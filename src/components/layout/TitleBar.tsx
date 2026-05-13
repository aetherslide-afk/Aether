import { getCurrentWindow } from "@tauri-apps/api/window";
import { Minus, Square, X } from "lucide-react";

export function TitleBar() {
  const win = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-9 px-4 shrink-0 select-none
                 bg-[--color-surface] border-b border-[--color-border-subtle]"
    >
      <span
        data-tauri-drag-region
        className="text-[11px] font-semibold tracking-widest uppercase text-[--color-text-subtle] letter-spacing-widest"
      >
        Aether
      </span>

      <div className="flex items-center gap-0.5">
        <WinBtn onClick={() => win.minimize()} hoverClass="hover:bg-[--color-surface-hover]">
          <Minus size={10} />
        </WinBtn>
        <WinBtn onClick={() => win.toggleMaximize()} hoverClass="hover:bg-[--color-surface-hover]">
          <Square size={9} />
        </WinBtn>
        <WinBtn onClick={() => win.close()} hoverClass="hover:bg-[--color-danger]/80 hover:text-white">
          <X size={11} />
        </WinBtn>
      </div>
    </div>
  );
}

function WinBtn({ onClick, hoverClass, children }: {
  onClick: () => void;
  hoverClass: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center w-8 h-7 rounded text-[--color-text-subtle]
                  transition-all duration-150 ${hoverClass}`}
    >
      {children}
    </button>
  );
}
