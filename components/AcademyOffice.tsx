import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, nanoid } from '@/lib/utils';
import type { Player, Client, Payment, TrainingSession, SessionType, LocationConfig, DayEvent, DayEventType } from '@/lib/playbook';
import { 
  Check, X, Phone, Search, Calendar as CalendarIcon, Users, 
  Activity, Plus, Clock, FileText, Briefcase, DollarSign,
  Trash2, ChevronLeft, ChevronRight, Edit2, SlidersHorizontal,
  Share2, CreditCard, Repeat, Lock, LockOpen, CloudRain, Ban
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InsightsDashboard } from './InsightsDashboard';

interface AcademyOfficeProps {
  players: Player[];
  locations: LocationConfig[];
  clients: Client[];
  sessions: TrainingSession[];
  dayEvents: DayEvent[];
  onUpdatePlayer: (player: Player) => void;
  onUpsertClient: (client: Client) => void;
  onUpsertSession: (session: TrainingSession) => void;
  onDeleteSession: (sessionId: string) => void;
  upsertDayEvent: (event: DayEvent) => void;
  deleteDayEvent: (id: string) => void;
  onClose: () => void;
}

type Tab = 'insights' | 'scheduler' | 'accounts' | 'bookings';
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
  players, locations, clients, sessions, dayEvents = [], 
  onUpdatePlayer, onUpsertClient, onUpsertSession, onDeleteSession, 
  upsertDayEvent, deleteDayEvent, onClose 
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
        </nav>
        
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-500/10 hover:text-red-500 shrink-0">
           <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-hidden relative">
         <div className={cn("h-full w-full", activeTab !== 'insights' && "hidden")}>
            <InsightsDashboard players={players} sessions={sessions} />
         </div>
         <div className={cn("h-full w-full", activeTab !== 'scheduler' && "hidden")}>
            <SchedulerWorkspace 
               players={players} locations={locations} sessions={sessions} dayEvents={dayEvents}
               onUpsertSession={onUpsertSession} onDeleteSession={onDeleteSession} 
               upsertDayEvent={upsertDayEvent} deleteDayEvent={deleteDayEvent} 
            />
         </div>
         <div className={cn("h-full w-full", activeTab !== 'accounts' && "hidden")}>
            <AccountsWorkspace clients={clients} players={players} onUpsertClient={onUpsertClient} />
         </div>
         <div className={cn("h-full w-full", activeTab !== 'bookings' && "hidden")}>
            <BookingsWorkspace clients={clients} players={players} sessions={sessions} />
         </div>
      </div>
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
      startHour: parseInt(s.startTime.split(':')[0])
   })), [sessions, players]);

   const sessionMap = useMemo(() => {
      const map = new Map<string, any[]>();
      events.forEach(e => {
         const key = `${e.date}::${e.startHour}::${e.location}`;
         map.set(key, [...(map.get(key) || []), e]);
      });
      return map;
   }, [events]);

   const handleMarkDay = (type: DayEventType) => {
      const dateStr = getLocalISODate(currentDate);
      const existing = dayEvents.find((e: DayEvent) => e.date === dateStr);
      if (existing && existing.type === type) deleteDayEvent(existing.id);
      else upsertDayEvent({ 
         id: existing?.id || nanoid(), 
         date: dateStr, 
         type, 
         createdAt: existing?.createdAt || Date.now(),
         updatedAt: Date.now()
      });
   };

   const handleRemovePlayerFromSession = (sessionId: string, playerId: string) => {
      const session = sessions.find(s => s.id === sessionId);
      if (!session) return;
      onUpsertSession({
         ...session,
         participantIds: session.participantIds.filter(id => id !== playerId),
         updatedAt: Date.now()
      });
   };

   const handleClearSchedule = () => {
      if (sessions.length === 0) return;
      if (window.confirm("DELETE ALL SESSIONS? Type 'DELETE' to confirm.") && window.prompt("Type 'DELETE':") === 'DELETE') {
         sessions.forEach(s => onDeleteSession(s.id));
      }
   };

   const handleDrop = (e: React.DragEvent, date: Date, time: string) => {
      e.preventDefault();
      const dateStr = getLocalISODate(date);
      const transferId = e.dataTransfer.getData('text/plain');
      const session = sessions.find(s => s.id === transferId || s.id === draggedSessionId);
      if (session) {
         onUpsertSession({ ...session, date: dateStr, startTime: time, updatedAt: Date.now() });
         setDraggedSessionId(null);
         return;
      }
      const player = players.find(p => p.id === transferId || p.id === draggedPlayerId);
      if (player) {
         const targetKey = `${dateStr}::${parseInt(time.split(':')[0])}::${selectedLocation}`;
         const existing = sessionMap.get(targetKey)?.[0];
         if (existing) {
            if (!existing.participantIds.includes(player.id)) {
               onUpsertSession({ ...existing, participantIds: [...existing.participantIds, player.id], updatedAt: Date.now() });
            }
         } else {
            onUpsertSession({ id: nanoid(), date: dateStr, startTime: time, endTime: `${parseInt(time.split(':')[0])+1}:00`, location: selectedLocation, type: selectedSessionType, price: SESSION_PRICING[selectedSessionType], maxCapacity: SESSION_LIMITS[selectedSessionType], participantIds: [player.id], createdAt: Date.now(), updatedAt: Date.now() });
         }
      }
      setDraggedPlayerId(null);
   };

   const generateCalendarDays = (date: Date) => {
      const y = date.getFullYear(), m = date.getMonth();
      const first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
      const days = [];
      const startPadding = first.getDay() === 0 ? 6 : first.getDay() - 1;
      for (let i = 0; i < startPadding; i++) days.push({ day: new Date(y, m, 1 - (startPadding - i)).getDate(), inMonth: false, date: new Date(y, m, 1 - (startPadding - i)) });
      for (let i = 1; i <= last.getDate(); i++) days.push({ day: i, inMonth: true, date: new Date(y, m, i), isToday: new Date(y, m, i).toDateString() === new Date().toDateString() });
      while (days.length % 7 !== 0) days.push({ day: new Date(y, m, days.length - startPadding + 1).getDate(), inMonth: false, date: new Date(y, m, days.length - startPadding + 1) });
      return days;
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
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Day Marker</label>
               <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleMarkDay('Rain')} className={cn("h-8 text-[10px] font-black uppercase tracking-widest gap-2", dayEvents.some((e:any) => e.date === getLocalISODate(currentDate) && e.type === 'Rain') && "bg-blue-500/20 border-blue-500 text-blue-400")}>
                     <CloudRain className="w-3 h-3" /> Rain
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleMarkDay('Coach Cancelled')} className={cn("h-8 text-[10px] font-black uppercase tracking-widest gap-2", dayEvents.some((e:any) => e.date === getLocalISODate(currentDate) && e.type === 'Coach Cancelled') && "bg-red-500/20 border-red-500 text-red-400")}>
                     <Ban className="w-3 h-3" /> Cancel
                  </Button>
               </div>
            </div>

            <Button variant="destructive" className="w-full text-[10px] font-black uppercase tracking-widest" onClick={handleClearSchedule}><Trash2 className="w-3 h-3 mr-2" /> Clear Schedule</Button>

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
               {viewMode === 'week' && <WeekView currentDate={currentDate} sessionMap={sessionMap} dayEvents={dayEvents} weekDays={getWeekDays(currentDate)} onDrop={handleDrop} onEdit={setEditingSession} onRemovePlayer={handleRemovePlayerFromSession} onDragSession={setDraggedSessionId} location={selectedLocation} startHour={START_HOUR} endHour={END_HOUR} />}
               {viewMode === 'month' && <MonthView currentDate={currentDate} events={events} dayEvents={dayEvents} location={selectedLocation} onEdit={setEditingSession} />}
               {viewMode === 'day' && <DayView currentDate={currentDate} sessionMap={sessionMap} dayEvents={dayEvents} onDrop={handleDrop} onEdit={setEditingSession} onRemovePlayer={handleRemovePlayerFromSession} location={selectedLocation} startHour={START_HOUR} endHour={END_HOUR} />}
            </div>
         </div>
      </div>
   );
}

function WeekView({ dayEvents = [], weekDays, sessionMap, onDrop, onEdit, onRemovePlayer, onDragSession, location, startHour, endHour }: any) {
   const currentHour = new Date().getHours(), currentMinute = new Date().getMinutes();
   const blocks = useMemo(() => generateSmartBlocks(startHour, endHour, sessionMap, weekDays, location), [startHour, endHour, sessionMap, weekDays, location]);

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
         <div className="flex-1 overflow-y-auto">
            {blocks.map((block: any) => block.type === 'active' && (
               <div key={block.hour} className={cn("grid grid-cols-[4rem_repeat(7,1fr)] border-b border-border/50 relative", block.rowHeight)}>
                  <div className="border-r border-border/50 flex justify-center pt-2 bg-card/10 text-xs font-mono text-muted-foreground">{block.hour}:00</div>
                  {weekDays.map((day: Date, i: number) => {
                     const dateStr = getLocalISODate(day), sessions = sessionMap.get(`${dateStr}::${block.hour}::${location}`) || [];
                     return (
                        <div key={i} className="border-r border-border/50 p-1 flex flex-col gap-1" onDragOver={e => e.preventDefault()} onDrop={e => handleDrop(e, day, `${block.hour}:00`)}>
                           {sessions.map((s: any) => (
                              <div key={s.id} draggable onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); onDragSession(s.id); }} className="w-full bg-card/50 border border-border rounded-lg p-2 shadow-sm cursor-grab">
                                 <div className="flex justify-between items-start mb-1">
                                    <span className="text-[8px] font-bold uppercase text-muted-foreground">{s.type}</span>
                                    <button onClick={() => onEdit(s)} className="text-[10px] hover:text-primary"><Edit2 className="w-2.5 h-3"/></button>
                                 </div>
                                 <div className="space-y-0.5 overflow-y-auto custom-scrollbar flex-1">
                                    {s.participants.map((p: any) => (
                                       <div key={p.id} className="flex items-center justify-between group/p text-[9px] leading-tight">
                                          <div className="flex items-center gap-1 min-w-0">
                                             <div className="w-3.5 h-3.5 rounded-full text-[7px] flex items-center justify-center font-bold text-white shrink-0" style={{ backgroundColor: p.avatar }}>{p.name.substring(0,1)}</div>
                                             <span className="truncate">{p.name}</span>
                                          </div>
                                          <button 
                                             onClick={(e) => { e.stopPropagation(); onRemovePlayer(s.id, p.id); }}
                                             className="text-red-500 opacity-0 group-hover/p:opacity-100 shrink-0"
                                          >
                                             <X className="w-2.5 h-2.5" />
                                          </button>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           ))}
                        </div>
                     );
                  })}
               </div>
            ))}
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

function DayView({ currentDate, sessionMap, dayEvents = [], onDrop, location, onEdit }: any) {
   const dateStr = getLocalISODate(currentDate), dayEvent = dayEvents.find((e: any) => e.date === dateStr);
   const blocks = generateSmartBlocks(8, 20, sessionMap, [currentDate], location);
   return (
      <div className="max-w-3xl mx-auto h-full p-4 relative">
         {dayEvent && <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none"><div className={cn("backdrop-blur-[1px] border p-6 rounded-2xl transform rotate-12 shadow-2xl", dayEvent.type === 'Rain' ? "bg-blue-500/10 border-blue-500/50" : "bg-red-500/10 border-red-500/50")}><h2 className={cn("text-4xl font-black uppercase tracking-tighter flex items-center gap-4", dayEvent.type === 'Rain' ? "text-blue-500" : "text-red-500")}>{dayEvent.type === 'Rain' ? <><CloudRain className="w-10 h-10" /> Rain Out</> : <><Ban className="w-10 h-10" /> Cancelled</>}</h2></div></div>}
         <div className="border border-border rounded-xl bg-card/20 overflow-hidden">
            {blocks.map((block: any) => block.type === 'active' && (
               <div key={block.hour} className={cn("flex border-b border-border/50", block.rowHeight)} onDragOver={e => e.preventDefault()} onDrop={e => onDrop(e, currentDate, `${block.hour}:00`)}>
                  <div className="w-20 shrink-0 border-r border-border/50 bg-secondary/20 flex items-center justify-center font-mono font-bold text-muted-foreground">{block.hour}:00</div>
                  <div className="flex-1 p-2 flex flex-col gap-2">
                     {(sessionMap.get(`${dateStr}::${block.hour}::${location}`) || []).map((s: any) => (
                        <div key={s.id} onClick={() => onEdit(s)} className="flex-1 bg-card border border-border rounded-lg p-3 shadow-sm cursor-pointer">
                           <div className="flex justify-between mb-2">
                              <div className="font-bold text-sm">{s.type} Session</div>
                              <div className="text-xs text-muted-foreground">{s.participantIds.length} Players</div>
                           </div>
                        </div>
                     ))}
                  </div>
               </div>
            ))}
         </div>
      </div>
   );
}

function generateSmartBlocks(startHour: number, endHour: number, sessionMap: any, days: Date[], location: string) {
   const activeHours = new Set<number>();
   for (let h = 13; h < endHour; h++) activeHours.add(h);
   days.forEach(d => {
      const dateStr = getLocalISODate(d);
      for(let h=startHour; h<endHour; h++) {
         if (sessionMap.get(`${dateStr}::${h}::${location}`)?.length > 0) activeHours.add(h);
      }
   });
   const blocks: any[] = [];
   for (let h = startHour; h < endHour; h++) {
      if (activeHours.has(h)) blocks.push({ type: 'active', hour: h, rowHeight: 'h-24' });
      else blocks.push({ type: 'gap', start: h, end: h+1 });
   }
   return blocks;
}

function generateCalendarDays(date: Date) {
   const y = date.getFullYear(), m = date.getMonth(), first = new Date(y, m, 1), last = new Date(y, m + 1, 0);
   const days = [], startPadding = first.getDay() === 0 ? 6 : first.getDay() - 1;
   for (let i = 0; i < startPadding; i++) days.push({ day: new Date(y, m, 1 - (startPadding - i)).getDate(), inMonth: false, date: new Date(y, m, 1 - (startPadding - i)) });
   for (let i = 1; i <= last.getDate(); i++) days.push({ day: i, inMonth: true, date: new Date(y, m, i) });
   while (days.length % 7 !== 0) days.push({ day: new Date(y, m, days.length - startPadding + 1).getDate(), inMonth: false, date: new Date(y, m, days.length - startPadding + 1) });
   return days;
}

function AccountsWorkspace({ clients, players, onUpsertClient }: any) {
   const [q, setQ] = useState('');
   const filtered = clients.filter((c: any) => c.name.toLowerCase().includes(q.toLowerCase()));
   return (
      <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto">
         <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black">Client Accounts</h2>
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
               <Input className="pl-9 w-64 bg-card/50" placeholder="Search..." value={q} onChange={e => setQ(e.target.value)} />
            </div>
         </div>
         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((c: any) => (
               <div key={c.id} className="p-5 rounded-2xl glass-card flex flex-col hover:border-primary/30 transition-all">
                  <div className="font-bold text-lg">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.phone || "No Phone"}</div>
               </div>
            ))}
         </div>
      </div>
   );
}

function BookingsWorkspace({ clients, players, sessions }: any) {
   return (
      <div className="flex h-full items-center justify-center opacity-30">
         <div className="text-center">
            <CreditCard className="w-16 h-16 mx-auto mb-4" />
            <p className="text-xl font-black uppercase tracking-widest">Bookings Workspace</p>
         </div>
      </div>
   );
}