use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const MAIN_WINDOW_LABEL: &str = "main";
const OVERLAY_WINDOW_LABEL: &str = "overlay";
const OVERLAY_WIDTH: f64 = 500.0;
const OVERLAY_MIN_WIDTH: f64 = 360.0;
const OVERLAY_MAX_WIDTH: f64 = 1180.0;
const OVERLAY_SAFE_AREA_PADDING: f64 = 12.0;
const OVERLAY_RIGHT_MARGIN: f64 = 12.0;

fn get_main_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    app.get_webview_window(MAIN_WINDOW_LABEL)
        .ok_or_else(|| tauri::Error::AssetNotFound(MAIN_WINDOW_LABEL.to_string()))
}

fn get_overlay_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window(OVERLAY_WINDOW_LABEL)
}

fn create_overlay_window(app: &AppHandle) -> tauri::Result<WebviewWindow> {
    let window = WebviewWindowBuilder::new(app, OVERLAY_WINDOW_LABEL, WebviewUrl::default())
        .title("BlinkDo")
        .inner_size(500.0, 620.0)
        .min_inner_size(360.0, 360.0)
        .resizable(true)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .focused(false)
        .build()?;

    Ok(window)
}

pub fn setup_window_close_handlers(app: &AppHandle) -> tauri::Result<()> {
    if let Ok(main_window) = get_main_window(app) {
        let window_clone = main_window.clone();
        main_window.on_window_event(move |event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                // Prevent the main window from closing, hide it instead
                api.prevent_close();
                if let Err(error) = window_clone.hide() {
                    log::error!("failed to hide main window on close: {error}");
                }
            }
        });
    }

    Ok(())
}

pub fn hide_main_window(app: &AppHandle) -> tauri::Result<()> {
    let window = get_main_window(app)?;

    if window.is_visible()? {
        window.hide()?;
    }

    Ok(())
}

pub fn show_main_window(app: &AppHandle) -> tauri::Result<()> {
    let window = get_main_window(app)?;

    if !window.is_visible()? {
        window.show()?;
        window.set_focus()?;
    }

    Ok(())
}

pub fn show_overlay_window(app: &AppHandle) -> tauri::Result<()> {
    let mut was_existing_overlay = false;
    let overlay = match get_overlay_window(app) {
        Some(win) => {
            was_existing_overlay = true;
            win
        }
        None => create_overlay_window(app)?,
    };

    // Set window to float above fullscreen apps on macOS
    #[cfg(target_os = "macos")]
    {
        use cocoa::appkit::{NSMainMenuWindowLevel, NSWindow};
        use cocoa::base::id;

        match overlay.ns_window() {
            Ok(handle) => {
                let ns_window = handle as id;
                unsafe {
                    ns_window.setLevel_((NSMainMenuWindowLevel + 2) as i64);
                }
            }
            Err(error) => {
                log::warn!("Failed to get NSWindow handle for overlay window: {error}");
            }
        }
    }

    overlay.set_always_on_top(true)?;
    overlay.set_skip_taskbar(true)?;

    // Keep the overlay inside the OS work area, so it does not cover the menu bar,
    // Dock, or Windows taskbar.
    if let Ok(Some(monitor)) = overlay.current_monitor() {
        let scale = overlay.scale_factor()?;
        let work_area = monitor.work_area();
        let work_area_size = work_area.size.to_logical::<f64>(scale);
        let work_area_pos = work_area.position.to_logical::<f64>(scale);
        let current_width = if was_existing_overlay {
            overlay
                .inner_size()
                .ok()
                .map(|size| size.to_logical::<f64>(scale).width)
                .unwrap_or(OVERLAY_WIDTH)
        } else {
            OVERLAY_WIDTH
        };
        let max_width = (work_area_size.width - OVERLAY_RIGHT_MARGIN - OVERLAY_SAFE_AREA_PADDING)
            .clamp(OVERLAY_MIN_WIDTH, OVERLAY_MAX_WIDTH);
        let width = current_width.clamp(OVERLAY_MIN_WIDTH, max_width);
        let height = (work_area_size.height - (OVERLAY_SAFE_AREA_PADDING * 2.0)).max(360.0);
        let x = work_area_pos.x + work_area_size.width - width - OVERLAY_RIGHT_MARGIN;
        let y = work_area_pos.y + OVERLAY_SAFE_AREA_PADDING;
        overlay.set_position(tauri::LogicalPosition { x, y })?;
        overlay.set_size(tauri::LogicalSize { width, height })?;
    }

    overlay.show()?;
    overlay.set_focus()?;

    Ok(())
}

pub fn toggle_overlay(app: &AppHandle) -> tauri::Result<()> {
    // Hide main window if visible
    if let Ok(main) = get_main_window(app) {
        if main.is_visible()? {
            main.hide()?;
        }
    }

    // Toggle overlay
    let overlay = match get_overlay_window(app) {
        Some(win) => win,
        None => create_overlay_window(app)?,
    };

    if overlay.is_visible()? {
        overlay.hide()?;
    } else {
        show_overlay_window(app)?;
    }

    Ok(())
}
