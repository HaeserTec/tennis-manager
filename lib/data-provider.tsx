import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { 
  Drill, DrillTemplate, Sequence, SessionPlan, Player, Client, TrainingSession, 
  LocationConfig, SessionLog, Term 
} from './playbook';
import { nanoid, safeJsonParse, nowMs } from './utils';
import { supabase } from './supabase';

// Check if Supabase is configured
const isSupabaseEnabled = Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);

// --- Default Data / Constants ---

const PRESET_TEMPLATES: DrillTemplate[] = [
  {
    id: 'tpl_singles',
    name: 'Singles Court',
    description: 'Standard setup',
    diagram: { nodes: [], paths: [] }
  },
  {
    id: 'tpl_doubles',
    name: 'Doubles Setup',
    description: '4 players at net',
    diagram: { nodes: [], paths: [] }
  }
];

// --- Helper Functions ---

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

// --- Context Types ---

interface DataContextType {
  // State
  drills: Drill[];
  templates: DrillTemplate[];
  sequences: Sequence[];
  plans: SessionPlan[];
  players: Player[];
  clients: Client[];
  sessions: TrainingSession[];
  locations: LocationConfig[];
  logs: SessionLog[];
  terms: Term[];

  // Actions
  setDrills: React.Dispatch<React.SetStateAction<Drill[]>>;
  setTemplates: React.Dispatch<React.SetStateAction<DrillTemplate[]>>;
  setSequences: React.Dispatch<React.SetStateAction<Sequence[]>>;
  setPlans: React.Dispatch<React.SetStateAction<SessionPlan[]>>;
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
  setClients: React.Dispatch<React.SetStateAction<Client[]>>;
  setSessions: React.Dispatch<React.SetStateAction<TrainingSession[]>>;
  setLocations: React.Dispatch<React.SetStateAction<LocationConfig[]>>;
  setLogs: React.Dispatch<React.SetStateAction<SessionLog[]>>;
  setTerms: React.Dispatch<React.SetStateAction<Term[]>>;

  // High-Level Actions
  addDrill: (drill: Drill) => void;
  updateDrill: (drill: Drill) => void;
  deleteDrill: (id: string) => void;
  
  addTemplate: (template: DrillTemplate) => void;
  updateTemplate: (template: DrillTemplate) => void;
  deleteTemplate: (id: string) => void;

  addSequence: (sequence: Sequence) => void;
  updateSequence: (sequence: Sequence) => void;
  deleteSequence: (id: string) => void;

  addPlan: (plan: SessionPlan) => void;
  updatePlan: (plan: SessionPlan) => void;
  deletePlan: (id: string) => void;

  addPlayer: (player: Player) => void;
  updatePlayer: (player: Player) => void;
  deletePlayer: (id: string) => void;

  upsertClient: (client: Client) => void;
  upsertSession: (session: TrainingSession) => void;
  deleteSession: (id: string) => void;
  upsertLog: (log: SessionLog) => void;
  uploadFile: (bucket: string, file: File) => Promise<string | null>;
  forceSync: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// --- Provider Component ---

export function DataProvider({ children }: { children: React.ReactNode }) {
  // 1. Initialize State from LocalStorage (Optimistic Default)
  // We use refs to hold the initial local state to compare against DB later
  const [drills, setDrills] = useState<Drill[]>(() => {
    const saved = safeJsonParse<Drill[]>(localStorage.getItem('tactics-lab-drills'), []);
    return (saved ?? []).map(normalizeDrill);
  });
  const [templates, setTemplates] = useState<DrillTemplate[]>(() => {
      const saved = safeJsonParse<DrillTemplate[]>(localStorage.getItem('tactics-lab-templates'), PRESET_TEMPLATES);
      return (saved ?? PRESET_TEMPLATES).map(normalizeTemplate);
  });
  const [sequences, setSequences] = useState<Sequence[]>(() => {
      const saved = safeJsonParse<Sequence[]>(localStorage.getItem('tactics-lab-sequences'), []);
      return (saved ?? []).map(s => ({...s, id: s.id ?? nanoid(), frames: s.frames || []}));
  });
  const [plans, setPlans] = useState<SessionPlan[]>(() => {
      const saved = safeJsonParse<SessionPlan[]>(localStorage.getItem('tactics-lab-plans'), []);
      return (saved ?? []).map(p => ({...p, id: p.id ?? nanoid(), items: p.items || []}));
  });
  const [players, setPlayers] = useState<Player[]>(() => {
      const saved = safeJsonParse<Player[]>(localStorage.getItem('tactics-lab-players'), []);
      return (saved ?? []).map(p => ({...p, id: p.id ?? nanoid(), assignedDrills: p.assignedDrills || []}));
  });
  const [clients, setClients] = useState<Client[]>(() => {
      const saved = safeJsonParse<Client[]>(localStorage.getItem('tactics-lab-clients'), []);
      return saved ?? [];
  });
  const [sessions, setSessions] = useState<TrainingSession[]>(() => {
      const saved = safeJsonParse<TrainingSession[]>(localStorage.getItem('tactics-lab-sessions'), []);
      return saved ?? [];
  });
  const [locations, setLocations] = useState<LocationConfig[]>(() => {
      return safeJsonParse<LocationConfig[]>(localStorage.getItem('tactics-lab-locations'), []);
  });
  const [logs, setLogs] = useState<SessionLog[]>(() => {
      return safeJsonParse<SessionLog[]>(localStorage.getItem('tactics-lab-logs'), []);
  });
  const [terms, setTerms] = useState<Term[]>(() => {
      return safeJsonParse<Term[]>(localStorage.getItem('tactics-lab-terms'), []);
  });

  // Ref to hold latest state for sync (avoids infinite dependency loop)
  const stateRef = useRef({
      drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms
  });

  useEffect(() => {
      stateRef.current = { drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms };
  }, [drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms]);

  // Track sync state
  const hasSynced = useRef(false);
  const lastSyncTime = useRef(0);

  // Sync Logic
  const forceSync = useCallback(async () => {
    if (!isSupabaseEnabled) return;
    
    // Throttle: Prevent multiple syncs within 5 seconds
    if (Date.now() - lastSyncTime.current < 5000) return;
    lastSyncTime.current = Date.now();

    // Use ref state to avoid stale closures without triggering re-renders
    const localState = stateRef.current;

    const syncTable = async (tableName: string, localData: any[], setter: React.Dispatch<React.SetStateAction<any[]>>) => {
        try {
            const { data: remoteData, error } = await supabase.from(tableName).select('*');
            
            if (error) {
                // Silent error unless critical
                if (error.code !== 'PGRST116') console.warn(`Sync error (${tableName}):`, error.message);
                return;
            }

            if (remoteData && remoteData.length > 0) {
                // Case A: Cloud has data -> Cloud wins (Download)
                setter(remoteData);
            } else if (localData.length > 0) {
                // Case B: Cloud is empty BUT Local has data -> Seed Cloud (Upload)
                // Deduplicate: Ensure no duplicate IDs in payload
                const uniqueData = Array.from(new Map(localData.map(item => [item.id, item])).values());
                const sanitized = uniqueData.map(item => JSON.parse(JSON.stringify(item)));
                
                const { error: uploadError } = await supabase.from(tableName).upsert(sanitized, { onConflict: 'id' });
                if (uploadError) {
                    console.warn(`Seed failed (${tableName}):`, uploadError.message);
                }
            }
        } catch (e: any) {
            // Squelch unless critical
        }
    };

    try {
        // Step 1: Upload independent tables
        await Promise.all([
            syncTable('clients', localState.clients, setClients), 
            syncTable('drills', localState.drills, setDrills),
            syncTable('drill_templates', localState.templates, setTemplates),
            syncTable('sequences', localState.sequences, setSequences),
            syncTable('session_plans', localState.plans, setPlans),
            syncTable('training_sessions', localState.sessions, setSessions),
            syncTable('locations', localState.locations, setLocations),
            syncTable('terms', localState.terms, setTerms),
        ]);

        // Step 2: Upload players (depends on clients)
        await syncTable('players', localState.players, setPlayers);

        // Step 3: Upload logs (depends on players)
        await syncTable('session_logs', localState.logs, setLogs);

    } catch (err: any) {
        // Silent catch
    }
  }, []); // Empty dependency array = Stable function!

  // 2. Supabase Sync on Mount
  useEffect(() => {
    if (!isSupabaseEnabled || hasSynced.current) return;
    hasSynced.current = true;
    forceSync();
  }, [forceSync]);

  // 3. Persistence Effects (LocalStorage - Always Backup)
  useEffect(() => { localStorage.setItem('tactics-lab-drills', JSON.stringify(drills)); }, [drills]);
  useEffect(() => { localStorage.setItem('tactics-lab-templates', JSON.stringify(templates)); }, [templates]);
  useEffect(() => { localStorage.setItem('tactics-lab-sequences', JSON.stringify(sequences)); }, [sequences]);
  useEffect(() => { localStorage.setItem('tactics-lab-plans', JSON.stringify(plans)); }, [plans]);
  useEffect(() => { localStorage.setItem('tactics-lab-players', JSON.stringify(players)); }, [players]);
  useEffect(() => { 
     try { localStorage.setItem('tactics-lab-clients', JSON.stringify(clients)); } 
     catch (e) { console.error("Storage Full"); }
  }, [clients]);
  useEffect(() => { localStorage.setItem('tactics-lab-sessions', JSON.stringify(sessions)); }, [sessions]);
  useEffect(() => { localStorage.setItem('tactics-lab-locations', JSON.stringify(locations)); }, [locations]);
  useEffect(() => { localStorage.setItem('tactics-lab-logs', JSON.stringify(logs)); }, [logs]);
  useEffect(() => { localStorage.setItem('tactics-lab-terms', JSON.stringify(terms)); }, [terms]);

  // 4. Helper to Sync to Supabase
  const syncToSupabase = async (table: string, data: any, action: 'upsert' | 'delete') => {
    if (!isSupabaseEnabled) return;
    try {
      if (action === 'delete') {
        await supabase.from(table).delete().eq('id', data.id);
      } else {
        // Remove undefined fields to avoid issues, or trust standard normalization
        await supabase.from(table).upsert(data);
      }
    } catch (err) {
      console.error(`Failed to sync ${table}:`, err);
    }
  };

  // 5. Actions with Dual-Write
  const addDrill = useCallback((drill: Drill) => {
    setDrills(prev => [drill, ...prev]);
    syncToSupabase('drills', drill, 'upsert');
  }, []);
  const updateDrill = useCallback((drill: Drill) => {
    setDrills(prev => prev.map(d => d.id === drill.id ? drill : d));
    syncToSupabase('drills', drill, 'upsert');
  }, []);
  const deleteDrill = useCallback((id: string) => {
    setDrills(prev => prev.filter(d => d.id !== id));
    syncToSupabase('drills', { id }, 'delete');
  }, []);

  const addTemplate = useCallback((t: DrillTemplate) => {
    setTemplates(prev => [t, ...prev]);
    syncToSupabase('drill_templates', t, 'upsert');
  }, []);
  const updateTemplate = useCallback((t: DrillTemplate) => {
    setTemplates(prev => prev.map(prevT => prevT.id === t.id ? t : prevT));
    syncToSupabase('drill_templates', t, 'upsert');
  }, []);
  const deleteTemplate = useCallback((id: string) => {
    setTemplates(prev => prev.filter(t => t.id !== id));
    syncToSupabase('drill_templates', { id }, 'delete');
  }, []);

  const addSequence = useCallback((s: Sequence) => {
    setSequences(prev => [s, ...prev]);
    syncToSupabase('sequences', s, 'upsert');
  }, []);
  const updateSequence = useCallback((s: Sequence) => {
    setSequences(prev => prev.map(prevS => prevS.id === s.id ? s : prevS));
    syncToSupabase('sequences', s, 'upsert');
  }, []);
  const deleteSequence = useCallback((id: string) => {
    setSequences(prev => prev.filter(s => s.id !== id));
    syncToSupabase('sequences', { id }, 'delete');
  }, []);

  const addPlan = useCallback((p: SessionPlan) => {
    setPlans(prev => [p, ...prev]);
    syncToSupabase('session_plans', p, 'upsert');
  }, []);
  const updatePlan = useCallback((p: SessionPlan) => {
    setPlans(prev => prev.map(prevP => prevP.id === p.id ? p : prevP));
    syncToSupabase('session_plans', p, 'upsert');
  }, []);
  const deletePlan = useCallback((id: string) => {
    setPlans(prev => prev.filter(p => p.id !== id));
    syncToSupabase('session_plans', { id }, 'delete');
  }, []);

  const addPlayer = useCallback((p: Player) => {
    setPlayers(prev => [p, ...prev]);
    syncToSupabase('players', p, 'upsert');
  }, []);
  const updatePlayer = useCallback((p: Player) => {
    setPlayers(prev => prev.map(prevP => prevP.id === p.id ? p : prevP));
    syncToSupabase('players', p, 'upsert');
  }, []);
  const deletePlayer = useCallback((id: string) => {
    setPlayers(prev => prev.filter(p => p.id !== id));
    syncToSupabase('players', { id }, 'delete');
  }, []);

  const upsertClient = useCallback((client: Client) => {
     setClients(prev => {
        const idx = prev.findIndex(c => c.id === client.id);
        if (idx >= 0) {
           const next = [...prev];
           next[idx] = client;
           return next;
        }
        return [client, ...prev];
     });
     syncToSupabase('clients', client, 'upsert');
  }, []);

  const upsertSession = useCallback((session: TrainingSession) => {
     setSessions(prev => {
        const idx = prev.findIndex(s => s.id === session.id);
        if (idx >= 0) {
           const next = [...prev];
           next[idx] = session;
           return next;
        }
        return [...prev, session];
     });
     syncToSupabase('training_sessions', session, 'upsert');
  }, []);

  const deleteSession = useCallback((id: string) => {
     setSessions(prev => prev.filter(s => s.id !== id));
     syncToSupabase('training_sessions', { id }, 'delete');
  }, []);

  const upsertLog = useCallback((log: SessionLog) => {
     setLogs(prev => {
        const idx = prev.findIndex(l => l.id === log.id);
        if (idx >= 0) {
           const next = [...prev];
           next[idx] = log;
           return next;
        }
        return [...prev, log];
     });
     syncToSupabase('session_logs', log, 'upsert');
  }, []);

  const uploadFile = useCallback(async (bucket: string, file: File): Promise<string | null> => {
    // If offline or not configured, fallback to Base64 (Legacy behavior)
    if (!isSupabaseEnabled) {
       return new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.readAsDataURL(file);
       });
    }
    
    try {
      const ext = file.name.split('.').pop();
      const path = `${Date.now()}-${Math.random().toString(36).slice(2,8)}.${ext}`;
      
      const { error } = await supabase.storage.from(bucket).upload(path, file);
      if (error) throw error;
      
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      console.error('Upload failed, falling back to local:', err);
      // Fallback on error
      return new Promise((resolve) => {
         const reader = new FileReader();
         reader.onloadend = () => resolve(reader.result as string);
         reader.readAsDataURL(file);
      });
    }
  }, []);

  // Ref to hold latest state for sync (avoids infinite dependency loop)

  return (
    <DataContext.Provider value={{
      drills, setDrills,
      templates, setTemplates,
      sequences, setSequences,
      plans, setPlans,
      players, setPlayers,
      clients, setClients,
      sessions, setSessions,
      locations, setLocations,
      logs, setLogs,
      terms, setTerms,

      addDrill, updateDrill, deleteDrill,
      addTemplate, updateTemplate, deleteTemplate,
      addSequence, updateSequence, deleteSequence,
      addPlan, updatePlan, deletePlan,
      addPlayer, updatePlayer, deletePlayer,
      upsertClient, upsertSession, deleteSession, upsertLog, uploadFile,
      forceSync
    }}>
      {children}
    </DataContext.Provider>
  );
}

// --- Hook ---

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}