export type SchemaIssue =
  | { kind: 'missing_table'; table: string; rawMessage: string }
  | { kind: 'missing_column'; table: string; column: string; rawMessage: string };

export type SyncHealthStatus = {
  missingTables: string[];
  missingColumns: Record<string, string[]>;
  issues: string[];
  hasIssues: boolean;
  lastUpdatedAt: number;
};

export const EMPTY_SYNC_HEALTH: SyncHealthStatus = {
  missingTables: [],
  missingColumns: {},
  issues: [],
  hasIssues: false,
  lastUpdatedAt: 0,
};

export const TABLE_COLUMN_ALLOWLIST: Record<string, string[]> = {
  drills: [
    'id', 'name', 'session', 'format', 'intensity', 'duration_mins', 'description',
    'target_player', 'opponent_action', 'coaching_points', 'tags', 'starred', 'diagram',
    'category_id', 'difficulty', 'estimated_duration', 'created_at', 'updated_at',
  ],
  drill_templates: ['id', 'name', 'description', 'starred', 'diagram', 'created_at', 'updated_at'],
  sequences: ['id', 'name', 'description', 'frames', 'tags', 'starred', 'created_at', 'updated_at'],
  session_plans: ['id', 'name', 'date', 'items', 'tags', 'starred', 'created_at', 'updated_at'],
  clients: ['id', 'name', 'email', 'phone', 'notes', 'status', 'payments', 'created_at', 'updated_at'],
  players: [
    'id', 'client_id', 'name', 'dob', 'age', 'level', 'stats', 'assigned_drills', 'notes',
    'analysis_notes', 'kit_notes', 'avatar_color', 'avatar_url', 'attendance', 'academy_pos',
    'handedness', 'play_style', 'height', 'reach', 'equipment', 'pbs', 'dna', 'intel',
    'schedule', 'account', 'progress_goals', 'curriculum_progress', 'created_at', 'updated_at',
  ],
  training_sessions: [
    'id', 'date', 'start_time', 'end_time', 'location', 'type', 'price', 'coach_id',
    'participant_ids', 'max_capacity', 'notes', 'series_id', 'created_at', 'updated_at',
  ],
  locations: ['id', 'name', 'courts', 'color', 'created_at', 'updated_at'],
  session_logs: [
    'id', 'player_id', 'term_id', 'date', 'duration_min', 'tech', 'consistency', 'tactics',
    'movement', 'coachability', 'total_score', 'anchor_best_streak', 'anchor_serve_in', 'note',
    'next_focus', 'effort', 'is_shared_with_parent', 'created_at', 'updated_at',
  ],
  session_observations: [
    'id', 'player_id', 'recorded_at', 'session_id', 'drill_id', 'drill_outcome',
    'ratings', 'focus_skill', 'focus_skill_rating', 'note', 'created_at', 'updated_at',
  ],
  terms: ['id', 'name', 'start_date', 'end_date', 'created_at', 'updated_at'],
  day_events: ['id', 'date', 'type', 'note', 'created_at', 'updated_at'],
  expenses: ['id', 'date', 'category', 'description', 'amount', 'created_at', 'updated_at'],
};

export function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function normalizeTableName(table: string): string {
  if (table.includes('.')) {
    const chunks = table.split('.');
    return chunks[chunks.length - 1];
  }
  return table;
}

export function sanitizeRecordForTable(
  tableName: string,
  item: Record<string, any>,
  options?: { validClientIds?: Set<string> }
): Record<string, any> {
  if (tableName === 'locations') {
    return {
      id: item.id,
      name: item.name,
      color: item.sessionType || item.color,
      courts: item.courts || [],
      updated_at: item.updatedAt || Date.now(),
      created_at: item.createdAt || Date.now(),
    };
  }

  const transformed: Record<string, any> = {};
  Object.keys(item).forEach((key) => {
    transformed[toSnakeCase(key)] = item[key];
  });

  delete transformed.user_id;

  if (tableName === 'training_sessions') {
    delete transformed.date_obj;
    delete transformed.start_hour;
    delete transformed.participants;
    delete transformed.start_key;
  }

  if (tableName === 'players' && transformed.client_id && options?.validClientIds) {
    if (!options.validClientIds.has(transformed.client_id)) {
      transformed.client_id = null;
    }
  }

  const allowlist = TABLE_COLUMN_ALLOWLIST[tableName];
  if (!allowlist) return transformed;

  const allow = new Set(allowlist);
  const filtered: Record<string, any> = {};
  Object.keys(transformed).forEach((key) => {
    if (allow.has(key)) {
      filtered[key] = transformed[key];
    }
  });
  return filtered;
}

export function classifySchemaIssue(error: { message?: string } | null | undefined): SchemaIssue | null {
  const rawMessage = (error?.message || '').trim();
  if (!rawMessage) return null;

  const missingColumnMatch = rawMessage.match(/Could not find the '([^']+)' column of '([^']+)'/i);
  if (missingColumnMatch) {
    return {
      kind: 'missing_column',
      column: missingColumnMatch[1],
      table: normalizeTableName(missingColumnMatch[2]),
      rawMessage,
    };
  }

  const missingTableMatch = rawMessage.match(/Could not find the table '([^']+)'/i);
  if (missingTableMatch) {
    return {
      kind: 'missing_table',
      table: normalizeTableName(missingTableMatch[1]),
      rawMessage,
    };
  }

  return null;
}

export function mergeSchemaIssue(prev: SyncHealthStatus, issue: SchemaIssue): SyncHealthStatus {
  const missingTables = new Set(prev.missingTables);
  const missingColumns: Record<string, string[]> = { ...prev.missingColumns };

  if (issue.kind === 'missing_table') {
    missingTables.add(issue.table);
  } else {
    const current = new Set(missingColumns[issue.table] || []);
    current.add(issue.column);
    missingColumns[issue.table] = Array.from(current).sort();
  }

  const issues: string[] = [];
  Array.from(missingTables).sort().forEach((table) => {
    issues.push(`Missing table: ${table}`);
  });
  Object.keys(missingColumns).sort().forEach((table) => {
    const cols = missingColumns[table];
    if (cols.length > 0) {
      issues.push(`Missing column(s) in ${table}: ${cols.join(', ')}`);
    }
  });

  return {
    missingTables: Array.from(missingTables).sort(),
    missingColumns,
    issues,
    hasIssues: issues.length > 0,
    lastUpdatedAt: Date.now(),
  };
}
