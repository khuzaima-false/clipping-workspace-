//! Native project filesystem support for the desktop studio.
//!
//! Each project can live in a user-visible folder:
//!
//! ```text
//! <project>/
//!   .forgevyn/
//!     project.forgevyn
//!     commits/
//!     cache/
//! ```
//!
//! The JSON manifest stores edit metadata only. Media blobs remain in the
//! existing IndexedDB/media store and are referenced by `mediaId`, so writing
//! history never duplicates source video.

use serde::{Deserialize, Serialize};
use serde_json::json;
use std::collections::hash_map::DefaultHasher;
use std::fs;
use std::hash::{Hash, Hasher};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tauri_plugin_dialog::DialogExt;

const MAX_COMMITS: usize = 100;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectDirInfo {
    pub path: String,
    pub project_json_path: String,
    pub created: bool,
}

fn sanitize_project_name(raw: &str) -> Result<String, String> {
    let trimmed = raw.trim().trim_end_matches(|c| c == '.' || c == ' ');
    if trimmed.is_empty() || trimmed == "." || trimmed == ".." {
        return Err("Project folder name is required.".into());
    }
    if trimmed
        .chars()
        .any(|c| matches!(c, '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|'))
    {
        return Err("Project folder name contains an invalid character.".into());
    }

    let stem = trimmed
        .split('.')
        .next()
        .unwrap_or(trimmed)
        .to_ascii_uppercase();
    let reserved = [
        "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6",
        "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7",
        "LPT8", "LPT9",
    ];
    if reserved
        .iter()
        .any(|reserved_name| *reserved_name == stem)
    {
        return Err("That folder name is reserved by the operating system.".into());
    }

    Ok(trimmed.to_string())
}

fn manifest_path(path: &Path) -> PathBuf {
    if path.file_name().and_then(|name| name.to_str()) == Some("project.forgevyn") {
        path.to_path_buf()
    } else {
        path.join(".forgevyn").join("project.forgevyn")
    }
}

fn prune_commits(commits: &Path) -> Result<(), String> {
    let mut entries: Vec<PathBuf> = fs::read_dir(commits)
        .map_err(|error| format!("Could not read commit history: {error}"))?
        .filter_map(|entry| entry.ok().map(|value| value.path()))
        .filter(|path| path.extension().and_then(|value| value.to_str()) == Some("json"))
        .collect();
    entries.sort();
    if entries.len() > MAX_COMMITS {
        let remove = entries.len() - MAX_COMMITS;
        for path in entries.drain(..remove) {
            let _ = fs::remove_file(path);
        }
    }
    Ok(())
}

fn append_commit(manifest: &Path, serialized: &[u8]) -> Result<(), String> {
    let Some(parent) = manifest.parent() else {
        return Err("Project manifest has no parent folder.".into());
    };
    let commits = parent.join("commits");
    fs::create_dir_all(&commits)
        .map_err(|error| format!("Could not create commit history: {error}"))?;

    let mut hasher = DefaultHasher::new();
    serialized.hash(&mut hasher);
    let hash = format!("{:016x}", hasher.finish());
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    let commit = commits.join(format!("{timestamp}-{hash}.json"));
    if !commit.exists() {
        fs::write(&commit, serialized)
            .map_err(|error| format!("Could not write project commit: {error}"))?;
    }
    prune_commits(&commits)
}

fn seed_manifest(name: &str) -> serde_json::Value {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or(0);
    json!({
        "format": "forgevyn-project",
        "version": 1,
        "id": format!("local-{now}"),
        "title": name,
        "createdAt": now,
        "updatedAt": now,
        "settings": { "storage": "desktop" },
        "timeline": {
            "assets": [],
            "sequence": [],
            "overlays": [],
            "audio": []
        }
    })
}

/// Returns the default parent folder for app-managed projects.
///
/// `kind` is `"app"` (%APPDATA% or ~/.config/forgevyn) or `"desktop"`.
#[tauri::command]
pub fn get_project_parent(app: AppHandle, kind: String) -> Result<String, String> {
    #[cfg(target_os = "linux")]
    let base = app.path().config_dir();
    #[cfg(not(target_os = "linux"))]
    let base = app.path().data_dir();

    let base = base.map_err(|error| format!("Could not resolve app storage: {error}"))?;
    let parent = if kind == "desktop" {
        app.path()
            .desktop_dir()
            .map_err(|error| format!("Could not resolve Desktop: {error}"))?
    } else {
        base.join("forgevyn").join("projects")
    };
    fs::create_dir_all(&parent)
        .map_err(|error| format!("Could not create project parent: {error}"))?;
    Ok(parent.to_string_lossy().into_owned())
}

/// Opens the native folder picker and returns the selected parent folder.
#[tauri::command]
pub async fn pick_project_folder(app: AppHandle) -> Result<Option<String>, String> {
    let picked = app
        .dialog()
        .file()
        .set_title("Choose a Forgevyn project folder")
        .blocking_pick_folder();

    match picked {
        Some(path) => path
            .into_path()
            .map(|path| Some(path.to_string_lossy().into_owned()))
            .map_err(|error| format!("Could not read selected folder: {error}")),
        None => Ok(None),
    }
}

/// Creates `<parent>/<name>/.forgevyn/` and a seed manifest.
#[tauri::command]
pub fn create_project_directory(parent: String, name: String) -> Result<ProjectDirInfo, String> {
    let clean_name = sanitize_project_name(&name)?;
    let parent_path = PathBuf::from(&parent);
    if !parent_path.is_absolute() {
        return Err("Project parent folder must be absolute.".into());
    }

    let root = parent_path.join(&clean_name);
    let forge_dir = root.join(".forgevyn");
    let commits = forge_dir.join("commits");
    let cache = forge_dir.join("cache");
    let manifest = forge_dir.join("project.forgevyn");
    let created = !manifest.exists();

    fs::create_dir_all(&commits)
        .map_err(|error| format!("Could not create project directory: {error}"))?;
    fs::create_dir_all(&cache)
        .map_err(|error| format!("Could not create project cache: {error}"))?;

    if created {
        let seed = seed_manifest(&clean_name);
        let serialized = serde_json::to_vec_pretty(&seed)
            .map_err(|error| format!("Could not serialize project seed: {error}"))?;
        fs::write(&manifest, serialized)
            .map_err(|error| format!("Could not write project manifest: {error}"))?;
    }

    Ok(ProjectDirInfo {
        path: root.to_string_lossy().into_owned(),
        project_json_path: manifest.to_string_lossy().into_owned(),
        created,
    })
}

/// Reads a project manifest. Accepts either the project root or manifest path.
#[tauri::command]
pub async fn load_project_manifest(
    path: String,
) -> Result<Option<serde_json::Value>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manifest = manifest_path(&PathBuf::from(path));
        if !manifest.exists() {
            return Ok(None);
        }
        let text = fs::read_to_string(&manifest)
            .map_err(|error| format!("Could not read project manifest: {error}"))?;
        let value = serde_json::from_str(&text)
            .map_err(|error| format!("Project manifest is not valid JSON: {error}"))?;
        Ok(Some(value))
    })
    .await
    .map_err(|error| format!("Project read task failed: {error}"))?
}

/// Writes a project manifest atomically and appends a bounded commit snapshot.
#[tauri::command]
pub async fn save_project_manifest(
    path: String,
    data: serde_json::Value,
) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        let manifest = manifest_path(&PathBuf::from(path));
        let parent = manifest
            .parent()
            .ok_or_else(|| "Project manifest has no parent folder.".to_string())?;
        fs::create_dir_all(parent)
            .map_err(|error| format!("Could not create project folder: {error}"))?;

        let serialized = serde_json::to_vec_pretty(&data)
            .map_err(|error| format!("Could not serialize project manifest: {error}"))?;
        let temporary = manifest.with_file_name("project.forgevyn.tmp");
        fs::write(&temporary, &serialized)
            .map_err(|error| format!("Could not write project manifest: {error}"))?;
        if fs::rename(&temporary, &manifest).is_err() {
            // Windows can refuse to replace an existing destination.
            let _ = fs::remove_file(&manifest);
            fs::rename(&temporary, &manifest)
                .map_err(|error| format!("Could not replace project manifest: {error}"))?;
        }

        append_commit(&manifest, &serialized)
    })
    .await
    .map_err(|error| format!("Project write task failed: {error}"))?
}
