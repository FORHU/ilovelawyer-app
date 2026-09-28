# Next session — written 2026-09-28

Short list of what's open, most urgent first. Detail lives in the linked write-ups rather than
being repeated here. Delete an item once it's done; delete the file when it's empty.

## ⚠ Nothing from 2026-09-28 is committed yet

All of it is sitting in two working trees:

- **`ilovelawyer-app`** (`feature/tauri-migration`) — en-GB placeholder fix; `src-tauri/src` split
  into one file per job; `.xlsx` preview sanitising (DOMPurify); production build fix
  (`scripts/stage-web.js`); Google sign-in popup; drag-and-drop; stranded-pane fix; Legal Terminal
  opens in the same window; UK/PH site chooser + memory; site in the title bar; new-tab links open
  in the default browser; desktop ↔ browser login handoff (web + `src-tauri` deep links);
  `src-tauri/.env.example` rewrite; docs.
- **`ilovelawyer-api`** (`feature/tauri-desktop-poc`) — `ph.localhost` / `uk.localhost` in
  `src/utils/tenant-host.ts`; login handoff endpoints (`POST /api/auth/handoff`,
  `/handoff/preview`, `/handoff/consume`, `src/utils/handoff.ts`); tests for both.

Commit them first — one commit per change reads best.

## What changed on 2026-09-28, in one place

| Change | Where | Why |
|---|---|---|
| Legal Terminal opens in the **same window** (desktop too) | 5 links, marked `DISABLED: terminal-own-window` | Product call: only panels get their own windows. Old code kept as comments — search the marker to switch back |
| Google sign-in works in the desktop app | `src-tauri/src/popups.rs` | Tauri blocked the popup Google opens. Only `accounts.google.com` is allowed |
| Drag-and-drop reaches the page | `web_window` in `src-tauri/src/shell.rs` | Tauri's own drop handler swallowed file drops and pane drags on Windows |
| A popped-out pane survives a restart | `apps/web/lib/terminal/popped-out.ts` | "Popped out" is memory-only now; the saved layout keeps the pane on the grid |
| App opens on the user's own UK/PH site | `src-tauri/src/tenant_site.rs` | Neutral `FRONTEND_URL` shows the chooser once, then remembers it. Panels open on the caller's site |
| `.xlsx` preview can't run script | `apps/web/lib/chat/sanitize-sheet-html.ts` | xlsx-preview escapes nothing — confirmed exploitable |
| Packaged app actually starts | `scripts/stage-web.js` | pnpm symlinks pointed at the dev machine; now copied as real files and hoisted |
| `src-tauri/src` split into modules | `src-tauri/src/lib.rs` has the map | Readability for newcomers; no behaviour change |
| Title bar shows the site ("UK I Love Lawyer Terminal!") | `tenant_site::window_title` | You can always see which site a window is on |
| "Open in new tab" links open the default browser | `src-tauri/src/popups.rs` | They silently did nothing. Non-web links stay blocked |
| **Login handoff, desktop ↔ browser** | API `utils/handoff.ts`; web `lib/desktop/handoff.ts`, `/handoff`, `/connect-desktop`; `src-tauri/src/deep_links.rs` | The two keep separate logins; a one-time code (60s, single use, never logs the other out) carries one over |

Every window the app creates (dashboard, panel) goes through `web_window` in `shell.rs` — a new
kind of window must too, or it loses Google sign-in and drag-and-drop.

## Get the stack up

```powershell
cd ilovelawyer-api;  npm run dev                   # API on :3001
cd ilovelawyer-app;  npx pnpm@10.33.4 tauri:dev    # desktop app + local Next.js on :3002
```

In a browser as well: open **`http://uk.localhost:3002`** (or `ph.`), not plain `localhost` —
see the traps below.

### Setting up another machine — none of this comes with the repo

1. **Toolchain and two placeholder files** — Rust, MSVC build tools, a Node exe copied to
   `src-tauri/binaries/node-x86_64-pc-windows-msvc.exe`, and an empty `C:\.ilw-build\web-standalone`.
   Both are checked at *compile* time, so cargo fails without them. Commands:
   [`desktop/getting-started.md`](desktop/getting-started.md) §8.
2. **`pnpm` 10.33.4** — the repo pins it. A different global version refuses to run; use
   `npx pnpm@10.33.4 …` or `npm install -g pnpm@10.33.4`.
3. **`src-tauri/.env`** — copy `src-tauri/.env.example`; it explains every option. Default is
   `FRONTEND_URL=http://localhost:3002` (UK/PH chooser on first launch).
4. **`apps/web/.env`** — `NODE_ENV`, `NEXT_PUBLIC_API_URL=http://localhost:3001`,
   `NEXT_PUBLIC_GOOGLE_CLIENT_ID`.
5. **`ilovelawyer-api/.env`** — as on the other machine, plus:
   - `CLIENT_URL` must include `http://uk.localhost:3002,http://ph.localhost:3002` (CORS and
     socket.io both use it).
   - `AWS_S3_BUCKET` / `AWS_ACCESS_KEY` — uploads go to the team's **real** S3 bucket even
     locally; there's no LocalStack S3. Use test files, not client documents.
6. **The API's stack** — `npm install`, `docker compose up -d`, then
   `npx prisma migrate deploy; npx prisma generate; npm run prisma:seed`
   (seed: `admin@ilovelawyer.com` / `AdminPass123`). Then **fix the LocalStack queues** (trap below).
7. **Create an organization on the right site.** Sign up/log in on `uk.localhost:3002` (or
   `ph.`): the organization's UK/PH is decided by the site it's created from, permanently.

### Traps that cost time on 2026-09-28

- **`.env` changes do nothing until a restart.** Both `src-tauri/.env` (read when the app starts)
  and the API's `.env`. Twice the app was still showing the old site after an edit.
- **LocalStack queues in the wrong place → AI jobs loop and flood the API.** The init script
  creates the queues in `us-east-1` under LocalStack's test account; the API looks in
  `ap-southeast-1` under the account derived from its (real) `AWS_ACCESS_KEY`. Every enqueue fails,
  the in-memory fallback runs the job at once, and `witnessExtract` ↔ `casePostExtraction` retrigger
  each other ~30×/s — cases stop loading, logs grow by hundreds of MB. Queues are in-memory, so
  this returned after every LocalStack restart. **Fixed** (item 2) — kept here for the symptoms. The old manual recreate:

  ```bash
  cd ilovelawyer-api; K=$(grep -E "^AWS_ACCESS_KEY=" .env | cut -d= -f2-)
  for q in document-extraction citation-extraction audio-overview case-reconstruction-audio ai-generation message-persistence case-graph-promotion; do
    docker exec -e AWS_ACCESS_KEY_ID="$K" -e AWS_SECRET_ACCESS_KEY=test ilovelawyer-localstack awslocal --region ap-southeast-1 sqs create-queue --queue-name "$q"
  done
  ```

  Symptom check: `combined.log` / `error.log` in `ilovelawyer-api` growing fast with
  `Failed to enqueue AI generation job … The specified queue does not exist`.
- **Every address has its own login — and so does the desktop app.** `localhost:3002`,
  `uk.localhost:3002` and `ph.localhost:3002` don't share a session, and the desktop app's built-in
  browser doesn't share one with Chrome/Firefox. "Can't load cases" was usually "logged in on a
  different address", or "logged in as an account that isn't in the organization".
- **Chat Send is greyed out with no message when you have no organization.** Create one first.
- **Windows may report a second display you can't see** (`DISPLAY2` at x −1920 on this machine).
  Anything placed on "the other monitor" lands there. Settings → Display → *Show only on 1*.
- **`An Application Control policy has blocked this file (os error 4551)`** — Smart App Control
  blocks freshly built Rust binaries; it has to be off.
- **`tauri:dev` fails if `pnpm dev` is already running** — both want port 3002.
- **`Encountered a script tag while rendering React component` (at `ThemeProvider`)** — harmless,
  dev-only. next-themes 0.4.6 (latest stable) injects a small theme script that React 19.2 now
  warns about; the theme still applies. Leave it until next-themes 1.0 is stable — not worth a
  beta or a rewrite, and unrelated to the desktop work.
- **Firefox says `NetworkError when attempting to fetch resource`** where Chrome/WebView2 says
  `Failed to fetch` — same thing: a request blocked (usually CORS: wrong address) or the API down.

### Driving the app without clicking (optional)

Launch a *second, isolated* copy with the debugger on, so it doesn't disturb yours:

```bash
cd ilovelawyer-app/src-tauri
FRONTEND_URL=http://uk.localhost:3002 WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333 \
  WEBVIEW2_USER_DATA_FOLDER=<some temp dir> ./target/debug/ilovelawyer-desktop.exe
```

Then drive it over CDP at `http://127.0.0.1:9333/json` — e.g. `window.__TAURI__.core.invoke(...)`
to call a command exactly as the page does. The separate data folder means it starts logged out.
For window placement, read rectangles with `DwmGetWindowAttribute(DWMWA_EXTENDED_FRAME_BOUNDS)`.

## 1. Try the 2026-09-28 changes in the running app

**Restart `tauri:dev` first** — Next.js only picks up the new `/api/auth/handoff/consume` proxy
route at startup, and the Rust side needs a rebuild for the deep-link plugins.

Built and unit-tested, not yet seen working live:

- **Login handoff** (API endpoints *were* tested live; the three flows below weren't):
  - Desktop → browser: account menu → **Open in Browser** → browser opens that page, signed in.
  - Browser → desktop: account menu → **Open in Desktop App** → browser asks to open the app →
    app shows that page, signed in. ✅ **Seen working 2026-09-28.**
  - Desktop signed out: **Log in with your browser** → browser `/connect-desktop` → Continue.
  - Each lands on **"Sign in as …?" — Cancel | Continue** unless already signed in as that
    account. Try Cancel too: nothing should change, and the code just expires.
  - `ilovelawyer://` is registered by the running app itself (`register_all`, per user, in
    HKCU) — so browser → desktop only works once the app has been started at least once.

- **Drag-and-drop** — drop a document on an upload area; drag a Terminal pane.
- **Stranded pane** — pop a pane out, quit the app with it out, relaunch: it should be back on
  the grid.
- **Site chooser + memory** — delete `%APPDATA%\com.ilovelawyer.desktop\last-site.txt`, launch
  with `FRONTEND_URL=http://localhost:3002`: chooser → pick → log in → relaunch goes straight there.
- **Google sign-in** — works as far as the popup opening. Whether Google then accepts it depends on
  the addresses registered for the client ID in Google Cloud (Authorised JavaScript origins); if it
  shows an origin error, `http://uk.localhost:3002` / `http://ph.localhost:3002` need adding there.

## 2. ~~Two fixes in `ilovelawyer-api` for the queue loop~~ — DONE 2026-09-28 (uncommitted)

- `src/lib/sqs.ts` signs LocalStack requests with LocalStack's test credentials, so they land in
  account `000000000000` — the one the queue URLs name — instead of the one the real
  `AWS_ACCESS_KEY` maps to.
- `docker/localstack-init/ready-create-queues.sh` creates the queues in `ap-southeast-1`.
- `src/queues/ai-generation.queue.ts`: the in-memory fallback now waits `delaySeconds`, so a queue
  outage makes jobs slow instead of a 30-per-second storm.

Verified live: no queue errors after the API restarted, and a send to `ai-generation` succeeds.
The "Traps" recipe above (recreating queues by hand with the API's key) is no longer needed.

## 3. ~~"Open in new tab" links do nothing in the desktop app~~ — FIXED 2026-09-28

`src-tauri/src/popups.rs` now sends every other `http(s)` new-window request to the default
browser (via tauri-plugin-opener); Google sign-in still opens in-app; non-web links stay blocked.
Tested by unit tests only — confirm one link (e.g. a law's source) opens in the browser.

## 4. Dock beside on a second monitor — the only untested docking case

Needs a real second display at a **different scaling percentage**. Dock a pane beside a window on
that monitor; check it lands there, flush, at the target's height, sized for *that* monitor's
scale. Plus two small gaps: the elevated-process label fallback, and the minimized-but-current
target. [`desktop/getting-started.md`](desktop/getting-started.md) §12.

## 5. Decide: keep or remove `open_case_terminal`

The Rust command (`src-tauri/src/case_terminal.rs`) is still registered and granted, but nothing
calls it since the Legal Terminal moved to the same window. Keep it if the own-window option may
come back (the web side is commented out, marker `DISABLED: terminal-own-window`); otherwise
remove it and its `build.rs` / `capabilities/default.json` entries.

## 6. Question for whoever owns the legal copy

`en-GB` derives British spelling by transform, which includes `term` (Terms & Conditions) —
"Unauthorized" becomes "Unauthorised". It can't change meaning, but the two variants are never
separately reviewed. To keep it exactly as written, exclude the `term` namespace in
`apps/web/lib/i18n/british.ts`. See `CONTEXT.md`'s **Supported Language** entry.

## 7. Parked until the installer is published: telling users the desktop app exists

Today nothing tells a browser user there *is* a desktop app, and "Open in Desktop App" shows for
everyone — for someone without the app it does nothing. A web page can't reliably tell whether
the app is installed (browsers hide which link types a PC can open), so it has to infer or ask.
Build these three together, once there's a real download link, all keyed on
`NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL` (already read by `desktopDownloadUrl()` in lib/desktop):

- **Open in Desktop App** — if the browser still has focus ~2–3s after the click, the app most
  likely didn't open: show "Don't have the desktop app? Download it".
- **Pop-out blocked** toast — its "Get the desktop app" action switches on by itself once the env
  var is set (`legal-terminal.tsx` `popOutPanel`).
- **Account menu** — optionally a "Get the desktop app" entry for Windows users.

Deliberately not built now: with nothing to download, it would all lead nowhere.

## 8. Production build — works, gaps left

`pnpm tauri:build` makes a working installer; the packaged app starts its bundled server and
window. Left: install and run the `-setup.exe` itself; build with the deployed API URL (the
installer bakes in `apps/web/.env`, i.e. `localhost:3001` on a dev machine); code signing; and
auto-update (`tauri-plugin-updater`, not set up). A PH user on a UK-configured build still logs in
twice on first launch — only a login shared across `uk.`/`ph.` (a parent-domain cookie, API side)
removes that. [`desktop/getting-started.md`](desktop/getting-started.md) §8.
