/**
 * Calendaria Hook Registration
 * All hooks for the Calendaria module should be registered here.
 * @module Hooks
 * @author Tyler
 */

import { log } from './utils/logger.mjs';
import { onRenderSceneConfig, onUpdateWorldTime } from './darkness.mjs';

/**
 * Register all hooks for the Calendaria module.
 * @returns {void}
 */
export function registerHooks() {
  Hooks.on('renderSceneConfig', onRenderSceneConfig);
  Hooks.on('updateWorldTime', onUpdateWorldTime);

  log(3, 'Hooks registered');
}
