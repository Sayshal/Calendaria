/**
 * Rest Time Integration
 * Hooks into dnd5e rest mechanics to advance world time based on rest duration.
 * @todo Add system-agnostic hooks for other systems (pf2e, etc.)
 * @module Integrations/RestTime
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { getCurrentDate } from '../notes/utils/date-utils.mjs';
import { log } from '../utils/logger.mjs';

/** @type {number} Hour to advance to when "New Day" is selected (8:00 AM) */
const NEW_DAY_HOUR = 8;

/**
 * Handle pre-rest hook to enable time advancement.
 * Fires before dialog, just enables the advanceTime flag.
 * @param {object} _actor - The actor taking the rest
 * @param {object} config - Rest configuration
 * @returns {void}
 */
export function onPreRest(_actor, config) {
  const advanceTime = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
  if (advanceTime) {
    config.advanceTime = true;
    log(3, `Rest time advancement enabled for ${config.type} rest`);
  }
}

/**
 * Handle long rest after dialog completes.
 * Calculates time to advance to reach 8:00 AM the next day (or 7 days for gritty).
 * @param {object} _actor - The actor taking the rest
 * @param {object} config - Rest configuration (with user's dialog choices)
 * @returns {void}
 */
export function onLongRest(_actor, config) {
  const advanceTime = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
  if (!advanceTime) return;
  if (config.advanceTime === false) return;
  const restVariant = game.settings.get('dnd5e', 'restVariant');
  const isLongRest = config.type === 'long' || config.longRest === true;
  const isGritty = restVariant === 'gritty';

  if (!isLongRest) {
    log(3, `Short rest detected, using system default duration`);
    return;
  }

  if (!config.newDay && !isGritty) {
    log(3, `Long rest time advancement (${config.duration} minutes)`);
    return;
  }

  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return;
  const currentDate = getCurrentDate();
  const currentMinutes = currentDate.hour * 60 + currentDate.minute;
  const targetMinutes = NEW_DAY_HOUR * 60;
  const minutesInDay = (calendar.days?.hoursPerDay ?? 24) * 60;
  const daysToAdvance = isGritty ? 7 : 1;
  const minutesUntilTarget = daysToAdvance * minutesInDay - currentMinutes + targetMinutes;
  config.duration = minutesUntilTarget;
  log(3, `Long rest (${restVariant}) advancing ${minutesUntilTarget} minutes to ${NEW_DAY_HOUR}:00 (${daysToAdvance} day${daysToAdvance > 1 ? 's' : ''} later)`);
}
