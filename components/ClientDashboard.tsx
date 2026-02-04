import React, { useState } from 'react';
import { LogOut, Calendar, CreditCard, Activity, User, ChevronRight, Clock, MapPin, Trophy, ChevronLeft, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Client, Player, TrainingSession, SessionLog, Drill } from '@/lib/playbook';
import { RadarChart } from '@/components/RadarChart';
import { ProgressChart } from '@/components/ProgressChart';

interface ClientDashboardProps {
  client: Client;
  players: Player[];
  sessions: TrainingSession[];
  logs: SessionLog[];
  drills: Drill[];
  onLogout: () => void;
}

export function ClientDashboard({ client, players, sessions, logs, drills, onLogout }: ClientDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'financials'>('overview');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());

  // Derived Data
  const myPlayers = players
    .filter(p => p.clientId === client.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  
  const upcomingSessions = sessions
    .filter(s => 
      s.participantIds.some(pid => myPlayers.map(p => p.id).includes(pid)) &&
      new Date(s.date + 'T' + s.startTime) >= new Date()
    )
    .sort((a, b) => new Date(a.date + 'T' + a.startTime).getTime() - new Date(b.date + 'T' + b.startTime).getTime())
    .slice(0, 5); // Next 5

  const selectedPlayer = myPlayers.find(p => p.id === selectedPlayerId);
  const playerLogs = selectedPlayer 
    ? logs
        .filter(l => l.playerId === selectedPlayer.id && l.isSharedWithParent)
        .sort((a,b) => b.createdAt - a.createdAt) 
    : [];

  const handlePlayerClick = (pid: string) => {
    setSelectedPlayerId(pid);
    setActiveTab('overview');
  };

  // --- Financial Logic ---
  const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const nextMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1);
  const clientPlayerIds = new Set(myPlayers.map(p => p.id));

  // 1. Opening Balance
  let openingFees = 0;
  let openingPayments = 0;
  sessions.forEach(s => {
      const sDate = new Date(s.date);
      if (sDate < currentMonthStart && s.participantIds.some(pid => clientPlayerIds.has(pid))) {
          const count = s.participantIds.filter(pid => clientPlayerIds.has(pid)).length;
          openingFees += (s.price || 0) * count;
      }
  });
  (client.payments || []).forEach(p => {
      if (new Date(p.date) < currentMonthStart) openingPayments += p.amount;
  });
  const openingBalance = openingFees - openingPayments;

  // 2. Current Month Transactions
  const monthlySessions = sessions.filter(s => {
      const d = new Date(s.date);
      return d >= currentMonthStart && d < nextMonthStart && s.participantIds.some(pid => clientPlayerIds.has(pid));
  });
  
  let currentFees = 0;
  monthlySessions.forEach(s => {
      const count = s.participantIds.filter(pid => clientPlayerIds.has(pid)).length;
      currentFees += (s.price || 0) * count;
  });
  
  const monthlyPayments = (client.payments || []).filter(p => {
      const d = new Date(p.date);
      return d >= currentMonthStart && d < nextMonthStart;
  });
  const currentPaymentTotal = monthlyPayments.reduce((acc, p) => acc + p.amount, 0);
  
  const closingBalance = openingBalance + currentFees - currentPaymentTotal;

  return (
    <div className="flex flex-col h-screen bg-radial-gradient text-foreground font-sans overflow-hidden">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-background/60 backdrop-blur-xl border-b border-white/5 shadow-sm sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/vgta-icon.svg"
            alt="VGTA"
            className="h-10 w-10 rounded-xl shadow-lg glow-primary"
          />
          <div>
            <h1 className="font-black text-lg leading-tight tracking-tight text-gradient uppercase">VGTA</h1>
            <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-80">Client Portal</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="text-right hidden sm:block">
              <div className="text-sm font-bold">{client.name}</div>
              <div className="text-xs text-muted-foreground">{client.email}</div>
           </div>
           <Button variant="ghost" size="sm" onClick={onLogout} className="text-muted-foreground hover:text-red-500 hover:bg-red-500/10">
             <LogOut className="w-4 h-4 mr-2" />
             <span className="hidden sm:inline">Sign Out</span>
           </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Navigation (Desktop) */}
        <aside className="w-64 bg-card/30 backdrop-blur-sm border-r border-white/5 hidden md:flex flex-col p-4 gap-2">
            <div className="pb-4">
               <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 px-3">Menu</h3>
               <nav className="space-y-1">
                  <Button 
                    variant={activeTab === 'overview' && !selectedPlayerId ? 'secondary' : 'ghost'} 
                    className="w-full justify-start font-bold" 
                    onClick={() => { setActiveTab('overview'); setSelectedPlayerId(null); }}
                  >
                     <Activity className="w-4 h-4 mr-2 opacity-70" />
                     Overview
                  </Button>
                  <Button 
                    variant={activeTab === 'schedule' ? 'secondary' : 'ghost'} 
                    className="w-full justify-start font-bold" 
                    onClick={() => { setActiveTab('schedule'); setSelectedPlayerId(null); }}
                  >
                     <Calendar className="w-4 h-4 mr-2 opacity-70" />
                     Schedule
                  </Button>
                  <Button 
                    variant={activeTab === 'financials' ? 'secondary' : 'ghost'} 
                    className="w-full justify-start font-bold" 
                    onClick={() => { setActiveTab('financials'); setSelectedPlayerId(null); }}
                  >
                     <CreditCard className="w-4 h-4 mr-2 opacity-70" />
                     Financials
                  </Button>
               </nav>
            </div>

            <div className="pb-4 flex-1">
               <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 px-3">Athletes</h3>
               <div className="space-y-1">
                  {myPlayers.map(p => (
                     <Button 
                        key={p.id}
                        variant={selectedPlayerId === p.id ? 'secondary' : 'ghost'} 
                        className="w-full justify-start group font-bold"
                        onClick={() => handlePlayerClick(p.id)}
                     >
                        <div className="w-6 h-6 rounded-full border border-white/10 flex items-center justify-center text-xs font-bold mr-2 text-white shadow-sm" style={{ backgroundColor: p.avatarColor }}>
                           {p.name.charAt(0)}
                        </div>
                        <span className="truncate">{p.name}</span>
                        {selectedPlayerId === p.id && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
                     </Button>
                  ))}
               </div>
            </div>
            
            <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl">
               <p className="text-xs text-primary font-bold mb-1">Need to reschedule?</p>
               <p className="text-[10px] text-muted-foreground leading-relaxed">
                  Please contact the academy office at least 24 hours in advance.
               </p>
            </div>
        </aside>

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto bg-transparent p-4 md:p-8 pb-24 md:pb-8 no-scrollbar">
           {selectedPlayer ? (
              // PLAYER DETAIL VIEW
              <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="flex items-center gap-4 mb-6">
                    <Button variant="outline" size="sm" onClick={() => setSelectedPlayerId(null)} className="md:hidden">
                       Back
                    </Button>
                    <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-xl" style={{ backgroundColor: selectedPlayer.avatarColor }}>
                       {selectedPlayer.name.charAt(0)}
                    </div>
                    <div>
                       <h2 className="text-3xl font-black text-white tracking-tight">{selectedPlayer.name}</h2>
                       <div className="flex gap-2 text-sm text-muted-foreground">
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-bold text-[10px] uppercase tracking-wider border border-white/5">
                             {selectedPlayer.level}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-bold text-[10px] uppercase tracking-wider border border-white/5">
                             {selectedPlayer.playStyle || 'All-Court'}
                          </span>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Stats Card */}
                    <div className="glass-card rounded-2xl p-6 border-white/5">
                       <h3 className="font-black text-muted-foreground uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-primary" />
                          Performance Analysis
                       </h3>
                       <div className="h-64 flex items-center justify-center">
                          <RadarChart stats={selectedPlayer.stats} />
                       </div>
                    </div>

                    {/* Recent Logs Card */}
                    <div className="glass-card rounded-2xl p-6 border-white/5 flex flex-col">
                       <h3 className="font-black text-muted-foreground uppercase tracking-widest text-xs mb-4 flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-yellow-500" />
                          Recent Sessions
                       </h3>
                       <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 max-h-64">
                          {playerLogs.length > 0 ? playerLogs.map(log => (
                             <div key={log.id} className="p-3 rounded-xl bg-card/50 border border-white/5 hover:bg-card/80 transition-colors">
                                <div className="flex justify-between items-center mb-1">
                                   <div className="flex flex-col">
                                      <span className="text-xs font-bold text-muted-foreground">{log.date}</span>
                                      {log.effort && (
                                         <div className="flex gap-0.5 mt-0.5">
                                            {[1,2,3,4,5].map(v => (
                                               <div key={v} className={cn("w-1.5 h-1.5 rounded-full", log.effort >= v ? "bg-orange-500" : "bg-white/10")} />
                                            ))}
                                         </div>
                                      )}
                                   </div>
                                   <span className="text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/30 px-2 py-0.5 rounded-full">
                                      {log.totalScore}/10
                                   </span>
                                </div>
                                {log.note && (
                                   <p className="text-[11px] text-foreground mt-2 leading-relaxed italic">"{log.note}"</p>
                                )}
                                {log.nextFocus && (
                                   <p className="text-[10px] text-muted-foreground mt-2">
                                      <span className="font-bold text-primary uppercase tracking-widest">Next Focus:</span> {log.nextFocus}
                                   </p>
                                )}
                             </div>
                          )) : (
                             <div className="text-center py-10 text-sm text-muted-foreground italic">No shared session reports yet.</div>
                          )}
                       </div>
                    </div>
                 </div>

                 {/* Progress Chart */}
                 <div className="glass-card rounded-2xl p-6 border-white/5">
                    <h3 className="font-black text-muted-foreground uppercase tracking-widest text-xs mb-4">Progress History</h3>
                    <div className="h-64 w-full">
                       <ProgressChart data={playerLogs.map(l => ({ ...l, total: l.totalScore }))} />
                    </div>
                 </div>

                 {/* Homework / Assigned Drills */}
                 {selectedPlayer.assignedDrills.length > 0 && (
                     <div className="glass-card rounded-2xl p-6 border-white/5">
                        <h3 className="font-black text-muted-foreground uppercase tracking-widest text-xs mb-4">Assigned Homework</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                           {selectedPlayer.assignedDrills.map(did => {
                              const drill = drills.find(d => d.id === did);
                              if (!drill) return null;
                              return (
                                 <div key={did} className="p-4 rounded-xl border border-white/10 bg-card/30 hover:bg-card/50 transition-colors">
                                    <div className="font-bold text-sm mb-1">{drill.name}</div>
                                    <div className="text-xs text-muted-foreground line-clamp-2">{drill.description}</div>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                 )}
              </div>

           ) : activeTab === 'schedule' ? (
              // SCHEDULE VIEW
              <div className="max-w-3xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">Upcoming Schedule</h2>
                 <div className="space-y-4">
                    {upcomingSessions.length > 0 ? upcomingSessions.map(session => {
                       const participantNames = session.participantIds
                          .map(pid => players.find(p => p.id === pid)?.name)
                          .filter(Boolean)
                          .join(", ");
                       
                       return (
                          <div key={session.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 glass-card rounded-2xl border-white/5 hover:border-primary/30 transition-colors">
                             <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-card border border-white/10 flex flex-col items-center justify-center text-primary shadow-lg">
                                <span className="text-[10px] font-black uppercase tracking-widest">{new Date(session.date).toLocaleString('default', { month: 'short' })}</span>
                                <span className="text-2xl font-black">{new Date(session.date).getDate()}</span>
                             </div>
                             <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                   <span className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border",
                                      session.type === 'Private' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                      session.type === 'Group' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" :
                                      "bg-orange-500/10 text-orange-400 border-orange-500/20"
                                   )}>
                                      {session.type}
                                   </span>
                                   <span className="text-xs text-muted-foreground font-bold font-mono flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {session.startTime} - {session.endTime}
                                   </span>
                                </div>
                                <h3 className="font-bold text-lg">{participantNames}</h3>
                                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                   <MapPin className="w-3 h-3" />
                                   {session.location}
                                </div>
                             </div>
                          </div>
                       );
                    }) : (
                       <div className="text-center py-20 glass-card rounded-3xl border-dashed border-white/10">
                          <Calendar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                          <p className="text-muted-foreground font-bold">No upcoming sessions scheduled.</p>
                       </div>
                    )}
                 </div>
              </div>

           ) : activeTab === 'financials' ? (
              // FINANCIALS VIEW
              <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="flex items-center justify-between">
                     <h2 className="text-2xl font-black text-white uppercase tracking-tight">Financial Statement</h2>
                     <div className="flex items-center bg-card border border-white/10 rounded-lg p-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}>
                           <ChevronLeft className="w-4 h-4" />
                        </Button>
                        <div className="px-4 font-bold text-sm min-w-[120px] text-center">
                           {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}>
                           <ChevronRight className="w-4 h-4" />
                        </Button>
                     </div>
                 </div>

                 {/* Summary Cards */}
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     <div className="glass-card p-4 rounded-xl border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Brought Forward</div>
                        <div className={cn("text-lg font-black font-mono", openingBalance !== 0 ? "text-foreground" : "text-muted-foreground")}>R {openingBalance.toLocaleString()}</div>
                     </div>
                     <div className="glass-card p-4 rounded-xl border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Fees (This Month)</div>
                        <div className="text-lg font-black font-mono">R {currentFees.toLocaleString()}</div>
                     </div>
                     <div className="glass-card p-4 rounded-xl border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Paid</div>
                        <div className="text-lg font-black font-mono text-emerald-400">R {currentPaymentTotal.toLocaleString()}</div>
                     </div>
                     <div className="glass-card p-4 rounded-xl border-white/5 bg-primary/5 border-primary/20">
                        <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Closing Balance</div>
                        <div className={cn("text-lg font-black font-mono", closingBalance > 0 ? "text-red-400" : "text-foreground")}>R {closingBalance.toLocaleString()}</div>
                     </div>
                 </div>
                 
                 <div className="glass-card rounded-2xl border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-card/30 flex justify-between items-center">
                        <h3 className="font-bold text-sm">Transaction History</h3>
                        <Button variant="outline" size="sm" className="h-7 text-xs gap-2">
                           <Download className="w-3 h-3" /> PDF
                        </Button>
                    </div>
                    <div className="divide-y divide-white/5">
                       {/* Merge Sessions and Payments for list view */}
                       {[
                           ...monthlySessions.map(s => ({ 
                               type: 'session', 
                               date: s.date, 
                               desc: `${s.type} Session`, 
                               amount: (s.price || 0) * s.participantIds.filter(pid => clientPlayerIds.has(pid)).length,
                               isCredit: false 
                           })),
                           ...monthlyPayments.map(p => ({ 
                               type: 'payment', 
                               date: p.date, 
                               desc: `Payment (${p.reference || 'Ref'})`, 
                               amount: p.amount,
                               isCredit: true 
                           }))
                       ].sort((a,b) => a.date.localeCompare(b.date)).length > 0 ? (
                           [
                              ...monthlySessions.map(s => ({ 
                                  id: s.id,
                                  type: 'session', 
                                  date: s.date, 
                                  desc: `${s.type} Session`, 
                                  amount: (s.price || 0) * s.participantIds.filter(pid => clientPlayerIds.has(pid)).length,
                                  isCredit: false 
                              })),
                              ...monthlyPayments.map(p => ({ 
                                  id: p.id,
                                  type: 'payment', 
                                  date: p.date, 
                                  desc: `Payment - ${p.reference || 'Ref'}`, 
                                  amount: p.amount,
                                  isCredit: true 
                              }))
                           ]
                           .sort((a,b) => a.date.localeCompare(b.date))
                           .map((item, idx) => (
                              <div key={idx} className="grid grid-cols-[100px_1fr_100px] gap-4 p-4 text-sm hover:bg-white/5 transition-colors items-center">
                                 <div className="font-mono text-xs text-muted-foreground">{item.date}</div>
                                 <div className="font-medium text-foreground">{item.desc}</div>
                                 <div className={cn("font-bold font-mono text-right", item.isCredit ? "text-emerald-400" : "text-foreground")}>
                                    {item.isCredit ? '-' : ''} R {item.amount}
                                 </div>
                              </div>
                           ))
                       ) : (
                          <div className="p-8 text-center text-muted-foreground text-sm italic">No transactions for this period.</div>
                       )}
                    </div>
                 </div>
              </div>

           ) : (
              // OVERVIEW (Dashboard Home)
              <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">Welcome, {client.name.split(' ')[0]}</h2>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Next Session Card */}
                    <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-3xl p-6 text-white shadow-2xl relative overflow-hidden group">
                       <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-white/20 transition-colors duration-700" />
                       <div className="relative z-10">
                          <h3 className="font-bold text-indigo-200 mb-1 flex items-center gap-2 uppercase tracking-wider text-xs">
                             <Calendar className="w-4 h-4" /> Next Session
                          </h3>
                          {upcomingSessions[0] ? (
                             <>
                                <div className="text-4xl font-black mt-2 mb-1">
                                   {new Date(upcomingSessions[0].date).toLocaleDateString('en-US', { weekday: 'long' })}
                                </div>
                                <div className="text-lg text-indigo-100 mb-6 font-medium">
                                   {upcomingSessions[0].startTime} @ {upcomingSessions[0].location}
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                   {upcomingSessions[0].participantIds.map(pid => {
                                      const p = players.find(x => x.id === pid);
                                      return p ? (
                                         <span key={pid} className="px-3 py-1 rounded-full bg-white/20 text-xs font-bold backdrop-blur-md border border-white/10">
                                            {p.name}
                                         </span>
                                      ) : null;
                                   })}
                                </div>
                             </>
                          ) : (
                             <div className="py-8 text-indigo-100 italic">No upcoming sessions.</div>
                          )}
                       </div>
                    </div>

                    {/* Quick Stats / Summary */}
                    <div className="grid grid-cols-2 gap-4">
                       <div className="glass-card p-5 rounded-2xl border-white/5 flex flex-col justify-center hover:bg-card/40 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-orange-500/20 flex items-center justify-center text-orange-500 mb-3">
                             <User className="w-5 h-5" />
                          </div>
                          <div className="text-3xl font-black">{myPlayers.length}</div>
                          <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Athletes</div>
                       </div>
                       <div className="glass-card p-5 rounded-2xl border-white/5 flex flex-col justify-center hover:bg-card/40 transition-colors">
                          <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center text-green-500 mb-3">
                             <Activity className="w-5 h-5" />
                          </div>
                          <div className="text-3xl font-black">{sessions.length}</div>
                          <div className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Total Sessions</div>
                       </div>
                       <div className="col-span-2 glass-card p-5 rounded-2xl border-white/5">
                          <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-3">Your Athletes</h3>
                          <div className="space-y-2">
                             {myPlayers.map(p => (
                                <div 
                                   key={p.id} 
                                   onClick={() => handlePlayerClick(p.id)}
                                   className="flex items-center justify-between p-2 hover:bg-white/5 rounded-lg cursor-pointer transition-colors group"
                                >
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full border border-white/10 flex items-center justify-center text-xs font-bold text-white shadow-sm" style={{ backgroundColor: p.avatarColor }}>
                                         {p.name.charAt(0)}
                                      </div>
                                      <div>
                                         <div className="text-sm font-bold">{p.name}</div>
                                         <div className="text-[10px] text-muted-foreground">{p.level}</div>
                                      </div>
                                   </div>
                                   <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Recent Activity Feed */}
                 <div className="mb-8">
                     <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">Recent Activity</h3>
                     <div className="space-y-3">
                        {myPlayers.flatMap(p => 
                           logs
                              .filter(l => l.playerId === p.id && l.isSharedWithParent)
                              .map(l => ({ ...l, playerName: p.name }))
                        )
                        .sort((a,b) => b.createdAt - a.createdAt)
                        .slice(0, 5)
                        .map(log => (
                           <div key={log.id} className="glass-card p-4 rounded-xl border-white/5 flex items-center gap-4 hover:border-primary/20 transition-colors">
                              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs border border-primary/20">
                                 {log.totalScore}
                              </div>
                              <div className="flex-1">
                                 <div className="flex justify-between">
                                    <span className="font-bold text-sm">{log.playerName}</span>
                                    <span className="text-xs text-muted-foreground font-mono">{log.date}</span>
                                 </div>
                                 <p className="text-xs text-muted-foreground line-clamp-1 italic">"{log.note || "Session report shared."}"</p>
                              </div>
                           </div>
                        ))}
                        {myPlayers.flatMap(p => logs.filter(l => l.playerId === p.id && l.isSharedWithParent)).length === 0 && (
                           <div className="py-10 text-center text-sm text-muted-foreground italic">No recent activity shared.</div>
                        )}
                     </div>
                 </div>
              </div>
           )}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-background/80 backdrop-blur-xl border-t border-white/10 p-2 z-50 flex justify-around items-center safe-area-bottom">
           <Button 
              variant="ghost" 
              onClick={() => { setActiveTab('overview'); setSelectedPlayerId(null); }}
              className={cn("flex flex-col items-center gap-1 h-auto py-2", activeTab === 'overview' && !selectedPlayerId ? "text-primary" : "text-muted-foreground")}
           >
              <Activity className="w-5 h-5" />
              <span className="text-[10px] font-bold">Overview</span>
           </Button>
           <Button 
              variant="ghost" 
              onClick={() => { setActiveTab('schedule'); setSelectedPlayerId(null); }}
              className={cn("flex flex-col items-center gap-1 h-auto py-2", activeTab === 'schedule' ? "text-primary" : "text-muted-foreground")}
           >
              <Calendar className="w-5 h-5" />
              <span className="text-[10px] font-bold">Schedule</span>
           </Button>
           <Button 
              variant="ghost" 
              onClick={() => { setActiveTab('financials'); setSelectedPlayerId(null); }}
              className={cn("flex flex-col items-center gap-1 h-auto py-2", activeTab === 'financials' ? "text-primary" : "text-muted-foreground")}
           >
              <CreditCard className="w-5 h-5" />
              <span className="text-[10px] font-bold">Money</span>
           </Button>
        </nav>
      </div>
    </div>
  );
}