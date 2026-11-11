use flate2::read::GzDecoder;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Read;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn trailers_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .unwrap_or_default()
        .join("trailers");
    let _ = fs::create_dir_all(&dir);
    dir
}

#[derive(Serialize)]
pub struct SubtitleFile {
    pub url: String,
    pub lang: String,
    pub label: String,
}

#[tauri::command]
pub async fn get_subtitles(app: AppHandle, video_id: String) -> Vec<SubtitleFile> {
    let dir = trailers_dir(&app);
    let entries = match fs::read_dir(&dir) {
        Ok(e) => e,
        Err(_) => return vec![],
    };

    entries
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.starts_with(&video_id) && name.ends_with(".vtt")
        })
        .map(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            let parts: Vec<&str> = name.split('.').collect();
            let (lang, label) = if parts.len() >= 3 {
                let lang_code = parts[parts.len() - 2];
                let mut label = lang_code.to_string();
                if let Some(first) = label.chars().next() {
                    label = format!("{}{}", first.to_uppercase(), &label[1..]);
                }
                (lang_code.to_string(), label)
            } else {
                ("en".to_string(), "English".to_string())
            };

            SubtitleFile {
                url: format!("tauri://localhost/trailers/{}", name),
                lang,
                label,
            }
        })
        .collect()
}

#[derive(Deserialize)]
pub struct AutoSubtitleRequest {
    #[serde(rename = "imdbId")]
    pub imdb_id: Option<String>,
    #[serde(rename = "type")]
    pub media_type: Option<String>,
    pub season: Option<i32>,
    pub episode: Option<i32>,
}

#[derive(Serialize)]
pub struct AutoSubtitleResult {
    pub label: String,
    pub content: String,
    pub format: Option<String>,
}

#[tauri::command]
pub async fn auto_fetch_subtitles(request: AutoSubtitleRequest) -> Vec<AutoSubtitleResult> {
    let imdb_id = match &request.imdb_id {
        Some(id) if !id.is_empty() => id.clone(),
        _ => return vec![],
    };

    let url = if request.media_type.as_deref() == Some("movie") {
        format!(
            "https://rest.opensubtitles.org/search/imdbid-{}/sublanguageid-eng",
            imdb_id
        )
    } else {
        let season = request.season.unwrap_or(1);
        let episode = request.episode.unwrap_or(1);
        format!(
            "https://rest.opensubtitles.org/search/episode-{}/imdbid-{}/season-{}/sublanguageid-eng",
            episode, imdb_id, season
        )
    };

    let client = match reqwest::Client::builder()
        .user_agent("Influcine v1.0")
        .build()
    {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    let response = match client.get(&url).send().await {
        Ok(r) if r.status().is_success() => r,
        _ => return vec![],
    };

    let data: Vec<serde_json::Value> = match response.json().await {
        Ok(d) => d,
        Err(_) => return vec![],
    };

    let mut results = Vec::new();
    for sub in data.iter().take(3) {
        let download_link = match sub.get("SubDownloadLink").and_then(|v| v.as_str()) {
            Some(l) => l,
            None => continue,
        };

        let label = sub
            .get("MovieReleaseName")
            .or_else(|| sub.get("LanguageName"))
            .and_then(|v| v.as_str())
            .unwrap_or("English")
            .to_string();

        let format = sub
            .get("SubFormat")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let dl_response = match client.get(download_link).send().await {
            Ok(r) if r.status().is_success() => r,
            _ => continue,
        };

        let bytes = match dl_response.bytes().await {
            Ok(b) => b,
            Err(_) => continue,
        };

        let content = try_gunzip(&bytes).unwrap_or_else(|| String::from_utf8_lossy(&bytes).to_string());

        results.push(AutoSubtitleResult {
            label,
            content,
            format,
        });
    }

    results
}

fn try_gunzip(data: &[u8]) -> Option<String> {
    let mut decoder = GzDecoder::new(data);
    let mut out = String::new();
    decoder.read_to_string(&mut out).ok()?;
    Some(out)
}
