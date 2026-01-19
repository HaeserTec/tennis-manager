import React from 'react';
import { cn } from '@/lib/utils';
import type { Drill, SessionPlan, Sequence, Player } from '@/lib/playbook';

interface HomeDashboardProps {
  stats: {
    drills: number;
    plans: number;
    sequences: number;
    players: number;
  };
  scoreboard: {
    logged: number;
    total: number;
  };
  recents: {
    drills: Drill[];
    plans: SessionPlan[];
    sequences: Sequence[];
    players: Player[];
  };
  onQuickAction: (action: 'new-drill' | 'new-plan' | 'new-sequence' | 'open-locker-room' | 'open-office' | 'open-scoreboard') => void;
  onSelectRecent: (type: 'drill' | 'plan' | 'sequence' | 'player', id: string) => void;
}

export function HomeDashboard({ stats, scoreboard, recents, onQuickAction, onSelectRecent }: HomeDashboardProps) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="flex-1 h-full overflow-y-auto bg-background p-6 md:p-10 text-foreground animate-in fade-in duration-700 no-scrollbar">
      <div className="max-w-7xl mx-auto space-y-12 pb-20">
        
        {/* Header Section (Restored) */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="relative shrink-0">
               <div className="absolute inset-0 bg-primary/20 blur-xl rounded-full animate-pulse" />
               <img
                 src="/vgta-icon.svg"
                 alt="VGTA"
                 className="relative h-16 w-16 rounded-2xl ring-1 ring-border/40 shadow-2xl"
               />
            </div>
            <div className="space-y-1">
              <h1 className="text-3xl md:text-5xl font-black tracking-tighter bg-gradient-to-br from-foreground via-foreground/80 to-muted-foreground bg-clip-text text-transparent uppercase">
                {greeting}
              </h1>
              <p className="text-muted-foreground text-sm md:text-base font-medium tracking-wide uppercase">
                Tactics Lab & Academy Command Center
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
             <div className="px-4 py-2 rounded-xl bg-card/50 border border-border backdrop-blur-sm">
                <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Local Time</div>
                <div className="text-sm font-mono font-bold text-foreground">
                   {new Date().toLocaleDateString([], { weekday: 'short', day: '2-digit', month: 'short' }).toUpperCase()} • {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
             </div>
          </div>
        </div>

        {/* 5-Card Command Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
           <ActionCard 
              title="The Scoreboard" 
              description={`Today's Progress: ${scoreboard.logged}/${scoreboard.total}`}
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>}
              color="text-yellow-400"
              bg="bg-yellow-500/5"
              border="hover:border-yellow-500/50"
              onClick={() => onQuickAction('open-scoreboard')}
           />
           <ActionCard 
              title="The Designer" 
              description="Create tactical drills & sequences"
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>}
              color="text-primary"
              bg="bg-primary/5"
              border="hover:border-primary/50"
              onClick={() => onQuickAction('new-drill')}
           />
           <ActionCard 
              title="The Planner" 
              description="Schedule sessions & weekly blocks"
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
              color="text-emerald-400"
              bg="bg-emerald-500/5"
              border="hover:border-emerald-500/50"
              onClick={() => onQuickAction('new-plan')}
           />
           <ActionCard 
              title="The Squad" 
              description="Manage roster & performance"
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              color="text-orange-400"
              bg="bg-orange-500/5"
              border="hover:border-orange-500/50"
              onClick={() => onQuickAction('open-locker-room')}
           />
           <ActionCard 
              title="The Office" 
              description="Academy billing & administration"
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
              color="text-pink-400"
              bg="bg-pink-500/5"
              border="hover:border-pink-500/50"
              onClick={() => onQuickAction('open-office')}
           />
        </div>

        {/* System Status Footer */}
        <div className="pt-8 border-t border-border/30">
           <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-black uppercase tracking-widest text-emerald-400">
              <span className="h-1 w-1 rounded-full bg-emerald-500 animate-pulse" />
              Portal Online & Synced
           </div>
        </div>

      </div>
    </div>
  );
}

function ActionCard({ title, description, icon, color, bg, border, onClick }: any) {
   return (
      <button 
         onClick={onClick}
         className={cn(
            "group relative flex flex-col items-start text-left p-6 rounded-3xl border border-border bg-card/40 hover:bg-card transition-all duration-300 hover:-translate-y-1 overflow-hidden shadow-lg",
            border
         )}
      >
         <div className={cn("absolute inset-0 opacity-10 transition-opacity duration-500", bg)} />
         
         <div className={cn("relative p-3 rounded-xl bg-background ring-1 ring-border/40 mb-4 transition-all duration-300 shadow-xl group-hover:scale-110", color)}>
            {icon}
         </div>
         
         <div className="relative space-y-1">
            <h3 className="font-bold text-lg text-foreground transition-colors uppercase italic tracking-tighter">
               {title}
            </h3>
            <p className="text-[10px] text-muted-foreground leading-relaxed font-black uppercase tracking-widest opacity-60">
               {description}
            </p>
         </div>
      </button>
   )
}