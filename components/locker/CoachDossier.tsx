import React, { useRef, useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn, nanoid } from '@/lib/utils';
import type { Player, TrainingSession, Drill } from '@/lib/playbook';
import { 
  User, Award, BookOpen, Target, TrendingUp, 
  Briefcase, CheckSquare, Clock, Zap, GraduationCap,
  Dumbbell, CalendarCheck, Crown
} from 'lucide-react';

// Define a unique shape for the Coach Profile
export interface CoachProfile {
  id: string;
  name: string;
  title: string;
  avatarUrl?: string;
  avatarColor?: string;
  philosophy: string;
  seasonFocus: string;
  education: Array<{ id: string; title: string; status: 'Planned' | 'In Progress' | 'Completed'; date?: string }>;
  goals: Array<{ id: string; text: string; completed: boolean }>;
  gear: {
    racket: string;
    strings: string;
    tension: string;
    shoes: string;
    lastRestrung: string;
  };
}

interface CoachDossierProps {
  profile: CoachProfile;
  players: Player[];
  sessions: TrainingSession[];
  drills: Drill[];
  onUpdate: (profile: CoachProfile) => void;
  onBack: () => void;
}

const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", 
  "#14b8a6", "#3b82f6", "#0ea5e9"
];

export function CoachDossier({
  profile,
  players,
  sessions,
  drills,
  onUpdate,
  onBack
}: CoachDossierProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showColors, setShowColors] = useState(false);
  const [newGoal, setNewGoal] = useState('');
  const [newEdu, setNewEdu] = useState('');

  // --- CALCULATE ACADEMY PULSE ---
  const pulse = useMemo(() => {
    // 1. Active Students
    const activeStudents = players.filter(p => p.account?.status !== 'Inactive').length;
    
    // 2. Weekly Hours (Average of last 4 weeks or just this week)
    // Let's do "Hours Scheduled This Week"
    const today = new Date();
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay()); // Sunday
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);
    
    const thisWeekSessions = sessions.filter(s => {
       const d = new Date(s.date);
       return d >= startOfWeek && d <= endOfWeek;
    });
    
    let weeklyMinutes = 0;
    thisWeekSessions.forEach(s => {
       const [h1, m1] = s.startTime.split(':').map(Number);
       const [h2, m2] = s.endTime.split(':').map(Number);
       weeklyMinutes += (h2 * 60 + m2) - (h1 * 60 + m1);
    });
    const weeklyHours = Math.round(weeklyMinutes / 60 * 10) / 10;

    // 3. Most Popular Drill (All Time)
    const drillCounts: Record<string, number> = {};
    players.forEach(p => {
       p.assignedDrills.forEach(did => {
          drillCounts[did] = (drillCounts[did] || 0) + 1;
       });
    });
    // Also check session plans if we had access, but assignedDrills is a good proxy for "Focus Drills"
    const topDrillId = Object.entries(drillCounts).sort((a,b) => b[1] - a[1])[0]?.[0];
    const topDrill = drills.find(d => d.id === topDrillId)?.name || 'N/A';

    return { activeStudents, weeklyHours, topDrill };
  }, [players, sessions, drills]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      onUpdate({ ...profile, avatarUrl: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  const addGoal = () => {
    if (!newGoal.trim()) return;
    onUpdate({
      ...profile,
      goals: [...(profile.goals || []), { id: nanoid(), text: newGoal, completed: false }]
    });
    setNewGoal('');
  };

  const toggleGoal = (id: string) => {
    onUpdate({
      ...profile,
      goals: profile.goals.map(g => g.id === id ? { ...g, completed: !g.completed } : g)
    });
  };

  const deleteGoal = (id: string) => {
    onUpdate({
      ...profile,
      goals: profile.goals.filter(g => g.id !== id)
    });
  };

  const addEdu = () => {
    if (!newEdu.trim()) return;
    onUpdate({
      ...profile,
      education: [...(profile.education || []), { id: nanoid(), title: newEdu, status: 'Planned' }]
    });
    setNewEdu('');
  };

  const updateEduStatus = (id: string, status: 'Planned' | 'In Progress' | 'Completed') => {
    onUpdate({
      ...profile,
      education: profile.education.map(e => e.id === id ? { ...e, status } : e)
    });
  };

  const deleteEdu = (id: string) => {
    onUpdate({
      ...profile,
      education: profile.education.filter(e => e.id !== id)
    });
  };

  const updateGear = (key: keyof CoachProfile['gear'], value: string) => {
      onUpdate({
          ...profile,
          gear: {
              ...profile.gear,
              [key]: value
          }
      });
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-background overflow-hidden animate-in fade-in duration-300">
      {/* Hero Section */}
      <div className="shrink-0 bg-card/30 border-b border-border relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-purple-500/5 pointer-events-none" />
        <div className="max-w-7xl mx-auto p-8 relative z-10">
          <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
            
            {/* Avatar */}
            <div className="relative group shrink-0">
              <div 
                className="h-32 w-32 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-2xl border-4 overflow-hidden transition-all relative z-10"
                style={{ 
                  borderColor: profile.avatarColor || '#6366f1',
                  backgroundColor: profile.avatarUrl ? 'transparent' : `${profile.avatarColor || '#6366f1'}`,
                  boxShadow: `0 0 30px -5px ${profile.avatarColor || '#6366f1'}66`
                }}
              >
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} className="h-full w-full object-cover" alt="" />
                ) : (
                  <Crown className="w-12 h-12 text-white/50" />
                )}
              </div>
              
              <button 
                onClick={() => fileInputRef.current?.click()} 
                className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity rounded-full cursor-pointer"
              >
                <User className="w-8 h-8 text-white" />
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
              
              <button 
                onClick={() => setShowColors(!showColors)} 
                className="absolute bottom-0 right-0 z-30 h-8 w-8 rounded-full border-2 border-background bg-card flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              >
                <div className="h-4 w-4 rounded-full" style={{ backgroundColor: profile.avatarColor || '#6366f1' }} />
              </button>

              {showColors && (
                <div className="absolute top-full left-1/2 -translate-x-1/2 mt-4 z-50 glass p-2 rounded-xl shadow-2xl flex gap-1.5 animate-in slide-in-from-top-2">
                  {AVATAR_COLORS.map(color => (
                    <button 
                      key={color} 
                      onClick={() => { onUpdate({...profile, avatarColor: color}); setShowColors(false); }} 
                      className={cn("h-6 w-6 rounded-full border-2 transition-all hover:scale-110", profile.avatarColor === color ? "border-white" : "border-transparent")} 
                      style={{ backgroundColor: color }} 
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Coach Details */}
            <div className="flex-1 text-center md:text-left space-y-2 w-full max-w-xl">
              <Input 
                value={profile.name} 
                onChange={e => onUpdate({...profile, name: e.target.value})} 
                className="text-3xl md:text-5xl font-black bg-transparent border-none px-0 h-auto py-0 tracking-tighter uppercase text-center md:text-left focus-visible:ring-0 placeholder:text-muted-foreground/50" 
                placeholder="YOUR NAME"
              />
              <Input 
                value={profile.title} 
                onChange={e => onUpdate({...profile, title: e.target.value})} 
                className="text-lg md:text-xl font-medium bg-transparent border-none px-0 h-auto py-0 text-primary uppercase tracking-widest text-center md:text-left focus-visible:ring-0 placeholder:text-primary/50" 
                placeholder="HEAD COACH"
              />
              <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                 <Badge icon={<Briefcase className="w-3.5 h-3.5" />} text="Academy Director" />
                 <Badge icon={<Award className="w-3.5 h-3.5" />} text="ITF Level 3" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 shrink-0 self-start">
              <Button variant="outline" onClick={onBack}>
                Close Profile
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
           
           {/* ACADEMY PULSE */}
           <Card title="Academy Pulse" icon={<TrendingUp className="w-4 h-4" />}>
              <div className="grid grid-cols-2 gap-4 mb-4">
                 <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black text-primary">{pulse.activeStudents}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active Students</span>
                 </div>
                 <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl flex flex-col items-center justify-center text-center">
                    <span className="text-3xl font-black text-emerald-600">{pulse.weeklyHours}</span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Hrs/Week</span>
                 </div>
              </div>
              <div className="p-3 bg-secondary/30 rounded-lg border border-border/50 flex items-center justify-between">
                 <span className="text-xs font-medium text-muted-foreground">Top Focus Drill</span>
                 <span className="text-xs font-bold truncate max-w-[150px]">{pulse.topDrill}</span>
              </div>
           </Card>

           {/* CONTINUING EDUCATION */}
           <Card title="Professional Development" icon={<GraduationCap className="w-4 h-4" />}>
              <div className="space-y-3">
                 <div className="flex gap-2">
                    <Input 
                       placeholder="Next course or certification..." 
                       value={newEdu}
                       onChange={e => setNewEdu(e.target.value)}
                       className="h-8 text-xs bg-background"
                       onKeyDown={e => e.key === 'Enter' && addEdu()}
                    />
                    <Button size="sm" className="h-8 w-8 p-0" onClick={addEdu}><Zap className="w-3 h-3" /></Button>
                 </div>
                 <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                    {(profile.education || []).map(edu => (
                       <div key={edu.id} className="group flex items-start gap-2 p-2 rounded-lg bg-card border border-border/50 hover:border-primary/30 transition-colors">
                          <div className="flex-1 min-w-0">
                             <div className="text-xs font-bold leading-tight mb-1">{edu.title}</div>
                             <div className="flex gap-1">
                                {['Planned', 'In Progress', 'Completed'].map((s) => (
                                   <button 
                                      key={s}
                                      onClick={() => updateEduStatus(edu.id, s as any)}
                                      className={cn(
                                         "text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded-full border transition-all",
                                         edu.status === s 
                                            ? (s === 'Completed' ? "bg-emerald-500 text-white border-emerald-500" : s === 'In Progress' ? "bg-blue-500 text-white border-blue-500" : "bg-primary text-white border-primary")
                                            : "bg-transparent text-muted-foreground border-border hover:border-foreground"
                                      )}
                                   >
                                      {s}
                                   </button>
                                ))}
                             </div>
                          </div>
                          <button onClick={() => deleteEdu(edu.id)} className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"><Zap className="w-3 h-3 rotate-45" /></button>
                       </div>
                    ))}
                    {(profile.education || []).length === 0 && <div className="text-xs text-muted-foreground italic text-center py-2">No courses planned yet.</div>}
                 </div>
              </div>
           </Card>

           {/* GOALS & OBJECTIVES */}
           <Card title="Academy Goals" icon={<Target className="w-4 h-4" />}>
              <div className="space-y-3">
                 <div className="flex gap-2">
                    <Input 
                       placeholder="Add a new goal..." 
                       value={newGoal}
                       onChange={e => setNewGoal(e.target.value)}
                       className="h-8 text-xs bg-background"
                       onKeyDown={e => e.key === 'Enter' && addGoal()}
                    />
                    <Button size="sm" className="h-8 w-8 p-0" onClick={addGoal}><CheckSquare className="w-3 h-3" /></Button>
                 </div>
                 <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1">
                    {(profile.goals || []).map(goal => (
                       <div key={goal.id} className="group flex items-center gap-2 p-2 rounded-lg hover:bg-secondary/50 transition-colors">
                          <button 
                             onClick={() => toggleGoal(goal.id)}
                             className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center transition-colors",
                                goal.completed ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground"
                             )}
                          >
                             {goal.completed && <CheckSquare className="w-3 h-3" />}
                          </button>
                          <span className={cn("text-xs flex-1", goal.completed && "text-muted-foreground line-through")}>{goal.text}</span>
                          <button onClick={() => deleteGoal(goal.id)} className="text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100"><Zap className="w-3 h-3" /></button>
                       </div>
                    ))}
                 </div>
              </div>
           </Card>

           {/* COACHING PHILOSOPHY */}
           <Card title="Coaching Philosophy" icon={<BookOpen className="w-4 h-4" />}>
              <textarea 
                 value={profile.philosophy || ''}
                 onChange={e => onUpdate({...profile, philosophy: e.target.value})}
                 className="w-full h-24 bg-background border border-border rounded-lg p-3 text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                 placeholder="Define your core coaching values and beliefs..."
              />
           </Card>

           {/* SEASON FOCUS */}
           <Card title="Season Focus" icon={<CalendarCheck className="w-4 h-4" />}>
              <textarea 
                 value={profile.seasonFocus || ''}
                 onChange={e => onUpdate({...profile, seasonFocus: e.target.value})}
                 className="w-full h-24 bg-background border border-border rounded-lg p-3 text-xs leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                 placeholder="What are the key technical or tactical themes for this term?"
              />
           </Card>

           {/* GEAR */}
           <Card title="My Gear" icon={<Dumbbell className="w-4 h-4" />}>
              <div className="space-y-2">
                 <div className="grid grid-cols-2 gap-2">
                    <Field label="Racket">
                       <Input 
                          value={profile.gear?.racket || ''}
                          onChange={e => updateGear('racket', e.target.value)}
                          className="h-7 text-xs"
                          placeholder="Frame model"
                       />
                    </Field>
                    <Field label="Shoes">
                       <Input 
                          value={profile.gear?.shoes || ''}
                          onChange={e => updateGear('shoes', e.target.value)}
                          className="h-7 text-xs"
                          placeholder="Current pair"
                       />
                    </Field>
                 </div>
                 <div className="grid grid-cols-3 gap-2">
                    <Field label="Strings">
                       <Input 
                          value={profile.gear?.strings || ''}
                          onChange={e => updateGear('strings', e.target.value)}
                          className="h-7 text-xs"
                          placeholder="Poly/Gut"
                       />
                    </Field>
                    <Field label="Tension">
                       <Input 
                          value={profile.gear?.tension || ''}
                          onChange={e => updateGear('tension', e.target.value)}
                          className="h-7 text-xs"
                          placeholder="52 lbs"
                       />
                    </Field>
                    <Field label="Restrung">
                       <Input 
                          type="date"
                          value={profile.gear?.lastRestrung || ''}
                          onChange={e => updateGear('lastRestrung', e.target.value)}
                          className="h-7 text-[10px]"
                       />
                    </Field>
                 </div>
              </div>
           </Card>

        </div>
      </div>
    </div>
  );
}

// Sub-components (Reused style but local to this file for now)
function Card({ title, icon, children }: { title: string, icon: React.ReactNode, children: React.ReactNode }) {
  return (
    <div className="p-4 rounded-xl border border-border bg-card/40 backdrop-blur-sm flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">{icon}</div>
        <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">{title}</h3>
      </div>
      <div className="flex-1">
         {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string, children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Badge({ icon, text }: { icon: React.ReactNode, text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-card/50 border-border text-foreground">
      {icon}
      <span>{text}</span>
    </div>
  );
}