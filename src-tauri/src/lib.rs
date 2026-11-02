//! Tauri entry point for the Forgevyn desktop shell.
//!
//! The UI is the existing Next.js static export (`../out`), so the Rust side is
//! intentionally thin: create the native window, load the app, and let the
//! client-side studio do all the work.
//!
//! Plugins:
//! - `updater`: checks GitHub Releases for signed updates (`latest.json`).
//! - `process`: relaunches the app after an update is installed.
//!
//! Inspector IPC:
//! - `sync_inspector_params` / `get_inspector_params` mirror transform and
//!   3-way color-wheel state for future frame processing.

mod inspector;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(inspector::InspectorState::default())
        .invoke_handler(tauri::generate_handler![
            inspector::sync_inspector_params,
            inspector::get_inspector_params
        ])
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .run(tauri::generate_context!())
        .expect("error while running the Forgevyn desktop app");
}
