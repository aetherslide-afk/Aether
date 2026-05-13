import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { Upload, RefreshCw, CheckCircle, AlertCircle, Loader2, Sparkles } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

interface Contribution {
  package: string; name: string;
  versionCode: number; releaseName: string;
  kind: "new" | "update";
}
interface UploadProgress { package: string; stage: string; message: string; error?: string; }
type UploadState = Record<string, { stage: string; message: string; error?: string }>;

export function ContributePage() {
  const { games, selectedDevice } = useStore();
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [scanning, setScanning]       = useState(false);
  const [uploadStates, setUploadStates] = useState<UploadState>({});
  const [uploadReady, setUploadReady] = useState(false);
  const [dataDir, setDataDir]         = useState("");

  useEffect(() => {
    invoke<string>("get_data_dir").then(setDataDir);
    const ul = listen<UploadProgress>("contribute://progress", (e) => {
      const p = e.payload;
      setUploadStates((prev) => ({ ...prev, [p.package]: { stage: p.stage, message: p.message, error: p.error } }));
    });
    return () => { ul.then((fn) => fn()); };
  }, []);

  useEffect(() => {
    if (!dataDir) return;
    invoke<boolean>("check_upload_ready", { uploadConfigPath: `${dataDir}/upload.config` }).then(setUploadReady);
  }, [dataDir]);

  async function scan() {
    if (!selectedDevice || games.length === 0) return;
    setScanning(true);
    try {
      const library = games.map((g) => ({ package: g.packageName, versionCode: g.versionCode, name: g.name }));
      const found = await invoke<Contribution[]>("detect_contributions", { deviceId: selectedDevice.id, library });
      setContributions(found);
    } catch {}
    finally { setScanning(false); }
  }

  async function upload(c: Contribution) {
    if (!selectedDevice || !dataDir) return;
    try {
      await invoke("upload_contribution", {
        deviceId: selectedDevice.id, package: c.package,
        releaseName: c.releaseName, versionCode: c.versionCode,
        deviceModel: selectedDevice.model || selectedDevice.id,
        uploadConfigPath: `${dataDir}/upload.config`, dataDir,
      });
    } catch {}
  }

  const newApps = contributions.filter((c) => c.kind === "new");
  const updates  = contributions.filter((c) => c.kind === "update");

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-6 space-y-5">

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[15px] font-semibold">Contribute</h1>
            <p className="text-[12px] text-[--color-text-muted] mt-0.5">
              Share apps and updates from your device back to the library
            </p>
          </div>
          <button onClick={scan} disabled={scanning || !selectedDevice || games.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-lg shrink-0
                       bg-primary text-white disabled:opacity-40 transition-all
                       hover:opacity-90 active:scale-95">
            <RefreshCw size={12} className={cn(scanning && "animate-spin")} />
            Scan Device
          </button>
        </div>

        {/* Notices */}
        {!selectedDevice && <Notice kind="warn" message="Connect a Quest device first." />}
        {selectedDevice && games.length === 0 && <Notice kind="warn" message="Load the game library first." />}
        {!uploadReady && contributions.length > 0 && (
          <Notice kind="info" message="rclone + upload.config required. Load library from a public mirror first." />
        )}

        {/* Empty */}
        {contributions.length === 0 && !scanning && selectedDevice && games.length > 0 && (
          <div className="flex flex-col items-center justify-center gap-3 py-20 text-[--color-text-muted]">
            <Sparkles size={24} className="opacity-20" />
            <p className="text-[12px]">Click Scan Device to check for contributions</p>
          </div>
        )}

        {/* Results */}
        {updates.length > 0 && (
          <Group title="Updates" count={updates.length}
                 description="Your installed version is newer than the library">
            {updates.map((c) => (
              <Row key={c.package} c={c} state={uploadStates[c.package]}
                   onUpload={() => upload(c)} ready={uploadReady} />
            ))}
          </Group>
        )}

        {newApps.length > 0 && (
          <Group title="New Apps" count={newApps.length}
                 description="Apps on your device not yet in the library">
            {newApps.map((c) => (
              <Row key={c.package} c={c} state={uploadStates[c.package]}
                   onUpload={() => upload(c)} ready={uploadReady} />
            ))}
          </Group>
        )}
      </div>
    </div>
  );
}

function Group({ title, count, description, children }: {
  title: string; count: number; description: string; children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-[--color-border-subtle] overflow-hidden"
         style={{ background: "var(--color-surface)" }}>
      <div className="px-4 py-3 border-b border-[--color-border-subtle]">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-[--color-text]">{title}</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium
                           bg-primary-dim text-primary">{count}</span>
        </div>
        <p className="text-[11px] text-[--color-text-muted] mt-0.5">{description}</p>
      </div>
      <div className="divide-y divide-[--color-border-subtle]/50">{children}</div>
    </div>
  );
}

function Row({ c, state, onUpload, ready }: {
  c: Contribution;
  state?: { stage: string; message: string; error?: string };
  onUpload: () => void; ready: boolean;
}) {
  const busy   = state && state.stage !== "done" && state.stage !== "error";
  const done   = state?.stage === "done";
  const failed = state?.stage === "error";

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-[--color-surface-elevated] transition-colors">
      <span className={cn(
        "text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0",
        c.kind === "new" ? "bg-success-dim text-success" : "bg-warning-dim text-warning"
      )}>
        {c.kind === "new" ? "NEW" : "UPD"}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-[12px] font-medium text-[--color-text] truncate">{c.name}</p>
        <p className="text-[10px] text-[--color-text-muted] font-mono truncate">{c.package}</p>
        {state && !failed && <p className="text-[10px] text-primary mt-0.5">{state.message}</p>}
        {failed && <p className="text-[10px] text-danger mt-0.5">{state?.error}</p>}
      </div>

      <span className="text-[10px] text-[--color-text-muted] shrink-0 font-mono">v{c.versionCode}</span>

      {done ? (
        <CheckCircle size={15} className="text-success shrink-0" />
      ) : failed ? (
        <AlertCircle size={15} className="text-danger shrink-0" />
      ) : (
        <button onClick={onUpload} disabled={!!busy || !ready}
          className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] rounded-lg shrink-0
                     border border-[--color-border-subtle] bg-[--color-surface-elevated]
                     text-[--color-text-muted] hover:text-[--color-text] hover:border-[--color-border]
                     disabled:opacity-40 transition-all">
          {busy ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          {busy ? state?.stage : "Upload"}
        </button>
      )}
    </div>
  );
}

function Notice({ kind, message }: { kind: "warn" | "info"; message: string }) {
  return (
    <div className={cn(
      "flex items-start gap-2 text-[11px] p-3 rounded-lg border",
      kind === "warn"
        ? "bg-warning-dim border-warning text-warning"
        : "bg-primary-dim border-primary text-primary"
    )}>
      <AlertCircle size={13} className="shrink-0 mt-0.5" />
      {message}
    </div>
  );
}
