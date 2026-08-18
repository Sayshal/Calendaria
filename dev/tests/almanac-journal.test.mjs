import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';
import { buildAlmanacContent, publishWeeklyAlmanac, weekStartFor } from '../../scripts/utils/almanac-journal.mjs';
import { dayOfWeek } from '../../scripts/notes/date-utils.mjs';

vi.mock('../../scripts/calendar/calendar-manager.mjs', async () => {
  const { default: CalendarManager, defaultCalendar } = await import('../__mocks__/calendar-manager.mjs');
  return { default: CalendarManager, defaultCalendar };
});
vi.mock('../../scripts/calendar/_module.mjs', async () => {
  const { default: CalendarManager } = await import('../__mocks__/calendar-manager.mjs');
  return { CalendarManager };
});
vi.mock('../../scripts/notes/_module.mjs', async () => await import('../../scripts/notes/date-utils.mjs'));
vi.mock('../../scripts/weather/_module.mjs', () => ({ WeatherManager: { getWeatherForDate: vi.fn(() => null), getForecast: vi.fn(() => []) } }));
vi.mock('../../scripts/utils/chronicle-data.mjs', () => ({ buildWeatherSentence: vi.fn((w) => (w ? 'Clear skies' : null)) }));
vi.mock('../../scripts/utils/socket.mjs', () => ({ CalendariaSocket: {} }));

const { WeatherManager } = await import('../../scripts/weather/_module.mjs');

let calendar;

beforeEach(() => {
  CalendarManager._reset();
  calendar = CalendarManager.getActiveCalendar();
  globalThis.CONST = { DOCUMENT_OWNERSHIP_LEVELS: { OBSERVER: 2 } };
  globalThis.JournalEntry = { create: vi.fn(() => Promise.resolve({ createEmbeddedDocuments: vi.fn() })) };
  game.journal = { find: vi.fn(() => null) };
});

describe('weekStartFor()', () => {
  it('rolls a mid-week date back to the first weekday', () => {
    const start = weekStartFor({ year: 2024, month: 5, dayOfMonth: 12 }, calendar);
    expect(dayOfWeek(start, calendar)).toBe(0);
  });
  it('leaves a date already on the first weekday alone', () => {
    const start = weekStartFor({ year: 2024, month: 5, dayOfMonth: 12 }, calendar);
    expect(weekStartFor(start, calendar)).toEqual(expect.objectContaining({ year: start.year, month: start.month, dayOfMonth: start.dayOfMonth }));
  });
});

describe('buildAlmanacContent()', () => {
  it('gives every day of both weeks one row with its own note lookup, plus a chronicle range link', () => {
    const content = buildAlmanacContent(calendar, { year: 2024, month: 5, dayOfMonth: 9 });
    expect(content.match(/<li>/g)).toHaveLength(14);
    expect(content.match(/\[\[cal\.notes \d+ \d+ \d+ links=true]]/g)).toHaveLength(14);
    expect(content).toMatch(/\[\[cal\.chronicle \d+ \d+ \d+ to \d+ \d+ \d+]]/);
  });
  it('keeps the day row when no weather was recorded', () => {
    const content = buildAlmanacContent(calendar, { year: 2024, month: 5, dayOfMonth: 9 });
    expect(content).not.toContain('Clear skies');
    expect(content.match(/<li>/g)).toHaveLength(14);
  });
  it('carries the recorded weather on each past day row', () => {
    WeatherManager.getWeatherForDate.mockReturnValue({ label: 'Clear' });
    const content = buildAlmanacContent(calendar, { year: 2024, month: 5, dayOfMonth: 9 });
    expect(content.match(/Clear skies/g)).toHaveLength(7);
  });
  it('freezes the forecast onto the coming week rows as player-grade data', () => {
    WeatherManager.getForecast.mockReturnValue([{ year: 2024, month: 5, dayOfMonth: 9, preset: { label: 'Rain' }, temperature: 12 }]);
    const content = buildAlmanacContent(calendar, { year: 2024, month: 5, dayOfMonth: 9 });
    expect(WeatherManager.getForecast).toHaveBeenCalledWith({ days: 7, playerView: true });
    expect(content.match(/Clear skies/g)).toHaveLength(1);
  });
});

describe('publishWeeklyAlmanac()', () => {
  const hookData = { current: { year: 2024, month: 5, dayOfMonth: 12 } };

  it('skips a week that has already been published', async () => {
    game.settings.get.mockImplementation((_m, key) => (key === 'weeklyAlmanac' ? true : '2024.5.9'));
    await publishWeeklyAlmanac(hookData);
    expect(JournalEntry.create).not.toHaveBeenCalled();
  });
  it('publishes and records the week when the marker is stale', async () => {
    game.settings.get.mockImplementation((_m, key) => (key === 'weeklyAlmanac' ? true : ''));
    await publishWeeklyAlmanac(hookData);
    expect(JournalEntry.create).toHaveBeenCalled();
    expect(game.settings.set).toHaveBeenCalledWith('calendaria', 'almanacLastWeek', '2024.5.9');
  });
  it('does nothing while the setting is off', async () => {
    game.settings.get.mockReturnValue(false);
    await publishWeeklyAlmanac(hookData);
    expect(JournalEntry.create).not.toHaveBeenCalled();
  });
});
