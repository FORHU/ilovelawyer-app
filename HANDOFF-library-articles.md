# Handoff: Library page markdown fix + Case Law Document browse

## Where this came from

User asked (via `/grill-with-docs`) to: fix broken markdown rendering for "generated articles" on the Library page, investigate where that data comes from, and add a way to view all articles. We ran a full interview (10+ questions) to disambiguate terms and scope before implementing — see `CONTEXT.md` (new "## Library" section: *Generated Article* vs *Case Law Document*) and `docs/adr/0003-generated-article-normalization-regex-unvalidated.md` for the reasoning behind the more surprising decisions. Don't re-derive that reasoning — read those two files first.

Repos involved: `ilovelawyer-app` (this repo, frontend) and `ilovelawyer-api` at `c:\Users\Jewish\Documents\GitHub\ilovelawyer-api` (backend, sibling directory).

## What was decided (full detail in CONTEXT.md / ADR 0003)

1. **Generated Article** (`legalSourceAnalysisCache` table, AI "Query AI" search results) vs **Case Law Document** (`documents` table, external ingestion corpus, browsed via already-existing `GET /api/legal-rag`) are two distinct concepts — previously conflated as "articles."
2. Markdown fix = renderer (was raw `whitespace-pre-wrap`, no parser at all) **+** a data-normalization script for a letter-spacing artifact (`D E C I S I O N` → `DECISION`) baked into stored content, **+** patching the write path so it stops recurring.
3. "View all articles" → build a browse page for **Case Law Documents** (cheap: hooks already existed, unused), not Generated Articles (would've needed new backend work).
4. Also removed the CACHED / FRESHLY GENERATED badge entirely per user request mid-session (it was already inaccurate — Tier-2 RAG matches showed "FRESHLY GENERATED" despite not being AI-generated).

## What's implemented (all done, not yet visually verified in a browser)

**ilovelawyer-api:**
- `src/utils/legalSourceCache.utils.ts` — added `normalizeLetterSpacing()`, a conservative regex (`/\b(?:[A-Z0-9]\s){3,}[A-Z0-9]\b/g`, uppercase/digit only, 4+ char minimum) that collapses letter-spaced runs without touching normal prose, G.R. numbers, `ARTICLE I`, etc. Verified against test strings — see conversation for the test matrix.
- `src/services/legal-source-cache.service.ts` — Tier 2 (RAG DB match) and Tier 3 (fresh AI generation) both now run content through `normalizeLetterSpacing()` before persisting, so the artifact can't recur.
- `scripts/normalize-generated-articles.ts` — new backfill script, **dry-run by default**, `--write` to commit. Verified end-to-end with a seeded+cleaned-up temp row (diff shown correctly in dry-run, persisted correctly with `--write`).

**ilovelawyer-app:**
- `apps/web/components/library/legal-markdown.tsx` — new shared markdown renderer (react-markdown + remark-gfm, serif/editorial styling matching the Library page, distinct from chat's `assistant-message.tsx`).
- `apps/web/app/(protected)/homepage/library/page.tsx` — now renders `formatted_markdown` via `LegalMarkdown`; removed the CACHED/FRESHLY GENERATED badge; wired the previously-decorative "Explore Supreme Court Reports" arrow button (in the dark bento card) to `Link href="/homepage/library/documents"`.
- `apps/web/app/(protected)/homepage/library/documents/page.tsx` — new browse list page using the pre-existing (previously unused) `useLegalDocumentsQuery` hook. Search box + Prev/Next pagination only, no category/year filters (per user's scope call).
- `apps/web/app/(protected)/homepage/library/documents/[id]/page.tsx` — new detail page using `useLegalDocumentQuery`, rendered via `LegalMarkdown`.
- `apps/web/locales/{en,ko,tl}/library.json` — removed `analysis.cached`/`analysis.freshlyGenerated` keys, added a full `documents.*` translation block (list + detail strings) in all three languages.

**Verified so far:** `tsc --noEmit` clean in both repos (only pre-existing, unrelated errors remain — see below); ESLint clean on all touched frontend files; `next build` compiles our code (fails only on a pre-existing unrelated error, see below); normalization script tested end-to-end against the local DB.

**Pre-existing, unrelated issues discovered (not caused by this work, did not fix beyond noted below):**
- `apps/web/components/ui/custom-select.tsx:112` — a `MenuPosition`/`CSSProperties` type error blocks `tsc --noEmit` and `next build` typecheck in the web app. Unrelated file, untouched by us.
- `ilovelawyer-api` had **no ESLint config file at all** (`npx eslint` errors with "couldn't find a configuration file").
- `ilovelawyer-api/src/utils/redis.util.ts` references `REDIS_HOST`/`REDIS_PORT`/`REDIS_PASSWORD` which aren't exported from `../config` — pre-existing dead/broken file (the actually-used redis client is `src/lib/redis.ts`, which works fine via `REDIS_URL`).
- `ilovelawyer-api/.env` has `DATABASE_URL` pointing at port `5433` and `REDIS_PORT=6380`, but the actual running Docker containers (`lawph-postgres`, `lawph-redis`) are mapped to `5432`/`6379`. We did **not** edit `.env` — we overrode `DATABASE_URL` inline per-command instead. Whoever picks this up should ask the user whether `.env` or `docker-compose.yml` is the one that's wrong.
- `ilovelawyer-api` node_modules was out of sync with `package.json` — `@aws-sdk/client-polly` (and some others) were missing, crashing the dev server (`ts-node` type-checks the whole program, so an unrelated missing-module error in `src/routes/tts.route.ts` blocked *everything* from booting). We ran `npm install` in `ilovelawyer-api` to fix this — that's a real, intentional change to `node_modules`/lockfile in that repo, done to unblock testing, not part of the feature.

## What's NOT done yet — pick up here

**Browser verification was in progress and got interrupted.** Steps so far:
1. Ran `npm install` in `ilovelawyer-api` to fix the missing-dependency crash (done, succeeded).
2. Need to **restart** the API dev server (it crashed before the `npm install` fix landed) — from `ilovelawyer-api`, with `DATABASE_URL` overridden to point at port `5432` (not the `.env` default of `5433`) since that's where the actual Postgres container listens:
   ```
   DATABASE_URL="postgres://postgres:<password-from-.env>@localhost:5432/legalrag" npm run dev
   ```
3. The web app already has a dev server running on **port 3000** (PID was 6660 at time of writing — pre-existing, started outside this session, do NOT assume it picked up today's file edits without checking; Next's file watcher should have hot-reloaded it, but confirm). Do not start a second one on the same port.
4. No Python is available in this shell (`py`/`python`/`python3` all resolve to the Microsoft Store stub) — the `webapp-testing` skill's `with_server.py` helper (Python-based) won't run. Chromium *is* already installed at `~/AppData/Local/ms-playwright/chromium-1228` and `npx playwright --version` works, so the plan was to write a **Node.js** Playwright script directly instead (no npm package installed yet — `npx playwright` downloads what it needs on demand, but a proper automation script needs the `playwright` package; check `node_modules/playwright` or install it, or use `npx tsx`/plain `node` with `require("playwright")` after a scoped install).
5. There's exactly 1 existing `User` row in the local DB and its credentials are unknown — plan was to **sign up a fresh temporary test user** through the actual `/signup` UI flow, log in, then navigate to:
   - `/homepage/library` — search something (e.g. "malolos", the term visible in the original bug screenshot), confirm markdown renders as real headings/paragraphs (not literal `#`/`##`) and the CACHED/FRESHLY GENERATED badge is gone.
   - `/homepage/library/documents` — confirm the list loads, search works, pagination works.
   - Click into a document — confirm `/homepage/library/documents/[id]` loads and renders via `LegalMarkdown`.
   - Screenshot each for the record.
   - **Clean up the temp test user afterward** (delete via Prisma, same pattern as the temp DB rows cleaned up earlier in this session — see `scripts/_tmp-e2e-check.ts` pattern in the conversation, though that exact file was deleted after use).
6. Report results back to the user, being explicit about what was/wasn't actually confirmed working in a real browser (per this project's own instructions: don't claim UI success without having tested it).

## Suggested skills for next session

- **`webapp-testing`** — was in use when interrupted; re-invoke to resume browser verification, but note the Python unavailability finding above (item 4) so the next session doesn't repeat that dead end — go straight to a Node-based Playwright script or ask the user how they'd prefer to verify.
- No other skills needed — the interview (`grill-with-docs`) and implementation phases are complete. This is purely a verification/QA task from here.

## Loose ends to flag to the user (not yet asked)

- Confirm whether `.env`'s `DATABASE_URL`/`REDIS_PORT` or `docker-compose.yml`'s port mappings are the "wrong" one in `ilovelawyer-api` — this was worked around, not fixed.
- Confirm the `npm install` in `ilovelawyer-api` (dependency sync) is welcome to stay, since it modified `package-lock.json`/`node_modules` outside the original scope of this feature work.
- Once verification passes, ask whether to actually run `npx ts-node scripts/normalize-generated-articles.ts --write` against the real environment where corrupted `legalSourceAnalysisCache` rows exist (local DB has 0 rows — this only matters in staging/prod).
