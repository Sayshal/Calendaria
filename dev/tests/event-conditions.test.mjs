import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';
import { CONDITION_FIELDS, CONDITION_OPERATORS } from '../../scripts/constants.mjs';
import { evaluateCondition } from '../../scripts/notes/condition-engine.mjs';
import { detectCycles, extractEventDependencies } from '../../scripts/notes/event-dependency-resolver.mjs';
import NoteManager from '../../scripts/notes/note-manager.mjs';
import { ensureFieldHandlersRegistered, isRecurringMatch } from '../../scripts/notes/recurrence.mjs';

vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: (key) => key,
  format: (key, data) => {
    let result = key;
    for (const [k, v] of Object.entries(data || {})) result = result.replace(`{${k}}`, String(v));
    return result;
  }
}));
vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager };
});
vi.mock('../../scripts/weather/weather-manager.mjs', async () => {
  const { default: WeatherManager } = await import('../__mocks__/weather-manager.mjs');
  return { default: WeatherManager };
});
vi.mock('../../scripts/notes/note-manager.mjs', async () => {
  const { default: NoteManager } = await import('../__mocks__/note-manager.mjs');
  return { default: NoteManager };
});

beforeEach(() => {
  CalendarManager._reset();
  NoteManager.getNote.mockReset();
  NoteManager.getAllNotes.mockReset();
  NoteManager.getAllNotes.mockReturnValue([]);
  ensureFieldHandlersRegistered();
});

describe('Event Condition: daysAgo', () => {
  it('matches when referenced event occurred exactly N days ago', () => {
    const eventAData = { repeat: 'never', startDate: { year: 1492, month: 0, dayOfMonth: 0 } };
    NoteManager.getNote.mockImplementation((id) => {
      if (id === 'eventA') return { id: 'eventA', flagData: eventAData };
      return null;
    });
    const condition = { field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 3, value2: { noteId: 'eventA' } };
    const match = evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 3 });
    expect(match).toBe(true);
    const noMatch = evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 2 });
    expect(noMatch).toBe(false);
  });
  it('matches with value 0 (event occurring today)', () => {
    const eventAData = { repeat: 'never', startDate: { year: 1492, month: 0, dayOfMonth: 5 } };
    NoteManager.getNote.mockImplementation((id) => {
      if (id === 'eventA') return { id: 'eventA', flagData: eventAData };
      return null;
    });
    const condition = { field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 0, value2: { noteId: 'eventA' } };
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 5 })).toBe(true);
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 6 })).toBe(false);
  });
});

describe('Event Condition: daysFromNow', () => {
  it('matches when referenced event occurs exactly N days from now', () => {
    const eventAData = { repeat: 'never', startDate: { year: 1492, month: 0, dayOfMonth: 10 } };
    NoteManager.getNote.mockImplementation((id) => {
      if (id === 'eventA') return { id: 'eventA', flagData: eventAData };
      return null;
    });
    const condition = { field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_FROM_NOW, value: 5, value2: { noteId: 'eventA' } };
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 5 })).toBe(true);
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 4 })).toBe(false);
  });
});

describe('Event Condition: withinLast', () => {
  it('matches when referenced event occurred within last N days (inclusive)', () => {
    const eventAData = { repeat: 'never', startDate: { year: 1492, month: 0, dayOfMonth: 5 } };
    NoteManager.getNote.mockImplementation((id) => {
      if (id === 'eventA') return { id: 'eventA', flagData: eventAData };
      return null;
    });
    const condition = { field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.WITHIN_LAST, value: 3, value2: { noteId: 'eventA', inclusive: true } };
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 5 })).toBe(true);
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 6 })).toBe(true);
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 8 })).toBe(true);
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 9 })).toBe(false);
  });
  it('respects exclusive flag', () => {
    const eventAData = { repeat: 'never', startDate: { year: 1492, month: 0, dayOfMonth: 5 } };
    NoteManager.getNote.mockImplementation((id) => {
      if (id === 'eventA') return { id: 'eventA', flagData: eventAData };
      return null;
    });
    const condition = { field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.WITHIN_LAST, value: 3, value2: { noteId: 'eventA', inclusive: false } };
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 5 })).toBe(false);
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 6 })).toBe(true);
  });
});

describe('Event Condition: withinNext', () => {
  it('matches when referenced event occurs within next N days (inclusive)', () => {
    const eventAData = { repeat: 'never', startDate: { year: 1492, month: 0, dayOfMonth: 10 } };
    NoteManager.getNote.mockImplementation((id) => {
      if (id === 'eventA') return { id: 'eventA', flagData: eventAData };
      return null;
    });
    const condition = { field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.WITHIN_NEXT, value: 3, value2: { noteId: 'eventA', inclusive: true } };
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 10 })).toBe(true);
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 9 })).toBe(true);
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 7 })).toBe(true);
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 6 })).toBe(false);
  });
});

describe('Circular dependency guard', () => {
  it('does not infinite loop on A→B→A cycle', () => {
    const eventAData = {
      repeat: 'never',
      startDate: { year: 1492, month: 0, dayOfMonth: 0 },
      conditionTree: { type: 'condition', field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 0, value2: { noteId: 'eventB' } }
    };
    const eventBData = {
      repeat: 'never',
      startDate: { year: 1492, month: 0, dayOfMonth: 0 },
      conditionTree: { type: 'condition', field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 0, value2: { noteId: 'eventA' } }
    };
    NoteManager.getNote.mockImplementation((id) => {
      if (id === 'eventA') return { id: 'eventA', flagData: eventAData };
      if (id === 'eventB') return { id: 'eventB', flagData: eventBData };
      return null;
    });
    const condition = { field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 0, value2: { noteId: 'eventA' } };
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('returns false for missing note reference', () => {
    NoteManager.getNote.mockReturnValue(null);
    const condition = { field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 0, value2: { noteId: 'nonexistent' } };
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('returns false for missing noteId in value2', () => {
    const condition = { field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 0, value2: {} };
    expect(evaluateCondition(condition, { year: 1492, month: 0, dayOfMonth: 0 })).toBe(false);
  });
});

describe('Event chaining via condition tree', () => {
  it('note B fires 2 days after note A using conditionTree', () => {
    const eventAData = { repeat: 'never', startDate: { year: 1492, month: 0, dayOfMonth: 5 } };
    const eventBData = {
      startDate: { year: 1492, month: 0, dayOfMonth: 0 },
      conditionTree: { type: 'condition', field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 2, value2: { noteId: 'eventA' } }
    };
    NoteManager.getNote.mockImplementation((id) => {
      if (id === 'eventA') return { id: 'eventA', flagData: eventAData };
      return null;
    });
    expect(isRecurringMatch(eventBData, { year: 1492, month: 0, dayOfMonth: 7 })).toBe(true);
    expect(isRecurringMatch(eventBData, { year: 1492, month: 0, dayOfMonth: 6 })).toBe(false);
    expect(isRecurringMatch(eventBData, { year: 1491, month: 11, dayOfMonth: 29 })).toBe(false);
  });
});

describe('extractEventDependencies()', () => {
  it('extracts note IDs from flat event condition', () => {
    const tree = { type: 'condition', field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 0, value2: { noteId: 'abc123' } };
    expect(extractEventDependencies(tree)).toEqual(['abc123']);
  });
  it('extracts note IDs from nested groups', () => {
    const tree = {
      type: 'group',
      mode: 'and',
      children: [
        { type: 'condition', field: 'day', op: '==', value: 1 },
        {
          type: 'group',
          mode: 'or',
          children: [
            { type: 'condition', field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 0, value2: { noteId: 'note1' } },
            { type: 'condition', field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 0, value2: { noteId: 'note2' } }
          ]
        }
      ]
    };
    const deps = extractEventDependencies(tree);
    expect(deps).toHaveLength(2);
    expect(deps).toContain('note1');
    expect(deps).toContain('note2');
  });
  it('deduplicates note IDs', () => {
    const tree = {
      type: 'group',
      mode: 'and',
      children: [
        { type: 'condition', field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 0, value2: { noteId: 'same' } },
        { type: 'condition', field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.WITHIN_LAST, value: 3, value2: { noteId: 'same' } }
      ]
    };
    expect(extractEventDependencies(tree)).toEqual(['same']);
  });
  it('returns empty array for null tree', () => {
    expect(extractEventDependencies(null)).toEqual([]);
  });
  it('returns empty array for non-event conditions', () => {
    const tree = { type: 'condition', field: 'day', op: '==', value: 1 };
    expect(extractEventDependencies(tree)).toEqual([]);
  });
});

describe('detectCycles()', () => {
  it('detects simple A→B→A cycle', () => {
    NoteManager.getAllNotes.mockReturnValue([
      { id: 'A', flagData: { connectedEvents: ['B'] } },
      { id: 'B', flagData: { connectedEvents: [] } }
    ]);
    const result = detectCycles('B', ['A']);
    expect(result.hasCycle).toBe(true);
    expect(result.cycleNodes).toContain('A');
    expect(result.cycleNodes).toContain('B');
  });
  it('detects longer A→B→C→A cycle', () => {
    NoteManager.getAllNotes.mockReturnValue([
      { id: 'A', flagData: { connectedEvents: ['B'] } },
      { id: 'B', flagData: { connectedEvents: ['C'] } },
      { id: 'C', flagData: { connectedEvents: [] } }
    ]);
    const result = detectCycles('C', ['A']);
    expect(result.hasCycle).toBe(true);
  });
  it('allows diamond dependency (no cycle)', () => {
    NoteManager.getAllNotes.mockReturnValue([
      { id: 'A', flagData: { connectedEvents: ['C'] } },
      { id: 'B', flagData: { connectedEvents: ['C'] } },
      { id: 'C', flagData: { connectedEvents: [] } },
      { id: 'D', flagData: { connectedEvents: [] } }
    ]);
    const result = detectCycles('D', ['A', 'B']);
    expect(result.hasCycle).toBe(false);
  });
  it('detects self-reference', () => {
    NoteManager.getAllNotes.mockReturnValue([{ id: 'A', flagData: { connectedEvents: [] } }]);
    const result = detectCycles('A', ['A']);
    expect(result.hasCycle).toBe(true);
  });
  it('returns no cycle for independent notes', () => {
    NoteManager.getAllNotes.mockReturnValue([
      { id: 'A', flagData: { connectedEvents: [] } },
      { id: 'B', flagData: { connectedEvents: [] } }
    ]);
    const result = detectCycles('C', ['A']);
    expect(result.hasCycle).toBe(false);
  });
});

describe('Migration: linked → condition tree', () => {
  it('converts linked with offset 0 to daysAgo:0', () => {
    const eventAData = { repeat: 'never', startDate: { year: 1492, month: 0, dayOfMonth: 5 } };
    NoteManager.getNote.mockImplementation((id) => {
      if (id === 'parentNote') return { id: 'parentNote', flagData: eventAData };
      return null;
    });
    const migratedData = {
      startDate: { year: 1492, month: 0, dayOfMonth: 0 },
      conditionTree: { type: 'condition', field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 0, value2: { noteId: 'parentNote' } }
    };
    expect(isRecurringMatch(migratedData, { year: 1492, month: 0, dayOfMonth: 5 })).toBe(true);
    expect(isRecurringMatch(migratedData, { year: 1492, month: 0, dayOfMonth: 6 })).toBe(false);
  });
  it('converts linked with positive offset to daysAgo:N', () => {
    const eventAData = { repeat: 'never', startDate: { year: 1492, month: 0, dayOfMonth: 5 } };
    NoteManager.getNote.mockImplementation((id) => {
      if (id === 'parentNote') return { id: 'parentNote', flagData: eventAData };
      return null;
    });
    const migratedData = {
      startDate: { year: 1492, month: 0, dayOfMonth: 0 },
      conditionTree: { type: 'condition', field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_AGO, value: 3, value2: { noteId: 'parentNote' } }
    };
    expect(isRecurringMatch(migratedData, { year: 1492, month: 0, dayOfMonth: 8 })).toBe(true);
    expect(isRecurringMatch(migratedData, { year: 1492, month: 0, dayOfMonth: 7 })).toBe(false);
  });

  it('converts linked with negative offset to daysFromNow:N', () => {
    const eventAData = { repeat: 'never', startDate: { year: 1492, month: 0, dayOfMonth: 10 } };
    NoteManager.getNote.mockImplementation((id) => {
      if (id === 'parentNote') return { id: 'parentNote', flagData: eventAData };
      return null;
    });
    const migratedData = {
      startDate: { year: 1492, month: 0, dayOfMonth: 0 },
      conditionTree: { type: 'condition', field: CONDITION_FIELDS.EVENT, op: CONDITION_OPERATORS.DAYS_FROM_NOW, value: 2, value2: { noteId: 'parentNote' } }
    };
    expect(isRecurringMatch(migratedData, { year: 1492, month: 0, dayOfMonth: 8 })).toBe(true);
    expect(isRecurringMatch(migratedData, { year: 1492, month: 0, dayOfMonth: 9 })).toBe(false);
  });
});
