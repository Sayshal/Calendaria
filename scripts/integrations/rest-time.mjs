/**
 * Rest Time Integration
 * Hooks into dnd5e rest system to advance world time based on rest duration.
 * @todo Make this system agnostic-lite: Add hooks for as many systems as we can that support a short/long rest-type integration.
 * @module Integrations/RestTime
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import { getCurrentDate } from '../notes/utils/date-utils.mjs';

/** @type {number} Hour to advance to when "New Day" is selected (8:00 AM) */
const NEW_DAY_HOUR = 8;

/**
 * Register rest time integration hooks.
 * @returns {void}
 */
export function registerRestTimeHooks() {
  if (!game.system.id === 'dnd5e') return;

  // Use pre-hooks to enable time advancement (before dialog)
  Hooks.on('dnd5e.preShortRest', onPreRest);
  Hooks.on('dnd5e.preLongRest', onPreRest);

  // Use post-dialog hook to adjust duration for "New Day" option
  Hooks.on('dnd5e.longRest', onLongRest);

  log(3, 'Rest time integration hooks registered');
}

/**
 * Handle pre-rest hooks to enable time advancement.
 * Fires before dialog, just enables the advanceTime flag.
 * @param {Actor5e} actor - The actor taking the rest
 * @param {RestConfiguration} config - Rest configuration
 * @returns {void}
 */
function onPreRest(actor, config) {
  const advanceTime = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
  if (advanceTime) {
    config.advanceTime = true;
    log(3, `Rest time advancement enabled for ${config.type} rest`);
  }
}

/**
 * Handle long rest after dialog completes.
 * Calculates time advancement based on rest variant and newDay selection.
 *
 * Rest variants:
 * - Normal: 8 hours, newDay checkbox available
 * - Gritty: 7 days, always advances to 8 AM on final day (no newDay checkbox)
 * - Epic: 1 hour, newDay checkbox available
 * @param {Actor5e} actor - The actor taking the rest
 * @param {RestConfiguration} config - Rest configuration (with user's dialog choices)
 * @returns {void}
 */
function onLongRest(actor, config) {
  const advanceTime = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
  if (!advanceTime || !config.advanceTime) return;

  const restVariant = game.settings.get('dnd5e', 'restVariant');
  const isGritty = restVariant === 'gritty';

  // Gritty realism always uses "new day" behavior (no checkbox shown)
  // Normal/Epic only use it if the checkbox is checked
  if (!config.newDay && !isGritty) {
    log(3, `Long rest time advancement (${config.duration} minutes)`);
    return;
  }

  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) {
    log(2, 'No active calendar for New Day calculation, using default duration');
    return;
  }

  const currentDate = getCurrentDate();
  const currentMinutes = currentDate.hour * 60 + currentDate.minute;
  const targetMinutes = NEW_DAY_HOUR * 60;
  const minutesInDay = (calendar.hours ?? 24) * 60;

  // Determine days to advance based on variant
  // Gritty: 7 days, Normal/Epic: 1 day
  const daysToAdvance = isGritty ? 7 : 1;

  // Calculate minutes to reach 8:00 AM on target day
  // Formula: (days * minutesInDay) - currentMinutes + targetMinutes
  const minutesUntilTarget = daysToAdvance * minutesInDay - currentMinutes + targetMinutes;
  config.duration = minutesUntilTarget;

  log(3, `Long rest (${restVariant}) advancing ${minutesUntilTarget} minutes to ${NEW_DAY_HOUR}:00 (${daysToAdvance} day${daysToAdvance > 1 ? 's' : ''} later)`);
}
