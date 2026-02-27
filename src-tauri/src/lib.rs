mod accessibility;
mod changelog;
mod commands;
mod reminder;
mod shortcuts;
mod storage;
mod tray;
mod updater;
mod window;

use tauri::Manager;
use tauri_plugin_autostart::ManagerExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Info)
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::LogDir {
                        file_name: Some("blinkdo.log".to_string()),
                    },
                ))
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepOne)
                .max_file_size(5_000_000) // 5MB max
                .build(),
        )
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .setup(|app| {
            // Hide app from Dock on macOS only when no main window is visible
            // This will be managed dynamically based on window state

            let app_handle = app.handle().clone();

            let data = storage::load_or_create(&app_handle).map_err(std::io::Error::other)?;
            app.manage(storage::AppState::new(data));

            tray::create_tray(&app_handle)?;
            let current_shortcut = app_handle
                .state::<storage::AppState>()
                .snapshot()
                .settings
                .global_shortcut;
            if let Err(error) = shortcuts::register(&app_handle, &current_shortcut) {
                log::error!("failed to register saved shortcut {current_shortcut}: {error}");
                shortcuts::register(&app_handle, storage::DEFAULT_GLOBAL_SHORTCUT)?;
                {
                    let state = app_handle.state::<storage::AppState>();
                    let mut guard = state
                        .data
                        .lock()
                        .map_err(|_| std::io::Error::other("failed to lock todo state"))?;
                    guard.settings.global_shortcut = storage::DEFAULT_GLOBAL_SHORTCUT.to_string();
                    if let Err(persist_error) = storage::persist(&app_handle, &guard) {
                        log::error!("failed to persist fallback shortcut: {persist_error}");
                    }
                }
            }

            // Don't hide main window on startup - let it show normally
            // window::hide_main_window(&app_handle)?;

            // Setup window close handlers
            window::setup_window_close_handlers(&app_handle)?;

            reminder::start_scheduler(app_handle.clone());

            let enable_autostart = app_handle
                .state::<storage::AppState>()
                .snapshot()
                .settings
                .enable_autostart;

            if enable_autostart {
                if let Err(error) = app_handle.autolaunch().enable() {
                    log::error!("failed to enable autostart: {error}");
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_state,
            commands::add_todo,
            commands::create_todo,
            commands::create_list,
            commands::update_todo,
            commands::complete_todo,
            commands::set_todo_completed,
            commands::set_todo_starred,
            commands::set_todo_priority,
            commands::set_todo_label,
            commands::rename_list,
            commands::set_list_icon,
            commands::set_active_list,
            commands::move_todo_to_list,
            commands::clear_completed_in_list,
            commands::reorder_todos,
            commands::delete_todo,
            commands::clear_history,
            commands::update_settings,
            commands::set_global_shortcut,
            commands::set_autostart_enabled,
            commands::set_todo_reminder,
            commands::hide_overlay,
            commands::get_app_version,
            commands::get_data_file_path,
            commands::open_data_file,
            commands::get_log_file_path,
            commands::open_log_file,
            commands::reset_all_data,
            commands::set_window_width,
            changelog::get_changelog,
            updater::check_for_update,
            updater::install_update,
            accessibility::open_accessibility_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
