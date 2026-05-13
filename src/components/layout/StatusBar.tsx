import { HardDrive, Wifi, Usb, AlertTriangle, CheckCircle, Circle } from "lucide-react";
import { useStore } from "@/store";
import { formatBytes, formatSpeed } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { HealthPanel } from "@/components/HealthPanel";

export function StatusBar() {
  const { selectedDevice, queue, adbStatus, devices, games } = useStore();
  const [showHealth, setShowHealth] = useState(false);

  const activeTask = queue.find(
    (t) => t.status === "downloading" || t.status === "installing"
  );

  const hasUnauthorized = devices.some((d) => d.type === "unauthorized");
  const hasDevice       = devices.some((d) => d.type !== "unauthorized");
  const libraryOk       = games.length > 0;

  const checks = [
    {
      label: "ADB",
      ok: adbStatus === "ok",
      error: adbStatus === "error",
    },
    {
      label: hasUnauthorized ? "Unauthorized" : "Device",
      ok: hasDevice && !hasUnauthorized,
      error: hasUnauthorized || (adbStatus === "ok" && !hasDevice),
    },
    {
      label: "Library",
      ok: libraryOk,
      error: adbStatus === "ok" && !libraryOk,
    },
  ];

  return (
    <>
      <div className="flex items-center justify-between h-6 px-4 shrink-0 text-[11px]"
           style={{ background: "var(--color-surface)", borderTop: "1px solid var(--color-border)", color: "var(--color-text-muted)" }}>
        <div className="flex items-center gap-3">
          {checks.map((c) => (
            <button key={c.label} onClick={() => setShowHealth(true)}
              className={cn(
                "flex items-center gap-1 transition-opacity hover:opacity-80",
                c.ok ? "text-success" : c.error ? "text-warning" : "text-[--color-text-muted] opacity-40"
              )}>
              {c.ok
                ? <CheckCircle size={10} />
                : c.error
                  ? <AlertTriangle size={10} />
                  : <Circle size={10} />}
              <span className="text-[10px]">{c.label}</span>
            </button>
          ))}

          {/* Device */}
          {selectedDevice && (
            <span className="flex items-center gap-1.5 text-[--color-success]">
              {selectedDevice.type === "wifi"
                ? <Wifi size={11} />
                : <Usb size={11} />}
              {selectedDevice.model || selectedDevice.id}
            </span>
          )}

          {/* Storage */}
          {selectedDevice?.freeSpace !== undefined && (
            <span className="flex items-center gap-1 opacity-60">
              <HardDrive size={10} />
              {formatBytes(selectedDevice.freeSpace)} free
            </span>
          )}
        </div>

        {/* Active download */}
        {activeTask && (
          <span className="flex items-center gap-2">
            <span className="opacity-60">{activeTask.gameName}</span>
            <span className="text-[--color-primary] font-medium">
              {Math.round(activeTask.progress)}%
            </span>
            {activeTask.speed != null && activeTask.speed > 0 && (
              <span className="opacity-60">{formatSpeed(activeTask.speed)}</span>
            )}
          </span>
        )}
      </div>

      {showHealth && <HealthPanel onClose={() => setShowHealth(false)} />}
    </>
  );
}
