# Aether

![GitHub last commit](https://img.shields.io/github/last-commit/aetherslide-afk/Aether)
![GitHub release (latest by date)](https://img.shields.io/github/v/release/aetherslide-afk/Aether)
[![Downloads](https://img.shields.io/github/downloads/aetherslide-afk/Aether/total.svg)](https://github.com/aetherslide-afk/Aether/releases)
![Issues](https://img.shields.io/github/issues/aetherslide-afk/Aether)

**Aether** is a free, open-source, cross-platform sideloading tool for Meta Quest headsets. It provides a clean, modern interface for installing, managing, and updating Android applications on your device — running natively on Windows, macOS, and Linux.

Aether is a legitimate, legal tool built around standard Android Debug Bridge (ADB) functionality. It does not modify, crack, or bypass any software protections. Intended use cases include installing applications not available through official storefronts, personal backups, save management, and contributing new titles back to the community library. Users are solely responsible for ensuring that their use of this tool complies with all applicable laws and the terms of service of their devices.

## Features

- **Game Library** — Browse apps in a visual gallery or sortable list view. Supports search, filters (Installed, Update Available, Favorites), and one-click download and install.
- **Download Manager** — Queue multiple downloads with real-time speed and ETA display, bandwidth throttling, and automatic resume of interrupted transfers.
- **Install Pipeline** — Push APK via ADB with full OBB support. Handles signature mismatches and version downgrades automatically with a backup-uninstall-reinstall flow.
- **Device Manager** — Detect and switch between multiple connected Quest headsets over USB or wireless ADB. View and manage all installed packages with readable app names.
- **Backup & Restore** — Create and restore save data per game before and after reinstalls.
- **Contributions** — Detect apps or newer versions on your device that are not yet in the library and share them back to the community.

## Download

Grab the latest release for your platform from the [Releases](../../releases) page.

| Platform | File |
|----------|------|
| Windows | `Aether_x.x.x_x64-setup.exe` |
| macOS (Apple Silicon) | `Aether_x.x.x_aarch64.dmg` |
| macOS (Intel) | `Aether_x.x.x_x64.dmg` |
| Linux | `Aether_x.x.x_amd64.AppImage` or `.deb` |

## Getting Started

1. Launch Aether.
2. On first run, paste your `public.json` config or enter its URL to connect to a game library.
3. The library loads automatically — browse and search from the main view.
4. Connect your Quest via USB and accept the ADB authorization prompt on the headset.
5. Click a game to download and install it.

## Important Notes

> **Antivirus False Positives** — Some antivirus software may flag Aether due to its use of ADB and archive extraction. The app is fully open source — you can inspect and build the code yourself.

> **Developer Mode** — Your Quest headset must have Developer Mode enabled before ADB can connect. Enable it from the Meta mobile app under your headset's settings.

## Build Instructions

This project is built with [Tauri](https://tauri.app) (Rust + React + TypeScript) and requires [Rust](https://rustup.rs) (stable) and [Node.js](https://nodejs.org) 22+ to build from source. Linux users also need the WebKit development libraries: `sudo apt install libwebkit2gtk-4.1-dev libgtk-3-dev libayatana-appindicator3-dev librsvg2-dev`.

1. Clone this repository.
2. Install frontend dependencies: `npm install`
3. Start the development build: `npm run tauri dev`
4. Or produce a production binary: `npm run tauri build`

### Building with public mirror support

The public mirror requires an API key embedded at build time. Copy `.env.example` to `.env` and fill in your key — Vite injects it into the bundle at compile time. The `.env` file is git-ignored and never committed. Without the key the app builds and runs normally; public mirror downloads will return 403.

## Contributing

We welcome contributions from the community. Please fork the repository, make your changes on a feature branch, and submit a pull request.

## License

Aether is distributed under the **MIT License**. See the [LICENSE](LICENSE) file for full details.
