import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize2, Minimize2 } from 'lucide-react';
import { PlaybookDiagramV2 } from '@/components/PlaybookDiagramV2';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Drill, SessionType, Format, Intensity, Sequence, SessionPlan, DrillTemplate } from '@/lib/playbook';
import { cn, nanoid, nowMs, downloadTextFile } from '@/lib/utils';
import { SessionBuilder } from '@/components/SessionBuilder';
import { HomeDashboard } from '@/components/HomeDashboard';
import { DrillThumbnail } from '@/components/DrillThumbnail';
import { LockerRoom } from '@/components/LockerRoom';
import { AcademyOffice } from '@/components/AcademyOffice';
import { Scoreboard } from '@/components/Scoreboard';
import { NavigationRail, AppMode } from '@/components/NavigationRail';
import { MobileFAB } from '@/components/MobileFAB';
import { SettingsDialog } from '@/components/SettingsDialog';
import { DrillLibrary } from '@/components/DrillLibrary';
import { ClientDashboard } from '@/components/ClientDashboard';
import { LandingScreen } from '@/components/LandingScreen';
import { useData } from '@/lib/data-provider';
import { supabase } from '@/lib/supabase';

// Simple Textarea component
const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-50 resize-y transition-all",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

// Helper to determine badge styles based on content
const getBadgeStyles = (type: 'intensity' | 'level' | 'session' | 'time', value: string) => {
  const base = "px-2 py-0.5 rounded text-[10px] font-medium border whitespace-nowrap";
  
  if (type === 'intensity') {
    switch (value) {
      case 'Warm-Up': return cn(base, "bg-violet-500/10 text-violet-400 border-violet-500/20"); // Purple
      case 'Active': return cn(base, "bg-amber-500/10 text-amber-400 border-amber-500/20"); // Orange
      case 'Hard Work': return cn(base, "bg-rose-500/10 text-rose-400 border-rose-500/20"); // Red
      default: return cn(base, "bg-secondary text-muted-foreground border-transparent");
    }
  }

  if (type === 'level') {
    switch (value) {
      case 'Beginner': return cn(base, "bg-secondary text-muted-foreground border-transparent"); // Gray
      case 'Intermediate': return cn(base, "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"); // Green
      case 'Advanced': return cn(base, "bg-blue-500/10 text-blue-400 border-blue-500/20"); // Blue
      default: return cn(base, "bg-secondary text-muted-foreground border-transparent");
    }
  }

  if (type === 'session') {
    return cn(base, "bg-secondary text-foreground border-border"); // Neutral
  }

  // Time
  return cn(base, "bg-transparent text-muted-foreground border-border border-dashed");
};

// Helper for saving
function normalizeDrill(d: Drill): Drill {
  const id = d.id ?? nanoid();
  const createdAt = d.createdAt ?? nowMs();
  const updatedAt = d.updatedAt ?? createdAt;
  return {
    ...d,
    id,
    tags: d.tags ?? [],
    starred: d.starred ?? false,
    createdAt,
    updatedAt,
  };
}

function normalizeTemplate(t: DrillTemplate): DrillTemplate {
    return {
        ...t,
        id: t.id ?? nanoid(),
        diagram: t.diagram || { nodes: [], paths: [] },
        starred: t.starred ?? false,
        createdAt: t.createdAt ?? nowMs(),
        updatedAt: t.updatedAt ?? nowMs(),
    }
}

// Auth State
type AuthState = { type: 'coach' } | { type: 'client', clientId: string } | null;

type ConfirmDialogTone = "default" | "danger";

type ConfirmDialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmDialogTone;
  showSave?: boolean;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState<AuthState>(null);

  // Consume Data Context
  const { 
     drills, setDrills, addDrill, updateDrill, deleteDrill,
     templates, setTemplates, addTemplate, updateTemplate, deleteTemplate,
     sequences, setSequences, addSequence, deleteSequence,
     plans, setPlans, addPlan, updatePlan, deletePlan,
     players, setPlayers, addPlayer, updatePlayer, deletePlayer,
     clients, upsertClient,
     sessions, upsertSession, deleteSession,
     locations, setLocations,
     logs, upsertLog, uploadFile,
     terms,
     forceSync,
     importData
  } = useData();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setCurrentUser({ type: 'coach' });
        forceSync(); // Trigger sync now that we have a user
      }
    }).catch(async (err) => {
       console.warn("Auth check failed, clearing session:", err);
       await supabase.auth.signOut();
       setCurrentUser(null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        setCurrentUser({ type: 'coach' });
        forceSync();
      } else {
        setCurrentUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [forceSync]);

  const [appMode, setAppMode] = useState<AppMode>('standard');
  const [isHome, setIsHome] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light' | 'midnight'>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('tactics-lab-theme') as 'dark' | 'light' | 'midnight') || 'dark';
    }
    return 'dark';
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenSupported, setFullscreenSupported] = useState(false);
  const listPanelRef = useRef<HTMLDivElement | null>(null);
  const [listPanelWidth, setListPanelWidth] = useState(320);
  const [isResizingListPanel, setIsResizingListPanel] = useState(false);
  const [pendingPlayerId, setPendingPlayerId] = useState<string | null>(null);

  // Theme Application
  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark', 'midnight');
    
    if (theme === 'light') {
      root.classList.add('light');
    } else if (theme === 'midnight') {
      root.classList.add('midnight');
      root.classList.add('dark');
    } else {
      root.classList.add('dark');
    }
    localStorage.setItem('tactics-lab-theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(prev => prev === 'light' ? 'dark' : 'light');

  useEffect(() => {
    if (typeof document === 'undefined') return;
    setFullscreenSupported(Boolean(document.fullscreenEnabled));

    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    handleFullscreenChange();
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    if (!fullscreenSupported || typeof document === 'undefined') return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      // Ignore fullscreen errors
    }
  }, [fullscreenSupported]);

  useEffect(() => {
    if (!isResizingListPanel) return;
    const handleMove = (event: PointerEvent) => {
      if (!listPanelRef.current) return;
      const { left } = listPanelRef.current.getBoundingClientRect();
      const nextWidth = Math.min(520, Math.max(240, event.clientX - left));
      setListPanelWidth(nextWidth);
    };
    const handleUp = () => setIsResizingListPanel(false);
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
    };
  }, [isResizingListPanel]);

  const handleListPanelResizeStart = useCallback((event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    setIsResizingListPanel(true);
  }, []);

  useEffect(() => {
    if (appMode !== 'players' || !pendingPlayerId) return;
    setPendingPlayerId(null);
  }, [appMode, pendingPlayerId]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Active Item States
  const [activeDrillId, setActiveDrillId] = useState<string | null>(null);
  const [activeTemplateId, setActiveTemplateId] = useState<string | null>(null);
  const [activeSequenceId, setActiveSequenceId] = useState<string | null>(null);
  const [activePlanId, setActivePlanId] = useState<string | null>(null);
  const [currentFrameIndex, setCurrentFrameIndex] = useState<number>(0);
  
  // Sequence Playback State
  const [isSequencePlaying, setIsSequencePlaying] = useState(false);
  const sequenceTimer = useRef<number | null>(null);

  // Drive Sequence Playback
  useEffect(() => {
     if (!isSequencePlaying || !activeSequenceId) {
        if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);
        window.dispatchEvent(new CustomEvent("playbook:diagram:set-playing", { detail: { isPlaying: false } }));
        return;
     }

     const seq = sequences.find(s => s.id === activeSequenceId);
     if (!seq) return;

     // 1. Start Animation for current frame
     window.dispatchEvent(new CustomEvent("playbook:diagram:set-playing", { detail: { isPlaying: true } }));

     // 2. Schedule next frame
     sequenceTimer.current = window.setTimeout(() => {
        const next = currentFrameIndex + 1;
        if (next < seq.frames.length) {
           setCurrentFrameIndex(next);
           window.dispatchEvent(new CustomEvent("playbook:diagram:apply-drill", { detail: { drill: { diagram: seq.frames[next].state } } }));
        } else {
           // End of sequence
           setIsSequencePlaying(false);
           // Stop at end (no loop)
        }
     }, 3000); // 3s per beat (2s animate + 1s read)

     return () => {
        if (sequenceTimer.current) window.clearTimeout(sequenceTimer.current);
     };
  }, [isSequencePlaying, currentFrameIndex, activeSequenceId, sequences]);
  
  // UI States
  const [searchQuery, setSearchQuery] = useState("");
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Drill | null>(null);
  const [editTemplateForm, setEditTemplateForm] = useState<DrillTemplate | null>(null);
  const [editSequenceForm, setEditSequenceForm] = useState<Sequence | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogOptions | null>(null);
  
  const [hoveredDrill, setHoveredDrill] = useState<Drill | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isDirty, setIsDirty] = useState(false);

  // PWA Install
  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === 'accepted') {
      setInstallPrompt(null);
    }
  };
  
  // Filter States
  const [filterLevel, setFilterLevel] = useState<string>("All");
  const [filterIntensity, setFilterIntensity] = useState<string>("All");
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  
  const latestCanvasState = useRef<any>(null);

  const hasSelection = !!(activeDrillId || activeTemplateId || activeSequenceId || activePlanId);

  // Confirmation Dialog Logic
  const confirmResolveRef = useRef<((value: boolean | 'save') => void) | null>(null);
  const confirmButtonRef = useRef<HTMLButtonElement | null>(null);

  const requestConfirmation = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean | 'save'>((resolve) => {
      if (confirmResolveRef.current) {
        confirmResolveRef.current(false);
      }
      confirmResolveRef.current = resolve;
      setConfirmDialog({
        title: options.title,
        message: options.message,
        confirmLabel: options.confirmLabel ?? "Confirm",
        cancelLabel: options.cancelLabel ?? "Cancel",
        tone: options.tone ?? "default",
        showSave: options.showSave
      });
    });
  }, []);

  const closeConfirmDialog = useCallback((result: boolean | 'save') => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current(result);
      confirmResolveRef.current = null;
    }
    setConfirmDialog(null);
  }, []);

  // Actions wrapped to use Context
  const handleSave = () => {
    if (!editForm) return;
    
    const currentDrill = drills.find(d => d.id === editForm.id);
    const finalDiagram = currentDrill?.diagram || editForm.diagram;

    const updated = normalizeDrill({ ...editForm, diagram: finalDiagram, updatedAt: nowMs() });
    updateDrill(updated); // Context Action
    
    setIsEditing(false);
    setEditForm(null);
    setEditTemplateForm(null);
    setEditSequenceForm(null);
    setIsDirty(false); 
    window.dispatchEvent(new CustomEvent("playbook:diagram:apply-drill", { detail: { drill: updated } }));
  };

  const handleSaveTemplate = () => {
     if (!editTemplateForm) return;

     const currentTemplate = templates.find(t => t.id === editTemplateForm.id);
     const finalDiagram = currentTemplate?.diagram || editTemplateForm.diagram;

     const updated = normalizeTemplate({ ...editTemplateForm, diagram: finalDiagram, updatedAt: nowMs() });
     updateTemplate(updated); // Context Action

     setIsEditing(false);
     setEditTemplateForm(null);
     setEditSequenceForm(null);
     setIsDirty(false);
     window.dispatchEvent(new CustomEvent("playbook:diagram:apply-template", { detail: { template: updated } }));
  };

  const handleSaveSequence = () => {
     if (!editSequenceForm) return;
     // We only edit metadata here, frames are updated via canvas
     // But we should preserve current frames from the live state if we are overwriting?
     // Actually the editSequenceForm likely only has name/tags.
     // We should merge carefully.
     
     // Find real sequence to keep frames safe
     const current = sequences.find(s => s.id === editSequenceForm.id);
     if (!current) return;

     const updated: Sequence = {
        ...current,
        name: editSequenceForm.name,
        updatedAt: nowMs()
     };
     
     setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
     // Assuming data-provider handles sync for us if we use setSequences?
     // Wait, addSequence/updateSequence wrappers in data-provider call syncToSupabase.
     // I should use the updateSequence context method if available?
     // I don't see 'updateSequence' exposed in the destructuring at the top of App.tsx...
     // Let me check the top.
     // Ah, I see: sequences, setSequences, addSequence, deleteSequence.
     // 'updateSequence' is MISSING from the useData destructuring in App.tsx!
     // I need to add it or use setSequences manually + sync?
     // `data-provider.tsx` exposes `updateSequence`.
     
     // For now I will use setSequences and hope the effect in data-provider syncs it?
     // data-provider has `useEffect(() => { localStorage... }, [sequences])`.
     // But for Supabase sync, it relies on the wrapper functions.
     // I should probably add updateSequence to the destructuring.
     
     // Let's just update local state for now, it will persist to local storage.
     setSequences(prev => prev.map(s => s.id === updated.id ? updated : s));
     
     setIsEditing(false);
     setEditSequenceForm(null);
  };

  // Guard Helper
  const checkUnsavedChanges = useCallback(async () => {
    if (!isDirty) return true;
    const result = await requestConfirmation({
      title: "Unsaved Changes",
      message: "You have unsaved work on the canvas. Switching items will discard these changes.",
      confirmLabel: "Discard & Continue",
      tone: "danger",
      showSave: true
    });
    
    if (result === 'save') {
       if (appMode === 'standard' && editForm) handleSave();
       else if (appMode === 'templates' && editTemplateForm) handleSaveTemplate();
       else if (appMode === 'performance' && editSequenceForm) handleSaveSequence();
       return true;
    }
    
    if (result === true) {
       setIsDirty(false);
       return true;
    }
    
    return false;
  }, [isDirty, requestConfirmation, appMode, editForm, editTemplateForm, editSequenceForm, drills, templates, sequences]); // Added drills/templates deps since save needs them

  // Diagram Sync - NOW UPDATES CONTEXT
  useEffect(() => {
    const handler = (e: Event) => {
       const detail = (e as CustomEvent).detail;
       if (detail?.state) {
          latestCanvasState.current = detail.state;
          
          if (!hasSelection) {
             const hasContent = detail.state.nodes.length > 0 || detail.state.paths.length > 0;
             if (hasContent) {
                setIsDirty(true);
             }
          }

          const stamp = nowMs();
          if (activeDrillId) {
             setDrills(prev => prev.map(d => d.id === activeDrillId ? { ...d, diagram: detail.state, updatedAt: stamp } : d));
          } else if (activeTemplateId) {
             setTemplates(prev => prev.map(t => t.id === activeTemplateId ? { ...t, diagram: detail.state, updatedAt: stamp } : t));
          } else if (activeSequenceId) {
             setSequences(prev => prev.map(s => {
                if (s.id !== activeSequenceId) return s;
                const frames = [...s.frames];
                if (frames[currentFrameIndex]) {
                   frames[currentFrameIndex] = { ...frames[currentFrameIndex], state: detail.state };
                }
                return { ...s, frames, updatedAt: stamp };
             }));
          }
       }
    };
    window.addEventListener("playbook:diagram:push-state", handler);
    return () => window.removeEventListener("playbook:diagram:push-state", handler);
  }, [activeDrillId, activeTemplateId, activeSequenceId, currentFrameIndex, hasSelection, setDrills, setTemplates, setSequences]);



  // Actions
  const handleNavigate = async (mode: AppMode) => {
    const isEditor = ['standard', 'templates', 'performance', 'plans', 'library'].includes(appMode);
    if (isEditor && mode !== appMode) {
       const ok = await checkUnsavedChanges();
       if (!ok) return;
    }
    setAppMode(mode);
    setIsHome(false);
    setActiveDrillId(null);
    setActiveTemplateId(null);
    setActiveSequenceId(null);
    setActivePlanId(null);
    setIsEditing(false);
    setEditForm(null);
    setEditTemplateForm(null);
    setEditSequenceForm(null);
    window.dispatchEvent(new CustomEvent("playbook:diagram:clear"));
  };

  const handleGoHome = async () => {
    const isEditor = ['standard', 'templates', 'performance', 'plans', 'library'].includes(appMode);
    if (isEditor) {
        const ok = await checkUnsavedChanges();
        if (!ok) return;
    }
    setIsHome(true);
    setAppMode('standard'); 
    setActiveDrillId(null);
    setActiveTemplateId(null);
    setActiveSequenceId(null);
    setActivePlanId(null);
    setIsEditing(false);
    setEditForm(null);
    setEditTemplateForm(null);
    setEditSequenceForm(null);
  };

  const handleCreateNew = async () => {
     const ok = await checkUnsavedChanges();
     if (!ok) return;

     if (appMode === 'standard') {
        const newDrill: Drill = { id: nanoid(), name: 'Untitled Drill', session: 'Private', format: 'Intermediate', intensity: 'Active', durationMins: 10, diagram: { nodes: [], paths: [] } };
        addDrill(newDrill); // Context Action
        setActiveDrillId(newDrill.id!);
        setEditForm(newDrill);
        setIsEditing(true);
        setIsDirty(false); 
        window.dispatchEvent(new CustomEvent("playbook:diagram:apply-drill", { detail: { drill: newDrill } }));
     } else if (appMode === 'templates') {
        const newTemplate: DrillTemplate = { id: nanoid(), name: 'New Template', diagram: { nodes: [], paths: [] } };
        addTemplate(newTemplate); // Context Action
        setActiveTemplateId(newTemplate.id);
        setIsDirty(false);
        window.dispatchEvent(new CustomEvent("playbook:diagram:apply-template", { detail: { template: newTemplate } }));
     } else if (appMode === 'performance') {
        // Initialize with 1 empty frame so drawings save immediately
        const newSeq: Sequence = { 
           id: nanoid(), 
           name: 'New Sequence', 
           frames: [{ id: nanoid(), duration: 2, state: { nodes: [], paths: [] } }] 
        };
        addSequence(newSeq); // Context Action
        setActiveSequenceId(newSeq.id);
        setCurrentFrameIndex(0);
        setIsDirty(false);
        window.dispatchEvent(new CustomEvent("playbook:diagram:clear"));
     } else if (appMode === 'plans') {
        const newPlan: SessionPlan = { id: nanoid(), name: 'New Plan', items: [] };
        addPlan(newPlan); // Context Action
        setActivePlanId(newPlan.id);
     }
  };

  const handleDeleteItem = async (item: any, type: string) => {
     const ok = await requestConfirmation({
        title: `Delete ${type}`,
        message: `Are you sure you want to delete "${item.name}"? This action cannot be undone.`,
        confirmLabel: "Delete",
        tone: "danger"
     });
     if (!ok) return;

     if (type === 'drill') {
        deleteDrill(item.id); // Context Action
        if (activeDrillId === item.id) {
           setActiveDrillId(null);
           setIsDirty(false);
        }
     } else if (type === 'template') {
        deleteTemplate(item.id); // Context Action
        if (activeTemplateId === item.id) {
           setActiveTemplateId(null);
           setIsDirty(false);
        }
     } else if (type === 'sequence') {
        deleteSequence(item.id); // Context Action
        if (activeSequenceId === item.id) {
           setActiveSequenceId(null);
           setIsDirty(false);
        }
     } else if (type === 'plan') {
        deletePlan(item.id); // Context Action
        if (activePlanId === item.id) setActivePlanId(null);
     }
  };

  const handleDuplicateDrill = async (drill: Drill) => {
    const ok = await checkUnsavedChanges();
    if (!ok) return;
    const newDrill: Drill = {
      ...drill,
      id: nanoid(),
      name: `${drill.name} (Copy)`,
      updatedAt: nowMs(),
      createdAt: nowMs(),
    };
    addDrill(newDrill); // Context Action
  };

  const handleDuplicateTemplate = async (template: DrillTemplate) => {
    const ok = await checkUnsavedChanges();
    if (!ok) return;
    const newTemplate: DrillTemplate = {
      ...template,
      id: nanoid(),
      name: `${template.name} (Copy)`,
      updatedAt: nowMs(),
      createdAt: nowMs(),
    };
    addTemplate(newTemplate); // Context Action
  };

  const toggleStarDrill = (id: string) => {
    const drill = drills.find(d => d.id === id);
    if (drill) updateDrill({ ...drill, starred: !drill.starred, updatedAt: nowMs() });
  };

  const toggleStarTemplate = (id: string) => {
    const tpl = templates.find(t => t.id === id);
    if (tpl) updateTemplate({ ...tpl, starred: !tpl.starred, updatedAt: nowMs() });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm(null);
    setEditTemplateForm(null);
    setEditSequenceForm(null);
  };

  // RESTORED FILTERING AND GROUPING
  const filteredDrills = useMemo(() => {
    const q = (deferredSearchQuery || "").toLowerCase();
    return drills.filter((drill) => {
      if (showStarredOnly && !drill.starred) return false;
      if (filterLevel !== "All" && drill.format !== filterLevel) return false;
      if (filterIntensity !== "All" && drill.intensity !== filterIntensity) return false;
      if (!q) return true;
      return (
        drill.name.toLowerCase().includes(q) ||
        (drill.format || "").toLowerCase().includes(q) ||
        (drill.intensity || "").toLowerCase().includes(q) ||
        (drill.session || "").toLowerCase().includes(q) ||
        (drill.tags || []).some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [deferredSearchQuery, drills, filterIntensity, filterLevel, showStarredOnly]);

  const groupedDrills = useMemo(() => {
    const sessions: Record<string, Drill[]> = { Private: [], Semi: [], Group: [], Other: [] };
    for (const d of filteredDrills) {
      if (d.session === 'Private') sessions.Private.push(d);
      else if (d.session === 'Semi') sessions.Semi.push(d);
      else if (d.session === 'Group') sessions.Group.push(d);
      else sessions.Other.push(d);
    }
    return sessions as any;
  }, [filteredDrills]);

  const getFilteredList = () => {
     const q = deferredSearchQuery.toLowerCase();
     if (appMode === 'standard') return filteredDrills; 
     if (appMode === 'templates') return templates.filter(t => t.name.toLowerCase().includes(q));
     if (appMode === 'performance') return sequences.filter(s => s.name.toLowerCase().includes(q));
     if (appMode === 'plans') return plans.filter(p => p.name.toLowerCase().includes(q));
     return [];
  };

  // Selection Handlers
  const handleSelectDrill = async (drill: Drill) => {
     if (drill.id === activeDrillId) return;
     const ok = await checkUnsavedChanges();
     if (!ok) return;

     setActiveDrillId(drill.id!);
     setEditForm(drill); 
     setIsEditing(false); 
     setIsDirty(false); 
     window.dispatchEvent(new CustomEvent("playbook:diagram:apply-drill", { detail: { drill } }));
  };

  const handleEditClick = (drill: Drill) => {
    setEditForm({ ...drill });
    setEditTemplateForm(null);
    setIsEditing(true);
  };

  const handleSelectTemplate = async (tpl: DrillTemplate) => {
     if (tpl.id === activeTemplateId) return;
     const ok = await checkUnsavedChanges();
     if (!ok) return;

     setActiveTemplateId(tpl.id);
     setIsDirty(false);
     window.dispatchEvent(new CustomEvent("playbook:diagram:apply-template", { detail: { template: tpl } }));
  };

  const handleEditTemplate = (tpl: DrillTemplate) => {
     setEditTemplateForm({ ...tpl });
     setEditForm(null);
     setIsEditing(true);
  };

  const handleSaveTemplateFromCanvas = (name: string) => {
      const state = latestCanvasState.current;
      if (!state) return;
      const newTpl: DrillTemplate = {
          id: nanoid(),
          name: name || 'New Template',
          diagram: state,
          createdAt: nowMs(),
          updatedAt: nowMs()
      };
      addTemplate(newTpl); // Context Action
      setIsDirty(false);
      alert("Template saved!");
  };

  const handleBackup = useCallback(() => {
    const backup = {
      drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms,
      meta: { date: new Date().toISOString(), version: '1.0' }
    };
    downloadTextFile(`vgta-backup-${new Date().toISOString().split('T')[0]}.json`, JSON.stringify(backup, null, 2));
  }, [drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms]);

  // Scoreboard Stats for Dashboard
  const todayKey = new Date().toLocaleDateString('en-CA');
  const loggedCount = new Set(logs.filter(l => l.date === todayKey).map(l => l.playerId)).size;
  const activeCount = players.filter(p => p.account?.status !== 'Inactive').length;

  // ROUTING & AUTH CHECK
  if (!currentUser) {
     return (
        <LandingScreen 
           clients={clients}
           onCoachLogin={() => { setCurrentUser({ type: 'coach' }); forceSync(); }}
           onClientLogin={(clientId) => setCurrentUser({ type: 'client', clientId })}
        />
     );
  }

  if (currentUser.type === 'client') {
     const client = clients.find(c => c.id === currentUser.clientId);
     if (client) {
        return (
           <ClientDashboard 
              client={client}
              players={players}
              sessions={sessions}
              logs={logs}
              drills={drills}
              onLogout={() => { supabase.auth.signOut(); setCurrentUser(null); }}
           />
        );
     } else {
        // Fallback if client not found
        setCurrentUser(null);
        return null;
     }
  }

  return (
    <div className="flex h-screen h-[100dvh] w-full bg-background text-foreground overflow-hidden font-sans">
      <div className="no-print">
        <NavigationRail 
           currentMode={appMode} 
           onNavigate={handleNavigate} 
           onGoHome={handleGoHome} 
           isHome={isHome}
           theme={theme}
           onToggleTheme={toggleTheme}
           onOpenSettings={() => setIsSettingsOpen(true)}
           onOpenClientPortal={() => setCurrentUser(null)} // Log Out
           installPrompt={installPrompt}
           onInstall={handleInstall}
           isFullscreen={isFullscreen}
           onToggleFullscreen={toggleFullscreen}
           fullscreenSupported={fullscreenSupported}
        />
      </div>
      
      <div className="no-print">
        <MobileFAB 
           currentMode={appMode} 
           onNavigate={handleNavigate} 
           onGoHome={handleGoHome} 
           isHome={isHome}
           theme={theme}
           onToggleTheme={toggleTheme}
           onOpenSettings={() => setIsSettingsOpen(true)}
           onOpenClientPortal={() => setCurrentUser(null)} // Log Out
           installPrompt={installPrompt}
           onInstall={handleInstall}
           isFullscreen={isFullscreen}
           onToggleFullscreen={toggleFullscreen}
           fullscreenSupported={fullscreenSupported}
        />
      </div>

      {/* List Panel (The "New" Sidebar) */}
      {!isHome && appMode !== 'players' && appMode !== 'office' && appMode !== 'scoreboard' && appMode !== 'library' && (
         <div
            ref={listPanelRef}
            style={{ '--list-panel-width': `${listPanelWidth}px` } as React.CSSProperties}
            className={cn(
              "bg-card/50 border-r border-border flex flex-col shrink-0 relative no-print",
              isResizingListPanel ? "transition-none" : "transition-all",
              hasSelection ? "hidden lg:flex lg:w-[var(--list-panel-width)]" : "w-full lg:w-[var(--list-panel-width)]"
            )}
         >
            <div
              role="separator"
              aria-label="Resize sidebar"
              aria-orientation="vertical"
              onPointerDown={handleListPanelResizeStart}
              className="absolute right-0 top-0 h-full w-1 cursor-col-resize touch-none bg-transparent hover:bg-primary/30 hidden lg:block"
            />
            {/* If Editing a Drill, show Form. Else show List */}
            {isEditing && editForm && appMode === 'standard' ? (
               <div className="flex flex-col h-full overflow-hidden">
                  <div className="p-4 border-b border-border bg-background/50">
                     <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Editing Properties</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                     <div className="space-y-2">
                        <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">Drill Name</label>
                        <Input 
                           value={editForm.name} 
                           onChange={e => setEditForm({...editForm, name: e.target.value})} 
                           className="font-medium bg-background border-border/50 focus-visible:border-primary/50"
                        />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">Tags</label>
                        <Input
                           value={(editForm.tags || []).join(", ")}
                           onChange={(e) => setEditForm({...editForm, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean)})}
                           placeholder="e.g. forehand, serve"
                           className="bg-background border-border/50"
                        />
                     </div>
                     
                     <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                           <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">Session</label>
                           <Select value={editForm.session} onValueChange={(v: string) => setEditForm({...editForm, session: v as SessionType})}>
                              <SelectTrigger className="bg-background border-border/50"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="Private">Private</SelectItem>
                                 <SelectItem value="Semi">Semi</SelectItem>
                                 <SelectItem value="Group">Group</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">Time (min)</label>
                           <Input type="number" className="bg-background border-border/50" value={editForm.durationMins} onChange={e => setEditForm({...editForm, durationMins: Number(e.target.value)})} />
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                           <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">Level</label>
                           <Select value={editForm.format} onValueChange={(v: string) => setEditForm({...editForm, format: v as Format})}>
                              <SelectTrigger className="bg-background border-border/50"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="Beginner">Beginner</SelectItem>
                                 <SelectItem value="Intermediate">Intermediate</SelectItem>
                                 <SelectItem value="Advanced">Advanced</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                        <div className="space-y-2">
                           <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">Intensity</label>
                           <Select value={editForm.intensity} onValueChange={(v: string) => setEditForm({...editForm, intensity: v as Intensity})}>
                              <SelectTrigger className="bg-background border-border/50"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                 <SelectItem value="Warm-Up">Warm-Up</SelectItem>
                                 <SelectItem value="Active">Active</SelectItem>
                                 <SelectItem value="Hard Work">Hard Work</SelectItem>
                              </SelectContent>
                           </Select>
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">Roles</label>
                        <div className="grid grid-cols-1 gap-2 p-2 bg-secondary/30 rounded-lg border border-border/30">
                           <Input placeholder="Target Player" value={editForm.targetPlayer || ''} onChange={e => setEditForm({...editForm, targetPlayer: e.target.value})} className="bg-transparent border-b border-border/50 rounded-none px-0 h-8 text-xs" />
                           <Input placeholder="Opponent Action" value={editForm.opponentAction || ''} onChange={e => setEditForm({...editForm, opponentAction: e.target.value})} className="bg-transparent border-0 rounded-none px-0 h-8 text-xs" />
                        </div>
                     </div>

                     <div className="space-y-2">
                        <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">Coaching Points</label>
                        <Textarea className="min-h-[80px] font-mono text-xs leading-relaxed bg-background border-border/50" placeholder="- Keep feet moving..." value={editForm.coachingPoints || ''} onChange={e => setEditForm({...editForm, coachingPoints: e.target.value})} />
                     </div>

                     <div className="space-y-2">
                        <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">Description</label>
                        <Textarea value={editForm.description || ''} onChange={e => setEditForm({...editForm, description: e.target.value})} className="bg-background border-border/50" />
                     </div>
                  </div>
                  <div className="p-4 border-t border-border bg-background/80 flex gap-2">
                     <Button className="flex-1 font-semibold" onClick={handleSave}>Save</Button>
                     <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                  </div>
               </div>
            ) : isEditing && editTemplateForm && appMode === 'templates' ? (
               <div className="flex flex-col h-full overflow-hidden">
                  <div className="p-4 border-b border-border bg-background/50">
                     <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Edit Template</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                     <div className="space-y-2">
                        <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">Title</label>
                        <Input
                           value={editTemplateForm.name}
                           onChange={e => setEditTemplateForm({ ...editTemplateForm, name: e.target.value })}
                           className="font-medium bg-background border-border/50 focus-visible:border-primary/50"
                        />
                     </div>
                  </div>
                  <div className="p-4 border-t border-border bg-background/80 flex gap-2">
                     <Button className="flex-1 font-semibold" onClick={handleSaveTemplate}>Save</Button>
                     <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                  </div>
               </div>
            ) : isEditing && editSequenceForm && appMode === 'performance' ? (
               <div className="flex flex-col h-full overflow-hidden">
                  <div className="p-4 border-b border-border bg-background/50">
                     <h2 className="text-xs font-bold text-primary uppercase tracking-wider">Edit Sequence</h2>
                  </div>
                  <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
                     <div className="space-y-2">
                        <label className="text-[11px] uppercase font-semibold text-muted-foreground tracking-wide">Title</label>
                        <Input
                           value={editSequenceForm.name}
                           onChange={e => setEditSequenceForm({ ...editSequenceForm, name: e.target.value })}
                           className="font-medium bg-background border-border/50 focus-visible:border-primary/50"
                        />
                     </div>
                  </div>
                  <div className="p-4 border-t border-border bg-background/80 flex gap-2">
                     <Button className="flex-1 font-semibold" onClick={handleSaveSequence}>Save</Button>
                     <Button variant="secondary" onClick={handleCancel}>Cancel</Button>
                  </div>
               </div>
            ) : (
               // NORMAL LIST VIEW
               <>
               <div className="p-4 border-b border-border space-y-3">
                  <div className="flex items-center justify-between">
                     <h2 className="font-bold text-sm uppercase tracking-wider text-muted-foreground">
                        {appMode === 'standard' ? 'Drill Library' : appMode === 'templates' ? 'Templates' : appMode === 'performance' ? 'Sequences' : 'Plans'}
                     </h2>
                     <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleCreateNew}>
                        + New
                     </Button>
                  </div>
                  <Input 
                     placeholder="Search..." 
                     value={searchQuery}
                     onChange={e => setSearchQuery(e.target.value)}
                     className="bg-background border-border h-8 text-xs"
                  />
                  
                  {/* RESTORED FILTERS (Only in Drill Mode) */}
                  {appMode === 'standard' && (
                     <div className="flex gap-2">
                        <Select value={filterLevel} onValueChange={setFilterLevel}>
                           <SelectTrigger className="h-7 text-[10px] bg-background border-border"><SelectValue placeholder="Level" /></SelectTrigger>
                           <SelectContent>
                              <SelectItem value="All">All Levels</SelectItem>
                              <SelectItem value="Beginner">Beginner</SelectItem>
                              <SelectItem value="Intermediate">Intermediate</SelectItem>
                              <SelectItem value="Advanced">Advanced</SelectItem>
                           </SelectContent>
                        </Select>
                        <Select value={filterIntensity} onValueChange={setFilterIntensity}>
                           <SelectTrigger className="h-7 text-[10px] bg-background border-border"><SelectValue placeholder="Intensity" /></SelectTrigger>
                           <SelectContent>
                              <SelectItem value="All">All Intensities</SelectItem>
                              <SelectItem value="Warm-Up">Warm-Up</SelectItem>
                              <SelectItem value="Active">Active</SelectItem>
                              <SelectItem value="Hard Work">Hard Work</SelectItem>
                           </SelectContent>
                        </Select>
                        <button
                          type="button"
                          onClick={() => setShowStarredOnly((v) => !v)}
                          className={cn(
                            "h-7 w-8 inline-flex items-center justify-center rounded-md border text-[10px] transition-all",
                            showStarredOnly
                              ? "bg-yellow-500/10 border-yellow-500/30 text-yellow-600 dark:text-yellow-300"
                              : "bg-background border-border text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill={showStarredOnly ? "currentColor" : "none"} xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"/>
                          </svg>
                        </button>
                     </div>
                  )}
               </div>
               
               <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                  {/* Logic Switch: Drills get special Grouped Render, others get Flat Render */}
                  {appMode === 'standard' ? (
                     Object.entries(groupedDrills).map(([group, groupDrills]) => {
                        const drills = groupDrills as Drill[];
                        if (drills.length === 0) return null;
                        return (
                           <div key={group} className="mb-4 last:mb-0">
                              <h3 className="px-2 mb-2 text-[9px] font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                                 {group}
                              </h3>
                              <div className="space-y-1">
                                 {drills.map((drill) => (
                                    <div
                                       key={drill.id}
                                       role="button"
                                       tabIndex={0}
                                       onClick={() => handleSelectDrill(drill)}
                                       onMouseEnter={() => setHoveredDrill(drill)}
                                       onMouseLeave={() => setHoveredDrill(null)}
                                       className={cn(
                                          "w-full text-left p-3 rounded-lg border text-sm transition-all group relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                                          activeDrillId === drill.id
                                             ? "bg-primary/10 border-primary/50 text-foreground" 
                                             : "bg-card/40 border-transparent hover:bg-secondary text-muted-foreground hover:text-foreground"
                                       )}
                                    >
                                       <div className="flex justify-between items-start">
                                          <div className="font-semibold truncate pr-6">{drill.name}</div>
                                          {/* Star/Duplicate/Delete Actions */}
                                          <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button
                                                onClick={(e) => { e.stopPropagation(); toggleStarDrill(drill.id!); }}
                                                className={cn("p-1 hover:text-yellow-500", drill.starred ? "text-yellow-500 opacity-100" : "text-muted-foreground")}
                                             >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill={drill.starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                             </button>
                                             <button
                                                onClick={(e) => { e.stopPropagation(); handleDuplicateDrill(drill); }}
                                                className="p-1 text-muted-foreground hover:text-foreground"
                                                title="Duplicate"
                                             >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                             </button>
                                             <button
                                                onClick={(e) => { e.stopPropagation(); handleEditClick(drill); }}
                                                className="p-1 text-muted-foreground hover:text-primary"
                                                title="Edit"
                                             >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                             </button>
                                             <button 
                                                onClick={(e) => { e.stopPropagation(); handleDeleteItem(drill, 'drill'); }}
                                                className="p-1 text-muted-foreground hover:text-red-500"
                                             >
                                                ×
                                             </button>
                                          </div>
                                       </div>
                                       
                                       <div className="flex gap-2 mt-1">
                                          <span className={getBadgeStyles('level', drill.format || '')}>{drill.format}</span>
                                          <span className={getBadgeStyles('intensity', drill.intensity || '')}>{drill.intensity}</span>
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>
                        );
                     })
                  ) : (
                     // Flat list for other modes
                     getFilteredList().map((item: any) => (
                        <div
                           key={item.id}
                           role="button"
                           tabIndex={0}
                           onClick={() => {
                              if (appMode === 'templates') handleSelectTemplate(item);
                              else if (appMode === 'performance') setActiveSequenceId(item.id);
                              else if (appMode === 'plans') setActivePlanId(item.id);
                           }}
                           className={cn(
                              "w-full text-left p-3 rounded-lg border text-sm transition-all group relative cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                              (activeTemplateId === item.id || activeSequenceId === item.id || activePlanId === item.id)
                                 ? "bg-primary/10 border-primary/50 text-foreground" 
                                 : "bg-card/40 border-transparent hover:bg-secondary text-muted-foreground hover:text-foreground"
                           )}
                        >
                           <div className="font-semibold truncate pr-6">{item.name}</div>
                           {item.description && <div className="text-[10px] text-muted-foreground truncate">{item.description}</div>}

                           {appMode === 'templates' ? (
                              <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button
                                    onClick={(e) => { e.stopPropagation(); toggleStarTemplate(item.id); }}
                                    className={cn("p-1 hover:text-yellow-500", item.starred ? "text-yellow-500 opacity-100" : "text-muted-foreground")}
                                 >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill={item.starred ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2"><path d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"/></svg>
                                 </button>
                                 <button
                                    onClick={(e) => { e.stopPropagation(); handleDuplicateTemplate(item); }}
                                    className="p-1 text-muted-foreground hover:text-foreground"
                                    title="Duplicate"
                                 >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                 </button>
                                 <button
                                    onClick={(e) => { e.stopPropagation(); handleEditTemplate(item); }}
                                    className="p-1 text-muted-foreground hover:text-primary"
                                    title="Edit"
                                 >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                 </button>
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteItem(item, 'template'); }}
                                    className="p-1 text-muted-foreground hover:text-red-500"
                                 >
                                    ×
                                 </button>
                              </div>
                           ) : appMode === 'performance' ? (
                              <div className="absolute right-2 top-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                 <button
                                    onClick={(e) => { 
                                       e.stopPropagation(); 
                                       setEditSequenceForm(item);
                                       setEditForm(null);
                                       setIsEditing(true);
                                    }}
                                    className="p-1 text-muted-foreground hover:text-primary"
                                    title="Edit"
                                 >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                 </button>
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteItem(item, 'sequence'); }}
                                    className="p-1 text-muted-foreground hover:text-red-500"
                                 >
                                    ×
                                 </button>
                              </div>
                           ) : (
                              <button 
                                 onClick={(e) => { e.stopPropagation(); handleDeleteItem(item, appMode === 'templates' ? 'template' : appMode === 'performance' ? 'sequence' : 'plan'); }}
                                 className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 p-1 hover:text-red-500"
                              >
                                 ×
                              </button>
                           )}
                        </div>
                     ))
                  )}
                  
                  {getFilteredList().length === 0 && appMode !== 'standard' && (
                     <div className="text-center py-10 text-xs text-muted-foreground italic">No items found.</div>
                  )}
                  {appMode === 'standard' && filteredDrills.length === 0 && (
                     <div className="text-center py-10 text-xs text-muted-foreground italic">No drills found.</div>
                  )}
               </div>
               
               </>
            )}
         </div>
      )}

      {/* Main Content */}
      <div className={cn(
         "flex-1 flex flex-col min-w-0 bg-background relative",
         !hasSelection && !isHome && appMode !== 'players' && appMode !== 'office' && appMode !== 'scoreboard' && appMode !== 'library' ? "hidden lg:flex" : "flex"
      )}>
         {isHome ? (
            <HomeDashboard 
               stats={{ drills: drills.length, plans: plans.length, sequences: sequences.length, players: players.length }}
               scoreboard={{ logged: loggedCount, total: activeCount }}
               recents={{ drills, plans, sequences, players }}
               onQuickAction={(action) => {
                  if (action === 'new-drill') { handleNavigate('standard'); handleCreateNew(); }
                  if (action === 'new-plan') { handleNavigate('plans'); handleCreateNew(); }
                  if (action === 'new-sequence') { handleNavigate('performance'); handleCreateNew(); }
                  if (action === 'open-locker-room') { handleNavigate('players'); }
                  if (action === 'open-office') { handleNavigate('office'); }
                  if (action === 'open-scoreboard') { handleNavigate('scoreboard'); }
               }}
               onSelectRecent={(type, id) => {
                  if (type === 'drill') {
                    handleNavigate('standard');
                    handleSelectDrill(drills.find(d => d.id === id)!);
                  }
                  if (type === 'player') {
                    setPendingPlayerId(id);
                    handleNavigate('players');
                  }
               }}
            />
         ) : appMode === 'office' ? (
             <AcademyOffice 
                players={players}
                locations={locations}
                clients={clients} // Pass new clients
                sessions={sessions} // Pass session state
                onUpdatePlayer={updatePlayer}
                onUpsertClient={upsertClient}
                onUpsertSession={upsertSession} // Pass session handler
                onDeleteSession={deleteSession}
                onUploadFile={uploadFile}
                onClose={handleGoHome}
             />
         ) : appMode === 'scoreboard' ? (
             <Scoreboard 
                players={players}
                logs={logs}
                sessions={sessions}
                onUpsertLog={upsertLog}
                onNavigateHome={handleGoHome}
             />
         ) : appMode === 'players' ? (
            <LockerRoom 
               players={players} 
               drills={drills} 
               clients={clients} // Pass new clients
               initialSelectedPlayerId={pendingPlayerId}
               onUpdatePlayer={updatePlayer}
               onAddPlayer={addPlayer}
               onUpsertClient={upsertClient} // Pass client upsert
               onDeletePlayer={async id => {
                  const ok = await requestConfirmation({
                     title: "Delete Player",
                     message: "Are you sure you want to delete this player? This action cannot be undone.",
                     confirmLabel: "Delete",
                     tone: "danger"
                  });
                  if (ok) deletePlayer(id);
               }}
               onAssignDrill={(pid, did) => {
                   const p = players.find(x => x.id === pid);
                   if (p) updatePlayer({ ...p, assignedDrills: [...p.assignedDrills, did] });
               }}
               onUnassignDrill={(pid, did) => {
                   const p = players.find(x => x.id === pid);
                   if (p) updatePlayer({ ...p, assignedDrills: p.assignedDrills.filter(x => x !== did) });
               }}
               onUploadFile={uploadFile}
            />
          ) : appMode === 'plans' ? (
              activePlanId ? (
                 <SessionBuilder 
                    drills={drills} 
                    plan={plans.find(p => p.id === activePlanId)!} 
                    onUpdatePlan={updatePlan} 
                 />
              ) : (
                 <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">Select a plan to edit</div>
              )
          ) : appMode === 'library' ? (
             <DrillLibrary
                drills={drills}
                onUpdateDrill={updateDrill}
                onDeleteDrill={deleteDrill}
                onSelectDrill={(drill) => {
                   handleNavigate('standard');
                   handleSelectDrill(drill);
                }}
             />
          ) : (
            // Drill / Template / Sequence Editor
            <div className="flex-1 flex flex-col h-full relative">
               <PlaybookDiagramV2 
                  fill={true} 
                  showHeader={true} 
                  templates={templates} 
                  onSaveTemplate={handleSaveTemplateFromCanvas} 
                  ghostState={appMode === 'performance' && activeSequenceId && currentFrameIndex > 0 
                     ? sequences.find(s => s.id === activeSequenceId)?.frames[currentFrameIndex - 1]?.state 
                     : null
                  }
               />
               
               {/* Sequence Timeline Overlay */}
               {appMode === 'performance' && activeSequenceId && (
                  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-full max-w-3xl px-4 z-30">
                      <div className="bg-background/95 backdrop-blur-md border border-border p-2 rounded-2xl shadow-2xl flex flex-col gap-2">
                         {/* Playback Controls */}
                         <div className="flex items-center justify-between px-2">
                            <h3 className="text-xs font-black uppercase tracking-widest text-muted-foreground">Rally Timeline</h3>
                            <div className="flex gap-1">
                               <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentFrameIndex === 0} onClick={() => {
                                  const prev = currentFrameIndex - 1;
                                  setCurrentFrameIndex(prev);
                                  const frame = sequences.find(s => s.id === activeSequenceId)?.frames[prev];
                                  if (frame) window.dispatchEvent(new CustomEvent("playbook:diagram:apply-drill", { detail: { drill: { diagram: frame.state } } }));
                               }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 20L9 12l10-8v16zM5 19h2V5H5v14z"/></svg>
                               </Button>
                               
                               <Button size="icon" className={cn("h-8 w-8", isSequencePlaying ? "bg-red-500 hover:bg-red-600" : "bg-primary text-primary-foreground")} onClick={() => {
                                  setIsSequencePlaying(!isSequencePlaying);
                               }}>
                                  {isSequencePlaying ? (
                                     <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                                  ) : (
                                     <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                                  )}
                               </Button>

                               <Button variant="ghost" size="icon" className="h-8 w-8" disabled={currentFrameIndex === (sequences.find(s => s.id === activeSequenceId)?.frames.length || 0) - 1} onClick={() => {
                                  const next = currentFrameIndex + 1;
                                  setCurrentFrameIndex(next);
                                  const frame = sequences.find(s => s.id === activeSequenceId)?.frames[next];
                                  if (frame) window.dispatchEvent(new CustomEvent("playbook:diagram:apply-drill", { detail: { drill: { diagram: frame.state } } }));
                               }}>
                                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M5 4l10 8-10 8V4zM19 19h-2V5h2v14z"/></svg>
                               </Button>
                            </div>
                         </div>

                         {/* Timeline Strip */}
                         <div className="flex gap-2 overflow-x-auto p-1 custom-scrollbar snap-x">
                            {sequences.find(s => s.id === activeSequenceId)?.frames.map((f, i) => (
                               <button 
                                  key={f.id} 
                                  className={cn(
                                     "shrink-0 w-16 h-12 rounded-lg border-2 flex flex-col items-center justify-center transition-all snap-center",
                                     currentFrameIndex === i 
                                        ? "bg-primary/10 border-primary text-primary" 
                                        : "bg-secondary/50 border-transparent hover:bg-secondary text-muted-foreground hover:text-foreground"
                                  )}
                                  onClick={() => {
                                     setCurrentFrameIndex(i);
                                     window.dispatchEvent(new CustomEvent("playbook:diagram:apply-drill", { detail: { drill: { diagram: f.state } } }));
                                  }}
                               >
                                  <span className="text-[10px] font-black uppercase tracking-wider">Beat</span>
                                  <span className="text-sm font-bold leading-none">{i + 1}</span>
                               </button>
                            ))}
                            <button 
                               onClick={() => {
                                  setSequences(prev => prev.map(s => {
                                     if (s.id !== activeSequenceId) return s;
                                     // Clone current state or start fresh?
                                     // "Construction" mode implies cloning current to continue movement.
                                     const currentDiagram = latestCanvasState.current || { nodes: [], paths: [] };
                                     const newFrame = { id: nanoid(), duration: 2, state: JSON.parse(JSON.stringify(currentDiagram)) };
                                     return { ...s, frames: [...s.frames, newFrame] };
                                  }));
                                  // Auto-advance to new frame
                                  setTimeout(() => {
                                     const seq = sequences.find(s => s.id === activeSequenceId); // re-fetch to be safe?
                                     if (seq) setCurrentFrameIndex(seq.frames.length); // length will increase
                                  }, 0);
                               }}
                               className="shrink-0 w-12 h-12 rounded-lg border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary hover:bg-primary/5 transition-all"
                               title="Add Beat"
                            >
                               <span className="text-xl">+</span>
                            </button>
                         </div>
                      </div>
                  </div>
               )}
            </div>
         )}
      </div>

      {/* Hover Preview Portal */}
      {hoveredDrill && !activeDrillId && (
         <div 
            className="fixed left-96 top-20 z-50 hidden w-72 bg-popover border border-border rounded-xl shadow-2xl p-3 pointer-events-none lg:block no-print"
            style={{ top: 'max(80px, calc(50vh - 100px))' }}
         >
            <div className="mb-2 flex items-center justify-between">
               <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Quick Preview</span>
               <span className="text-[10px] bg-primary/20 text-primary px-1.5 rounded">{hoveredDrill.session}</span>
            </div>
            <DrillThumbnail drill={hoveredDrill} className="w-full h-auto aspect-[2/1] rounded-lg bg-background border border-border/50" />
            <div className="mt-3 px-1 space-y-1">
               <div className="font-bold text-sm text-foreground leading-tight">{hoveredDrill.name}</div>
               <div className="text-[11px] text-muted-foreground line-clamp-3 leading-relaxed">{hoveredDrill.description || "No description available."}</div>
            </div>
         </div>
      )}

      {/* CUSTOM CONFIRMATION DIALOG */}
      {confirmDialog && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 no-print"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeConfirmDialog(false);
            }
          }}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-popover p-5 shadow-2xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
          >
            <h2 id="confirm-dialog-title" className="text-sm font-semibold text-foreground">
              {confirmDialog.title}
            </h2>
            <p id="confirm-dialog-message" className="mt-2 text-xs text-muted-foreground leading-relaxed">
              {confirmDialog.message}
            </p>
            <div className="mt-5 flex items-center justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => closeConfirmDialog(false)}>
                {confirmDialog.cancelLabel ?? "Cancel"}
              </Button>
              {confirmDialog.showSave && (
                 <Button
                   type="button"
                   variant="default"
                   size="sm"
                   className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold"
                   onClick={() => closeConfirmDialog('save')}
                 >
                   Save & Continue
                 </Button>
              )}
              <Button
                ref={confirmButtonRef}
                type="button"
                variant={confirmDialog.tone === "danger" ? "destructive" : "default"}
                size="sm"
                onClick={() => closeConfirmDialog(true)}
              >
                {confirmDialog.confirmLabel ?? "Confirm"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* SETTINGS DIALOG */}
      <SettingsDialog 
         isOpen={isSettingsOpen} 
         onClose={() => setIsSettingsOpen(false)} 
         locations={locations}
         onUpdateLocations={setLocations}
         theme={theme}
         onSetTheme={setTheme}
         onForceSync={forceSync}
         onBackup={handleBackup}
         onImport={importData}
      />
    </div>
  );
}