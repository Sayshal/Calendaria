/**
 * Tests for format-utils.mjs
 * @module Tests/FormatUtils
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

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

import {
  ordinal,
  toRomanNumeral,
  dateFormattingParts,
  formatShort,
  formatLong,
  formatFull,
  formatOrdinal,
  formatFantasy,
  formatTime,
  formatTime12,
  formatDateTime,
  formatDateTime12,
  formatApproximateTime,
  formatApproximateDate,
  formatCustom,
  validateFormatString,
  hasMoonIconMarkers,
  renderMoonIcons,
  stripMoonIconMarkers,
  formatDuration,
  formatGameDuration,
  resolveFormatString,
  formatForLocation,
  getDisplayLocationDefinitions,
  getDisplayFormat,
  timeSince,
  getAvailableTokens,
  DEFAULT_FORMAT_PRESETS,
  LOCATION_DEFAULTS
} from '../../scripts/utils/formatting/format-utils.mjs';
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
  const components = { year: 2024, month: 0, dayOfMonth: 14, hour: 14, minute: 30, second: 45 };

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
      const parts = dateFormattingParts(mockCalendar, { ...components, dayOfMonth: 4 });
      expect(parts.DD).toBe('05');
    });

    it('calculates day of year', () => {
      // January 15 = day 14 of year (0-indexed)
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.dayOfYear).toBe(14);
      expect(parts.DDD).toBe('015');
    });

    it('calculates day of year for later months', () => {
      // March 1 = 31 (Jan) + 28 (Feb) + 0 = day 59 (0-indexed)
      const parts = dateFormattingParts(mockCalendar, { ...components, month: 2, dayOfMonth: 0 });
      expect(parts.dayOfYear).toBe(59);
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

    it('returns EEEE/EEE/EE/E tokens', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.EEEE).toBe(parts.dddd);
      expect(parts.EEE).toBe(parts.ddd);
      expect(parts.EE).toBe(parts.ddd);
      expect(parts.E).toBe(parts.ddd);
    });

    it('returns EEEEE single-letter weekday', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.EEEEE).toHaveLength(1);
    });

    it('returns week of year and week of month', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.w).toBeGreaterThanOrEqual(1);
      expect(parts.ww).toMatch(/^\d{2}$/);
      expect(parts.W).toBeGreaterThanOrEqual(1);
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

    it('returns G/GG/GGG/GGGG tokens', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.G).toBe('CE');
      expect(parts.GG).toBe('CE');
      expect(parts.GGG).toBe('CE');
      expect(parts.GGGG).toBe('Common Era');
    });

    it('handles multiple eras with matchingEras array', () => {
      const multiEraCal = addCalendarGetters({
        ...mockCalendar,
        eras: [
          { name: 'Age of Kings', abbreviation: 'AK', startYear: 2000, endYear: 3000 },
          { name: 'Golden Era', abbreviation: 'GE', startYear: 2020, endYear: 2030 }
        ]
      });
      const parts = dateFormattingParts(multiEraCal, components);
      expect(parts.matchingEras).toHaveLength(2);
      expect(parts.matchingEras[0].name).toBe('Age of Kings');
      expect(parts.matchingEras[1].name).toBe('Golden Era');
    });
  });

  describe('Season tokens', () => {
    it('returns season info when getCurrentSeason is available', () => {
      const spring = { name: 'Spring', abbreviation: 'Spr' };
      const seasonCal = addCalendarGetters({
        ...mockCalendar,
        seasons: {
          values: [spring, { name: 'Summer', abbreviation: 'Sum' }]
        },
        getCurrentSeason: () => spring
      });
      const parts = dateFormattingParts(seasonCal, components);
      expect(parts.QQQQ).toBe('Spring');
      expect(parts.QQQ).toBe('Spr');
      expect(parts.Q).toBe(1);
      expect(parts.QQ).toBe('01');
    });

    it('returns empty season when no getCurrentSeason', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.QQQQ).toBe('');
      expect(parts.QQQ).toBe('');
      expect(parts.Q).toBe('');
    });
  });

  describe('Climate zone tokens', () => {
    it('returns zone info when getActiveClimateZone is available', () => {
      const zoneCal = addCalendarGetters({
        ...mockCalendar,
        getActiveClimateZone: () => ({ id: 'temperate', name: 'Temperate' })
      });
      const parts = dateFormattingParts(zoneCal, components);
      expect(parts.zzzz).toBe('Temperate');
      expect(parts.z).toBe('Tem');
    });

    it('returns empty zone when no getActiveClimateZone', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.zzzz).toBe('');
      expect(parts.z).toBe('');
    });
  });

  describe('Monthless calendars', () => {
    const monthlessCalendar = addCalendarGetters({ ...mockCalendar, isMonthless: true });

    it('returns empty month values', () => {
      const parts = dateFormattingParts(monthlessCalendar, { ...components, dayOfMonth: 99 });
      expect(parts.M).toBe('');
      expect(parts.MM).toBe('');
      expect(parts.MMM).toBe('');
      expect(parts.MMMM).toBe('');
      expect(parts.Mo).toBe('');
    });

    it('uses dayOfMonth as day of year for D', () => {
      const parts = dateFormattingParts(monthlessCalendar, { ...components, dayOfMonth: 99 });
      expect(parts.D).toBe(100);
      expect(parts.Do).toBe('100th');
    });
  });

  describe('Intercalary handling', () => {
    it('returns empty D/DD/Do for intercalary festival days', () => {
      const intercalaryCal = addCalendarGetters({
        ...mockCalendar,
        findFestivalDay: () => ({ name: 'Midwinter', countsForWeekday: false })
      });
      const parts = dateFormattingParts(intercalaryCal, components);
      expect(parts.D).toBe('');
      expect(parts.DD).toBe('');
      expect(parts.Do).toBe('');
      expect(parts.M).toBe('');
      expect(parts.MM).toBe('');
      expect(parts.MMMM).toBe('Midwinter');
    });
  });

  describe('Named week tokens', () => {
    it('returns named week when getCurrentWeek is available', () => {
      const weekCal = addCalendarGetters({
        ...mockCalendar,
        getCurrentWeek: () => ({ weekName: 'Week of the Wolf', weekAbbr: 'Wolf' })
      });
      const parts = dateFormattingParts(weekCal, components);
      expect(parts.namedWeek).toBe('Week of the Wolf');
      expect(parts.namedWeekAbbr).toBe('Wolf');
    });

    it('abbreviates named week if no weekAbbr', () => {
      const weekCal = addCalendarGetters({
        ...mockCalendar,
        getCurrentWeek: () => ({ weekName: 'Harvest' })
      });
      const parts = dateFormattingParts(weekCal, components);
      expect(parts.namedWeekAbbr).toBe('Har');
    });
  });

  describe('Year name tokens', () => {
    it('returns year name when matching', () => {
      const yearNameCal = addCalendarGetters({
        ...mockCalendar,
        years: { ...mockCalendar.years, names: [{ year: 2024, name: 'Year of the Dragon' }] }
      });
      const parts = dateFormattingParts(yearNameCal, components);
      expect(parts.yearName).toBe('Year of the Dragon');
    });

    it('returns empty string when no year name matches', () => {
      const parts = dateFormattingParts(mockCalendar, components);
      expect(parts.yearName).toBe('');
    });
  });

  describe('Default values', () => {
    it('defaults hour, minute, second to 0', () => {
      const parts = dateFormattingParts(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0 });
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
    const result = formatShort(mockCalendar, { year: 2024, month: 0, dayOfMonth: 4 });
    expect(result).toBe('5 Jan');
  });
});

describe('formatLong()', () => {
  it('formats as "D MMMM, y"', () => {
    const result = formatLong(mockCalendar, { year: 1492, month: 0, dayOfMonth: 4 });
    expect(result).toBe('5 January, 1492');
  });
});

describe('formatFull()', () => {
  it('formats as "dddd, D MMMM y"', () => {
    const result = formatFull(mockCalendar, { year: 1492, month: 0, dayOfMonth: 4 });
    expect(result).toMatch(/^\w+, 5 January 1492$/);
  });
});

describe('formatOrdinal()', () => {
  it('formats as "Do of MMMM, era"', () => {
    const result = formatOrdinal(mockCalendar, { year: 2024, month: 0, dayOfMonth: 4 });
    expect(result).toBe('5th of January, Common Era');
  });

  it('omits era when none matches', () => {
    const noEraCal = addCalendarGetters({ ...mockCalendar, eras: [] });
    const result = formatOrdinal(noEraCal, { year: 2024, month: 0, dayOfMonth: 4 });
    expect(result).toBe('5th of January');
  });
});

describe('formatFantasy()', () => {
  it('formats as "Do of MMMM, y era"', () => {
    const result = formatFantasy(mockCalendar, { year: 2024, month: 0, dayOfMonth: 4 });
    expect(result).toBe('5th of January, 2024 Common Era');
  });

  it('omits era when none matches', () => {
    const noEraCal = addCalendarGetters({ ...mockCalendar, eras: [] });
    const result = formatFantasy(noEraCal, { year: 2024, month: 0, dayOfMonth: 4 });
    expect(result).toBe('5th of January, 2024');
  });
});

describe('formatTime()', () => {
  it('formats as "HH:mm"', () => {
    const result = formatTime(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0, hour: 14, minute: 30 });
    expect(result).toBe('14:30');
  });

  it('pads single digits', () => {
    const result = formatTime(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0, hour: 9, minute: 5 });
    expect(result).toBe('09:05');
  });
});

describe('formatTime12()', () => {
  it('formats as "h:mm A"', () => {
    const result = formatTime12(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0, hour: 14, minute: 30 });
    expect(result).toBe('2:30 PM');
  });

  it('handles AM times', () => {
    const result = formatTime12(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0, hour: 9, minute: 30 });
    expect(result).toBe('9:30 AM');
  });

  it('handles midnight', () => {
    const result = formatTime12(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0, hour: 0, minute: 0 });
    expect(result).toBe('12:00 AM');
  });

  it('handles noon', () => {
    const result = formatTime12(mockCalendar, { year: 2024, month: 0, dayOfMonth: 0, hour: 12, minute: 0 });
    expect(result).toBe('12:00 PM');
  });
});

describe('formatDateTime()', () => {
  it('formats as "D MMMM y, HH:mm"', () => {
    const result = formatDateTime(mockCalendar, { year: 2024, month: 0, dayOfMonth: 4, hour: 14, minute: 30 });
    expect(result).toBe('5 January 2024, 14:30');
  });
});

describe('formatDateTime12()', () => {
  it('formats as "D MMMM y, h:mm A"', () => {
    const result = formatDateTime12(mockCalendar, { year: 2024, month: 0, dayOfMonth: 4, hour: 14, minute: 30 });
    expect(result).toBe('5 January 2024, 2:30 PM');
  });

  it('handles AM', () => {
    const result = formatDateTime12(mockCalendar, { year: 2024, month: 0, dayOfMonth: 4, hour: 9, minute: 15 });
    expect(result).toBe('5 January 2024, 9:15 AM');
  });
});

/* -------------------------------------------- */
/*  formatApproximateTime()                     */
/* -------------------------------------------- */

describe('formatApproximateTime()', () => {
  it('returns Morning for early day hours', () => {
    const result = formatApproximateTime(mockCalendar, { hour: 8 });
    expect(result).toBe('CALENDARIA.Format.ApproxTime.Morning');
  });

  it('returns Noon for midday', () => {
    const result = formatApproximateTime(mockCalendar, { hour: 12 });
    expect(result).toBe('CALENDARIA.Format.ApproxTime.Noon');
  });

  it('returns Afternoon for post-noon hours', () => {
    const result = formatApproximateTime(mockCalendar, { hour: 14 });
    expect(result).toBe('CALENDARIA.Format.ApproxTime.Afternoon');
  });

  it('returns Night for late night hours', () => {
    const result = formatApproximateTime(mockCalendar, { hour: 2 });
    expect(result).toBe('CALENDARIA.Format.ApproxTime.Night');
  });

  it('returns Midnight for middle of the night', () => {
    const result = formatApproximateTime(mockCalendar, { hour: 0 });
    expect(result).toBe('CALENDARIA.Format.ApproxTime.Midnight');
  });

  it('defaults hour to 0 when missing', () => {
    const result = formatApproximateTime(mockCalendar, {});
    expect(result).toBe('CALENDARIA.Format.ApproxTime.Midnight');
  });

  it('uses custom sunrise/sunset from calendar', () => {
    const customCal = addCalendarGetters({
      ...mockCalendar,
      sunrise: () => 8,
      sunset: () => 20
    });
    const result = formatApproximateTime(customCal, { hour: 14 });
    expect(result).toMatch(/CALENDARIA\.Format\.ApproxTime\.\w+/);
  });
});

/* -------------------------------------------- */
/*  formatApproximateDate()                     */
/* -------------------------------------------- */

describe('formatApproximateDate()', () => {
  it('falls back to month name when no season', () => {
    const result = formatApproximateDate(mockCalendar, { year: 2024, month: 0, dayOfMonth: 14 });
    expect(result).toBe('January');
  });

  it('returns Early/Mid/Late season when getCurrentSeason available', () => {
    const seasonCal = addCalendarGetters({
      ...mockCalendar,
      seasons: {
        values: [{ name: 'Spring', monthStart: 2, monthEnd: 4, dayStart: 0, dayEnd: 30 }]
      },
      getCurrentSeason: () => ({ name: 'Spring', monthStart: 2, monthEnd: 4, dayStart: 0, dayEnd: 30 })
    });
    // March 1 = early spring
    const result = formatApproximateDate(seasonCal, { year: 2024, month: 2, dayOfMonth: 0 });
    expect(result).toMatch(/CALENDARIA\.Format\.ApproxDate\.(Early|Mid|Late)/);
  });

  it('handles seasons with dayStart/dayEnd only', () => {
    const seasonCal = addCalendarGetters({
      ...mockCalendar,
      seasons: {
        values: [{ name: 'Harvest', dayStart: 0, dayEnd: 100 }]
      },
      getCurrentSeason: () => ({ name: 'Harvest', dayStart: 0, dayEnd: 100 })
    });
    const result = formatApproximateDate(seasonCal, { year: 2024, month: 0, dayOfMonth: 10 });
    expect(result).toMatch(/CALENDARIA\.Format\.ApproxDate\.Early/);
  });
});

/* -------------------------------------------- */
/*  formatCustom()                              */
/* -------------------------------------------- */

describe('formatCustom()', () => {
  const components = { year: 2024, month: 0, dayOfMonth: 14, hour: 14, minute: 30, second: 45 };

  it('replaces standard tokens', () => {
    const result = formatCustom(mockCalendar, components, 'YYYY-MM-DD');
    expect(result).toBe('2024-01-15');
  });

  it('replaces time tokens', () => {
    const result = formatCustom(mockCalendar, components, 'HH:mm:ss');
    expect(result).toBe('14:30:45');
  });

  it('replaces 12-hour tokens', () => {
    const result = formatCustom(mockCalendar, components, 'h:mm A');
    expect(result).toBe('2:30 PM');
  });

  it('handles literal text in brackets', () => {
    const result = formatCustom(mockCalendar, components, '[Year] YYYY');
    expect(result).toBe('Year 2024');
  });

  it('handles custom context tokens in brackets', () => {
    const result = formatCustom(mockCalendar, components, '[era]');
    expect(result).toBe('Common Era');
  });

  it('handles fallback syntax [primary|fallback]', () => {
    // No season set, so primary 'season' is empty, fallback to MMMM
    const result = formatCustom(mockCalendar, components, '[season|MMMM]');
    expect(result).toBe('January');
  });

  it('uses primary when available in fallback syntax', () => {
    const seasonCal = addCalendarGetters({
      ...mockCalendar,
      getCurrentSeason: () => ({ name: 'Winter' })
    });
    const result = formatCustom(seasonCal, components, '[season|MMMM]');
    expect(result).toBe('Winter');
  });

  it('handles era index syntax [era=0]', () => {
    const result = formatCustom(mockCalendar, components, '[era=0]');
    expect(result).toBe('Common Era');
  });

  it('handles eraAbbr index syntax [eraAbbr=0]', () => {
    const result = formatCustom(mockCalendar, components, '[eraAbbr=0]');
    expect(result).toBe('CE');
  });

  it('handles yearInEra index syntax [yearInEra=0]', () => {
    const result = formatCustom(mockCalendar, components, '[yearInEra=0]');
    expect(result).toBe('2024');
  });

  it('returns empty for out-of-range era index', () => {
    const result = formatCustom(mockCalendar, components, '[era=99]');
    expect(result).toBe('');
  });

  it('handles weekday tokens', () => {
    const result = formatCustom(mockCalendar, components, 'EEEE, Do MMMM');
    expect(result).toMatch(/^\w+, 15th January$/);
  });

  it('handles mixed tokens and literals', () => {
    const result = formatCustom(mockCalendar, components, 'D/MM/YYYY');
    expect(result).toBe('15/01/2024');
  });

  it('handles ordinal day', () => {
    const result = formatCustom(mockCalendar, { ...components, dayOfMonth: 0 }, 'Do');
    expect(result).toBe('1st');
  });

  it('handles DDD (day of year)', () => {
    const result = formatCustom(mockCalendar, components, 'DDD');
    expect(result).toBe('015');
  });

  it('handles year tokens Y/YY/YYYY', () => {
    const result = formatCustom(mockCalendar, { ...components, year: 7 }, 'Y YY YYYY');
    expect(result).toBe('7 7 0007');
  });

  it('passes through unrecognized bracket tokens as literals', () => {
    const result = formatCustom(mockCalendar, components, '[hello]');
    expect(result).toBe('hello');
  });

  it('handles approxTime/approxDate custom tokens', () => {
    const result = formatCustom(mockCalendar, components, '[approxTime]');
    expect(result).toMatch(/CALENDARIA\.Format\.ApproxTime\.\w+/);
  });

  it('handles cycle tokens with cycle data', () => {
    const cycleCal = addCalendarGetters({
      ...mockCalendar,
      cycles: [
        {
          name: 'Zodiac',
          length: 12,
          offset: 0,
          stages: {
            0: { name: 'Aries' },
            1: { name: 'Taurus' },
            2: { name: 'Gemini' },
            3: { name: 'Cancer' },
            4: { name: 'Leo' },
            5: { name: 'Virgo' },
            6: { name: 'Libra' },
            7: { name: 'Scorpio' },
            8: { name: 'Sagittarius' },
            9: { name: 'Capricorn' },
            10: { name: 'Aquarius' },
            11: { name: 'Pisces' }
          }
        }
      ]
    });
    const result = formatCustom(cycleCal, components, '[cycleName]');
    expect(result).toBeTruthy();
  });

  it('handles indexed cycle tokens [cycleName=0]', () => {
    const cycleCal = addCalendarGetters({
      ...mockCalendar,
      cycles: [
        {
          name: 'Zodiac',
          length: 12,
          offset: 0,
          stages: {
            0: { name: 'Aries' },
            1: { name: 'Taurus' },
            2: { name: 'Gemini' },
            3: { name: 'Cancer' },
            4: { name: 'Leo' },
            5: { name: 'Virgo' },
            6: { name: 'Libra' },
            7: { name: 'Scorpio' },
            8: { name: 'Sagittarius' },
            9: { name: 'Capricorn' },
            10: { name: 'Aquarius' },
            11: { name: 'Pisces' }
          }
        }
      ]
    });
    const result = formatCustom(cycleCal, components, '[cycleName=0]');
    expect(result).toBeTruthy();
  });

  it('handles [cycleRoman=0]', () => {
    const cycleCal = addCalendarGetters({
      ...mockCalendar,
      cycles: [{ name: 'Age', length: 5, offset: 0, stages: { 0: { name: 'A' }, 1: { name: 'B' }, 2: { name: 'C' }, 3: { name: 'D' }, 4: { name: 'E' } } }],
      getCurrentCycleNumber: () => 3
    });
    const result = formatCustom(cycleCal, components, '[cycleRoman=0]');
    expect(result).toBe('III');
  });

  it('handles [cycle=0]', () => {
    const cycleCal = addCalendarGetters({
      ...mockCalendar,
      getCurrentCycleNumber: () => 5
    });
    const result = formatCustom(cycleCal, components, '[cycle=0]');
    expect(result).toBe('5');
  });
});

/* -------------------------------------------- */
/*  validateFormatString()                      */
/* -------------------------------------------- */

describe('validateFormatString()', () => {
  it('returns valid for empty/null input', () => {
    expect(validateFormatString('')).toEqual({ valid: true });
    expect(validateFormatString(null)).toEqual({ valid: true });
  });

  it('returns valid for simple format string', () => {
    expect(validateFormatString('YYYY-MM-DD')).toEqual({ valid: true });
  });

  it('detects unclosed brackets', () => {
    const result = validateFormatString('[hello');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('CALENDARIA.Format.Error.UnclosedBracket');
  });

  it('detects extra closing brackets', () => {
    const result = validateFormatString('hello]');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('CALENDARIA.Format.Error.UnclosedBracket');
  });

  it('detects empty brackets', () => {
    const result = validateFormatString('[]');
    expect(result.valid).toBe(false);
    expect(result.error).toBe('CALENDARIA.Format.Error.EmptyBracket');
  });

  it('generates preview when calendar and components provided', () => {
    const components = { year: 2024, month: 0, dayOfMonth: 14, hour: 14, minute: 30 };
    const result = validateFormatString('YYYY-MM-DD', mockCalendar, components);
    expect(result.valid).toBe(true);
    expect(result.preview).toBe('2024-01-15');
  });
});

/* -------------------------------------------- */
/*  Moon icon markers                           */
/* -------------------------------------------- */

describe('hasMoonIconMarkers()', () => {
  it('returns false for null/undefined', () => {
    expect(hasMoonIconMarkers(null)).toBe(false);
    expect(hasMoonIconMarkers(undefined)).toBe(false);
  });

  it('returns false for string without markers', () => {
    expect(hasMoonIconMarkers('hello world')).toBe(false);
  });

  it('returns true for string with moon marker', () => {
    expect(hasMoonIconMarkers('text __MOONICON:path|alt|tip|color__ more')).toBe(true);
  });
});

describe('renderMoonIcons()', () => {
  it('returns input for null/undefined', () => {
    expect(renderMoonIcons(null)).toBe(null);
    expect(renderMoonIcons(undefined)).toBe(undefined);
  });

  it('returns input for string without markers', () => {
    expect(renderMoonIcons('hello')).toBe('hello');
  });

  it('converts marker to img element', () => {
    const input = '__MOONICON:icons/moon.png|Full Moon|Luna: Full Moon|__';
    const result = renderMoonIcons(input);
    expect(result).toContain('<img');
    expect(result).toContain('src="icons/moon.png"');
    expect(result).toContain('alt="Full Moon"');
    expect(result).toContain('data-tooltip="Luna: Full Moon"');
  });

  it('wraps in tinted span when color is provided', () => {
    const input = '__MOONICON:icons/moon.png|Full Moon|Luna: Full Moon|#ff0000__';
    const result = renderMoonIcons(input);
    expect(result).toContain('class="calendaria-moon-icon tinted"');
    expect(result).toContain('--moon-color: #ff0000');
  });

  it('handles multiple markers in one string', () => {
    const input = 'text __MOONICON:a.png|A|TipA|__ and __MOONICON:b.png|B|TipB|#00f__';
    const result = renderMoonIcons(input);
    expect(result).toContain('src="a.png"');
    expect(result).toContain('src="b.png"');
  });
});

describe('stripMoonIconMarkers()', () => {
  it('returns input for null/undefined', () => {
    expect(stripMoonIconMarkers(null)).toBe(null);
    expect(stripMoonIconMarkers(undefined)).toBe(undefined);
  });

  it('returns input for string without markers', () => {
    expect(stripMoonIconMarkers('hello')).toBe('hello');
  });

  it('removes moon markers from string', () => {
    const input = 'before __MOONICON:icons/moon.png|Full Moon|Tip|#fff__ after';
    expect(stripMoonIconMarkers(input)).toBe('before  after');
  });
});

/* -------------------------------------------- */
/*  formatDuration()                            */
/* -------------------------------------------- */

describe('formatDuration()', () => {
  it('formats default HH:mm:ss.SSS', () => {
    // 1h 23m 45s 678ms
    const ms = (1 * 3600 + 23 * 60 + 45) * 1000 + 678;
    expect(formatDuration(ms)).toBe('01:23:45.678');
  });

  it('formats HH:mm:ss', () => {
    const ms = (2 * 3600 + 5 * 60 + 3) * 1000;
    expect(formatDuration(ms, 'HH:mm:ss')).toBe('02:05:03');
  });

  it('formats mm:ss.SSS', () => {
    const ms = (1 * 3600 + 2 * 60 + 3) * 1000 + 456;
    expect(formatDuration(ms, 'mm:ss.SSS')).toBe('62:03.456');
  });

  it('formats mm:ss', () => {
    const ms = (5 * 60 + 30) * 1000;
    expect(formatDuration(ms, 'mm:ss')).toBe('05:30');
  });

  it('formats ss.SSS', () => {
    const ms = 3500;
    expect(formatDuration(ms, 'ss.SSS')).toBe('03:500');
  });

  it('formats ss', () => {
    const ms = 90 * 1000;
    expect(formatDuration(ms, 'ss')).toBe('90');
  });

  it('uses default format for unknown format string', () => {
    const ms = 1000;
    const result = formatDuration(ms, 'unknown');
    expect(result).toBe('00:00:01.000');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('00:00:00.000');
  });
});

/* -------------------------------------------- */
/*  formatGameDuration()                        */
/* -------------------------------------------- */

describe('formatGameDuration()', () => {
  it('formats HH:mm:ss', () => {
    const secs = 2 * 3600 + 15 * 60 + 30;
    expect(formatGameDuration(secs, mockCalendar, 'HH:mm:ss')).toBe('02:15:30');
  });

  it('includes day prefix for durations >= 1 day', () => {
    const secs = 25 * 3600 + 30 * 60;
    expect(formatGameDuration(secs, mockCalendar, 'HH:mm:ss')).toBe('1d 01:30:00');
  });

  it('formats mm:ss', () => {
    const secs = 3 * 60 + 45;
    expect(formatGameDuration(secs, mockCalendar, 'mm:ss')).toBe('03:45');
  });

  it('formats ss', () => {
    const secs = 90;
    expect(formatGameDuration(secs, mockCalendar, 'ss')).toBe('90');
  });

  it('formats HH:mm:ss.SSS (with .000 suffix)', () => {
    const secs = 3661;
    expect(formatGameDuration(secs, mockCalendar, 'HH:mm:ss.SSS')).toBe('01:01:01.000');
  });

  it('formats mm:ss.SSS', () => {
    const secs = 125;
    expect(formatGameDuration(secs, mockCalendar, 'mm:ss.SSS')).toBe('02:05.000');
  });

  it('formats ss.SSS', () => {
    const secs = 5;
    expect(formatGameDuration(secs, mockCalendar, 'ss.SSS')).toBe('05.000');
  });

  it('uses default format for unknown format string', () => {
    const secs = 3661;
    const result = formatGameDuration(secs, mockCalendar, 'unknown');
    expect(result).toBe('01:01:01');
  });

  it('handles null calendar with defaults', () => {
    const secs = 3661;
    expect(formatGameDuration(secs, null, 'HH:mm:ss')).toBe('01:01:01');
  });

  it('handles custom time units', () => {
    const customCal = addCalendarGetters({
      ...mockCalendar,
      days: { ...mockCalendar.days, hoursPerDay: 10, minutesPerHour: 100, secondsPerMinute: 100 }
    });
    // 1 hour = 100 * 100 = 10000 seconds in this calendar
    expect(formatGameDuration(10000, customCal, 'HH:mm:ss')).toBe('01:00:00');
  });
});

/* -------------------------------------------- */
/*  resolveFormatString()                       */
/* -------------------------------------------- */

describe('resolveFormatString()', () => {
  it('resolves known preset names', () => {
    expect(resolveFormatString('dateShort')).toBe('D MMM');
    expect(resolveFormatString('dateLong')).toBe('D MMMM, Y');
    expect(resolveFormatString('time24')).toBe('HH:mm');
    expect(resolveFormatString('time12')).toBe('h:mm A');
    expect(resolveFormatString('dateISO')).toBe('YYYY-MM-DD');
  });

  it('returns custom format string as-is', () => {
    expect(resolveFormatString('Do [of] MMMM')).toBe('Do [of] MMMM');
  });
});

/* -------------------------------------------- */
/*  getDisplayFormat()                          */
/* -------------------------------------------- */

describe('getDisplayFormat()', () => {
  beforeEach(() => {
    game.settings.get.mockReset();
  });

  it('returns location default when settings throws', () => {
    game.settings.get.mockImplementation(() => {
      throw new Error('not registered');
    });
    expect(getDisplayFormat('hudDate')).toBe('ordinal');
  });

  it('returns location default when no format set', () => {
    game.settings.get.mockReturnValue({});
    expect(getDisplayFormat('hudDate')).toBe('ordinal');
  });

  it('returns GM format for GM users', () => {
    game.settings.get.mockReturnValue({ hudDate: { gm: 'dateFull', player: 'dateShort' } });
    game.user.isGM = true;
    expect(getDisplayFormat('hudDate')).toBe('dateFull');
  });

  it('returns player format for non-GM users', () => {
    game.settings.get.mockReturnValue({ hudDate: { gm: 'dateFull', player: 'dateShort' } });
    game.user.isGM = false;
    expect(getDisplayFormat('hudDate')).toBe('dateShort');
    game.user.isGM = true; // restore
  });

  it('falls back to dateLong for unknown location', () => {
    game.settings.get.mockReturnValue({});
    expect(getDisplayFormat('unknownLocation')).toBe('dateLong');
  });
});

/* -------------------------------------------- */
/*  formatForLocation()                         */
/* -------------------------------------------- */

describe('formatForLocation()', () => {
  beforeEach(() => {
    game.settings.get.mockReset();
  });

  it('formats using preset from settings', () => {
    game.settings.get.mockReturnValue({ hudDate: { gm: 'dateShort' } });
    game.user.isGM = true;
    const result = formatForLocation(mockCalendar, { year: 2024, month: 0, dayOfMonth: 14, hour: 12 }, 'hudDate');
    expect(result).toBe('15 Jan');
  });

  it('handles calendarDefault setting', () => {
    game.settings.get.mockReturnValue({ hudDate: { gm: 'calendarDefault' } });
    const calWithFormats = addCalendarGetters({
      ...mockCalendar,
      dateFormats: { dateLong: 'YYYY/MM/DD' }
    });
    const result = formatForLocation(calWithFormats, { year: 2024, month: 0, dayOfMonth: 14, hour: 12 }, 'hudDate');
    expect(result).toBe('2024/01/15');
  });

  it('handles off preset', () => {
    game.settings.get.mockReturnValue({ hudDate: { gm: 'off' } });
    const result = formatForLocation(mockCalendar, { year: 2024, month: 0, dayOfMonth: 14 }, 'hudDate');
    expect(result).toBe('');
  });
});

/* -------------------------------------------- */
/*  getDisplayLocationDefinitions()             */
/* -------------------------------------------- */

describe('getDisplayLocationDefinitions()', () => {
  it('returns array of location definitions', () => {
    const defs = getDisplayLocationDefinitions();
    expect(defs).toBeInstanceOf(Array);
    expect(defs.length).toBeGreaterThan(0);
  });

  it('each definition has id, label, category', () => {
    const defs = getDisplayLocationDefinitions();
    for (const def of defs) {
      expect(def).toHaveProperty('id');
      expect(def).toHaveProperty('label');
      expect(def).toHaveProperty('category');
    }
  });

  it('includes expected locations', () => {
    const defs = getDisplayLocationDefinitions();
    const ids = defs.map((d) => d.id);
    expect(ids).toContain('hudDate');
    expect(ids).toContain('hudTime');
    expect(ids).toContain('miniCalHeader');
    expect(ids).toContain('bigCalHeader');
    expect(ids).toContain('chatTimestamp');
  });
});

/* -------------------------------------------- */
/*  timeSince()                                 */
/* -------------------------------------------- */

describe('timeSince()', () => {
  const today = { year: 2024, month: 0, dayOfMonth: 15 };

  it('returns Today for same date', () => {
    expect(timeSince(today, today)).toBe('CALENDARIA.Format.Today');
  });

  it('returns Tomorrow for next day', () => {
    const tomorrow = { ...today, dayOfMonth: 16 };
    expect(timeSince(tomorrow, today)).toBe('CALENDARIA.Format.Tomorrow');
  });

  it('returns Yesterday for previous day', () => {
    const yesterday = { ...today, dayOfMonth: 14 };
    expect(timeSince(yesterday, today)).toBe('CALENDARIA.Format.Yesterday');
  });

  it('returns InFuture for days ahead', () => {
    const future = { ...today, dayOfMonth: 20 };
    const result = timeSince(future, today);
    expect(result).toBe('CALENDARIA.Format.InFuture');
  });

  it('returns InPast for days behind', () => {
    const past = { ...today, dayOfMonth: 10 };
    const result = timeSince(past, today);
    expect(result).toBe('CALENDARIA.Format.InPast');
  });

  it('returns InFuture for week-scale differences', () => {
    const future = { year: 2024, month: 1, dayOfMonth: 0 };
    const result = timeSince(future, today);
    expect(result).toBe('CALENDARIA.Format.InFuture');
  });

  it('returns InFuture for month-scale differences', () => {
    const future = { year: 2024, month: 4, dayOfMonth: 15 };
    const result = timeSince(future, today);
    expect(result).toBe('CALENDARIA.Format.InFuture');
  });

  it('returns InFuture for year-scale differences', () => {
    const future = { year: 2026, month: 0, dayOfMonth: 15 };
    const result = timeSince(future, today);
    expect(result).toBe('CALENDARIA.Format.InFuture');
  });

  it('returns InPast for year-scale past differences', () => {
    const past = { year: 2020, month: 0, dayOfMonth: 15 };
    const result = timeSince(past, today);
    expect(result).toBe('CALENDARIA.Format.InPast');
  });
});

/* -------------------------------------------- */
/*  getAvailableTokens()                        */
/* -------------------------------------------- */

describe('getAvailableTokens()', () => {
  it('returns array of token definitions', () => {
    const tokens = getAvailableTokens();
    expect(tokens).toBeInstanceOf(Array);
    expect(tokens.length).toBeGreaterThan(0);
  });

  it('each token has required fields', () => {
    const tokens = getAvailableTokens();
    for (const t of tokens) {
      expect(t).toHaveProperty('token');
      expect(t).toHaveProperty('descriptionKey');
      expect(t).toHaveProperty('type');
    }
  });

  it('includes standard tokens', () => {
    const tokens = getAvailableTokens();
    const names = tokens.map((t) => t.token);
    expect(names).toContain('YYYY');
    expect(names).toContain('MM');
    expect(names).toContain('DD');
    expect(names).toContain('HH');
  });

  it('includes custom tokens', () => {
    const tokens = getAvailableTokens();
    const customTokens = tokens.filter((t) => t.type === 'custom');
    expect(customTokens.length).toBeGreaterThan(0);
  });
});

/* -------------------------------------------- */
/*  Constants                                   */
/* -------------------------------------------- */

describe('DEFAULT_FORMAT_PRESETS', () => {
  it('contains expected preset keys', () => {
    expect(DEFAULT_FORMAT_PRESETS).toHaveProperty('dateShort');
    expect(DEFAULT_FORMAT_PRESETS).toHaveProperty('dateLong');
    expect(DEFAULT_FORMAT_PRESETS).toHaveProperty('time24');
    expect(DEFAULT_FORMAT_PRESETS).toHaveProperty('time12');
    expect(DEFAULT_FORMAT_PRESETS).toHaveProperty('dateISO');
    expect(DEFAULT_FORMAT_PRESETS).toHaveProperty('datetime24');
    expect(DEFAULT_FORMAT_PRESETS).toHaveProperty('datetime12');
  });
});

describe('LOCATION_DEFAULTS', () => {
  it('contains expected location keys', () => {
    expect(LOCATION_DEFAULTS).toHaveProperty('hudDate');
    expect(LOCATION_DEFAULTS).toHaveProperty('hudTime');
    expect(LOCATION_DEFAULTS).toHaveProperty('miniCalHeader');
    expect(LOCATION_DEFAULTS).toHaveProperty('bigCalHeader');
    expect(LOCATION_DEFAULTS).toHaveProperty('chatTimestamp');
  });
});
