//! Inspector parameter mirror for the desktop frame-processing pipeline.
//!
//! The webview store remains the source of truth. These commands store a
//! passive snapshot so future Rust frame processing can read the same transform
//! and 3-way color-wheel values that the canvas renderer uses.

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

fn default_scale() -> f64 {
    1.0
}

fn default_opacity() -> f64 {
    1.0
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WheelPointParams {
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    #[serde(default)]
    pub r: Option<f64>,
    #[serde(default)]
    pub g: Option<f64>,
    #[serde(default)]
    pub b: Option<f64>,
    #[serde(default)]
    pub lum: Option<f64>,
    #[serde(default)]
    pub sat: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ColorWheelsParams {
    #[serde(default)]
    pub lift: WheelPointParams,
    #[serde(default)]
    pub gamma: WheelPointParams,
    #[serde(default)]
    pub gain: WheelPointParams,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipTransformParams {
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
    #[serde(default = "default_scale")]
    pub scale: f64,
    #[serde(default)]
    pub rotation: f64,
    #[serde(default = "default_opacity")]
    pub opacity: f64,
}

impl Default for ClipTransformParams {
    fn default() -> Self {
        Self {
            x: 0.0,
            y: 0.0,
            scale: default_scale(),
            rotation: 0.0,
            opacity: default_opacity(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct InspectorParams {
    #[serde(default)]
    pub clip_id: Option<String>,
    #[serde(default)]
    pub transform: ClipTransformParams,
    #[serde(default)]
    pub color_wheels: ColorWheelsParams,
}

/// Shared, thread-safe snapshot of the current Inspector parameters.
#[derive(Default)]
pub struct InspectorState(pub Mutex<Option<InspectorParams>>);

#[tauri::command]
pub async fn sync_inspector_params(
    state: State<'_, InspectorState>,
    params: InspectorParams,
) -> Result<(), String> {
    let mut guard = state
        .0
        .lock()
        .map_err(|error| format!("Inspector state lock poisoned: {error}"))?;
    *guard = Some(params);
    Ok(())
}

#[tauri::command]
pub async fn get_inspector_params(
    state: State<'_, InspectorState>,
) -> Result<Option<InspectorParams>, String> {
    let guard = state
        .0
        .lock()
        .map_err(|error| format!("Inspector state lock poisoned: {error}"))?;
    Ok(guard.clone())
}
