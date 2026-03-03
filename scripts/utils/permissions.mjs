/**
 * Permission checking utilities for Calendaria.
 * @module Utils/Permissions
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';

/**
 * Default permission settings for each action.
 */
const DEFAULTS = {
  viewBigCal: { player: false, trusted: true, assistant: true },
  viewMiniCal: { player: false, trusted: true, assistant: true },
  viewTimeKeeper: { player: false, trusted: true, assistant: true },
  viewSunDial: { player: false, trusted: true, assistant: true },
  addNotes: { player: true, trusted: true, assistant: true },
  changeDateTime: { player: false, trusted: false, assistant: true },
  changeActiveCalendar: { player: false, trusted: false, assistant: false },
  changeWeather: { player: false, trusted: false, assistant: true },
  editNotes: { player: false, trusted: true, assistant: true },
  deleteNotes: { player: false, trusted: false, assistant: true },
  editCalendars: { player: false, trusted: false, assistant: false },
  viewWeatherForecast: { player: false, trusted: true, assistant: true }
};

/**
 * Check if the current user has a specific permission.
 * @param {string} permissionKey - The permission key to check
 * @returns {boolean} True if user has the permission
 */
export function hasPermission(permissionKey) {
  if (game.user.isGM) return true;
  const saved = game.settings.get(MODULE.ID, SETTINGS.PERMISSIONS) || {};
  const perms = saved[permissionKey] || DEFAULTS[permissionKey] || {};
  if (perms.player) return true;
  if (perms.trusted && game.user.isTrusted) return true;
  if (perms.assistant && game.user.role === CONST.USER_ROLES.ASSISTANT) return true;
  return false;
}

/**
 * Check if the current user can view the BigCal.
 * @returns {boolean} True if user has permission
 */
export function canViewBigCal() {
  return hasPermission('viewBigCal');
}

/**
 * Check if the current user can view the MiniCal.
 * @returns {boolean} True if user has permission
 */
export function canViewMiniCal() {
  return hasPermission('viewMiniCal');
}

/**
 * Check if the current user can view the TimeKeeper.
 * @returns {boolean} True if user has permission
 */
export function canViewTimeKeeper() {
  return hasPermission('viewTimeKeeper');
}

/**
 * Check if the current user can view the Sun Dial.
 * @returns {boolean} True if user has permission
 */
export function canViewSunDial() {
  return hasPermission('viewSunDial');
}

/**
 * Check if the current user can add notes.
 * @returns {boolean} True if user has permission
 */
export function canAddNotes() {
  return hasPermission('addNotes');
}

/**
 * Check if the current user can change the date/time.
 * @returns {boolean} True if user has permission
 */
export function canChangeDateTime() {
  return hasPermission('changeDateTime');
}

/**
 * Check if the current user can change the active calendar.
 * @returns {boolean} True if user has permission
 */
export function canChangeActiveCalendar() {
  return hasPermission('changeActiveCalendar');
}

/**
 * Check if the current user can change weather.
 * @returns {boolean} True if user has permission
 */
export function canChangeWeather() {
  return hasPermission('changeWeather');
}

/**
 * Check if the current user can edit existing notes.
 * @returns {boolean} True if user has permission
 */
export function canEditNotes() {
  return hasPermission('editNotes');
}

/**
 * Check if the current user can delete notes.
 * @returns {boolean} True if user has permission
 */
export function canDeleteNotes() {
  return hasPermission('deleteNotes');
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
    if (perms.assistant && user.role === CONST.USER_ROLES.ASSISTANT) return true;
    return false;
  });
}
