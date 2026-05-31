use tauri::{AppHandle, Emitter, Manager, State};

use crate::commands::helpers::lock_error;
use crate::storage::{AppData, AppState, STORAGE_FILE_NAME};

#[tauri::command]
pub fn set_window_width(app: AppHandle, width: f64) -> Result<(), String> {
    let window = app.get_webview_window("overlay")
        .or_else(|| app.get_webview_window("main"))
        .ok_or_else(|| "no window found".to_string())?;

    let scale_factor = window.scale_factor().unwrap_or(1.0);
    let is_overlay = window.label() == "overlay";
    let current_size = window.inner_size()
        .map_err(|e| format!("failed to get window size: {e}"))?
        .to_logical::<f64>(scale_factor);

    log::info!("Setting window width: requested={width}, scale={scale_factor}, is_overlay={is_overlay}");

    if is_overlay {
        let monitor = window.current_monitor()
            .map_err(|e| format!("failed to get monitor: {e}"))?
            .ok_or_else(|| "no monitor found".to_string())?;
        let monitor_size = monitor.size().to_logical::<f64>(scale_factor);
        let monitor_position = monitor.position().to_logical::<f64>(scale_factor);
        let new_x = monitor_position.x + (monitor_size.width - width) / 2.0;
        let new_y = monitor_position.y + (monitor_size.height - current_size.height) / 2.0;

        window.set_position(tauri::LogicalPosition { x: new_x, y: new_y })
            .map_err(|e| format!("failed to set position: {e}"))?;
        window.set_size(tauri::LogicalSize { width, height: current_size.height })
            .map_err(|e| format!("failed to set size: {e}"))?;
    } else {
        window.set_size(tauri::LogicalSize { width, height: current_size.height })
            .map_err(|e| format!("failed to set size: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn hide_overlay(app: AppHandle) -> Result<(), String> {
    crate::window::hide_main_window(&app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
pub fn get_data_file_path(app: AppHandle) -> Result<String, String> {
    let app_dir = app.path().app_data_dir().map_err(|e| format!("failed to resolve appDataDir: {e}"))?;
    let path = app_dir.join(STORAGE_FILE_NAME);
    path.to_str().ok_or_else(|| "invalid path".to_string()).map(|s| s.to_string())
}

#[tauri::command]
pub fn open_data_file(app: AppHandle) -> Result<(), String> {
    let app_dir = app.path().app_data_dir().map_err(|e| format!("failed to resolve appDataDir: {e}"))?;
    let path = app_dir.join(STORAGE_FILE_NAME);

    #[cfg(target_os = "macos")] {
        std::process::Command::new("open").arg(&path).spawn()
            .map_err(|e| format!("failed to open file: {e}"))?;
    }
    #[cfg(target_os = "linux")] {
        std::process::Command::new("xdg-open").arg(&path).spawn()
            .map_err(|e| format!("failed to open file: {e}"))?;
    }
    #[cfg(target_os = "windows")] {
        std::process::Command::new("cmd").args(["/C", "start", "", path.to_str().unwrap_or("")])
            .spawn().map_err(|e| format!("failed to open file: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn get_log_file_path(app: AppHandle) -> Result<String, String> {
    let log_dir = app.path().app_log_dir().map_err(|e| format!("failed to resolve log directory: {e}"))?;
    let path = log_dir.join("blinkdo.log");
    path.to_str().ok_or_else(|| "invalid path".to_string()).map(|s| s.to_string())
}

#[tauri::command]
pub fn open_log_file(app: AppHandle) -> Result<(), String> {
    let log_dir = app.path().app_log_dir().map_err(|e| format!("failed to resolve log directory: {e}"))?;
    let path = log_dir.join("blinkdo.log");
    if !path.exists() { return Err("Log file does not exist yet".to_string()); }

    #[cfg(target_os = "macos")] {
        std::process::Command::new("open").arg(&path).spawn()
            .map_err(|e| format!("failed to open log file: {e}"))?;
    }
    #[cfg(target_os = "linux")] {
        std::process::Command::new("xdg-open").arg(&path).spawn()
            .map_err(|e| format!("failed to open log file: {e}"))?;
    }
    #[cfg(target_os = "windows")] {
        std::process::Command::new("cmd").args(["/C", "start", "", path.to_str().unwrap_or("")])
            .spawn().map_err(|e| format!("failed to open log file: {e}"))?;
    }
    Ok(())
}

#[tauri::command]
pub fn reset_all_data(app: AppHandle, state: State<'_, AppState>) -> Result<(), String> {
    log::info!("Resetting all data");

    let mut guard = state.data.lock().map_err(|_| lock_error("todo"))?;
    *guard = AppData::default();
    drop(guard);

    let mut notified_guard = state.notified_todos.lock().map_err(|_| lock_error("reminder"))?;
    notified_guard.clear();
    drop(notified_guard);

    crate::shortcuts::replace_registered_shortcut(&app, crate::storage::DEFAULT_GLOBAL_SHORTCUT).ok();

    let app_dir = app.path().app_data_dir().map_err(|e| format!("failed to resolve appDataDir: {e}"))?;
    let path = app_dir.join(STORAGE_FILE_NAME);
    if path.exists() { std::fs::remove_file(&path).map_err(|e| format!("failed to delete data file: {e}"))?; }

    app.emit("data-reset", ()).ok();
    log::info!("All data has been reset");
    Ok(())
}

#[tauri::command]
pub fn load_state(state: State<'_, AppState>) -> AppData {
    state.snapshot()
}
