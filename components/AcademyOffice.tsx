import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, nanoid } from '@/lib/utils';
import type { Player, Client, Payment, TrainingSession, SessionType, LocationConfig, DayEvent, DayEventType, Expense } from '@/lib/playbook';
import {
  Check, X, Phone, Search, Calendar as CalendarIcon, Users,
  Activity, Plus, Clock, FileText, Briefcase, DollarSign,
  Trash2, ChevronLeft, ChevronRight, Edit2, SlidersHorizontal,
  Share2, CreditCard, Repeat, Lock, LockOpen, CloudRain, Ban, Printer,
  BookOpen, Sparkles, TrendingDown
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InsightsDashboard } from './InsightsDashboard';
import { ClientEditPanel } from '@/components/ClientEditPanel';
import { SessionEditPanel } from '@/components/SessionEditPanel';
import { AccountsStatement } from '@/components/AccountsStatement';

interface AcademyOfficeProps {
  players: Player[];
  locations: LocationConfig[];
  clients: Client[];
  sessions: TrainingSession[];
  dayEvents: DayEvent[];
  expenses: Expense[];
  onUpdatePlayer: (player: Player) => void;
  onUpsertClient: (client: Client) => void;
  onDeleteClient?: (clientId: string) => void;
  onMergeClients?: (sourceId: string, targetId: string) => void;
  onUpsertSession: (session: TrainingSession) => void;
  onDeleteSession: (sessionId: string) => void;
  upsertDayEvent: (event: DayEvent) => void;
  deleteDayEvent: (id: string) => void;
  upsertExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;
  onUploadFile?: (bucket: string, file: File) => Promise<string | null>;
  onClose: () => void;
}

type Tab = 'insights' | 'scheduler' | 'accounts' | 'bookings' | 'payments' | 'expenses';
type RepeatMode = 'None' | 'Month' | 'Term' | 'Year';

const SESSION_PRICING = { Private: 350, Semi: 250, Group: 200 };
const SESSION_LIMITS = { Private: 1, Semi: 2, Group: 5 };
const TYPE_HIERARCHY = { Private: 1, Semi: 2, Group: 3 };

const SA_TERMS_2026 = [
   { name: "Term 1 '26", start: '2026-01-14', end: '2026-03-27' },
   { name: "Term 2 '26", start: '2026-04-08', end: '2026-06-26' },
   { name: "Term 3 '26", start: '2026-07-21', end: '2026-10-02' },
   { name: "Term 4 '26", start: '2026-10-13', end: '2026-12-09' }
];

const SA_HOLIDAYS_2026 = new Set([
   '2026-01-01', '2026-03-21', '2026-04-03', '2026-04-06', '2026-04-27', '2026-05-01', 
   '2026-06-15', '2026-06-16', '2026-08-09', '2026-08-10', '2026-09-24', '2026-12-16', 
   '2026-12-25', '2026-12-26'
]);

const getLocalISODate = (date: Date): string => {
   const offset = date.getTimezoneOffset() * 60000;
   const localDate = new Date(date.getTime() - offset);
   return localDate.toISOString().split('T')[0];
};

export function AcademyOffice({
  players, locations, clients, sessions, dayEvents = [], expenses = [],
  onUpdatePlayer, onUpsertClient, onDeleteClient, onMergeClients,
  onUpsertSession, onDeleteSession,
  upsertDayEvent, deleteDayEvent,
  upsertExpense, deleteExpense,
  onClose
}: AcademyOfficeProps) {
  const [activeTab, setActiveTab] = useState<Tab>('insights');

  return (
    <div className="flex flex-col h-full bg-radial-gradient overflow-hidden">
      <div className="h-16 shrink-0 border-b border-white/5 bg-background/60 backdrop-blur-xl flex items-center justify-between px-6 z-20 overflow-x-auto no-scrollbar gap-4">
        <div className="flex items-center gap-4 shrink-0">
           <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 p-[1px] shadow-lg glow-primary">
              <div className="h-full w-full rounded-[11px] bg-background/20 backdrop-blur-sm flex items-center justify-center text-white">
                 <Briefcase className="w-5 h-5" />
              </div>
           </div>
           <div className="hidden sm:block">
              <h1 className="text-lg font-black uppercase tracking-tighter text-gradient">Admin</h1>
              <p className="text-[10px] text-muted-foreground font-black uppercase tracking-[0.2em] opacity-60">Office Management</p>
           </div>
        </div>

        <nav className="flex items-center gap-1.5 glass p-1.5 rounded-2xl border border-white/5 shrink-0">
           <NavTab id="insights" label="Insights" icon={<Activity className="w-4 h-4"/>} active={activeTab} onClick={setActiveTab} />
           <NavTab id="scheduler" label="Scheduler" icon={<CalendarIcon className="w-4 h-4"/>} active={activeTab} onClick={setActiveTab} />
           <NavTab id="accounts" label="Accounts" icon={<Users className="w-4 h-4"/>} active={activeTab} onClick={setActiveTab} />
           <NavTab id="bookings" label="Bookings" icon={<Clock className="w-4 h-4"/>} active={activeTab} onClick={setActiveTab} />
           <NavTab id="payments" label="Ledger" icon={<DollarSign className="w-4 h-4"/>} active={activeTab} onClick={setActiveTab} />
           <NavTab id="expenses" label="Expenses" icon={<TrendingDown className="w-4 h-4"/>} active={activeTab} onClick={setActiveTab} />
        </nav>
        
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-500/10 hover:text-red-500 shrink-0">
           <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden relative">
         <div className={cn("h-full w-full", activeTab !== 'insights' && "hidden")}>
            <InsightsDashboard players={players} sessions={sessions} clients={clients} expenses={expenses} />
         </div>
         <div className={cn("h-full w-full", activeTab !== 'scheduler' && "hidden")}>
            <SchedulerWorkspace 
               players={players} locations={locations} sessions={sessions} dayEvents={dayEvents}
               onUpsertSession={onUpsertSession} onDeleteSession={onDeleteSession} 
               upsertDayEvent={upsertDayEvent} deleteDayEvent={deleteDayEvent} 
            />
         </div>
         <div className={cn("h-full w-full", activeTab !== 'accounts' && "hidden")}>
            <AccountsWorkspace
               clients={clients}
               players={players}
               sessions={sessions}
               onUpsertClient={onUpsertClient}
               onDeleteClient={onDeleteClient}
               onMergeClients={onMergeClients}
            />
         </div>
         <div className={cn("h-full w-full", activeTab !== 'bookings' && "hidden")}>
            <AccountsStatement clients={clients} players={players} sessions={sessions} />
         </div>
         <div className={cn("h-full w-full", activeTab !== 'payments' && "hidden")}>
            <PaymentLedger clients={clients} onUpsertClient={onUpsertClient} />
         </div>
         <div className={cn("h-full w-full", activeTab !== 'expenses' && "hidden")}>
            <ExpenseTracker expenses={expenses} upsertExpense={upsertExpense} deleteExpense={deleteExpense} />
         </div>
      </div>
    </div>
  );
}

// ... existing components ...

function ExpenseTracker({ expenses, upsertExpense, deleteExpense }: { expenses: Expense[], upsertExpense: (e: Expense) => void, deleteExpense: (id: string) => void }) {
   const [isAddOpen, setIsAddOpen] = useState(false);
   const [q, setQ] = useState('');
   const [sortDesc, setSortDesc] = useState(true);

   // Add Modal State
   const [date, setDate] = useState(getLocalISODate(new Date()));
   const [category, setCategory] = useState<'Equipment'|'Court Hire'|'Travel'|'Marketing'|'Salary'|'Other'>('Other');
   const [amount, setAmount] = useState('');
   const [description, setDescription] = useState('');

   const filteredExpenses = useMemo(() => {
      const list = expenses.filter(e => 
         e.description.toLowerCase().includes(q.toLowerCase()) || 
         e.category.toLowerCase().includes(q.toLowerCase())
      );
      return list.sort((a, b) => {
         const dateA = new Date(a.date).getTime();
         const dateB = new Date(b.date).getTime();
         return sortDesc ? dateB - dateA : dateA - dateB;
      });
   }, [expenses, q, sortDesc]);

   const handleAdd = () => {
      if (!amount) return;
      upsertExpense({
         id: nanoid(),
         date,
         category,
         amount: parseFloat(amount),
         description,
         createdAt: Date.now(),
         updatedAt: Date.now()
      });
      setIsAddOpen(false);
      setAmount('');
      setDescription('');
      setCategory('Other');
   };

   return (
      <div className="p-8 max-w-5xl mx-auto h-full flex flex-col relative">
         <div className="flex items-center justify-between mb-8 shrink-0">
            <div>
               <h2 className="text-3xl font-black">Expense Tracker</h2>
               <p className="text-sm text-muted-foreground">Manage operational costs</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                     placeholder="Search expenses..." 
                     value={q} 
                     onChange={e => setQ(e.target.value)} 
                     className="pl-9 w-64 bg-card/50 border-border" 
                  />
               </div>
               <Button onClick={() => setIsAddOpen(true)} className="gap-2 font-bold shadow-lg shadow-primary/20 bg-rose-500 hover:bg-rose-600 text-white">
                  <Plus className="w-4 h-4" /> Add Expense
               </Button>
            </div>
         </div>

         <div className="flex-1 overflow-hidden border border-border rounded-2xl bg-card/30 backdrop-blur-sm flex flex-col">
            <div className="grid grid-cols-[120px_1fr_2fr_1fr_60px] gap-4 p-4 border-b border-border bg-card/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
               <div className="cursor-pointer hover:text-foreground flex items-center gap-1" onClick={() => setSortDesc(!sortDesc)}>
                  Date {sortDesc ? <ChevronLeft className="w-3 h-3 -rotate-90" /> : <ChevronLeft className="w-3 h-3 rotate-90" />}
               </div>
               <div>Category</div>
               <div>Description</div>
               <div className="text-right">Amount</div>
               <div className="text-center">Action</div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
               {filteredExpenses.map(e => (
                  <div key={e.id} className="grid grid-cols-[120px_1fr_2fr_1fr_60px] gap-4 p-4 border-b border-border/50 hover:bg-card/50 transition-colors items-center text-sm">
                     <div className="font-mono text-muted-foreground">{e.date}</div>
                     <div className="font-bold text-xs uppercase tracking-wide opacity-80">{e.category}</div>
                     <div className="truncate text-muted-foreground">{e.description || '-'}</div>
                     <div className="text-right font-mono font-bold text-rose-400">R {e.amount.toLocaleString()}</div>
                     <div className="text-center">
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-rose-500" onClick={() => { if(confirm('Delete expense?')) deleteExpense(e.id); }}>
                           <Trash2 className="w-3 h-3" />
                        </Button>
                     </div>
                  </div>
               ))}
               {filteredExpenses.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground italic">No expenses recorded.</div>
               )}
            </div>
         </div>

         {isAddOpen && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-border flex items-center justify-between">
                     <h3 className="text-xl font-black tracking-tight">Add Expense</h3>
                     <Button variant="ghost" size="icon" onClick={() => setIsAddOpen(false)}><X className="w-5 h-5" /></Button>
                  </div>
                  
                  <div className="p-6 space-y-6">
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</label>
                           <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-background border-border h-12" />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Category</label>
                           <Select value={category} onValueChange={(v: any) => setCategory(v)}>
                              <SelectTrigger className="bg-background border-border h-12"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="Equipment">Equipment</SelectItem>
                                 <SelectItem value="Court Hire">Court Hire</SelectItem>
                                 <SelectItem value="Travel">Travel</SelectItem>
                                 <SelectItem value="Marketing">Marketing</SelectItem>
                                 <SelectItem value="Salary">Salary</SelectItem>
                                 <SelectItem value="Other">Other</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount (R)</label>
                        <Input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="bg-background border-border h-12 font-mono text-lg" />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Description</label>
                        <Input placeholder="Details..." value={description} onChange={e => setDescription(e.target.value)} className="bg-background border-border h-12" />
                     </div>
                  </div>

                  <div className="p-6 border-t border-border bg-card/50 rounded-b-2xl flex justify-end gap-3">
                     <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                     <Button onClick={handleAdd} disabled={!amount} className="font-bold px-8 shadow-lg bg-rose-500 hover:bg-rose-600 text-white">Save Expense</Button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}

function NavTab({ id, label, icon, active, onClick }: { id: Tab, label: string, icon: React.ReactNode, active: Tab, onClick: (t: Tab) => void }) {
   return (
      <button
         onClick={() => onClick(id)}
         className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shrink-0",
            active === id ? "bg-background shadow-lg text-primary ring-1 ring-white/10 scale-105" : "text-muted-foreground hover:text-foreground hover:bg-background/50"
         )}
      >
         {icon} {label}
      </button>
   );
}

function SchedulerWorkspace({ players, locations, sessions, dayEvents = [], onUpsertSession, onDeleteSession, upsertDayEvent, deleteDayEvent }: any) {
   const [currentDate, setCurrentDate] = useState(new Date("2026-01-26"));
   const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
   const [selectedSessionType, setSelectedSessionType] = useState<SessionType>('Private');
   const [selectedLocation, setSelectedLocation] = useState<string>("Main Court");
   const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
   const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
   const [repeatMode, setRepeatMode] = useState<RepeatMode>('None');
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);
   const [gapSelection, setGapSelection] = useState<{ date: Date, hours: number[] } | null>(null);

   const START_HOUR = 8;
   const END_HOUR = 20;

   const sortedPlayers = useMemo(() => [...players].sort((a, b) => a.name.localeCompare(b.name)), [players]);

   const getWeekDays = (date: Date) => {
      const start = new Date(date);
      const day = start.getDay(); 
      const diff = day === 0 ? 6 : day - 1; 
      start.setDate(start.getDate() - diff);
      return Array.from({ length: 7 }, (_, i) => {
         const d = new Date(start);
         d.setDate(start.getDate() + i);
         return d;
      });
   };

   const events = useMemo(() => sessions.map(s => ({
      ...s, participants: s.participantIds.map(pid => {
         const p = players.find(x => x.id === pid);
         return p ? { id: p.id, name: p.name, avatar: p.avatarColor } : { id: 'unknown', name: 'Unknown', avatar: '#ccc' };
      }),
      startKey: s.startTime
   })), [sessions, players]);

   const sessionMap = useMemo(() => {
      const map = new Map<string, any[]>();
      events.forEach(e => {
         const key = `${e.date}::${e.startKey}::${e.location}`;
         map.set(key, [...(map.get(key) || []), e]);
      });
      return map;
   }, [events]);



   const handleRemovePlayerFromSession = (sessionId: string, playerId: string) => {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;
      onUpsertSession({
         ...session,
         participantIds: session.participantIds.filter(id => id !== playerId),
         updatedAt: Date.now()
      });
   };

   const handleCleanDuplicates = () => {
      const groups: Record<string, TrainingSession[]> = {};
      sessions.forEach(s => {
         const key = `${s.date}|${s.startTime}|${s.location}`;
         if (!groups[key]) groups[key] = [];
         groups[key].push(s);
      });

      let duplicatesToDelete: string[] = [];
      Object.values(groups).forEach(group => {
         if (group.length > 1) {
            // Sort by participant count (keep the one with most players), then by update time
            group.sort((a, b) => {
               if (b.participantIds.length !== a.participantIds.length) return b.participantIds.length - a.participantIds.length;
               return (b.updatedAt || 0) - (a.updatedAt || 0);
            });
            // Mark all but the first for deletion
            for (let i = 1; i < group.length; i++) {
               duplicatesToDelete.push(group[i].id);
            }
         }
      });

      if (duplicatesToDelete.length === 0) {
         alert("No duplicate sessions found.");
         return;
      }

      if (window.confirm(`Found ${duplicatesToDelete.length} duplicate sessions. Delete them?`)) {
         duplicatesToDelete.forEach(id => onDeleteSession(id));
         alert("Duplicates removed.");
      }
   };

   const handleClearSchedule = () => {
      if (sessions.length === 0) return;
      if (window.confirm("DELETE ALL SESSIONS? Type 'DELETE' to confirm.") && window.prompt("Type 'DELETE':") === 'DELETE') {
         sessions.forEach(s => onDeleteSession(s.id));
      }
   };

   const handleResizeStart = (e: React.PointerEvent, session: TrainingSession) => {
      e.preventDefault();
      e.stopPropagation();
      
      // Find clean session from source of truth to avoid polluting state with derived view props
      const cleanSession = sessions.find(s => s.id === session.id) || session;
      
      const startY = e.clientY;
      const [endH, endM] = cleanSession.endTime.split(':').map(Number);
      const startTotalEndM = endH * 60 + endM;
      
      // Mutable state to track changes for final commit
      let currentEndTime = cleanSession.endTime;
      let currentPrice = cleanSession.price;

      const onMove = (ev: PointerEvent) => {
         const dy = ev.clientY - startY;
         // 24px = 15 minutes (96px/h)
         const minutesDelta = Math.round(dy / 24) * 15; 
         
         let newTotalM = startTotalEndM + minutesDelta;
         
         // Enforce constraints (min 15m duration from start time)
         const [sH, sM] = cleanSession.startTime.split(':').map(Number);
         const sTotal = sH * 60 + sM;
         if (newTotalM < sTotal + 15) newTotalM = sTotal + 15;
         if (newTotalM > sTotal + 300) newTotalM = sTotal + 300; // Max 5h

         const newEndH = Math.floor(newTotalM / 60);
         const newEndM = newTotalM % 60;
         currentEndTime = `${String(newEndH).padStart(2,'0')}:${String(newEndM).padStart(2,'0')}`;
         
         // Recalculate Price
         const durationMins = newTotalM - sTotal;
         const baseRate = SESSION_PRICING[cleanSession.type] || 0;
         currentPrice = Math.round((durationMins / 60) * baseRate);

         // Optimistic update
         onUpsertSession({ ...cleanSession, endTime: currentEndTime, price: currentPrice });
      };

      const onUp = () => {
         window.removeEventListener('pointermove', onMove);
         window.removeEventListener('pointerup', onUp);
         // Commit the final values tracked in the closure
         onUpsertSession({ ...cleanSession, endTime: currentEndTime, price: currentPrice, updatedAt: Date.now() });
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
   };

   const generateRecurringDates = (startDateStr: string, mode: RepeatMode = repeatMode) => {
      const dates = [startDateStr];
      if (mode === 'None') return dates;

      const start = new Date(startDateStr);
      const currentMonth = start.getMonth();
      let nextDate = new Date(start);
      nextDate.setDate(nextDate.getDate() + 7);

      const term = SA_TERMS_2026.find(t => {
         const s = new Date(t.start);
         const e = new Date(t.end);
         return start >= s && start <= e;
      });

      while (true) {
         if (mode === 'Month' && nextDate.getMonth() !== currentMonth) break;
         if (mode === 'Term') {
            if (!term || nextDate > new Date(term.end)) break;
         }
         
         dates.push(getLocalISODate(nextDate));
         nextDate.setDate(nextDate.getDate() + 7);
      }
      return dates;
   };

   const handleRepeatSession = (session: TrainingSession, mode: RepeatMode) => {
      const dates = generateRecurringDates(session.date, mode);
      // Skip first date as it is the current session
      const futureDates = dates.slice(1);
      
      const seriesId = session.seriesId || nanoid();
      if (!session.seriesId) {
         onUpsertSession({ ...session, seriesId, updatedAt: Date.now() });
      }

      let createdCount = 0;
      futureDates.forEach(d => {
         // Check for existing session at the same time and location
         const collision = sessions.find(s => 
            s.date === d && 
            s.startTime === session.startTime && 
            s.location === session.location
         );

         if (!collision) {
            onUpsertSession({
               ...session,
               id: nanoid(),
               date: d,
               seriesId,
               createdAt: Date.now(),
               updatedAt: Date.now()
            });
            createdCount++;
         }
      });
      
      if (createdCount > 0) {
         alert(`Created ${createdCount} new recurring sessions.`);
      } else {
         alert("No new sessions created (slots already filled).");
      }
   };


   const handleDrop = (e: React.DragEvent, date: Date, time: string) => {
      e.preventDefault();
      const dateStr = getLocalISODate(date);
      const transferId = e.dataTransfer.getData('text/plain');
      const session = sessions.find(s => s.id === transferId || s.id === draggedSessionId);
      
      if (session) {
         // Move existing session (No recursion)
         onUpsertSession({ ...session, date: dateStr, startTime: time, updatedAt: Date.now() });
         setDraggedSessionId(null);
         return;
      }
      
      const player = players.find(p => p.id === transferId || p.id === draggedPlayerId);
      if (player) {
         const targetKey = `${dateStr}::${time}::${selectedLocation}`;
         const existing = sessionMap.get(targetKey)?.[0];
         
         if (existing) {
            // Add to existing (No recursion)
            if (!existing.participantIds.includes(player.id)) {
               onUpsertSession({ ...existing, participantIds: [...existing.participantIds, player.id], updatedAt: Date.now() });
            }
         } else {
            // Create New (With Recursion)
            const [h, m] = time.split(':').map(Number);
            const endM = m + 60;
            const endH = h + Math.floor(endM / 60);
            const endTime = `${String(endH).padStart(2,'0')}:${String(endM % 60).padStart(2,'0')}`;
            
            const dates = generateRecurringDates(dateStr);
            const seriesId = dates.length > 1 ? nanoid() : undefined;

            dates.forEach(d => {
               onUpsertSession({ 
                  id: nanoid(), 
                  date: d, 
                  startTime: time, 
                  endTime, 
                  location: selectedLocation, 
                  type: selectedSessionType, 
                  price: SESSION_PRICING[selectedSessionType], 
                  maxCapacity: SESSION_LIMITS[selectedSessionType], 
                  participantIds: [player.id], 
                  seriesId,
                  createdAt: Date.now(), 
                  updatedAt: Date.now() 
               });
            });
         }
      }
      setDraggedPlayerId(null);
   };

   const handleCellClick = (date: Date, time: string) => {
      const dateStr = getLocalISODate(date);
      const [h, m] = time.split(':').map(Number);
      const endM = m + 60;
      const endH = h + Math.floor(endM / 60);
      const endTime = `${String(endH).padStart(2,'0')}:${String(endM % 60).padStart(2,'0')}`;
      
      const dates = generateRecurringDates(dateStr);
      const seriesId = dates.length > 1 ? nanoid() : undefined;
      let firstSession = null;

      dates.forEach((d, i) => {
         const newSession: TrainingSession = { 
            id: nanoid(), 
            date: d, 
            startTime: time, 
            endTime, 
            location: selectedLocation, 
            type: selectedSessionType, 
            price: SESSION_PRICING[selectedSessionType], 
            maxCapacity: SESSION_LIMITS[selectedSessionType], 
            participantIds: [], 
            seriesId,
            createdAt: Date.now(), 
            updatedAt: Date.now() 
         };
         onUpsertSession(newSession);
         if (i === 0) firstSession = newSession;
      });
      
      if (firstSession) setEditingSession(firstSession);
   };

   const handleEditSession = (s: any) => {
      const clean = sessions.find(sess => sess.id === s.id);
      if (clean) setEditingSession(clean);
   };

   return (
      <div className="flex flex-col md:flex-row h-full relative">
         <div className={cn("fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border p-4 flex flex-col gap-6 transition-transform duration-300 md:relative md:translate-x-0 md:bg-card/30 md:backdrop-blur-sm", isSidebarOpen ? "translate-x-0" : "-translate-x-full")}>
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
               <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                  <div className="flex gap-1">
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() - 1)))}><ChevronLeft className="w-4 h-4"/></Button>
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth() + 1)))}><ChevronRight className="w-4 h-4"/></Button>
                  </div>
               </div>
               <div className="grid grid-cols-7 gap-1">
                  {generateCalendarDays(currentDate).map((d, i) => (
                     <button key={i} onClick={() => setCurrentDate(d.date)} className={cn("h-7 w-7 rounded-md text-[10px] flex items-center justify-center transition-all relative", !d.inMonth && "opacity-20", d.isToday && "text-primary font-bold ring-1 ring-primary", d.date.toDateString() === currentDate.toDateString() && "bg-primary text-primary-foreground shadow-md")}>
                        {d.day}
                     </button>
                  ))}
               </div>
            </div>



            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Repeat Mode</label>
               <Select value={repeatMode} onValueChange={(v: RepeatMode) => setRepeatMode(v)}>
                  <SelectTrigger className="h-8 text-xs bg-card border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                     <SelectItem value="None">No Repeat</SelectItem>
                     <SelectItem value="Month">This Month</SelectItem>
                     <SelectItem value="Term">This Term</SelectItem>
                  </SelectContent>
               </Select>
            </div>

            <Button variant="destructive" className="w-full text-[10px] font-black uppercase tracking-widest" onClick={handleClearSchedule}><Trash2 className="w-3 h-3 mr-2" /> Clear Schedule</Button>
            <Button variant="outline" className="w-full text-[10px] font-black uppercase tracking-widest" onClick={handleCleanDuplicates}><Sparkles className="w-3 h-3 mr-2" /> Cleanup Duplicates</Button>

            <div className="flex-1 flex flex-col min-h-0">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Drag to Schedule</label>
               <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {sortedPlayers.map(p => (
                     <div key={p.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', p.id); setDraggedPlayerId(p.id); }} onDragEnd={() => setDraggedPlayerId(null)} className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border cursor-grab active:cursor-grabbing">
                        <div className="h-8 w-8 rounded-full border border-border/50 text-xs flex items-center justify-center font-bold text-white shrink-0" style={{ backgroundColor: p.avatarColor }}>{p.name.substring(0,2)}</div>
                        <div className="text-xs font-bold truncate">{p.name}</div>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         <div className="flex-1 flex flex-col min-w-0 bg-background">
            <div className="h-16 border-b border-border/50 flex items-center justify-between px-4 md:px-6 bg-card/10 gap-2">
               <div className="flex items-center gap-4">
                  <div className="flex gap-1">
                     <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() - (viewMode==='week'?7:1))))}><ChevronLeft className="w-4 h-4" /></Button>
                     <Button variant="outline" size="icon" onClick={() => setCurrentDate(new Date(currentDate.setDate(currentDate.getDate() + (viewMode==='week'?7:1))))}><ChevronRight className="w-4 h-4" /></Button>
                  </div>
                  <h2 className="text-xl font-bold">{currentDate.toLocaleString('default', { month: 'long', day: 'numeric' })}</h2>
               </div>
               <div className="flex bg-secondary/50 rounded-lg p-1">
                  {['month', 'week', 'day'].map(m => <button key={m} onClick={() => setViewMode(m as any)} className={cn("px-3 py-1 text-xs font-bold rounded-md transition-all", viewMode === m && "bg-background shadow text-primary")}>{m[0].toUpperCase()}</button>)}
               </div>
            </div>

            <div className="flex-1 overflow-auto bg-card/5 relative">
               {viewMode === 'week' && <WeekView currentDate={currentDate} sessionMap={sessionMap} dayEvents={dayEvents} weekDays={getWeekDays(currentDate)} onDrop={handleDrop} onEdit={handleEditSession} onRemovePlayer={handleRemovePlayerFromSession} onDragSession={setDraggedSessionId} onResizeStart={handleResizeStart} onCellClick={handleCellClick} location={selectedLocation} startHour={START_HOUR} endHour={END_HOUR} />}
               {viewMode === 'month' && <MonthView currentDate={currentDate} events={events} dayEvents={dayEvents} location={selectedLocation} onEdit={handleEditSession} />}
               {viewMode === 'day' && <DayView currentDate={currentDate} sessionMap={sessionMap} dayEvents={dayEvents} onDrop={handleDrop} onEdit={handleEditSession} onRemovePlayer={handleRemovePlayerFromSession} onResizeStart={handleResizeStart} onCellClick={handleCellClick} location={selectedLocation} startHour={START_HOUR} endHour={END_HOUR} />}
            </div>
         </div>

         {editingSession && (
            <SessionEditPanel
               session={editingSession}
               players={players}
               isOpen={true}
               onClose={() => setEditingSession(null)}
               onRepeat={(mode: RepeatMode) => handleRepeatSession(editingSession, mode)}
               onSave={(updated) => {
                  onUpsertSession(updated);
                  setEditingSession(null);
               }}
               onDelete={(id) => {
                  onDeleteSession(id);
                  setEditingSession(null);
               }}
            />
         )}
      </div>
   );
}

function WeekView({ dayEvents = [], weekDays, sessionMap, onDrop, onEdit, onRemovePlayer, onDragSession, onResizeStart, onCellClick, location, startHour, endHour }: any) {
   // Use FIXED 1-hour blocks for the grid background
   const blocks = useMemo(() => {
      const b = [];
      for(let h = startHour; h < endHour; h++) {
         const hh = String(h).padStart(2, '0');
         const time = `${hh}:00`; 
         b.push({ time, rowHeight: 'h-24' }); // 96px per hour
      }
      return b;
   }, [startHour, endHour]);

   return (
      <div className="min-w-[640px] h-full flex flex-col relative">
         <div className="grid grid-cols-[4rem_repeat(7,1fr)] border-b border-border/50 bg-background/50 sticky top-0 z-10">
            <div className="border-r border-border/50 bg-card/30" />
            {weekDays.map((day: Date, i: number) => {
               const dateStr = getLocalISODate(day), dayEvent = dayEvents.find((e: any) => e.date === dateStr);
               return (
                  <div key={i} className={cn("py-3 text-center border-r border-border/50 relative overflow-hidden", day.toDateString() === new Date().toDateString() && "bg-primary/5", dayEvent?.type === 'Rain' && "bg-blue-500/10", dayEvent?.type === 'Coach Cancelled' && "bg-red-500/10")}>
                     {dayEvent && <div className={cn("absolute inset-0 flex items-center justify-center opacity-20", dayEvent.type === 'Rain' ? "text-blue-500" : "text-red-500")}>{dayEvent.type === 'Rain' ? <CloudRain className="w-8 h-8" /> : <Ban className="w-8 h-8" />}</div>}
                     <div className="text-[10px] font-bold text-muted-foreground uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                     <div className={cn("text-lg font-black", day.toDateString() === new Date().toDateString() ? "text-primary" : "text-foreground")}>{day.getDate()}</div>
                     {dayEvent && <div className={cn("text-[8px] font-black uppercase tracking-widest", dayEvent.type === 'Rain' ? "text-blue-400" : "text-red-400")}>{dayEvent.type === 'Rain' ? "Rain Out" : "Cancelled"}</div>}
                  </div>
               );
            })}
         </div>
         <div className="flex-1 overflow-y-auto relative">
            {/* Background Grid */}
            <div className="absolute inset-0 grid grid-cols-[4rem_repeat(7,1fr)] pointer-events-none z-0">
               <div className="border-r border-border/50 bg-card/5" />
               {weekDays.map((_:any, i:number) => (
                  <div key={i} className="border-r border-border/50" />
               ))}
            </div>
            
            {/* Time Rows */}
            {blocks.map((block: any) => (
               <div key={block.time} className={cn("grid grid-cols-[4rem_repeat(7,1fr)] border-b border-border/50 relative z-0", block.rowHeight)}>
                  <div className="border-r border-border/50 flex justify-center items-start pt-2 bg-card/10 text-[10px] font-mono text-muted-foreground">{block.time}</div>
                  {weekDays.map((day: Date, i: number) => (
                     <div 
                        key={i} 
                        className="border-r border-border/50 relative group/cell" 
                        onDragOver={e => e.preventDefault()} 
                        onDrop={e => onDrop(e, day, block.time)}
                     >
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none">
                           <button 
                              onClick={() => onCellClick(day, block.time)}
                              className="bg-primary text-primary-foreground rounded-full p-1 shadow-lg hover:scale-110 transition-transform pointer-events-auto"
                           >
                              <Plus className="w-4 h-4" />
                           </button>
                        </div>
                     </div>
                  ))}
               </div>
            ))}

            {/* Absolute Sessions Layer */}
            <div className="absolute inset-0 pointer-events-none grid grid-cols-[4rem_repeat(7,1fr)] z-10">
               <div /> {/* Time column padding */}
               {weekDays.map((day: Date, dayIdx: number) => {
                  const dateStr = getLocalISODate(day);
                  const daySessions = Array.from(sessionMap.entries())
                     .filter(([key]) => key.startsWith(`${dateStr}::`))
                     .flatMap(([, s]) => s)
                     .filter((s, idx, self) => self.findIndex(x => x.id === s.id) === idx);

                  return (
                     <div key={dayIdx} className="relative h-full pointer-events-none">
                        {daySessions.map((s: any) => {
                           const [startH, startM] = s.startTime.split(':').map(Number);
                           const [endH, endM] = s.endTime.split(':').map(Number);
                           
                           const startOffsetMins = (startH * 60 + startM) - (startHour * 60);
                           const durationMins = (endH * 60 + endM) - (startH * 60 + startM);
                           
                           // 96px per hour -> 1.6px per minute
                           const top = (startOffsetMins / 60) * 96; 
                           const height = (durationMins / 60) * 96;

                           return (
                              <div 
                                 key={s.id} 
                                 draggable 
                                 onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); onDragSession(s.id); }} 
                                 className="absolute left-1 right-1 bg-card border border-primary/20 rounded-lg p-2 shadow-sm pointer-events-auto cursor-grab group flex flex-col overflow-hidden hover:z-50 hover:shadow-lg transition-shadow"
                                 style={{ top: `${top}px`, height: `${height}px` }}
                              >
                                 <div className="flex flex-row justify-between items-center mb-1 shrink-0 gap-1">
                                    <div className="flex items-baseline gap-1 min-w-0 overflow-hidden">
                                       <span className="text-[9px] font-bold uppercase text-primary/70 truncate shrink-0">{s.type}</span>
                                       <span className="text-[8px] font-mono text-muted-foreground truncate">{s.startTime}-{s.endTime}</span>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); onEdit(s); }} className="text-[10px] hover:text-primary shrink-0"><Edit2 className="w-2.5 h-3"/></button>
                                 </div>
                                 <div className="mt-1 space-y-0.5 overflow-y-auto custom-scrollbar flex-1 pb-3 pointer-events-none">
                                    {s.participants.map((p: any) => (
                                       <div key={p.id} className="flex items-center justify-between group/p text-[9px] leading-tight">
                                          <div className="flex items-center gap-1 min-w-0">
                                             <div className="w-3.5 h-3.5 rounded-full text-[7px] flex items-center justify-center font-bold text-white shrink-0" style={{ backgroundColor: p.avatar }}>{p.name.substring(0,1)}</div>
                                             <span className="truncate">{p.name}</span>
                                          </div>
                                          <button 
                                             onClick={(e) => { e.stopPropagation(); onRemovePlayer(s.id, p.id); }}
                                             className="text-red-500 opacity-0 group-hover/p:opacity-100 shrink-0 pointer-events-auto"
                                          >
                                             <X className="w-2.5 h-2.5" />
                                          </button>
                                       </div>
                                    ))}
                                 </div>
                                 {/* Resize Handle Overlay */}
                                 <div 
                                    className="absolute bottom-0 left-0 right-0 h-3 cursor-s-resize flex justify-center items-end pointer-events-auto hover:bg-primary/10 transition-colors"
                                    onPointerDown={(e) => onResizeStart(e, s)}
                                    onClick={(e) => e.stopPropagation()}
                                 >
                                    <div className="w-8 h-1 rounded-full bg-border group-hover:bg-primary/50 mb-1" />
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  );
               })}
            </div>
         </div>
      </div>
   );
}


function MonthView({ currentDate, events, dayEvents = [], location, onEdit }: any) {
   const days = generateCalendarDays(currentDate); 
   return (
      <div className="h-full flex flex-col">
         <div className="grid grid-cols-7 border-b border-border/50 bg-background/50">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => <div key={d} className="py-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">{d}</div>)}
         </div>
         <div className="flex-1 grid grid-cols-7 grid-rows-5">
            {days.map((d: any, i: number) => {
               const dateStr = getLocalISODate(d.date), dayEvent = dayEvents.find((e: any) => e.date === dateStr), daySessions = events.filter((e: any) => e.date === dateStr && e.location === location);
               return (
                  <div key={i} className={cn("border-r border-b border-border/50 p-2 min-h-[100px] relative", !d.inMonth && "bg-secondary/30", dayEvent?.type === 'Rain' && "bg-blue-500/5", dayEvent?.type === 'Coach Cancelled' && "bg-red-500/5")}>
                     <div className="flex justify-between items-center mb-2">
                        <div className={cn("text-xs font-bold", dayEvent?.type === 'Rain' ? "text-blue-500" : dayEvent?.type === 'Coach Cancelled' ? "text-red-500" : "")}>{d.day}</div>
                        <div className="flex gap-1">
                           {dayEvent?.type === 'Rain' && <CloudRain className="w-2.5 h-2.5 text-blue-500" />}
                           {dayEvent?.type === 'Coach Cancelled' && <Ban className="w-2.5 h-2.5 text-red-500" />}
                        </div>
                     </div>
                     <div className="space-y-1 overflow-y-auto max-h-[60px]">
                        {daySessions.map((s: any, idx: number) => <div key={idx} className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded truncate cursor-pointer" onClick={() => onEdit(s)}>{s.startTime} {s.type}</div>)}
                     </div>
                  </div>
               );
            })}
         </div>
      </div>
   );
}

function DayView({ currentDate, sessionMap, dayEvents = [], onDrop, onEdit, onRemovePlayer, onResizeStart, onCellClick, location, startHour, endHour }: any) {
   const dateStr = getLocalISODate(currentDate), dayEvent = dayEvents.find((e: any) => e.date === dateStr);
   
   // Use FIXED 1-hour blocks for the grid background
   const blocks = useMemo(() => {
      const b = [];
      for(let h = startHour; h < endHour; h++) {
         const hh = String(h).padStart(2, '0');
         const time = `${hh}:00`; 
         b.push({ time, rowHeight: 'h-24' }); // 96px per hour
      }
      return b;
   }, [startHour, endHour]);
   
   const daySessions = Array.from(sessionMap.entries())
      .filter(([key]) => key.startsWith(`${dateStr}::`))
      .flatMap(([, s]) => s)
      .filter((s, idx, self) => self.findIndex(x => x.id === s.id) === idx);

   return (
      <div className="max-w-3xl mx-auto h-full p-4 relative">
         {dayEvent && <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"><div className={cn("backdrop-blur-[1px] border p-6 rounded-2xl transform rotate-12 shadow-2xl", dayEvent.type === 'Rain' ? "bg-blue-500/10 border-blue-500/50" : "bg-red-500/10 border-red-500/50")}><h2 className={cn("text-4xl font-black uppercase tracking-tighter flex items-center gap-4", dayEvent.type === 'Rain' ? "text-blue-500" : "text-red-500")}>{dayEvent.type === 'Rain' ? <><CloudRain className="w-10 h-10" /> Rain Out</> : <><Ban className="w-10 h-10" /> Cancelled</>}</h2></div></div>}
         <div className="border border-border rounded-xl bg-card/20 overflow-hidden relative">
            {blocks.map((block: any) => (
               <div 
                  key={block.time} 
                  className={cn("flex border-b border-border/50", block.rowHeight, "relative group/cell")} 
                  onDragOver={e => e.preventDefault()} 
                  onDrop={e => onDrop(e, currentDate, block.time)}
               >
                  <div className="w-20 shrink-0 border-r border-border/50 bg-secondary/20 flex items-center justify-center font-mono font-bold text-muted-foreground text-xs">{block.time}</div>
                  <div className="flex-1 relative">
                     <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity pointer-events-none">
                        <button 
                           onClick={() => onCellClick(currentDate, block.time)}
                           className="bg-primary text-primary-foreground rounded-full p-1 shadow-lg hover:scale-110 transition-transform pointer-events-auto"
                        >
                           <Plus className="w-4 h-4" />
                        </button>
                     </div>
                  </div>
               </div>
            ))}

            {/* Absolute Sessions Layer */}
            <div className="absolute inset-0 pointer-events-none flex">
               <div className="w-20 shrink-0" />
               <div className="flex-1 relative">
                  {daySessions.map((s: any) => {
                     const [startH, startM] = s.startTime.split(':').map(Number);
                     const [endH, endM] = s.endTime.split(':').map(Number);
                     
                     const startOffsetMins = (startH * 60 + startM) - (startHour * 60);
                     const durationMins = (endH * 60 + endM) - (startH * 60 + startM);
                     
                     // 96px per hour -> 1.6px per minute
                     const top = (startOffsetMins / 60) * 96; 
                     const height = (durationMins / 60) * 96;

                     return (
                        <div 
                           key={s.id} 
                           className="absolute left-2 right-2 bg-card border border-primary/20 rounded-xl p-4 shadow-md pointer-events-auto cursor-pointer group flex flex-col hover:z-50 hover:shadow-xl transition-shadow"
                           style={{ top: `${top}px`, height: `${height}px` }}
                           onClick={(e) => { e.stopPropagation(); onEdit(s); }}
                        >
                           <div className="flex justify-between mb-2 shrink-0">
                              <div className="flex flex-col">
                                 <div className="font-bold text-sm text-primary">{s.type} Session</div>
                                 <div className="text-[10px] font-mono text-muted-foreground">{s.startTime} - {s.endTime}</div>
                              </div>
                              <div className="text-xs bg-secondary px-2 py-1 rounded-full h-fit">{s.participantIds.length} Players</div>
                           </div>
                           
                           <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-wrap gap-2 content-start pointer-events-none">
                              {s.participants.map((p: any) => (
                                 <div key={p.id} className="flex items-center gap-1.5 bg-background border border-border px-2 py-1 rounded-lg text-[10px] font-medium">
                                    <div className="w-4 h-4 rounded-full flex items-center justify-center font-bold text-white shrink-0" style={{ backgroundColor: p.avatar }}>{p.name.substring(0,1)}</div>
                                    <span>{p.name}</span>
                                 </div>
                              ))}
                           </div>

                           {/* Resize Handle */}
                           <div 
                              className="absolute bottom-0 left-0 right-0 h-4 cursor-s-resize flex justify-center items-end pb-1 pointer-events-auto hover:bg-primary/10 transition-colors"
                              onPointerDown={(e) => { e.stopPropagation(); onResizeStart(e, s); }}
                              onClick={(e) => e.stopPropagation()}
                           >
                              <div className="w-16 h-1 rounded-full bg-border group-hover:bg-primary/50" />
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
         </div>
      </div>
   );
}





function generateCalendarDays(date: Date) {
   const y = date.getFullYear(), m = date.getMonth(), first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
   const days = [], startPadding = first.getDay() === 0 ? 6 : first.getDay() - 1;
   for (let i = 0; i < startPadding; i++) days.push({ day: new Date(y, m, 1 - (startPadding - i)).getDate(), inMonth: false, date: new Date(y, m, 1 - (startPadding - i)) });
   for (let i = 1; i <= last.getDate(); i++) days.push({ day: i, inMonth: true, date: new Date(y, m, i) });
   while (days.length % 7 !== 0) days.push({ day: new Date(y, m, days.length - startPadding + 1).getDate(), inMonth: false, date: new Date(y, m, days.length - startPadding + 1) });
   return days;
}

function AccountsWorkspace({ clients, players, sessions, onUpsertClient, onDeleteClient, onMergeClients }: {
   clients: Client[];
   players: Player[];
   sessions: TrainingSession[];
   onUpsertClient: (client: Client) => void;
   onDeleteClient?: (clientId: string) => void;
   onMergeClients?: (sourceId: string, targetId: string) => void;
}) {
   const [q, setQ] = useState('');
   const [locationFilter, setLocationFilter] = useState('All');
   const [editingClient, setEditingClient] = useState<Client | null>(null);

   const filtered = useMemo(() => {
      let result = clients.filter((c: Client) => c.name.toLowerCase().includes(q.toLowerCase()));

      if (locationFilter !== 'All') {
         result = result.filter(c => {
            const clientPlayers = players.filter(p => p.clientId === c.id);
            return clientPlayers.some(p => p.intel?.location === locationFilter);
         });
      }

      return result.sort((a, b) => a.name.localeCompare(b.name));
   }, [clients, players, q, locationFilter]);

   return (
      <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto">
         <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-4">
               <h2 className="text-3xl font-black">Client Accounts</h2>
               <Button variant="outline" size="sm" className="gap-2" onClick={() => window.print()}>
                  <Printer className="w-4 h-4" /> Print
               </Button>
            </div>
            <div className="flex items-center gap-2">
               <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-[140px] bg-card/50 border-border">
                     <SelectValue placeholder="Location" />
                  </SelectTrigger>
                  <SelectContent>
                     <SelectItem value="All">All Locations</SelectItem>
                     <SelectItem value="Bothaville">Bothaville</SelectItem>
                     <SelectItem value="Kroonstad">Kroonstad</SelectItem>
                     <SelectItem value="Welkom">Welkom</SelectItem>
                  </SelectContent>
               </Select>
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input className="pl-9 w-64 bg-card/50" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} />
               </div>
            </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c: Client) => (
               <div
                  key={c.id}
                  onClick={() => setEditingClient(c)}
                  className="p-5 rounded-2xl glass-card flex flex-col hover:border-primary/30 transition-all cursor-pointer"
               >
                  <div className="font-bold text-lg">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone || "No Phone"}</div>
                  <div className="text-xs text-muted-foreground mt-1">
                     {players.filter(p => p.clientId === c.id).length} player(s)
                  </div>
               </div>
            ))}
         </div>

         {editingClient && (
            <ClientEditPanel
               client={editingClient}
               players={players}
               allClients={clients}
               sessions={sessions}
               isOpen={true}
               onClose={() => setEditingClient(null)}
               onSave={(updated) => {
                  onUpsertClient(updated);
                  setEditingClient(null);
               }}
               onDelete={(id) => {
                  if (onDeleteClient) onDeleteClient(id);
                  setEditingClient(null);
               }}
               onMerge={(sourceId, targetId) => {
                  if (onMergeClients) onMergeClients(sourceId, targetId);
                  setEditingClient(null);
               }}
            />
         )}
      </div>
   );
}

function PaymentLedger({ clients, onUpsertClient }: { clients: Client[], onUpsertClient: (c: Client) => void }) {
   const [isAddOpen, setIsAddOpen] = useState(false);
   const [q, setQ] = useState('');
   const [sortDesc, setSortDesc] = useState(true);

   // Add Modal State
   const [newPaymentClient, setNewPaymentClient] = useState('');
   const [newPaymentAmount, setNewPaymentAmount] = useState('');
   const [newPaymentDate, setNewPaymentDate] = useState(getLocalISODate(new Date()));
   const [newPaymentRef, setNewPaymentRef] = useState('');
   const [newPaymentNote, setNewPaymentNote] = useState('');

   const allPayments = useMemo(() => {
      const list = clients.flatMap(c => (c.payments || []).map(p => ({
         ...p,
         clientName: c.name,
         clientId: c.id
      })));
      
      const filtered = list.filter(p => 
         p.clientName.toLowerCase().includes(q.toLowerCase()) || 
         p.reference?.toLowerCase().includes(q.toLowerCase())
      );

      return filtered.sort((a, b) => {
         const dateA = new Date(a.date).getTime();
         const dateB = new Date(b.date).getTime();
         return sortDesc ? dateB - dateA : dateA - dateB;
      });
   }, [clients, q, sortDesc]);

   const handleAddPayment = () => {
      if (!newPaymentClient || !newPaymentAmount) return;
      
      const client = clients.find(c => c.id === newPaymentClient);
      if (!client) return;

      const payment: Payment = {
         id: nanoid(),
         date: newPaymentDate,
         amount: parseFloat(newPaymentAmount),
         reference: newPaymentRef,
         note: newPaymentNote
      };

      onUpsertClient({
         ...client,
         payments: [...(client.payments || []), payment],
         updatedAt: Date.now()
      });

      setIsAddOpen(false);
      setNewPaymentClient('');
      setNewPaymentAmount('');
      setNewPaymentRef('');
      setNewPaymentNote('');
   };

   return (
      <div className="p-8 max-w-5xl mx-auto h-full flex flex-col relative">
         <div className="flex items-center justify-between mb-8 shrink-0">
            <div>
               <h2 className="text-3xl font-black">Payment Ledger</h2>
               <p className="text-sm text-muted-foreground">Track all incoming payments</p>
            </div>
            <div className="flex items-center gap-4">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                     placeholder="Search ledger..." 
                     value={q} 
                     onChange={e => setQ(e.target.value)} 
                     className="pl-9 w-64 bg-card/50 border-border" 
                  />
               </div>
               <Button onClick={() => setIsAddOpen(true)} className="gap-2 font-bold shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4" /> Record Payment
               </Button>
            </div>
         </div>

         <div className="flex-1 overflow-hidden border border-border rounded-2xl bg-card/30 backdrop-blur-sm flex flex-col">
            <div className="grid grid-cols-[120px_2fr_1fr_1.5fr_1fr] gap-4 p-4 border-b border-border bg-card/50 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
               <div className="cursor-pointer hover:text-foreground flex items-center gap-1" onClick={() => setSortDesc(!sortDesc)}>
                  Date {sortDesc ? <ChevronLeft className="w-3 h-3 -rotate-90" /> : <ChevronLeft className="w-3 h-3 rotate-90" />}
               </div>
               <div>Client</div>
               <div className="text-right">Amount</div>
               <div>Reference</div>
               <div>Note</div>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar">
               {allPayments.map(p => (
                  <div key={p.id} className="grid grid-cols-[120px_2fr_1fr_1.5fr_1fr] gap-4 p-4 border-b border-border/50 hover:bg-card/50 transition-colors items-center text-sm">
                     <div className="font-mono text-muted-foreground">{p.date}</div>
                     <div className="font-bold truncate">{p.clientName}</div>
                     <div className="text-right font-mono font-bold text-emerald-400">R {p.amount.toLocaleString()}</div>
                     <div className="truncate text-muted-foreground">{p.reference || '-'}</div>
                     <div className="truncate text-muted-foreground text-xs italic">{p.note || '-'}</div>
                  </div>
               ))}
               {allPayments.length === 0 && (
                  <div className="p-8 text-center text-muted-foreground italic">No payments found.</div>
               )}
            </div>
         </div>

         {/* Add Payment Modal */}
         {isAddOpen && (
            <div className="absolute inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                  <div className="p-6 border-b border-border flex items-center justify-between">
                     <h3 className="text-xl font-black tracking-tight">Record Payment</h3>
                     <Button variant="ghost" size="icon" onClick={() => setIsAddOpen(false)}><X className="w-5 h-5" /></Button>
                  </div>
                  
                  <div className="p-6 space-y-6 overflow-y-auto">
                     <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Client</label>
                        <Select value={newPaymentClient} onValueChange={setNewPaymentClient}>
                           <SelectTrigger className="bg-background border-border h-12">
                              <SelectValue placeholder="Select Client...">
                                 {clients.find(c => c.id === newPaymentClient)?.name}
                              </SelectValue>
                           </SelectTrigger>
                           <SelectContent className="max-h-[200px]">
                              {clients.sort((a,b) => a.name.localeCompare(b.name)).map(c => (
                                 <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                              ))}
                           </SelectContent>
                        </Select>
                     </div>

                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount (R)</label>
                           <Input 
                              type="number" 
                              placeholder="0.00" 
                              value={newPaymentAmount} 
                              onChange={e => setNewPaymentAmount(e.target.value)}
                              className="bg-background border-border h-12 font-mono text-lg"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Date</label>
                           <Input 
                              type="date" 
                              value={newPaymentDate} 
                              onChange={e => setNewPaymentDate(e.target.value)}
                              className="bg-background border-border h-12"
                           />
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reference</label>
                        <Input 
                           placeholder="e.g. EFT Term 1, Cash, etc." 
                           value={newPaymentRef} 
                           onChange={e => setNewPaymentRef(e.target.value)}
                           className="bg-background border-border h-12"
                        />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Notes (Optional)</label>
                        <Input 
                           placeholder="Additional details..." 
                           value={newPaymentNote} 
                           onChange={e => setNewPaymentNote(e.target.value)}
                           className="bg-background border-border h-12"
                        />
                     </div>
                  </div>

                  <div className="p-6 border-t border-border bg-card/50 rounded-b-2xl flex justify-end gap-3">
                     <Button variant="ghost" onClick={() => setIsAddOpen(false)}>Cancel</Button>
                     <Button 
                        onClick={handleAddPayment} 
                        disabled={!newPaymentClient || !newPaymentAmount}
                        className="font-bold px-8 shadow-lg shadow-primary/20"
                     >
                        Save Payment
                     </Button>
                  </div>
               </div>
            </div>
         )}
      </div>
   );
}

