use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use tauri::{command, AppHandle, Emitter};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;

// ── Events ────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Clone)]
pub struct InstallProgress {
    #[serde(rename = "gameId")]
    pub game_id: String,
    pub stage: String, // "pushing" | "installing" | "obb" | "done" | "error" | "reinstalling" | "backing_up" | "restoring"
    pub progress: f32,
    pub message: String,
    pub error: Option<String>,
}

fn emit(app: &AppHandle, game_id: &str, stage: &str, progress: f32, message: &str, error: Option<String>) {
    let _ = app.emit(
        "install://progress",
        InstallProgress {
            game_id: game_id.to_string(),
            stage: stage.to_string(),
            progress,
            message: message.to_string(),
            error,
        },
    );
}

// ── Commands ──────────────────────────────────────────────────────────────────

#[command]
pub async fn install_game(
    app: AppHandle,
    #[allow(unused_variables)]
    game_id: String,
    device_id: String,
    apk_path: String,
    package_name: String,
    game_name: String,
    obb_dir: Option<String>,
    auto_reinstall: bool,
) -> Result<(), String> {
    let apk = PathBuf::from(&apk_path);
    if !apk.exists() {
        return Err(format!("APK not found: {apk_path}"));
    }

    let filename = apk.file_name().unwrap().to_string_lossy().to_string();
    let remote_apk = format!("/data/local/tmp/{filename}");

    // ── Step 1: Push APK to device ─────────────────────────────────────────
    emit(&app, &game_id, "pushing", 0.0, "Pushing APK to device…", None);

    push_with_progress(&app, &game_id, &device_id, &apk_path, &remote_apk).await?;

    // ── Step 2: Install from device storage ───────────────────────────────
    emit(&app, &game_id, "installing", 80.0, "Installing…", None);

    let install_result = adb_shell(&device_id, &format!("pm install -r \"{remote_apk}\"")).await;

    // Cleanup temp APK regardless of outcome
    let _ = adb_shell(&device_id, &format!("rm -f \"{remote_apk}\"")).await;

    match install_result {
        Ok(output) if output.contains("Success") => {
            // ── Step 3: OBB ───────────────────────────────────────────────
            if let Some(ref obb) = obb_dir {
                push_obb(&app, &game_id, &device_id, obb, &package_name).await?;
            }
            emit(&app, &game_id, "done", 100.0, &format!("{game_name} installed"), None);
            Ok(())
        }

        Ok(output) | Err(output) => {
            let err = output.trim().to_string();

            let needs_reinstall = auto_reinstall && (
                err.contains("INSTALL_FAILED_UPDATE_INCOMPATIBLE")
                || err.contains("signatures do not match")
                || err.contains("INSTALL_FAILED_VERSION_DOWNGRADE")
                || err.contains("INSTALL_FAILED_ALREADY_EXISTS")
            );

            let needs_reinstall_storage = auto_reinstall
                && err.contains("INSTALL_FAILED_INSUFFICIENT_STORAGE");

            if needs_reinstall || needs_reinstall_storage {
                reinstall(
                    &app,
                    &game_id,
                    &device_id,
                    &apk_path,
                    &package_name,
                    &game_name,
                    obb_dir.as_deref(),
                )
                .await
            } else {
                emit(&app, &game_id, "error", 0.0, "", Some(err.clone()));
                Err(err)
            }
        }
    }
}

#[command]
pub async fn backup_save_data(
    device_id: String,
    package_name: String,
    backup_dir: String,
) -> Result<(), String> {
    std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
    adb(&device_id, &["pull", &format!("/sdcard/Android/data/{package_name}"), &backup_dir]).await?;
    Ok(())
}

#[command]
pub async fn restore_save_data(
    device_id: String,
    package_name: String,
    backup_dir: String,
) -> Result<(), String> {
    let src = format!("{backup_dir}/{package_name}");
    adb(&device_id, &["push", &src, "/sdcard/Android/data/"]).await?;
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async fn reinstall(
    app: &AppHandle,
    game_id: &str,
    device_id: &str,
    apk_path: &str,
    package_name: &str,
    game_name: &str,
    obb_dir: Option<&str>,
) -> Result<(), String> {
    // Backup save data
    emit(app, game_id, "backing_up", 10.0, "Backing up save data…", None);
    let tmp_backup = std::env::temp_dir().join(format!("sqr_backup_{package_name}"));
    std::fs::create_dir_all(&tmp_backup).ok();
    let _ = adb(device_id, &[
        "pull",
        &format!("/sdcard/Android/data/{package_name}"),
        tmp_backup.to_str().unwrap(),
    ]).await;

    // Uninstall
    emit(app, game_id, "reinstalling", 30.0, "Uninstalling old version…", None);
    adb(device_id, &["uninstall", package_name]).await?;

    // Push fresh APK
    emit(app, game_id, "pushing", 40.0, "Pushing APK…", None);
    let filename = Path::new(apk_path).file_name().unwrap().to_string_lossy().to_string();
    let remote_apk = format!("/data/local/tmp/{filename}");
    push_with_progress(app, game_id, device_id, apk_path, &remote_apk).await?;

    // Reinstall
    emit(app, game_id, "reinstalling", 80.0, "Reinstalling…", None);
    let out = adb_shell(device_id, &format!("pm install -r \"{remote_apk}\"")).await;
    let _ = adb_shell(device_id, &format!("rm -f \"{remote_apk}\"")).await;

    match out {
        Ok(o) if o.contains("Success") => {}
        Ok(o) | Err(o) => {
            emit(app, game_id, "error", 0.0, "", Some(o.clone()));
            return Err(o);
        }
    }

    // Restore save data
    emit(app, game_id, "restoring", 90.0, "Restoring save data…", None);
    let backup_pkg = tmp_backup.join(package_name);
    if backup_pkg.exists() {
        let _ = adb(device_id, &[
            "push",
            backup_pkg.to_str().unwrap(),
            "/sdcard/Android/data/",
        ]).await;
    }
    std::fs::remove_dir_all(&tmp_backup).ok();

    // OBB
    if let Some(obb) = obb_dir {
        push_obb(app, game_id, device_id, obb, package_name).await?;
    }

    emit(app, game_id, "done", 100.0, &format!("{game_name} reinstalled"), None);
    Ok(())
}

/// Push a local file to the device, parsing `adb push` percent lines for progress.
async fn push_with_progress(
    app: &AppHandle,
    game_id: &str,
    device_id: &str,
    local: &str,
    remote: &str,
) -> Result<(), String> {
    let mut child = Command::new("adb")
        .args(["-s", device_id, "push", local, remote])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| e.to_string())?;

    // adb push writes progress to stderr: "[ 23%] /data/local/tmp/file.apk"
    if let Some(stderr) = child.stderr.take() {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            if let Some(pct) = parse_push_percent(&line) {
                // Scale push phase to 0..80% of total install progress
                let scaled = pct * 0.8;
                emit(app, game_id, "pushing", scaled, &format!("Pushing… {pct:.0}%"), None);
            }
        }
    }

    let status = child.wait().await.map_err(|e| e.to_string())?;
    if status.success() {
        Ok(())
    } else {
        Err("adb push failed".to_string())
    }
}

async fn push_obb(
    app: &AppHandle,
    game_id: &str,
    device_id: &str,
    obb_local_dir: &str,
    package_name: &str,
) -> Result<(), String> {
    emit(app, game_id, "obb", 90.0, "Pushing OBB data…", None);
    let remote = format!("/sdcard/Android/obb/{package_name}/");
    adb(device_id, &["shell", "mkdir", "-p", &remote]).await.ok();
    adb(device_id, &["push", obb_local_dir, &format!("/sdcard/Android/obb/{package_name}/")]).await?;
    Ok(())
}

fn parse_push_percent(line: &str) -> Option<f32> {
    // "[  5%] ..." or "[ 23%] ..."
    let trimmed = line.trim();
    if trimmed.starts_with('[') {
        let end = trimmed.find('%')?;
        trimmed[1..end].trim().parse::<f32>().ok()
    } else {
        None
    }
}

async fn adb(device_id: &str, args: &[&str]) -> Result<String, String> {
    let mut full_args = vec!["-s", device_id];
    full_args.extend_from_slice(args);

    let out = Command::new("adb")
        .args(&full_args)
        .output()
        .await
        .map_err(|e| e.to_string())?;

    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();

    if out.status.success() {
        Ok(stdout)
    } else {
        Err(if stderr.is_empty() { stdout } else { stderr })
    }
}

async fn adb_shell(device_id: &str, cmd: &str) -> Result<String, String> {
    adb(device_id, &["shell", cmd]).await
}
