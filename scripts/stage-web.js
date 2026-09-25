// Assembles apps/web's Next.js standalone build into a self-contained directory that
// `bundle.resources` can ship and the sidecar can actually run.
//
// UNVERIFIED as of the 2026-09-25 migration into this repo. The production bundling path was
// never confirmed working even in ilovelawyer-desktop, and the move invalidated every relative
// path below. `tauri dev` does not use this script. See docs/desktop/production-readiness.md.
//
// Why this exists: `.next/standalone` is NOT self-contained under pnpm in a monorepo.
// Next emits:
//
//     .next/standalone/
//     ├── node_modules/.pnpm/       traced dependencies, real files
//     └── apps/web/
//         ├── server.js             the entry point
//         └── node_modules/next     SYMLINK to an absolute path in the dev workspace
//
// Pointing bundle.resources at `apps/web` (as this repo did until 2026-09-25) ships server.js
// with no dependencies at all — Tauri's resource copier skips the symlink, so the packaged app
// died instantly with `Cannot find module 'next'`. Following that symlink wouldn't have helped
// either: it resolves into the developer's own workspace, which doesn't exist on a user's machine.
//
// So: copy everything with symlinks dereferenced into real files, and flatten `apps/web` up to
// the staging root, which puts server.js next to a node_modules it can resolve. Flattening also
// means src-tauri/src/lib.rs needs no change — it still runs `server.js` with the staging root
// as its working directory.

const fs = require("node:fs")
const path = require("node:path")

const repoRoot = path.join(__dirname, "..")
const appWeb = path.join(repoRoot, "apps", "web")
const standalone = path.join(appWeb, ".next", "standalone")

// Deliberately NOT under repoRoot (`...\ilovelawyer-desktop\.staging\...`): pnpm's `.pnpm`
// virtual store encodes the whole dependency+peer-dep graph into each folder name (e.g.
// `next@16.2.6_react-dom@19.2.4_react@19.2.4__react@19.2.4`), and Next's own source tree
// nests several directories deeper inside that. Combined with a long repo path, real files
// here landed at 279 characters — over Windows' classic 260 MAX_PATH — which doesn't fail
// this script (Node/git use long-path-aware APIs) but does fail `makensis` during bundling
// with an opaque "failed opening file". Staging at the drive root leaves ~230 characters of
// headroom for the relative path, comfortably above the ~183 seen today.
//
// Hardcoded to C:\ rather than derived from repoRoot's drive, and must match
// `bundle.resources` in src-tauri/tauri.conf.json exactly — tauri.conf.json is static JSON
// with no env var interpolation, so it can't compute this at build time, which means it
// can't follow a dynamic path either. If this repo is ever checked out on a different drive,
// update both this constant and that file together, or the build fails with tauri.conf.json's
// well-known "resource path doesn't exist" error (see docs/desktop/architecture.md's gotchas).
const STAGING_ROOT = "C:\\.ilw-build"
if (path.parse(repoRoot).root.toUpperCase() !== "C:\\") {
  fail(
    `this repo is checked out on ${path.parse(repoRoot).root}, but staging is hardcoded to ` +
      `${STAGING_ROOT} to match bundle.resources in src-tauri/tauri.conf.json. Update both ` +
      `together (see the comment above STAGING_ROOT), or this build's resource path won't ` +
      `exist and the bundling step will fail.`,
  )
}
const staging = path.join(STAGING_ROOT, "web-standalone")

function fail(message) {
  console.error(`stage-web: ${message}`)
  process.exit(1)
}

if (!fs.existsSync(standalone)) {
  fail(
    `no standalone build at ${standalone}\n` +
      `Run ilovelawyer-app's \`build\` first (next.config.ts sets output: "standalone").`,
  )
}

// Start clean: a stale file left behind by a previous build would be shipped silently.
fs.rmSync(staging, { recursive: true, force: true })
fs.mkdirSync(staging, { recursive: true })

const copy = (from, to) =>
  fs.cpSync(from, to, { recursive: true, dereference: true, force: true })

// 1. Traced dependencies from the standalone root.
copy(path.join(standalone, "node_modules"), path.join(staging, "node_modules"))

// 2. The app itself, flattened up so server.js sits beside that node_modules. Its own
//    node_modules (where the `next` symlink lives) merges into the same directory.
copy(path.join(standalone, "apps", "web"), staging)

// 3. Static assets and public/, which Next deliberately leaves out of the standalone output.
copy(path.join(appWeb, ".next", "static"), path.join(staging, ".next", "static"))
if (fs.existsSync(path.join(appWeb, "public"))) {
  copy(path.join(appWeb, "public"), path.join(staging, "public"))
}

// Fail loudly here rather than shipping an installer that dies on the user's machine — this is
// the exact failure this script was written to prevent, so it's worth asserting rather than
// assuming.
const entry = path.join(staging, "server.js")
if (!fs.existsSync(entry)) fail(`no server.js in ${staging}`)
const next = path.join(staging, "node_modules", "next", "package.json")
if (!fs.existsSync(next)) fail(`\`next\` is not resolvable from ${staging} — the bundle would not run`)

// The app's build-time .env rides along, which is how this repo has always bundled it. Nothing
// secret lives there (NEXT_PUBLIC_* only), but it does pin NEXT_PUBLIC_API_URL into the shipped
// app — see docs/desktop/production-readiness.md item 5.
const env = path.join(staging, ".env")
console.log(`stage-web: staged ${staging}`)
console.log(`stage-web: .env ${fs.existsSync(env) ? "included" : "not present"}`)
