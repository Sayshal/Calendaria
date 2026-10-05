import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it, vi } from 'vitest';
import CalendariaCalendar from '../../scripts/data/calendaria-calendar.mjs';

vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager, defaultCalendar } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager, defaultCalendar };
});

const SECS_PER_DAY = 86400;
const load = (id) => Object.assign(new CalendariaCalendar(), JSON.parse(readFileSync(join(import.meta.dirname, `../../calendars/${id}.json`), 'utf8')));
const ia = load('intergalactic-astramark');
const renescara = load('renescara');

/**
 * Convert world time to components with the display year (yearZero applied).
 * @param {CalendariaCalendar} calendar - Calendar to read with
 * @param {number} time - World time in seconds
 * @returns {object} Time components with display year
 */
const dateAt = (calendar, time) => {
  const components = calendar.timeToComponents(time);
  return { ...components, year: components.year + calendar.years.yearZero };
};

/** Day 1 of the campaign: 19 Shadowmoon 4736 in Renescara. */
const ANCHOR = renescara.componentsToTime({ year: 4736 - renescara.years.yearZero, month: 12, dayOfMonth: 18 });

describe('Intergalactic Astramark / Renescara alignment', () => {
  it('Day 1 is 4 Florens 52347 IA and 19 Shadowmoon 4736', () => {
    expect(dateAt(ia, ANCHOR)).toMatchObject({ year: 52347, month: 2, dayOfMonth: 3, hour: 0, minute: 0 });
    expect(dateAt(renescara, ANCHOR)).toMatchObject({ year: 4736, month: 12, dayOfMonth: 18, hour: 0, minute: 0 });
  });

  it('launch is 14 Florens 52347 IA and the Day of Threshold 4736', () => {
    const launch = ANCHOR + 10 * SECS_PER_DAY;
    expect(dateAt(ia, launch)).toMatchObject({ year: 52347, month: 2, dayOfMonth: 13 });
    expect(dateAt(renescara, launch)).toMatchObject({ year: 4736, month: 13, dayOfMonth: 0 });
  });
});
