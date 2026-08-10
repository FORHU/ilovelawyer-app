# 0010: Case Document RAG pipeline — extraction, chunking, embedding, and retrieval parameters

## Status

Partially confirmed. The API-level contract (dispatch trigger, `ragStatus` field/enum) is confirmed
live via the actual Swagger spec and a working end-to-end test. The internals below the API surface —
extraction libraries, chunk size, embedding model choice, retrieval trigger shape, retrieval query
parameters — are **not verified against the real implementation**; they're the original recommended
spec from this ADR's first draft, carried forward unconfirmed. Treat that part as "what to check with
the BE team," not as settled fact.

Extends ADR 0008 (which decided the shape — chunked retrieval via pgvector, scoped to Case-linked
Documents, fire-and-forget dispatch). Depends on ADR 0009 for the confirmed upload/link contract.

## Context

ADR 0008 established the pattern to reuse ("the pattern, not the data, is reusable") from the
existing legal-rag feature (`legal-rag.repository.ts`, pgvector, `embedText()` /
`text-embedding-3-small`), but stopped short of concrete parameters.

Checking how legal-rag actually integrates with chat surfaced a mismatch with ADR 0008's own
description: legal-rag's chat integration is reactive, not proactive. Chat Wonder's response contains
`[RELATED_QUERIES]` tags, which `ChatSvc` resolves server-side (`LegalRagRepo.findForRelatedTerm`) to
specific documents. There is no "embed every message and vector-search" code path anywhere in
`ilovelawyer-api`'s legal-rag feature — despite ADR 0008 describing Case Document retrieval exactly
that way. Whether the BE team built Case Document retrieval to match ADR 0008's proactive description
or mirrored legal-rag's reactive pattern instead is unconfirmed.

## Confirmed (from the live API contract)

- `UserDocument` has a `ragStatus` field: enum `"PENDING" | "READY" | "FAILED"` (not the
  `pending`/`ready`/`failed` lowercase this ADR originally specified — case matters, correct it in any
  implementation that reads this field).
- Dispatch trigger: extraction/embedding fires whenever a Document has a `caseId` — either at confirm
  time (`POST /api/documents`, if `caseId` is passed directly) or via the later
  `PATCH /api/documents/:id` transition (when a Create Case upload, confirmed with no `caseId`, gets
  linked to the newly-created Case). This matters because Create Case uploads never have `caseId` at
  confirm time — if dispatch only happened at confirm, those documents would never get processed at
  all. Confirmed with the BE team that `PATCH` also triggers it.

## Recommended (not yet confirmed against the real implementation)

- **Extraction**: `pdf-parse` for PDF, `mammoth` for DOCX — both pure-JS, no native/system
  dependencies. Scanned/image-only PDFs out of scope (no OCR) — a failed/empty extraction should
  result in `ragStatus: "FAILED"`, consistent with ADR 0008's "stays silently absent" behavior.
- **Chunking**: paragraph-boundary-aware splitting (falls back to hard character cuts for one
  oversized paragraph), ~2000 characters per chunk, ~300 character overlap.
- **Embedding**: reuse the existing `embedText()` utility and `text-embedding-3-small` model
  (`src/utils/embedding.ts`) — the same model already used for legal-rag, even though the chunks live
  in a separate table.
- **Storage**: a chunk+embedding table for Case Documents, distinct from legal-rag's
  externally-ingested `document_chunks` table (per ADR 0008).
- **Retrieval trigger**: proactive — embed the user's incoming chat message and vector-search Case
  Document chunks on every message in a Case-scoped conversation, rather than mirroring legal-rag's
  `[RELATED_QUERIES]`-tag pattern.
- **Retrieval parameters**: top 5 chunks, `minSimilarity` 0.3 — reusing
  `LegalRagRepo.vectorSearch`'s already-tuned defaults.

## Consequences

- If retrieval does turn out to be proactive (per the recommendation above), every message in a
  Case-scoped conversation costs one extra embedding call plus one pgvector query, regardless of
  whether the question needs document content. Not yet a confirmed cost — depends on which retrieval
  shape was actually built.
- `ragStatus` is never surfaced to the user as an error either way (per the confirm endpoint's own
  description) — a Document uploaded moments ago may not yet be searchable with no UI indication of
  that.
