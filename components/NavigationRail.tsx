import React from 'react';
import { cn } from '@/lib/utils';
import { 
  LayoutDashboard, 
  Dumbbell, 
  ClipboardList, 
  Activity, 
  Users, 
  LayoutTemplate, 
  Library,
  Settings, 
  Download, 
  Trophy, 
  Briefcase,
  LogOut,
  Maximize2,
  Minimize2
} from 'lucide-react';
  import { ThemeToggle } from './ThemeToggle';
  
  export type AppMode = 'standard' | 'performance' | 'plans' | 'players' | 'templates' | 'office' | 'scoreboard' | 'library';
  
  interface NavigationRailProps {
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
  
  export function NavigationRail({
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
    fullscreenSupported,
    onOpenProfile
  }: NavigationRailProps & { onOpenProfile?: () => void }) {
    return (
      <div className="hidden lg:flex flex-col items-center w-16 h-full glass border-r border-border py-4 z-40">
        {/* Home / Logo */}
        <button 
          onClick={onGoHome}
          className={cn(
            "mb-8 p-2 rounded-xl transition-all duration-300",
            isHome ? "bg-primary/20 text-primary glow-primary border border-primary/20" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
          )}
          title="Home Dashboard"
        >
          <LayoutDashboard className="w-6 h-6" />
        </button>
  
        {/* Main Nav */}
        <div className="flex-1 flex flex-col gap-4 w-full px-2">
          <NavButton 
            icon={<Dumbbell className="w-5 h-5" />} 
            label="Drills" 
            isActive={currentMode === 'standard' && !isHome} 
            onClick={() => onNavigate('standard')}
            colorClass="text-foreground"
            activeClass="bg-secondary/50 text-foreground border border-white/5 shadow-lg"
          />
          <NavButton 
            icon={<ClipboardList className="w-5 h-5" />} 
            label="Plans" 
            isActive={currentMode === 'plans' && !isHome} 
            onClick={() => onNavigate('plans')}
            colorClass="text-emerald-400"
            activeClass="bg-emerald-500/20 text-emerald-300 border border-emerald-500/20 shadow-[0_0_15px_-3px_rgba(16,185,129,0.3)]"
          />
          <NavButton 
            icon={<Activity className="w-5 h-5" />} 
            label="Sequences" 
            isActive={currentMode === 'performance' && !isHome} 
            onClick={() => onNavigate('performance')}
            colorClass="text-indigo-400"
            activeClass="bg-indigo-500/20 text-indigo-300 border border-indigo-500/20 shadow-[0_0_15px_-3px_rgba(99,102,241,0.3)]"
          />
          <NavButton 
            icon={<Users className="w-5 h-5" />} 
            label="The Squad" 
            isActive={currentMode === 'players' && !isHome} 
            onClick={() => onNavigate('players')}
            colorClass="text-orange-400"
            activeClass="bg-orange-500/20 text-orange-400 border border-orange-500/20 shadow-[0_0_15px_-3px_rgba(251,146,60,0.3)]"
          />
          <NavButton 
            icon={<Trophy className="w-5 h-5" />} 
            label="Scoreboard" 
            isActive={currentMode === 'scoreboard' && !isHome} 
            onClick={() => onNavigate('scoreboard')}
            colorClass="text-yellow-400"
            activeClass="bg-yellow-500/20 text-yellow-400 border border-yellow-500/20 shadow-[0_0_15px_-3px_rgba(250,204,21,0.3)]"
          />
  
          <NavButton 
            icon={<Briefcase className="w-5 h-5" />} 
            label="Office" 
            isActive={currentMode === 'office' && !isHome} 
            onClick={() => onNavigate('office')}
            colorClass="text-pink-400"
            activeClass="bg-pink-500/20 text-pink-400 border border-pink-500/20 shadow-[0_0_15px_-3px_rgba(244,114,182,0.3)]"
          />        
        <div className="h-px w-8 bg-border/50 mx-auto my-2" />
        
        <NavButton 
          icon={<Library className="w-5 h-5" />} 
          label="Library" 
          isActive={currentMode === 'library' && !isHome} 
          onClick={() => onNavigate('library')}
          colorClass="text-cyan-400"
          activeClass="bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 shadow-[0_0_15px_-3px_rgba(34,211,238,0.3)]"
        />
        
        <NavButton 
          icon={<LayoutTemplate className="w-5 h-5" />} 
          label="Templates" 
          isActive={currentMode === 'templates' && !isHome} 
          onClick={() => onNavigate('templates')}
          colorClass="text-sky-400"
          activeClass="bg-sky-500/20 text-sky-300 border border-sky-500/20 shadow-[0_0_15px_-3px_rgba(56,189,248,0.3)]"
        />
      </div>

      {/* Bottom Actions */}
      <div className="mt-auto flex flex-col gap-4 items-center">
        {/* Profile Button */}
        {onOpenProfile && (
          <button 
            onClick={onOpenProfile} 
            className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-purple-600 p-[2px] shadow-lg hover:scale-105 transition-transform"
            title="My Profile"
          >
            <div className="w-full h-full rounded-full bg-background flex items-center justify-center">
               <span className="font-black text-xs text-primary">ME</span>
            </div>
          </button>
        )}

        {onOpenClientPortal && (
           <button onClick={onOpenClientPortal} className="p-2 text-muted-foreground hover:text-red-400 transition-colors" title="Log Out">
              <LogOut className="w-5 h-5" />
           </button>
        )}
        {fullscreenSupported && (
          <button 
            onClick={onToggleFullscreen} 
            className="p-2 text-muted-foreground hover:text-foreground transition-colors"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
          </button>
        )}
        {installPrompt && (
          <button 
            onClick={onInstall} 
            className="p-2 text-primary hover:text-primary/80 transition-colors"
            title="Install App"
          >
            <Download className="w-5 h-5" />
          </button>
        )}
        <ThemeToggle theme={theme} onToggle={onToggleTheme} className="border-none bg-transparent" />
        <button onClick={onOpenSettings} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Settings className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function NavButton({ icon, label, isActive, onClick, colorClass, activeClass }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative group w-full aspect-square flex items-center justify-center rounded-xl transition-all duration-200",
        isActive 
          ? activeClass 
          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}
      title={label}
    >
      {/* Icon */}
      <div className={cn("transition-colors", isActive ? "opacity-100" : "opacity-70 group-hover:opacity-100")}>
         {icon}
      </div>
      
      {/* Tooltip Label (on hover) */}
      <div className="absolute left-14 bg-popover text-popover-foreground text-xs font-bold px-2 py-1 rounded border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-xl">
        {label}
      </div>
      
      {/* Active Indicator */}
      {isActive && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-current rounded-r-full opacity-50" />
      )}
    </button>
  );
}
