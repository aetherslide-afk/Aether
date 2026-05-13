import { HardDrive, Wifi, Usb } from "lucide-react";
import { useStore } from "@/store";
import { formatBytes, formatSpeed } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function StatusBar() {
  const { selectedDevice, queue } = useStore();
  const activeTask = queue.find(
    (t) => t.status === "downloading" || t.status === "installing"
  );

  return (
    <div className="flex items-center justify-between h-6 px-4 shrink-0
                    bg-[--color-surface] border-t border-[--color-border-subtle]
                    text-[11px] text-[--color-text-muted]">
      <div className="flex items-center gap-4">
        {selectedDevice ? (
          <span className={cn("flex items-center gap-1.5 text-[--color-success]")}>
            {selectedDevice.type === "wifi"
              ? <Wifi size={11} />
              : <Usb size={11} />}
            {selectedDevice.model || selectedDevice.id}
          </span>
        ) : (
          <span className="flex items-center gap-1.5 opacity-40">
            <span className="w-1.5 h-1.5 rounded-full bg-current" />
            No device
          </span>
        )}

        {selectedDevice?.freeSpace !== undefined && (
          <span className="flex items-center gap-1 opacity-60">
            <HardDrive size={10} />
            {formatBytes(selectedDevice.freeSpace)} free
          </span>
        )}
      </div>

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
  );
}
