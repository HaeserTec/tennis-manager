import React, { useEffect, useMemo, useState } from 'react';
import { LogOut, Calendar, CreditCard, Activity, User, ChevronRight, Clock, MapPin, Trophy, ChevronLeft, AlertTriangle, CheckCircle2, TrendingUp, Bell, Send, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Client, Player, TrainingSession, SessionLog, Drill, DayEvent } from '@/lib/playbook';
import { RadarChart } from '@/components/RadarChart';
import { ProgressChart } from '@/components/ProgressChart';
import { getSessionBillingForClient } from '@/lib/billing';
import { ClientStatementDocument } from './ClientStatementDocument';
import { ClientWeeklyReportDocument } from './ClientWeeklyReportDocument';

interface ClientDashboardProps {
  client: Client;
  players: Player[];
  sessions: TrainingSession[];
  dayEvents?: DayEvent[];
  logs: SessionLog[];
  drills: Drill[];
  onLogout: () => void;
}

type MessageItem = {
  id: string;
  author: 'coach' | 'parent';
  text: string;
  createdAt: number;
};

type GoalCheckins = Record<string, boolean>;

const metricLabel: Record<string, string> = {
  tech: 'Technique',
  consistency: 'Consistency',
  tactics: 'Tactics',
  movement: 'Movement',
  coachability: 'Coachability'
};

const getWeekStart = (d: Date) => {
  const copy = new Date(d);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getWeekEnd = (start: Date) => {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return end;
};

const getWeekKey = (d: Date) => {
  const s = getWeekStart(d);
  const y = s.getFullYear();
  const m = String(s.getMonth() + 1).padStart(2, '0');
  const day = String(s.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export function ClientDashboard(props: ClientDashboardProps) {
  const { client, players, sessions, dayEvents = [], logs, onLogout } = props;
  const parseLocalDate = (dateStr: string) => new Date(`${dateStr}T12:00:00`);
  const parseSessionDateTime = (dateStr: string, timeStr: string) => new Date(`${dateStr}T${timeStr}`);
  const [activeTab, setActiveTab] = useState<'overview' | 'schedule' | 'financials'>('overview');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showStatement, setShowStatement] = useState(false);
  const [statementAutoPrint, setStatementAutoPrint] = useState(false);
  const [showWeeklyReport, setShowWeeklyReport] = useState(false);
  const [messageDraft, setMessageDraft] = useState('');
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [goalCheckins, setGoalCheckins] = useState<GoalCheckins>({});
  const weekStart = useMemo(() => getWeekStart(new Date()), []);
  const weekEnd = useMemo(() => getWeekEnd(weekStart), [weekStart]);
  const weekKey = useMemo(() => getWeekKey(new Date()), []);
  const messageStorageKey = useMemo(() => `tl-client-messages-${client.id}`, [client.id]);

  // Derived Data
  const myPlayers = players
    .filter(p => p.clientId === client.id)
    .sort((a, b) => a.name.localeCompare(b.name));
  const myPlayerIds = useMemo(() => new Set(myPlayers.map(p => p.id)), [myPlayers]);
  
  const upcomingSessions = sessions
    .filter(s => 
      s.participantIds.some(pid => myPlayerIds.has(pid)) &&
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
  const selectedPlayerUpcoming = useMemo(() => {
    if (!selectedPlayer) return [];
    return sessions
      .filter(s => s.participantIds.includes(selectedPlayer.id) && new Date(`${s.date}T${s.startTime}`) >= new Date())
      .sort((a, b) => new Date(`${a.date}T${a.startTime}`).getTime() - new Date(`${b.date}T${b.startTime}`).getTime())
      .slice(0, 3);
  }, [selectedPlayer, sessions]);
  const selectedPlayerAverage = useMemo(() => {
    if (playerLogs.length === 0) return 0;
    const avg = playerLogs.reduce((sum, log) => sum + log.totalScore, 0) / playerLogs.length;
    return Math.round(avg * 10) / 10;
  }, [playerLogs]);
  const selectedPlayerLastShared = playerLogs[0];
  const sharedActivityFeed = useMemo(() => {
    return myPlayers
      .flatMap(p =>
        logs
          .filter(l => l.playerId === p.id && l.isSharedWithParent)
          .map(l => ({ ...l, playerName: p.name }))
      )
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 8);
  }, [myPlayers, logs]);
  const now = new Date();
  const next48HoursTs = now.getTime() + 48 * 60 * 60 * 1000;
  const next7DaysTs = now.getTime() + 7 * 24 * 60 * 60 * 1000;
  const upcoming48hSessions = useMemo(
    () => upcomingSessions.filter((s) => {
      const ts = parseSessionDateTime(s.date, s.startTime).getTime();
      return ts >= now.getTime() && ts <= next48HoursTs;
    }),
    [upcomingSessions, now, next48HoursTs]
  );
  const upcoming7DaysSessions = useMemo(
    () => upcomingSessions.filter((s) => {
      const ts = parseSessionDateTime(s.date, s.startTime).getTime();
      return ts >= now.getTime() && ts <= next7DaysTs;
    }),
    [upcomingSessions, now, next7DaysTs]
  );
  const playerInsights = useMemo(() => {
    return myPlayers.map((player) => {
      const playerSharedLogs = logs
        .filter((l) => l.playerId === player.id && l.isSharedWithParent)
        .sort((a, b) => b.createdAt - a.createdAt);
      const latest = playerSharedLogs[0];
      const previous = playerSharedLogs[1];
      const delta = latest && previous ? Number((latest.totalScore - previous.totalScore).toFixed(1)) : null;
      const nextSession = upcomingSessions.find((s) => s.participantIds.includes(player.id));
      return {
        player,
        latest,
        delta,
        nextSession
      };
    });
  }, [logs, myPlayers, upcomingSessions]);
  const playerGoalRows = useMemo(() => {
    return myPlayers.map((player) => {
      const explicitGoals = (player.progressGoals || [])
        .filter((g) => !g.completedAt)
        .map((g) => ({
          id: g.id,
          label: `${metricLabel[g.metric] || g.metric} target ${g.targetValue}/10`,
          deadline: g.deadline
        }));

      if (explicitGoals.length > 0) {
        return { player, goals: explicitGoals };
      }

      const metricEntries = [
        { key: 'tech', value: player.stats.tech },
        { key: 'consistency', value: player.stats.consistency },
        { key: 'tactics', value: player.stats.tactics },
        { key: 'movement', value: player.stats.movement },
        { key: 'coachability', value: player.stats.coachability }
      ];
      metricEntries.sort((a, b) => a.value - b.value);
      const weakest = metricEntries[0];
      const target = Math.min(10, weakest.value + 1);
      return {
        player,
        goals: [
          {
            id: `generated-${player.id}-${weakest.key}`,
            label: `${metricLabel[weakest.key]} target ${target}/10`,
            deadline: undefined
          }
        ]
      };
    });
  }, [myPlayers]);
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
  let openingCredits = 0;
  let openingPayments = 0;
  sessions.forEach(s => {
      const sDate = parseLocalDate(s.date);
      if (sDate < currentMonthStart && s.participantIds.some(pid => clientPlayerIds.has(pid))) {
          const billing = getSessionBillingForClient(s, clientPlayerIds, dayEvents);
          openingFees += billing.charge;
          openingCredits += billing.credit;
      }
  });
  (client.payments || []).forEach(p => {
      if (parseLocalDate(p.date) < currentMonthStart) openingPayments += p.amount;
  });
  const openingBalance = openingFees - openingCredits - openingPayments;

  // 2. Current Month Transactions
  const monthlySessions = sessions.filter(s => {
      const d = parseLocalDate(s.date);
      return d >= currentMonthStart && d < nextMonthStart && s.participantIds.some(pid => clientPlayerIds.has(pid));
  });
  
  let currentFees = 0;
  let currentCredits = 0;
  monthlySessions.forEach(s => {
      const billing = getSessionBillingForClient(s, clientPlayerIds, dayEvents);
      currentFees += billing.charge;
      currentCredits += billing.credit;
  });
  
  const monthlyPayments = (client.payments || []).filter(p => {
      const d = parseLocalDate(p.date);
      return d >= currentMonthStart && d < nextMonthStart;
  });
  const currentPaymentTotal = monthlyPayments.reduce((acc, p) => acc + p.amount, 0);
  
  const closingBalance = openingBalance + currentFees - currentCredits - currentPaymentTotal;
  const monthlyTransactionRows = useMemo(() => {
    return [
      ...monthlySessions.flatMap(s => {
        const billing = getSessionBillingForClient(s, clientPlayerIds, dayEvents);
        if (billing.status === 'rain') return [];
        if (billing.status === 'cancelled') {
          return [{
            id: `credit-${s.id}`,
            type: 'credit',
            date: s.date,
            desc: `${s.type} Session - Coach Cancelled Credit`,
            amount: billing.credit,
            isCredit: true
          }];
        }
        return [{
          id: s.id,
          type: 'session',
          date: s.date,
          desc: `${s.type} Session`,
          amount: billing.charge,
          isCredit: false
        }];
      }),
      ...monthlyPayments.map(p => ({
        id: p.id,
        type: 'payment',
        date: p.date,
        desc: `Payment - ${p.reference || 'Ref'}`,
        amount: p.amount,
        isCredit: true,
        proofUrl: (p as any).proofUrl
      }))
    ].sort((a, b) => (a.date === b.date ? 0 : a.date > b.date ? -1 : 1));
  }, [monthlySessions, monthlyPayments, clientPlayerIds, dayEvents]);
  const actionItems = useMemo(() => {
    const items: { tone: 'danger' | 'warning' | 'ok'; title: string; detail: string; onClick: () => void }[] = [];
    if (closingBalance > 0) {
      items.push({
        tone: 'danger',
        title: `Outstanding balance: R ${closingBalance.toLocaleString()}`,
        detail: 'Review statement and payment record.',
        onClick: () => {
          setActiveTab('financials');
          setSelectedPlayerId(null);
        }
      });
    }
    if (upcoming48hSessions.length > 0) {
      items.push({
        tone: 'warning',
        title: `${upcoming48hSessions.length} session(s) in next 48h`,
        detail: 'Check times and location before travel.',
        onClick: () => {
          setActiveTab('schedule');
          setSelectedPlayerId(null);
        }
      });
    }
    const staleReports = playerInsights.filter((i) => {
      if (!i.latest) return true;
      const ageDays = (now.getTime() - parseLocalDate(i.latest.date).getTime()) / (24 * 60 * 60 * 1000);
      return ageDays > 14;
    });
    if (staleReports.length > 0) {
      items.push({
        tone: 'warning',
        title: `${staleReports.length} player(s) with no recent report`,
        detail: 'Last shared update is older than 14 days.',
        onClick: () => {
          const first = staleReports[0];
          if (first) {
            setSelectedPlayerId(first.player.id);
            setActiveTab('overview');
          }
        }
      });
    }
    if (items.length === 0) {
      items.push({
        tone: 'ok',
        title: 'Everything is on track',
        detail: 'No urgent actions right now.',
        onClick: () => {
          setActiveTab('overview');
          setSelectedPlayerId(null);
        }
      });
    }
    return items.slice(0, 4);
  }, [closingBalance, now, playerInsights, upcoming48hSessions]);
  const mergedMessages = useMemo(() => {
    return [...messages].sort((a, b) => b.createdAt - a.createdAt).slice(0, 20);
  }, [messages]);

  useEffect(() => {
    const raw = window.localStorage.getItem(messageStorageKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as MessageItem[];
        if (Array.isArray(parsed)) {
          setMessages(parsed.filter((m) => m && (m.author === 'coach' || m.author === 'parent') && typeof m.text === 'string'));
        } else {
          setMessages([]);
        }
      } catch {
        setMessages([]);
      }
    } else {
      setMessages([]);
    }
  }, [messageStorageKey]);

  useEffect(() => {
    window.localStorage.setItem(messageStorageKey, JSON.stringify(messages));
    window.dispatchEvent(new Event('tl-messages-updated'));
  }, [messageStorageKey, messages]);

  useEffect(() => {
    const checkinsKey = `tl-client-goal-checkins-${client.id}-${weekKey}`;
    const raw = window.localStorage.getItem(checkinsKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as GoalCheckins;
        setGoalCheckins(parsed && typeof parsed === 'object' ? parsed : {});
      } catch {
        setGoalCheckins({});
      }
    } else {
      setGoalCheckins({});
    }
  }, [client.id, weekKey]);

  useEffect(() => {
    const checkinsKey = `tl-client-goal-checkins-${client.id}-${weekKey}`;
    window.localStorage.setItem(checkinsKey, JSON.stringify(goalCheckins));
  }, [client.id, goalCheckins, weekKey]);

  const sendMessage = () => {
    const text = messageDraft.trim();
    if (!text) return;
    const msg: MessageItem = {
      id: `parent-${Date.now()}`,
      author: 'parent',
      text,
      createdAt: Date.now()
    };
    setMessages((prev) => [msg, ...prev]);
    setMessageDraft('');
  };

  const toggleGoalCheckin = (playerId: string, goalId: string) => {
    const key = `${playerId}:${goalId}`;
    setGoalCheckins((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="app-shell flex flex-col h-screen text-foreground font-sans overflow-hidden">
      {/* Top Bar */}
      <header className="app-panel-muted app-divider flex items-center justify-between px-6 py-4 border-b shadow-sm sticky top-0 z-10 shrink-0">
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
        <aside className="app-panel-muted app-divider w-64 border-r hidden md:flex flex-col p-4 gap-2">
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
              <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="glass-card rounded-3xl p-5 sm:p-6 border-white/10">
                  <div className="flex items-start sm:items-center justify-between gap-4 mb-5">
                    <Button variant="outline" size="sm" onClick={() => setSelectedPlayerId(null)} className="md:hidden">
                       Back
                    </Button>
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full border-2 border-white/20 flex items-center justify-center text-white text-2xl font-bold shadow-xl" style={{ backgroundColor: selectedPlayer.avatarColor }}>
                         {selectedPlayer.name.charAt(0)}
                      </div>
                      <div>
                         <h2 className="text-3xl font-black text-white tracking-tight">{selectedPlayer.name}</h2>
                         <div className="flex gap-2 text-sm text-muted-foreground mt-1">
                            <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-bold text-[10px] uppercase tracking-wider border border-white/5">
                               {selectedPlayer.level}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground font-bold text-[10px] uppercase tracking-wider border border-white/5">
                               {selectedPlayer.playStyle || 'All-Court'}
                            </span>
                         </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Avg Shared Score</div>
                      <div className="text-3xl font-black text-primary">{selectedPlayerAverage || '-'}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    {[
                      { label: 'Technique', value: selectedPlayer.stats.tech, tone: 'text-rose-300 border-rose-500/20 bg-rose-500/5' },
                      { label: 'Consistency', value: selectedPlayer.stats.consistency, tone: 'text-amber-300 border-amber-500/20 bg-amber-500/5' },
                      { label: 'Tactics', value: selectedPlayer.stats.tactics, tone: 'text-emerald-300 border-emerald-500/20 bg-emerald-500/5' },
                      { label: 'Movement', value: selectedPlayer.stats.movement, tone: 'text-sky-300 border-sky-500/20 bg-sky-500/5' },
                      { label: 'Coachability', value: selectedPlayer.stats.coachability, tone: 'text-violet-300 border-violet-500/20 bg-violet-500/5' },
                    ].map((metric) => (
                      <div key={metric.label} className={cn("rounded-2xl border p-3", metric.tone)}>
                        <div className="text-[10px] font-black uppercase tracking-[0.15em] opacity-80">{metric.label}</div>
                        <div className="text-2xl font-black mt-1">{metric.value}</div>
                      </div>
                    ))}
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

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <div className="glass-card rounded-2xl p-4 border-white/5">
                     <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Next Session</div>
                     <div className="font-bold">
                       {selectedPlayerUpcoming[0]
                         ? `${parseLocalDate(selectedPlayerUpcoming[0].date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${selectedPlayerUpcoming[0].startTime}`
                         : 'None scheduled'}
                     </div>
                   </div>
                   <div className="glass-card rounded-2xl p-4 border-white/5">
                     <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Reports Shared</div>
                     <div className="font-bold text-2xl">{playerLogs.length}</div>
                   </div>
                   <div className="glass-card rounded-2xl p-4 border-white/5">
                     <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Last Coach Insight</div>
                     <div className="text-sm line-clamp-2">{selectedPlayerLastShared?.note || 'No shared insight yet'}</div>
                   </div>
                 </div>

                 {/* Progress Chart */}
                 <div className="glass-card rounded-2xl p-6 border-white/5 relative z-10">
                    <h3 className="font-black text-muted-foreground uppercase tracking-widest text-xs mb-4">Progress History</h3>
                    <div className="h-64 w-full">
                       <ProgressChart data={playerLogs.map(l => ({ ...l, total: l.totalScore }))} />
                    </div>
                 </div>

              </div>

           ) : activeTab === 'schedule' ? (
              // SCHEDULE VIEW
              <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="glass-card rounded-2xl p-4 border-white/5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upcoming Sessions</div>
                      <div className="text-2xl font-black mt-1">{upcomingSessions.length}</div>
                    </div>
                    <div className="glass-card rounded-2xl p-4 border-white/5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Athletes Booked</div>
                      <div className="text-2xl font-black mt-1">{myPlayers.length}</div>
                    </div>
                    <div className="glass-card rounded-2xl p-4 border-white/5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Next Session</div>
                      <div className="font-bold mt-1 text-sm">
                        {upcomingSessions[0] ? parseLocalDate(upcomingSessions[0].date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : 'Not scheduled'}
                      </div>
                    </div>
                    <div className="glass-card rounded-2xl p-4 border-white/5">
                      <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Location</div>
                      <div className="font-bold mt-1 text-sm">{upcomingSessions[0]?.location || '-'}</div>
                    </div>
                 </div>

                 <div className="glass-card rounded-3xl p-6 border-white/5">
                  <h2 className="text-2xl font-black text-white uppercase tracking-tight mb-6">Upcoming Schedule</h2>
                  <div className="space-y-4">
                    {upcomingSessions.length > 0 ? upcomingSessions.map(session => {
                       const participantNames = session.participantIds
                          .map(pid => players.find(p => p.id === pid)?.name)
                          .filter(Boolean)
                          .join(", ");
                       
                       return (
                          <div key={session.id} className="flex flex-col lg:flex-row items-start lg:items-center gap-4 p-4 rounded-2xl border border-white/10 bg-card/30 hover:bg-card/50 hover:border-primary/30 transition-colors">
                             <div className="flex-shrink-0 w-16 h-16 rounded-2xl bg-card border border-white/10 flex flex-col items-center justify-center text-primary shadow-lg">
                                <span className="text-[10px] font-black uppercase tracking-widest">{parseLocalDate(session.date).toLocaleString('default', { month: 'short' })}</span>
                                <span className="text-2xl font-black">{parseLocalDate(session.date).getDate()}</span>
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
                                <h3 className="font-bold text-lg">{participantNames || 'No athlete assigned'}</h3>
                                <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                                   <MapPin className="w-3 h-3" />
                                   {session.location}
                                </div>
                             </div>
                          </div>
                       );
                    }) : (
                       <div className="text-center py-20 rounded-3xl border border-dashed border-white/10 bg-card/20">
                          <Calendar className="w-10 h-10 text-muted-foreground/50 mx-auto mb-3" />
                          <p className="text-muted-foreground font-bold">No upcoming sessions scheduled.</p>
                       </div>
                    )}
                  </div>
                 </div>
              </div>

           ) : activeTab === 'financials' ? (
              // FINANCIALS VIEW
              <div className="max-w-5xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                 <div className="glass-card rounded-3xl p-5 border-white/5 flex items-center justify-between">
                     <div>
                       <h2 className="text-2xl font-black text-white uppercase tracking-tight">Financial Statement</h2>
                       <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Monthly Summary</p>
                     </div>
                     <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setStatementAutoPrint(false);
                          setShowStatement(true);
                        }}
                      >
                        Open Statement
                      </Button>
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => {
                          setStatementAutoPrint(true);
                          setShowStatement(true);
                        }}
                      >
                        Print Statement
                      </Button>
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
                 </div>

                 {/* Summary Cards */}
                 <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                     <div className="glass-card p-4 rounded-xl border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Brought Forward</div>
                        <div className={cn("text-lg font-black font-mono", openingBalance !== 0 ? "text-foreground" : "text-muted-foreground")}>R {openingBalance.toLocaleString()}</div>
                     </div>
                     <div className="glass-card p-4 rounded-xl border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Fees (This Month)</div>
                        <div className="text-lg font-black font-mono">R {currentFees.toLocaleString()}</div>
                     </div>
                     <div className="glass-card p-4 rounded-xl border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Credits</div>
                        <div className="text-lg font-black font-mono text-blue-400">R {currentCredits.toLocaleString()}</div>
                     </div>
                     <div className="glass-card p-4 rounded-xl border-white/5">
                        <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-1">Paid</div>
                        <div className="text-lg font-black font-mono text-emerald-400">R {currentPaymentTotal.toLocaleString()}</div>
                     </div>
                     <div className="glass-card p-4 rounded-xl border-white/5 bg-primary/10 border-primary/30">
                        <div className="text-[10px] font-black uppercase tracking-widest text-primary mb-1">Closing Balance</div>
                        <div className={cn("text-xl font-black font-mono", closingBalance > 0 ? "text-red-400" : "text-emerald-300")}>R {closingBalance.toLocaleString()}</div>
                     </div>
                 </div>
                 
                 <div className="glass-card rounded-2xl border-white/5 overflow-hidden">
                    <div className="p-4 border-b border-white/5 bg-card/30 flex justify-between items-center">
                        <h3 className="font-bold text-sm">Transaction History</h3>
                    </div>
                    <div className="divide-y divide-white/5">
                       {monthlyTransactionRows.length > 0 ? (
                           monthlyTransactionRows.map((item, idx) => (
                              <div key={idx} className="grid grid-cols-[110px_1fr_160px] gap-4 p-4 text-sm hover:bg-white/5 transition-colors items-center">
                                 <div className="font-mono text-xs text-muted-foreground">{item.date}</div>
                                 <div className="font-medium text-foreground">
                                   {item.desc}
                                   {(item as any).proofUrl && (
                                     <a href={(item as any).proofUrl} target="_blank" rel="noreferrer" className="ml-2 text-xs text-primary underline">
                                       View POP
                                     </a>
                                   )}
                                 </div>
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
              <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
                 <div className="flex items-end justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-white uppercase tracking-tight">Welcome, {client.name.split(' ')[0]}</h2>
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest mt-1">Client Command Center</p>
                  </div>
                  <Button size="sm" className="h-8 text-xs" onClick={() => setShowWeeklyReport(true)}>
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                    Weekly Report
                  </Button>
                 </div>

                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                   <div className="glass-card rounded-2xl p-4 border-white/5">
                     <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Athletes</div>
                     <div className="text-2xl font-black mt-1">{myPlayers.length}</div>
                   </div>
                   <div className="glass-card rounded-2xl p-4 border-white/5">
                     <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Upcoming Sessions</div>
                     <div className="text-2xl font-black mt-1">{upcomingSessions.length}</div>
                   </div>
                   <div className="glass-card rounded-2xl p-4 border-white/5">
                     <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Closing Balance</div>
                     <div className={cn("text-2xl font-black mt-1", closingBalance > 0 ? "text-red-400" : "text-emerald-300")}>
                       R {closingBalance.toLocaleString()}
                     </div>
                   </div>
                   <div className="glass-card rounded-2xl p-4 border-white/5">
                     <div className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Last Shared Report</div>
                     <div className="text-sm font-bold mt-1">{sharedActivityFeed[0]?.date || 'No reports yet'}</div>
                   </div>
                 </div>

                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                    <div className="glass-card rounded-3xl border-white/5 p-5">
                      <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Bell className="w-4 h-4 text-primary" />
                        Action Center
                      </h3>
                      <div className="space-y-3">
                        {actionItems.map((item, idx) => (
                          <button
                            key={idx}
                            onClick={item.onClick}
                            className={cn(
                              "w-full text-left rounded-xl border p-3 transition-colors hover:bg-white/10",
                              item.tone === 'danger' && "border-red-500/30 bg-red-500/10",
                              item.tone === 'warning' && "border-amber-500/30 bg-amber-500/10",
                              item.tone === 'ok' && "border-emerald-500/30 bg-emerald-500/10"
                            )}
                          >
                            <div className="flex items-start gap-2">
                              {item.tone === 'danger' ? (
                                <AlertTriangle className="w-4 h-4 mt-0.5 text-red-300 shrink-0" />
                              ) : item.tone === 'warning' ? (
                                <AlertTriangle className="w-4 h-4 mt-0.5 text-amber-300 shrink-0" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4 mt-0.5 text-emerald-300 shrink-0" />
                              )}
                              <div>
                                <div className="text-sm font-bold">{item.title}</div>
                                <div className="text-xs text-muted-foreground mt-0.5">{item.detail}</div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="glass-card rounded-3xl border-white/5 p-5">
                      <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-primary" />
                        7-Day Family Schedule
                      </h3>
                      {upcoming7DaysSessions.length > 0 ? (
                        <div className="space-y-2">
                          {upcoming7DaysSessions.slice(0, 6).map((session) => {
                            const sessionPlayers = session.participantIds
                              .map((pid) => myPlayers.find((p) => p.id === pid)?.name)
                              .filter(Boolean)
                              .join(', ');
                            return (
                              <div key={session.id} className="rounded-xl border border-white/10 bg-card/40 px-3 py-2">
                                <div className="flex justify-between gap-2">
                                  <div className="text-sm font-bold">
                                    {parseLocalDate(session.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                                  </div>
                                  <div className="text-xs font-mono text-muted-foreground">{session.startTime}</div>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1">{session.location}</div>
                                <div className="text-xs text-foreground/90 mt-1">{sessionPlayers}</div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="rounded-xl border border-dashed border-white/10 p-5 text-sm text-muted-foreground italic">
                          No sessions in the next 7 days.
                        </div>
                      )}
                    </div>

                 </div>
                 
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
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
                                   {parseLocalDate(upcomingSessions[0].date).toLocaleDateString('en-US', { weekday: 'long' })}
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
                    <div className="glass-card p-5 rounded-3xl border-white/5">
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
                             {myPlayers.length === 0 && (
                                <div className="text-sm text-muted-foreground italic py-4 text-center">No linked athletes yet.</div>
                             )}
                          </div>
                    </div>
                 </div>

                 <div className="glass-card rounded-3xl border-white/5 p-5">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">Family Performance Board</h3>
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Shared reports + momentum</span>
                    </div>
                    <div className="divide-y divide-white/5">
                      {playerInsights.map((entry) => (
                        <div key={entry.player.id} className="grid grid-cols-1 lg:grid-cols-[220px_120px_120px_1fr_180px] gap-3 items-center py-3">
                          <button onClick={() => handlePlayerClick(entry.player.id)} className="text-left group">
                            <div className="font-bold group-hover:text-primary transition-colors">{entry.player.name}</div>
                            <div className="text-xs text-muted-foreground">{entry.player.level}</div>
                          </button>
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Latest Score</div>
                            <div className="font-black text-lg">{entry.latest?.totalScore ?? '-'}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Momentum</div>
                            <div className={cn("font-black text-lg flex items-center gap-1", (entry.delta ?? 0) > 0 ? "text-emerald-300" : (entry.delta ?? 0) < 0 ? "text-red-300" : "text-muted-foreground")}>
                              <TrendingUp className="w-4 h-4" />
                              {entry.delta === null ? '-' : `${entry.delta > 0 ? '+' : ''}${entry.delta}`}
                            </div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Next Focus</div>
                            <div className="text-sm line-clamp-1">{entry.latest?.nextFocus || entry.latest?.note || 'No focus shared yet'}</div>
                          </div>
                          <div>
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-black">Next Session</div>
                            <div className="text-sm">
                              {entry.nextSession
                                ? `${parseLocalDate(entry.nextSession.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} ${entry.nextSession.startTime}`
                                : 'Not scheduled'}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>

                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                   <div className="glass-card rounded-3xl border-white/5 p-5">
                     <div className="flex items-center justify-between mb-4">
                       <h3 className="text-lg font-black text-white uppercase tracking-tight">Messaging Center</h3>
                       <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Coach + Parent Updates</span>
                     </div>
                     <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                       {mergedMessages.length > 0 ? mergedMessages.map((m) => (
                         <div
                           key={m.id}
                           className={cn(
                             "rounded-xl border px-3 py-2",
                             m.author === 'coach' ? "border-primary/25 bg-primary/10" : "border-white/10 bg-card/40"
                           )}
                         >
                           <div className="flex items-center justify-between mb-1">
                             <span className={cn("text-[10px] font-black uppercase tracking-widest", m.author === 'coach' ? "text-primary" : "text-muted-foreground")}>
                               {m.author === 'coach' ? 'Coach Update' : 'Parent Note'}
                             </span>
                             <span className="text-[10px] text-muted-foreground font-mono">
                               {new Date(m.createdAt).toLocaleDateString()}
                             </span>
                           </div>
                           <p className="text-sm">{m.text}</p>
                         </div>
                       )) : (
                         <p className="text-sm text-muted-foreground italic">No messages yet.</p>
                       )}
                     </div>
                     <div className="mt-3 flex gap-2">
                       <Input
                         value={messageDraft}
                         onChange={(e) => setMessageDraft(e.target.value)}
                         placeholder="Send a message to coach (injury update, travel, availability...)"
                         className="h-9"
                       />
                       <Button size="sm" className="h-9" onClick={sendMessage}>
                         <Send className="w-3.5 h-3.5 mr-1.5" />
                         Send
                       </Button>
                     </div>
                   </div>

                   <div className="glass-card rounded-3xl border-white/5 p-5">
                     <div className="flex items-center justify-between mb-4">
                       <h3 className="text-lg font-black text-white uppercase tracking-tight">Goals Tracker</h3>
                       <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Weekly Check-ins</span>
                     </div>
                     <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                       {playerGoalRows.map((row) => {
                         const completed = row.goals.filter((g) => goalCheckins[`${row.player.id}:${g.id}`]).length;
                         return (
                           <div key={row.player.id} className="rounded-xl border border-white/10 bg-card/40 p-3">
                             <div className="flex items-center justify-between mb-2">
                               <div className="font-bold">{row.player.name}</div>
                               <div className="text-xs text-muted-foreground">{completed}/{row.goals.length} checked this week</div>
                             </div>
                             <div className="space-y-1.5">
                               {row.goals.map((goal) => {
                                 const checked = !!goalCheckins[`${row.player.id}:${goal.id}`];
                                 return (
                                   <label key={goal.id} className="flex items-start gap-2 rounded-lg border border-white/10 px-2 py-1.5 cursor-pointer hover:bg-white/5">
                                     <input
                                       type="checkbox"
                                       checked={checked}
                                       onChange={() => toggleGoalCheckin(row.player.id, goal.id)}
                                       className="mt-0.5"
                                     />
                                     <span className="text-sm leading-tight">
                                       {goal.label}
                                       {goal.deadline ? <span className="text-xs text-muted-foreground ml-1">(due {goal.deadline})</span> : null}
                                     </span>
                                   </label>
                                 );
                               })}
                             </div>
                           </div>
                         );
                       })}
                     </div>
                   </div>
                 </div>

                 {/* Recent Activity Feed */}
                 <div className="glass-card rounded-3xl border-white/5 p-5">
                     <h3 className="text-lg font-black text-white uppercase tracking-tight mb-4">Recent Activity</h3>
                     <div className="space-y-3">
                        {sharedActivityFeed.map(log => (
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
                        {sharedActivityFeed.length === 0 && (
                           <div className="py-10 text-center text-sm text-muted-foreground italic">No recent activity shared.</div>
                        )}
                     </div>
                 </div>
              </div>
           )}
        </main>

        {showStatement && (
          <ClientStatementDocument
            client={client}
            players={players}
            sessions={sessions}
            dayEvents={dayEvents}
            autoPrint={statementAutoPrint}
            onClose={() => {
              setShowStatement(false);
              setStatementAutoPrint(false);
            }}
          />
        )}
        {showWeeklyReport && (
          <ClientWeeklyReportDocument
            client={client}
            players={players}
            sessions={sessions}
            logs={logs}
            weekStart={weekStart}
            weekEnd={weekEnd}
            onClose={() => setShowWeeklyReport(false)}
          />
        )}

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
