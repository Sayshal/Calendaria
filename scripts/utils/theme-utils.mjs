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
  bg: '#c8aa78',
  bgLighter: '#e0cca0',
  bgHover: '#b89868',
  border: '#9a7840',
  borderLight: '#b09058',
  divider: '#907030',
  inputBg: '#d8c090',
  text: '#3c2415',
  textDim: '#8a7460',
  textHeading: '#5c3a1e',
  textSecondary: '#6b4f3a',
  titleText: '#5c3a1e',
  weekdayHeader: '#3c2415',
  dayNumber: '#3c2415',
  restDay: '#7a6040',
  buttonBg: '#d4ba88',
  buttonText: '#3c2415',
  buttonBorder: '#b89050',
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
  textHeading: '#e8d090',
  textSecondary: '#9988c0',
  titleText: '#e8d090',
  weekdayHeader: '#c8b8e8',
  dayNumber: '#c8b8e8',
  restDay: '#9988c0',
  buttonBg: '#2e1e55',
  buttonText: '#c8b8e8',
  buttonBorder: '#4a3580',
  primary: '#c8a848',
  today: '#d4b040',
  accent: '#b89838',
  error: '#ff5555',
  warning: '#e8a040',
  success: '#66bb88',
  festivalBorder: '#d4b040',
  festivalText: '#e0c060',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Verdant theme preset colors. */
export const VERDANT_COLORS = {
  bg: '#0f1f0f',
  bgLighter: '#1a2e1a',
  bgHover: '#2a4030',
  border: '#3a5a3a',
  borderLight: '#4a6a4a',
  divider: '#3a5a3a',
  inputBg: '#152515',
  text: '#c8dcc8',
  textDim: '#6a8a6a',
  textHeading: '#d4e8b0',
  textSecondary: '#8aaa8a',
  titleText: '#d4e8b0',
  weekdayHeader: '#c8dcc8',
  dayNumber: '#c8dcc8',
  restDay: '#8aaa8a',
  buttonBg: '#1e3420',
  buttonText: '#c8dcc8',
  buttonBorder: '#3a5a3a',
  primary: '#66bb66',
  today: '#d4a017',
  accent: '#d4a017',
  error: '#e05555',
  warning: '#e8b84d',
  success: '#55cc55',
  festivalBorder: '#d4a017',
  festivalText: '#ffd700',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Infernal theme preset colors. */
export const INFERNAL_COLORS = {
  bg: '#1a0a0a',
  bgLighter: '#2a1515',
  bgHover: '#3d2020',
  border: '#5a2020',
  borderLight: '#6a3030',
  divider: '#5a2020',
  inputBg: '#201010',
  text: '#e0c0b8',
  textDim: '#8a5550',
  textHeading: '#ff8866',
  textSecondary: '#b08070',
  titleText: '#ff8866',
  weekdayHeader: '#e0c0b8',
  dayNumber: '#e0c0b8',
  restDay: '#b08070',
  buttonBg: '#351818',
  buttonText: '#e0c0b8',
  buttonBorder: '#5a2020',
  primary: '#e04030',
  today: '#ff6600',
  accent: '#ff8844',
  error: '#ff4444',
  warning: '#ffaa00',
  success: '#66aa55',
  festivalBorder: '#ff6600',
  festivalText: '#ff8844',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Frost theme preset colors. */
export const FROST_COLORS = {
  bg: '#a8c4d8',
  bgLighter: '#c4dae8',
  bgHover: '#98b4c8',
  border: '#6890a8',
  borderLight: '#80a8c0',
  divider: '#5880a0',
  inputBg: '#b8d0e0',
  text: '#0e1e2a',
  textDim: '#3a5a70',
  textHeading: '#081828',
  textSecondary: '#284860',
  titleText: '#081828',
  weekdayHeader: '#0e1e2a',
  dayNumber: '#0e1e2a',
  restDay: '#3a5a70',
  buttonBg: '#98b8cc',
  buttonText: '#0e1e2a',
  buttonBorder: '#6890a8',
  primary: '#2070a8',
  today: '#1868a0',
  accent: '#3080b0',
  error: '#b83030',
  warning: '#b08020',
  success: '#287848',
  festivalBorder: '#1868a0',
  festivalText: '#105888',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Steampunk theme preset colors. */
export const STEAMPUNK_COLORS = {
  bg: '#1c1410',
  bgLighter: '#2a2018',
  bgHover: '#3a3025',
  border: '#6a5030',
  borderLight: '#7a6040',
  divider: '#5a4428',
  inputBg: '#221a14',
  text: '#d4c4a8',
  textDim: '#8a7860',
  textHeading: '#e8c878',
  textSecondary: '#b0a080',
  titleText: '#e8c878',
  weekdayHeader: '#d4c4a8',
  dayNumber: '#d4c4a8',
  restDay: '#b0a080',
  buttonBg: '#30261c',
  buttonText: '#d4c4a8',
  buttonBorder: '#6a5030',
  primary: '#cd8032',
  today: '#e09030',
  accent: '#b87333',
  error: '#cc4040',
  warning: '#e8a030',
  success: '#5a9050',
  festivalBorder: '#cd8032',
  festivalText: '#e8a040',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Neon theme preset colors. */
export const NEON_COLORS = {
  bg: '#050505',
  bgLighter: '#111111',
  bgHover: '#1a1a1a',
  border: '#00ddff',
  borderLight: '#00aacc',
  divider: '#ff44aa',
  inputBg: '#0a0a0a',
  text: '#f0f0f0',
  textDim: '#00cc99',
  textHeading: '#ff44aa',
  textSecondary: '#00ddff',
  titleText: '#ff44aa',
  weekdayHeader: '#00ddff',
  dayNumber: '#f0f0f0',
  restDay: '#00cc99',
  buttonBg: '#1a1a1a',
  buttonText: '#00ddff',
  buttonBorder: '#ff44aa',
  primary: '#00ddff',
  today: '#ff44aa',
  accent: '#00ff88',
  error: '#ff3366',
  warning: '#ffcc00',
  success: '#00ff88',
  festivalBorder: '#ffcc00',
  festivalText: '#00ff88',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Minimalist theme preset colors. */
export const MINIMALIST_COLORS = {
  bg: '#ffffff',
  bgLighter: '#f5f5f5',
  bgHover: '#e8e8e8',
  border: '#1a1a1a',
  borderLight: '#cccccc',
  divider: '#1a1a1a',
  inputBg: '#f5f5f5',
  text: '#1a1a1a',
  textDim: '#666666',
  textHeading: '#000000',
  textSecondary: '#444444',
  titleText: '#000000',
  weekdayHeader: '#1a1a1a',
  dayNumber: '#1a1a1a',
  restDay: '#888888',
  buttonBg: '#f0f0f0',
  buttonText: '#1a1a1a',
  buttonBorder: '#1a1a1a',
  primary: '#dd0000',
  today: '#dd0000',
  accent: '#dd0000',
  error: '#dd0000',
  warning: '#dd8800',
  success: '#008844',
  festivalBorder: '#dd0000',
  festivalText: '#aa0000',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Solarized theme preset colors. */
export const SOLARIZED_COLORS = {
  bg: '#002b36',
  bgLighter: '#073642',
  bgHover: '#0a4050',
  border: '#586e75',
  borderLight: '#657b83',
  divider: '#586e75',
  inputBg: '#073642',
  text: '#839496',
  textDim: '#586e75',
  textHeading: '#93a1a1',
  textSecondary: '#657b83',
  titleText: '#eee8d5',
  weekdayHeader: '#839496',
  dayNumber: '#839496',
  restDay: '#657b83',
  buttonBg: '#073642',
  buttonText: '#839496',
  buttonBorder: '#586e75',
  primary: '#268bd2',
  today: '#cb4b16',
  accent: '#2aa198',
  error: '#dc322f',
  warning: '#b58900',
  success: '#859900',
  festivalBorder: '#d33682',
  festivalText: '#6c71c4',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Royal theme preset colors. */
export const ROYAL_COLORS = {
  bg: '#0a0e1a',
  bgLighter: '#121830',
  bgHover: '#1a2240',
  border: '#2a3050',
  borderLight: '#3a4060',
  divider: '#2a3050',
  inputBg: '#0e1220',
  text: '#d0c8b0',
  textDim: '#706848',
  textHeading: '#f0d060',
  textSecondary: '#a09878',
  titleText: '#f0d060',
  weekdayHeader: '#d0c8b0',
  dayNumber: '#d0c8b0',
  restDay: '#8090a8',
  buttonBg: '#161e38',
  buttonText: '#d0c8b0',
  buttonBorder: '#2a3050',
  primary: '#d4a830',
  today: '#cc2222',
  accent: '#c09030',
  error: '#cc3333',
  warning: '#e0a030',
  success: '#408848',
  festivalBorder: '#d4a830',
  festivalText: '#f0c848',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Sakura theme preset colors. */
export const SAKURA_COLORS = {
  bg: '#4a2838',
  bgLighter: '#6a4458',
  bgHover: '#5a3448',
  border: '#8a5c70',
  borderLight: '#9a6c80',
  divider: '#7a5060',
  inputBg: '#402030',
  text: '#f2dce4',
  textDim: '#b08898',
  textHeading: '#ffeef4',
  textSecondary: '#d0a8b4',
  titleText: '#ffeef4',
  weekdayHeader: '#f2dce4',
  dayNumber: '#f2dce4',
  restDay: '#d0a8b4',
  buttonBg: '#6a4458',
  buttonText: '#f2dce4',
  buttonBorder: '#8a5c70',
  primary: '#f06888',
  today: '#ff5080',
  accent: '#e06080',
  error: '#e04848',
  warning: '#daa050',
  success: '#60a868',
  festivalBorder: '#ff5080',
  festivalText: '#f88898',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, string>} Slate theme preset colors. */
export const SLATE_COLORS = {
  bg: '#2b3d35',
  bgLighter: '#344840',
  bgHover: '#3e5448',
  border: '#4a6050',
  borderLight: '#546a5a',
  divider: '#44584c',
  inputBg: '#304038',
  text: '#dedad0',
  textDim: '#8a9888',
  textHeading: '#ece8dc',
  textSecondary: '#aab4a4',
  titleText: '#ece8dc',
  weekdayHeader: '#dedad0',
  dayNumber: '#dedad0',
  restDay: '#aab4a4',
  buttonBg: '#384e42',
  buttonText: '#dedad0',
  buttonBorder: '#4a6050',
  primary: '#d0c8a8',
  today: '#ecc850',
  accent: '#c0b898',
  error: '#d86050',
  warning: '#dab850',
  success: '#80b070',
  festivalBorder: '#ecc850',
  festivalText: '#daba48',
  shadow: '#000000',
  overlay: '#000000'
};

/** @type {Object<string, {name: string, colors: Object<string, string>}>} All bundled theme presets. */
export const THEME_PRESETS = {
  dark: { name: 'CALENDARIA.ThemeEditor.Presets.Dark', colors: DEFAULT_COLORS },
  light: { name: 'CALENDARIA.ThemeEditor.Presets.Light', colors: LIGHT_COLORS },
  highContrast: { name: 'CALENDARIA.ThemeEditor.Presets.HighContrast', colors: HIGH_CONTRAST_COLORS },
  parchment: { name: 'CALENDARIA.ThemeEditor.Presets.Parchment', colors: PARCHMENT_COLORS },
  arcane: { name: 'CALENDARIA.ThemeEditor.Presets.Arcane', colors: ARCANE_COLORS },
  verdant: { name: 'CALENDARIA.ThemeEditor.Presets.Verdant', colors: VERDANT_COLORS },
  infernal: { name: 'CALENDARIA.ThemeEditor.Presets.Infernal', colors: INFERNAL_COLORS },
  frost: { name: 'CALENDARIA.ThemeEditor.Presets.Frost', colors: FROST_COLORS },
  steampunk: { name: 'CALENDARIA.ThemeEditor.Presets.Steampunk', colors: STEAMPUNK_COLORS },
  neon: { name: 'CALENDARIA.ThemeEditor.Presets.Neon', colors: NEON_COLORS },
  minimalist: { name: 'CALENDARIA.ThemeEditor.Presets.Minimalist', colors: MINIMALIST_COLORS },
  solarized: { name: 'CALENDARIA.ThemeEditor.Presets.Solarized', colors: SOLARIZED_COLORS },
  royal: { name: 'CALENDARIA.ThemeEditor.Presets.Royal', colors: ROYAL_COLORS },
  sakura: { name: 'CALENDARIA.ThemeEditor.Presets.Sakura', colors: SAKURA_COLORS },
  slate: { name: 'CALENDARIA.ThemeEditor.Presets.Slate', colors: SLATE_COLORS }
};

/** @type {Object<string, string>} Color categories with labels. */
export const COLOR_CATEGORIES = {
  backgrounds: 'CALENDARIA.ThemeEditor.Category.Backgrounds',
  borders: 'CALENDARIA.ThemeEditor.Category.Borders',
  text: 'CALENDARIA.ThemeEditor.Category.Text',
  buttons: 'CALENDARIA.ThemeEditor.Category.Buttons',
  accents: 'CALENDARIA.ThemeEditor.Category.Accents',
  festivals: 'CALENDARIA.Common.Festivals',
  effects: 'CALENDARIA.ThemeEditor.Category.Effects'
};

/** @type {Object<string, string>} HUD component categories with labels. */
export const COMPONENT_CATEGORIES = {
  common: 'CALENDARIA.ThemeEditor.Component.Common',
  domeHud: 'CALENDARIA.ThemeEditor.Component.DomeHud',
  timeKeeper: 'CALENDARIA.Common.TimeKeeper',
  miniCal: 'CALENDARIA.Common.MiniCal'
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
  '.set-date-dialog',
  '.calendaria-cinematic'
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
 * Check if a theme key is a user-created custom theme.
 * @param {string} key - Theme key
 * @returns {boolean} True if the key identifies a custom theme
 */
export function isCustomThemeKey(key) {
  return !!key && key.startsWith('custom_') && !THEME_PRESETS[key];
}

/**
 * Get all user-created custom themes.
 * @returns {Object<string, {name: string, basePreset: string, colors: object}>} Custom theme map
 */
export function getCustomThemes() {
  return game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
}

/**
 * Get a single custom theme entry.
 * @param {string} key - Custom theme key
 * @returns {{name: string, basePreset: string, colors: object}|null} Theme entry or null
 */
export function getCustomTheme(key) {
  return getCustomThemes()[key] || null;
}

/**
 * Resolve full colors for any theme key (built-in or custom).
 * @param {string} key - Theme key
 * @returns {Object<string, string>} Full color object
 */
export function getColorsForTheme(key) {
  if (THEME_PRESETS[key]) return { ...THEME_PRESETS[key].colors };
  if (isCustomThemeKey(key)) {
    const custom = getCustomTheme(key);
    if (custom) {
      const base = THEME_PRESETS[custom.basePreset]?.colors || DEFAULT_COLORS;
      return { ...base, ...custom.colors };
    }
  }
  return { ...DEFAULT_COLORS };
}

/**
 * Create a new custom theme seeded from a preset.
 * @param {string} basePresetKey - Built-in preset key to base from
 * @returns {{key: string, entry: {name: string, basePreset: string, colors: object}}} New theme key and entry
 */
export function createCustomTheme(basePresetKey) {
  const themes = getCustomThemes();
  const presetName = THEME_PRESETS[basePresetKey] ? game.i18n.localize(THEME_PRESETS[basePresetKey].name) : basePresetKey;
  let n = 1;
  const prefix = `custom_${basePresetKey}_`;
  while (themes[`${prefix}${n}`]) n++;
  const key = `${prefix}${n}`;
  const entry = { name: `Custom ${presetName} #${n}`, basePreset: basePresetKey, colors: {} };
  return { key, entry };
}

/**
 * Delete a custom theme. Falls back to 'dark' if the deleted theme was active.
 * @param {string} key - Custom theme key to delete
 */
export async function deleteCustomTheme(key) {
  const themes = getCustomThemes();
  delete themes[key];
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, themes);
  if (game.settings.get(MODULE.ID, SETTINGS.THEME_MODE) === key) {
    await game.settings.set(MODULE.ID, SETTINGS.THEME_MODE, 'dark');
    applyCustomColors(THEME_PRESETS.dark.colors);
  }
}

/**
 * Save color overrides for a custom theme.
 * @param {string} themeKey - Custom theme key
 * @param {object} overrides - Color overrides (only keys that differ from base)
 */
export async function saveCustomThemeColors(themeKey, overrides) {
  const themes = getCustomThemes();
  if (!themes[themeKey]) return;
  themes[themeKey].colors = overrides;
  await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, themes);
}

/**
 * Apply a preset theme by name (visual only, no save).
 * @param {string} presetName - Preset name
 */
export function applyPreset(presetName) {
  const colors = getColorsForTheme(presetName);
  applyCustomColors(colors);
}

/**
 * Get current theme colors.
 * @returns {Object<string, string>} Full resolved colors
 */
export function getCurrentColors() {
  const themeMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE) || 'dark';
  return getColorsForTheme(themeMode);
}

/**
 * Reset the active custom theme's overrides, or re-apply a built-in preset.
 */
export async function resetTheme() {
  const themeMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE) || 'dark';
  if (isCustomThemeKey(themeMode)) {
    const themes = getCustomThemes();
    if (themes[themeMode]) {
      themes[themeMode].colors = {};
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, themes);
    }
  }
  applyCustomColors(getColorsForTheme(themeMode));
}

/**
 * Initialize theme colors on module ready.
 * Checks for GM-forced theme first, then falls back to user preference.
 */
export function initializeTheme() {
  const forced = game.settings.get(MODULE.ID, SETTINGS.FORCE_THEME);
  if (forced && forced !== 'none') {
    if (forced === 'custom' || isCustomThemeKey(forced)) {
      const forcedColors = game.settings.get(MODULE.ID, SETTINGS.FORCED_THEME_COLORS) || {};
      applyCustomColors({ ...DEFAULT_COLORS, ...forcedColors });
    } else if (THEME_PRESETS[forced]) {
      applyCustomColors(THEME_PRESETS[forced].colors);
    }
    return;
  }
  let themeMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE) || 'dark';
  if (themeMode === 'custom') {
    themeMode = 'dark';
    game.settings.set(MODULE.ID, SETTINGS.THEME_MODE, 'dark');
  }
  applyCustomColors(getColorsForTheme(themeMode));
}

/**
 * Check if a theme is currently being forced by the GM.
 * @returns {string|null} Forced theme name or null if not forced
 */
export function getForcedTheme() {
  const forced = game.settings.get(MODULE.ID, SETTINGS.FORCE_THEME);
  return forced && forced !== 'none' ? forced : null;
}
