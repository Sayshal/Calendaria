import { registerCalendarSwitching } from './calendar-switching.mjs';
import { registerTimeAdvancement } from './time-advancement.mjs';
import { registerWeatherGeneration } from './weather-generation.mjs';
import { registerNoteCrud } from './note-crud.mjs';
import { registerDarknessSync } from './darkness-sync.mjs';
import { registerApiSmoke } from './api-smoke.mjs';
import { registerWeatherAdvanced } from './weather-advanced.mjs';
import { registerNoteQueries } from './note-queries.mjs';
import { registerNoteProperties } from './note-properties.mjs';
import { registerTimeDayCycle } from './time-day-cycle.mjs';
import { registerDateArithmetic } from './date-arithmetic.mjs';
import { registerMoonPhases } from './moon-phases.mjs';
import { registerCalendarMetadata } from './calendar-metadata.mjs';
import { registerFormatStrings } from './format-strings.mjs';
import { registerClockControls } from './clock-controls.mjs';
import { registerHookEvents } from './hook-events.mjs';

/**
 * Register all Calendaria Quench integration test batches.
 * @param {object} quench  Quench test runner instance
 */
export function registerBatches(quench) {
  registerCalendarSwitching(quench);
  registerTimeAdvancement(quench);
  registerWeatherGeneration(quench);
  registerNoteCrud(quench);
  registerDarknessSync(quench);
  registerApiSmoke(quench);
  registerWeatherAdvanced(quench);
  registerNoteQueries(quench);
  registerNoteProperties(quench);
  registerTimeDayCycle(quench);
  registerDateArithmetic(quench);
  registerMoonPhases(quench);
  registerCalendarMetadata(quench);
  registerFormatStrings(quench);
  registerClockControls(quench);
  registerHookEvents(quench);
}
