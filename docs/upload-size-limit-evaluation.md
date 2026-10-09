# Upload size limit: evaluation

Part of FORHU/ilovelawyer-api#91 (upload governance).

Branch: `fix/raise-upload-size-limit`. Line numbers checked against `main` @ `197fb087` (app) and `fb9ddd32` (api), 2026-10-09.

## Summary

Lawyers say the 25 MB per-file limit is too small for legal bundles with many pages, annexes and exhibits.

The issue's diagnosis is correct. 25 MB is a limit that only exists in the browser, it was chosen by accident, and nothing on the server enforces it or any other size. Several of the issue's details are out of date, though, and raising the number alone would leave the server without a limit and let large files fail later in extraction.

## What the issue gets right

- **The number was copied from an unrelated route.** `ilovelawyer-api/src/routes/files.route.ts:7` sets multer's `fileSize: 25 * 1024 * 1024` for `POST /files/upload`. That route is not the one case documents use.
- **Case documents have no server-side size limit.**
  - `ilovelawyer-api/src/utils/s3.ts:62` signs a presigned `PutObjectCommand` with only `Bucket`, `Key` and `ContentType`, so S3 accepts any size.
  - `fileSize` in `ilovelawyer-api/src/validation/document.validation.ts:39` is optional and only has to be at least 0. The client reports it after it has uploaded the file, so it limits nothing.
- **Uploading several files at once already works.** `MAX_ATTACHED_FILES = 10` ([consultation-chat.tsx:147](../apps/web/components/chat/consultation-chat.tsx#L147)) and the file input has `multiple` ([consultation-chat.tsx:1812](../apps/web/components/chat/consultation-chat.tsx#L1812)). The only real complaint is that 25 MB is too small.

## What is out of date

| The issue says | The code now |
|---|---|
| `MAX_FILE_SIZE_BYTES` is defined at `consultation-chat.tsx:98` | It is defined once in [lib/cases/upload-batch.ts:87](../apps/web/lib/cases/upload-batch.ts#L87) and imported everywhere |
| `MAX_ATTACHED_FILES` is at line 92 | Line 147 |
| `multiple` is at line 1056 | Line 1812 |
| The Document Analysis page has no limit | That page no longer exists (`app/(protected)/homepage/document-analysis/` is gone) |
| The limit only applies in chat | It applies in four upload paths (below) |

The 25 MB check runs in these places:

1. Chat attachments: [consultation-chat.tsx:1227](../apps/web/components/chat/consultation-chat.tsx#L1227)
2. Create Case: [create-case/page.tsx:352](../apps/web/app/(protected)/homepage/create-case/page.tsx#L352)
3. Case document browser: [document-folder-browser.tsx:137](../apps/web/components/cases/document-folder-browser.tsx#L137)
4. Terminal upload: [use-case-document-upload.ts:31](../apps/web/lib/terminal/use-case-document-upload.ts#L31)

All four import the same constant, so changing `upload-batch.ts:87` raises the limit everywhere. The "over the N MB limit" error messages compute N from the constant, so they update too.

## What the issue misses

1. **A presigned PUT cannot enforce a size.** To limit uploads on the server, the API needs one of these:
   - Switch to a presigned POST (`createPresignedPost`) with a `content-length-range` condition, so S3 refuses oversized uploads.
   - Keep PUT, but have `DocumentSvc.create` run `HeadObject` before saving the document record, and delete and reject anything over the cap.

   Either way, the API should own the value as a single constant that the app copies or reads, so the two sides cannot drift apart.
2. **Extraction loads the whole file into memory.** The API calls `getObjectBuffer` to read the whole object before parsing (the root-level `_debug_50mb.ts` script was profiling exactly this). The extraction queue runs 3 jobs at once, so the worst case is roughly 3 times the cap in buffers, plus whatever the PDF parser itself uses. The cap has to fit inside the API container's memory.
3. **Images have a lower limit than PDFs.** Scanned PDFs go to asynchronous Textract via S3, which allows up to 500 MB and 3,000 pages. Images go to synchronous `DetectDocumentText` (`ilovelawyer-api/src/utils/document-text-extraction.ts:147-152`), which rejects files over 5 MB (the limit given in that file's own comment at line 165; check it against the current AWS limits for passing bytes directly). A large photo or scan would upload successfully and then fail at extraction. Either give images their own lower cap or move them to the asynchronous path.

## Recommended fix

| Step | Repo | Change |
|---|---|---|
| 1 | api | Add one constant for the document size cap (decided: 25 MB, see below). |
| 2 | api | Enforce it on the server, with a presigned POST plus `content-length-range`, or with a `HeadObject` check in `DocumentSvc.create`. |
| 3 | api | Cap images separately at 5 MB, unless image OCR moves to async Textract. |
| 4 | app | Set `MAX_FILE_SIZE_BYTES` in `upload-batch.ts:87` to the same value, and add the image cap to the client-side checks. |
| 5 | both | Test with a file just under and just over the cap, a scanned PDF, and a large image. |

**Decision: the cap stays at 25 MB.** What changes is that 25 MB is now a deliberate limit the API enforces, not only a number in the browser. 100 MB was considered and turned down. Raising the cap later means changing the two constants together, after checking it against the API container's memory (3 extraction jobs run at once, each holding a whole file in memory).

## Implementation (uncommitted, for review)

Branches: `fix/raise-upload-size-limit` (app) and `fix/document-upload-size-cap` (api).

**api**
- `constants/document-upload.constants.ts`: `DOCUMENT_MAX_BYTES` (25 MB), `IMAGE_DOCUMENT_MAX_BYTES` (5 MB) and the list of image extensions.
- `utils/s3.ts`: `getObjectSize` (HeadObject) and `deleteS3Object`.
- `utils/document-size.ts`: `assertUploadedSizesAllowed` reads each file's real size from S3. If any file is over its cap, it deletes those objects and refuses the request with a 413, before any database row is written. A file that was never uploaded is refused with a 400.
- `DocumentSvc.create`, `DocumentSvc.createMany` and `CaseSvc.handleCreateCaseWithDocument` run the check after the access check, and store the size S3 reports instead of the size the client sent.
- Joi: client-reported `fileSize` now has a maximum of `DOCUMENT_MAX_BYTES`, so it fails early.
- Tests: `test/document-upload-size.spec.ts` (new); `document-upload-case-access.spec.ts` now stubs `getObjectSize`.

The cap is enforced when the upload is confirmed, not by S3 itself. A presigned PUT still lets an oversized file reach the bucket, and it is deleted when the upload is confirmed. Switching to a presigned POST with `content-length-range` would stop it reaching S3 at all, but every upload surface in the app would have to change, so it was left for later.

**app**
- `lib/cases/upload-batch.ts`: `MAX_FILE_SIZE_BYTES` stays at 25 MB, now matching the API. Also adds a new 5 MB image cap and the helpers `maxFileSizeBytes`, `isWithinSizeLimit` and `oversizedFilesLabel`.
- The four upload paths use `isWithinSizeLimit`. The toast now names each rejected file with its own limit, e.g. "scan.png (5MB limit)".
- Tests: `lib/cases/__tests__/upload-batch.test.ts` (new).

## Open questions

- What memory does the API container in production actually get? That sets the safe cap.
- Should the cap differ by plan or tenant? Today it is one global value.
- Do we raise the client limit now and add the server cap afterwards? That's quicker for lawyers, but in the meantime uploads would still have no server limit at all.
