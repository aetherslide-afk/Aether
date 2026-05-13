import { Library, Smartphone, Settings, GitMerge } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStore } from "@/store";

const tabs = [
  { id: "library"    as const, label: "Library",    icon: Library   },
  { id: "device"     as const, label: "Device",     icon: Smartphone},
  { id: "contribute" as const, label: "Contribute", icon: GitMerge  },
  { id: "settings"   as const, label: "Settings",   icon: Settings  },
];

export function Sidebar() {
  const { activeTab, setActiveTab } = useStore();

  return (
    <aside className="flex flex-col w-14 shrink-0 bg-[--color-surface] border-r border-[--color-border-subtle]">
      {/* Logo mark */}
      <div className="flex items-center justify-center h-12 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-[--color-primary-dim] border border-[--color-primary]/20 flex items-center justify-center">
          <span className="text-[--color-primary] font-bold text-xs tracking-tight">Æ</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex flex-col items-center gap-0.5 px-1.5 py-2 flex-1">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            title={label}
            className={cn(
              "relative flex items-center justify-center w-full h-9 rounded-md transition-all duration-150",
              activeTab === id
                ? "bg-[--color-primary-dim] text-[--color-primary]"
                : "text-[--color-text-muted] hover:bg-[--color-surface-hover] hover:text-[--color-text]"
            )}
          >
            {activeTab === id && (
              <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 bg-[--color-primary] rounded-r-full" />
            )}
            <Icon size={16} strokeWidth={activeTab === id ? 2.5 : 1.75} />
          </button>
        ))}
      </nav>
    </aside>
  );
}
