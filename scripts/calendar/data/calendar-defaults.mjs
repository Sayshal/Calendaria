/**
 * Default configurations for D&D 5e calendars.
 * Provides moons, seasons, eras, and weather for calendars loaded from CONFIG.DND5E.calendar.calendars.
 *
 * @module Calendar/Data/CalendarDefaults
 * @author Tyler
 */

import { getDefaultZoneConfig } from '../../weather/climate-data.mjs';

/**
 * Standard 8-phase moon cycle used by most calendars.
 */
const STANDARD_PHASES = [
  { name: 'CALENDARIA.MoonPhase.NewMoon', icon: 'modules/calendaria/assets/moon-phases/01_newmoon.svg', start: 0, end: 0.0625 },
  { name: 'CALENDARIA.MoonPhase.WaxingCrescent', icon: 'modules/calendaria/assets/moon-phases/02_waxingcrescent.svg', start: 0.0625, end: 0.1875 },
  { name: 'CALENDARIA.MoonPhase.FirstQuarter', icon: 'modules/calendaria/assets/moon-phases/03_firstquarter.svg', start: 0.1875, end: 0.3125 },
  { name: 'CALENDARIA.MoonPhase.WaxingGibbous', icon: 'modules/calendaria/assets/moon-phases/04_waxinggibbous.svg', start: 0.3125, end: 0.4375 },
  { name: 'CALENDARIA.MoonPhase.FullMoon', icon: 'modules/calendaria/assets/moon-phases/05_fullmoon.svg', start: 0.4375, end: 0.5625 },
  { name: 'CALENDARIA.MoonPhase.WaningGibbous', icon: 'modules/calendaria/assets/moon-phases/06_waninggibbous.svg', start: 0.5625, end: 0.6875 },
  { name: 'CALENDARIA.MoonPhase.LastQuarter', icon: 'modules/calendaria/assets/moon-phases/07_lastquarter.svg', start: 0.6875, end: 0.8125 },
  { name: 'CALENDARIA.MoonPhase.WaningCrescent', icon: 'modules/calendaria/assets/moon-phases/08_waningcrescent.svg', start: 0.8125, end: 1 }
];

/* -------------------------------------------- */
/*  Calendar Definitions                        */
/* -------------------------------------------- */

/**
 * Create default weather config with a temperate zone.
 * @param {string[]} [seasonNames] - Season names for temperature keys
 * @returns {object} Default weather config
 */
function createDefaultWeather(seasonNames = ['Spring', 'Summer', 'Autumn', 'Winter']) {
  const zone = getDefaultZoneConfig('temperate', seasonNames);
  return {
    activeZone: 'temperate',
    autoGenerate: false,
    zones: zone ? [zone] : []
  };
}

/**
 * Gregorian calendar defaults (Real World)
 */
export const GREGORIAN = {
  moons: [{ name: 'CALENDARIA.Moon.Gregorian.Luna', cycleLength: 30, phases: STANDARD_PHASES, referenceDate: { year: 2025, month: 0, day: 29 } }],
  seasons: {
    values: [
      { name: 'CALENDARIA.Season.Spring', dayStart: 79, dayEnd: 171 },
      { name: 'CALENDARIA.Season.Summer', dayStart: 172, dayEnd: 265 },
      { name: 'CALENDARIA.Season.Autumn', dayStart: 266, dayEnd: 354 },
      { name: 'CALENDARIA.Season.Winter', dayStart: 355, dayEnd: 78 }
    ]
  },
  eras: [{ name: 'CALENDARIA.Era.CommonEra', abbreviation: 'CALENDARIA.Era.CE', startYear: 1, endYear: null, format: 'suffix', template: null }],
  daylight: { enabled: true, shortestDay: 8, longestDay: 16, winterSolstice: 355, summerSolstice: 172 },
  weather: createDefaultWeather()
};

/**
 * Harptos calendar defaults (Forgotten Realms)
 */
export const HARPTOS = {
  moons: [{ name: 'CALENDARIA.Moon.Harptos.Selune', cycleLength: 30, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 15 } }],
  seasons: {
    values: [
      { name: 'CALENDARIA.Season.Spring', dayStart: 60, dayEnd: 151 },
      { name: 'CALENDARIA.Season.Summer', dayStart: 152, dayEnd: 243 },
      { name: 'CALENDARIA.Season.Autumn', dayStart: 244, dayEnd: 334 },
      { name: 'CALENDARIA.Season.Winter', dayStart: 335, dayEnd: 59 }
    ]
  },
  eras: [{ name: 'CALENDARIA.Era.DaleReckoning', abbreviation: 'CALENDARIA.Era.DR', startYear: 1, endYear: null, format: 'suffix', template: null }],
  daylight: { enabled: true, shortestDay: 8, longestDay: 16, winterSolstice: 355, summerSolstice: 172 },
  weather: createDefaultWeather()
};

/**
 * Greyhawk calendar defaults (Oerth)
 */
export const GREYHAWK = {
  moons: [
    { name: 'CALENDARIA.Moon.Greyhawk.Luna', cycleLength: 28, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 4 } },
    { name: 'CALENDARIA.Moon.Greyhawk.Celene', cycleLength: 91, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 2, day: 12 } }
  ],
  seasons: {
    values: [
      { name: 'CALENDARIA.Season.Spring', dayStart: 56, dayEnd: 147 },
      { name: 'CALENDARIA.Season.Summer', dayStart: 148, dayEnd: 238 },
      { name: 'CALENDARIA.Season.Autumn', dayStart: 239, dayEnd: 329 },
      { name: 'CALENDARIA.Season.Winter', dayStart: 330, dayEnd: 55 }
    ]
  },
  eras: [{ name: 'CALENDARIA.Era.CommonYear', abbreviation: 'CALENDARIA.Era.CY', startYear: 1, endYear: null, format: 'suffix', template: null }],
  daylight: { enabled: true, shortestDay: 8, longestDay: 16, winterSolstice: 354, summerSolstice: 172 },
  weather: createDefaultWeather()
};

/**
 * Khorvaire calendar defaults (Eberron)
 */
export const KHORVAIRE = {
  moons: [
    { name: 'CALENDARIA.Moon.Khorvaire.Zarantyr', cycleLength: 28, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } },
    { name: 'CALENDARIA.Moon.Khorvaire.Olarune', cycleLength: 35, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } },
    { name: 'CALENDARIA.Moon.Khorvaire.Therendor', cycleLength: 42, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } },
    { name: 'CALENDARIA.Moon.Khorvaire.Eyre', cycleLength: 49, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } },
    { name: 'CALENDARIA.Moon.Khorvaire.Dravago', cycleLength: 56, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } },
    { name: 'CALENDARIA.Moon.Khorvaire.Nymm', cycleLength: 63, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } },
    { name: 'CALENDARIA.Moon.Khorvaire.Lharvion', cycleLength: 70, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } },
    { name: 'CALENDARIA.Moon.Khorvaire.Barrakas', cycleLength: 77, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } },
    { name: 'CALENDARIA.Moon.Khorvaire.Rhaan', cycleLength: 84, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } },
    { name: 'CALENDARIA.Moon.Khorvaire.Sypheros', cycleLength: 91, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } },
    { name: 'CALENDARIA.Moon.Khorvaire.Aryth', cycleLength: 98, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } },
    { name: 'CALENDARIA.Moon.Khorvaire.Vult', cycleLength: 105, phases: STANDARD_PHASES, referenceDate: { year: 0, month: 0, day: 0 } }
  ],
  seasons: {
    values: [
      { name: 'CALENDARIA.Season.Spring', dayStart: 56, dayEnd: 139 },
      { name: 'CALENDARIA.Season.Summer', dayStart: 140, dayEnd: 223 },
      { name: 'CALENDARIA.Season.Autumn', dayStart: 224, dayEnd: 307 },
      { name: 'CALENDARIA.Season.Winter', dayStart: 308, dayEnd: 55 }
    ]
  },
  eras: [{ name: 'CALENDARIA.Era.YearOfTheKingdom', abbreviation: 'CALENDARIA.Era.YK', startYear: 1, endYear: null, format: 'suffix', template: null }],
  daylight: { enabled: true, shortestDay: 8, longestDay: 16, winterSolstice: 326, summerSolstice: 158 },
  weather: createDefaultWeather()
};

/* -------------------------------------------- */
/*  Default Lookup Map                          */
/* -------------------------------------------- */

/**
 * Map of calendar IDs to their default configurations.
 */
export const CALENDAR_DEFAULTS = {
  gregorian: GREGORIAN,
  harptos: HARPTOS,
  greyhawk: GREYHAWK,
  khorvaire: KHORVAIRE
};

/**
 * Get default configuration for a calendar ID.
 * @param {string} id - Calendar ID
 * @returns {{moons?: Array, seasons?: object, eras?: Array}|null}
 */
export function getCalendarDefaults(id) {
  return CALENDAR_DEFAULTS[id] ?? null;
}
