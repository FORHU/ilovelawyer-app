# 0008: Case Documents are retrieved into chat via chunked embeddings, scoped to their Case

## Status

Accepted. Backend work not yet started (spec handed off — see the instructions produced alongside
this ADR). Frontend work (Case Details document list, in-chat upload) tracked separately.

## Context

Two gaps existed side by side:

- A Case's uploaded evidentiary Documents (`ilovelawyer-app/apps/web/app/(protected)/homepage/create-case/page.tsx`)
  are correctly stored (S3) and linked to their Case (`caseId` on `UserDocument`), but nothing ever
  reads their content back out. The Case's chat has no way to answer a question using what's in an
  uploaded file.
- `CONTEXT.md`'s Pending section previously described Document content/RAG as "explicitly out of
  scope" for Case Chat. That was written before the backend shipped `actionType`/`jurisdiction`/
  structured `Party` support and `CaseSvc.formatForAiContext()` (which already injects the Case's
  structured fields into every chat message) — the premise had moved on without the doc catching up.

Three shapes were considered for "the chatbot can look into an uploaded file":

1. **Full text stuffed into the prompt.** Extract the whole file's text once, send it (or a capped
   slice) as context on every message. Simplest, but a large PDF can blow past the model's context
   window, and a truncation cutoff silently drops whatever falls after it — no way to know which
   part of a long document the model actually saw.
2. **Chunked retrieval (RAG).** Extract, split into chunks, embed each chunk, and retrieve only the
   chunks relevant to the current question at send time. Scales to large/many documents. This is
   real new infrastructure — but `ilovelawyer-api` already runs exactly this shape for the separate
   legal-corpus RAG feature (`legal-rag.repository.ts`, `pgvector`, `src/utils/embedding.ts`'s
   `embedText()` using `text-embedding-3-small`) — the pattern, not the data, is reusable.
3. **Metadata-only awareness.** Tell the model which filenames exist, no content. Cheapest, but
   doesn't satisfy "look into" the file — the model can acknowledge a file exists and nothing more.

## Decision

Chunked retrieval (RAG), scoped to Case-linked Documents only:

- A Document only feeds retrieval once it has a `caseId` (set either at Create Case time, once the
  Case is created, or immediately for an in-chat upload inside a Case's chat). The general
  `/homepage` chat (no Case) does not get document retrieval — there's no Case to scope it to, and
  retrieving across a user's *entire* document history risks pulling an unrelated case's chunks into
  the wrong conversation.
- Extraction → chunking → embedding runs fire-and-forget right after the upload responds, mirroring
  the existing pattern for conversation-title generation (`ChatSvc.generateAndSaveTitle`, dispatched
  with `.catch(() => {})` and never awaited by the caller). No job queue exists in `ilovelawyer-api`
  today, so this was chosen over standing up new queue infrastructure for a first version.
- Until embedding finishes, a Document is silently absent from retrieval — no blocking, no
  processing spinner tied to AI-readiness. A document that fails extraction (e.g. a scanned,
  image-only PDF with no extractable text layer) stays silently absent too, rather than surfacing an
  error that would interrupt the chat.
- Retrieval happens entirely server-side: the backend embeds the user's message and searches chunks
  scoped to `conversation.caseId`, the same way it already re-derives the Case's structured-field
  context fresh on every message rather than trusting anything the client sends. The frontend does
  not participate in assembling document context.
- Only PDF and DOCX are accepted for Case Documents going forward, enforced server-side (previously
  the upload endpoint accepted any file type up to 25MB with no filter at all — the Create Case
  form's `accept=".pdf,.docx"` was a picker hint only, silently bypassed by drag-and-drop).

## Consequences

- New dependency: a PDF/DOCX text-extraction library in `ilovelawyer-api` (none exists today).
- New schema: a chunk+embedding table and a readiness marker on `UserDocument`, both owned by this
  app (distinct from the legal corpus's `document_chunks`, which belongs to an external ingestion
  pipeline and is deliberately unmodeled in this repo's Prisma schema).
- A Document uploaded moments ago may not yet be searchable — acceptable for a first version, but if
  users report "I just uploaded this and the chatbot doesn't see it," the fire-and-forget +
  no-status-surfaced choice is the first thing to revisit.
- The general `/homepage` chat still cannot reference any uploaded file. Extending retrieval there
  would need a different scoping key than `caseId` (e.g. per-conversation attachments) — deliberately
  deferred, not designed here.
