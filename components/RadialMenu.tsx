
import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RadialMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onSelect: (type: 'player' | 'ball' | 'coach' | 'target') => void;
}

export function RadialMenu({ x, y, onClose, onSelect }: RadialMenuProps) {
  // Close when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
       // We rely on the parent container catching clicks, but a global listener is safer
       // if the menu is portaled. Here it's inline, so we just need to stop propagation on the menu itself.
    };
    document.addEventListener("click", onClose);
    return () => document.removeEventListener("click", onClose);
  }, [onClose]);

  return (
    <div
      className="absolute z-50 animate-in fade-in zoom-in-95 duration-200"
      style={{
        left: x,
        top: y,
        transform: "translate(-50%, -50%)",
      }}
      onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the menu
      onDoubleClick={(e) => e.stopPropagation()} // Prevent double click bubbling
    >
      {/* Central Close Button */}
      <div className="relative w-32 h-32 flex items-center justify-center">
        {/* Ring background */}
        <div className="absolute inset-0 bg-card/90 rounded-full border border-border shadow-xl backdrop-blur-md" />
        
        {/* Center Close */}
        <Button
            variant="ghost"
            size="icon"
            className="w-10 h-10 rounded-full hover:bg-secondary text-muted-foreground z-10"
            onClick={onClose}
        >
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </Button>

        {/* Buttons arranged radially */}
        {/* Top: Player */}
        <div className="absolute top-2 left-1/2 -translate-x-1/2">
             <button
                className="flex flex-col items-center gap-1 group"
                onClick={() => onSelect('player')}
             >
                <div className="w-9 h-9 rounded-full bg-blue-500/20 text-blue-400 flex items-center justify-center border border-blue-500/30 group-hover:bg-blue-500 group-hover:text-white transition-colors">
                    <span className="font-bold text-xs">P</span>
                </div>
                <span className="text-[9px] text-muted-foreground font-medium group-hover:text-foreground"></span>
             </button>
        </div>

        {/* Bottom: Ball */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
             <button
                className="flex flex-col-reverse items-center gap-1 group"
                onClick={() => onSelect('ball')}
             >
                <div className="w-9 h-9 rounded-full bg-yellow-500/20 text-yellow-400 flex items-center justify-center border border-yellow-500/30 group-hover:bg-yellow-500 group-hover:text-black transition-colors">
                   <div className="w-3.5 h-3.5 rounded-full bg-current" />
                </div>
                <span className="text-[9px] text-muted-foreground font-medium group-hover:text-foreground"></span>
             </button>
        </div>

        {/* Left: Coach */}
        <div className="absolute left-2 top-1/2 -translate-y-1/2">
             <button
                className="flex flex-col items-center gap-1 group"
                onClick={() => onSelect('coach')}
             >
                <div className="w-9 h-9 rounded-full bg-red-500/20 text-red-400 flex items-center justify-center border border-red-500/30 group-hover:bg-red-500 group-hover:text-white transition-colors">
                   <span className="font-bold text-xs">C</span>
                </div>
                {/* <span className="text-[9px] text-muted-foreground font-medium group-hover:text-foreground"></span> */}
             </button>
        </div>

        {/* Right: Target */}
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
             <button
                className="flex flex-col items-center gap-1 group"
                onClick={() => onSelect('target')}
             >
                <div className="w-9 h-9 rounded-full bg-green-500/20 text-green-400 flex items-center justify-center border border-green-500/30 group-hover:bg-green-500 group-hover:text-white transition-colors">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
                </div>
                {/* <span className="text-[9px] text-muted-foreground font-medium group-hover:text-foreground">Target</span> */}
             </button>
        </div>
      </div>
    </div>
  );
}
