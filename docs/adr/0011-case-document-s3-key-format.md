# 0011: Case Document S3 key format — case-scoped folders, timestamp + random suffix

## Status

Proposed. Not yet implemented on the live backend — the `presign` implementation lives in
`ilovelawyer-api`'s deployed dev environment, which is ahead of the `ilovelawyer-api` checkout
available when this ADR was written (that checkout, local and `origin/staging`, has no `presign`
route at all — still the old multipart `POST /api/documents` flow from before ADR 0009). This ADR
records the frontend-side decision and the contract change it requires; the backend-side
implementation is handed off in `docs/case-document-rag-backend-handoff.md`.

**Rollout note (confirmed against the live dev backend):** the frontend briefly forwarded `caseId`
to `presign` ahead of backend support and broke every upload — the live endpoint validates its
body against a strict allowlist (Joi with no `.unknown(true)`) and 400s with `"caseId" is not
allowed` on any unrecognized field. This is not a "safe to add, backend just ignores it" situation;
the two sides must land in order: backend accepts `caseId` on `presign` **first**, frontend starts
sending it **after**, confirmed working. The frontend change has been reverted in the meantime
(`useUploadCaseDocumentMutation` no longer sends `caseId` to presign).

## Context

ADR 0009 documented the presign key as `documents/{userId}/{uuid}-{filename}`, keyed on the
uploading user because a Create Case upload happened before the Case existed. Since then (backend
handoff doc §5), Create Case now creates the Case first and uploads with `caseId` already known at
confirm time — so for that flow, the "the case doesn't exist yet" reason ADR 0009 gave no longer
applies.

Browsing the bucket by user id scatters a case's documents across whichever users touched them
instead of grouping them; a case-scoped folder is easier to browse and reason about.

One entry point still uploads with no case at all: `document-analysis/page.tsx`'s "No Case" option
(`apps/web/app/(protected)/homepage/document-analysis/page.tsx:30`) is a deliberate case-less
upload, not a pending-link state — a purely case-scoped key format has no home for it.

Multiple files can also be presigned concurrently for the same case:
`create-case/page.tsx`'s `handleSubmitFiling` uploads every pending file via `Promise.all`
(line 220). A key built from a timestamp alone risks two files landing on the same millisecond,
with one silently overwriting the other in S3 (`PutObject` has no conflict detection).

## Decision

- The key branches on whether `caseId` is known at presign time:
  - With a case: `documents/cases/{caseId}/{timestamp}-{shortId}.{ext}`
  - Without a case (Document Analysis's "No Case" upload): `documents/users/{userId}/{timestamp}-{shortId}.{ext}`
- `{shortId}` is a short random token (e.g. `crypto.randomUUID()`). It exists purely to guarantee
  uniqueness when two files in the same case/user land on the same timestamp (see the
  `Promise.all` case above) — a client-incrementing or server-side-counter scheme was considered
  and rejected, since both need new coordination (a request field or a per-case atomic counter)
  that a random token gets for free.
- `{ext}` is derived from the original filename's extension, not from `contentType`.
- The original filename is dropped from the key entirely. It's already stored separately on
  `UserDocument.name`, so nothing depends on it being in the S3 key — the trade-off is that
  browsing the bucket directly (S3 console, etc.) shows opaque names instead of the source
  filename.
- **Contract change**: `POST /api/documents/presign` gains an optional `caseId` field —
  `{ filename, contentType, caseId? }`. Still never *required*: Document Analysis's "No Case"
  path omits it, which is exactly what selects the `documents/users/{userId}/...` branch above.
  The frontend now sends it (`useUploadCaseDocumentMutation`, `apps/web/lib/cases/mutations.ts`)
  whenever the caller already has a `caseId` — which is every call site except Document
  Analysis's "No Case" selection.
- This changes only newly-created keys. Existing objects keep their
  `documents/{userId}/{uuid}-{filename}` keys (ADR 0009) — each `UserDocument` row stores its own
  `s3Key`/`fileUrl` independently, so there's nothing to migrate.

## Consequences

- Backend work required: `presign` must accept and use the new optional `caseId` field to branch
  the key format. Not yet implemented anywhere reachable from this repo's tooling — see the
  handoff doc for the spec.
- Document Analysis's "No Case" option keeps working, now landing in
  `documents/users/{userId}/...` instead of a case folder.
- Bulk "delete all documents in a case" by S3 prefix becomes possible later (not implemented now),
  since a case's objects now share a `documents/cases/{caseId}/` prefix.
- `presign`'s response shape (`{ uploadUrl, key }`) is unchanged — only the request gains a field.
  The frontend still treats `key` as opaque and echoes it back to confirm unmodified.
