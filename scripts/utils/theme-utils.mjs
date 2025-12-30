/**
 * Theme utilities for Calendaria custom color theming.
 * Handles application and initialization of user-customized theme colors.
 * @module Utils/ThemeUtils
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';

/**
 * Default color values for Calendaria theme.
 * @type {Object<string, string>}
 */
export const DEFAULT_COLORS = {
  bg: '#1f1f1f',
  bgLighter: '#2a2a2a',
  bgHover: '#353535',
  border: '#4a4a4a',
  borderLight: '#3a3a3a',
  text: '#e0e0e0',
  textDim: '#999999',
  titleText: '#ffffff',
  weekdayHeader: '#e0e0e0',
  dayNumber: '#e0e0e0',
  restDay: '#8b9dc3',
  buttonBg: '#3a3a3a',
  buttonText: '#e0e0e0',
  buttonBorder: '#4a4a4a',
  primary: '#4a90e2',
  today: '#ff6400',
  festivalBorder: '#d4af37',
  festivalText: '#ffd700'
};

/**
 * Color variable definitions with display names.
 * @type {Array<{key: string, label: string, category: string}>}
 */
export const COLOR_DEFINITIONS = [
  { key: 'bg', label: 'CALENDARIA.ThemeEditor.Colors.Background', category: 'backgrounds' },
  { key: 'bgLighter', label: 'CALENDARIA.ThemeEditor.Colors.BackgroundLighter', category: 'backgrounds' },
  { key: 'bgHover', label: 'CALENDARIA.ThemeEditor.Colors.BackgroundHover', category: 'backgrounds' },
  { key: 'border', label: 'CALENDARIA.ThemeEditor.Colors.Border', category: 'borders' },
  { key: 'borderLight', label: 'CALENDARIA.ThemeEditor.Colors.BorderLight', category: 'borders' },
  { key: 'text', label: 'CALENDARIA.ThemeEditor.Colors.Text', category: 'text' },
  { key: 'textDim', label: 'CALENDARIA.ThemeEditor.Colors.TextDim', category: 'text' },
  { key: 'titleText', label: 'CALENDARIA.ThemeEditor.Colors.TitleText', category: 'text' },
  { key: 'weekdayHeader', label: 'CALENDARIA.ThemeEditor.Colors.WeekdayHeader', category: 'text' },
  { key: 'dayNumber', label: 'CALENDARIA.ThemeEditor.Colors.DayNumber', category: 'text' },
  { key: 'restDay', label: 'CALENDARIA.ThemeEditor.Colors.RestDay', category: 'text' },
  { key: 'buttonBg', label: 'CALENDARIA.ThemeEditor.Colors.ButtonBackground', category: 'buttons' },
  { key: 'buttonText', label: 'CALENDARIA.ThemeEditor.Colors.ButtonText', category: 'buttons' },
  { key: 'buttonBorder', label: 'CALENDARIA.ThemeEditor.Colors.ButtonBorder', category: 'buttons' },
  { key: 'primary', label: 'CALENDARIA.ThemeEditor.Colors.Primary', category: 'accents' },
  { key: 'today', label: 'CALENDARIA.ThemeEditor.Colors.Today', category: 'accents' },
  { key: 'festivalBorder', label: 'CALENDARIA.ThemeEditor.Colors.FestivalBorder', category: 'festivals' },
  { key: 'festivalText', label: 'CALENDARIA.ThemeEditor.Colors.FestivalText', category: 'festivals' }
];

/**
 * Apply custom colors to all Calendaria elements.
 * @param {Object<string, string>} colors - Color values to apply
 */
export function applyCustomColors(colors) {
  let styleEl = document.getElementById('calendaria-custom-theme');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'calendaria-custom-theme';
    document.head.appendChild(styleEl);
  }

  const cssVars = [];
  const varMap = {
    bg: '--calendaria-bg',
    bgLighter: '--calendaria-bg-lighter',
    bgHover: '--calendaria-bg-hover',
    border: '--calendaria-border',
    borderLight: '--calendaria-border-light',
    text: '--calendaria-text',
    textDim: '--calendaria-text-dim',
    titleText: '--calendaria-title-text',
    weekdayHeader: '--calendaria-weekday-header',
    dayNumber: '--calendaria-day-number',
    restDay: '--calendaria-rest-day',
    buttonBg: '--calendaria-button-bg',
    buttonText: '--calendaria-button-text',
    buttonBorder: '--calendaria-button-border',
    primary: '--calendaria-primary',
    today: '--calendaria-today',
    festivalBorder: '--calendaria-festival-border',
    festivalText: '--calendaria-festival-text'
  };

  for (const [key, cssVar] of Object.entries(varMap)) if (colors[key]) cssVars.push(`${cssVar}: ${colors[key]};`);
  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
  };
  if (colors.today) {
    const { r, g, b } = hexToRgb(colors.today);
    cssVars.push(`--calendaria-today-bg: rgb(${r} ${g} ${b} / 20%);`);
    cssVars.push(`--calendaria-current-hour: rgb(${r} ${g} ${b} / 12%);`);
  }
  if (colors.primary) {
    const { r, g, b } = hexToRgb(colors.primary);
    cssVars.push(`--calendaria-selected-bg: rgb(${r} ${g} ${b} / 15%);`);
  }
  if (colors.festivalBorder) {
    const { r, g, b } = hexToRgb(colors.festivalBorder);
    cssVars.push(`--calendaria-festival-bg: rgb(${r} ${g} ${b} / 15%);`);
  }
  styleEl.textContent = `.calendaria {${cssVars.join('\n        ')}}`;
  for (const app of foundry.applications.instances.values()) if (app.constructor.name.includes('Calendar')) app.render();
}

/**
 * Initialize custom theme colors on module ready.
 */
export function initializeTheme() {
  const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
  if (Object.keys(customColors).length > 0) {
    const colors = { ...DEFAULT_COLORS, ...customColors };
    applyCustomColors(colors);
  }
}
