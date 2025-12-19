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
import { ASSETS } from '../../constants.mjs';

/**
 * Generate moon phases with custom names for Aela (Silver Sister).
 * @returns {Array} Array of moon phase definitions
 */
function generateAelaPhases() {
  const prefix = 'CALENDARIA.Calendar.RENESCARA.Moon.Aela.Phase';
  return [
    { name: `${prefix}.DarkSister.Name`, rising: `${prefix}.DarkSister.Rising`, fading: `${prefix}.DarkSister.Fading`, icon: `${ASSETS.MOON_ICONS}/01_newmoon.svg`, start: 0, end: 0.125 },
    { name: `${prefix}.Growing.Name`, rising: `${prefix}.Growing.Rising`, fading: `${prefix}.Growing.Fading`, icon: `${ASSETS.MOON_ICONS}/02_waxingcrescent.svg`, start: 0.125, end: 0.25 },
    { name: `${prefix}.Growing.Name`, rising: `${prefix}.Growing.Rising`, fading: `${prefix}.Growing.Fading`, icon: `${ASSETS.MOON_ICONS}/03_firstquarter.svg`, start: 0.25, end: 0.375 },
    { name: `${prefix}.Growing.Name`, rising: `${prefix}.Growing.Rising`, fading: `${prefix}.Growing.Fading`, icon: `${ASSETS.MOON_ICONS}/04_waxinggibbous.svg`, start: 0.375, end: 0.5 },
    { name: `${prefix}.SilverCrown.Name`, rising: `${prefix}.SilverCrown.Rising`, fading: `${prefix}.SilverCrown.Fading`, icon: `${ASSETS.MOON_ICONS}/05_fullmoon.svg`, start: 0.5, end: 0.625 },
    { name: `${prefix}.Fading.Name`, rising: `${prefix}.Fading.Rising`, fading: `${prefix}.Fading.Fading`, icon: `${ASSETS.MOON_ICONS}/06_waninggibbous.svg`, start: 0.625, end: 0.75 },
    { name: `${prefix}.Fading.Name`, rising: `${prefix}.Fading.Rising`, fading: `${prefix}.Fading.Fading`, icon: `${ASSETS.MOON_ICONS}/07_lastquarter.svg`, start: 0.75, end: 0.875 },
    { name: `${prefix}.Fading.Name`, rising: `${prefix}.Fading.Rising`, fading: `${prefix}.Fading.Fading`, icon: `${ASSETS.MOON_ICONS}/08_waningcrescent.svg`, start: 0.875, end: 1 }
  ];
}

/**
 * Generate moon phases with ominous names for Ruan (Rust Wanderer).
 * @returns {Array} Array of moon phase definitions
 */
function generateRuanPhases() {
  const prefix = 'CALENDARIA.Calendar.RENESCARA.Moon.Ruan.Phase';
  return [
    { name: `${prefix}.HiddenEye.Name`, rising: `${prefix}.HiddenEye.Rising`, fading: `${prefix}.HiddenEye.Fading`, icon: `${ASSETS.MOON_ICONS}/01_newmoon.svg`, start: 0, end: 0.125 },
    { name: `${prefix}.Awakening.Name`, rising: `${prefix}.Awakening.Rising`, fading: `${prefix}.Awakening.Fading`, icon: `${ASSETS.MOON_ICONS}/02_waxingcrescent.svg`, start: 0.125, end: 0.25 },
    { name: `${prefix}.Awakening.Name`, rising: `${prefix}.Awakening.Rising`, fading: `${prefix}.Awakening.Fading`, icon: `${ASSETS.MOON_ICONS}/03_firstquarter.svg`, start: 0.25, end: 0.375 },
    { name: `${prefix}.Awakening.Name`, rising: `${prefix}.Awakening.Rising`, fading: `${prefix}.Awakening.Fading`, icon: `${ASSETS.MOON_ICONS}/04_waxinggibbous.svg`, start: 0.375, end: 0.5 },
    { name: `${prefix}.BloodMoon.Name`, rising: `${prefix}.BloodMoon.Rising`, fading: `${prefix}.BloodMoon.Fading`, icon: `${ASSETS.MOON_ICONS}/05_fullmoon.svg`, start: 0.5, end: 0.625 },
    { name: `${prefix}.Closing.Name`, rising: `${prefix}.Closing.Rising`, fading: `${prefix}.Closing.Fading`, icon: `${ASSETS.MOON_ICONS}/06_waninggibbous.svg`, start: 0.625, end: 0.75 },
    { name: `${prefix}.Closing.Name`, rising: `${prefix}.Closing.Rising`, fading: `${prefix}.Closing.Fading`, icon: `${ASSETS.MOON_ICONS}/07_lastquarter.svg`, start: 0.75, end: 0.875 },
    { name: `${prefix}.Closing.Name`, rising: `${prefix}.Closing.Rising`, fading: `${prefix}.Closing.Fading`, icon: `${ASSETS.MOON_ICONS}/08_waningcrescent.svg`, start: 0.875, end: 1 }
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
    leapYear: null // No leap years in Renescara calendar
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
    daysPerYear: 365,
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
      name: 'CALENDARIA.Calendar.RENESCARA.Moon.Aela.Name',
      cycleLength: 28,
      color: '#C0C0C0',
      hidden: false,
      phases: generateAelaPhases(),
      referenceDate: { year: 3247, month: 0, day: 1 }
    },
    {
      name: 'CALENDARIA.Calendar.RENESCARA.Moon.Ruan.Name',
      cycleLength: 73,
      color: '#B44622',
      hidden: false,
      phases: generateRuanPhases(),
      referenceDate: { year: 3247, month: 0, day: 19 }
    }
  ],

  // Seasons (evenly divided across the year)
  seasons: {
    values: [
      { name: 'CALENDARIA.Calendar.RENESCARA.Season.Spring', icon: 'fas fa-seedling', color: '#90ee90', dayStart: 0, dayEnd: 83 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Season.Summer', icon: 'fas fa-sun', color: '#ffd700', dayStart: 84, dayEnd: 167 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Season.Autumn', icon: 'fas fa-leaf', color: '#d2691e', dayStart: 168, dayEnd: 251 },
      { name: 'CALENDARIA.Calendar.RENESCARA.Season.Winter', icon: 'fas fa-snowflake', color: '#87ceeb', dayStart: 252, dayEnd: 364 }
    ]
  },

  // Daylight settings - The Long Night (winter) and SolsticeCrown (summer)
  daylight: { enabled: true, shortestDay: 8, longestDay: 16, winterSolstice: 281, summerSolstice: 126 },

  // Calendar metadata
  metadata: { id: 'renescara', description: 'CALENDARIA.Calendar.RENESCARA.Description', author: 'calendaria', system: 'Renescara' },

  // Weather zones - 4 regional climates with Gyre-influenced fantasy weather
  weather: {
    zones: [
      {
        id: 'valdris',
        name: 'CALENDARIA.Calendar.RENESCARA.Weather.Zone.Valdris.Name',
        description: 'CALENDARIA.Calendar.RENESCARA.Weather.Zone.Valdris.Description',
        temperatures: { Spring: { min: -18, max: 10 }, Summer: { min: 10, max: 41 }, Autumn: { min: -3, max: 19 }, Winter: { min: -35, max: -4 }, _default: { min: -10, max: 15 } },
        presets: [
          { id: 'clear', enabled: true, chance: 5 },
          { id: 'partly-cloudy', enabled: true, chance: 4 },
          { id: 'cloudy', enabled: true, chance: 3 },
          { id: 'overcast', enabled: true, chance: 3 },
          { id: 'snow', enabled: true, chance: 4 },
          { id: 'blizzard', enabled: true, chance: 2 },
          { id: 'fog', enabled: true, chance: 2 },
          { id: 'windy', enabled: true, chance: 3 },
          { id: 'aether-haze', enabled: true, chance: 2 },
          { id: 'luminous-sky', enabled: true, chance: 3 },
          { id: 'veilfall', enabled: true, chance: 1 },
          { id: 'gravewind', enabled: true, chance: 2 },
          { id: 'nullfront', enabled: true, chance: 2 },
          { id: 'ley-surge', enabled: true, chance: 2 }
        ]
      },
      {
        id: 'lys',
        name: 'CALENDARIA.Calendar.RENESCARA.Weather.Zone.Lys.Name',
        description: 'CALENDARIA.Calendar.RENESCARA.Weather.Zone.Lys.Description',
        temperatures: { Spring: { min: 5, max: 25 }, Summer: { min: 18, max: 38 }, Autumn: { min: 8, max: 28 }, Winter: { min: -5, max: 18 }, _default: { min: 8, max: 25 } },
        presets: [
          { id: 'clear', enabled: true, chance: 6 },
          { id: 'partly-cloudy', enabled: true, chance: 5 },
          { id: 'cloudy', enabled: true, chance: 3 },
          { id: 'rain', enabled: true, chance: 4 },
          { id: 'drizzle', enabled: true, chance: 3 },
          { id: 'thunderstorm', enabled: true, chance: 2 },
          { id: 'fog', enabled: true, chance: 3 },
          { id: 'windy', enabled: true, chance: 3 },
          { id: 'aether-haze', enabled: true, chance: 2 },
          { id: 'luminous-sky', enabled: true, chance: 1 },
          { id: 'veilfall', enabled: true, chance: 1 },
          { id: 'gravewind', enabled: true, chance: 1 },
          { id: 'nullfront', enabled: true, chance: 1 },
          { id: 'ley-surge', enabled: true, chance: 2 }
        ]
      },
      {
        id: 'sanctus',
        name: 'CALENDARIA.Calendar.RENESCARA.Weather.Zone.Sanctus.Name',
        description: 'CALENDARIA.Calendar.RENESCARA.Weather.Zone.Sanctus.Description',
        temperatures: { Spring: { min: -25, max: 5 }, Summer: { min: -5, max: 22 }, Autumn: { min: -20, max: 8 }, Winter: { min: -50, max: -20 }, _default: { min: -20, max: 5 } },
        presets: [
          { id: 'clear', enabled: true, chance: 4 },
          { id: 'partly-cloudy', enabled: true, chance: 3 },
          { id: 'cloudy', enabled: true, chance: 3 },
          { id: 'overcast', enabled: true, chance: 4 },
          { id: 'snow', enabled: true, chance: 5 },
          { id: 'blizzard', enabled: true, chance: 4 },
          { id: 'fog', enabled: true, chance: 2 },
          { id: 'windy', enabled: true, chance: 4 },
          { id: 'aether-haze', enabled: true, chance: 3 },
          { id: 'luminous-sky', enabled: true, chance: 4 },
          { id: 'veilfall', enabled: true, chance: 2 },
          { id: 'gravewind', enabled: true, chance: 3 },
          { id: 'nullfront', enabled: true, chance: 4 },
          { id: 'ley-surge', enabled: true, chance: 2 }
        ]
      },
      {
        id: 'thornwood',
        name: 'CALENDARIA.Calendar.RENESCARA.Weather.Zone.Thornwood.Name',
        description: 'CALENDARIA.Calendar.RENESCARA.Weather.Zone.Thornwood.Description',
        temperatures: { Spring: { min: -8, max: 22 }, Summer: { min: 12, max: 35 }, Autumn: { min: -2, max: 25 }, Winter: { min: -25, max: 5 }, _default: { min: 0, max: 20 } },
        presets: [
          { id: 'clear', enabled: true, chance: 4 },
          { id: 'partly-cloudy', enabled: true, chance: 4 },
          { id: 'cloudy', enabled: true, chance: 3 },
          { id: 'overcast', enabled: true, chance: 3 },
          { id: 'rain', enabled: true, chance: 3 },
          { id: 'fog', enabled: true, chance: 4 },
          { id: 'mist', enabled: true, chance: 4 },
          { id: 'thunderstorm', enabled: true, chance: 2 },
          { id: 'aether-haze', enabled: true, chance: 4 },
          { id: 'luminous-sky', enabled: true, chance: 2 },
          { id: 'veilfall', enabled: true, chance: 5 },
          { id: 'gravewind', enabled: true, chance: 4 },
          { id: 'nullfront', enabled: true, chance: 3 },
          { id: 'ley-surge', enabled: true, chance: 5 }
        ]
      }
    ]
  },

  // Eras - Three Ages of Renescara
  eras: [
    {
      name: 'CALENDARIA.Calendar.RENESCARA.Era.FirstAge.Name',
      abbreviation: 'CALENDARIA.Calendar.RENESCARA.Era.FirstAge.Abbr',
      startYear: -2000,
      endYear: -500,
      template: 'Year {{yearInEra}} of the {{era}}'
    },
    {
      name: 'CALENDARIA.Calendar.RENESCARA.Era.DarkCenturies.Name',
      abbreviation: 'CALENDARIA.Calendar.RENESCARA.Era.DarkCenturies.Abbr',
      startYear: -500,
      endYear: 0,
      template: 'Year {{yearInEra}} of the {{era}}'
    },
    {
      name: 'CALENDARIA.Calendar.RENESCARA.Era.SecondAge.Name',
      abbreviation: 'CALENDARIA.Calendar.RENESCARA.Era.SecondAge.Abbr',
      startYear: 1,
      endYear: null,
      template: 'Year {{year}} of the {{era}}'
    }
  ],

  // Canonical hours - 6 watches based on weekday themes
  canonicalHours: [
    { name: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.DawnWatch.Name', abbreviation: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.DawnWatch.Abbr', startHour: 5, endHour: 9 },
    { name: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.IronHours.Name', abbreviation: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.IronHours.Abbr', startHour: 9, endHour: 13 },
    { name: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.GreenHours.Name', abbreviation: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.GreenHours.Abbr', startHour: 13, endHour: 17 },
    { name: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.MerchantsBell.Name', abbreviation: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.MerchantsBell.Abbr', startHour: 17, endHour: 21 },
    { name: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.ShadeHours.Name', abbreviation: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.ShadeHours.Abbr', startHour: 21, endHour: 1 },
    { name: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.MoonWatch.Name', abbreviation: 'CALENDARIA.Calendar.RENESCARA.CanonicalHour.MoonWatch.Abbr', startHour: 1, endHour: 5 }
  ],

  // AM/PM notation - Sunward/Moonward
  amPmNotation: {
    am: 'CALENDARIA.Calendar.RENESCARA.Time.Sunward.Name',
    pm: 'CALENDARIA.Calendar.RENESCARA.Time.Moonward.Name',
    amAbbr: 'CALENDARIA.Calendar.RENESCARA.Time.Sunward.Abbr',
    pmAbbr: 'CALENDARIA.Calendar.RENESCARA.Time.Moonward.Abbr'
  },

  // Cycles - The Five Wanderers (5-year planetary cycle)
  cycles: [
    {
      name: 'CALENDARIA.Calendar.RENESCARA.Cycle.FiveWanderers',
      length: 5,
      offset: 0,
      basedOn: 'year',
      entries: [
        { name: 'CALENDARIA.Calendar.RENESCARA.Cycle.Ferrus' },
        { name: 'CALENDARIA.Calendar.RENESCARA.Cycle.Verdantis' },
        { name: 'CALENDARIA.Calendar.RENESCARA.Cycle.Crystallus' },
        { name: 'CALENDARIA.Calendar.RENESCARA.Cycle.Umbralis' },
        { name: 'CALENDARIA.Calendar.RENESCARA.Cycle.Temporis' }
      ]
    }
  ],
  cycleFormat: 'Year of {{1}}',

  // Weeks - Month-based with thematic names
  weeks: {
    enabled: true,
    type: 'month-based',
    names: [
      { name: 'CALENDARIA.Calendar.RENESCARA.Week.Rising.Name', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Week.Rising.Abbr' },
      { name: 'CALENDARIA.Calendar.RENESCARA.Week.Fullness.Name', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Week.Fullness.Abbr' },
      { name: 'CALENDARIA.Calendar.RENESCARA.Week.Turning.Name', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Week.Turning.Abbr' },
      { name: 'CALENDARIA.Calendar.RENESCARA.Week.Fading.Name', abbreviation: 'CALENDARIA.Calendar.RENESCARA.Week.Fading.Abbr' }
    ]
  },

  // Date formats
  dateFormats: {
    short: '{{d}} {{b}}',
    long: '{{d}} {{B}}, {{y}}',
    full: '{{B}} {{d}}, {{y}} ({{ch}})',
    time: '{{H}}:{{M}}',
    time12: '{{h}}:{{M}} {{p}}'
  }
};

/**
 * Default starting date for new Renescara campaigns
 */
export const RENESCARA_DEFAULT_DATE = { year: 3247, month: 0, day: 1 };
