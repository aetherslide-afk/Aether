import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Loader2 } from "lucide-react";
import { TitleBar } from "@/components/layout/TitleBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { StatusBar } from "@/components/layout/StatusBar";
import { StartupDialog } from "@/components/StartupDialog";
import { LibraryPage } from "@/pages/LibraryPage";
import { DevicePage } from "@/pages/DevicePage";
import { ContributePage } from "@/pages/ContributePage";
import { SettingsPage } from "@/pages/SettingsPage";
import { useStore } from "@/store";
import { useMetadata } from "@/hooks/useMetadata";
import { useDownloadListener } from "@/hooks/useDownload";
import { useInstallListener } from "@/hooks/useInstall";

export default function App() {
  const { activeTab, games } = useStore();
  const { loading: metaLoading, progress, loadFromPublicConfig, loadFromLocalMeta } = useMetadata();
  const [ready, setReady] = useState(false);
  const [setupDone, setSetupDone] = useState(false);

  useDownloadListener();
  useInstallListener();

  useEffect(() => {
    async function init() {
      try {
        const dataDir = await invoke<string>("get_data_dir");
        const configPath = `${dataDir}/public.json`;
        const configExists = await invoke<boolean>("file_exists", { path: configPath }).catch(() => false);

        if (configExists) {
          await loadFromPublicConfig(configPath).catch(() => loadFromLocalMeta());
        }
      } catch {
        // No config — show startup dialog
      } finally {
        setReady(true);
      }
    }
    init();
  }, []);

  const needsSetup = ready && !setupDone && games.length === 0 && !metaLoading;

  // Full-screen loading while auto-loading on startup
  if (!ready || (metaLoading && games.length === 0)) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-[--color-background]">
        <TitleBar />
        <div className="flex flex-1 items-center justify-center flex-col gap-3">
          <Loader2 size={28} className="animate-spin text-[--color-primary]" />
          <p className="text-sm text-[--color-text-muted]">
            {progress?.message ?? "Starting…"}
          </p>
          {progress && (
            <div className="w-48 h-1 bg-[--color-border] rounded-full overflow-hidden">
              <div
                className="h-full bg-[--color-primary] transition-all duration-300"
                style={{ width: `${progress.progress}%` }}
              />
            </div>
          )}
        </div>
        <StatusBar />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[--color-background]">
      <TitleBar />
      <div className="flex flex-1 min-h-0">
        {!needsSetup && <Sidebar />}
        <main className="flex-1 min-w-0 overflow-hidden">
          {needsSetup ? (
            <StartupDialog onDone={() => setSetupDone(true)} />
          ) : (
            <>
              {activeTab === "library" && <LibraryPage />}
              {activeTab === "device" && <DevicePage />}
              {activeTab === "contribute" && <ContributePage />}
              {activeTab === "settings" && <SettingsPage />}
            </>
          )}
        </main>
      </div>
      <StatusBar />
    </div>
  );
}
