/**
 * Rest Time Integration
 * @module Integrations/RestTime
 * @author Tyler
 */

import { CinematicOverlay } from '../applications/_module.mjs';
import { CalendarManager } from '../calendar/_module.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { getCurrentDate } from '../notes/_module.mjs';
import { TimeClock } from '../time/_module.mjs';
import { log } from '../utils/_module.mjs';
import { WeatherManager } from '../weather/_module.mjs';

/** @type {number} Hour to advance to when "New Day" is selected (8:00 AM) */
const NEW_DAY_HOUR = 8;

/** @type {number|null} Debounce timer for PF2E rest handler */
let pf2eRestTimer = null;

/** @type {number|null} Debounce timer for PF1E rest handler */
let pf1eRestTimer = null;

/**
 * Handle pre-rest hook to enable time advancement.
 * @param {object} _actor - The actor taking the rest
 * @param {object} config - Rest configuration
 * @returns {void}
 */
export function onPreRest(_actor, config) {
  if (TimeClock.locked) {
    log(2, 'Rest time advancement blocked (clock locked)');
    return;
  }
  const advanceTime = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
  if (!advanceTime) return;
  if (config.advanceTime === false && (config.request || config.dialog === false)) return;
  config.advanceTime = true;
  log(3, `Rest time advancement enabled for ${config.type} rest`);
}

/**
 * Handle long rest after dialog completes.
 * @param {object} actor - The actor taking the rest
 * @param {object} config - Rest configuration (with user's dialog choices)
 * @returns {void}
 */
export function onLongRest(actor, config) {
  if (TimeClock.locked) return;
  const advanceTime = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
  if (!advanceTime) return;
  if (config.advanceTime === false && actor?.type !== 'group') return;
  const restVariant = game.settings.get('dnd5e', 'restVariant');
  const isLongRest = config.type === 'long' || config.longRest === true;
  const isGritty = restVariant === 'gritty';
  if (!isLongRest) return;
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return;
  const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
  const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
  const mode = game.settings.get(MODULE.ID, SETTINGS.REST_ADVANCE_MODE);
  config.advanceTime = false;
  if (mode === 'automatic') {
    const systemMinutes = config.duration;
    if (!systemMinutes || systemMinutes <= 0) {
      log(3, 'Long rest time advancement skipped (system reported no duration)');
      return;
    }
    const systemHours = systemMinutes / 60;
    const seconds = systemHours * minutesPerHour * secondsPerMinute;
    CinematicOverlay.gatedAdvance(seconds, { source: 'rest' });
    log(3, `Long rest advancing ${systemHours} hours (system default)`);
    return;
  }
  if (mode === 'fixed' && !isGritty) {
    const fixedHours = game.settings.get(MODULE.ID, SETTINGS.REST_FIXED_HOURS);
    if (fixedHours <= 0) {
      log(3, 'Long rest time advancement suppressed (fixed hours = 0)');
      return;
    }
    const seconds = fixedHours * minutesPerHour * secondsPerMinute;
    CinematicOverlay.gatedAdvance(seconds, { source: 'rest' });
    log(3, `Long rest advancing ${fixedHours} hours`);
    return;
  }
  const targetHour = getTargetHour(calendar, mode);
  const currentDate = getCurrentDate();
  const currentMinutes = currentDate.hour * minutesPerHour + currentDate.minute;
  const targetMinutes = targetHour * minutesPerHour;
  const minutesInDay = (calendar.days?.hoursPerDay ?? 24) * minutesPerHour;
  const daysToAdvance = isGritty ? 7 : 1;
  const minutesUntilTarget = daysToAdvance * minutesInDay - currentMinutes + targetMinutes;
  CinematicOverlay.gatedAdvance(minutesUntilTarget * secondsPerMinute, { source: 'rest' });
  log(3, `Long rest (${restVariant}) advancing ${minutesUntilTarget} minutes to ${targetHour}:00 (${daysToAdvance} day${daysToAdvance > 1 ? 's' : ''} later)`);
}

/**
 * Handle PF2E "Rest for the Night" hook. Debounced since it fires per-character.
 * @returns {void}
 */
export function onPF2eRest() {
  if (pf2eRestTimer) return;
  pf2eRestTimer = setTimeout(() => {
    pf2eRestTimer = null;
  }, 500);
  if (TimeClock.locked) {
    log(2, 'PF2E rest time advancement blocked (clock locked)');
    return;
  }
  const advanceTime = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
  if (!advanceTime) return;
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return;
  const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
  const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
  const mode = game.settings.get(MODULE.ID, SETTINGS.REST_ADVANCE_MODE);
  if (mode === 'automatic') {
    const seconds = 8 * minutesPerHour * secondsPerMinute;
    CinematicOverlay.gatedAdvance(seconds, { source: 'rest' });
    log(3, 'PF2E rest advancing 8 hours (system default)');
    return;
  }
  if (mode === 'fixed') {
    const fixedHours = game.settings.get(MODULE.ID, SETTINGS.REST_FIXED_HOURS);
    if (fixedHours <= 0) {
      log(3, 'PF2E rest time advancement suppressed (fixed hours = 0)');
      return;
    }
    const seconds = fixedHours * minutesPerHour * secondsPerMinute;
    CinematicOverlay.gatedAdvance(seconds, { source: 'rest' });
    log(3, `PF2E rest advancing ${fixedHours} hours`);
    return;
  }
  const targetHour = getTargetHour(calendar, mode);
  const currentDate = getCurrentDate();
  const currentMinutes = currentDate.hour * minutesPerHour + currentDate.minute;
  const targetMinutes = targetHour * minutesPerHour;
  const minutesInDay = (calendar.days?.hoursPerDay ?? 24) * minutesPerHour;
  const minutesUntilTarget = minutesInDay - currentMinutes + targetMinutes;
  CinematicOverlay.gatedAdvance(minutesUntilTarget * secondsPerMinute, { source: 'rest' });
  log(3, `PF2E rest advancing ${minutesUntilTarget} minutes to ${targetHour}:00`);
}

/**
 * Handle PF1E rest hook. Debounced since it fires per-actor.
 * @param {object} _actor - The resting actor
 * @param {object} options - Rest options from performRest()
 * @returns {void}
 */
export function onPF1eRest(_actor, options = {}) {
  if (!options.hours) return;
  if (pf1eRestTimer) return;
  pf1eRestTimer = setTimeout(() => {
    pf1eRestTimer = null;
  }, 500);
  if (TimeClock.locked) {
    log(2, 'PF1E rest time advancement blocked (clock locked)');
    return;
  }
  const advanceTime = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
  if (!advanceTime) return;
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return;
  const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
  const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
  const mode = game.settings.get(MODULE.ID, SETTINGS.REST_ADVANCE_MODE);
  if (mode === 'automatic') {
    const seconds = options.hours * minutesPerHour * secondsPerMinute;
    CinematicOverlay.gatedAdvance(seconds, { source: 'rest' });
    log(3, `PF1E rest advancing ${options.hours} hours (system default)`);
    return;
  }
  if (mode === 'fixed') {
    const fixedHours = game.settings.get(MODULE.ID, SETTINGS.REST_FIXED_HOURS);
    if (fixedHours <= 0) {
      log(3, 'PF1E rest time advancement suppressed (fixed hours = 0)');
      return;
    }
    const seconds = fixedHours * minutesPerHour * secondsPerMinute;
    CinematicOverlay.gatedAdvance(seconds, { source: 'rest' });
    log(3, `PF1E rest advancing ${fixedHours} hours`);
    return;
  }
  const targetHour = getTargetHour(calendar, mode);
  const currentDate = getCurrentDate();
  const currentMinutes = currentDate.hour * minutesPerHour + currentDate.minute;
  const targetMinutes = targetHour * minutesPerHour;
  const minutesInDay = (calendar.days?.hoursPerDay ?? 24) * minutesPerHour;
  const minutesUntilTarget = minutesInDay - currentMinutes + targetMinutes;
  CinematicOverlay.gatedAdvance(minutesUntilTarget * secondsPerMinute, { source: 'rest' });
  log(3, `PF1E rest advancing ${minutesUntilTarget} minutes to ${targetHour}:00`);
}

/**
 * Determine the target hour for rest completion.
 * @param {object} calendar - The active calendar
 * @param {string} mode - Rest advance mode ('automatic', 'newDay', 'sunrise', 'fixed')
 * @returns {number} Target hour (decimal)
 */
function getTargetHour(calendar, mode) {
  if (mode !== 'sunrise') return NEW_DAY_HOUR;
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const sunrise = calendar?.sunrise?.(undefined, zone);
  return sunrise ?? NEW_DAY_HOUR;
}
