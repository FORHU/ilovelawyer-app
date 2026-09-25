# Node sidecar binary

`tauri build` needs a portable Node executable here, named to match your build target's
Rust triple, e.g. on 64-bit Windows:

```
node-x86_64-pc-windows-msvc.exe
```

Get one from https://nodejs.org (the plain Windows binary distribution, not an installer),
matching the Node version `ilovelawyer-app` targets (`engines.node: >=20` in its root
`package.json`), and drop it in this folder. Tauri appends the triple automatically based
on `bundle.externalBin: ["binaries/node"]` in `tauri.conf.json`.

Not needed for `tauri dev` — dev mode loads `ilovelawyer-app`'s already-running `next dev`
server instead of spawning this sidecar (see the `cfg!(debug_assertions)` check in
`src/lib.rs`, and Plan §Phase 2/8 in `../../architecture/tauri-desktop-shell-plan.md`).
