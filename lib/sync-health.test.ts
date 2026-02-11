import { describe, expect, it } from 'vitest';
import {
  EMPTY_SYNC_HEALTH,
  classifySchemaIssue,
  mergeSchemaIssue,
  sanitizeRecordForTable,
} from './sync-health';

describe('sync-health helpers', () => {
  it('strips unknown fields for players payloads', () => {
    const payload = sanitizeRecordForTable('players', {
      id: 'p1',
      name: 'Test Player',
      level: 'Beginner',
      goals: ['not-in-schema'],
      createdAt: 1,
      updatedAt: 2,
    });

    expect(payload).toEqual({
      id: 'p1',
      name: 'Test Player',
      level: 'Beginner',
      created_at: 1,
      updated_at: 2,
    });
    expect(payload.goals).toBeUndefined();
  });

  it('sanitizes invalid player client links', () => {
    const payload = sanitizeRecordForTable(
      'players',
      { id: 'p2', name: 'Linked Player', clientId: 'missing-client' },
      { validClientIds: new Set(['valid-client']) }
    );

    expect(payload.client_id).toBeNull();
  });

  it('parses missing column and missing table errors', () => {
    const missingColumn = classifySchemaIssue({
      message: "Could not find the 'goals' column of 'players' in the schema cache",
    });
    const missingTable = classifySchemaIssue({
      message: "Could not find the table 'public.expenses' in the schema cache",
    });

    expect(missingColumn).toEqual({
      kind: 'missing_column',
      table: 'players',
      column: 'goals',
      rawMessage: "Could not find the 'goals' column of 'players' in the schema cache",
    });
    expect(missingTable).toEqual({
      kind: 'missing_table',
      table: 'expenses',
      rawMessage: "Could not find the table 'public.expenses' in the schema cache",
    });
  });

  it('deduplicates schema issues in health status', () => {
    const once = mergeSchemaIssue(EMPTY_SYNC_HEALTH, {
      kind: 'missing_table',
      table: 'expenses',
      rawMessage: 'table missing',
    });
    const twice = mergeSchemaIssue(once, {
      kind: 'missing_table',
      table: 'expenses',
      rawMessage: 'table missing',
    });

    expect(twice.missingTables).toEqual(['expenses']);
    expect(twice.issues).toEqual(['Missing table: expenses']);
  });
});
