import { Search, LayoutGrid, List, Download, RefreshCw, ChevronDown } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";
import { useState, useRef, useEffect } from "react";
import type { FilterBy, SortBy } from "@/types";
import { GalleryView } from "@/components/game/GalleryView";
import { ListView } from "@/components/game/ListView";
import { QueuePanel } from "@/components/game/QueuePanel";
import { useMetadata } from "@/hooks/useMetadata";

const filters: { id: FilterBy; label: string }[] = [
  { id: "all",        label: "All"        },
  { id: "installed",  label: "Installed"  },
  { id: "downloaded", label: "Downloaded" },
  { id: "updates",    label: "Updates"    },
  { id: "favorites",  label: "Favorites"  },
];

const sorts: { id: SortBy; label: string }[] = [
  { id: "name",      label: "Name"      },
  { id: "updated",   label: "Updated"   },
  { id: "size",      label: "Size"      },
  { id: "downloads", label: "Downloads" },
];

export function LibraryPage() {
  const {
    games, viewMode, setViewMode, sortBy, setSortBy,
    filterBy, setFilterBy, searchQuery, setSearchQuery, queue,
  } = useStore();
  const { loading, refreshMetadata } = useMetadata();

  const filtered = games
    .filter((g) => {
      if (searchQuery && !g.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterBy === "installed")  return g.installedVersion !== undefined;
      if (filterBy === "downloaded") return g.isDownloaded;
      if (filterBy === "updates")    return g.hasUpdate;
      if (filterBy === "favorites")  return g.isFavorite;
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "name")      return a.name.localeCompare(b.name);
      if (sortBy === "size")      return b.size - a.size;
      if (sortBy === "downloads") return (b.downloads ?? 0) - (a.downloads ?? 0);
      return 0;
    });

  return (
    <div className="flex flex-col h-full">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 h-11 border-b border-[--color-border-subtle] shrink-0">
        {/* Search */}
        <div className="relative w-52">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[--color-text-muted] pointer-events-none" />
          <input
            type="text"
            placeholder="Search…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-[12px] rounded-lg
                       bg-[--color-surface-elevated] border border-[--color-border-subtle]
                       text-[--color-text] placeholder:text-[--color-text-muted]
                       focus:outline-none focus:border-[--color-primary]/50 transition-colors"
          />
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-0.5">
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilterBy(f.id)}
              className={cn(
                "px-2.5 py-1 rounded-md text-[11px] font-medium transition-all duration-150",
                filterBy === f.id
                  ? "bg-[--color-primary-dim] text-[--color-primary]"
                  : "text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-hover]"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-1 ml-auto">
          <SortDropdown value={sortBy} onChange={setSortBy} />

          <div className="w-px h-4 bg-[--color-border-subtle] mx-1" />

          <button
            onClick={() => refreshMetadata()}
            disabled={loading}
            title="Refresh library"
            className="p-1.5 rounded-md text-[--color-text-muted] hover:text-[--color-text]
                       hover:bg-[--color-surface-hover] disabled:opacity-40 transition-all"
          >
            <RefreshCw size={13} className={cn(loading && "animate-spin")} />
          </button>

          <div className="flex items-center rounded-md overflow-hidden border border-[--color-border-subtle]">
            <button
              onClick={() => setViewMode("gallery")}
              className={cn(
                "flex items-center justify-center w-7 h-7 transition-colors",
                viewMode === "gallery"
                  ? "bg-[--color-surface-elevated] text-[--color-text]"
                  : "text-[--color-text-muted] hover:bg-[--color-surface-hover]"
              )}
            >
              <LayoutGrid size={13} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className={cn(
                "flex items-center justify-center w-7 h-7 transition-colors",
                viewMode === "list"
                  ? "bg-[--color-surface-elevated] text-[--color-text]"
                  : "text-[--color-text-muted] hover:bg-[--color-surface-hover]"
              )}
            >
              <List size={13} />
            </button>
          </div>
        </div>
      </div>

      {/* Count */}
      <div className="px-4 py-1 text-[10px] text-[--color-text-muted] shrink-0 border-b border-[--color-border-subtle]/50">
        {filtered.length.toLocaleString()} {filtered.length === 1 ? "game" : "games"}
        {searchQuery && <span className="opacity-60"> · "{searchQuery}"</span>}
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 overflow-y-auto">
          {games.length === 0 ? <EmptyState /> :
           viewMode === "gallery" ? <GalleryView games={filtered} /> :
           <ListView games={filtered} />}
        </div>
        {queue.length > 0 && <QueuePanel />}
      </div>
    </div>
  );
}

function SortDropdown({ value, onChange }: { value: SortBy; onChange: (v: SortBy) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = sorts.find((s) => s.id === value);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px]
                   text-[--color-text-muted] hover:text-[--color-text]
                   hover:bg-[--color-surface-hover] transition-all"
      >
        {current?.label}
        <ChevronDown size={10} className={cn("transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 min-w-[110px]
                        bg-[--color-surface-elevated] border border-[--color-border]
                        rounded-lg shadow-xl overflow-hidden">
          {sorts.map((s) => (
            <button
              key={s.id}
              onClick={() => { onChange(s.id); setOpen(false); }}
              className={cn(
                "w-full text-left px-3 py-2 text-[11px] transition-colors",
                s.id === value
                  ? "text-[--color-primary] bg-[--color-primary-dim]"
                  : "text-[--color-text-muted] hover:text-[--color-text] hover:bg-[--color-surface-hover]"
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3">
      <Download size={32} className="text-[--color-text-subtle]" />
      <p className="text-[13px] text-[--color-text-muted]">No games loaded</p>
      <p className="text-[11px] text-[--color-text-subtle]">Configure a mirror in Settings to get started</p>
    </div>
  );
}
