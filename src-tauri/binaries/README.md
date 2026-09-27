# Node sidecar binary

Tauri needs a Node executable here, named to match your build target's Rust triple, e.g. on
64-bit Windows:

```
node-x86_64-pc-windows-msvc.exe
```

**Needed for `tauri dev` too, not just `tauri build`.** `tauri-build` checks that every
`bundle.externalBin` entry exists at compile time, so without this file cargo fails before the
app ever starts — even though dev mode never runs it (it loads the `next dev` server that
`beforeDevCommand` starts instead; see the `cfg!(dev)` check in `src/lib.rs`).

For dev, copying your installed Node is enough (see `docs/desktop/getting-started.md` §8):

```powershell
copy "$(where.exe node)" src-tauri\binaries\node-x86_64-pc-windows-msvc.exe
```

For a real `tauri build`, use the plain Windows binary distribution from https://nodejs.org (not
an installer), matching the Node version the app targets (`engines.node: >=20` in the root
`package.json`). Tauri appends the triple automatically based on
`bundle.externalBin: ["binaries/node"]` in `tauri.conf.json`.
