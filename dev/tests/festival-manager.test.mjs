import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONDITION_FIELDS, DISPLAY_STYLES, NOTE_VISIBILITY } from '../../scripts/constants.mjs';
import FestivalManager from '../../scripts/festivals/festival-manager.mjs';
import NoteManager from '../../scripts/notes/note-manager.mjs';

vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: (key) => key,
  format: (key, data) => {
    let result = key;
    for (const [k, v] of Object.entries(data || {})) result = result.replace(`{${k}}`, String(v));
    return result;
  }
}));
vi.mock('../../scripts/notes/note-manager.mjs', () => {
  const notes = new Map();
  let idCounter = 0;
  return {
    default: {
      getAllNotes: vi.fn(() => Array.from(notes.values())),
      getFullNote: vi.fn((id) => notes.get(id) || null),
      createNote: vi.fn(async ({ name, content, noteData, calendarId }) => {
        const id = `page-${++idCounter}`;
        const stub = { id, name, content: content ?? '', flagData: noteData, calendarId, visible: true };
        notes.set(id, stub);
        return { id, name, system: noteData };
      }),
      deleteNote: vi.fn(async (pageId) => {
        notes.delete(pageId);
        return true;
      }),
      enableBypassDeleteProtection: vi.fn(),
      disableBypassDeleteProtection: vi.fn(),
      _reset: () => {
        notes.clear();
        idCounter = 0;
      },
      _getNotes: () => notes
    }
  };
});

const seededSet = new Set();
globalThis.game = {
  user: { isGM: true },
  time: { components: { year: 1492, month: 0, dayOfMonth: 0, hour: 12, minute: 0 } },
  settings: {
    get: vi.fn(() => seededSet),
    set: vi.fn(async (_module, _key, value) => {
      seededSet.clear();
      for (const v of value) seededSet.add(v);
    })
  }
};

describe('FestivalManager', () => {
  beforeEach(() => {
    NoteManager._reset();
    seededSet.clear();
    vi.clearAllMocks();
  });

  describe('createFestivalNote', () => {
    it('creates a note with month+dayOfMonth condition tree', async () => {
      const calendar = { festivals: { fest1: { name: 'Midwinter', month: 0, dayOfMonth: 14, duration: 1 } }, metadata: { id: 'harptos' }, years: { yearZero: 0 }, monthsArray: [{ days: 31 }], getDaysInMonth: () => 31 };
      await FestivalManager.createFestivalNote('harptos', 'fest1', calendar.festivals.fest1, calendar);
      const notes = NoteManager.getAllNotes();
      expect(notes).toHaveLength(1);
      const noteData = notes[0].flagData;
      expect(noteData.linkedFestival).toEqual({ calendarId: 'harptos', festivalKey: 'fest1', countsForWeekday: true, leapYearOnly: false, leapDuration: null });
      expect(noteData.conditionTree).toEqual({
        type: 'group',
        mode: 'and',
        children: [
          { type: 'condition', field: CONDITION_FIELDS.MONTH, op: '==', value: 1 },
          { type: 'condition', field: CONDITION_FIELDS.DAY, op: '==', value: 15 }
        ]
      });
    });
    it('creates a note with dayOfYear condition tree', async () => {
      const calendar = { festivals: { fest1: { name: 'Spring Festival', dayOfYear: 79, duration: 1 } }, metadata: { id: 'test' }, years: { yearZero: 0 }, monthsArray: [{ days: 31 }, { days: 28 }, { days: 31 }], getDaysInMonth: (m) => [31, 28, 31][m] };
      await FestivalManager.createFestivalNote('test', 'fest1', calendar.festivals.fest1, calendar);
      const notes = NoteManager.getAllNotes();
      expect(notes).toHaveLength(1);
      const tree = notes[0].flagData.conditionTree;
      expect(tree).toEqual({ type: 'condition', field: CONDITION_FIELDS.DAY_OF_YEAR, op: '==', value: 80 });
    });
    it('wraps leapYearOnly festivals with isLeapYear condition', async () => {
      const calendar = { festivals: { fest1: { name: 'Shieldmeet', dayOfYear: 213, duration: 1, leapYearOnly: true } }, metadata: { id: 'harptos' }, years: { yearZero: 0 }, monthsArray: [{ days: 31 }], getDaysInMonth: () => 31 };
      await FestivalManager.createFestivalNote('harptos', 'fest1', calendar.festivals.fest1, calendar);
      const notes = NoteManager.getAllNotes();
      expect(notes).toHaveLength(1);
      const tree = notes[0].flagData.conditionTree;
      expect(tree.type).toBe('group');
      expect(tree.mode).toBe('and');
      expect(tree.children).toHaveLength(2);
      expect(tree.children[0]).toEqual({ type: 'condition', field: CONDITION_FIELDS.IS_LEAP_YEAR, op: '==', value: 1 });
      expect(tree.children[1]).toEqual({ type: 'condition', field: CONDITION_FIELDS.DAY_OF_YEAR, op: '==', value: 214 });
      expect(notes[0].flagData.linkedFestival.leapYearOnly).toBe(true);
    });
    it('carries countsForWeekday and leapDuration onto linkedFestival', async () => {
      const festival = { name: 'Shield', dayOfYear: 214, duration: 1, leapDuration: 2, countsForWeekday: false };
      const calendar = { festivals: { fest1: festival }, metadata: { id: 'harptos' }, years: { yearZero: 0 }, monthsArray: [], getDaysInMonth: () => 30 };
      await FestivalManager.createFestivalNote('harptos', 'fest1', festival, calendar);
      const noteData = NoteManager.getAllNotes()[0].flagData;
      expect(noteData.linkedFestival.countsForWeekday).toBe(false);
      expect(noteData.linkedFestival.leapDuration).toBe(2);
    });
    it('derives startDate from conditionTree when month/dayOfMonth are stale defaults (#628)', async () => {
      const conditionTree = {
        type: 'group',
        mode: 'and',
        children: [
          { type: 'condition', field: 'month', op: '==', value: 8 },
          { type: 'condition', field: 'day', op: '==', value: 12 }
        ]
      };
      const festival = { name: 'Harvest Eve', month: 0, dayOfMonth: 0, conditionTree, duration: 1 };
      const calendar = { festivals: { fest1: festival }, metadata: { id: 'test' }, years: { yearZero: 0 }, monthsArray: [], getDaysInMonth: () => 30 };
      await FestivalManager.createFestivalNote('test', 'fest1', festival, calendar);
      const noteData = NoteManager.getAllNotes()[0].flagData;
      expect(noteData.startDate.month).toBe(7);
      expect(noteData.startDate.dayOfMonth).toBe(11);
    });
  });

  describe('deriveDateFromConditionTree', () => {
    it('extracts month and day from a simple month/day group', () => {
      const tree = {
        type: 'group',
        mode: 'and',
        children: [
          { type: 'condition', field: 'month', op: '==', value: 12 },
          { type: 'condition', field: 'day', op: '==', value: 13 }
        ]
      };
      expect(FestivalManager.deriveDateFromConditionTree(tree)).toEqual({ month: 11, dayOfMonth: 12 });
    });
    it('handles isLeapYear wrapper', () => {
      const tree = {
        type: 'group',
        mode: 'and',
        children: [
          { type: 'condition', field: 'isLeapYear', op: '==', value: 1 },
          {
            type: 'group',
            mode: 'and',
            children: [
              { type: 'condition', field: 'month', op: '==', value: 7 },
              { type: 'condition', field: 'day', op: '==', value: 30 }
            ]
          }
        ]
      };
      expect(FestivalManager.deriveDateFromConditionTree(tree)).toEqual({ month: 6, dayOfMonth: 29 });
    });
    it('returns null for non-fixed-date trees', () => {
      expect(FestivalManager.deriveDateFromConditionTree(null)).toBeNull();
      expect(FestivalManager.deriveDateFromConditionTree({ type: 'condition', field: 'dayOfYear', op: '==', value: 80 })).toBeNull();
      expect(FestivalManager.deriveDateFromConditionTree({ type: 'group', mode: 'or', children: [] })).toBeNull();
    });
    it('coerces string values from legacy condition arrays', () => {
      const tree = {
        type: 'group',
        mode: 'and',
        children: [
          { type: 'condition', field: 'month', op: '==', value: '3' },
          { type: 'condition', field: 'day', op: '==', value: '15' }
        ]
      };
      expect(FestivalManager.deriveDateFromConditionTree(tree)).toEqual({ month: 2, dayOfMonth: 14 });
    });
  });

  describe('note creation properties', () => {
    it('sets correct display properties', async () => {
      const calendar = { festivals: { fest1: { name: 'Greengrass', month: 3, dayOfMonth: 0, color: '#22dd22', icon: 'fa-leaf', duration: 3 } }, metadata: { id: 'test' }, years: { yearZero: 0 }, monthsArray: [], getDaysInMonth: () => 30 };
      await FestivalManager.createFestivalNote('test', 'fest1', calendar.festivals.fest1, calendar);
      const noteData = NoteManager.getAllNotes()[0].flagData;
      expect(noteData.color).toBe('#22dd22');
      expect(noteData.icon).toBe('fas fa-leaf');
      expect(noteData.displayStyle).toBe(DISPLAY_STYLES.BANNER);
      expect(noteData.visibility).toBe(NOTE_VISIBILITY.VISIBLE);
      expect(noteData.categories).toEqual([]);
      expect(noteData.allDay).toBe(true);
      expect(noteData.hasDuration).toBe(true);
      expect(noteData.duration).toBe(3);
      expect(noteData.silent).toBe(true);
    });
    it('uses default color and icon when not specified', async () => {
      const calendar = { festivals: { fest1: { name: 'Simple', month: 0, dayOfMonth: 0 } }, metadata: { id: 'test' }, years: { yearZero: 0 }, monthsArray: [], getDaysInMonth: () => 30 };
      await FestivalManager.createFestivalNote('test', 'fest1', calendar.festivals.fest1, calendar);
      const noteData = NoteManager.getAllNotes()[0].flagData;
      expect(noteData.color).toBe('#f0a500');
      expect(noteData.icon).toBe('fas fa-masks-theater');
      expect(noteData.hasDuration).toBe(false);
      expect(noteData.duration).toBe(1);
    });
    it('reads template fields from festival definition', async () => {
      const festival = { name: 'Harvest', month: 8, dayOfMonth: 21, duration: 1, displayStyle: 'icon', visibility: 'hidden', silent: false, reminderType: 'chat', reminderOffset: 2 };
      const calendar = { festivals: { fest1: festival }, metadata: { id: 'test' }, years: { yearZero: 0 }, monthsArray: [], getDaysInMonth: () => 30 };
      await FestivalManager.createFestivalNote('test', 'fest1', festival, calendar);
      const noteData = NoteManager.getAllNotes()[0].flagData;
      expect(noteData.displayStyle).toBe('icon');
      expect(noteData.visibility).toBe('hidden');
      expect(noteData.silent).toBe(false);
      expect(noteData.reminderType).toBe('chat');
      expect(noteData.reminderOffset).toBe(2);
    });
  });

  describe('seedFestivalNotes', () => {
    it('creates missing notes only (does not duplicate)', async () => {
      const calendar = { festivals: { fest1: { name: 'Festival', month: 0, dayOfMonth: 0, duration: 1 } }, metadata: { id: 'test' }, years: { yearZero: 0 }, monthsArray: [], getDaysInMonth: () => 30 };
      const created1 = await FestivalManager.seedFestivalNotes('test', calendar);
      expect(created1).toBe(1);
      expect(NoteManager.getAllNotes()).toHaveLength(1);
      const created2 = await FestivalManager.seedFestivalNotes('test', calendar);
      expect(created2).toBe(0);
      expect(NoteManager.getAllNotes()).toHaveLength(1);
    });
    it('skips seeding when the calendar is already marked seeded', async () => {
      seededSet.add('test');
      const calendar = { festivals: { fest1: { name: 'Festival A', month: 0, dayOfMonth: 0, duration: 1 } }, metadata: { id: 'test' }, years: { yearZero: 0 }, monthsArray: [], getDaysInMonth: () => 30 };
      const created = await FestivalManager.seedFestivalNotes('test', calendar);
      expect(created).toBe(0);
      expect(NoteManager.getAllNotes()).toHaveLength(0);
    });
    it('records the calendar in the seeded-calendars set', async () => {
      const calendar = { festivals: { fest1: { name: 'Festival', month: 0, dayOfMonth: 0, duration: 1 } }, metadata: { id: 'test' }, years: { yearZero: 0 }, monthsArray: [], getDaysInMonth: () => 30 };
      await FestivalManager.seedFestivalNotes('test', calendar);
      expect(seededSet.has('test')).toBe(true);
    });
  });

  describe('clearSeedRecord', () => {
    it('removes the calendar from the seeded set', async () => {
      seededSet.add('test');
      await FestivalManager.clearSeedRecord('test');
      expect(seededSet.has('test')).toBe(false);
    });
  });

  describe('deleteFestivalNote', () => {
    it('deletes a single festival note by key', async () => {
      const calendar = {
        festivals: { fest1: { name: 'Festival A', month: 0, dayOfMonth: 0, duration: 1 }, fest2: { name: 'Festival B', month: 5, dayOfMonth: 10, duration: 1 } },
        metadata: { id: 'test' },
        years: { yearZero: 0 },
        monthsArray: [],
        getDaysInMonth: () => 30
      };
      await FestivalManager.seedFestivalNotes('test', calendar);
      expect(NoteManager.getAllNotes()).toHaveLength(2);
      const deleted = await FestivalManager.deleteFestivalNote('test', 'fest1');
      expect(deleted).toBe(true);
      expect(NoteManager.getAllNotes()).toHaveLength(1);
      expect(NoteManager.getAllNotes()[0].name).toBe('Festival B');
      expect(NoteManager.enableBypassDeleteProtection).toHaveBeenCalled();
      expect(NoteManager.disableBypassDeleteProtection).toHaveBeenCalled();
    });
    it('returns false for nonexistent key', async () => {
      const deleted = await FestivalManager.deleteFestivalNote('test', 'nonexistent');
      expect(deleted).toBe(false);
    });
  });

  describe('deleteAllFestivalNotes', () => {
    it('deletes all festival notes for a calendar', async () => {
      const calendar = {
        festivals: { fest1: { name: 'Festival A', month: 0, dayOfMonth: 0, duration: 1 }, fest2: { name: 'Festival B', month: 5, dayOfMonth: 10, duration: 1 } },
        metadata: { id: 'test' },
        years: { yearZero: 0 },
        monthsArray: [],
        getDaysInMonth: () => 30
      };
      await FestivalManager.seedFestivalNotes('test', calendar);
      expect(NoteManager.getAllNotes()).toHaveLength(2);
      const count = await FestivalManager.deleteAllFestivalNotes('test');
      expect(count).toBe(2);
      expect(NoteManager.getAllNotes()).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('skips seed for non-GM users', async () => {
      game.user.isGM = false;
      const calendar = { festivals: { fest1: { name: 'Test', month: 0, dayOfMonth: 0 } }, metadata: { id: 'test' } };
      await FestivalManager.seedFestivalNotes('test', calendar);
      expect(NoteManager.createNote).not.toHaveBeenCalled();
      game.user.isGM = true;
    });
    it('handles calendar with no festivals', async () => {
      const calendar = { festivals: {}, metadata: { id: 'test' } };
      const created = await FestivalManager.seedFestivalNotes('test', calendar);
      expect(created).toBe(0);
      expect(NoteManager.createNote).not.toHaveBeenCalled();
    });
    it('handles null calendar gracefully', async () => {
      const created = await FestivalManager.seedFestivalNotes('test', null);
      expect(created).toBe(0);
      expect(NoteManager.createNote).not.toHaveBeenCalled();
    });
    it('handles missing calendarId gracefully', async () => {
      const created = await FestivalManager.seedFestivalNotes(null, {});
      expect(created).toBe(0);
      expect(NoteManager.createNote).not.toHaveBeenCalled();
    });
  });

  describe('getFestivalNotes', () => {
    it('returns only festival notes for the given calendar', async () => {
      const calendarA = { festivals: { fest1: { name: 'Fest A', month: 0, dayOfMonth: 0, duration: 1 } }, metadata: { id: 'calA' }, years: { yearZero: 0 }, monthsArray: [], getDaysInMonth: () => 30 };
      const calendarB = { festivals: { fest1: { name: 'Fest B', month: 0, dayOfMonth: 0, duration: 1 } }, metadata: { id: 'calB' }, years: { yearZero: 0 }, monthsArray: [], getDaysInMonth: () => 30 };
      await FestivalManager.seedFestivalNotes('calA', calendarA);
      await FestivalManager.seedFestivalNotes('calB', calendarB);
      const notesA = FestivalManager.getFestivalNotes('calA');
      const notesB = FestivalManager.getFestivalNotes('calB');
      expect(notesA).toHaveLength(1);
      expect(notesB).toHaveLength(1);
      expect(notesA[0].flagData.linkedFestival.calendarId).toBe('calA');
      expect(notesB[0].flagData.linkedFestival.calendarId).toBe('calB');
    });
  });

  describe('getFestivalNoteByKey', () => {
    it('returns the correct festival note by key', async () => {
      const calendar = {
        festivals: { midwinter: { name: 'Midwinter', month: 0, dayOfMonth: 14, duration: 1 }, greengrass: { name: 'Greengrass', month: 3, dayOfMonth: 0, duration: 1 } },
        metadata: { id: 'test' },
        years: { yearZero: 0 },
        monthsArray: [],
        getDaysInMonth: () => 30
      };
      await FestivalManager.seedFestivalNotes('test', calendar);
      const note = FestivalManager.getFestivalNoteByKey('test', 'greengrass');
      expect(note).not.toBeNull();
      expect(note.name).toBe('Greengrass');
      const missing = FestivalManager.getFestivalNoteByKey('test', 'nonexistent');
      expect(missing).toBeNull();
    });
  });

  describe('dayOfYear to startDate conversion', () => {
    it('converts dayOfYear to correct month and dayOfMonth', async () => {
      const calendar = { festivals: { fest1: { name: 'Test', dayOfYear: 31, duration: 1 } }, metadata: { id: 'test' }, years: { yearZero: 0 }, monthsArray: [{ days: 31 }, { days: 28 }], getDaysInMonth: (m) => [31, 28][m] || 30 };
      await FestivalManager.createFestivalNote('test', 'fest1', calendar.festivals.fest1, calendar);
      const noteData = NoteManager.getAllNotes()[0].flagData;
      expect(noteData.startDate.month).toBe(1);
      expect(noteData.startDate.dayOfMonth).toBe(0);
    });
  });
});
