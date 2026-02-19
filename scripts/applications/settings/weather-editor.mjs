/**
 * Weather Editor — Unified editor for built-in and custom weather types.
 * Mirrors SettingsPanel's sidebar+tabs layout with weather types as dynamic tab entries.
 * Each weather type is its own PART (reusing the same template), rendered as a <section> tab.
 * @module Applications/WeatherEditor
 * @author Tyler
 */

import { HOOKS, MODULE, SETTINGS, TEMPLATES } from '../../constants.mjs';
import { isFXMasterActive, getAvailableFxPresets } from '../../integrations/fxmaster.mjs';
import { ALL_PRESETS, HUD_EFFECTS, WEATHER_CATEGORIES } from '../../weather/weather-presets.mjs';
import { getEffectDefaults } from '../hud-weather-renderer.mjs';
import { SKY_OVERRIDES } from '../hud.mjs';
import { localize } from '../../utils/localization.mjs';
import { log } from '../../utils/logger.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Standalone weather editor window with sidebar navigation.
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class WeatherEditor extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-weather-editor',
    classes: ['calendaria', 'settings-panel', 'standard-form'],
    tag: 'form',
    window: {
      title: 'CALENDARIA.WeatherEditor.Title',
      icon: 'fas fa-cloud-sun',
      resizable: false
    },
    position: { width: 750, height: 700 },
    form: {
      handler: WeatherEditor.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      createPreset: WeatherEditor.#onCreatePreset,
      deletePreset: WeatherEditor.#onDeletePreset,
      resetVisuals: WeatherEditor.#onResetVisuals
    }
  };

  /**
   * Dynamic PARTS — one entry per preset (built-in + custom), all sharing the same template.
   * AppV2 reads this during render to determine which parts to process.
   * @override
   */
  static get PARTS() {
    const parts = { tabs: { template: TEMPLATES.TAB_NAVIGATION } };
    for (const preset of ALL_PRESETS) {
      parts[preset.id] = { template: TEMPLATES.SETTINGS.WEATHER_EDITOR, scrollable: [''] };
    }
    try {
      const custom = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
      for (const p of custom) {
        parts[p.id] = { template: TEMPLATES.SETTINGS.WEATHER_EDITOR, scrollable: [''] };
      }
    } catch {
      /* game.settings not ready during early class load */
    }
    parts.footer = { template: TEMPLATES.SETTINGS.WEATHER_EDITOR_FOOTER };
    return parts;
  }

  /** @override */
  tabGroups = { primary: ALL_PRESETS[0]?.id ?? 'clear' };

  // ─── Context Preparation ───────────────────────────────────────────

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.tabs = this._prepareTabs('primary');
    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const allPresets = [...ALL_PRESETS, ...customPresets];

    // Build sidebar tab groups by category (for tab-navigation.hbs)
    const activeTab = this.tabGroups.primary || allPresets[0]?.id;
    const categoryOrder = ['standard', 'severe', 'environmental', 'fantasy', 'custom'];
    const groups = {};

    for (const cat of categoryOrder) {
      const catDef = WEATHER_CATEGORIES[cat];
      if (!catDef) continue;
      groups[cat] = {
        id: cat,
        label: catDef.label,
        tooltip: catDef.label,
        color: WeatherEditor.#getCategoryColor(cat),
        tabs: []
      };
    }

    for (const preset of allPresets) {
      const cat = preset.category || 'custom';
      if (!groups[cat]) continue;
      const isActive = preset.id === activeTab;
      groups[cat].tabs.push({
        id: preset.id,
        group: 'primary',
        label: preset.category === 'custom' ? preset.label : localize(preset.label),
        icon: `fas ${preset.icon}`,
        active: isActive,
        cssClass: isActive ? 'active' : '',
        color: groups[cat].color
      });
    }

    // Alphabetize presets within each category
    for (const group of Object.values(groups)) {
      group.tabs.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    }

    context.tabGroups = Object.values(groups).filter((g) => g.tabs.length > 0);
    context.ungroupedTabs = [];
    context.showSearch = false;
    return context;
  }

  /**
   * Build dynamic tabs from all presets. Each preset becomes a tab entry
   * keyed by its ID, matching the dynamic PARTS entries.
   * @override
   */
  _prepareTabs(_group, _options) {
    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const allPresets = [...ALL_PRESETS, ...customPresets];
    const active = this.tabGroups.primary || allPresets[0]?.id;

    const tabs = {};
    for (const preset of allPresets) {
      const isActive = preset.id === active;
      tabs[preset.id] = {
        id: preset.id,
        group: 'primary',
        label: preset.category === 'custom' ? preset.label : localize(preset.label),
        icon: `fas ${preset.icon}`,
        active: isActive,
        cssClass: isActive ? 'active' : ''
      };
    }
    return tabs;
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId === 'tabs') return context;

    if (partId === 'footer') {
      const presetId = this.tabGroups.primary;
      context.isCustom = !ALL_PRESETS.find((p) => p.id === presetId);
      return context;
    }

    // Every other part is a preset editor section
    context.tab = context.tabs?.[partId];
    if (context.tab) await this.#prepareEditorContext(context, partId);
    return context;
  }

  /**
   * Prepare editor panel context for a specific preset.
   * @param {object} context - Template context
   * @param {string} presetId - Preset ID (matches the partId)
   */
  async #prepareEditorContext(context, presetId) {
    const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const builtinPreset = ALL_PRESETS.find((p) => p.id === presetId);
    const customPreset = customPresets.find((p) => p.id === presetId);
    const preset = builtinPreset || customPreset;

    if (!preset) {
      context.preset = null;
      return;
    }

    const isCustom = !builtinPreset;

    // For built-in presets, load overrides from setting
    const overrides = !isCustom ? (game.settings.get(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES) || {})[presetId] || {} : {};

    // Merge overrides into core fields for built-in presets
    const label = isCustom ? preset.label : overrides.label || localize(preset.label);
    const icon = overrides.icon || preset.icon;
    const color = overrides.color || preset.color;
    const effectId = isCustom ? preset.hudEffect || 'clear' : overrides.hudEffect || preset.hudEffect || 'clear';
    const defaults = getEffectDefaults(effectId);
    const skyDefaults = SKY_OVERRIDES[effectId];

    // Visual override source: custom preset stores directly, built-in uses override setting
    const vo = isCustom ? preset.visualOverrides || {} : overrides.visualOverrides || {};
    const so = isCustom ? preset.skyOverrides || {} : overrides.skyOverrides || {};

    const defCount = defaults?.count ?? [0, 0];
    const defScale = defaults?.scale ?? [0, 0];
    const defAlpha = defaults?.alpha ?? [0, 0];
    const defSpeedX = defaults?.speed?.x ?? [0, 0];
    const defSpeedY = defaults?.speed?.y ?? [0, 0];
    const defGravity = defaults?.gravity ?? 0;
    const defWobble = defaults?.wobble ?? 0;
    const defTint = defaults?.tint ?? [0xffffff, 0xffffff];

    // Environment lighting: separate override values from defaults for placeholder pattern
    const envBaseOverride = isCustom ? (preset.environmentBase ?? {}) : (overrides.environmentBase ?? {});
    const envDarkOverride = isCustom ? (preset.environmentDark ?? {}) : (overrides.environmentDark ?? {});
    const envBaseDefault = builtinPreset?.environmentBase ?? {};
    const envDarkDefault = builtinPreset?.environmentDark ?? {};

    context.isCustom = isCustom;
    context.preset = {
      id: preset.id,
      label,
      icon,
      color,
      hudEffect: effectId,
      baseHue: envBaseOverride.hue ?? '',
      baseSaturation: envBaseOverride.saturation ?? '',
      darkHue: envDarkOverride.hue ?? '',
      darkSaturation: envDarkOverride.saturation ?? ''
    };

    // HUD effect dropdown options (alphabetized by label)
    context.hudEffectOptions = HUD_EFFECTS.map((e) => ({
      value: e,
      label: localize(`CALENDARIA.HudEffect.${e}`),
      selected: e === effectId
    })).sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));

    // FXMaster preset dropdown (only if FXMaster is active)
    context.hasFXMaster = isFXMasterActive();
    if (context.hasFXMaster) {
      const currentFxPreset = isCustom ? preset.fxPreset || '' : overrides.fxPreset !== undefined ? overrides.fxPreset || '' : builtinPreset.fxPreset || '';
      context.preset.fxPreset = currentFxPreset;
      const fxPresets = getAvailableFxPresets();
      context.fxPresetOptions = [
        { value: '', label: localize('CALENDARIA.Common.None'), selected: !currentFxPreset },
        ...fxPresets.map((p) => ({ value: p.value, label: p.label, selected: p.value === currentFxPreset }))
      ];
    }

    // Visual override values (empty string = use placeholder/default)
    context.visuals = {
      countMin: vo.count?.[0] ?? '',
      countMax: vo.count?.[1] ?? '',
      scaleMin: vo.scale?.[0] ?? '',
      scaleMax: vo.scale?.[1] ?? '',
      alphaMin: vo.alpha?.[0] ?? '',
      alphaMax: vo.alpha?.[1] ?? '',
      speedXMin: vo.speedX?.[0] ?? '',
      speedXMax: vo.speedX?.[1] ?? '',
      speedYMin: vo.speedY?.[0] ?? '',
      speedYMax: vo.speedY?.[1] ?? '',
      gravity: vo.gravity ?? '',
      wobble: vo.wobble ?? '',
      tintPrimary: vo.tint ? WeatherEditor.#numToHex(vo.tint[0]) : WeatherEditor.#numToHex(defTint[0]),
      tintSecondary: vo.tint ? WeatherEditor.#numToHex(vo.tint[1]) : WeatherEditor.#numToHex(defTint[1])
    };

    // Defaults for placeholders
    context.defaults = {
      baseHue: envBaseDefault.hue ?? '',
      baseSaturation: envBaseDefault.saturation ?? '',
      darkHue: envDarkDefault.hue ?? '',
      darkSaturation: envDarkDefault.saturation ?? '',
      countMin: defCount[0],
      countMax: defCount[1],
      scaleMin: defScale[0],
      scaleMax: defScale[1],
      alphaMin: defAlpha[0],
      alphaMax: defAlpha[1],
      speedXMin: defSpeedX[0],
      speedXMax: defSpeedX[1],
      speedYMin: defSpeedY[0],
      speedYMax: defSpeedY[1],
      gravity: defGravity,
      wobble: defWobble,
      skyStrength: skyDefaults?.strength ?? 0.7
    };

    // Sky override values
    context.sky = {
      strength: so.strength ?? '',
      top: so.top ? WeatherEditor.#rgbToHex(so.top) : skyDefaults?.top ? WeatherEditor.#rgbToHex(skyDefaults.top) : '#808080',
      mid: so.mid ? WeatherEditor.#rgbToHex(so.mid) : skyDefaults?.mid ? WeatherEditor.#rgbToHex(skyDefaults.mid) : '#808080',
      bottom: so.bottom ? WeatherEditor.#rgbToHex(so.bottom) : skyDefaults?.bottom ? WeatherEditor.#rgbToHex(skyDefaults.bottom) : '#808080'
    };
  }

  // ─── Tab Change ───────────────────────────────────────────────────

  /**
   * Re-render footer when switching tabs so the correct button shows.
   * @param {string} tab - Tab ID
   * @param {string} group - Tab group name
   * @param {object} options - Tab change options
   */
  changeTab(tab, group, options) {
    super.changeTab(tab, group, options);
    this.render({ parts: ['footer'] });
  }

  // ─── State Synchronization ─────────────────────────────────────────

  /** @override */
  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state);
    const focused = priorElement?.querySelector(':focus');
    if (focused?.name) state.focusedField = focused.name;
  }

  /** @override */
  _syncPartState(partId, newElement, priorElement, state) {
    super._syncPartState(partId, newElement, priorElement, state);
    if (state.focusedField) {
      const field = newElement?.querySelector(`[name="${state.focusedField}"]`);
      field?.focus();
    }
  }

  // ─── Form Submission ───────────────────────────────────────────────

  /**
   * Handle form submission (submitOnChange).
   * Form data keys are namespaced by preset ID (e.g. "clear.vo-count-min")
   * to avoid collisions between sections. We extract only the active preset's data.
   * @param {SubmitEvent} _event - The submit event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - Parsed form data
   */
  static async #onSubmit(_event, _form, formData) {
    const presetId = this.tabGroups.primary;
    if (!presetId) return;

    const expanded = foundry.utils.expandObject(formData.object);
    const data = expanded[presetId];
    if (!data) return;

    const builtinPreset = ALL_PRESETS.find((p) => p.id === presetId);
    const isCustom = !builtinPreset;
    const effectId = data.hudEffect || 'clear';

    // Detect if HUD effect changed — clear visual/sky overrides so new defaults apply
    let effectChanged = false;
    if (isCustom) {
      const presets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
      const stored = presets.find((p) => p.id === presetId);
      effectChanged = stored && (stored.hudEffect || 'clear') !== effectId;
    } else {
      const overrides = (game.settings.get(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES) || {})[presetId] || {};
      const prevEffect = overrides.hudEffect || builtinPreset.hudEffect || 'clear';
      effectChanged = prevEffect !== effectId;
    }

    // Parse environment lighting fields
    const baseHue = data.baseHue !== '' && data.baseHue != null ? parseFloat(data.baseHue) : null;
    const baseSat = data.baseSaturation !== '' && data.baseSaturation != null ? parseFloat(data.baseSaturation) : null;
    const darkHue = data.darkHue !== '' && data.darkHue != null ? parseFloat(data.darkHue) : null;
    const darkSat = data.darkSaturation !== '' && data.darkSaturation != null ? parseFloat(data.darkSaturation) : null;
    const environmentBase = baseHue !== null || baseSat !== null ? { hue: baseHue, saturation: baseSat } : null;
    const environmentDark = darkHue !== null || darkSat !== null ? { hue: darkHue, saturation: darkSat } : null;

    // Extract visual/sky overrides (delta against defaults) — skip if effect just changed
    const { visualOverrides, skyOverrides } = effectChanged ? { visualOverrides: null, skyOverrides: null } : WeatherEditor.#extractVisuals(data, effectId);

    if (isCustom) {
      const presets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
      const preset = presets.find((p) => p.id === presetId);
      if (!preset) return;

      preset.label = (data.label || '').trim() || preset.label;
      preset.icon = (data.icon || '').trim() || 'fa-cloud';
      preset.color = data.color || '#888888';
      preset.hudEffect = effectId;
      preset.fxPreset = data.fxPreset || null;
      preset.environmentBase = environmentBase;
      preset.environmentDark = environmentDark;
      preset.visualOverrides = visualOverrides;
      preset.skyOverrides = skyOverrides;

      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS, presets);
      log(3, `Weather Editor: saved custom weather "${preset.label}"`);
    } else {
      // Built-in: save all overridable fields (delta only — skip values matching defaults)
      const allOverrides = game.settings.get(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES) || {};
      const override = {};
      const trimLabel = (data.label || '').trim();
      if (trimLabel && trimLabel !== localize(builtinPreset.label)) override.label = trimLabel;
      const trimIcon = (data.icon || '').trim();
      if (trimIcon && trimIcon !== builtinPreset.icon) override.icon = trimIcon;
      if (data.color && data.color !== builtinPreset.color) override.color = data.color;
      if (effectId !== (builtinPreset.hudEffect || 'clear')) override.hudEffect = effectId;
      const fxPresetValue = data.fxPreset || null;
      if (fxPresetValue !== (builtinPreset.fxPreset ?? null)) override.fxPreset = fxPresetValue;
      if (environmentBase) override.environmentBase = environmentBase;
      if (environmentDark) override.environmentDark = environmentDark;
      if (visualOverrides) override.visualOverrides = visualOverrides;
      if (skyOverrides) override.skyOverrides = skyOverrides;

      if (Object.keys(override).length) {
        allOverrides[presetId] = override;
      } else {
        delete allOverrides[presetId];
      }
      await game.settings.set(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES, allOverrides);
      log(3, `Weather Editor: saved overrides for built-in "${presetId}"`);
    }

    // Refresh HUD weather canvas so changes are visible immediately
    Hooks.callAll(HOOKS.WEATHER_CHANGE);
  }

  // ─── Action Handlers ───────────────────────────────────────────────

  /** Create a new custom preset. */
  static async #onCreatePreset() {
    const presets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const newPreset = {
      id: foundry.utils.randomID(),
      label: localize('CALENDARIA.WeatherEditor.NewName'),
      icon: 'fa-cloud',
      color: '#888888',
      category: 'custom',
      tempMin: 10,
      tempMax: 25,
      darknessPenalty: 0,
      inertiaWeight: 1,
      hudEffect: 'clear',
      fxPreset: null,
      environmentBase: null,
      environmentDark: null,
      description: ''
    };
    presets.push(newPreset);
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS, presets);
    this.tabGroups.primary = newPreset.id;
    this.render();
  }

  /** Delete the currently selected custom preset. */
  static async #onDeletePreset() {
    const presetId = this.tabGroups.primary;
    if (!presetId) return;

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Common.Delete') },
      content: `<p>${localize('CALENDARIA.WeatherEditor.DeleteConfirm')}</p>`
    });
    if (!confirmed) return;

    const presets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const filtered = presets.filter((p) => p.id !== presetId);
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS, filtered);

    this.tabGroups.primary = ALL_PRESETS[0]?.id ?? 'clear';
    this.render();
  }

  /** Reset visual overrides for a built-in preset. */
  static async #onResetVisuals() {
    const presetId = this.tabGroups.primary;
    if (!presetId) return;

    const allOverrides = game.settings.get(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES) || {};
    delete allOverrides[presetId];
    await game.settings.set(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES, allOverrides);
    ui.notifications.info(localize('CALENDARIA.WeatherEditor.VisualsReset'));
    this.render({ parts: [presetId] });
  }

  // ─── Visual Extraction ─────────────────────────────────────────────

  /**
   * Extract visual and sky overrides from form data, computing delta against defaults.
   * @param {object} data - Expanded form data for a single preset (already namespaced)
   * @param {string} effectId - The HUD effect ID
   * @returns {{visualOverrides: object|null, skyOverrides: object|null}} Delta overrides
   */
  static #extractVisuals(data, effectId) {
    const defaults = getEffectDefaults(effectId);
    const skyDefaults = SKY_OVERRIDES[effectId];
    const visualOverrides = {};

    const parseRange = (minKey, maxKey, defaultArr) => {
      const minVal = data[minKey];
      const maxVal = data[maxKey];
      if ((minVal === '' || minVal == null) && (maxVal === '' || maxVal == null)) return null;
      const min = minVal !== '' && minVal != null ? parseFloat(minVal) : (defaultArr?.[0] ?? 0);
      const max = maxVal !== '' && maxVal != null ? parseFloat(maxVal) : (defaultArr?.[1] ?? 0);
      if (defaultArr && min === defaultArr[0] && max === defaultArr[1]) return null;
      return [min, max];
    };

    const count = parseRange('vo-count-min', 'vo-count-max', defaults?.count);
    if (count) visualOverrides.count = count;
    const scale = parseRange('vo-scale-min', 'vo-scale-max', defaults?.scale);
    if (scale) visualOverrides.scale = scale;
    const alpha = parseRange('vo-alpha-min', 'vo-alpha-max', defaults?.alpha);
    if (alpha) visualOverrides.alpha = alpha;
    const speedX = parseRange('vo-speedx-min', 'vo-speedx-max', defaults?.speed?.x);
    if (speedX) visualOverrides.speedX = speedX;
    const speedY = parseRange('vo-speedy-min', 'vo-speedy-max', defaults?.speed?.y);
    if (speedY) visualOverrides.speedY = speedY;

    const gravVal = data['vo-gravity'];
    if (gravVal !== '' && gravVal != null && parseFloat(gravVal) !== (defaults?.gravity ?? 0)) {
      visualOverrides.gravity = parseFloat(gravVal);
    }
    const wobVal = data['vo-wobble'];
    if (wobVal !== '' && wobVal != null && parseFloat(wobVal) !== (defaults?.wobble ?? 0)) {
      visualOverrides.wobble = parseFloat(wobVal);
    }

    const tintPrimary = WeatherEditor.#hexToNum(data['vo-tint-primary'] || '#ffffff');
    const tintSecondary = WeatherEditor.#hexToNum(data['vo-tint-secondary'] || '#ffffff');
    const defTint = defaults?.tint ?? [0xffffff, 0xffffff];
    if (tintPrimary !== defTint[0] || tintSecondary !== defTint[1]) {
      visualOverrides.tint = [tintPrimary, tintSecondary];
    }

    const skyOverrides = {};
    const strVal = data['so-strength'];
    if (strVal !== '' && strVal != null && parseFloat(strVal) !== (skyDefaults?.strength ?? 0.7)) {
      skyOverrides.strength = parseFloat(strVal);
    }
    const topHex = data['so-top'];
    const defTop = skyDefaults?.top ? WeatherEditor.#rgbToHex(skyDefaults.top) : '#808080';
    if (topHex && topHex !== defTop) skyOverrides.top = WeatherEditor.#hexToRgb(topHex);
    const midHex = data['so-mid'];
    const defMid = skyDefaults?.mid ? WeatherEditor.#rgbToHex(skyDefaults.mid) : '#808080';
    if (midHex && midHex !== defMid) skyOverrides.mid = WeatherEditor.#hexToRgb(midHex);
    const botHex = data['so-bottom'];
    const defBot = skyDefaults?.bottom ? WeatherEditor.#rgbToHex(skyDefaults.bottom) : '#808080';
    if (botHex && botHex !== defBot) skyOverrides.bottom = WeatherEditor.#hexToRgb(botHex);

    return {
      visualOverrides: Object.keys(visualOverrides).length ? visualOverrides : null,
      skyOverrides: Object.keys(skyOverrides).length ? skyOverrides : null
    };
  }

  // ─── Color Helpers ─────────────────────────────────────────────────

  /**
   * Convert hex number (0xRRGGBB) to HTML hex string.
   * @param {number} hex - Hex color number
   * @returns {string} HTML hex string
   */
  static #numToHex(hex) {
    return `#${hex.toString(16).padStart(6, '0')}`;
  }

  /**
   * Convert HTML hex string to hex number.
   * @param {string} str - HTML hex string
   * @returns {number} Hex color number
   */
  static #hexToNum(str) {
    return parseInt(str.replace('#', ''), 16);
  }

  /**
   * Convert [r, g, b] array to HTML hex string.
   * @param {number[]} rgb - RGB array
   * @returns {string} HTML hex string
   */
  static #rgbToHex(rgb) {
    return `#${rgb.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
  }

  /**
   * Convert HTML hex string to [r, g, b] array.
   * @param {string} str - HTML hex string
   * @returns {number[]} RGB array
   */
  static #hexToRgb(str) {
    const n = parseInt(str.replace('#', ''), 16);
    return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
  }

  /**
   * Get sidebar group color for a category.
   * @param {string} category - Category ID
   * @returns {string} Hex color
   */
  static #getCategoryColor(category) {
    switch (category) {
      case 'standard':
        return '#84cc16';
      case 'severe':
        return '#ef4444';
      case 'environmental':
        return '#f97316';
      case 'fantasy':
        return '#a855f7';
      case 'custom':
        return '#14b8a6';
      default:
        return '#6b7280';
    }
  }
}
