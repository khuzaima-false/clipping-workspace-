//! Tauri entry point for the Forgevyn desktop shell.
//!
//! The UI is the existing Next.js static export (`../out`), so the Rust side is
//! intentionally thin: create the native window, load the app, and let the
//! client-side studio do all the work.
//!
//! Plugins:
//! - `updater`: checks GitHub Releases for signed updates (`latest.json`).
//! - `process`: relaunches the app after an update is installed.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running the Forgevyn desktop app");
}
