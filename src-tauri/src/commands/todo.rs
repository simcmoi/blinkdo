use std::collections::{HashMap, HashSet};
use tauri::{AppHandle, State};

use crate::commands::helpers::{
    collect_subtree_ids, lock_error, normalize_optional_id, normalize_optional_text, persist_state,
    push_todo,
};
use crate::storage::{now_millis, AppData, AppState, TodoPriority, TodoStatus};

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoPatchInput {
    pub id: String,
    pub title: String,
    pub details: Option<String>,
    pub reminder_at: Option<i64>,
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
    log::info!("Creating todo: title='{}'", title);
    push_todo(&state, title, details, reminder_at, parent_id, list_id)?;
    persist_state(&app, &state)
}

#[tauri::command]
pub fn update_todo(
    payload: TodoPatchInput,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    log::info!("Updating todo: id='{}'", payload.id);
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
    log::info!("Setting todo completed: id='{}'", id);
    let next_completed_at = completed.then_some(now_millis());
    let next_status = if completed {
        TodoStatus::Done
    } else {
        TodoStatus::Todo
    };
    let affected_ids = {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        let ids = collect_subtree_ids(&guard.todos, &id);
        for todo in guard.todos.iter_mut() {
            if ids.contains(&todo.id) {
                todo.completed_at = next_completed_at;
                todo.status = next_status;
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
    let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
    if let Some(todo) = guard.todos.iter_mut().find(|todo| todo.id == id) {
        todo.starred = starred;
    }
    drop(guard);
    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_todo_priority(
    id: String,
    priority: TodoPriority,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
    if let Some(todo) = guard.todos.iter_mut().find(|todo| todo.id == id) {
        todo.priority = priority;
    }
    drop(guard);
    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_todo_status(
    id: String,
    status: TodoStatus,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
    if let Some(todo) = guard.todos.iter_mut().find(|todo| todo.id == id) {
        todo.status = status;
        match status {
            TodoStatus::Done => {
                if todo.completed_at.is_none() {
                    todo.completed_at = Some(now_millis());
                }
            }
            _ => {
                todo.completed_at = None;
            }
        }
    }
    drop(guard);
    persist_state(&app, &state)
}

#[tauri::command]
pub fn set_todo_label(
    id: String,
    label_id: Option<String>,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<AppData, String> {
    let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
    let normalized_label_id = normalize_optional_id(label_id).and_then(|candidate| {
        guard
            .settings
            .labels
            .iter()
            .find(|label| label.id == candidate)
            .map(|label| label.id.clone())
    });

    if let Some(todo) = guard.todos.iter_mut().find(|todo| todo.id == id) {
        todo.label_id = normalized_label_id;
    }
    drop(guard);
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

    let mut notified_guard = state
        .notified_todos
        .lock()
        .map_err(|_| lock_error("reminder"))?;
    for deleted_id in deleted_ids {
        notified_guard.remove(&deleted_id);
    }
    drop(notified_guard);

    persist_state(&app, &state)
}

#[tauri::command]
pub fn clear_history(app: AppHandle, state: State<'_, AppState>) -> Result<AppData, String> {
    let completed_ids: Vec<String> = {
        let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
        let ids = guard
            .todos
            .iter()
            .filter(|t| t.completed_at.is_some())
            .map(|t| t.id.clone())
            .collect();
        guard.todos.retain(|todo| todo.completed_at.is_none());
        ids
    };

    let mut notified_guard = state
        .notified_todos
        .lock()
        .map_err(|_| lock_error("reminder"))?;
    for id in completed_ids {
        notified_guard.remove(&id);
    }
    drop(notified_guard);

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
        let deduped_order: Vec<String> = ordered_ids
            .into_iter()
            .filter(|id| sibling_set.contains(id) && seen.insert(id.clone()))
            .collect();

        if deduped_order.len() >= 2 {
            let rank_by_id: HashMap<String, i64> = deduped_order
                .into_iter()
                .enumerate()
                .map(|(i, id)| (id, i as i64))
                .collect();

            for todo in guard.todos.iter_mut() {
                if let Some(rank) = rank_by_id.get(&todo.id) {
                    todo.sort_index = Some(*rank);
                }
            }
        }
    }
    drop(guard);
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
