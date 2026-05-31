use std::collections::{HashMap, HashSet};
use std::sync::{Mutex, OnceLock};
use std::thread;
use std::time::Duration;

use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_notification::NotificationExt;

use crate::storage::{now_millis, AppState, Todo};

const POLL_INTERVAL_SECONDS: u64 = 10;
const MAX_CONSECUTIVE_FAILURES: u32 = 3;

fn notification_failures() -> &'static Mutex<HashMap<String, u32>> {
    static FAILURES: OnceLock<Mutex<HashMap<String, u32>>> = OnceLock::new();
    FAILURES.get_or_init(|| Mutex::new(HashMap::new()))
}

pub fn start_scheduler(app: AppHandle) {
    thread::spawn(move || loop {
        if let Err(error) = check_due_reminders(&app) {
            log::error!("reminder scheduler failed: {error}");
        }

        thread::sleep(Duration::from_secs(POLL_INTERVAL_SECONDS));
    });
}

fn check_due_reminders(app: &AppHandle) -> Result<(), String> {
    let state = app.state::<AppState>();
    let now = now_millis();

    let (active_ids, due_todos): (HashSet<String>, Vec<Todo>) = {
        let guard = state
            .data
            .lock()
            .map_err(|_| String::from("failed to lock todo state"))?;

        let active = guard
            .todos
            .iter()
            .filter(|todo| todo.completed_at.is_none())
            .map(|todo| todo.id.clone())
            .collect::<HashSet<_>>();

        let due = guard
            .todos
            .iter()
            .filter(|todo| {
                todo.completed_at.is_none()
                    && todo.reminder_at.is_some_and(|reminder| reminder <= now)
            })
            .cloned()
            .collect::<Vec<_>>();

        (active, due)
    };

    let mut notified = state
        .notified_todos
        .lock()
        .map_err(|_| String::from("failed to lock reminder state"))?;

    notified.retain(|id| active_ids.contains(id));

    for todo in due_todos {
        if notified.contains(&todo.id) {
            continue;
        }

        if let Err(error) = app
            .notification()
            .builder()
            .title("Rappel tâche")
            .body(todo.title.clone())
            .show()
        {
            log::error!(
                "failed to display reminder notification for {}: {error}",
                todo.id
            );

            let mut failures = notification_failures().lock().unwrap();
            let count = failures.entry(todo.id.clone()).or_insert(0);
            *count += 1;

            if *count >= MAX_CONSECUTIVE_FAILURES {
                failures.remove(&todo.id);
                drop(failures);
                app.emit("reminder-notification-failed", &todo.title).ok();
            }

            continue;
        }

        notified.insert(todo.id);
    }

    Ok(())
}
