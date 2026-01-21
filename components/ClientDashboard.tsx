import React, { useState } from 'react';
import { LogOut, Calendar, CreditCard, Activity, User, ChevronRight, Clock, MapPin, Trophy } from 'lucide-react';
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

  // Derived Data
  const myPlayers = players.filter(p => p.clientId === client.id);
  
  const upcomingSessions = sessions
    .filter(s => 
      s.participantIds.some(pid => myPlayers.map(p => p.id).includes(pid)) &&
      new Date(s.date + 'T' + s.startTime) >= new Date()
    )
    .sort((a, b) => new Date(a.date + 'T' + a.startTime).getTime() - new Date(b.date + 'T' + b.startTime).getTime())
    .slice(0, 5); // Next 5

  const selectedPlayer = myPlayers.find(p => p.id === selectedPlayerId);
  const playerLogs = selectedPlayer ? logs.filter(l => l.playerId === selectedPlayer.id).sort((a,b) => b.createdAt - a.createdAt) : [];

  const handlePlayerClick = (pid: string) => {
    setSelectedPlayerId(pid);
    setActiveTab('overview'); // Ensure we are on a view that supports the detail
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-6 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm sticky top-0 z-10 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/vgta-icon.svg"
            alt="VGTA"
            className="h-10 w-10 rounded-xl ring-1 ring-slate-200 dark:ring-slate-800 shadow-lg"
          />
          <div>
            <h1 className="font-bold text-lg leading-tight tracking-tight">VGTA</h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Client Portal</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="text-right hidden sm:block">
              <div className="text-sm font-semibold">{client.name}</div>
              <div className="text-xs text-slate-500">{client.email}</div>
           </div>
           <Button variant="ghost" size="sm" onClick={onLogout} className="text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
             <LogOut className="w-4 h-4 mr-2" />
             <span className="hidden sm:inline">Sign Out</span>
           </Button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden relative">
        {/* Sidebar Navigation (Desktop) */}
        <aside className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 hidden md:flex flex-col p-4 gap-2">
            <div className="pb-4">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Menu</h3>
               <nav className="space-y-1">
                  <Button 
                    variant={activeTab === 'overview' && !selectedPlayerId ? 'secondary' : 'ghost'} 
                    className="w-full justify-start" 
                    onClick={() => { setActiveTab('overview'); setSelectedPlayerId(null); }}
                  >
                     <Activity className="w-4 h-4 mr-2 opacity-70" />
                     Overview
                  </Button>
                  <Button 
                    variant={activeTab === 'schedule' ? 'secondary' : 'ghost'} 
                    className="w-full justify-start" 
                    onClick={() => { setActiveTab('schedule'); setSelectedPlayerId(null); }}
                  >
                     <Calendar className="w-4 h-4 mr-2 opacity-70" />
                     Schedule
                  </Button>
                  <Button 
                    variant={activeTab === 'financials' ? 'secondary' : 'ghost'} 
                    className="w-full justify-start" 
                    onClick={() => { setActiveTab('financials'); setSelectedPlayerId(null); }}
                  >
                     <CreditCard className="w-4 h-4 mr-2 opacity-70" />
                     Financials
                  </Button>
               </nav>
            </div>

            <div className="pb-4 flex-1">
               <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 px-3">Athletes</h3>
               <div className="space-y-1">
                  {myPlayers.map(p => (
                     <Button 
                        key={p.id}
                        variant={selectedPlayerId === p.id ? 'secondary' : 'ghost'} 
                        className="w-full justify-start group"
                        onClick={() => handlePlayerClick(p.id)}
                     >
                        <div className="w-6 h-6 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xs font-bold mr-2 group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors">
                           {p.name.charAt(0)}
                        </div>
                        <span className="truncate">{p.name}</span>
                        {selectedPlayerId === p.id && <ChevronRight className="w-4 h-4 ml-auto opacity-50" />}
                     </Button>
                  ))}
               </div>
            </div>
            
            <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 rounded-xl">
               <p className="text-xs text-indigo-800 dark:text-indigo-200 font-medium mb-1">Need to reschedule?</p>
               <p className="text-[10px] text-indigo-600 dark:text-indigo-400 leading-relaxed">
                  Please contact the academy office at least 24 hours in advance.
               </p>
            </div>
        </aside>

        {/* Main View Area */}
        <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 p-4 md:p-8 pb-24 md:pb-8 no-scrollbar">
           {selectedPlayer ? (
              // PLAYER DETAIL VIEW
              <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="flex items-center gap-4 mb-6">
                    <Button variant="outline" size="sm" onClick={() => setSelectedPlayerId(null)} className="md:hidden">
                       Back
                    </Button>
                    <div className="w-16 h-16 rounded-full bg-indigo-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                       {selectedPlayer.name.charAt(0)}
                    </div>
                    <div>
                       <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedPlayer.name}</h2>
                       <div className="flex gap-2 text-sm text-slate-500">
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs">
                             {selectedPlayer.level}
                          </span>
                          <span className="px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-xs">
                             {selectedPlayer.playStyle || 'All-Court'}
                          </span>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Stats Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                       <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                          <Activity className="w-4 h-4 text-indigo-500" />
                          Performance Analysis
                       </h3>
                       <div className="h-64 flex items-center justify-center">
                          <RadarChart stats={selectedPlayer.stats} />
                       </div>
                    </div>

                    {/* Recent Logs Card */}
                    <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col">
                       <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                          <Trophy className="w-4 h-4 text-amber-500" />
                          Recent Sessions
                       </h3>
                       <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 max-h-64">
                          {playerLogs.length > 0 ? playerLogs.map(log => (
                             <div key={log.id} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
                                <div className="flex justify-between items-center mb-1">
                                   <span className="text-xs font-bold text-slate-500">{log.date}</span>
                                   <span className="text-xs font-bold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-2 py-0.5 rounded-full">
                                      {log.totalScore}/10
                                   </span>
                                </div>
                                {log.nextFocus && (
                                   <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">
                                      <span className="font-semibold text-indigo-500">Focus:</span> {log.nextFocus}
                                   </p>
                                )}
                             </div>
                          )) : (
                             <div className="text-center py-10 text-sm text-slate-400">No sessions logged yet.</div>
                          )}
                       </div>
                    </div>
                 </div>

                 {/* Progress Chart */}
                 <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                    <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Progress History</h3>
                    <div className="h-64 w-full">
                       <ProgressChart data={playerLogs.map(l => ({ ...l, total: l.totalScore }))} />
                    </div>
                 </div>

                 {/* Homework / Assigned Drills */}
                 {selectedPlayer.assignedDrills.length > 0 && (
                     <div className="bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-slate-700 dark:text-slate-200 mb-4">Assigned Homework</h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                           {selectedPlayer.assignedDrills.map(did => {
                              const drill = drills.find(d => d.id === did);
                              if (!drill) return null;
                              return (
                                 <div key={did} className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30">
                                    <div className="font-bold text-sm mb-1">{drill.name}</div>
                                    <div className="text-xs text-slate-500 line-clamp-2">{drill.description}</div>
                                 </div>
                              );
                           })}
                        </div>
                     </div>
                 )}
              </div>

           ) : activeTab === 'schedule' ? (
              // SCHEDULE VIEW
              <div className="max-w-3xl mx-auto space-y-6">
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Upcoming Schedule</h2>
                 <div className="space-y-4">
                    {upcomingSessions.length > 0 ? upcomingSessions.map(session => {
                       const participantNames = session.participantIds
                          .map(pid => players.find(p => p.id === pid)?.name)
                          .filter(Boolean)
                          .join(", ");
                       
                       return (
                          <div key={session.id} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5 bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                             <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-indigo-50 dark:bg-indigo-900/20 flex flex-col items-center justify-center text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/10">
                                <span className="text-xs font-bold uppercase">{new Date(session.date).toLocaleString('default', { month: 'short' })}</span>
                                <span className="text-2xl font-bold">{new Date(session.date).getDate()}</span>
                             </div>
                             <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                   <span className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                                      session.type === 'Private' ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" :
                                      session.type === 'Group' ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" :
                                      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                                   )}>
                                      {session.type}
                                   </span>
                                   <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {session.startTime} - {session.endTime}
                                   </span>
                                </div>
                                <h3 className="font-bold text-slate-900 dark:text-slate-100">{participantNames}</h3>
                                <div className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                   <MapPin className="w-3 h-3" />
                                   {session.location}
                                </div>
                             </div>
                          </div>
                       );
                    }) : (
                       <div className="text-center py-20 bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                          <p className="text-slate-500 font-medium">No upcoming sessions scheduled.</p>
                       </div>
                    )}
                 </div>
              </div>

           ) : activeTab === 'financials' ? (
              // FINANCIALS VIEW
              <div className="max-w-3xl mx-auto space-y-6">
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Payment History</h2>
                 
                 <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
                    <div className="grid grid-cols-4 gap-4 p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/30 text-xs font-bold text-slate-500 uppercase tracking-wider">
                       <div>Date</div>
                       <div>Reference</div>
                       <div>Amount</div>
                       <div>Status</div>
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                       {client.payments && client.payments.length > 0 ? (
                          [...client.payments].sort((a,b) => b.date.localeCompare(a.date)).map(payment => (
                             <div key={payment.id} className="grid grid-cols-4 gap-4 p-4 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="font-medium text-slate-700 dark:text-slate-300">{payment.date}</div>
                                <div className="text-slate-500">{payment.reference || 'Payment'}</div>
                                <div className="font-bold text-slate-900 dark:text-slate-100">R {payment.amount}</div>
                                <div>
                                   <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                      Paid
                                   </span>
                                </div>
                             </div>
                          ))
                       ) : (
                          <div className="p-8 text-center text-slate-500 text-sm">No payment history available.</div>
                       )}
                    </div>
                 </div>
              </div>

           ) : (
              // OVERVIEW (Dashboard Home)
              <div className="max-w-5xl mx-auto">
                 <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">Welcome, {client.name.split(' ')[0]}</h2>
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Next Session Card */}
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl p-6 text-white shadow-xl shadow-indigo-200 dark:shadow-none relative overflow-hidden">
                       <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-8 -mt-8" />
                       <div className="relative z-10">
                          <h3 className="font-medium text-indigo-100 mb-1 flex items-center gap-2">
                             <Calendar className="w-4 h-4" /> Next Session
                          </h3>
                          {upcomingSessions[0] ? (
                             <>
                                <div className="text-3xl font-bold mt-2 mb-1">
                                   {new Date(upcomingSessions[0].date).toLocaleDateString('en-US', { weekday: 'long' })}
                                </div>
                                <div className="text-lg text-indigo-100 mb-6">
                                   {upcomingSessions[0].startTime} @ {upcomingSessions[0].location}
                                </div>
                                <div className="flex items-center gap-2">
                                   {upcomingSessions[0].participantIds.map(pid => {
                                      const p = players.find(x => x.id === pid);
                                      return p ? (
                                         <span key={pid} className="px-3 py-1 rounded-full bg-white/20 text-sm font-medium backdrop-blur-sm">
                                            {p.name}
                                         </span>
                                      ) : null;
                                   })}
                                </div>
                             </>
                          ) : (
                             <div className="py-8 text-indigo-100">No upcoming sessions.</div>
                          )}
                       </div>
                    </div>

                    {/* Quick Stats / Summary */}
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                          <div className="w-10 h-10 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 mb-3">
                             <User className="w-5 h-5" />
                          </div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">{myPlayers.length}</div>
                          <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Athletes</div>
                       </div>
                       <div className="bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 flex flex-col justify-center">
                          <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 mb-3">
                             <Activity className="w-5 h-5" />
                          </div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">{sessions.length}</div>
                          <div className="text-xs text-slate-500 font-medium uppercase tracking-wide">Total Sessions</div>
                       </div>
                       <div className="col-span-2 bg-white dark:bg-slate-900 p-5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
                          <h3 className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-3">Your Athletes</h3>
                          <div className="space-y-2">
                             {myPlayers.map(p => (
                                <div 
                                   key={p.id} 
                                   onClick={() => handlePlayerClick(p.id)}
                                   className="flex items-center justify-between p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg cursor-pointer transition-colors group"
                                >
                                   <div className="flex items-center gap-3">
                                      <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-600 dark:text-slate-300">
                                         {p.name.charAt(0)}
                                      </div>
                                      <div>
                                         <div className="text-sm font-bold text-slate-900 dark:text-white">{p.name}</div>
                                         <div className="text-[10px] text-slate-500">{p.level}</div>
                                      </div>
                                   </div>
                                   <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500" />
                                </div>
                             ))}
                          </div>
                       </div>
                    </div>
                 </div>

                 {/* Recent Activity Feed */}
                 <div className="mb-8">
                     <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-4">Recent Activity</h3>
                     <div className="space-y-3">
                        {myPlayers.flatMap(p => 
                           logs
                              .filter(l => l.playerId === p.id)
                              .map(l => ({ ...l, playerName: p.name }))
                        )
                        .sort((a,b) => b.createdAt - a.createdAt)
                        .slice(0, 5)
                        .map(log => (
                           <div key={log.id} className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center gap-4">
                              <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center text-indigo-600 font-bold text-xs">
                                 {log.totalScore}
                              </div>
                              <div className="flex-1">
                                 <div className="flex justify-between">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">{log.playerName}</span>
                                    <span className="text-xs text-slate-500">{log.date}</span>
                                 </div>
                                 <p className="text-xs text-slate-500 line-clamp-1">{log.note || "Session completed successfully."}</p>
                              </div>
                           </div>
                        ))}
                     </div>
                 </div>
              </div>
           )}
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 p-2 z-50 flex justify-around items-center safe-area-bottom">
           <Button 
              variant="ghost" 
              onClick={() => { setActiveTab('overview'); setSelectedPlayerId(null); }}
              className={cn("flex flex-col items-center gap-1 h-auto py-2", activeTab === 'overview' && !selectedPlayerId ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500")}
           >
              <Activity className="w-5 h-5" />
              <span className="text-[10px] font-medium">Overview</span>
           </Button>
           <Button 
              variant="ghost" 
              onClick={() => { setActiveTab('schedule'); setSelectedPlayerId(null); }}
              className={cn("flex flex-col items-center gap-1 h-auto py-2", activeTab === 'schedule' ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500")}
           >
              <Calendar className="w-5 h-5" />
              <span className="text-[10px] font-medium">Schedule</span>
           </Button>
           <Button 
              variant="ghost" 
              onClick={() => { setActiveTab('financials'); setSelectedPlayerId(null); }}
              className={cn("flex flex-col items-center gap-1 h-auto py-2", activeTab === 'financials' ? "text-indigo-600 dark:text-indigo-400" : "text-slate-500")}
           >
              <CreditCard className="w-5 h-5" />
              <span className="text-[10px] font-medium">Money</span>
           </Button>
        </nav>
      </div>
    </div>
  );
}