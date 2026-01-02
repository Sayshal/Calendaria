/**
 * Unified Settings Panel Application
 * A comprehensive UI for configuring all Calendaria module settings.
 * @module Applications/SettingsPanel
 * @author Tyler
 */

import { BUNDLED_CALENDARS } from '../../calendar/calendar-loader.mjs';
import CalendarManager from '../../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS, TEMPLATES } from '../../constants.mjs';
import { localize } from '../../utils/localization.mjs';
import { log } from '../../utils/logger.mjs';
import { COLOR_CATEGORIES, COLOR_DEFINITIONS, COMPONENT_CATEGORIES, DEFAULT_COLORS, THEME_PRESETS, applyCustomColors, applyPreset } from '../../utils/theme-utils.mjs';
import WeatherManager from '../../weather/weather-manager.mjs';
import { CalendarApplication } from '../calendar-application.mjs';
import { CalendarEditor } from '../calendar-editor.mjs';
import { CalendariaHUD } from '../calendaria-hud.mjs';
import { MiniCalendar } from '../mini-calendar.mjs';
import { ImporterApp } from '../importer-app.mjs';
import { TimeKeeperHUD } from '../time-keeper-hud.mjs';

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
      resetPosition: SettingsPanel.#onResetPosition,
      addCategory: SettingsPanel.#onAddCategory,
      removeCategory: SettingsPanel.#onRemoveCategory,
      resetColor: SettingsPanel.#onResetColor,
      resetAllColors: SettingsPanel.#onResetAllColors,
      exportTheme: SettingsPanel.#onExportTheme,
      importTheme: SettingsPanel.#onImportTheme,
      openHUD: SettingsPanel.#onOpenHUD,
      openMiniCalendar: SettingsPanel.#onOpenMiniCalendar,
      openTimeKeeper: SettingsPanel.#onOpenTimeKeeper,
      openFullCal: SettingsPanel.#onOpenFullCal,
      addMoonTrigger: SettingsPanel.#onAddMoonTrigger,
      removeMoonTrigger: SettingsPanel.#onRemoveMoonTrigger,
      addSeasonTrigger: SettingsPanel.#onAddSeasonTrigger,
      removeSeasonTrigger: SettingsPanel.#onRemoveSeasonTrigger
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
    miniCalendar: { template: TEMPLATES.SETTINGS.PANEL_MINI_CALENDAR, scrollable: [''] },
    hud: { template: TEMPLATES.SETTINGS.PANEL_HUD, scrollable: [''] },
    formats: { template: TEMPLATES.SETTINGS.PANEL_FORMATS, scrollable: [''] }
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
        { id: 'formats', icon: 'fas fa-font', label: 'CALENDARIA.SettingsPanel.Tab.Formats', gmOnly: true },
        { id: 'macros', icon: 'fas fa-bolt', label: 'CALENDARIA.SettingsPanel.Tab.Macros', gmOnly: true },
        { id: 'chat', icon: 'fas fa-comment', label: 'CALENDARIA.SettingsPanel.Tab.Chat', gmOnly: true },
        { id: 'advanced', icon: 'fas fa-tools', label: 'CALENDARIA.SettingsPanel.Tab.Advanced' },
        { id: 'hud', icon: 'fas fa-sun', label: 'CALENDARIA.SettingsPanel.Tab.HUD', cssClass: 'app-tab' },
        { id: 'miniCalendar', icon: 'fas fa-compress', label: 'CALENDARIA.SettingsPanel.Tab.MiniCalendar', cssClass: 'app-tab' },
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
  _onRender(context, options) {
    super._onRender(context, options);

    // Handle theme mode dropdown change
    const themeModeSelect = this.element.querySelector('select[name="themeMode"]');
    themeModeSelect?.addEventListener('change', async (e) => {
      const mode = e.target.value;
      if (!mode) return;

      await game.settings.set(MODULE.ID, SETTINGS.THEME_MODE, mode);

      if (mode === 'custom') {
        const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
        applyCustomColors({ ...DEFAULT_COLORS, ...customColors });
      } else {
        applyPreset(mode);
      }

      this.render({ force: true, parts: ['appearance'] });
    });
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
      case 'miniCalendar':
        await this.#prepareMiniCalendarContext(context);
        break;
      case 'hud':
        await this.#prepareHUDContext(context);
        break;
      case 'formats':
        await this.#prepareFormatsContext(context);
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
      const key = id.split('-').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join('');
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
    context.syncClockPause = game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE);
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
   * Prepare context for the MiniCalendar tab.
   * @param {object} context - The context object
   */
  async #prepareMiniCalendarContext(context) {
    const miniCalendarSticky = game.settings.get(MODULE.ID, SETTINGS.MINI_CALENDAR_STICKY_STATES);
    context.miniCalendarStickyTimeControls = miniCalendarSticky?.timeControls ?? false;
    context.miniCalendarStickySidebar = miniCalendarSticky?.sidebar ?? false;
    context.miniCalendarStickyPosition = miniCalendarSticky?.position ?? false;
    context.showMiniCalendar = game.settings.get(MODULE.ID, SETTINGS.SHOW_MINI_CALENDAR);
    context.miniCalendarControlsDelay = game.settings.get(MODULE.ID, SETTINGS.MINI_CALENDAR_CONTROLS_DELAY);
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
   * Prepare context for the Formats tab.
   * @param {object} context - The context object
   */
  async #prepareFormatsContext(context) {
    const displayFormats = game.settings.get(MODULE.ID, SETTINGS.DISPLAY_FORMATS);
    const presetOptions = [
      { value: 'short', label: localize('CALENDARIA.Format.Preset.Short') },
      { value: 'long', label: localize('CALENDARIA.Format.Preset.Long') },
      { value: 'full', label: localize('CALENDARIA.Format.Preset.Full') },
      { value: 'ordinal', label: localize('CALENDARIA.Format.Preset.Ordinal') },
      { value: 'fantasy', label: localize('CALENDARIA.Format.Preset.Fantasy') },
      { value: 'time', label: localize('CALENDARIA.Format.Preset.Time') },
      { value: 'time12', label: localize('CALENDARIA.Format.Preset.Time12') },
      { value: 'approxTime', label: localize('CALENDARIA.Format.Preset.ApproxTime') },
      { value: 'approxDate', label: localize('CALENDARIA.Format.Preset.ApproxDate') },
      { value: 'datetime', label: localize('CALENDARIA.Format.Preset.DateTime') },
      { value: 'datetime12', label: localize('CALENDARIA.Format.Preset.DateTime12') },
      { value: 'custom', label: localize('CALENDARIA.Format.Preset.Custom') }
    ];

    const locations = [
      { id: 'hudDate', label: localize('CALENDARIA.Format.Location.HudDate'), category: 'hud' },
      { id: 'hudTime', label: localize('CALENDARIA.Format.Location.HudTime'), category: 'hud' },
      { id: 'miniCalendarHeader', label: localize('CALENDARIA.Format.Location.MiniCalendarHeader'), category: 'miniCalendar' },
      { id: 'miniCalendarTime', label: localize('CALENDARIA.Format.Location.MiniCalendarTime'), category: 'miniCalendar' },
      { id: 'fullCalendarHeader', label: localize('CALENDARIA.Format.Location.FullCalendarHeader'), category: 'fullcal' },
      { id: 'chatTimestamp', label: localize('CALENDARIA.Format.Location.ChatTimestamp'), category: 'chat' }
    ];

    context.formatLocations = locations.map((loc) => {
      const formats = displayFormats[loc.id] || { gm: 'long', player: 'long' };
      const knownPresets = ['short', 'long', 'full', 'ordinal', 'fantasy', 'time', 'time12', 'approxTime', 'approxDate', 'datetime', 'datetime12'];
      const isCustomGM = !knownPresets.includes(formats.gm);
      const isCustomPlayer = !knownPresets.includes(formats.player);
      return {
        ...loc,
        gmFormat: formats.gm,
        playerFormat: formats.player,
        gmPresetOptions: presetOptions.map((o) => ({
          ...o,
          selected: isCustomGM ? o.value === 'custom' : o.value === formats.gm
        })),
        playerPresetOptions: presetOptions.map((o) => ({
          ...o,
          selected: isCustomPlayer ? o.value === 'custom' : o.value === formats.player
        })),
        isCustomGM,
        isCustomPlayer
      };
    });

    // Group by category for organized display
    context.formatCategories = [
      { id: 'hud', label: localize('CALENDARIA.Format.Category.CalendariaHUD'), locations: context.formatLocations.filter((l) => l.category === 'hud') },
      { id: 'miniCalendar', label: localize('CALENDARIA.Format.Category.MiniCalendar'), locations: context.formatLocations.filter((l) => l.category === 'miniCalendar') },
      { id: 'fullcal', label: localize('CALENDARIA.Format.Category.FullCalendar'), locations: context.formatLocations.filter((l) => l.category === 'fullcal') },
      { id: 'chat', label: localize('CALENDARIA.Format.Category.Chat'), locations: context.formatLocations.filter((l) => l.category === 'chat') }
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
    const zones = WeatherManager.getCalendarZones() || [];
    const activeZone = WeatherManager.getActiveZone();
    context.hasZones = zones.length > 0;
    context.zoneOptions = zones.map((z) => ({ value: z.id, label: z.name, selected: z.id === activeZone?.id }));
  }

  /**
   * Prepare context for the Appearance tab.
   * @param {object} context - The context object
   */
  async #prepareAppearanceContext(context) {
    const themeMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE) || 'dark';
    const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};

    // Theme modes dropdown
    context.themeModes = [
      { key: 'dark', label: localize('CALENDARIA.ThemeEditor.Presets.Dark'), selected: themeMode === 'dark' },
      { key: 'highContrast', label: localize('CALENDARIA.ThemeEditor.Presets.HighContrast'), selected: themeMode === 'highContrast' },
      { key: 'custom', label: localize('CALENDARIA.ThemeEditor.Custom'), selected: themeMode === 'custom' }
    ];

    // Only show custom color editor when in custom mode
    context.showCustomColors = themeMode === 'custom';

    if (context.showCustomColors) {
      // Build categories with component info
      const categories = {};
      for (const [catKey, catLabel] of Object.entries(COLOR_CATEGORIES)) {
        categories[catKey] = { key: catKey, label: catLabel, colors: [] };
      }

      for (const def of COLOR_DEFINITIONS) {
        const value = customColors[def.key] || DEFAULT_COLORS[def.key];
        const isCustom = customColors[def.key] !== undefined;
        const componentLabel = COMPONENT_CATEGORIES[def.component] || '';
        categories[def.category].colors.push({
          key: def.key,
          label: def.label,
          value,
          defaultValue: DEFAULT_COLORS[def.key],
          isCustom,
          component: def.component,
          componentLabel
        });
      }

      context.themeCategories = Object.values(categories).filter((c) => c.colors.length > 0);
    }
  }

  /**
   * Prepare context for the Macros tab.
   * @param {object} context - The context object
   */
  async #prepareMacrosContext(context) {
    const config = game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS);
    context.macros = game.macros.contents.map((m) => ({ id: m.id, name: m.name }));

    // Global triggers
    const globalTriggers = [
      { key: 'dawn', label: 'CALENDARIA.MacroTrigger.Dawn' },
      { key: 'dusk', label: 'CALENDARIA.MacroTrigger.Dusk' },
      { key: 'midday', label: 'CALENDARIA.MacroTrigger.Midday' },
      { key: 'midnight', label: 'CALENDARIA.MacroTrigger.Midnight' },
      { key: 'newDay', label: 'CALENDARIA.MacroTrigger.NewDay' }
    ];
    context.globalTriggers = globalTriggers.map((trigger) => ({
      ...trigger,
      label: localize(trigger.label),
      macroId: config.global?.[trigger.key] || ''
    }));

    // Season triggers
    const calendar = CalendarManager.getActiveCalendar();
    context.hasSeasons = calendar?.seasons?.values?.length > 0;
    if (context.hasSeasons) {
      context.seasons = calendar.seasons.values.map((season, index) => ({ index, name: localize(season.name) }));
      context.seasonTriggers = (config.season || []).map((trigger, index) => {
        const isAll = trigger.seasonIndex === -1;
        const season = isAll ? null : calendar.seasons.values[trigger.seasonIndex];
        return {
          index,
          seasonIndex: trigger.seasonIndex,
          seasonName: isAll ? localize('CALENDARIA.MacroTrigger.AllSeasons') : season ? localize(season.name) : `Season ${trigger.seasonIndex}`,
          macroId: trigger.macroId
        };
      });
    }

    // Moon phase triggers
    context.hasMoons = calendar?.moons?.length > 0;
    if (context.hasMoons) {
      context.moons = calendar.moons.map((moon, index) => ({ index, name: localize(moon.name) }));
      context.moonPhases = {};
      calendar.moons.forEach((moon, moonIndex) => {
        context.moonPhases[moonIndex] = moon.phases?.map((phase, phaseIndex) => ({ index: phaseIndex, name: localize(phase.name) })) || [];
      });

      context.moonTriggers = (config.moonPhase || []).map((trigger, index) => {
        const isAllMoons = trigger.moonIndex === -1;
        const isAllPhases = trigger.phaseIndex === -1;
        const moon = isAllMoons ? null : calendar.moons[trigger.moonIndex];
        const phase = isAllMoons || isAllPhases ? null : moon?.phases?.[trigger.phaseIndex];
        return {
          index,
          moonIndex: trigger.moonIndex,
          moonName: isAllMoons ? localize('CALENDARIA.MacroTrigger.AllMoons') : moon ? localize(moon.name) : `Moon ${trigger.moonIndex}`,
          phaseIndex: trigger.phaseIndex,
          phaseName: isAllPhases ? localize('CALENDARIA.MacroTrigger.AllPhases') : phase ? localize(phase.name) : `Phase ${trigger.phaseIndex}`,
          macroId: trigger.macroId
        };
      });
    }
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
    if ('showMiniCalendar' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_MINI_CALENDAR, data.showMiniCalendar);
    if ('showCalendarHUD' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, data.showCalendarHUD);
    if ('showMoonPhases' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_MOON_PHASES, data.showMoonPhases);
    if ('calendarHUDMode' in data) await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE, data.calendarHUDMode);
    if ('miniCalendarControlsDelay' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CALENDAR_CONTROLS_DELAY, Number(data.miniCalendarControlsDelay));
    if ('darknessSync' in data) await game.settings.set(MODULE.ID, SETTINGS.DARKNESS_SYNC, data.darknessSync);
    if ('advanceTimeOnRest' in data) await game.settings.set(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST, data.advanceTimeOnRest);
    if ('advanceTimeOnCombat' in data) await game.settings.set(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_COMBAT, data.advanceTimeOnCombat);
    if ('syncClockPause' in data) await game.settings.set(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE, data.syncClockPause);
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
    if ('climateZone' in data) await WeatherManager.setActiveZone(data.climateZone);
    if ('miniCalendarStickySection' in data) {
      await game.settings.set(MODULE.ID, SETTINGS.MINI_CALENDAR_STICKY_STATES, {
        timeControls: !!data.miniCalendarStickyTimeControls,
        sidebar: !!data.miniCalendarStickySidebar,
        position: !!data.miniCalendarStickyPosition
      });
      MiniCalendar.refreshStickyStates();
    }

    if ('hudStickySection' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_STICKY_STATES, { tray: !!data.hudStickyTray, position: !!data.hudStickyPosition });
    if ('calendarHUDLocked' in data) await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_LOCKED, data.calendarHUDLocked);
    if ('primaryGM' in data) await game.settings.set(MODULE.ID, SETTINGS.PRIMARY_GM, data.primaryGM || '');
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

    // Macro triggers
    if (data.macroTriggers) {
      const globalTriggerKeys = ['dawn', 'dusk', 'midday', 'midnight', 'newDay'];
      const config = { global: {}, season: [], moonPhase: [] };
      for (const key of globalTriggerKeys) config.global[key] = data.macroTriggers.global?.[key] || '';
      if (data.macroTriggers.seasonTrigger) {
        const triggers = Array.isArray(data.macroTriggers.seasonTrigger) ? data.macroTriggers.seasonTrigger : [data.macroTriggers.seasonTrigger];
        for (const trigger of triggers) if (trigger?.macroId) config.season.push({ seasonIndex: parseInt(trigger.seasonIndex), macroId: trigger.macroId });
      }
      if (data.macroTriggers.moonTrigger) {
        const triggers = Array.isArray(data.macroTriggers.moonTrigger) ? data.macroTriggers.moonTrigger : [data.macroTriggers.moonTrigger];
        for (const trigger of triggers) if (trigger?.macroId) config.moonPhase.push({ moonIndex: parseInt(trigger.moonIndex), phaseIndex: parseInt(trigger.phaseIndex), macroId: trigger.macroId });
      }
      await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    }

    // Display format settings
    if (data.displayFormats) {
      const currentFormats = game.settings.get(MODULE.ID, SETTINGS.DISPLAY_FORMATS);
      const newFormats = { ...currentFormats };
      for (const [locationId, formats] of Object.entries(data.displayFormats)) {
        if (formats) {
          // If preset is 'custom', use custom field; otherwise use the preset name
          let gmFormat = formats.gmPreset === 'custom' ? formats.gmCustom?.trim() : formats.gmPreset;
          let playerFormat = formats.playerPreset === 'custom' ? formats.playerCustom?.trim() : formats.playerPreset;
          // Fallback to 'long' if empty
          newFormats[locationId] = {
            gm: gmFormat || 'long',
            player: playerFormat || 'long'
          };
        }
      }
      await game.settings.set(MODULE.ID, SETTINGS.DISPLAY_FORMATS, newFormats);

      // Trigger re-render of all HUDs to apply new format settings
      Hooks.callAll('calendaria.displayFormatsChanged', newFormats);
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
   * Reset a specific UI position.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onResetPosition(_event, target) {
    const targetType = target.dataset.target;
    const config = {
      miniCalendar: { setting: SETTINGS.MINI_CALENDAR_POSITION, appId: 'mini-calendar' },
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
   * Open the MiniCalendar.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenMiniCalendar(_event, _target) {
    MiniCalendar.show();
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

  /**
   * Add a new moon phase trigger.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onAddMoonTrigger(_event, _target) {
    const moonSelect = this.element.querySelector('select[name="newMoonTrigger.moonIndex"]');
    const phaseSelect = this.element.querySelector('select[name="newMoonTrigger.phaseIndex"]');
    const macroSelect = this.element.querySelector('select[name="newMoonTrigger.macroId"]');
    const moonIndex = parseInt(moonSelect?.value);
    const phaseIndex = parseInt(phaseSelect?.value);
    const macroId = macroSelect?.value;
    if (isNaN(moonIndex) || isNaN(phaseIndex) || !macroId) {
      ui.notifications.warn('CALENDARIA.MacroTrigger.SelectAll', { localize: true });
      return;
    }
    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.moonPhase) config.moonPhase = [];
    const exists = config.moonPhase.some((t) => t.moonIndex === moonIndex && t.phaseIndex === phaseIndex);
    if (exists) {
      ui.notifications.warn('CALENDARIA.MacroTrigger.DuplicateMoon', { localize: true });
      return;
    }
    config.moonPhase.push({ moonIndex, phaseIndex, macroId });
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    this.render({ parts: ['macros'] });
  }

  /**
   * Remove a moon phase trigger.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onRemoveMoonTrigger(_event, target) {
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;
    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.moonPhase) return;
    config.moonPhase.splice(index, 1);
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    this.render({ parts: ['macros'] });
  }

  /**
   * Add a new season trigger.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onAddSeasonTrigger(_event, _target) {
    const seasonSelect = this.element.querySelector('select[name="newSeasonTrigger.seasonIndex"]');
    const macroSelect = this.element.querySelector('select[name="newSeasonTrigger.macroId"]');
    const seasonIndex = parseInt(seasonSelect?.value);
    const macroId = macroSelect?.value;
    if (isNaN(seasonIndex) || !macroId) {
      ui.notifications.warn('CALENDARIA.MacroTrigger.SelectSeasonAndMacro', { localize: true });
      return;
    }
    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.season) config.season = [];
    const exists = config.season.some((t) => t.seasonIndex === seasonIndex);
    if (exists) {
      ui.notifications.warn('CALENDARIA.MacroTrigger.DuplicateSeason', { localize: true });
      return;
    }
    config.season.push({ seasonIndex, macroId });
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    this.render({ parts: ['macros'] });
  }

  /**
   * Remove a season trigger.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onRemoveSeasonTrigger(_event, target) {
    const index = parseInt(target.dataset.index);
    if (isNaN(index)) return;
    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.season) return;
    config.season.splice(index, 1);
    await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    this.render({ parts: ['macros'] });
  }

  /** @inheritdoc */
  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);
    if (partId === 'macros') {
      const moonSelect = htmlElement.querySelector('select[name="newMoonTrigger.moonIndex"]');
      const phaseSelect = htmlElement.querySelector('select[name="newMoonTrigger.phaseIndex"]');
      if (moonSelect && phaseSelect) {
        moonSelect.addEventListener('change', () => {
          const selectedMoon = moonSelect.value;
          const phaseOptions = phaseSelect.querySelectorAll('option[data-moon]');
          phaseOptions.forEach((opt) => {
            if (selectedMoon === '-1') opt.hidden = opt.dataset.moon !== '-1';
            else if (selectedMoon === '') opt.hidden = false;
            else opt.hidden = opt.dataset.moon !== '-1' && opt.dataset.moon !== selectedMoon;
          });
          if (phaseSelect.selectedOptions[0]?.hidden) phaseSelect.value = '';
        });
      }
    }

    // Format preset dropdowns toggle custom input visibility
    if (partId === 'formats') {
      const presetSelects = htmlElement.querySelectorAll('select[name*="Preset"]');
      presetSelects.forEach((select) => {
        select.addEventListener('change', (event) => {
          const locationId = event.target.dataset.location;
          const role = event.target.dataset.role;
          const customInput = htmlElement.querySelector(`input[name="displayFormats.${locationId}.${role}Custom"]`);
          if (customInput) {
            if (event.target.value === 'custom') {
              customInput.classList.remove('hidden');
              customInput.focus();
            } else {
              customInput.classList.add('hidden');
              customInput.value = '';
            }
          }
        });
      });
    }
  }
}
