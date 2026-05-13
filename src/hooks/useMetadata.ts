import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { useState, useCallback } from "react";
import { useStore } from "@/store";
import { PUBLIC_MIRROR_API_KEY } from "@/lib/config";
import type { Game } from "@/types";

interface MetadataProgress {
  stage: "downloading" | "extracting" | "parsing";
  progress: number;
  message: string;
}

interface PublicConfig {
  baseUri: string;
  password: string;
}

interface RawGame {
  id: string;
  name: string;
  packageName: string;
  releaseName: string;
  versionCode: number;
  versionName: string;
  apkPath: string;
  size: number;
  downloads: number;
  thumbnailPath?: string;
  notes?: string;
  isFavorite: boolean;
  installedVersion?: number;
  isDownloaded: boolean;
  hasUpdate: boolean;
}

export function useMetadata() {
  const { setGames, setActiveMirror } = useStore();
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<MetadataProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // All paths relative to get_data_dir() — consistent between frontend and Rust
  async function getPaths() {
    const dataDir = await invoke<string>("get_data_dir");
    return {
      dataDir,
      configPath: `${dataDir}/public.json`,
      archivePath: `${dataDir}/meta.7z`,
      metaDir: `${dataDir}/meta`,
      thumbsDir: `${dataDir}/meta/thumbnails`,
      notesDir: `${dataDir}/meta/notes`,
    };
  }

  const loadFromPublicConfig = useCallback(async (configPath: string) => {
    setLoading(true);
    setError(null);

    const unlisten = await listen<MetadataProgress>("metadata://progress", (e) => {
      setProgress(e.payload);
    });

    try {
      const paths = await getPaths();
      const config = await invoke<PublicConfig>("load_public_config", { path: configPath });

      // Save mirror in store so downloads can use the baseUri
      setActiveMirror({ name: "public", type: "http", url: config.baseUri });

      // Smart cache: skip download+extract if game list already exists
      const gameListExists = await invoke<boolean>("file_exists", {
        path: `${paths.metaDir}/GameList.txt`,
      }).catch(() => false);

      const archiveExists = await invoke<boolean>("file_exists", {
        path: paths.archivePath,
      }).catch(() => false);

      if (!gameListExists) {
        // Need to download and extract
        if (!archiveExists) {
          await invoke("download_metadata", {
            baseUri: config.baseUri,
            destDir: paths.dataDir,
            apiKey: PUBLIC_MIRROR_API_KEY || null,
          });
        }
        await invoke("extract_metadata", {
          archivePath: paths.archivePath,
          destDir: paths.metaDir,
          password: config.password,
        });
      } else {
        setProgress({ stage: "parsing", progress: 0, message: "Loading cached library…" });
      }

      const rawGames = await invoke<RawGame[]>("parse_game_list", {
        metaDir: paths.metaDir,
        thumbnailsDir: paths.thumbsDir,
        notesDir: paths.notesDir,
      });

      setGames(rawGames.map(toGame));
    } catch (e) {
      setError(String(e));
      throw e;
    } finally {
      unlisten();
      setLoading(false);
      setProgress(null);
    }
  }, [setGames, setActiveMirror]);

  // Load from already-extracted metadata cache (offline / no network)
  const loadFromLocalMeta = useCallback(async () => {
    setLoading(true);
    setError(null);

    const unlisten = await listen<MetadataProgress>("metadata://progress", (e) => {
      setProgress(e.payload);
    });

    try {
      const paths = await getPaths();
      const rawGames = await invoke<RawGame[]>("parse_game_list", {
        metaDir: paths.metaDir,
        thumbnailsDir: paths.thumbsDir,
        notesDir: paths.notesDir,
      });
      setGames(rawGames.map(toGame));
    } catch (e) {
      setError(String(e));
    } finally {
      unlisten();
      setLoading(false);
      setProgress(null);
    }
  }, [setGames]);

  // Force re-download even if cached
  const refreshMetadata = useCallback(async () => {
    const paths = await getPaths();
    // Delete cache so loadFromPublicConfig downloads fresh
    await invoke("delete_file", { path: paths.archivePath }).catch(() => {});
    await invoke("delete_dir", { path: paths.metaDir }).catch(() => {});
    await loadFromPublicConfig(paths.configPath);
  }, [loadFromPublicConfig]);

  return { loading, progress, error, loadFromPublicConfig, loadFromLocalMeta, refreshMetadata };
}

function toGame(r: RawGame): Game {
  return {
    id: r.id,
    name: r.name,
    packageName: r.packageName,
    releaseName: r.releaseName,
    versionCode: r.versionCode,
    versionName: r.versionName,
    apkPath: r.apkPath,
    size: r.size,
    downloads: r.downloads,
    thumbnailPath: r.thumbnailPath,
    notes: r.notes,
    isFavorite: r.isFavorite,
    installedVersion: r.installedVersion,
    isDownloaded: r.isDownloaded,
    hasUpdate: r.hasUpdate,
  };
}
