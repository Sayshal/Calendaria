/**
 * Tests for format-utils.mjs
 * @module Tests/FormatUtils
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

import { ordinal, toRomanNumeral, dateFormattingParts, formatShort, formatLong, formatFull, formatTime, formatTime12 } from '../../scripts/utils/format-utils.mjs';
import { addCalendarGetters } from '../__mocks__/calendar-manager.mjs';

/* -------------------------------------------- */
/*  Mock Calendar Data                          */
/* -------------------------------------------- */

// Basic Gregorian-like calendar mock
const mockCalendar = addCalendarGetters({
  months: {
    values: [
      { name: 'January', abbreviation: 'Jan', days: 31 },
      { name: 'February', abbreviation: 'Feb', days: 28 },
      { name: 'March', abbreviation: 'Mar', days: 31 },
      { name: 'April', abbreviation: 'Apr', days: 30 },
      { name: 'May', abbreviation: 'May', days: 31 },
      { name: 'June', abbreviation: 'Jun', days: 30 },
      { name: 'July', abbreviation: 'Jul', days: 31 },
      { name: 'August', abbreviation: 'Aug', days: 31 },
      { name: 'September', abbreviation: 'Sep', days: 30 },
      { name: 'October', abbreviation: 'Oct', days: 31 },
      { name: 'November', abbreviation: 'Nov', days: 30 },
      { name: 'December', abbreviation: 'Dec', days: 31 }
    ]
  },
  days: {
    values: [
      { name: 'Sunday', abbreviation: 'Sun' },
      { name: 'Monday', abbreviation: 'Mon' },
      { name: 'Tuesday', abbreviation: 'Tue' },
      { name: 'Wednesday', abbreviation: 'Wed' },
      { name: 'Thursday', abbreviation: 'Thu' },
      { name: 'Friday', abbreviation: 'Fri' },
      { name: 'Saturday', abbreviation: 'Sat' }
    ],
    hoursPerDay: 24,
    minutesPerHour: 60,
    secondsPerMinute: 60,
    daysPerYear: 365
  },
  years: {
    yearZero: 0,
    firstWeekday: 0
  },
  isMonthless: false,
  eras: [{ name: 'Common Era', abbreviation: 'CE', startYear: 1 }]
});

/* -------------------------------------------- */
/*  ordinal()                                   */
/* -------------------------------------------- */

describe('ordinal()', () => {
  it('returns 1st for 1', () => {
    expect(ordinal(1)).toBe('1st');
  });

  it('returns 2nd for 2', () => {
    expect(ordinal(2)).toBe('2nd');
  });

  it('returns 3rd for 3', () => {
    expect(ordinal(3)).toBe('3rd');
  });

  it('returns 4th for 4', () => {
    expect(ordinal(4)).toBe('4th');
  });

  it('handles teens correctly (11th, 12th, 13th)', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(12)).toBe('12th');
    expect(ordinal(13)).toBe('13th');
  });

  it('handles 21st, 22nd, 23rd', () => {
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
    expect(ordinal(23)).toBe('23rd');
  });

  it('handles 111th, 112th, 113th (century teens)', () => {
    expect(ordinal(111)).toBe('111th');
    expect(ordinal(112)).toBe('112th');
    expect(ordinal(113)).toBe('113th');
  });

  it('handles large numbers', () => {
    expect(ordinal(100)).toBe('100th');
    expect(ordinal(101)).toBe('101st');
    expect(ordinal(102)).toBe('102nd');
    expect(ordinal(103)).toBe('103rd');
    expect(ordinal(1000)).toBe('1000th');
    expect(ordinal(1001)).toBe('1001st');
  });

  it('handles zero', () => {
    expect(ordinal(0)).toBe('0th');
  });
});

/* -------------------------------------------- */
/*  toRomanNumeral()                            */
/* -------------------------------------------- */

describe('toRomanNumeral()', () => {
  it('converts single digit values', () => {
    expect(toRomanNumeral(1)).toBe('I');
    expect(toRomanNumeral(2)).toBe('II');
    expect(toRomanNumeral(3)).toBe('III');
    expect(toRomanNumeral(4)).toBe('IV');
    expect(toRomanNumeral(5)).toBe('V');
    expect(toRomanNumeral(6)).toBe('VI');
    expect(toRomanNumeral(7)).toBe('VII');
    expect(toRomanNumeral(8)).toBe('VIII');
    expect(toRomanNumeral(9)).toBe('IX');
  });

  it('converts tens', () => {
    expect(toRomanNumeral(10)).toBe('X');
    expect(toRomanNumeral(20)).toBe('XX');
    expect(toRomanNumeral(30)).toBe('XXX');
    expect(toRomanNumeral(40)).toBe('XL');
    expect(toRomanNumeral(50)).toBe('L');
    expect(toRomanNumeral(60)).toBe('LX');
    expect(toRomanNumeral(70)).toBe('LXX');
    expect(toRomanNumeral(80)).toBe('LXXX');
    expect(toRomanNumeral(90)).toBe('XC');
  });

  it('converts hundreds', () => {
    expect(toRomanNumeral(100)).toBe('C');
    expect(toRomanNumeral(200)).toBe('CC');
    expect(toRomanNumeral(300)).toBe('CCC');
    expect(toRomanNumeral(400)).toBe('CD');
    expect(toRomanNumeral(500)).toBe('D');
    expect(toRomanNumeral(600)).toBe('DC');
    expect(toRomanNumeral(700)).toBe('DCC');
    expect(toRomanNumeral(800)).toBe('DCCC');
    expect(toRomanNumeral(900)).toBe('CM');
  });

  it('converts thousands', () => {
    expect(toRomanNumeral(1000)).toBe('M');
    expect(toRomanNumeral(2000)).toBe('MM');
    expect(toRomanNumeral(3000)).toBe('MMM');
  });

  it('converts complex numbers', () => {
    expect(toRomanNumeral(1999)).toBe('MCMXCIX');
    expect(toRomanNumeral(2024)).toBe('MMXXIV');
    expect(toRomanNumeral(3999)).toBe('MMMCMXCIX');
    expect(toRomanNumeral(1776)).toBe('MDCCLXXVI');
    expect(toRomanNumeral(1492)).toBe('MCDXCII');
  });

  it('returns original number as string for values < 1', () => {
    expect(toRomanNumeral(0)).toBe('0');
    expect(toRomanNumeral(-1)).toBe('-1');
    expect(toRomanNumeral(-100)).toBe('-100');
  });

  it('returns original number as string for values > 3999', () => {
    expect(toRomanNumeral(4000)).toBe('4000');
    expect(toRomanNumeral(5000)).toBe('5000');
    expect(toRomanNumeral(10000)).toBe('10000');
  });
});

/* -------------------------------------------- */
/*  dateFormattingParts()                       */
/* -------------------------------------------- */

describe('dateFormattingParts()', () => {
  const components = { year: 2024, month: 0, dayOfMonth: 15, hour: 14, minute: 30, second: 45 };

  describe('Year tokens', () => {
    it('returns year parts correctly', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.y).toBe(2024);
      expect(parts.yy).toBe('24');
      expect(parts.yyyy).toBe('2024');
    });

    it('pads short years', () => {
      const parts = dateFormattingParts(mockCalendar, { ...components, year: 5 });
      expect(parts.yyyy).toBe('0005');
    });
  });

  describe('Month tokens', () => {
    it('returns month number (1-indexed)', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.M).toBe(1);
      expect(parts.MM).toBe('01');
    });

    it('returns month name and abbreviation', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.MMM).toBe('Jan');
      expect(parts.MMMM).toBe('January');
    });

    it('returns ordinal month', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.Mo).toBe('1st');
    });

    it('handles different months', () => {
      const parts = dateFormattingParts(mockCalendar, { ...components, month: 11 });
      expect(parts.M).toBe(12);
      expect(parts.MMM).toBe('Dec');
      expect(parts.MMMM).toBe('December');
    });
  });

  describe('Day tokens', () => {
    it('returns day of month', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.D).toBe(15);
      expect(parts.DD).toBe('15');
      expect(parts.Do).toBe('15th');
    });

    it('pads single-digit days', () => {
      const parts = dateFormattingParts(mockCalendar, { ...components, dayOfMonth: 5 });
      expect(parts.DD).toBe('05');
    });

    it('calculates day of year', () => {
      // January 15 = day 15 of year
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.dayOfYear).toBe(15);
      expect(parts.DDD).toBe('015');
    });

    it('calculates day of year for later months', () => {
      // March 1 = 31 (Jan) + 28 (Feb) + 1 = day 60
      const parts = dateFormattingParts(mockCalendar, { ...components, month: 2, dayOfMonth: 1 });
      expect(parts.dayOfYear).toBe(60);
    });
  });

  describe('Weekday tokens', () => {
    it('returns weekday index', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.d).toBeGreaterThanOrEqual(0);
      expect(parts.d).toBeLessThan(7);
    });

    it('returns weekday name and abbreviation', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.dddd).toMatch(/^(Sunday|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday)$/);
      expect(parts.ddd).toMatch(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/);
      expect(parts.dd).toHaveLength(2);
    });
  });

  describe('Hour tokens', () => {
    it('returns 24h hour', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.H).toBe(14);
      expect(parts.HH).toBe('14');
    });

    it('returns 12h hour', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.h).toBe(2);
      expect(parts.hh).toBe('02');
    });

    it('handles midnight (12 AM)', () => {
      const parts = dateFormattingParts(mockCalendar, { ...components, hour: 0 });
      expect(parts.H).toBe(0);
      expect(parts.h).toBe(12);
      expect(parts.A).toBe('AM');
    });

    it('handles noon (12 PM)', () => {
      const parts = dateFormattingParts(mockCalendar, { ...components, hour: 12 });
      expect(parts.H).toBe(12);
      expect(parts.h).toBe(12);
      expect(parts.A).toBe('PM');
    });

    it('handles AM hours', () => {
      const parts = dateFormattingParts(mockCalendar, { ...components, hour: 9 });
      expect(parts.h).toBe(9);
      expect(parts.A).toBe('AM');
      expect(parts.a).toBe('am');
    });

    it('handles PM hours', () => {
      const parts = dateFormattingParts(mockCalendar, { ...components, hour: 21 });
      expect(parts.h).toBe(9);
      expect(parts.A).toBe('PM');
      expect(parts.a).toBe('pm');
    });
  });

  describe('Minute and second tokens', () => {
    it('returns minute parts', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.m).toBe(30);
      expect(parts.mm).toBe('30');
    });

    it('returns second parts', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.s).toBe(45);
      expect(parts.ss).toBe('45');
    });

    it('pads single-digit values', () => {
      const parts = dateFormattingParts(mockCalendar, { ...components, minute: 5, second: 9 });
      expect(parts.mm).toBe('05');
      expect(parts.ss).toBe('09');
    });
  });

  describe('Era tokens', () => {
    it('returns era information for matching year', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.era).toBe('Common Era');
      expect(parts.eraAbbr).toBe('CE');
      expect(parts.eraYear).toBe(2024);
    });

    it('returns empty era for calendar without eras', () => {
      const calWithoutEras = addCalendarGetters({ ...mockCalendar, eras: null });
      const parts = dateFormattingParts(calWithoutEras, components);
      expect(parts.era).toBe('');
      expect(parts.eraAbbr).toBe('');
      expect(parts.eraYear).toBe('');
    });
  });

  describe('Monthless calendars', () => {
    const monthlessCalendar = addCalendarGetters({ ...mockCalendar, isMonthless: true });

    it('returns empty month values', () => {
      const parts = dateFormattingParts(monthlessCalendar, { ...components, dayOfMonth: 100 });
      expect(parts.M).toBe('');
      expect(parts.MM).toBe('');
      expect(parts.MMM).toBe('');
      expect(parts.MMMM).toBe('');
      expect(parts.Mo).toBe('');
    });

    it('uses dayOfMonth as day of year for D', () => {
      const parts = dateFormattingParts(monthlessCalendar, { ...components, dayOfMonth: 100 });
      expect(parts.D).toBe(100);
      expect(parts.Do).toBe('100th');
    });
  });

  describe('Default values', () => {
    it('defaults hour, minute, second to 0', () => {
      const parts = dateFormattingParts(mockCalendar, { year: 2024, month: 0, dayOfMonth: 1 });
      expect(parts.H).toBe(0);
      expect(parts.m).toBe(0);
      expect(parts.s).toBe(0);
    });

    it('handles null calendar gracefully', () => {
      const parts = dateFormattingParts(null, components);
      expect(parts.y).toBe(2024);
      // Mock format returns key unchanged; real system would return 'Month 1'
      expect(parts.MMMM).toBe('CALENDARIA.Calendar.MonthFallback');
    });
  });
});

/* -------------------------------------------- */
/*  Preset Formatters                           */
/* -------------------------------------------- */

describe('formatShort()', () => {
  it('formats as "D MMM"', () => {
    const result = formatShort(mockCalendar, { year: 2024, month: 0, dayOfMonth: 5 });
    expect(result).toBe('5 Jan');
  });
});

describe('formatLong()', () => {
  it('formats as "D MMMM, y"', () => {
    const result = formatLong(mockCalendar, { year: 1492, month: 0, dayOfMonth: 5 });
    expect(result).toBe('5 January, 1492');
  });
});

describe('formatFull()', () => {
  it('formats as "dddd, D MMMM y"', () => {
    const result = formatFull(mockCalendar, { year: 1492, month: 0, dayOfMonth: 5 });
    expect(result).toMatch(/^\w+, 5 January 1492$/);
  });
});

describe('formatTime()', () => {
  it('formats as "HH:mm"', () => {
    const result = formatTime(mockCalendar, { year: 2024, month: 0, dayOfMonth: 1, hour: 14, minute: 30 });
    expect(result).toBe('14:30');
  });

  it('pads single digits', () => {
    const result = formatTime(mockCalendar, { year: 2024, month: 0, dayOfMonth: 1, hour: 9, minute: 5 });
    expect(result).toBe('09:05');
  });
});

describe('formatTime12()', () => {
  it('formats as "h:mm A"', () => {
    const result = formatTime12(mockCalendar, { year: 2024, month: 0, dayOfMonth: 1, hour: 14, minute: 30 });
    expect(result).toBe('2:30 PM');
  });

  it('handles AM times', () => {
    const result = formatTime12(mockCalendar, { year: 2024, month: 0, dayOfMonth: 1, hour: 9, minute: 30 });
    expect(result).toBe('9:30 AM');
  });

  it('handles midnight', () => {
    const result = formatTime12(mockCalendar, { year: 2024, month: 0, dayOfMonth: 1, hour: 0, minute: 0 });
    expect(result).toBe('12:00 AM');
  });

  it('handles noon', () => {
    const result = formatTime12(mockCalendar, { year: 2024, month: 0, dayOfMonth: 1, hour: 12, minute: 0 });
    expect(result).toBe('12:00 PM');
  });
});
