/**
 * Leap Year Pattern Utilities
 * Evaluates complex leap year patterns like "400,!100,4" (Gregorian rules).
 *
 * @module Calendar/LeapYearUtils
 * @author Tyler
 */

/**
 * Parse a single interval string into an interval object.
 * @param {string|number} intervalStr - Interval string like "4", "!100", or "+400"
 * @param {number} offset - Offset for modulo calculation (typically leapStart)
 * @returns {{interval: number, subtracts: boolean, offset: number}}
 */
export function parseInterval(intervalStr, offset = 0) {
  const str = String(intervalStr).trim();
  const subtracts = str.includes('!');
  const ignoresOffset = str.includes('+');
  const interval = Math.max(1, parseInt(str.replace(/[!+]/g, ''), 10) || 1);
  const normalizedOffset = interval === 1 || ignoresOffset ? 0 : (((interval + offset) % interval) + interval) % interval;
  return { interval, subtracts, offset: normalizedOffset };
}

/**
 * Parse a full pattern string into an array of interval objects.
 * @param {string} pattern - Pattern string like "400,!100,4"
 * @param {number} [offset=0] - Offset for modulo (typically leapStart)
 * @returns {Array<{interval: number, subtracts: boolean, offset: number}>}
 */
export function parsePattern(pattern, offset = 0) {
  if (!pattern || typeof pattern !== 'string') return [];
  return pattern
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => parseInterval(s, offset));
}

/**
 * Get vote for a single interval on a given year.
 * @param {{interval: number, subtracts: boolean, offset: number}} intervalObj
 * @param {number} year - Year to check
 * @param {boolean} [yearZeroExists=true] - Whether year 0 exists in the calendar
 * @returns {'allow'|'deny'|'abstain'}
 */
export function voteOnYear(intervalObj, year, yearZeroExists = true) {
  let mod = year - intervalObj.offset;
  if (!yearZeroExists && year < 0) mod++;
  if (mod % intervalObj.interval === 0) return intervalObj.subtracts ? 'deny' : 'allow';
  return 'abstain';
}

/**
 * Determine if a year is a leap year using interval pattern voting.
 * @param {Array<{interval: number, subtracts: boolean, offset: number}>} intervals
 * @param {number} year - Year to check
 * @param {boolean} [yearZeroExists=true] - Whether year 0 exists
 * @returns {boolean}
 */
export function intersectsYear(intervals, year, yearZeroExists = true) {
  if (!intervals || intervals.length === 0) return false;
  const votes = intervals.map((interval) => voteOnYear(interval, year, yearZeroExists));
  const total = votes.reduce((acc, vote) => {
    if (vote === 'allow') return acc + 1;
    if (vote === 'deny') return acc - 1;
    return acc;
  }, 0);
  return total > 0;
}

/**
 * Check if a year is a leap year based on leap year configuration.
 * @param {object} leapYearConfig - Leap year configuration object
 * @param {string} [leapYearConfig.rule='none'] - Rule type
 * @param {number} [leapYearConfig.interval] - Simple interval (for 'simple' rule)
 * @param {number} [leapYearConfig.start=0] - First leap year (offset)
 * @param {string} [leapYearConfig.pattern] - Custom pattern (for 'custom' rule)
 * @param {number} year - Year to check
 * @param {boolean} [yearZeroExists=true] - Whether year 0 exists
 * @returns {boolean}
 */
export function isLeapYear(leapYearConfig, year, yearZeroExists = true) {
  if (!leapYearConfig) return false;

  const rule = leapYearConfig.rule || 'none';
  const start = leapYearConfig.start ?? leapYearConfig.leapStart ?? 0;

  switch (rule) {
    case 'none':
      return false;
    case 'simple': {
      const interval = leapYearConfig.interval ?? leapYearConfig.leapInterval;
      if (!interval || interval <= 0) return false;
      const intervals = [parseInterval(String(interval), start)];
      return intersectsYear(intervals, year, yearZeroExists);
    }
    case 'gregorian': {
      const intervals = parsePattern('400,!100,4', start);
      return intersectsYear(intervals, year, yearZeroExists);
    }
    case 'custom': {
      const pattern = leapYearConfig.pattern;
      if (!pattern) return false;
      const intervals = parsePattern(pattern, start);
      return intersectsYear(intervals, year, yearZeroExists);
    }
    default:
      return false;
  }
}

/**
 * Get a human-readable description of a leap year rule.
 * @param {object} leapYearConfig - Leap year configuration
 * @returns {string}
 */
export function getLeapYearDescription(leapYearConfig) {
  if (!leapYearConfig) return game.i18n.localize('CALENDARIA.LeapYear.None');

  const rule = leapYearConfig.rule || 'none';

  switch (rule) {
    case 'none':
      return game.i18n.localize('CALENDARIA.LeapYear.None');
    case 'simple': {
      const interval = leapYearConfig.interval ?? leapYearConfig.leapInterval ?? 4;
      const start = leapYearConfig.start ?? leapYearConfig.leapStart ?? 0;
      return game.i18n.format('CALENDARIA.LeapYear.Simple', { interval, start });
    }
    case 'gregorian':
      return game.i18n.localize('CALENDARIA.LeapYear.Gregorian');
    case 'custom': {
      const pattern = leapYearConfig.pattern || '';
      return game.i18n.format('CALENDARIA.LeapYear.Custom', { pattern });
    }
    default:
      return game.i18n.localize('CALENDARIA.LeapYear.None');
  }
}
