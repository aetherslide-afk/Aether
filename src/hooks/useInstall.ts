import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useEffect } from "react";
import { useStore } from "@/store";

interface InstallProgress {
  gameId: string;
  stage: "pushing" | "installing" | "obb" | "done" | "error" | "reinstalling" | "backing_up" | "restoring";
  progress: number;
  message: string;
  error?: string;
}

export function useInstallListener() {
  const { updateTask } = useStore();

  useEffect(() => {
    const unlisten = listen<InstallProgress>("install://progress", (e) => {
      const p = e.payload;
      updateTask(p.gameId, {
        status: p.stage === "done" ? "done"
          : p.stage === "error" ? "error"
          : "installing",
        progress: p.progress,
        error: p.error,
      });
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [updateTask]);
}

export interface InstallRequest {
  gameId: string;
  deviceId: string;
  apkPath: string;
  packageName: string;
  gameName: string;
  obbDir?: string;
  autoReinstall?: boolean;
}

export async function installGame(req: InstallRequest): Promise<void> {
  await invoke("install_game", {
    gameId: req.gameId,
    deviceId: req.deviceId,
    apkPath: req.apkPath,
    packageName: req.packageName,
    gameName: req.gameName,
    obbDir: req.obbDir ?? null,
    autoReinstall: req.autoReinstall ?? true,
  });
}

export async function backupSaveData(deviceId: string, packageName: string, backupDir: string) {
  await invoke("backup_save_data", { deviceId, packageName, backupDir });
}

export async function restoreSaveData(deviceId: string, packageName: string, backupDir: string) {
  await invoke("restore_save_data", { deviceId, packageName, backupDir });
}
