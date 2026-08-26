# ilovelawyer-app (frontend)

Web frontend for ilovelawyer — a Next.js App Router application that consumes the `ilovelawyer-api` backend.

Mirrors the domain language established in `ilovelawyer-api/CONTEXT.md`. Terms defined there (Session, Access Token, Refresh Token, Logout) apply here unless explicitly overridden below.

## Language

**Access Token**
Short-lived JWT returned in the login/Google OAuth response body. Held in memory only (Zustand store) — never written to `localStorage` or `sessionStorage`. Attached to every API request as `Authorization: Bearer <token>` by `apiFetch`.
_Avoid_: "auth token", "JWT token"

**Refresh Token**
Longer-lived JWT returned alongside the Access Token. Never held in frontend JS — set by the backend as an httpOnly cookie (`refreshTokenCookie.ts`), scoped to the `/api/auth` path, so the frontend can neither read nor store it directly. Used exclusively to mint a new Access Token when the current one expires.
_Avoid_: "session token" (ambiguous with the backend's Session concept), "stored in localStorage/sessionStorage" (that was the old design; the token now never reaches frontend JS)

**Remember Session**
A login-form preference sent to the backend, which controls the Refresh Token cookie's `maxAge`: set (persists across browser restarts) when checked, omitted (browser-session cookie, cleared on browser close) when unchecked. Implemented entirely server-side in `setRefreshTokenCookie`— not a frontend storage choice.
_Avoid_: "stay logged in", "keep me signed in" (use the exact label from the UI: "Remember session"), "controls localStorage vs sessionStorage" (outdated — see Refresh Token)

**Auth Store**
The Zustand store (`useAuthStore`) that holds the Access Token and current User in memory. The single source of truth for whether the app considers the user authenticated. Initialized on app mount by attempting a silent refresh using any persisted Refresh Token.
_Avoid_: "auth context", "session store"

**Silent Refresh**
The process of calling `POST /api/auth/refresh` with a persisted Refresh Token on app mount, before any protected page renders, to restore the Access Token without requiring the user to log in again.
_Avoid_: "auto-login", "token hydration"

**Protected Route**
Any route under the `(protected)` layout group that requires an authenticated user. The layout performs a client-side guard: if the Auth Store has no Access Token after Silent Refresh completes, it redirects to `/login`.
_Avoid_: "private route", "authenticated page"

**Username**
A unique, URL-safe identifier auto-generated from the user's Full Name at signup (e.g., "Juan Cruz" → `"juan.cruz.4k2"`). The user never explicitly chooses it during signup. Maps to the `username` field on the backend User model.
_Avoid_: "handle", "user ID"

**Full Name**
The display name a user provides at signup. Stored as `name` on the backend User model. Distinct from Username.
_Avoid_: "name" (ambiguous — always say Full Name in UI copy and "name" only when referring to the API field)

**Conversation**
A saved thread of chat messages between a user and the AI, identified by an id reflected in the URL (`/homepage?c=<conversationId>`) so it survives a refresh. Listed in the sidebar, most-recently-created first. The `/homepage` page's UI copy (nav tab, headline) calls this "Consultation" — same concept, just the user-facing label; the code and this glossary use Conversation.
_Avoid_: "chat", "session" (ambiguous with the backend's Session concept)

**Conversation Title**
The label shown for a Conversation in the sidebar. Intended to be an AI-generated topical summary (e.g., "Wrongful Termination — Retaliatory Dismissal"), set once by the backend after the first exchange — not something the user types in. Until that backend generation work ships, the frontend falls back to a naive truncation of the user's first message.
_Avoid_: "conversation name" (this app calls it Title, matching the `title` field)

**Case**
A litigation filing record a user creates via the Create Case form: a Case Title, Type of Action, Jurisdiction, one or more Parties, and uploaded evidentiary Documents (see Case Document). Created through `POST /api/my-cases`.
_Avoid_: "matter", "filing" (use Case for the record itself; "filing" is fine as a verb for the act of submitting one), "POST /api/cases" (the actual mount path is `/api/my-cases`)

**Case Portfolio**
The list/browse view of all Cases a user has created — a "recent cases" tab, not a distinct record type of its own. Every Case a user creates appears here; there is no separate step to add one.
_Avoid_: "portfolio" alone (always pair with "Case" to avoid confusion with a document/evidence portfolio)

**Party**
A person or entity involved in a Case, captured as a Full Name and a Designation. A Case has one or more Parties.

**Designation**
A Party's role within a Case: Petitioner/Plaintiff, Respondent/Defendant, or Intervenor/Third-Party.

**Case Document**
A file (PDF or DOCX) uploaded as evidence and linked to a Case. Uploaded either during Create Case (before the Case exists — linked to it once created) or, going forward, from within that Case's own chat. Shortly after upload it becomes something the Case's chat can search and reference when answering — see `docs/adr/0008-case-document-rag-for-chat.md`. Distinct from a Case Law Document (an ingested case/statute record from an external corpus), a Generated Article (AI-written Library content), and a Related Case (an AI-surfaced citation) — none of these four are the same kind of "document."
_Avoid_: "document" alone (ambiguous with Case Law Document, Generated Article, and Related Case — always say Case Document for an uploaded evidentiary file), "attachment" (this app's chat/upload UI copy doesn't use that word)

**Related Case**
A legal-precedent citation (title, case/RA number, source url, snippet, relevance score, `vetted` flag) that Chat Wonder surfaces alongside its reply to a Conversation message, fetched per-Conversation via `GET /api/chat/consultations/:id/related-cases`. Sourced from Chat Wonder's own retrieval at answer time — not queried from this app's `documents` corpus, so it is a different kind of citation from a Case Law Document even though both point at case law. Empty until at least one message has been sent in the Conversation.
_Avoid_: "case law document" or "legal document" (both mean the corpus-backed Case Law Document, a different retrieval path), "citation" alone

## Case Workspace (v2)

**Case Workspace**
The three-panel (Sources / Chat / Studio) layout for a Case's detail page, at `/homepage/v2/case-portfolio/[id]`. A parallel presentation of the same Case detail page that lives at `/homepage/case-portfolio/[id]` — same Case, same Conversations, same data, different layout. See `docs/adr/0012-case-workspace-parallel-route.md`.
_Avoid_: "case portfolio v2", "notebook" (this app has no notebook concept — that's the reference design's vocabulary, not this app's)

**Sources Panel**
The Case Workspace's left panel. Two tabs: a Documents tab (a Case's Case Documents) and a Related Cases tab (the active Conversation's Related Cases). Independently collapsible to a slim rail.

**Studio Panel**
The Case Workspace's right panel. Four tiles: Mind Map, Timeline, Data Table (each opens inline in the panel itself — the panel widens, per-tile, and shows a "Studio > {tile}" breadcrumb with a back control, not a modal), and Audio Overview (visible but disabled — see Pending, below). A tile's own click triggers its action (generate for Mind Map, refresh for Timeline/Data Table) without opening the view; a separate Result Row is what opens it, once there's something to show. Independently collapsible to a slim rail. Deliberately does not include the reference design's other tiles (Slide Deck, Video Overview, Reports, Flashcards, Quiz, Infographic) — Case Workspace replicates the reference's layout, not its full generative toolset.

**Result Row**
A Studio Panel row, listed below the tile grid once a tile actually has something to show (generating, or already generated/fetched) — e.g. "Mind Map · Updated 2m ago". Clicking it opens that tile's inline view. Distinct from the tile above it, which only triggers the tile's action (generate/refresh) and never opens the view itself.

**Audio Overview**
A Studio Panel tile. Two AI hosts (Host A / Host B) discussing the case back-and-forth, in distinct AWS Polly voices, as a single playable track — not a narration read aloud. Deliberately distinct from Case Reconstruction's existing Audio narration, which is one voice reading one already-written narrative field; Audio Overview has no written-narrative counterpart to read — the dialogue script is the artifact. The script (chat-triggered — see `docs/adr/0002-audio-overview-chat-triggered-generation.md` in ilovelawyer-api) and its rendered audio (ffmpeg-merged Polly clips — `docs/adr/0003-audio-overview-ffmpeg-merge.md`) are separate steps: generating/regenerating the script never re-renders audio automatically.
_Avoid_: "podcast" in code/schema naming (fine in conversation) — Audio Overview is this glossary's canonical term; "narration" (that's Case Reconstruction's Audio, a different feature)

## Legal Terminal

A separate multi-pane case workspace from Case Workspace (above) — freeform rather than a fixed three-panel layout, and with a much larger catalog of panes (18, vs. Case Workspace's 3 Studio tiles). The two features share no code and are never shown on the same page, but their names collide enough in writing that this glossary always qualifies "workspace" — see Terminal Workspace, below.

**Pane**
A single draggable/resizable tile in the Legal Terminal grid (`/homepage/terminal/[caseId]`), rendering one Panel Catalog entry's content. Freely positioned, not confined to a fixed grid cell — moved by dragging its header's grip handle, resized from any edge or corner.
_Avoid_: "panel" in UI copy or glossary writing — matches this feature's own UI copy ("Add pane", "Hide pane", "1 pane"/"2 panes"). The code's type names (`PanelId`, `PanelLayout`, `TerminalPanelBody`) keep "Panel" as-is; that's a naming a future refactor shouldn't chase.

**Panel Catalog**
The full set of possible Pane types (`useTerminalCatalogQuery`), each with an id (`PanelId`), a label, and an `available` flag. Not all of them are visible by default — see Suggested Pane.

**Suggested Pane**
A hidden Panel Catalog entry surfaced in the toolbar because its backing data already exists in the case snapshot — a heuristic frontend-only check, not an AI judgment call.
_Avoid_: implying this is an AI recommendation.

**Preset**
A starting Pane arrangement (`PANE_1`/`PANE_2`/`PANE_4`/`PANE_6` — which Panel Catalog entries are visible, tiled into columns) applied from the sidebar. Doesn't lock the layout: Panes can be freely moved/resized afterward.

**Terminal Workspace**
A named, saved arrangement of Panes (visibility, position, size, active Preset) for one case, persisted server-side as `layoutJson` and managed from the Workspace Settings sidebar (save/load/reset).
_Avoid_: bare "workspace" in any writing that also touches Case Workspace — always say "Terminal Workspace" or "Case Workspace" explicitly; they are unrelated concepts that happen to share a name.

**Workspace Settings sidebar**
The collapsible left sidebar hosting Preset selection, the Panel Library, Terminal Workspace save/load/reset, and Display Preferences. Replaced the previous top-bar row of dropdowns/buttons. See `docs/adr/0013-legal-terminal-redesign.md`.

**Panel Library**
The Workspace Settings sidebar's list of every Panel Catalog entry. Dragging an entry onto the grid adds it as a new Pane at the drop position.
_Avoid_: "add pane dropdown" (that was the pre-redesign mechanic; the Panel Library replaces it with drag-and-drop)

**Display Preferences**
Three global, per-browser toggles for the Legal Terminal, persisted in `localStorage` only — same pattern as Language Preference, not saved per Terminal Workspace (so they stay put regardless of which one is loaded): High Density Mode, Grid Snapping, Panel Labels.

**High Density Mode**
A Display Preference that tightens spacing and typography across both the Legal Terminal's chrome and every Pane's internal content.

**Grid Snapping**
A Display Preference (UI label: "Show Grid Lines") that makes Pane dragging/resizing snap to grid increments instead of moving freely.
_Avoid_: "Show Grid Lines" as the glossary term for this — the UI label undersells that this is a real interaction change, not a cosmetic overlay.

**Panel Labels**
A Display Preference that, when off, hides a Pane's entire header bar (grip handle, title, close control) — revealed only on hover. Touch devices (no hover state, detected via `(hover: hover)`) always show the header regardless of this toggle, so Panes stay movable/closable there.

## Calendar

**Appointment**
A scheduled item with a specific date and start/end time, shown as a block on the Calendar. Created and edited from the Planner panel on the Calendar page.
_Avoid_: "event", "meeting" (Appointment is the canonical term; the reference mock's "Events" label refers to this same concept)

**Note**
A piece of free-form text a user attaches to a specific calendar day — distinct from an Appointment in that it has no start/end time, but like an Appointment it is anchored to one date and appears on that day's cell.
_Avoid_: "reminder", "memo"

**Agenda View**
The Calendar page's mobile (below `md`) presentation: a vertical scrollable list of the current month's days, each showing its Appointments and Notes inline, replacing the 7-column day-grid used at `md` and above. Read/navigation only — creating or editing still happens via the Planner panel. See `docs/adr/0004-calendar-mobile-agenda-view.md`.
_Avoid_: "mobile calendar", "list view" (Agenda View is the canonical name for this specific mode)

## Translation

**Display Language**
The language the app's UI chrome is currently rendered in. User-controlled via a dropdown switcher, independent of any single page — switching it re-renders all UI copy across the app.
_Avoid_: "locale" (this app has no locale-prefixed routing, currency/date formatting, or region concept — Display Language controls UI text only)

**Supported Language**
One of the curated set of Display Languages the app ships translations for: English (default), Korean, Tagalog. Adding a new one is a deliberate, one-at-a-time decision — not an open-ended "any language" selector.

**Language Catalog**
The static set of translated UI strings for one Supported Language, split into per-feature files (e.g. `common`, `auth`, `landing`, `calendar`) so a page loads only the catalog(s) it needs. Translated by hand, not by an automated translation service — there is no translation vendor called at runtime.
_Avoid_: "translation file" alone (ambiguous about the namespacing)

**Language Preference**
The user's chosen Display Language, persisted in `localStorage` only — the same pattern as Remember Session. Not synced to the User's account on the backend, so it does not follow the user across devices.

## Library

**Generated Article**
The markdown content produced by the Library page's "Query AI" search box. Backed by the `legalSourceAnalysisCache` table in `ilovelawyer-api` (owned by this system, populated by `LegalSourceCacheSvc.analyze()`'s three-tier lookup: cache hit → match against the external `documents` corpus → AI generation via Chat Wonder). Distinct from a Case Law Document.
_Avoid_: "article" alone, "search result" (ambiguous with Case Law Document)

**Case Law Document**
A case/statute record from the `documents` table — an external corpus owned by a separate ingestion pipeline (not this repo), queried read-only via `GET /api/legal-rag`. Distinct from a Generated Article: this content is ingested, not AI-generated by this app.
_Avoid_: "article", "legal document" alone (ambiguous with Generated Article)

## Pending (backend not yet implemented)

- Conversation Title auto-generation — no LLM-summarization logic exists in `ilovelawyer-api` yet; spec has been handed off, `title` is `null` until it ships.
- Case: `POST /api/my-cases` accepts `caseName`/`parties` (structured `{ name, designation }[]`, backed by a `Party` model)/`notes`, but still has no `actionType`/`jurisdiction` fields. Spec for those two columns has been handed off to the backend team. The Create Case page submits against the real endpoint (`caseTitle`→`caseName`, structured Parties sent as-is, documents uploaded via the real `POST /api/documents` then linked with `PATCH /api/documents/:id` once the case id is known) — it works end-to-end today, but Type of Action and Jurisdiction are captured in the form and silently not persisted until the backend ships them (the form shows an inline notice saying so).
- Case Chat — a Case will support multiple Conversations (one-to-many), with the Case's structured fields injected into the AI's context so it doesn't need re-explaining. Spec (nullable `Conversation.caseId` FK, context-injection mechanism) has been handed off to the backend team; blocked on that plus `actionType`/`jurisdiction` above. Case Portfolio (list) and a Case detail page (`/homepage/case-portfolio/[id]`) are wired to the real `GET /api/my-cases` / `GET /api/my-cases/:id` today as the foundation this will attach to. Document content (text-extraction/RAG) is explicitly out of scope for this feature.
- Case structured fields — **resolved on the backend, not yet caught up on the frontend.** `POST /api/my-cases` now accepts and persists `actionType`, `jurisdiction`, and a structured `parties` array (name + designation each), and `GET /api/my-cases/:id` returns them. The Create Case page hasn't been updated to send them yet: Type of Action and Jurisdiction are captured in the form and silently dropped (the form still shows an inline notice saying so, which is now inaccurate), and Parties are still collapsed into the single `partyInvolved` string instead of being sent as the structured array. This is a frontend-only task now — no further backend spec needed.
- Case Chat — **structured-field context injection is live.** A Case supports multiple Conversations (one-to-many, `Conversation.caseId`), and `CaseSvc.formatForAiContext()` injects the Case's `actionType`/`jurisdiction`/Parties/notes into every message so the user doesn't need to re-explain them. Case Portfolio (list) and the Case detail page (`/homepage/case-portfolio/[id]`) are wired to `GET /api/my-cases` / `GET /api/my-cases/:id`. What's still pending: Case Document content is not yet searchable by the chat — see `docs/adr/0008-case-document-rag-for-chat.md` for the retrieval design, `docs/adr/0009-case-document-upload-presigned-s3.md` for the upload transport it now depends on, and `docs/adr/0010-case-document-rag-pipeline-parameters.md` for the extraction/chunking/embedding/retrieval spec handed to the backend team to implement it.
- Notes (calendar) — no backend endpoint or model exists; spec has been handed off to the backend team. Appointments, by contrast, now have a working backend home at `/api/events` (see `docs/adr/0001-calendar-wired-to-unbuilt-api.md` for the original context) and the Calendar page has been repointed there — though the Event model has no end-time/duration field, so Appointments show only a start time until the backend adds one (spec handed off).
- Document Analysis page — queues files into IndexedDB via `useMediaQueueStore` for local staging, then sends each one for real via `useUploadCaseDocumentMutation` (presign → S3 PUT → confirm), same as Create Case. Attaching to a Case is optional here (a "No Case" dropdown choice) — this is the one upload entry point that intentionally allows a Case Document with no Case. There is no AI analysis pipeline on the backend yet — `aiSummary` is a plain column nothing currently populates, so "Document Analysis" today is really just upload, not analysis. Distinct from the Case Document chat-retrieval work in `docs/adr/0008-case-document-rag-for-chat.md`: that ADR's chat-paperclip upload and per-document AI analysis/summary (`aiSummary`) both remain unbuilt on both ends.
- Translating legal document content (case titles, summaries, full text served via `/api/legal-rag`) and AI chat responses (`/api/chat`) into a Supported Language — out of scope for the Language Catalog work, since that content is owned and served by `ilovelawyer-api`, not this repo. Left for a separate, backend-owned initiative.
- OTP verification — `useVerifyOtpMutation` (`lib/auth/mutations.ts`) calls `POST /api/auth/verify-otp`, but `ilovelawyer-api`'s `auth.route.ts` has no such route; the call 404s unconditionally today.
- Case Workspace — Studio Panel's Audio Overview is now built end-to-end (script generation, ffmpeg-merged Polly rendering — see the Audio Overview glossary entry and its two ADRs in ilovelawyer-api). Not yet deployed: the `MessageAudioOverview` Prisma model needs `prisma generate` + `prisma migrate dev` run against the shared staging DB, blocked locally by a file lock from the running dev server at the time this shipped. Sources Panel's Documents tab has no include/exclude selection (deliberately dropped — see `docs/adr/0012-case-workspace-parallel-route.md`), unlike the reference design it's modeled on.
- Legal Terminal — **all requested + recommended panels shipped.** Contradictions was split out of Evidence & Timeline first (pure UI move, no new data). The follow-up batch — Legal Issues, Weaknesses, Strengths, Attack Strategies, Defense Strategies (one `CaseFinding` model, `category` discriminator, `notes: "AI"` tags AI-authored rows exactly like `ProcedureItem`'s STRATEGY convention, replaced wholesale each Refresh via `CaseFindingAiSvc`), Witnesses (`Witness` model, manual only), Damages & Remedies (`DamageClaim` model, manual only) — is now built end-to-end: Prisma models, `/api/my-cases/:caseId/{findings,witnesses,damages}` CRUD, all folded into `CaseSnapshotSvc.get()` so panels read off the existing snapshot like every other panel. Case Reconstruction (`CaseReconstruction` model, one narrative per case) is also live — `POST /api/my-cases/:caseId/reconstruction/generate` asks Chat Wonder (now via WS streaming, not blocking REST, to avoid Cloudflare 524s on long generations) for a tagged 4-block response (`[NARRATIVE]`/`[COURT_VERSION]`/`[OPPOSING_VERSION]`/`[GAPS]`, parsed by `case-reconstruction-parse.ts`) — it's a dedicated action, not bundled into the general Refresh, and the lawyer can edit any of the three narrative registers afterward (`PATCH .../reconstruction`, per-field). The panel now has three tabs — General (the original client-facing narrative), For the Court, From the Other Side — plus a "what this narrative doesn't cover" gaps list (qualitative, not a fabricated coverage percentage, per the zero-hallucination policy). Audio narration (General register only) is generated on demand via an async AWS Polly job (`POST/GET .../reconstruction/audio`, `pollAudioJob`, mirrors `TranscriptionSvc`'s start-job/poll-status pattern), stored as a `File` row and played back with a native `<audio>` element; editing the narrative marks existing audio stale (`audioStaleAt`) rather than deleting it. All 8 new panels default to hidden (opt-in via "Add pane"), and the toolbar now surfaces a "Suggested" chip row (heuristic, frontend-only, no AI call) that points at any hidden panel whose backing data already exists. Migrations `20260821020000_add_case_findings_witnesses_damages_reconstruction` and `20260822000000_case_reconstruction_registers_gaps_audio` applied to the shared staging DB.
- Legal Terminal redesign — **spec agreed, not yet built.** A brand-consistent visual reskin plus three new pieces of real functionality: the Workspace Settings sidebar (replacing top-bar dropdowns), drag-and-drop Panel Library, and the three Display Preferences (High Density Mode, Grid Snapping, Panel Labels — see Language above for definitions). All 18 existing Panes, the freeform drag/resize model, Presets, and Terminal Workspace save/load stay as they work today. See `docs/adr/0013-legal-terminal-redesign.md`.
</content>
