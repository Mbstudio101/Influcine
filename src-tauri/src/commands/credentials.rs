use serde::{Deserialize, Serialize};

const SERVICE_NAME: &str = "com.influcine.app";

#[derive(Serialize, Deserialize)]
pub struct Credentials {
    pub email: String,
    pub password: String,
}

#[tauri::command]
pub async fn credentials_save(email: String, password: String) -> bool {
    let entry = keyring::Entry::new(SERVICE_NAME, "user_credentials");
    match entry {
        Ok(entry) => {
            let creds = Credentials { email, password };
            match serde_json::to_string(&creds) {
                Ok(json) => entry.set_password(&json).is_ok(),
                Err(_) => false,
            }
        }
        Err(_) => false,
    }
}

#[tauri::command]
pub async fn credentials_load() -> Option<Credentials> {
    let entry = keyring::Entry::new(SERVICE_NAME, "user_credentials").ok()?;
    let password = entry.get_password().ok()?;
    serde_json::from_str(&password).ok()
}

#[tauri::command]
pub async fn credentials_clear() -> bool {
    match keyring::Entry::new(SERVICE_NAME, "user_credentials") {
        Ok(entry) => entry.delete_credential().is_ok(),
        Err(_) => false,
    }
}
