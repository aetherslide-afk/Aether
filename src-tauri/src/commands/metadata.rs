use base64::{engine::general_purpose::STANDARD, Engine};
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tauri::{command, AppHandle, Emitter};

// ── CSV column indices (matches original SideloaderRCLONE) ──────────────────
const GAME_NAME_IDX: usize = 0;
const RELEASE_NAME_IDX: usize = 1;
const PACKAGE_NAME_IDX: usize = 2;
const VERSION_CODE_IDX: usize = 3;
const APK_PATH_IDX: usize = 4;
const VERSION_NAME_IDX: usize = 5;
const DOWNLOADS_IDX: usize = 6;

// ── Public types ─────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PublicConfig {
    #[serde(rename = "baseUri")]
    pub base_uri: String,
    pub password: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GameEntry {
    pub id: String,
    pub name: String,
    #[serde(rename = "packageName")]
    pub package_name: String,
    #[serde(rename = "releaseName")]
    pub release_name: String,
    #[serde(rename = "versionCode")]
    pub version_code: u64,
    #[serde(rename = "versionName")]
    pub version_name: String,
    #[serde(rename = "apkPath")]
    pub apk_path: String,
    pub size: u64,
    pub downloads: u64,
    #[serde(rename = "thumbnailPath")]
    pub thumbnail_path: Option<String>,
    pub notes: Option<String>,
    #[serde(rename = "isFavorite")]
    pub is_favorite: bool,
    #[serde(rename = "installedVersion")]
    pub installed_version: Option<u64>,
    #[serde(rename = "isDownloaded")]
    pub is_downloaded: bool,
    #[serde(rename = "hasUpdate")]
    pub has_update: bool,
}

#[derive(Debug, Serialize, Clone)]
pub struct MetadataProgress {
    pub stage: String,
    pub progress: f32,
    pub message: String,
}

fn emit_progress(app: &AppHandle, stage: &str, progress: f32, message: &str) {
    let _ = app.emit(
        "metadata://progress",
        MetadataProgress {
            stage: stage.to_string(),
            progress,
            message: message.to_string(),
        },
    );
}

// ── Commands ─────────────────────────────────────────────────────────────────

#[command]
pub fn load_public_config(path: String) -> Result<PublicConfig, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    let raw: serde_json::Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    let base_uri = raw["baseUri"]
        .as_str()
        .ok_or("missing baseUri")?
        .to_string();

    // Password is base64-encoded in the JSON file
    let password_b64 = raw["password"].as_str().ok_or("missing password")?;
    let password_bytes = STANDARD
        .decode(password_b64)
        .map_err(|e| format!("bad password encoding: {e}"))?;
    let password = String::from_utf8(password_bytes).map_err(|e| e.to_string())?;

    let mut uri = base_uri;
    if !uri.starts_with("http://") && !uri.starts_with("https://") {
        uri = format!("https://{uri}");
    }

    Ok(PublicConfig {
        base_uri: uri,
        password,
    })
}

#[command]
pub async fn download_metadata(
    app: AppHandle,
    base_uri: String,
    dest_dir: String,
    api_key: Option<String>,
) -> Result<String, String> {
    let dest = PathBuf::from(&dest_dir);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;

    let archive_path = dest.join("meta.7z");
    let url = format!("{}/meta.7z", base_uri.trim_end_matches('/'));

    emit_progress(&app, "downloading", 0.0, "Connecting…");

    let client = reqwest::Client::new();
    let mut req = client.get(&url);
    if let Some(key) = &api_key {
        if !key.is_empty() {
            req = req.header("X-API-Key", key.as_str());
        }
    }
    let response = req
        .send()
        .await
        .map_err(|e| format!("Download failed: {e}"))?;

    if !response.status().is_success() {
        return Err(format!("Server returned {}", response.status()));
    }

    let total = response.content_length().unwrap_or(0);
    let mut file = fs::File::create(&archive_path).map_err(|e| e.to_string())?;
    let mut downloaded: u64 = 0;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Stream error: {e}"))?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;

        if total > 0 {
            let pct = (downloaded as f32 / total as f32) * 100.0;
            emit_progress(
                &app,
                "downloading",
                pct,
                &format!("{:.1} / {:.1} MB", mb(downloaded), mb(total)),
            );
        }
    }

    emit_progress(&app, "downloading", 100.0, "Download complete");
    Ok(archive_path.to_string_lossy().to_string())
}

#[command]
pub fn extract_metadata(
    app: AppHandle,
    archive_path: String,
    dest_dir: String,
    password: String,
) -> Result<(), String> {
    emit_progress(&app, "extracting", 0.0, "Extracting metadata…");

    let dest = PathBuf::from(&dest_dir);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;

    let pw = sevenz_rust::Password::from(password.as_str());
    sevenz_rust::decompress_with_extract_fn_and_password(
        fs::File::open(&archive_path).map_err(|e| e.to_string())?,
        &dest,
        pw,
        |entry, reader, dest| sevenz_rust::default_entry_extract_fn(entry, reader, dest),
    )
    .map_err(|e| format!("Extraction failed: {e}"))?;

    emit_progress(&app, "extracting", 100.0, "Extraction complete");

    // Promote .meta subdirectories to the dest root
    let dot_meta = dest.join(".meta");
    if dot_meta.exists() {
        for subdir in ["nouns", "thumbnails", "notes"] {
            let src = dot_meta.join(subdir);
            let dst = dest.join(subdir);
            if src.exists() {
                if dst.exists() {
                    fs::remove_dir_all(&dst).ok();
                }
                fs::rename(&src, &dst).ok();
            }
        }
        // Extract upload.config to parent data dir (sibling of meta/)
        let upload_src = dot_meta.join("upload.config");
        if upload_src.exists() {
            if let Some(parent) = dest.parent() {
                let upload_dst = parent.join("upload.config");
                fs::copy(&upload_src, &upload_dst).ok();
            }
        }
    }

    Ok(())
}

#[command]
pub fn parse_game_list(
    app: AppHandle,
    meta_dir: String,
    thumbnails_dir: String,
    notes_dir: String,
) -> Result<Vec<GameEntry>, String> {
    emit_progress(&app, "parsing", 0.0, "Loading game list…");

    let meta = PathBuf::from(&meta_dir);

    // Find *ameList.txt (GameList.txt or similar)
    let game_list_path = find_game_list(&meta)?;
    let content = fs::read_to_string(&game_list_path).map_err(|e| e.to_string())?;
    let lines: Vec<&str> = content.lines().collect();
    let total = lines.len().max(1) as f32;

    let thumbs = PathBuf::from(&thumbnails_dir);
    let notes = PathBuf::from(&notes_dir);
    let mut games = Vec::with_capacity(lines.len());

    for (i, line) in lines.iter().enumerate().skip(1) {
        if line.trim().is_empty() {
            continue;
        }
        let cols: Vec<&str> = line.split(';').collect();
        if cols.len() < 2 {
            continue;
        }

        let package_name = col(&cols, PACKAGE_NAME_IDX);
        let release_name = col(&cols, RELEASE_NAME_IDX);

        let thumbnail_path = find_thumbnail(&thumbs, &package_name);
        let notes_text = read_notes(&notes, &release_name, &package_name);

        let version_code: u64 = col(&cols, VERSION_CODE_IDX)
            .chars()
            .filter(|c| c.is_ascii_digit())
            .collect::<String>()
            .parse()
            .unwrap_or(0);

        // Size is stored as MB in the CSV (column 6 in local scans, but in online CSV
        // it isn't standardized — treat 0 if missing/unparseable)
        let size_mb: f64 = cols
            .get(6)
            .and_then(|s| s.trim().parse().ok())
            .unwrap_or(0.0);

        let downloads: u64 = col(&cols, DOWNLOADS_IDX)
            .chars()
            .filter(|c| c.is_ascii_digit())
            .collect::<String>()
            .parse()
            .unwrap_or(0);

        games.push(GameEntry {
            id: package_name.clone(),
            name: col(&cols, GAME_NAME_IDX),
            package_name: package_name.clone(),
            release_name: col(&cols, RELEASE_NAME_IDX),
            version_code,
            version_name: col(&cols, VERSION_NAME_IDX),
            apk_path: col(&cols, APK_PATH_IDX),
            size: (size_mb * 1024.0 * 1024.0) as u64,
            downloads,
            thumbnail_path,
            notes: notes_text,
            is_favorite: false,
            installed_version: None,
            is_downloaded: false,
            has_update: false,
        });

        if i % 100 == 0 {
            emit_progress(&app, "parsing", (i as f32 / total) * 100.0, &format!("Parsed {i} games…"));
        }
    }

    emit_progress(&app, "parsing", 100.0, &format!("{} games loaded", games.len()));
    Ok(games)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

fn col(cols: &[&str], idx: usize) -> String {
    cols.get(idx)
        .map(|s| s.trim().to_string())
        .unwrap_or_default()
}

fn mb(bytes: u64) -> f64 {
    bytes as f64 / 1_048_576.0
}

fn find_game_list(meta_dir: &Path) -> Result<PathBuf, String> {
    let dir = fs::read_dir(meta_dir).map_err(|e| e.to_string())?;
    for entry in dir.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if name.ends_with("ameList.txt") {
            return Ok(entry.path());
        }
    }
    Err("GameList.txt not found in meta directory".to_string())
}

fn find_thumbnail(thumbs_dir: &Path, package_name: &str) -> Option<String> {
    for ext in [".jpg", ".png", ".webp"] {
        let p = thumbs_dir.join(format!("{package_name}{ext}"));
        if p.exists() {
            return Some(p.to_string_lossy().to_string());
        }
    }
    None
}

fn read_notes(notes_dir: &Path, release_name: &str, package_name: &str) -> Option<String> {
    for name in [release_name, package_name] {
        for ext in [".txt", ".md"] {
            let p = notes_dir.join(format!("{name}{ext}"));
            if p.exists() {
                return fs::read_to_string(p).ok();
            }
        }
    }
    None
}
