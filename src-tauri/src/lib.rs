mod commands;

use commands::adb::*;
use commands::contribute::*;
use commands::download::*;
use commands::install::*;
use commands::metadata::*;
use commands::settings::*;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            // ADB
            adb_list_devices,
            adb_connect_wireless,
            adb_install,
            adb_uninstall,
            adb_push,
            adb_pull,
            adb_shell,
            adb_list_packages,
            // Contributions
            detect_contributions,
            upload_contribution,
            check_upload_ready,
            // Downloads
            start_download,
            cancel_download,
            // Install
            install_game,
            backup_save_data,
            restore_save_data,
            // Metadata
            load_public_config,
            download_metadata,
            extract_metadata,
            parse_game_list,
            // Settings
            load_settings,
            save_settings,
            pick_folder,
            get_data_dir,
            fetch_public_config,
            save_public_config,
            file_exists,
            delete_file,
            delete_dir,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
