/**
 * Localize a string key. Wrapper for game.i18n.localize.
 * @param {string} key - i18n key or string
 * @returns {string} Localized string (or original if not a key)
 */
export function localize(key) {
  return game.i18n.localize(key);
}

/**
 * Format a localized string with data. Wrapper for game.i18n.format.
 * @param {string} key - i18n key
 * @param {object} data - Data to interpolate
 * @returns {string} Formatted localized string
 */
export function format(key, data) {
  return game.i18n.format(key, data);
}
