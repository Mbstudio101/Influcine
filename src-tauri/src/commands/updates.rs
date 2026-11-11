#[allow(unused_imports)]
use serde::Serialize;

#[derive(Serialize)]
pub struct UpdateCheckResult {
    pub update: bool,
    pub version: Option<String>,
    #[serde(rename = "releaseNotes")]
    pub release_notes: Option<String>,
    pub error: Option<String>,
}

#[tauri::command]
pub async fn update_check(current_version: String) -> UpdateCheckResult {
    let url = "https://api.github.com/repos/Mbstudio101/influcine/releases/latest";

    let client = match reqwest::Client::builder()
        .user_agent("Influcine-Updater")
        .build()
    {
        Ok(c) => c,
        Err(e) => {
            return UpdateCheckResult {
                update: false,
                version: None,
                release_notes: None,
                error: Some(e.to_string()),
            }
        }
    };

    let response = match client.get(url).send().await {
        Ok(r) if r.status().is_success() => r,
        Ok(r) => {
            return UpdateCheckResult {
                update: false,
                version: None,
                release_notes: None,
                error: Some(format!("HTTP {}", r.status())),
            }
        }
        Err(e) => {
            return UpdateCheckResult {
                update: false,
                version: None,
                release_notes: None,
                error: Some(e.to_string()),
            }
        }
    };

    let release: serde_json::Value = match response.json().await {
        Ok(v) => v,
        Err(e) => {
            return UpdateCheckResult {
                update: false,
                version: None,
                release_notes: None,
                error: Some(e.to_string()),
            }
        }
    };

    let latest = release
        .get("tag_name")
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .trim_start_matches('v')
        .to_string();

    let notes = release
        .get("body")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let is_update = compare_versions(&latest, &current_version) > 0;

    UpdateCheckResult {
        update: is_update,
        version: Some(latest),
        release_notes: notes,
        error: None,
    }
}

fn compare_versions(v1: &str, v2: &str) -> i32 {
    let p1: Vec<u32> = v1
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();
    let p2: Vec<u32> = v2
        .split('.')
        .filter_map(|s| s.parse().ok())
        .collect();

    let max_len = p1.len().max(p2.len());
    for i in 0..max_len {
        let n1 = p1.get(i).copied().unwrap_or(0);
        let n2 = p2.get(i).copied().unwrap_or(0);
        if n1 > n2 {
            return 1;
        }
        if n1 < n2 {
            return -1;
        }
    }
    0
}
