import { beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';
import { CONDITION_FIELDS, CONDITION_GROUP_MODES, CONDITION_OPERATORS, MAX_NESTING_DEPTH } from '../../scripts/constants.mjs';
import {
  canConditionTreeMatchRange,
  createEpochContext,
  createGroup,
  EpochDataCache,
  evaluateCondition,
  evaluateConditions,
  evaluateEntry,
  evaluateGroup,
  getFieldValue,
  getSearchDistanceFromTree,
  isGroup,
  registerFieldHandler,
  validateConditions,
  validateConditionTree
} from '../../scripts/notes/condition-engine.mjs';
import WeatherManager from '../../scripts/weather/weather-manager.mjs';

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

beforeEach(() => {
  CalendarManager._reset();
  WeatherManager.getCurrentWeather.mockReturnValue(null);
});

describe('getFieldValue()', () => {
  describe('year', () => {
    it('returns the year directly', () => {
      expect(getFieldValue(CONDITION_FIELDS.YEAR, { year: 1492, month: 0, dayOfMonth: 0 })).toBe(1492);
    });
  });
  describe('month', () => {
    it('returns 1-indexed month', () => {
      expect(getFieldValue(CONDITION_FIELDS.MONTH, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(1);
      expect(getFieldValue(CONDITION_FIELDS.MONTH, { year: 2024, month: 11, dayOfMonth: 0 })).toBe(12);
    });
  });
  describe('day', () => {
    it('returns 1-indexed day of month', () => {
      expect(getFieldValue(CONDITION_FIELDS.DAY, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(1);
      expect(getFieldValue(CONDITION_FIELDS.DAY, { year: 2024, month: 0, dayOfMonth: 14 })).toBe(15);
    });
  });
  describe('dayOfYear', () => {
    it('returns 1-based day of year', () => {
      expect(getFieldValue(CONDITION_FIELDS.DAY_OF_YEAR, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(1);
      expect(getFieldValue(CONDITION_FIELDS.DAY_OF_YEAR, { year: 2024, month: 1, dayOfMonth: 0 })).toBe(32);
    });
  });
  describe('daysBeforeMonthEnd', () => {
    it('returns days remaining before end of month', () => {
      expect(getFieldValue(CONDITION_FIELDS.DAYS_BEFORE_MONTH_END, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(30);
      expect(getFieldValue(CONDITION_FIELDS.DAYS_BEFORE_MONTH_END, { year: 2024, month: 0, dayOfMonth: 30 })).toBe(0);
    });
  });
  describe('weekday', () => {
    it('returns 1-indexed weekday', () => {
      const result = getFieldValue(CONDITION_FIELDS.WEEKDAY, { year: 2024, month: 0, dayOfMonth: 0 });
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(1);
      expect(result).toBeLessThanOrEqual(7);
    });
  });
  describe('weekNumberInMonth', () => {
    it('returns week number within month', () => {
      expect(getFieldValue(CONDITION_FIELDS.WEEK_NUMBER_IN_MONTH, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(1);
      expect(getFieldValue(CONDITION_FIELDS.WEEK_NUMBER_IN_MONTH, { year: 2024, month: 0, dayOfMonth: 7 })).toBe(2);
    });
  });
  describe('inverseWeekNumber', () => {
    it('returns weeks from end of month', () => {
      expect(getFieldValue(CONDITION_FIELDS.INVERSE_WEEK_NUMBER, { year: 2024, month: 0, dayOfMonth: 30 })).toBe(1);
    });
  });
  describe('weekInMonth', () => {
    it('returns same as weekNumberInMonth', () => {
      const date = { year: 2024, month: 0, dayOfMonth: 7 };
      expect(getFieldValue(CONDITION_FIELDS.WEEK_IN_MONTH, date)).toBe(getFieldValue(CONDITION_FIELDS.WEEK_NUMBER_IN_MONTH, date));
    });
  });
  describe('weekInYear', () => {
    it('returns week number within year', () => {
      expect(getFieldValue(CONDITION_FIELDS.WEEK_IN_YEAR, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(1);
      expect(getFieldValue(CONDITION_FIELDS.WEEK_IN_YEAR, { year: 2024, month: 0, dayOfMonth: 7 })).toBe(2);
    });
  });
  describe('totalWeek', () => {
    it('returns total weeks since epoch', () => {
      const result = getFieldValue(CONDITION_FIELDS.TOTAL_WEEK, { year: 2024, month: 0, dayOfMonth: 0 });
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
  describe('weeksBeforeMonthEnd', () => {
    it('returns full weeks remaining in month', () => {
      expect(getFieldValue(CONDITION_FIELDS.WEEKS_BEFORE_MONTH_END, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(4);
    });
  });
  describe('weeksBeforeYearEnd', () => {
    it('returns full weeks remaining in year', () => {
      const result = getFieldValue(CONDITION_FIELDS.WEEKS_BEFORE_YEAR_END, { year: 2024, month: 0, dayOfMonth: 0 });
      expect(typeof result).toBe('number');
      expect(result).toBe(52);
    });
  });

  describe('season', () => {
    it('returns 1-indexed season index', () => {
      const result = getFieldValue(CONDITION_FIELDS.SEASON, { year: 2024, month: 3, dayOfMonth: 9 });
      expect(result).toBe(1);
    });
    it('returns null when no seasons configured', () => {
      CalendarManager._configure({ seasons: { values: [] } });
      expect(getFieldValue(CONDITION_FIELDS.SEASON, { year: 2024, month: 0, dayOfMonth: 0 })).toBeNull();
    });
  });

  describe('seasonPercent', () => {
    it('returns percentage through current season', () => {
      const result = getFieldValue(CONDITION_FIELDS.SEASON_PERCENT, { year: 2024, month: 3, dayOfMonth: 9 });
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(100);
    });
    it('returns null when no seasons', () => {
      CalendarManager._configure({ seasons: { values: [] } });
      expect(getFieldValue(CONDITION_FIELDS.SEASON_PERCENT, { year: 2024, month: 0, dayOfMonth: 0 })).toBeNull();
    });
  });

  describe('seasonDay', () => {
    it('returns day within current season', () => {
      const result = getFieldValue(CONDITION_FIELDS.SEASON_DAY, { year: 2024, month: 3, dayOfMonth: 9 });
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(1);
    });
  });

  describe('isLongestDay', () => {
    it('returns boolean', () => {
      const result = getFieldValue(CONDITION_FIELDS.IS_LONGEST_DAY, { year: 2024, month: 0, dayOfMonth: 0 });
      expect(typeof result).toBe('boolean');
    });
    it('returns false when no seasons', () => {
      CalendarManager._configure({ seasons: { values: [] } });
      expect(getFieldValue(CONDITION_FIELDS.IS_LONGEST_DAY, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
    });
  });

  describe('isShortestDay', () => {
    it('returns boolean', () => {
      const result = getFieldValue(CONDITION_FIELDS.IS_SHORTEST_DAY, { year: 2024, month: 0, dayOfMonth: 0 });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('isSpringEquinox', () => {
    it('returns true on spring equinox day', () => {
      const result = getFieldValue(CONDITION_FIELDS.IS_SPRING_EQUINOX, { year: 2024, month: 2, dayOfMonth: 21 });
      expect(result).toBe(true);
    });
    it('returns false on other days', () => {
      expect(getFieldValue(CONDITION_FIELDS.IS_SPRING_EQUINOX, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
    });
  });

  describe('isAutumnEquinox', () => {
    it('returns boolean', () => {
      const result = getFieldValue(CONDITION_FIELDS.IS_AUTUMN_EQUINOX, { year: 2024, month: 0, dayOfMonth: 0 });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('moonPhase', () => {
    it('returns float position 0-1', () => {
      const result = getFieldValue(CONDITION_FIELDS.MOON_PHASE, { year: 2024, month: 0, dayOfMonth: 0 }, 0);
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThan(1);
    });
    it('returns null for invalid moon index', () => {
      expect(getFieldValue(CONDITION_FIELDS.MOON_PHASE, { year: 2024, month: 0, dayOfMonth: 0 }, 99)).toBeNull();
    });
  });

  describe('moonPhaseIndex', () => {
    it('returns integer phase index', () => {
      const result = getFieldValue(CONDITION_FIELDS.MOON_PHASE_INDEX, { year: 2024, month: 0, dayOfMonth: 0 }, 0);
      expect(typeof result).toBe('number');
    });
    it('returns null for invalid moon index', () => {
      expect(getFieldValue(CONDITION_FIELDS.MOON_PHASE_INDEX, { year: 2024, month: 0, dayOfMonth: 0 }, 99)).toBeNull();
    });
  });

  describe('cycle', () => {
    it('returns cycle entry index', () => {
      const result = getFieldValue(CONDITION_FIELDS.CYCLE, { year: 2024, month: 0, dayOfMonth: 0 }, 0);
      expect(typeof result).toBe('number');
    });
    it('returns null for invalid cycle index', () => {
      expect(getFieldValue(CONDITION_FIELDS.CYCLE, { year: 2024, month: 0, dayOfMonth: 0 }, 99)).toBeNull();
    });
  });

  describe('era', () => {
    it('returns 1-indexed era', () => {
      expect(getFieldValue(CONDITION_FIELDS.ERA, { year: 500, month: 0, dayOfMonth: 0 })).toBe(1);
      expect(getFieldValue(CONDITION_FIELDS.ERA, { year: 1500, month: 0, dayOfMonth: 0 })).toBe(2);
    });
    it('returns null when no eras', () => {
      CalendarManager._configure({ eras: [] });
      expect(getFieldValue(CONDITION_FIELDS.ERA, { year: 2024, month: 0, dayOfMonth: 0 })).toBeNull();
    });
  });

  describe('eraYear', () => {
    it('returns year within era', () => {
      expect(getFieldValue(CONDITION_FIELDS.ERA_YEAR, { year: 1500, month: 0, dayOfMonth: 0 })).toBe(501);
    });
    it('returns raw year when no eras', () => {
      CalendarManager._configure({ eras: [] });
      expect(getFieldValue(CONDITION_FIELDS.ERA_YEAR, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(2024);
    });
  });

  describe('intercalary', () => {
    it('returns false for normal months', () => {
      expect(getFieldValue(CONDITION_FIELDS.INTERCALARY, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
    });
    it('returns true for intercalary months', () => {
      CalendarManager._configure({ months: { values: [ { name: 'Normal', days: 30 }, { name: 'Leap', days: 1, type: 'intercalary' } ] } });
      expect(getFieldValue(CONDITION_FIELDS.INTERCALARY, { year: 2024, month: 1, dayOfMonth: 0 })).toBe(true);
    });
  });

  describe('date', () => {
    it('returns total days since epoch', () => {
      const result = getFieldValue(CONDITION_FIELDS.DATE, { year: 2024, month: 0, dayOfMonth: 0 });
      expect(typeof result).toBe('number');
    });
    it('increases for later dates', () => {
      const day1 = getFieldValue(CONDITION_FIELDS.DATE, { year: 2024, month: 0, dayOfMonth: 0 });
      const day2 = getFieldValue(CONDITION_FIELDS.DATE, { year: 2024, month: 0, dayOfMonth: 1 });
      expect(day2).toBeGreaterThan(day1);
    });
  });

  describe('weather', () => {
    it('returns null when no weather set', () => {
      expect(getFieldValue(CONDITION_FIELDS.WEATHER, { year: 2024, month: 0, dayOfMonth: 0 })).toBeNull();
    });
    it('returns weather preset ID when weather is set', () => {
      WeatherManager.getCurrentWeather.mockReturnValue({ id: 'sunny', label: 'Sunny' });
      expect(getFieldValue(CONDITION_FIELDS.WEATHER, { year: 2024, month: 0, dayOfMonth: 0 })).toBe('sunny');
    });
    it('returns historical weather ID when available', () => {
      WeatherManager.getWeatherForDate.mockReturnValue({ id: 'stormy' });
      expect(getFieldValue(CONDITION_FIELDS.WEATHER, { year: 2024, month: 0, dayOfMonth: 0 })).toBe('stormy');
    });
    it('prefers historical over current weather', () => {
      WeatherManager.getWeatherForDate.mockReturnValue({ id: 'stormy' });
      WeatherManager.getCurrentWeather.mockReturnValue({ id: 'sunny' });
      expect(getFieldValue(CONDITION_FIELDS.WEATHER, { year: 2024, month: 0, dayOfMonth: 0 })).toBe('stormy');
    });
    it('falls back to current weather when no historical data', () => {
      WeatherManager.getWeatherForDate.mockReturnValue(null);
      WeatherManager.getCurrentWeather.mockReturnValue({ id: 'sunny' });
      expect(getFieldValue(CONDITION_FIELDS.WEATHER, { year: 2024, month: 0, dayOfMonth: 0 })).toBe('sunny');
    });
    it('passes zone ID to both weather lookups', () => {
      getFieldValue(CONDITION_FIELDS.WEATHER, { year: 2024, month: 0, dayOfMonth: 0 }, 'zone-1');
      expect(WeatherManager.getWeatherForDate).toHaveBeenCalledWith(2024, 0, 0, 'zone-1');
      expect(WeatherManager.getCurrentWeather).toHaveBeenCalledWith('zone-1');
    });
    it('returns null when historical entry has no id', () => {
      WeatherManager.getWeatherForDate.mockReturnValue({ label: 'Custom' });
      expect(getFieldValue(CONDITION_FIELDS.WEATHER, { year: 2024, month: 0, dayOfMonth: 0 })).toBeNull();
    });
  });

  describe('unknown field', () => {
    it('returns null for unrecognized fields', () => {
      expect(getFieldValue('nonexistent', { year: 2024, month: 0, dayOfMonth: 0 })).toBeNull();
    });
  });
});

describe('getFieldValue() with epoch context', () => {
  it('caches computed values across calls', () => {
    const date = { year: 2024, month: 3, dayOfMonth: 9 };
    const ctx = createEpochContext(date);
    const doy1 = getFieldValue(CONDITION_FIELDS.DAY_OF_YEAR, date, null, ctx);
    const doy2 = getFieldValue(CONDITION_FIELDS.DAY_OF_YEAR, date, null, ctx);
    expect(doy1).toBe(doy2);
    expect(ctx._cache.dayOfYear).toBe(doy1 - 1);
  });
  it('caches lastDayOfMonth', () => {
    const date = { year: 2024, month: 0, dayOfMonth: 15 };
    const ctx = createEpochContext(date);
    getFieldValue(CONDITION_FIELDS.DAYS_BEFORE_MONTH_END, date, null, ctx);
    expect(ctx._cache.lastDayOfMonth).toBe(31);
  });
  it('shares cache between different fields', () => {
    const date = { year: 2024, month: 0, dayOfMonth: 7 };
    const ctx = createEpochContext(date);
    getFieldValue(CONDITION_FIELDS.WEEK_IN_YEAR, date, null, ctx);
    expect(ctx._cache.dayOfYear).toBeDefined();
    const doy = getFieldValue(CONDITION_FIELDS.DAY_OF_YEAR, date, null, ctx);
    expect(doy).toBe(ctx._cache.dayOfYear + 1);
  });
});

describe('evaluateCondition()', () => {
  const date = { year: 2024, month: 5, dayOfMonth: 14 };
  describe('== (equal)', () => {
    it('matches when field equals value', () => {
      expect(evaluateCondition({ field: 'year', op: '==', value: 2024 }, date)).toBe(true);
    });
    it('fails when field does not equal value', () => {
      expect(evaluateCondition({ field: 'year', op: '==', value: 2025 }, date)).toBe(false);
    });
  });
  describe('!= (not equal)', () => {
    it('matches when field differs from value', () => {
      expect(evaluateCondition({ field: 'year', op: '!=', value: 2025 }, date)).toBe(true);
    });
    it('fails when field equals value', () => {
      expect(evaluateCondition({ field: 'year', op: '!=', value: 2024 }, date)).toBe(false);
    });
  });
  describe('>= (greater or equal)', () => {
    it('matches when field is greater', () => {
      expect(evaluateCondition({ field: 'month', op: '>=', value: 5 }, date)).toBe(true);
    });
    it('matches when field is equal', () => {
      expect(evaluateCondition({ field: 'month', op: '>=', value: 6 }, date)).toBe(true);
    });
    it('fails when field is less', () => {
      expect(evaluateCondition({ field: 'month', op: '>=', value: 7 }, date)).toBe(false);
    });
  });
  describe('<= (less or equal)', () => {
    it('matches when field is less', () => {
      expect(evaluateCondition({ field: 'month', op: '<=', value: 7 }, date)).toBe(true);
    });
    it('matches when field is equal', () => {
      expect(evaluateCondition({ field: 'month', op: '<=', value: 6 }, date)).toBe(true);
    });
    it('fails when field is greater', () => {
      expect(evaluateCondition({ field: 'month', op: '<=', value: 5 }, date)).toBe(false);
    });
  });
  describe('> (greater)', () => {
    it('matches when field is strictly greater', () => {
      expect(evaluateCondition({ field: 'day', op: '>', value: 14 }, date)).toBe(true);
    });
    it('fails when field is equal', () => {
      expect(evaluateCondition({ field: 'day', op: '>', value: 15 }, date)).toBe(false);
    });
  });
  describe('< (less)', () => {
    it('matches when field is strictly less', () => {
      expect(evaluateCondition({ field: 'day', op: '<', value: 16 }, date)).toBe(true);
    });
    it('fails when field is equal', () => {
      expect(evaluateCondition({ field: 'day', op: '<', value: 15 }, date)).toBe(false);
    });
  });
  describe('% (modulo)', () => {
    it('matches when (fieldValue - offset) is divisible by value', () => {
      expect(evaluateCondition({ field: 'year', op: '%', value: 4 }, date)).toBe(true);
    });
    it('fails when not divisible', () => {
      expect(evaluateCondition({ field: 'year', op: '%', value: 3 }, date)).toBe(false);
    });
    it('uses startDate for offset calculation', () => {
      const startDate = { year: 2020, month: 0, dayOfMonth: 0 };
      expect(evaluateCondition({ field: 'year', op: '%', value: 4 }, date, { startDate })).toBe(true);
      expect(evaluateCondition({ field: 'year', op: '%', value: 3 }, date, { startDate })).toBe(false);
    });
    it('returns false when value is 0 (division by zero)', () => {
      expect(evaluateCondition({ field: 'year', op: '%', value: 0 }, date)).toBe(false);
    });
  });
  describe('unknown operator', () => {
    it('returns false', () => {
      expect(evaluateCondition({ field: 'year', op: '??', value: 2024 }, date)).toBe(false);
    });
  });
  describe('null field value', () => {
    it('returns false when field resolves to null', () => {
      CalendarManager._configure({ seasons: { values: [] } });
      expect(evaluateCondition({ field: 'season', op: '==', value: 1 }, date)).toBe(false);
    });
  });
});

describe('evaluateCondition() with date field', () => {
  it('matches exact date using == with date object value', () => {
    const date = { year: 2024, month: 5, dayOfMonth: 14 };
    const condition = { field: 'date', op: '==', value: { year: 2024, month: 5, dayOfMonth: 14 } };
    expect(evaluateCondition(condition, date)).toBe(true);
  });
  it('rejects different date using ==', () => {
    const date = { year: 2024, month: 5, dayOfMonth: 14 };
    const condition = { field: 'date', op: '==', value: { year: 2024, month: 5, dayOfMonth: 15 } };
    expect(evaluateCondition(condition, date)).toBe(false);
  });
  it('supports >= for "on or after" checks', () => {
    const date = { year: 2024, month: 5, dayOfMonth: 14 };
    const condition = { field: 'date', op: '>=', value: { year: 2024, month: 5, dayOfMonth: 14 } };
    expect(evaluateCondition(condition, date)).toBe(true);
    const earlier = { field: 'date', op: '>=', value: { year: 2024, month: 5, dayOfMonth: 15 } };
    expect(evaluateCondition(earlier, date)).toBe(false);
  });
  it('supports <= for "on or before" checks', () => {
    const date = { year: 2024, month: 5, dayOfMonth: 14 };
    const condition = { field: 'date', op: '<=', value: { year: 2024, month: 5, dayOfMonth: 14 } };
    expect(evaluateCondition(condition, date)).toBe(true);
  });
  it('supports != for "not on" checks', () => {
    const date = { year: 2024, month: 5, dayOfMonth: 14 };
    const condition = { field: 'date', op: '!=', value: { year: 2024, month: 5, dayOfMonth: 14 } };
    expect(evaluateCondition(condition, date)).toBe(false);
    const condition2 = { field: 'date', op: '!=', value: { year: 2024, month: 5, dayOfMonth: 15 } };
    expect(evaluateCondition(condition2, date)).toBe(true);
  });
});

describe('evaluateCondition() with weather field', () => {
  it('matches current weather preset ID', () => {
    WeatherManager.getCurrentWeather.mockReturnValue({ id: 'rainy', label: 'Rainy' });
    const condition = { field: 'weather', op: '==', value: 'rainy' };
    expect(evaluateCondition(condition, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
  });
  it('rejects non-matching weather', () => {
    WeatherManager.getCurrentWeather.mockReturnValue({ id: 'sunny', label: 'Sunny' });
    const condition = { field: 'weather', op: '==', value: 'rainy' };
    expect(evaluateCondition(condition, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('supports != for weather exclusion', () => {
    WeatherManager.getCurrentWeather.mockReturnValue({ id: 'sunny', label: 'Sunny' });
    const condition = { field: 'weather', op: '!=', value: 'rainy' };
    expect(evaluateCondition(condition, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
  });
  it('returns false when no weather set and checking ==', () => {
    WeatherManager.getCurrentWeather.mockReturnValue(null);
    const condition = { field: 'weather', op: '==', value: 'rainy' };
    expect(evaluateCondition(condition, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
  });
});

describe('evaluateConditions()', () => {
  it('returns true for empty conditions', () => {
    expect(evaluateConditions([], { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
  });
  it('returns true for null conditions', () => {
    expect(evaluateConditions(null, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
  });
  it('returns true for undefined conditions', () => {
    expect(evaluateConditions(undefined, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
  });
  it('evaluates single condition', () => {
    const conditions = [{ field: 'year', op: '==', value: 2024 }];
    expect(evaluateConditions(conditions, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(evaluateConditions(conditions, { year: 2025, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('requires ALL conditions to pass (AND logic)', () => {
    const conditions = [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 6 } ];
    expect(evaluateConditions(conditions, { year: 2024, month: 5, dayOfMonth: 0 })).toBe(true);
    expect(evaluateConditions(conditions, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
    expect(evaluateConditions(conditions, { year: 2025, month: 5, dayOfMonth: 0 })).toBe(false);
  });
  it('short-circuits on first failing condition', () => {
    const conditions = [ { field: 'year', op: '==', value: 9999 }, { field: 'month', op: '==', value: 1 } ];
    expect(evaluateConditions(conditions, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('supports startDate option for modulo', () => {
    const conditions = [{ field: 'year', op: '%', value: 2 }];
    const startDate = { year: 2020, month: 0, dayOfMonth: 0 };
    expect(evaluateConditions(conditions, { year: 2024, month: 0, dayOfMonth: 0 }, { startDate })).toBe(true);
    expect(evaluateConditions(conditions, { year: 2023, month: 0, dayOfMonth: 0 }, { startDate })).toBe(false);
  });
  it('creates epoch context automatically for caching', () => {
    const conditions = [ { field: 'dayOfYear', op: '>=', value: 1 }, { field: 'weekInYear', op: '>=', value: 1 } ];
    expect(evaluateConditions(conditions, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
  });
  it('accepts external epoch context', () => {
    const date = { year: 2024, month: 0, dayOfMonth: 0 };
    const ctx = createEpochContext(date);
    const conditions = [ { field: 'dayOfYear', op: '==', value: 1 }, { field: 'year', op: '==', value: 2024 } ];
    expect(evaluateConditions(conditions, date, { epochCtx: ctx })).toBe(true);
    expect(ctx._cache.dayOfYear).toBe(0);
  });
});

describe('compound conditions', () => {
  it('"every 3rd year in summer" pattern', () => {
    const conditions = [ { field: 'year', op: '%', value: 3 }, { field: 'season', op: '==', value: 2 } ];
    expect(evaluateConditions(conditions, { year: 2024, month: 6, dayOfMonth: 0 })).toBe(false);
    expect(evaluateConditions(conditions, { year: 2025, month: 0, dayOfMonth: 0 })).toBe(false);
    expect(evaluateConditions(conditions, { year: 2025, month: 6, dayOfMonth: 0 })).toBe(true);
  });
  it('"between two dates" pattern using compound date conditions', () => {
    const conditions = [ { field: 'date', op: '>=', value: { year: 2024, month: 0, dayOfMonth: 0 } }, { field: 'date', op: '<=', value: { year: 2024, month: 11, dayOfMonth: 30 } } ];
    expect(evaluateConditions(conditions, { year: 2024, month: 6, dayOfMonth: 0 })).toBe(true);
    expect(evaluateConditions(conditions, { year: 2023, month: 6, dayOfMonth: 0 })).toBe(false);
    expect(evaluateConditions(conditions, { year: 2025, month: 6, dayOfMonth: 0 })).toBe(false);
  });
  it('"weekday + month" pattern for specific day selection', () => {
    const conditions = [ { field: 'month', op: '==', value: 1 }, { field: 'weekday', op: '==', value: 2 } ];
    const result = evaluateConditions(conditions, { year: 2024, month: 0, dayOfMonth: 0 });
    expect(typeof result).toBe('boolean');
  });
});

describe('createEpochContext()', () => {
  it('creates context with date reference', () => {
    const date = { year: 2024, month: 0, dayOfMonth: 0 };
    const ctx = createEpochContext(date);
    expect(ctx.date).toBe(date);
    expect(ctx._cache).toEqual({});
  });
  it('get() computes and caches values', () => {
    const date = { year: 2024, month: 0, dayOfMonth: 0 };
    const ctx = createEpochContext(date);
    let callCount = 0;
    const compute = () => {
      callCount++;
      return 42;
    };
    expect(ctx.get('test', compute)).toBe(42);
    expect(ctx.get('test', compute)).toBe(42);
    expect(callCount).toBe(1);
  });
  it('stores different keys independently', () => {
    const date = { year: 2024, month: 0, dayOfMonth: 0 };
    const ctx = createEpochContext(date);
    ctx.get('a', () => 1);
    ctx.get('b', () => 2);
    expect(ctx._cache.a).toBe(1);
    expect(ctx._cache.b).toBe(2);
  });
});

describe('CONDITION_FIELDS constant', () => {
  it('has 30 fields', () => {
    expect(Object.keys(CONDITION_FIELDS).length).toBe(41);
  });
  it('includes all original 28 fields', () => {
    const originalFields = [
      'year',
      'month',
      'day',
      'dayOfYear',
      'daysBeforeMonthEnd',
      'weekday',
      'weekNumberInMonth',
      'inverseWeekNumber',
      'weekInMonth',
      'weekInYear',
      'totalWeek',
      'weeksBeforeMonthEnd',
      'weeksBeforeYearEnd',
      'season',
      'seasonPercent',
      'seasonDay',
      'isLongestDay',
      'isShortestDay',
      'isSpringEquinox',
      'isAutumnEquinox',
      'moonPhase',
      'moonPhaseIndex',
      'moonPhaseCountMonth',
      'moonPhaseCountYear',
      'cycle',
      'era',
      'eraYear',
      'intercalary'
    ];
    const values = Object.values(CONDITION_FIELDS);
    for (const field of originalFields) expect(values).toContain(field);
  });
  it('includes new date and weather fields', () => {
    const values = Object.values(CONDITION_FIELDS);
    expect(values).toContain('date');
    expect(values).toContain('weather');
  });
});

describe('CONDITION_OPERATORS constant', () => {
  it('has 7 operators', () => {
    expect(Object.keys(CONDITION_OPERATORS).length).toBe(11);
  });
  it('includes all expected operators', () => {
    const values = Object.values(CONDITION_OPERATORS);
    expect(values).toContain('==');
    expect(values).toContain('!=');
    expect(values).toContain('>=');
    expect(values).toContain('<=');
    expect(values).toContain('>');
    expect(values).toContain('<');
    expect(values).toContain('%');
  });
});

describe('CONDITION_GROUP_MODES constant', () => {
  it('has 5 modes', () => {
    expect(Object.keys(CONDITION_GROUP_MODES).length).toBe(5);
  });
  it('includes all expected modes', () => {
    const values = Object.values(CONDITION_GROUP_MODES);
    expect(values).toContain('and');
    expect(values).toContain('or');
    expect(values).toContain('nand');
    expect(values).toContain('xor');
    expect(values).toContain('count');
  });
});

describe('MAX_NESTING_DEPTH', () => {
  it('is 5', () => {
    expect(MAX_NESTING_DEPTH).toBe(5);
  });
});

describe('isGroup()', () => {
  it('returns true for group objects', () => {
    expect(isGroup({ type: 'group', mode: 'and', children: [] })).toBe(true);
  });
  it('returns false for flat conditions', () => {
    expect(isGroup({ field: 'year', op: '==', value: 2024 })).toBe(false);
  });
  it('returns false for null/undefined', () => {
    expect(isGroup(null)).toBe(false);
    expect(isGroup(undefined)).toBe(false);
  });
});

describe('createGroup()', () => {
  it('creates an AND group', () => {
    const group = createGroup('and', [{ field: 'year', op: '==', value: 2024 }]);
    expect(group.type).toBe('group');
    expect(group.mode).toBe('and');
    expect(group.children).toHaveLength(1);
  });
  it('creates a COUNT group with threshold', () => {
    const group = createGroup('count', [], { threshold: 3 });
    expect(group.mode).toBe('count');
    expect(group.threshold).toBe(3);
  });
  it('defaults COUNT threshold to 1', () => {
    const group = createGroup('count', []);
    expect(group.threshold).toBe(1);
  });
  it('does not add threshold for non-COUNT modes', () => {
    const group = createGroup('or', []);
    expect(group.threshold).toBeUndefined();
  });
});

describe('validateConditionTree()', () => {
  it('validates a flat condition', () => {
    const result = validateConditionTree({ field: 'year', op: '==', value: 2024 });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  it('rejects condition missing field', () => {
    const result = validateConditionTree({ op: '==', value: 2024 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('field');
  });
  it('rejects condition missing operator', () => {
    const result = validateConditionTree({ field: 'year', value: 2024 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('operator');
  });
  it('validates a valid group', () => {
    const group = createGroup('and', [{ field: 'year', op: '==', value: 2024 }]);
    const result = validateConditionTree(group);
    expect(result.valid).toBe(true);
  });
  it('rejects group with invalid mode', () => {
    const result = validateConditionTree({ type: 'group', mode: 'invalid', children: [] });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('Invalid group mode');
  });
  it('rejects group with non-array children', () => {
    const result = validateConditionTree({ type: 'group', mode: 'and', children: 'bad' });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('array');
  });
  it('rejects COUNT group without valid threshold', () => {
    const result = validateConditionTree({ type: 'group', mode: 'count', children: [], threshold: 0 });
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('threshold');
  });
  it('validates nested groups recursively', () => {
    const nested = createGroup('or', [ createGroup('and', [ { field: 'month', op: '==', value: 6 }, { field: 'day', op: '==', value: 15 } ]), { field: 'year', op: '==', value: 2024 } ]);
    const result = validateConditionTree(nested);
    expect(result.valid).toBe(true);
  });
  it('reports errors in nested children', () => {
    const nested = createGroup('and', [ createGroup('or', [{ field: 'month' }]) ]);
    const result = validateConditionTree(nested);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('operator'))).toBe(true);
  });
  it('rejects nesting beyond MAX_NESTING_DEPTH', () => {
    let current = { field: 'year', op: '==', value: 2024 };
    for (let i = 0; i <= MAX_NESTING_DEPTH + 1; i++) current = createGroup('and', [current]);
    const result = validateConditionTree(current);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('depth');
  });
});

describe('validateConditions()', () => {
  it('validates empty array', () => {
    expect(validateConditions([]).valid).toBe(true);
  });
  it('rejects non-array', () => {
    expect(validateConditions('bad').valid).toBe(false);
  });
  it('validates mixed conditions and groups', () => {
    const conditions = [ { field: 'year', op: '==', value: 2024 }, createGroup('or', [ { field: 'month', op: '==', value: 1 }, { field: 'month', op: '==', value: 6 } ]) ];
    expect(validateConditions(conditions).valid).toBe(true);
  });
  it('reports indexed errors', () => {
    const conditions = [ { field: 'year', op: '==', value: 2024 }, { op: '==', value: 2024 } ];
    const result = validateConditions(conditions);
    expect(result.valid).toBe(false);
    expect(result.errors[0]).toContain('[1]');
  });
});

describe('evaluateGroup() — AND mode', () => {
  const date = { year: 2024, month: 5, dayOfMonth: 14 };
  it('returns true when all children pass', () => {
    const group = createGroup('and', [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 6 } ]);
    expect(evaluateGroup(group, date)).toBe(true);
  });
  it('returns false when one child fails', () => {
    const group = createGroup('and', [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 7 } ]);
    expect(evaluateGroup(group, date)).toBe(false);
  });
  it('returns true for empty children (vacuous truth)', () => {
    const group = createGroup('and', []);
    expect(evaluateGroup(group, date)).toBe(true);
  });
});

describe('evaluateGroup() — OR mode', () => {
  const date = { year: 2024, month: 5, dayOfMonth: 14 };
  it('returns true when at least one child passes', () => {
    const group = createGroup('or', [ { field: 'year', op: '==', value: 9999 }, { field: 'month', op: '==', value: 6 } ]);
    expect(evaluateGroup(group, date)).toBe(true);
  });
  it('returns false when all children fail', () => {
    const group = createGroup('or', [ { field: 'year', op: '==', value: 9999 }, { field: 'month', op: '==', value: 12 } ]);
    expect(evaluateGroup(group, date)).toBe(false);
  });
  it('returns false for empty children', () => {
    const group = createGroup('or', []);
    expect(evaluateGroup(group, date)).toBe(false);
  });
});

describe('evaluateGroup() — NAND mode', () => {
  const date = { year: 2024, month: 5, dayOfMonth: 14 };
  it('returns false when all children pass', () => {
    const group = createGroup('nand', [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 6 } ]);
    expect(evaluateGroup(group, date)).toBe(false);
  });
  it('returns true when at least one child fails', () => {
    const group = createGroup('nand', [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 12 } ]);
    expect(evaluateGroup(group, date)).toBe(true);
  });
  it('returns true for empty children (NAND of nothing)', () => {
    const group = createGroup('nand', []);
    expect(evaluateGroup(group, date)).toBe(true);
  });
});

describe('evaluateGroup() — XOR mode', () => {
  const date = { year: 2024, month: 5, dayOfMonth: 14 };
  it('returns true when exactly one child passes', () => {
    const group = createGroup('xor', [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 12 } ]);
    expect(evaluateGroup(group, date)).toBe(true);
  });
  it('returns false when multiple children pass', () => {
    const group = createGroup('xor', [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 6 } ]);
    expect(evaluateGroup(group, date)).toBe(false);
  });
  it('returns false when no children pass', () => {
    const group = createGroup('xor', [ { field: 'year', op: '==', value: 9999 }, { field: 'month', op: '==', value: 12 } ]);
    expect(evaluateGroup(group, date)).toBe(false);
  });
  it('returns false for empty children', () => {
    const group = createGroup('xor', []);
    expect(evaluateGroup(group, date)).toBe(false);
  });
});

describe('evaluateGroup() — COUNT mode', () => {
  const date = { year: 2024, month: 5, dayOfMonth: 14 };
  it('returns true when threshold is met', () => {
    const group = createGroup(
      'count',
      [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 6 }, { field: 'day', op: '==', value: 99 } ],
      { threshold: 2 }
    );
    expect(evaluateGroup(group, date)).toBe(true);
  });
  it('returns false when threshold is not met', () => {
    const group = createGroup(
      'count',
      [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 12 }, { field: 'day', op: '==', value: 99 } ],
      { threshold: 2 }
    );
    expect(evaluateGroup(group, date)).toBe(false);
  });
  it('returns true when all pass and threshold is met', () => {
    const group = createGroup(
      'count',
      [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 6 } ],
      { threshold: 2 }
    );
    expect(evaluateGroup(group, date)).toBe(true);
  });

  it('returns false for empty children', () => {
    const group = createGroup('count', [], { threshold: 1 });
    expect(evaluateGroup(group, date)).toBe(false);
  });
});

describe('evaluateGroup() — nested groups', () => {
  const date = { year: 2024, month: 5, dayOfMonth: 14 };
  it('evaluates nested AND inside OR', () => {
    const group = createGroup('or', [ createGroup('and', [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 6 } ]), { field: 'year', op: '==', value: 2025 } ]);
    expect(evaluateGroup(group, date)).toBe(true);
  });
  it('evaluates nested OR inside AND', () => {
    const group = createGroup('and', [ { field: 'year', op: '==', value: 2024 }, createGroup('or', [ { field: 'month', op: '==', value: 1 }, { field: 'month', op: '==', value: 6 } ]) ]);
    expect(evaluateGroup(group, date)).toBe(true);
  });
  it('returns false for deeply nested failing conditions', () => {
    const group = createGroup('and', [ createGroup('or', [ createGroup('and', [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 12 } ]) ]) ]);
    expect(evaluateGroup(group, date)).toBe(false);
  });
  it('stops evaluation at MAX_NESTING_DEPTH', () => {
    let current = createGroup('and', [{ field: 'year', op: '==', value: 2024 }]);
    for (let i = 0; i < MAX_NESTING_DEPTH; i++) current = createGroup('and', [current]);
    expect(evaluateGroup(current, date)).toBe(false);
  });
});

describe('evaluateEntry()', () => {
  const date = { year: 2024, month: 5, dayOfMonth: 14 };
  it('evaluates flat conditions', () => {
    expect(evaluateEntry({ field: 'year', op: '==', value: 2024 }, date)).toBe(true);
    expect(evaluateEntry({ field: 'year', op: '==', value: 9999 }, date)).toBe(false);
  });
  it('evaluates groups', () => {
    const group = createGroup('or', [ { field: 'year', op: '==', value: 9999 }, { field: 'month', op: '==', value: 6 } ]);
    expect(evaluateEntry(group, date)).toBe(true);
  });
});

describe('evaluateConditions() with groups', () => {
  const date = { year: 2024, month: 5, dayOfMonth: 14 };
  it('evaluates mixed flat conditions and groups (implicit AND)', () => {
    const conditions = [ { field: 'year', op: '==', value: 2024 }, createGroup('or', [ { field: 'month', op: '==', value: 1 }, { field: 'month', op: '==', value: 6 } ]) ];
    expect(evaluateConditions(conditions, date)).toBe(true);
  });
  it('fails when group in mixed array fails', () => {
    const conditions = [ { field: 'year', op: '==', value: 2024 }, createGroup('or', [ { field: 'month', op: '==', value: 1 }, { field: 'month', op: '==', value: 12 } ]) ];
    expect(evaluateConditions(conditions, date)).toBe(false);
  });
  it('backward compatible with flat-only arrays', () => {
    const conditions = [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 6 } ];
    expect(evaluateConditions(conditions, date)).toBe(true);
  });
  it('still returns true for empty/null/undefined', () => {
    expect(evaluateConditions([], date)).toBe(true);
    expect(evaluateConditions(null, date)).toBe(true);
    expect(evaluateConditions(undefined, date)).toBe(true);
  });
});

describe('complex scheduling patterns with groups', () => {
  it('"any 2 of 3 moon phases" using COUNT', () => {
    const group = createGroup(
      'count',
      [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 6 }, { field: 'day', op: '==', value: 99 } ],
      { threshold: 2 }
    );
    const date = { year: 2024, month: 5, dayOfMonth: 14 };
    expect(evaluateGroup(group, date)).toBe(true);
  });
  it('"(Event A AND Season B) OR Event C" pattern', () => {
    const conditions = [ createGroup('or', [ createGroup('and', [ { field: 'year', op: '==', value: 2024 }, { field: 'month', op: '==', value: 6 } ]), { field: 'day', op: '==', value: 1 } ]) ];
    expect(evaluateConditions(conditions, { year: 2024, month: 5, dayOfMonth: 14 })).toBe(true);
    expect(evaluateConditions(conditions, { year: 2025, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(evaluateConditions(conditions, { year: 2025, month: 1, dayOfMonth: 5 })).toBe(false);
  });
  it('"not during winter" using NAND with season', () => {
    const conditions = [ createGroup('nand', [ { field: 'season', op: '==', value: 4 } ]) ];
    expect(evaluateConditions(conditions, { year: 2024, month: 5, dayOfMonth: 14 })).toBe(true);
  });
  it('"exactly one of three weekdays" using XOR', () => {
    const date = { year: 2024, month: 5, dayOfMonth: 14 };
    const weekdayValue = getFieldValue(CONDITION_FIELDS.WEEKDAY, date);
    const otherDay1 = weekdayValue === 1 ? 2 : 1;
    const otherDay2 = weekdayValue === 3 ? 4 : 3;
    const group = createGroup('xor', [ { field: 'weekday', op: '==', value: weekdayValue }, { field: 'weekday', op: '==', value: otherDay1 }, { field: 'weekday', op: '==', value: otherDay2 } ]);
    expect(evaluateGroup(group, date)).toBe(true);
  });
});

describe('evaluateGroup() — edge cases', () => {
  it('returns false for unknown mode', () => {
    const group = { type: 'group', mode: 'bogus', children: [{ field: 'year', op: '==', value: 2024 }] };
    expect(evaluateGroup(group, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('returns false when null children', () => {
    const group = { type: 'group', mode: 'and', children: null };
    expect(evaluateGroup(group, { year: 2024, month: 0, dayOfMonth: 0 })).toBe(true);
  });
});

describe('EpochDataCache', () => {
  it('returns the same context for the same date', () => {
    const cache = new EpochDataCache();
    const date = { year: 2024, month: 5, dayOfMonth: 14 };
    const ctx1 = cache.getContext(date);
    const ctx2 = cache.getContext(date);
    expect(ctx1).toBe(ctx2);
  });
  it('returns different contexts for different dates', () => {
    const cache = new EpochDataCache();
    const ctx1 = cache.getContext({ year: 2024, month: 0, dayOfMonth: 0 });
    const ctx2 = cache.getContext({ year: 2024, month: 0, dayOfMonth: 1 });
    expect(ctx1).not.toBe(ctx2);
  });
  it('tracks size correctly', () => {
    const cache = new EpochDataCache();
    expect(cache.size).toBe(0);
    cache.getContext({ year: 2024, month: 0, dayOfMonth: 0 });
    expect(cache.size).toBe(1);
    cache.getContext({ year: 2024, month: 0, dayOfMonth: 1 });
    expect(cache.size).toBe(2);
    cache.getContext({ year: 2024, month: 0, dayOfMonth: 0 });
    expect(cache.size).toBe(2);
  });
  it('clear removes all entries', () => {
    const cache = new EpochDataCache();
    cache.getContext({ year: 2024, month: 0, dayOfMonth: 0 });
    cache.getContext({ year: 2024, month: 0, dayOfMonth: 1 });
    expect(cache.size).toBe(2);
    cache.clear();
    expect(cache.size).toBe(0);
  });
  it('contexts are functional epoch contexts', () => {
    const cache = new EpochDataCache();
    const ctx = cache.getContext({ year: 2024, month: 5, dayOfMonth: 14 });
    expect(typeof ctx.get).toBe('function');
    const val = ctx.get('test', () => 42);
    expect(val).toBe(42);
    expect(ctx.get('test', () => 99)).toBe(42);
  });
});

describe('canConditionTreeMatchRange()', () => {
  const rangeStart = { year: 2024, month: 3, dayOfMonth: 0 };
  const rangeEnd = { year: 2024, month: 8, dayOfMonth: 29 };
  it('rejects year == outside range', () => {
    const tree = createGroup('and', [{ field: 'year', op: '==', value: 2020 }]);
    expect(canConditionTreeMatchRange(tree, rangeStart, rangeEnd)).toBe(false);
  });
  it('accepts year == inside range', () => {
    const tree = createGroup('and', [{ field: 'year', op: '==', value: 2024 }]);
    expect(canConditionTreeMatchRange(tree, rangeStart, rangeEnd)).toBe(true);
  });
  it('rejects year >= when rangeEnd.year < value', () => {
    const tree = createGroup('and', [{ field: 'year', op: '>=', value: 2030 }]);
    expect(canConditionTreeMatchRange(tree, rangeStart, rangeEnd)).toBe(false);
  });
  it('rejects year <= when rangeStart.year > value', () => {
    const tree = createGroup('and', [{ field: 'year', op: '<=', value: 2020 }]);
    expect(canConditionTreeMatchRange(tree, rangeStart, rangeEnd)).toBe(false);
  });
  it('rejects year > when rangeEnd.year <= value', () => {
    const tree = createGroup('and', [{ field: 'year', op: '>', value: 2024 }]);
    expect(canConditionTreeMatchRange(tree, rangeStart, rangeEnd)).toBe(false);
  });
  it('rejects year < when rangeStart.year >= value', () => {
    const tree = createGroup('and', [{ field: 'year', op: '<', value: 2024 }]);
    expect(canConditionTreeMatchRange(tree, rangeStart, rangeEnd)).toBe(false);
  });
  it('returns true for OR groups (conservative)', () => {
    const tree = createGroup('or', [ { field: 'year', op: '==', value: 2020 }, { field: 'year', op: '==', value: 2024 } ]);
    expect(canConditionTreeMatchRange(tree, rangeStart, rangeEnd)).toBe(true);
  });
  it('returns true for null/undefined tree', () => {
    expect(canConditionTreeMatchRange(null, rangeStart, rangeEnd)).toBe(true);
    expect(canConditionTreeMatchRange(undefined, rangeStart, rangeEnd)).toBe(true);
  });
  it('returns true for empty AND group', () => {
    const tree = createGroup('and', []);
    expect(canConditionTreeMatchRange(tree, rangeStart, rangeEnd)).toBe(true);
  });
  it('rejects month == outside single-year range', () => {
    const tree = createGroup('and', [{ field: 'month', op: '==', value: 1 }]);
    expect(canConditionTreeMatchRange(tree, rangeStart, rangeEnd)).toBe(false);
  });
  it('accepts month == inside single-year range', () => {
    const tree = createGroup('and', [{ field: 'month', op: '==', value: 5 }]);
    expect(canConditionTreeMatchRange(tree, rangeStart, rangeEnd)).toBe(true);
  });
  it('handles single condition at root (not a group)', () => {
    expect(canConditionTreeMatchRange({ field: 'year', op: '==', value: 2020 }, rangeStart, rangeEnd)).toBe(false);
    expect(canConditionTreeMatchRange({ field: 'year', op: '==', value: 2024 }, rangeStart, rangeEnd)).toBe(true);
  });
});

describe('getSearchDistanceFromTree()', () => {
  it('returns modulo value for day % N', () => {
    const tree = createGroup('and', [{ field: 'day', op: '%', value: 5 }]);
    expect(getSearchDistanceFromTree(tree)).toBe(5);
  });
  it('returns 7 for weekday == X', () => {
    const tree = createGroup('and', [{ field: 'weekday', op: '==', value: 3 }]);
    expect(getSearchDistanceFromTree(tree)).toBe(7);
  });
  it('returns calendar year length for month == X', () => {
    const cal = CalendarManager.getActiveCalendar();
    const yearLen = cal.getDaysInYear(0);
    const tree = createGroup('and', [{ field: 'month', op: '==', value: 6 }]);
    expect(getSearchDistanceFromTree(tree)).toBe(yearLen);
  });
  it('returns 31 for day == X', () => {
    const tree = createGroup('and', [{ field: 'day', op: '==', value: 15 }]);
    expect(getSearchDistanceFromTree(tree)).toBe(31);
  });
  it('returns calendar year length for dayOfYear == X', () => {
    const cal = CalendarManager.getActiveCalendar();
    const yearLen = cal.getDaysInYear(0);
    const tree = createGroup('and', [{ field: 'dayOfYear', op: '==', value: 100 }]);
    expect(getSearchDistanceFromTree(tree)).toBe(yearLen);
  });
  it('returns calendar year length for empty/null tree', () => {
    const cal = CalendarManager.getActiveCalendar();
    const yearLen = cal.getDaysInYear(0);
    expect(getSearchDistanceFromTree(null)).toBe(yearLen);
    expect(getSearchDistanceFromTree(createGroup('and', []))).toBe(yearLen);
  });
  it('takes minimum of multiple AND children', () => {
    const tree = createGroup('and', [ { field: 'day', op: '%', value: 10 }, { field: 'weekday', op: '==', value: 1 } ]);
    expect(getSearchDistanceFromTree(tree)).toBe(7);
  });
  it('takes maximum for OR children', () => {
    const cal = CalendarManager.getActiveCalendar();
    const yearLen = cal.getDaysInYear(0);
    const tree = createGroup('or', [ { field: 'day', op: '%', value: 3 }, { field: 'month', op: '==', value: 6 } ]);
    expect(getSearchDistanceFromTree(tree)).toBe(yearLen);
  });
});

describe('moonSubPhase field', () => {
  it('returns 1 (rising) for early position within phase', () => {
    const cal = CalendarManager.getActiveCalendar();
    cal.getMoonPhase.mockReturnValue({ position: 0.51, phaseIndex: 4, dayWithinPhase: 0, phaseDuration: 3 });
    const result = getFieldValue(CONDITION_FIELDS.MOON_SUB_PHASE, { year: 2000, month: 0, dayOfMonth: 10 }, 0);
    expect(result).toBe(1);
  });
  it('returns 2 (true) for middle position within phase', () => {
    const cal = CalendarManager.getActiveCalendar();
    cal.getMoonPhase.mockReturnValue({ position: 0.55, phaseIndex: 4, dayWithinPhase: 1, phaseDuration: 3 });
    const result = getFieldValue(CONDITION_FIELDS.MOON_SUB_PHASE, { year: 2000, month: 0, dayOfMonth: 10 }, 0);
    expect(result).toBe(2);
  });
  it('returns 3 (fading) for late position within phase', () => {
    const cal = CalendarManager.getActiveCalendar();
    cal.getMoonPhase.mockReturnValue({ position: 0.6, phaseIndex: 4, dayWithinPhase: 2, phaseDuration: 3 });
    const result = getFieldValue(CONDITION_FIELDS.MOON_SUB_PHASE, { year: 2000, month: 0, dayOfMonth: 10 }, 0);
    expect(result).toBe(3);
  });
  it('returns null for invalid moon index', () => {
    const result = getFieldValue(CONDITION_FIELDS.MOON_SUB_PHASE, { year: 2000, month: 0, dayOfMonth: 0 }, 99);
    expect(result).toBe(null);
  });
  it('returns null when getMoonPhase returns null', () => {
    const cal = CalendarManager.getActiveCalendar();
    cal.getMoonPhase.mockReturnValue(null);
    const result = getFieldValue(CONDITION_FIELDS.MOON_SUB_PHASE, { year: 2000, month: 0, dayOfMonth: 0 }, 0);
    expect(result).toBe(null);
  });
  it('returns null when dayWithinPhase is missing', () => {
    const cal = CalendarManager.getActiveCalendar();
    cal.getMoonPhase.mockReturnValue({ position: 0.5, phaseIndex: 4 });
    const result = getFieldValue(CONDITION_FIELDS.MOON_SUB_PHASE, { year: 2000, month: 0, dayOfMonth: 0 }, 0);
    expect(result).toBe(null);
  });
  it('evaluates moonSubPhase condition with == operator', () => {
    const cal = CalendarManager.getActiveCalendar();
    cal.getMoonPhase.mockReturnValue({ position: 0.55, phaseIndex: 4, dayWithinPhase: 1, phaseDuration: 3 });
    const condition = { field: 'moonSubPhase', op: '==', value: 2, value2: 0 };
    expect(evaluateCondition(condition, { year: 2000, month: 0, dayOfMonth: 10 })).toBe(true);
    expect(evaluateCondition({ ...condition, value: 1 }, { year: 2000, month: 0, dayOfMonth: 10 })).toBe(false);
  });
});

describe('random field', () => {
  it('returns deterministic value for same seed/date', () => {
    const date = { year: 2000, month: 0, dayOfMonth: 0 };
    const val1 = getFieldValue(CONDITION_FIELDS.RANDOM, date, 42);
    const val2 = getFieldValue(CONDITION_FIELDS.RANDOM, date, 42);
    expect(val1).toBe(val2);
  });
  it('returns different values for different seeds', () => {
    const date = { year: 2000, month: 0, dayOfMonth: 0 };
    const val1 = getFieldValue(CONDITION_FIELDS.RANDOM, date, 42);
    const val2 = getFieldValue(CONDITION_FIELDS.RANDOM, date, 99);
    expect(val1).not.toBe(val2);
  });
  it('returns different values for different dates', () => {
    const val1 = getFieldValue(CONDITION_FIELDS.RANDOM, { year: 2000, month: 0, dayOfMonth: 0 }, 42);
    const val2 = getFieldValue(CONDITION_FIELDS.RANDOM, { year: 2000, month: 0, dayOfMonth: 1 }, 42);
    expect(val1).not.toBe(val2);
  });
  it('returns value in [0, 100) range', () => {
    for (let d = 0; d < 100; d++) {
      const val = getFieldValue(CONDITION_FIELDS.RANDOM, { year: 2000, month: 0, dayOfMonth: d }, 12345);
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThan(100);
    }
  });
  it('evaluates random <= probability condition', () => {
    const date = { year: 2000, month: 0, dayOfMonth: 0 };
    const randomValue = getFieldValue(CONDITION_FIELDS.RANDOM, date, 42);
    expect(evaluateCondition({ field: 'random', op: '<=', value: 100, value2: 42 }, date)).toBe(true);
    expect(evaluateCondition({ field: 'random', op: '<=', value: 0, value2: 42 }, date)).toBe(randomValue <= 0);
  });
  it('matches legacy seededRandom output', () => {
    const date = { year: 2000, month: 5, dayOfMonth: 14 };
    const val = getFieldValue(CONDITION_FIELDS.RANDOM, date, 777);
    expect(typeof val).toBe('number');
    expect(val).toBeGreaterThanOrEqual(0);
    expect(val).toBeLessThan(100);
  });
});

describe('computed field (via registered handler)', () => {
  let mockResolve;
  beforeEach(() => {
    mockResolve = vi.fn(() => null);
    registerFieldHandler(CONDITION_FIELDS.COMPUTED, (condition, date) => {
      const config = condition.value2;
      if (!config?.chain?.length) return false;
      const resolved = mockResolve(config, date.year);
      if (!resolved) return false;
      return resolved.year === date.year && resolved.month === date.month && resolved.dayOfMonth === date.dayOfMonth;
    });
  });
  it('returns false when computedConfig is null', () => {
    const condition = { field: CONDITION_FIELDS.COMPUTED, op: CONDITION_OPERATORS.EQUAL, value: true, value2: null };
    expect(evaluateCondition(condition, { year: 2000, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('returns false when config has no chain', () => {
    const condition = { field: CONDITION_FIELDS.COMPUTED, op: CONDITION_OPERATORS.EQUAL, value: true, value2: { chain: [] } };
    expect(evaluateCondition(condition, { year: 2000, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('returns true when resolved date matches current date', () => {
    const date = { year: 2000, month: 2, dayOfMonth: 14 };
    const config = { chain: [{ type: 'anchor', value: 'springEquinox' }] };
    mockResolve.mockReturnValue({ year: 2000, month: 2, dayOfMonth: 14 });
    const condition = { field: CONDITION_FIELDS.COMPUTED, op: CONDITION_OPERATORS.EQUAL, value: true, value2: config };
    expect(evaluateCondition(condition, date)).toBe(true);
    expect(mockResolve).toHaveBeenCalledWith(config, 2000);
  });
  it('returns false when resolved date does not match', () => {
    const date = { year: 2000, month: 2, dayOfMonth: 14 };
    const config = { chain: [{ type: 'anchor', value: 'springEquinox' }] };
    mockResolve.mockReturnValue({ year: 2000, month: 2, dayOfMonth: 20 });
    const condition = { field: CONDITION_FIELDS.COMPUTED, op: CONDITION_OPERATORS.EQUAL, value: true, value2: config };
    expect(evaluateCondition(condition, date)).toBe(false);
  });
  it('returns false when resolve returns null', () => {
    const config = { chain: [{ type: 'anchor', value: 'springEquinox' }] };
    const condition = { field: CONDITION_FIELDS.COMPUTED, op: CONDITION_OPERATORS.EQUAL, value: true, value2: config };
    expect(evaluateCondition(condition, { year: 2000, month: 0, dayOfMonth: 0 })).toBe(false);
  });
});

describe('isLeapYear field', () => {
  beforeEach(() => CalendarManager._reset());
  it('returns 1 for a leap year', () => {
    const value = getFieldValue(CONDITION_FIELDS.IS_LEAP_YEAR, { year: 2000, month: 0, dayOfMonth: 0 });
    expect(value).toBe(true);
  });
  it('returns false for a non-leap year', () => {
    const value = getFieldValue(CONDITION_FIELDS.IS_LEAP_YEAR, { year: 2001, month: 0, dayOfMonth: 0 });
    expect(value).toBe(false);
  });
  it('returns false for century years not divisible by 400', () => {
    const value = getFieldValue(CONDITION_FIELDS.IS_LEAP_YEAR, { year: 1900, month: 0, dayOfMonth: 0 });
    expect(value).toBe(false);
  });
  it('returns true for century years divisible by 400', () => {
    const value = getFieldValue(CONDITION_FIELDS.IS_LEAP_YEAR, { year: 2400, month: 0, dayOfMonth: 0 });
    expect(value).toBe(true);
  });
  it('evaluates isLeapYear == true condition correctly', () => {
    const condition = { field: CONDITION_FIELDS.IS_LEAP_YEAR, op: '==', value: true };
    expect(evaluateCondition(condition, { year: 2000, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(evaluateCondition(condition, { year: 2001, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('evaluates isLeapYear == false condition correctly', () => {
    const condition = { field: CONDITION_FIELDS.IS_LEAP_YEAR, op: '==', value: false };
    expect(evaluateCondition(condition, { year: 2001, month: 0, dayOfMonth: 0 })).toBe(true);
    expect(evaluateCondition(condition, { year: 2000, month: 0, dayOfMonth: 0 })).toBe(false);
  });
  it('accounts for yearZero offset', () => {
    CalendarManager._configure({ years: { yearZero: 100 } });
    const value = getFieldValue(CONDITION_FIELDS.IS_LEAP_YEAR, { year: 204, month: 0, dayOfMonth: 0 });
    expect(value).toBe(true);
    const value2 = getFieldValue(CONDITION_FIELDS.IS_LEAP_YEAR, { year: 201, month: 0, dayOfMonth: 0 });
    expect(value2).toBe(false);
  });
  it('returns false when calendar has no isLeapYear method', () => {
    CalendarManager._configure({ isLeapYear: undefined });
    CalendarManager.getActiveCalendar.mockReturnValue(null);
    const value = getFieldValue(CONDITION_FIELDS.IS_LEAP_YEAR, { year: 2000, month: 0, dayOfMonth: 0 });
    expect(value).toBe(false);
  });
  it('works in a condition tree with date conditions', () => {
    const tree = { type: 'group', mode: 'and', children: [ { type: 'condition', field: CONDITION_FIELDS.IS_LEAP_YEAR, op: '==', value: true }, { type: 'condition', field: CONDITION_FIELDS.DAY_OF_YEAR, op: '==', value: 60 } ] };
    const leapDate = { year: 2000, month: 1, dayOfMonth: 28 };
    const nonLeapDate = { year: 2001, month: 1, dayOfMonth: 28 };
    const result1 = evaluateConditions(tree.children, leapDate);
    const result2 = evaluateConditions(tree.children, nonLeapDate);
    expect(result1).toBe(true);
    expect(result2).toBe(false);
  });
});
