import { MODULE, SETTINGS } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';

/** Core setting that Manage Modules writes when modules are toggled. */
const MODULE_CONFIGURATION_KEY = 'core.moduleConfiguration';

/** Application id of Foundry's reload confirmation, shown as soon as Manage Modules is saved. */
const RELOAD_PROMPT_ID = 'reload-world-confirm';

/**
 * Count the calendar notes Calendaria currently tracks.
 * @returns {number} Number of calendar notes
 */
export function countCalendarNotes() {
  return NoteManager.getAllNotes().length;
}

/**
 * Delete every calendar note journal and forget which calendars have been seeded with festival notes.
 * Leaves the world without any `calendaria.calendarnote` pages, so the module can be disabled or uninstalled cleanly.
 * @returns {Promise<number>} Number of notes removed
 */
export async function removeAllCalendarNotes() {
  const deleted = await NoteManager.deleteAllNotes();
  await game.settings.set(MODULE.ID, SETTINGS.SEEDED_CALENDARS, new Set());
  ATLAS.log(3, `Removed ${deleted} calendar notes and cleared the festival seed record`);
  return deleted;
}

/**
 * Ask the GM whether to remove Calendaria's notes now that the module is being switched off.
 * Foundry's reload prompt is closed while this dialog is open and re-opened afterwards so the two never stack.
 * @returns {Promise<boolean>} True when the notes were removed
 */
export async function promptNoteCleanupBeforeDisable() {
  const count = countCalendarNotes();
  if (!count) return false;
  const reloadPrompt = foundry.applications.instances.get(RELOAD_PROMPT_ID);
  if (reloadPrompt) await reloadPrompt.close();
  const remove = await foundry.applications.api.DialogV2.confirm({
    classes: ['calendaria'],
    modal: true,
    window: { title: 'CALENDARIA.Deactivation.Title', icon: 'fas fa-triangle-exclamation' },
    position: { width: 480 },
    content: `<p>${_loc('CALENDARIA.Deactivation.Body', { count })}</p><p>${_loc('CALENDARIA.Deactivation.Hint')}</p>`,
    yes: { label: 'CALENDARIA.Deactivation.Remove', icon: 'fas fa-trash' },
    no: { label: 'CALENDARIA.Deactivation.Keep', icon: 'fas fa-box-archive', default: true },
    rejectClose: false
  });
  let removed = false;
  if (remove) {
    const deleted = await removeAllCalendarNotes();
    ui.notifications.info(_loc('CALENDARIA.Deactivation.Removed', { count: deleted }));
    removed = true;
  }
  if (reloadPrompt) foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true });
  return removed;
}

/**
 * Parse the module configuration payload carried by an updateSetting hook.
 * @param {*} value - Raw `changes.value`, either a JSON string or an already-parsed object
 * @returns {object|null} Map of module id to enabled state, or null when unreadable
 */
function parseModuleConfiguration(value) {
  if (value == null) return null;
  if (typeof value !== 'string') return typeof value === 'object' ? value : null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

/**
 * Offer note cleanup when the core module configuration turns Calendaria off.
 * Only the client that saved Manage Modules reacts, so the prompt appears once, in front of the GM who made the change.
 * @param {object} setting - The updated Setting document
 * @param {object} changes - The changes applied to the setting
 * @param {object} _options - Update options
 * @param {string} userId - ID of the user who made the change
 * @returns {Promise<boolean>|void} Resolves true when notes were removed; undefined when the change is not ours to handle
 */
export function onUpdateModuleConfiguration(setting, changes, _options, userId) {
  if (setting?.key !== MODULE_CONFIGURATION_KEY) return;
  if (userId !== game.user?.id || !game.user?.isGM) return;
  if (!game.modules.get(MODULE.ID)?.active) return;
  const config = parseModuleConfiguration(changes?.value) ?? game.settings.get('core', 'moduleConfiguration');
  if (config?.[MODULE.ID] !== false) return;
  ATLAS.log(3, 'Calendaria is being disabled; offering calendar note cleanup');
  return promptNoteCleanupBeforeDisable();
}
