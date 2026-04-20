import { beforeEach, describe, expect, it, vi } from 'vitest';
import { _setCurrentDate } from '../../scripts/notes/date-utils.mjs';
import NoteManager from '../../scripts/notes/note-manager.mjs';
import EventScheduler from '../../scripts/time/event-scheduler.mjs';
import { CalendariaSocket } from '../../scripts/utils/socket.mjs';

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
vi.mock('../../scripts/constants.mjs', async (importOriginal) => ({ ...(await importOriginal()),
  MODULE: { ID: 'calendaria' },
  HOOKS: { EVENT_TRIGGERED: 'calendaria.eventTriggered', EVENT_DAY_CHANGED: 'calendaria.eventDayChanged' }
}));
vi.mock('../../scripts/notes/date-utils.mjs', () => {
  let currentDate = { year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 };
  return {
    getCurrentDate: vi.fn(() => currentDate),
    compareDates: vi.fn((a, b) => {
      if (a.year !== b.year) return a.year < b.year ? -1 : 1;
      if (a.month !== b.month) return a.month < b.month ? -1 : 1;
      if (a.dayOfMonth !== b.dayOfMonth) return a.dayOfMonth < b.dayOfMonth ? -1 : 1;
      return 0;
    }),
    _setCurrentDate: (d) => { currentDate = d; }
  };
});
vi.mock('../../scripts/notes/note-manager.mjs', () => ({
  default: {
    getAllNotes: vi.fn(() => []),
    getFullNote: vi.fn(() => null),
    isInitialized: vi.fn(() => true),
    getPresetDefinition: vi.fn(() => null)
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
vi.mock('../../scripts/weather/_module.mjs', () => ({
  WeatherManager: { whenDayChangeSettled: vi.fn(() => Promise.resolve()) }
}));

const TRIGGER_CHECK_INTERVAL = 1800;

const makeNote = (id, name, startDate, flagOverrides = {}) => ({
  id,
  name,
  journalId: `j-${id}`,
  flagData: { startDate, allDay: false, categories: [], color: '#4a9eff', icon: 'fas fa-calendar', macro: null, visibility: 'visible', silent: false, ...flagOverrides }
});
let worldTimeBase = 0;
const WT = () => worldTimeBase + TRIGGER_CHECK_INTERVAL + 1;
beforeEach(async () => {
  worldTimeBase += 1_000_000;
  CalendariaSocket.isPrimaryGM.mockReturnValue(true);
  NoteManager.isInitialized.mockReturnValue(true);
  NoteManager.getAllNotes.mockReturnValue([]);
  NoteManager.getFullNote.mockReturnValue(null);
  _setCurrentDate({ year: 0, month: 0, dayOfMonth: 99, hour: 0, minute: 0 });
  EventScheduler.initialize();
  _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 });
  await EventScheduler.onUpdateWorldTime(worldTimeBase, 0);
  Hooks.callAll.mockClear();
  NoteManager.getAllNotes.mockClear();
  NoteManager.getFullNote.mockClear();
  ui.notifications.info.mockClear();
  ui.notifications.warn.mockClear();
  ChatMessage.create.mockClear();
});

describe('EventScheduler.onUpdateWorldTime()', () => {
  it('does nothing when not primary GM', async () => {
    CalendariaSocket.isPrimaryGM.mockReturnValue(false);
    await EventScheduler.onUpdateWorldTime(WT(), 1800);
    expect(NoteManager.getAllNotes).not.toHaveBeenCalled();
  });
  it('does nothing when NoteManager not initialized', async () => {
    NoteManager.isInitialized.mockReturnValue(false);
    await EventScheduler.onUpdateWorldTime(WT(), 1800);
    expect(NoteManager.getAllNotes).not.toHaveBeenCalled();
  });
  it('checks triggers after TRIGGER_CHECK_INTERVAL', async () => {
    const note = makeNote('e1', 'Event', { year: 1, month: 0, dayOfMonth: 0, hour: 13, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 14, minute: 0 });
    await EventScheduler.onUpdateWorldTime(WT(), TRIGGER_CHECK_INTERVAL);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.eventTriggered', expect.objectContaining({ id: 'e1' }));
  });
});

describe('EventScheduler — trigger detection', () => {
  it('triggers event when time crosses start time', async () => {
    const note = makeNote('e1', 'Meeting', { year: 1, month: 0, dayOfMonth: 0, hour: 13, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 14, minute: 0 });
    await EventScheduler.onUpdateWorldTime(WT(), TRIGGER_CHECK_INTERVAL);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.eventTriggered', expect.objectContaining({ id: 'e1', name: 'Meeting' }));
  });
  it('does not trigger event when time has not reached start', async () => {
    const note = makeNote('e1', 'Meeting', { year: 1, month: 0, dayOfMonth: 0, hour: 20, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 14, minute: 0 });
    await EventScheduler.onUpdateWorldTime(WT(), TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.info).not.toHaveBeenCalled();
  });
  it('does not trigger same event twice in same day', async () => {
    const note = makeNote('e1', 'Meeting', { year: 1, month: 0, dayOfMonth: 0, hour: 13, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 14, minute: 0 });
    const wt1 = WT();
    await EventScheduler.onUpdateWorldTime(wt1, TRIGGER_CHECK_INTERVAL);
    await EventScheduler.onUpdateWorldTime(wt1 + TRIGGER_CHECK_INTERVAL + 1, TRIGGER_CHECK_INTERVAL);
    const triggerCalls = Hooks.callAll.mock.calls.filter((c) => c[0] === 'calendaria.eventTriggered');
    expect(triggerCalls).toHaveLength(1);
  });
  it('clears triggered set on date change', async () => {
    const note = makeNote('e1', 'Meeting', { year: 1, month: 0, dayOfMonth: 1, hour: 10, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 23, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 1, hour: 11, minute: 0 });
    await EventScheduler.onUpdateWorldTime(WT(), TRIGGER_CHECK_INTERVAL);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.eventTriggered', expect.objectContaining({ id: 'e1' }));
  });
  it('triggers all-day event at start of day', async () => {
    const note = makeNote('e1', 'Holiday', { year: 1, month: 0, dayOfMonth: 1 }, { allDay: true });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 23, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 1, hour: 1, minute: 0 });
    await EventScheduler.onUpdateWorldTime(WT(), TRIGGER_CHECK_INTERVAL);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.eventTriggered', expect.objectContaining({ id: 'e1', name: 'Holiday' }));
  });
  it('skips silent events', async () => {
    const note = makeNote('e1', 'Silent Event', { year: 1, month: 0, dayOfMonth: 0, hour: 13, minute: 0 }, { silent: true });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 14, minute: 0 });
    await EventScheduler.onUpdateWorldTime(WT(), TRIGGER_CHECK_INTERVAL);
    expect(ui.notifications.info).not.toHaveBeenCalled();
  });
  it('fires EVENT_TRIGGERED hook', async () => {
    const note = makeNote('e1', 'Meeting', { year: 1, month: 0, dayOfMonth: 0, hour: 13, minute: 0 });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 14, minute: 0 });
    await EventScheduler.onUpdateWorldTime(WT(), TRIGGER_CHECK_INTERVAL);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.eventTriggered', expect.objectContaining({ id: 'e1', name: 'Meeting' }));
  });
});

describe('EventScheduler — notification types', () => {
  it('triggers event for deadline category', async () => {
    const note = makeNote('e1', 'Due Date', { year: 1, month: 0, dayOfMonth: 0, hour: 13, minute: 0 }, { categories: ['deadline'] });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 14, minute: 0 });
    await EventScheduler.onUpdateWorldTime(WT(), TRIGGER_CHECK_INTERVAL);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.eventTriggered', expect.objectContaining({ id: 'e1', name: 'Due Date' }));
  });
  it('triggers event for combat category', async () => {
    const note = makeNote('e1', 'Battle', { year: 1, month: 0, dayOfMonth: 0, hour: 13, minute: 0 }, { categories: ['combat'] });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 14, minute: 0 });
    await EventScheduler.onUpdateWorldTime(WT(), TRIGGER_CHECK_INTERVAL);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.eventTriggered', expect.objectContaining({ id: 'e1', name: 'Battle' }));
  });
  it('triggers event for regular categories', async () => {
    const note = makeNote('e1', 'Quest', { year: 1, month: 0, dayOfMonth: 0, hour: 13, minute: 0 }, { categories: ['quest'] });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 14, minute: 0 });
    await EventScheduler.onUpdateWorldTime(WT(), TRIGGER_CHECK_INTERVAL);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.eventTriggered', expect.objectContaining({ id: 'e1', name: 'Quest' }));
  });
});

describe('EventScheduler — multi-day events', () => {
  it('shows progress notification for multi-day event in progress', async () => {
    const note = makeNote('e1', 'Festival', { year: 1, month: 0, dayOfMonth: 0 }, { endDate: { year: 1, month: 0, dayOfMonth: 4 }, allDay: true });
    NoteManager.getAllNotes.mockReturnValue([note]);
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 0, hour: 23, minute: 0 });
    EventScheduler.initialize();
    _setCurrentDate({ year: 1, month: 0, dayOfMonth: 1, hour: 8, minute: 0 });
    await EventScheduler.onUpdateWorldTime(WT(), TRIGGER_CHECK_INTERVAL);
    expect(Hooks.callAll).toHaveBeenCalledWith('calendaria.eventDayChanged', expect.objectContaining({ id: 'e1' }));
  });
});
