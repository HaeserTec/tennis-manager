import { Player, SessionLog, ProgressGoal, ProgressMetric, Drill, TrainingSession } from './playbook';

export interface ScoreData {
  tech: number;
  consistency: number;
  tactics: number;
  movement: number;
  coachability: number;
}

export function computeTotalScore(scores: ScoreData): number {
  return scores.tech + scores.consistency + scores.tactics + scores.movement + scores.coachability;
}

export type DashboardStats = {
  totalRevenue: number;
  revenueChange: number;
  totalSessions: number;
  sessionsChange: number;
  activeClients: number;
  clientGrowth: number;
  avgPerSession: number;
  mostPopularType: string;
};

export type ChartData = {
  label: string;
  value: number;
};

export type HeatmapData = Record<string, number>;

// ============================================
// PROGRESS TRACKING ANALYTICS
// ============================================

export type ProgressChartData = {
  date: string;
  tech: number;
  consistency: number;
  tactics: number;
  movement: number;
  coachability: number;
  total: number;
};

export type TrendDirection = 'improving' | 'stable' | 'declining';

export interface TrendData {
  direction: TrendDirection;
  change: number;
  percentChange: number;
  dataPoints: number[];
}

export function getPlayerProgressHistory(playerId: string, logs: SessionLog[]): ProgressChartData[] {
  const playerLogs = logs
    .filter(log => log.playerId === playerId)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return playerLogs.map(log => ({
    date: log.date,
    tech: log.tech,
    consistency: log.consistency,
    tactics: log.tactics,
    movement: log.movement,
    coachability: log.coachability,
    total: log.totalScore,
  }));
}

export function calculateMetricTrend(logs: SessionLog[], metric: ProgressMetric): TrendData {
  const values = logs.map(log => log[metric]).filter(v => v !== undefined);
  
  if (values.length < 2) {
    return { direction: 'stable', change: 0, percentChange: 0, dataPoints: values };
  }

  const first = values[0];
  const last = values[values.length - 1];
  const change = last - first;
  const percentChange = first !== 0 ? (change / first) * 100 : 0;

  let direction: TrendDirection = 'stable';
  if (change > 0.5) direction = 'improving';
  else if (change < -0.5) direction = 'declining';

  return {
    direction,
    change,
    percentChange: Math.round(percentChange),
    dataPoints: values,
  };
}

export function getSessionComparison(log1: SessionLog, log2: SessionLog) {
  const metrics: ProgressMetric[] = ['tech', 'consistency', 'tactics', 'movement', 'coachability'];
  
  const comparison = metrics.map(metric => {
    const val1 = log1[metric];
    const val2 = log2[metric];
    const diff = val2 - val1;
    return {
      metric,
      previous: val1,
      current: val2,
      change: diff,
      improved: diff > 0,
      declined: diff < 0,
    };
  });

  const totalChange = log2.totalScore - log1.totalScore;
  const improvedCount = comparison.filter(c => c.improved).length;
  const declinedCount = comparison.filter(c => c.declined).length;

  return {
    metrics: comparison,
    totalChange,
    improvedCount,
    declinedCount,
    overallImproved: totalChange > 0,
  };
}

export function getGoalProgress(player: Player, goals: ProgressGoal[], currentScores: ScoreData) {
  const now = new Date();
  
  return goals.map(goal => {
    const currentValue = currentScores[goal.metric];
    const targetValue = goal.targetValue;
    const progress = Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
    const isOverdue = goal.deadline && new Date(goal.deadline) < now;
    const daysRemaining = goal.deadline 
      ? Math.ceil((new Date(goal.deadline).getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    let status: 'on-track' | 'at-risk' | 'completed' | 'overdue' = 'on-track';
    if (progress >= 100) status = 'completed';
    else if (isOverdue) status = 'overdue';
    else if (progress < 50 && daysRemaining && daysRemaining < 30) status = 'at-risk';

    return {
      ...goal,
      currentValue,
      progress: Math.round(progress),
      status,
      daysRemaining,
    };
  }).sort((a, b) => {
    const statusOrder: Record<string, number> = { completed: 0, 'on-track': 1, 'at-risk': 2, overdue: 3 };
    return statusOrder[a.status] - statusOrder[b.status];
  });
}

export function getTopImprovers(players: Player[], logs: SessionLog[], metric: ProgressMetric, weeks: number = 4): { player: Player; improvement: number; recentAvg: number; oldAvg: number }[] {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - weeks * 7);

  const recentLogs = logs.filter(log => new Date(log.date) >= cutoffDate);
  const oldLogs = logs.filter(log => new Date(log.date) < cutoffDate);

  return players
    .map(player => {
      const playerRecent = recentLogs.filter(l => l.playerId === player.id);
      const playerOld = oldLogs.filter(l => l.playerId === player.id);

      if (playerRecent.length === 0 || playerOld.length === 0) return null;

      const recentAvg = playerRecent.reduce((sum, l) => sum + l[metric], 0) / playerRecent.length;
      const oldAvg = playerOld.reduce((sum, l) => sum + l[metric], 0) / playerOld.length;
      const improvement = recentAvg - oldAvg;

      return { player, improvement, recentAvg, oldAvg };
    })
    .filter((item): item is { player: Player; improvement: number; recentAvg: number; oldAvg: number } => item !== null)
    .sort((a, b) => b.improvement - a.improvement)
    .slice(0, 10);
}

// ============================================
// DRILL LIBRARY ANALYTICS
// ============================================

export interface DrillStats {
  totalDrills: number;
  byCategory: Record<string, number>;
  byLevel: Record<string, number>;
  byIntensity: Record<string, number>;
  mostUsedTags: { name: string; count: number }[];
}

export function calculateDrillStats(drills: Drill[], categories: { id: string }[]): DrillStats {
  const byCategory: Record<string, number> = {};
  const byLevel: Record<string, number> = {};
  const byIntensity: Record<string, number> = {};
  const tagCounts: Record<string, number> = {};

  drills.forEach(drill => {
    if (drill.categoryId) {
      byCategory[drill.categoryId] = (byCategory[drill.categoryId] || 0) + 1;
    }
    if (drill.format) {
      byLevel[drill.format] = (byLevel[drill.format] || 0) + 1;
    }
    if (drill.intensity) {
      byIntensity[drill.intensity] = (byIntensity[drill.intensity] || 0) + 1;
    }
    drill.tags?.forEach(tag => {
      tagCounts[tag] = (tagCounts[tag] || 0) + 1;
    });
  });

  const mostUsedTags = Object.entries(tagCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    totalDrills: drills.length,
    byCategory,
    byLevel,
    byIntensity,
    mostUsedTags,
  };
}

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function calculateDashboardStats(players: Player[], sessions: TrainingSession[]): DashboardStats {
  let totalRevenue = 0;
  let totalSessions = sessions.length;
  const activeClientIds = new Set<string>();
  const sessionTypeCounts: Record<string, number> = { Private: 0, Semi: 0, Group: 0 };

  sessions.forEach(s => {
     // Assuming price is per session, not per player, but logic might vary.
     // For now, let's assume total revenue = sum of all session prices * number of participants?
     // OR if the price on the session is the "Rate", then it's per hour.
     // Let's assume price is total session fee for simplicity, or per player?
     // Convention: Private R350 (Total), Group R200 (Per head? or Total?).
     // Let's assume the session.price is the total revenue for that slot.
     
     totalRevenue += (s.price || 0);
     
     sessionTypeCounts[s.type] = (sessionTypeCounts[s.type] || 0) + 1;
     s.participantIds.forEach(pid => {
        // Find player to get client
        const p = players.find(x => x.id === pid);
        if (p?.clientId) activeClientIds.add(p.clientId);
     });
  });

  let mostPopularType = 'Private';
  let max = -1;
  Object.entries(sessionTypeCounts).forEach(([type, count]) => {
     if (count > max) {
        max = count;
        mostPopularType = type;
     }
  });

  return {
    totalRevenue,
    revenueChange: 100, // Placeholder
    totalSessions,
    sessionsChange: 100, // Placeholder
    activeClients: activeClientIds.size,
    clientGrowth: activeClientIds.size,
    avgPerSession: totalSessions > 0 ? Math.round(totalRevenue / totalSessions) : 0,
    mostPopularType
  };
}

export function getRevenueChartData(sessions: TrainingSession[], period: 'week' | 'month' | 'year'): ChartData[] {
  const data: ChartData[] = [];
  const now = new Date();
  
  if (period === 'week') {
    for (let i = 0; i < 7; i++) {
      const d = new Date(now);
      d.setDate(d.getDate() - (now.getDay() - 1) + i); // Start from Monday of current week
      const dateStr = d.toISOString().split('T')[0];
      
      let val = 0;
      sessions.forEach(s => {
         if (s.date === dateStr) {
            val += (s.price || 0);
         }
      });
      data.push({ label: d.toLocaleDateString('en-US', { weekday: 'short' }), value: val });
    }
  } else if (period === 'month') {
     // Show current calendar month (all weeks)
     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
     const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
     
     // Break into 4-5 weeks
     let current = new Date(startOfMonth);
     let weekNum = 1;
     
     while (current <= endOfMonth) {
        const weekStart = new Date(current);
        const weekEnd = new Date(current);
        weekEnd.setDate(weekEnd.getDate() + 6);
        
        let val = 0;
        sessions.forEach(s => {
           const sDate = new Date(s.date);
           if (sDate >= weekStart && sDate <= weekEnd && sDate <= endOfMonth) {
              val += (s.price || 0);
           }
        });
        
        data.push({ label: `Week ${weekNum}`, value: val });
        current.setDate(current.getDate() + 7);
        weekNum++;
     }
  } else {
     for (let i = 0; i < 12; i++) {
        const d = new Date(now.getFullYear(), i, 1); // Jan to Dec
        const monthIdx = i;
        
        let val = 0;
        sessions.forEach(s => {
           const sDate = new Date(s.date);
           if (sDate.getFullYear() === now.getFullYear() && sDate.getMonth() === monthIdx) {
              val += (s.price || 0);
           }
        });
        data.push({ label: d.toLocaleDateString('en-US', { month: 'short' }), value: val });
     }
  }
  return data;
}

export function getHeatmapData(sessions: TrainingSession[]): HeatmapData {
   const heatmap: HeatmapData = {};
   sessions.forEach(s => {
      const dayName = new Date(s.date).toLocaleDateString('en-US', { weekday: 'long' });
      // s.startTime is "14:00". We need "14:00:00" or just key based on hour
      // The component expects "Monday-14:00:00"
      const hour = s.startTime.split(':')[0] + ":00:00"; // Assuming component formats strict
      // Actually component loops ['13:00'...] and key is `${day}-${time}:00` -> "Monday-13:00:00"
      
      const key = `${dayName}-${s.startTime}:00`; 
      heatmap[key] = (heatmap[key] || 0) + 1;
   });
   return heatmap;
}

export function getClientHealth(players: Player[], sessions: TrainingSession[]) {
   const now = new Date();
   return players.map(p => {
      // Find last session for this player
      const playerSessions = sessions.filter(s => s.participantIds.includes(p.id));
      const lastSession = playerSessions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
      
      const lastSessionTs = lastSession ? new Date(lastSession.date).getTime() : 0;
      const daysSince = lastSessionTs ? Math.floor((now.getTime() - lastSessionTs) / (1000 * 60 * 60 * 24)) : 999;
      
      const hasSchedule = playerSessions.length > 0;
      
      let score = hasSchedule ? 80 : 20;
      if (daysSince > 30) score -= 40;
      if (daysSince < 7) score += 20;
      
      return {
         ...p,
         healthScore: Math.min(100, Math.max(0, score)),
         healthStatus: score > 50 ? 'Healthy' : 'Risk',
         daysSinceLastSession: daysSince
      };
   }).sort((a,b) => a.healthScore - b.healthScore);
}

export function calculateAttendanceStreak(playerId: string, sessions: TrainingSession[]): number {
  const now = new Date();
  
  // 1. Get past sessions for player
  const attendedDates = sessions
    .filter(s => 
      s.participantIds.includes(playerId) && 
      new Date(s.date + 'T' + s.startTime) < now
    )
    .map(s => new Date(s.date));

  if (attendedDates.length === 0) return 0;

  // 2. Get unique weeks (Monday timestamps)
  const getMonday = (d: Date) => {
    const t = new Date(d);
    const day = t.getDay();
    const diff = t.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is sunday
    t.setDate(diff);
    t.setHours(0,0,0,0);
    return t.getTime();
  };

  const attendedWeeks = new Set(attendedDates.map(d => getMonday(d)));
  
  // 3. Count backwards
  let currentMonday = getMonday(now);
  let streak = 0;
  
  // Check current week
  if (attendedWeeks.has(currentMonday)) {
     streak++;
  }
  
  // Check previous weeks
  // If we didn't match current week, we start checking from last week.
  // But if we DID match current week, we ALSO continue to last week.
  // Actually, loop should just decrement.
  
  // However, if we missed current week (e.g. it's Tuesday and we play Thursday), 
  // but played last week, streak should be valid?
  // User Requirement: "sessions in the past until exactly now".
  // If I played last week, and haven't played yet this week, is my streak 0?
  // Usually apps say "Streak: 5 weeks" even if you haven't played THIS week yet, until the week is over.
  // But to be strict: 
  
  // Revised Logic:
  // Iterate backwards from Current Week.
  // If has(CurrentWeek) -> streak++, continue.
  // If !has(CurrentWeek) -> check LastWeek.
  //    If has(LastWeek) -> streak++, continue from LastWeek.
  //    If !has(LastWeek) -> streak = 0.
  
  // Implementation:
  // Try Current Week
  if (!attendedWeeks.has(currentMonday)) {
     // If not present this week, move pointer to last week.
     // If last week is also missing, return 0.
     currentMonday -= 7 * 24 * 60 * 60 * 1000;
     if (!attendedWeeks.has(currentMonday)) return 0;
  }
  
  // Now we are at a "Hit".
  while (attendedWeeks.has(currentMonday)) {
     streak++;
     currentMonday -= 7 * 24 * 60 * 60 * 1000;
  }
  
  return streak;
}