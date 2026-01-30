import React, { useState, useMemo } from 'react';
import { cn, nanoid } from '@/lib/utils';
import type { Player, SessionLog, ProgressGoal, ProgressMetric } from '@/lib/playbook';
import { ProgressChart, TrendIndicator } from '@/components/ProgressChart';
import { useProgress, usePlayerGoals, useGoalProgress } from '@/lib/hooks';
import { 
  ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Target, 
  Calendar, BarChart3, Award, History, Download, Printer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

interface PlayerProgressProps {
  player: Player;
  logs: SessionLog[];
  onUpdatePlayer: (player: Player) => void;
  onNavigateBack: () => void;
}

type TabType = 'overview' | 'trends' | 'history' | 'goals';

const METRICS: { key: ProgressMetric; label: string; color: string }[] = [
  { key: 'tech', label: 'Technique', color: '#ef4444' },
  { key: 'consistency', label: 'Consistency', color: '#f59e0b' },
  { key: 'tactics', label: 'Tactics', color: '#10b981' },
  { key: 'movement', label: 'Movement', color: '#3b82f6' },
  { key: 'coachability', label: 'Coachability', color: '#8b5cf6' },
];

export function PlayerProgress({ player, logs, onUpdatePlayer, onNavigateBack }: PlayerProgressProps) {
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [timeRange, setTimeRange] = useState<number>(12);

  const { history, trends } = useProgress(player.id, logs);
  const { goals, addGoal, updateGoal, deleteGoal, completeGoal } = usePlayerGoals(player);

  const currentScores = useMemo(() => {
    const latest = logs
      .filter(l => l.playerId === player.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0];
    return latest ? {
      tech: latest.tech,
      consistency: latest.consistency,
      tactics: latest.tactics,
      movement: latest.movement,
      coachability: latest.coachability,
    } : null;
  }, [logs, player.id]);

  const goalProgress = useGoalProgress(player, goals, currentScores);

  const filteredHistory = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - timeRange * 7);
    return history.filter(h => new Date(h.date) >= cutoff);
  }, [history, timeRange]);

  const handleAddGoal = () => {
    const metric = METRICS[0].key;
    addGoal({
      playerId: player.id,
      metric,
      targetValue: 8,
    });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="shrink-0 p-4 border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onNavigateBack}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-black uppercase tracking-tighter">{player.name}</h1>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Progress Tracking</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="w-4 h-4 mr-1" />
              Print
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
          {[
            { id: 'overview', label: 'Overview', icon: <BarChart3 className="w-4 h-4" /> },
            { id: 'trends', label: 'Trends', icon: <TrendingUp className="w-4 h-4" /> },
            { id: 'history', label: 'History', icon: <History className="w-4 h-4" /> },
            { id: 'goals', label: 'Goals', icon: <Target className="w-4 h-4" /> },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                activeTab === tab.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              )}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'overview' && (
          <OverviewTab 
            player={player}
            history={history}
            trends={trends}
            goalProgress={goalProgress}
            currentScores={currentScores}
          />
        )}

        {activeTab === 'trends' && (
          <TrendsTab 
            history={filteredHistory}
            trends={trends}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        )}

        {activeTab === 'history' && (
          <HistoryTab logs={logs.filter(l => l.playerId === player.id)} />
        )}

        {activeTab === 'goals' && (
          <GoalsTab 
            goals={goalProgress}
            onAddGoal={handleAddGoal}
            onUpdateGoal={updateGoal}
            onDeleteGoal={deleteGoal}
            onCompleteGoal={completeGoal}
          />
        )}
      </div>
    </div>
  );
}

// Overview Tab
function OverviewTab({ 
  player, 
  history, 
  trends, 
  goalProgress, 
  currentScores 
}: { 
  player: Player;
  history: any[];
  trends: any;
  goalProgress: any[];
  currentScores: any;
}) {
  const recentHistory = history.slice(-12);

  if (recentHistory.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <History className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p className="text-lg font-medium">No session data yet</p>
        <p className="text-sm">Start logging sessions to see progress tracking data</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Current Scores */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {METRICS.map(({ key, label, color }) => (
          <div
            key={key}
            className="p-4 rounded-2xl bg-card/50 border border-border text-center"
          >
            <div className="text-3xl font-black" style={{ color }}>
              {currentScores?.[key]?.toFixed(1) || '-'}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">
              {label}
            </div>
            {trends?.[key] && (
              <TrendIndicator 
                direction={trends[key].direction} 
                change={trends[key].change} 
              />
            )}
          </div>
        ))}
      </div>

      {/* Progress Chart */}
      <div className="p-6 rounded-2xl bg-card/30 border border-border">
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-primary" />
          Recent Progress
        </h3>
        <ProgressChart data={recentHistory} height={250} />
      </div>

      {/* Active Goals */}
      <div className="p-6 rounded-2xl bg-card/30 border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Target className="w-5 h-5 text-amber-400" />
            Active Goals
          </h3>
          <span className="text-sm text-muted-foreground">
            {goalProgress.filter(g => g.status === 'completed').length} completed
          </span>
        </div>
        {goalProgress.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {goalProgress.filter(g => g.status !== 'completed').slice(0, 4).map(goal => (
              <div key={goal.id} className="p-4 rounded-xl bg-white/5 border border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-bold">{METRICS.find(m => m.key === goal.metric)?.label}</span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                    goal.status === 'on-track' ? "bg-emerald-500/10 text-emerald-400" :
                    goal.status === 'at-risk' ? "bg-amber-500/10 text-amber-400" :
                    "bg-red-500/10 text-red-400"
                  )}>
                    {goal.status}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${goal.progress}%` }}
                    />
                  </div>
                  <span className="text-sm font-mono">{goal.currentValue}/{goal.targetValue}</span>
                </div>
                {goal.deadline && (
                  <div className="text-[10px] text-muted-foreground mt-2">
                    {goal.daysRemaining !== null 
                      ? `${goal.daysRemaining} days remaining`
                      : 'Past deadline'}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No goals set yet</p>
        )}
      </div>
    </div>
  );
}

// Trends Tab
function TrendsTab({ 
  history, 
  trends, 
  timeRange, 
  onTimeRangeChange 
}: { 
  history: any[];
  trends: any;
  timeRange: number;
  onTimeRangeChange: (v: number) => void;
}) {
  const ranges = [
    { label: '4 Weeks', value: 4 },
    { label: '3 Months', value: 12 },
    { label: '6 Months', value: 26 },
    { label: '1 Year', value: 52 },
  ];

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">Time range:</span>
        <div className="flex gap-1 bg-secondary/50 p-1 rounded-lg">
          {ranges.map(r => (
            <button
              key={r.value}
              onClick={() => onTimeRangeChange(r.value)}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm font-medium transition-all",
                timeRange === r.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Chart */}
      {history.length > 0 ? (
        <div className="p-6 rounded-2xl bg-card/30 border border-border">
          <ProgressChart data={history} height={300} showLegend />
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p>Not enough data for trends</p>
        </div>
      )}

      {/* Individual Metric Trends */}
      {trends && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {METRICS.map(({ key, label, color }) => (
            <div key={key} className="p-4 rounded-xl bg-card/50 border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold">{label}</span>
                {trends[key] && (
                  <TrendIndicator 
                    direction={trends[key].direction} 
                    change={trends[key].change}
                    label={`over ${history.length} sessions`}
                  />
                )}
              </div>
              {trends[key] && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{trends[key].dataPoints[0]?.toFixed(1) || '-'}</span>
                    <span>{trends[key].dataPoints[trends[key].dataPoints.length - 1]?.toFixed(1) || '-'}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div 
                      className={cn(
                        "h-full rounded-full transition-all",
                        trends[key].direction === 'improving' ? "bg-emerald-500" :
                        trends[key].direction === 'declining' ? "bg-red-500" : "bg-muted-foreground"
                      )}
                      style={{ width: `${Math.min(100, Math.abs(trends[key].change) * 20 + 50)}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// History Tab
function HistoryTab({ logs }: { logs: SessionLog[] }) {
  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [logs]);

  if (sortedLogs.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Calendar className="w-12 h-12 mx-auto mb-4 opacity-20" />
        <p>No session history yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2">
        <History className="w-5 h-5 text-primary" />
        Session History ({sortedLogs.length} sessions)
      </h3>
      
      <div className="space-y-3">
        {sortedLogs.map((log, idx) => (
          <div 
            key={log.id}
            className="p-4 rounded-xl bg-card/50 border border-border hover:bg-card/80 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">
                  {new Date(log.date).toLocaleDateString('en-US', { 
                    weekday: 'short', 
                    month: 'short', 
                    day: 'numeric',
                    year: 'numeric'
                  })}
                </span>
              </div>
              <div className="text-lg font-black text-primary">
                {log.totalScore.toFixed(1)}
              </div>
            </div>
            
            <div className="grid grid-cols-5 gap-2 mb-3">
              {METRICS.map(({ key, label, color }) => (
                <div key={key} className="text-center">
                  <div className="text-lg font-bold" style={{ color }}>{log[key].toFixed(1)}</div>
                  <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>

            {log.nextFocus && (
              <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-2">
                <span className="font-bold">Next Focus:</span> {log.nextFocus}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Goals Tab
function GoalsTab({ 
  goals, 
  onAddGoal, 
  onUpdateGoal, 
  onDeleteGoal, 
  onCompleteGoal 
}: { 
  goals: any[];
  onAddGoal: () => void;
  onUpdateGoal: (id: string, updates: any) => void;
  onDeleteGoal: (id: string) => void;
  onCompleteGoal: (id: string) => void;
}) {
  const [editingGoal, setEditingGoal] = useState<string | null>(null);
  const [targetValue, setTargetValue] = useState<string>('');

  const handleEditClick = (goal: any) => {
    setEditingGoal(goal.id);
    setTargetValue(goal.targetValue.toString());
  };

  const handleSaveEdit = (goalId: string) => {
    const value = parseFloat(targetValue);
    if (value >= 0 && value <= 10) {
      onUpdateGoal(goalId, { targetValue: value });
    }
    setEditingGoal(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2">
          <Target className="w-5 h-5 text-amber-400" />
          Progress Goals
        </h3>
        <Button onClick={onAddGoal} size="sm">
          <Award className="w-4 h-4 mr-1" />
          Add Goal
        </Button>
      </div>

      {goals.length > 0 ? (
        <div className="space-y-3">
          {goals.map(goal => {
            const metricLabel = METRICS.find(m => m.key === goal.metric)?.label;
            const isEditing = editingGoal === goal.id;

            return (
              <div 
                key={goal.id}
                className={cn(
                  "p-4 rounded-xl border transition-all",
                  goal.status === 'completed' ? "bg-emerald-500/10 border-emerald-500/30" :
                  goal.status === 'overdue' ? "bg-red-500/10 border-red-500/30" :
                  goal.status === 'at-risk' ? "bg-amber-500/10 border-amber-500/30" :
                  "bg-card/50 border-border"
                )}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: METRICS.find(m => m.key === goal.metric)?.color }}
                    />
                    <span className="font-bold">{metricLabel}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "text-[10px] px-2 py-0.5 rounded-full font-bold uppercase",
                      goal.status === 'completed' ? "bg-emerald-500/20 text-emerald-400" :
                      goal.status === 'overdue' ? "bg-red-500/20 text-red-400" :
                      goal.status === 'at-risk' ? "bg-amber-500/20 text-amber-400" :
                      "bg-blue-500/20 text-blue-400"
                    )}>
                      {goal.status}
                    </span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="w-6 h-6"
                      onClick={() => onDeleteGoal(goal.id)}
                    >
                      <span className="text-xs">×</span>
                    </Button>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between text-xs mb-1">
                      <span>Current: {goal.currentValue.toFixed(1)}</span>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input 
                            type="number"
                            min="0"
                            max="10"
                            step="0.5"
                            value={targetValue}
                            onChange={e => setTargetValue(e.target.value)}
                            className="w-16 h-6 text-xs"
                          />
                          <Button size="sm" className="h-6 px-2" onClick={() => handleSaveEdit(goal.id)}>
                            ✓
                          </Button>
                        </div>
                      ) : (
                        <button onClick={() => handleEditClick(goal)}>
                          Target: {goal.targetValue.toFixed(1)}
                        </button>
                      )}
                    </div>
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={cn(
                          "h-full rounded-full transition-all",
                          goal.status === 'completed' ? "bg-emerald-500" :
                          goal.status === 'overdue' ? "bg-red-500" :
                          "bg-primary"
                        )}
                        style={{ width: `${goal.progress}%` }}
                      />
                    </div>
                  </div>
                  <div className="text-xl font-black text-primary">
                    {goal.progress}%
                  </div>
                </div>

                {goal.daysRemaining !== null && (
                  <div className="text-xs text-muted-foreground mt-2">
                    {goal.status === 'completed' 
                      ? 'Goal achieved!'
                      : goal.daysRemaining > 0 
                        ? `${goal.daysRemaining} days remaining`
                        : `${Math.abs(goal.daysRemaining)} days overdue`
                    }
                  </div>
                )}

                {goal.status !== 'completed' && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="mt-3 w-full"
                    onClick={() => onCompleteGoal(goal.id)}
                  >
                    <Award className="w-4 h-4 mr-1" />
                    Mark Complete
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
          <p className="text-lg font-medium">No goals set</p>
          <p className="text-sm">Add goals to track player development</p>
        </div>
      )}
    </div>
  );
}
