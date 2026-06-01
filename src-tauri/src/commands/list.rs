use tauri::{AppHandle, State};
use uuid::Uuid;

use crate::commands::helpers::{collect_subtree_ids, lock_error, persist_state};
use crate::storage::{now_millis, AppData, AppState, TodoList};

#[tauri::command]
pub fn create_list(
    name: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let list_name = if name.trim().is_empty() {
        "Nouvelle liste".to_string()
    } else {
        name.trim().to_string()
    };
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
    let trimmed_name = name.trim().to_string();
    if trimmed_name.is_empty() {
        return persist_state(&app, &state);
    }
    {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        if let Some(list) = guard.settings.lists.iter_mut().find(|list| list.id == id) {
            list.name = trimmed_name;
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
    let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
    if let Some(list) = guard.settings.lists.iter_mut().find(|list| list.id == id) {
        list.icon = icon;
    }
    drop(guard);
    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_active_list(
    id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
    if guard.settings.lists.iter().any(|list| list.id == id) {
        guard.settings.active_list_id = id;
    }
    drop(guard);
    persist_state(&app, &state)
}

#[tauri::command]
pub fn move_todo_to_list(
    id: String,
    list_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let normalized_list_id = list_id.trim().to_string();
    if normalized_list_id.is_empty() {
        return persist_state(&app, &state);
    }

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
        .map(|v| v.saturating_add(1));

    for todo in guard.todos.iter_mut() {
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
            .map(|p| !moved_ids.contains(p))
            .unwrap_or(false)
        {
            todo.parent_id = None;
        }
    }
    drop(guard);
    persist_state(&app, &state)
}

#[tauri::command]
pub fn clear_completed_in_list(
    list_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let normalized_list_id = list_id.trim().to_string();
    if normalized_list_id.is_empty() {
        return persist_state(&app, &state);
    }

    let removed_ids = {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        let ids: Vec<String> = guard
            .todos
            .iter()
            .filter(|t| {
                t.completed_at.is_some()
                    && t.list_id.as_deref() == Some(normalized_list_id.as_str())
            })
            .map(|t| t.id.clone())
            .collect();
        guard.todos.retain(|t| {
            !(t.completed_at.is_some() && t.list_id.as_deref() == Some(normalized_list_id.as_str()))
        });
        ids
    };

    let mut notified_guard = state
        .notified_todos
        .lock()
        .map_err(|_| lock_error("reminder"))?;
    for id in removed_ids {
        notified_guard.remove(&id);
    }
    drop(notified_guard);

    persist_state(&app, &state)
}
