use rusqlite::{params, Connection, Result as SqlResult};
use std::path::Path;

use crate::storage::{AppData, Settings, Todo, TodoPriority, TodoStatus};

pub fn open(path: &Path) -> SqlResult<Connection> {
    let conn = Connection::open(path)?;
    conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL;")?;
    Ok(conn)
}

pub fn migrate(conn: &Connection) -> SqlResult<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS todos (
            id          TEXT PRIMARY KEY,
            title       TEXT NOT NULL,
            details     TEXT,
            parent_id   TEXT,
            list_id     TEXT,
            starred     INTEGER NOT NULL DEFAULT 0,
            priority    TEXT NOT NULL DEFAULT 'none',
            status      TEXT NOT NULL DEFAULT 'todo',
            label_id    TEXT,
            sort_index  INTEGER,
            created_at  INTEGER NOT NULL,
            completed_at INTEGER,
            reminder_at INTEGER
        );
        CREATE TABLE IF NOT EXISTS settings (
            key   TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_todos_list_id ON todos(list_id);
        CREATE INDEX IF NOT EXISTS idx_todos_parent_id ON todos(parent_id);
        CREATE INDEX IF NOT EXISTS idx_todos_completed ON todos(completed_at);",
    )?;
    ensure_column(conn, "todos", "status", "TEXT NOT NULL DEFAULT 'todo'")?;
    Ok(())
}

fn ensure_column(conn: &Connection, table: &str, column: &str, definition: &str) -> SqlResult<()> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let exists = stmt
        .query_map([], |row| row.get::<_, String>(1))?
        .collect::<SqlResult<Vec<String>>>()?
        .iter()
        .any(|name| name == column);

    if !exists {
        conn.execute(&format!("ALTER TABLE {table} ADD COLUMN {column} {definition}"), [])?;
    }

    Ok(())
}

pub fn load(conn: &Connection) -> SqlResult<AppData> {
    let settings = load_settings(conn)?;
    let todos = load_todos(conn)?;
    Ok(AppData { settings, todos })
}

fn load_settings(conn: &Connection) -> SqlResult<Settings> {
    let json: String = conn
        .query_row(
            "SELECT value FROM settings WHERE key = 'app_settings'",
            [],
            |row| row.get(0),
        )
        .unwrap_or_else(|e| {
            log::warn!("failed to load settings from database: {e}");
            "null".to_string()
        });

    if json == "null" {
        return Ok(Settings::default());
    }

    serde_json::from_str(&json).map_err(|e| {
        rusqlite::Error::ToSqlConversionFailure(Box::new(e))
    })
}

fn load_todos(conn: &Connection) -> SqlResult<Vec<Todo>> {
    let mut stmt = conn.prepare(
        "SELECT id, title, details, parent_id, list_id, starred, priority,
                status, label_id, sort_index, created_at, completed_at, reminder_at
         FROM todos ORDER BY created_at ASC",
    )?;

    let todos = stmt
        .query_map([], |row| {
            let priority_str: String = row.get(6)?;
            Ok(Todo {
                id: row.get(0)?,
                title: row.get(1)?,
                details: row.get(2)?,
                parent_id: row.get(3)?,
                list_id: row.get(4)?,
                starred: row.get::<_, i64>(5)? != 0,
                priority: serde_json::from_str(&format!("\"{}\"", priority_str))
                    .unwrap_or_else(|e| {
                        log::warn!("failed to parse priority '{}': {e}", priority_str);
                        TodoPriority::None
                    }),
                status: {
                    let status_str: String = row.get(7)?;
                    serde_json::from_str(&format!("\"{}\"", status_str))
                        .unwrap_or_else(|e| {
                            log::warn!("failed to parse status '{}': {e}", status_str);
                            TodoStatus::Todo
                        })
                },
                label_id: row.get(8)?,
                sort_index: row.get(9)?,
                created_at: row.get(10)?,
                completed_at: row.get(11)?,
                reminder_at: row.get(12)?,
            })
        })?
        .collect::<SqlResult<Vec<Todo>>>()?;

    Ok(todos)
}

pub fn save(conn: &Connection, data: &AppData) -> SqlResult<()> {
    let tx = conn.unchecked_transaction()?;
    save_settings(&tx, &data.settings)?;
    save_todos(&tx, &data.todos)?;
    tx.commit()?;
    Ok(())
}

fn save_settings(conn: &Connection, settings: &Settings) -> SqlResult<()> {
    let json = serde_json::to_string(settings).map_err(|e| {
        rusqlite::Error::ToSqlConversionFailure(Box::new(e))
    })?;
    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES ('app_settings', ?1)",
        params![json],
    )?;
    Ok(())
}

fn save_todos(conn: &Connection, todos: &[Todo]) -> SqlResult<()> {
    conn.execute("DELETE FROM todos", [])?;

    let mut stmt = conn.prepare(
        "INSERT INTO todos (id, title, details, parent_id, list_id, starred, priority,
                           status, label_id, sort_index, created_at, completed_at, reminder_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
    )?;

    for todo in todos {
        let priority_str = serde_json::to_string(&todo.priority)
            .unwrap_or_else(|_| "\"none\"".to_string())
            .trim_matches('"')
            .to_string();
        let status_str = serde_json::to_string(&todo.status)
            .unwrap_or_else(|_| "\"todo\"".to_string())
            .trim_matches('"')
            .to_string();

        stmt.execute(params![
            todo.id,
            todo.title,
            todo.details,
            todo.parent_id,
            todo.list_id,
            todo.starred as i64,
            priority_str,
            status_str,
            todo.label_id,
            todo.sort_index,
            todo.created_at,
            todo.completed_at,
            todo.reminder_at,
        ])?;
    }

    Ok(())
}
