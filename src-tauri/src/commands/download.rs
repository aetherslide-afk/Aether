use dashmap::DashMap;
use futures_util::StreamExt;
use reqwest::header::{RANGE, CONTENT_LENGTH};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::time::Instant;
use tauri::{command, AppHandle, Emitter};

// ── Global cancel-token map ───────────────────────────────────────────────────
// game_id → cancel flag
lazy_static::lazy_static! {
    static ref CANCEL_FLAGS: DashMap<String, Arc<AtomicBool>> = DashMap::new();
}

// ── Public types ──────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct DownloadProgress {
    #[serde(rename = "gameId")]
    pub game_id: String,
    pub stage: String,
    pub progress: f32,
    pub speed: f64,
    #[serde(rename = "etaSecs")]
    pub eta_secs: u64,
    pub downloaded: u64,
    pub total: u64,
    pub error: Option<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
pub struct DownloadRequest {
    #[serde(rename = "gameId")]
    pub game_id: String,
    #[serde(rename = "gameName")]
    pub game_name: String,
    #[serde(rename = "apkUrl")]
    pub apk_url: String,
    #[serde(rename = "destDir")]
    pub dest_dir: String,
    #[serde(rename = "bandwidthLimit")]
    pub bandwidth_limit: Option<f64>, // MB/s, None = unlimited
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[command]
pub async fn start_download(app: AppHandle, req: DownloadRequest) -> Result<(), String> {
    let cancel = Arc::new(AtomicBool::new(false));
    CANCEL_FLAGS.insert(req.game_id.clone(), cancel.clone());

    let result = download_apk(&app, &req, &cancel).await;

    CANCEL_FLAGS.remove(&req.game_id);

    match result {
        Ok(()) => emit_progress(
            &app,
            &req.game_id,
            "done",
            100.0,
            0.0,
            0,
            0,
            0,
            None,
        ),
        Err(e) if e == "cancelled" => emit_progress(
            &app,
            &req.game_id,
            "cancelled",
            0.0,
            0.0,
            0,
            0,
            0,
            None,
        ),
        Err(e) => emit_progress(
            &app,
            &req.game_id,
            "error",
            0.0,
            0.0,
            0,
            0,
            0,
            Some(e),
        ),
    }

    Ok(())
}

#[command]
pub fn cancel_download(game_id: String) {
    if let Some(flag) = CANCEL_FLAGS.get(&game_id) {
        flag.store(true, Ordering::Relaxed);
    }
}

// ── Core download logic ───────────────────────────────────────────────────────

async fn download_apk(
    app: &AppHandle,
    req: &DownloadRequest,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    let dest = PathBuf::from(&req.dest_dir);
    fs::create_dir_all(&dest).map_err(|e| e.to_string())?;

    let bw_limit = req.bandwidth_limit.map(|mb| mb * 1_048_576.0); // MB/s → bytes/s

    download_file_with_progress(
        app,
        &req.game_id,
        &req.apk_url,
        &dest,
        bw_limit,
        cancel,
    )
    .await
}

async fn download_file_with_progress(
    app: &AppHandle,
    game_id: &str,
    url: &str,
    dest_dir: &Path,
    bandwidth_limit: Option<f64>,
    cancel: &Arc<AtomicBool>,
) -> Result<(), String> {
    const MAX_RETRIES: u32 = 3;
    const BUFFER_SIZE: usize = 81_920; // 80 KB — same as original
    const PROGRESS_INTERVAL_MS: u128 = 250; // ~4 updates/sec

    let filename = url
        .rsplit('/')
        .next()
        .map(|s| urlencoding::decode(s).unwrap_or_default().to_string())
        .unwrap_or_else(|| "download.apk".to_string());

    let dest_path = dest_dir.join(&filename);

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(1800))
        .build()
        .map_err(|e| e.to_string())?;

    for attempt in 0..=MAX_RETRIES {
        if cancel.load(Ordering::Relaxed) {
            return Err("cancelled".to_string());
        }

        match try_download(
            app,
            game_id,
            &client,
            url,
            &dest_path,
            bandwidth_limit,
            cancel,
            BUFFER_SIZE,
            PROGRESS_INTERVAL_MS,
        )
        .await
        {
            Ok(()) => return Ok(()),
            Err(e) if e == "cancelled" => return Err(e),
            Err(e) => {
                if attempt >= MAX_RETRIES {
                    return Err(format!("Failed after {} attempts: {}", MAX_RETRIES + 1, e));
                }
                let delay_ms = 1000u64 * 2u64.pow(attempt);
                tokio::time::sleep(std::time::Duration::from_millis(delay_ms)).await;
            }
        }
    }

    Ok(())
}

async fn try_download(
    app: &AppHandle,
    game_id: &str,
    client: &reqwest::Client,
    url: &str,
    dest_path: &Path,
    bandwidth_limit: Option<f64>,
    cancel: &Arc<AtomicBool>,
    _buffer_size: usize,
    progress_interval_ms: u128,
) -> Result<(), String> {
    // Resume: check existing bytes
    let existing = if dest_path.exists() {
        dest_path.metadata().map(|m| m.len()).unwrap_or(0)
    } else {
        0
    };

    // HEAD to get total size
    let head = client
        .head(url)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let total: u64 = head
        .headers()
        .get(CONTENT_LENGTH)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse().ok())
        .unwrap_or(0);

    // Already complete?
    if total > 0 && existing >= total {
        emit_progress(app, game_id, "downloading", 100.0, 0.0, existing, total, 0, None);
        return Ok(());
    }

    // Build GET, with Range header if resuming
    let mut req_builder = client.get(url);
    if existing > 0 {
        req_builder = req_builder.header(RANGE, format!("bytes={}-", existing));
    }

    let response = req_builder.send().await.map_err(|e| e.to_string())?;
    let status = response.status();

    let resuming = status == reqwest::StatusCode::PARTIAL_CONTENT;
    let start_bytes = if resuming { existing } else { 0 };

    if !status.is_success() {
        return Err(format!("HTTP {status}"));
    }

    // Open file (append if resuming, create otherwise)
    let mut file = if resuming && start_bytes > 0 {
        OpenOptions::new()
            .append(true)
            .open(dest_path)
            .map_err(|e| e.to_string())?
    } else {
        OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(dest_path)
            .map_err(|e| e.to_string())?
    };

    let mut downloaded = start_bytes;
    let mut stream = response.bytes_stream();

    // EWMA speed tracking (alpha=0.3, same as original)
    let mut ewma_speed: f64 = 0.0;
    const ALPHA: f64 = 0.3;
    let mut last_progress = Instant::now();
    let mut bytes_since_report: u64 = 0;

    // Token-bucket bandwidth throttling
    let mut token_bucket: f64 = 0.0;
    let mut last_refill = Instant::now();

    while let Some(chunk) = stream.next().await {
        if cancel.load(Ordering::Relaxed) {
            return Err("cancelled".to_string());
        }

        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;

        let n = chunk.len() as u64;
        downloaded += n;
        bytes_since_report += n;

        // Bandwidth throttle — token bucket
        if let Some(limit_bps) = bandwidth_limit {
            let now = Instant::now();
            let elapsed = now.duration_since(last_refill).as_secs_f64();
            token_bucket += n as f64;
            last_refill = now;

            let allowed = limit_bps * elapsed;
            token_bucket -= allowed;
            if token_bucket < 0.0 {
                token_bucket = 0.0;
            }

            if token_bucket > 0.0 {
                let sleep_secs = token_bucket / limit_bps;
                if sleep_secs > 0.01 {
                    tokio::time::sleep(std::time::Duration::from_secs_f64(sleep_secs)).await;
                    token_bucket = 0.0;
                    last_refill = Instant::now();
                }
            }
        }

        // Throttled progress events
        let elapsed_ms = last_progress.elapsed().as_millis();
        if elapsed_ms >= progress_interval_ms {
            let instant_speed = bytes_since_report as f64 / last_progress.elapsed().as_secs_f64();
            ewma_speed = if ewma_speed < 1.0 {
                instant_speed
            } else {
                ALPHA * instant_speed + (1.0 - ALPHA) * ewma_speed
            };

            let progress = if total > 0 {
                (downloaded as f32 / total as f32 * 100.0).min(99.0)
            } else {
                0.0
            };

            let eta_secs = if ewma_speed > 0.0 && total > downloaded {
                ((total - downloaded) as f64 / ewma_speed) as u64
            } else {
                0
            };

            emit_progress(app, game_id, "downloading", progress, ewma_speed, downloaded, total, eta_secs, None);

            last_progress = Instant::now();
            bytes_since_report = 0;
        }
    }

    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

#[allow(clippy::too_many_arguments)]
fn emit_progress(
    app: &AppHandle,
    game_id: &str,
    stage: &str,
    progress: f32,
    speed: f64,
    downloaded: u64,
    total: u64,
    eta_secs: u64,
    error: Option<String>,
) {
    let _ = app.emit(
        "download://progress",
        DownloadProgress {
            game_id: game_id.to_string(),
            stage: stage.to_string(),
            progress,
            speed,
            eta_secs,
            downloaded,
            total,
            error,
        },
    );
}
