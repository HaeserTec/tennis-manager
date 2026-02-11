import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Clock3, Users, Droplets, CircleDot, TimerReset } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, nanoid } from '@/lib/utils';
import type { Drill, Player, SessionObservation, TrainingSession } from '@/lib/playbook';

interface LiveSessionCompanionProps {
  players: Player[];
  drills: Drill[];
  sessions: TrainingSession[];
  locations: string[];
  sessionObservations: SessionObservation[];
  onAddObservation: (observation: SessionObservation) => void;
}

type Draft = {
  ratings: Record<string, number>;
  drillId: string;
  drillOutcome: SessionObservation['drillOutcome'];
  focusSkill: string;
  focusSkillRating: number;
  note: string;
};

const BASE_SKILLS: { key: string; label: string }[] = [
  { key: 'tech', label: 'Technique' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'tactics', label: 'Tactics' },
  { key: 'movement', label: 'Movement' },
  { key: 'coachability', label: 'Coachability' },
];

function toDateTime(date: string, time: string): Date {
  return new Date(`${date}T${time}`);
}

function getDefaultDraft(): Draft {
  return {
    ratings: { tech: 3, consistency: 3, tactics: 3, movement: 3, coachability: 3 },
    drillId: '',
    drillOutcome: 'Good',
    focusSkill: '',
    focusSkillRating: 3,
    note: '',
  };
}

export function LiveSessionCompanion({
  players,
  drills,
  sessions,
  locations,
  sessionObservations,
  onAddObservation,
}: LiveSessionCompanionProps) {
  const [nowMs, setNowMs] = useState(Date.now());
  const [selectedLocation, setSelectedLocation] = useState<string>('All');
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [timerEndsAt, setTimerEndsAt] = useState<number | null>(null);
  const [timerLabel, setTimerLabel] = useState<string>('');
  const [customMinutes, setCustomMinutes] = useState<string>('5');
  const timerAlertedRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const activeSessions = useMemo(() => {
    const now = new Date(nowMs);
    return sessions
      .filter((session) => {
        if (selectedLocation !== 'All' && session.location !== selectedLocation) return false;
        const start = toDateTime(session.date, session.startTime);
        const end = toDateTime(session.date, session.endTime);
        return now >= start && now <= end;
      })
      .sort((a, b) => toDateTime(a.date, a.startTime).getTime() - toDateTime(b.date, b.startTime).getTime());
  }, [sessions, selectedLocation, nowMs]);

  const nextSession = useMemo(() => {
    const now = new Date(nowMs);
    return sessions
      .filter((session) => {
        if (selectedLocation !== 'All' && session.location !== selectedLocation) return false;
        const start = toDateTime(session.date, session.startTime);
        return start > now;
      })
      .sort((a, b) => toDateTime(a.date, a.startTime).getTime() - toDateTime(b.date, b.startTime).getTime())[0];
  }, [sessions, selectedLocation, nowMs]);

  const activePlayerIds = useMemo(() => {
    return Array.from(new Set(activeSessions.flatMap((session) => session.participantIds)));
  }, [activeSessions]);

  const activePlayers = useMemo(() => {
    return activePlayerIds
      .map((id) => players.find((player) => player.id === id))
      .filter((player): player is Player => Boolean(player))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [activePlayerIds, players]);

  useEffect(() => {
    setDrafts((prev) => {
      const next = { ...prev };
      activePlayers.forEach((player) => {
        if (!next[player.id]) next[player.id] = getDefaultDraft();
      });
      return next;
    });
  }, [activePlayers]);

  const secondsRemaining = timerEndsAt ? Math.max(0, Math.floor((timerEndsAt - nowMs) / 1000)) : 0;
  const timerDone = timerEndsAt !== null && secondsRemaining === 0;

  useEffect(() => {
    if (!timerEndsAt) {
      timerAlertedRef.current = false;
      return;
    }
    if (timerDone && !timerAlertedRef.current) {
      timerAlertedRef.current = true;

      try {
        const ctx = new AudioContext();
        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.value = 880;
        gainNode.gain.value = 0.05;
        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);
        oscillator.start();
        window.setTimeout(() => {
          oscillator.stop();
          ctx.close();
        }, 240);
      } catch {
        // Ignore audio failures silently.
      }

      if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Session timer complete', {
          body: timerLabel ? `${timerLabel} finished.` : 'Your timer is complete.',
        });
      }
    }
  }, [timerDone, timerEndsAt, timerLabel]);

  const startTimer = (minutes: number, label: string) => {
    setTimerLabel(label);
    setTimerEndsAt(Date.now() + minutes * 60 * 1000);
    timerAlertedRef.current = false;

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  };

  const setDraft = (playerId: string, updater: (current: Draft) => Draft) => {
    setDrafts((prev) => ({ ...prev, [playerId]: updater(prev[playerId] || getDefaultDraft()) }));
  };

  const saveObservation = (player: Player) => {
    const draft = drafts[player.id] || getDefaultDraft();
    const currentSession = activeSessions.find((session) => session.participantIds.includes(player.id));
    const observation: SessionObservation = {
      id: nanoid(),
      playerId: player.id,
      recordedAt: Date.now(),
      sessionId: currentSession?.id,
      drillId: draft.drillId || undefined,
      drillOutcome: draft.drillOutcome,
      ratings: draft.ratings,
      focusSkill: draft.focusSkill || undefined,
      focusSkillRating: draft.focusSkill ? draft.focusSkillRating : undefined,
      note: draft.note || undefined,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    onAddObservation(observation);
    setDraft(player.id, () => getDefaultDraft());
  };

  const saveAllActive = () => {
    activePlayers.forEach((player) => saveObservation(player));
  };

  return (
    <div className="h-full flex flex-col bg-background text-foreground">
      <div className="p-4 border-b border-border bg-card/20 flex flex-wrap items-center gap-3">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tight">Live Session Companion</h2>
          <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">
            Real-time roster, observations, and court timers
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            className="h-8 text-xs font-bold"
            onClick={saveAllActive}
            disabled={activePlayers.length === 0}
          >
            Save All Active
          </Button>
          <Select value={selectedLocation} onValueChange={setSelectedLocation}>
            <SelectTrigger className="w-[180px] h-8 text-xs bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="All">All Locations</SelectItem>
              {locations.map((location) => (
                <SelectItem key={location} value={location}>{location}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr_1fr] gap-4 p-4 flex-1 min-h-0 overflow-hidden">
        <div className="min-h-0 flex flex-col gap-4 overflow-hidden">
          <div className="rounded-xl border border-border bg-card/40 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Who&apos;s On Court</h3>
            </div>
            {activeSessions.length > 0 ? (
              <div className="space-y-2 max-h-[220px] overflow-auto custom-scrollbar">
                {activeSessions.map((session) => (
                  <div key={session.id} className="p-2 rounded-lg bg-background/60 border border-border/50">
                    <div className="text-xs font-semibold">{session.type} • {session.location}</div>
                    <div className="text-[10px] text-muted-foreground">{session.startTime} - {session.endTime}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">{session.participantIds.length} players active</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground">
                No active session now.
                {nextSession && (
                  <div className="mt-1">
                    Next: {nextSession.date} {nextSession.startTime} • {nextSession.location}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card/40 p-4 min-h-0">
            <div className="flex items-center gap-2 mb-2">
              <Clock3 className="w-4 h-4 text-primary" />
              <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Session Utility Timer</h3>
            </div>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => startTimer(1, 'Ball Pickup')}>
                <CircleDot className="w-3 h-3 mr-1" /> Ball Pickup
              </Button>
              <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => startTimer(2, 'Water Break')}>
                <Droplets className="w-3 h-3 mr-1" /> Water Break
              </Button>
              <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => startTimer(8, 'Short Block')}>
                8 min Block
              </Button>
              <Button size="sm" variant="secondary" className="h-8 text-xs" onClick={() => startTimer(12, 'Main Block')}>
                12 min Block
              </Button>
            </div>
            <div className="flex items-center gap-2 mb-3">
              <Input
                type="number"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className="h-8 text-xs"
                placeholder="Min"
              />
              <Button
                size="sm"
                className="h-8 text-xs"
                onClick={() => startTimer(Math.max(1, parseInt(customMinutes || '1', 10)), 'Custom Timer')}
              >
                Start
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => setTimerEndsAt(null)}>
                <TimerReset className="w-3 h-3 mr-1" /> Clear
              </Button>
            </div>
            <div className={cn(
              "rounded-lg border p-3 text-center",
              timerDone ? "border-emerald-500/40 bg-emerald-500/10" : "border-border bg-background/40"
            )}>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{timerLabel || 'No Timer Running'}</div>
              <div className={cn("text-2xl font-black mt-1", timerDone && "text-emerald-400")}>
                {timerEndsAt ? `${Math.floor(secondsRemaining / 60).toString().padStart(2, '0')}:${(secondsRemaining % 60).toString().padStart(2, '0')}` : '--:--'}
              </div>
            </div>
          </div>
        </div>

        <div className="min-h-0 overflow-auto custom-scrollbar pr-1 space-y-3">
          <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">Rate Live Skills (Per Player)</div>
          {activePlayers.length === 0 && (
            <div className="p-6 rounded-xl border border-border bg-card/30 text-sm text-muted-foreground italic">
              No active roster right now. Start from Scheduler and players will appear here live.
            </div>
          )}
          {activePlayers.map((player) => {
            const draft = drafts[player.id] || getDefaultDraft();
            return (
              <div key={player.id} className="rounded-xl border border-border bg-card/40 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="font-bold">{player.name}</div>
                  <div className="text-[10px] text-muted-foreground">{player.level}</div>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {BASE_SKILLS.map((skill) => (
                    <div key={skill.key} className="p-2 rounded-lg bg-background/40 border border-border/40">
                      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{skill.label}</div>
                      <Select
                        value={String(draft.ratings[skill.key] || 3)}
                        onValueChange={(value) => setDraft(player.id, (current) => ({
                          ...current,
                          ratings: { ...current.ratings, [skill.key]: parseInt(value, 10) },
                        }))}
                      >
                        <SelectTrigger className="h-7 mt-1 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}/5</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <Input
                    value={draft.focusSkill}
                    onChange={(e) => setDraft(player.id, (current) => ({ ...current, focusSkill: e.target.value }))}
                    placeholder="Focus skill (optional)"
                    className="h-8 text-xs md:col-span-2"
                  />
                  <Select
                    value={String(draft.focusSkillRating)}
                    onValueChange={(value) => setDraft(player.id, (current) => ({ ...current, focusSkillRating: parseInt(value, 10) }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}/5</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <Select
                    value={draft.drillId || 'none'}
                    onValueChange={(value) => setDraft(player.id, (current) => ({ ...current, drillId: value === 'none' ? '' : value }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Drill worked on" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Drill Selected</SelectItem>
                      {drills.map((drill) => <SelectItem key={drill.id} value={drill.id!}>{drill.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select
                    value={draft.drillOutcome || 'Good'}
                    onValueChange={(value: SessionObservation['drillOutcome']) => setDraft(player.id, (current) => ({ ...current, drillOutcome: value }))}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Excellent">Excellent</SelectItem>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Mixed">Mixed</SelectItem>
                      <SelectItem value="Poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <textarea
                  value={draft.note}
                  onChange={(e) => setDraft(player.id, (current) => ({ ...current, note: e.target.value }))}
                  placeholder="Quick observation..."
                  className="w-full h-16 rounded-md border border-border bg-background/40 px-3 py-2 text-xs"
                />

                <div className="flex justify-end">
                  <Button size="sm" className="h-8 text-xs font-bold" onClick={() => saveObservation(player)}>
                    Save Observation
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="min-h-0 overflow-auto custom-scrollbar space-y-3">
          <div className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recent Player History</div>
          {activePlayers.map((player) => {
            const history = sessionObservations
              .filter((item) => item.playerId === player.id)
              .sort((a, b) => (b.recordedAt || 0) - (a.recordedAt || 0))
              .slice(0, 4);
            return (
              <div key={player.id} className="rounded-xl border border-border bg-card/40 p-3">
                <div className="font-semibold text-sm mb-2">{player.name}</div>
                {history.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">No saved observations yet.</div>
                ) : (
                  <div className="space-y-2">
                    {history.map((item) => (
                      <div key={item.id} className="p-2 rounded-lg bg-background/40 border border-border/40">
                        <div className="text-[10px] text-muted-foreground">
                          {new Date(item.recordedAt).toLocaleString()}
                        </div>
                        <div className="text-xs mt-0.5">
                          {item.drillOutcome ? `Drill: ${item.drillOutcome}` : 'Observation'}
                        </div>
                        {item.focusSkill && (
                          <div className="text-[10px] text-muted-foreground mt-0.5">
                            Focus: {item.focusSkill} ({item.focusSkillRating || '-'}/5)
                          </div>
                        )}
                        {item.note && <div className="text-[10px] mt-1 italic text-muted-foreground">"{item.note}"</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
