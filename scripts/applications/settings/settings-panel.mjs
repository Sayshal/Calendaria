/**
 * Unified Settings Panel Application
 * A comprehensive UI for configuring all Calendaria module settings.
 * @module Applications/SettingsPanel
 * @author Tyler
 */

import { BUNDLED_CALENDARS } from '../../calendar/calendar-loader.mjs';
import CalendarManager from '../../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS, TEMPLATES } from '../../constants.mjs';
import TimeClock, { getTimeIncrements } from '../../time/time-clock.mjs';
import { DEFAULT_FORMAT_PRESETS, LOCATION_DEFAULTS, validateFormatString } from '../../utils/format-utils.mjs';
import { format, localize } from '../../utils/localization.mjs';
import { log } from '../../utils/logger.mjs';
import { canChangeActiveCalendar, canViewMiniCal, canViewTimeKeeper } from '../../utils/permissions.mjs';
import { exportSettings, importSettings } from '../../utils/settings-io.mjs';
import { COLOR_CATEGORIES, COLOR_DEFINITIONS, COMPONENT_CATEGORIES, DEFAULT_COLORS, applyCustomColors, applyPreset } from '../../utils/theme-utils.mjs';
import { fromDisplayUnit, getTemperatureUnit, toDisplayUnit } from '../../weather/climate-data.mjs';
import WeatherManager from '../../weather/weather-manager.mjs';
import { BigCal } from '../big-cal.mjs';
import { CalendarEditor } from '../calendar-editor.mjs';
import { HUD } from '../hud.mjs';
import { ImporterApp } from '../importer-app.mjs';
import { MiniCal } from '../mini-cal.mjs';
import { Stopwatch } from '../stopwatch.mjs';
import { TimeKeeper } from '../time-keeper.mjs';
import { TokenReferenceDialog } from '../token-reference-dialog.mjs';

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
    position: { width: 900, height: 835 },
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
      exportTheme: SettingsPanel.#onExportTheme,
      importTheme: SettingsPanel.#onImportTheme,
      openHUD: SettingsPanel.#onOpenHUD,
      closeHUD: SettingsPanel.#onCloseHUD,
      openMiniCal: SettingsPanel.#onOpenMiniCal,
      closeMiniCal: SettingsPanel.#onCloseMiniCal,
      openTimeKeeper: SettingsPanel.#onOpenTimeKeeper,
      closeTimeKeeper: SettingsPanel.#onCloseTimeKeeper,
      openBigCal: SettingsPanel.#onOpenBigCal,
      closeBigCal: SettingsPanel.#onCloseBigCal,
      openStopwatch: SettingsPanel.#onOpenStopwatch,
      closeStopwatch: SettingsPanel.#onCloseStopwatch,
      addMoonTrigger: SettingsPanel.#onAddMoonTrigger,
      removeMoonTrigger: SettingsPanel.#onRemoveMoonTrigger,
      addSeasonTrigger: SettingsPanel.#onAddSeasonTrigger,
      removeSeasonTrigger: SettingsPanel.#onRemoveSeasonTrigger,
      addWeatherPreset: SettingsPanel.#onAddWeatherPreset,
      editWeatherPreset: SettingsPanel.#onEditWeatherPreset,
      removeWeatherPreset: SettingsPanel.#onRemoveWeatherPreset,
      navigateToSetting: SettingsPanel.#onNavigateToSetting,
      showTokenReference: SettingsPanel.#onShowTokenReference,
      resetSection: SettingsPanel.#onResetSection,
      exportSettings: SettingsPanel.#onExportSettings,
      importSettings: SettingsPanel.#onImportSettings
    }
  };

  /** @override */
  static PARTS = {
    tabs: { template: TEMPLATES.TAB_NAVIGATION },
    home: { template: TEMPLATES.SETTINGS.PANEL_HOME, scrollable: [''] },
    notes: { template: TEMPLATES.SETTINGS.PANEL_NOTES, scrollable: [''] },
    time: { template: TEMPLATES.SETTINGS.PANEL_TIME, scrollable: [''] },
    weather: { template: TEMPLATES.SETTINGS.PANEL_WEATHER, scrollable: [''] },
    theme: { template: TEMPLATES.SETTINGS.PANEL_THEME, scrollable: [''] },
    macros: { template: TEMPLATES.SETTINGS.PANEL_MACROS, scrollable: [''] },
    chat: { template: TEMPLATES.SETTINGS.PANEL_CHAT, scrollable: [''] },
    permissions: { template: TEMPLATES.SETTINGS.PANEL_PERMISSIONS, scrollable: [''] },
    canvas: { template: TEMPLATES.SETTINGS.PANEL_CANVAS, scrollable: [''] },
    module: { template: TEMPLATES.SETTINGS.PANEL_MODULE, scrollable: [''] },
    bigcal: { template: TEMPLATES.SETTINGS.PANEL_BIGCAL, scrollable: [''] },
    miniCal: { template: TEMPLATES.SETTINGS.PANEL_MINI_CAL, scrollable: [''] },
    hud: { template: TEMPLATES.SETTINGS.PANEL_HUD, scrollable: [''] },
    timekeeper: { template: TEMPLATES.SETTINGS.PANEL_TIMEKEEPER, scrollable: [''] },
    stopwatch: { template: TEMPLATES.SETTINGS.PANEL_STOPWATCH, scrollable: [''] },
    footer: { template: TEMPLATES.SETTINGS.PANEL_FOOTER }
  };

  /** Tab group definitions with colors */
  static TAB_GROUPS = [
    { id: 'calendar', label: 'CALENDARIA.SettingsPanel.Group.Calendar', tooltip: 'CALENDARIA.SettingsPanel.GroupTooltip.Calendar', color: '#84cc16' },
    { id: 'technical', label: 'CALENDARIA.SettingsPanel.Group.Technical', tooltip: 'CALENDARIA.SettingsPanel.GroupTooltip.Technical', color: '#f97316' },
    { id: 'apps', label: 'CALENDARIA.SettingsPanel.Group.Apps', tooltip: 'CALENDARIA.SettingsPanel.GroupTooltip.Apps', color: '#14b8a6' }
  ];

  /** @override */
  static TABS = {
    primary: {
      tabs: [
        { id: 'home', group: 'primary', icon: 'fas fa-house', label: 'CALENDARIA.SettingsPanel.Tab.Home', color: '#ff144f' },
        { id: 'notes', group: 'primary', icon: 'fas fa-sticky-note', label: 'CALENDARIA.Common.Notes', tabGroup: 'calendar', gmOnly: true },
        { id: 'time', group: 'primary', icon: 'fas fa-clock', label: 'CALENDARIA.Common.Time', tabGroup: 'calendar', gmOnly: true },
        { id: 'weather', group: 'primary', icon: 'fas fa-cloud-sun', label: 'CALENDARIA.Common.Weather', tabGroup: 'calendar', gmOnly: true },
        { id: 'theme', group: 'primary', icon: 'fas fa-palette', label: 'CALENDARIA.SettingsPanel.Tab.Theme', tabGroup: 'calendar' },
        { id: 'macros', group: 'primary', icon: 'fas fa-bolt', label: 'CALENDARIA.SettingsPanel.Tab.Macros', tabGroup: 'technical', gmOnly: true },
        { id: 'chat', group: 'primary', icon: 'fas fa-comments', label: 'CALENDARIA.SettingsPanel.Tab.Chat', tabGroup: 'technical', gmOnly: true },
        { id: 'permissions', group: 'primary', icon: 'fas fa-user-shield', label: 'CALENDARIA.SettingsPanel.Tab.Permissions', tabGroup: 'technical', gmOnly: true },
        { id: 'canvas', group: 'primary', icon: 'fas fa-map', label: 'CALENDARIA.SettingsPanel.Tab.Canvas', tabGroup: 'technical', gmOnly: true },
        { id: 'module', group: 'primary', icon: 'fas fa-tools', label: 'CALENDARIA.SettingsPanel.Tab.Module', tabGroup: 'technical' },
        { id: 'bigcal', group: 'primary', icon: 'fas fa-calendar-days', label: 'CALENDARIA.SettingsPanel.Tab.BigCal', tabGroup: 'apps' },
        { id: 'miniCal', group: 'primary', icon: 'fas fa-compress', label: 'CALENDARIA.SettingsPanel.Tab.MiniCal', tabGroup: 'apps' },
        { id: 'hud', group: 'primary', icon: 'fas fa-sun', label: 'CALENDARIA.SettingsPanel.Tab.HUD', tabGroup: 'apps' },
        { id: 'timekeeper', group: 'primary', icon: 'fas fa-gauge', label: 'CALENDARIA.SettingsPanel.Tab.TimeKeeper', tabGroup: 'apps', gmOnly: true },
        { id: 'stopwatch', group: 'primary', icon: 'fas fa-stopwatch', label: 'CALENDARIA.SettingsPanel.Tab.Stopwatch', tabGroup: 'apps', gmOnly: true }
      ],
      initial: 'home'
    }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.isGM = game.user.isGM;
    const { tabGroups, ungroupedTabs } = this.#prepareTabGroups();
    context.tabGroups = tabGroups;
    context.ungroupedTabs = ungroupedTabs;
    context.showSearch = true;
    context.searchPlaceholder = 'CALENDARIA.SettingsPanel.Search.Placeholder';
    context.searchLabel = 'CALENDARIA.SettingsPanel.Search.Label';
    return context;
  }

  /**
   * Prepare grouped and ungrouped tabs for template rendering.
   * @returns {{tabGroups: Array<object>, ungroupedTabs: Array<object>}} Tab groups and ungrouped tabs
   */
  #prepareTabGroups() {
    const isGM = game.user.isGM;
    const activeTab = this.tabGroups.primary || 'home';

    const filterTab = (tab) => {
      if (tab.gmOnly && !isGM) return false;
      if (tab.id === 'miniCal' && !canViewMiniCal()) return false;
      if (tab.id === 'timekeeper' && !canViewTimeKeeper()) return false;
      return true;
    };

    const mapTab = (tab) => ({
      ...tab,
      group: 'primary',
      active: tab.id === activeTab,
      cssClass: tab.id === activeTab ? 'active' : ''
    });

    const ungroupedTabs = SettingsPanel.TABS.primary.tabs
      .filter((tab) => !tab.tabGroup)
      .filter(filterTab)
      .map(mapTab);

    const tabGroups = SettingsPanel.TAB_GROUPS.map((group) => {
      const groupTabs = SettingsPanel.TABS.primary.tabs
        .filter((tab) => tab.tabGroup === group.id)
        .filter(filterTab)
        .map(mapTab);
      return { ...group, tabs: groupTabs };
    }).filter((group) => group.tabs.length > 0);

    return { tabGroups, ungroupedTabs };
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const themeModeSelect = this.element.querySelector('select[name="themeMode"]');
    if (themeModeSelect && !themeModeSelect.dataset.listenerAttached) {
      themeModeSelect.dataset.listenerAttached = 'true';
      themeModeSelect.addEventListener('change', async (e) => {
        const mode = e.target.value;
        if (!mode) return;
        await game.settings.set(MODULE.ID, SETTINGS.THEME_MODE, mode);
        if (mode === 'custom') {
          const customColors = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS) || {};
          applyCustomColors({ ...DEFAULT_COLORS, ...customColors });
        } else applyPreset(mode);
        this.render({ force: true, parts: ['theme'] });
      });
    }

    if (!this.element.dataset.formListenerAttached) {
      this.element.dataset.formListenerAttached = 'true';
      this.element.addEventListener('change', () => this.#setSaveIndicator('saving'));
    }

    this.#setupSearchListeners();
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    this.#destroySearchDropdown();
  }

  /** Track save indicator state across re-renders */
  #saveState = 'saved';

  /** Timeout ID for resetting save indicator */
  #saveTimeout = null;

  /**
   * Update the save indicator state.
   * @param {'saved'|'saving'} state - The indicator state
   */
  #setSaveIndicator(state) {
    this.#saveState = state;
    const indicator = this.element?.querySelector('.save-indicator');
    if (!indicator) return;
    indicator.dataset.state = state;
    const icon = indicator.querySelector('i');
    const text = indicator.childNodes[indicator.childNodes.length - 1];
    if (state === 'saving') {
      if (icon) icon.className = 'fas fa-sync fa-spin';
      if (text?.nodeType === Node.TEXT_NODE) text.textContent = localize('CALENDARIA.SettingsPanel.Footer.Saving');
    } else {
      if (icon) icon.className = 'fas fa-check';
      if (text?.nodeType === Node.TEXT_NODE) text.textContent = localize('CALENDARIA.SettingsPanel.Footer.Saved');
    }
  }

  /** Cached search index */
  #searchIndex = null;

  /**
   * Build the search index from SETTING_METADATA.
   * @returns {Array<object>} Array of searchable items
   */
  #buildSearchIndex() {
    if (this.#searchIndex) return this.#searchIndex;
    const index = [];
    const settingLabels = new Set();
    for (const [key, meta] of Object.entries(SettingsPanel.SETTING_METADATA)) {
      const label = localize(meta.label);
      const hintKey = meta.label.replace('.Name', '.Hint');
      const hint = game.i18n.has(hintKey) ? localize(hintKey) : '';
      const tabDef = SettingsPanel.TABS.primary.tabs.find((t) => t.id === meta.tab);
      const tabLabel = tabDef ? localize(tabDef.label) : meta.tab;
      index.push({ type: 'setting', key, tab: meta.tab, tabLabel, label, searchText: `${label} ${hint}`.toLowerCase() });
      settingLabels.add(`${meta.tab}:${label.toLowerCase()}`);
    }
    this.element.querySelectorAll('fieldset[data-section]').forEach((fieldset) => {
      const legend = fieldset.querySelector(':scope > legend');
      if (!legend) return;
      const label = legend.textContent.trim();
      if (!label) return;
      const tabEl = fieldset.closest('[data-tab]');
      if (!tabEl) return;
      const tab = tabEl.dataset.tab;
      if (settingLabels.has(`${tab}:${label.toLowerCase()}`)) return;
      const tabDef = SettingsPanel.TABS.primary.tabs.find((t) => t.id === tab);
      const tabLabel = tabDef ? localize(tabDef.label) : tab;
      const fieldsetId = fieldset.dataset.section;
      index.push({ type: 'fieldset', key: `${tab}:${fieldsetId}`, tab, tabLabel, label, searchText: label.toLowerCase() });
    });
    this.#searchIndex = index;
    return index;
  }

  /** Reference to the search results dropdown appended to body */
  #searchDropdown = null;

  /**
   * Setup search input listeners.
   */
  #setupSearchListeners() {
    const searchInput = this.element.querySelector('input[name="navSearch"]');
    if (!searchInput || searchInput.dataset.listenerAttached) return;
    searchInput.dataset.listenerAttached = 'true';
    let searchTimeout = null;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const query = e.target.value.trim().toLowerCase();
      if (query.length < 2) {
        this.#destroySearchDropdown();
        return;
      }
      searchTimeout = setTimeout(() => this.#performSearch(query, searchInput), 150);
    });
    searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.#destroySearchDropdown();
        searchInput.value = '';
        searchInput.blur();
      }
    });
    document.addEventListener('click', (e) => {
      if (!this.#searchDropdown) return;
      if (!searchInput.contains(e.target) && !this.#searchDropdown.contains(e.target)) {
        this.#destroySearchDropdown();
        searchInput.value = '';
      }
    });
  }

  /**
   * Destroy the search dropdown if it exists.
   */
  #destroySearchDropdown() {
    if (this.#searchDropdown) {
      this.#searchDropdown.remove();
      this.#searchDropdown = null;
    }
  }

  /**
   * Create and return the search dropdown, appending to body.
   * @returns {HTMLElement} The dropdown element
   */
  #getOrCreateSearchDropdown() {
    if (!this.#searchDropdown) {
      this.#searchDropdown = document.createElement('div');
      this.#searchDropdown.className = 'calendaria-search-results';
      document.body.appendChild(this.#searchDropdown);
    }
    return this.#searchDropdown;
  }

  /**
   * Position the search results dropdown using fixed positioning.
   * @param {HTMLElement} container - Results container
   * @param {HTMLElement} searchInput - The search input element
   */
  #positionSearchResults(container, searchInput) {
    const rect = searchInput.getBoundingClientRect();
    const dropdownWidth = rect.width * 1.5;
    const leftOffset = (dropdownWidth - rect.width) / 2;
    container.style.top = `${rect.bottom + 4}px`;
    container.style.left = `${rect.left - leftOffset}px`;
    container.style.width = `${dropdownWidth}px`;
  }

  /**
   * Perform search and display results.
   * @param {string} query - Search query
   * @param {HTMLElement} searchInput - The search input element
   */
  #performSearch(query, searchInput) {
    const container = this.#getOrCreateSearchDropdown();
    const index = this.#buildSearchIndex();
    const results = index.filter((item) => item.searchText.includes(query)).slice(0, 10);
    if (results.length === 0) {
      container.innerHTML = `<div class="no-results">${localize('CALENDARIA.SettingsPanel.Search.NoResults')}</div>`;
      this.#positionSearchResults(container, searchInput);
      return;
    }
    container.innerHTML = results
      .map(
        (item) => `
      <button type="button" class="search-result" data-tab="${item.tab}" data-key="${item.key}" data-type="${item.type}">
        <span class="result-label">${item.label}</span>
        <span class="result-tab">${item.tabLabel}</span>
      </button>
    `
      )
      .join('');
    this.#positionSearchResults(container, searchInput);
    container.querySelectorAll('.search-result').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        this.#onSearchResultClick(btn.dataset.tab, btn.dataset.key, btn.dataset.type);
      });
    });
  }

  /**
   * Handle search result click - navigate to tab and highlight element.
   * @param {string} tab - Tab ID
   * @param {string} key - Setting key or fieldset ID
   * @param {string} type - Result type ('setting' or 'fieldset')
   */
  #onSearchResultClick(tab, key, type) {
    const searchInput = this.element.querySelector('input[name="navSearch"]');
    if (searchInput) searchInput.value = '';
    this.#destroySearchDropdown();
    this.changeTab(tab, 'primary');
    setTimeout(() => {
      const tabContent = this.element.querySelector(`section.tab[data-tab="${tab}"]`);
      if (!tabContent) return;
      let targetEl;
      if (type === 'fieldset') {
        const fieldsetId = key.includes(':') ? key.split(':')[1] : key;
        targetEl = tabContent.querySelector(`fieldset[data-section="${fieldsetId}"]`);
      } else {
        const settingEl = tabContent.querySelector(`[name="${key}"], [data-setting="${key}"]`);
        targetEl = settingEl?.closest('.form-group') || settingEl?.closest('fieldset') || settingEl;
        if (!targetEl) {
          for (const [sectionId, settingKeys] of Object.entries(SettingsPanel.SECTION_SETTINGS)) {
            if (settingKeys.includes(key)) {
              targetEl = tabContent.querySelector(`fieldset[data-section="${sectionId}"]`);
              break;
            }
          }
        }
      }
      if (targetEl) {
        const containerRect = tabContent.getBoundingClientRect();
        const targetRect = targetEl.getBoundingClientRect();
        const scrollTop = tabContent.scrollTop + (targetRect.top - containerRect.top) - 16;
        tabContent.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' });
        targetEl.classList.add('search-highlight');
        setTimeout(() => targetEl.classList.remove('search-highlight'), 2000);
      }
    }, 100);
  }

  /** @override */
  _prepareTabs(group, options) {
    const tabs = super._prepareTabs(group, options);
    if (!game.user.isGM && tabs && typeof tabs === 'object') {
      const filtered = {};
      for (const [id, tab] of Object.entries(tabs)) {
        const tabDef = SettingsPanel.TABS.primary.tabs.find((t) => t.id === id);
        if (tabDef?.gmOnly) continue;
        if (id === 'miniCal' && !canViewMiniCal()) continue;
        if (id === 'timekeeper' && !canViewTimeKeeper()) continue;
        filtered[id] = tab;
      }
      const activeTab = this.tabGroups[group];
      const activeTabDef = SettingsPanel.TABS.primary.tabs.find((t) => t.id === activeTab);
      const isActiveHidden = activeTabDef?.gmOnly || (activeTab === 'miniCal' && !canViewMiniCal()) || (activeTab === 'timekeeper' && !canViewTimeKeeper());
      if (isActiveHidden) {
        this.tabGroups[group] = 'theme';
        for (const tab of Object.values(filtered)) {
          tab.active = tab.id === 'theme';
          tab.cssClass = tab.id === 'theme' ? 'active' : tab.cssClass?.replace('active', '').trim() || undefined;
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
      case 'home':
        await this.#prepareHomeContext(context);
        break;
      case 'notes':
        await this.#prepareNotesContext(context);
        break;
      case 'time':
        await this.#prepareTimeContext(context);
        break;
      case 'weather':
        await this.#prepareWeatherContext(context);
        break;
      case 'theme':
        await this.#prepareThemeContext(context);
        break;
      case 'macros':
        await this.#prepareMacrosContext(context);
        break;
      case 'chat':
        await this.#prepareChatContext(context);
        break;
      case 'permissions':
        await this.#preparePermissionsContext(context);
        break;
      case 'canvas':
        await this.#prepareCanvasContext(context);
        break;
      case 'module':
        await this.#prepareModuleContext(context);
        break;
      case 'bigcal':
        await this.#prepareBigCalContext(context);
        break;
      case 'miniCal':
        await this.#prepareMiniCalContext(context);
        break;
      case 'hud':
        await this.#prepareHUDContext(context);
        break;
      case 'timekeeper':
        await this.#prepareTimeKeeperContext(context);
        break;
      case 'stopwatch':
        await this.#prepareStopwatchContext(context);
        break;
      case 'footer':
        await this.#prepareFooterContext(context);
        break;
    }
    return context;
  }

  /**
   * Prepare context for the Home tab.
   * @param {object} context - The context object
   */
  async #prepareHomeContext(context) {
    const activeCalendarId = game.settings.get(MODULE.ID, SETTINGS.ACTIVE_CALENDAR);
    const customCalendars = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_CALENDARS) || {};
    const showToPlayers = game.settings.get(MODULE.ID, SETTINGS.SHOW_ACTIVE_CALENDAR_TO_PLAYERS);
    context.showActiveCalendar = context.isGM || showToPlayers;
    context.showActiveCalendarToPlayers = showToPlayers;
    context.canChangeCalendar = context.isGM || canChangeActiveCalendar();
    context.calendarOptions = [];
    for (const id of BUNDLED_CALENDARS) {
      const key = id
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      context.calendarOptions.push({ value: id, label: localize(`CALENDARIA.Calendar.${key}.Name`), selected: id === activeCalendarId, isCustom: false });
    }
    for (const [id, data] of Object.entries(customCalendars))
      context.calendarOptions.push({ value: id, label: localize(data.name) || data.name || id, selected: id === activeCalendarId, isCustom: true });
    context.calendarOptions.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    context.recentSettings = this.#prepareRecentSettings();
  }

  /**
   * Metadata for settings - maps setting keys to their tab and label.
   * Used for recent settings tracking.
   */
  static SETTING_METADATA = {
    [SETTINGS.ACTIVE_CALENDAR]: { tab: 'home', label: 'CALENDARIA.Settings.ActiveCalendar.Name' },
    [SETTINGS.SHOW_ACTIVE_CALENDAR_TO_PLAYERS]: { tab: 'home', label: 'CALENDARIA.Settings.ShowActiveCalendarToPlayers.Name' },
    [SETTINGS.ADVANCE_TIME_ON_REST]: { tab: 'time', label: 'CALENDARIA.Settings.AdvanceTimeOnRest.Name' },
    [SETTINGS.SYNC_CLOCK_PAUSE]: { tab: 'time', label: 'CALENDARIA.Settings.SyncClockPause.Name' },
    [SETTINGS.TIME_SPEED_MULTIPLIER]: { tab: 'time', label: 'CALENDARIA.Settings.TimeSpeedMultiplier.Name' },
    [SETTINGS.TIME_SPEED_INCREMENT]: { tab: 'time', label: 'CALENDARIA.Settings.TimeSpeedIncrement.Name' },
    [SETTINGS.TEMPERATURE_UNIT]: { tab: 'weather', label: 'CALENDARIA.Settings.TemperatureUnit.Name' },
    [SETTINGS.THEME_MODE]: { tab: 'theme', label: 'CALENDARIA.ThemeEditor.PresetSelect' },
    [SETTINGS.CUSTOM_THEME_COLORS]: { tab: 'theme', label: 'CALENDARIA.SettingsPanel.Section.Theme' },
    [SETTINGS.CHAT_TIMESTAMP_MODE]: { tab: 'chat', label: 'CALENDARIA.Settings.ChatTimestampMode.Name' },
    [SETTINGS.CHAT_TIMESTAMP_SHOW_TIME]: { tab: 'chat', label: 'CALENDARIA.Settings.ChatTimestampShowTime.Name' },
    [SETTINGS.PERMISSIONS]: { tab: 'permissions', label: 'CALENDARIA.SettingsPanel.Tab.Permissions' },
    [SETTINGS.HUD_STICKY_ZONES_ENABLED]: { tab: 'canvas', label: 'CALENDARIA.Settings.StickyZones.Name' },
    [SETTINGS.ALLOW_SIDEBAR_OVERLAP]: { tab: 'canvas', label: 'CALENDARIA.Settings.AllowSidebarOverlap.Name' },
    [SETTINGS.DARKNESS_SYNC]: { tab: 'canvas', label: 'CALENDARIA.Settings.DarknessSync.Name' },
    [SETTINGS.DARKNESS_SYNC_ALL_SCENES]: { tab: 'canvas', label: 'CALENDARIA.Settings.DarknessSyncAllScenes.Name' },
    [SETTINGS.DARKNESS_WEATHER_SYNC]: { tab: 'canvas', label: 'CALENDARIA.Settings.DarknessWeatherSync.Name' },
    [SETTINGS.AMBIENCE_SYNC]: { tab: 'canvas', label: 'CALENDARIA.Settings.AmbienceSync.Name' },
    [SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER]: { tab: 'canvas', label: 'CALENDARIA.Settings.DefaultBrightnessMultiplier.Name' },
    [SETTINGS.PRIMARY_GM]: { tab: 'module', label: 'CALENDARIA.Settings.PrimaryGM.Name' },
    [SETTINGS.LOGGING_LEVEL]: { tab: 'module', label: 'CALENDARIA.Settings.Logger.Name' },
    [SETTINGS.DEV_MODE]: { tab: 'module', label: 'CALENDARIA.SettingsPanel.DevMode.Name' },
    [SETTINGS.SHOW_TOOLBAR_BUTTON]: { tab: 'module', label: 'CALENDARIA.Settings.ShowToolbarButton.Name' },
    [SETTINGS.TOOLBAR_APPS]: { tab: 'module', label: 'CALENDARIA.Settings.ToolbarApps.Name' },
    [SETTINGS.SHOW_JOURNAL_FOOTER]: { tab: 'module', label: 'CALENDARIA.Settings.ShowJournalFooter.Name' },
    [SETTINGS.SHOW_CALENDAR_HUD]: { tab: 'hud', label: 'CALENDARIA.Settings.ShowCalendarHUD.Name' },
    [SETTINGS.FORCE_HUD]: { tab: 'hud', label: 'CALENDARIA.Settings.ForceHUD.Name' },
    [SETTINGS.CALENDAR_HUD_LOCKED]: { tab: 'hud', label: 'CALENDARIA.Settings.CalendarHUDLocked.Name' },
    [SETTINGS.CALENDAR_HUD_MODE]: { tab: 'hud', label: 'CALENDARIA.Settings.CalendarHUDMode.Name' },
    [SETTINGS.HUD_DIAL_STYLE]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDDialStyle.Name' },
    [SETTINGS.HUD_TRAY_DIRECTION]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDTrayDirection.Name' },
    [SETTINGS.HUD_COMBAT_COMPACT]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDCombatCompact.Name' },
    [SETTINGS.HUD_COMBAT_HIDE]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDCombatHide.Name' },
    [SETTINGS.HUD_DOME_AUTO_HIDE]: { tab: 'hud', label: 'CALENDARIA.Settings.DomeAutoHide.Name' },
    [SETTINGS.HUD_AUTO_FADE]: { tab: 'hud', label: 'CALENDARIA.Settings.AutoFade.Name' },
    [SETTINGS.HUD_IDLE_OPACITY]: { tab: 'hud', label: 'CALENDARIA.Settings.IdleOpacity.Name' },
    [SETTINGS.HUD_WIDTH_SCALE]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDWidthScale.Name' },
    [SETTINGS.HUD_SHOW_WEATHER]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDShowWeather.Name' },
    [SETTINGS.HUD_SHOW_SEASON]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDShowSeason.Name' },
    [SETTINGS.HUD_SHOW_ERA]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDShowEra.Name' },
    [SETTINGS.HUD_SHOW_CYCLES]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDShowCycles.Name' },
    [SETTINGS.HUD_WEATHER_DISPLAY_MODE]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDWeatherDisplayMode.Name' },
    [SETTINGS.HUD_SEASON_DISPLAY_MODE]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDSeasonDisplayMode.Name' },
    [SETTINGS.HUD_ERA_DISPLAY_MODE]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDEraDisplayMode.Name' },
    [SETTINGS.HUD_CYCLES_DISPLAY_MODE]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDCyclesDisplayMode.Name' },
    [SETTINGS.HUD_STICKY_STATES]: { tab: 'hud', label: 'CALENDARIA.SettingsPanel.Section.StickyStates' },
    [SETTINGS.CUSTOM_TIME_JUMPS]: { tab: 'hud', label: 'CALENDARIA.SettingsPanel.Section.CustomTimeJumps' },
    [SETTINGS.DISPLAY_FORMATS]: { tab: 'hud', label: 'CALENDARIA.SettingsPanel.Section.DisplayFormats' },
    [SETTINGS.SHOW_MINI_CAL]: { tab: 'miniCal', label: 'CALENDARIA.Settings.ShowMiniCal.Name' },
    [SETTINGS.FORCE_MINI_CAL]: { tab: 'miniCal', label: 'CALENDARIA.Settings.ForceMiniCal.Name' },
    [SETTINGS.MINI_CAL_AUTO_FADE]: { tab: 'miniCal', label: 'CALENDARIA.Settings.AutoFade.Name' },
    [SETTINGS.MINI_CAL_IDLE_OPACITY]: { tab: 'miniCal', label: 'CALENDARIA.Settings.IdleOpacity.Name' },
    [SETTINGS.MINI_CAL_CONTROLS_DELAY]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalControlsDelay.Name' },
    [SETTINGS.MINI_CAL_CONFIRM_SET_DATE]: { tab: 'miniCal', label: 'CALENDARIA.Settings.ConfirmSetDate.Name' },
    [SETTINGS.MINI_CAL_SHOW_WEATHER]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalShowWeather.Name' },
    [SETTINGS.MINI_CAL_SHOW_SEASON]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalShowSeason.Name' },
    [SETTINGS.MINI_CAL_SHOW_ERA]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalShowEra.Name' },
    [SETTINGS.MINI_CAL_SHOW_CYCLES]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalShowCycles.Name' },
    [SETTINGS.MINI_CAL_SHOW_MOON_PHASES]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalShowMoonPhases.Name' },
    [SETTINGS.MINI_CAL_WEATHER_DISPLAY_MODE]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalWeatherDisplayMode.Name' },
    [SETTINGS.MINI_CAL_SEASON_DISPLAY_MODE]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalSeasonDisplayMode.Name' },
    [SETTINGS.MINI_CAL_ERA_DISPLAY_MODE]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalEraDisplayMode.Name' },
    [SETTINGS.MINI_CAL_CYCLES_DISPLAY_MODE]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalCyclesDisplayMode.Name' },
    [SETTINGS.MINI_CAL_STICKY_STATES]: { tab: 'miniCal', label: 'CALENDARIA.SettingsPanel.Section.StickyStates' },
    [SETTINGS.MINI_CAL_TIME_JUMPS]: { tab: 'miniCal', label: 'CALENDARIA.SettingsPanel.Section.CustomTimeJumps' },
    [SETTINGS.BIG_CAL_SHOW_WEATHER]: { tab: 'bigcal', label: 'CALENDARIA.Settings.BigCalShowWeather.Name' },
    [SETTINGS.BIG_CAL_SHOW_SEASON]: { tab: 'bigcal', label: 'CALENDARIA.Settings.BigCalShowSeason.Name' },
    [SETTINGS.BIG_CAL_SHOW_ERA]: { tab: 'bigcal', label: 'CALENDARIA.Settings.BigCalShowEra.Name' },
    [SETTINGS.BIG_CAL_SHOW_CYCLES]: { tab: 'bigcal', label: 'CALENDARIA.Settings.BigCalShowCycles.Name' },
    [SETTINGS.BIG_CAL_SHOW_MOON_PHASES]: { tab: 'bigcal', label: 'CALENDARIA.Settings.BigCalShowMoonPhases.Name' },
    [SETTINGS.BIG_CAL_WEATHER_DISPLAY_MODE]: { tab: 'bigcal', label: 'CALENDARIA.Settings.BigCalWeatherDisplayMode.Name' },
    [SETTINGS.BIG_CAL_SEASON_DISPLAY_MODE]: { tab: 'bigcal', label: 'CALENDARIA.Settings.BigCalSeasonDisplayMode.Name' },
    [SETTINGS.BIG_CAL_ERA_DISPLAY_MODE]: { tab: 'bigcal', label: 'CALENDARIA.Settings.BigCalEraDisplayMode.Name' },
    [SETTINGS.BIG_CAL_CYCLES_DISPLAY_MODE]: { tab: 'bigcal', label: 'CALENDARIA.Settings.BigCalCyclesDisplayMode.Name' },
    [SETTINGS.SHOW_TIME_KEEPER]: { tab: 'timekeeper', label: 'CALENDARIA.Settings.ShowTimeKeeper.Name' },
    [SETTINGS.TIMEKEEPER_AUTO_FADE]: { tab: 'timekeeper', label: 'CALENDARIA.Settings.AutoFade.Name' },
    [SETTINGS.TIMEKEEPER_IDLE_OPACITY]: { tab: 'timekeeper', label: 'CALENDARIA.Settings.IdleOpacity.Name' },
    [SETTINGS.TIMEKEEPER_TIME_JUMPS]: { tab: 'timekeeper', label: 'CALENDARIA.SettingsPanel.Section.CustomTimeJumps' },
    [SETTINGS.STOPWATCH_AUTO_START_TIME]: { tab: 'stopwatch', label: 'CALENDARIA.Settings.StopwatchAutoStartTime.Name' },
    [SETTINGS.CUSTOM_CATEGORIES]: { tab: 'notes', label: 'CALENDARIA.SettingsPanel.Section.Categories' },
    [SETTINGS.MACRO_TRIGGERS]: { tab: 'macros', label: 'CALENDARIA.SettingsPanel.Tab.Macros' },
    [SETTINGS.CUSTOM_WEATHER_PRESETS]: { tab: 'weather', label: 'CALENDARIA.SettingsPanel.Section.WeatherPresets' }
  };

  /**
   * Mapping of section IDs to their associated settings.
   * Used for per-section reset functionality.
   */
  static SECTION_SETTINGS = {
    // HUD tab sections
    'hud-display': [
      SETTINGS.SHOW_CALENDAR_HUD,
      SETTINGS.FORCE_HUD,
      SETTINGS.CALENDAR_HUD_MODE,
      SETTINGS.HUD_DIAL_STYLE,
      SETTINGS.HUD_TRAY_DIRECTION,
      SETTINGS.HUD_COMBAT_COMPACT,
      SETTINGS.HUD_COMBAT_HIDE,
      SETTINGS.HUD_DOME_AUTO_HIDE,
      SETTINGS.HUD_AUTO_FADE,
      SETTINGS.HUD_IDLE_OPACITY,
      SETTINGS.HUD_WIDTH_SCALE
    ],
    'hud-block-visibility': [
      SETTINGS.HUD_SHOW_WEATHER,
      SETTINGS.HUD_WEATHER_DISPLAY_MODE,
      SETTINGS.HUD_SHOW_SEASON,
      SETTINGS.HUD_SEASON_DISPLAY_MODE,
      SETTINGS.HUD_SHOW_ERA,
      SETTINGS.HUD_ERA_DISPLAY_MODE,
      SETTINGS.HUD_SHOW_CYCLES,
      SETTINGS.HUD_CYCLES_DISPLAY_MODE
    ],
    'hud-sticky': [SETTINGS.HUD_STICKY_STATES, SETTINGS.CALENDAR_HUD_LOCKED],
    'hud-time-jumps': [SETTINGS.CUSTOM_TIME_JUMPS],
    // MiniCal tab sections
    'minical-display': [
      SETTINGS.SHOW_MINI_CAL,
      SETTINGS.FORCE_MINI_CAL,
      SETTINGS.MINI_CAL_AUTO_FADE,
      SETTINGS.MINI_CAL_IDLE_OPACITY,
      SETTINGS.MINI_CAL_CONTROLS_DELAY,
      SETTINGS.MINI_CAL_CONFIRM_SET_DATE
    ],
    'minical-block-visibility': [
      SETTINGS.MINI_CAL_SHOW_WEATHER,
      SETTINGS.MINI_CAL_WEATHER_DISPLAY_MODE,
      SETTINGS.MINI_CAL_SHOW_SEASON,
      SETTINGS.MINI_CAL_SEASON_DISPLAY_MODE,
      SETTINGS.MINI_CAL_SHOW_ERA,
      SETTINGS.MINI_CAL_ERA_DISPLAY_MODE,
      SETTINGS.MINI_CAL_SHOW_CYCLES,
      SETTINGS.MINI_CAL_CYCLES_DISPLAY_MODE,
      SETTINGS.MINI_CAL_SHOW_MOON_PHASES
    ],
    'minical-sticky': [SETTINGS.MINI_CAL_STICKY_STATES],
    'minical-time-jumps': [SETTINGS.MINI_CAL_TIME_JUMPS],
    // BigCal tab sections
    'bigcal-block-visibility': [
      SETTINGS.BIG_CAL_SHOW_WEATHER,
      SETTINGS.BIG_CAL_WEATHER_DISPLAY_MODE,
      SETTINGS.BIG_CAL_SHOW_SEASON,
      SETTINGS.BIG_CAL_SEASON_DISPLAY_MODE,
      SETTINGS.BIG_CAL_SHOW_ERA,
      SETTINGS.BIG_CAL_ERA_DISPLAY_MODE,
      SETTINGS.BIG_CAL_SHOW_CYCLES,
      SETTINGS.BIG_CAL_CYCLES_DISPLAY_MODE,
      SETTINGS.BIG_CAL_SHOW_MOON_PHASES
    ],
    // TimeKeeper tab sections
    'timekeeper-display': [SETTINGS.SHOW_TIME_KEEPER, SETTINGS.TIMEKEEPER_AUTO_FADE, SETTINGS.TIMEKEEPER_IDLE_OPACITY],
    'timekeeper-sticky': [SETTINGS.TIMEKEEPER_STICKY_STATES],
    'timekeeper-time-jumps': [SETTINGS.TIMEKEEPER_TIME_JUMPS],
    // Stopwatch tab sections
    'stopwatch-display': [SETTINGS.STOPWATCH_AUTO_START_TIME],
    'stopwatch-sticky': [SETTINGS.STOPWATCH_STICKY_STATES],
    // Time tab sections
    'time-realtime': [SETTINGS.TIME_SPEED_MULTIPLIER, SETTINGS.TIME_SPEED_INCREMENT],
    'time-integration': [SETTINGS.ADVANCE_TIME_ON_REST, SETTINGS.SYNC_CLOCK_PAUSE],
    // Chat tab sections
    'chat-timestamps': [SETTINGS.CHAT_TIMESTAMP_MODE, SETTINGS.CHAT_TIMESTAMP_SHOW_TIME],
    // Canvas tab sections
    'canvas-sticky-zones': [SETTINGS.HUD_STICKY_ZONES_ENABLED, SETTINGS.ALLOW_SIDEBAR_OVERLAP],
    'canvas-scene-integration': [SETTINGS.DARKNESS_SYNC, SETTINGS.DARKNESS_WEATHER_SYNC, SETTINGS.AMBIENCE_SYNC, SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER],
    // Weather tab sections
    'weather-temperature': [SETTINGS.TEMPERATURE_UNIT],
    // Module tab sections
    'module-sync': [SETTINGS.PRIMARY_GM],
    'module-integration': [SETTINGS.SHOW_TOOLBAR_BUTTON, SETTINGS.TOOLBAR_APPS, SETTINGS.SHOW_JOURNAL_FOOTER],
    'module-debugging': [SETTINGS.DEV_MODE, SETTINGS.LOGGING_LEVEL],
    // Permissions tab sections
    permissions: [SETTINGS.PERMISSIONS],
    // Theme tab sections
    theme: [SETTINGS.CUSTOM_THEME_COLORS, SETTINGS.THEME_MODE]
  };

  /**
   * Prepare recently changed settings for display.
   * @returns {Array<object>} Array of recent setting changes
   */
  #prepareRecentSettings() {
    const recentData = game.user.getFlag(MODULE.ID, 'recentSettings') || [];
    const now = Date.now();
    const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
    return recentData
      .filter((s) => s.timestamp > oneWeekAgo)
      .slice(0, 10)
      .map((s) => ({ ...s, timeAgo: foundry.utils.timeSince(new Date(s.timestamp)) }));
  }

  /**
   * Track changed settings by comparing before/after snapshots.
   * @param {object} beforeSnapshot - Settings values before changes
   * @param {object} afterSnapshot - Settings values after changes
   */
  static async #trackChangedSettings(beforeSnapshot, afterSnapshot) {
    const recentData = game.user.getFlag(MODULE.ID, 'recentSettings') || [];
    const now = Date.now();
    let changed = false;
    for (const [key, beforeValue] of Object.entries(beforeSnapshot)) {
      const afterValue = afterSnapshot[key];
      if (JSON.stringify(beforeValue) !== JSON.stringify(afterValue)) {
        const metadata = SettingsPanel.SETTING_METADATA[key];
        if (!metadata) continue;
        const idx = recentData.findIndex((s) => s.settingKey === key);
        if (idx !== -1) recentData.splice(idx, 1);
        recentData.unshift({ settingKey: key, tab: metadata.tab, label: localize(metadata.label), timestamp: now });
        changed = true;
      }
    }
    if (changed) await game.user.setFlag(MODULE.ID, 'recentSettings', recentData.slice(0, 20));
  }

  /**
   * Snapshot current values of all tracked settings.
   * @returns {object} Object mapping setting keys to current values
   */
  static #snapshotSettings() {
    const snapshot = {};
    for (const key of Object.keys(SettingsPanel.SETTING_METADATA)) snapshot[key] = game.settings.get(MODULE.ID, key);
    return snapshot;
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
    context.advanceTimeOnRest = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
    context.syncClockPause = game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE);
    context.roundTimeDisabled = CONFIG.time.roundTime === 0;
    context.timeSpeedMultiplier = game.settings.get(MODULE.ID, SETTINGS.TIME_SPEED_MULTIPLIER);
    const currentIncrement = game.settings.get(MODULE.ID, SETTINGS.TIME_SPEED_INCREMENT);
    const incrementLabels = {
      second: localize('CALENDARIA.Common.Second'),
      round: localize('CALENDARIA.Common.Round'),
      minute: localize('CALENDARIA.Common.Minute'),
      hour: localize('CALENDARIA.Common.Hour'),
      day: localize('CALENDARIA.Common.Day'),
      week: localize('CALENDARIA.Common.Week'),
      month: localize('CALENDARIA.Common.Month'),
      season: localize('CALENDARIA.Common.Season'),
      year: localize('CALENDARIA.Common.Year')
    };
    const isMonthless = CalendarManager.getActiveCalendar()?.isMonthless ?? false;
    context.timeSpeedIncrements = Object.keys(getTimeIncrements())
      .filter((key) => !isMonthless || key !== 'month')
      .map((key) => ({ key, label: incrementLabels[key] || key, selected: key === currentIncrement }));
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
    context.formatLocations = this.#prepareFormatLocationsForCategory('chat');
  }

  /**
   * Prepare context for the MiniCal tab.
   * @param {object} context - The context object
   */
  async #prepareMiniCalContext(context) {
    const miniCalSticky = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_STICKY_STATES);
    context.miniCalStickyTimeControls = miniCalSticky?.timeControls ?? false;
    context.miniCalStickySidebar = miniCalSticky?.sidebar ?? false;
    context.miniCalStickyPosition = miniCalSticky?.position ?? false;
    context.showMiniCal = game.settings.get(MODULE.ID, SETTINGS.SHOW_MINI_CAL);
    context.miniCalAutoFade = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_AUTO_FADE);
    context.miniCalIdleOpacity = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_IDLE_OPACITY);
    context.miniCalControlsDelay = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_CONTROLS_DELAY);
    context.miniCalConfirmSetDate = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_CONFIRM_SET_DATE);
    context.forceMiniCal = game.settings.get(MODULE.ID, SETTINGS.FORCE_MINI_CAL);
    context.formatLocations = this.#prepareFormatLocationsForCategory('miniCal');
    context.openHint = format('CALENDARIA.SettingsPanel.AppTab.OpenHint', { appName: 'MiniCal' });

    // Block visibility settings
    context.miniCalShowWeather = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_WEATHER);
    context.miniCalShowSeason = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_SEASON);
    context.miniCalShowEra = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_ERA);
    context.miniCalShowCycles = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_CYCLES);
    context.miniCalShowMoonPhases = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_MOON_PHASES);
    context.miniCalHeaderShowSelected = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_HEADER_SHOW_SELECTED);

    const miniCalWeatherDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_WEATHER_DISPLAY_MODE);
    context.miniCalWeatherDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.Full'), selected: miniCalWeatherDisplayMode === 'full' },
      { value: 'iconTemp', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.IconTemp'), selected: miniCalWeatherDisplayMode === 'iconTemp' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.IconOnly'), selected: miniCalWeatherDisplayMode === 'icon' },
      { value: 'temp', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.TempOnly'), selected: miniCalWeatherDisplayMode === 'temp' }
    ];

    const miniCalSeasonDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SEASON_DISPLAY_MODE);
    context.miniCalSeasonDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Settings.HUDSeasonDisplayMode.Full'), selected: miniCalSeasonDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDSeasonDisplayMode.IconOnly'), selected: miniCalSeasonDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Settings.HUDSeasonDisplayMode.TextOnly'), selected: miniCalSeasonDisplayMode === 'text' }
    ];

    const miniCalEraDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_ERA_DISPLAY_MODE);
    context.miniCalEraDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.Full'), selected: miniCalEraDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.IconOnly'), selected: miniCalEraDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.TextOnly'), selected: miniCalEraDisplayMode === 'text' },
      { value: 'abbr', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.Abbreviation'), selected: miniCalEraDisplayMode === 'abbr' }
    ];

    const miniCalCyclesDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_CYCLES_DISPLAY_MODE);
    context.miniCalCyclesDisplayModeOptions = [
      { value: 'name', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.NameOption'), selected: miniCalCyclesDisplayMode === 'name' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.IconOnly'), selected: miniCalCyclesDisplayMode === 'icon' },
      { value: 'number', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.Number'), selected: miniCalCyclesDisplayMode === 'number' },
      { value: 'roman', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.Roman'), selected: miniCalCyclesDisplayMode === 'roman' }
    ];

    // MiniCal time jumps
    const miniCalJumps = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_TIME_JUMPS) || {};
    const incrementLabels = {
      second: localize('CALENDARIA.Common.Second'),
      round: localize('CALENDARIA.Common.Round'),
      minute: localize('CALENDARIA.Common.Minute'),
      hour: localize('CALENDARIA.Common.Hour'),
      day: localize('CALENDARIA.Common.Day'),
      week: localize('CALENDARIA.Common.Week'),
      month: localize('CALENDARIA.Common.Month'),
      season: localize('CALENDARIA.Common.Season'),
      year: localize('CALENDARIA.Common.Year')
    };
    const isMonthless = CalendarManager.getActiveCalendar()?.isMonthless ?? false;
    context.miniCalTimeJumps = Object.keys(getTimeIncrements())
      .filter((key) => !isMonthless || key !== 'month')
      .map((key) => ({ key, label: incrementLabels[key] || key, jumps: miniCalJumps[key] || { dec2: null, dec1: null, inc1: null, inc2: null } }));
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
    context.forceHUD = game.settings.get(MODULE.ID, SETTINGS.FORCE_HUD);
    const hudMode = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE);
    context.hudModeOptions = [
      { value: 'fullsize', label: localize('CALENDARIA.Settings.CalendarHUDMode.Fullsize'), selected: hudMode === 'fullsize' },
      { value: 'compact', label: localize('CALENDARIA.Settings.CalendarHUDMode.Compact'), selected: hudMode === 'compact' }
    ];
    context.isCompactMode = hudMode === 'compact';

    // Dial style settings
    const dialStyle = game.settings.get(MODULE.ID, SETTINGS.HUD_DIAL_STYLE);
    context.dialStyleOptions = [
      { value: 'dome', label: localize('CALENDARIA.Settings.HUDDialStyle.Dome'), selected: dialStyle === 'dome' },
      { value: 'slice', label: localize('CALENDARIA.Settings.HUDDialStyle.Slice'), selected: dialStyle === 'slice' }
    ];

    // Tray direction settings
    const trayDirection = game.settings.get(MODULE.ID, SETTINGS.HUD_TRAY_DIRECTION);
    context.trayDirectionOptions = [
      { value: 'down', label: localize('CALENDARIA.Settings.HUDTrayDirection.Down'), selected: trayDirection === 'down' },
      { value: 'up', label: localize('CALENDARIA.Settings.HUDTrayDirection.Up'), selected: trayDirection === 'up' }
    ];

    context.hudCombatCompact = game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_COMPACT);
    context.hudCombatHide = game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_HIDE);
    context.hudDomeAutoHide = game.settings.get(MODULE.ID, SETTINGS.HUD_DOME_AUTO_HIDE);
    context.hudAutoFade = game.settings.get(MODULE.ID, SETTINGS.HUD_AUTO_FADE);
    context.hudIdleOpacity = game.settings.get(MODULE.ID, SETTINGS.HUD_IDLE_OPACITY);
    context.hudWidthScale = game.settings.get(MODULE.ID, SETTINGS.HUD_WIDTH_SCALE);
    context.hudWidthScalePixels = Math.round(context.hudWidthScale * 800);

    // Block visibility settings
    context.hudShowWeather = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_WEATHER);
    context.hudShowSeason = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_SEASON);
    context.hudShowEra = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_ERA);
    const weatherDisplayMode = game.settings.get(MODULE.ID, SETTINGS.HUD_WEATHER_DISPLAY_MODE);
    context.weatherDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.Full'), selected: weatherDisplayMode === 'full' },
      { value: 'iconTemp', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.IconTemp'), selected: weatherDisplayMode === 'iconTemp' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.IconOnly'), selected: weatherDisplayMode === 'icon' },
      { value: 'temp', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.TempOnly'), selected: weatherDisplayMode === 'temp' }
    ];
    const seasonDisplayMode = game.settings.get(MODULE.ID, SETTINGS.HUD_SEASON_DISPLAY_MODE);
    context.seasonDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Settings.HUDSeasonDisplayMode.Full'), selected: seasonDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDSeasonDisplayMode.IconOnly'), selected: seasonDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Settings.HUDSeasonDisplayMode.TextOnly'), selected: seasonDisplayMode === 'text' }
    ];
    const eraDisplayMode = game.settings.get(MODULE.ID, SETTINGS.HUD_ERA_DISPLAY_MODE);
    context.eraDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.Full'), selected: eraDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.IconOnly'), selected: eraDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.TextOnly'), selected: eraDisplayMode === 'text' },
      { value: 'abbr', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.Abbreviation'), selected: eraDisplayMode === 'abbr' }
    ];
    context.hudShowCycles = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_CYCLES);
    const cyclesDisplayMode = game.settings.get(MODULE.ID, SETTINGS.HUD_CYCLES_DISPLAY_MODE);
    context.cyclesDisplayModeOptions = [
      { value: 'name', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.NameOption'), selected: cyclesDisplayMode === 'name' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.IconOnly'), selected: cyclesDisplayMode === 'icon' },
      { value: 'number', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.Number'), selected: cyclesDisplayMode === 'number' },
      { value: 'roman', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.Roman'), selected: cyclesDisplayMode === 'roman' }
    ];

    // Custom time jumps per interval
    const customJumps = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_TIME_JUMPS) || {};
    const incrementLabels = {
      second: localize('CALENDARIA.Common.Second'),
      round: localize('CALENDARIA.Common.Round'),
      minute: localize('CALENDARIA.Common.Minute'),
      hour: localize('CALENDARIA.Common.Hour'),
      day: localize('CALENDARIA.Common.Day'),
      week: localize('CALENDARIA.Common.Week'),
      month: localize('CALENDARIA.Common.Month'),
      season: localize('CALENDARIA.Common.Season'),
      year: localize('CALENDARIA.Common.Year')
    };
    const isMonthless = CalendarManager.getActiveCalendar()?.isMonthless ?? false;
    context.customTimeJumps = Object.keys(getTimeIncrements())
      .filter((key) => !isMonthless || key !== 'month')
      .map((key) => ({ key, label: incrementLabels[key] || key, jumps: customJumps[key] || { dec2: null, dec1: null, inc1: null, inc2: null } }));
    context.formatLocations = this.#prepareFormatLocationsForCategory('hud');
    context.openHint = format('CALENDARIA.SettingsPanel.AppTab.OpenHint', { appName: 'HUD' });
  }

  /**
   * Prepare context for the BigCal tab.
   * @param {object} context - The context object
   */
  async #prepareBigCalContext(context) {
    context.formatLocations = this.#prepareFormatLocationsForCategory('bigcal');
    context.openHint = format('CALENDARIA.SettingsPanel.AppTab.OpenHint', { appName: 'BigCal' });

    // Block visibility settings
    context.bigCalShowWeather = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_WEATHER);
    context.bigCalShowSeason = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_SEASON);
    context.bigCalShowEra = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_ERA);
    context.bigCalShowCycles = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_CYCLES);
    context.bigCalShowMoonPhases = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SHOW_MOON_PHASES);
    context.bigCalHeaderShowSelected = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_HEADER_SHOW_SELECTED);

    const bigCalWeatherDisplayMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_WEATHER_DISPLAY_MODE);
    context.bigCalWeatherDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.Full'), selected: bigCalWeatherDisplayMode === 'full' },
      { value: 'iconTemp', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.IconTemp'), selected: bigCalWeatherDisplayMode === 'iconTemp' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.IconOnly'), selected: bigCalWeatherDisplayMode === 'icon' },
      { value: 'temp', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.TempOnly'), selected: bigCalWeatherDisplayMode === 'temp' }
    ];

    const bigCalSeasonDisplayMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SEASON_DISPLAY_MODE);
    context.bigCalSeasonDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Settings.HUDSeasonDisplayMode.Full'), selected: bigCalSeasonDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDSeasonDisplayMode.IconOnly'), selected: bigCalSeasonDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Settings.HUDSeasonDisplayMode.TextOnly'), selected: bigCalSeasonDisplayMode === 'text' }
    ];

    const bigCalEraDisplayMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_ERA_DISPLAY_MODE);
    context.bigCalEraDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.Full'), selected: bigCalEraDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.IconOnly'), selected: bigCalEraDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.TextOnly'), selected: bigCalEraDisplayMode === 'text' },
      { value: 'abbr', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.Abbreviation'), selected: bigCalEraDisplayMode === 'abbr' }
    ];

    const bigCalCyclesDisplayMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_CYCLES_DISPLAY_MODE);
    context.bigCalCyclesDisplayModeOptions = [
      { value: 'name', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.NameOption'), selected: bigCalCyclesDisplayMode === 'name' },
      { value: 'icon', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.IconOnly'), selected: bigCalCyclesDisplayMode === 'icon' },
      { value: 'number', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.Number'), selected: bigCalCyclesDisplayMode === 'number' },
      { value: 'roman', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.Roman'), selected: bigCalCyclesDisplayMode === 'roman' }
    ];
  }

  /**
   * Prepare format locations for a specific category.
   * @param {string} category - The category to filter by (hud, timekeeper, miniCal, bigcal, chat, stopwatch)
   * @returns {Array<object>} Prepared format locations for the category
   */
  #prepareFormatLocationsForCategory(category) {
    const displayFormats = game.settings.get(MODULE.ID, SETTINGS.DISPLAY_FORMATS);

    // Get active calendar name for "Calendar Default" option
    const calendar = CalendarManager.getActiveCalendar();
    let calendarName = localize('CALENDARIA.Common.Calendar');
    if (calendar?.metadata?.id) {
      const locKey = `CALENDARIA.Calendar.${calendar.metadata.id
        .split('-')
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join('')}.Name`;
      const localized = localize(locKey);
      calendarName = localized !== locKey ? localized : calendar.name || localize('CALENDARIA.Common.Calendar');
    }
    const calendarDefaultLabel = format('CALENDARIA.Format.Preset.CalendarDefault', { calendar: calendarName });

    const presetOptions = [
      { value: 'calendarDefault', label: calendarDefaultLabel },
      { value: 'custom', label: localize('CALENDARIA.Format.Preset.Custom') },
      // Approximate
      { value: 'approxDate', label: localize('CALENDARIA.Format.Preset.ApproxDate') },
      { value: 'approxTime', label: localize('CALENDARIA.Format.Preset.ApproxTime') },
      // Date - Standard
      { value: 'dateShort', label: localize('CALENDARIA.Format.Preset.DateShort') },
      { value: 'dateMedium', label: localize('CALENDARIA.Format.Preset.DateMedium') },
      { value: 'dateLong', label: localize('CALENDARIA.Format.Preset.DateLong') },
      { value: 'dateFull', label: localize('CALENDARIA.Format.Preset.DateFull') },
      // Date - Regional
      { value: 'dateUS', label: localize('CALENDARIA.Format.Preset.DateUS') },
      { value: 'dateUSFull', label: localize('CALENDARIA.Format.Preset.DateUSFull') },
      { value: 'dateISO', label: localize('CALENDARIA.Format.Preset.DateISO') },
      { value: 'dateNumericUS', label: localize('CALENDARIA.Format.Preset.DateNumericUS') },
      { value: 'dateNumericEU', label: localize('CALENDARIA.Format.Preset.DateNumericEU') },
      // Date - Ordinal/Fantasy
      { value: 'ordinal', label: localize('CALENDARIA.Format.Preset.Ordinal') },
      { value: 'ordinalLong', label: localize('CALENDARIA.Format.Preset.OrdinalLong') },
      { value: 'ordinalEra', label: localize('CALENDARIA.Format.Preset.OrdinalEra') },
      { value: 'ordinalFull', label: localize('CALENDARIA.Format.Preset.OrdinalFull') },
      { value: 'seasonDate', label: localize('CALENDARIA.Format.Preset.SeasonDate') },
      // Year/Week
      { value: 'weekHeader', label: localize('CALENDARIA.Format.Preset.WeekHeader') },
      { value: 'yearOnly', label: localize('CALENDARIA.Format.Preset.YearOnly') },
      { value: 'yearEra', label: localize('CALENDARIA.Format.Preset.YearEra') },
      // Time
      { value: 'time12', label: localize('CALENDARIA.Format.Preset.Time12') },
      { value: 'time12Sec', label: localize('CALENDARIA.Format.Preset.Time12Sec') },
      { value: 'time24', label: localize('CALENDARIA.Format.Preset.Time24') },
      { value: 'time24Sec', label: localize('CALENDARIA.Format.Preset.Time24Sec') },
      // Date + Time
      { value: 'datetimeShort12', label: localize('CALENDARIA.Format.Preset.DatetimeShort12') },
      { value: 'datetimeShort24', label: localize('CALENDARIA.Format.Preset.DatetimeShort24') },
      { value: 'datetime12', label: localize('CALENDARIA.Format.Preset.Datetime12') },
      { value: 'datetime24', label: localize('CALENDARIA.Format.Preset.Datetime24') }
    ];

    // Locations that support "Off" option
    const supportsOff = ['hudDate', 'timekeeperDate'];

    // Stopwatch preset configurations
    const stopwatchRealtimePresets = [
      { value: 'stopwatchRealtimeFull', label: localize('CALENDARIA.Format.Preset.StopwatchFull') },
      { value: 'stopwatchRealtimeNoMs', label: localize('CALENDARIA.Format.Preset.StopwatchNoMs') },
      { value: 'stopwatchRealtimeMinSec', label: localize('CALENDARIA.Format.Preset.StopwatchMinSec') },
      { value: 'stopwatchRealtimeSecOnly', label: localize('CALENDARIA.Format.Preset.StopwatchSecOnly') },
      { value: 'custom', label: localize('CALENDARIA.Format.Preset.Custom') }
    ];
    const stopwatchGametimePresets = [
      { value: 'stopwatchGametimeFull', label: localize('CALENDARIA.Format.Preset.StopwatchFull') },
      { value: 'stopwatchGametimeMinSec', label: localize('CALENDARIA.Format.Preset.StopwatchMinSec') },
      { value: 'stopwatchGametimeSecOnly', label: localize('CALENDARIA.Format.Preset.StopwatchSecOnly') },
      { value: 'custom', label: localize('CALENDARIA.Format.Preset.Custom') }
    ];
    const stopwatchRealtimeKnown = ['stopwatchRealtimeFull', 'stopwatchRealtimeNoMs', 'stopwatchRealtimeMinSec', 'stopwatchRealtimeSecOnly'];
    const stopwatchGametimeKnown = ['stopwatchGametimeFull', 'stopwatchGametimeMinSec', 'stopwatchGametimeSecOnly'];

    const allLocations = [
      { id: 'hudDate', label: localize('CALENDARIA.Format.Location.HudDate'), category: 'hud', contextType: 'date' },
      { id: 'hudTime', label: localize('CALENDARIA.Format.Location.HudTime'), category: 'hud', contextType: 'time' },
      { id: 'timekeeperDate', label: localize('CALENDARIA.Format.Location.TimeKeeperDate'), category: 'timekeeper', contextType: 'date' },
      { id: 'timekeeperTime', label: localize('CALENDARIA.Format.Location.TimeKeeperTime'), category: 'timekeeper', contextType: 'time' },
      { id: 'miniCalHeader', label: localize('CALENDARIA.Format.Location.MiniCalHeader'), category: 'miniCal', contextType: 'date' },
      { id: 'miniCalTime', label: localize('CALENDARIA.Format.Location.MiniCalTime'), category: 'miniCal', contextType: 'time' },
      { id: 'bigCalHeader', label: localize('CALENDARIA.Format.Location.BigCalHeader'), category: 'bigcal', contextType: 'date' },
      { id: 'bigCalWeekHeader', label: localize('CALENDARIA.Format.Location.BigCalWeekHeader'), category: 'bigcal', contextType: 'date' },
      { id: 'bigCalYearHeader', label: localize('CALENDARIA.Format.Location.BigCalYearHeader'), category: 'bigcal', contextType: 'date' },
      { id: 'bigCalYearLabel', label: localize('CALENDARIA.Format.Location.BigCalYearLabel'), category: 'bigcal', contextType: 'date' },
      { id: 'chatTimestamp', label: localize('CALENDARIA.Format.Location.ChatTimestamp'), category: 'chat', contextType: 'date' },
      { id: 'stopwatchRealtime', label: localize('CALENDARIA.Format.Location.StopwatchRealtime'), category: 'stopwatch', contextType: 'stopwatch', gmOnly: true },
      { id: 'stopwatchGametime', label: localize('CALENDARIA.Format.Location.StopwatchGametime'), category: 'stopwatch', contextType: 'stopwatch', gmOnly: true }
    ];

    const locations = allLocations.filter((loc) => loc.category === category);

    return locations.map((loc) => {
      let knownPresets, locationPresets, defaultFormat;
      if (loc.id === 'stopwatchRealtime') {
        knownPresets = stopwatchRealtimeKnown;
        locationPresets = stopwatchRealtimePresets;
        defaultFormat = 'stopwatchRealtimeFull';
      } else if (loc.id === 'stopwatchGametime') {
        knownPresets = stopwatchGametimeKnown;
        locationPresets = stopwatchGametimePresets;
        defaultFormat = 'stopwatchGametimeFull';
      } else {
        knownPresets = [
          'off',
          'calendarDefault',
          'approxDate',
          'approxTime',
          'dateShort',
          'dateMedium',
          'dateLong',
          'dateFull',
          'dateUS',
          'dateUSFull',
          'dateISO',
          'dateNumericUS',
          'dateNumericEU',
          'ordinal',
          'ordinalLong',
          'ordinalEra',
          'ordinalFull',
          'seasonDate',
          'time12',
          'time12Sec',
          'time24',
          'time24Sec',
          'datetimeShort12',
          'datetimeShort24',
          'datetime12',
          'datetime24'
        ];
        locationPresets = [...presetOptions];
        defaultFormat = 'dateLong';
        if (supportsOff.includes(loc.id)) locationPresets = [{ value: 'off', label: localize('CALENDARIA.Format.Preset.Off') }, ...locationPresets];
      }

      const formats = displayFormats[loc.id] || { gm: defaultFormat, player: defaultFormat };
      const isCustomGM = !knownPresets.includes(formats.gm);
      const isCustomPlayer = !knownPresets.includes(formats.player);

      return {
        ...loc,
        gmFormat: formats.gm,
        playerFormat: formats.player,
        gmPresetOptions: locationPresets.map((o) => ({ ...o, selected: isCustomGM ? o.value === 'custom' : o.value === formats.gm })),
        playerPresetOptions: locationPresets.map((o) => ({ ...o, selected: isCustomPlayer ? o.value === 'custom' : o.value === formats.player })),
        isCustomGM,
        isCustomPlayer
      };
    });
  }

  /**
   * Prepare context for the Stopwatch tab.
   * @param {object} context - The context object
   */
  async #prepareStopwatchContext(context) {
    context.stopwatchAutoStartTime = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_AUTO_START_TIME);
    const stopwatchSticky = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STICKY_STATES);
    context.stopwatchStickyPosition = stopwatchSticky?.position ?? false;
    context.formatLocations = this.#prepareFormatLocationsForCategory('stopwatch');
    context.openHint = format('CALENDARIA.SettingsPanel.AppTab.OpenHint', { appName: 'Stopwatch' });
  }

  /**
   * Prepare context for the footer.
   * @param {object} context - The context object
   */
  async #prepareFooterContext(context) {
    context.moduleVersion = game.modules.get(MODULE.ID)?.version ?? 'Unknown';
    context.saveState = this.#saveState;
    context.saveLabel = this.#saveState === 'saving' ? localize('CALENDARIA.SettingsPanel.Footer.Saving') : localize('CALENDARIA.SettingsPanel.Footer.Saved');
    context.saveIcon = this.#saveState === 'saving' ? 'fa-sync fa-spin' : 'fa-check';
  }

  /**
   * Prepare context for the TimeKeeper tab.
   * @param {object} context - The context object
   */
  async #prepareTimeKeeperContext(context) {
    context.showTimeKeeper = game.settings.get(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER);
    context.timeKeeperAutoFade = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_AUTO_FADE);
    context.timeKeeperIdleOpacity = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_IDLE_OPACITY);
    const timeKeeperSticky = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_STICKY_STATES);
    context.timeKeeperStickyPosition = timeKeeperSticky?.position ?? false;

    // Format locations for TimeKeeper
    context.formatLocations = this.#prepareFormatLocationsForCategory('timekeeper');

    // TimeKeeper time jumps
    const timeKeeperJumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const incrementLabels = {
      second: localize('CALENDARIA.Common.Second'),
      round: localize('CALENDARIA.Common.Round'),
      minute: localize('CALENDARIA.Common.Minute'),
      hour: localize('CALENDARIA.Common.Hour'),
      day: localize('CALENDARIA.Common.Day'),
      week: localize('CALENDARIA.Common.Week'),
      month: localize('CALENDARIA.Common.Month'),
      season: localize('CALENDARIA.Common.Season'),
      year: localize('CALENDARIA.Common.Year')
    };
    const isMonthless = CalendarManager.getActiveCalendar()?.isMonthless ?? false;
    context.timeKeeperTimeJumps = Object.keys(getTimeIncrements())
      .filter((key) => !isMonthless || key !== 'month')
      .map((key) => ({ key, label: incrementLabels[key] || key, jumps: timeKeeperJumps[key] || { dec2: null, dec1: null, inc1: null, inc2: null } }));
    context.openHint = format('CALENDARIA.SettingsPanel.AppTab.OpenHint', { appName: 'TimeKeeper' });
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
    context.temperatureUnitSymbol = tempUnit === 'fahrenheit' ? '°F' : '°C';
    const rawPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    context.customWeatherPresets = rawPresets.map((p) => ({
      ...p,
      tempMin: toDisplayUnit(p.tempMin),
      tempMax: toDisplayUnit(p.tempMax)
    }));
    const zones = WeatherManager.getCalendarZones() || [];
    const activeZone = WeatherManager.getActiveZone();
    context.hasZones = zones.length > 0;
    context.zoneOptions = zones.map((z) => ({ value: z.id, label: localize(z.name), selected: z.id === activeZone?.id }));
    context.zoneOptions.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
  }

  /**
   * Prepare context for the Theme tab.
   * @param {object} context - The context object
   */
  async #prepareThemeContext(context) {
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
      const categories = {};
      for (const [catKey, catLabel] of Object.entries(COLOR_CATEGORIES)) categories[catKey] = { key: catKey, label: catLabel, colors: [] };
      for (const def of COLOR_DEFINITIONS) {
        const value = customColors[def.key] || DEFAULT_COLORS[def.key];
        const isCustom = customColors[def.key] !== undefined;
        const componentLabel = COMPONENT_CATEGORIES[def.component] || '';
        categories[def.category].colors.push({ key: def.key, label: def.label, value, defaultValue: DEFAULT_COLORS[def.key], isCustom, component: def.component, componentLabel });
      }

      context.themeCategories = Object.values(categories).filter((c) => c.colors.length > 0);
    }
  }

  /**
   * Prepare context for the Canvas tab.
   * @param {object} context - The context object
   */
  async #prepareCanvasContext(context) {
    context.stickyZonesEnabled = game.settings.get(MODULE.ID, SETTINGS.HUD_STICKY_ZONES_ENABLED);
    context.allowSidebarOverlap = game.settings.get(MODULE.ID, SETTINGS.ALLOW_SIDEBAR_OVERLAP);
    context.darknessSync = game.settings.get(MODULE.ID, SETTINGS.DARKNESS_SYNC);
    context.darknessSyncAllScenes = game.settings.get(MODULE.ID, SETTINGS.DARKNESS_SYNC_ALL_SCENES);
    context.darknessWeatherSync = game.settings.get(MODULE.ID, SETTINGS.DARKNESS_WEATHER_SYNC);
    context.ambienceSync = game.settings.get(MODULE.ID, SETTINGS.AMBIENCE_SYNC);
    context.defaultBrightnessMultiplier = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER) ?? 1.0;
  }

  /**
   * Prepare context for the Macros tab.
   * @param {object} context - The context object
   */
  async #prepareMacrosContext(context) {
    const config = game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS);
    context.macros = game.macros.contents.map((m) => ({ id: m.id, name: m.name }));
    context.macros.sort((a, b) => a.name.localeCompare(b.name, game.i18n.lang));

    // Global triggers
    const globalTriggers = [
      { key: 'dawn', label: 'CALENDARIA.MacroTrigger.Dawn' },
      { key: 'dusk', label: 'CALENDARIA.MacroTrigger.Dusk' },
      { key: 'midday', label: 'CALENDARIA.MacroTrigger.Midday' },
      { key: 'midnight', label: 'CALENDARIA.MacroTrigger.Midnight' },
      { key: 'newDay', label: 'CALENDARIA.MacroTrigger.NewDay' }
    ];
    context.globalTriggers = globalTriggers.map((trigger) => ({ ...trigger, label: localize(trigger.label), macroId: config.global?.[trigger.key] || '' }));

    // Season triggers
    const calendar = CalendarManager.getActiveCalendar();
    context.hasSeasons = calendar?.seasonsArray?.length > 0;
    if (context.hasSeasons) {
      context.seasons = calendar.seasonsArray.map((season, index) => ({ index, name: localize(season.name) }));
      context.seasonTriggers = (config.season || []).map((trigger, index) => {
        const isAll = trigger.seasonIndex === -1;
        const season = isAll ? null : calendar.seasonsArray[trigger.seasonIndex];
        return {
          index,
          seasonIndex: trigger.seasonIndex,
          seasonName: isAll ? localize('CALENDARIA.MacroTrigger.AllSeasons') : season ? localize(season.name) : `Season ${trigger.seasonIndex}`,
          macroId: trigger.macroId
        };
      });
    }

    // Moon phase triggers
    context.hasMoons = calendar?.moonsArray?.length > 0;
    if (context.hasMoons) {
      context.moons = calendar.moonsArray.map((moon, index) => ({ index, name: localize(moon.name) }));
      context.moonPhases = {};
      calendar.moonsArray.forEach((moon, moonIndex) => {
        context.moonPhases[moonIndex] = Object.values(moon.phases ?? {}).map((phase, phaseIndex) => ({ index: phaseIndex, name: localize(phase.name) }));
      });

      context.moonTriggers = (config.moonPhase || []).map((trigger, index) => {
        const isAllMoons = trigger.moonIndex === -1;
        const isAllPhases = trigger.phaseIndex === -1;
        const moon = isAllMoons ? null : calendar.moonsArray[trigger.moonIndex];
        const phase = isAllMoons || isAllPhases ? null : Object.values(moon?.phases ?? {})[trigger.phaseIndex];
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
   * Prepare context for the Module tab.
   * @param {object} context - The context object
   */
  async #prepareModuleContext(context) {
    const primaryGM = game.settings.get(MODULE.ID, SETTINGS.PRIMARY_GM);
    context.primaryGMOptions = [{ value: '', label: localize('CALENDARIA.Settings.PrimaryGM.Auto'), selected: !primaryGM }];
    for (const user of game.users.filter((u) => u.isGM)) context.primaryGMOptions.push({ value: user.id, label: user.name, selected: user.id === primaryGM });
    context.primaryGMOptions.sort((a, b) => {
      if (a.value === '') return -1;
      if (b.value === '') return 1;
      return a.label.localeCompare(b.label, game.i18n.lang);
    });
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

    // Toolbar integration settings
    context.showToolbarButton = game.settings.get(MODULE.ID, SETTINGS.SHOW_TOOLBAR_BUTTON);
    const toolbarApps = game.settings.get(MODULE.ID, SETTINGS.TOOLBAR_APPS);
    context.toolbarAppOptions = [
      { id: 'bigcal', icon: 'fa-calendar-days', label: localize('CALENDARIA.SettingsPanel.Tab.BigCal'), checked: toolbarApps.has('bigcal') },
      { id: 'minical', icon: 'fa-compress', label: localize('CALENDARIA.SettingsPanel.Tab.MiniCal'), checked: toolbarApps.has('minical') },
      { id: 'hud', icon: 'fa-sun', label: localize('CALENDARIA.SettingsPanel.Tab.HUD'), checked: toolbarApps.has('hud') },
      { id: 'timekeeper', icon: 'fa-gauge', label: localize('CALENDARIA.SettingsPanel.Tab.TimeKeeper'), checked: toolbarApps.has('timekeeper') },
      { id: 'stopwatch', icon: 'fa-stopwatch', label: localize('CALENDARIA.SettingsPanel.Tab.Stopwatch'), checked: toolbarApps.has('stopwatch') }
    ];
    context.showJournalFooter = game.settings.get(MODULE.ID, SETTINGS.SHOW_JOURNAL_FOOTER);
  }

  /**
   * Prepare context for the Permissions tab.
   * @param {object} context - The context object
   */
  async #preparePermissionsContext(context) {
    const defaults = {
      viewBigCal: { player: false, trusted: true, assistant: true },
      viewMiniCal: { player: false, trusted: true, assistant: true },
      viewTimeKeeper: { player: false, trusted: true, assistant: true },
      addNotes: { player: true, trusted: true, assistant: true },
      changeDateTime: { player: false, trusted: false, assistant: true },
      changeActiveCalendar: { player: false, trusted: false, assistant: false },
      changeWeather: { player: false, trusted: false, assistant: true },
      editNotes: { player: false, trusted: true, assistant: true },
      deleteNotes: { player: false, trusted: false, assistant: true },
      editCalendars: { player: false, trusted: false, assistant: false }
    };
    const saved = game.settings.get(MODULE.ID, SETTINGS.PERMISSIONS) || {};
    context.permissions = {};
    for (const [key, defaultVal] of Object.entries(defaults)) {
      context.permissions[key] = {
        player: saved[key]?.player ?? defaultVal.player,
        trusted: saved[key]?.trusted ?? defaultVal.trusted,
        assistant: saved[key]?.assistant ?? defaultVal.assistant
      };
    }
  }

  /**
   * Handle form submission.
   * @param {Event} _event - The form submission event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - The form data
   */
  static async #onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    log(3, 'Settings panel form data:', data);
    const beforeSnapshot = SettingsPanel.#snapshotSettings();
    if ('showTimeKeeper' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER, data.showTimeKeeper);
    if ('timeKeeperAutoFade' in data) await game.settings.set(MODULE.ID, SETTINGS.TIMEKEEPER_AUTO_FADE, data.timeKeeperAutoFade);
    if ('timeKeeperIdleOpacity' in data) await game.settings.set(MODULE.ID, SETTINGS.TIMEKEEPER_IDLE_OPACITY, Number(data.timeKeeperIdleOpacity));
    if ('stopwatchAutoStartTime' in data) await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_AUTO_START_TIME, data.stopwatchAutoStartTime);
    if ('timeSpeedMultiplier' in data || 'timeSpeedIncrement' in data) {
      if ('timeSpeedMultiplier' in data) await game.settings.set(MODULE.ID, SETTINGS.TIME_SPEED_MULTIPLIER, Math.max(0.01, Number(data.timeSpeedMultiplier) || 1));
      if ('timeSpeedIncrement' in data) await game.settings.set(MODULE.ID, SETTINGS.TIME_SPEED_INCREMENT, data.timeSpeedIncrement);
      TimeClock.loadSpeedFromSettings();
    }

    if ('showToolbarButton' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_TOOLBAR_BUTTON, data.showToolbarButton);
    if ('toolbarApps' in data) {
      const apps = Array.isArray(data.toolbarApps) ? data.toolbarApps : data.toolbarApps ? [data.toolbarApps] : [];
      await game.settings.set(MODULE.ID, SETTINGS.TOOLBAR_APPS, new Set(apps));
    }
    if ('showJournalFooter' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_JOURNAL_FOOTER, data.showJournalFooter);
    if ('showMiniCal' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_MINI_CAL, data.showMiniCal);
    if ('showCalendarHUD' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_CALENDAR_HUD, data.showCalendarHUD);
    if ('forceHUD' in data) await game.settings.set(MODULE.ID, SETTINGS.FORCE_HUD, data.forceHUD);
    if ('forceMiniCal' in data) await game.settings.set(MODULE.ID, SETTINGS.FORCE_MINI_CAL, data.forceMiniCal);
    if ('calendarHUDMode' in data) {
      const oldMode = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE);
      await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_MODE, data.calendarHUDMode);
      if (oldMode !== data.calendarHUDMode) {
        const settingsPanel = foundry.applications.instances.get('calendaria-settings-panel');
        if (settingsPanel?.rendered) settingsPanel.render({ parts: ['hud'] });
      }
    }

    if ('hudDialStyle' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_DIAL_STYLE, data.hudDialStyle);
    if ('hudTrayDirection' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_TRAY_DIRECTION, data.hudTrayDirection);
    if ('hudCombatCompact' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_COMBAT_COMPACT, data.hudCombatCompact);
    if ('hudCombatHide' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_COMBAT_HIDE, data.hudCombatHide);
    if ('hudDomeAutoHide' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_DOME_AUTO_HIDE, data.hudDomeAutoHide);
    if ('hudAutoFade' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_AUTO_FADE, data.hudAutoFade);
    if ('hudIdleOpacity' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_IDLE_OPACITY, Number(data.hudIdleOpacity));
    if ('hudWidthScale' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_WIDTH_SCALE, Number(data.hudWidthScale));
    if ('miniCalAutoFade' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_AUTO_FADE, data.miniCalAutoFade);
    if ('miniCalIdleOpacity' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_IDLE_OPACITY, Number(data.miniCalIdleOpacity));
    if ('miniCalControlsDelay' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_CONTROLS_DELAY, Number(data.miniCalControlsDelay));
    if ('miniCalConfirmSetDate' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_CONFIRM_SET_DATE, data.miniCalConfirmSetDate);
    if ('darknessSync' in data) {
      await game.settings.set(MODULE.ID, SETTINGS.DARKNESS_SYNC, data.darknessSync);
      if (data.darknessSync && game.pf2e?.worldClock) {
        const pf2eWorldClock = game.settings.get('pf2e', 'worldClock');
        if (pf2eWorldClock?.syncDarkness) await game.settings.set('pf2e', 'worldClock', { ...pf2eWorldClock, syncDarkness: false });
      }
    }

    if ('darknessSyncAllScenes' in data) await game.settings.set(MODULE.ID, SETTINGS.DARKNESS_SYNC_ALL_SCENES, data.darknessSyncAllScenes);
    if ('darknessWeatherSync' in data) await game.settings.set(MODULE.ID, SETTINGS.DARKNESS_WEATHER_SYNC, data.darknessWeatherSync);
    if ('ambienceSync' in data) await game.settings.set(MODULE.ID, SETTINGS.AMBIENCE_SYNC, data.ambienceSync);
    if ('advanceTimeOnRest' in data) await game.settings.set(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST, data.advanceTimeOnRest);
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

    if ('showActiveCalendarToPlayers' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_ACTIVE_CALENDAR_TO_PLAYERS, data.showActiveCalendarToPlayers);
    if ('temperatureUnit' in data) await game.settings.set(MODULE.ID, SETTINGS.TEMPERATURE_UNIT, data.temperatureUnit);
    if ('climateZone' in data) await WeatherManager.setActiveZone(data.climateZone);
    if ('miniCalStickySection' in data) {
      const current = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_STICKY_STATES) || {};
      await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_STICKY_STATES, {
        ...current,
        timeControls: !!data.miniCalStickyTimeControls,
        sidebar: !!data.miniCalStickySidebar,
        position: !!data.miniCalStickyPosition
      });
      MiniCal.refreshStickyStates();
    }
    if ('timeKeeperStickySection' in data) {
      await game.settings.set(MODULE.ID, SETTINGS.TIMEKEEPER_STICKY_STATES, {
        position: !!data.timeKeeperStickyPosition
      });
    }
    if ('stopwatchStickySection' in data) {
      await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_STICKY_STATES, {
        position: !!data.stopwatchStickyPosition
      });
    }

    if ('hudStickySection' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_STICKY_STATES, { tray: !!data.hudStickyTray, position: !!data.hudStickyPosition });
    if ('calendarHUDLocked' in data) await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_HUD_LOCKED, data.calendarHUDLocked);
    if ('stickyZonesEnabled' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_STICKY_ZONES_ENABLED, data.stickyZonesEnabled);
    if ('allowSidebarOverlap' in data) await game.settings.set(MODULE.ID, SETTINGS.ALLOW_SIDEBAR_OVERLAP, data.allowSidebarOverlap);
    if ('hudShowWeather' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_SHOW_WEATHER, data.hudShowWeather);
    if ('hudShowSeason' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_SHOW_SEASON, data.hudShowSeason);
    if ('hudShowEra' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_SHOW_ERA, data.hudShowEra);
    if ('hudShowCycles' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_SHOW_CYCLES, data.hudShowCycles);
    if ('hudWeatherDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_WEATHER_DISPLAY_MODE, data.hudWeatherDisplayMode);
    if ('hudSeasonDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_SEASON_DISPLAY_MODE, data.hudSeasonDisplayMode);
    if ('hudEraDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_ERA_DISPLAY_MODE, data.hudEraDisplayMode);
    if ('hudCyclesDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_CYCLES_DISPLAY_MODE, data.hudCyclesDisplayMode);

    // MiniCal block visibility
    if ('miniCalShowWeather' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_SHOW_WEATHER, data.miniCalShowWeather);
    if ('miniCalShowSeason' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_SHOW_SEASON, data.miniCalShowSeason);
    if ('miniCalShowEra' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_SHOW_ERA, data.miniCalShowEra);
    if ('miniCalShowCycles' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_SHOW_CYCLES, data.miniCalShowCycles);
    if ('miniCalShowMoonPhases' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_SHOW_MOON_PHASES, data.miniCalShowMoonPhases);
    if ('miniCalHeaderShowSelected' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_HEADER_SHOW_SELECTED, data.miniCalHeaderShowSelected);
    if ('miniCalWeatherDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_WEATHER_DISPLAY_MODE, data.miniCalWeatherDisplayMode);
    if ('miniCalSeasonDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_SEASON_DISPLAY_MODE, data.miniCalSeasonDisplayMode);
    if ('miniCalEraDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_ERA_DISPLAY_MODE, data.miniCalEraDisplayMode);
    if ('miniCalCyclesDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_CYCLES_DISPLAY_MODE, data.miniCalCyclesDisplayMode);

    // BigCal block visibility
    if ('bigCalShowWeather' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_SHOW_WEATHER, data.bigCalShowWeather);
    if ('bigCalShowSeason' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_SHOW_SEASON, data.bigCalShowSeason);
    if ('bigCalShowEra' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_SHOW_ERA, data.bigCalShowEra);
    if ('bigCalShowCycles' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_SHOW_CYCLES, data.bigCalShowCycles);
    if ('bigCalShowMoonPhases' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_SHOW_MOON_PHASES, data.bigCalShowMoonPhases);
    if ('bigCalHeaderShowSelected' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_HEADER_SHOW_SELECTED, data.bigCalHeaderShowSelected);
    if ('bigCalWeatherDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_WEATHER_DISPLAY_MODE, data.bigCalWeatherDisplayMode);
    if ('bigCalSeasonDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_SEASON_DISPLAY_MODE, data.bigCalSeasonDisplayMode);
    if ('bigCalEraDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_ERA_DISPLAY_MODE, data.bigCalEraDisplayMode);
    if ('bigCalCyclesDisplayMode' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_CYCLES_DISPLAY_MODE, data.bigCalCyclesDisplayMode);
    if (data.customTimeJumps) {
      const jumps = {};
      for (const [key, values] of Object.entries(data.customTimeJumps)) {
        jumps[key] = {
          dec2: values.dec2 ? Number(values.dec2) : null,
          dec1: values.dec1 ? Number(values.dec1) : null,
          inc1: values.inc1 ? Number(values.inc1) : null,
          inc2: values.inc2 ? Number(values.inc2) : null
        };
      }
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_TIME_JUMPS, jumps);
      foundry.applications.instances.get('calendaria-hud')?.render({ parts: ['bar'] });
    }

    if (data.timeKeeperTimeJumps) {
      const jumps = {};
      for (const [key, values] of Object.entries(data.timeKeeperTimeJumps)) {
        jumps[key] = {
          dec2: values.dec2 ? Number(values.dec2) : null,
          dec1: values.dec1 ? Number(values.dec1) : null,
          inc1: values.inc1 ? Number(values.inc1) : null,
          inc2: values.inc2 ? Number(values.inc2) : null
        };
      }
      await game.settings.set(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS, jumps);
      foundry.applications.instances.get('time-keeper')?.render();
    }

    if (data.miniCalTimeJumps) {
      const jumps = {};
      for (const [key, values] of Object.entries(data.miniCalTimeJumps)) {
        jumps[key] = {
          dec2: values.dec2 ? Number(values.dec2) : null,
          dec1: values.dec1 ? Number(values.dec1) : null,
          inc1: values.inc1 ? Number(values.inc1) : null,
          inc2: values.inc2 ? Number(values.inc2) : null
        };
      }
      await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_TIME_JUMPS, jumps);
      foundry.applications.instances.get('mini-cal')?.render();
    }

    if ('primaryGM' in data) await game.settings.set(MODULE.ID, SETTINGS.PRIMARY_GM, data.primaryGM || '');
    if ('loggingLevel' in data) await game.settings.set(MODULE.ID, SETTINGS.LOGGING_LEVEL, data.loggingLevel);
    if ('devMode' in data) await game.settings.set(MODULE.ID, SETTINGS.DEV_MODE, data.devMode);
    if (data.permissions) {
      const permissionKeys = ['viewBigCal', 'viewMiniCal', 'viewTimeKeeper', 'addNotes', 'changeDateTime', 'changeActiveCalendar', 'changeWeather', 'editNotes', 'deleteNotes', 'editCalendars'];
      const permissions = {};
      for (const key of permissionKeys) {
        if (data.permissions[key]) {
          permissions[key] = {
            player: !!data.permissions[key].player,
            trusted: !!data.permissions[key].trusted,
            assistant: !!data.permissions[key].assistant
          };
        }
      }
      await game.settings.set(MODULE.ID, SETTINGS.PERMISSIONS, permissions);
    }

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

    // Default brightness multiplier
    if (data.defaultBrightnessMultiplier != null) await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER, Number(data.defaultBrightnessMultiplier));

    // Macro triggers
    if (data.macroTriggers) {
      const globalTriggerKeys = ['dawn', 'dusk', 'midday', 'midnight', 'newDay'];
      const config = { global: {}, season: [], moonPhase: [] };
      for (const key of globalTriggerKeys) config.global[key] = data.macroTriggers.global?.[key] || '';
      if (data.macroTriggers.seasonTrigger) {
        for (const trigger of Object.values(data.macroTriggers.seasonTrigger)) {
          if (trigger) config.season.push({ seasonIndex: parseInt(trigger.seasonIndex), macroId: trigger.macroId || '' });
        }
      }
      if (data.macroTriggers.moonTrigger) {
        for (const trigger of Object.values(data.macroTriggers.moonTrigger)) {
          if (trigger) config.moonPhase.push({ moonIndex: parseInt(trigger.moonIndex), phaseIndex: parseInt(trigger.phaseIndex), macroId: trigger.macroId || '' });
        }
      }
      await game.settings.set(MODULE.ID, SETTINGS.MACRO_TRIGGERS, config);
    }

    // Display format settings (includes stopwatch - all locations use the same code path)
    if (data.displayFormats && Object.keys(data.displayFormats).length > 0) {
      const currentFormats = game.settings.get(MODULE.ID, SETTINGS.DISPLAY_FORMATS);
      const newFormats = { ...currentFormats };
      let stopwatchChanged = false;
      const affectedParts = new Set();
      const locationToPartMap = {
        hudDate: 'hud',
        hudTime: 'hud',
        timekeeperDate: 'timekeeper',
        timekeeperTime: 'timekeeper',
        miniCalHeader: 'miniCal',
        miniCalTime: 'miniCal',
        bigCalHeader: 'bigcal',
        chatTimestamp: 'chat',
        stopwatchRealtime: 'stopwatch',
        stopwatchGametime: 'stopwatch'
      };
      for (const [locationId, formats] of Object.entries(data.displayFormats)) {
        if (formats) {
          const defaultFormat = LOCATION_DEFAULTS[locationId] || 'dateLong';
          let gmFormat, playerFormat;
          if (formats.gmPreset === 'custom') {
            const customValue = formats.gmCustom?.trim();
            gmFormat = customValue || currentFormats[locationId]?.gm || defaultFormat;
          } else gmFormat = formats.gmPreset || defaultFormat;
          if (formats.playerPreset === 'custom') {
            const customValue = formats.playerCustom?.trim();
            playerFormat = customValue || currentFormats[locationId]?.player || defaultFormat;
          } else playerFormat = formats.playerPreset || defaultFormat;
          newFormats[locationId] = { gm: gmFormat, player: playerFormat };
          if (locationId === 'stopwatchRealtime' || locationId === 'stopwatchGametime') stopwatchChanged = true;
          if (locationToPartMap[locationId]) affectedParts.add(locationToPartMap[locationId]);
        }
      }
      await game.settings.set(MODULE.ID, SETTINGS.DISPLAY_FORMATS, newFormats);
      Hooks.callAll('calendaria.displayFormatsChanged', newFormats);
      if (stopwatchChanged) foundry.applications.instances.get('calendaria-stopwatch')?.render();
      const settingsPanel = foundry.applications.instances.get('calendaria-settings-panel');
      if (settingsPanel?.rendered && affectedParts.size > 0) settingsPanel.render({ parts: [...affectedParts] });
    }

    // Re-render applications when their settings change
    const timekeeperKeys = ['timeKeeperAutoFade', 'timeKeeperIdleOpacity', 'timeKeeperStickyPosition'];
    if (timekeeperKeys.some((k) => k in data)) foundry.applications.instances.get('time-keeper')?.render();

    const hudKeys = [
      'hudDialStyle',
      'hudTrayDirection',
      'hudCombatCompact',
      'hudCombatHide',
      'hudDomeAutoHide',
      'hudAutoFade',
      'hudIdleOpacity',
      'hudWidthScale',
      'hudShowWeather',
      'hudWeatherDisplayMode',
      'hudShowSeason',
      'hudSeasonDisplayMode',
      'hudShowEra',
      'hudEraDisplayMode',
      'hudShowCycles',
      'hudCyclesDisplayMode',
      'hudStickyTray'
    ];

    if (hudKeys.some((k) => k in data)) foundry.applications.instances.get('calendaria-hud')?.render();
    const miniCalKeys = [
      'miniCalAutoFade',
      'miniCalIdleOpacity',
      'miniCalControlsDelay',
      'miniCalConfirmSetDate',
      'miniCalStickyTimeControls',
      'miniCalStickySidebar',
      'miniCalStickyPosition',
      'miniCalShowWeather',
      'miniCalWeatherDisplayMode',
      'miniCalShowSeason',
      'miniCalSeasonDisplayMode',
      'miniCalShowEra',
      'miniCalEraDisplayMode',
      'miniCalShowCycles',
      'miniCalCyclesDisplayMode',
      'miniCalShowMoonPhases'
    ];
    if (miniCalKeys.some((k) => k in data)) foundry.applications.instances.get('mini-cal')?.render();

    const bigCalKeys = [
      'bigCalShowWeather',
      'bigCalWeatherDisplayMode',
      'bigCalShowSeason',
      'bigCalSeasonDisplayMode',
      'bigCalShowEra',
      'bigCalEraDisplayMode',
      'bigCalShowCycles',
      'bigCalCyclesDisplayMode',
      'bigCalShowMoonPhases'
    ];
    if (bigCalKeys.some((k) => k in data)) foundry.applications.instances.get('calendaria')?.render();
    const afterSnapshot = SettingsPanel.#snapshotSettings();
    await SettingsPanel.#trackChangedSettings(beforeSnapshot, afterSnapshot);
    const settingsPanel = foundry.applications.instances.get('calendaria-settings-panel');
    if (settingsPanel?.rendered) {
      settingsPanel.render({ parts: ['home'] });
      // Reset save indicator after brief delay, clearing any existing timeout
      if (settingsPanel.#saveTimeout) clearTimeout(settingsPanel.#saveTimeout);
      settingsPanel.#saveTimeout = setTimeout(() => settingsPanel.#setSaveIndicator('saved'), 750);
    }
  }

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
      miniCal: { setting: SETTINGS.MINI_CAL_POSITION, appId: 'mini-cal' },
      hud: { setting: SETTINGS.CALENDAR_HUD_POSITION, appId: 'calendaria-hud' },
      timekeeper: { setting: SETTINGS.TIME_KEEPER_POSITION, appId: 'time-keeper' }
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
    app?.render({ force: true, parts: ['theme'] });
  }

  /**
   * Reset a section's settings to their default values.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onResetSection(_event, target) {
    const sectionId = target.dataset.section;
    const settingKeys = SettingsPanel.SECTION_SETTINGS[sectionId];
    if (!settingKeys?.length) return;

    // Build list of setting labels for the confirmation dialog
    const settingLabels = settingKeys
      .map((key) => {
        const meta = SettingsPanel.SETTING_METADATA[key];
        return meta ? localize(meta.label) : key;
      })
      .filter((label) => label);

    const listHtml = settingLabels.map((label) => `<li>${label}</li>`).join('');
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.SettingsPanel.ResetSection.Title') },
      content: `<p>${localize('CALENDARIA.SettingsPanel.ResetSection.Content')}</p><ul class="reset-section-list">${listHtml}</ul>`,
      yes: { label: localize('CALENDARIA.Common.Reset'), icon: 'fas fa-undo' },
      no: { label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
    });

    if (!confirmed) return;

    // Reset each setting to its default value
    for (const key of settingKeys) {
      const setting = game.settings.settings.get(`${MODULE.ID}.${key}`);
      if (setting) {
        const defaultValue = setting.type?.initial ?? setting.default;
        if (defaultValue !== undefined) await game.settings.set(MODULE.ID, key, defaultValue);
      }
    }

    this.render();
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
   * Export all world settings to JSON file.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onExportSettings(_event, _target) {
    await exportSettings();
  }

  /**
   * Import settings from JSON file.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onImportSettings(_event, _target) {
    await importSettings(() => this?.render({ force: true }));
  }

  /**
   * Open the Calendar HUD.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenHUD(_event, _target) {
    HUD.show();
  }

  /**
   * Close the Calendar HUD.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onCloseHUD(_event, _target) {
    HUD.hide();
  }

  /**
   * Open the MiniCal.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenMiniCal(_event, _target) {
    MiniCal.show();
  }

  /**
   * Close the MiniCal.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onCloseMiniCal(_event, _target) {
    MiniCal.hide();
  }

  /**
   * Open the TimeKeeper.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenTimeKeeper(_event, _target) {
    TimeKeeper.show();
  }

  /**
   * Close the TimeKeeper.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onCloseTimeKeeper(_event, _target) {
    TimeKeeper.hide();
  }

  /**
   * Open the BigCal Application.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenBigCal(_event, _target) {
    new BigCal().render(true);
  }

  /**
   * Close the BigCal.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onCloseBigCal(_event, _target) {
    foundry.applications.instances.get('calendaria-big-cal')?.close();
  }

  /**
   * Open the Stopwatch.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenStopwatch(_event, _target) {
    Stopwatch.show();
  }

  /**
   * Close the Stopwatch.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onCloseStopwatch(_event, _target) {
    Stopwatch.hide();
  }

  /**
   * Add a new moon phase trigger.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onAddMoonTrigger(_event, _target) {
    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.moonPhase) config.moonPhase = [];
    const calendar = CalendarManager.getActiveCalendar();
    const moons = calendar?.moonsArray ?? [];
    const usedCombos = new Set(config.moonPhase.map((t) => `${t.moonIndex}:${t.phaseIndex}`));
    let found = false;
    let moonIndex = -1;
    let phaseIndex = -1;
    for (let m = 0; m < moons.length && !found; m++) {
      const phases = Object.values(moons[m]?.phases ?? {});
      for (let p = 0; p < phases.length && !found; p++) {
        if (!usedCombos.has(`${m}:${p}`)) {
          moonIndex = m;
          phaseIndex = p;
          found = true;
        }
      }
    }
    if (!found && !usedCombos.has('-1:-1')) {
      moonIndex = -1;
      phaseIndex = -1;
      found = true;
    }
    if (!found) {
      ui.notifications.warn('CALENDARIA.MacroTrigger.AllMoonsUsed', { localize: true });
      return;
    }
    config.moonPhase.push({ moonIndex, phaseIndex, macroId: '' });
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
    const config = foundry.utils.deepClone(game.settings.get(MODULE.ID, SETTINGS.MACRO_TRIGGERS));
    if (!config.season) config.season = [];
    const calendar = CalendarManager.getActiveCalendar();
    const seasons = calendar?.seasonsArray ?? [];
    const usedIndices = new Set(config.season.map((t) => t.seasonIndex));
    let seasonIndex = seasons.findIndex((_, i) => !usedIndices.has(i));
    if (seasonIndex === -1 && !usedIndices.has(-1)) seasonIndex = -1;
    if (seasonIndex === -1 && usedIndices.has(-1)) {
      ui.notifications.warn('CALENDARIA.MacroTrigger.AllSeasonsUsed', { localize: true });
      return;
    }
    config.season.push({ seasonIndex, macroId: '' });
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

  /**
   * Open weather preset dialog for adding or editing.
   * @param {object|null} preset - Existing preset to edit, or null for new
   * @returns {Promise<object|null>} The preset data or null if cancelled
   */
  static async #openWeatherPresetDialog(preset = null) {
    const isNew = !preset;
    const data = preset || { label: '', icon: 'fa-cloud', color: '#888888', tempMin: 10, tempMax: 25, darknessPenalty: 0, environmentBase: null, environmentDark: null };
    const envBase = data.environmentBase ?? {};
    const envDark = data.environmentDark ?? {};
    const unitSymbol = getTemperatureUnit() === 'fahrenheit' ? '°F' : '°C';
    const displayMin = toDisplayUnit(data.tempMin);
    const displayMax = toDisplayUnit(data.tempMax);

    const content = `
      <form class="weather-preset-dialog">
        <div class="form-group">
          <label>${localize('CALENDARIA.SettingsPanel.WeatherPresets.NamePlaceholder')}</label>
          <input type="text" name="label" value="${data.label}" placeholder="${localize('CALENDARIA.SettingsPanel.WeatherPresets.NamePlaceholder')}" autofocus>
        </div>
        <div class="form-group">
          <label>${localize('CALENDARIA.SettingsPanel.WeatherPresets.Icon')}</label>
          <input type="text" name="icon" value="${data.icon}" placeholder="fa-cloud">
          <p class="hint">${localize('CALENDARIA.SettingsPanel.WeatherPresets.IconTooltip')}</p>
        </div>
        <div class="form-group">
          <label>${localize('CALENDARIA.SettingsPanel.WeatherPresets.Color')}</label>
          <input type="color" name="color" value="${data.color}">
        </div>
        <div class="form-group">
          <label>${localize('CALENDARIA.SettingsPanel.WeatherPresets.TempRange')}</label>
          <div class="form-fields">
            <input type="number" name="tempMin" value="${displayMin}" placeholder="0">
            <span>–</span>
            <input type="number" name="tempMax" value="${displayMax}" placeholder="25">
            <span>${unitSymbol}</span>
          </div>
        </div>
        <div class="form-group">
          <label>${localize('CALENDARIA.SettingsPanel.WeatherPresets.DarknessPenalty')}</label>
          <input type="number" name="darknessPenalty" value="${data.darknessPenalty}" step="0.05" min="-0.5" max="0.5">
          <p class="hint">${localize('CALENDARIA.SettingsPanel.WeatherPresets.DarknessPenaltyTooltip')}</p>
        </div>
        <fieldset>
          <legend>${localize('CALENDARIA.SettingsPanel.WeatherPresets.EnvironmentLighting')}</legend>
          <p class="hint">${localize('CALENDARIA.SettingsPanel.WeatherPresets.EnvironmentLightingHint')}</p>
          <div class="form-group">
            <label>${localize('CALENDARIA.SettingsPanel.WeatherPresets.BaseHue')}</label>
            <div class="form-fields">
              <input type="number" name="baseHue" min="0" max="360" step="1" value="${envBase.hue ?? ''}" placeholder="${localize('CALENDARIA.Common.Default')}">
              <span>°</span>
            </div>
          </div>
          <div class="form-group">
            <label>${localize('CALENDARIA.SettingsPanel.WeatherPresets.BaseSaturation')}</label>
            <div class="form-fields">
              <input type="number" name="baseSaturation" min="0" max="1" step="0.1" value="${envBase.saturation ?? ''}" placeholder="${localize('CALENDARIA.Common.Default')}">
            </div>
          </div>
          <div class="form-group">
            <label>${localize('CALENDARIA.SettingsPanel.WeatherPresets.DarkHue')}</label>
            <div class="form-fields">
              <input type="number" name="darkHue" min="0" max="360" step="1" value="${envDark.hue ?? ''}" placeholder="${localize('CALENDARIA.Common.Default')}">
              <span>°</span>
            </div>
          </div>
          <div class="form-group">
            <label>${localize('CALENDARIA.SettingsPanel.WeatherPresets.DarkSaturation')}</label>
            <div class="form-fields">
              <input type="number" name="darkSaturation" min="0" max="1" step="0.1" value="${envDark.saturation ?? ''}" placeholder="${localize('CALENDARIA.Common.Default')}">
            </div>
          </div>
        </fieldset>
      </form>
    `;

    const title = isNew ? localize('CALENDARIA.SettingsPanel.WeatherPresets.Add') : localize('CALENDARIA.SettingsPanel.WeatherPresets.Edit');
    return foundry.applications.api.DialogV2.prompt({
      window: { title },
      position: { width: 'auto', height: 'auto' },
      content,
      ok: {
        callback: (_event, button, _dialog) => {
          const form = button.form;
          const baseHue = form.elements.baseHue.value ? parseFloat(form.elements.baseHue.value) : null;
          const baseSat = form.elements.baseSaturation.value ? parseFloat(form.elements.baseSaturation.value) : null;
          const darkHue = form.elements.darkHue.value ? parseFloat(form.elements.darkHue.value) : null;
          const darkSat = form.elements.darkSaturation.value ? parseFloat(form.elements.darkSaturation.value) : null;
          return {
            label: form.elements.label.value.trim(),
            icon: form.elements.icon.value.trim() || 'fa-cloud',
            color: form.elements.color.value || '#888888',
            tempMin: fromDisplayUnit(Number(form.elements.tempMin.value) || 10),
            tempMax: fromDisplayUnit(Number(form.elements.tempMax.value) || 25),
            darknessPenalty: Number(form.elements.darknessPenalty.value) || 0,
            environmentBase: baseHue !== null || baseSat !== null ? { hue: baseHue, saturation: baseSat } : null,
            environmentDark: darkHue !== null || darkSat !== null ? { hue: darkHue, saturation: darkSat } : null
          };
        }
      }
    });
  }

  /**
   * Add a custom weather preset.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onAddWeatherPreset(_event, _target) {
    const result = await SettingsPanel.#openWeatherPresetDialog();
    if (!result || !result.label) return;

    const currentPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    currentPresets.push({
      id: foundry.utils.randomID(),
      label: result.label,
      icon: result.icon,
      color: result.color,
      category: 'custom',
      tempMin: result.tempMin,
      tempMax: result.tempMax,
      darknessPenalty: result.darknessPenalty,
      environmentBase: result.environmentBase,
      environmentDark: result.environmentDark,
      description: ''
    });
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS, currentPresets);
    this.render({ parts: ['weather'] });
  }

  /**
   * Edit an existing custom weather preset.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onEditWeatherPreset(_event, target) {
    const presetId = target.dataset.presetId;
    if (!presetId) return;

    const currentPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const preset = currentPresets.find((p) => p.id === presetId);
    if (!preset) return;

    const result = await SettingsPanel.#openWeatherPresetDialog(preset);
    if (!result || !result.label) return;

    preset.label = result.label;
    preset.icon = result.icon;
    preset.color = result.color;
    preset.tempMin = result.tempMin;
    preset.tempMax = result.tempMax;
    preset.darknessPenalty = result.darknessPenalty;
    preset.environmentBase = result.environmentBase;
    preset.environmentDark = result.environmentDark;

    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS, currentPresets);
    this.render({ parts: ['weather'] });
  }

  /**
   * Remove a custom weather preset.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onRemoveWeatherPreset(_event, target) {
    const presetId = target.dataset.presetId;
    if (!presetId) return;
    const currentPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
    const filtered = currentPresets.filter((p) => p.id !== presetId);
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS, filtered);
    this.render({ parts: ['weather'] });
  }

  /**
   * Navigate to a specific setting's tab and fieldset.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static #onNavigateToSetting(_event, target) {
    const { tab, fieldset } = target.dataset;
    if (!tab) return;
    this.changeTab(tab, 'primary');
    if (fieldset) {
      requestAnimationFrame(() => {
        const fieldsetEl = this.element.querySelector(`fieldset.${fieldset}, fieldset[data-fieldset="${fieldset}"]`);
        if (fieldsetEl) fieldsetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  /**
   * Show the token reference dialog.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static #onShowTokenReference(_event, target) {
    const contextType = target.dataset.contextType || 'all';
    TokenReferenceDialog.open({ contextType });
  }

  /** @inheritdoc */
  _attachPartListeners(partId, htmlElement, options) {
    super._attachPartListeners(partId, htmlElement, options);

    // Theme tab: enable reset button when color changes
    if (partId === 'theme') {
      const colorInputs = htmlElement.querySelectorAll('input[type="color"][data-key]');
      colorInputs.forEach((input) => {
        input.addEventListener('change', () => {
          const resetBtn = input.closest('.color-table-row')?.querySelector('.reset-color');
          if (resetBtn) {
            resetBtn.disabled = false;
            resetBtn.removeAttribute('aria-disabled');
          }
        });
      });
    }

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

    if (partId === 'module') {
      const toolbarCheckbox = htmlElement.querySelector('input[name="showToolbarButton"]');
      const toolbarAppsGroup = htmlElement.querySelector('.toolbar-apps-checkboxes')?.closest('.form-group');
      const toolbarAppsInputs = toolbarAppsGroup?.querySelectorAll('input[name="toolbarApps"]');
      if (toolbarCheckbox && toolbarAppsGroup && toolbarAppsInputs) {
        toolbarCheckbox.addEventListener('change', () => {
          toolbarAppsGroup.classList.toggle('disabled', !toolbarCheckbox.checked);
          toolbarAppsInputs.forEach((input) => (input.disabled = !toolbarCheckbox.checked));
        });
      }
    }

    // Range slider value display update
    if (partId === 'timekeeper') {
      const rangeInput = htmlElement.querySelector('input[name="timeKeeperIdleOpacity"]');
      const rangeGroup = rangeInput?.closest('.form-group');
      const numberInput = rangeGroup?.querySelector('.range-value');
      if (rangeInput && numberInput) {
        rangeInput.addEventListener('input', (e) => {
          numberInput.value = e.target.value;
        });
        numberInput.addEventListener('input', (e) => {
          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
          rangeInput.value = val;
          rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }

      // Auto-fade checkbox toggles opacity slider
      const autoFadeCheckbox = htmlElement.querySelector('input[name="timeKeeperAutoFade"]');
      if (autoFadeCheckbox && rangeInput && rangeGroup && numberInput) {
        autoFadeCheckbox.addEventListener('change', () => {
          rangeInput.disabled = !autoFadeCheckbox.checked;
          numberInput.disabled = !autoFadeCheckbox.checked;
          rangeGroup.classList.toggle('disabled', !autoFadeCheckbox.checked);
        });
      }
    }

    if (partId === 'miniCal') {
      const controlsDelayInput = htmlElement.querySelector('input[name="miniCalControlsDelay"]');
      const controlsDelayGroup = controlsDelayInput?.closest('.form-group');
      const controlsDelayValue = controlsDelayGroup?.querySelector('.range-value');
      if (controlsDelayInput && controlsDelayValue) {
        controlsDelayInput.addEventListener('input', (e) => {
          controlsDelayValue.textContent = `${e.target.value}s`;
        });
      }

      // Opacity range slider with number input
      const opacityInput = htmlElement.querySelector('input[name="miniCalIdleOpacity"]');
      const opacityGroup = opacityInput?.closest('.form-group');
      const opacityNumber = opacityGroup?.querySelector('.range-value');
      if (opacityInput && opacityNumber) {
        opacityInput.addEventListener('input', (e) => {
          opacityNumber.value = e.target.value;
        });
        opacityNumber.addEventListener('input', (e) => {
          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
          opacityInput.value = val;
          opacityInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }

      // Auto-fade checkbox toggles opacity slider
      const autoFadeCheckbox = htmlElement.querySelector('input[name="miniCalAutoFade"]');
      if (autoFadeCheckbox && opacityInput && opacityGroup && opacityNumber) {
        autoFadeCheckbox.addEventListener('change', () => {
          opacityInput.disabled = !autoFadeCheckbox.checked;
          opacityNumber.disabled = !autoFadeCheckbox.checked;
          opacityGroup.classList.toggle('disabled', !autoFadeCheckbox.checked);
        });
      }
    }

    if (partId === 'hud') {
      const hudModeSelect = htmlElement.querySelector('select[name="calendarHUDMode"]');
      const dialStyleSelect = htmlElement.querySelector('select[name="hudDialStyle"]');
      const dialStyleGroup = dialStyleSelect?.closest('.form-group');
      const dialStyleHint = dialStyleGroup?.querySelector('.hint');
      const widthScaleInput = htmlElement.querySelector('input[name="hudWidthScale"]');
      const widthScaleGroup = widthScaleInput?.closest('.form-group');
      const widthScaleHint = widthScaleGroup?.querySelector('.hint');
      const widthScaleValue = widthScaleGroup?.querySelector('.range-value');

      if (widthScaleInput && widthScaleValue) {
        widthScaleInput.addEventListener('input', (e) => {
          const scale = parseFloat(e.target.value);
          widthScaleValue.textContent = `${scale}x`;
        });
      }

      if (hudModeSelect) {
        const updateCompactState = () => {
          const isCompact = hudModeSelect.value === 'compact';
          if (dialStyleSelect) {
            dialStyleSelect.disabled = isCompact;
            if (isCompact) dialStyleSelect.value = 'slice';
            else dialStyleSelect.value = game.settings.get(MODULE.ID, SETTINGS.HUD_DIAL_STYLE);
            dialStyleGroup?.classList.toggle('disabled', isCompact);
            if (dialStyleHint) dialStyleHint.textContent = isCompact ? localize('CALENDARIA.Settings.HUDDialStyle.DisabledHint') : localize('CALENDARIA.Settings.HUDDialStyle.Hint');
          }
          if (widthScaleInput) {
            widthScaleInput.disabled = isCompact;
            widthScaleGroup?.classList.toggle('disabled', isCompact);
            if (widthScaleHint) widthScaleHint.textContent = isCompact ? localize('CALENDARIA.Settings.HUDWidthScale.DisabledHint') : localize('CALENDARIA.Settings.HUDWidthScale.Hint');
          }
        };
        hudModeSelect.addEventListener('change', updateCompactState);
        updateCompactState();
      }

      // Opacity range slider with number input
      const opacityInput = htmlElement.querySelector('input[name="hudIdleOpacity"]');
      const opacityGroup = opacityInput?.closest('.form-group');
      const opacityNumber = opacityGroup?.querySelector('.range-value');
      if (opacityInput && opacityNumber) {
        opacityInput.addEventListener('input', (e) => {
          opacityNumber.value = e.target.value;
        });
        opacityNumber.addEventListener('input', (e) => {
          const val = Math.max(0, Math.min(100, parseInt(e.target.value) || 0));
          opacityInput.value = val;
          opacityInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }

      // Auto-fade checkbox toggles opacity slider
      const autoFadeCheckbox = htmlElement.querySelector('input[name="hudAutoFade"]');
      if (autoFadeCheckbox && opacityInput && opacityGroup && opacityNumber) {
        autoFadeCheckbox.addEventListener('change', () => {
          opacityInput.disabled = !autoFadeCheckbox.checked;
          opacityNumber.disabled = !autoFadeCheckbox.checked;
          opacityGroup.classList.toggle('disabled', !autoFadeCheckbox.checked);
        });
      }
    }

    // Permissions tab checkbox cascade: checking a role auto-checks higher roles
    if (partId === 'permissions') {
      const permissionRows = htmlElement.querySelectorAll('.permission-row');
      permissionRows.forEach((row) => {
        const checkboxes = row.querySelectorAll('input[type="checkbox"][data-role-order]');
        checkboxes.forEach((checkbox) => {
          checkbox.addEventListener('change', (e) => {
            if (!e.target.checked) return;
            const currentOrder = parseInt(e.target.dataset.roleOrder);
            checkboxes.forEach((cb) => {
              const order = parseInt(cb.dataset.roleOrder);
              if (order > currentOrder && !cb.disabled) cb.checked = true;
            });
          });
        });
      });
    }

    // Canvas tab brightness multiplier range slider
    if (partId === 'canvas') {
      const rangeInput = htmlElement.querySelector('input[name="defaultBrightnessMultiplier"]');
      const rangeGroup = rangeInput?.closest('.form-group');
      const rangeValue = rangeGroup?.querySelector('.range-value');
      if (rangeInput && rangeValue) {
        rangeInput.addEventListener('input', (e) => {
          rangeValue.textContent = `${e.target.value}x`;
        });
      }
    }

    // Format preset dropdowns toggle custom input visibility and update preview
    // Applied to all tabs with format settings: hud, timekeeper, miniCal, bigcal, chat, stopwatch
    const formatParts = ['hud', 'timekeeper', 'miniCal', 'bigcal', 'chat', 'stopwatch'];
    if (formatParts.includes(partId)) {
      const presetSelects = htmlElement.querySelectorAll('select[name*="Preset"]');
      presetSelects.forEach((select) => {
        const locationId = select.dataset.location;
        const role = select.dataset.role;
        const customInput = htmlElement.querySelector(`input[name="displayFormats.${locationId}.${role}Custom"]`);
        const previewSpan = htmlElement.querySelector(`.format-preview[data-location="${locationId}"][data-role="${role}"]`);

        // Update preview on preset change
        select.addEventListener('change', (event) => {
          if (event.target.value === 'custom') {
            customInput?.classList.remove('hidden');
            // Pre-populate with current format string if empty (fixes #199, #210)
            if (customInput && !customInput.value.trim()) {
              const savedFormats = game.settings.get(MODULE.ID, SETTINGS.DISPLAY_FORMATS);
              const defaultFormat = LOCATION_DEFAULTS[locationId] || 'dateLong';
              let currentFormat = savedFormats[locationId]?.[role] || defaultFormat;
              // Resolve calendarDefault to actual format string from calendar
              if (currentFormat === 'calendarDefault') {
                const locationFormatKeys = {
                  hudDate: 'dateLong',
                  hudTime: 'time24',
                  timekeeperDate: 'dateLong',
                  timekeeperTime: 'time24',
                  miniCalHeader: 'dateLong',
                  miniCalTime: 'time24',
                  bigCalHeader: 'dateFull',
                  chatTimestamp: 'dateLong'
                };
                const formatKey = locationFormatKeys[locationId] || 'dateLong';
                const calendar = CalendarManager.getActiveCalendar();
                currentFormat = calendar?.dateFormats?.[formatKey] || formatKey;
              }
              // Convert preset name to format string, or use as-is if already custom
              currentFormat = DEFAULT_FORMAT_PRESETS[currentFormat] || currentFormat;
              customInput.value = currentFormat;
            }
            customInput?.focus();
          } else {
            customInput?.classList.add('hidden');
            if (customInput) customInput.value = '';
          }
          // Update preview for new selection
          this.#updateFormatPreview(previewSpan, locationId, event.target.value, customInput?.value);
        });

        // Initial preview on load
        this.#updateFormatPreview(previewSpan, locationId, select.value, customInput?.value);
      });

      // Custom format input handlers with debounced preview
      const customInputs = htmlElement.querySelectorAll('.format-custom-input');
      customInputs.forEach((input) => {
        const locationId = input.dataset.location;
        const role = input.dataset.role;
        const previewSpan = htmlElement.querySelector(`.format-preview[data-location="${locationId}"][data-role="${role}"]`);

        let debounceTimer;
        input.addEventListener('input', () => {
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            this.#updateFormatPreview(previewSpan, locationId, 'custom', input.value);
            // Sync invalid class with error state
            input.classList.toggle('invalid', previewSpan?.classList.contains('error') ?? false);
          }, 300);
        });
      });
    }
  }

  /**
   * Update format preview for a format location.
   * @param {HTMLSpanElement} previewSpan - The preview span element
   * @param {string} locationId - The location identifier
   * @param {string} preset - The selected preset value
   * @param {string} [customValue] - Custom format string (when preset is 'custom')
   */
  #updateFormatPreview(previewSpan, locationId, preset, customValue) {
    if (!previewSpan) return;

    // Handle 'off' preset - no preview
    if (preset === 'off') {
      previewSpan.textContent = '';
      previewSpan.classList.remove('error');
      return;
    }

    // Resolve format string from preset or custom value
    let formatStr;
    if (preset === 'custom') {
      formatStr = customValue?.trim();
      if (!formatStr) {
        previewSpan.textContent = '';
        previewSpan.classList.remove('error');
        return;
      }
    } else if (preset === 'calendarDefault') {
      // Resolve calendarDefault to actual format string from calendar
      const locationFormatKeys = {
        hudDate: 'dateLong',
        hudTime: 'time24',
        timekeeperDate: 'dateLong',
        timekeeperTime: 'time24',
        miniCalHeader: 'dateLong',
        miniCalTime: 'time24',
        bigCalHeader: 'dateFull',
        chatTimestamp: 'dateLong'
      };
      const formatKey = locationFormatKeys[locationId] || 'dateLong';
      const calendar = CalendarManager.getActiveCalendar();
      const calFormat = calendar?.dateFormats?.[formatKey];
      formatStr = calFormat || DEFAULT_FORMAT_PRESETS[formatKey] || formatKey;
    } else {
      formatStr = DEFAULT_FORMAT_PRESETS[preset] || preset;
    }

    // Get current date components for preview
    const calendar = CalendarManager.getActiveCalendar();
    const rawComponents = calendar?.timeToComponents?.(game.time.worldTime);
    const yearZero = calendar?.years?.yearZero ?? 0;
    const components = rawComponents
      ? { ...rawComponents, year: rawComponents.year + yearZero, dayOfMonth: (rawComponents.dayOfMonth ?? 0) + 1 }
      : { year: 1492, month: 0, dayOfMonth: 15, hour: 14, minute: 30, second: 0 };

    // Check if this is a stopwatch location (uses different format)
    const isStopwatch = locationId === 'stopwatchRealtime' || locationId === 'stopwatchGametime';
    if (isStopwatch) {
      previewSpan.textContent = formatStr;
      previewSpan.classList.remove('error');
      return;
    }

    const result = validateFormatString(formatStr, calendar, components);
    if (result.valid) {
      previewSpan.textContent = result.preview || formatStr;
      previewSpan.classList.remove('error');
    } else {
      previewSpan.textContent = localize(result.error || 'CALENDARIA.Format.Error.Invalid');
      previewSpan.classList.add('error');
    }
  }
}
