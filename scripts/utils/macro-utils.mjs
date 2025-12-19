/**
 * Macro Utility Functions
 * Helpers for executing macros from various trigger points.
 *
 * @module Utils/MacroUtils
 * @author Tyler
 */

import { log } from './logger.mjs';

/**
 * Execute a macro by its ID.
 *
 * @param {string} macroId - The ID of the macro to execute
 * @param {Object} [context={}] - Context data to pass to the macro (available as `scope` in macro)
 * @returns {Promise<*>} Result of macro execution, or undefined if not found
 */
export async function executeMacroById(macroId, context = {}) {
  if (!macroId) return;
  const macro = game.macros.get(macroId);
  if (!macro) return;
  log(3, `Executing macro: ${macro.name}`, context);
  return macro.execute(context);
}

/**
 * Get all available macros for selection UI.
 *
 * @returns {Array<{id: string, name: string, type: string}>} Array of macro options
 */
export function getAvailableMacros() {
  return game.macros.contents.map((m) => ({ id: m.id, name: m.name, type: m.type }));
}
