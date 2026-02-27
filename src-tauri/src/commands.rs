use std::collections::{HashMap, HashSet};
use tauri::{AppHandle, Emitter, Manager, State};
use uuid::Uuid;

use crate::shortcuts;
use crate::storage::{
    normalize_shortcut, now_millis, persist, AppData, AppState, Settings, Todo, TodoLabel,
    TodoList, TodoPriority, DEFAULT_LIST_ID,
};
use crate::window;

fn lock_error(name: &str) -> String {
    format!("failed to lock {name} state")
}

fn persist_state(app: &AppHandle, state: &State<'_, AppState>) -> Result<AppData, String> {
    let snapshot = state.data.lock().map_err(|_| lock_error("todo"))?.clone();
    persist(app, &snapshot)?;
    Ok(snapshot)
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn normalize_optional_id(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn normalize_list_name(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

fn normalize_label_color(value: &str) -> String {
    let normalized = value.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "slate" | "blue" | "green" | "amber" | "rose" | "violet" => normalized,
        _ => "slate".to_string(),
    }
}

fn sanitize_settings(mut settings: Settings) -> Settings {
    if settings.lists.is_empty() {
        settings.lists.push(TodoList {
            id: DEFAULT_LIST_ID.to_string(),
            name: "Mes tâches".to_string(),
            icon: None,
            created_at: now_millis(),
        });
    }

    for (index, list) in settings.lists.iter_mut().enumerate() {
        list.name = normalize_list_name(
            &list.name,
            if index == 0 {
                "Mes tâches"
            } else {
                "Nouvelle liste"
            },
        );
    }

    if !settings
        .lists
        .iter()
        .any(|list| list.id == settings.active_list_id)
    {
        settings.active_list_id = settings
            .lists
            .first()
            .map(|list| list.id.clone())
            .unwrap_or_else(|| DEFAULT_LIST_ID.to_string());
    }

    if settings.labels.is_empty() {
        settings.labels.push(TodoLabel {
            id: "general".to_string(),
            name: "Général".to_string(),
            color: "slate".to_string(),
        });
    } else {
        let mut used_label_ids = HashSet::new();
        for (index, label) in settings.labels.iter_mut().enumerate() {
            let fallback_name = format!("Label {}", index + 1);
            label.name = normalize_list_name(&label.name, &fallback_name);
            label.color = normalize_label_color(&label.color);

            let mut label_id = normalize_list_name(&label.id, &format!("label-{}", index + 1));
            if used_label_ids.contains(&label_id) {
                label_id = format!("label-{}-{}", index + 1, now_millis());
            }
            used_label_ids.insert(label_id.clone());
            label.id = label_id;
        }
    }

    settings.global_shortcut = normalize_shortcut(&settings.global_shortcut);

    settings.legacy_list_name = None;
    settings
}

fn collect_subtree_ids(todos: &[Todo], root_id: &str) -> HashSet<String> {
    let mut children_by_parent: HashMap<&str, Vec<&str>> = HashMap::new();
    for todo in todos {
        if let Some(parent_id) = todo.parent_id.as_deref() {
            children_by_parent
                .entry(parent_id)
                .or_default()
                .push(todo.id.as_str());
        }
    }

    let mut stack = vec![root_id];
    let mut visited = HashSet::new();

    while let Some(current) = stack.pop() {
        if !visited.insert(current.to_string()) {
            continue;
        }

        if let Some(children) = children_by_parent.get(current) {
            for child_id in children {
                stack.push(child_id);
            }
        }
    }

    visited
}

fn push_todo(
    state: &State<'_, AppState>,
    title: String,
    details: Option<String>,
    reminder_at: Option<i64>,
    parent_id: Option<String>,
    list_id: Option<String>,
) -> Result<(), String> {
    let trimmed_title = title.trim();
    if trimmed_title.is_empty() {
        return Ok(());
    }

    let normalized_details = normalize_optional_text(details);
    let normalized_parent_id = normalize_optional_id(parent_id);
    let normalized_list_id = normalize_optional_id(list_id);

    let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
    let target_list_id = normalized_list_id
        .filter(|candidate| {
            guard
                .settings
                .lists
                .iter()
                .any(|list| list.id == *candidate)
        })
        .unwrap_or_else(|| guard.settings.active_list_id.clone());

    let validated_parent_id = normalized_parent_id.and_then(|candidate_parent| {
        guard
            .todos
            .iter()
            .find(|todo| {
                todo.id == candidate_parent
                    && todo.list_id.as_deref() == Some(target_list_id.as_str())
            })
            .map(|todo| todo.id.clone())
    });

    let next_sort_index = guard
        .todos
        .iter()
        .filter(|todo| {
            todo.list_id.as_deref() == Some(target_list_id.as_str())
                && todo.parent_id.as_deref() == validated_parent_id.as_deref()
                && todo.completed_at.is_none()
        })
        .filter_map(|todo| todo.sort_index)
        .max()
        .map(|value| value.saturating_add(1));

    guard.todos.push(Todo {
        id: Uuid::new_v4().to_string(),
        title: trimmed_title.to_string(),
        details: normalized_details,
        parent_id: validated_parent_id,
        list_id: Some(target_list_id),
        starred: false,
        priority: TodoPriority::None,
        label_id: None,
        sort_index: next_sort_index,
        created_at: now_millis(),
        completed_at: None,
        reminder_at,
    });

    Ok(())
}

#[tauri::command]
pub fn set_window_width(app: AppHandle, width: f64) -> Result<(), String> {
    // Try overlay window first, then main window
    let window = app
        .get_webview_window("overlay")
        .or_else(|| app.get_webview_window("main"))
        .ok_or_else(|| "no window found".to_string())?;
    
    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let is_overlay = window.label() == "overlay";
    
    // Get current size in LOGICAL pixels
    let current_size = window
        .inner_size()
        .map_err(|error| format!("failed to get window size: {error}"))?
        .to_logical::<f64>(scale_factor);
    
    log::info!(
        "Setting window width: requested={}, scale={}, current_logical={:?}, is_overlay={}",
        width, scale_factor, current_size, is_overlay
    );
    
    // For overlay window, calculate centered position before resizing
    if is_overlay {
        // Get current monitor
        let monitor = window
            .current_monitor()
            .map_err(|error| format!("failed to get current monitor: {error}"))?
            .ok_or_else(|| "no monitor found".to_string())?;
        
        let monitor_size = monitor.size().to_logical::<f64>(scale_factor);
        let monitor_position = monitor.position().to_logical::<f64>(scale_factor);
        
        // Calculate centered position for the new width
        let new_x = monitor_position.x + (monitor_size.width - width) / 2.0;
        let new_y = monitor_position.y + (monitor_size.height - current_size.height) / 2.0;
        
        log::info!(
            "Centering overlay: monitor_size={:?}, new_position=({}, {})",
            monitor_size, new_x, new_y
        );
        
        // Set position and size together
        window
            .set_position(tauri::LogicalPosition { x: new_x, y: new_y })
            .map_err(|error| format!("failed to set window position: {error}"))?;
        
        window
            .set_size(tauri::LogicalSize {
                width,
                height: current_size.height,
            })
            .map_err(|error| format!("failed to set window size: {error}"))?;
    } else {
        // For main window, just resize without centering
        window
            .set_size(tauri::LogicalSize {
                width,
                height: current_size.height,
            })
            .map_err(|error| format!("failed to set window size: {error}"))?;
    }
    
    Ok(())
}


#[tauri::command]
pub fn get_log_file_path(app: AppHandle) -> Result<String, String> {
    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|error| format!("failed to resolve log directory: {error}"))?;

    let path = log_dir.join("blinkdo.log");

    path.to_str()
        .ok_or_else(|| "invalid path".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
pub fn open_log_file(app: AppHandle) -> Result<(), String> {
    log::info!("Opening log file");

    let log_dir = app
        .path()
        .app_log_dir()
        .map_err(|error| format!("failed to resolve log directory: {error}"))?;

    let path = log_dir.join("blinkdo.log");

    // Vérifier si le fichier existe
    if !path.exists() {
        return Err("Log file does not exist yet".to_string());
    }

    // Utiliser la commande 'open' sur macOS pour ouvrir le fichier avec l'éditeur par défaut
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|error| format!("failed to open log file: {error}"))?;
    }

    // Utiliser 'xdg-open' sur Linux
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|error| format!("failed to open log file: {error}"))?;
    }

    // Utiliser 'start' sur Windows
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", path.to_str().unwrap_or("")])
            .spawn()
            .map_err(|error| format!("failed to open log file: {error}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn reset_all_data(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    log::info!("Resetting all data");

    // Clear in-memory state
    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        *guard = AppData::default();
    }

    // Clear notified todos
    {
        let mut notified_guard = state
            .notified_todos
            .lock()
            .map_err(|_| lock_error("reminder"))?;
        notified_guard.clear();
    }

    // Re-register the default shortcut after reset
    if let Err(error) =
        crate::shortcuts::replace_registered_shortcut(&app, crate::storage::DEFAULT_GLOBAL_SHORTCUT)
    {
        log::error!("failed to re-register shortcut after reset: {error}");
        // Don't fail the reset if shortcut registration fails
    }

    // Delete the data file
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve appDataDir: {error}"))?;

    let path = app_dir.join(crate::storage::STORAGE_FILE_NAME);

    if path.exists() {
        std::fs::remove_file(&path)
            .map_err(|error| format!("failed to delete data file: {error}"))?;
    }

    // Emit event to notify frontend that data has been reset
    app.emit("data-reset", ()).ok();

    log::info!("All data has been reset");
    Ok(())
}

#[tauri::command]
pub fn load_state(state: State<'_, AppState>) -> AppData {
    state.snapshot()
}

#[tauri::command]
pub fn add_todo(
    text: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    log::info!("Adding todo: {}", text);
    push_todo(&state, text, None, None, None, None)?;
    persist_state(&app, &state)
}

#[tauri::command]
pub fn create_todo(
    title: String,
    details: Option<String>,
    reminder_at: Option<i64>,
    parent_id: Option<String>,
    list_id: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    log::info!(
        "Creating todo: title='{}', has_details={}, has_reminder={}, parent_id={:?}, list_id={:?}",
        title,
        details.is_some(),
        reminder_at.is_some(),
        parent_id,
        list_id
    );
    push_todo(&state, title, details, reminder_at, parent_id, list_id)?;
    persist_state(&app, &state)
}

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoPatchInput {
    pub id: String,
    pub title: String,
    pub details: Option<String>,
    pub reminder_at: Option<i64>,
}

#[tauri::command]
pub fn update_todo(
    payload: TodoPatchInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    log::info!(
        "Updating todo: id='{}', title='{}'",
        payload.id,
        payload.title
    );

    let trimmed_title = payload.title.trim();
    if trimmed_title.is_empty() {
        return persist_state(&app, &state);
    }

    let normalized_details = normalize_optional_text(payload.details);
    let mut should_reset_reminder_notification = false;

    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;

        if let Some(todo) = guard.todos.iter_mut().find(|todo| todo.id == payload.id) {
            should_reset_reminder_notification = todo.reminder_at != payload.reminder_at;
            todo.title = trimmed_title.to_string();
            todo.details = normalized_details;
            todo.reminder_at = payload.reminder_at;
        }
    }

    if should_reset_reminder_notification {
        let mut notified_guard = state
            .notified_todos
            .lock()
            .map_err(|_| lock_error("reminder"))?;
        notified_guard.remove(&payload.id);
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn complete_todo(
    id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    set_todo_completed(id, true, app, state)
}

#[tauri::command]
pub fn set_todo_completed(
    id: String,
    completed: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    log::info!(
        "Setting todo completed: id='{}', completed={}",
        id,
        completed
    );

    let next_completed_at = completed.then_some(now_millis());

    let affected_ids = {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        let ids = collect_subtree_ids(&guard.todos, &id);

        for todo in guard.todos.iter_mut() {
            if ids.contains(&todo.id) {
                todo.completed_at = next_completed_at;
            }
        }
        ids
    };

    if completed && !affected_ids.is_empty() {
        let mut notified_guard = state
            .notified_todos
            .lock()
            .map_err(|_| lock_error("reminder"))?;
        for affected_id in affected_ids {
            notified_guard.remove(&affected_id);
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_todo_starred(
    id: String,
    starred: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;

        if let Some(todo) = guard.todos.iter_mut().find(|todo| todo.id == id) {
            todo.starred = starred;
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_todo_priority(
    id: String,
    priority: TodoPriority,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;

        if let Some(todo) = guard.todos.iter_mut().find(|todo| todo.id == id) {
            todo.priority = priority;
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_todo_label(
    id: String,
    label_id: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let normalized_label_id = normalize_optional_id(label_id);

    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        let valid_label_id = normalized_label_id.and_then(|candidate| {
            guard
                .settings
                .labels
                .iter()
                .find(|label| label.id == candidate)
                .map(|label| label.id.clone())
        });

        if let Some(todo) = guard.todos.iter_mut().find(|todo| todo.id == id) {
            todo.label_id = valid_label_id;
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn create_list(
    name: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let list_name = normalize_list_name(&name, "Nouvelle liste");
    let list_id = Uuid::new_v4().to_string();

    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        guard.settings.lists.push(TodoList {
            id: list_id.clone(),
            name: list_name,
            icon: None,
            created_at: now_millis(),
        });
        guard.settings.active_list_id = list_id;
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn rename_list(
    id: String,
    name: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let trimmed_name = name.trim();
    if trimmed_name.is_empty() {
        return persist_state(&app, &state);
    }

    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        if let Some(list) = guard.settings.lists.iter_mut().find(|list| list.id == id) {
            list.name = trimmed_name.to_string();
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_list_icon(
    id: String,
    icon: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        if let Some(list) = guard.settings.lists.iter_mut().find(|list| list.id == id) {
            list.icon = icon;
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_active_list(
    id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        if guard.settings.lists.iter().any(|list| list.id == id) {
            guard.settings.active_list_id = id;
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn move_todo_to_list(
    id: String,
    list_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let normalized_list_id = normalize_list_name(&list_id, "");
    if normalized_list_id.is_empty() {
        return persist_state(&app, &state);
    }

    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;

        if !guard
            .settings
            .lists
            .iter()
            .any(|list| list.id == normalized_list_id)
        {
            return persist_state(&app, &state);
        }

        let moved_ids = collect_subtree_ids(&guard.todos, &id);
        if moved_ids.is_empty() {
            return persist_state(&app, &state);
        }

        let root_completed = guard
            .todos
            .iter()
            .find(|todo| todo.id == id)
            .map(|todo| todo.completed_at.is_some())
            .unwrap_or(false);

        let next_root_sort_index = guard
            .todos
            .iter()
            .filter(|todo| {
                todo.list_id.as_deref() == Some(normalized_list_id.as_str())
                    && todo.parent_id.is_none()
                    && (todo.completed_at.is_some() == root_completed)
            })
            .filter_map(|todo| todo.sort_index)
            .max()
            .map(|value| value.saturating_add(1));

        for todo in &mut guard.todos {
            if !moved_ids.contains(&todo.id) {
                continue;
            }

            todo.list_id = Some(normalized_list_id.clone());
            if todo.id == id {
                todo.parent_id = None;
                todo.sort_index = next_root_sort_index;
                continue;
            }

            if todo
                .parent_id
                .as_ref()
                .map(|parent_id| !moved_ids.contains(parent_id))
                .unwrap_or(false)
            {
                todo.parent_id = None;
            }
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn clear_completed_in_list(
    list_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let normalized_list_id = normalize_list_name(&list_id, "");
    if normalized_list_id.is_empty() {
        return persist_state(&app, &state);
    }

    let removed_ids = {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;

        let ids = guard
            .todos
            .iter()
            .filter(|todo| {
                todo.completed_at.is_some()
                    && todo.list_id.as_deref() == Some(normalized_list_id.as_str())
            })
            .map(|todo| todo.id.clone())
            .collect::<Vec<_>>();

        guard.todos.retain(|todo| {
            !(todo.completed_at.is_some()
                && todo.list_id.as_deref() == Some(normalized_list_id.as_str()))
        });
        ids
    };

    {
        let mut notified_guard = state
            .notified_todos
            .lock()
            .map_err(|_| lock_error("reminder"))?;
        for id in removed_ids {
            notified_guard.remove(&id);
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn reorder_todos(
    list_id: String,
    parent_id: Option<String>,
    completed: bool,
    ordered_ids: Vec<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    if ordered_ids.len() < 2 {
        return persist_state(&app, &state);
    }

    {
        let normalized_parent_id = normalize_optional_id(parent_id);
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;

        let sibling_ids: Vec<String> = guard
            .todos
            .iter()
            .filter(|todo| {
                todo.list_id.as_deref() == Some(list_id.as_str())
                    && todo.parent_id.as_deref() == normalized_parent_id.as_deref()
                    && (todo.completed_at.is_some() == completed)
            })
            .map(|todo| todo.id.clone())
            .collect();

        if sibling_ids.len() >= 2 {
            let sibling_set: HashSet<String> = sibling_ids.iter().cloned().collect();
            let mut seen = HashSet::new();
            let mut deduped_order: Vec<String> = Vec::with_capacity(sibling_ids.len());

            for candidate in ordered_ids {
                if sibling_set.contains(&candidate) && seen.insert(candidate.clone()) {
                    deduped_order.push(candidate);
                }
            }

            if deduped_order.len() >= 2 {
                let rank_by_id: HashMap<String, i64> = deduped_order
                    .into_iter()
                    .enumerate()
                    .map(|(index, id)| (id, index as i64))
                    .collect();

                for todo in &mut guard.todos {
                    if let Some(rank) = rank_by_id.get(&todo.id) {
                        todo.sort_index = Some(*rank);
                    }
                }
            }
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn delete_todo(
    id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    log::info!("Deleting todo: id='{}'", id);

    let deleted_ids = {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        let mut ids = collect_subtree_ids(&guard.todos, &id);
        if ids.is_empty() {
            ids.insert(id.clone());
        }
        guard.todos.retain(|todo| !ids.contains(&todo.id));
        ids
    };

    {
        let mut notified_guard = state
            .notified_todos
            .lock()
            .map_err(|_| lock_error("reminder"))?;
        for deleted_id in deleted_ids {
            notified_guard.remove(&deleted_id);
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn clear_history(app: AppHandle, state: State<'_, AppState>) -> Result<AppData, String> {
    let completed_ids: Vec<String> = {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;

        let ids = guard
            .todos
            .iter()
            .filter(|todo| todo.completed_at.is_some())
            .map(|todo| todo.id.clone())
            .collect::<Vec<_>>();

        guard.todos.retain(|todo| todo.completed_at.is_none());
        ids
    };

    {
        let mut notified_guard = state
            .notified_todos
            .lock()
            .map_err(|_| lock_error("reminder"))?;
        for id in completed_ids {
            notified_guard.remove(&id);
        }
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn update_settings(
    settings: Settings,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let sanitized_settings = sanitize_settings(settings);
    let previous_shortcut = {
        state
            .data
            .lock()
            .map_err(|_| lock_error("todo"))?
            .settings
            .global_shortcut
            .clone()
    };

    if sanitized_settings.global_shortcut != previous_shortcut {
        shortcuts::replace_registered_shortcut(&app, &sanitized_settings.global_shortcut)
            .map_err(|error| format!("failed to update global shortcut: {error}"))?;
    }

    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        guard.settings = sanitized_settings;

        let valid_list_ids: HashSet<String> = guard
            .settings
            .lists
            .iter()
            .map(|list| list.id.clone())
            .collect();
        let valid_label_ids: HashSet<String> = guard
            .settings
            .labels
            .iter()
            .map(|label| label.id.clone())
            .collect();
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
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_global_shortcut(
    shortcut: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let normalized_shortcut = normalize_shortcut(&shortcut);
    shortcuts::replace_registered_shortcut(&app, &normalized_shortcut)
        .map_err(|error| format!("failed to update global shortcut: {error}"))?;

    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        guard.settings.global_shortcut = normalized_shortcut;
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_autostart_enabled(
    enabled: bool,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    use tauri_plugin_autostart::ManagerExt;

    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        guard.settings.enable_autostart = enabled;
    }

    if enabled {
        if let Err(error) = app.autolaunch().enable() {
            log::error!("failed to enable autostart: {error}");
            return Err(format!("failed to enable autostart: {error}"));
        }
    } else if let Err(error) = app.autolaunch().disable() {
        log::error!("failed to disable autostart: {error}");
        return Err(format!("failed to disable autostart: {error}"));
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_todo_reminder(
    id: String,
    reminder_at: Option<i64>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let mut should_reset_reminder_notification = false;

    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;

        if let Some(todo) = guard.todos.iter_mut().find(|todo| todo.id == id) {
            should_reset_reminder_notification = todo.reminder_at != reminder_at;
            todo.reminder_at = reminder_at;
        }
    }

    if should_reset_reminder_notification {
        let mut notified_guard = state
            .notified_todos
            .lock()
            .map_err(|_| lock_error("reminder"))?;
        notified_guard.remove(&id);
    }

    persist_state(&app, &state)
}

#[tauri::command]
pub fn hide_overlay(app: AppHandle) -> Result<(), String> {
    window::hide_main_window(&app).map_err(|error| error.to_string())
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn get_data_file_path(app: AppHandle) -> Result<String, String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve appDataDir: {error}"))?;

    let path = app_dir.join(crate::storage::STORAGE_FILE_NAME);

    path.to_str()
        .ok_or_else(|| "invalid path".to_string())
        .map(|s| s.to_string())
}

#[tauri::command]
pub fn open_data_file(app: AppHandle) -> Result<(), String> {
    let app_dir = app
        .path()
        .app_data_dir()
        .map_err(|error| format!("failed to resolve appDataDir: {error}"))?;

    let path = app_dir.join(crate::storage::STORAGE_FILE_NAME);

    // Utiliser la commande 'open' sur macOS pour ouvrir le fichier avec l'éditeur par défaut
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|error| format!("failed to open file: {error}"))?;
    }

    // Utiliser 'xdg-open' sur Linux
    #[cfg(target_os = "linux")]
    {
        std::process::Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|error| format!("failed to open file: {error}"))?;
    }

    // Utiliser 'start' sur Windows
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", path.to_str().unwrap_or("")])
            .spawn()
            .map_err(|error| format!("failed to open file: {error}"))?;
    }

    Ok(())
}
