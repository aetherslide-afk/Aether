export interface Game {
  id: string;
  name: string;
  packageName: string;
  versionCode: number;
  versionName: string;
  size: number;
  releaseName: string;
  apkPath: string;
  thumbnailPath?: string;
  notes?: string;
  isFavorite: boolean;
  installedVersion?: number;
  isDownloaded: boolean;
  hasUpdate: boolean;
  downloads?: number;
}

export interface Device {
  id: string;
  name: string;
  model: string;
  type: "usb" | "wifi" | "unauthorized";
  freeSpace?: number;
  totalSpace?: number;
}

export interface DownloadTask {
  id: string;
  gameId: string;
  gameName: string;
  status: "queued" | "downloading" | "installing" | "done" | "error";
  progress: number;
  speed?: number;
  eta?: number;
  error?: string;
}

export interface AppSettings {
  downloadPath: string;
  deleteAfterInstall: boolean;
  autoReinstallOnFailure: boolean;
  checkForUpdates: boolean;
  showAdultContent: boolean;
  trailersEnabled: boolean;
  bandwidthLimit: number;
  proxyEnabled: boolean;
  proxyAddress: string;
  proxyPort: number;
  singleThreadMode: boolean;
  useDownloadedFiles: boolean;
}

export interface Mirror {
  name: string;
  type: "http" | "rclone";
  url?: string;
  remoteName?: string;
}

export type ViewMode = "gallery" | "list";
export type SortBy = "name" | "updated" | "size" | "downloads";
export type FilterBy = "all" | "installed" | "downloaded" | "updates" | "favorites";
