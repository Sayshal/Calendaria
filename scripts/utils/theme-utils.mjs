/**
 * Theme utilities for Calendaria custom color theming.
 * Handles application and initialization of user-customized theme colors.
 * @module Utils/ThemeUtils
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';

/**
 * Default color values for Calendaria theme (Dark).
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
  accent: '#a89060',
  success: '#88cc88',
  festivalBorder: '#d4af37',
  festivalText: '#ffd700',
  shadow: '#000000',
  overlay: '#000000'
};

/**
 * Light theme preset colors.
 * @type {Object<string, string>}
 */
export const LIGHT_COLORS = {
  bg: '#f5f5f5',
  bgLighter: '#ffffff',
  bgHover: '#e8e8e8',
  border: '#d0d0d0',
  borderLight: '#e0e0e0',
  text: '#2c2c2c',
  textDim: '#666666',
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
  success: '#228822',
  festivalBorder: '#b89527',
  festivalText: '#8b7000',
  shadow: '#000000',
  overlay: '#000000'
};

/**
 * High contrast theme preset colors.
 * @type {Object<string, string>}
 */
export const HIGH_CONTRAST_COLORS = {
  bg: '#000000',
  bgLighter: '#1a1a1a',
  bgHover: '#333333',
  border: '#ffffff',
  borderLight: '#cccccc',
  text: '#ffffff',
  textDim: '#cccccc',
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
  success: '#00ff88',
  festivalBorder: '#ffdd00',
  festivalText: '#ffee00',
  shadow: '#000000',
  overlay: '#000000'
};

/**
 * All bundled theme presets.
 * @type {Object<string, {name: string, colors: Object<string, string>}>}
 */
export const THEME_PRESETS = {
  dark: { name: 'CALENDARIA.ThemeEditor.Presets.Dark', colors: DEFAULT_COLORS },
  highContrast: { name: 'CALENDARIA.ThemeEditor.Presets.HighContrast', colors: HIGH_CONTRAST_COLORS }
};

/**
 * Color categories with labels.
 * @type {Object<string, string>}
 */
export const COLOR_CATEGORIES = {
  backgrounds: 'CALENDARIA.ThemeEditor.Category.Backgrounds',
  borders: 'CALENDARIA.ThemeEditor.Category.Borders',
  text: 'CALENDARIA.ThemeEditor.Category.Text',
  buttons: 'CALENDARIA.ThemeEditor.Category.Buttons',
  accents: 'CALENDARIA.ThemeEditor.Category.Accents',
  festivals: 'CALENDARIA.ThemeEditor.Category.Festivals',
  effects: 'CALENDARIA.ThemeEditor.Category.Effects'
};

/**
 * HUD component categories with labels.
 * @type {Object<string, string>}
 */
export const COMPONENT_CATEGORIES = {
  common: 'CALENDARIA.ThemeEditor.Component.Common',
  domeHud: 'CALENDARIA.ThemeEditor.Component.DomeHud',
  timeKeeper: 'CALENDARIA.ThemeEditor.Component.TimeKeeper',
  miniCal: 'CALENDARIA.ThemeEditor.Component.MiniCal'
};

/**
 * Color variable definitions with display names and categories.
 * Organized by element type and component.
 * @type {Array<{key: string, label: string, category: string, component: string}>}
 */
export const COLOR_DEFINITIONS = [
  { key: 'bg', label: 'CALENDARIA.ThemeEditor.Colors.Background', category: 'backgrounds', component: 'common' },
  { key: 'bgLighter', label: 'CALENDARIA.ThemeEditor.Colors.BackgroundLighter', category: 'backgrounds', component: 'common' },
  { key: 'bgHover', label: 'CALENDARIA.ThemeEditor.Colors.BackgroundHover', category: 'backgrounds', component: 'common' },
  { key: 'border', label: 'CALENDARIA.ThemeEditor.Colors.Border', category: 'borders', component: 'common' },
  { key: 'borderLight', label: 'CALENDARIA.ThemeEditor.Colors.BorderLight', category: 'borders', component: 'common' },
  { key: 'text', label: 'CALENDARIA.ThemeEditor.Colors.Text', category: 'text', component: 'common' },
  { key: 'textDim', label: 'CALENDARIA.ThemeEditor.Colors.TextDim', category: 'text', component: 'common' },
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

  // Today variations
  if (colors.today) {
    const { r, g, b } = hexToRgb(colors.today);
    derived['--calendaria-today-bg'] = `rgb(${r} ${g} ${b} / 20%)`;
    derived['--calendaria-current-hour'] = `rgb(${r} ${g} ${b} / 12%)`;
  }

  // Primary variations
  if (colors.primary) {
    const { r, g, b } = hexToRgb(colors.primary);
    derived['--calendaria-selected-bg'] = `rgb(${r} ${g} ${b} / 15%)`;
    derived['--calendaria-primary-hover'] = lightenColor(colors.primary, 10);
  }

  // Festival variations
  if (colors.festivalBorder) {
    const { r, g, b } = hexToRgb(colors.festivalBorder);
    derived['--calendaria-festival-bg'] = `rgb(${r} ${g} ${b} / 15%)`;
  }

  // Shadow/overlay variations
  if (colors.shadow) {
    const { r, g, b } = hexToRgb(colors.shadow);
    derived['--calendaria-shadow'] = `rgb(${r} ${g} ${b} / 40%)`;
    derived['--calendaria-event-shadow'] = `rgb(${r} ${g} ${b} / 20%)`;
  }
  if (colors.overlay) {
    const { r, g, b } = hexToRgb(colors.overlay);
    derived['--calendaria-overlay'] = `rgb(${r} ${g} ${b} / 50%)`;
  }

  // Background hover (auto-generate if not set)
  if (colors.bg && !colors.bgHover) {
    derived['--calendaria-bg-hover'] = lightenColor(colors.bg, 8);
  }

  // Button hover
  if (colors.buttonBg) {
    derived['--calendaria-button-hover'] = lightenColor(colors.buttonBg, 10);
  }

  return derived;
}

/**
 * CSS variable mapping from color keys to CSS variable names.
 * @type {Object<string, string>}
 */
const CSS_VAR_MAP = {
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
  accent: '--calendaria-accent',
  success: '--calendaria-success',
  festivalBorder: '--calendaria-festival-border',
  festivalText: '--calendaria-festival-text',
  shadow: '--calendaria-shadow-color',
  overlay: '--calendaria-overlay-color'
};

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
  for (const [key, cssVar] of Object.entries(CSS_VAR_MAP)) if (colors[key]) cssVars.push(`${cssVar}: ${colors[key]};`);
  const derived = generateDerivedColors(colors);
  for (const [cssVar, value] of Object.entries(derived)) cssVars.push(`${cssVar}: ${value};`);
  styleEl.textContent = `.calendaria {\n  ${cssVars.join('\n  ')}\n}`;
  const ids = ['calendaria-hud', 'time-keeper', 'mini-calendar', 'calendaria-big-cal', 'calendaria-stopwatch'];
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
 */
export function initializeTheme() {
  const themeMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE) || 'dark';

  if (themeMode === 'custom') {
    const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
    const colors = { ...DEFAULT_COLORS, ...customColors };
    applyCustomColors(colors);
  } else if (THEME_PRESETS[themeMode]) {
    applyCustomColors(THEME_PRESETS[themeMode].colors);
  }
}
