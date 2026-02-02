import React, { useState, useEffect } from 'react';
import { X, Trash2, Clock, MapPin, Users, DollarSign, Repeat } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { TrainingSession, SessionType, Player } from '@/lib/playbook';

interface SessionEditPanelProps {
  session: TrainingSession;
  players: Player[];
  isOpen: boolean;
  onClose: () => void;
  onSave: (session: TrainingSession) => void;
  onDelete: (sessionId: string) => void;
  onRepeat?: (mode: 'Month' | 'Term') => void;
}

const SESSION_PRICING: Record<SessionType, number> = { Private: 350, Semi: 250, Group: 200 };
const SESSION_LIMITS: Record<SessionType, number> = { Private: 1, Semi: 2, Group: 5 };

export function SessionEditPanel({
  session,
  players,
  isOpen,
  onClose,
  onSave,
  onDelete,
  onRepeat
}: SessionEditPanelProps) {
  const [startTime, setStartTime] = useState(session.startTime);
  const [endTime, setEndTime] = useState(session.endTime);
  const [type, setType] = useState<SessionType>(session.type);
  const [location, setLocation] = useState(session.location);
  const [price, setPrice] = useState(session.price);
  const [maxCapacity, setMaxCapacity] = useState(session.maxCapacity);
  const [notes, setNotes] = useState(session.notes || '');

  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    setStartTime(session.startTime);
    setEndTime(session.endTime);
    setType(session.type);
    setLocation(session.location);
    setPrice(session.price);
    setMaxCapacity(session.maxCapacity);
    setNotes(session.notes || '');
    setIsDirty(false);
  }, [session]);

  useEffect(() => {
    const hasChanges = 
      startTime !== session.startTime ||
      endTime !== session.endTime ||
      type !== session.type ||
      location !== session.location ||
      price !== session.price ||
      maxCapacity !== session.maxCapacity ||
      notes !== (session.notes || '');
    setIsDirty(hasChanges);
  }, [startTime, endTime, type, location, price, maxCapacity, notes, session]);

  const calculateDuration = (start: string, end: string) => {
    const [sH, sM] = start.split(':').map(Number);
    const [eH, eM] = end.split(':').map(Number);
    return (eH * 60 + eM) - (sH * 60 + sM);
  };

  const handleTypeChange = (newType: SessionType) => {
    setType(newType);
    // Update price based on duration
    const duration = calculateDuration(startTime, endTime);
    const baseRate = SESSION_PRICING[newType] || 0;
    setPrice(Math.round((duration / 60) * baseRate));
    setMaxCapacity(SESSION_LIMITS[newType] || 1);
  };

  const handleTimeChange = (newStart: string, newEnd: string) => {
    setStartTime(newStart);
    setEndTime(newEnd);
    const duration = calculateDuration(newStart, newEnd);
    const baseRate = SESSION_PRICING[type] || 0;
    setPrice(Math.round((duration / 60) * baseRate));
  };

  const handleSave = () => {
    onSave({
      ...session,
      startTime,
      endTime,
      type,
      location,
      price,
      maxCapacity,
      notes,
      updatedAt: Date.now()
    });
    onClose();
  };

  if (!isOpen) return null;

  const duration = calculateDuration(startTime, endTime);

  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full md:w-[400px] bg-background border-l border-border z-[70] flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
        <div className="flex items-center justify-between p-4 border-b border-border shrink-0">
          <h2 className="font-bold text-lg">Edit Session</h2>
          <div className="flex items-center gap-2">
            {onRepeat && (
               <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                     <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
                        <Repeat className="w-4 h-4" />
                     </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                     <DropdownMenuItem onClick={() => onRepeat('Month')}>Repeat for Month</DropdownMenuItem>
                     <DropdownMenuItem onClick={() => onRepeat('Term')}>Repeat for Term</DropdownMenuItem>
                  </DropdownMenuContent>
               </DropdownMenu>
            )}
            <Button variant="ghost" size="icon" onClick={() => { if(window.confirm('Delete this session?')) { onDelete(session.id); onClose(); } }} className="text-muted-foreground hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-6">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Start Time</label>
                <Input type="time" value={startTime} onChange={e => handleTimeChange(e.target.value, endTime)} step="900" />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">End Time</label>
                <Input type="time" value={endTime} onChange={e => handleTimeChange(startTime, e.target.value)} step="900" />
              </div>
            </div>
            <div className="text-[10px] font-bold text-primary uppercase text-right">Duration: {duration} mins</div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Session Type</label>
              <Select value={type} onValueChange={handleTypeChange}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Private">Private</SelectItem>
                  <SelectItem value="Semi">Semi</SelectItem>
                  <SelectItem value="Group">Group</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Price (R)</label>
                <Input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Max Capacity</label>
                <Input type="number" value={maxCapacity} onChange={e => setMaxCapacity(Number(e.target.value))} />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Notes</label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                className="w-full h-24 bg-background border border-border rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Session notes..."
              />
            </div>
          </div>

          <div className="space-y-3">
             <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                   <Users className="w-4 h-4" /> Participants ({session.participantIds.length})
                </h3>
                
                <Select onValueChange={(pid) => {
                   if (!session.participantIds.includes(pid)) {
                      onSave({
                         ...session,
                         participantIds: [...session.participantIds, pid],
                         updatedAt: Date.now()
                      });
                   }
                }}>
                   <SelectTrigger className="h-6 w-32 text-[10px]">
                      <SelectValue placeholder="+ Add Player" />
                   </SelectTrigger>
                   <SelectContent>
                      {players
                         .filter(p => !session.participantIds.includes(p.id))
                         .sort((a,b) => a.name.localeCompare(b.name))
                         .map(p => (
                            <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                         ))
                      }
                   </SelectContent>
                </Select>
             </div>
             <div className="space-y-2">
                {session.participantIds.map(pid => {
                   const p = players.find(x => x.id === pid);
                   if (!p) return null;
                   return (
                      <div key={pid} className="flex items-center gap-3 p-2 rounded-lg bg-card/50 border border-border group">
                         <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: p.avatarColor }}>
                            {p.name.substring(0,2)}
                         </div>
                         <div className="flex-1 text-sm font-medium">{p.name}</div>
                         <Button
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                            onClick={() => {
                               onSave({
                                  ...session,
                                  participantIds: session.participantIds.filter(id => id !== pid),
                                  updatedAt: Date.now()
                               });
                            }}
                         >
                            <X className="w-3 h-3" />
                         </Button>
                      </div>
                   );
                })}
             </div>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-card/50 flex gap-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={!isDirty} className="flex-1">Save Changes</Button>
        </div>
      </div>
    </>
  );
}
