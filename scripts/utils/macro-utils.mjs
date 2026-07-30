/**
 * Execute a macro by its ID.
 * @param {string} macroId - The ID of the macro to execute
 * @param {object} [context] - Context data to pass to the macro (available as `scope` in macro)
 * @returns {Promise<*>} Result of macro execution, or undefined if not found
 */
export async function executeMacroById(macroId, context = {}) {
  if (!macroId) return;
  const macro = game.macros.get(macroId);
  if (!macro) return;
  return macro.execute(context);
}

/**
 * Get macros visible to the current user for selection UI.
 * @param {object} [options] - Filter options
 * @param {string} [options.includeId] - Macro ID to retain even when not visible, so a stored selection is not dropped
 * @returns {Array<{id: string, name: string, type: string}>} Array of macro options
 */
export function getAvailableMacros({ includeId } = {}) {
  return (game.macros?.contents ?? []).filter((m) => m.visible || m.id === includeId).map((m) => ({ id: m.id, name: m.name, type: m.type }));
}
