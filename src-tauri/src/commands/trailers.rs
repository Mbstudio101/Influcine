use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager, State};

pub struct TrailerState {
    pub stream_cache: Mutex<HashMap<String, CachedUrl>>,
}

pub struct CachedUrl {
    pub url: String,
    pub expiry: u64,
}

fn trailers_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("trailers");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn bin_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("bin");
    let _ = fs::create_dir_all(&dir);
    dir
}

fn ytdlp_path(app: &AppHandle) -> PathBuf {
    let name = if cfg!(windows) { "yt-dlp.exe" } else { "yt-dlp" };
    bin_dir(app).join(name)
}

fn now_secs() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs()
}

async fn ensure_ytdlp(app: &AppHandle) -> Result<PathBuf, String> {
    let path = ytdlp_path(app);
    if path.exists() {
        let meta = fs::metadata(&path).map_err(|e| e.to_string())?;
        if meta.len() > 10 * 1024 * 1024 {
            return Ok(path);
        }
        let _ = fs::remove_file(&path);
    }

    let asset_name = if cfg!(target_os = "macos") {
        "yt-dlp_macos"
    } else if cfg!(target_os = "windows") {
        "yt-dlp.exe"
    } else {
        "yt-dlp_linux"
    };

    let url = format!(
        "https://github.com/yt-dlp/yt-dlp/releases/latest/download/{}",
        asset_name
    );

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Download failed: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Read failed: {}", e))?;

    fs::write(&path, &bytes).map_err(|e| format!("Write failed: {}", e))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o755));
    }

    Ok(path)
}

#[tauri::command]
pub async fn trailer_check(app: AppHandle, video_id: String) -> Option<String> {
    let dir = trailers_dir(&app);
    let file_path = dir.join(format!("{}.mp4", video_id));

    if file_path.exists() {
        let meta = fs::metadata(&file_path).ok()?;
        if meta.len() > 0 {
            if meta.len() < 10 * 1024 * 1024 {
                let _ = fs::remove_file(&file_path);
            }
            return Some(format!("asset://localhost/trailers/{}.mp4", video_id));
        } else {
            let _ = fs::remove_file(&file_path);
        }
    }

    Some(format!("asset://localhost/trailers/{}.mp4", video_id))
}

#[tauri::command]
pub async fn trailer_download(app: AppHandle, video_id: String) -> Result<String, String> {
    let dir = trailers_dir(&app);
    let file_path = dir.join(format!("{}.mp4", video_id));

    if file_path.exists() {
        return Ok(format!("asset://localhost/trailers/{}.mp4", video_id));
    }

    let ytdlp = ensure_ytdlp(&app).await?;
    let url = format!("https://www.youtube.com/watch?v={}", video_id);

    let output = Command::new(&ytdlp)
        .args([
            &url,
            "-f",
            "bv*[ext=mp4][height>=1080]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b",
            "-o",
            file_path.to_str().unwrap_or("output.mp4"),
            "--write-subs",
            "--write-auto-subs",
            "--sub-format",
            "vtt",
            "--sub-langs",
            "en,.*",
            "--no-playlist",
            "--ignore-errors",
            "--force-ipv4",
            "--no-check-certificates",
        ])
        .output()
        .map_err(|e| format!("Failed to run yt-dlp: {}", e))?;

    if !file_path.exists() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Download finished but file not found: {}", stderr));
    }

    Ok(format!("asset://localhost/trailers/{}.mp4", video_id))
}

#[tauri::command]
pub async fn trailer_search(app: AppHandle, query: String) -> Option<String> {
    let ytdlp = ensure_ytdlp(&app).await.ok()?;
    let search_query = format!("ytsearch1:{} trailer", query);

    let output = Command::new(&ytdlp)
        .args([
            &search_query,
            "--get-id",
            "--no-playlist",
            "--no-check-certificates",
        ])
        .output()
        .ok()?;

    let id = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if id.len() == 11 {
        Some(id)
    } else {
        None
    }
}

#[tauri::command]
pub async fn trailer_prefetch(
    app: AppHandle,
    state: State<'_, TrailerState>,
    video_id: String,
) -> Result<bool, String> {
    {
        let cache = state.stream_cache.lock().unwrap();
        if let Some(cached) = cache.get(&video_id) {
            if cached.expiry > now_secs() {
                return Ok(true);
            }
        }
    }

    let ytdlp = ensure_ytdlp(&app).await?;
    let url = format!("https://www.youtube.com/watch?v={}", video_id);

    let output = Command::new(&ytdlp)
        .args([
            &url,
            "-f",
            "best[ext=mp4]/best[ext=webm]/best",
            "-S",
            "res,ext:mp4:m4a",
            "-g",
            "--force-ipv4",
            "--no-check-certificates",
        ])
        .output()
        .map_err(|e| format!("yt-dlp failed: {}", e))?;

    let direct_url = String::from_utf8_lossy(&output.stdout)
        .trim()
        .lines()
        .next()
        .unwrap_or("")
        .to_string();

    if direct_url.starts_with("http") {
        let mut cache = state.stream_cache.lock().unwrap();
        cache.insert(
            video_id,
            CachedUrl {
                url: direct_url,
                expiry: now_secs() + 3600,
            },
        );
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn trailer_invalidate(app: AppHandle, video_id: String) -> bool {
    let dir = trailers_dir(&app);
    let file_path = dir.join(format!("{}.mp4", video_id));
    if file_path.exists() {
        fs::remove_file(&file_path).is_ok()
    } else {
        false
    }
}

#[tauri::command]
pub fn get_adblock_script() -> String {
    include_str!("../adblock.js").to_string()
}
