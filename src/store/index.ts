import { create } from "zustand";
import type { Game, Device, DownloadTask, AppSettings, ViewMode, SortBy, FilterBy, Mirror } from "@/types";

interface AppStore {
  // Library
  games: Game[];
  setGames: (games: Game[]) => void;
  toggleFavorite: (id: string) => void;

  // View state
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  sortBy: SortBy;
  setSortBy: (sort: SortBy) => void;
  filterBy: FilterBy;
  setFilterBy: (filter: FilterBy) => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;

  // Device
  devices: Device[];
  setDevices: (devices: Device[]) => void;
  selectedDevice: Device | null;
  setSelectedDevice: (device: Device | null) => void;

  // Queue
  queue: DownloadTask[];
  addToQueue: (task: DownloadTask) => void;
  updateTask: (id: string, update: Partial<DownloadTask>) => void;
  removeFromQueue: (id: string) => void;
  clearQueue: () => void;

  // Settings
  settings: AppSettings;
  setSettings: (settings: Partial<AppSettings>) => void;

  // Mirrors
  mirrors: Mirror[];
  setMirrors: (mirrors: Mirror[]) => void;
  activeMirror: Mirror | null;
  setActiveMirror: (mirror: Mirror | null) => void;

  // Health
  adbStatus: "ok" | "error" | "unknown";
  setAdbStatus: (status: "ok" | "error" | "unknown") => void;

  // UI
  activeTab: "library" | "device" | "contribute" | "settings";
  setActiveTab: (tab: "library" | "device" | "contribute" | "settings") => void;
}

const defaultSettings: AppSettings = {
  downloadPath: "",
  deleteAfterInstall: false,
  autoReinstallOnFailure: true,
  checkForUpdates: true,
  showAdultContent: false,
  trailersEnabled: false,
  bandwidthLimit: 0,
  proxyEnabled: false,
  proxyAddress: "",
  proxyPort: 8080,
  singleThreadMode: false,
  useDownloadedFiles: true,
};

export const useStore = create<AppStore>((set) => ({
  games: [],
  setGames: (games) => set({ games }),
  toggleFavorite: (id) =>
    set((s) => ({
      games: s.games.map((g) =>
        g.id === id ? { ...g, isFavorite: !g.isFavorite } : g
      ),
    })),

  viewMode: "gallery",
  setViewMode: (viewMode) => set({ viewMode }),
  sortBy: "name",
  setSortBy: (sortBy) => set({ sortBy }),
  filterBy: "all",
  setFilterBy: (filterBy) => set({ filterBy }),
  searchQuery: "",
  setSearchQuery: (searchQuery) => set({ searchQuery }),

  devices: [],
  setDevices: (devices) => set({ devices }),
  selectedDevice: null,
  setSelectedDevice: (selectedDevice) => set({ selectedDevice }),

  queue: [],
  addToQueue: (task) => set((s) => ({ queue: [...s.queue, task] })),
  updateTask: (id, update) =>
    set((s) => ({
      queue: s.queue.map((t) => (t.id === id ? { ...t, ...update } : t)),
    })),
  removeFromQueue: (id) =>
    set((s) => ({ queue: s.queue.filter((t) => t.id !== id) })),
  clearQueue: () => set({ queue: [] }),

  settings: defaultSettings,
  setSettings: (update) =>
    set((s) => ({ settings: { ...s.settings, ...update } })),

  mirrors: [],
  setMirrors: (mirrors) => set({ mirrors }),
  activeMirror: null,
  setActiveMirror: (activeMirror) => set({ activeMirror }),

  adbStatus: "unknown",
  setAdbStatus: (adbStatus) => set({ adbStatus }),

  activeTab: "library",
  setActiveTab: (activeTab) => set({ activeTab }),
}));
