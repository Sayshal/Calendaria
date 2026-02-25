/**
 * Tests for event-scheduler.mjs
 * Covers: onUpdateWorldTime flow, trigger detection, notification types, multi-day progress.
 * @module Tests/EventScheduler
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: vi.fn((key) => key),
  format: vi.fn((key, data) => {
    let result = key;
    for (const [k, v] of Object.entries(data || {})) result = result.replace(`{${k}}`, String(v));
    return result;
  })
}));
vi.mock('../../scripts/utils/socket.mjs', () => ({
  CalendariaSocket: { isPrimaryGM: vi.fn(() => true), emit: vi.fn() }
}));
vi.mock('../../scripts/constants.mjs', () => ({
  MODULE: { ID: 'calendaria' },
  HOOKS: {
    EVENT_TRIGGERED: 'calendaria.eventTriggered',
    EVENT_DAY_CHANGED: 'calendaria.eventDayChanged'
  },
  TEMPLATES: { PARTIALS: { CHAT_ANNOUNCEMENT: 'chat-announcement.hbs' } }
}));
vi.mock('../../scripts/notes/date-utils.mjs', () => {
  let currentDate = { year: 1, month: 0, day: 1, hour: 12, minute: 0 };
  return {
    getCurrentDate: vi.fn(() => currentDate),
    compareDates: vi.fn((a, b) => {
      if (a.year !== b.year) return a.year < b.year ? -1 : 1;
      if (a.month !== b.month) return a.month < b.month ? -1 : 1;
      if (a.day !== b.day) return a.day < b.day ? -1 : 1;
      return 0;
    }),
    _setCurrentDate: (d) => {
      currentDate = d;
    }
  };
});
vi.mock('../../scripts/notes/note-manager.mjs', () => ({
  default: {
    getAllNotes: vi.fn(() => []),
    getFullNote: vi.fn(() => null),
    isInitialized: vi.fn(() => true),
    getCategoryDefinition: vi.fn(() => null)
  }
}));
vi.mock('../../scripts/calendar/calendar-manager.mjs', () => ({
  default: {
    getActiveCalendar: vi.fn(() => ({
      monthsArray: [{ name: 'January', days: 31 }],
      days: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
      componentsToTime: vi.fn((c) => {
        const spd = 86400;
        return c.year * 365 * spd + c.month * 30 * spd + (c.dayOfMonth ?? 0) * spd;
      })
    }))
  }
}));
vi.mock('../../scripts/notes/recurrence.mjs', () => ({
  needsRandomRegeneration: vi.fn(() => false),
  generateRandomOccurrences: vi.fn(() => [])
}));

import EventScheduler from '../../scripts/time/event-scheduler.mjs';
import NoteManager from '../../scripts/notes/note-manager.mjs';
import { CalendariaSocket } from '../../scripts/utils/socket.mjs';
import { _setCurrentDate } from '../../scripts/notes/date-utils.mjs';

const makeNote = (id, name, startDate, flagOverrides = {}) => ({
  id,
  name,
  journalId: `j-${id}`,
  flagData: {
    startDate,
    allDay: false,
    categories: [],
    color: '#4a9eff',
    icon: 'fas fa-calendar',
    macro: null,
    gmOnly: false,
    silent: false,
    ...flagOverrides
  }
});

// Increasing counter so worldTime always exceeds #lastTriggerCheckTime from prior tests
let worldTimeBase = 0;
const WT = () => worldTimeBase + EventScheduler.TRIGGER_CHECK_INTERVAL + 1;

beforeEach(() => {
  worldTimeBase += 1_000_000;
  CalendariaSocket.isPrimaryGM.mockReturnValue(true);
  NoteManager.isInitialized.mockReturnValue(true);
  NoteManager.getAllNotes.mockReturnValue([]);
  NoteManager.getFullNote.mockReturnValue(null);
  // Force a day change to clear #triggeredToday (static state persists between tests)
  _setCurrentDate({ year: 0, month: 0, day: 99, hour: 0, minute: 0 });
  EventScheduler.initialize();
  _setCurrentDate({ year: 1, month: 0, day: 1, hour: 12, minute: 0 });
  EventScheduler.onUpdateWorldTime(worldTimeBase, 0);
  // Clear mocks after priming so tests start clean
  Hooks.callAll.mockClear();
  NoteManager.getAllNotes.mockClear();
  NoteManager.getFullNote.mockClear();
  ui.notifications.info.mockClear();
  ui.notifications.warn.mockClear();
});

/* -------------------------------------------- */
/*  onUpdateWorldTime — basic flow               */
/* -------------------------------------------- */

describe('EventScheduler.onUpdateWorldTime()', () => {
  it('does nothing when not primary GM', () => {
    CalendariaSocket.isPrimaryGM.mockReturnValue(false);
    EventScheduler.onUpdateWorldTime(WT(), 1800);
    expect(NoteManager.getAllNotes).not.toHaveBeenCalled();
  });

  it('does nothing when NoteManager not initialized', () => {
    NoteManager.isInitialized.mockReturnValue(false);
    EventScheduler.onUpdateWorldTime(WT(), 1800);
    expect(NoteManager.getAllNotes).not.toHaveBeenCalled();
  });

  it('checks triggers after TRIGGER_CHECK_INTERVAL', () => {
    const note = makeNote('e1', 'Event', { year: 1, month: 0, day: 1, hour: 13, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 14, minute: 0 });
    EventScheduler.onUpdateWorldTime(WT(), EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.info).toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Trigger detection (shouldTrigger via API)    */
/* -------------------------------------------- */

describe('EventScheduler — trigger detection', () => {
  it('triggers event when time crosses start time', () => {
    const note = makeNote('e1', 'Meeting', { year: 1, month: 0, day: 1, hour: 13, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 14, minute: 0 });
    EventScheduler.onUpdateWorldTime(WT(), EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.info).toHaveBeenCalled();
  });

  it('does not trigger event when time has not reached start', () => {
    const note = makeNote('e1', 'Meeting', { year: 1, month: 0, day: 1, hour: 20, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 14, minute: 0 });
    EventScheduler.onUpdateWorldTime(WT(), EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.info).not.toHaveBeenCalled();
  });

  it('does not trigger same event twice in same day', () => {
    const note = makeNote('e1', 'Meeting', { year: 1, month: 0, day: 1, hour: 13, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 12, minute: 0 });
    EventScheduler.initialize();
    // First trigger
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 14, minute: 0 });
    const wt1 = WT();
    EventScheduler.onUpdateWorldTime(wt1, EventScheduler.TRIGGER_CHECK_INTERVAL);
    // Second call (same day, already triggered) — use wt1 + interval to pass threshold
    EventScheduler.onUpdateWorldTime(wt1 + EventScheduler.TRIGGER_CHECK_INTERVAL + 1, EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.info).toHaveBeenCalledTimes(1);
  });

  it('clears triggered set on date change', () => {
    const note = makeNote('e1', 'Meeting', { year: 1, month: 0, day: 2, hour: 10, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 23, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, day: 2, hour: 11, minute: 0 });
    EventScheduler.onUpdateWorldTime(WT(), EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.info).toHaveBeenCalled();
  });

  it('triggers all-day event at start of day', () => {
    const note = makeNote('e1', 'Holiday', { year: 1, month: 0, day: 2 }, { allDay: true });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 23, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, day: 2, hour: 1, minute: 0 });
    EventScheduler.onUpdateWorldTime(WT(), EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.info).toHaveBeenCalled();
  });

  it('skips silent events', () => {
    const note = makeNote('e1', 'Silent Event', { year: 1, month: 0, day: 1, hour: 13, minute: 0 }, { silent: true });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 14, minute: 0 });
    EventScheduler.onUpdateWorldTime(WT(), EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.info).not.toHaveBeenCalled();
  });

  it('fires EVENT_TRIGGERED hook', () => {
    const note = makeNote('e1', 'Meeting', { year: 1, month: 0, day: 1, hour: 13, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 14, minute: 0 });
    EventScheduler.onUpdateWorldTime(WT(), EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.eventTriggered', expect.objectContaining({ id: 'e1', name: 'Meeting' }));
  });
});

/* -------------------------------------------- */
/*  Notification type                            */
/* -------------------------------------------- */

describe('EventScheduler — notification types', () => {
  it('uses warn for deadline category', () => {
    const note = makeNote('e1', 'Due Date', { year: 1, month: 0, day: 1, hour: 13, minute: 0 }, { categories: ['deadline'] });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 14, minute: 0 });
    EventScheduler.onUpdateWorldTime(WT(), EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  it('uses warn for combat category', () => {
    const note = makeNote('e1', 'Battle', { year: 1, month: 0, day: 1, hour: 13, minute: 0 }, { categories: ['combat'] });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 14, minute: 0 });
    EventScheduler.onUpdateWorldTime(WT(), EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.warn).toHaveBeenCalled();
  });

  it('uses info for regular categories', () => {
    const note = makeNote('e1', 'Quest', { year: 1, month: 0, day: 1, hour: 13, minute: 0 }, { categories: ['quest'] });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 14, minute: 0 });
    EventScheduler.onUpdateWorldTime(WT(), EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.info).toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Multi-day progress                           */
/* -------------------------------------------- */

describe('EventScheduler — multi-day events', () => {
  it('shows progress notification for multi-day event in progress', () => {
    const note = makeNote(
      'e1',
      'Festival',
      { year: 1, month: 0, day: 1 },
      {
        endDate: { year: 1, month: 0, day: 5 },
        allDay: true
      }
    );
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 23, minute: 0 });
    EventScheduler.initialize();
    // Day 2 of 5
    _setCurrentDate({ year: 1, month: 0, day: 2, hour: 8, minute: 0 });
    EventScheduler.onUpdateWorldTime(WT(), EventScheduler.TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.info).toHaveBeenCalled();
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.eventDayChanged', expect.objectContaining({ id: 'e1' }));
  });
});
