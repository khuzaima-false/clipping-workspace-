//! OS-keychain-backed storage for optional web-auth session tokens.
//!
//! Forgevyn remains local-first. This store is only populated when a desktop
//! user explicitly signs in to the web account, so future AI credit tracking
//! can use the same session as the browser.

use keyring::Entry;

const SERVICE: &str = "com.forgevyn.studio";
const ACCOUNT: &str = "web-auth-session";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|error| format!("Keychain unavailable: {error}"))
}

#[tauri::command]
pub fn save_auth_token(token: String) -> Result<(), String> {
    entry()?
        .set_password(&token)
        .map_err(|error| format!("Could not save session token: {error}"))
}

#[tauri::command]
pub fn load_auth_token() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
pub fn clear_auth_token() -> Result<(), String> {
    let _ = entry()?.delete_credential();
    Ok(())
}
