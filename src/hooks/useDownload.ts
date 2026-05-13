import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { appDataDir, join } from "@tauri-apps/api/path";
import { useEffect } from "react";
import { useStore } from "@/store";
import { installGame } from "@/hooks/useInstall";
import type { DownloadTask } from "@/types";

interface DownloadProgress {
  gameId: string;
  stage: "downloading" | "done" | "error" | "cancelled";
  progress: number;
  speed: number;
  etaSecs: number;
  downloaded: number;
  total: number;
  error?: string;
}

export function useDownloadListener() {
  const { updateTask } = useStore();

  useEffect(() => {
    const unlisten = listen<DownloadProgress>("download://progress", (e) => {
      const p = e.payload;
      updateTask(p.gameId, {
        status:
          p.stage === "done" ? "done"
          : p.stage === "error" ? "error"
          : p.stage === "cancelled" ? "error"
          : "downloading",
        progress: p.progress,
        speed: p.speed,
        eta: p.etaSecs,
        error: p.error,
      });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [updateTask]);
}

export async function downloadGame(
  gameId: string,
  gameName: string,
  packageName: string,
  apkUrl: string,
  deviceId?: string,
  bandwidthLimit?: number,
): Promise<void> {
  const dataDir = await appDataDir();
  const destDir = await join(dataDir, "downloads", gameId);

  await invoke("start_download", {
    req: {
      gameId,
      gameName,
      apkUrl,
      destDir,
      bandwidthLimit: bandwidthLimit ?? null,
    },
  });

  // Chain install if a device is selected
  if (deviceId) {
    const apkPath = await join(destDir, apkUrl.split("/").pop()!);
    await installGame({
      gameId,
      deviceId,
      apkPath,
      packageName,
      gameName,
      autoReinstall: true,
    });
  }
}

export async function cancelDownload(gameId: string): Promise<void> {
  await invoke("cancel_download", { gameId });
}

export function buildApkUrl(baseUri: string, apkPath: string): string {
  const base = baseUri.replace(/\/$/, "");
  const path = apkPath.replace(/^\//, "");
  return `${base}/${encodeURIComponent(path).replace(/%2F/g, "/")}`;
}
