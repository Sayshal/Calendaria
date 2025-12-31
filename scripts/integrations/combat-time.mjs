/**
 * Combat Time Integration
 * Advances world time based on combat rounds.
 * @module Integrations/CombatTime
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';

/**
 * Handle combat round changes to advance world time.
 * @param {object} combat - The combat document
 * @param {object} changes - The changes made to the combat
 * @param {object} _options - Update options
 * @param {string} userId - The user who triggered the update
 */
export function onUpdateCombat(combat, changes, _options, userId) {
  if (!('round' in changes)) return;
  if (game.user.id !== userId || !game.user.isGM) return;
  if (!game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_COMBAT)) return;

  const previousRound = combat._source?.round ?? 0;
  if (changes.round <= previousRound) return;

  const roundsAdvanced = changes.round - previousRound;
  const calendar = CalendarManager.getActiveCalendar();
  const secondsPerRound = calendar?.secondsPerRound ?? 6;
  const totalSeconds = roundsAdvanced * secondsPerRound;

  log(3, `Combat round ${previousRound} -> ${changes.round}: advancing time by ${totalSeconds} seconds`);
  game.time.advance(totalSeconds);
}
