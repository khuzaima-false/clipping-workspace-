//! Native window controls used by the compact studio menu and F11 shortcut.

use tauri::{AppHandle, Manager};

#[tauri::command]
pub fn window_control(app: AppHandle, action: String) -> Result<(), String> {
    let Some(window) = app.get_webview_window("main") else {
        return Ok(());
    };

    match action.as_str() {
        "fullscreen" => {
            let next = !window
                .is_fullscreen()
                .map_err(|error| format!("Could not read fullscreen state: {error}"))?;
            window
                .set_fullscreen(next)
                .map_err(|error| format!("Could not toggle fullscreen: {error}"))
        }
        "maximize" => window
            .maximize()
            .map_err(|error| format!("Could not maximize window: {error}")),
        "unmaximize" => window
            .unmaximize()
            .map_err(|error| format!("Could not restore window: {error}")),
        "minimize" => window
            .minimize()
            .map_err(|error| format!("Could not minimize window: {error}")),
        _ => Ok(()),
    }
}
