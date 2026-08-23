import { beforeEach, describe, expect, it } from 'vitest';
import CalendariaCalendar from '../../scripts/data/calendaria-calendar.mjs';
import { syncWithLuxon } from '../../scripts/integrations/luxon-sync.mjs';

/** 1970-01-01T00:00:00, a Thursday (ISO weekday 4). */
const luxonNow = { year: 1970, month: 1, day: 1, hour: 0, minute: 0, second: 0, weekday: 4 };

/** Minimal themed calendar stub matching bundled Gregorian's sync-relevant shape. */
function makeCalendar(firstWeekday, id = 'gregorian') {
  return {
    metadata: { id, luxonSync: { theme: 'CE' } },
    years: { yearZero: 1970, firstWeekday },
    days: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
    daysInWeek: 7,
    componentsToTime: () => 0
  };
}

/** Read the instance getter without constructing a full CalendarData. */
function effectiveFirstWeekday(stub) {
  return Object.getOwnPropertyDescriptor(CalendariaCalendar.prototype, 'effectiveFirstWeekday').get.call(stub);
}

describe('luxon sync firstWeekday', () => {
  beforeEach(() => {
    globalThis.CONFIG = { PF2E: { worldClock: { CE: { yearOffset: 0 } } } };
    globalThis.game = {
      system: { id: 'pf2e' },
      time: { worldTime: 0 },
      pf2e: { worldClock: { worldCreatedOn: { isValid: true, plus: () => luxonNow } } }
    };
    CalendariaCalendar.setEpochSync(0, null);
  });

  it('leaves the authored years.firstWeekday untouched', () => {
    const calendar = makeCalendar(2);
    expect(syncWithLuxon(calendar)).toBe(true);
    expect(calendar.years.firstWeekday).toBe(2);
  });

  it('stores the derived weekday against the synced calendar id', () => {
    syncWithLuxon(makeCalendar(2));
    expect(CalendariaCalendar.correctFirstWeekday).toBe(4);
    expect(CalendariaCalendar.correctFirstWeekdayId).toBe('gregorian');
  });

  it('prefers the synced weekday only for the calendar it was derived from', () => {
    syncWithLuxon(makeCalendar(2));
    expect(effectiveFirstWeekday(makeCalendar(2))).toBe(4);
    expect(effectiveFirstWeekday(makeCalendar(2, 'golarion'))).toBe(2);
  });

  it('falls back to the authored value once sync is cleared', () => {
    syncWithLuxon(makeCalendar(2));
    CalendariaCalendar.setEpochSync(0, null);
    expect(CalendariaCalendar.correctFirstWeekdayId).toBeNull();
    expect(effectiveFirstWeekday(makeCalendar(2))).toBe(2);
  });
});
