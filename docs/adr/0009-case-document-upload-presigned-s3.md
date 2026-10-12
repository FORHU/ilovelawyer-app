# 0009: Case Document uploads move from backend-proxied to presigned S3 URLs

## Status

Implemented and verified live (`ilovelawyer-api` built this ahead of/independently from this ADR's
first draft — the shape below is the actual contract, confirmed by reading its live Swagger spec and
by an end-to-end test: presign → S3 PUT → confirm → create Case → link → Case page load, all
succeeded). Originally written as a forward-looking design; corrected here to match reality rather
than superseded, since the actual decision landed in the same place this ADR intended.

## Context

Case Document upload used to be a single `POST /api/documents` multipart call: the browser posted the
file to `ilovelawyer-api`, which buffered it via `multer.memoryStorage()` and itself called
`PutObjectCommand` to write it to S3 (`src/utils/s3.ts`). That round-tripped every uploaded byte
through the backend process.

The frontend was migrated to a presigned-URL, direct-to-S3 flow instead: the browser asks the backend
for a one-time upload link, PUTs the file straight to S3, then tells the backend it's done. This takes
the backend out of the file-bytes path entirely. `apps/web/lib/cases/mutations.ts`'s
`useUploadCaseDocumentMutation` implements the frontend side.

## Decision (confirmed contract, as implemented)

- **`POST /api/documents/presign`** — request: `{ filename: string, contentType: string }` (both
  required). Response: `{ uploadUrl: string, key: string }`. The key is of the form
  `documents/{userId}/{uuid}-{filename}` — keyed on the uploading user, not a case id, since a Create
  Case upload happens before the Case exists. It never moves or gets re-keyed once a Case is later
  linked; only the DB row's `caseId` changes.
- The browser PUTs the file bytes directly to `uploadUrl`.
- **`POST /api/documents`** (repurposed as confirm) — request: `{ key: string, name: string, caseId?: string }`
  (`key` and `name` required). Response: 201, a `UserDocument` including a `ragStatus` field (see ADR
  0010). Per the endpoint's own description: "Content-type/size are validated post-hoc by that
  pipeline, not here" — i.e. not rejected at upload time, but not entirely unchecked either; whatever
  the extraction pipeline does with a mismatched/oversized file is where that validation actually
  happens (see ADR 0010's extraction step).
- **`PATCH /api/documents/:id`** (linking an already-uploaded Document to a Case once it's created) —
  unchanged: `{ name?, caseId?, aiSummary? }` → 204.
- Whether confirm calls `HeadObject` to verify the S3 object actually exists before creating the row
  is not confirmed either way — no evidence from the API contract alone, and the backend source wasn't
  read directly for this ADR.

## Consequences

- A Document uploaded during Create Case but never submitted (form abandoned) leaves a `UserDocument`
  row with `caseId = null` and a real S3 object. Whether anything cleans these up over time is
  unconfirmed — worth asking the BE team directly rather than assuming either way.
- `POST /api/documents`'s request contract changed (multipart file → JSON body) — the frontend was
  updated to match (`useUploadCaseDocumentMutation`).

## Addendum: 1 GB upload limit

One upload — everything a person picks or drops at once, plus files already queued on that screen
(Create Case's list, chat attachments) — may total at most 1 GB (1024³ bytes). There is no separate
per-file cap; the old client-only 25 MB per-file limit was removed, so one file can be up to 1 GB.

- **Web:** `checkUploadSelection` (`apps/web/lib/cases/upload-batch.ts`) drops unsupported types,
  then rejects a selection over 1 GB whole and shows `UploadLimitBanner` with the total. Nothing
  from that selection uploads. The upload mutations re-check as a backstop.
- **API:** presign and confirm reject a request whose files total over 1 GB with a 413
  (`UPLOAD_BATCH_TOO_LARGE`). Presign takes each file's `fileSize` and signs it into the URL, so S3
  rejects (403) a PUT of any other size. `fileSize` on presign is optional until this web release is
  verified in production, then becomes required. Upload URLs now expire after 1 hour, not 5 minutes.
- **Known limitation:** the API checks 1 GB per request, and a request carries at most 50 files. A
  selection the web app splits across several requests is held to 1 GB in total only by the web
  app; a client calling the API directly could exceed it by splitting files across requests.
  Revisit with an upload batch id or a per-user rolling quota if direct-API abuse shows up.
- **Extraction:** every file stays eligible for text extraction and indexing whatever its size.
  See ilovelawyer-api's `DocumentExtractionSvc` (temp-file download, streamed TXT/large XLSX,
  size-scaled job timeout) and the opt-in standalone extraction worker (`DOCUMENT_EXTRACTION_IN_API`).
  Text with no blank lines is chunked as packed lines up to the tier's chunk size (not one chunk per
  line), and documents over 3,200 chunks are embedded and stored in rounds so memory stays flat.
  Case analysis reads document text through `DocumentChunkRepo.findFullTextsByDocuments`, which now
  stops at the caller's per-document budget, or 5M characters by default, instead of loading every
  chunk; a 45 MB spreadsheet's full 112M characters ran the API out of memory.
