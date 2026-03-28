/**
 * Theme utilities for Calendaria custom color theming.
 * @module Utils/ThemeUtils
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';

/** @type {Object<string, string>} Default color values for Calendaria theme (Dark). */
export const DEFAULT_COLORS = {
  bg: '#1f1f1f',
  bgLighter: '#2a2a2a',
  bgHover: '#353535',
  border: '#4a4a4a',
  borderLight: '#3a3a3a',
  divider: '#414141',
  inputBg: '#303030',
  text: '#e0e0e0',
  textDim: '#999999',
  textHeading: '#eeeeee',
  textSecondary: '#aaaaaa',
  titleText: '#ffffff',
  weekdayHeader: '#e0e0e0',
  dayNumber: '#e0e0e0',
  restDay: '#8b9dc3',
  buttonBg: '#3a3a3a',
  buttonText: '#e0e0e0',
  buttonBorder: '#4a4a4a',
  primary: '#4a90e2',
  today: '#ff6400',
  accent: '#a89060',
  error: '#f44336',
  warning: '#ffc107',
  success: '#88cc88',
  festivalBorder: '#d4af37',
  festivalText: '#ffd700',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Light theme preset colors. */
export const LIGHT_COLORS = {
  bg: '#f5f5f5',
  bgLighter: '#ffffff',
  bgHover: '#e8e8e8',
  border: '#d0d0d0',
  borderLight: '#e0e0e0',
  divider: '#d2d2d2',
  inputBg: '#f8f8f8',
  text: '#2c2c2c',
  textDim: '#666666',
  textHeading: '#202020',
  textSecondary: '#505050',
  titleText: '#1a1a1a',
  weekdayHeader: '#2c2c2c',
  dayNumber: '#2c2c2c',
  restDay: '#5a6a8a',
  buttonBg: '#e8e8e8',
  buttonText: '#2c2c2c',
  buttonBorder: '#d0d0d0',
  primary: '#2a70c2',
  today: '#e05500',
  accent: '#8b7000',
  error: '#d32f2f',
  warning: '#f5b400',
  success: '#228822',
  festivalBorder: '#b89527',
  festivalText: '#8b7000',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} High contrast theme preset colors. */
export const HIGH_CONTRAST_COLORS = {
  bg: '#000000',
  bgLighter: '#1a1a1a',
  bgHover: '#333333',
  border: '#ffffff',
  borderLight: '#cccccc',
  divider: '#666666',
  inputBg: '#1a1a1a',
  text: '#ffffff',
  textDim: '#cccccc',
  textHeading: '#ffffff',
  textSecondary: '#dddddd',
  titleText: '#ffffff',
  weekdayHeader: '#ffffff',
  dayNumber: '#ffffff',
  restDay: '#99bbff',
  buttonBg: '#333333',
  buttonText: '#ffffff',
  buttonBorder: '#ffffff',
  primary: '#00aaff',
  today: '#ff8800',
  accent: '#ffcc00',
  error: '#ff4444',
  warning: '#ffcc00',
  success: '#00ff88',
  festivalBorder: '#ffdd00',
  festivalText: '#ffee00',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Parchment theme preset colors. */
export const PARCHMENT_COLORS = {
  bg: '#f5e6c8',
  bgLighter: '#eddcc0',
  bgHover: '#d0b888',
  border: '#c9a96e',
  borderLight: '#b8944e',
  divider: '#b8944e',
  inputBg: '#eddcc0',
  text: '#3c2415',
  textDim: '#8a7460',
  textHeading: '#5c3a1e',
  textSecondary: '#6b4f3a',
  titleText: '#5c3a1e',
  weekdayHeader: '#3c2415',
  dayNumber: '#3c2415',
  restDay: '#7a6040',
  buttonBg: '#dcc8a0',
  buttonText: '#3c2415',
  buttonBorder: '#c9a96e',
  primary: '#8b6914',
  today: '#ff8c00',
  accent: '#8b6914',
  error: '#c62828',
  warning: '#e6a000',
  success: '#5a7a2e',
  festivalBorder: '#b8860b',
  festivalText: '#8b6914',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Logbook theme preset colors. */
export const LOGBOOK_COLORS = {
  bg: '#f5f0e0',
  bgLighter: '#faf5e8',
  bgHover: '#e8e0cc',
  border: '#5b7daa',
  borderLight: '#7b9cc4',
  divider: '#5b7daa',
  inputBg: '#f0ead8',
  text: '#1a1a30',
  textDim: '#5a5a70',
  textHeading: '#2a1010',
  textSecondary: '#3a3a55',
  titleText: '#2a1010',
  weekdayHeader: '#1a1a30',
  dayNumber: '#1a1a30',
  restDay: '#b03030',
  buttonBg: '#e0d8c4',
  buttonText: '#1a1a30',
  buttonBorder: '#5b7daa',
  primary: '#2855a0',
  today: '#c02020',
  accent: '#b03030',
  error: '#c62828',
  warning: '#cc8800',
  success: '#2a7a3a',
  festivalBorder: '#c02020',
  festivalText: '#901818',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Arcane theme preset colors. */
export const ARCANE_COLORS = {
  bg: '#1a0a2e',
  bgLighter: '#231440',
  bgHover: '#3d2a6e',
  border: '#4a3580',
  borderLight: '#5a45a0',
  divider: '#5a45a0',
  inputBg: '#251845',
  text: '#c8b8e8',
  textDim: '#7766a0',
  textHeading: '#e0d0ff',
  textSecondary: '#9988c0',
  titleText: '#e0d0ff',
  weekdayHeader: '#c8b8e8',
  dayNumber: '#c8b8e8',
  restDay: '#9988c0',
  buttonBg: '#2e1e55',
  buttonText: '#c8b8e8',
  buttonBorder: '#4a3580',
  primary: '#b088ff',
  today: '#b496ff',
  accent: '#b088ff',
  error: '#ff5555',
  warning: '#e8a0ff',
  success: '#66bb88',
  festivalBorder: '#b088ff',
  festivalText: '#d4b8ff',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Sci-Fi theme preset colors. */
export const SCIFI_COLORS = {
  bg: '#0a0e17',
  bgLighter: '#111820',
  bgHover: '#1a2a40',
  border: '#1a3050',
  borderLight: '#1a3050',
  divider: '#1a3050',
  inputBg: '#0d1520',
  text: '#b0c4de',
  textDim: '#506070',
  textHeading: '#00e5ff',
  textSecondary: '#7a94b0',
  titleText: '#00e5ff',
  weekdayHeader: '#b0c4de',
  dayNumber: '#b0c4de',
  restDay: '#7a94b0',
  buttonBg: '#0f1a28',
  buttonText: '#b0c4de',
  buttonBorder: '#1a3050',
  primary: '#00e5ff',
  today: '#00e5ff',
  accent: '#00e5ff',
  error: '#ff4444',
  warning: '#ffaa00',
  success: '#00cc88',
  festivalBorder: '#00e5ff',
  festivalText: '#00e5ff',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, {name: string, colors: Object<string, string>}>} All bundled theme presets. */
export const THEME_PRESETS = {
  dark: { name: 'CALENDARIA.ThemeEditor.Presets.Dark', colors: DEFAULT_COLORS },
  light: { name: 'CALENDARIA.ThemeEditor.Presets.Light', colors: LIGHT_COLORS },
  highContrast: { name: 'CALENDARIA.ThemeEditor.Presets.HighContrast', colors: HIGH_CONTRAST_COLORS },
  parchment: { name: 'CALENDARIA.ThemeEditor.Presets.Parchment', colors: PARCHMENT_COLORS },
  logbook: { name: 'CALENDARIA.ThemeEditor.Presets.Logbook', colors: LOGBOOK_COLORS },
  arcane: { name: 'CALENDARIA.ThemeEditor.Presets.Arcane', colors: ARCANE_COLORS },
  scifi: { name: 'CALENDARIA.ThemeEditor.Presets.Scifi', colors: SCIFI_COLORS }
};

/** @type {Object<string, string>} Color categories with labels. */
export const COLOR_CATEGORIES = {
  backgrounds: 'CALENDARIA.ThemeEditor.Category.Backgrounds',
  borders: 'CALENDARIA.ThemeEditor.Category.Borders',
  text: 'CALENDARIA.ThemeEditor.Category.Text',
  buttons: 'CALENDARIA.ThemeEditor.Category.Buttons',
  accents: 'CALENDARIA.ThemeEditor.Category.Accents',
  festivals: 'CALENDARIA.ThemeEditor.Category.Festivals',
  effects: 'CALENDARIA.ThemeEditor.Category.Effects'
};

/** @type {Object<string, string>} HUD component categories with labels. */
export const COMPONENT_CATEGORIES = {
  common: 'CALENDARIA.ThemeEditor.Component.Common',
  domeHud: 'CALENDARIA.ThemeEditor.Component.DomeHud',
  timeKeeper: 'CALENDARIA.ThemeEditor.Component.TimeKeeper',
  miniCal: 'CALENDARIA.ThemeEditor.Component.MiniCal'
};

/** @type {Array<{key: string, label: string, category: string, component: string}>} Color variable definitions with display names and categories. */
export const COLOR_DEFINITIONS = [
  { key: 'bg', label: 'CALENDARIA.ThemeEditor.Colors.Background', category: 'backgrounds', component: 'common' },
  { key: 'bgLighter', label: 'CALENDARIA.ThemeEditor.Colors.BackgroundLighter', category: 'backgrounds', component: 'common' },
  { key: 'bgHover', label: 'CALENDARIA.ThemeEditor.Colors.BackgroundHover', category: 'backgrounds', component: 'common' },
  { key: 'inputBg', label: 'CALENDARIA.ThemeEditor.Colors.InputBackground', category: 'backgrounds', component: 'common' },
  { key: 'divider', label: 'CALENDARIA.ThemeEditor.Colors.Divider', category: 'borders', component: 'common' },
  { key: 'border', label: 'CALENDARIA.ThemeEditor.Colors.Border', category: 'borders', component: 'common' },
  { key: 'borderLight', label: 'CALENDARIA.ThemeEditor.Colors.BorderLight', category: 'borders', component: 'common' },
  { key: 'text', label: 'CALENDARIA.ThemeEditor.Colors.Text', category: 'text', component: 'common' },
  { key: 'textDim', label: 'CALENDARIA.ThemeEditor.Colors.TextDim', category: 'text', component: 'common' },
  { key: 'textHeading', label: 'CALENDARIA.ThemeEditor.Colors.TextHeading', category: 'text', component: 'common' },
  { key: 'textSecondary', label: 'CALENDARIA.ThemeEditor.Colors.TextSecondary', category: 'text', component: 'common' },
  { key: 'titleText', label: 'CALENDARIA.ThemeEditor.Colors.TitleText', category: 'text', component: 'common' },
  { key: 'weekdayHeader', label: 'CALENDARIA.ThemeEditor.Colors.WeekdayHeader', category: 'text', component: 'miniCal' },
  { key: 'dayNumber', label: 'CALENDARIA.ThemeEditor.Colors.DayNumber', category: 'text', component: 'miniCal' },
  { key: 'restDay', label: 'CALENDARIA.ThemeEditor.Colors.RestDay', category: 'text', component: 'miniCal' },
  { key: 'buttonBg', label: 'CALENDARIA.ThemeEditor.Colors.ButtonBackground', category: 'buttons', component: 'common' },
  { key: 'buttonText', label: 'CALENDARIA.ThemeEditor.Colors.ButtonText', category: 'buttons', component: 'common' },
  { key: 'buttonBorder', label: 'CALENDARIA.ThemeEditor.Colors.ButtonBorder', category: 'buttons', component: 'common' },
  { key: 'primary', label: 'CALENDARIA.ThemeEditor.Colors.Primary', category: 'accents', component: 'common' },
  { key: 'today', label: 'CALENDARIA.ThemeEditor.Colors.Today', category: 'accents', component: 'common' },
  { key: 'accent', label: 'CALENDARIA.ThemeEditor.Colors.Accent', category: 'accents', component: 'common' },
  { key: 'error', label: 'CALENDARIA.ThemeEditor.Colors.Error', category: 'accents', component: 'common' },
  { key: 'warning', label: 'CALENDARIA.ThemeEditor.Colors.Warning', category: 'accents', component: 'common' },
  { key: 'success', label: 'CALENDARIA.ThemeEditor.Colors.Success', category: 'accents', component: 'common' },
  { key: 'festivalBorder', label: 'CALENDARIA.ThemeEditor.Colors.FestivalBorder', category: 'festivals', component: 'common' },
  { key: 'festivalText', label: 'CALENDARIA.ThemeEditor.Colors.FestivalText', category: 'festivals', component: 'common' },
  { key: 'shadow', label: 'CALENDARIA.ThemeEditor.Colors.Shadow', category: 'effects', component: 'common' },
  { key: 'overlay', label: 'CALENDARIA.ThemeEditor.Colors.Overlay', category: 'effects', component: 'common' }
];

/**
 * Get color definitions grouped by category.
 * @returns {Object<string, Array>} - Colors grouped by category
 */
export function getColorsByCategory() {
  const grouped = {};
  for (const cat of Object.keys(COLOR_CATEGORIES)) grouped[cat] = [];
  for (const def of COLOR_DEFINITIONS) if (grouped[def.category]) grouped[def.category].push(def);
  return grouped;
}

/**
 * Get color definitions grouped by component.
 * @returns {Object<string, Array>} - Colors grouped by component
 */
export function getColorsByComponent() {
  const grouped = {};
  for (const comp of Object.keys(COMPONENT_CATEGORIES)) grouped[comp] = [];
  for (const def of COLOR_DEFINITIONS) if (grouped[def.component]) grouped[def.component].push(def);
  return grouped;
}

/**
 * Theme preset for import/export functionality.
 */
export class ThemePreset {
  /**
   * @param {string} name - Preset name
   * @param {Object<string, string>} colors - Color values
   */
  constructor(name, colors) {
    this.name = name;
    this.colors = { ...colors };
    this.version = 1;
    this.createdAt = Date.now();
  }

  /**
   * Export preset to JSON string.
   * @returns {string} - JSON string
   */
  toJSON() {
    return JSON.stringify({ name: this.name, colors: this.colors, version: this.version, createdAt: this.createdAt }, null, 2);
  }

  /**
   * Create preset from JSON string.
   * @param {string} json - JSON string
   * @returns {ThemePreset|null} - Preset or null if invalid
   */
  static fromJSON(json) {
    const data = JSON.parse(json);
    if (!data.name || !data.colors) return null;
    const preset = new ThemePreset(data.name, data.colors);
    preset.version = data.version || 1;
    preset.createdAt = data.createdAt || Date.now();
    return preset;
  }

  /**
   * Download preset as JSON file.
   */
  download() {
    const blob = new Blob([this.toJSON()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `calendaria-theme-${this.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Import preset from file input.
   * @param {File} file - JSON file
   * @returns {Promise<ThemePreset|null>} - Preset or null if invalid
   */
  static async fromFile(file) {
    const text = await file.text();
    return ThemePreset.fromJSON(text);
  }
}

/**
 * Convert hex color to RGB object.
 * @param {string} hex - Hex color string
 * @returns {{r: number, g: number, b: number}} - RGB values
 */
export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
}

/**
 * Convert RGB to hex color.
 * @param {number} r - Red (0-255)
 * @param {number} g - Green (0-255)
 * @param {number} b - Blue (0-255)
 * @returns {string} - Hex color
 */
export function rgbToHex(r, g, b) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${clamp(r).toString(16).padStart(2, '0')}${clamp(g).toString(16).padStart(2, '0')}${clamp(b).toString(16).padStart(2, '0')}`;
}

/**
 * Lighten a hex color by a percentage.
 * @param {string} hex - Hex color
 * @param {number} percent - Percentage to lighten (0-100)
 * @returns {string} - Lightened hex color
 */
export function lightenColor(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const factor = percent / 100;
  return rgbToHex(r + (255 - r) * factor, g + (255 - g) * factor, b + (255 - b) * factor);
}

/**
 * Darken a hex color by a percentage.
 * @param {string} hex - Hex color
 * @param {number} percent - Percentage to darken (0-100)
 * @returns {string} - Darkened hex color
 */
export function darkenColor(hex, percent) {
  const { r, g, b } = hexToRgb(hex);
  const factor = 1 - percent / 100;
  return rgbToHex(r * factor, g * factor, b * factor);
}

/**
 * Generate derived colors from base colors.
 * @param {Object<string, string>} colors - Base colors
 * @returns {Object<string, string>} - Derived CSS variable values
 */
export function generateDerivedColors(colors) {
  const derived = {};
  if (colors.today) {
    const { r, g, b } = hexToRgb(colors.today);
    derived['--calendaria-today-bg'] = `rgb(${r} ${g} ${b} / 20%)`;
    derived['--calendaria-current-hour'] = `rgb(${r} ${g} ${b} / 12%)`;
  }
  if (colors.primary) {
    const { r, g, b } = hexToRgb(colors.primary);
    derived['--calendaria-selected-bg'] = `rgb(${r} ${g} ${b} / 15%)`;
    derived['--calendaria-primary-hover'] = lightenColor(colors.primary, 10);
  }
  if (colors.festivalBorder) {
    const { r, g, b } = hexToRgb(colors.festivalBorder);
    derived['--calendaria-festival-bg'] = `rgb(${r} ${g} ${b} / 15%)`;
  }
  if (colors.shadow) {
    const { r, g, b } = hexToRgb(colors.shadow);
    derived['--calendaria-shadow'] = `rgb(${r} ${g} ${b} / 40%)`;
  }
  if (colors.overlay) {
    const { r, g, b } = hexToRgb(colors.overlay);
    derived['--calendaria-overlay'] = `rgb(${r} ${g} ${b} / 50%)`;
  }
  if (colors.bg && !colors.bgHover) derived['--calendaria-bg-hover'] = lightenColor(colors.bg, 8);
  if (colors.buttonBg) derived['--calendaria-button-hover'] = lightenColor(colors.buttonBg, 10);
  return derived;
}

/** @type {Object<string, string>} CSS variable mapping from color keys to CSS variable names. */
const CSS_VAR_MAP = {
  bg: '--calendaria-bg',
  bgLighter: '--calendaria-bg-lighter',
  bgHover: '--calendaria-bg-hover',
  border: '--calendaria-border',
  borderLight: '--calendaria-border-light',
  divider: '--calendaria-divider',
  error: '--calendaria-error',
  inputBg: '--calendaria-input-bg',
  text: '--calendaria-text',
  textDim: '--calendaria-text-dim',
  textHeading: '--calendaria-text-heading',
  textSecondary: '--calendaria-text-secondary',
  titleText: '--calendaria-title-text',
  weekdayHeader: '--calendaria-weekday-header',
  restDay: '--calendaria-rest-day',
  buttonBg: '--calendaria-button-bg',
  primary: '--calendaria-primary',
  today: '--calendaria-today',
  accent: '--calendaria-accent',
  success: '--calendaria-success',
  warning: '--calendaria-warning',
  festivalBorder: '--calendaria-festival-border',
  festivalText: '--calendaria-festival-text',
  shadow: '--calendaria-shadow-color',
  overlay: '--calendaria-overlay-color'
};

/** @type {string[]} Themed application classes — only these receive custom theme colors. */
const THEMED_APPS = [
  '.calendaria-hud',
  '.mini-cal',
  '.big-cal',
  '.chronicle',
  '.calendar-note-sheet',
  '.note-viewer',
  '.time-keeper',
  '.sun-dial',
  '.stopwatch',
  '.secondary-calendar',
  '.set-date-dialog'
];

/**
 * Apply custom colors to all themed Calendaria applications.
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
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) if (colors[key]) cssVars.push(`${cssVar}: ${colors[key]};`);
  const derived = generateDerivedColors(colors);
  for (const [cssVar, value] of Object.entries(derived)) cssVars.push(`${cssVar}: ${value};`);
  const selector = THEMED_APPS.map((cls) => `.calendaria${cls}`).join(',\n');
  styleEl.textContent = `${selector} {\n  ${cssVars.join('\n  ')}\n}`;
  const ids = ['calendaria-hud', 'calendaria-timekeeper', 'calendaria-mini-cal', 'calendaria-big-cal', 'calendaria-stopwatch'];
  for (const id of ids) foundry.applications.instances.get(id)?.render();
}

/**
 * Apply a preset theme by name.
 * @param {string} presetName - Preset name (dark, light, highContrast)
 */
export function applyPreset(presetName) {
  const preset = THEME_PRESETS[presetName];
  if (!preset) return;
  applyCustomColors(preset.colors);
  game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, preset.colors);
}

/**
 * Get current theme colors (merged with defaults).
 * @returns {Object<string, string>} - Current colors
 */
export function getCurrentColors() {
  const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
  return { ...DEFAULT_COLORS, ...customColors };
}

/**
 * Reset theme to defaults.
 */
export async function resetTheme() {
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, {});
  applyCustomColors(DEFAULT_COLORS);
}

/**
 * Initialize theme colors on module ready.
 * Checks for GM-forced theme first, then falls back to user preference.
 */
export function initializeTheme() {
  const forced = game.settings.get(MODULE.ID, SETTINGS.FORCE_THEME);
  if (forced && forced !== 'none') {
    if (forced === 'custom') {
      const forcedColors = game.settings.get(MODULE.ID, SETTINGS.FORCED_THEME_COLORS) || {};
      applyCustomColors({ ...DEFAULT_COLORS, ...forcedColors });
    } else if (THEME_PRESETS[forced]) {
      applyCustomColors(THEME_PRESETS[forced].colors);
    }
    return;
  }
  const themeMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE) || 'dark';
  if (themeMode === 'custom') {
    const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
    const colors = { ...DEFAULT_COLORS, ...customColors };
    applyCustomColors(colors);
  } else if (THEME_PRESETS[themeMode]) {
    applyCustomColors(THEME_PRESETS[themeMode].colors);
  }
}

/**
 * Check if a theme is currently being forced by the GM.
 * @returns {string|null} Forced theme name or null if not forced
 */
export function getForcedTheme() {
  const forced = game.settings.get(MODULE.ID, SETTINGS.FORCE_THEME);
  return forced && forced !== 'none' ? forced : null;
}
