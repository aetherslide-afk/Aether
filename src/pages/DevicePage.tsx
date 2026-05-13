import { Smartphone, RefreshCw, Wifi, Usb, HardDrive, Search, Trash2, Loader2, Signal } from "lucide-react";
import { useStore } from "@/store";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { useState, useEffect } from "react";
import type { Device } from "@/types";

interface InstalledPackage { package: string; label: string; }

const SYSTEM_PREFIXES = [
  "com.meta.shell", "com.meta.quest_hard", "com.meta.hand",
  "com.oculus.vrprivacy", "com.oculus.accountscenter",
  "com.oculus.systemactivities", "com.oculus.socialplatform",
  "com.facebook.arvr", "com.facebook.spatial",
  "com.deovr", "cn.vr4p",
];

export function DevicePage() {
  const { devices, setDevices, selectedDevice, setSelectedDevice } = useStore();
  const [scanning, setScanning]           = useState(false);
  const [wirelessIp, setWirelessIp]       = useState("");
  const [packages, setPackages]           = useState<InstalledPackage[]>([]);
  const [loadingPkgs, setLoadingPkgs]     = useState(false);
  const [pkgSearch, setPkgSearch]         = useState("");
  const [hideSystem, setHideSystem]       = useState(true);

  useEffect(() => { scanDevices(); }, []);
  useEffect(() => {
    if (selectedDevice) loadPackages(selectedDevice);
    else setPackages([]);
  }, [selectedDevice]);

  async function scanDevices() {
    setScanning(true);
    try {
      const found = await invoke<Device[]>("adb_list_devices");
      setDevices(found);
      if (found.length > 0 && !selectedDevice) setSelectedDevice(found[0]);
    } catch {}
    finally { setScanning(false); }
  }

  async function loadPackages(device: Device) {
    setLoadingPkgs(true);
    setPackages([]);
    try {
      const pkgs = await invoke<InstalledPackage[]>("adb_list_packages", { deviceId: device.id });
      setPackages(pkgs.sort((a, b) => a.label.localeCompare(b.label)));
    } catch {}
    finally { setLoadingPkgs(false); }
  }

  async function uninstallPackage(pkg: string) {
    if (!selectedDevice) return;
    try {
      await invoke("adb_uninstall", { deviceId: selectedDevice.id, package: pkg });
      setPackages((p) => p.filter((x) => x.package !== pkg));
    } catch {}
  }

  async function connectWireless() {
    if (!wirelessIp.trim()) return;
    try {
      await invoke("adb_connect_wireless", { ip: wirelessIp });
      await scanDevices();
    } catch {}
  }

  const filtered = packages.filter((p) => {
    if (hideSystem && SYSTEM_PREFIXES.some((pfx) => p.package.startsWith(pfx))) return false;
    if (pkgSearch) {
      const q = pkgSearch.toLowerCase();
      return p.label.toLowerCase().includes(q) || p.package.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex h-full min-h-0">

      {/* ── Left panel ── */}
      <div className="w-64 shrink-0 border-r border-[--color-border-subtle] flex flex-col bg-[--color-surface]">

        {/* Header */}
        <div className="flex items-center justify-between px-4 h-11 border-b border-[--color-border-subtle] shrink-0">
          <span className="text-[12px] font-semibold text-[--color-text]">Devices</span>
          <button onClick={scanDevices} disabled={scanning} title="Scan"
            className="p-1.5 rounded-md text-[--color-text-muted] hover:text-[--color-text]
                       hover:bg-[--color-surface-hover] disabled:opacity-40 transition-all">
            <RefreshCw size={13} className={cn(scanning && "animate-spin")} />
          </button>
        </div>

        {/* Device list */}
        <div className="flex-1 p-2 space-y-1 overflow-y-auto">
          {scanning && devices.length === 0 ? (
            <div className="flex items-center justify-center gap-2 text-[11px] text-[--color-text-muted] py-8">
              <Loader2 size={13} className="animate-spin" /> Scanning…
            </div>
          ) : devices.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-[--color-text-muted]">
              <Smartphone size={24} className="opacity-20" />
              <p className="text-[11px] text-center leading-relaxed opacity-60">
                No devices found.<br />Connect your headset via USB.
              </p>
            </div>
          ) : (
            devices.map((device) => {
              const active = selectedDevice?.id === device.id;
              return (
                <button key={device.id} onClick={() => setSelectedDevice(device)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all",
                    active
                      ? "bg-primary-dim border border-[--color-primary]/30 text-primary"
                      : "hover:bg-[--color-surface-hover] text-[--color-text-muted] hover:text-[--color-text]"
                  )}>
                  {device.type === "wifi"
                    ? <Wifi size={14} className="shrink-0" />
                    : <Usb size={14} className="shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-[12px] font-medium truncate", active && "text-[--color-text]")}>
                      {device.model || device.id}
                    </p>
                    <p className="text-[10px] text-[--color-text-muted] truncate font-mono">
                      {device.id}
                    </p>
                  </div>
                  {active && <Signal size={11} className="text-[--color-success] shrink-0" />}
                </button>
              );
            })
          )}
        </div>

        {/* Storage */}
        {selectedDevice?.freeSpace !== undefined && (
          <div className="px-4 py-2 border-t border-[--color-border-subtle]
                          flex items-center gap-1.5 text-[11px] text-[--color-text-muted]">
            <HardDrive size={11} />
            <span>{formatBytes(selectedDevice.freeSpace)} free</span>
          </div>
        )}

        {/* Wireless ADB */}
        <div className="p-3 border-t border-[--color-border-subtle] space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[--color-text-muted]
                        flex items-center gap-1.5">
            <Wifi size={10} /> Wireless ADB
          </p>
          <div className="flex gap-1.5">
            <input
              type="text"
              placeholder="192.168.x.x"
              value={wirelessIp}
              onChange={(e) => setWirelessIp(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && connectWireless()}
              className="flex-1 min-w-0 px-2.5 py-1.5 text-[11px] rounded-lg
                         bg-[--color-surface-elevated] border border-[--color-border-subtle]
                         text-[--color-text] placeholder:text-[--color-text-muted]
                         focus:outline-none focus:border-[--color-primary]/50 transition-colors"
            />
            <button onClick={connectWireless}
              className="px-2.5 py-1.5 text-[11px] rounded-lg shrink-0
                         bg-[--color-surface-elevated] border border-[--color-border-subtle]
                         hover:border-[--color-border] text-[--color-text-muted] hover:text-[--color-text] transition-all">
              Connect
            </button>
          </div>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col min-h-0">
        {selectedDevice ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 h-11 border-b border-[--color-border-subtle] shrink-0">
              <span className="text-[12px] font-semibold text-[--color-text]">
                Installed
                {filtered.length > 0 &&
                  <span className="ml-1.5 text-[--color-text-muted] font-normal">{filtered.length}</span>}
              </span>

              {/* Hide system toggle */}
              <button
                onClick={() => setHideSystem((v) => !v)}
                className={cn(
                  "flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] transition-all ml-2",
                  hideSystem
                    ? "bg-primary-dim text-primary"
                    : "text-[--color-text-muted] hover:bg-[--color-surface-hover] hover:text-[--color-text]"
                )}>
                Hide system
              </button>

              <div className="relative ml-auto w-48">
                <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[--color-text-muted] pointer-events-none" />
                <input
                  type="text"
                  placeholder="Filter…"
                  value={pkgSearch}
                  onChange={(e) => setPkgSearch(e.target.value)}
                  className="w-full pl-7 pr-3 py-1.5 text-[11px] rounded-lg
                             bg-[--color-surface-elevated] border border-[--color-border-subtle]
                             text-[--color-text] placeholder:text-[--color-text-muted]
                             focus:outline-none focus:border-[--color-primary]/50 transition-colors"
                />
              </div>

              <button onClick={() => loadPackages(selectedDevice)} disabled={loadingPkgs} title="Refresh"
                className="p-1.5 rounded-md text-[--color-text-muted] hover:text-[--color-text]
                           hover:bg-[--color-surface-hover] disabled:opacity-40 transition-all">
                <RefreshCw size={13} className={cn(loadingPkgs && "animate-spin")} />
              </button>
            </div>

            {/* Package list */}
            <div className="flex-1 overflow-y-auto">
              {loadingPkgs ? (
                <div className="flex items-center justify-center gap-2 text-[12px] text-[--color-text-muted] h-32">
                  <Loader2 size={15} className="animate-spin" /> Loading…
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center text-[12px] text-[--color-text-muted] h-32">
                  {pkgSearch ? `No results for "${pkgSearch}"` : "No packages found"}
                </div>
              ) : (
                <div className="divide-y divide-[--color-border-subtle]/50">
                  {filtered.map((pkg) => (
                    <div key={pkg.package}
                      className="group flex items-center gap-3 px-4 py-2.5
                                 hover:bg-[--color-surface-elevated] transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[--color-text] truncate">{pkg.label}</p>
                        <p className="text-[10px] text-[--color-text-muted] font-mono truncate">{pkg.package}</p>
                      </div>
                      <button
                        onClick={() => uninstallPackage(pkg.package)}
                        title="Uninstall"
                        className="p-1.5 rounded-md opacity-0 group-hover:opacity-100
                                   hover:bg-danger-dim text-danger transition-all">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-[--color-text-muted]">
            <Smartphone size={28} className="opacity-20" />
            <p className="text-[12px]">Select a device to view installed apps</p>
          </div>
        )}
      </div>
    </div>
  );
}
