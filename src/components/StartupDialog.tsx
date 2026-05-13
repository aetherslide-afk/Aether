import { useState } from "react";
import { Globe, HardDrive, Loader2, AlertCircle, Wand2 } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { cn } from "@/lib/utils";
import { useMetadata } from "@/hooks/useMetadata";

type Mode = "public" | "offline";
interface Props { onDone: () => void }

export function StartupDialog({ onDone }: Props) {
  const [mode, setMode] = useState<Mode>("public");
  const [input, setInput] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const { loading, progress, error, loadFromPublicConfig } = useMetadata();

  const isJson = input.trim().startsWith("{");

  function beautify() {
    try {
      const parsed = JSON.parse(input);
      setInput(JSON.stringify(parsed, null, 2));
      setJsonError(null);
    } catch (e: any) {
      setJsonError("Invalid JSON — " + e.message);
    }
  }

  function handleChange(val: string) {
    setInput(val);
    setJsonError(null);
    // Auto-beautify when a complete JSON is pasted
    if (val.trim().startsWith("{") && val.trim().endsWith("}")) {
      try {
        const parsed = JSON.parse(val);
        setInput(JSON.stringify(parsed, null, 2));
      } catch {}
    }
  }

  async function handleStart() {
    if (mode === "offline") { onDone(); return; }
    if (!input.trim()) return;
    try {
      const dataDir = await invoke<string>("get_data_dir");
      const configPath = `${dataDir}/public.json`;
      if (isJson) {
        await invoke("save_public_config", { content: input.trim(), path: configPath });
      } else {
        await invoke("fetch_public_config", { url: input.trim(), path: configPath });
      }
      await loadFromPublicConfig(configPath);
      onDone();
    } catch (e) { console.error(e); }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <div className="w-72 space-y-4">
          <div className="flex items-center gap-2.5">
            <Loader2 size={15} className="animate-spin text-[--color-primary] shrink-0" />
            <span className="text-[13px] font-medium text-[--color-text]">
              {stageLabel(progress?.stage)}
            </span>
          </div>
          <div className="h-1 bg-[--color-border] rounded-full overflow-hidden">
            <div
              className="h-full bg-[--color-primary] transition-all duration-500 rounded-full"
              style={{ width: `${progress?.progress ?? 0}%` }}
            />
          </div>
          <p className="text-[11px] text-[--color-text-muted]">{progress?.message ?? "Please wait…"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center h-full p-8">
      <div className="w-full max-w-md space-y-5">

        {/* Header */}
        <div className="space-y-1">
          <h1 className="text-[22px] font-semibold tracking-tight">Welcome to Aether</h1>
          <p className="text-[13px] text-[--color-text-muted]">Choose how to load your game library</p>
        </div>

        {/* Mode cards */}
        <div className="grid grid-cols-2 gap-2">
          <ModeCard active={mode === "public"} onClick={() => setMode("public")}
            icon={<Globe size={16} />} title="Public Mirror" description="Connect via config" />
          <ModeCard active={mode === "offline"} onClick={() => setMode("offline")}
            icon={<HardDrive size={16} />} title="Offline" description="Local files only" />
        </div>

        {/* JSON / URL input */}
        {mode === "public" && (
          <div className="space-y-2">
            {/* Label row */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[--color-text-muted]">
                Paste <code className="font-mono bg-[--color-surface-elevated] px-1 py-0.5 rounded text-[--color-text]">public.json</code> or a URL
              </span>
              <div className="flex items-center gap-2">
                {input.trim() && (
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-medium",
                    isJson
                      ? "bg-[--color-success]/15 text-[--color-success]"
                      : "bg-[--color-primary]/15 text-[--color-primary]"
                  )}>
                    {isJson ? "JSON" : "URL"}
                  </span>
                )}
                {isJson && (
                  <button
                    onClick={beautify}
                    title="Beautify JSON"
                    className="flex items-center gap-1 text-[10px] text-[--color-text-muted]
                               hover:text-[--color-primary] transition-colors"
                  >
                    <Wand2 size={11} /> Format
                  </button>
                )}
              </div>
            </div>

            {/* Textarea */}
            <div className={cn(
              "relative rounded-xl border overflow-hidden transition-colors",
              jsonError
                ? "border-[--color-danger]/50"
                : isJson
                  ? "border-[--color-success]/30 focus-within:border-[--color-success]/60"
                  : "border-[--color-border] focus-within:border-[--color-primary]/50"
            )}>
              {/* Line numbers for JSON */}
              {isJson && (
                <div className="absolute left-0 top-0 bottom-0 w-8 bg-[--color-surface]
                                border-r border-[--color-border-subtle] flex flex-col
                                pt-3 pb-3 select-none pointer-events-none z-10">
                  {input.split("\n").map((_, i) => (
                    <span key={i} className="text-center text-[10px] text-[--color-text-subtle]
                                             leading-[1.6rem]">
                      {i + 1}
                    </span>
                  ))}
                </div>
              )}

              <textarea
                rows={isJson ? Math.min(Math.max(input.split("\n").length, 4), 12) : 1}
                placeholder={
                  isJson
                    ? ""
                    : `Paste JSON or enter URL\n\nExample JSON:\n{\n  "baseUri": "https://…",\n  "password": "…"\n}`
                }
                value={input}
                onChange={(e) => handleChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !isJson && !e.shiftKey) {
                    e.preventDefault();
                    handleStart();
                  }
                }}
                autoFocus
                spellCheck={false}
                className={cn(
                  "w-full bg-[--color-surface-elevated] text-[--color-text]",
                  "placeholder:text-[--color-text-subtle] focus:outline-none",
                  "font-mono text-[12px] leading-[1.6rem] resize-none",
                  "py-3 pr-3 transition-colors",
                  isJson ? "pl-10" : "px-3"
                )}
              />
            </div>

            {/* JSON parse error */}
            {jsonError && (
              <p className="text-[11px] text-[--color-danger] flex items-center gap-1.5">
                <AlertCircle size={11} /> {jsonError}
              </p>
            )}
          </div>
        )}

        {/* API error */}
        {error && (
          <div className="flex items-start gap-2 text-[11px] text-[--color-danger]
                          p-3 rounded-lg bg-[--color-danger]/8 border border-[--color-danger]/20">
            <AlertCircle size={13} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* CTA */}
        <button
          onClick={handleStart}
          disabled={mode === "public" && !input.trim()}
          className="w-full h-10 rounded-xl bg-[--color-primary] hover:bg-[--color-primary-hover]
                     disabled:opacity-30 disabled:cursor-not-allowed
                     text-white text-[13px] font-semibold tracking-wide
                     transition-all duration-150 shadow-lg shadow-[--color-primary]/20"
        >
          {mode === "offline" ? "Continue Offline" : "Connect & Load Library"}
        </button>
      </div>
    </div>
  );
}

function stageLabel(stage?: string) {
  return ({ downloading: "Downloading library…", extracting: "Extracting…", parsing: "Building game list…" })[stage ?? ""] ?? "Loading…";
}

function ModeCard({ active, onClick, icon, title, description }: {
  active: boolean; onClick: () => void;
  icon: React.ReactNode; title: string; description: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-col items-start gap-2 p-3.5 rounded-xl border text-left transition-all duration-150",
        active
          ? "border-[--color-primary]/50 bg-[--color-primary-dim]"
          : "border-[--color-border-subtle] bg-[--color-surface] hover:bg-[--color-surface-elevated] hover:border-[--color-border]"
      )}
    >
      <span className={cn("p-1.5 rounded-lg", active ? "bg-[--color-primary]/20 text-[--color-primary]" : "bg-[--color-surface-elevated] text-[--color-text-muted]")}>
        {icon}
      </span>
      <div>
        <p className={cn("text-[12px] font-semibold", active ? "text-[--color-text]" : "text-[--color-text-muted]")}>{title}</p>
        <p className="text-[11px] text-[--color-text-muted]">{description}</p>
      </div>
    </button>
  );
}
