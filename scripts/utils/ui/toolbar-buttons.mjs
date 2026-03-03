/**
 * Scene Control Toolbar Buttons
 * @module Utils/UI/ToolbarButtons
 * @author Tyler
 */

import { BigCal } from '../../applications/calendar/big-cal.mjs';
import { MiniCal } from '../../applications/calendar/mini-cal.mjs';
import { HUD } from '../../applications/hud/hud.mjs';
import { Stopwatch } from '../../applications/time/stopwatch.mjs';
import { SunDial } from '../../applications/time/sun-dial.mjs';
import { TimeKeeper } from '../../applications/time/time-keeper.mjs';
import { MODULE, SETTINGS } from '../../constants.mjs';
import { localize } from '../localization.mjs';

/** App definitions for toolbar buttons. */
const TOOLBAR_APP_DEFS = {
  bigcal: { icon: 'fa-calendar-days', label: 'CALENDARIA.SettingsPanel.Tab.BigCal', toggle: () => BigCal.toggle() },
  minical: { icon: 'fa-compress', label: 'CALENDARIA.SettingsPanel.Tab.MiniCal', toggle: () => MiniCal.toggle() },
  hud: { icon: 'fa-landmark-dome', label: 'CALENDARIA.SettingsPanel.Tab.HUD', toggle: () => HUD.toggle() },
  timekeeper: { icon: 'fa-gauge', label: 'CALENDARIA.SettingsPanel.Tab.TimeKeeper', toggle: () => TimeKeeper.toggle() },
  sundial: { icon: 'fa-sun', label: 'CALENDARIA.SettingsPanel.Tab.SunDial', toggle: () => SunDial.toggle() },
  stopwatch: { icon: 'fa-stopwatch', label: 'CALENDARIA.SettingsPanel.Tab.Stopwatch', toggle: () => Stopwatch.toggle() }
};

/**
 * Add Calendaria buttons to scene controls.
 * @param {object} controls - Scene controls object (V13 style)
 */
export function onGetSceneControlButtons(controls) {
  if (!controls.notes?.tools) return;
  if (!game.settings.get(MODULE.ID, SETTINGS.SHOW_TOOLBAR_BUTTON)) return;
  const toolbarApps = game.settings.get(MODULE.ID, SETTINGS.TOOLBAR_APPS);
  for (const appId of toolbarApps) {
    const def = TOOLBAR_APP_DEFS[appId];
    if (!def) continue;
    controls.notes.tools[`calendaria-${appId}`] = { name: `calendaria-${appId}`, title: localize(def.label), icon: `fas ${def.icon}`, visible: true, onChange: def.toggle, button: true };
  }
}
