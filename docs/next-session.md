# Next session — written 2026-09-27, for 2026-09-28

Short list of what's open, newest work first. Detail lives in the linked write-ups rather than
being repeated here. Delete an item once it's done; delete the file when it's empty.

## Get the stack up

Containers and `.env` files persist from 2026-09-27, so there's no setup to redo:

```powershell
cd ilovelawyer-api;  npm run dev        # API on :3001, its own Postgres :5440 / Redis :6390
cd ilovelawyer-app;  pnpm tauri:dev     # desktop app, loading http://ph.localhost:3002
```

Log in as `admin@ilovelawyer.com` / `AdminPass123`. Test case: `Dock Beside Test`
(`96eafdf7-f7b4-45f8-aaca-8b8904f4e61d`), org `Dock Test Firm` (PH tenant).

If a Rust build fails with `An Application Control policy has blocked this file (os error 4551)`,
Windows Smart App Control has turned itself back on — it can't be allowlisted per file.

## 1. Dock beside on a second monitor — the only untested case

**Needs the second display, which is why it waited.** Everything else about docking was measured
live on 2026-09-27; this is the one branch with no coverage, and it's exactly where
physical-vs-logical pixel bugs surface.

Put the target window on the secondary monitor at a **different scaling percentage** from the
primary, then dock a pane beside it. Check the panel lands on that monitor, against the right
edge of the target, at the target's height, and sized for *that* monitor's scale — not the
primary's. `place_beside` has a unit test for negative monitor coordinates, but nothing has
confirmed that Tauri's physical coordinates and `GetDpiForWindow` agree once two scale factors
are in play.

Two smaller gaps worth closing while you're in there: the elevated-process label fallback
("Dock beside your last window", never exercised) and the minimized-but-still-current target.
Both described in [`desktop/getting-started.md`](desktop/getting-started.md) §12.

## 2. Decide what to do about the stranded pane

A pane popped out into its own window is persisted as hidden, so if the app restarts before the
close event arrives the pane is gone from the saved workspace with no window to bring it back.
Reproduced on 2026-09-27. It predates the docking work and belongs to pop-out, so it was flagged
rather than fixed inside that branch — full write-up and two suggested fixes in
[`desktop/getting-started.md`](desktop/getting-started.md) §12.

## 3. One-line fix in `ilovelawyer-api`

`src/utils/tenant-host.ts` is missing `ph.localhost` / `uk.localhost`, which the web app's copy in
`apps/web/lib/tenant-code/resolve-host.ts` has and whose comment says to keep the two in sync.
Requests from `http://ph.localhost:3002` therefore fail with "Unable to determine tenant from
request origin", so organisations have to be created against a `ph.ilovelawyer.local` origin
instead. Deliberately left to the API repo.

## 4. Question for whoever owns the legal copy

`en-GB` derives British spelling by transform, which now includes `term` (Terms & Conditions) —
"Unauthorized" becomes "Unauthorised". Spelling can't change meaning, but it does mean the two
variants of that document are never separately reviewed. If legal would rather it were left
exactly as written, exclude the `term` namespace in `apps/web/lib/i18n/british.ts`. See
`CONTEXT.md`'s **Supported Language** entry.

## Still unverified, from before (not new)

Production packaging: `tauri build` has never been run from this repo since `src-tauri` moved, and
`scripts/stage-web.js` is flagged UNVERIFIED because its path assumptions changed. Neither
production path — bundled sidecar or remote — has been confirmed. Only `tauri dev` is known to work.
