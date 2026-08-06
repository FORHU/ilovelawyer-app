# Case Document upload + RAG — backend implementation spec

For whoever owns `ilovelawyer-api`. Companion to three ADRs in `ilovelawyer-app/docs/adr/`:

- [0008](adr/0008-case-document-rag-for-chat.md) — why (chunked retrieval, scoped to Case-linked Documents)
- [0009](adr/0009-case-document-upload-presigned-s3.md) — upload transport (presigned S3 URLs) — **confirmed live**
- [0010](adr/0010-case-document-rag-pipeline-parameters.md) — extraction/chunking/embedding/retrieval — **partially confirmed**
- [0011](adr/0011-case-document-s3-key-format.md) — case-scoped S3 key format — **not yet built, spec below (§6)**

This doc was originally written before the upload/link piece existed; it's now been verified against
the real, running API (Swagger spec + an end-to-end test: presign → S3 PUT → confirm → create Case →
link → Case page load, all succeeded). Section 1–3 below describe **what's actually live today** —
nothing to build there. Section 4 (the extraction/chunking/embedding/retrieval pipeline) is **not
confirmed** against the real implementation; treat it as questions to ask the BE team, not a build
spec, unless they tell you otherwise.

## 1. `POST /api/documents/presign` — confirmed live

Request:
```json
{ "filename": "contract.pdf", "contentType": "application/pdf" }
```

Response:
```json
{ "uploadUrl": "https://...", "key": "documents/{userId}/{uuid}-{filename}" }
```

Browser then PUTs the file bytes directly to `uploadUrl`.

## 2. `POST /api/documents` (confirm) — confirmed live

Request:
```json
{ "key": "documents/{userId}/{uuid}-contract.pdf", "name": "contract.pdf", "caseId": "optional-uuid" }
```

Response: 201, a `UserDocument`:
```json
{
  "id": "...", "userId": "...", "caseId": null, "name": "contract.pdf",
  "fileUrl": "https://.../documents/...", "aiSummary": null,
  "ragStatus": "PENDING", "s3Key": "documents/...", "createdAt": "..."
}
```

Per the endpoint's own Swagger description: "Content-type/size are validated post-hoc by that
pipeline, not here" — nothing is rejected at confirm time. Extraction dispatch fires whenever
`caseId` is present — either right here (if passed directly) or later, via §3.

## 3. `PATCH /api/documents/:id` — confirmed live

Request: `{ "name"?: string, "caseId"?: string | null, "aiSummary"?: string }` → 204.

This is how a Create Case upload (confirmed with no `caseId`, since the Case doesn't exist yet at
upload time) gets linked once the Case is created. Confirmed with the BE team that this transition
**also** triggers extraction dispatch — otherwise Create Case documents, which never carry `caseId`
at confirm time, would never get processed at all.

## 4. Extraction → chunking → embedding → retrieval — NOT CONFIRMED, ask before assuming

Everything below is the original recommended spec, carried over unverified. `ragStatus` existing and
transitioning `PENDING → READY/FAILED` is confirmed (the field is real); *how* it gets there is not.

Recommended shape, pending confirmation:

- **Extraction**: `pdf-parse` for PDF, `mammoth` for DOCX. No OCR — scanned/image-only PDFs should
  land on `ragStatus: "FAILED"`.
- **Chunking**: paragraph-boundary-aware splitting, ~2000 characters per chunk, ~300 character
  overlap, falling back to a hard character cut for one oversized paragraph.
- **Embedding**: reuse `embedText()` (`src/utils/embedding.ts`, `text-embedding-3-small`) — same model
  already used for legal-rag.
- **Storage**: a chunk+embedding table for Case Documents, distinct from legal-rag's
  externally-ingested `document_chunks` table (per ADR 0008 — don't touch that one).
- **`ragStatus` semantics**: `READY` once at least one chunk exists; `FAILED` on parse error *or* zero
  chunks (empty extraction counts as failed, not ready).
- **Retrieval trigger**: proactive — embed the user's incoming chat message and vector-search on every
  message in a Case-scoped conversation, rather than legal-rag's reactive `[RELATED_QUERIES]`-tag
  pattern. Ask the BE team which one they actually built.
- **Retrieval parameters**: top 5 chunks, `minSimilarity` 0.3 (matching `LegalRagRepo.vectorSearch`'s
  existing tuning), scoped to `conversation.caseId` and `ragStatus = 'READY'`.

## 5. Create Case now creates the case before uploading — align here if your build differs

As of 2026-08-04, `ilovelawyer-app`'s Create Case flow changed: it now creates the case first, then
uploads documents with `caseId` already known at confirm time. Previously it uploaded files
immediately on drag-and-drop, before the case existed, then linked them via `PATCH` afterward. This
was a frontend-only change — no backend contract change was required or made to ship it, because §1–3
above already supported everything it needed. If your current build has diverged from §1–3 (e.g. an
internal proposal floated requiring `caseId` on `presign` and case-scoped S3 keys), reconcile that with
the frontend team explicitly — don't let the two sides assume different contracts.

**Exact sequence the frontend now calls, in order, for Create Case:**

1. `POST /api/my-cases` → `{ id, ... }`
2. For each file:
   a. `POST /api/documents/presign` — request `{ filename, contentType }`, **no `caseId`** — response
      `{ uploadUrl, key }`, exactly as in §1.
   b. Browser `PUT`s the file bytes to `uploadUrl`.
   c. `POST /api/documents` — request `{ key, name, caseId }`, with `caseId` now always populated for
      this flow (previously always omitted here, linked later via `PATCH`).

**What this means for you:**

- `presign`'s contract must not start requiring `caseId` — the frontend still never sends one. If an
  internal proposal already added that requirement server-side, presign calls from Create Case will
  start failing; confirm before either side ships.
- Whatever key format `presign` returns is fine — the frontend only echoes `key` back into confirm
  unmodified, it doesn't parse or assume its structure. Changing `documents/{userId}/...` to
  `cases/{caseId}/documents/...` is safe *only if* it doesn't require adding `caseId` to the `presign`
  request itself (see above).
- Extraction dispatch firing at confirm-time (per §4/ADR 0010) is now the *only* path Create Case
  exercises — it never relies on the `PATCH`-triggered dispatch anymore. If that path was only ever
  tested via `PATCH`, retest it via direct confirm-with-`caseId`.
- The `PATCH /api/documents/:id` linking endpoint is no longer called by Create Case at all. It's still
  called nowhere else in the frontend today either — don't remove it (still a documented, generic
  capability), but don't expect traffic on it from this flow going forward.

**Orphaned-document risk (§4/ADR 0009), updated**: closed for Create Case specifically — a case now
always exists before any document is confirmed, so this flow can no longer produce a `caseId: null`
row. `document-analysis/page.tsx` still uploads with `caseId` optionally omitted, intentionally (a "no
case" choice, not a pending-link state) — that entry point still needs whatever cleanup/lifecycle
answer §4's open question already asked for.

## 6. Requested: case-scoped S3 keys — spec, not yet built

See [0011](adr/0011-case-document-s3-key-format.md) for the full rationale. Summary of what's being
asked for:

- `POST /api/documents/presign` request gains an optional `caseId` field:
  `{ filename, contentType, caseId? }`. This is additive — still never required, so it doesn't
  conflict with §5's rule that presign must keep working with no `caseId` (Document Analysis's
  "No Case" upload still won't send one). The frontend now sends `caseId` whenever the caller has
  one — every call site except Document Analysis's "No Case" selection.
- Key format branches on whether `caseId` was sent:
  - With: `documents/cases/{caseId}/{timestamp}-{shortId}.{ext}`
  - Without: `documents/users/{userId}/{timestamp}-{shortId}.{ext}`
- `{shortId}`: a short random token (e.g. `crypto.randomUUID()`), required for uniqueness — Create
  Case uploads multiple files to the same case concurrently (`Promise.all`), so a timestamp alone
  can collide and silently overwrite a file in S3.
- `{ext}`: from the original filename's extension, not `contentType`.
- Original filename is intentionally dropped from the key (it's already on `UserDocument.name`).
- Existing objects keep their current `documents/{userId}/{uuid}-{filename}` keys — no migration,
  since each row stores its own `s3Key` independently. This only affects new uploads going forward.

**Confirmed live behavior, and a sequencing warning**: `presign`'s request validation is a strict
allowlist (Joi, no `.unknown(true)`) — sending `caseId` before the backend explicitly accepts it
400s every upload with `"caseId" is not allowed`, it does not silently ignore the extra field.
The frontend briefly sent it ahead of backend support and broke uploads end-to-end; that's been
reverted for now. **Please land backend support for `caseId` on `presign` before telling the
frontend team to re-enable sending it** — this can't be rolled out on both sides simultaneously
without a coordinated flag day.

## Known open question

Whether `POST /api/documents/presign` + confirm enforce a `HeadObject` existence check, and whether
orphaned Documents (Create Case uploads never submitted, `caseId` stays null forever) get cleaned up —
neither was confirmed. Worth a direct question to the BE team rather than assuming either answer.
