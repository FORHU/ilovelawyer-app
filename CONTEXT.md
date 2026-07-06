# ilovelawyer-app (frontend)

Web frontend for ilovelawyer — a Next.js App Router application that consumes the `ilovelawyer-api` backend.

Mirrors the domain language established in `ilovelawyer-api/CONTEXT.md`. Terms defined there (Session, Access Token, Refresh Token, Logout) apply here unless explicitly overridden below.

## Language

**Access Token**
Short-lived JWT returned in the login/Google OAuth response body. Held in memory only (Zustand store) — never written to `localStorage` or `sessionStorage`. Attached to every API request as `Authorization: Bearer <token>` by `apiFetch`.
_Avoid_: "auth token", "JWT token"

**Refresh Token**
Longer-lived JWT returned alongside the Access Token. Storage location depends on the "Remember session" choice at login: `localStorage` when checked (persists across browser restarts), `sessionStorage` when unchecked (cleared on tab close). Used exclusively to mint a new Access Token when the current one expires.
_Avoid_: "session token" (ambiguous with the backend's Session concept)

**Remember Session**
A login-form preference that controls where the Refresh Token is stored — `localStorage` vs `sessionStorage`. Has no effect on the backend; purely a frontend behavior.
_Avoid_: "stay logged in", "keep me signed in" (use the exact label from the UI: "Remember session")

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
A saved thread of chat messages between a user and the AI, identified by an id reflected in the URL (`/homepage?c=<conversationId>`) so it survives a refresh. Listed in the sidebar, most-recently-created first.
_Avoid_: "chat", "session" (ambiguous with the backend's Session concept)

**Conversation Title**
The label shown for a Conversation in the sidebar. Intended to be an AI-generated topical summary (e.g., "Wrongful Termination — Retaliatory Dismissal"), set once by the backend after the first exchange — not something the user types in. Until that backend generation work ships, the frontend falls back to a naive truncation of the user's first message.
_Avoid_: "conversation name" (this app calls it Title, matching the `title` field)

## Pending (backend not yet implemented)

- `POST /api/auth/forgot-password` — no backend endpoint exists; the `/forgot-password` page is a UI placeholder.
- `POST /api/auth/reset-password` — no backend endpoint exists; the `/reset-password` page is a UI placeholder.
- Conversation Title auto-generation — no LLM-summarization logic exists in `ilovelawyer-api` yet; spec has been handed off, `title` is `null` until it ships.
