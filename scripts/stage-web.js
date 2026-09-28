// Assembles apps/web's Next.js standalone build into a self-contained directory that
// `bundle.resources` can ship and the sidecar can actually run.
//
// Verified 2026-09-28: `pnpm tauri:build` produces an installer whose packaged app starts its
// sidecar and serves the web app. `tauri dev` does not use this script.
//
// Why this exists: `.next/standalone` is NOT self-contained under pnpm in a monorepo.
// Next emits:
//
//     .next/standalone/
//     ├── node_modules/.pnpm/       traced dependencies, real files (plus ~50 symlinks)
//     └── apps/web/
//         ├── server.js             the entry point
//         └── node_modules/next     SYMLINK to an absolute path in the dev workspace
//
// Every symlink Next writes points at an absolute path in the developer's own workspace, which
// doesn't exist on a user's machine — and Tauri's resource copier skips symlinks anyway, so the
// packaged app died instantly with `Cannot find module 'next'`.
//
// So: copy everything, replacing each symlink with real files; flatten `apps/web` up to the
// staging root, which puts server.js next to a node_modules it can resolve; and hoist every
// package into that one node_modules, npm-style (step 4 below explains why pnpm's own layout
// can't survive without its symlinks). Flattening also
// means the sidecar code (src-tauri/src/sidecar.rs) needs no change — it still runs `server.js`
// with the staging root as its working directory.
//
// Two traps, both hit for real:
// - `fs.cpSync(..., { dereference: true })` does NOT replace symlinks *nested* inside the tree it
//   copies — only the top-level source. It left all ~50 in place, and a check that merely
//   required `node_modules/next/package.json` passed, because the link still resolved on the
//   machine that built it. So `copyResolvingLinks` below walks the tree itself, and the final
//   check asserts that no symlink survives anywhere.
// - Following a link to its real target would copy the *whole* package from the workspace (165 MB
//   for `next` alone). Next already put the traced subset (16 MB) at the same path inside
//   `.next/standalone`, so each link is redirected there instead.

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
// well-known "resource path doesn't exist" error.
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

// Links whose target Next didn't trace (so nothing at runtime loads it) — dropped, and listed at
// the end so a surprising one is visible in the build log.
const droppedLinks = []

/**
 * Copies `from` to `to`, writing real files wherever the source has a symlink.
 *
 * A link's absolute target is inside the workspace (`repoRoot`); the same relative path inside
 * `.next/standalone` holds Next's traced copy, so that's what gets copied. `ancestors` holds the
 * directories being copied further up this branch: pnpm links can form cycles (a depends on b,
 * b on a), and following one back into an ancestor would recurse forever.
 */
function copyResolvingLinks(from, to, ancestors = new Set()) {
  const stat = fs.lstatSync(from)
  if (stat.isSymbolicLink()) {
    const target = path.resolve(path.dirname(from), fs.readlinkSync(from))
    const relative = path.relative(repoRoot, target)
    if (relative.startsWith("..") || path.isAbsolute(relative)) {
      fail(`${from} links outside the workspace (${target}) — nothing to redirect it to`)
    }
    const traced = path.join(standalone, relative)
    if (!fs.existsSync(traced)) {
      droppedLinks.push(path.relative(standalone, from))
      return
    }
    copyResolvingLinks(traced, to, ancestors)
    return
  }
  if (stat.isDirectory()) {
    const real = fs.realpathSync(from)
    if (ancestors.has(real)) return
    fs.mkdirSync(to, { recursive: true })
    const inner = new Set(ancestors).add(real)
    for (const entry of fs.readdirSync(from)) {
      copyResolvingLinks(path.join(from, entry), path.join(to, entry), inner)
    }
    return
  }
  fs.copyFileSync(from, to)
}

// 1. Traced dependencies from the standalone root.
copyResolvingLinks(path.join(standalone, "node_modules"), path.join(staging, "node_modules"))

// 2. The app itself, flattened up so server.js sits beside that node_modules. Its own
//    node_modules (where the `next` symlink lives) merges into the same directory.
copyResolvingLinks(path.join(standalone, "apps", "web"), staging)

// 3. Static assets and public/, which Next deliberately leaves out of the standalone output.
copyResolvingLinks(path.join(appWeb, ".next", "static"), path.join(staging, ".next", "static"))
if (fs.existsSync(path.join(appWeb, "public"))) {
  copyResolvingLinks(path.join(appWeb, "public"), path.join(staging, "public"))
}

// 4. Hoist every package to the top-level node_modules, npm-style, and drop pnpm's `.pnpm` store.
//
//    pnpm puts a package's dependencies *beside* it, inside `.pnpm/<id>/node_modules/`, and makes
//    that work with symlinks. With the symlinks replaced by copies (above), `node_modules/next`
//    sits outside that folder, so Node can't find its dependencies (`Cannot find module
//    '@swc/helpers/...'` — hit for real). Node walks *up* looking for `node_modules/<name>`, so
//    one copy of each package at the top level makes every require resolve.
//
//    That's only correct while each package exists in one version: two versions of the same
//    name can't both sit at `node_modules/<name>`. So a conflict fails the build instead of
//    quietly shipping whichever came first. (2026-09-28: 25 packages, 0 conflicts.)
const store = path.join(staging, "node_modules", ".pnpm")
const hoisted = new Map() // package name → version now at the top level
for (const id of fs.readdirSync(store)) {
  const packages = path.join(store, id, "node_modules")
  if (!fs.existsSync(packages)) continue
  for (const entry of fs.readdirSync(packages)) {
    // Scoped packages (`@swc/helpers`) are one directory deeper.
    const names = entry.startsWith("@")
      ? fs.readdirSync(path.join(packages, entry)).map((scoped) => `${entry}/${scoped}`)
      : [entry]
    for (const name of names) {
      const from = path.join(packages, name)
      const manifest = path.join(from, "package.json")
      if (!fs.existsSync(manifest)) continue
      const version = JSON.parse(fs.readFileSync(manifest, "utf8")).version
      const to = path.join(staging, "node_modules", name)
      if (hoisted.has(name) || fs.existsSync(to)) {
        const existing = hoisted.get(name) ?? JSON.parse(fs.readFileSync(path.join(to, "package.json"), "utf8")).version
        if (existing !== version) {
          fail(`${name} is needed in two versions (${existing}, ${version}), which a flat node_modules can't hold`)
        }
        continue
      }
      fs.mkdirSync(path.dirname(to), { recursive: true })
      fs.renameSync(from, to)
      hoisted.set(name, version)
    }
  }
}
fs.rmSync(store, { recursive: true, force: true })

// Fail loudly here rather than shipping an installer that dies on the user's machine — this is
// the exact failure this script was written to prevent, so it's worth asserting rather than
// assuming. "Does next resolve?" is NOT enough on its own: a leftover symlink resolves fine on
// the build machine and is exactly what broke the packaged app (see the header).
function findSymlinks(dir, found = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isSymbolicLink()) found.push(full)
    else if (entry.isDirectory()) findSymlinks(full, found)
  }
  return found
}
const leftover = findSymlinks(staging)
if (leftover.length > 0) {
  fail(`${leftover.length} symlink(s) left in ${staging}, which Tauri won't ship — e.g. ${leftover[0]}`)
}
const entry = path.join(staging, "server.js")
if (!fs.existsSync(entry)) fail(`no server.js in ${staging}`)
const next = path.join(staging, "node_modules", "next", "package.json")
if (!fs.existsSync(next)) fail(`\`next\` is not resolvable from ${staging} — the bundle would not run`)
if (droppedLinks.length > 0) {
  console.log(`stage-web: dropped ${droppedLinks.length} link(s) to untraced packages: ${droppedLinks.join(", ")}`)
}

// The app's build-time .env rides along, which is how this repo has always bundled it. Nothing
// secret lives there (NEXT_PUBLIC_* only), but it does pin NEXT_PUBLIC_API_URL into the shipped
// app.
const env = path.join(staging, ".env")
console.log(`stage-web: staged ${staging}`)
console.log(`stage-web: .env ${fs.existsSync(env) ? "included" : "not present"}`)
