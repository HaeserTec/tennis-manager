import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { 
  Drill, DrillTemplate, Sequence, SessionPlan, Player, Client, TrainingSession, 
  LocationConfig, SessionLog, Term, DayEvent 
} from './playbook';
import { nanoid, safeJsonParse, nowMs, getPathLength } from './utils';
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

// Helper to convert strings
const toSnakeCase = (str: string) => str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const toCamelCase = (str: string) => str.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

const transformData = (obj: any, transformer: (s: string) => string): any => {
    if (Array.isArray(obj)) return obj.map(v => transformData(v, transformer));
    if (obj !== null && typeof obj === 'object') {
        return Object.keys(obj).reduce((acc, key) => {
          const newKey = transformer(key);
          acc[newKey] = transformData(obj[key], transformer);
          return acc;
        }, {} as any);
    }
    return obj;
};

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
  dayEvents: DayEvent[];

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
  setDayEvents: React.Dispatch<React.SetStateAction<DayEvent[]>>;

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
  
  upsertDayEvent: (event: DayEvent) => void;
  deleteDayEvent: (id: string) => void;

  uploadFile: (bucket: string, file: File) => Promise<string | null>;
  forceSync: (direction?: 'auto' | 'upload' | 'download') => Promise<void>;
  importData: (data: any) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// --- Provider Component ---

export function DataProvider({ children }: { children: React.ReactNode }) {
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
      return (saved ?? []).map(p => ({
          ...p, 
          id: p.id ?? nanoid(), 
          name: p.name || "Unknown Player", 
          assignedDrills: p.assignedDrills || []
      }));
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
  const [dayEvents, setDayEvents] = useState<DayEvent[]>(() => {
      return safeJsonParse<DayEvent[]>(localStorage.getItem('tactics-lab-day-events'), []);
  });

  const stateRef = useRef({
      drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms, dayEvents
  });

  useEffect(() => {
      stateRef.current = { drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms, dayEvents };
  }, [drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms, dayEvents]);

  const hasSynced = useRef(false);
  const lastSyncTime = useRef(0);

  const forceSync = useCallback(async (direction: 'auto' | 'upload' | 'download' = 'auto') => {
    if (!isSupabaseEnabled) return;
    if (direction === 'auto' && Date.now() - lastSyncTime.current < 5000) return;
    lastSyncTime.current = Date.now();

    const localState = stateRef.current;

    const uploadTable = async (tableName: string, localData: any[]) => {
        if (!localData || localData.length === 0) return;
        const uniqueData = Array.from(new Map(localData.map(item => [item.id, item])).values());
        
        let sanitized: any[];
        if (tableName === 'locations') {
           sanitized = uniqueData.map(item => ({ id: item.id, name: item.name, color: item.sessionType, courts: [] }));
        } else {
           sanitized = uniqueData.map(item => {
              const transformed = transformData(JSON.parse(JSON.stringify(item)), toSnakeCase);
              delete transformed.user_id;
              // Clean up derived or missing properties that aren't in DB schema
              if (tableName === 'training_sessions') {
                 delete transformed.date_obj;
                 delete transformed.start_hour;
                 delete transformed.participants;
              }
              if (tableName === 'players') {
                 // Ensure we don't send anything that might clash or doesn't exist
                 delete transformed.age; // Usually derived from dob
              }
              return transformed;
           });
        }
        
        const { error: uploadError } = await supabase.from(tableName).upsert(sanitized, { onConflict: 'id' });
        if (uploadError) console.warn(`Upload failed (${tableName}):`, uploadError.message);
    };

    const syncTable = async (tableName: string, localData: any[], setter: React.Dispatch<React.SetStateAction<any[]>>) => {
        try {
            if (direction === 'upload') {
                await uploadTable(tableName, localData);
                return;
            }

            const { data: remoteData, error } = await supabase.from(tableName).select('*');
            if (error) {
                if (error.code !== 'PGRST116') console.warn(`Sync error (${tableName}):`, error.message);
                return;
            }

            if (direction === 'download') {
                if (remoteData && remoteData.length > 0) setter(transformData(remoteData, toCamelCase));
                return;
            }

            if (remoteData && remoteData.length > 0) {
                const transformedRemote = transformData(remoteData, toCamelCase);
                const remoteMap = new Map(transformedRemote.map((item: any) => [item.id, item]));
                const mergedMap = new Map(transformedRemote.map((item: any) => [item.id, item]));
                const toUpload: any[] = [];
                
                for (const localItem of (localData || [])) {
                    const remoteItem = remoteMap.get(localItem.id);
                    if (!remoteItem || (localItem.updatedAt || 0) > (remoteItem.updatedAt || 0)) {
                        toUpload.push(localItem);
                        mergedMap.set(localItem.id, localItem);
                    }
                }
                setter(Array.from(mergedMap.values()));
                if (toUpload.length > 0) await uploadTable(tableName, toUpload);
            } else if (localData && localData.length > 0) {
                await uploadTable(tableName, localData);
            }
        } catch (e: any) {
            console.error(`Sync failure for ${tableName}:`, e);
        }
    };

    try {
        await Promise.all([
            syncTable('clients', localState.clients, setClients), 
            syncTable('drills', localState.drills, setDrills),
            syncTable('drill_templates', localState.templates, setTemplates),
            syncTable('sequences', localState.sequences, setSequences),
            syncTable('session_plans', localState.plans, setPlans),
            syncTable('training_sessions', localState.sessions, setSessions),
            syncTable('locations', localState.locations, setLocations),
            syncTable('terms', localState.terms, setTerms),
            syncTable('day_events', localState.dayEvents, setDayEvents),
        ]);
        await syncTable('players', localState.players, setPlayers);
        await syncTable('session_logs', localState.logs, setLogs);
    } catch (err: any) {}
  }, []);

  useEffect(() => {
    if (!isSupabaseEnabled || hasSynced.current) return;
    hasSynced.current = true;
    forceSync('auto');
  }, [forceSync]);

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
  useEffect(() => { localStorage.setItem('tactics-lab-day-events', JSON.stringify(dayEvents)); }, [dayEvents]);

  const syncToSupabase = async (table: string, data: any, action: 'upsert' | 'delete') => {
    if (!isSupabaseEnabled) return;
    try {
      if (action === 'delete') {
        await supabase.from(table).delete().eq('id', data.id);
      } else {
        let payload = transformData(data, toSnakeCase);
        if (payload.user_id) delete payload.user_id;
        if (table === 'locations') {
           payload = { id: data.id, name: data.name, color: data.sessionType, courts: [] };
        }
        if (table === 'training_sessions') {
           delete payload.date_obj;
           delete payload.start_hour;
           delete payload.participants;
        }
        if (table === 'players') {
           delete payload.age;
        }
        const { error } = await supabase.from(table).upsert(payload);
        if (error && error.code !== 'PGRST116') console.warn(`Incremental sync failed (${table}):`, error.message);
      }
    } catch (err) {
      // Squelch
    }
  };

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

  const upsertDayEvent = useCallback((event: DayEvent) => {
     setDayEvents(prev => {
        const idx = prev.findIndex(e => e.id === event.id);
        const now = Date.now();
        const updatedEvent = {
           ...event,
           createdAt: event.createdAt || now,
           updatedAt: now
        };
        if (idx >= 0) {
           const next = [...prev];
           next[idx] = updatedEvent;
           return next;
        }
        return [...prev, updatedEvent];
     });
     syncToSupabase('day_events', { ...event, updatedAt: Date.now() }, 'upsert');
  }, []);

  const deleteDayEvent = useCallback((id: string) => {
     setDayEvents(prev => prev.filter(e => e.id !== id));
     syncToSupabase('day_events', { id }, 'delete');
  }, []);

  const uploadFile = useCallback(async (bucket: string, file: File): Promise<string | null> => {
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
      return new Promise((resolve) => {
         const reader = new FileReader();
         reader.onloadend = () => resolve(reader.result as string);
         reader.readAsDataURL(file);
      });
    }
  }, []);

  const importData = useCallback((data: any) => {
    if (!data) return;
    if (data.drills) setDrills(data.drills);
    if (data.templates) setTemplates(data.templates);
    if (data.sequences) setSequences(data.sequences);
    if (data.plans) setPlans(data.plans);
    if (data.players) setPlayers(data.players);
    if (data.clients) setClients(data.clients);
    if (data.sessions) setSessions(data.sessions);
    if (data.locations) setLocations(data.locations);
    if (data.logs) setLogs(data.logs);
    if (data.terms) setTerms(data.terms);
    if (data.dayEvents) setDayEvents(data.dayEvents);
    setTimeout(() => { forceSync('upload'); }, 1000);
  }, [forceSync]);

  return (
    <DataContext.Provider value={{
      drills, setDrills, templates, setTemplates, sequences, setSequences, plans, setPlans,
      players, setPlayers, clients, setClients, sessions, setSessions, locations, setLocations,
      logs, setLogs, terms, setTerms, dayEvents, setDayEvents,
      addDrill, updateDrill, deleteDrill, addTemplate, updateTemplate, deleteTemplate,
      addSequence, updateSequence, deleteSequence, addPlan, updatePlan, deletePlan,
      addPlayer, updatePlayer, deletePlayer, upsertClient, upsertSession, deleteSession, upsertLog, 
      upsertDayEvent, deleteDayEvent, uploadFile, forceSync, importData
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const context = useContext(DataContext);
  if (context === undefined) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
}
