use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::command;
// reqwest is needed for fetch_public_config
#[allow(unused_imports)]
use reqwest;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AppSettings {
    pub download_path: String,
    pub delete_after_install: bool,
    pub auto_reinstall_on_failure: bool,
    pub check_for_updates: bool,
    pub show_adult_content: bool,
    pub trailers_enabled: bool,
    pub bandwidth_limit: f64,
    pub proxy_enabled: bool,
    pub proxy_address: String,
    pub proxy_port: u16,
    pub single_thread_mode: bool,
    pub use_downloaded_files: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            download_path: String::new(),
            delete_after_install: false,
            auto_reinstall_on_failure: true,
            check_for_updates: true,
            show_adult_content: false,
            trailers_enabled: false,
            bandwidth_limit: 0.0,
            proxy_enabled: false,
            proxy_address: String::new(),
            proxy_port: 8080,
            single_thread_mode: false,
            use_downloaded_files: true,
        }
    }
}

fn settings_path() -> PathBuf {
    let config_dir = dirs::config_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("SideQuestReloaded");
    fs::create_dir_all(&config_dir).ok();
    config_dir.join("settings.json")
}

#[command]
pub fn load_settings() -> Result<AppSettings, String> {
    let path = settings_path();
    if !path.exists() {
        return Ok(AppSettings::default());
    }
    let json = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&json).map_err(|e| e.to_string())
}

#[command]
pub fn save_settings(settings: AppSettings) -> Result<(), String> {
    let path = settings_path();
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| e.to_string())
}

#[command]
pub fn pick_folder() -> Result<Option<String>, String> {
    Ok(None)
}

#[command]
pub fn file_exists(path: String) -> bool {
    PathBuf::from(path).exists()
}

/// Save a public.json content string directly to disk (user pastes JSON).
#[command]
pub fn save_public_config(content: String, path: String) -> Result<(), String> {
    // Validate it's proper JSON with at least baseUri
    let v: serde_json::Value =
        serde_json::from_str(&content).map_err(|_| "Invalid JSON".to_string())?;
    if v["baseUri"].as_str().is_none() {
        return Err("Missing \"baseUri\" field".to_string());
    }
    fs::write(path, content).map_err(|e| e.to_string())
}

#[command]
pub fn delete_file(path: String) -> Result<(), String> {
    let p = PathBuf::from(path);
    if p.exists() { fs::remove_file(p).map_err(|e| e.to_string())?; }
    Ok(())
}

#[command]
pub fn delete_dir(path: String) -> Result<(), String> {
    let p = PathBuf::from(path);
    if p.exists() { fs::remove_dir_all(p).map_err(|e| e.to_string())?; }
    Ok(())
}

#[command]
pub fn get_data_dir() -> Result<String, String> {
    let path = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("SideQuestReloaded");
    fs::create_dir_all(&path).map_err(|e| e.to_string())?;
    Ok(path.to_string_lossy().to_string())
}

/// Downloads public.json from the given URL and saves it to `path`.
#[command]
pub async fn fetch_public_config(url: String, path: String) -> Result<(), String> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url).send().await.map_err(|e| e.to_string())?;
    if !resp.status().is_success() {
        return Err(format!("HTTP {}: {}", resp.status(), url));
    }
    let bytes = resp.bytes().await.map_err(|e| e.to_string())?;

    // Validate it looks like a public config
    let _: serde_json::Value = serde_json::from_slice(&bytes)
        .map_err(|_| "URL did not return valid JSON".to_string())?;

    fs::write(path, bytes).map_err(|e| e.to_string())
}
