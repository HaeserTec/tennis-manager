import React, { useMemo, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, nanoid } from '@/lib/utils';
import type { Player, PlayerStats, Drill, Client, TrainingSession, DayEvent, SessionObservation } from '@/lib/playbook';
import { RadarChart } from '@/components/RadarChart';
import { ClientEditPanel } from '@/components/ClientEditPanel';
import { 
  User, Heart, Brain, Zap, Trophy, Calendar, 
  BookOpen, AlertTriangle, Users, Phone, 
  Target, Star, TrendingUp, Activity, CheckCircle2, Clock,
  Dumbbell
} from 'lucide-react';

interface PlayerDossierProps {
  player: Player;
  players: Player[];
  drills: Drill[];
  clients: Client[];
  sessions: TrainingSession[];
  dayEvents?: DayEvent[];
  sessionObservations?: SessionObservation[];
  onUpdate: (player: Player) => void;
  onUpsertClient?: (client: Client) => void;
  onDeleteClient?: (clientId: string) => void;
  onMergeClients?: (sourceId: string, targetId: string) => void;
  onAssignDrill: (playerId: string, drillId: string) => void;
  onUnassignDrill: (playerId: string, drillId: string) => void;
  onBack: () => void;
  onDelete: (playerId: string) => void;
}

const AVATAR_COLORS = [
  "#ff003f", "#ffaa00", "#ffff00", "#39ff14", 
  "#00faff", "#4d4dff", "#d946ef"
];

const DAY_OPTIONS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

export function PlayerDossier({
  player,
  players,
  drills,
  clients,
  sessions,
  dayEvents = [],
  sessionObservations = [],
  onUpdate,
  onUpsertClient,
  onDeleteClient,
  onMergeClients,
  onAssignDrill,
  onUnassignDrill,
  onBack,
  onDelete
}: PlayerDossierProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showColors, setShowColors] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [newNote, setNewNote] = useState('');
  const [newScheduleDay, setNewScheduleDay] = useState<string>('Monday');
  const [newScheduleStartTime, setNewScheduleStartTime] = useState<string>('16:00');
  const [newScheduleEndTime, setNewScheduleEndTime] = useState<string>('17:00');
  const [newScheduleType, setNewScheduleType] = useState<'Private' | 'Semi' | 'Group'>('Private');
  const [newScheduleLocation, setNewScheduleLocation] = useState<string>('');

  const linkedClient = clients?.find((c: Client) => c.id === player.clientId);
  const assignedDrillsData = drills.filter((d: Drill) => player.assignedDrills.includes(d.id));

  // Calculate age from DOB
  const age = player.dob ? Math.floor((Date.now() - new Date(player.dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)) : null;

  const schedule = player.schedule || [];
  const attendance = player.attendance || [];
  const attendanceByDate = useMemo(() => {
    const counts = new Map<string, number>();
    attendance.forEach((ts) => {
      const key = new Date(ts).toISOString().split('T')[0];
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return counts;
  }, [attendance]);

  const pastScheduledOccurrences = useMemo(() => {
    if (!schedule.length) return [] as Array<{
      id: string;
      dateKey: string;
      day: string;
      startTime: string;
      endTime: string;
      sessionType: 'Private' | 'Semi' | 'Group';
      location: string;
    }>;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - 56); // Last 8 weeks

    const all: Array<{
      id: string;
      dateKey: string;
      day: string;
      startTime: string;
      endTime: string;
      sessionType: 'Private' | 'Semi' | 'Group';
      location: string;
    }> = [];

    for (let cursor = new Date(start); cursor < today; cursor.setDate(cursor.getDate() + 1)) {
      const day = DAY_OPTIONS[cursor.getDay()];
      const dateKey = cursor.toISOString().split('T')[0];
      const matches = schedule.filter((slot) => slot.day === day);
      matches.forEach((slot) => {
        const slotId = slot.id || `${slot.day}-${slot.startTime}-${slot.endTime}-${slot.location}`;
        all.push({
          id: `${slotId}-${dateKey}`,
          dateKey,
          day,
          startTime: slot.startTime,
          endTime: slot.endTime,
          sessionType: slot.sessionType,
          location: slot.location,
        });
      });
    }

    all.sort((a, b) => b.dateKey.localeCompare(a.dateKey));
    return all;
  }, [schedule]);

  const scheduledAttendanceRows = useMemo(() => {
    const consumedByDate = new Map<string, number>();
    return pastScheduledOccurrences.map((occurrence) => {
      const attendedSlots = attendanceByDate.get(occurrence.dateKey) || 0;
      const consumed = consumedByDate.get(occurrence.dateKey) || 0;
      const attended = consumed < attendedSlots;
      if (attended) consumedByDate.set(occurrence.dateKey, consumed + 1);
      return { ...occurrence, attended };
    });
  }, [attendanceByDate, pastScheduledOccurrences]);

  const attendedCount = scheduledAttendanceRows.filter((r) => r.attended).length;
  const playerObservations = useMemo(
    () => sessionObservations
      .filter((item) => item.playerId === player.id)
      .sort((a, b) => (b.recordedAt || 0) - (a.recordedAt || 0)),
    [sessionObservations, player.id]
  );
  const coachingTimeline = useMemo(() => {
    const attendanceEvents = scheduledAttendanceRows.slice(0, 30).map((row) => ({
      id: `attendance-${row.id}`,
      timestamp: new Date(`${row.dateKey}T12:00:00`).getTime(),
      kind: 'attendance' as const,
      title: row.attended ? 'Attended Session' : 'Missed Session',
      subtitle: `${row.dateKey} • ${row.startTime}-${row.endTime}${row.location ? ` • ${row.location}` : ''}`,
      badge: row.attended ? 'Present' : 'Absent',
      tone: row.attended ? 'emerald' : 'amber',
    }));
    const observationEvents = playerObservations.slice(0, 30).map((item) => ({
      id: `observation-${item.id}`,
      timestamp: item.recordedAt,
      kind: 'observation' as const,
      title: item.drillOutcome ? `Observation • ${item.drillOutcome}` : 'Observation',
      subtitle: item.focusSkill
        ? `Focus: ${item.focusSkill} (${item.focusSkillRating || '-'}/5)`
        : (item.note || 'Session note'),
      badge: 'Coach Note',
      tone: 'blue',
    }));
    return [...attendanceEvents, ...observationEvents]
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 40);
  }, [scheduledAttendanceRows, playerObservations]);
  const recentObservationCount = useMemo(() => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    return playerObservations.filter((item) => item.recordedAt >= thirtyDaysAgo).length;
  }, [playerObservations]);

  const handleStatChange = (stat: keyof PlayerStats, val: string) => {
    const num = Math.min(100, Math.max(0, parseInt(val) || 0));
    onUpdate({ ...player, stats: { ...player.stats, [stat]: num }, updatedAt: Date.now() });
  };

  const handleNestedUpdate = (category: string, key: string, val: any) => {
    onUpdate({
      ...player,
      [category]: { ...(player[category] || {}), [key]: val },
      updatedAt: Date.now()
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdate({ ...player, avatarUrl: reader.result as string, updatedAt: Date.now() });
    };
    reader.readAsDataURL(file);
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    const note = {
      id: nanoid(),
      date: new Date().toISOString().split('T')[0],
      content: newNote,
    };
    const journal = player.journal || [];
    onUpdate({ ...player, journal: [note, ...journal], updatedAt: Date.now() });
    setNewNote('');
  };

  const handleAddScheduleSlot = () => {
    const next = [...schedule, {
      id: nanoid(),
      date: '',
      day: newScheduleDay,
      startTime: newScheduleStartTime,
      endTime: newScheduleEndTime,
      location: newScheduleLocation.trim(),
      sessionType: newScheduleType,
      fee: undefined,
    }];
    onUpdate({ ...player, schedule: next, updatedAt: Date.now() });
    setNewScheduleLocation('');
  };

  const handleRemoveScheduleSlot = (slotId: string) => {
    const next = schedule.filter((slot) => {
      const currentId = slot.id || `${slot.day}-${slot.startTime}-${slot.endTime}-${slot.location}`;
      return currentId !== slotId;
    });
    onUpdate({ ...player, schedule: next, updatedAt: Date.now() });
  };

  const handleToggleScheduledAttendance = (dateKey: string, shouldAttend: boolean) => {
    const nextAttendance = [...attendance];
    if (shouldAttend) {
      const existingCount = nextAttendance.filter((ts) => new Date(ts).toISOString().startsWith(dateKey)).length;
      const ts = new Date(`${dateKey}T12:00:00.000Z`).getTime() + existingCount;
      nextAttendance.push(ts);
    } else {
      const idx = nextAttendance.findIndex((ts) => new Date(ts).toISOString().startsWith(dateKey));
      if (idx >= 0) nextAttendance.splice(idx, 1);
    }
    onUpdate({ ...player, attendance: nextAttendance, updatedAt: Date.now() });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden">
      {/* Hero Card - Sticky Top */}
      <div className="shrink-0 bg-card/20 border-b border-border">
        <div className="max-w-7xl mx-auto p-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div 
                className="h-24 w-24 md:h-32 md:w-32 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-2xl border-4 overflow-hidden transition-all"
                style={{ 
                  borderColor: player.avatarColor,
                  backgroundColor: player.avatarUrl ? 'transparent' : `${player.avatarColor}33`,
                  boxShadow: `0 0 20px -5px ${player.avatarColor}88`
                }}
              >
                {player.avatarUrl ? (
                  <img src={player.avatarUrl} className="h-full w-full object-cover" alt="" />
                ) : (
                  player.name.substring(0, 2).toUpperCase()
                )}
              </div>
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="absolute inset-0 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl"
              >
                <User className="w-6 h-6 text-white" />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              
              <button 
                onClick={() => setShowColors(!showColors)} 
                className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full border-2 border-white/20 bg-card backdrop-blur flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              >
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: player.avatarColor }} />
              </button>

              {showColors && (
                <div className="absolute top-full left-0 mt-3 z-50 glass p-2 rounded-xl shadow-2xl flex gap-1.5">
                  {AVATAR_COLORS.map(color => (
                    <button 
                      key={color} 
                      onClick={() => { onUpdate({...player, avatarColor: color, updatedAt: Date.now()}); setShowColors(false); }} 
                      className={cn("h-6 w-6 rounded-full border-2 transition-all hover:scale-110", player.avatarColor === color ? "border-white" : "border-transparent")} 
                      style={{ backgroundColor: color }} 
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Player Info */}
            <div className="flex-1 min-w-0">
              <Input 
                value={player.name} 
                onChange={e => onUpdate({...player, name: e.target.value})} 
                className="text-2xl md:text-4xl font-black bg-transparent border-transparent hover:border-white/10 focus:bg-card/50 px-0 h-auto py-0 tracking-tighter uppercase text-gradient mb-2" 
              />
              
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <Badge icon={<Trophy className="w-3 h-3" />} text={player.level} color="primary" />
                {age && <Badge icon={<User className="w-3 h-3" />} text={`${age} years`} />}
                <Badge icon={<Activity className="w-3 h-3" />} text={player.handedness || 'Right'} />
                {player.playStyle && <Badge icon={<Zap className="w-3 h-3" />} text={player.playStyle} />}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="sm" onClick={onBack} className="h-9">
                ← Back
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onDelete(player.id)} className="h-9 text-red-500 hover:text-red-400 hover:bg-red-400/10">
                Delete
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Masonry Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Column A: The Human */}
            <div className="space-y-6">
              {/* DNA Card */}
              <Card title="Player DNA" icon={<Brain className="w-4 h-4" />}>
                <div className="space-y-4">
                  <Field label="Favorite Shot">
                    <Input 
                      value={player.dna?.favoriteShot || ''} 
                      onChange={e => handleNestedUpdate('dna', 'favoriteShot', e.target.value)} 
                      placeholder="e.g. Cross-court FH Winner" 
                      className="h-9"
                    />
                  </Field>
                  
                  <Field label="Spirit Pro">
                    <Input 
                      value={player.dna?.favoritePro || ''} 
                      onChange={e => handleNestedUpdate('dna', 'favoritePro', e.target.value)} 
                      placeholder="e.g. Roger Federer" 
                      className="h-9"
                    />
                  </Field>
                  
                  <Field label="Career Goal">
                    <Input 
                      value={player.dna?.careerGoal || ''} 
                      onChange={e => handleNestedUpdate('dna', 'careerGoal', e.target.value)} 
                      placeholder="e.g. High School Team" 
                      className="h-9"
                    />
                  </Field>
                  
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium text-muted-foreground">Confidence</label>
                      <span className="text-xs font-bold">{player.dna?.confidence || 5}/10</span>
                    </div>
                    <input 
                      type="range" 
                      min="1" 
                      max="10" 
                      value={player.dna?.confidence || 5} 
                      onChange={e => handleNestedUpdate('dna', 'confidence', parseInt(e.target.value))} 
                      className="w-full accent-primary h-1.5 bg-secondary rounded-lg appearance-none cursor-pointer" 
                    />
                  </div>
                </div>
              </Card>

              {/* Intel Card */}
              <Card title="Intel" icon={<Heart className="w-4 h-4" />}>
                <div className="space-y-4">
                  {linkedClient ? (
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                      <div className="flex items-center gap-2 text-primary mb-1">
                        <Users className="w-3.5 h-3.5" />
                        <span className="text-xs font-bold uppercase">Linked Parent</span>
                      </div>
                      <p className="font-bold">{linkedClient.name}</p>
                      {linkedClient.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Phone className="w-3 h-3" /> {linkedClient.phone}
                        </p>
                      )}
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="h-7 mt-2 text-xs"
                        onClick={() => setEditingClient(linkedClient)}
                      >
                        Edit Parent
                      </Button>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground">
                      No parent linked. Link from the client accounts.
                    </div>
                  )}

                  <Field label="School">
                    <Input 
                      value={player.intel?.school || ''} 
                      onChange={e => handleNestedUpdate('intel', 'school', e.target.value)} 
                      placeholder="School name" 
                      className="h-9"
                    />
                  </Field>

                  <Field label="Location">
                    <Input 
                      value={player.intel?.location || ''} 
                      onChange={e => handleNestedUpdate('intel', 'location', e.target.value)} 
                      placeholder="Training location" 
                      className="h-9"
                    />
                  </Field>

                  <Field label="Medical Alerts">
                    <Input 
                      value={player.intel?.medicalAlerts || ''} 
                      onChange={e => handleNestedUpdate('intel', 'medicalAlerts', e.target.value)} 
                      placeholder="Allergies, conditions..." 
                      className="h-9 border-rose-500/30 bg-rose-500/5"
                    />
                  </Field>
                </div>
              </Card>
            </div>

            {/* Column B: The Athlete */}
            <div className="space-y-6">
              {/* Physical Profile */}
              <Card title="Physical Profile" icon={<Activity className="w-4 h-4" />}>
                <div className="flex justify-center py-4">
                  <RadarChart stats={player.stats} size={200} />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(player.stats).map(([key, val]) => (
                    <div key={key} className="p-2 rounded-lg bg-card/50 border border-border/50">
                      <div className="flex justify-between items-center mb-1">
                        <label className="text-[10px] uppercase font-bold text-muted-foreground">{key}</label>
                        <span className="text-xs font-mono font-bold text-primary">{val}%</span>
                      </div>
                      <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={val as number} 
                        onChange={e => handleStatChange(key as keyof PlayerStats, e.target.value)} 
                        className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer" 
                      />
                    </div>
                  ))}
                </div>
              </Card>

              {/* Personal Bests */}
              <Card title="Personal Bests" icon={<Trophy className="w-4 h-4" />}>
                <div className="grid grid-cols-2 gap-3">
                  <PBField 
                    label="Back to Base" 
                    unit="sec" 
                    value={player.pbs?.backToBase} 
                    onChange={v => handleNestedUpdate('pbs', 'backToBase', v)}
                    icon={<Clock className="w-3.5 h-3.5" />}
                  />
                  <PBField 
                    label="Longest Rally" 
                    unit="shots" 
                    value={player.pbs?.longestRally} 
                    onChange={v => handleNestedUpdate('pbs', 'longestRally', parseInt(v) || 0)}
                    icon={<Target className="w-3.5 h-3.5" />}
                  />
                  <PBField 
                    label="1st Serve %" 
                    unit="%" 
                    value={player.pbs?.firstServePct} 
                    onChange={v => handleNestedUpdate('pbs', 'firstServePct', parseInt(v) || 0)}
                    icon={<TrendingUp className="w-3.5 h-3.5" />}
                  />
                  <PBField 
                    label="Streak" 
                    unit="sessions" 
                    value={player.pbs?.attendanceStreak} 
                    onChange={v => handleNestedUpdate('pbs', 'attendanceStreak', parseInt(v) || 0)}
                    icon={<Star className="w-3.5 h-3.5" />}
                  />
                </div>
              </Card>

              {/* Training Schedule */}
              <Card title="Training Schedule" icon={<Clock className="w-4 h-4" />}>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <Select value={newScheduleDay} onValueChange={setNewScheduleDay}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {DAY_OPTIONS.map((day) => (
                          <SelectItem key={day} value={day}>{day}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={newScheduleType} onValueChange={(v: 'Private' | 'Semi' | 'Group') => setNewScheduleType(v)}>
                      <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Private">Private</SelectItem>
                        <SelectItem value="Semi">Semi</SelectItem>
                        <SelectItem value="Group">Group</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input type="time" value={newScheduleStartTime} onChange={(e) => setNewScheduleStartTime(e.target.value)} className="h-9" />
                    <Input type="time" value={newScheduleEndTime} onChange={(e) => setNewScheduleEndTime(e.target.value)} className="h-9" />
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newScheduleLocation}
                      onChange={(e) => setNewScheduleLocation(e.target.value)}
                      placeholder="Location (optional)"
                      className="h-9"
                    />
                    <Button size="sm" className="h-9" onClick={handleAddScheduleSlot}>
                      Add
                    </Button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar">
                    {schedule.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic text-center py-2">No recurring sessions yet.</p>
                    ) : (
                      schedule.map((slot) => {
                        const slotId = slot.id || `${slot.day}-${slot.startTime}-${slot.endTime}-${slot.location}`;
                        return (
                        <div key={slotId} className="flex items-center justify-between p-2 rounded-lg bg-card/50 border border-border/50">
                          <div className="text-xs">
                            <div className="font-semibold">{slot.day} • {slot.startTime}-{slot.endTime}</div>
                            <div className="text-muted-foreground">{slot.sessionType}{slot.location ? ` • ${slot.location}` : ''}</div>
                          </div>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-muted-foreground hover:text-red-500"
                            onClick={() => handleRemoveScheduleSlot(slotId)}
                          >
                            ×
                          </Button>
                        </div>
                      )})
                    )}
                  </div>
                </div>
              </Card>

              {/* Attendance */}
              <Card title="Attendance (Scheduled, Past Only)" icon={<Calendar className="w-4 h-4" />}>
                <div className="text-xs text-muted-foreground mb-3">
                  {attendedCount} / {scheduledAttendanceRows.length} past scheduled sessions marked present
                </div>
                <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                  {scheduledAttendanceRows.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-3">
                      No past scheduled sessions yet.
                    </p>
                  ) : (
                    scheduledAttendanceRows.map((row) => (
                      <div key={row.id} className="flex items-center justify-between p-2 rounded-lg bg-card/50 border border-border/50">
                        <div className="text-xs">
                          <div className="font-semibold">
                            {row.dateKey} • {row.startTime}-{row.endTime}
                          </div>
                          <div className="text-muted-foreground">{row.sessionType}{row.location ? ` • ${row.location}` : ''}</div>
                        </div>
                        <Button
                          size="sm"
                          variant={row.attended ? 'secondary' : 'outline'}
                          className={cn(
                            "h-7 text-[10px] font-bold",
                            row.attended ? "text-emerald-400 border-emerald-500/40" : "text-muted-foreground"
                          )}
                          onClick={() => handleToggleScheduledAttendance(row.dateKey, !row.attended)}
                        >
                          {row.attended ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Present
                            </>
                          ) : (
                            'Mark Present'
                          )}
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </Card>
            </div>

            {/* Column C: The Journey */}
            <div className="space-y-6">
              {/* Coach's Journal */}
              <Card title="Coach's Journal" icon={<BookOpen className="w-4 h-4" />}>
                <div className="space-y-3 mb-4">
                  <textarea 
                    className="w-full h-20 bg-card/50 border border-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-primary/50" 
                    placeholder="Add a new note..." 
                    value={newNote} 
                    onChange={e => setNewNote(e.target.value)} 
                  />
                  <Button size="sm" onClick={handleAddNote} className="w-full h-8 text-xs" disabled={!newNote.trim()}>
                    Add Entry
                  </Button>
                </div>
                
                <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
                  {(player.journal || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">No journal entries yet.</p>
                  ) : (
                    (player.journal || []).map((entry: any) => (
                      <div key={entry.id} className="p-3 rounded-lg bg-card/30 border border-border/50">
                        <div className="text-[10px] text-muted-foreground mb-1">{entry.date}</div>
                        <p className="text-xs leading-relaxed">{entry.content}</p>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              <Card title="Coaching Timeline" icon={<Activity className="w-4 h-4" />}>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                  <span>{coachingTimeline.length} recent events</span>
                  <span>{recentObservationCount} observations in last 30 days</span>
                </div>
                <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                  {coachingTimeline.length === 0 ? (
                    <p className="text-xs text-muted-foreground italic text-center py-3">
                      No attendance or observation history yet.
                    </p>
                  ) : (
                    coachingTimeline.map((entry) => (
                      <div key={entry.id} className="p-2.5 rounded-lg bg-card/40 border border-border/50">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs font-semibold">{entry.title}</div>
                          <span className={cn(
                            "text-[10px] px-1.5 py-0.5 rounded border font-bold",
                            entry.tone === 'emerald' && "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
                            entry.tone === 'amber' && "text-amber-200 border-amber-500/40 bg-amber-500/10",
                            entry.tone === 'blue' && "text-blue-300 border-blue-500/40 bg-blue-500/10"
                          )}>
                            {entry.badge}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {new Date(entry.timestamp).toLocaleString()}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{entry.subtitle}</div>
                      </div>
                    ))
                  )}
                </div>
              </Card>

              {/* Gear */}
              <Card title="Gear" icon={<Dumbbell className="w-4 h-4" />}>
                <div className="space-y-3">
                  <Field label="Racket Model">
                    <Input 
                      value={player.equipment?.racket || ''} 
                      onChange={e => onUpdate({...player, equipment: {...player.equipment, racket: e.target.value}})} 
                      placeholder="e.g. Babolat Pure Drive" 
                      className="h-9"
                    />
                  </Field>
                  
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Grip Size">
                      <Select 
                        value={player.equipment?.gripSize || ''} 
                        onValueChange={v => onUpdate({...player, equipment: {...player.equipment, gripSize: v}})}
                      >
                        <SelectTrigger className="h-9"><SelectValue placeholder="Size" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="L1">L1 (4 1/8)</SelectItem>
                          <SelectItem value="L2">L2 (4 1/4)</SelectItem>
                          <SelectItem value="L3">L3 (4 3/8)</SelectItem>
                          <SelectItem value="L4">L4 (4 1/2)</SelectItem>
                        </SelectContent>
                      </Select>
                    </Field>
                    
                    <Field label="Tension (kg)">
                      <Input 
                        value={player.equipment?.tension || ''} 
                        onChange={e => onUpdate({...player, equipment: {...player.equipment, tension: e.target.value}})} 
                        placeholder="e.g. 24" 
                        className="h-9"
                      />
                    </Field>
                  </div>
                  
                  <Field label="Last Restrung">
                    <Input 
                      type="date" 
                      value={player.equipment?.lastRestrung || ''} 
                      onChange={e => onUpdate({...player, equipment: {...player.equipment, lastRestrung: e.target.value}})} 
                      className="h-9"
                    />
                  </Field>
                </div>
              </Card>

              {/* Assigned Drills */}
              <Card title="Development Plan" icon={<Target className="w-4 h-4" />}>
                <div className="space-y-2">
                  <Select onValueChange={(drillId) => onAssignDrill(player.id, drillId)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Assign drill..." />
                    </SelectTrigger>
                    <SelectContent>
                      {drills.map((d: Drill) => (
                        <SelectItem key={d.id} value={d.id!}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  
                  <div className="space-y-1.5 max-h-32 overflow-y-auto custom-scrollbar">
                    {assignedDrillsData.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-2">No drills assigned.</p>
                    ) : (
                      assignedDrillsData.map((d: Drill) => (
                        <div key={d.id} className="flex items-center justify-between p-2 rounded-lg bg-card/50 border border-border/50 group">
                          <div className="flex items-center gap-2">
                            <div className="h-6 w-6 rounded bg-secondary flex items-center justify-center text-[10px] font-bold">
                              {d.name[0]}
                            </div>
                            <span className="text-xs font-medium truncate">{d.name}</span>
                          </div>
                          <button 
                            onClick={() => onUnassignDrill(player.id, d.id!)}
                            className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            ×
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      {/* Client Edit Panel */}
      {editingClient && (
        <ClientEditPanel
          client={editingClient}
          players={players || []}
          allClients={clients || []}
          sessions={sessions || []}
          dayEvents={dayEvents}
          isOpen={true}
          onClose={() => setEditingClient(null)}
          onSave={(updated) => {
            if (onUpsertClient) onUpsertClient(updated);
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

// Sub-components

function Card({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm">
      <div className="flex items-center gap-2 mb-4">
        <div className="text-primary">{icon}</div>
        <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Badge({ icon, text, color }: { icon: React.ReactNode, text: string, color?: string }) {
  return (
    <div className={cn(
      "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border",
      color === 'primary' 
        ? "bg-primary/10 border-primary/30 text-primary" 
        : "bg-card/50 border-border text-muted-foreground"
    )}>
      {icon}
      <span>{text}</span>
    </div>
  );
}

function PBField({ label, unit, value, onChange, icon }: any) {
  return (
    <div className="p-3 rounded-lg bg-card/50 border border-border/50">
      <div className="flex items-center gap-2 text-muted-foreground mb-2">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <Input 
          value={value || ''} 
          onChange={e => onChange(e.target.value)}
          placeholder="0"
          className="h-8 w-16 text-lg font-black bg-transparent border-none p-0 focus-visible:ring-0" 
        />
        <span className="text-[10px] text-muted-foreground uppercase">{unit}</span>
      </div>
    </div>
  );
}
