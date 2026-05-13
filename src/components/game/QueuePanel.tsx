import { X, CheckCircle, AlertCircle, Loader2, XCircle } from "lucide-react";
import { cn, formatSpeed } from "@/lib/utils";
import { useStore } from "@/store";
import { cancelDownload } from "@/hooks/useDownload";
import type { DownloadTask } from "@/types";

export function QueuePanel() {
  const { queue, removeFromQueue } = useStore();
  const done = queue.filter((t) => t.status === "done" || t.status === "error");

  return (
    <div className="w-60 shrink-0 border-l border-[--color-border-subtle] flex flex-col"
         style={{ background: "var(--color-surface)" }}>

      <div className="flex items-center justify-between px-3 h-9 border-b border-[--color-border-subtle] shrink-0">
        <span className="text-[11px] font-semibold text-[--color-text]">
          Queue <span className="text-[--color-text-muted] font-normal">{queue.length}</span>
        </span>
        {done.length > 0 && (
          <button onClick={() => done.forEach((t) => removeFromQueue(t.id))}
            className="text-[10px] text-[--color-text-muted] hover:text-danger transition-colors">
            Clear done
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-[--color-border-subtle]/40">
        {queue.length === 0 ? (
          <p className="text-[11px] text-[--color-text-muted] text-center py-8 opacity-50">
            No downloads queued
          </p>
        ) : (
          queue.map((task) => (
            <QueueItem key={task.id} task={task} onRemove={() => removeFromQueue(task.id)} />
          ))
        )}
      </div>
    </div>
  );
}

function QueueItem({ task, onRemove }: { task: DownloadTask; onRemove: () => void }) {
  const active = task.status === "downloading" || task.status === "installing";

  return (
    <div className="flex items-start gap-2 p-3">
      <StatusIcon status={task.status} />

      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium truncate text-[--color-text]">{task.gameName}</p>

        <div className="flex items-center justify-between mt-0.5">
          <p className={cn("text-[10px]", statusColor(task.status))}>
            {stageLabel(task)}
          </p>
          {active && task.eta != null && task.eta > 0 && (
            <p className="text-[10px] text-[--color-text-muted]">{formatEta(task.eta)}</p>
          )}
        </div>

        {active && (
          <div className="mt-1.5 h-[3px] rounded-full overflow-hidden"
               style={{ background: "var(--color-border)" }}>
            <div className="h-full rounded-full transition-all duration-300"
                 style={{ width: `${task.progress}%`, background: "var(--color-primary)" }} />
          </div>
        )}

        {task.error && (
          <p className="text-[10px] text-danger truncate mt-0.5">{task.error}</p>
        )}
      </div>

      <button
        onClick={active ? () => cancelDownload(task.id) : onRemove}
        title={active ? "Cancel" : "Remove"}
        className={cn(
          "shrink-0 mt-0.5 transition-colors",
          active
            ? "text-[--color-text-muted] hover:text-danger"
            : "text-[--color-text-subtle] hover:text-[--color-text-muted]"
        )}>
        {active ? <XCircle size={12} /> : <X size={11} />}
      </button>
    </div>
  );
}

function StatusIcon({ status }: { status: DownloadTask["status"] }) {
  if (status === "done")
    return <CheckCircle size={13} className="text-success shrink-0 mt-0.5" />;
  if (status === "error")
    return <AlertCircle size={13} className="text-danger shrink-0 mt-0.5" />;
  if (status === "downloading" || status === "installing")
    return <Loader2 size={13} className="text-primary animate-spin shrink-0 mt-0.5" />;
  return (
    <div className="w-3 h-3 rounded-full border border-[--color-border] shrink-0 mt-0.5" />
  );
}

function stageLabel(task: DownloadTask): string {
  if (task.status === "downloading" && task.speed) return formatSpeed(task.speed);
  if (task.status === "installing") {
    const p = Math.round(task.progress);
    if (p < 10) return "Backing up…";
    if (p < 40) return "Uninstalling…";
    if (p < 80) return "Pushing APK…";
    if (p < 90) return "Installing…";
    if (p < 95) return "Pushing OBB…";
    return "Restoring…";
  }
  return ({ queued: "Queued", done: "Done ✓", error: "Failed" } as Record<string, string>)[task.status] ?? task.status;
}

function statusColor(status: DownloadTask["status"]) {
  if (status === "done")     return "text-success";
  if (status === "error")    return "text-danger";
  if (status === "downloading" || status === "installing") return "text-primary";
  return "text-[--color-text-muted]";
}

function formatEta(secs: number) {
  if (secs < 60)   return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h`;
}
