import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  Drill, DrillTemplate, Sequence, SessionPlan, Player, Client, TrainingSession,
  LocationConfig, SessionLog, Term, DayEvent, Expense, DEFAULT_DRILLS
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
  expenses: Expense[];

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
  setExpenses: React.Dispatch<React.SetStateAction<Expense[]>>;

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
  deleteClient: (clientId: string) => void;
  mergeClients: (sourceId: string, targetId: string) => void;
  upsertSession: (session: TrainingSession) => void;
  deleteSession: (id: string) => void;
  upsertLog: (log: SessionLog) => void;
  
  upsertDayEvent: (event: DayEvent) => void;
  deleteDayEvent: (id: string) => void;

  upsertExpense: (expense: Expense) => void;
  deleteExpense: (id: string) => void;

  uploadFile: (bucket: string, file: File) => Promise<string | null>;
  forceSync: (direction?: 'auto' | 'upload' | 'download') => Promise<void>;
  importData: (data: any) => void;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

// --- Provider Component ---

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [drills, setDrills] = useState<Drill[]>(() => {
    const saved = safeJsonParse<Drill[]>(localStorage.getItem('tactics-lab-drills'), []);
    const normalized = (saved ?? []).map(normalizeDrill);
    
    // Merge defaults: Only add defaults that don't already exist in the saved list (by ID)
    const existingIds = new Set(normalized.map(d => d.id));
    const missingDefaults = DEFAULT_DRILLS.filter(d => !existingIds.has(d.id)).map(normalizeDrill);
    
    return [...normalized, ...missingDefaults];
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
  const [expenses, setExpenses] = useState<Expense[]>(() => {
      return safeJsonParse<Expense[]>(localStorage.getItem('tactics-lab-expenses'), []);
  });

  const stateRef = useRef({
      drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms, dayEvents, expenses
  });

  useEffect(() => {
      stateRef.current = { drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms, dayEvents, expenses };
  }, [drills, templates, sequences, plans, players, clients, sessions, locations, logs, terms, dayEvents, expenses]);

  const hasSynced = useRef(false);
  const lastSyncTime = useRef(0);

  const isImporting = useRef(false);

  const forceSync = useCallback(async (direction: 'auto' | 'upload' | 'download' = 'auto') => {
    if (!isSupabaseEnabled || isImporting.current) return;
    
    // Check for active session before syncing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (direction === 'auto' && Date.now() - lastSyncTime.current < 5000) return;
    lastSyncTime.current = Date.now();

    const localState = stateRef.current;

    const uploadTable = async (tableName: string, localData: any[]) => {
        if (!localData || localData.length === 0) return;
        const uniqueData = Array.from(new Map(localData.map(item => [item.id, item])).values());
        
        // SERVER TRUTH: Fetch valid client IDs from server if uploading players.
        // We do NOT trust local state for Foreign Keys during upload.
        let validClientIds: Set<string> = new Set();
        if (tableName === 'players') {
            const { data, error } = await supabase.from('clients').select('id');
            if (data) {
                data.forEach(c => validClientIds.add(c.id));
            } else if (error) {
                console.warn("Failed to fetch clients for FK validation, defaulting to stripping IDs:", error);
            }
        }

        const sanitized = uniqueData.map(item => {
            if (tableName === 'locations') {
                return {
                    id: item.id,
                    name: item.name,
                    color: item.sessionType || item.color,
                    courts: item.courts || [],
                    updated_at: item.updatedAt || Date.now(),
                    created_at: item.createdAt || Date.now()
                };
            }

            // ONLY transform top-level keys for DB columns. 
            const transformed: any = {};
            Object.keys(item).forEach(key => {
                const dbKey = toSnakeCase(key);
                transformed[dbKey] = item[key];
            });

            delete transformed.user_id;
            
            // Clean up derived or missing properties
            if (tableName === 'training_sessions') {
                delete transformed.date_obj;
                delete transformed.start_hour;
                delete transformed.participants;
                delete transformed.start_key;
            }
            if (tableName === 'players') {
                delete transformed.age;
                
                // STRICT DEFENSE: If client_id is not in our server-verified set, KILL IT.
                // This prevents 409 errors even if the local state thinks it's valid.
                if (transformed.client_id) {
                   if (!validClientIds.has(transformed.client_id)) {
                      // console.warn(`Sanitizing upload: Player ${transformed.name} has un-synced parent ${transformed.client_id}. Unlinking.`);
                      transformed.client_id = null;
                   }
                }
            }
            return transformed;
        });
        // Process uploads sequentially to isolate failures and provide better error handling
        for (const item of sanitized) {
            const { error: uploadError } = await supabase.from(tableName).upsert(item, { onConflict: 'id' });
            if (uploadError) {
                console.warn(`Upload failed for item ${item.id} in ${tableName}:`, uploadError.message);
                // If 409 (FK violation) happens on a player, retry without the client_id as a fallback
                if (tableName === 'players' && uploadError.code === '23503') {
                    console.warn(`Retry upload for player ${item.id} without client link.`);
                    const fallbackItem = { ...item, client_id: null };
                    await supabase.from(tableName).upsert(fallbackItem, { onConflict: 'id' });
                }
            }
        }
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
                if (remoteData && remoteData.length > 0) {
                    const transformedRemote = remoteData.map(item => {
                        const camelItem: any = {};
                        Object.keys(item).forEach(key => {
                            camelItem[toCamelCase(key)] = item[key];
                        });
                        return camelItem;
                    });
                    setter(transformedRemote);
                }
                return;
            }

            if (remoteData && remoteData.length > 0) {
                const transformedRemote = remoteData.map(item => {
                    const camelItem: any = {};
                    Object.keys(item).forEach(key => {
                        camelItem[toCamelCase(key)] = item[key];
                    });
                    return camelItem;
                });

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
                if (toUpload.length > 0) {
                    await uploadTable(tableName, toUpload);
                }
            } else if (localData && localData.length > 0) {
                await uploadTable(tableName, localData);
            }
        } catch (e: any) {
            console.error(`Sync failure for ${tableName}:`, e);
        }
    };

    try {
        // Step 1: Sync Clients FIRST (Parent records must exist before Players)
        await syncTable('clients', localState.clients, setClients);

        // Step 2: Sync Players (References Clients)
        await syncTable('players', localState.players, setPlayers);

        // Step 3: Sync everything else in parallel
        await Promise.all([
            syncTable('drills', localState.drills, setDrills),
            syncTable('drill_templates', localState.templates, setTemplates),
            syncTable('sequences', localState.sequences, setSequences),
            syncTable('session_plans', localState.plans, setPlans),
            syncTable('training_sessions', localState.sessions, setSessions),
            syncTable('locations', localState.locations, setLocations),
            syncTable('terms', localState.terms, setTerms),
            syncTable('day_events', localState.dayEvents, setDayEvents),
            syncTable('session_logs', localState.logs, setLogs),
            syncTable('expenses', localState.expenses, setExpenses)
        ]);
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
  useEffect(() => { localStorage.setItem('tactics-lab-expenses', JSON.stringify(expenses)); }, [expenses]);

  const syncToSupabase = async (table: string, data: any, action: 'upsert' | 'delete') => {
    if (!isSupabaseEnabled || isImporting.current) return;
    
    // Check for active session before syncing
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      if (action === 'delete') {
        await supabase.from(table).delete().eq('id', data.id);
      } else {
        let payload = transformData(data, toSnakeCase);
        if (payload.user_id) delete payload.user_id;
        if (table === 'locations') {
           payload = { 
               id: data.id, 
               name: data.name, 
               color: data.sessionType || data.color, 
               courts: data.courts || [],
               updated_at: data.updatedAt || Date.now(),
               created_at: data.createdAt || Date.now()
           };
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

  const deleteClient = useCallback((clientId: string) => {
    setClients(prev => prev.filter(c => c.id !== clientId));
    syncToSupabase('clients', { id: clientId }, 'delete');
  }, []);

  const mergeClients = useCallback((sourceId: string, targetId: string) => {
    const source = clients.find(c => c.id === sourceId);
    const target = clients.find(c => c.id === targetId);
    if (!source || !target) return;

    // Create merged client - prefer most recent non-empty values
    const merged: Client = {
      ...target,
      email: (source.updatedAt > target.updatedAt && source.email) ? source.email : (target.email || source.email),
      phone: (source.updatedAt > target.updatedAt && source.phone) ? source.phone : (target.phone || source.phone),
      notes: [target.notes, source.notes].filter(Boolean).join('\n---\n') || undefined,
      payments: [...(target.payments || []), ...(source.payments || [])],
      status: target.status === 'Active' || source.status === 'Active' ? 'Active' : target.status,
      updatedAt: Date.now()
    };

    // Update all players from source to target
    setPlayers(prev => prev.map(p =>
      p.clientId === sourceId ? { ...p, clientId: targetId, updatedAt: Date.now() } : p
    ));

    // Upsert merged client
    setClients(prev => {
      const withoutSource = prev.filter(c => c.id !== sourceId);
      const idx = withoutSource.findIndex(c => c.id === targetId);
      if (idx >= 0) {
        const next = [...withoutSource];
        next[idx] = merged;
        return next;
      }
      return withoutSource;
    });

    syncToSupabase('clients', merged, 'upsert');
    syncToSupabase('clients', { id: sourceId }, 'delete');
  }, [clients]);

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

  const upsertExpense = useCallback((expense: Expense) => {
     setExpenses(prev => {
        const idx = prev.findIndex(e => e.id === expense.id);
        const now = Date.now();
        const updated = { ...expense, createdAt: expense.createdAt || now, updatedAt: now };
        if (idx >= 0) {
           const next = [...prev];
           next[idx] = updated;
           return next;
        }
        return [...prev, updated];
     });
     syncToSupabase('expenses', { ...expense, updatedAt: Date.now() }, 'upsert');
  }, []);

  const deleteExpense = useCallback((id: string) => {
     setExpenses(prev => prev.filter(e => e.id !== id));
     syncToSupabase('expenses', { id }, 'delete');
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
    const stamp = nowMs();
    isImporting.current = true;
    
    // Support legacy/alternate keys (e.g. sessionPlans -> plans)
    const rawPlans = data.plans || data.sessionPlans || data.session_plans || [];
    const rawTemplates = data.templates || data.drillTemplates || data.drill_templates || [];
    const rawSessions = data.sessions || data.trainingSessions || data.training_sessions || [];
    const rawEvents = data.dayEvents || data.day_events || [];
    const rawLogs = data.logs || data.sessionLogs || data.session_logs || [];
    const rawExpenses = data.expenses || [];

    // Prepare fresh datasets
    const nextDrills = (data.drills || []).map((d: any) => ({ ...normalizeDrill(d), updatedAt: stamp }));
    const nextTemplates = rawTemplates.map((t: any) => ({ ...normalizeTemplate(t), updatedAt: stamp }));
    const nextSequences = (data.sequences || []).map((s: any) => ({ ...s, id: s.id ?? nanoid(), updatedAt: stamp }));
    const nextPlans = rawPlans.map((p: any) => ({ ...p, id: p.id ?? nanoid(), updatedAt: stamp }));
    const nextPlayers = (data.players || []).map((p: any) => ({ ...p, id: p.id ?? nanoid(), updatedAt: stamp }));
    const nextClients = (data.clients || []).map((c: any) => ({ ...c, updatedAt: stamp }));
    const nextSessions = rawSessions.map((s: any) => ({ ...s, updatedAt: stamp }));
    const nextLocations = (data.locations || []).map((l: any) => ({ ...l, updatedAt: stamp }));
    const nextLogs = rawLogs.map((l: any) => ({ ...l, updatedAt: stamp }));
    const nextTerms = (data.terms || []).map((t: any) => ({ ...t, updatedAt: stamp }));
    const nextDayEvents = rawEvents.map((e: any) => ({ ...e, updatedAt: stamp }));
    const nextExpenses = rawExpenses.map((e: any) => ({ ...e, updatedAt: stamp }));

    // SANITIZATION: Remove dangling client references from players
    const clientIds = new Set(nextClients.map((c: any) => c.id));
    nextPlayers.forEach((p: any) => {
        if (p.clientId && !clientIds.has(p.clientId)) {
            console.warn(`Sanitizing imported player ${p.name}: removing dangling clientId ${p.clientId}`);
            p.clientId = null;
        }
    });

    // Update React State
    if (data.drills) setDrills(nextDrills);
    setTemplates(nextTemplates);
    setSequences(nextSequences);
    setPlans(nextPlans);
    setPlayers(nextPlayers);
    setClients(nextClients);
    setSessions(nextSessions);
    setLocations(nextLocations);
    setLogs(nextLogs);
    setTerms(nextTerms);
    setDayEvents(nextDayEvents);
    setExpenses(nextExpenses);

    // Update Cache
    stateRef.current = {
        drills: nextDrills,
        templates: nextTemplates,
        sequences: nextSequences,
        plans: nextPlans,
        players: nextPlayers,
        clients: nextClients,
        sessions: nextSessions,
        locations: nextLocations,
        logs: nextLogs,
        terms: nextTerms,
        dayEvents: nextDayEvents,
        expenses: nextExpenses
    };

    // Force an immediate upload
    setTimeout(async () => { 
        await forceSync('upload'); 
        isImporting.current = false;
    }, 200);
  }, [forceSync]);

  return (
    <DataContext.Provider value={{
      drills, setDrills, templates, setTemplates, sequences, setSequences, plans, setPlans,
      players, setPlayers, clients, setClients, sessions, setSessions, locations, setLocations,
      logs, setLogs, terms, setTerms, dayEvents, setDayEvents, expenses, setExpenses,
      addDrill, updateDrill, deleteDrill, addTemplate, updateTemplate, deleteTemplate,
      addSequence, updateSequence, deleteSequence, addPlan, updatePlan, deletePlan,
      addPlayer, updatePlayer, deletePlayer, upsertClient, deleteClient, mergeClients, upsertSession, deleteSession, upsertLog,
      upsertDayEvent, deleteDayEvent, upsertExpense, deleteExpense, uploadFile, forceSync, importData
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
