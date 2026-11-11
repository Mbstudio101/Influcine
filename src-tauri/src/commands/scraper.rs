use regex::Regex;

#[tauri::command]
pub async fn get_actor_image(name: String) -> Option<String> {
    let query = format!("{} actor", name);
    let url = format!(
        "https://www.google.com/search?q={}&tbm=isch&gbv=1",
        urlencoding::encode(&query)
    );

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
        .build()
        .ok()?;

    let html = client.get(&url).send().await.ok()?.text().await.ok()?;

    let re = Regex::new(r#"src="(https://encrypted-tbn0\.gstatic\.com/images\?q=[^"]+)""#).ok()?;
    let caps = re.captures(&html)?;
    let img_url = caps.get(1)?.as_str().replace("&amp;", "&");
    Some(img_url)
}
