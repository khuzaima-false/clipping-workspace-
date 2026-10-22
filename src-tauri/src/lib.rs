//! Tauri entry point for the Forgevyn desktop shell.
//!
//! The UI is the existing Next.js static export (`../out`), so the Rust side is
//! intentionally thin: create the native window, load the app, and let the
//! client-side studio do all the work.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running the Forgevyn desktop app");
}
