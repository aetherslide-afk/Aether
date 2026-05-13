import { CheckCircle, XCircle, Circle, X } from "lucide-react";
import { useStore } from "@/store";
import { cn } from "@/lib/utils";

type CheckStatus = "ok" | "error" | "unknown";

interface Check {
  id: string;
  label: string;
  status: CheckStatus;
  errorTitle?: string;
  solution?: string[];
}

function detectOS(): "windows" | "macos" | "linux" {
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "windows";
  if (ua.includes("Mac"))     return "macos";
  return "linux";
}

const ADB_SOLUTION: Record<"windows" | "macos" | "linux", string[]> = {
  windows: [
    "Download Platform Tools from developer.android.com/tools/releases/platform-tools",
    "Extract and add the folder to your system PATH",
    "Or place adb.exe next to Aether.exe inside a platform-tools\\ folder",
    "Restart Aether and scan again",
  ],
  macos: [
    "Install Homebrew from brew.sh if you don't have it",
    "Run: brew install android-platform-tools",
    "Restart Aether and scan again",
  ],
  linux: [
    "Ubuntu / Debian: sudo apt install adb",
    "Fedora: sudo dnf install android-tools",
    "Arch: sudo pacman -S android-tools",
    "Restart Aether and scan again",
  ],
};

export function HealthPanel({ onClose }: { onClose: () => void }) {
  const { adbStatus, devices, games } = useStore();
  const os = detectOS();

  const hasUnauthorized = devices.some((d) => d.type === "unauthorized");
  const hasDevice = devices.some((d) => d.type !== "unauthorized");

  const deviceStatus: CheckStatus =
    adbStatus !== "ok" ? "unknown" :
    hasUnauthorized     ? "error"   :
    hasDevice           ? "ok"      : "error";

  const checks: Check[] = [
    {
      id: "adb",
      label: "ADB drivers installed",
      status: adbStatus,
      errorTitle: "ADB not found on this system",
      solution: ADB_SOLUTION[os],
    },
    {
      id: "device",
      label: hasUnauthorized ? "Device authorization pending" : "Quest device connected",
      status: deviceStatus,
      errorTitle: hasUnauthorized
        ? "Device connected but not authorized"
        : "No Quest device detected",
      solution: hasUnauthorized
        ? [
            "Make sure Developer Mode is enabled on your Quest (via the Meta mobile app)",
            "Disconnect and reconnect the USB cable",
            "Look for the 'Allow USB debugging?' prompt on your headset and tap Allow",
          ]
        : [
            "Enable Developer Mode on your Quest via the Meta mobile app",
            "Connect your Quest to this computer with a USB cable",
            "Accept the 'Allow USB debugging?' prompt that appears on the headset",
          ],
    },
    {
      id: "library",
      label: "Game library loaded",
      status: games.length > 0 ? "ok" : "error",
      errorTitle: "No game library loaded",
      solution: [
        "Go to Settings and paste your public.json config or enter its URL",
        "The library will download and load automatically",
      ],
    },
  ];

  const overallOk = checks.every((c) => c.status === "ok");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
         style={{ background: "rgba(0,0,0,0.5)" }}
         onClick={onClose}>
      <div className="w-96 rounded-xl border border-[--color-border-subtle] shadow-2xl overflow-hidden"
           style={{ background: "var(--color-surface)" }}
           onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[--color-border-subtle]">
          <div>
            <p className="text-[13px] font-semibold text-[--color-text]">System Status</p>
            <p className="text-[11px] text-[--color-text-muted] mt-0.5">
              {overallOk ? "Everything is ready" : "Action required to use Aether"}
            </p>
          </div>
          <button onClick={onClose}
            className="p-1.5 rounded-md text-[--color-text-muted] hover:text-[--color-text]
                       hover:bg-[--color-surface-elevated] transition-all">
            <X size={13} />
          </button>
        </div>

        {/* Checks */}
        <div className="divide-y divide-[--color-border-subtle]/50">
          {checks.map((check) => (
            <CheckRow key={check.id} check={check} />
          ))}
        </div>
      </div>
    </div>
  );
}

function CheckRow({ check }: { check: Check }) {
  const isError = check.status === "error";
  const isOk    = check.status === "ok";

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-center gap-2.5">
        {isOk
          ? <CheckCircle size={14} className="text-success shrink-0" />
          : isError
            ? <XCircle size={14} className="text-danger shrink-0" />
            : <Circle size={14} className="text-[--color-text-subtle] shrink-0" />
        }
        <span className={cn(
          "text-[12px] font-medium",
          isOk ? "text-[--color-text]" : isError ? "text-danger" : "text-[--color-text-muted]"
        )}>
          {check.label}
        </span>
      </div>

      {isError && check.solution && (
        <div className="ml-6 rounded-lg border border-[--color-border-subtle] overflow-hidden">
          {check.errorTitle && (
            <div className="px-3 py-1.5 border-b border-[--color-border-subtle]"
                 style={{ background: "var(--color-surface-elevated)" }}>
              <p className="text-[10px] font-semibold text-[--color-text-muted] uppercase tracking-wider">
                {check.errorTitle}
              </p>
            </div>
          )}
          <ol className="px-3 py-2 space-y-1 list-decimal list-inside"
              style={{ background: "var(--color-surface-elevated)" }}>
            {check.solution.map((step, i) => (
              <li key={i} className="text-[11px] text-[--color-text-muted] leading-relaxed">{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
