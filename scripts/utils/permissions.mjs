import { MODULE, SETTINGS } from '../constants.mjs';

/** @type {Object<string, object>} Default permission settings for each action. */
const DEFAULTS = {
  viewBigCal: { player: false, trusted: true },
  viewChronicle: { player: false, trusted: true },
  viewHUD: { player: true, trusted: true },
  viewMiniCal: { player: false, trusted: true },
  viewNotes: { player: true, trusted: true },
  viewStopwatch: { player: false, trusted: true },
  viewSunDial: { player: false, trusted: true },
  viewTimeKeeper: { player: false, trusted: true },
  addNotes: { player: true, trusted: true },
  changeDateTime: { player: false, trusted: false },
  changeActiveCalendar: { player: false, trusted: false },
  changeWeather: { player: false, trusted: false },
  deleteNotes: { player: false, trusted: false },
  editCalendars: { player: false, trusted: false },
  viewWeatherForecast: { player: false, trusted: true }
};

/**
 * Check if a user has a specific permission.
 * @param {string} permissionKey - The permission key to check
 * @param {User} [user] - User to check, defaults to the current user
 * @returns {boolean} True if user has the permission
 */
export function hasPermission(permissionKey, user = game.user) {
  if (user.isGM) return true;
  const saved = game.settings.get(MODULE.ID, SETTINGS.PERMISSIONS) || {};
  const perms = saved[permissionKey] || DEFAULTS[permissionKey] || {};
  if (perms.player) return true;
  if (perms.trusted && user.isTrusted) return true;
  return false;
}

/**
 * Check whether moons should be shown to the current user. GMs always see them.
 * @returns {boolean} True if moon display is allowed for this user
 */
export function canViewMoons() {
  return game.user.isGM || !game.settings.get(MODULE.ID, SETTINGS.HIDE_MOONS_FROM_PLAYERS);
}

/**
 * Check if the current user can view the BigCal.
 * @returns {boolean} True if user has permission
 */
export function canViewBigCal() {
  return hasPermission('viewBigCal');
}

/**
 * Check if the current user can view the Chronicle.
 * @returns {boolean} True if user has permission
 */
export function canViewChronicle() {
  return hasPermission('viewChronicle');
}

/**
 * Check if the current user can view the HUD.
 * @returns {boolean} True if user has permission
 */
export function canViewHUD() {
  return hasPermission('viewHUD');
}

/**
 * Check if the current user can view the MiniCal.
 * @returns {boolean} True if user has permission
 */
export function canViewMiniCal() {
  return hasPermission('viewMiniCal');
}

/**
 * Check if the current user can open the Note Viewer.
 * @returns {boolean} True if user has permission
 */
export function canViewNotes() {
  return hasPermission('viewNotes');
}

/**
 * Check if the current user can view the Stopwatch.
 * @returns {boolean} True if user has permission
 */
export function canViewStopwatch() {
  return hasPermission('viewStopwatch');
}

/**
 * Check if the current user can view the Sun Dial.
 * @returns {boolean} True if user has permission
 */
export function canViewSunDial() {
  return hasPermission('viewSunDial');
}

/**
 * Check if the current user can view the TimeKeeper.
 * @returns {boolean} True if user has permission
 */
export function canViewTimeKeeper() {
  return hasPermission('viewTimeKeeper');
}

/**
 * Check if the current user can add notes.
 * @returns {boolean} True if user has permission
 */
export function canAddNotes() {
  return hasPermission('addNotes');
}

/**
 * Check if a user can change the date/time.
 * @param {User} [user] - User to check, defaults to the current user
 * @returns {boolean} True if user has permission
 */
export function canChangeDateTime(user) {
  return hasPermission('changeDateTime', user);
}

/**
 * Check if the current user can change the active calendar.
 * @returns {boolean} True if user has permission
 */
export function canChangeActiveCalendar() {
  return hasPermission('changeActiveCalendar');
}

/**
 * Check if a user can change weather.
 * @param {User} [user] - User to check, defaults to the current user
 * @returns {boolean} True if user has permission
 */
export function canChangeWeather(user) {
  return hasPermission('changeWeather', user);
}

/**
 * Check if the current user can delete notes.
 * @returns {boolean} True if user has permission
 */
export function canDeleteNotes() {
  return hasPermission('deleteNotes');
}

/**
 * Check if the current user can delete a specific note: GMs and the author always, other owners only with Delete Notes.
 * @param {object} page - Calendar note page
 * @returns {boolean} True if the user may delete the note
 */
export function canDeleteNote(page) {
  if (game.user.isGM || page?.system?.author?._id === game.user.id) return true;
  return !!(page?.parent ?? page)?.isOwner && canDeleteNotes();
}

/**
 * Check if the current user can edit calendars.
 * @returns {boolean} True if user has permission
 */
export function canEditCalendars() {
  return hasPermission('editCalendars');
}

/**
 * Check if the current user can view weather forecasts.
 * @returns {boolean} True if user has permission
 */
export function canViewWeatherForecast() {
  return hasPermission('viewWeatherForecast');
}

/**
 * Get all users who have a specific permission.
 * Exposed at runtime as `CALENDARIA.permissions.getUsersWithPermission` via the
 * `import * as Permissions` namespace spread in `scripts/api.mjs`.
 * @param {string} permissionKey - The permission key to check
 * @returns {object[]} Array of users with the permission
 */
export function getUsersWithPermission(permissionKey) {
  const saved = game.settings.get(MODULE.ID, SETTINGS.PERMISSIONS) || {};
  const perms = saved[permissionKey] || DEFAULTS[permissionKey] || {};
  return game.users.filter((user) => {
    if (user.isGM) return true;
    if (perms.player) return true;
    if (perms.trusted && user.isTrusted) return true;
    return false;
  });
}

/**
 * Get active non-GM users who lack a specific view permission.
 * @param {string} permissionKey - The permission key to check
 * @returns {object[]} Array of active users blocked by the permission
 */
export function getBlockedActiveUsers(permissionKey) {
  const saved = game.settings.get(MODULE.ID, SETTINGS.PERMISSIONS) || {};
  const perms = saved[permissionKey] || DEFAULTS[permissionKey] || {};
  return game.users.filter((user) => {
    if (!user.active || user.isGM) return false;
    if (perms.player) return false;
    if (perms.trusted && user.isTrusted) return false;
    return true;
  });
}

/**
 * Warn the GM when some active players lack view permission for a widget.
 * @param {string} permissionKey - The view permission key for the widget
 * @param {string} featureLabel - Localized name of the feature/widget
 */
export function warnShowToAll(permissionKey, featureLabel) {
  const blocked = getBlockedActiveUsers(permissionKey);
  if (blocked.length === 0) return;
  const names = blocked.map((u) => u.name).join(', ');
  ui.notifications.warn(_loc('CALENDARIA.Permissions.MismatchWarning', { names, feature: featureLabel }));
}
