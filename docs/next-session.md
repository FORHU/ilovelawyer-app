# Next session — written 2026-09-27, for 2026-09-28

Short list of what's open, newest work first. Detail lives in the linked write-ups rather than
being repeated here. Delete an item once it's done; delete the file when it's empty.

## Get the stack up

**Why a local API at all:** item 1 needs the Dock beside button, which only exists on this branch.
The deployed ph-dev/uk-dev environments don't have it yet, so the desktop app has to load local
code — and local code wants an API. Pointing `NEXT_PUBLIC_API_URL` at a deployed API instead
generally won't work, because its CORS allowlist is keyed on exact origins and doesn't include
`localhost:3002`.

### On the machine this was set up on (2026-09-27)

Containers, database and `.env` files all persist, so nothing to redo:

```powershell
cd ilovelawyer-api;  npm run dev        # API on :3001, its own Postgres :5440 / Redis :6390
cd ilovelawyer-app;  pnpm tauri:dev     # desktop app, loading http://ph.localhost:3002
```

### On a different machine — this part does NOT come with the repo

Everything below is gitignored or lives outside the checkout, so a second PC needs it once:

1. **Toolchain and the two placeholder files** — Rust, MSVC build tools, a Node exe copied to
   `src-tauri/binaries/node-x86_64-pc-windows-msvc.exe`, and an empty `C:\.ilw-build\web-standalone`.
   Both placeholders are checked at *compile* time, so cargo fails without them. Commands are in
   [`desktop/getting-started.md`](desktop/getting-started.md) §8.
2. **`pnpm` 10.33.4** — the repo pins it via `packageManager`, and an older pnpm refuses to run
   (`ERR_PNPM_BAD_PM_VERSION`). `npm install -g pnpm@10.33.4`.
3. **`src-tauri/.env`** — set `FRONTEND_URL=http://ph.localhost:3002` to load local code (leave it
   unset for the bundled path, or point it at a deployed tenant). Also `WINDOW_TITLE`.
4. **`apps/web/.env`** — `NODE_ENV`, `NEXT_PUBLIC_API_URL=http://localhost:3001`,
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (a placeholder is fine).
5. **The API's own stack.** `npm install` in `ilovelawyer-api` (its `node_modules` may look present
   but be empty — that was the case here), then bring up its containers. Ports 5432/6379 are often
   already taken by other projects, so override them and match `ilovelawyer-api/.env`
   (`DATABASE_URL` port, `REDIS_PORT`, `REDIS_PASSWORD=password`):

   ```powershell
   $env:POSTGRES_PORT=5440; $env:REDIS_PORT=6390; docker compose up -d
   npx prisma migrate deploy; npx prisma generate; npm run prisma:seed
   ```

   The seed creates `admin@ilovelawyer.com` / `AdminPass123`. A case needs an organisation, and
   organisation creation resolves the tenant from the request Origin — see item 3, which is why it
   has to be created against a `ph.ilovelawyer.local:3002` origin until that's fixed.

Test fixtures on the 2026-09-27 machine, for reference: org `Dock Test Firm` (PH tenant), case
`Dock Beside Test` (`96eafdf7-f7b4-45f8-aaca-8b8904f4e61d`).

### Two things that will waste your time

- **`An Application Control policy has blocked this file (os error 4551)`** — Windows Smart App
  Control blocking freshly built Rust binaries. It kills `cargo test` and `tauri dev` after every
  rebuild and cannot be allowlisted per file; it has to be off.
- **`tauri:dev` fails outright if `pnpm dev` is already running** — both want port 3002. Stop the
  standalone one first; to use a browser as well, just open `localhost:3002` while `tauri:dev` runs.

### Driving the app without clicking (optional)

How the 2026-09-27 placement numbers were measured, if you want to repeat it rather than eyeball
the second monitor: launch with the WebView's debugger open —

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"; pnpm tauri:dev
```

— then drive the page over CDP at `http://127.0.0.1:9222/json` (log in, open the Terminal, click),
and read window rectangles with `DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)` so you're
comparing *visible* frames. The scripts themselves were scratch and aren't in the repo. Two traps:
a rebuild logs the app out, because the session is in memory; and a browser that keeps grabbing the
foreground will retarget between choosing a target and clicking, so trust the button's own label at
click time rather than anything read beforehand.

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
