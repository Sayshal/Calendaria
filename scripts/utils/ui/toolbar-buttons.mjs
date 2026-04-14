/**
 * Scene Control Toolbar Buttons
 * @module Utils/UI/ToolbarButtons
 * @author Tyler
 */

import { BigCal, Chronicle, HUD, MiniCal, Stopwatch, SunDial, TimeKeeper } from '../../applications/_module.mjs';
import { MODULE, SETTINGS } from '../../constants.mjs';
import { localize } from '../localization.mjs';
import { canViewBigCal, canViewChronicle, canViewHUD, canViewMiniCal, canViewStopwatch, canViewSunDial, canViewTimeKeeper } from '../permissions.mjs';

/** App definitions for toolbar buttons. */
const TOOLBAR_APP_DEFS = {
  bigcal: { icon: 'fa-calendar-days', label: 'CALENDARIA.Common.BigCal', toggle: () => BigCal.toggle(), canView: canViewBigCal },
  minical: { icon: 'fa-compress', label: 'CALENDARIA.Common.MiniCal', toggle: () => MiniCal.toggle(), canView: canViewMiniCal },
  hud: { icon: 'fa-landmark-dome', label: 'CALENDARIA.SettingsPanel.Tab.HUD', toggle: () => HUD.toggle(), canView: canViewHUD },
  timekeeper: { icon: 'fa-gauge', label: 'CALENDARIA.Common.TimeKeeper', toggle: () => TimeKeeper.toggle(), canView: canViewTimeKeeper },
  sundial: { icon: 'fa-sun', label: 'CALENDARIA.SettingsPanel.Tab.SunDial', toggle: () => SunDial.toggle(), canView: canViewSunDial },
  stopwatch: { icon: 'fa-stopwatch', label: 'CALENDARIA.Common.StopWatch', toggle: () => Stopwatch.toggle(), canView: canViewStopwatch },
  chronicle: { icon: 'fa-scroll', label: 'CALENDARIA.Chronicle.Title', toggle: () => Chronicle.toggle(), canView: canViewChronicle }
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
    controls.notes.tools[`calendaria-${appId}`] = { name: `calendaria-${appId}`, title: localize(def.label), icon: `fas ${def.icon}`, visible: def.canView(), onChange: def.toggle, button: true };
  }
}
