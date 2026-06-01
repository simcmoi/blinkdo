use std::collections::HashSet;
use tauri::{AppHandle, State};

use crate::commands::helpers::{lock_error, persist_state, sanitize_settings};
use crate::storage::{normalize_shortcut, AppData, AppState, Settings};

#[tauri::command]
pub fn update_settings(
    settings: Settings,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let sanitized_settings = sanitize_settings(settings);
    let previous_shortcut = state
        .data
        .lock()
        .map_err(|_| lock_error("todo"))?
        .settings
        .global_shortcut
        .clone();

    if sanitized_settings.global_shortcut != previous_shortcut {
        crate::shortcuts::replace_registered_shortcut(&app, &sanitized_settings.global_shortcut)
            .map_err(|e| format!("failed to update global shortcut: {e}"))?;
    }

    let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
    guard.settings = sanitized_settings;

    let valid_list_ids: HashSet<String> =
        guard.settings.lists.iter().map(|l| l.id.clone()).collect();
    let valid_label_ids: HashSet<String> =
        guard.settings.labels.iter().map(|l| l.id.clone()).collect();
    let fallback_list_id = guard.settings.active_list_id.clone();

    for todo in &mut guard.todos {
        match todo.list_id.as_deref() {
            Some(list_id) if valid_list_ids.contains(list_id) => {}
            _ => {
                todo.list_id = Some(fallback_list_id.clone());
            }
        }
        match todo.label_id.as_deref() {
            Some(label_id) if valid_label_ids.contains(label_id) => {}
            _ => {
                todo.label_id = None;
            }
        }
    }
    drop(guard);

    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_global_shortcut(
    shortcut: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let normalized_shortcut = normalize_shortcut(&shortcut);
    crate::shortcuts::replace_registered_shortcut(&app, &normalized_shortcut)
        .map_err(|e| format!("failed to update global shortcut: {e}"))?;

    let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
    guard.settings.global_shortcut = normalized_shortcut;
    drop(guard);

    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_autostart_enabled(
    enabled: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    use tauri_plugin_autostart::ManagerExt;

    let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
    guard.settings.enable_autostart = enabled;
    drop(guard);

    if enabled {
        app.autolaunch()
            .enable()
            .map_err(|e| format!("failed to enable autostart: {e}"))?;
    } else {
        app.autolaunch()
            .disable()
            .map_err(|e| format!("failed to disable autostart: {e}"))?;
    }

    persist_state(&app, &state)
}
