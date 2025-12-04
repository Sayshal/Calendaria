/**
 * Calendaria Module Logger
 * @module Logger
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';

/**
 * Array to store Calendaria logs only.
 * @type {Array<{timestamp: string, type: string, level: number, content: Array}>}
 */
const calendariaLogHistory = [];

/**
 * Simple logging function with module ID prefix and colored styling.
 * @param {Number} level - Log level (1=error, 2=warning, 3=verbose)
 * @param {...*} args - Content to log to console (any number of arguments)
 */
export function log(level, ...args) {
  calendariaLogHistory.push({timestamp: new Date().toISOString(),type: level === 1 ? 'error' : level === 2 ? 'warn' : 'debug',level,content: args});
  if (calendariaLogHistory.length > 2000) calendariaLogHistory.shift();
  const configuredLogLevel = MODULE.LOG_LEVEL;
  if (configuredLogLevel > 0 && level <= configuredLogLevel) {
    let logType;
    switch (level) {
      case 1:
        logType = 'error';
        console.error(`%c${MODULE.ID}%c |`, 'color: #ef4444; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 0 1px #000;', 'color: #9ca3af;', ...args);
        break;
      case 2:
        logType = 'warn';
        console.warn(`%c${MODULE.ID}%c |`, 'color: #fb923c; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 0 1px #000;', 'color: #9ca3af;', ...args);
        break;
      case 3:
      default:
        logType = 'debug';
        console.debug(`%c${MODULE.ID}%c |`, 'color: #a78bfa; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; text-shadow: 0 0 1px #000;', 'color: #9ca3af;', ...args);
        break;
    }
  }
}

/**
 * Initialize the logger with current game settings.
 * @returns {void}
 */
export function initializeLogger() {
  try {
    const logLevel = game.settings.get(MODULE.ID, SETTINGS.LOGGING_LEVEL);
    MODULE.LOG_LEVEL = parseInt(logLevel) || 0;
  } catch (error) {
    console.error(`${MODULE.ID} | Error initializing logger:`, error);
    MODULE.LOG_LEVEL = 1;
  }
}
