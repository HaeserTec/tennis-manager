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
    <div className="flex-1 h-full overflow-y-auto bg-radial-gradient p-6 md:p-10 text-foreground no-scrollbar">
      <div className="max-w-7xl mx-auto space-y-12 pb-20">
        
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-start gap-5">
            <div className="relative shrink-0">
               <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full" />
               <img
                 src="/vgta-icon.svg"
                 alt="VGTA"
                 className="relative h-20 w-20 rounded-2xl ring-1 ring-border/40 shadow-2xl"
               />
            </div>
            <div className="space-y-1">
              <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-gradient uppercase">
                {greeting}
              </h1>
              <p className="text-muted-foreground text-sm md:text-base font-bold tracking-[0.2em] uppercase opacity-70">
                Command Center
              </p>
            </div>
          </div>
          
          <div className="flex gap-3">
             <div className="px-6 py-3 rounded-2xl glass border border-white/5 shadow-2xl">
                <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-1">Local Time</div>
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
              description={`Today: ${scoreboard.logged}/${scoreboard.total}`}
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>}
              color="text-yellow-400"
              bg="bg-yellow-500/10"
              border="hover:border-yellow-500/50"
              onClick={() => onQuickAction('open-scoreboard')}
           />
           <ActionCard 
              title="The Designer" 
              description="Drills & Sequences"
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/><path d="M2 2l7.586 7.586"/><circle cx="11" cy="11" r="2"/></svg>}
              color="text-primary"
              bg="bg-primary/10"
              border="hover:border-primary/50"
              onClick={() => onQuickAction('new-drill')}
           />
           <ActionCard 
              title="The Planner" 
              description="Schedule & Blocks"
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>}
              color="text-emerald-400"
              bg="bg-emerald-500/10"
              border="hover:border-emerald-500/50"
              onClick={() => onQuickAction('new-plan')}
           />
           <ActionCard 
              title="The Squad" 
              description="Roster & Stats"
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>}
              color="text-orange-400"
              bg="bg-orange-500/10"
              border="hover:border-orange-500/50"
              onClick={() => onQuickAction('open-locker-room')}
           />
           <ActionCard 
              title="The Office" 
              description="Billing & Admin"
              icon={<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>}
              color="text-pink-400"
              bg="bg-pink-500/10"
              border="hover:border-pink-500/50"
              onClick={() => onQuickAction('open-office')}
           />
        </div>

        {/* Jump Back In (Recents) */}
        <div className="space-y-6">
           <div className="flex items-center gap-3">
              <div className="h-1.5 w-1.5 rounded-full bg-primary glow-primary" />
              <h2 className="text-xs font-black uppercase tracking-[0.3em] text-muted-foreground">Jump Back In</h2>
           </div>
           
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Recent Players */}
              <div className="space-y-4">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 px-1">Active Roster</h3>
                 <div className="space-y-2">
                    {recents.players.slice(0, 3).map(p => (
                       <button 
                          key={p.id} 
                          onClick={() => onSelectRecent('player', p.id)}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl glass-card hover:bg-white/5 transition-all group"
                       >
                          <div className="h-10 w-10 rounded-xl bg-secondary flex items-center justify-center text-xs font-bold text-muted-foreground group-hover:text-foreground group-hover:scale-110 transition-all border border-white/5" style={{ backgroundColor: p.avatarColor }}>
                             {p.name.substring(0, 2)}
                          </div>
                          <div className="text-left">
                             <div className="text-sm font-black text-foreground uppercase tracking-tight">{p.name}</div>
                             <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{p.level}</div>
                          </div>
                       </button>
                    ))}
                    {recents.players.length === 0 && <div className="text-[10px] text-muted-foreground italic pl-2">No active players</div>}
                 </div>
              </div>

              {/* Recent Drills */}
              <div className="space-y-4">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 px-1">Recent Drills</h3>
                 <div className="space-y-2">
                    {recents.drills.slice(0, 3).map(d => (
                       <button 
                          key={d.id} 
                          onClick={() => onSelectRecent('drill', d.id!)}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl glass-card hover:bg-white/5 transition-all group"
                       >
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-all border border-primary/10">
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 19l7-7 3 3-7 7-3-3z"/><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z"/></svg>
                          </div>
                          <div className="text-left flex-1 min-w-0">
                             <div className="text-sm font-black text-foreground truncate uppercase tracking-tight">{d.name}</div>
                             <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{d.format} • {d.intensity}</div>
                          </div>
                       </button>
                    ))}
                    {recents.drills.length === 0 && <div className="text-[10px] text-muted-foreground italic pl-2">No recent drills</div>}
                 </div>
              </div>

              {/* Recent Plans */}
              <div className="space-y-4">
                 <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground opacity-50 px-1">Session Plans</h3>
                 <div className="space-y-2">
                    {recents.plans.slice(0, 3).map(p => (
                       <button 
                          key={p.id} 
                          onClick={() => onSelectRecent('plan', p.id)}
                          className="w-full flex items-center gap-4 p-4 rounded-2xl glass-card hover:bg-white/5 transition-all group"
                       >
                          <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-all border border-emerald-500/10">
                             <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                          </div>
                          <div className="text-left flex-1 min-w-0">
                             <div className="text-sm font-black text-foreground truncate uppercase tracking-tight">{p.name}</div>
                             <div className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{p.items?.length || 0} Drills</div>
                          </div>
                       </button>
                    ))}
                    {recents.plans.length === 0 && <div className="text-[10px] text-muted-foreground italic pl-2">No recent plans</div>}
                 </div>
              </div>
           </div>
        </div>

        {/* System Status Footer */}
        <div className="pt-8 border-t border-border/10">
           <div className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full glass border border-emerald-500/10 text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
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
            "group relative flex flex-col items-start text-left p-8 rounded-[2rem] glass-card hover:bg-white/5 transition-all duration-500 hover:-translate-y-2 overflow-hidden",
            border
         )}
      >
         <div className={cn("absolute inset-0 opacity-10 transition-opacity duration-700", bg)} />
         
         <div className={cn("relative p-4 rounded-2xl glass ring-1 ring-white/10 mb-6 transition-all duration-500 shadow-2xl group-hover:scale-110 group-hover:rotate-3", color)}>
            {icon}
         </div>
         
         <div className="relative space-y-2">
            <h3 className="font-black text-xl text-foreground transition-colors uppercase italic tracking-tighter">
               {title}
            </h3>
            <p className="text-[10px] text-muted-foreground leading-relaxed font-black uppercase tracking-[0.2em] opacity-50 group-hover:opacity-100 transition-opacity">
               {description}
            </p>
         </div>
      </button>
   )
}