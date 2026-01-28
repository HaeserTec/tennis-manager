import React, { useState } from 'react';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Dumbbell, 
  ClipboardList, 
  Activity, 
  Users, 
  LayoutTemplate, 
  Library,
  Briefcase,
  Menu,
  X,
  Sun,
  Moon,
  Settings,
  Download,
  Trophy,
  LogOut,
  Maximize2,
  Minimize2
} from 'lucide-react';
import type { AppMode } from './NavigationRail';

interface MobileFABProps {
  currentMode: AppMode;
  onNavigate: (mode: AppMode) => void;
  onGoHome: () => void;
  isHome: boolean;
  theme: 'dark' | 'light' | 'midnight';
  onToggleTheme: () => void;
  onOpenSettings: () => void;
  onOpenClientPortal?: () => void;
  installPrompt?: any;
  onInstall?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
  fullscreenSupported?: boolean;
}

export function MobileFAB({ 
  currentMode, 
  onNavigate, 
  onGoHome, 
  isHome, 
  theme, 
  onToggleTheme, 
  onOpenSettings,
  onOpenClientPortal,
  installPrompt,
  onInstall,
  isFullscreen,
  onToggleFullscreen,
  fullscreenSupported
}: MobileFABProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleSelect = (action: () => void) => {
    action();
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 lg:hidden flex flex-col items-end gap-3 font-sans">
      {/* Backdrop for click-away */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-in fade-in duration-200"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Speed Dial Items */}
      <div className={cn("flex flex-col gap-3 items-end transition-all duration-200 z-50", isOpen ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-10 scale-95 pointer-events-none")}>
        <FabItem 
           label="Settings" 
           icon={<Settings className="w-5 h-5" />} 
           onClick={() => handleSelect(onOpenSettings)}
           active={false}
           color="text-muted-foreground"
        />
        <FabItem 
           label={theme === 'dark' ? "Light Mode" : "Dark Mode"} 
           icon={theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />} 
           onClick={() => handleSelect(onToggleTheme)}
           active={false}
           color="text-yellow-400"
        />
        {onOpenClientPortal && (
           <FabItem 
             label="Log Out" 
             icon={<LogOut className="w-5 h-5" />} 
             onClick={() => handleSelect(onOpenClientPortal)}
             active={false}
             color="text-red-400"
           />
        )}
        
        {fullscreenSupported && (
          <FabItem 
             label={isFullscreen ? "Exit Fullscreen" : "Fullscreen"}
             icon={isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
             onClick={() => handleSelect(onToggleFullscreen!)}
             active={false}
             color="text-muted-foreground"
          />
        )}

        {installPrompt && (
          <FabItem 
             label="Install App" 
             icon={<Download className="w-5 h-5" />} 
             onClick={() => handleSelect(onInstall!)}
             active={false}
             color="text-primary animate-pulse"
          />
        )}

        <FabItem 
           label="The Squad" 
           icon={<Users className="w-5 h-5" />} 
           onClick={() => handleSelect(() => onNavigate('players'))}
           active={currentMode === 'players' && !isHome}
           color="text-orange-400"
        />
        <FabItem 
           label="Scoreboard" 
           icon={<Trophy className="w-5 h-5" />} 
           onClick={() => handleSelect(() => onNavigate('scoreboard'))}
           active={currentMode === 'scoreboard' && !isHome}
           color="text-yellow-400"
        />
        <FabItem 
           label="Office" 
           icon={<Briefcase className="w-5 h-5" />} 
           onClick={() => handleSelect(() => onNavigate('office'))}
           active={currentMode === 'office' && !isHome}
           color="text-pink-400"
        />
        <FabItem 
           label="Templates" 
           icon={<LayoutTemplate className="w-5 h-5" />} 
           onClick={() => handleSelect(() => onNavigate('templates'))}
           active={currentMode === 'templates' && !isHome}
           color="text-sky-400"
        />
        <FabItem 
           label="Library" 
           icon={<Library className="w-5 h-5" />} 
           onClick={() => handleSelect(() => onNavigate('library'))}
           active={currentMode === 'library' && !isHome}
           color="text-cyan-400"
        />
        <FabItem 
           label="Plans" 
           icon={<ClipboardList className="w-5 h-5" />} 
           onClick={() => handleSelect(() => onNavigate('plans'))}
           active={currentMode === 'plans' && !isHome}
           color="text-emerald-400"
        />
        <FabItem 
           label="Drills" 
           icon={<Dumbbell className="w-5 h-5" />} 
           onClick={() => handleSelect(() => onNavigate('standard'))}
           active={currentMode === 'standard' && !isHome}
           color="text-foreground"
        />
        <FabItem 
           label="Sequences" 
           icon={<Activity className="w-5 h-5" />} 
           onClick={() => handleSelect(() => onNavigate('performance'))}
           active={currentMode === 'performance' && !isHome}
           color="text-indigo-400"
        />
        <FabItem 
           label="Home" 
           icon={<LayoutDashboard className="w-5 h-5" />} 
           onClick={() => handleSelect(onGoHome)}
           active={isHome}
           color="text-primary"
        />
      </div>

      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "h-14 w-14 rounded-full shadow-[0_0_20px_-5px_rgba(0,0,0,0.5)] flex items-center justify-center transition-all duration-300 z-50 border border-border",
          isOpen ? "bg-secondary text-muted-foreground rotate-90" : "bg-primary text-primary-foreground hover:bg-primary/90"
        )}
        aria-label="Navigation Menu"
      >
        {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>
    </div>
  );
}

function FabItem({ label, icon, onClick, active, color }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 pl-4 pr-2 py-2 rounded-full shadow-lg border border-border transition-all active:scale-95",
        active ? "bg-secondary ring-1 ring-primary/20" : "bg-card hover:bg-secondary"
      )}
    >
      <span className={cn("text-xs font-bold uppercase tracking-wider", active ? "text-foreground" : "text-muted-foreground")}>{label}</span>
      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center bg-background border border-border", color)}>
        {icon}
      </div>
    </button>
  );
}
