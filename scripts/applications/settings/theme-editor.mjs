/**
 * Theme Editor Application
 * A UI for customizing Calendaria's color scheme.
 *
 * @module Applications/Settings/ThemeEditor
 * @author Tyler
 */

import { MODULE, SETTINGS, TEMPLATES } from '../../constants.mjs';
import { log } from '../../utils/logger.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Default color values for Calendaria.
 * @type {Object<string, string>}
 */
const DEFAULT_COLORS = {
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
const COLOR_DEFINITIONS = [
  // Backgrounds
  { key: 'bg', label: 'CALENDARIA.ThemeEditor.Colors.Background', category: 'backgrounds' },
  { key: 'bgLighter', label: 'CALENDARIA.ThemeEditor.Colors.BackgroundLighter', category: 'backgrounds' },
  { key: 'bgHover', label: 'CALENDARIA.ThemeEditor.Colors.BackgroundHover', category: 'backgrounds' },
  // Borders
  { key: 'border', label: 'CALENDARIA.ThemeEditor.Colors.Border', category: 'borders' },
  { key: 'borderLight', label: 'CALENDARIA.ThemeEditor.Colors.BorderLight', category: 'borders' },
  // Text
  { key: 'text', label: 'CALENDARIA.ThemeEditor.Colors.Text', category: 'text' },
  { key: 'textDim', label: 'CALENDARIA.ThemeEditor.Colors.TextDim', category: 'text' },
  { key: 'titleText', label: 'CALENDARIA.ThemeEditor.Colors.TitleText', category: 'text' },
  { key: 'weekdayHeader', label: 'CALENDARIA.ThemeEditor.Colors.WeekdayHeader', category: 'text' },
  { key: 'dayNumber', label: 'CALENDARIA.ThemeEditor.Colors.DayNumber', category: 'text' },
  // Buttons
  { key: 'buttonBg', label: 'CALENDARIA.ThemeEditor.Colors.ButtonBackground', category: 'buttons' },
  { key: 'buttonText', label: 'CALENDARIA.ThemeEditor.Colors.ButtonText', category: 'buttons' },
  { key: 'buttonBorder', label: 'CALENDARIA.ThemeEditor.Colors.ButtonBorder', category: 'buttons' },
  // Accents
  { key: 'primary', label: 'CALENDARIA.ThemeEditor.Colors.Primary', category: 'accents' },
  { key: 'today', label: 'CALENDARIA.ThemeEditor.Colors.Today', category: 'accents' },
  // Festivals
  { key: 'festivalBorder', label: 'CALENDARIA.ThemeEditor.Colors.FestivalBorder', category: 'festivals' },
  { key: 'festivalText', label: 'CALENDARIA.ThemeEditor.Colors.FestivalText', category: 'festivals' }
];

/**
 * Theme Editor Application for customizing Calendaria's appearance.
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class ThemeEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-theme-editor',
    classes: ['calendaria', 'theme-editor', 'standard-form'],
    tag: 'form',
    window: {
      icon: 'fas fa-palette',
      resizable: true,
      title: 'CALENDARIA.ThemeEditor.Title'
    },
    position: { width: 'auto', height: 'auto' },
    form: {
      handler: ThemeEditor.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      resetColor: ThemeEditor.#onResetColor,
      resetAllColors: ThemeEditor.#onResetAllColors,
      exportTheme: ThemeEditor.#onExportTheme,
      importTheme: ThemeEditor.#onImportTheme
    }
  };

  /** @override */
  static PARTS = {
    form: { template: TEMPLATES.SETTINGS.THEME_EDITOR, scrollable: [''] },
    footer: { template: TEMPLATES.FORM_FOOTER }
  };

  /**
   * Current working color values.
   * @type {Object<string, string>}
   */
  #colorValues = {};

  /* -------------------------------------------- */

  constructor(options = {}) {
    super(options);
    this.#loadCurrentColors();
  }

  /* -------------------------------------------- */

  /**
   * Load current color values from settings.
   * @private
   */
  #loadCurrentColors() {
    const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
    this.#colorValues = { ...DEFAULT_COLORS, ...customColors };
  }

  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};

    // Group colors by category
    const categories = {
      backgrounds: { label: 'CALENDARIA.ThemeEditor.Category.Backgrounds', colors: [] },
      borders: { label: 'CALENDARIA.ThemeEditor.Category.Borders', colors: [] },
      text: { label: 'CALENDARIA.ThemeEditor.Category.Text', colors: [] },
      buttons: { label: 'CALENDARIA.ThemeEditor.Category.Buttons', colors: [] },
      accents: { label: 'CALENDARIA.ThemeEditor.Category.Accents', colors: [] },
      festivals: { label: 'CALENDARIA.ThemeEditor.Category.Festivals', colors: [] }
    };

    for (const def of COLOR_DEFINITIONS) {
      const value = this.#colorValues[def.key] || DEFAULT_COLORS[def.key];
      const isCustom = customColors[def.key] !== undefined;
      categories[def.category].colors.push({ key: def.key, label: def.label, value, defaultValue: DEFAULT_COLORS[def.key], isCustom });
    }

    context.categories = Object.values(categories);

    // Footer buttons
    context.buttons = [
      { type: 'submit', icon: 'fas fa-save', label: 'CALENDARIA.ThemeEditor.Save' },
      { type: 'button', action: 'resetAllColors', icon: 'fas fa-undo', label: 'CALENDARIA.ThemeEditor.ResetAll' },
      { type: 'button', action: 'exportTheme', icon: 'fas fa-download', label: 'CALENDARIA.ThemeEditor.Export' },
      { type: 'button', action: 'importTheme', icon: 'fas fa-upload', label: 'CALENDARIA.ThemeEditor.Import' }
    ];

    return context;
  }

  /**
   * Add color input listeners after render.
   * @param {ApplicationRenderContext} context - Render context
   * @param {RenderOptions} options - Render options
   * @protected
   */
  _onRender(context, options) {
    super._onRender?.(context, options);

    // Add color input listeners for live preview
    const colorInputs = this.element.querySelectorAll('input[type="color"]');
    for (const input of colorInputs) input.addEventListener('input', this.#onColorInputChange.bind(this));
  }

  /**
   * Handle live color input changes.
   * @param {Event} event - Input event
   * @private
   */
  #onColorInputChange(event) {
    const input = event.target;
    const key = input.name.replace('colors.', '');
    const value = input.value;

    // Update local state
    this.#colorValues[key] = value;

    // Update the hex text input next to the color picker
    const hexInput = input.closest('.color-fields')?.querySelector('.color-hex');
    if (hexInput) hexInput.value = value;

    // Apply live preview to all calendaria elements
    ThemeEditor.applyCustomColors(this.#colorValues);
  }

  /* -------------------------------------------- */
  /*  Form Handling                               */
  /* -------------------------------------------- */

  /**
   * Handle form submission.
   * @param {Event} event - Form submit event
   * @param {HTMLFormElement} form - The form element
   * @param {FormDataExtended} formData - Processed form data
   */
  static async #onSubmit(event, form, formData) {
    const data = formData.object;

    // Extract color values from form data
    const customColors = {};

    for (const def of COLOR_DEFINITIONS) {
      const key = `colors.${def.key}`;
      if (data[key] && data[key] !== DEFAULT_COLORS[def.key]) {
        customColors[def.key] = data[key];
        this.#colorValues[def.key] = data[key];
      }
    }

    // Save custom colors
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, customColors);

    // Apply colors globally
    ThemeEditor.applyCustomColors(this.#colorValues);

    log(3, 'Theme colors saved');
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Reset a single color to default.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onResetColor(event, target) {
    const key = target.dataset.key;

    // Update local state
    this.#colorValues[key] = DEFAULT_COLORS[key];

    // Remove from custom colors
    const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
    delete customColors[key];
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, customColors);

    // Apply and re-render
    ThemeEditor.applyCustomColors(this.#colorValues);
    this.render();
  }

  /**
   * Reset all colors to defaults.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onResetAllColors(event, target) {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: game.i18n.localize('CALENDARIA.ThemeEditor.ResetAll') },
      content: `<p>${game.i18n.localize('CALENDARIA.ThemeEditor.ConfirmResetAll')}</p>`,
      yes: { label: game.i18n.localize('CALENDARIA.ThemeEditor.ResetAll'), icon: 'fas fa-undo' },
      no: { label: game.i18n.localize('CALENDARIA.UI.Cancel'), icon: 'fas fa-times' }
    });

    if (confirmed) {
      // Clear custom colors
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, {});

      // Reset to defaults
      this.#colorValues = { ...DEFAULT_COLORS };
      ThemeEditor.applyCustomColors(this.#colorValues);

      ui.notifications.info(game.i18n.localize('CALENDARIA.ThemeEditor.ColorsReset'));
      this.render();
    }
  }

  /**
   * Export current theme as JSON.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onExportTheme(event, target) {
    const exportData = {
      colors: { ...this.#colorValues },
      version: game.modules.get(MODULE.ID)?.version || '1.0.0'
    };

    const filename = `calendaria-theme-${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    ui.notifications.info(game.i18n.localize('CALENDARIA.ThemeEditor.ExportSuccess'));
  }

  /**
   * Import theme from JSON file.
   * @param {Event} event - Click event
   * @param {HTMLElement} target - Target element
   */
  static async #onImportTheme(event, target) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      try {
        const text = await file.text();
        const importData = JSON.parse(text);

        if (!importData.colors) throw new Error('Invalid theme file format');

        // Calculate which colors differ from defaults
        const customColors = {};
        for (const [key, value] of Object.entries(importData.colors)) if (DEFAULT_COLORS[key] !== value) customColors[key] = value;

        await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, customColors);
        this.#colorValues = { ...DEFAULT_COLORS, ...customColors };

        ThemeEditor.applyCustomColors(this.#colorValues);
        ui.notifications.info(game.i18n.localize('CALENDARIA.ThemeEditor.ImportSuccess'));
        this.render();
      } catch (err) {
        log(2, 'Theme import failed:', err);
        ui.notifications.error(game.i18n.localize('CALENDARIA.ThemeEditor.ImportError'));
      }
    });

    input.click();
  }

  /* -------------------------------------------- */
  /*  Static API                                  */
  /* -------------------------------------------- */

  /**
   * Apply custom colors to all Calendaria elements.
   * @param {Object<string, string>} colors - Color values to apply
   */
  static applyCustomColors(colors) {
    // Create or update style element
    let styleEl = document.getElementById('calendaria-custom-theme');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'calendaria-custom-theme';
      document.head.appendChild(styleEl);
    }

    // Build CSS variables
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
      buttonBg: '--calendaria-button-bg',
      buttonText: '--calendaria-button-text',
      buttonBorder: '--calendaria-button-border',
      primary: '--calendaria-primary',
      today: '--calendaria-today',
      festivalBorder: '--calendaria-festival-border',
      festivalText: '--calendaria-festival-text'
    };

    for (const [key, cssVar] of Object.entries(varMap)) if (colors[key]) cssVars.push(`${cssVar}: ${colors[key]};`);

    // Derive semi-transparent variants from base colors
    const hexToRgb = (hex) => {
      const h = hex.replace('#', '');
      return {
        r: parseInt(h.substring(0, 2), 16),
        g: parseInt(h.substring(2, 4), 16),
        b: parseInt(h.substring(4, 6), 16)
      };
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

    // Apply to .calendaria elements
    styleEl.textContent = `.calendaria {${cssVars.join('\n        ')}}`;

    // Re-render open calendar windows
    for (const app of foundry.applications.instances.values()) if (app.constructor.name.includes('Calendar')) app.render();
  }

  /**
   * Initialize custom colors on module ready.
   * Called from main module initialization.
   */
  static initialize() {
    const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};

    if (Object.keys(customColors).length > 0) {
      const colors = { ...DEFAULT_COLORS, ...customColors };
      ThemeEditor.applyCustomColors(colors);
    }
  }
}
