fn main() {
    // Declaring the app's commands generates an `allow-<command>` permission for each. Without
    // this, Tauri only lets *local* pages call them — and every window here loads a URL, which
    // counts as remote whenever it isn't the dev server (ph.localhost, *.ilovelawyer.com), so
    // every command would be rejected with "not allowed". Granted in capabilities/default.json.
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "open_case_terminal",
            "open_panel_window",
            "current_dock_target",
        ]),
    ))
    .expect("failed to run tauri-build");
}
