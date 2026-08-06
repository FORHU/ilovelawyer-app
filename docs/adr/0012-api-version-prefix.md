# 0012: API version prefix (`/api` → `/api/v1`), centralized and gated

## Status

Live. Confirmed 2026-08-05 via direct requests against the dev backend
(`http://192.168.1.37:3001`): `GET /api/v1/health` responds (200/503 depending on Redis health,
not 404), `POST /api/v1/documents/presign` and `GET /api/v1/my-cases` both return `401` (route
exists, needs auth) rather than 404, and the old `/api/health` still works too — both mounts live
in parallel, as asked. `NEXT_PUBLIC_API_VERSION_PREFIX=/api/v1` is now set in `apps/web/.env`.

## Context

The request was simply "change all `/api/...` to `/api/v1/...`, so future routing changes are
easier." Two ways to do that:

1. Literally rewrite the `/api/...` string in every call site (9 files:
   `lib/{cases,auth,chat,legal-rag,transcription,user,calendar}/mutations.ts`, `lib/fetch.ts`,
   `next.config.ts`).
2. Centralize the prefix in one place and leave every call site writing `/api/...` exactly as
   before, transformed at the one point where a request actually goes out.

Option 1 was rejected: it satisfies the literal ask once, but leaves the exact same problem for
next time — the version string is scattered across 9 files again, which is the opposite of
"easier to change in the future."

Separately: this session already shipped one frontend contract change (forwarding `caseId` to
`POST /api/documents/presign`, see ADR 0011) ahead of confirmed backend support, and it broke
uploads outright. A path-prefix change has a much larger blast radius — every endpoint in the
app, not just uploads — so shipping it live before the backend has a matching `/api/v1` mount
would break the entire app (auth, chat, cases, documents, calendar, everything) simultaneously.

## Decision

- `lib/fetch.ts` gains `API_PREFIX = process.env.NEXT_PUBLIC_API_VERSION_PREFIX ?? ""` and a
  `versioned(path)` helper: if `API_PREFIX` is set and `path` starts with `/api/`, rewrites it to
  `${API_PREFIX}${path without the leading "/api"}`. Every call site is untouched — they still
  write `"/api/my-cases"`, `"/api/chat/conversations"`, etc.
- Default (`API_PREFIX = ""`) is a no-op: `versioned()` returns the path unchanged, so today's
  behavior (`/api/...` exactly as before) is preserved until the env var is set.
- `next.config.ts`'s `rewrites()` duplicates the same env var and logic (it can't import from
  `lib/fetch.ts` — it runs at Next config-load time), so the six cookie-proxied auth paths
  (`/api/auth/refresh`, `/logout`, `/login`, `/google`, `/reset-password`, `/verify-otp`) and the
  regular `resolveUrl()` path agree on what the browser actually calls.
- To cut over: set `NEXT_PUBLIC_API_VERSION_PREFIX=/api/v1` — but only after the backend confirms
  it's actually serving `/api/v1/*`. Given ADR 0011's presign incident this session (a route that
  worked, then 400'd on a new field, then 404'd entirely, all within the same session), "the
  backend has it" needs to be verified with a real request, not taken on a verbal claim.

## Consequences

- Backend ask, when ready: mount the existing router at `/api/v1` too —
  `app.use("/api/v1", router)` alongside (or instead of) the current `app.use("/api", router)` in
  `src/app.ts:49`. Everything under it (`/auth`, `/chat`, `/my-cases`, `/documents`, etc.) comes
  along for free since routing is unchanged below that mount point.
- A future `/api/v2` (or dropping versioning entirely) is a one-line change to the env var and
  this file's default — not a repeat of this session's file-by-file hunt.
- If the env var is set before the backend actually serves that prefix, every API call in the app
  fails at once (auth, chat, cases, documents, calendar) — this is the one thing to check first if
  the app suddenly goes fully dark after a deploy.
