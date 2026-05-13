import { Star, Download, Trash2, RefreshCw } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";
import { useStore } from "@/store";
import type { Game } from "@/types";

export function ListView({ games }: { games: Game[] }) {
  return (
    <div className="flex flex-col">
      {/* Sticky header */}
      <div className="grid grid-cols-[32px_1fr_160px_80px_72px_72px] gap-0
                      sticky top-0 z-10 px-2
                      border-b border-[--color-border-subtle]"
           style={{ background: "var(--color-surface)" }}>
        {["", "Name", "Package", "Version", "Size", ""].map((h, i) => (
          <div key={i} className={cn(
            "py-2 px-2 text-[10px] font-semibold uppercase tracking-wider text-[--color-text-muted]",
            i >= 4 && "text-right"
          )}>{h}</div>
        ))}
      </div>

      {/* Rows */}
      {games.map((game) => <GameRow key={game.id} game={game} />)}
    </div>
  );
}

function GameRow({ game }: { game: Game }) {
  const { toggleFavorite } = useStore();
  const installed = game.installedVersion !== undefined;

  return (
    <div className={cn(
      "group grid grid-cols-[32px_1fr_160px_80px_72px_72px] gap-0 px-2",
      "border-b border-[--color-border-subtle]/40 transition-colors cursor-pointer",
      "hover:bg-[--color-surface-elevated]",
      installed && "border-l-2 border-l-[--color-success]"
    )}>
      {/* Favorite */}
      <div className="flex items-center justify-center py-2.5">
        <button onClick={() => toggleFavorite(game.id)}
          className={cn(
            "transition-all duration-150",
            game.isFavorite ? "text-yellow-400 opacity-100" : "text-[--color-text-subtle] opacity-0 group-hover:opacity-100"
          )}>
          <Star size={12} fill={game.isFavorite ? "currentColor" : "none"} strokeWidth={2} />
        </button>
      </div>

      {/* Name */}
      <div className="flex items-center gap-2 py-2.5 px-2 min-w-0">
        <span className="text-[12px] font-medium text-[--color-text] truncate">{game.name}</span>
        {game.hasUpdate && (
          <span className="flex items-center gap-0.5 shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-md
                           bg-warning-dim text-warning">
            <RefreshCw size={8} /> UPD
          </span>
        )}
      </div>

      {/* Package */}
      <div className="flex items-center py-2.5 px-2 min-w-0">
        <span className="text-[10px] text-[--color-text-muted] font-mono truncate">{game.packageName}</span>
      </div>

      {/* Version */}
      <div className="flex items-center py-2.5 px-2">
        <span className={cn(
          "text-[11px]",
          installed ? "text-success font-medium" : "text-[--color-text-muted]"
        )}>
          v{game.versionName}
        </span>
      </div>

      {/* Size */}
      <div className="flex items-center justify-end py-2.5 px-2">
        <span className="text-[11px] text-[--color-text-muted]">
          {game.size > 0 ? formatBytes(game.size) : "—"}
        </span>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5 py-2.5 px-1
                      opacity-0 group-hover:opacity-100 transition-opacity">
        <button title="Download & Install"
          className="p-1.5 rounded-md hover:bg-primary-dim text-[--color-text-muted] hover:text-primary transition-all">
          <Download size={13} />
        </button>
        <button title="Uninstall"
          className="p-1.5 rounded-md hover:bg-danger-dim text-[--color-text-muted] hover:text-danger transition-all">
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  );
}
