import React, { useState, useMemo, useEffect } from 'react';
import { cn, nanoid, nowMs } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Player, SessionLog, Term, TrainingSession } from '@/lib/playbook';
import { computeTotalScore, ScoreData, calculateAttendanceStreak } from '@/lib/analytics';
import { ChevronLeft, ChevronRight, Edit2, CheckCircle2, Trophy, Flame, Target, Minus, Plus, ListOrdered, Medal, ArrowUpDown } from 'lucide-react';

interface ScoreboardProps {
  players: Player[];
  logs: SessionLog[];
  sessions: TrainingSession[];
  onUpsertLog: (log: SessionLog) => void;
  onNavigateHome: () => void;
}

const METRIC_DESCRIPTIONS: Record<string, Record<string, string>> = {
  Technique: {
    Beginner: "Grips, stance, contact point",
    Intermediate: "Swing shape, spin generation, fluidity",
    Advanced: "Biomechanics, kinetic chain, efficiency"
  },
  Consistency: {
    Beginner: "Making contact, clearing the net",
    Intermediate: "Rally tolerance, directional control",
    Advanced: "High-percentage play under pressure"
  },
  Tactics: {
    Beginner: "Keeping ball in play, basic direction",
    Intermediate: "Ward patterns, court zones, depth",
    Advanced: "Shot selection, neutralizing vs attacking"
  },
  Movement: {
    Beginner: "Recovery to center, ready position",
    Intermediate: "Split step, spacing, footwork patterns",
    Advanced: "Explosiveness, end-range balance"
  },
  Coachability: {
    Beginner: "Listening, effort, engagement",
    Intermediate: "Application of feedback, focus",
    Advanced: "Professionalism, problem solving, grit"
  }
};

export function Scoreboard({ players, logs, sessions, onUpsertLog, onNavigateHome }: ScoreboardProps) {
  const [viewMode, setViewMode] = useState<'daily' | 'leaderboard'>('daily');
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toLocaleDateString('en-CA'));
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);
  
  // Leaderboard Sorting
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'total', direction: 'desc' });

  // -- Derived State --
  const todaysLogs = useMemo(() => logs.filter(l => l.date === selectedDate), [logs, selectedDate]);
  const loggedPlayerIds = useMemo(() => new Set(todaysLogs.map(l => l.playerId)), [todaysLogs]);
  
  const queue = useMemo(() => {
     return players.filter(p => p.account?.status !== 'Inactive').sort((a,b) => a.name.localeCompare(b.name));
  }, [players]);

  const leaderboardData = useMemo(() => {
     return players
        .filter(p => p.account?.status !== 'Inactive')
        .map(p => {
           const streak = calculateAttendanceStreak(p.id, sessions);
           const total = (p.stats.tech + p.stats.consistency + p.stats.tactics + p.stats.movement) / 4;
           return {
              ...p,
              streak,
              total: Math.round(total)
           };
        })
        .sort((a, b) => {
           const aVal = sortConfig.key === 'name' ? a.name : sortConfig.key === 'streak' ? a.streak : (a as any).stats[sortConfig.key] || (a as any)[sortConfig.key] || 0;
           const bVal = sortConfig.key === 'name' ? b.name : sortConfig.key === 'streak' ? b.streak : (b as any).stats[sortConfig.key] || (b as any)[sortConfig.key] || 0;
           
           if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
           if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
           return 0;
        });
  }, [players, sessions, sortConfig]);

  const progress = {
    logged: loggedPlayerIds.size,
    total: queue.length
  };

  const handleSelectPlayer = (playerId: string) => {
    setSelectedPlayerId(playerId);
    // On mobile, open drawer. On desktop, just selection state updates the right pane.
    if (window.innerWidth < 1024) {
       setIsMobileDrawerOpen(true);
    }
  };

  const handleDateChange = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toLocaleDateString('en-CA'));
  };

  const handleSort = (key: string) => {
     setSortConfig(current => ({
        key,
        direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
     }));
  };

  const activePlayer = players.find(p => p.id === selectedPlayerId);
  const activeLog = todaysLogs.find(l => l.playerId === selectedPlayerId);

  return (
    <div className="flex-1 flex flex-col h-full bg-background relative overflow-hidden animate-in fade-in duration-300">
      
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border bg-card/50 backdrop-blur-sm z-10 flex flex-col gap-4">
        <div className="flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onNavigateHome}>
                 <ChevronLeft className="w-5 h-5" />
              </Button>
              <div>
                 <h1 className="text-xl font-black uppercase tracking-tighter text-foreground">The Scoreboard</h1>
                 <p className="text-[10px] text-muted-foreground font-bold tracking-widest uppercase">Performance Tracking</p>
              </div>
           </div>
           
           <div className="flex bg-secondary/50 rounded-lg p-1 shrink-0">
              <button onClick={() => setViewMode('daily')} className={cn("px-3 py-1 text-xs font-bold rounded-md transition-all", viewMode === 'daily' && "bg-background shadow text-primary")}>Daily Log</button>
              <button onClick={() => setViewMode('leaderboard')} className={cn("px-3 py-1 text-xs font-bold rounded-md transition-all", viewMode === 'leaderboard' && "bg-background shadow text-primary")}>Leaderboard</button>
           </div>
        </div>

        {viewMode === 'daily' && (
           <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between">
                 <div className="flex items-center gap-2 bg-secondary/50 rounded-lg p-1">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDateChange(-1)}><ChevronLeft className="w-3 h-3" /></Button>
                    <div className="text-xs font-mono font-bold w-20 text-center">
                       {selectedDate === new Date().toLocaleDateString('en-CA') ? "TODAY" : selectedDate}
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => handleDateChange(1)}><ChevronRight className="w-3 h-3" /></Button>
                 </div>
                 <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    <span className={cn(progress.logged === progress.total ? "text-emerald-400" : "text-foreground")}>
                       {progress.logged} / {progress.total} Logged
                    </span>
                 </div>
              </div>
              <div className="h-1.5 w-full bg-secondary rounded-full overflow-hidden">
                 <div 
                    className="h-full bg-primary transition-all duration-500 ease-out" 
                    style={{ width: `${Math.min(100, (progress.logged / Math.max(1, progress.total)) * 100)}%` }} 
                 />
              </div>
           </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-hidden relative">
         
         {/* VIEW: LEADERBOARD */}
         {viewMode === 'leaderboard' && (
            <div className="absolute inset-0 overflow-auto p-4 md:p-8 animate-in fade-in zoom-in-95 duration-200">
               <div className="max-w-5xl mx-auto">
                  <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
                     {/* Table Header */}
                     <div className="grid grid-cols-[3rem_2fr_1fr_1fr_1fr_1fr_1fr] md:grid-cols-[4rem_2fr_repeat(5,1fr)] bg-secondary/30 border-b border-border text-[10px] font-black uppercase tracking-widest text-muted-foreground sticky top-0 backdrop-blur-md z-10">
                        <div className="p-4 text-center">#</div>
                        <div className="p-4 cursor-pointer hover:text-foreground flex items-center gap-1" onClick={() => handleSort('name')}>
                           Player <ArrowUpDown className="w-3 h-3" />
                        </div>
                        <div className="p-4 text-center cursor-pointer hover:text-foreground hidden md:block" onClick={() => handleSort('tech')}>Tech</div>
                        <div className="p-4 text-center cursor-pointer hover:text-foreground hidden md:block" onClick={() => handleSort('tactics')}>Tact</div>
                        <div className="p-4 text-center cursor-pointer hover:text-foreground hidden md:block" onClick={() => handleSort('movement')}>Move</div>
                        <div className="p-4 text-center cursor-pointer hover:text-foreground hidden md:block" onClick={() => handleSort('consistency')}>Cons</div>
                        <div className="p-4 text-center cursor-pointer hover:text-foreground flex items-center justify-center gap-1" onClick={() => handleSort('streak')}>
                           <Flame className="w-3 h-3 text-orange-500" /> Streak
                        </div>
                     </div>

                     {/* Table Body */}
                     <div className="divide-y divide-border/50">
                        {leaderboardData.map((player, idx) => (
                           <div key={player.id} className="grid grid-cols-[3rem_2fr_1fr_1fr_1fr_1fr_1fr] md:grid-cols-[4rem_2fr_repeat(5,1fr)] hover:bg-white/5 transition-colors group items-center">
                              <div className="p-4 text-center font-black text-muted-foreground flex justify-center">
                                 {idx === 0 ? <Medal className="w-5 h-5 text-yellow-400" /> : 
                                  idx === 1 ? <Medal className="w-5 h-5 text-slate-400" /> : 
                                  idx === 2 ? <Medal className="w-5 h-5 text-amber-700" /> : 
                                  idx + 1}
                              </div>
                              <div className="p-4 flex items-center gap-3">
                                 <div className="h-8 w-8 rounded-full flex items-center justify-center font-bold text-xs bg-secondary shrink-0">
                                    {player.name.substring(0,2)}
                                 </div>
                                 <div className="font-bold text-sm">{player.name}</div>
                              </div>
                              
                              {/* Stats Columns */}
                              <div className="p-4 text-center font-mono font-bold text-sm hidden md:block">{player.stats.tech}</div>
                              <div className="p-4 text-center font-mono font-bold text-sm hidden md:block">{player.stats.tactics}</div>
                              <div className="p-4 text-center font-mono font-bold text-sm hidden md:block">{player.stats.movement}</div>
                              <div className="p-4 text-center font-mono font-bold text-sm hidden md:block">{player.stats.consistency}</div>
                              
                              <div className="p-4 text-center font-black text-orange-500 flex justify-center items-center gap-1">
                                 {player.streak} <span className="text-[10px] text-muted-foreground font-medium uppercase">Wks</span>
                              </div>
                           </div>
                        ))}
                     </div>
                  </div>
               </div>
            </div>
         )}

         {/* VIEW: DAILY LOG */}
         {viewMode === 'daily' && (
            <div className="flex-1 flex h-full">
               {/* Left Column: The Queue */}
               <div className={cn(
                  "flex-1 overflow-y-auto p-4 space-y-2 lg:border-r border-border transition-all",
                  "lg:max-w-md xl:max-w-lg" // Desktop width constraint
               )}>
                  {queue.map(player => {
                     const isLogged = loggedPlayerIds.has(player.id);
                     const existingLog = todaysLogs.find(l => l.playerId === player.id);
                     const isSelected = selectedPlayerId === player.id;
                     
                     return (
                        <div 
                           key={player.id} 
                           onClick={() => handleSelectPlayer(player.id)}
                           className={cn(
                              "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer",
                              isSelected ? "bg-primary/5 border-primary ring-1 ring-primary/20" : isLogged ? "bg-emerald-500/5 border-emerald-500/20" : "bg-card border-border hover:border-primary/50"
                           )}
                        >
                           <div className="flex items-center gap-3">
                              <div className={cn(
                                 "h-10 w-10 rounded-full flex items-center justify-center text-xs font-bold ring-1 ring-inset",
                                 isLogged ? "ring-emerald-500/30 text-emerald-500" : "ring-white/10 text-muted-foreground"
                              )}>
                                 {player.avatarUrl ? <img src={player.avatarUrl} className="h-full w-full rounded-full object-cover" /> : player.name.substring(0,2).toUpperCase()}
                              </div>
                              <div>
                                 <div className="font-bold text-sm text-foreground">{player.name}</div>
                                 <div className="text-[10px] text-muted-foreground font-medium flex gap-2">
                                    {isLogged && existingLog ? (
                                       <span className="text-emerald-400 flex items-center gap-1">
                                          <Trophy className="w-3 h-3" /> Score: {existingLog.totalScore}/10
                                       </span>
                                    ) : (
                                       <span>Ready to log</span>
                                    )}
                                 </div>
                              </div>
                           </div>

                           <Button 
                              size="sm" 
                              variant={isLogged ? "secondary" : "default"}
                              className={cn("h-8 text-xs font-bold min-w-[90px]", isLogged && "text-muted-foreground hover:text-foreground")}
                           >
                              {isLogged ? "Edit" : "Quick Rate"}
                           </Button>
                        </div>
                     )
                  })}
                  
                  {queue.length === 0 && (
                     <div className="text-center py-10 text-muted-foreground italic text-xs">No active players found.</div>
                  )}
               </div>

               {/* Right Column: Desktop Log Form */}
               <div className="hidden lg:flex flex-1 bg-card/20 items-stretch justify-center p-6 overflow-y-auto">
                  {activePlayer ? (
                     <div className="w-full max-w-2xl bg-background border border-border rounded-2xl shadow-xl flex flex-col h-fit">
                        <LogForm 
                           player={activePlayer} 
                           existingLog={activeLog} 
                           date={selectedDate} 
                           onSave={(log) => onUpsertLog(log)} 
                           onCancel={() => setSelectedPlayerId(null)}
                           embedded={true}
                        />
                     </div>
                  ) : (
                     <div className="flex flex-col items-center justify-center text-muted-foreground opacity-50 space-y-4">
                        <div className="h-20 w-20 rounded-full bg-secondary flex items-center justify-center">
                           <Edit2 className="w-8 h-8" />
                        </div>
                        <p className="text-sm font-bold uppercase tracking-widest">Select a player to log</p>
                     </div>
                  )}
               </div>
            </div>
         )}
      </div>

      {/* Mobile Drawer (Only for Daily View) */}
      {isMobileDrawerOpen && activePlayer && viewMode === 'daily' && (
         <div className="lg:hidden absolute inset-0 z-50 bg-background/95 backdrop-blur-md flex flex-col animate-in slide-in-from-bottom-full duration-300">
             <LogForm 
               player={activePlayer}
               existingLog={activeLog}
               date={selectedDate}
               onSave={(log) => { onUpsertLog(log); setIsMobileDrawerOpen(false); }}
               onCancel={() => setIsMobileDrawerOpen(false)}
             />
         </div>
      )}
    </div>
  );
}

// ... Rest of the file (LogForm, ScoreControl, CounterControl) stays the same but I need to include it or it gets cut off.
// Since I'm using `replace` with `new_string` covering the whole main component, I need to make sure I don't delete the helper components.
// The previous output of `read_file` showed them at the bottom.
// I will use `replace` targeting the `Scoreboard` function specifically.

function LogForm({ player, existingLog, date, onSave, onCancel, embedded = false }: { player: Player, existingLog?: SessionLog, date: string, onSave: (l: SessionLog) => void, onCancel: () => void, embedded?: boolean }) {
   // Form State (Re-initialize when player changes)
   const [scores, setScores] = useState<ScoreData>({ tech: 1, consistency: 1, tactics: 1, movement: 1, coachability: 1 });
   const [anchors, setAnchors] = useState({ bestStreak: 0, serveIn: 5 });
   const [note, setNote] = useState("");

   // Effect to load existing log data when switching players
   useEffect(() => {
      setScores({
         tech: existingLog?.tech ?? 1,
         consistency: existingLog?.consistency ?? 1,
         tactics: existingLog?.tactics ?? 1,
         movement: existingLog?.movement ?? 1,
         coachability: existingLog?.coachability ?? 1,
      });
      setAnchors({
         bestStreak: existingLog?.anchorBestStreak ?? 0,
         serveIn: existingLog?.anchorServeIn ?? 5,
      });
      setNote(existingLog?.note ?? "");
   }, [existingLog, player.id]); // Dependency on player.id ensures reset on switch

   const total = computeTotalScore(scores);

   const handleSave = () => {
      const log: SessionLog = {
         id: existingLog?.id ?? nanoid(),
         playerId: player.id,
         date,
         ...scores,
         totalScore: total,
         anchorBestStreak: anchors.bestStreak,
         anchorServeIn: anchors.serveIn,
         note,
         createdAt: existingLog?.createdAt ?? nowMs(),
         updatedAt: nowMs(),
      };
      onSave(log);
   };

   // Helper to get description based on player level
   const getDesc = (metric: string) => {
      const level = player.level || 'Intermediate';
      return METRIC_DESCRIPTIONS[metric]?.[level] || "";
   }

   return (
      <div className="flex flex-col h-full">
         {/* Form Header */}
         <div className="p-4 border-b border-border flex items-center justify-between bg-card/50">
            <div className="flex items-center gap-3">
               <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center font-bold text-sm">
                  {player.name.substring(0,2)}
               </div>
               <div>
                  <div className="font-black uppercase tracking-tight text-xl">{player.name}</div>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest flex gap-2">
                     <span>{date} Log</span>
                     <span className="text-primary/70">• {player.level}</span>
                  </div>
               </div>
            </div>
            <div className="flex items-center gap-4">
               <div className="text-right">
                  <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Total Score</div>
                  <div className="text-3xl font-black text-primary leading-none">{total}/10</div>
               </div>
               {!embedded && <Button variant="ghost" size="icon" onClick={onCancel}>✕</Button>}
            </div>
         </div>

         {/* Scrollable Content */}
         <div className="flex-1 overflow-y-auto p-6 space-y-8">
            
            {/* 5 Core Metrics */}
            <div className="space-y-4">
               <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                  <div className="h-1 w-4 bg-primary rounded-full" />
                  Core Metrics
               </h3>
               <div className="grid grid-cols-1 gap-3">
                  <ScoreControl label="Technique" description={getDesc("Technique")} value={scores.tech} onChange={v => setScores({...scores, tech: v})} />
                  <ScoreControl label="Consistency" description={getDesc("Consistency")} value={scores.consistency} onChange={v => setScores({...scores, consistency: v})} />
                  <ScoreControl label="Tactics" description={getDesc("Tactics")} value={scores.tactics} onChange={v => setScores({...scores, tactics: v})} />
                  <ScoreControl label="Movement" description={getDesc("Movement")} value={scores.movement} onChange={v => setScores({...scores, movement: v})} />
                  <ScoreControl label="Coachability" description={getDesc("Coachability")} value={scores.coachability} onChange={v => setScores({...scores, coachability: v})} />
               </div>
            </div>

            <div className="h-px bg-border/50" />

            {/* Anchors */}
            <div className="space-y-4">
               <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground mb-2 flex items-center gap-2">
                  <div className="h-1 w-4 bg-orange-500 rounded-full" />
                  Daily Anchors
               </h3>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <CounterControl 
                     label="Max Rally Count" 
                     subtitle="Longest exchange without error"
                     icon={<Flame className="w-4 h-4 text-orange-500" />}
                     value={anchors.bestStreak} 
                     onChange={v => setAnchors(prev => ({ ...prev, bestStreak: Math.max(0, v) }))} 
                  />
                  <CounterControl 
                     label="Serves In / 10" 
                     subtitle="First serves made (start of point)"
                     icon={<Target className="w-4 h-4 text-blue-500" />}
                     value={anchors.serveIn} 
                     onChange={v => setAnchors(prev => ({ ...prev, serveIn: Math.max(0, Math.min(10, v)) }))} 
                  />
               </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
               <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Session Insight</label>
               <textarea 
                  className="w-full h-24 bg-card border border-border rounded-xl p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all placeholder:text-muted-foreground/50"
                  placeholder={`What was ${player.name.split(' ')[0]}'s key breakthrough or struggle today?`}
                  value={note}
                  onChange={e => setNote(e.target.value)}
               />
            </div>

         </div>

         {/* Footer Actions */}
         <div className="p-4 border-t border-border bg-card/50 flex gap-3">
            <Button variant="secondary" className="flex-1 h-12 text-sm font-bold" onClick={onCancel}>Cancel</Button>
            <Button className="flex-[2] h-12 text-sm font-black tracking-wide bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20" onClick={handleSave}>
               {existingLog ? "Update Log" : "Save Log"}
            </Button>
         </div>
      </div>
   );
}

function ScoreControl({ label, description, value, onChange }: { label: string, description?: string, value: number, onChange: (v: number) => void }) {
   return (
      <div className="flex flex-col md:flex-row md:items-center justify-between p-3 rounded-xl bg-card border border-border/50 gap-3 hover:border-primary/30 transition-colors">
         <div className="flex flex-col gap-0.5">
            <span className="text-sm font-bold text-foreground">{label}</span>
            {description && (
               <span className="text-[10px] text-muted-foreground italic leading-tight">{description}</span>
            )}
         </div>
         <div className="flex gap-1 shrink-0">
            {[0, 1, 2].map(score => (
               <button
                  key={score}
                  onClick={() => onChange(score)}
                  className={cn(
                     "h-9 w-12 rounded-lg text-sm font-bold transition-all border",
                     value === score 
                        ? "bg-primary text-primary-foreground border-primary scale-105 shadow-md" 
                        : "bg-secondary text-muted-foreground border-transparent hover:bg-secondary/80"
                  )}
               >
                  {score}
               </button>
            ))}
         </div>
      </div>
   )
}

function CounterControl({ label, subtitle, icon, value, onChange }: { label: string, subtitle?: string, icon?: React.ReactNode, value: number, onChange: (v: number) => void }) {
   return (
      <div className="bg-card border border-border/50 rounded-xl p-4 flex flex-col gap-3">
         <div className="flex items-center gap-2">
            {icon}
            <div>
               <div className="text-xs font-bold uppercase tracking-wider">{label}</div>
               {subtitle && <div className="text-[10px] text-muted-foreground leading-tight">{subtitle}</div>}
            </div>
         </div>
         <div className="flex items-center justify-between bg-background rounded-lg border border-border p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-secondary" onClick={() => onChange(value - 1)}>
               <Minus className="w-4 h-4" />
            </Button>
            <div className="flex-1 text-center font-mono text-xl font-black">{value}</div>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md hover:bg-secondary" onClick={() => onChange(value + 1)}>
               <Plus className="w-4 h-4" />
            </Button>
         </div>
      </div>
   )
}