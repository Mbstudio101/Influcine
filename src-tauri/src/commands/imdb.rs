use rusqlite::Connection;
use serde::Serialize;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};

pub struct ImdbState(pub Mutex<Option<Connection>>);

#[derive(Serialize, Clone)]
pub struct ImdbResult {
    pub tconst: String,
    #[serde(rename = "primaryTitle")]
    pub primary_title: String,
    #[serde(rename = "startYear")]
    pub start_year: Option<i32>,
    #[serde(rename = "titleType")]
    pub title_type: String,
    #[serde(rename = "averageRating")]
    pub average_rating: Option<f64>,
    #[serde(rename = "numVotes")]
    pub num_votes: Option<i64>,
}

#[derive(Serialize)]
pub struct ImdbSearchResult {
    pub results: Vec<ImdbResult>,
    pub error: Option<String>,
}

fn find_db_path(app: &AppHandle) -> Option<PathBuf> {
    let desktop = dirs::desktop_dir()?.join("IMDB").join("imdb.db");
    if desktop.exists() {
        return Some(desktop);
    }

    let resource = app.path().resource_dir().ok()?.join("imdb.db");
    if resource.exists() {
        return Some(resource);
    }

    None
}

fn ensure_db(app: &AppHandle, state: &ImdbState) -> bool {
    let mut guard = state.0.lock().unwrap();
    if guard.is_some() {
        return true;
    }

    if let Some(db_path) = find_db_path(app) {
        match Connection::open_with_flags(&db_path, rusqlite::OpenFlags::SQLITE_OPEN_READ_ONLY) {
            Ok(conn) => {
                *guard = Some(conn);
                true
            }
            Err(_) => false,
        }
    } else {
        false
    }
}

#[tauri::command]
pub fn imdb_search(
    app: AppHandle,
    state: State<'_, ImdbState>,
    query: String,
) -> ImdbSearchResult {
    if query.len() < 2 {
        return ImdbSearchResult {
            results: vec![],
            error: None,
        };
    }

    if !ensure_db(&app, &state) {
        return ImdbSearchResult {
            results: vec![],
            error: Some("Database not loaded".to_string()),
        };
    }

    let guard = state.0.lock().unwrap();
    let conn = guard.as_ref().unwrap();

    let sql = "
        SELECT t.tconst, t.primaryTitle, t.startYear, t.titleType, r.averageRating, r.numVotes
        FROM titles t
        LEFT JOIN ratings r ON t.tconst = r.tconst
        WHERE t.primaryTitle LIKE ?1 AND t.titleType IN ('movie', 'tvSeries')
        ORDER BY r.numVotes DESC
        LIMIT 20
    ";

    let result = (|| -> Result<Vec<ImdbResult>, String> {
        let mut stmt = conn.prepare(sql).map_err(|e| e.to_string())?;
        let pattern = format!("{}%", query);
        let rows = stmt
            .query_map([&pattern], |row| {
                Ok(ImdbResult {
                    tconst: row.get(0)?,
                    primary_title: row.get(1)?,
                    start_year: row.get(2)?,
                    title_type: row.get(3)?,
                    average_rating: row.get(4)?,
                    num_votes: row.get(5)?,
                })
            })
            .map_err(|e| e.to_string())?;
        Ok(rows.filter_map(|r| r.ok()).collect())
    })();

    match result {
        Ok(results) => ImdbSearchResult {
            results,
            error: None,
        },
        Err(_) => ImdbSearchResult {
            results: vec![],
            error: Some("Query failed".to_string()),
        },
    }
}
