use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{command, AppHandle, Emitter};
use tokio::process::Command;

// ── Types ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LibraryGame {
    pub package: String,
    #[serde(rename = "versionCode")]
    pub version_code: u64,
    pub name: String,
}

#[derive(Debug, Serialize, Clone)]
pub struct Contribution {
    pub package: String,
    pub name: String,
    #[serde(rename = "versionCode")]
    pub version_code: u64,
    #[serde(rename = "releaseName")]
    pub release_name: String,
    pub kind: String, // "new" | "update"
}

#[derive(Debug, Serialize, Clone)]
pub struct UploadProgress {
    pub package: String,
    pub stage: String, // "pulling" | "zipping" | "uploading" | "done" | "error"
    pub message: String,
    pub error: Option<String>,
}

// ── Commands ──────────────────────────────────────────────────────────────────

/// Cross-reference installed packages with the library to find new apps and
/// version updates that can be contributed back to the mirror.
#[command]
pub async fn detect_contributions(
    device_id: String,
    library: Vec<LibraryGame>,
) -> Result<Vec<Contribution>, String> {
    // Build a map: package → library version
    let lib_map: std::collections::HashMap<String, (u64, String)> = library
        .iter()
        .map(|g| (g.package.clone(), (g.version_code, g.name.clone())))
        .collect();

    // Get installed packages with labels
    let output = adb(&device_id, &["shell", "cmd", "package", "list", "packages", "-3", "--show-labels"])
        .await
        .unwrap_or_default();

    let mut contributions = Vec::new();

    for line in output.lines() {
        let line = line.trim();
        let pkg = match line.split_whitespace().next().and_then(|p| p.strip_prefix("package:")) {
            Some(p) => p.trim().to_string(),
            None => continue,
        };

        let label = line
            .split_whitespace()
            .find(|p| p.starts_with("applicationLabel:"))
            .and_then(|p| p.strip_prefix("applicationLabel:"))
            .unwrap_or(&pkg)
            .to_string();

        // Get installed version code
        let version_output = adb(
            &device_id,
            &["shell", &format!("dumpsys package {pkg} | grep versionCode")],
        )
        .await
        .unwrap_or_default();

        let installed_version = parse_version_code(&version_output);

        match lib_map.get(&pkg) {
            None => {
                // Package not in library — potential new contribution
                contributions.push(Contribution {
                    package: pkg.clone(),
                    name: label.clone(),
                    version_code: installed_version,
                    release_name: format!("{label} v{installed_version}"),
                    kind: "new".to_string(),
                });
            }
            Some((lib_version, lib_name)) if installed_version > *lib_version => {
                // Newer version than what's in the library
                contributions.push(Contribution {
                    package: pkg.clone(),
                    name: lib_name.clone(),
                    version_code: installed_version,
                    release_name: format!("{lib_name} v{installed_version}"),
                    kind: "update".to_string(),
                });
            }
            _ => {}
        }
    }

    // Cap new apps at 6 per session (mirror requirement)
    let mut new_count = 0;
    contributions.retain(|c| {
        if c.kind == "new" {
            new_count += 1;
            new_count <= 6
        } else {
            true
        }
    });

    Ok(contributions)
}

/// Pull APK from device, zip it, and upload via rclone upload.config.
#[command]
pub async fn upload_contribution(
    app: AppHandle,
    device_id: String,
    package: String,
    release_name: String,
    _version_code: u64,
    device_model: String,
    upload_config_path: String,
    data_dir: String,
) -> Result<(), String> {
    let work_dir = PathBuf::from(&data_dir).join("uploads").join(&package);
    fs::create_dir_all(&work_dir).map_err(|e| e.to_string())?;

    emit_upload(&app, &package, "pulling", "Pulling APK from device…", None);

    // Get APK path on device
    let path_out = adb(&device_id, &["shell", &format!("pm path {package}")]).await?;
    let apk_remote = path_out
        .lines()
        .next()
        .and_then(|l| l.strip_prefix("package:"))
        .map(|s| s.trim().to_string())
        .ok_or("Could not find APK path on device")?;

    // Pull APK
    let local_apk = work_dir.join("base.apk");
    adb(&device_id, &["pull", &apk_remote, local_apk.to_str().unwrap()]).await?;

    // Pull OBB if exists
    let obb_remote = format!("/sdcard/Android/obb/{package}/");
    let obb_local = work_dir.join("obb");
    let _has_obb = adb(&device_id, &["pull", &obb_remote, obb_local.to_str().unwrap()])
        .await
        .is_ok();

    emit_upload(&app, &package, "zipping", "Compressing…", None);

    // Build archive name: "ReleaseName vVERSION package deviceModel"
    let archive_name = format!("{release_name} {package} {device_model}");
    let zip_path = PathBuf::from(&data_dir)
        .join("uploads")
        .join(format!("{archive_name}.zip"));

    zip_directory(&work_dir, &zip_path)?;

    emit_upload(&app, &package, "uploading", "Uploading to mirror…", None);

    // Upload via rclone
    upload_via_rclone(&zip_path, &upload_config_path).await?;

    // Write size file and upload it too
    let size = zip_path.metadata().map(|m| m.len()).unwrap_or(0);
    let size_file = PathBuf::from(&data_dir)
        .join("uploads")
        .join(format!("{archive_name}.txt"));
    fs::write(&size_file, size.to_string()).ok();
    upload_via_rclone(&size_file, &upload_config_path).await.ok();

    // Cleanup
    fs::remove_dir_all(&work_dir).ok();
    fs::remove_file(&zip_path).ok();
    fs::remove_file(&size_file).ok();

    emit_upload(&app, &package, "done", "Uploaded successfully!", None);
    Ok(())
}

/// Check if rclone is available and upload.config exists.
#[command]
pub fn check_upload_ready(upload_config_path: String) -> bool {
    let rclone_ok = std::process::Command::new("rclone")
        .arg("version")
        .output()
        .map(|o| o.status.success())
        .unwrap_or(false);
    let config_ok = PathBuf::from(upload_config_path).exists();
    rclone_ok && config_ok
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async fn adb(device_id: &str, args: &[&str]) -> Result<String, String> {
    let mut full = vec!["-s", device_id];
    full.extend_from_slice(args);
    let out = Command::new("adb")
        .args(&full)
        .output()
        .await
        .map_err(|e| e.to_string())?;
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

fn parse_version_code(output: &str) -> u64 {
    for line in output.lines() {
        if let Some(rest) = line.trim().strip_prefix("versionCode=") {
            let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
            if let Ok(v) = digits.parse() {
                return v;
            }
        }
    }
    0
}

fn zip_directory(src: &Path, dest: &Path) -> Result<(), String> {
    use std::io::{Read, Write};

    let file = fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    for entry in walkdir::WalkDir::new(src).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();
        let name = path.strip_prefix(src).unwrap_or(path);
        if path.is_file() {
            zip.start_file(name.to_string_lossy(), options)
                .map_err(|e| e.to_string())?;
            let mut f = fs::File::open(path).map_err(|e| e.to_string())?;
            let mut buf = Vec::new();
            f.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            zip.write_all(&buf).map_err(|e| e.to_string())?;
        }
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(())
}

async fn upload_via_rclone(file: &Path, config_path: &str) -> Result<(), String> {
    let out = Command::new("rclone")
        .args([
            "copy",
            file.to_str().unwrap(),
            "RSL-gameuploads:",
            "--config",
            config_path,
        ])
        .output()
        .await
        .map_err(|e| e.to_string())?;

    if out.status.success() {
        Ok(())
    } else {
        Err(String::from_utf8_lossy(&out.stderr).to_string())
    }
}

fn emit_upload(app: &AppHandle, package: &str, stage: &str, message: &str, error: Option<String>) {
    let _ = app.emit(
        "contribute://progress",
        UploadProgress {
            package: package.to_string(),
            stage: stage.to_string(),
            message: message.to_string(),
            error,
        },
    );
}
