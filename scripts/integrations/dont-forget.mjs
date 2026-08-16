import { HOOKS } from '../constants.mjs';
import { CalendariaSocket } from '../utils/_module.mjs';

/**
 * Check if the Don't Forget module is installed and active.
 * @returns {boolean} Whether Don't Forget is active
 */
export function isDontForgetActive() {
  return game.modules.get('dont-forget')?.active ?? false;
}

/** @type {string} Producer id declared on every to-do this integration creates. */
const SOURCE = 'calendaria';

/**
 * Collect every mirrored to-do created from a note, across all users.
 * @param {string} noteId - The calendar note id
 * @returns {object[]} Matching reminder records
 */
function findMirrored(noteId) {
  return DONTFORGET.api.findReminders({ source: SOURCE, ref: noteId });
}

/**
 * Mirror a delivered reminder into Don't Forget for each targeted user.
 * @param {object} note - The note stub
 * @param {string} message - Formatted reminder message
 * @param {string[]} targets - User ids receiving the reminder
 * @returns {Promise<void>}
 */
export async function mirrorReminder(note, message, targets) {
  if (!isDontForgetActive() || !note.flagData.persistToDo) return;
  const existing = findMirrored(note.id);
  const label = message.replace(/<[^>]+>/g, '');
  for (const userId of targets) {
    if (existing.some((r) => r.userId === userId && !r.isDone)) continue;
    await DONTFORGET.api.createReminder(userId, { label, source: SOURCE, ref: note.id });
  }
  ATLAS.log(3, `Mirrored reminder for note ${note.id} to ${targets.length} user(s)`);
}

/**
 * Remove every to-do this integration created from a note.
 * @param {string} noteId - The calendar note id
 * @returns {Promise<void>}
 */
export async function clearMirroredToDos(noteId) {
  if (!isDontForgetActive()) return;
  for (const reminder of findMirrored(noteId)) await DONTFORGET.api.deleteReminder(reminder.id, reminder.userId, SOURCE);
}

/**
 * Drop mirrored to-dos when a note stops opting in or its reminder is disabled.
 * @param {object} note - The updated note stub
 * @returns {Promise<void>}
 */
async function onNoteUpdated(note) {
  if (note.flagData?.persistToDo && note.flagData.reminderType !== 'none') return;
  await clearMirroredToDos(note.id);
}

/**
 * Initialize Don't Forget integration.
 */
export function initializeDontForget() {
  if (!isDontForgetActive()) return;
  ATLAS.log(3, "Don't Forget detected, registering reminder mirror cleanup");
  Hooks.on(HOOKS.NOTE_UPDATED, (note) => {
    if (CalendariaSocket.isPrimaryGM()) onNoteUpdated(note);
  });
  Hooks.on(HOOKS.NOTE_DELETED, (noteId) => {
    if (CalendariaSocket.isPrimaryGM()) clearMirroredToDos(noteId);
  });
}
