/**
 * Tests for leap-year-utils.mjs
 * @module Tests/LeapYearUtils
 */

import { describe, it, expect, vi } from 'vitest';

// Mock localization before importing
vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: (key) => key,
  format: (key, data) => {
    let result = key;
    for (const [k, v] of Object.entries(data || {})) {
      result = result.replace(`{${k}}`, String(v));
    }
    return result;
  }
}));

import { parseInterval, parsePattern, voteOnYear, intersectsYear, isLeapYear, getLeapYearDescription } from '../../scripts/calendar/calendar-utils.mjs';

/* -------------------------------------------- */
/*  parseInterval()                             */
/* -------------------------------------------- */

describe('parseInterval()', () => {
  it('parses simple interval', () => {
    const result = parseInterval('4', 0);
    expect(result.interval).toBe(4);
    expect(result.subtracts).toBe(false);
    expect(result.offset).toBe(0);
  });

  it('parses negating interval with !', () => {
    const result = parseInterval('!100', 0);
    expect(result.interval).toBe(100);
    expect(result.subtracts).toBe(true);
    expect(result.offset).toBe(0);
  });

  it('parses interval ignoring offset with +', () => {
    const result = parseInterval('+400', 5);
    expect(result.interval).toBe(400);
    expect(result.subtracts).toBe(false);
    expect(result.offset).toBe(0);
  });

  it('applies offset correctly', () => {
    const result = parseInterval('4', 2);
    expect(result.interval).toBe(4);
    expect(result.offset).toBe(2);
  });

  it('handles numeric input', () => {
    const result = parseInterval(4, 0);
    expect(result.interval).toBe(4);
  });

  it('defaults to interval of 1 for invalid input', () => {
    const result = parseInterval('', 0);
    expect(result.interval).toBe(1);
  });

  it('handles whitespace', () => {
    const result = parseInterval('  4  ', 0);
    expect(result.interval).toBe(4);
  });

  it('handles combined ! and + modifiers', () => {
    const result = parseInterval('!+100', 5);
    expect(result.interval).toBe(100);
    expect(result.subtracts).toBe(true);
    expect(result.offset).toBe(0);
  });
});

/* -------------------------------------------- */
/*  parsePattern()                              */
/* -------------------------------------------- */

describe('parsePattern()', () => {
  it('parses Gregorian pattern "400,!100,4"', () => {
    const intervals = parsePattern('400,!100,4', 0);
    expect(intervals).toHaveLength(3);
    expect(intervals[0].interval).toBe(400);
    expect(intervals[0].subtracts).toBe(false);
    expect(intervals[1].interval).toBe(100);
    expect(intervals[1].subtracts).toBe(true);
    expect(intervals[2].interval).toBe(4);
    expect(intervals[2].subtracts).toBe(false);
  });

  it('returns empty array for null/undefined pattern', () => {
    expect(parsePattern(null, 0)).toEqual([]);
    expect(parsePattern(undefined, 0)).toEqual([]);
  });

  it('returns empty array for empty string', () => {
    expect(parsePattern('', 0)).toEqual([]);
  });

  it('returns empty array for non-string input', () => {
    expect(parsePattern(123, 0)).toEqual([]);
  });

  it('handles whitespace in pattern', () => {
    const intervals = parsePattern('  4 , !100 ,  400  ', 0);
    expect(intervals).toHaveLength(3);
    expect(intervals[0].interval).toBe(4);
    expect(intervals[1].interval).toBe(100);
    expect(intervals[2].interval).toBe(400);
  });

  it('filters out empty segments', () => {
    const intervals = parsePattern('4,,100', 0);
    expect(intervals).toHaveLength(2);
  });
});

/* -------------------------------------------- */
/*  voteOnYear()                                */
/* -------------------------------------------- */

describe('voteOnYear()', () => {
  it('returns "allow" when year matches non-subtracting interval', () => {
    const interval = { interval: 4, subtracts: false, offset: 0 };
    expect(voteOnYear(interval, 2020, true)).toBe('allow');
    expect(voteOnYear(interval, 2024, true)).toBe('allow');
  });

  it('returns "deny" when year matches subtracting interval', () => {
    const interval = { interval: 100, subtracts: true, offset: 0 };
    expect(voteOnYear(interval, 1900, true)).toBe('deny');
    expect(voteOnYear(interval, 2100, true)).toBe('deny');
  });

  it('returns "abstain" when year does not match', () => {
    const interval = { interval: 4, subtracts: false, offset: 0 };
    expect(voteOnYear(interval, 2021, true)).toBe('abstain');
    expect(voteOnYear(interval, 2022, true)).toBe('abstain');
    expect(voteOnYear(interval, 2023, true)).toBe('abstain');
  });

  it('handles offset correctly', () => {
    const interval = { interval: 4, subtracts: false, offset: 2 };
    expect(voteOnYear(interval, 2, true)).toBe('allow');
    expect(voteOnYear(interval, 6, true)).toBe('allow');
    expect(voteOnYear(interval, 4, true)).toBe('abstain');
  });

  it('adjusts for calendars without year zero', () => {
    const interval = { interval: 4, subtracts: false, offset: 0 };
    // When yearZeroExists is false and year < 0, mod++ is applied
    // This shifts the pattern by 1 for negative years
    // -4: mod = -4, mod++ = -3, -3 % 4 = -3 (abstain)
    // -5: mod = -5, mod++ = -4, -4 % 4 = 0 (allow)
    expect(voteOnYear(interval, -4, false)).toBe('abstain');
    expect(voteOnYear(interval, -5, false)).toBe('allow');
  });
});

/* -------------------------------------------- */
/*  intersectsYear()                            */
/* -------------------------------------------- */

describe('intersectsYear()', () => {
  it('returns false for empty intervals', () => {
    expect(intersectsYear([], 2020, true)).toBe(false);
    expect(intersectsYear(null, 2020, true)).toBe(false);
    expect(intersectsYear(undefined, 2020, true)).toBe(false);
  });

  it('returns true when more allows than denies', () => {
    const intervals = [
      { interval: 4, subtracts: false, offset: 0 },
      { interval: 100, subtracts: true, offset: 0 }
    ];
    // 2020: divisible by 4 (allow), not by 100 (abstain) = net +1 = true
    expect(intersectsYear(intervals, 2020, true)).toBe(true);
  });

  it('returns false when more denies than allows', () => {
    const intervals = [
      { interval: 4, subtracts: false, offset: 0 },
      { interval: 100, subtracts: true, offset: 0 }
    ];
    // 1900: divisible by 4 (allow), divisible by 100 (deny) = net 0 = false
    expect(intersectsYear(intervals, 1900, true)).toBe(false);
  });

  it('handles Gregorian pattern correctly', () => {
    const intervals = parsePattern('400,!100,4', 0);
    // 2000: div by 400 (allow), div by 100 (deny), div by 4 (allow) = net +1 = true
    expect(intersectsYear(intervals, 2000, true)).toBe(true);
    // 1900: not div by 400 (abstain), div by 100 (deny), div by 4 (allow) = net 0 = false
    expect(intersectsYear(intervals, 1900, true)).toBe(false);
    // 2020: not div by 400 (abstain), not div by 100 (abstain), div by 4 (allow) = net +1 = true
    expect(intersectsYear(intervals, 2020, true)).toBe(true);
    // 2021: abstain, abstain, abstain = net 0 = false
    expect(intersectsYear(intervals, 2021, true)).toBe(false);
  });
});

/* -------------------------------------------- */
/*  isLeapYear()                                */
/* -------------------------------------------- */

describe('isLeapYear()', () => {
  describe('rule: none', () => {
    it('always returns false', () => {
      const config = { rule: 'none' };
      expect(isLeapYear(config, 2020)).toBe(false);
      expect(isLeapYear(config, 2000)).toBe(false);
      expect(isLeapYear(config, 1)).toBe(false);
    });

    it('returns false for null config', () => {
      expect(isLeapYear(null, 2020)).toBe(false);
    });

    it('returns false for undefined config', () => {
      expect(isLeapYear(undefined, 2020)).toBe(false);
    });

    it('returns false for config without rule', () => {
      expect(isLeapYear({}, 2020)).toBe(false);
    });
  });

  describe('rule: simple', () => {
    it('uses interval to determine leap years', () => {
      const config = { rule: 'simple', interval: 4 };
      expect(isLeapYear(config, 4)).toBe(true);
      expect(isLeapYear(config, 8)).toBe(true);
      expect(isLeapYear(config, 5)).toBe(false);
    });

    it('respects start offset', () => {
      const config = { rule: 'simple', interval: 4, start: 2 };
      expect(isLeapYear(config, 2)).toBe(true);
      expect(isLeapYear(config, 6)).toBe(true);
      expect(isLeapYear(config, 4)).toBe(false);
    });

    it('handles leapInterval alias', () => {
      const config = { rule: 'simple', leapInterval: 5 };
      expect(isLeapYear(config, 5)).toBe(true);
      expect(isLeapYear(config, 10)).toBe(true);
      expect(isLeapYear(config, 3)).toBe(false);
    });

    it('returns false for invalid interval', () => {
      expect(isLeapYear({ rule: 'simple', interval: 0 }, 4)).toBe(false);
      expect(isLeapYear({ rule: 'simple', interval: -1 }, 4)).toBe(false);
      expect(isLeapYear({ rule: 'simple' }, 4)).toBe(false);
    });
  });

  describe('rule: gregorian', () => {
    it('matches real-world Gregorian leap years', () => {
      const config = { rule: 'gregorian' };
      // Common leap years
      expect(isLeapYear(config, 2020)).toBe(true);
      expect(isLeapYear(config, 2024)).toBe(true);
      expect(isLeapYear(config, 2000)).toBe(true);
      expect(isLeapYear(config, 1600)).toBe(true);
      // Common non-leap years
      expect(isLeapYear(config, 2021)).toBe(false);
      expect(isLeapYear(config, 2022)).toBe(false);
      expect(isLeapYear(config, 2023)).toBe(false);
      // Century years not divisible by 400
      expect(isLeapYear(config, 1900)).toBe(false);
      expect(isLeapYear(config, 2100)).toBe(false);
      expect(isLeapYear(config, 1800)).toBe(false);
      expect(isLeapYear(config, 1700)).toBe(false);
    });
  });

  describe('rule: custom', () => {
    it('uses custom pattern', () => {
      const config = { rule: 'custom', pattern: '8,!4' };
      // 8: div by 8 (allow), div by 4 (deny) = net 0 = false? Let me check
      // Actually with pattern '8,!4':
      // 8: div by 8 (allow), div by 4 (deny) = +1 - 1 = 0 = false
      // 4: not div by 8 (abstain), div by 4 (deny) = -1 = false
      // 16: div by 8 (allow), div by 4 (deny) = 0 = false
      // This pattern results in no leap years since 8 is always div by 4
      expect(isLeapYear(config, 4)).toBe(false);
      expect(isLeapYear(config, 8)).toBe(false);
    });

    it('handles pattern with positive votes winning', () => {
      const config = { rule: 'custom', pattern: '3' };
      expect(isLeapYear(config, 3)).toBe(true);
      expect(isLeapYear(config, 6)).toBe(true);
      expect(isLeapYear(config, 9)).toBe(true);
      expect(isLeapYear(config, 4)).toBe(false);
    });

    it('returns false for empty pattern', () => {
      expect(isLeapYear({ rule: 'custom', pattern: '' }, 2020)).toBe(false);
      expect(isLeapYear({ rule: 'custom' }, 2020)).toBe(false);
    });
  });

  describe('rule: unknown', () => {
    it('returns false for unknown rule', () => {
      expect(isLeapYear({ rule: 'unknown' }, 2020)).toBe(false);
      expect(isLeapYear({ rule: 'invalid' }, 2020)).toBe(false);
    });
  });
});

/* -------------------------------------------- */
/*  getLeapYearDescription()                    */
/* -------------------------------------------- */

describe('getLeapYearDescription()', () => {
  it('returns None description for null config', () => {
    expect(getLeapYearDescription(null)).toBe('CALENDARIA.LeapYear.None');
  });

  it('returns None description for rule: none', () => {
    expect(getLeapYearDescription({ rule: 'none' })).toBe('CALENDARIA.LeapYear.None');
  });

  it('returns Simple description with interval and start', () => {
    const result = getLeapYearDescription({ rule: 'simple', interval: 4, start: 0 });
    expect(result).toContain('CALENDARIA.LeapYear.Simple');
  });

  it('returns Gregorian description', () => {
    expect(getLeapYearDescription({ rule: 'gregorian' })).toBe('CALENDARIA.LeapYear.Gregorian');
  });

  it('returns Custom description with pattern', () => {
    const result = getLeapYearDescription({ rule: 'custom', pattern: '400,!100,4' });
    expect(result).toContain('CALENDARIA.LeapYear.Custom');
  });

  it('returns None description for unknown rule', () => {
    expect(getLeapYearDescription({ rule: 'unknown' })).toBe('CALENDARIA.LeapYear.None');
  });
});
