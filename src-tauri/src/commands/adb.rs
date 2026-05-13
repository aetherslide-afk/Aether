use serde::{Deserialize, Serialize};
use std::process::Command;
use tauri::command;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Device {
    pub id: String,
    pub name: String,
    pub model: String,
    #[serde(rename = "type")]
    pub device_type: String,
    pub free_space: Option<u64>,
    pub total_space: Option<u64>,
}

fn adb_bin() -> String {
    #[cfg(target_os = "windows")]
    {
        // Check for ADB bundled next to the executable first
        if let Ok(exe) = std::env::current_exe() {
            let bundled = exe.parent().unwrap_or(std::path::Path::new("."))
                .join("platform-tools").join("adb.exe");
            if bundled.exists() {
                return bundled.to_string_lossy().to_string();
            }
        }
        "adb.exe".to_string()
    }
    #[cfg(not(target_os = "windows"))]
    "adb".to_string()
}

fn run_adb(args: &[&str]) -> Result<String, String> {
    let output = Command::new(adb_bin())
        .args(args)
        .output()
        .map_err(|e| format!("ADB not found: {e}"))?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(String::from_utf8_lossy(&output.stderr).to_string())
    }
}

fn run_adb_device(device_id: &str, args: &[&str]) -> Result<String, String> {
    let mut full_args = vec!["-s", device_id];
    full_args.extend_from_slice(args);
    run_adb(&full_args)
}

#[command]
pub fn adb_list_devices() -> Result<Vec<Device>, String> {
    let output = run_adb(&["devices", "-l"])?;
    let mut devices = Vec::new();

    for line in output.lines().skip(1) {
        let line = line.trim();
        if line.is_empty() || !line.contains("device") {
            continue;
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 2 || parts[1] != "device" {
            continue;
        }
        let id = parts[0].to_string();
        let model = parts
            .iter()
            .find(|p| p.starts_with("model:"))
            .map(|p| p.trim_start_matches("model:").replace('_', " "))
            .unwrap_or_else(|| id.clone());

        let device_type = if id.contains(':') { "wifi" } else { "usb" }.to_string();

        let free_space = get_free_space(&id).ok();

        devices.push(Device {
            id,
            name: model.clone(),
            model,
            device_type,
            free_space,
            total_space: None,
        });
    }
    Ok(devices)
}

fn get_free_space(device_id: &str) -> Result<u64, String> {
    let output = run_adb_device(device_id, &["shell", "df", "/sdcard"])?;
    // Parse "df" output — second data line has: filesystem blocks used available %
    for line in output.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() >= 4 {
            if let Ok(available) = parts[3].parse::<u64>() {
                return Ok(available * 1024); // df reports in KB
            }
        }
    }
    Err("Could not parse df output".to_string())
}

#[command]
pub fn adb_connect_wireless(ip: String) -> Result<String, String> {
    let addr = if ip.contains(':') {
        ip.clone()
    } else {
        format!("{ip}:5555")
    };
    run_adb(&["connect", &addr])
}

#[command]
pub fn adb_install(device_id: String, apk_path: String) -> Result<String, String> {
    run_adb_device(&device_id, &["install", "-r", &apk_path])
}

#[command]
pub fn adb_uninstall(device_id: String, package: String) -> Result<String, String> {
    run_adb_device(&device_id, &["uninstall", &package])
}

#[command]
pub fn adb_push(device_id: String, local: String, remote: String) -> Result<String, String> {
    run_adb_device(&device_id, &["push", &local, &remote])
}

#[command]
pub fn adb_pull(device_id: String, remote: String, local: String) -> Result<String, String> {
    run_adb_device(&device_id, &["pull", &remote, &local])
}

#[command]
pub fn adb_shell(device_id: String, cmd: String) -> Result<String, String> {
    run_adb_device(&device_id, &["shell", &cmd])
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InstalledPackage {
    pub package: String,
    pub label: String,
}

#[command]
pub fn adb_list_packages(device_id: String) -> Result<Vec<InstalledPackage>, String> {
    // Try to get human-readable labels (Android 10+ / Quest)
    let labeled = run_adb_device(
        &device_id,
        &["shell", "cmd", "package", "list", "packages", "-3", "--show-labels"],
    );

    if let Ok(output) = labeled {
        let packages: Vec<InstalledPackage> = output
            .lines()
            .filter_map(|line| {
                // Format: "package:com.foo.bar  applicationLabel:My App"
                let line = line.trim();
                let pkg = line
                    .split_whitespace()
                    .next()?
                    .strip_prefix("package:")?
                    .trim()
                    .to_string();
                if pkg.is_empty() { return None; }

                let label = line
                    .split_whitespace()
                    .find(|p| p.starts_with("applicationLabel:"))?
                    .strip_prefix("applicationLabel:")?
                    .trim()
                    .to_string();

                Some(InstalledPackage { package: pkg, label })
            })
            .collect();

        if !packages.is_empty() {
            return Ok(packages);
        }
    }

    // Fallback: plain package list, derive label from package name
    let output = run_adb_device(&device_id, &["shell", "pm", "list", "packages", "-3"])?;
    Ok(output
        .lines()
        .filter_map(|l| l.strip_prefix("package:"))
        .map(|s| s.trim().to_string())
        .filter(|s| !s.is_empty())
        .map(|pkg| {
            let label = label_from_package(&pkg);
            InstalledPackage { package: pkg, label }
        })
        .collect())
}

fn label_from_package(pkg: &str) -> String {
    // Take the last segment of the package name and make it readable
    // e.g. "com.bigscreenvr.bigscreen" → "Bigscreen"
    //      "com.vertigogames.azs2"     → "Azs2"
    let last = pkg.rsplit('.').next().unwrap_or(pkg);
    // Split on camelCase boundaries and underscores
    let mut result = String::new();
    let mut prev_lower = false;
    for (i, ch) in last.chars().enumerate() {
        if ch == '_' || ch == '-' {
            result.push(' ');
            prev_lower = false;
        } else if ch.is_uppercase() && prev_lower {
            result.push(' ');
            result.push(ch);
            prev_lower = false;
        } else {
            if i == 0 { result.push(ch.to_uppercase().next().unwrap_or(ch)); }
            else { result.push(ch); }
            prev_lower = ch.is_lowercase();
        }
    }
    result
}
