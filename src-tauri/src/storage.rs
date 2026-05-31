use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};

pub mod db;

pub const STORAGE_FILE_NAME: &str = "todos.json";
pub const DB_FILE_NAME: &str = "blinkdo.db";
pub const DEFAULT_LIST_ID: &str = "default";
pub const DEFAULT_GLOBAL_SHORTCUT: &str = "Shift+Space";

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum SortOrder {
    Asc,
    #[default]
    Desc,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum SortMode {
    Manual,
    #[default]
    Recent,
    Oldest,
    Title,
    DueDate,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SoundSettings {
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default = "default_true")]
    pub on_create: bool,
    #[serde(default = "default_true")]
    pub on_complete: bool,
    #[serde(default = "default_true")]
    pub on_delete: bool,
}

impl Default for SoundSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            on_create: true,
            on_complete: true,
            on_delete: true,
        }
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum ThemeMode {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoLabel {
    pub id: String,
    pub name: String,
    pub color: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "lowercase")]
pub enum TodoPriority {
    #[default]
    None,
    Low,
    Medium,
    High,
    Urgent,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, Default)]
#[serde(rename_all = "camelCase")]
pub enum TodoStatus {
    #[default]
    Todo,
    InProgress,
    Waiting,
    Done,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TodoList {
    pub id: String,
    pub name: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Todo {
    pub id: String,
    #[serde(default, alias = "text")]
    pub title: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub parent_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub list_id: Option<String>,
    #[serde(default)]
    pub starred: bool,
    #[serde(default)]
    pub priority: TodoPriority,
    #[serde(default)]
    pub status: TodoStatus,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sort_index: Option<i64>,
    pub created_at: i64,
    pub completed_at: Option<i64>,
    pub reminder_at: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
    #[serde(default)]
    pub sort_mode: SortMode,
    #[serde(default)]
    pub sort_order: SortOrder,
    #[serde(default = "default_auto_close_on_blur")]
    pub auto_close_on_blur: bool,
    #[serde(default = "default_lists")]
    pub lists: Vec<TodoList>,
    #[serde(default = "default_active_list_id")]
    pub active_list_id: String,
    #[serde(default = "default_global_shortcut")]
    pub global_shortcut: String,
    #[serde(default)]
    pub theme_mode: ThemeMode,
    #[serde(default = "default_labels")]
    pub labels: Vec<TodoLabel>,
    #[serde(default = "default_enable_autostart")]
    pub enable_autostart: bool,
    #[serde(default = "default_enable_sound_effects")]
    pub enable_sound_effects: bool,
    #[serde(default = "default_sound_settings")]
    pub sound_settings: SoundSettings,
    #[serde(default = "default_language")]
    pub language: String,
    #[serde(default, alias = "listName", alias = "list_name", skip_serializing)]
    pub legacy_list_name: Option<String>,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            sort_mode: SortMode::Recent,
            sort_order: SortOrder::Desc,
            auto_close_on_blur: true,
            lists: default_lists(),
            active_list_id: default_active_list_id(),
            global_shortcut: default_global_shortcut(),
            theme_mode: ThemeMode::System,
            labels: default_labels(),
            enable_autostart: true,
            enable_sound_effects: true,
            sound_settings: SoundSettings::default(),
            language: default_language(),
            legacy_list_name: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AppData {
    #[serde(default)]
    pub settings: Settings,
    #[serde(default)]
    pub todos: Vec<Todo>,
}

pub struct AppState {
    pub data: Mutex<AppData>,
    pub notified_todos: Mutex<HashSet<String>>,
}

impl AppState {
    pub fn new(data: AppData) -> Self {
        Self {
            data: Mutex::new(data),
            notified_todos: Mutex::new(HashSet::new()),
        }
    }

    pub fn snapshot(&self) -> AppData {
        match self.data.lock() {
            Ok(guard) => guard.clone(),
            Err(poisoned) => {
                log::warn!("todo state lock was poisoned, recovering");
                poisoned.into_inner().clone()
            }
        }
    }
}

fn default_auto_close_on_blur() -> bool {
    true
}

fn default_list_name() -> String {
    "Mes tâches".to_string()
}

fn default_active_list_id() -> String {
    DEFAULT_LIST_ID.to_string()
}

fn default_lists() -> Vec<TodoList> {
    vec![TodoList {
        id: default_active_list_id(),
        name: default_list_name(),
        icon: None,
        created_at: 0,
    }]
}

fn default_global_shortcut() -> String {
    DEFAULT_GLOBAL_SHORTCUT.to_string()
}

fn default_labels() -> Vec<TodoLabel> {
    vec![TodoLabel {
        id: "general".to_string(),
        name: "Général".to_string(),
        color: "slate".to_string(),
    }]
}

fn default_enable_autostart() -> bool {
    true
}

fn default_enable_sound_effects() -> bool {
    true
}

fn default_true() -> bool {
    true
}

fn default_sound_settings() -> SoundSettings {
    SoundSettings::default()
}

fn default_language() -> String {
    "auto".to_string()
}

pub fn normalize_shortcut(value: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        default_global_shortcut()
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

fn normalize_name(value: &str, fallback: &str) -> String {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        fallback.to_string()
    } else {
        trimmed.to_string()
    }
}

fn normalize_data(mut data: AppData) -> AppData {
    let mut lists = data.settings.lists.clone();

    if lists.is_empty() {
        let legacy_name = data
            .settings
            .legacy_list_name
            .as_deref()
            .map(|name| normalize_name(name, &default_list_name()))
            .unwrap_or_else(default_list_name);

        lists.push(TodoList {
            id: default_active_list_id(),
            name: legacy_name,
            icon: None,
            created_at: now_millis(),
        });
    } else {
        for (index, list) in lists.iter_mut().enumerate() {
            let fallback = if index == 0 {
                "Mes tâches"
            } else {
                "Nouvelle liste"
            };
            list.name = normalize_name(&list.name, fallback);
        }
    }

    let active_list_id = if lists
        .iter()
        .any(|list| list.id == data.settings.active_list_id)
    {
        data.settings.active_list_id.clone()
    } else {
        lists
            .first()
            .map(|list| list.id.clone())
            .unwrap_or_else(default_active_list_id)
    };

    let valid_list_ids: HashSet<String> = lists.iter().map(|list| list.id.clone()).collect();

    let mut labels = data.settings.labels.clone();
    if labels.is_empty() {
        labels = default_labels();
    } else {
        let mut normalized_labels = Vec::with_capacity(labels.len());
        let mut used_ids = HashSet::new();

        for (index, label) in labels.into_iter().enumerate() {
            let fallback_name = format!("Label {}", index + 1);
            let mut id = normalize_name(&label.id, &format!("label-{}", index + 1));
            if used_ids.contains(&id) {
                id = format!("label-{}-{}", index + 1, now_millis());
            }
            used_ids.insert(id.clone());

            normalized_labels.push(TodoLabel {
                id,
                name: normalize_name(&label.name, &fallback_name),
                color: normalize_label_color(&label.color),
            });
        }

        labels = normalized_labels;
    }

    let valid_label_ids: HashSet<String> = labels.iter().map(|label| label.id.clone()).collect();

    for todo in &mut data.todos {
        let fallback_id = active_list_id.clone();
        match todo.list_id.as_deref() {
            Some(list_id) if valid_list_ids.contains(list_id) => {}
            _ => {
                todo.list_id = Some(fallback_id);
            }
        }

        match todo.label_id.as_deref() {
            Some(label_id) if valid_label_ids.contains(label_id) => {}
            _ => {
                todo.label_id = None;
            }
        }
    }

    data.settings.lists = lists;
    data.settings.active_list_id = active_list_id;
    data.settings.global_shortcut = normalize_shortcut(&data.settings.global_shortcut);
    data.settings.labels = labels;
    data.settings.legacy_list_name = None;
    data
}

fn app_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir()
        .map_err(|e| format!("failed to resolve appDataDir: {e}"))?;
    fs::create_dir_all(&dir)
        .map_err(|e| format!("failed to create appDataDir: {e}"))?;
    Ok(dir)
}

fn json_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_dir(app)?.join(STORAGE_FILE_NAME))
}

fn db_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_dir(app)?.join(DB_FILE_NAME))
}

fn migrate_json_to_sqlite(app: &AppHandle, conn: &rusqlite::Connection) -> Result<(), String> {
    let json_p = json_path(app)?;
    if !json_p.exists() {
        return Ok(());
    }

    log::info!("Migrating data from {} to SQLite", STORAGE_FILE_NAME);

    let raw = fs::read_to_string(&json_p)
        .map_err(|e| format!("failed to read {}: {e}", json_p.display()))?;

    let data: AppData = serde_json::from_str(&raw)
        .map_err(|e| format!("failed to parse {}: {e}", json_p.display()))?;

    let normalized = normalize_data(data);
    db::save(conn, &normalized)
        .map_err(|e| format!("failed to write SQLite: {e}"))?;

    fs::rename(&json_p, json_p.with_extension("json.bak"))
        .map_err(|e| format!("failed to backup JSON file: {e}"))?;

    log::info!("Migration complete, JSON backed up to todos.json.bak");
    Ok(())
}

pub fn load_or_create(app: &AppHandle) -> Result<AppData, String> {
    let db_p = db_path(app)?;
    let conn = db::open(&db_p).map_err(|e| format!("failed to open database: {e}"))?;
    db::migrate(&conn).map_err(|e| format!("failed to run migrations: {e}"))?;

    // Migrate from JSON if present
    migrate_json_to_sqlite(app, &conn)?;

    // Load from SQLite
    let data = db::load(&conn).map_err(|e| format!("failed to load from database: {e}"))?;

    // If empty, initialize with defaults
    if data.settings.lists.is_empty() || data.todos.is_empty() {
        let default_data = AppData::default();
        db::save(&conn, &default_data)
            .map_err(|e| format!("failed to save defaults: {e}"))?;
        return Ok(default_data);
    }

    Ok(data)
}

pub fn persist(app: &AppHandle, data: &AppData) -> Result<(), String> {
    let db_p = db_path(app)?;
    let conn = db::open(&db_p).map_err(|e| format!("failed to open database: {e}"))?;
    db::save(&conn, data).map_err(|e| format!("failed to save to database: {e}"))
}

pub fn now_millis() -> i64 {
    match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_millis() as i64,
        Err(_) => {
            log::warn!("system time before unix epoch, using 0");
            0
        }
    }
}
