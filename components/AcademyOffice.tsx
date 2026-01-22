import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn, nanoid } from '@/lib/utils';
import type { Player, Session, Client, Payment, TrainingSession, SessionType } from '@/lib/playbook';
import { 
  Check, X, Phone, Search, Calendar as CalendarIcon, Users, 
  Activity, CreditCard, Plus, MapPin, 
  Copy, Share2, Briefcase, DollarSign,
  Trash2, Filter, ChevronLeft, ChevronRight,
  TrendingUp, Clock, FileText, User, Users2,
  Repeat, AlertCircle, MoreHorizontal, Edit2, SlidersHorizontal
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InsightsDashboard } from './InsightsDashboard';

import { LocationConfig } from '@/components/SettingsDialog';

interface AcademyOfficeProps {
  players: Player[];
  locations: LocationConfig[];
  clients: Client[];
  sessions: TrainingSession[];
  onUpdatePlayer: (player: Player) => void;
  onUpsertClient: (client: Client) => void;
  onUpsertSession: (session: TrainingSession) => void;
  onDeleteSession: (sessionId: string) => void;
  onClose: () => void;
}

type Tab = 'insights' | 'scheduler' | 'accounts' | 'bookings';

const SESSION_PRICING = {
   Private: 350,
   Semi: 250,
   Group: 200
};

const SESSION_LIMITS = {
   Private: 1,
   Semi: 2,
   Group: 5
};

export function AcademyOffice({ players, locations, clients, sessions, onUpdatePlayer, onUpsertClient, onUpsertSession, onDeleteSession, onClose }: AcademyOfficeProps) {
  const [activeTab, setActiveTab] = useState<Tab>('insights');

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500 overflow-hidden">
      {/* Top Navigation Bar */}
      <div className="h-16 shrink-0 border-b border-border/40 bg-background/60 backdrop-blur-xl flex items-center justify-between px-6 z-20 overflow-x-auto no-scrollbar gap-4">
        <div className="flex items-center gap-4 shrink-0">
           <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 p-[1px]">
              <div className="h-full w-full rounded-[11px] bg-background/20 backdrop-blur-sm flex items-center justify-center text-white">
                 <Briefcase className="w-5 h-5" />
              </div>
           </div>
           <div className="hidden sm:block">
              <h1 className="text-lg font-black uppercase tracking-tighter text-foreground bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">SessionPro</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Office Management</p>
           </div>
        </div>

        <nav className="flex items-center gap-1 bg-secondary/50 p-1 rounded-xl border border-border/50 shrink-0">
           <NavTab id="insights" label="Insights" icon={<Activity className="w-4 h-4"/>} active={activeTab} onClick={setActiveTab} />
           <NavTab id="scheduler" label="Scheduler" icon={<CalendarIcon className="w-4 h-4"/>} active={activeTab} onClick={setActiveTab} />
           <NavTab id="accounts" label="Accounts" icon={<Users className="w-4 h-4"/>} active={activeTab} onClick={setActiveTab} />
           <NavTab id="bookings" label="Bookings" icon={<Clock className="w-4 h-4"/>} active={activeTab} onClick={setActiveTab} />
        </nav>
        
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-red-500/10 hover:text-red-500 shrink-0">
           <X className="w-5 h-5" />
        </Button>
      </div>

      {/* Main Workspace */}
      <div className="flex-1 overflow-hidden relative">
         {activeTab === 'insights' && <InsightsDashboard players={players} sessions={sessions} />}
         {activeTab === 'scheduler' && <SchedulerWorkspace players={players} locations={locations} sessions={sessions} onUpsertSession={onUpsertSession} onDeleteSession={onDeleteSession} />}
         {activeTab === 'accounts' && <AccountsWorkspace clients={clients} players={players} onUpsertClient={onUpsertClient} />}
         {activeTab === 'bookings' && <BookingsWorkspace clients={clients} players={players} sessions={sessions} />}
      </div>
    </div>
  );
}

// ============================================
// SCHEDULER WORKSPACE
// ============================================
function SchedulerWorkspace({ players, locations, sessions, onUpsertSession, onDeleteSession }: { players: Player[], locations: LocationConfig[], sessions: TrainingSession[], onUpsertSession: (s: TrainingSession) => void, onDeleteSession: (id: string) => void }) {
   const [currentDate, setCurrentDate] = useState(new Date());
   const [viewMode, setViewMode] = useState<'month' | 'week' | 'day'>('week');
   const [selectedSessionType, setSelectedSessionType] = useState<SessionType>('Private');
   const [selectedLocation, setSelectedLocation] = useState<string>("Main Court");
   const [draggedPlayerId, setDraggedPlayerId] = useState<string | null>(null);
   const [draggedSessionId, setDraggedSessionId] = useState<string | null>(null);
   const [isRepeatEnabled, setIsRepeatEnabled] = useState(false);
   const [isSidebarOpen, setIsSidebarOpen] = useState(false);
   
   // View Range Config
   const [viewStartHour, setViewStartHour] = useState(13);
   const [viewEndHour, setViewEndHour] = useState(19);

   // Edit Modal State
   const [editingSession, setEditingSession] = useState<TrainingSession | null>(null);

   // Calendar Utilities
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

   // Derived Events (From First-Class Sessions)
   const events = useMemo(() => {
      return sessions.map(session => ({
         ...session,
         dateObj: new Date(session.date), // Helper for comparisons
         participants: session.participantIds.map(pid => {
            const p = players.find(x => x.id === pid);
            return p ? { id: p.id, name: p.name, avatar: p.avatarColor } : { id: 'unknown', name: 'Unknown', avatar: '#ccc' };
         })
      }));
   }, [sessions, players]);

   const handleDrop = (e: React.DragEvent, date: Date, time: string) => {
      e.preventDefault();
      const dateString = date.toISOString().split('T')[0];

      // CASE 1: Rescheduling Existing Session
      if (draggedSessionId) {
         const session = sessions.find(s => s.id === draggedSessionId);
         if (!session) return;

         // If dropping on same slot, do nothing
         if (session.date === dateString && session.startTime === time) {
            setDraggedSessionId(null);
            return;
         }

         onUpsertSession({
            ...session,
            date: dateString,
            startTime: time,
            endTime: `${parseInt(time.split(':')[0]) + 1}:00`,
            updatedAt: Date.now()
         });
         setDraggedSessionId(null);
         return;
      }

      // CASE 2: Adding Player (New or Existing Session)
      if (!draggedPlayerId) return;
      
      const player = players.find(p => p.id === draggedPlayerId);
      if (!player) return;

      // Check for Existing Session in this Slot
      let targetSession = sessions.find(s => 
         s.date === dateString && 
         s.startTime === time && 
         s.location === selectedLocation
      );

      if (targetSession) {
         // ADD TO EXISTING
         if (targetSession.type !== selectedSessionType) {
            if(!confirm(`This is a ${targetSession.type} session. Change it to ${selectedSessionType}?`)) return;
            targetSession = { ...targetSession, type: selectedSessionType, maxCapacity: SESSION_LIMITS[selectedSessionType] };
         }

         if (targetSession.participantIds.length >= targetSession.maxCapacity) {
            alert(`Session full! Max ${targetSession.maxCapacity}.`);
            setDraggedPlayerId(null);
            return;
         }

         if (targetSession.participantIds.includes(player.id)) {
            alert("Player already in session.");
            setDraggedPlayerId(null);
            return;
         }

         onUpsertSession({
            ...targetSession,
            participantIds: [...targetSession.participantIds, player.id],
            updatedAt: Date.now()
         });

      } else {
         // CREATE NEW SESSION
         const newSession: TrainingSession = {
            id: nanoid(),
            date: dateString,
            startTime: time,
            endTime: `${parseInt(time.split(':')[0]) + 1}:00`,
            location: selectedLocation,
            type: selectedSessionType,
            price: SESSION_PRICING[selectedSessionType],
            maxCapacity: SESSION_LIMITS[selectedSessionType],
            participantIds: [player.id],
            createdAt: Date.now(),
            updatedAt: Date.now()
         };

         if (isRepeatEnabled) {
            const nextDate = new Date(date);
            const currentMonth = nextDate.getMonth();
            const batch = [newSession];
            
            for(let i=0; i<4; i++) {
               nextDate.setDate(nextDate.getDate() + 7);
               if (nextDate.getMonth() !== currentMonth) break; 
               
               batch.push({
                  ...newSession,
                  id: nanoid(),
                  date: nextDate.toISOString().split('T')[0]
               });
            }
            batch.forEach(s => onUpsertSession(s));
         } else {
            onUpsertSession(newSession);
         }
      }
      
      setDraggedPlayerId(null);
   };

   // Auto-calculate type based on participant count
   const calculateSessionType = (count: number): SessionType => {
      if (count >= 3) return 'Group';
      if (count === 2) return 'Semi';
      return 'Private';
   };

   const handleAddParticipant = (playerId: string) => {
      if (!editingSession || editingSession.participantIds.includes(playerId)) return;
      const newIds = [...editingSession.participantIds, playerId];
      const newType = calculateSessionType(newIds.length);
      
      setEditingSession({
         ...editingSession,
         participantIds: newIds,
         type: newType,
         price: SESSION_PRICING[newType],
         maxCapacity: SESSION_LIMITS[newType]
      });
   };

   const handleRemoveParticipant = (playerId: string) => {
      if (!editingSession) return;
      const newIds = editingSession.participantIds.filter(id => id !== playerId);
      const newType = calculateSessionType(newIds.length || 1); // Default to Private if empty

      setEditingSession({
         ...editingSession,
         participantIds: newIds,
         type: newType,
         price: SESSION_PRICING[newType],
         maxCapacity: SESSION_LIMITS[newType]
      });
   };

   // Update Session Handler
   const handleUpdateSession = () => {
      if (!editingSession) return;
      onUpsertSession({ ...editingSession, updatedAt: Date.now() });
      setEditingSession(null);
   };

   // Click-to-Create Handler
   const handleCreateSession = (date: Date, time: string) => {
      const dateString = date.toISOString().split('T')[0];
      setEditingSession({
         id: nanoid(),
         date: dateString,
         startTime: time,
         endTime: `${parseInt(time.split(':')[0]) + 1}:00`,
         location: selectedLocation,
         type: selectedSessionType,
         price: SESSION_PRICING[selectedSessionType],
         maxCapacity: SESSION_LIMITS[selectedSessionType],
         participantIds: [],
         createdAt: Date.now(),
         updatedAt: Date.now()
      });
   };

   const handleDeleteSession = (sessionId: string) => {
      if (!confirm("Delete this entire session?")) return;
      onDeleteSession(sessionId);
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

   const handleNavigate = (direction: number) => {
      const d = new Date(currentDate);
      if (viewMode === 'month') d.setMonth(d.getMonth() + direction);
      else if (viewMode === 'week') d.setDate(d.getDate() + (direction * 7));
      else d.setDate(d.getDate() + direction);
      setCurrentDate(d);
   };

   return (
      <div className="flex flex-col md:flex-row h-full animate-in fade-in duration-300 relative">
         
         {/* EDIT SESSION MODAL */}
         {editingSession && (
            <div className="absolute inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
               <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center justify-between border-b border-border pb-4">
                     <div>
                        <h3 className="font-bold text-lg leading-tight">{sessions.find(s => s.id === editingSession.id) ? 'Edit Session' : 'New Session'}</h3>
                        <p className="text-xs text-muted-foreground">{editingSession.date}</p>
                     </div>
                     <div className="text-right">
                        <div className="text-lg font-black text-primary">R{editingSession.price}</div>
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{editingSession.type}</div>
                     </div>
                  </div>
                  
                  <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold text-muted-foreground uppercase">Time</label>
                           <Input type="time" value={editingSession.startTime} onChange={e => setEditingSession({...editingSession, startTime: e.target.value})} className="bg-background border-border" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold text-muted-foreground uppercase">Location</label>
                           <Input value={editingSession.location} onChange={e => setEditingSession({...editingSession, location: e.target.value})} className="bg-background border-border" />
                        </div>
                     </div>

                     {/* Participant Management */}
                     <div className="space-y-2 bg-secondary/20 p-3 rounded-xl border border-border/50">
                        <div className="flex items-center justify-between">
                           <label className="text-[10px] font-bold text-muted-foreground uppercase">Roster ({editingSession.participantIds.length})</label>
                           <Select onValueChange={handleAddParticipant}>
                              <SelectTrigger className="h-7 w-[140px] text-[10px] bg-background border-border"><SelectValue placeholder="+ Add Player" /></SelectTrigger>
                              <SelectContent className="max-h-[200px] overflow-y-auto custom-scrollbar">
                                 {players
                                    .filter(p => !editingSession.participantIds.includes(p.id))
                                    .map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)
                                 }
                              </SelectContent>
                           </Select>
                        </div>
                        
                        <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar">
                           {editingSession.participantIds.length > 0 ? (
                              editingSession.participantIds.map(pid => {
                                 const p = players.find(x => x.id === pid);
                                 if (!p) return null;
                                 return (
                                    <div key={pid} className="flex items-center justify-between p-2 rounded-lg bg-card border border-border">
                                       <div className="flex items-center gap-2">
                                          <div className="h-5 w-5 rounded-full text-[8px] flex items-center justify-center font-bold text-white" style={{ backgroundColor: p.avatarColor }}>
                                             {p.name.substring(0,1)}
                                          </div>
                                          <span className="text-xs font-bold">{p.name}</span>
                                       </div>
                                       <button onClick={() => handleRemoveParticipant(pid)} className="text-muted-foreground hover:text-red-500">
                                          <X className="w-3 h-3" />
                                       </button>
                                    </div>
                                 );
                              })
                           ) : (
                              <div className="text-center py-4 text-xs text-muted-foreground italic">No players added yet.</div>
                           )}
                        </div>
                     </div>

                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Manual Override</label>
                        <Select value={editingSession.type} onValueChange={(v: SessionType) => setEditingSession({...editingSession, type: v, price: SESSION_PRICING[v], maxCapacity: SESSION_LIMITS[v]})}>
                           <SelectTrigger className="bg-background border-border h-8 text-xs"><SelectValue /></SelectTrigger>
                           <SelectContent>
                              <SelectItem value="Private">Private (Max 1)</SelectItem>
                              <SelectItem value="Semi">Doubles (Max 2)</SelectItem>
                              <SelectItem value="Group">Group (Max 5)</SelectItem>
                           </SelectContent>
                        </Select>
                     </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-border mt-2">
                     {sessions.find(s => s.id === editingSession.id) && (
                        <Button variant="ghost" className="text-red-400 hover:text-red-500 hover:bg-red-500/10" onClick={() => { handleDeleteSession(editingSession.id); setEditingSession(null); }}>
                           Delete
                        </Button>
                     )}
                     <div className="flex-1" />
                     <Button variant="ghost" onClick={() => setEditingSession(null)}>Cancel</Button>
                     <Button onClick={handleUpdateSession} className="font-bold min-w-[80px]">
                        Save
                     </Button>
                  </div>
               </div>
            </div>
         )}

         {/* Sidebar Controls (Responsive Drawer) */}
         <div className={cn(
            "fixed inset-y-0 left-0 z-50 w-72 bg-card border-r border-border p-4 flex flex-col gap-6 transition-transform duration-300 md:relative md:translate-x-0 md:bg-card/30 md:backdrop-blur-sm",
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
         )}>
            <div className="flex items-center justify-between md:hidden">
               <h3 className="font-bold">Controls</h3>
               <Button size="icon" variant="ghost" onClick={() => setIsSidebarOpen(false)}><X className="w-5 h-5"/></Button>
            </div>

            {/* Mini Calendar (Mon Start) */}
            <div className="bg-card border border-border rounded-xl p-4 shadow-sm">
               <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</span>
                  <div className="flex gap-1">
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() - 1); setCurrentDate(d); }}><ChevronLeft className="w-4 h-4"/></Button>
                     <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { const d = new Date(currentDate); d.setMonth(d.getMonth() + 1); setCurrentDate(d); }}><ChevronRight className="w-4 h-4"/></Button>
                  </div>
               </div>
               <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-muted-foreground font-bold mb-2">
                  {['M','T','W','T','F','S','S'].map((d, i) => <div key={`${d}-${i}`}>{d}</div>)}
               </div>
               <div className="grid grid-cols-7 gap-1">
                  {generateCalendarDays(currentDate).map((d, i) => (
                     <button 
                        key={i} 
                        onClick={() => setCurrentDate(d.date)}
                        className={cn(
                           "h-7 w-7 rounded-md text-xs flex items-center justify-center transition-all",
                           !d.inMonth && "opacity-20",
                           d.isToday && "text-primary font-bold",
                           d.date.toDateString() === currentDate.toDateString() ? "bg-primary text-primary-foreground shadow-md" : "hover:bg-secondary"
                        )}
                     >
                        {d.day}
                     </button>
                  ))}
               </div>
            </div>

            {/* Session Config */}
            <div className="space-y-3">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Session Configuration</label>
               <Select value={selectedSessionType} onValueChange={(v: any) => setSelectedSessionType(v)}>
                  <SelectTrigger className="w-full bg-card border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                     <SelectItem value="Private">Private (Max 1)</SelectItem>
                     <SelectItem value="Semi">Doubles (Max 2)</SelectItem>
                     <SelectItem value="Group">Group (Max 5)</SelectItem>
                  </SelectContent>
               </Select>
               <Select value={selectedLocation} onValueChange={setSelectedLocation}>
                  <SelectTrigger className="w-full bg-card border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                     <SelectItem value="Main Court">Main Court</SelectItem>
                     {locations.map(l => <SelectItem key={l.id} value={l.name}>{l.name}</SelectItem>)}
                  </SelectContent>
               </Select>

               {/* View Range */}
               <div className="grid grid-cols-2 gap-2">
                  <div>
                     <label className="text-[9px] font-bold text-muted-foreground uppercase">Start</label>
                     <Select value={String(viewStartHour)} onValueChange={v => setViewStartHour(Number(v))}>
                        <SelectTrigger className="h-8 text-xs bg-card border-border"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-40 overflow-y-auto custom-scrollbar">
                           {Array.from({length: 24}).map((_, i) => <SelectItem key={i} value={String(i)}>{i}:00</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
                  <div>
                     <label className="text-[9px] font-bold text-muted-foreground uppercase">End</label>
                     <Select value={String(viewEndHour)} onValueChange={v => setViewEndHour(Number(v))}>
                        <SelectTrigger className="h-8 text-xs bg-card border-border"><SelectValue /></SelectTrigger>
                        <SelectContent className="max-h-40 overflow-y-auto custom-scrollbar">
                           {Array.from({length: 24}).map((_, i) => <SelectItem key={i} value={String(i)} disabled={i <= viewStartHour}>{i}:00</SelectItem>)}
                        </SelectContent>
                     </Select>
                  </div>
               </div>

               {/* Recurring Toggle */}
               <div 
                  onClick={() => setIsRepeatEnabled(!isRepeatEnabled)}
                  className={cn(
                     "flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                     isRepeatEnabled ? "bg-indigo-500/10 border-indigo-500 text-indigo-400" : "bg-card/30 border-border text-muted-foreground hover:bg-card/50"
                  )}
               >
                  <Repeat className="w-4 h-4" />
                  <div className="flex-1">
                     <p className="text-xs font-bold">Repeat for Month</p>
                     <p className="text-[9px] opacity-70">Book remainder of month</p>
                  </div>
                  {isRepeatEnabled && <Check className="w-4 h-4" />}
               </div>
            </div>

            {/* Draggable Squad */}
            <div className="flex-1 flex flex-col min-h-0">
               <label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">Drag to Schedule</label>
               <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                  {players.map(p => (
                     <div 
                        key={p.id}
                        draggable
                        onDragStart={() => setDraggedPlayerId(p.id)}
                        onDragEnd={() => setDraggedPlayerId(null)}
                        className="flex items-center gap-3 p-2.5 rounded-lg bg-card border border-border hover:border-primary/50 cursor-grab active:cursor-grabbing group transition-all shadow-sm"
                     >
                        <div className="h-8 w-8 rounded-full border border-border/50 text-xs flex items-center justify-center font-bold text-white shrink-0" style={{ backgroundColor: p.avatarColor }}>
                           {p.name.substring(0,2)}
                        </div>
                        <div className="flex-1 min-w-0">
                           <div className="text-xs font-bold truncate">{p.name}</div>
                           <div className="text-[10px] text-muted-foreground">{p.level}</div>
                        </div>
                        <div className="opacity-0 group-hover:opacity-100 text-primary">
                           <Plus className="w-4 h-4" />
                        </div>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Mobile Sidebar Overlay */}
         {isSidebarOpen && (
            <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)} />
         )}

         {/* Main Calendar View */}
         <div className="flex-1 flex flex-col min-w-0 bg-background">
            {/* Header with Navigation */}
            <div className="h-16 border-b border-border/50 flex items-center justify-between px-4 md:px-6 bg-card/10 gap-2">
               <div className="flex items-center gap-2 md:gap-4 overflow-hidden">
                  <Button variant="ghost" size="icon" className="md:hidden shrink-0" onClick={() => setIsSidebarOpen(true)}>
                     <SlidersHorizontal className="w-5 h-5" />
                  </Button>
                  
                  <div className="flex gap-1 shrink-0">
                     <Button variant="outline" size="icon" onClick={() => handleNavigate(-1)}>
                        <ChevronLeft className="w-4 h-4" />
                     </Button>
                     <Button variant="outline" size="icon" onClick={() => handleNavigate(1)}>
                        <ChevronRight className="w-4 h-4" />
                     </Button>
                     <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => setCurrentDate(new Date())}>Today</Button>
                  </div>
                  <h2 className="text-lg md:text-xl font-bold truncate">
                     {viewMode === 'month' && currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
                     {viewMode === 'day' && currentDate.toLocaleString('default', { weekday: 'short', day: 'numeric' })}
                     {viewMode === 'week' && (() => {
                        const days = getWeekDays(currentDate);
                        return `${days[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${days[6].toLocaleDateString('default', { month: 'short', day: 'numeric' })}`
                     })()}
                  </h2>
               </div>
               
               <div className="flex bg-secondary/50 rounded-lg p-1 shrink-0">
                  <button onClick={() => setViewMode('month')} className={cn("px-2 md:px-3 py-1 text-xs font-bold rounded-md transition-all", viewMode === 'month' && "bg-background shadow text-primary")}>M</button>
                  <button onClick={() => setViewMode('week')} className={cn("px-2 md:px-3 py-1 text-xs font-bold rounded-md transition-all", viewMode === 'week' && "bg-background shadow text-primary")}>W</button>
                  <button onClick={() => setViewMode('day')} className={cn("px-2 md:px-3 py-1 text-xs font-bold rounded-md transition-all", viewMode === 'day' && "bg-background shadow text-primary")}>D</button>
               </div>
            </div>

            {/* Calendar Grid */}
            <div className="flex-1 overflow-auto bg-card/5 relative">
               {viewMode === 'week' && (
                  <WeekView 
                     currentDate={currentDate} 
                     events={events} // Hide cancelled
                     onDrop={handleDrop}
                     location={selectedLocation}
                     weekDays={getWeekDays(currentDate)}
                     onRemovePlayer={handleRemovePlayerFromSession}
                     onEdit={setEditingSession}
                     onCreate={handleCreateSession}
                     onDragSession={setDraggedSessionId}
                     startHour={viewStartHour}
                     endHour={viewEndHour}
                  />
               )}
               {viewMode === 'month' && (
                  <MonthView 
                     currentDate={currentDate} 
                     events={events}
                     location={selectedLocation}
                     onEdit={setEditingSession}
                  />
               )}
               {viewMode === 'day' && (
                  <DayView 
                     currentDate={currentDate} 
                     events={events}
                     onDrop={handleDrop}
                     location={selectedLocation}
                     onRemovePlayer={handleRemovePlayerFromSession}
                     onEdit={setEditingSession}
                     onCreate={handleCreateSession}
                     onDragSession={setDraggedSessionId}
                     startHour={viewStartHour}
                     endHour={viewEndHour}
                  />
               )}
            </div>
         </div>
      </div>
   );
}

type ScheduleBlock =
  | { type: 'active'; hour: number; rowHeight: string }
  | { type: 'gap'; start: number; end: number };

function generateSmartBlocks(startHour: number, endHour: number, events: any[], days: Date[]): ScheduleBlock[] {
   const activeHours = new Set<number>();
   const activeCapacities = new Map<number, number>();

   // Scan for active sessions
   events.forEach((e: any) => {
      const h = parseInt(e.startTime.split(':')[0]);
      if (h >= startHour && h < endHour) {
         // Check if this event falls on one of the days we are viewing
         const eventDate = e.dateObj.toDateString();
         if (days.some(d => d.toDateString() === eventDate)) {
            activeHours.add(h);
            const currentMax = activeCapacities.get(h) || 0;
            // Use actual participant count to determine height, not theoretical max
            activeCapacities.set(h, Math.max(currentMax, e.participantIds.length || 1));
         }
      }
   });

   const blocks: ScheduleBlock[] = [];
   let currentGapStart = -1;

   for (let h = startHour; h < endHour; h++) {
      if (activeHours.has(h)) {
         if (currentGapStart !== -1) {
            blocks.push({ type: 'gap', start: currentGapStart, end: h });
            currentGapStart = -1;
         }
         
         // Incremental Height Scaling based on Player Count
         const maxCap = activeCapacities.get(h) || 1;
         let rowHeight = 'h-18'; // Default (1 player)
         
         if (maxCap === 2) rowHeight = 'h-22';
         else if (maxCap === 3) rowHeight = 'h-30';
         else if (maxCap === 4) rowHeight = 'h-38';
         else if (maxCap >= 5) rowHeight = 'h-42';
         
         blocks.push({ type: 'active', hour: h, rowHeight });
      } else {
         if (currentGapStart === -1) currentGapStart = h;
      }
   }
   if (currentGapStart !== -1) {
      blocks.push({ type: 'gap', start: currentGapStart, end: endHour });
   }

   return blocks;
}

function WeekView({ currentDate, events, onDrop, location, weekDays, onRemovePlayer, onEdit, onCreate, onDragSession, startHour = 6, endHour = 22 }: any) {
   const blocks = useMemo(() => generateSmartBlocks(startHour, endHour, events, weekDays), [startHour, endHour, events, weekDays]);

   return (
      <div className="min-w-[640px] h-full flex flex-col">
         {/* Header Row */}
         <div className="grid grid-cols-[4rem_repeat(7,1fr)] border-b border-border/50 bg-background/50 sticky top-0 z-10">
            <div className="border-r border-border/50 bg-card/30" />
            {weekDays.map((day: Date, i: number) => (
               <div key={i} className={cn("py-3 text-center border-r border-border/50 last:border-0", day.toDateString() === new Date().toDateString() && "bg-primary/5")}>
                  <div className="text-[10px] font-bold text-muted-foreground uppercase">{day.toLocaleDateString('en-US', { weekday: 'short' })}</div>
                  <div className={cn("text-lg font-black", day.toDateString() === new Date().toDateString() ? "text-primary" : "text-foreground")}>{day.getDate()}</div>
               </div>
            ))}
         </div>

         {/* Time Grid */}
         <div className="flex-1 overflow-y-auto">
            {blocks.map((block, bIdx) => {
               if (block.type === 'gap') {
                  return (
                     <div key={`gap-${bIdx}`} className="h-8 bg-secondary/30 border-b border-border/50 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                           Free Time • {block.start}:00 - {block.end}:00
                        </span>
                     </div>
                  );
               }

               const time = `${block.hour}:00`;
               
               return (
                  <div key={time} className={cn("grid grid-cols-[4rem_repeat(7,1fr)] border-b border-border/50 transition-all", block.rowHeight)}>
                     <div className="border-r border-border/50 flex justify-center pt-2 bg-card/10">
                        <span className="text-xs font-mono text-muted-foreground">{time}</span>
                     </div>
                     {weekDays.map((day: Date, i: number) => {
                        // Fuzzy match time (e.g. 08:30 matches 08:00 slot)
                        const session = events.find((e: any) => 
                           e.dateObj.toDateString() === day.toDateString() && 
                           parseInt(e.startTime.split(':')[0]) === block.hour &&
                           e.location === location
                        );
                        
                        return (
                           <div 
                              key={i} 
                              className="border-r border-border/50 last:border-0 p-1 relative transition-colors hover:bg-primary/5"
                              onDragOver={e => e.preventDefault()}
                              onDrop={e => onDrop(e, day, time)}
                           >
                              {session ? (
                                 <div 
                                    draggable
                                    onDragStart={() => onDragSession(session.id)}
                                    className="h-full bg-card/50 border border-border rounded-lg p-2 shadow-sm animate-in zoom-in duration-200 cursor-grab active:cursor-grabbing hover:border-primary/50 overflow-hidden flex flex-col"
                                 >
                                    <div className="flex justify-between items-start mb-1 shrink-0">
                                       <div className="flex flex-col">
                                          <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">{session.type}</span>
                                          <span className="text-[9px] font-mono opacity-50">{session.startTime}</span>
                                       </div>
                                       <button onClick={() => onEdit(session)} className="text-[10px] hover:text-primary shrink-0"><Edit2 className="w-2.5 h-3"/></button>
                                    </div>
                                    <div className="space-y-0.5 overflow-y-auto custom-scrollbar flex-1">
                                       {session.participants.map((p: any) => (
                                          <div key={p.id} className="flex items-center justify-between group/p text-[9px] leading-tight">
                                             <div className="flex items-center gap-1 min-w-0">
                                                <div className="w-3.5 h-3.5 rounded-full text-[7px] flex items-center justify-center font-bold text-white shrink-0" style={{ backgroundColor: p.avatar }}>{p.name.substring(0,1)}</div>
                                                <span className="truncate">{p.name}</span>
                                             </div>
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); onRemovePlayer(session.id, p.id); }}
                                                className="text-red-500 opacity-0 group-hover/p:opacity-100 shrink-0"
                                             >
                                                <X className="w-2.5 h-2.5" />
                                             </button>
                                          </div>
                                       ))}
                                    </div>
                                 </div>
                              ) : (
                                 <div 
                                    onClick={() => onCreate(day, time)}
                                    className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity cursor-pointer text-primary/50 hover:bg-card/20 rounded-lg"
                                 >
                                    <Plus className="w-6 h-6" />
                                 </div>
                              )}
                           </div>
                        )
                     })}
                  </div>
               );
            })}
         </div>
      </div>
   );
}

// --- Month View Component ---
function MonthView({ currentDate, events, location, onEdit }: any) {
   const days = generateCalendarDays(currentDate); 
   
   return (
      <div className="h-full flex flex-col">
         <div className="grid grid-cols-7 border-b border-border/50 bg-background/50">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
               <div key={d} className="py-2 text-center text-xs font-bold text-muted-foreground uppercase tracking-wider">{d}</div>
            ))}
         </div>
         <div className="flex-1 grid grid-cols-7 grid-rows-5">
            {days.map((d: any, i: number) => {
               const daySessions = events.filter((e: any) => e.dateObj.toDateString() === d.date.toDateString() && e.location === location);
               return (
                  <div key={i} className={cn("border-r border-b border-border/50 p-2 min-h-[100px]", !d.inMonth && "bg-secondary/30 text-muted-foreground")}>
                     <div className="text-right text-xs font-bold mb-2">{d.day}</div>
                     <div className="space-y-1 overflow-y-auto max-h-[80px] custom-scrollbar">
                        {daySessions.map((s: any, idx: number) => (
                           <div 
                              key={idx} 
                              className="text-[9px] bg-primary/10 text-primary px-1 py-0.5 rounded truncate cursor-pointer hover:bg-primary/20 transition-colors flex justify-between group/pill"
                              title={`${s.type} - ${s.participants.length} Players`}
                              onClick={() => onEdit(s)}
                           >
                              <span>{s.startTime} {s.type}</span>
                           </div>
                        ))}
                     </div>
                  </div>
               )
            })}
         </div>
      </div>
   );
}

// --- Day View Component ---
function DayView({ currentDate, events, onDrop, location, onRemovePlayer, onEdit, onCreate, onDragSession, startHour = 6, endHour = 22 }: any) {
   const blocks = useMemo(() => generateSmartBlocks(startHour, endHour, events, [currentDate]), [startHour, endHour, events, currentDate]);
   const daySessions = events.filter((e: any) => e.dateObj.toDateString() === currentDate.toDateString() && e.location === location);

   return (
      <div className="max-w-3xl mx-auto h-full p-4">
         <div className="border border-border rounded-xl bg-card/20 overflow-hidden">
            {blocks.map((block, bIdx) => {
               if (block.type === 'gap') {
                  return (
                     <div key={`gap-${bIdx}`} className="h-8 bg-secondary/30 border-b border-border/50 flex items-center justify-center">
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-70">
                           Free Time • {block.start}:00 - {block.end}:00
                        </span>
                     </div>
                  );
               }

               const time = `${block.hour}:00`;
               const session = daySessions.find((e: any) => parseInt(e.startTime.split(':')[0]) === block.hour);

               return (
                  <div 
                     key={time} 
                     className={cn("flex border-b border-border/50 last:border-0", block.rowHeight)}
                     onDragOver={e => e.preventDefault()}
                     onDrop={e => onDrop(e, currentDate, time)}
                  >
                     <div className="w-20 shrink-0 border-r border-border/50 bg-secondary/20 flex items-center justify-center font-mono font-bold text-muted-foreground">
                        {time}
                     </div>
                     <div className="flex-1 p-2 relative hover:bg-primary/5 transition-colors">
                        {session ? (
                           <div 
                              draggable
                              onDragStart={() => onDragSession(session.id)}
                              onClick={() => onEdit(session)}
                              className="h-full bg-card border border-border rounded-lg p-3 shadow-sm cursor-grab active:cursor-grabbing hover:border-primary/50 flex flex-col"
                           >
                              <div className="flex justify-between mb-2 shrink-0">
                                 <div className="font-bold text-sm">{session.type} Session</div>
                                 <div className="text-xs text-muted-foreground">{session.participants.length} / {session.maxCapacity}</div>
                              </div>
                              <div className="flex gap-2 flex-wrap overflow-y-auto custom-scrollbar flex-1 content-start">
                                 {session.participants.map((p: any) => (
                                    <div key={p.id} className="flex items-center gap-1.5 bg-secondary px-2 py-1 rounded-full border border-border h-fit">
                                       <div className="w-4 h-4 rounded-full text-[8px] flex items-center justify-center font-bold text-white" style={{ backgroundColor: p.avatar }}>{p.name.substring(0,1)}</div>
                                       <span className="text-xs font-medium">{p.name}</span>
                                       <button 
                                          onClick={(e) => { e.stopPropagation(); onRemovePlayer(session.id, p.id); }}
                                          className="ml-1 text-muted-foreground hover:text-red-500"
                                       >
                                          <X className="w-3 h-3" />
                                       </button>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        ) : (
                           <div 
                              onClick={() => onCreate(currentDate, time)}
                              className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 text-muted-foreground text-sm font-medium cursor-pointer"
                           >
                              <Plus className="w-6 h-6" /> Create Session
                           </div>
                        )}
                     </div>
                  </div>
               );
            })}
         </div>
      </div>
   );
}

// ============================================
// ACCOUNTS WORKSPACE
// ============================================
function AccountsWorkspace({ clients, players, onUpsertClient }: { clients: Client[], players: Player[], onUpsertClient: (c: Client) => void }) {
   const [q, setQ] = useState('');
   const [activeClientId, setActiveClientId] = useState<string | null>(null); // For detail/payment view
   const filtered = clients.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));

   const handleCreateClient = () => {
      const name = prompt("Client Name:");
      if (!name) return;
      onUpsertClient({
         id: nanoid(),
         name,
         email: "",
         phone: "",
         status: "Active",
         createdAt: Date.now(),
         updatedAt: Date.now(),
         payments: []
      });
   };

   // If a client is selected for editing/payment details
   const selectedClient = useMemo(() => clients.find(c => c.id === activeClientId), [clients, activeClientId]);

   if (selectedClient) {
      return (
         <ClientDetailView 
            client={selectedClient} 
            players={players.filter(p => p.clientId === selectedClient.id)}
            onBack={() => setActiveClientId(null)}
            onUpdate={onUpsertClient}
         />
      );
   }

   return (
      <div className="p-8 max-w-6xl mx-auto h-full overflow-y-auto animate-in fade-in duration-500">
         <div className="flex items-center justify-between mb-8">
            <div>
               <h2 className="text-3xl font-black tracking-tight">Client Accounts</h2>
               <p className="text-muted-foreground text-sm font-medium">Manage parent/guardian accounts and billing info</p>
            </div>
            <div className="flex gap-3">
               <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                     className="pl-9 w-64 bg-card/50 border-border" 
                     placeholder="Search clients..." 
                     value={q}
                     onChange={e => setQ(e.target.value)}
                  />
               </div>
               <Button onClick={handleCreateClient} className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl shadow-lg shadow-primary/20">
                  <Plus className="w-4 h-4 mr-2" /> Add Client
               </Button>
            </div>
         </div>

         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(client => {
               const children = players.filter(p => p.clientId === client.id);
               return (
                  <div key={client.id} className="p-5 rounded-2xl bg-card/30 border border-white/5 flex flex-col hover:border-primary/30 transition-all group backdrop-blur-md">
                     <div className="flex items-start justify-between mb-4">
                        <div className="flex gap-4">
                           <div className="h-12 w-12 rounded-xl border-2 flex items-center justify-center font-bold text-lg shadow-2xl transition-transform group-hover:scale-110 bg-primary/10 border-primary text-primary">
                              {client.name.substring(0,2)}
                           </div>
                           <div>
                              <div className="font-bold text-lg text-foreground leading-tight">{client.name}</div>
                              <div className="text-[10px] font-black uppercase text-muted-foreground tracking-widest mt-1 opacity-60">Account Holder</div>
                           </div>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setActiveClientId(client.id)} className="opacity-0 group-hover:opacity-100 transition-opacity">
                           <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        </Button>
                     </div>

                     <div className="space-y-3 mb-6 flex-1">
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                           <Phone className="w-3.5 h-3.5" /> {client.phone || "No Phone"}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                           {children.map(child => (
                              <span key={child.id} className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-bold text-muted-foreground border border-border">
                                 {child.name}
                              </span>
                           ))}
                           {children.length === 0 && <span className="text-[10px] italic text-muted-foreground">No students linked</span>}
                        </div>
                     </div>

                     <div className="pt-4 border-t border-white/5 flex gap-2">
                        <Button variant="secondary" size="sm" className="flex-1 text-[10px] font-black uppercase tracking-widest h-8" onClick={() => window.open(`tel:${client.phone}`)}>
                           <Phone className="w-3 h-3 mr-2" /> Call
                        </Button>
                        <Button variant="secondary" size="sm" className="flex-1 text-[10px] font-black uppercase tracking-widest h-8" onClick={() => setActiveClientId(client.id)}>
                           <DollarSign className="w-3 h-3 mr-2" /> Payments
                        </Button>
                     </div>
                  </div>
               );
            })}
         </div>
      </div>
   );
}

function ClientDetailView({ client, players, onBack, onUpdate }: { client: Client, players: Player[], onBack: () => void, onUpdate: (c: Client) => void }) {
   const [amount, setAmount] = useState("");
   const [note, setNote] = useState("");
   const [date, setDate] = useState(() => new Date().toLocaleDateString('en-CA'));
   const [proofFile, setProofFile] = useState<{ name: string, data: string } | null>(null);
   const fileInputRef = React.useRef<HTMLInputElement>(null);

   const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      // Limit to 500KB to prevent localStorage overflow
      if (file.size > 500 * 1024) {
         alert("File is too large! Please attach a file smaller than 500KB to ensure it saves.");
         return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
         setProofFile({ name: file.name, data: reader.result as string });
      };
      reader.readAsDataURL(file);
   };

   const handleAddPayment = () => {
      const val = parseFloat(amount);
      if (!val) return;
      
      const newPayment: Payment = {
         id: nanoid(),
         date,
         amount: val,
         note,
         reference: proofFile ? "Proof Attached" : "Manual Entry",
         proofUrl: proofFile?.data
      };
      
      onUpdate({
         ...client,
         payments: [newPayment, ...(client.payments || [])],
         updatedAt: Date.now()
      });
      
      setAmount("");
      setNote("");
      setProofFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      
      // Explicit Confirmation
      alert("Payment recorded successfully!");
   };

   const handleDeletePayment = (paymentId: string) => {
      if (!window.confirm("Are you sure you want to delete this payment record?")) return;
      
      const updatedPayments = (client.payments || []).filter(p => p.id !== paymentId);
      onUpdate({
         ...client,
         payments: updatedPayments,
         updatedAt: Date.now()
      });
   };

   return (
      <div className="p-8 max-w-4xl mx-auto h-full overflow-y-auto animate-in slide-in-from-right-8 duration-300">
         <div className="flex items-center gap-4 mb-8">
            <Button variant="ghost" size="icon" onClick={onBack}>
               <ChevronLeft className="w-6 h-6" />
            </Button>
            <div>
               <h2 className="text-3xl font-black tracking-tight">{client.name}</h2>
               <p className="text-muted-foreground text-sm font-medium">Payment History & Account Details</p>
            </div>
         </div>

         <div className="grid md:grid-cols-2 gap-8">
            {/* New Payment Form */}
            <div className="space-y-6">
               <div className="p-6 rounded-2xl bg-primary/5 border border-primary/20 space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                     <Plus className="w-4 h-4" /> Record Payment
                  </h3>
                  <div className="space-y-3">
                     <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Amount (R)</label>
                        <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="bg-background border-border text-lg font-mono" placeholder="0.00" />
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Date</label>
                        <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-background border-border color-scheme-dark" />
                     </div>
                     <div>
                        <label className="text-[10px] font-bold text-muted-foreground uppercase">Note (Optional)</label>
                        <Input value={note} onChange={e => setNote(e.target.value)} className="bg-background border-border" placeholder="e.g. EFT Reference / Advance Payment" />
                     </div>
                     
                     {/* File Attachment UI */}
                     <div>
                        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleFileUpload} />
                        <label className="text-[10px] font-bold text-muted-foreground uppercase mb-1 block">Proof of Payment</label>
                        <div className="flex gap-2">
                           <Button 
                              variant="outline" 
                              className={cn("w-full border-dashed", proofFile ? "border-emerald-500 bg-emerald-500/10 text-emerald-500" : "border-border")}
                              onClick={() => fileInputRef.current?.click()}
                           >
                              {proofFile ? (
                                 <span className="flex items-center gap-2 truncate text-xs"><Check className="w-3 h-3" /> {proofFile.name}</span>
                              ) : (
                                 <span className="flex items-center gap-2 text-xs"><FileText className="w-3 h-3" /> Attach File (Max 500KB)</span>
                              )}
                           </Button>
                           {proofFile && (
                              <Button variant="ghost" size="icon" onClick={() => { setProofFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}>
                                 <X className="w-4 h-4 text-red-500" />
                              </Button>
                           )}
                        </div>
                     </div>

                     <Button onClick={handleAddPayment} className="w-full font-bold">Add Payment</Button>
                  </div>
               </div>

               <div className="p-6 rounded-2xl bg-card/30 border border-border space-y-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Linked Students</h3>
                  <div className="space-y-2">
                     {players.map(p => (
                        <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/50">
                           <div className="h-8 w-8 rounded-full bg-card flex items-center justify-center font-bold text-xs border border-border">{p.name.substring(0,2)}</div>
                           <span className="text-sm font-medium">{p.name}</span>
                        </div>
                     ))}
                  </div>
               </div>
            </div>

            {/* Payment History */}
            <div className="space-y-4">
               <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Payment Ledger
               </h3>
               <div className="space-y-2">
                  {client.payments && client.payments.length > 0 ? (
                     client.payments.map(p => (
                        <div key={p.id} className="flex items-center justify-between p-4 rounded-xl bg-card/40 border border-border hover:bg-card/60 transition-colors group/row">
                           <div>
                              <div className="font-mono font-bold text-lg text-emerald-400">R{p.amount.toFixed(2)}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{p.date}</div>
                           </div>
                           <div className="text-right flex flex-col items-end gap-1">
                              <div className="text-xs font-bold text-foreground">{p.note || "Payment Received"}</div>
                              <div className="flex items-center gap-2">
                                 {p.proofUrl && (
                                    <button 
                                       onClick={() => {
                                          const win = window.open();
                                          if (win) {
                                             win.document.write(`<iframe src="${p.proofUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
                                          }
                                       }}
                                       className="text-[9px] bg-primary/20 text-primary px-2 py-0.5 rounded flex items-center gap-1 hover:bg-primary/30 transition-colors uppercase font-bold tracking-wider"
                                    >
                                       <FileText className="w-3 h-3" /> View Proof
                                    </button>
                                 )}
                                 <div className="text-[10px] text-muted-foreground uppercase tracking-wider">{p.reference}</div>
                                 <button 
                                    onClick={() => handleDeletePayment(p.id)}
                                    className="p-1 text-muted-foreground hover:text-red-500 opacity-0 group-hover/row:opacity-100 transition-opacity"
                                    title="Delete Payment"
                                 >
                                    <Trash2 className="w-3 h-3" />
                                 </button>
                              </div>
                           </div>
                        </div>
                     ))
                  ) : (
                     <div className="text-center py-10 italic text-muted-foreground text-sm">No payments recorded yet.</div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}

// ============================================
// BOOKINGS WORKSPACE
// ============================================
function BookingsWorkspace({ clients, players, sessions }: { clients: Client[], players: Player[], sessions: TrainingSession[] }) {
   const [activeClientId, setActiveClientId] = useState<string | null>(null);
   
   const activeClient = useMemo(() => clients.find(c => c.id === activeClientId), [clients, activeClientId]);
   
   // Aggregate Booking History for ALL linked players
   const bookingHistory = useMemo(() => {
      if (!activeClient) return [];
      
      const linkedPlayers = players.filter(p => p.clientId === activeClient.id);
      const allHistory: any[] = [];
      
      // Get all sessions where ANY linked player is a participant
      sessions.forEach(session => {
         const involvedKids = linkedPlayers.filter(p => session.participantIds.includes(p.id));
         
         involvedKids.forEach(kid => {
            allHistory.push({
               id: session.id + kid.id,
               date: session.date,
               time: session.startTime,
               student: kid.name,
               type: session.type,
               fee: session.price,
               status: 'Scheduled'
            });
         });
      });

      return allHistory.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
   }, [activeClient, players, sessions]);

   const totalBilled = bookingHistory.reduce((sum, b) => sum + b.fee, 0);
   const totalPaid = activeClient?.payments?.reduce((sum, p) => sum + p.amount, 0) || 0;
   const balanceDue = totalBilled - totalPaid;

   const handleGenerateStatement = () => {
      if (!activeClient) return;
      
      const statementHtml = `
         <html>
            <head>
               <title>Statement - ${activeClient.name}</title>
               <style>
                  body { font-family: system-ui, sans-serif; padding: 40px; max-w-3xl; margin: 0 auto; color: #1a1a1a; }
                  .header { display: flex; justify-content: space-between; margin-bottom: 40px; border-bottom: 2px solid #eee; padding-bottom: 20px; }
                  .title { font-size: 24px; font-weight: 900; letter-spacing: -1px; text-transform: uppercase; }
                  .meta { text-align: right; font-size: 12px; color: #666; }
                  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
                  th { text-align: left; border-bottom: 1px solid #000; padding: 10px 5px; text-transform: uppercase; font-size: 10px; }
                  td { border-bottom: 1px solid #eee; padding: 10px 5px; }
                  .total-row td { border-top: 2px solid #000; font-weight: bold; font-size: 16px; border-bottom: none; }
                  @media print { body { padding: 0; } .no-print { display: none; } }
               </style>
            </head>
            <body>
               <div class="header">
                  <div>
                     <div class="title">Statement</div>
                     <div style="margin-top:5px; font-weight:bold;">${activeClient.name}</div>
                     <div style="font-size:12px; color:#666;">${activeClient.phone || ''}</div>
                  </div>
                  <div class="meta">
                     Date: ${new Date().toLocaleDateString()}<br/>
                     Ref: ${activeClient.id.substring(0,8).toUpperCase()}
                  </div>
               </div>

               <table>
                  <thead>
                     <tr>
                        <th>Date</th>
                        <th>Description</th>
                        <th>Student</th>
                        <th style="text-align:right">Amount</th>
                     </tr>
                  </thead>
                  <tbody>
                     ${bookingHistory.map(b => `
                        <tr>
                           <td>${b.date}</td>
                           <td>${b.type} Session (${b.time})</td>
                           <td>${b.student}</td>
                           <td style="text-align:right">R${b.fee.toFixed(2)}</td>
                        </tr>
                     `).join('')}
                     
                     <tr class="total-row">
                        <td colspan="3" style="text-align:right; padding-top:20px;">Total Billed</td>
                        <td style="text-align:right; padding-top:20px;">R${totalBilled.toFixed(2)}</td>
                     </tr>
                     <tr>
                        <td colspan="3" style="text-align:right">Total Paid</td>
                        <td style="text-align:right; color:#059669;">- R${totalPaid.toFixed(2)}</td>
                     </tr>
                     <tr class="total-row">
                        <td colspan="3" style="text-align:right">Balance Due</td>
                        <td style="text-align:right; color:${balanceDue > 0 ? '#000' : '#059669'}">R${balanceDue.toFixed(2)}</td>
                     </tr>
                  </tbody>
               </table>

               <div style="margin-top:50px; font-size:11px; text-align:center; color:#999;">
                  Generated by SessionPro • Von Gericke Tennis Academy
               </div>
               
               <script>window.print();</script>
            </body>
         </html>
      `;
      
      const win = window.open('', '_blank');
      if (win) {
         win.document.write(statementHtml);
         win.document.close();
      }
   };

   return (
      <div className="flex h-full animate-in slide-in-from-left-4 duration-500">
         <div className="w-80 border-r border-border/40 bg-card/20 backdrop-blur-sm flex flex-col">
            <div className="p-6 border-b border-border/30 space-y-4">
               <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Select Account</h3>
               <Input placeholder="Search records..." className="bg-background/50 border-border" />
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1 custom-scrollbar">
               {clients.map(c => (
                  <button key={c.id} onClick={() => setActiveClientId(c.id)} className={cn("w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left border", activeClientId === c.id ? "bg-primary/10 border-primary shadow-lg" : "border-transparent hover:bg-secondary/50")}>
                     <div className="h-8 w-8 rounded-lg flex items-center justify-center font-bold text-xs bg-primary/20 text-primary uppercase">{c.name.substring(0,2)}</div>
                     <div className="font-bold text-sm flex-1">{c.name}</div>
                     {activeClientId === c.id && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                  </button>
               ))}
            </div>
         </div>

         <div className="flex-1 bg-secondary/10 p-10 overflow-y-auto">
            {activeClient ? (
               <div className="max-w-4xl mx-auto space-y-8">
                  <div className="flex items-center justify-between">
                     <div>
                        <h2 className="text-3xl font-black tracking-tight">{activeClient.name}</h2>
                        <p className="text-muted-foreground text-sm font-medium">Session history and account statement</p>
                     </div>
                     <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Balance Due</p>
                        <p className={cn("text-4xl font-black tracking-tighter", balanceDue > 0 ? "text-primary" : "text-emerald-400")}>
                           {balanceDue < 0 ? `+ R${Math.abs(balanceDue).toFixed(2)} (Cr)` : `R${balanceDue.toFixed(2)}`}
                        </p>
                        {totalPaid > 0 && <p className="text-xs text-muted-foreground mt-1">Paid: R{totalPaid.toFixed(2)}</p>}
                        <Button size="sm" variant="outline" className="mt-2 h-8 text-xs font-bold" onClick={handleGenerateStatement}>
                           <FileText className="w-3 h-3 mr-2" /> Generate Statement
                        </Button>
                     </div>
                  </div>

                  <div className="space-y-2">
                     <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground ml-1">Recent Bookings</h3>
                     <div className="grid gap-2">
                        {bookingHistory.map(b => (
                           <div key={b.id} className="flex items-center justify-between p-4 rounded-2xl bg-card/40 border border-white/5 group hover:border-primary/20 transition-all">
                              <div className="flex items-center gap-6">
                                 <div className="text-sm font-black text-foreground w-24">{b.date}</div>
                                 <div className="text-xs font-mono text-muted-foreground">{b.time}</div>
                                 <div className="text-xs font-bold text-foreground">{b.student}</div>
                                 <div className={cn("px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-widest border", 
                                    b.type === 'Private' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                                    b.type === 'Semi' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 
                                    'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                 )}>{b.type}</div>
                              </div>
                              <div className="flex items-center gap-6">
                                 <span className="text-sm font-black">R{b.fee}</span>
                                 {(() => {
                                    const isPast = new Date(b.date + 'T' + b.time) < new Date();
                                    return (
                                       <span className={cn(
                                          "px-2 py-1 rounded-full text-[10px] font-bold border",
                                          isPast 
                                             ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                                             : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                       )}>
                                          {isPast ? "Completed" : "Scheduled"}
                                       </span>
                                    );
                                 })()}
                                 <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><Share2 className="w-4 h-4"/></Button>
                              </div>
                           </div>
                        ))}
                        {bookingHistory.length === 0 && <div className="text-center py-20 bg-card/5 rounded-2xl border border-dashed border-border italic text-muted-foreground text-sm">No completed sessions found for this account.</div>}
                     </div>
                  </div>
               </div>
            ) : (
               <div className="h-full flex flex-col items-center justify-center opacity-30">
                  <div className="h-20 w-20 rounded-3xl bg-secondary flex items-center justify-center mb-4"><CreditCard className="w-10 h-10"/></div>
                  <p className="text-xl font-black uppercase tracking-widest">Select an Account</p>
               </div>
            )}
         </div>
      </div>
   );
}

function NavTab({ id, label, icon, active, onClick }: { id: Tab, label: string, icon: React.ReactNode, active: Tab, onClick: (t: Tab) => void }) {
   const isActive = active === id;
   return (
      <button
         onClick={() => onClick(id)}
         className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all shrink-0",
            isActive 
               ? "bg-background shadow-lg text-primary ring-1 ring-black/5 dark:ring-white/10 scale-105" 
               : "text-muted-foreground hover:text-foreground hover:bg-background/50"
         )}
      >
         {icon}
         {label}
      </button>
   );
}

// Generate a month view grid for the sidebar - MON START
function generateCalendarDays(currentDate: Date) {
   const year = currentDate.getFullYear();
   const month = currentDate.getMonth();
   const firstDay = new Date(year, month, 1);
   const lastDay = new Date(year, month + 1, 0);
   
   const days = [];
   const dayOfWeek = firstDay.getDay(); // 0(Sun) - 6(Sat)
   // Mon(1) should be 0. Sun(0) should be 6.
   const startPadding = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
   
   for (let i = 0; i < startPadding; i++) {
      const d = new Date(year, month, 1 - (startPadding - i));
      days.push({ day: d.getDate(), inMonth: false, date: d });
   }
   
   for (let i = 1; i <= lastDay.getDate(); i++) {
      const d = new Date(year, month, i);
      const isToday = d.toDateString() === new Date().toDateString();
      days.push({ day: i, inMonth: true, date: d, isToday });
   }
   
   // Pad end
   while (days.length % 7 !== 0) {
      const d = new Date(year, month, days.length - startPadding + 1);
      days.push({ day: d.getDate(), inMonth: false, date: d });
   }
   
   return days;
}
