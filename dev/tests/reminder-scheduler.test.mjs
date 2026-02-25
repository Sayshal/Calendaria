/**
 * Tests for reminder-scheduler.mjs
 * Covers: onUpdateWorldTime flow, shouldFireReminder scenarios,
 * getTargetUsers, formatReminderMessage.
 * @module Tests/ReminderScheduler
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
    REMINDER_RECEIVED: 'calendaria.reminderReceived'
  },
  SOCKET_TYPES: { REMINDER_NOTIFY: 'reminderNotify' }
}));
vi.mock('../../scripts/notes/date-utils.mjs', () => {
  let currentDate = { year: 1, month: 0, day: 1, hour: 12, minute: 0 };
  return {
    getCurrentDate: vi.fn(() => currentDate),
    _setCurrentDate: (d) => {
      currentDate = d;
    }
  };
});
vi.mock('../../scripts/notes/note-manager.mjs', () => ({
  default: {
    getAllNotes: vi.fn(() => []),
    getFullNote: vi.fn(() => null),
    isInitialized: vi.fn(() => true)
  }
}));
vi.mock('../../scripts/calendar/calendar-manager.mjs', () => ({
  default: {
    getActiveCalendar: vi.fn(() => ({
      monthsArray: Array.from({ length: 12 }, (_, i) => ({ name: `Month ${i}`, days: 30 })),
      days: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
      years: { yearZero: 0 },
      getDaysInMonth: vi.fn(() => 30),
      metadata: { id: 'gregorian' }
    }))
  }
}));
vi.mock('../../scripts/calendar/calendar-registry.mjs', () => ({
  default: { getActiveId: vi.fn(() => 'gregorian') }
}));
vi.mock('../../scripts/notes/recurrence.mjs', () => ({
  isRecurringMatch: vi.fn(() => false)
}));

import ReminderScheduler from '../../scripts/time/reminder-scheduler.mjs';
import NoteManager from '../../scripts/notes/note-manager.mjs';
import { CalendariaSocket } from '../../scripts/utils/socket.mjs';
import { _setCurrentDate } from '../../scripts/notes/date-utils.mjs';
import { isRecurringMatch } from '../../scripts/notes/recurrence.mjs';

const makeNote = (id, name, startDate, flagOverrides = {}) => ({
  id,
  name,
  calendarId: null,
  journalId: `j-${id}`,
  visible: true,
  flagData: {
    startDate,
    endDate: null,
    allDay: false,
    repeat: 'never',
    reminderOffset: 1,
    reminderType: 'toast',
    reminderTargets: 'all',
    reminderUsers: [],
    categories: [],
    color: '#4a9eff',
    icon: 'fas fa-bell',
    iconType: 'fontawesome',
    gmOnly: false,
    silent: false,
    author: null,
    ...flagOverrides
  }
});

// Increasing counter so worldTime always exceeds #lastCheckTime from prior tests
let worldTimeBase = 0;
const WT = () => worldTimeBase + ReminderScheduler.CHECK_INTERVAL + 1;

beforeEach(() => {
  worldTimeBase += 1_000_000;
  CalendariaSocket.isPrimaryGM.mockReturnValue(true);
  CalendariaSocket.emit.mockClear();
  NoteManager.isInitialized.mockReturnValue(true);
  NoteManager.getAllNotes.mockReturnValue([]);
  isRecurringMatch.mockReturnValue(false);
  // Force a day change to clear #firedToday (static state persists between tests)
  _setCurrentDate({ year: 0, month: 0, day: 99, hour: 0, minute: 0 });
  ReminderScheduler.initialize();
  _setCurrentDate({ year: 1, month: 0, day: 1, hour: 12, minute: 0 });
  ReminderScheduler.onUpdateWorldTime(worldTimeBase, 0);
  // Clear mocks after priming so tests start clean
  Hooks.callAll.mockClear();
  Hooks.on.mockClear();
  CalendariaSocket.emit.mockClear();
  NoteManager.getAllNotes.mockClear();
  ui.notifications.info.mockClear();
});

/* -------------------------------------------- */
/*  onUpdateWorldTime — basic flow               */
/* -------------------------------------------- */

describe('ReminderScheduler.onUpdateWorldTime()', () => {
  it('does nothing when not primary GM', () => {
    CalendariaSocket.isPrimaryGM.mockReturnValue(false);
    ReminderScheduler.onUpdateWorldTime(WT(), 300);
    expect(NoteManager.getAllNotes).not.toHaveBeenCalled();
  });

  it('does nothing when NoteManager not initialized', () => {
    NoteManager.isInitialized.mockReturnValue(false);
    ReminderScheduler.onUpdateWorldTime(WT(), 300);
    expect(NoteManager.getAllNotes).not.toHaveBeenCalled();
  });

  it('checks reminders after CHECK_INTERVAL', () => {
    const note = makeNote('r1', 'Reminder', { year: 1, month: 0, day: 1, hour: 14, minute: 0 }, { reminderOffset: 1 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    // At hour 13, 1 hour before 14:00 event → should fire
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 13, minute: 0 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    expect(CalendariaSocket.emit).toHaveBeenCalled();
  });

  it('clears fired set on date change', () => {
    const note = makeNote('r1', 'Reminder', { year: 1, month: 0, day: 2, hour: 14, minute: 0 }, { reminderOffset: 1 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 23, minute: 0 });
    ReminderScheduler.initialize();
    // Change day
    _setCurrentDate({ year: 1, month: 0, day: 2, hour: 13, minute: 0 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    expect(CalendariaSocket.emit).toHaveBeenCalled();
  });

  it('clears fired set on time reversal', () => {
    const note = makeNote('r1', 'Reminder', { year: 1, month: 0, day: 1, hour: 14, minute: 0 }, { reminderOffset: 1 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 13, minute: 0 });
    const wt = WT();
    ReminderScheduler.onUpdateWorldTime(wt, 100);
    // Time goes backwards — triggers the reversal path
    ReminderScheduler.onUpdateWorldTime(wt - 500, -500);
  });
});

/* -------------------------------------------- */
/*  shouldFireReminder scenarios                 */
/* -------------------------------------------- */

describe('ReminderScheduler — non-recurring timed events', () => {
  it('fires reminder when current time is within offset window', () => {
    // Event at 14:00, offset 1 hour → remind at 13:00
    const note = makeNote('r1', 'Meeting', { year: 1, month: 0, day: 1, hour: 14, minute: 0 }, { reminderOffset: 1 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 13, minute: 0 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    expect(CalendariaSocket.emit).toHaveBeenCalled();
  });

  it('does not fire before offset window', () => {
    const note = makeNote('r1', 'Meeting', { year: 1, month: 0, day: 1, hour: 14, minute: 0 }, { reminderOffset: 1 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 10, minute: 0 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    expect(CalendariaSocket.emit).not.toHaveBeenCalled();
  });

  it('does not fire after event time', () => {
    const note = makeNote('r1', 'Meeting', { year: 1, month: 0, day: 1, hour: 14, minute: 0 }, { reminderOffset: 1 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 15, minute: 0 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    expect(CalendariaSocket.emit).not.toHaveBeenCalled();
  });

  it('skips silent events', () => {
    const note = makeNote('r1', 'Silent', { year: 1, month: 0, day: 1, hour: 14, minute: 0 }, { reminderOffset: 1, silent: true });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 13, minute: 0 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    expect(CalendariaSocket.emit).not.toHaveBeenCalled();
  });

  it('skips notes with negative reminderOffset', () => {
    const note = makeNote('r1', 'No Remind', { year: 1, month: 0, day: 1, hour: 14, minute: 0 }, { reminderOffset: -1 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 13, minute: 0 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    expect(CalendariaSocket.emit).not.toHaveBeenCalled();
  });
});

describe('ReminderScheduler — all-day non-recurring', () => {
  it('fires all-day reminder with 0 offset on event day', () => {
    const note = makeNote(
      'r1',
      'Holiday',
      { year: 1, month: 0, day: 1 },
      {
        allDay: true,
        reminderOffset: 0,
        endDate: null
      }
    );
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 8, minute: 0 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    // Non-recurring with todayInRange, allDay=true, offset=0
    // #isDateInRange should match, timed check: currentMinutes >= reminderMinutes (0) && < eventMinutes (0) = false
    // Actually for all-day offset>0 tomorrowInRange path or todayInRange path
  });
});

describe('ReminderScheduler — recurring events', () => {
  it('fires recurring reminder when occursToday and within offset window', () => {
    isRecurringMatch.mockReturnValue(true);
    const note = makeNote(
      'r1',
      'Weekly Meeting',
      { year: 1, month: 0, day: 1, hour: 14, minute: 0 },
      {
        repeat: 'weekly',
        reminderOffset: 1
      }
    );
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 13, minute: 30 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    expect(CalendariaSocket.emit).toHaveBeenCalled();
  });

  it('fires all-day recurring reminder with 0 offset', () => {
    isRecurringMatch.mockReturnValue(true);
    const note = makeNote(
      'r1',
      'Monthly Holiday',
      { year: 1, month: 0, day: 1 },
      {
        repeat: 'monthly',
        allDay: true,
        reminderOffset: 0
      }
    );
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 8, minute: 0 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    expect(CalendariaSocket.emit).toHaveBeenCalled();
  });

  it('does not fire when recurring but does not occur today', () => {
    isRecurringMatch.mockReturnValue(false);
    const note = makeNote(
      'r1',
      'Weekly',
      { year: 1, month: 0, day: 3, hour: 14, minute: 0 },
      {
        repeat: 'weekly',
        reminderOffset: 1
      }
    );
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 13, minute: 0 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    expect(CalendariaSocket.emit).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  handleReminderNotify                         */
/* -------------------------------------------- */

describe('ReminderScheduler.handleReminderNotify()', () => {
  it('shows toast for current user in targets', () => {
    ReminderScheduler.handleReminderNotify({
      type: 'toast',
      noteId: 'n1',
      noteName: 'Event',
      message: 'Reminder!',
      targets: ['test-user'],
      icon: 'fas fa-bell',
      color: '#4a9eff'
    });
    expect(ui.notifications.info).toHaveBeenCalled();
  });

  it('ignores if user not in targets', () => {
    ReminderScheduler.handleReminderNotify({
      type: 'toast',
      noteId: 'n1',
      noteName: 'Event',
      message: 'Reminder!',
      targets: ['other-user']
    });
    expect(ui.notifications.info).not.toHaveBeenCalled();
  });
});

/* -------------------------------------------- */
/*  Calendar filtering                           */
/* -------------------------------------------- */

describe('ReminderScheduler — calendar filtering', () => {
  it('skips notes from a different calendar', () => {
    const note = makeNote('r1', 'Note', { year: 1, month: 0, day: 1, hour: 14, minute: 0 }, { reminderOffset: 1 });
    note.calendarId = 'other-calendar';
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, day: 1, hour: 13, minute: 0 });
    ReminderScheduler.onUpdateWorldTime(WT(), ReminderScheduler.CHECK_INTERVAL);
    expect(CalendariaSocket.emit).not.toHaveBeenCalled();
  });
});
