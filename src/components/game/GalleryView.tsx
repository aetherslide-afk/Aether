import { Star, Download, Trash2, Loader2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";
import { downloadGame, buildApkUrl } from "@/hooks/useDownload";
import type { Game } from "@/types";

interface Props { games: Game[] }

export function GalleryView({ games }: Props) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(148px,1fr))] gap-2 p-4">
      {games.map((game) => <GameTile key={game.id} game={game} />)}
    </div>
  );
}

function GameTile({ game }: { game: Game }) {
  const { toggleFavorite, addToQueue, activeMirror, queue, settings } = useStore();
  const isQueued = queue.some((t) => t.id === game.id);
  const task = queue.find((t) => t.id === game.id);

  function handleDownload() {
    if (isQueued || !activeMirror?.url) return;
    const url = buildApkUrl(activeMirror.url, game.apkPath);
    addToQueue({ id: game.id, gameId: game.id, gameName: game.name, status: "queued", progress: 0 });
    downloadGame(game.id, game.name, game.packageName, url,
      useStore.getState().selectedDevice?.id,
      settings.bandwidthLimit || undefined);
  }

  const isInstalled = game.installedVersion !== undefined;
  const isDownloading = task?.status === "downloading";
  const isInstalling = task?.status === "installing";

  return (
    <div className="group relative flex flex-col rounded-xl overflow-hidden
                    bg-[--color-surface] border border-[--color-border-subtle]
                    hover:border-[--color-border] hover:bg-[--color-surface-elevated]
                    transition-all duration-200 cursor-pointer">

      {/* Thumbnail */}
      <div className="relative aspect-square overflow-hidden bg-[--color-surface-elevated]">
        {game.thumbnailPath ? (
          <img
            src={game.thumbnailPath}
            alt={game.name}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-3xl font-bold text-[--color-text-subtle]/40 select-none">
              {game.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Gradient overlay — always visible at bottom */}
        <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />

        {/* Top badges */}
        <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
          {game.hasUpdate && (
            <span className="flex items-center gap-0.5 bg-[--color-warning] text-black
                             text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-none">
              <RefreshCw size={8} /> UPD
            </span>
          )}
        </div>

        {/* Hover action overlay */}
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]
                        opacity-0 group-hover:opacity-100 transition-opacity duration-200
                        flex items-center justify-center gap-2">
          <ActionBtn
            title={isQueued ? "In queue…" : "Download & Install"}
            onClick={handleDownload}
            disabled={isQueued || !activeMirror?.url}
          >
            {isDownloading || isInstalling
              ? <Loader2 size={15} className="animate-spin" />
              : <Download size={15} />}
          </ActionBtn>
          <ActionBtn title="Uninstall" onClick={() => {}} danger>
            <Trash2 size={15} />
          </ActionBtn>
        </div>

        {/* Download progress bar */}
        {(isDownloading || isInstalling) && task && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-black/40">
            <div
              className="h-full bg-[--color-primary] transition-all duration-300"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        )}
      </div>

      {/* Info row */}
      <div className="flex items-start justify-between gap-1 px-2.5 py-2">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium truncate leading-snug text-[--color-text]">
            {game.name}
          </p>
          <p className="text-[10px] text-[--color-text-muted] truncate leading-snug">
            v{game.versionName}
          </p>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); toggleFavorite(game.id); }}
          className={cn(
            "shrink-0 mt-0.5 transition-colors duration-150",
            game.isFavorite
              ? "text-yellow-400"
              : "text-[--color-text-subtle] hover:text-yellow-400 opacity-0 group-hover:opacity-100"
          )}
        >
          <Star size={11} fill={game.isFavorite ? "currentColor" : "none"} strokeWidth={2} />
        </button>
      </div>

      {/* Installed indicator strip */}
      {isInstalled && (
        <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-[--color-success]/60" />
      )}
    </div>
  );
}

function ActionBtn({ title, onClick, danger, disabled, children }: {
  title: string; onClick: () => void;
  danger?: boolean; disabled?: boolean; children: React.ReactNode;
}) {
  return (
    <button
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center w-8 h-8 rounded-lg text-white transition-all duration-150",
        "border backdrop-blur-sm disabled:opacity-50",
        danger
          ? "bg-[--color-danger]/20 border-[--color-danger]/30 hover:bg-[--color-danger]/40"
          : "bg-[--color-primary]/20 border-[--color-primary]/30 hover:bg-[--color-primary]/40"
      )}
    >
      {children}
    </button>
  );
}
