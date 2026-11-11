mod commands;

use commands::imdb::ImdbState;
use commands::trailers::TrailerState;
use std::collections::HashMap;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .manage(ImdbState(Mutex::new(None)))
        .manage(TrailerState {
            stream_cache: Mutex::new(HashMap::new()),
        })
        .invoke_handler(tauri::generate_handler![
            // Window controls
            commands::window::window_minimize,
            commands::window::window_maximize,
            commands::window::window_close,
            commands::window::window_is_maximized,
            commands::window::window_toggle_maximize,
            commands::window::window_is_fullscreen,
            commands::window::window_toggle_fullscreen,
            // Credentials
            commands::credentials::credentials_save,
            commands::credentials::credentials_load,
            commands::credentials::credentials_clear,
            // Logging
            commands::logging::log_error,
            commands::logging::get_logs_path,
            // IMDB
            commands::imdb::imdb_search,
            // Subtitles
            commands::subtitles::get_subtitles,
            commands::subtitles::auto_fetch_subtitles,
            // Trailers
            commands::trailers::trailer_check,
            commands::trailers::trailer_download,
            commands::trailers::trailer_search,
            commands::trailers::trailer_prefetch,
            commands::trailers::trailer_invalidate,
            commands::trailers::get_adblock_script,
            // Updates
            commands::updates::update_check,
            // Scraper
            commands::scraper::get_actor_image,
        ])
        .setup(|_app| {
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Influcine");
}
