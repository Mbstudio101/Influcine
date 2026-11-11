use serde::Deserialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn logs_dir(app: &AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().unwrap_or_default().join("logs");
    let _ = fs::create_dir_all(&dir);
    dir
}

#[derive(Deserialize)]
pub struct ErrorData {
    pub message: String,
    pub stack: Option<String>,
    #[serde(rename = "type")]
    pub error_type: Option<String>,
    pub context: Option<serde_json::Value>,
}

#[tauri::command]
pub async fn log_error(app: AppHandle, error_data: ErrorData) -> bool {
    let dir = logs_dir(&app);
    let log_file = dir.join("app.log");
    let timestamp = chrono::Utc::now().to_rfc3339();
    let entry = format!(
        "[{}] [{}] {}\nStack: {}\nContext: {}\n-------------------\n",
        timestamp,
        error_data.error_type.as_deref().unwrap_or("ERROR"),
        error_data.message,
        error_data.stack.as_deref().unwrap_or("N/A"),
        error_data
            .context
            .as_ref()
            .map(|c| c.to_string())
            .unwrap_or_else(|| "{}".to_string())
    );
    fs::write(&log_file, {
        let mut existing = fs::read_to_string(&log_file).unwrap_or_default();
        existing.push_str(&entry);
        existing
    })
    .is_ok()
}

#[tauri::command]
pub async fn get_logs_path(app: AppHandle) -> String {
    logs_dir(&app).to_string_lossy().to_string()
}
