/**
 * Rest Time Integration
 * @module Integrations/RestTime
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { getCurrentDate } from '../notes/date-utils.mjs';
import TimeClock from '../time/time-clock.mjs';
import { log } from '../utils/logger.mjs';
import WeatherManager from '../weather/weather-manager.mjs';

/** @type {number} Hour to advance to when "New Day" is selected (8:00 AM) */
const NEW_DAY_HOUR = 8;

/**
 * Handle pre-rest hook to enable time advancement.
 * @param {object} _actor - The actor taking the rest
 * @param {object} config - Rest configuration
 * @returns {void}
 */
export function onPreRest(_actor, config) {
  if (TimeClock.locked) {
    log(3, 'Rest time advancement blocked (clock locked)');
    return;
  }
  const advanceTime = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
  if (advanceTime) {
    config.advanceTime = true;
    log(3, `Rest time advancement enabled for ${config.type} rest`);
  }
}

/**
 * Handle long rest after dialog completes.
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
  if (!isLongRest) return;
  if (!config.newDay && !isGritty) return;
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return;
  const targetHour = getTargetHour(calendar);
  const currentDate = getCurrentDate();
  const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
  const currentMinutes = currentDate.hour * minutesPerHour + currentDate.minute;
  const targetMinutes = targetHour * minutesPerHour;
  const minutesInDay = (calendar.days?.hoursPerDay ?? 24) * minutesPerHour;
  const daysToAdvance = isGritty ? 7 : 1;
  const minutesUntilTarget = daysToAdvance * minutesInDay - currentMinutes + targetMinutes;
  config.duration = minutesUntilTarget;
  log(3, `Long rest (${restVariant}) advancing ${minutesUntilTarget} minutes to ${targetHour}:00 (${daysToAdvance} day${daysToAdvance > 1 ? 's' : ''} later)`);
}

/**
 * Determine the target hour for rest completion.
 * @param {object} calendar - The active calendar
 * @returns {number} Target hour (decimal)
 */
function getTargetHour(calendar) {
  const restToSunrise = game.settings.get(MODULE.ID, SETTINGS.REST_TO_SUNRISE);
  if (!restToSunrise) return NEW_DAY_HOUR;
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const sunrise = calendar?.sunrise?.(undefined, zone);
  return sunrise ?? NEW_DAY_HOUR;
}
