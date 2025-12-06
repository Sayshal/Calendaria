/**
 * Renescarran Calendar
 * A unique calendar system for the world of Renescara.
 *
 * Features:
 * - 13 perfect months of 28 days each
 * - Day of Threshold (intercalary day) at year's end
 * - 7-day weeks
 * - Two moons: Aela (28-day cycle) and Ruan (73-day cycle)
 * - Rich festival tradition throughout the year
 *
 * Total: 365 days (13 × 28 + 1 = 365)
 *
 * @module Calendar/Data/RenescaraCalendar
 * @author Tyler
 */

import CalendariaCalendar from './calendaria-calendar.mjs';

/**
 * Generate standard moon phases for a given cycle length.
 * @param {number} cycleLength - Length of the moon cycle in days
 * @returns {Array} Array of moon phase definitions
 */
function generateMoonPhases(cycleLength) {
  return [
    { name: 'CALENDARIA.MoonPhase.NewMoon', icon: '🌑', start: 0, end: 0.125 },
    { name: 'CALENDARIA.MoonPhase.WaxingCrescent', icon: '🌒', start: 0.125, end: 0.25 },
    { name: 'CALENDARIA.MoonPhase.FirstQuarter', icon: '🌓', start: 0.25, end: 0.375 },
    { name: 'CALENDARIA.MoonPhase.WaxingGibbous', icon: '🌔', start: 0.375, end: 0.5 },
    { name: 'CALENDARIA.MoonPhase.FullMoon', icon: '🌕', start: 0.5, end: 0.625 },
    { name: 'CALENDARIA.MoonPhase.WaningGibbous', icon: '🌖', start: 0.625, end: 0.75 },
    { name: 'CALENDARIA.MoonPhase.LastQuarter', icon: '🌗', start: 0.75, end: 0.875 },
    { name: 'CALENDARIA.MoonPhase.WaningCrescent', icon: '🌘', start: 0.875, end: 1 }
  ];
}

/**
 * Renescarran Calendar Definition
 * Compatible with Foundry VTT's CalendarData structure
 */
export const RENESCARA_CALENDAR = {
  // Calendar name
  name: 'CALENDARIA.Calendar.RENESCARA.Name',

  // Year configuration
  years: {
    yearZero: 0, // No offset - year 1 is year 1
    firstWeekday: 0, // Week starts on Solday (index 0)
    yearNames: [], // No named years/eras by default
    yearRounds: [], // No special year cycles
    leapYear: { leapStart: 0, leapInterval: 0 }
  },

  // Month structure
  months: {
    values: [
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Thawmoon', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.ThawmoonShort', ordinal: 1, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Seedmoon', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.SeedmoonShort', ordinal: 2, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Blossmoon', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.BlossmoonShort', ordinal: 3, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Greenmoon', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.GreenmoonShort', ordinal: 4, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Summertide', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.SummertideShort', ordinal: 5, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Goldmoon', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.GoldmoonShort', ordinal: 6, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Harvestmoon', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.HarvestmoonShort', ordinal: 7, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Ambermoon', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.AmbermoonShort', ordinal: 8, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Fadingmoon', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.FadingmoonShort', ordinal: 9, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Frostmoon', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.FrostmoonShort', ordinal: 10, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Winterdeep', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.WinterdeepShort', ordinal: 11, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Ironmoon', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.IronmoonShort', ordinal: 12, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.Shadowmoon', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.ShadowmoonShort', ordinal: 13, days: 28 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Month.DayOfThreshold', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Month.DayOfThresholdShort', ordinal: 14, days: 1, type: 'intercalary' }
    ]
  },

  // Day configuration (weekdays and time structure)
  days: {
    values: [
      { name: 'CALENDARIA.Calendar.RENESCARA.Day.Solday', ordinal: 1 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Day.Ferriday', ordinal: 2 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Day.Verday', ordinal: 3 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Day.Midweek', ordinal: 4 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Day.Mercday', ordinal: 5 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Day.Shadeday', ordinal: 6 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Day.Tideday', ordinal: 7 }
    ],
    daysPerYear: 365, // 13 × 28 + 1 = 365
    hoursPerDay: 24,
    minutesPerHour: 60,
    secondsPerMinute: 60
  },

  // Calendaria-specific: Festival days
  // Note: Foundry uses 0-indexed months and days, but we store as 1-indexed for clarity
  festivals: [
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.FirstlightFestival', month: 1, day: 15 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.Sowtide', month: 2, day: 7 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.Firstbloom', month: 3, day: 21 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.Greenfire', month: 4, day: 14 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.SolsticeCrown', month: 5, day: 14 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.FirstReaping', month: 6, day: 8 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.TheGathering', month: 7, day: 15 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.TheTurning', month: 8, day: 21 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.Lastlight', month: 9, day: 7 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.FirstfrostFair', month: 10, day: 14 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.TheLongNight', month: 11, day: 1 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.IronFeast', month: 12, day: 28 },
    { name: 'CALENDARIA.Calendar.RENESCARA.Festival.TheVeilwalk', month: 13, day: 14 }
  ],

  // Calendaria-specific: Moons
  moons: [
    {
      name: 'CALENDARIA.Calendar.RENESCARA.Moon.Aela',
      cycleLength: 28,
      phases: generateMoonPhases(28),
      referenceDate: {
        year: 3247,
        month: 0, // 0-indexed: Thawmoon
        day: 1 // 1-indexed: First day of month
      }
    },
    {
      name: 'CALENDARIA.Calendar.RENESCARA.Moon.Ruan',
      cycleLength: 73,
      phases: generateMoonPhases(73),
      referenceDate: {
        year: 3247,
        month: 0, // 0-indexed: Thawmoon
        day: 19 // 1-indexed: Offset by 18 days (18 + 1 = 19)
      }
    }
  ],

  // Seasons (evenly divided across the year)
  seasons: {
    values: [
      { name: 'CALENDARIA.Calendar.RENESCARA.Season.Spring', dayStart: 0, dayEnd: 83 }, // Thawmoon through Blossmoon (months 1-3)
      { name: 'CALENDARIA.Calendar.RENESCARA.Season.Summer', dayStart: 84, dayEnd: 167 }, // Greenmoon through Goldmoon (months 4-6)
      { name: 'CALENDARIA.Calendar.RENESCARA.Season.Autumn', dayStart: 168, dayEnd: 251 }, // Harvestmoon through Fadingmoon (months 7-9)
      { name: 'CALENDARIA.Calendar.RENESCARA.Season.Winter', dayStart: 252, dayEnd: 364 } // Frostmoon through Day of Threshold (months 10-14)
    ]
  },

  // Calendar metadata
  metadata: {
    id: 'renescara',
    description: 'CALENDARIA.Calendar.RENESCARA.Description',
    author: 'calendaria',
    system: 'Renescara'
  }
};

/**
 * Default starting date for new Renescara campaigns
 */
export const RENESCARA_DEFAULT_DATE = { year: 3247, month: 0, day: 1 };
