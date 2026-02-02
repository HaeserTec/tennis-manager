# Implementation Plan: Progress Tracking & Drill Library Organization

## Overview
This plan implements two major features for Tennis Tactics Lab:
1. **Progress Tracking** - Visual analytics for individual player improvement over time
2. **Drill Library Organization** - Tag management, categories, and advanced search capabilities

Both features build on existing infrastructure and integrate with the current dark/neon UI theme.

---

## PART A: Progress Tracking

### A.1 Data Model Updates (`lib/playbook.ts`) ✅

**New Types:**
```typescript
export interface ProgressGoal {
  id: string;
  playerId: string;
  metric: 'tech' | 'consistency' | 'tactics' | 'movement' | 'coachability';
  targetValue: number;  // 0-10 scale
  deadline?: string;    // YYYY-MM-DD
  createdAt: number;
  completedAt?: number;
}

export interface ProgressSnapshot {
  id: string;
  playerId: string;
  date: string;
  scores: ScoreData;
  totalScore: number;
  focusArea?: string;
  notes?: string;
}
```

**Updates to Player:**
```typescript
export interface Player {
  // ... existing fields
  progressGoals?: ProgressGoal[];
}
```

### A.2 Analytics Functions (`lib/analytics.ts`) ✅

**New Functions:**
1. `getPlayerProgressHistory(playerId, logs)` - Returns array of snapshots sorted by date
2. `calculateMetricTrend(playerId, logs, metric)` - Returns trend data (improving/stable/declining)
3. `compareSessions(log1, log2)` - Shows improvement between two sessions
4. `getGoalProgress(player, goals)` - Maps current scores against goals
5. `getTopImprovers(players, logs, metric, weeks)` - Find top improving players

### A.3 New Components ✅

| Component | File | Status |
|-----------|------|--------|
| ProgressChart | `components/ProgressChart.tsx` | ✅ SVG line charts with tooltips |
| PlayerProgress | `components/PlayerProgress.tsx` | ✅ Full progress dashboard with tabs |

### A.4 UI Integration Points ✅
- Added "Progress" tab to LockerRoom PlayerDetailView

---

## PART B: Drill Library Organization

### B.1 Data Model Updates (`lib/playbook.ts`) ✅

**New Types:**
```typescript
export interface DrillCategory {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  parentId?: string;
  isSystem?: boolean;
}

export interface DrillTag {
  id: string;
  name: string;
  color?: string;
  usageCount: number;
}

export interface DrillCollection {
  id: string;
  name: string;
  description?: string;
  drillIds: string[];
  createdAt: number;
}
```

**Updates to Drill:**
```typescript
export interface Drill {
  // ... existing fields
  categoryId?: string;
  difficulty?: number;       // 1-5 scale
  estimatedDuration?: number;
}
```

### B.2 Default Categories ✅
```typescript
const DEFAULT_CATEGORIES: DrillCategory[] = [
  { id: 'cat_warmup', name: 'Warm-Up', color: '#10b981', icon: 'Flame', isSystem: true },
  { id: 'cat_groundstrokes', name: 'Groundstrokes', color: '#3b82f6', icon: 'Circle', isSystem: true },
  { id: 'cat_serve', name: 'Serve', color: '#f59e0b', icon: 'Triangle', isSystem: true },
  { id: 'cat_volley', name: 'Volley', color: '#8b5cf6', icon: 'Square', isSystem: true },
  { id: 'cat_return', name: 'Return', color: '#ec4899', icon: 'ArrowLeft', isSystem: true },
  { id: 'cat_overhead', name: 'Overhead', color: '#ef4444', icon: 'ArrowUp', isSystem: true },
  { id: 'cat_conditioning', name: 'Conditioning', color: '#06b6d4', icon: 'Zap', isSystem: true },
  { id: 'cat_game_based', name: 'Game-Based', color: '#84cc16', icon: 'Trophy', isSystem: true },
];
```

### B.3 New Components ✅

| Component | File | Status |
|-----------|------|--------|
| DrillLibrary | `components/DrillLibrary.tsx` | ✅ Main library with search/filters |
| ProgressChart | `components/ProgressChart.tsx` | ✅ SVG line charts |

### B.4 UI Integration Points ✅
- Added "Library" mode to NavigationRail
- Updated App.tsx to handle 'library' mode

---

## PART C: Shared Infrastructure

### C.1 New Hooks (`lib/hooks.ts`) ✅
```typescript
export function useProgress(playerId: string, logs: SessionLog[]);
export function useDrillCategories();
export function useDrillTags(drills: Drill[]);
export function useDrillCollections();
export function usePlayerGoals(player: Player | null);
export function useGoalProgress(player, goals, currentScores);
export function useDataExport();
export function useDataImport();
```

### C.2 Storage Keys ✅
```typescript
const STORAGE_KEYS = {
  DRILL_TAGS: 'tactics-lab-drill-tags',
  DRILL_CATEGORIES: 'tactics-lab-drill-categories',
  DRILL_COLLECTIONS: 'tactics-lab-drill-collections',
  PLAYER_GOALS: 'tactics-lab-player-goals',
};
```

---

## PART D: Implementation Phases

| Phase | Tasks | Status |
|-------|-------|--------|
| 1 | Update data models (playbook.ts) | ✅ Complete |
| 2 | Add analytics functions | ✅ Complete |
| 3 | Create hooks.ts | ✅ Complete |
| 4 | Create ProgressChart component | ✅ Complete |
| 5 | Create PlayerProgress component | ✅ Complete |
| 6 | Integrate Progress into LockerRoom | ✅ Complete |
| 7 | Create DrillLibrary component | ✅ Complete |
| 8 | Add default categories | ✅ Complete |
| 9 | Integrate Drill Library into App | ✅ Complete |
| 10 | Add Library navigation mode | ✅ Complete |
| 11 | Testing & refinement | ⏳ Pending |

---
  
  ## PART E: Financials & Admin Overhaul (Completed Feb 2026) ✅
  
  ### E.1 Financial Consolidation ✅
  - **AccountsStatement Component:** Created a master view for all client accounts.
  - **Logic:** Implemented "Brought Forward" (Opening Balance) logic to correctly carry over credit/debt from previous months.
  - **Filtering:** Added month-based filtering and client search.
  
  ### E.2 Scheduler Enhancements ✅
  - **Recurrence:** Added "Repeat Mode" (Month/Term) for creating session series.
  - **Visuals:** Optimized `WeekView` to show Time + Type on one line for better density.
  - **UX:** Removed unused "Day Markers" (Rain/Cancel) to declutter.
  - **Fixes:** Solved resize persistence bug using mutable state closures.
  
  ### E.3 Client Portal 2.0 ✅
  - **Theme:** Ported "Midnight" radial gradient theme to the client side.
  - **Financials Tab:** Added full statement view (B/F, Fees, Paid, Balance) for parents.
  - **Navigation:** Improved mobile navigation bar and desktop sidebar.
  
  ---
  
  ## File Structure

```
lib/
  ├── playbook.ts         (updated - new types)
  ├── analytics.ts        (updated - progress functions)
  ├── hooks.ts            (new - custom hooks)
  └── utils.ts            (existing)

components/
  ├── PlayerProgress.tsx           (new)
  ├── ProgressChart.tsx            (new)
  ├── DrillLibrary.tsx             (new)
  └── NavigationRail.tsx           (updated)

App.tsx                      (updated - library mode)
LockerRoom.tsx               (updated - progress tab)
```

---

## Notes
- No new npm packages - custom SVG charts
- All data in localStorage
- Mobile responsive required
- Dark mode native support
- JSON export/import for library sharing
