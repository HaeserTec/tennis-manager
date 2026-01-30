export type Intensity = "Warm-Up" | "Active" | "Hard Work";
export type SessionType = "Private" | "Semi" | "Group"; // Renamed from 'Session' to avoid conflict
export type Format = "Beginner" | "Intermediate" | "Advanced";

export interface Drill {
  id?: string;
  name: string;
  session?: SessionType;
  format?: Format;
  intensity?: Intensity;
  durationMins?: number;
  description?: string;
  targetPlayer?: string;
  opponentAction?: string;
  coachingPoints?: string;
  tags?: string[];
  starred?: boolean;
  createdAt?: number;
  updatedAt?: number;
  diagram?: {
    nodes: any[];
    paths: any[];
  };
  // Drill Library Organization fields
  categoryId?: string;
  difficulty?: number;       // 1-5 scale
  estimatedDuration?: number; // minutes
}

export interface SequenceFrame {
  id: string;
  name?: string;
  duration?: number; // seconds
  state: {
    nodes: any[];
    paths: any[];
  };
}

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  frames: SequenceFrame[];
  tags?: string[];
  starred?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface PlanItem {
  id: string; // unique instance id in the plan
  drillId: string;
  drill: Drill; // snapshot of the drill data
  durationMins?: number;
  notes?: string;
}

export interface SessionPlan {
  id: string;
  name: string;
  date?: string;
  items: PlanItem[];
  tags?: string[];
  starred?: boolean;
  createdAt?: number;
  updatedAt?: number;
}

export interface DrillTemplate {
  id: string;
  name: string;
  description?: string;
  starred?: boolean;
  diagram: {
    nodes: any[];
    paths: any[];
  };
  createdAt?: number;
  updatedAt?: number;
}

export interface PlayerStats {
  forehand: number;
  backhand: number;
  serve: number;
  volley: number;
  movement: number;
  consistency: number;
}

// Payment Record
export interface Payment {
  id: string;
  date: string; // YYYY-MM-DD
  amount: number;
  reference?: string; // "EFT - Oct/Nov"
  proofUrl?: string; // Future: URL to image/pdf
  note?: string; 
}

// Parent/Account Holder
export interface Client {
  id: string;
  name: string; // "Parent Name"
  email: string;
  phone: string;
  notes?: string;
  status: 'Active' | 'Inactive' | 'Lead';
  payments?: Payment[]; // Ledger of received payments
  createdAt: number;
  updatedAt: number;
}

// New First-Class Entity
export interface TrainingSession {
  id: string;
  date: string; // "YYYY-MM-DD"
  startTime: string; // "14:00"
  endTime: string;   // "15:00"
  location: string;
  type: SessionType; // Private, Semi, Group
  price: number;
  coachId?: string;
  participantIds: string[]; // List of Player IDs enrolled
  maxCapacity: number;
  
  // Instance-specific overrides
  notes?: string;
  
  // Link recurring sessions together
  seriesId?: string;

  createdAt: number;
  updatedAt: number;
}

export interface Player {
  id: string;
  name: string;
  dob?: string;
  age?: number;
  level: Format;
  stats: PlayerStats;
  assignedDrills: string[];
  notes?: string;
  analysisNotes?: string;
  kitNotes?: string;
  avatarColor?: string;
  avatarUrl?: string;
  attendance?: number[];
  academyPos?: { x: number; y: number };
  
  // Link to Parent Account
  clientId?: string;

  // The Build
  handedness?: 'Right' | 'Left';
  playStyle?: 'Aggressive Baseliner' | 'Serve & Volleyer' | 'Counter-Puncher' | 'All-Court';
  height?: string; // cm
  reach?: string; // cm
  
  equipment?: {
    racket?: string;
    gripSize?: string;
    tension?: string; // kg
    lastRestrung?: string;
  };

  // History & PBs
  pbs?: {
    backToBase?: string;
    longestRally?: number;
    firstServePct?: number;
    attendanceStreak?: number;
  };

  // Player DNA
  dna?: {
    favoriteShot?: string;
    confidence?: number; // 1-10
    careerGoal?: string;
    favoritePro?: string;
  };

  // Coach's Intel
  intel?: {
    // Deprecated legacy fields
    sessionType?: SessionType;
    sessionDay?: string; 
    location?: string;   
    parentContact?: string; 
    medicalAlerts?: string;
  };

  // DEPRECATED: Schedule is now managed via TrainingSession entities
  schedule?: {
    id: string;
    date: string; 
    day: string; 
    startTime: string; 
    endTime: string; 
    location: string;
    sessionType: SessionType;
    fee?: number; 
  }[];

  // Account & Billing
   account?: {
      status: 'Active' | 'Inactive';
   };
   createdAt?: number;
   updatedAt?: number;

   // Progress Tracking
   progressGoals?: ProgressGoal[];
}

export interface Term {
  id: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

export type DayEventType = 'Rain' | 'Coach Cancelled' | 'Tournament' | 'Holiday';

export interface DayEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: DayEventType;
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface LocationConfig {
  id: string;
  name: string;
  defaultRate: number;
  sessionType: SessionType;
}

export interface SessionLog {
  id: string;
  playerId: string;
  termId?: string;
  date: string; // YYYY-MM-DD
  durationMin?: number;
  
  // Scores (0-2)
  tech: number;
  consistency: number;
  tactics: number;
  movement: number;
  coachability: number;
  
  totalScore: number; // 0-10

  // Anchors
  anchorBestStreak?: number;
  anchorServeIn?: number; // 0-10

  note?: string;
  nextFocus?: string;
  
  createdAt: number;
  updatedAt: number;
}

// ============================================
// PROGRESS TRACKING TYPES
// ============================================

export type ProgressMetric = 'tech' | 'consistency' | 'tactics' | 'movement' | 'coachability';

export interface ProgressGoal {
  id: string;
  playerId: string;
  metric: ProgressMetric;
  targetValue: number;  // 0-10 scale
  deadline?: string;    // YYYY-MM-DD
  createdAt: number;
  completedAt?: number;
}

export interface ProgressSnapshot {
  id: string;
  playerId: string;
  date: string;
  scores: {
    tech: number;
    consistency: number;
    tactics: number;
    movement: number;
    coachability: number;
  };
  totalScore: number;
  focusArea?: string;
  notes?: string;
}

// ============================================
// DRILL LIBRARY ORGANIZATION TYPES
// ============================================

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

// Default categories for drill library
export const DEFAULT_DRILL_CATEGORIES: DrillCategory[] = [
  { id: 'cat_warmup', name: 'Warm-Up', color: '#10b981', icon: 'Flame', isSystem: true },
  { id: 'cat_groundstrokes', name: 'Groundstrokes', color: '#3b82f6', icon: 'Circle', isSystem: true },
  { id: 'cat_serve', name: 'Serve', color: '#f59e0b', icon: 'Triangle', isSystem: true },
  { id: 'cat_volley', name: 'Volley', color: '#8b5cf6', icon: 'Square', isSystem: true },
  { id: 'cat_return', name: 'Return', color: '#ec4899', icon: 'ArrowLeft', isSystem: true },
  { id: 'cat_overhead', name: 'Overhead', color: '#ef4444', icon: 'ArrowUp', isSystem: true },
  { id: 'cat_conditioning', name: 'Conditioning', color: '#06b6d4', icon: 'Zap', isSystem: true },
  { id: 'cat_game_based', name: 'Game-Based', color: '#84cc16', icon: 'Trophy', isSystem: true },
];

// ============================================
// STORAGE KEYS
// ============================================

export const STORAGE_KEYS = {
  DRILL_TAGS: 'tactics-lab-drill-tags',
  DRILL_CATEGORIES: 'tactics-lab-drill-categories',
  DRILL_COLLECTIONS: 'tactics-lab-drill-collections',
  PLAYER_GOALS: 'tactics-lab-player-goals',
  DAY_EVENTS: 'tactics-lab-day-events',
};
