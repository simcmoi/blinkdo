use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

const MAIN_WINDOW_LABEL: &str = "main";
const OVERLAY_WINDOW_LABEL: &str = "overlay";

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
        .inner_size(500.0, 700.0)
        .min_inner_size(500.0, 400.0)
        .resizable(true)
        .maximizable(false)
        .minimizable(false)
        .decorations(false)
        .transparent(true)
        .shadow(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .visible(false)
        .center()
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
    let overlay = match get_overlay_window(app) {
        Some(win) => win,
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
                    // NSFloatingWindowLevel = NSMainMenuWindowLevel + 2 (level 24)
                    // This makes the window float above fullscreen apps
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
    overlay.center()?;
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
