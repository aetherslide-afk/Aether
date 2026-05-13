import { invoke } from "@tauri-apps/api/core";
import { FolderOpen } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

export function SettingsPage() {
  const { settings, setSettings } = useStore();

  async function pickDownloadFolder() {
    try {
      const path = await invoke<string>("pick_folder");
      if (path) setSettings({ downloadPath: path });
    } catch {}
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-xl mx-auto px-6 py-6 space-y-2">
        <h1 className="text-[15px] font-semibold mb-5">Settings</h1>

        <Section title="Downloads">
          <Field label="Download folder">
            <div className="flex gap-2">
              <input
                readOnly
                value={settings.downloadPath || "Default (app folder)"}
                className={inputCls + " flex-1 cursor-default"}
              />
              <button onClick={pickDownloadFolder} className={btnCls}>
                <FolderOpen size={13} />
                Browse
              </button>
            </div>
          </Field>

          <Field label="Bandwidth limit" hint="MB/s — 0 means unlimited">
            <NumberInput
              value={settings.bandwidthLimit}
              min={0} step={0.5} unit="MB/s"
              onChange={(v) => setSettings({ bandwidthLimit: v })}
            />
          </Field>

          <Divider />
          <Toggle label="Delete files after install"        checked={settings.deleteAfterInstall}      onChange={(v) => setSettings({ deleteAfterInstall: v })} />
          <Toggle label="Auto-reinstall on failure"         checked={settings.autoReinstallOnFailure}  onChange={(v) => setSettings({ autoReinstallOnFailure: v })} />
          <Toggle label="Use already downloaded files"      checked={settings.useDownloadedFiles}      onChange={(v) => setSettings({ useDownloadedFiles: v })} />
          <Toggle label="Single thread mode"                checked={settings.singleThreadMode}        onChange={(v) => setSettings({ singleThreadMode: v })} />
        </Section>

        <Section title="Content">
          <Toggle label="Show adult content"    checked={settings.showAdultContent} onChange={(v) => setSettings({ showAdultContent: v })} />
          <Toggle label="Enable game trailers"  checked={settings.trailersEnabled}  onChange={(v) => setSettings({ trailersEnabled: v })} />
          <Toggle label="Check for app updates" checked={settings.checkForUpdates}  onChange={(v) => setSettings({ checkForUpdates: v })} />
        </Section>

        <Section title="Proxy">
          <Toggle label="Enable proxy" checked={settings.proxyEnabled} onChange={(v) => setSettings({ proxyEnabled: v })} />

          {settings.proxyEnabled && (
            <Field label="Proxy address & port">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="127.0.0.1"
                  value={settings.proxyAddress}
                  onChange={(e) => setSettings({ proxyAddress: e.target.value })}
                  className={inputCls + " flex-1"}
                />
                <input
                  type="number"
                  placeholder="8080"
                  value={settings.proxyPort}
                  onChange={(e) => setSettings({ proxyPort: parseInt(e.target.value) || 8080 })}
                  className={inputCls + " w-24"}
                />
              </div>
            </Field>
          )}
        </Section>
      </div>
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const inputCls = `
  px-3 py-2 text-[12px] rounded-lg
  bg-[--color-surface-elevated] border border-[--color-border-subtle]
  text-[--color-text] placeholder:text-[--color-text-muted]
  focus:outline-none focus:border-[--color-primary]/50
  transition-colors
`.trim();

const btnCls = `
  flex items-center gap-1.5 px-3 py-2 text-[12px] rounded-lg shrink-0
  bg-[--color-surface-elevated] border border-[--color-border-subtle]
  text-[--color-text-muted] hover:text-[--color-text] hover:border-[--color-border]
  transition-all
`.trim();

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[--color-border-subtle] bg-[--color-surface] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[--color-border-subtle]">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[--color-text-muted]">
          {title}
        </span>
      </div>
      <div className="divide-y divide-[--color-border-subtle]/60">{children}</div>
    </div>
  );
}

function Field({ label, hint, children }: {
  label: string; hint?: string; children: React.ReactNode;
}) {
  return (
    <div className="px-4 py-3 space-y-1.5">
      <div>
        <span className="text-[12px] text-[--color-text]">{label}</span>
        {hint && <span className="ml-2 text-[11px] text-[--color-text-muted]">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

function Divider() {
  return <div className="mx-4 border-t border-[--color-border-subtle]/40" />;
}

function Toggle({ label, checked, onChange }: {
  label: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="w-full flex items-center justify-between px-4 py-3
                 hover:bg-[--color-surface-hover] transition-colors text-left group"
    >
      <span className="text-[12px] text-[--color-text] group-hover:text-white transition-colors">
        {label}
      </span>
      <div
        className="relative w-9 h-5 rounded-full transition-all duration-200 shrink-0"
        style={{ background: checked ? "#7b5ea7" : "#b91c1c" }}
      >
        <span className={cn(
          "absolute top-[3px] left-[3px] w-[14px] h-[14px] rounded-full bg-white shadow-sm transition-transform duration-200",
          checked && "translate-x-[16px]"
        )} />
      </div>
    </button>
  );
}

function NumberInput({ value, min, step, unit, onChange }: {
  value: number; min: number; step: number; unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <input
          type="number"
          min={min}
          step={step}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className={inputCls + " w-28 pr-12 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-[--color-text-muted] pointer-events-none">
          {unit}
        </span>
      </div>
      <span className="text-[11px] text-[--color-text-muted]">
        {value === 0 ? "unlimited" : `${value} MB/s`}
      </span>
    </div>
  );
}
