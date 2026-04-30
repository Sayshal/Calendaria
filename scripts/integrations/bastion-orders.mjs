import { CalendarManager } from '../calendar/_module.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import { TimeClock } from '../time/_module.mjs';
import { CalendariaSocket, localize, log } from '../utils/_module.mjs';

/** @type {Function|null} Cached reference to dnd5e's original confirmAdvance method. */
let originalConfirmAdvance = null;

/**
 * Check whether dnd5e bastion integration is available and enabled.
 * @returns {boolean} True if the dnd5e bastion API and configuration are ready
 */
function isBastionSystemActive() {
  if (game.system?.id !== 'dnd5e') return false;
  if (!game.dnd5e?.bastion?.advanceAllFacilities) return false;
  const config = game.settings.get('dnd5e', 'bastionConfiguration');
  return !!config?.enabled;
}

/**
 * Compute seconds per day from the active calendar.
 * @param {object} calendar - The active calendar
 * @returns {number} Seconds per day
 */
function getSecondsPerDay(calendar) {
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
  const secondsPerMinute = calendar?.days?.secondsPerMinute ?? 60;
  return hoursPerDay * minutesPerHour * secondsPerMinute;
}

/**
 * Handle day-change hook to auto-advance bastion orders when enough time has elapsed.
 * @returns {Promise<void>}
 */
export async function onDayChangeForBastions() {
  if (TimeClock.locked) return;
  if (!CalendariaSocket.isPrimaryGM()) return;
  if (!game.settings.get(MODULE.ID, SETTINGS.ADVANCE_BASTION_ORDERS)) return;
  if (!isBastionSystemActive()) return;
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return;
  const secondsPerDay = getSecondsPerDay(calendar);
  if (!secondsPerDay) return;
  const currentTime = game.time.worldTime;
  const lastAdvance = game.settings.get(MODULE.ID, SETTINGS.BASTION_LAST_ADVANCE);
  if (lastAdvance === null || lastAdvance === undefined) {
    await game.settings.set(MODULE.ID, SETTINGS.BASTION_LAST_ADVANCE, currentTime);
    return;
  }
  const daysElapsed = Math.floor((currentTime - lastAdvance) / secondsPerDay);
  if (daysElapsed <= 0) return;
  const bastionConfig = game.settings.get('dnd5e', 'bastionConfiguration');
  const turnDuration = Math.max(1, bastionConfig?.duration ?? 7);
  if (daysElapsed < turnDuration) return;
  const characters = game.actors.filter((a) => a.system?.isCharacter && a.itemTypes?.facility?.length);
  for (const actor of characters) await game.dnd5e.bastion.advanceAllFacilities(actor, { duration: daysElapsed });
  await game.settings.set(MODULE.ID, SETTINGS.BASTION_LAST_ADVANCE, currentTime);
  log(3, `Advanced bastion orders by ${daysElapsed} days for ${characters.length} actor(s)`);
}

/**
 * Patch dnd5e's bastion turn button so it advances world time by one turn duration.
 * @returns {void}
 */
export function patchBastionButton() {
  if (game.system?.id !== 'dnd5e') return;
  if (!game.dnd5e?.bastion?.confirmAdvance) return;
  if (originalConfirmAdvance) return;
  originalConfirmAdvance = game.dnd5e.bastion.confirmAdvance.bind(game.dnd5e.bastion);
  game.dnd5e.bastion.confirmAdvance = async function patchedConfirmAdvance() {
    if (!game.user.isGM) return;
    if (!game.settings.get(MODULE.ID, SETTINGS.ADVANCE_BASTION_ORDERS)) return originalConfirmAdvance();
    const bastionConfig = game.settings.get('dnd5e', 'bastionConfiguration');
    if (!bastionConfig?.enabled) return originalConfirmAdvance();
    if (TimeClock.locked) {
      ui.notifications.warn(localize('CALENDARIA.Bastion.ClockLocked'));
      return;
    }
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return originalConfirmAdvance();
    const duration = Math.max(1, bastionConfig.duration ?? 7);
    const proceed = await foundry.applications.api.DialogV2.confirm({
      content: `<p>${localize('CALENDARIA.Bastion.AdvanceConfirm', { days: duration })}</p>`,
      rejectClose: false,
      window: { icon: 'fa-solid fa-chess-rook', title: localize('CALENDARIA.Bastion.AdvanceTitle') }
    });
    if (!proceed) return;
    const secondsPerDay = getSecondsPerDay(calendar);
    await game.time.advance(duration * secondsPerDay);
  };
  document.getElementById('bastion-turn')?.remove();
  game.dnd5e.bastion.initializeUI?.();
  const button = document.getElementById('bastion-turn');
  if (button) {
    const duration = Math.max(1, game.settings.get('dnd5e', 'bastionConfiguration')?.duration ?? 7);
    button.dataset.tooltip = localize('CALENDARIA.Bastion.ButtonTooltip', { days: duration });
  }
  log(3, 'Patched dnd5e bastion button to advance world time');
}
