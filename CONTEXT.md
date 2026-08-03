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
A litigation filing record a user creates via the Create Case form: a Case Title, Type of Action, Jurisdiction, one or more Parties, and uploaded evidentiary Documents. Created through `POST /api/cases`.
_Avoid_: "matter", "filing" (use Case for the record itself; "filing" is fine as a verb for the act of submitting one)

**Case Portfolio**
The list/browse view of all Cases a user has created — a "recent cases" tab, not a distinct record type of its own. Every Case a user creates appears here; there is no separate step to add one.
_Avoid_: "portfolio" alone (always pair with "Case" to avoid confusion with a document/evidence portfolio)

**Party**
A person or entity involved in a Case, captured as a Full Name and a Designation. A Case has one or more Parties.

**Designation**
A Party's role within a Case: Petitioner/Plaintiff, Respondent/Defendant, or Intervenor/Third-Party.

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
- Notes (calendar) — no backend endpoint or model exists; spec has been handed off to the backend team. Appointments, by contrast, now have a working backend home at `/api/events` (see `docs/adr/0001-calendar-wired-to-unbuilt-api.md` for the original context) and the Calendar page has been repointed there — though the Event model has no end-time/duration field, so Appointments show only a start time until the backend adds one (spec handed off).
- Document Analysis page — scoped to become a per-Case feature (upload + analyze a document attached to a Case). Currently 100% client-side (queues files into IndexedDB via `useMediaQueueStore`, never calls the backend) — needs rebuilding against `POST /api/documents` once it's moved under a Case. Separately, even once wired up, there is no AI analysis pipeline on the backend yet — `aiSummary` is a plain column nothing currently populates.
- Translating legal document content (case titles, summaries, full text served via `/api/legal-rag`) and AI chat responses (`/api/chat`) into a Supported Language — out of scope for the Language Catalog work, since that content is owned and served by `ilovelawyer-api`, not this repo. Left for a separate, backend-owned initiative.
- OTP verification — `useVerifyOtpMutation` (`lib/auth/mutations.ts`) calls `POST /api/auth/verify-otp`, but `ilovelawyer-api`'s `auth.route.ts` has no such route; the call 404s unconditionally today.
</content>
