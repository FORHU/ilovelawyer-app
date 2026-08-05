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
