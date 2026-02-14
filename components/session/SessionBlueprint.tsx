import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, nanoid, parseISODateLocal, toLocalISODate } from '@/lib/utils';
import type { Drill, TrainingSession, Player, SessionType } from '@/lib/playbook';
import { DrillThumbnail } from '@/components/DrillThumbnail';
import { 
  Calendar, Clock, MapPin, Users, Plus, X, GripVertical,
  AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight,
  Clock3, Dumbbell
} from 'lucide-react';

interface SessionBlueprintProps {
  drills: Drill[];
  players: Player[];
  existingSessions: TrainingSession[];
  onCreateSessions: (sessions: TrainingSession[]) => void;
  locations: string[];
}

interface BlueprintSession {
  id: string;
  tempId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  type: SessionType;
  drillIds: string[];
  participantIds: string[];
  notes: string;
}

const SESSION_PRICING: Record<SessionType, number> = { Private: 350, Semi: 250, Group: 200 };
const SESSION_LIMITS: Record<SessionType, number> = { Private: 1, Semi: 2, Group: 5 };
const TIME_SLOTS = [
  '08:00', '09:00', '10:00', '11:00', '12:00', 
  '14:00', '15:00', '16:00', '17:00', '18:00', '19:00'
];

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function SessionBlueprint({ 
  drills, 
  players, 
  existingSessions, 
  onCreateSessions,
  locations 
}: SessionBlueprintProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [blueprintSessions, setBlueprintSessions] = useState<BlueprintSession[]>([]);
  const [draggedDrill, setDraggedDrill] = useState<Drill | null>(null);
  const [selectedLocation, setSelectedLocation] = useState(locations[0] || 'Main Court');
  const [selectedType, setSelectedType] = useState<SessionType>('Private');
  const [hoveredDrill, setHoveredDrill] = useState<Drill | null>(null);
  const [showConflicts, setShowConflicts] = useState(true);

  // Get week dates
  const weekDates = useMemo(() => {
    const start = new Date(currentWeek);
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [currentWeek]);

  // Calculate total weekly minutes
  const totalMinutes = useMemo(() => {
    return blueprintSessions.reduce((total, s) => {
      const [startH, startM] = s.startTime.split(':').map(Number);
      const [endH, endM] = s.endTime.split(':').map(Number);
      return total + ((endH * 60 + endM) - (startH * 60 + startM));
    }, 0);
  }, [blueprintSessions]);

  // Check for conflicts
  const getConflicts = useCallback((date: string, startTime: string, endTime: string, excludeId?: string) => {
    return existingSessions.filter(s => {
      if (s.date !== date) return false;
      if (excludeId && s.id === excludeId) return false;
      // Check time overlap
      return (startTime < s.endTime && endTime > s.startTime);
    });
  }, [existingSessions]);

  const handleDrop = (e: React.DragEvent, date: Date, timeSlot: string) => {
    e.preventDefault();
    if (!draggedDrill) return;

    const dateStr = toLocalISODate(date);
    const [h, m] = timeSlot.split(':').map(Number);
    const endH = h + 1;
    const endTime = `${String(endH).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

    // Check for conflicts
    const conflicts = getConflicts(dateStr, timeSlot, endTime);

    const newSession: BlueprintSession = {
      id: '', // Will be assigned on apply
      tempId: nanoid(),
      date: dateStr,
      startTime: timeSlot,
      endTime,
      location: selectedLocation,
      type: selectedType,
      drillIds: [draggedDrill.id!],
      participantIds: [],
      notes: `Drill: ${draggedDrill.name}`,
    };

    setBlueprintSessions(prev => [...prev, newSession]);
    setDraggedDrill(null);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const removeSession = (tempId: string) => {
    setBlueprintSessions(prev => prev.filter(s => s.tempId !== tempId));
  };

  const updateSession = (tempId: string, updates: Partial<BlueprintSession>) => {
    setBlueprintSessions(prev => prev.map(s => 
      s.tempId === tempId ? { ...s, ...updates } : s
    ));
  };

  const addDrillToSession = (tempId: string, drill: Drill) => {
    setBlueprintSessions(prev => prev.map(s => {
      if (s.tempId !== tempId) return s;
      if (s.drillIds.includes(drill.id!)) return s;
      return {
        ...s,
        drillIds: [...s.drillIds, drill.id!],
        notes: `${s.notes}, ${drill.name}`,
      };
    }));
  };

  const removeDrillFromSession = (tempId: string, drillId: string) => {
    setBlueprintSessions(prev => prev.map(s => {
      if (s.tempId !== tempId) return s;
      return {
        ...s,
        drillIds: s.drillIds.filter(id => id !== drillId),
      };
    }));
  };

  const handleApply = () => {
    if (blueprintSessions.length === 0) return;

    const sessions: TrainingSession[] = blueprintSessions.map(blueprint => ({
      id: nanoid(),
      date: blueprint.date,
      startTime: blueprint.startTime,
      endTime: blueprint.endTime,
      location: blueprint.location,
      type: blueprint.type,
      price: SESSION_PRICING[blueprint.type],
      maxCapacity: SESSION_LIMITS[blueprint.type],
      participantIds: blueprint.participantIds,
      notes: blueprint.notes,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }));

    onCreateSessions(sessions);
    setBlueprintSessions([]);
  };

  const getSessionDrills = (drillIds: string[]) => {
    return drillIds.map(id => drills.find(d => d.id === id)).filter(Boolean) as Drill[];
  };

  const formatDuration = (mins: number) => {
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    if (hrs === 0) return `${remainingMins}m`;
    if (remainingMins === 0) return `${hrs}h`;
    return `${hrs}h ${remainingMins}m`;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-card/50">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black uppercase tracking-tight">Session Blueprint</h2>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock3 className="w-4 h-4" />
            <span className="font-mono font-bold text-primary">{formatDuration(totalMinutes)}</span>
            <span>planned this week</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-36 h-8 text-xs">
                <MapPin className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {locations.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Select value={selectedType} onValueChange={(v) => setSelectedType(v as SessionType)}>
              <SelectTrigger className="w-28 h-8 text-xs">
                <Users className="w-3 h-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Private">Private</SelectItem>
                <SelectItem value="Semi">Semi</SelectItem>
                <SelectItem value="Group">Group</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowConflicts(!showConflicts)}
            className={cn("h-8 text-xs", showConflicts && "text-amber-500")}
          >
            <AlertTriangle className="w-3.5 h-3.5 mr-1" />
            Conflicts
          </Button>

          <Button 
            onClick={handleApply}
            disabled={blueprintSessions.length === 0}
            className="h-8 text-xs gap-1"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Apply to Schedule ({blueprintSessions.length})
          </Button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Drill Library */}
        <div className="w-80 border-r border-border bg-card/30 flex flex-col">
          <div className="p-3 border-b border-border">
            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Dumbbell className="w-3.5 h-3.5" />
              Drill Library
            </h3>
            <p className="text-[10px] text-muted-foreground mt-1">
              Drag drills to the timeline
            </p>
          </div>
          
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {drills.map((drill) => (
              <div
                key={drill.id}
                draggable
                onDragStart={() => setDraggedDrill(drill)}
                onDragEnd={() => setDraggedDrill(null)}
                onMouseEnter={() => setHoveredDrill(drill)}
                onMouseLeave={() => setHoveredDrill(null)}
                className="p-3 bg-card border border-border rounded-lg cursor-grab active:cursor-grabbing hover:border-primary/50 hover:shadow-sm transition-all group"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-sm truncate">{drill.name}</h4>
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {drill.intensity}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">
                        {drill.durationMins || 10}m
                      </span>
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </div>
              </div>
            ))}
          </div>

          {/* Drill Preview */}
          {hoveredDrill && (
            <div className="absolute left-[340px] top-20 z-50 w-72 bg-card border border-border rounded-xl shadow-2xl p-3 pointer-events-none">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-bold text-muted-foreground uppercase">Preview</span>
                <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded">{hoveredDrill.session}</span>
              </div>
              <DrillThumbnail drill={hoveredDrill} className="w-full h-auto aspect-[2/1] rounded-lg bg-secondary border border-border/50" />
              <div className="mt-2">
                <div className="font-bold text-sm">{hoveredDrill.name}</div>
                <p className="text-[11px] text-muted-foreground line-clamp-2 mt-1">{hoveredDrill.description}</p>
              </div>
            </div>
          )}
        </div>

        {/* Right Panel - Weekly Timeline */}
        <div className="flex-1 flex flex-col overflow-hidden bg-background">
          {/* Week Navigation */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                const d = new Date(currentWeek);
                d.setDate(d.getDate() - 7);
                setCurrentWeek(d);
              }}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-bold min-w-[140px] text-center">
                {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                const d = new Date(currentWeek);
                d.setDate(d.getDate() + 7);
                setCurrentWeek(d);
              }}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="text-xs text-muted-foreground">
              {blueprintSessions.length} session{blueprintSessions.length !== 1 ? 's' : ''} planned
            </div>
          </div>

          {/* Timeline Grid */}
          <div className="flex-1 overflow-auto">
            <div className="min-w-[800px] p-4">
              {/* Day Headers */}
              <div className="grid grid-cols-8 gap-2 mb-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Time</div>
                {weekDates.map((date, i) => (
                  <div key={i} className={cn(
                    "text-center p-2 rounded-lg",
                    date.toDateString() === new Date().toDateString() 
                      ? "bg-primary/10 text-primary" 
                      : "bg-card/50"
                  )}>
                    <div className="text-xs font-bold">{DAYS[i]}</div>
                    <div className="text-[10px] text-muted-foreground">{date.getDate()}</div>
                  </div>
                ))}
              </div>

              {/* Time Slots */}
              <div className="space-y-1">
                {TIME_SLOTS.map((timeSlot) => (
                  <div key={timeSlot} className="grid grid-cols-8 gap-2">
                    {/* Time Label */}
                    <div className="flex items-center justify-center text-[10px] font-mono text-muted-foreground">
                      {timeSlot}
                    </div>
                    
                    {/* Day Cells */}
                    {weekDates.map((date, dayIndex) => {
                      const dateStr = toLocalISODate(date);
                      const [h, m] = timeSlot.split(':').map(Number);
                      const endTime = `${String(h + 1).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
                      
                      // Find sessions in this slot
                      const slotSessions = blueprintSessions.filter(s => 
                        s.date === dateStr && s.startTime === timeSlot
                      );
                      
                      // Check conflicts
                      const conflicts = showConflicts ? getConflicts(dateStr, timeSlot, endTime) : [];
                      
                      return (
                        <div
                          key={dayIndex}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, date, timeSlot)}
                          className={cn(
                            "min-h-[60px] rounded-lg border transition-all relative",
                            conflicts.length > 0 
                              ? "bg-amber-500/10 border-amber-500/30" 
                              : "bg-card/30 border-border hover:border-primary/30 hover:bg-card/50"
                          )}
                        >
                          {/* Conflict Indicator */}
                          {conflicts.length > 0 && (
                            <div className="absolute top-0.5 right-0.5">
                              <AlertTriangle className="w-3 h-3 text-amber-500" />
                            </div>
                          )}
                          
                          {/* Sessions in this slot */}
                          <div className="p-1.5 space-y-1">
                            {slotSessions.map((session) => (
                              <div 
                                key={session.tempId}
                                className="bg-primary text-primary-foreground rounded px-2 py-1 text-[10px] relative group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold truncate">
                                    {getSessionDrills(session.drillIds).map(d => d.name).join(', ')}
                                  </span>
                                  <button 
                                    onClick={() => removeSession(session.tempId)}
                                    className="opacity-0 group-hover:opacity-100 hover:text-red-200"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </div>
                                <div className="text-[9px] opacity-80">
                                  {session.type} • {session.location}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Planned Sessions Sidebar (Bottom when items exist) */}
      {blueprintSessions.length > 0 && (
        <div className="border-t border-border bg-card/50 p-4 max-h-48 overflow-auto">
          <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
            Planned Sessions ({blueprintSessions.length})
          </h4>
          <div className="flex flex-wrap gap-2">
            {blueprintSessions.map((session) => {
              const sessionDrills = getSessionDrills(session.drillIds);
              const date = parseISODateLocal(session.date);
              const conflicts = getConflicts(session.date, session.startTime, session.endTime, session.tempId);
              
              return (
                <div 
                  key={session.tempId}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg border text-xs",
                    conflicts.length > 0
                      ? "bg-amber-500/10 border-amber-500/30"
                      : "bg-card border-border"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-bold">
                      {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {session.startTime} - {session.endTime} • {session.type}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    {conflicts.length > 0 && (
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" title="Conflict detected" />
                    )}
                    <button 
                      onClick={() => removeSession(session.tempId)}
                      className="p-1 hover:bg-secondary rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
