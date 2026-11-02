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
//!
//! Project IPC:
//! - native folder picking, project-directory creation, JSON manifest IO, and
//!   OS-keychain storage for optional cloud-auth sessions.

mod auth_store;
mod inspector;
mod project_fs;
mod window_controls;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(inspector::InspectorState::default())
        .invoke_handler(tauri::generate_handler![
            inspector::sync_inspector_params,
            inspector::get_inspector_params,
            project_fs::get_project_parent,
            project_fs::pick_project_folder,
            project_fs::create_project_directory,
            project_fs::load_project_manifest,
            project_fs::save_project_manifest,
            auth_store::save_auth_token,
            auth_store::load_auth_token,
            auth_store::clear_auth_token,
            window_controls::window_control
        ])
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_dialog::init())
        .run(tauri::generate_context!())
        .expect("error while running the Forgevyn desktop app");
}
