use tauri::AppHandle;
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};

use crate::storage::{normalize_shortcut, DEFAULT_GLOBAL_SHORTCUT};
use crate::window;

fn attach_shortcut(
    app: &AppHandle,
    shortcut: &str,
) -> Result<(), tauri_plugin_global_shortcut::Error> {
    app.global_shortcut()
        .on_shortcut(shortcut, |app, _shortcut: &Shortcut, event| {
            if event.state != ShortcutState::Pressed {
                return;
            }

            if let Err(error) = window::toggle_overlay(app) {
                log::error!("failed to toggle overlay from global shortcut: {error}");
            }
        })
}

pub fn register(
    app: &AppHandle,
    shortcut: &str,
) -> Result<(), tauri_plugin_global_shortcut::Error> {
    replace_registered_shortcut(app, shortcut)
}

pub fn replace_registered_shortcut(
    app: &AppHandle,
    shortcut: &str,
) -> Result<(), tauri_plugin_global_shortcut::Error> {
    let normalized = normalize_shortcut(shortcut);
    let gs = app.global_shortcut();

    gs.unregister_all()?;

    match attach_shortcut(app, &normalized) {
        Ok(()) => Ok(()),
        Err(error) => {
            if normalized != DEFAULT_GLOBAL_SHORTCUT {
                log::warn!(
                    "failed to register global shortcut '{}', falling back to '{}'",
                    normalized,
                    DEFAULT_GLOBAL_SHORTCUT
                );
                if let Err(fallback_error) = attach_shortcut(app, DEFAULT_GLOBAL_SHORTCUT) {
                    log::error!(
                        "failed to register fallback global shortcut {}: {fallback_error}",
                        DEFAULT_GLOBAL_SHORTCUT
                    );
                }
            }
            Err(error)
        }
    }
}
