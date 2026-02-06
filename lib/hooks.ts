import { useState, useEffect, useMemo, useCallback } from 'react';
import { Player, SessionLog, Drill, DrillCategory, DrillTag, DrillCollection, ProgressGoal, STORAGE_KEYS, DEFAULT_DRILL_CATEGORIES, Client, TrainingSession } from './playbook';
import { getPlayerProgressHistory, calculateMetricTrend, getSessionComparison, getGoalProgress } from './analytics';

// ============================================
// PROGRESS TRACKING HOOKS
// ============================================

export function useProgress(playerId: string | null, logs: SessionLog[]) {
  const history = useMemo(() => {
    if (!playerId) return [];
    return getPlayerProgressHistory(playerId, logs);
  }, [playerId, logs]);

  const trends = useMemo(() => {
    if (!playerId || logs.length === 0) return null;
    const playerLogs = logs.filter(l => l.playerId === playerId);
    return {
      tech: calculateMetricTrend(playerLogs, 'tech'),
      consistency: calculateMetricTrend(playerLogs, 'consistency'),
      tactics: calculateMetricTrend(playerLogs, 'tactics'),
      movement: calculateMetricTrend(playerLogs, 'movement'),
      coachability: calculateMetricTrend(playerLogs, 'coachability'),
    };
  }, [playerId, logs]);

  const latestSession = useMemo(() => {
    if (!playerId || logs.length === 0) return null;
    return logs
      .filter(l => l.playerId === playerId)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0] || null;
  }, [playerId, logs]);

  return { history, trends, latestSession };
}

export function usePlayerGoals(player: Player | null) {
  const [goals, setGoals] = useState<ProgressGoal[]>(() => {
    if (!player) return [];
    const saved = localStorage.getItem(`${STORAGE_KEYS.PLAYER_GOALS}_${player.id}`);
    return saved ? JSON.parse(saved) : (player.progressGoals || []);
  });

  useEffect(() => {
    if (!player) return;
    const key = `${STORAGE_KEYS.PLAYER_GOALS}_${player.id}`;
    localStorage.setItem(key, JSON.stringify(goals));
  }, [goals, player]);

  const addGoal = useCallback((goal: Omit<ProgressGoal, 'id' | 'createdAt'>) => {
    const newGoal: ProgressGoal = {
      ...goal,
      id: Math.random().toString(36).substring(2, 15),
      createdAt: Date.now(),
    };
    setGoals(prev => [...prev, newGoal]);
    return newGoal;
  }, []);

  const updateGoal = useCallback((id: string, updates: Partial<ProgressGoal>) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setGoals(prev => prev.filter(g => g.id !== id));
  }, []);

  const completeGoal = useCallback((id: string) => {
    setGoals(prev => prev.map(g => g.id === id ? { ...g, completedAt: Date.now() } : g));
  }, []);

  return { goals, addGoal, updateGoal, deleteGoal, completeGoal };
}

export function useGoalProgress(player: Player | null, goals: ProgressGoal[], currentScores: { tech: number; consistency: number; tactics: number; movement: number; coachability: number } | null) {
  return useMemo(() => {
    if (!player || !currentScores) return [];
    return getGoalProgress(player, goals, currentScores);
  }, [player, goals, currentScores]);
}

// ============================================
// DRILL LIBRARY HOOKS
// ============================================

export function useDrillCategories() {
  const [categories, setCategories] = useState<DrillCategory[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DRILL_CATEGORIES);
    return saved ? JSON.parse(saved) : DEFAULT_DRILL_CATEGORIES;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DRILL_CATEGORIES, JSON.stringify(categories));
  }, [categories]);

  const addCategory = useCallback((category: Omit<DrillCategory, 'id'>) => {
    const newCategory: DrillCategory = {
      ...category,
      id: `cat_${Math.random().toString(36).substring(2, 10)}`,
    };
    setCategories(prev => [...prev, newCategory]);
    return newCategory;
  }, []);

  const updateCategory = useCallback((id: string, updates: Partial<DrillCategory>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCategory = useCallback((id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
  }, []);

  const resetToDefaults = useCallback(() => {
    setCategories(DEFAULT_DRILL_CATEGORIES);
  }, []);

  return { categories, addCategory, updateCategory, deleteCategory, resetToDefaults };
}

export function useDrillTags(drills: Drill[]) {
  const [tags, setTags] = useState<DrillTag[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DRILL_TAGS);
    if (saved) {
      const parsed = JSON.parse(saved);
      return updateTagUsageCount(parsed, drills);
    }
    return [];
  });

  useEffect(() => {
    const updatedTags = updateTagUsageCount(tags, drills);
    if (JSON.stringify(updatedTags) !== JSON.stringify(tags)) {
      setTags(updatedTags);
    }
    localStorage.setItem(STORAGE_KEYS.DRILL_TAGS, JSON.stringify(updatedTags));
  }, [drills]);

  const addTag = useCallback((name: string) => {
    const existing = tags.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (existing) return existing;

    const newTag: DrillTag = {
      id: `tag_${Math.random().toString(36).substring(2, 10)}`,
      name: name.trim(),
      usageCount: 0,
    };
    setTags(prev => [...prev, newTag]);
    return newTag;
  }, [tags]);

  const renameTag = useCallback((id: string, newName: string) => {
    setTags(prev => prev.map(t => t.id === id ? { ...t, name: newName.trim() } : t));
  }, []);

  const deleteTag = useCallback((id: string) => {
    setTags(prev => prev.filter(t => t.id !== id));
  }, []);

  const mergeTags = useCallback((fromId: string, toId: string) => {
    const fromTag = tags.find(t => t.id === fromId);
    const toTag = tags.find(t => t.id === toId);
    if (!fromTag || !toTag) return;

    setTags(prev => {
      const result = prev.filter(t => t.id !== fromId);
      return result.map(t => t.id === toId 
        ? { ...t, usageCount: t.usageCount + fromTag.usageCount }
        : t
      );
    });
  }, [tags]);

  return { tags, addTag, renameTag, deleteTag, mergeTags };
}

function updateTagUsageCount(tags: DrillTag[], drills: Drill[]): DrillTag[] {
  const usageCount: Record<string, number> = {};
  drills.forEach(drill => {
    drill.tags?.forEach(tagName => {
      const tag = tags.find(t => t.name === tagName);
      if (tag) {
        usageCount[tag.id] = (usageCount[tag.id] || 0) + 1;
      }
    });
  });

  return tags.map(tag => ({
    ...tag,
    usageCount: usageCount[tag.id] || 0,
  }));
}

export function useDrillCollections() {
  const [collections, setCollections] = useState<DrillCollection[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.DRILL_COLLECTIONS);
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.DRILL_COLLECTIONS, JSON.stringify(collections));
  }, [collections]);

  const createCollection = useCallback((name: string, description?: string) => {
    const newCollection: DrillCollection = {
      id: `col_${Math.random().toString(36).substring(2, 10)}`,
      name: name.trim(),
      description,
      drillIds: [],
      createdAt: Date.now(),
    };
    setCollections(prev => [...prev, newCollection]);
    return newCollection;
  }, []);

  const updateCollection = useCallback((id: string, updates: Partial<DrillCollection>) => {
    setCollections(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  }, []);

  const deleteCollection = useCallback((id: string) => {
    setCollections(prev => prev.filter(c => c.id !== id));
  }, []);

  const addDrillToCollection = useCallback((collectionId: string, drillId: string) => {
    setCollections(prev => prev.map(c => {
      if (c.id === collectionId && !c.drillIds.includes(drillId)) {
        return { ...c, drillIds: [...c.drillIds, drillId] };
      }
      return c;
    }));
  }, []);

  const removeDrillFromCollection = useCallback((collectionId: string, drillId: string) => {
    setCollections(prev => prev.map(c => {
      if (c.id === collectionId) {
        return { ...c, drillIds: c.drillIds.filter(id => id !== drillId) };
      }
      return c;
    }));
  }, []);

  return { 
    collections, 
    createCollection, 
    updateCollection, 
    deleteCollection,
    addDrillToCollection,
    removeDrillFromCollection,
  };
}

// ============================================
// EXPORT/IMPORT HOOK
// ============================================

export function useDataExport() {
  const exportData = useCallback((data: object, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  return { exportData };
}

export function useDataImport<T>(onImport: (data: T) => void) {
  const importData = useCallback((file: File): Promise<T> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string) as T;
          onImport(data);
          resolve(data);
        } catch (error) {
          reject(new Error('Invalid JSON file'));
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }, [onImport]);

  return { importData };
}

// ============================================
// FINANCIAL HOOKS
// ============================================

export interface ClientFinancial {
  client: Client;
  playerCount: number;
  openingBalance: number;
  monthlyFees: number;
  monthlyPayments: number;
  closingBalance: number;
  location: string;
}

export interface FinancialTotals {
  openingBalance: number;
  monthlyFees: number;
  monthlyPayments: number;
  closingBalance: number;
}

export interface LedgerEntry {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'fee' | 'payment';
  clientName: string;
  clientId: string;
}

export function useClientFinancials(
  clients: Client[], 
  players: Player[], 
  sessions: TrainingSession[], 
  currentDate: Date
) {
  return useMemo(() => {
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString().split('T')[0];
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString().split('T')[0];

    let totalOpening = 0;
    let totalFees = 0;
    let totalPayments = 0;
    let totalClosing = 0;

    const clientFinancials: ClientFinancial[] = clients.map(client => {
      const clientPlayers = players.filter(p => p.clientId === client.id);
      const playerCount = clientPlayers.length;
      const location = clientPlayers[0]?.intel?.location || 'Unknown';

      // Calculate Opening Balance (Everything before startOfMonth)
      const priorFees = sessions.filter(s => 
        s.date < startOfMonth && 
        s.participantIds.some(pid => clientPlayers.some(cp => cp.id === pid))
      ).reduce((sum, s) => sum + s.price, 0);

      const priorPayments = (client.payments || [])
        .filter(p => p.date < startOfMonth)
        .reduce((sum, p) => sum + p.amount, 0);

      const openingBalance = priorFees - priorPayments;

      // Calculate Monthly Activity
      const monthlyFees = sessions.filter(s => 
        s.date >= startOfMonth && s.date <= endOfMonth &&
        s.participantIds.some(pid => clientPlayers.some(cp => cp.id === pid))
      ).reduce((sum, s) => sum + s.price, 0);

      const monthlyPayments = (client.payments || [])
        .filter(p => p.date >= startOfMonth && p.date <= endOfMonth)
        .reduce((sum, p) => sum + p.amount, 0);

      const closingBalance = openingBalance + monthlyFees - monthlyPayments;

      // Aggregates
      totalOpening += openingBalance;
      totalFees += monthlyFees;
      totalPayments += monthlyPayments;
      totalClosing += closingBalance;

      return {
        client,
        playerCount,
        openingBalance,
        monthlyFees,
        monthlyPayments,
        closingBalance,
        location
      };
    });

    return {
      clients: clientFinancials,
      totals: {
        openingBalance: totalOpening,
        monthlyFees: totalFees,
        monthlyPayments: totalPayments,
        closingBalance: totalClosing
      }
    };
  }, [clients, players, sessions, currentDate]);
}

export function useFilteredClients(
  financials: ClientFinancial[],
  searchQuery: string,
  locationFilter: string
) {
  return useMemo(() => {
    let result = financials;
    const q = searchQuery.toLowerCase();

    if (q) {
      result = result.filter(f => 
        f.client.name.toLowerCase().includes(q) ||
        f.client.email?.toLowerCase().includes(q) ||
        f.client.phone?.includes(q)
      );
    }

    if (locationFilter !== 'All') {
      result = result.filter(f => f.location === locationFilter);
    }

    return result.sort((a, b) => a.client.name.localeCompare(b.client.name));
  }, [financials, searchQuery, locationFilter]);
}

export function useLedgerEntries(
  financials: ClientFinancial[],
  selectedClientId: string | null
) {
  return useMemo(() => {
    let entries: LedgerEntry[] = [];

    // Filter scope
    const scope = selectedClientId 
      ? financials.filter(f => f.client.id === selectedClientId)
      : financials;

    // Flatten scope
    scope.forEach(f => {
      // Payments
      (f.client.payments || []).forEach(p => {
        entries.push({
          id: p.id,
          date: p.date,
          description: p.reference || 'Payment',
          amount: -p.amount, // Payment reduces balance
          type: 'payment',
          clientName: f.client.name,
          clientId: f.client.id
        });
      });
    });

    return entries.sort((a, b) => b.date.localeCompare(a.date));
  }, [financials, selectedClientId]);
}
