# Case Workspace as a parallel route, sharing logic but not markup, with the existing Case detail page

Status: accepted

We're replicating a NotebookLM-style three-panel layout (Sources / Chat / Studio) for the Case detail page, requested against a live reference design. Rather than editing `/homepage/case-portfolio/[id]/page.tsx` in place, it ships as a new, independent route — `/homepage/v2/case-portfolio/[id]/page.tsx` — so the shipped page keeps working unmodified while the new layout is validated. This is the first `/v2/`-style parallel route in this app; there was no prior precedent for it.

The two pages do share the non-visual layer: message streaming/send, `useCaseDocumentsQuery`, Mind Map/Timeline data, and Conversation switching are pulled into hooks consumed by both pages, rather than copy-pasted. The alternative — a full copy-paste fork — was rejected because it would leave two divergent copies of streaming/upload/RAG-indexing logic (see `docs/adr/0008-case-document-rag-for-chat.md`, `0009`, `0010`), so a future fix to any of that (e.g. an embedding-indexing bug) would need to land in two places or silently drift.

Case Workspace (the new layout) intentionally does not replicate the reference design in full: no include/exclude checkboxes on Sources, no non-functional toolbar chrome (Copy/Analytics/Share/Settings/"Public" badge), no forced dark theme, and only 3 of the reference's 9 Studio tiles (Mind Map, Timeline, Audio Overview) — the rest were out of scope as this is a layout replication using this app's existing features, not a clone of NotebookLM's generative toolset.
