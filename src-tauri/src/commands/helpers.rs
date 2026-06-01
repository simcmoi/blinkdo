use std::collections::{HashMap, HashSet};
use tauri::{AppHandle, State};

use crate::storage::{
    normalize_shortcut, now_millis, persist, AppData, AppState, Settings, Todo, TodoLabel,
    TodoList, DEFAULT_LIST_ID,
};

pub fn lock_error(name: &str) -> String {
    format!("failed to lock {name} state")
}

pub fn persist_state(app: &AppHandle, state: &State<'_, AppState>) -> Result<AppData, String> {
    let snapshot = state.data.lock().map_err(|_| lock_error("todo"))?.clone();
    persist(app, &snapshot)?;
    Ok(snapshot)
}

pub fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

pub fn normalize_optional_id(value: Option<String>) -> Option<String> {
    value.and_then(|raw| {
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

pub fn normalize_label_color(value: &str) -> String {
    let normalized = value.trim().to_ascii_lowercase();
    match normalized.as_str() {
        "slate" | "blue" | "green" | "amber" | "rose" | "violet" => normalized,
        _ => "slate".to_string(),
    }
}

pub fn sanitize_settings(mut settings: Settings) -> Settings {
    if settings.lists.is_empty() {
        settings.lists.push(TodoList {
            id: DEFAULT_LIST_ID.to_string(),
            name: "Mes tâches".to_string(),
            icon: None,
            created_at: now_millis(),
        });
    }

    for (index, list) in settings.lists.iter_mut().enumerate() {
        list.name = if list.name.trim().is_empty() {
            if index == 0 {
                "Mes tâches".to_string()
            } else {
                "Nouvelle liste".to_string()
            }
        } else {
            list.name.trim().to_string()
        };
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
            label.name = if label.name.trim().is_empty() {
                fallback_name
            } else {
                label.name.trim().to_string()
            };
            label.color = normalize_label_color(&label.color);

            let mut label_id = if label.id.trim().is_empty() {
                format!("label-{}", index + 1)
            } else {
                label.id.clone()
            };
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

pub fn collect_subtree_ids(todos: &[Todo], root_id: &str) -> HashSet<String> {
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

pub fn push_todo(
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
        id: uuid::Uuid::new_v4().to_string(),
        title: trimmed_title.to_string(),
        details: normalized_details,
        parent_id: validated_parent_id,
        list_id: Some(target_list_id),
        starred: false,
        priority: crate::storage::TodoPriority::None,
        status: crate::storage::TodoStatus::Todo,
        label_id: None,
        sort_index: next_sort_index,
        created_at: now_millis(),
        completed_at: None,
        reminder_at,
    });

    Ok(())
}
