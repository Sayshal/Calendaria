/**
 * Unified Settings Panel Application
 * A comprehensive UI for configuring all Calendaria module settings.
 * @module Applications/SettingsPanel
 * @author Tyler
 */

import { BUNDLED_CALENDARS } from '../../calendar/calendar-loader.mjs';
import { MODULE, SETTINGS, TEMPLATES } from '../../constants.mjs';
import { localize } from '../../utils/localization.mjs';
import { log } from '../../utils/logger.mjs';
import { COLOR_DEFINITIONS, DEFAULT_COLORS, applyCustomColors } from '../../utils/theme-utils.mjs';
import { CalendarApplication } from '../calendar-application.mjs';
import { CalendarEditor } from '../calendar-editor.mjs';
import { CalendariaHUD } from '../calendaria-hud.mjs';
import { CompactCalendar } from '../compact-calendar.mjs';
import { ImporterApp } from '../importer-app.mjs';
import { TimeKeeperHUD } from '../time-keeper-hud.mjs';
import { MacroTriggerConfig } from './macro-trigger-config.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Unified Settings Panel for Calendaria module configuration.
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class SettingsPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-settings-panel',
    classes: ['calendaria', 'settings-panel', 'standard-form'],
    tag: 'form',
    window: { icon: 'fas fa-cog', resizable: false, title: 'CALENDARIA.SettingsPanel.Title' },
    position: { width: 700, height: 650 },
    form: {
      handler: SettingsPanel.#onSubmit,
      submitOnChange: true,
      closeOnSubmit: false
    },
    actions: {
      openCalendarEditor: SettingsPanel.#onOpenCalendarEditor,
      openImporter: SettingsPanel.#onOpenImporter,
      openMacroTriggers: SettingsPanel.#onOpenMacroTriggers,
      resetPosition: SettingsPanel.#onResetPosition,
      addCategory: SettingsPanel.#onAddCategory,
      removeCategory: SettingsPanel.#onRemoveCategory,
      resetColor: SettingsPanel.#onResetColor,
      resetAllColors: SettingsPanel.#onResetAllColors,
      exportTheme: SettingsPanel.#onExportTheme,
      importTheme: SettingsPanel.#onImportTheme,
      openHUD: SettingsPanel.#onOpenHUD,
      openCompact: SettingsPanel.#onOpenCompact,
      openTimeKeeper: SettingsPanel.#onOpenTimeKeeper,
      openFullCal: SettingsPanel.#onOpenFullCal
    }
  };

  /** @override */
  static PARTS = {
    tabs: { template: TEMPLATES.EDITOR.TAB_NAVIGATION },
    calendar: { template: TEMPLATES.SETTINGS.PANEL_CALENDAR, scrollable: [''] },
    notes: { template: TEMPLATES.SETTINGS.PANEL_NOTES, scrollable: [''] },
    time: { template: TEMPLATES.SETTINGS.PANEL_TIME, scrollable: [''] },
    moons: { template: TEMPLATES.SETTINGS.PANEL_MOONS, scrollable: [''] },
    weather: { template: TEMPLATES.SETTINGS.PANEL_WEATHER, scrollable: [''] },
    appearance: { template: TEMPLATES.SETTINGS.PANEL_APPEARANCE, scrollable: [''] },
    macros: { template: TEMPLATES.SETTINGS.PANEL_MACROS, scrollable: [''] },
    chat: { template: TEMPLATES.SETTINGS.PANEL_CHAT, scrollable: [''] },
    advanced: { template: TEMPLATES.SETTINGS.PANEL_ADVANCED, scrollable: [''] },
    timekeeper: { template: TEMPLATES.SETTINGS.PANEL_TIMEKEEPER, scrollable: [''] },
    compact: { template: TEMPLATES.SETTINGS.PANEL_COMPACT, scrollable: [''] },
    hud: { template: TEMPLATES.SETTINGS.PANEL_HUD, scrollable: [''] }
  };

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: 'calendar', icon: 'fas fa-calendar-alt', label: 'CALENDARIA.Common.Calendar', gmOnly: true },
        { id: 'notes', icon: 'fas fa-sticky-note', label: 'CALENDARIA.Common.Notes', gmOnly: true },
        { id: 'time', icon: 'fas fa-clock', label: 'CALENDARIA.Common.Time', gmOnly: true },
        { id: 'moons', icon: 'fas fa-moon', label: 'CALENDARIA.Common.Moons', gmOnly: true },
        { id: 'weather', icon: 'fas fa-cloud-sun', label: 'CALENDARIA.Common.Weather', gmOnly: true },
        { id: 'appearance', icon: 'fas fa-palette', label: 'CALENDARIA.SettingsPanel.Tab.Appearance' },
        { id: 'macros', icon: 'fas fa-bolt', label: 'CALENDARIA.SettingsPanel.Tab.Macros', gmOnly: true },
        { id: 'chat', icon: 'fas fa-comment', label: 'CALENDARIA.SettingsPanel.Tab.Chat', gmOnly: true },
        { id: 'advanced', icon: 'fas fa-tools', label: 'CALENDARIA.SettingsPanel.Tab.Advanced' },
        { id: 'hud', icon: 'fas fa-sun', label: 'CALENDARIA.SettingsPanel.Tab.HUD', cssClass: 'app-tab' },
        { id: 'compact', icon: 'fas fa-compress', label: 'CALENDARIA.SettingsPanel.Tab.Compact', cssClass: 'app-tab' },
        { id: 'timekeeper', icon: 'fas fa-stopwatch', label: 'CALENDARIA.SettingsPanel.Tab.TimeKeeper', cssClass: 'app-tab' }
      ],
      initial: 'calendar'
    }
  };

  /* -------------------------------------------- */
  /*  Context Preparation                         */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.isGM = game.user.isGM;
    return context;
  }

  /** @override */
  _prepareTabs(group, options) {
    const tabs = super._prepareTabs(group, options);
    if (!game.user.isGM && tabs && typeof tabs === 'object') {
      const filtered = {};
      for (const [id, tab] of Object.entries(tabs)) {
        const tabDef = SettingsPanel.TABS.primary.tabs.find((t) => t.id === id);
        if (!tabDef?.gmOnly) filtered[id] = tab;
      }
      const activeTab = this.tabGroups[group];
      const activeTabDef = SettingsPanel.TABS.primary.tabs.find((t) => t.id === activeTab);
      if (activeTabDef?.gmOnly) {
        this.tabGroups[group] = 'appearance';
        for (const tab of Object.values(filtered)) {
          tab.active = tab.id === 'appearance';
          tab.cssClass = tab.id === 'appearance' ? 'active' : tab.cssClass?.replace('active', '').trim() || undefined;
        }
      }
      return filtered;
    }
    return tabs;
  }

  /** @override */
  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    context.tab = context.tabs[partId];
    switch (partId) {
      case 'calendar':
        await this.#prepareCalendarContext(context);
        break;
      case 'notes':
        await this.#prepareNotesContext(context);
        break;
      case 'time':
        await this.#prepareTimeContext(context);
        break;
      case 'moons':
        await this.#prepareMoonsContext(context);
        break;
      case 'weather':
        await this.#prepareWeatherContext(context);
        break;
      case 'appearance':
        await this.#prepareAppearanceContext(context);
        break;
      case 'macros':
        await this.#prepareMacrosContext(context);
        break;
      case 'chat':
        await this.#prepareChatContext(context);
        break;
      case 'advanced':
        await this.#prepareAdvancedContext(context);
        break;
      case 'timekeeper':
        await this.#prepareTimeKeeperContext(context);
        break;
      case 'compact':
        await this.#prepareCompactContext(context);
        break;
      case 'hud':
        await this.#prepareHUDContext(context);
        break;
    }
    return context;
  }

  /* -------------------------------------------- */

  /**
   * Prepare context for the Moons tab.
   * @param {object} context - The context object
   */
  async #prepareMoonsContext(context) {
    context.showMoonPhases = game.settings.get(MODULE.ID, SETTINGS.SHOW_MOON_PHASES);
  }

  /**
   * Prepare context for the Calendar tab.
   * @param {object} context - The context object
   */
  async #prepareCalendarContext(context) {
    const activeCalendarId = game.settings.get(MODULE.ID, SETTINGS.ACTIVE_CALENDAR);
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    context.calendarOptions = [];
    for (const id of BUNDLED_CALENDARS) {
      const key = id.charAt(0).toUpperCase() + id.slice(1);
      context.calendarOptions.push({ value: id, label: localize(`CALENDARIA.Calendar.${key}.Name`), selected: id === activeCalendarId, isCustom: false });
    }
    for (const [id, data] of Object.entries(customCalendars)) context.calendarOptions.push({ value: id, label: data.name || id, selected: id === activeCalendarId, isCustom: true });
  }

  /**
   * Prepare context for the Notes tab.
   * @param {object} context - The context object
   */
  async #prepareNotesContext(context) {
    const rawCategories = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CATEGORIES) || [];
    context.categories = rawCategories.filter((c) => c && c.id).map((c) => ({ ...c, color: c.color || '#4a90e2' }));
  }

  /**
   * Prepare context for the Time tab.
   * @param {object} context - The context object
   */
  async #prepareTimeContext(context) {
    context.darknessSync = game.settings.get(MODULE.ID, SETTINGS.DARKNESS_SYNC);
    context.advanceTimeOnRest = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
    context.advanceTimeOnCombat = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_COMBAT);
  }

  /**
   * Prepare context for the Chat tab.
   * @param {object} context - The context object
   */
  async #prepareChatContext(context) {
    const chatMode = game.settings.get(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE);
    context.chatTimestampModeOptions = [
      { value: 'disabled', label: localize('CALENDARIA.Settings.ChatTimestampMode.Disabled'), selected: chatMode === 'disabled' },
      { value: 'replace', label: localize('CALENDARIA.Settings.ChatTimestampMode.Replace'), selected: chatMode === 'replace' },
      { value: 'augment', label: localize('CALENDARIA.Settings.ChatTimestampMode.Augment'), selected: chatMode === 'augment' }
    ];
    context.chatTimestampShowTime = game.settings.get(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_SHOW_TIME);
  }

  /**
   * Prepare context for the Compact Calendar tab.
   * @param {object} context - The context object
   */
  async #prepareCompactContext(context) {
    const compactSticky = game.settings.get(MODULE.ID, SETTINGS.COMPACT_STICKY_STATES);
    context.compactStickyTimeControls = compactSticky?.timeControls ?? false;
    context.compactStickySidebar = compactSticky?.sidebar ?? false;
    context.compactStickyPosition = compactSticky?.position ?? false;
    context.showCompactCalendar = game.settings.get(MODULE.ID, SETTINGS.SHOW_COMPACT_CALENDAR);
    context.compactControlsDelay = game.settings.get(MODULE.ID, SETTINGS.COMPACT_CONTROLS_DELAY);
  }

  /**
   * Prepare context for the Calendar HUD tab.
   * @param {object} context - The context object
   */
  async #prepareHUDContext(context) {
    const hudSticky = game.settings.get(MODULE.ID, SETTINGS.HUD_STICKY_STATES);
    context.hudStickyTray = hudSticky?.tray ?? false;
    context.hudStickyPosition = hudSticky?.position ?? false;
    context.calendarHUDLocked = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_LOCKED);
    context.showCalendarHUD = game.settings.get(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD);
    const hudMode = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE);
    context.hudModeOptions = [
      { value: 'fullsize', label: localize('CALENDARIA.Settings.CalendarHUDMode.Fullsize'), selected: hudMode === 'fullsize' },
      { value: 'compact', label: localize('CALENDARIA.Settings.CalendarHUDMode.Compact'), selected: hudMode === 'compact' }
    ];
  }

  /**
   * Prepare context for the TimeKeeper tab.
   * @param {object} context - The context object
   */
  async #prepareTimeKeeperContext(context) {
    context.showTimeKeeper = game.settings.get(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER);
  }

  /**
   * Prepare context for the Weather tab.
   * @param {object} context - The context object
   */
  async #prepareWeatherContext(context) {
    const tempUnit = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_UNIT);
    context.temperatureUnitOptions = [
      { value: 'celsius', label: localize('CALENDARIA.Settings.TemperatureUnit.Celsius'), selected: tempUnit === 'celsius' },
      { value: 'fahrenheit', label: localize('CALENDARIA.Settings.TemperatureUnit.Fahrenheit'), selected: tempUnit === 'fahrenheit' }
    ];
    context.customWeatherPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
  }

  /**
   * Prepare context for the Appearance tab.
   * @param {object} context - The context object
   */
  async #prepareAppearanceContext(context) {
    const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
    context.hasCustomTheme = Object.keys(customColors).length > 0;
    const categories = {
      backgrounds: { label: 'CALENDARIA.ThemeEditor.Category.Backgrounds', colors: [] },
      borders: { label: 'CALENDARIA.ThemeEditor.Category.Borders', colors: [] },
      text: { label: 'CALENDARIA.ThemeEditor.Category.Text', colors: [] },
      buttons: { label: 'CALENDARIA.ThemeEditor.Category.Buttons', colors: [] },
      accents: { label: 'CALENDARIA.ThemeEditor.Category.Accents', colors: [] },
      festivals: { label: 'CALENDARIA.Common.Festivals', colors: [] }
    };
    for (const def of COLOR_DEFINITIONS) {
      const value = customColors[def.key] || DEFAULT_COLORS[def.key];
      const isCustom = customColors[def.key] !== undefined;
      categories[def.category].colors.push({ key: def.key, label: def.label, value, defaultValue: DEFAULT_COLORS[def.key], isCustom });
    }
    context.themeCategories = Object.values(categories);
  }

  /**
   * Prepare context for the Macros tab.
   * @param {object} context - The context object
   */
  async #prepareMacrosContext(context) {
    const triggers = game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS);
    context.hasMacroTriggers = (triggers?.global && Object.values(triggers.global).some((v) => v)) || triggers?.season?.length > 0 || triggers?.moonPhase?.length > 0;
  }

  /**
   * Prepare context for the Advanced tab.
   * @param {object} context - The context object
   */
  async #prepareAdvancedContext(context) {
    const primaryGM = game.settings.get(MODULE.ID, SETTINGS.PRIMARY_GM);
    context.primaryGMOptions = [{ value: '', label: localize('CALENDARIA.Settings.PrimaryGM.Auto'), selected: !primaryGM }];
    for (const user of game.users.filter((u) => u.isGM)) context.primaryGMOptions.push({ value: user.id, label: user.name, selected: user.id === primaryGM });
    const logLevel = game.settings.get(MODULE.ID, SETTINGS.LOGGING_LEVEL);
    context.loggingLevelOptions = [
      { value: '0', label: localize('CALENDARIA.Settings.Logger.Choices.Off'), selected: logLevel === '0' || logLevel === 0 },
      { value: '1', label: localize('CALENDARIA.Settings.Logger.Choices.Errors'), selected: logLevel === '1' || logLevel === 1 },
      { value: '2', label: localize('CALENDARIA.Settings.Logger.Choices.Warnings'), selected: logLevel === '2' || logLevel === 2 },
      { value: '3', label: localize('CALENDARIA.Settings.Logger.Choices.Verbose'), selected: logLevel === '3' || logLevel === 3 }
    ];
    context.devMode = game.settings.get(MODULE.ID, SETTINGS.DEV_MODE);
    context.moduleVersion = game.modules.get(MODULE.ID)?.version ?? 'Unknown';
    const moduleData = game.data.modules?.find((m) => m.id === MODULE.ID);
    if (moduleData?.languages?.length) context.translations = moduleData.languages.map((lang) => lang.name).join(', ');
  }

  /* -------------------------------------------- */
  /*  Form Handling                               */
  /* -------------------------------------------- */

  /**
   * Handle form submission.
   * @param {Event} _event - The form submission event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - The form data
   */
  static async #onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    log(3, 'Settings panel form data:', data);
    if ('showTimeKeeper' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER, data.showTimeKeeper);
    if ('showCompactCalendar' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_COMPACT_CALENDAR, data.showCompactCalendar);
    if ('showCalendarHUD' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, data.showCalendarHUD);
    if ('showMoonPhases' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_MOON_PHASES, data.showMoonPhases);
    if ('calendarHUDMode' in data) await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE, data.calendarHUDMode);
    if ('compactControlsDelay' in data) await game.settings.set(MODULE.ID, SETTINGS.COMPACT_CONTROLS_DELAY, Number(data.compactControlsDelay));
    if ('darknessSync' in data) await game.settings.set(MODULE.ID, SETTINGS.DARKNESS_SYNC, data.darknessSync);
    if ('advanceTimeOnRest' in data) await game.settings.set(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST, data.advanceTimeOnRest);
    if ('advanceTimeOnCombat' in data) await game.settings.set(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_COMBAT, data.advanceTimeOnCombat);
    if ('chatTimestampMode' in data) await game.settings.set(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE, data.chatTimestampMode);
    if ('chatTimestampShowTime' in data) await game.settings.set(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_SHOW_TIME, data.chatTimestampShowTime);
    if ('activeCalendar' in data) {
      const current = game.settings.get(MODULE.ID, SETTINGS.ACTIVE_CALENDAR);
      if (data.activeCalendar !== current) {
        await game.settings.set(MODULE.ID, SETTINGS.ACTIVE_CALENDAR, data.activeCalendar);
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: localize('CALENDARIA.SettingsPanel.ReloadRequired.Title') },
          content: `<p>${localize('CALENDARIA.SettingsPanel.ReloadRequired.Content')}</p>`,
          yes: { label: localize('CALENDARIA.SettingsPanel.ReloadRequired.Reload') },
          no: { label: localize('CALENDARIA.SettingsPanel.ReloadRequired.Later') }
        });
        if (confirmed) foundry.utils.debouncedReload();
      }
    }

    if ('temperatureUnit' in data) await game.settings.set(MODULE.ID, SETTINGS.TEMPERATURE_UNIT, data.temperatureUnit);
    if ('compactStickySection' in data) {
      await game.settings.set(MODULE.ID, SETTINGS.COMPACT_STICKY_STATES, {
        timeControls: !!data.compactStickyTimeControls,
        sidebar: !!data.compactStickySidebar,
        position: !!data.compactStickyPosition
      });
    }

    if ('hudStickySection' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_STICKY_STATES, { tray: !!data.hudStickyTray, position: !!data.hudStickyPosition });
    if ('calendarHUDLocked' in data) await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_LOCKED, data.calendarHUDLocked);
    if ('primaryGM' in data) await game.settings.set(MODULE.ID, SETTINGS.PRIMARY_GM, data.primaryGM);
    if ('loggingLevel' in data) await game.settings.set(MODULE.ID, SETTINGS.LOGGING_LEVEL, data.loggingLevel);
    if ('devMode' in data) await game.settings.set(MODULE.ID, SETTINGS.DEV_MODE, data.devMode);
    if (data.colors) {
      const customColors = {};
      for (const def of COLOR_DEFINITIONS) {
        const key = def.key;
        if (data.colors[key] && data.colors[key] !== DEFAULT_COLORS[key]) customColors[key] = data.colors[key];
      }
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, customColors);
      applyCustomColors({ ...DEFAULT_COLORS, ...customColors });
    }

    if (data.categories) {
      const validCategories = Object.values(data.categories).filter((c) => c && c.id && c.name?.trim());
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CATEGORIES, validCategories);
    }
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Open the Calendar Editor.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenCalendarEditor(_event, _target) {
    new CalendarEditor().render(true);
  }

  /**
   * Open the Importer.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenImporter(_event, _target) {
    new ImporterApp().render(true);
  }

  /**
   * Open the Macro Trigger Configuration.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenMacroTriggers(_event, _target) {
    new MacroTriggerConfig().render(true);
  }

  /**
   * Reset a specific UI position.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onResetPosition(_event, target) {
    const targetType = target.dataset.target;
    const config = {
      compact: { setting: SETTINGS.COMPACT_CALENDAR_POSITION, appId: 'compact-calendar' },
      hud: { setting: SETTINGS.CALENDAR_HUD_POSITION, appId: 'calendaria-hud' },
      timekeeper: { setting: SETTINGS.TIME_KEEPER_POSITION, appId: 'time-keeper-hud' }
    };
    const { setting, appId } = config[targetType] || {};
    if (!setting) return;
    await game.settings.set(MODULE.ID, setting, null);
    const app = foundry.applications.instances.get(appId);
    if (app?.rendered) {
      app.setPosition({ left: null, top: null });
      app.render();
    }
    ui.notifications.info('CALENDARIA.SettingsPanel.ResetPosition.Success', { localize: true });
  }

  /**
   * Add a custom category.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onAddCategory(_event, _target) {
    const form = this.element;
    let currentCategories = [];
    if (form) {
      const formData = new foundry.applications.ux.FormDataExtended(form);
      const data = foundry.utils.expandObject(formData.object);
      currentCategories = data.categories ? Object.values(data.categories).filter((c) => c && c.id) : [];
    } else {
      currentCategories = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CATEGORIES) || [];
    }
    currentCategories.push({ id: foundry.utils.randomID(), name: localize('CALENDARIA.SettingsPanel.Category.NewName'), color: '#4a90e2', icon: 'fas fa-bookmark' });
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CATEGORIES, currentCategories);
    this.render();
  }

  /**
   * Remove a custom category.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onRemoveCategory(_event, target) {
    const categoryId = target.dataset.categoryId;
    if (!categoryId) return;
    const form = this.element.querySelector('form');
    let currentCategories = [];
    if (form) {
      const formData = new foundry.applications.ux.FormDataExtended(form);
      const data = foundry.utils.expandObject(formData.object);
      currentCategories = data.categories ? Object.values(data.categories).filter((c) => c && c.id && c.id !== categoryId) : [];
    } else {
      const saved = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CATEGORIES) || [];
      currentCategories = saved.filter((c) => c && c.id && c.id !== categoryId);
    }
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_CATEGORIES, currentCategories);
    this.render();
  }

  /**
   * Reset a single color to default.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onResetColor(_event, target) {
    const app = foundry.applications.instances.get('calendaria-settings-panel');
    const key = target.dataset.key;
    const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
    delete customColors[key];
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, customColors);
    applyCustomColors({ ...DEFAULT_COLORS, ...customColors });
    app?.render({ force: true, parts: ['appearance'] });
  }

  /**
   * Reset all colors to defaults.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onResetAllColors(_event, _target) {
    const app = foundry.applications.instances.get('calendaria-settings-panel');
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.ThemeEditor.ResetAll') },
      content: `<p>${localize('CALENDARIA.ThemeEditor.ConfirmResetAll')}</p>`,
      yes: { label: localize('CALENDARIA.ThemeEditor.ResetAll'), icon: 'fas fa-undo' },
      no: { label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
    });

    if (confirmed) {
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, {});
      applyCustomColors({ ...DEFAULT_COLORS });
      ui.notifications.info('CALENDARIA.ThemeEditor.ColorsReset', { localize: true });
      app?.render({ force: true, parts: ['appearance'] });
    }
  }

  /**
   * Export current theme as JSON.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onExportTheme(_event, _target) {
    const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
    const exportData = { colors: { ...DEFAULT_COLORS, ...customColors }, version: game.modules.get(MODULE.ID)?.version || '1.0.0' };
    const filename = `calendaria-theme-${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    ui.notifications.info('CALENDARIA.ThemeEditor.ExportSuccess', { localize: true });
  }

  /**
   * Import theme from JSON file.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onImportTheme(_event, _target) {
    const app = foundry.applications.instances.get('calendaria-settings-panel');
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
        const customColors = {};
        for (const [key, value] of Object.entries(importData.colors)) if (DEFAULT_COLORS[key] !== value) customColors[key] = value;
        await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, customColors);
        applyCustomColors({ ...DEFAULT_COLORS, ...customColors });
        ui.notifications.info('CALENDARIA.ThemeEditor.ImportSuccess', { localize: true });
        app?.render();
      } catch (err) {
        log(2, 'Theme import failed:', err);
        ui.notifications.error('CALENDARIA.ThemeEditor.ImportError', { localize: true });
      }
    });

    input.click();
  }

  /**
   * Open the Calendar HUD.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenHUD(_event, _target) {
    CalendariaHUD.show();
  }

  /**
   * Open the Compact Calendar.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenCompact(_event, _target) {
    CompactCalendar.show();
  }

  /**
   * Open the TimeKeeper HUD.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenTimeKeeper(_event, _target) {
    TimeKeeperHUD.show();
  }

  /**
   * Open the Full Calendar Application.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenFullCal(_event, _target) {
    new CalendarApplication().render(true);
  }
}
