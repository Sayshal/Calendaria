/**
 * Unified Settings Panel Application
 * @module Applications/SettingsPanel
 * @author Tyler
 */

import { BUNDLED_CALENDARS, CalendarManager, CalendarRegistry } from '../../calendar/_module.mjs';
import { HOOKS, MODULE, SETTINGS, TEMPLATES } from '../../constants.mjs';
import { FestivalManager } from '../../festivals/_module.mjs';
import { addDays, getAllPresets } from '../../notes/_module.mjs';
import { TimeClock, getTimeIncrements } from '../../time/_module.mjs';
import {
  COLOR_CATEGORIES,
  COLOR_DEFINITIONS,
  DEFAULT_COLORS,
  DEFAULT_FORMAT_PRESETS,
  LOCATION_DEFAULTS,
  THEME_PRESETS,
  applyCustomColors,
  canChangeActiveCalendar,
  canViewBigCal,
  canViewChronicle,
  canViewHUD,
  canViewMiniCal,
  canViewStopwatch,
  canViewSunDial,
  canViewTimeKeeper,
  createCustomTheme,
  deleteCustomTheme,
  exportSettings,
  format,
  getColorsForTheme,
  getCustomTheme,
  getCustomThemes,
  getForcedTheme,
  importSettings,
  initializeTheme,
  isCustomThemeKey,
  localize,
  validateFormatString
} from '../../utils/_module.mjs';
import { WeatherManager } from '../../weather/_module.mjs';
import {
  BigCal,
  CalendarEditor,
  Chronicle,
  CinematicOverlay,
  HUD,
  ImporterApp,
  MiniCal,
  PresetManager,
  SetDateDialog,
  Stopwatch,
  SunDial,
  TimeKeeper,
  TokenReferenceDialog,
  WeatherEditor,
  WeatherProbabilityDialog
} from '../_module.mjs';

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
    window: {
      icon: 'fas fa-cog',
      resizable: false,
      title: 'CALENDARIA.SettingsPanel.Title',
      controls: [{ action: 'toggleNavCollapse', icon: 'fa-solid fa-bars', label: 'CALENDARIA.SettingsPanel.NavCollapse.Tooltip' }]
    },
    position: { width: 900, height: 860 },
    form: { handler: SettingsPanel.#onSubmit, submitOnChange: true, closeOnSubmit: false },
    actions: {
      openCalendarEditor: SettingsPanel.#onOpenCalendarEditor,
      openImporter: SettingsPanel.#onOpenImporter,
      openSetDateDialog: SettingsPanel.#onOpenSetDateDialog,
      resetPosition: SettingsPanel.#onResetPosition,
      openPresetManager: SettingsPanel.#onOpenPresetManager,
      openEnricherReference: SettingsPanel.#onOpenEnricherReference,
      resetColor: SettingsPanel.#onResetColor,
      customizeTheme: SettingsPanel.#onCustomizeTheme,
      deleteCustomTheme: SettingsPanel.#onDeleteCustomTheme,
      exportTheme: SettingsPanel.#onExportTheme,
      importTheme: SettingsPanel.#onImportTheme,
      openHUD: SettingsPanel.#onOpenHUD,
      closeHUD: SettingsPanel.#onCloseHUD,
      openMiniCal: SettingsPanel.#onOpenMiniCal,
      closeMiniCal: SettingsPanel.#onCloseMiniCal,
      openTimeKeeper: SettingsPanel.#onOpenTimeKeeper,
      closeTimeKeeper: SettingsPanel.#onCloseTimeKeeper,
      showBigCal: SettingsPanel.#onShowBigCal,
      closeBigCal: SettingsPanel.#onCloseBigCal,
      openChronicle: SettingsPanel.#onOpenChronicle,
      closeChronicle: SettingsPanel.#onCloseChronicle,
      openStopwatch: SettingsPanel.#onOpenStopwatch,
      closeStopwatch: SettingsPanel.#onCloseStopwatch,
      openSunDial: SettingsPanel.#onOpenSunDial,
      closeSunDial: SettingsPanel.#onCloseSunDial,
      addMoonTrigger: SettingsPanel.#onAddMoonTrigger,
      removeMoonTrigger: SettingsPanel.#onRemoveMoonTrigger,
      addSeasonTrigger: SettingsPanel.#onAddSeasonTrigger,
      removeSeasonTrigger: SettingsPanel.#onRemoveSeasonTrigger,
      openWeatherEditor: SettingsPanel.#onOpenWeatherEditor,
      openWeatherProbabilities: SettingsPanel.#onOpenWeatherProbabilities,
      syncFestivals: SettingsPanel.#onSyncFestivals,
      regenerateAllWeather: SettingsPanel.#onRegenerateAllWeather,
      navigateToSetting: SettingsPanel.#onNavigateToSetting,
      showTokenReference: SettingsPanel.#onShowTokenReference,
      resetSection: SettingsPanel.#onResetSection,
      resetFogOfWar: SettingsPanel.#onResetFogOfWar,
      exportSettings: SettingsPanel.#onExportSettings,
      importSettings: SettingsPanel.#onImportSettings,
      toggleNavCollapse: SettingsPanel.#onToggleNavCollapse,
      playCinematicPreview: SettingsPanel.#onPlayCinematicPreview
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
    fogofwar: { template: TEMPLATES.SETTINGS.PANEL_FOG_OF_WAR, scrollable: [''] },
    canvas: { template: TEMPLATES.SETTINGS.PANEL_CANVAS, scrollable: [''] },
    module: { template: TEMPLATES.SETTINGS.PANEL_MODULE, scrollable: [''] },
    bigcal: { template: TEMPLATES.SETTINGS.PANEL_BIGCAL, scrollable: [''] },
    miniCal: { template: TEMPLATES.SETTINGS.PANEL_MINI_CAL, scrollable: [''] },
    hud: { template: TEMPLATES.SETTINGS.PANEL_HUD, scrollable: [''] },
    timekeeper: { template: TEMPLATES.SETTINGS.PANEL_TIMEKEEPER, scrollable: [''] },
    cinematics: { template: TEMPLATES.SETTINGS.PANEL_CINEMATICS, scrollable: [''] },
    chronicle: { template: TEMPLATES.SETTINGS.PANEL_CHRONICLE, scrollable: [''] },
    stopwatch: { template: TEMPLATES.SETTINGS.PANEL_STOPWATCH, scrollable: [''] },
    sunDial: { template: TEMPLATES.SETTINGS.PANEL_SUN_DIAL, scrollable: [''] },
    footer: { template: TEMPLATES.SETTINGS.PANEL_FOOTER }
  };

  /** @override */
  static TAB_GROUPS = [
    { id: 'calendar', label: 'CALENDARIA.Common.Calendar', tooltip: 'CALENDARIA.SettingsPanel.GroupTooltip.Calendar', color: '#84cc16' },
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
        { id: 'fogofwar', group: 'primary', icon: 'fas fa-eye-slash', label: 'CALENDARIA.SettingsPanel.Tab.FogOfWar', tabGroup: 'calendar', gmOnly: true },
        { id: 'theme', group: 'primary', icon: 'fas fa-palette', label: 'CALENDARIA.SettingsPanel.Tab.Theme', tabGroup: 'calendar' },
        { id: 'macros', group: 'primary', icon: 'fas fa-bolt', label: 'CALENDARIA.SettingsPanel.Tab.Macros', tabGroup: 'technical', gmOnly: true },
        { id: 'chat', group: 'primary', icon: 'fas fa-comments', label: 'CALENDARIA.SettingsPanel.Tab.Chat', tabGroup: 'technical', gmOnly: true },
        { id: 'permissions', group: 'primary', icon: 'fas fa-user-shield', label: 'CALENDARIA.SettingsPanel.Tab.Permissions', tabGroup: 'technical', gmOnly: true },
        { id: 'canvas', group: 'primary', icon: 'fas fa-map', label: 'CALENDARIA.SettingsPanel.Tab.Canvas', tabGroup: 'technical', gmOnly: true },
        { id: 'module', group: 'primary', icon: 'fas fa-tools', label: 'CALENDARIA.SettingsPanel.Tab.Module', tabGroup: 'technical' },
        { id: 'bigcal', group: 'primary', icon: 'fas fa-calendar-days', label: 'CALENDARIA.Common.BigCal', tabGroup: 'apps' },
        { id: 'miniCal', group: 'primary', icon: 'fas fa-compress', label: 'CALENDARIA.Common.MiniCal', tabGroup: 'apps' },
        { id: 'hud', group: 'primary', icon: 'fas fa-landmark-dome', label: 'CALENDARIA.SettingsPanel.Tab.HUD', tabGroup: 'apps' },
        { id: 'cinematics', group: 'primary', icon: 'fas fa-film', label: 'CALENDARIA.SettingsPanel.Tab.Cinematics', tabGroup: 'technical', gmOnly: true },
        { id: 'chronicle', group: 'primary', icon: 'fas fa-scroll', label: 'CALENDARIA.Chronicle.Title', tabGroup: 'apps' },
        { id: 'timekeeper', group: 'primary', icon: 'fas fa-gauge', label: 'CALENDARIA.Common.TimeKeeper', tabGroup: 'apps' },
        { id: 'stopwatch', group: 'primary', icon: 'fas fa-stopwatch', label: 'CALENDARIA.Common.StopWatch', tabGroup: 'apps' },
        { id: 'sunDial', group: 'primary', icon: 'fas fa-sun', label: 'CALENDARIA.SettingsPanel.Tab.SunDial', tabGroup: 'apps' }
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
      if (tab.id === 'bigcal' && !canViewBigCal()) return false;
      if (tab.id === 'hud' && !canViewHUD()) return false;
      if (tab.id === 'chronicle' && !canViewChronicle()) return false;
      if (tab.id === 'miniCal' && !canViewMiniCal()) return false;
      if (tab.id === 'stopwatch' && !canViewStopwatch()) return false;
      if (tab.id === 'timekeeper' && !canViewTimeKeeper()) return false;
      if (tab.id === 'sunDial' && !canViewSunDial()) return false;
      return true;
    };
    const mapTab = (tab) => ({ ...tab, group: 'primary', active: tab.id === activeTab, cssClass: tab.id === activeTab ? 'active' : '' });
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

  /** Whether the nav is collapsed to icon-only mode */
  #navCollapsed = false;

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (this.#navCollapsed) this.element.classList.add('nav-collapsed');
    const themeModeSelect = this.element.querySelector('select[name="themeMode"]');
    if (themeModeSelect && !themeModeSelect.dataset.listenerAttached) {
      themeModeSelect.dataset.listenerAttached = 'true';
      themeModeSelect.addEventListener('change', async (e) => {
        const mode = e.target.value;
        if (!mode) return;
        await game.settings.set(MODULE.ID, SETTINGS.THEME_MODE, mode);
        applyCustomColors(getColorsForTheme(mode));
        this.render({ force: true, parts: ['theme'] });
      });
    }
    if (!this.element.dataset.formListenerAttached) {
      this.element.dataset.formListenerAttached = 'true';
      this.element.addEventListener('change', () => this.#setSaveIndicator('saving'));
    }
    this.#setupSearchListeners();
    this.#setupDependentFields();
  }

  /** Wire up data-depends-on fields to toggle disabled state based on a parent checkbox. */
  #setupDependentFields() {
    for (const group of this.element.querySelectorAll('[data-depends-on]')) {
      const parentName = group.dataset.dependsOn;
      const parentInput = this.element.querySelector(`[name="${parentName}"]`);
      if (!parentInput) continue;
      const toggle = () => {
        const enabled = parentInput.checked;
        group.classList.toggle('disabled', !enabled);
        for (const input of group.querySelectorAll('input, select')) input.disabled = !enabled;
      };
      toggle();
      if (!parentInput.dataset.dependencyAttached) {
        parentInput.dataset.dependencyAttached = 'true';
        parentInput.addEventListener('change', toggle);
      }
    }
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    this.#destroySearchDropdown();
  }

  /** Toggle nav between full labels and icon-only mode. */
  static #onToggleNavCollapse() {
    this.#navCollapsed = !this.#navCollapsed;
    this.element.classList.toggle('nav-collapsed', this.#navCollapsed);
  }

  /** Preview a cinematic with a 3-day skip from current time. */
  static async #onPlayCinematicPreview() {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return;
    const secondsPerDay = (calendar.days?.hoursPerDay ?? 24) * (calendar.days?.minutesPerHour ?? 60) * (calendar.days?.secondsPerMinute ?? 60);
    const payload = CinematicOverlay.buildPayload(game.time.worldTime, game.time.worldTime + 3 * secondsPerDay);
    await CinematicOverlay.play(payload);
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
      this.#searchDropdown.className = 'calendaria-settings-search';
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
        if (id === 'bigcal' && !canViewBigCal()) continue;
        if (id === 'hud' && !canViewHUD()) continue;
        if (id === 'chronicle' && !canViewChronicle()) continue;
        if (id === 'miniCal' && !canViewMiniCal()) continue;
        if (id === 'stopwatch' && !canViewStopwatch()) continue;
        if (id === 'timekeeper' && !canViewTimeKeeper()) continue;
        if (id === 'sunDial' && !canViewSunDial()) continue;
        filtered[id] = tab;
      }
      const activeTab = this.tabGroups[group];
      const activeTabDef = SettingsPanel.TABS.primary.tabs.find((t) => t.id === activeTab);
      const isActiveHidden =
        activeTabDef?.gmOnly ||
        (activeTab === 'bigcal' && !canViewBigCal()) ||
        (activeTab === 'hud' && !canViewHUD()) ||
        (activeTab === 'chronicle' && !canViewChronicle()) ||
        (activeTab === 'miniCal' && !canViewMiniCal()) ||
        (activeTab === 'stopwatch' && !canViewStopwatch()) ||
        (activeTab === 'timekeeper' && !canViewTimeKeeper()) ||
        (activeTab === 'sunDial' && !canViewSunDial());
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

  /**
   * Get localized labels for time increment keys, filtered for monthless calendars.
   * @returns {{labels: Object<string, string>, keys: string[]}} Localized labels and filtered keys
   * @private
   */
  static #getIncrementLabels() {
    const labels = {
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
    const keys = Object.keys(getTimeIncrements()).filter((key) => !isMonthless || key !== 'month');
    return { labels, keys };
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
      case 'fogofwar':
        this.#prepareFogOfWarContext(context);
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
      case 'cinematics':
        this.#prepareCinematicsContext(context);
        break;
      case 'chronicle':
        this.#prepareChronicleContext(context);
        break;
      case 'stopwatch':
        await this.#prepareStopwatchContext(context);
        break;
      case 'sunDial':
        await this.#prepareSunDialContext(context);
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
    context.canChangeCalendar = context.isGM || canChangeActiveCalendar();
    context.calendarOptions = [];
    for (const id of BUNDLED_CALENDARS) {
      const key = id
        .split('-')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
      context.calendarOptions.push({ value: id, label: localize(`CALENDARIA.Calendar.${key}.Name`), selected: id === activeCalendarId, isCustom: false });
    }
    for (const [id, data] of Object.entries(customCalendars)) {
      context.calendarOptions.push({ value: id, label: localize(data.name) || data.name || id, selected: id === activeCalendarId, isCustom: true });
    }
    context.calendarOptions.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    context.showEquivalentDatesSection = context.isGM;
    const equivalentDateCalendars = game.settings.get(MODULE.ID, SETTINGS.EQUIVALENT_DATE_CALENDARS);
    context.equivalentDateOptions = context.calendarOptions
      .filter((opt) => opt.value !== activeCalendarId)
      .map((opt) => ({ id: opt.value, label: opt.label, checked: equivalentDateCalendars.has(opt.value) }));
    context.recentSettings = this.#prepareRecentSettings();
  }

  /**
   * Metadata for settings - maps setting keys to their tab and label.
   */
  static SETTING_METADATA = {
    [SETTINGS.ACTIVE_CALENDAR]: { tab: 'home', label: 'CALENDARIA.Settings.ActiveCalendar.Name' },
    [SETTINGS.EQUIVALENT_DATE_CALENDARS]: { tab: 'home', label: 'CALENDARIA.Settings.EquivalentDateCalendars.Name' },
    [SETTINGS.ADVANCE_TIME_ON_REST]: { tab: 'time', label: 'CALENDARIA.Settings.AdvanceTimeOnRest.Name' },
    [SETTINGS.SYNC_CLOCK_PAUSE]: { tab: 'time', label: 'CALENDARIA.Settings.SyncClockPause.Name' },
    [SETTINGS.CLOCK_RUN_DURING_COMBAT]: { tab: 'time', label: 'CALENDARIA.Settings.ClockRunDuringCombat.Name' },
    [SETTINGS.REST_TO_SUNRISE]: { tab: 'time', label: 'CALENDARIA.Settings.RestToSunrise.Name' },
    [SETTINGS.TIME_SPEED_MULTIPLIER]: { tab: 'time', label: 'CALENDARIA.Settings.TimeSpeedMultiplier.Name' },
    [SETTINGS.TIME_SPEED_INCREMENT]: { tab: 'time', label: 'CALENDARIA.Settings.TimeSpeedIncrement.Name' },
    [SETTINGS.TIME_ADVANCE_INTERVAL]: { tab: 'time', label: 'CALENDARIA.Settings.TimeAdvanceInterval.Name' },
    [SETTINGS.AUTO_GENERATE_WEATHER]: { tab: 'weather', label: 'CALENDARIA.Settings.AutoGenerate.Name' },
    [SETTINGS.TEMPERATURE_UNIT]: { tab: 'weather', label: 'CALENDARIA.Common.Temperature' },
    [SETTINGS.PRECIPITATION_UNIT]: { tab: 'weather', label: 'CALENDARIA.Common.Precipitation' },
    [SETTINGS.WIND_SPEED_UNIT]: { tab: 'weather', label: 'CALENDARIA.Settings.WindSpeedUnit.Name' },
    [SETTINGS.SHOW_CHRONICLE]: { tab: 'chronicle', label: 'CALENDARIA.Settings.ShowChronicle.Name' },
    [SETTINGS.FORCE_CHRONICLE]: { tab: 'chronicle', label: 'CALENDARIA.Common.ForceDisplayForAll' },
    [SETTINGS.CHRONICLE_COMBAT_MODE]: { tab: 'chronicle', label: 'CALENDARIA.Common.CombatBehavior' },
    [SETTINGS.CHRONICLE_BIG_CAL_BUTTON]: { tab: 'chronicle', label: 'CALENDARIA.Chronicle.Settings.BigCalButton.Name' },
    [SETTINGS.CHRONICLE_MINI_CAL_BUTTON]: { tab: 'chronicle', label: 'CALENDARIA.Chronicle.Settings.MiniCalButton.Name' },
    [SETTINGS.CHRONICLE_HUD_BUTTON]: { tab: 'chronicle', label: 'CALENDARIA.Chronicle.Settings.HudButton.Name' },
    [SETTINGS.CHRONICLE_ENTRY_DEPTH]: { tab: 'chronicle', label: 'CALENDARIA.Chronicle.Settings.EntryDepth.Name' },
    [SETTINGS.CHRONICLE_SHOW_EMPTY]: { tab: 'chronicle', label: 'CALENDARIA.Chronicle.Settings.ShowEmpty.Name' },
    [SETTINGS.CHRONICLE_SHOW_WEATHER]: { tab: 'chronicle', label: 'CALENDARIA.Common.ShowWeather' },
    [SETTINGS.CHRONICLE_SHOW_MOON_PHASES]: { tab: 'chronicle', label: 'CALENDARIA.Common.ShowMoonPhases' },
    [SETTINGS.CHRONICLE_SHOW_SEASON_CHANGES]: { tab: 'chronicle', label: 'CALENDARIA.Chronicle.Settings.ShowSeasonChanges.Name' },
    [SETTINGS.FORCE_THEME]: { tab: 'theme', label: 'CALENDARIA.Settings.ForceTheme.Name' },
    [SETTINGS.THEME_MODE]: { tab: 'theme', label: 'CALENDARIA.ThemeEditor.PresetSelect' },
    [SETTINGS.CUSTOM_THEME_COLORS]: { tab: 'theme', label: 'CALENDARIA.SettingsPanel.Section.Theme' },
    [SETTINGS.CHAT_TIMESTAMP_MODE]: { tab: 'chat', label: 'CALENDARIA.Settings.ChatTimestampMode.Name' },
    [SETTINGS.CHAT_TIMESTAMP_SHOW_TIME]: { tab: 'chat', label: 'CALENDARIA.Settings.ChatTimestampShowTime.Name' },
    [SETTINGS.PERMISSIONS]: { tab: 'permissions', label: 'CALENDARIA.SettingsPanel.Tab.Permissions' },
    [SETTINGS.FOG_OF_WAR_ENABLED]: { tab: 'fogofwar', label: 'CALENDARIA.Settings.FogOfWar.Name' },
    [SETTINGS.FOG_OF_WAR_CONFIG]: { tab: 'fogofwar', label: 'CALENDARIA.Settings.FogOfWar.AutoReveal' },
    [SETTINGS.FOG_OF_WAR_START_DATE]: { tab: 'fogofwar', label: 'CALENDARIA.Settings.FogOfWar.StartDate' },
    [SETTINGS.FOG_OF_WAR_REVEAL_INTERMEDIATE]: { tab: 'fogofwar', label: 'CALENDARIA.Settings.FogOfWar.RevealIntermediate' },
    [SETTINGS.FOG_OF_WAR_NAV_MODE]: { tab: 'fogofwar', label: 'CALENDARIA.Settings.FogOfWar.NavModeName' },
    [SETTINGS.CINEMATIC_ENABLED]: { tab: 'cinematics', label: 'CALENDARIA.Cinematic.Settings.Enabled.Name' },
    [SETTINGS.CINEMATIC_THRESHOLD]: { tab: 'cinematics', label: 'CALENDARIA.Common.Threshold' },
    [SETTINGS.CINEMATIC_THRESHOLD_UNIT]: { tab: 'cinematics', label: 'CALENDARIA.Cinematic.Settings.ThresholdUnit.Name' },
    [SETTINGS.CINEMATIC_ON_REST]: { tab: 'cinematics', label: 'CALENDARIA.Cinematic.Settings.OnRest.Name' },
    [SETTINGS.CINEMATIC_PANEL_DURATION]: { tab: 'cinematics', label: 'CALENDARIA.Cinematic.Settings.PanelDuration.Name' },
    [SETTINGS.CINEMATIC_SHOW_WEATHER]: { tab: 'cinematics', label: 'CALENDARIA.Common.ShowWeather' },
    [SETTINGS.CINEMATIC_SHOW_MOONS]: { tab: 'cinematics', label: 'CALENDARIA.Common.ShowMoonPhases' },
    [SETTINGS.CINEMATIC_SHOW_EVENTS]: { tab: 'cinematics', label: 'CALENDARIA.Cinematic.Settings.ShowEvents.Name' },
    [SETTINGS.CINEMATIC_EVENT_WEIGHTING]: { tab: 'cinematics', label: 'CALENDARIA.Cinematic.Settings.EventWeighting.Name' },
    [SETTINGS.CINEMATIC_EVENT_MAX_CARDS]: { tab: 'cinematics', label: 'CALENDARIA.Cinematic.Settings.EventMaxCards.Name' },
    [SETTINGS.HUD_STICKY_ZONES_ENABLED]: { tab: 'canvas', label: 'CALENDARIA.Settings.StickyZones.Name' },
    [SETTINGS.ALLOW_SIDEBAR_OVERLAP]: { tab: 'canvas', label: 'CALENDARIA.Settings.AllowSidebarOverlap.Name' },
    [SETTINGS.DARKNESS_SYNC]: { tab: 'canvas', label: 'CALENDARIA.Settings.DarknessSync.Name' },
    [SETTINGS.DARKNESS_SYNC_ALL_SCENES]: { tab: 'canvas', label: 'CALENDARIA.Settings.DarknessSyncAllScenes.Name' },
    [SETTINGS.DARKNESS_WEATHER_SYNC]: { tab: 'canvas', label: 'CALENDARIA.Settings.DarknessWeatherSync.Name' },
    [SETTINGS.AMBIENCE_SYNC]: { tab: 'canvas', label: 'CALENDARIA.Settings.AmbienceSync.Name' },
    [SETTINGS.COLOR_SHIFT_SYNC]: { tab: 'canvas', label: 'CALENDARIA.Settings.ColorShiftSync.Name' },
    [SETTINGS.DARKNESS_MOON_SYNC]: { tab: 'canvas', label: 'CALENDARIA.Settings.DarknessMoonSync.Name' },
    [SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER]: { tab: 'canvas', label: 'CALENDARIA.Settings.DefaultBrightnessMultiplier.Name' },
    [SETTINGS.PRIMARY_GM]: { tab: 'module', label: 'CALENDARIA.Settings.PrimaryGM.Name' },
    [SETTINGS.LOGGING_LEVEL]: { tab: 'module', label: 'CALENDARIA.Settings.Logger.Name' },
    [SETTINGS.DEV_MODE]: { tab: 'module', label: 'CALENDARIA.SettingsPanel.DevMode.Name' },
    [SETTINGS.SHOW_TOOLBAR_BUTTON]: { tab: 'module', label: 'CALENDARIA.Settings.ShowToolbarButton.Name' },
    [SETTINGS.TOOLBAR_APPS]: { tab: 'module', label: 'CALENDARIA.Settings.ToolbarApps.Name' },
    [SETTINGS.SHOW_JOURNAL_FOOTER]: { tab: 'module', label: 'CALENDARIA.Settings.ShowJournalFooter.Name' },
    [SETTINGS.SHOW_CALENDAR_HUD]: { tab: 'hud', label: 'CALENDARIA.Settings.ShowCalendarHUD.Name' },
    [SETTINGS.FORCE_HUD]: { tab: 'hud', label: 'CALENDARIA.Common.ForceDisplayForAll' },
    [SETTINGS.CALENDAR_HUD_LOCKED]: { tab: 'hud', label: 'CALENDARIA.Settings.CalendarHUDLocked.Name' },
    [SETTINGS.CALENDAR_HUD_MODE]: { tab: 'hud', label: 'CALENDARIA.Settings.CalendarHUDMode.Name' },
    [SETTINGS.HUD_DIAL_STYLE]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDDialStyle.Name' },
    [SETTINGS.HUD_TRAY_DIRECTION]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDTrayDirection.Name' },
    [SETTINGS.HUD_COMBAT_MODE]: { tab: 'hud', label: 'CALENDARIA.Common.CombatBehavior' },
    [SETTINGS.HUD_WEATHER_FX_MODE]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDWeatherFxMode.Name' },
    [SETTINGS.HUD_DOME_BELOW]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDDomeBelow.Name' },
    [SETTINGS.HUD_DOME_AUTO_HIDE]: { tab: 'hud', label: 'CALENDARIA.Settings.DomeAutoHide.Name' },
    [SETTINGS.HUD_SHOW_ALL_MOONS]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDShowAllMoons.Name' },
    [SETTINGS.HUD_AUTO_FADE]: { tab: 'hud', label: 'CALENDARIA.Settings.AutoFade.Name' },
    [SETTINGS.HUD_IDLE_OPACITY]: { tab: 'hud', label: 'CALENDARIA.Settings.IdleOpacity.Name' },
    [SETTINGS.HUD_WIDTH_SCALE]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDWidthScale.Name' },
    [SETTINGS.HUD_CALENDAR_BUTTON]: { tab: 'hud', label: 'CALENDARIA.Settings.HUDCalendarButton.Name' },
    [SETTINGS.HUD_SHOW_WEATHER]: { tab: 'hud', label: 'CALENDARIA.Common.ShowWeather' },
    [SETTINGS.HUD_SHOW_SEASON]: { tab: 'hud', label: 'CALENDARIA.Common.ShowSeason' },
    [SETTINGS.HUD_SHOW_ERA]: { tab: 'hud', label: 'CALENDARIA.Common.ShowEra' },
    [SETTINGS.HUD_SHOW_CYCLES]: { tab: 'hud', label: 'CALENDARIA.Common.ShowCycles' },
    [SETTINGS.HUD_WEATHER_DISPLAY_MODE]: { tab: 'hud', label: 'CALENDARIA.Common.WeatherDisplay' },
    [SETTINGS.HUD_SEASON_DISPLAY_MODE]: { tab: 'hud', label: 'CALENDARIA.Common.SeasonDisplay' },
    [SETTINGS.HUD_ERA_DISPLAY_MODE]: { tab: 'hud', label: 'CALENDARIA.Common.EraDisplay' },
    [SETTINGS.HUD_CYCLES_DISPLAY_MODE]: { tab: 'hud', label: 'CALENDARIA.Common.CyclesDisplay' },
    [SETTINGS.HUD_STICKY_STATES]: { tab: 'hud', label: 'CALENDARIA.SettingsPanel.Section.StickyStates' },
    [SETTINGS.CUSTOM_TIME_JUMPS]: { tab: 'hud', label: 'CALENDARIA.SettingsPanel.Section.CustomTimeJumps' },
    [SETTINGS.DISPLAY_FORMATS]: { tab: 'hud', label: 'CALENDARIA.SettingsPanel.Section.DisplayFormats' },
    [SETTINGS.MINI_CAL_COMBAT_MODE]: { tab: 'miniCal', label: 'CALENDARIA.Common.CombatBehavior' },
    [SETTINGS.MINI_CAL_COMPACT_MODE]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalCompactMode.Name' },
    [SETTINGS.SHOW_MINI_CAL]: { tab: 'miniCal', label: 'CALENDARIA.Settings.ShowMiniCal.Name' },
    [SETTINGS.FORCE_MINI_CAL]: { tab: 'miniCal', label: 'CALENDARIA.Common.ForceDisplayForAll' },
    [SETTINGS.MINI_CAL_AUTO_FADE]: { tab: 'miniCal', label: 'CALENDARIA.Settings.AutoFade.Name' },
    [SETTINGS.MINI_CAL_IDLE_OPACITY]: { tab: 'miniCal', label: 'CALENDARIA.Settings.IdleOpacity.Name' },
    [SETTINGS.MINI_CAL_CONTROLS_DELAY]: { tab: 'miniCal', label: 'CALENDARIA.Settings.MiniCalControlsDelay.Name' },
    [SETTINGS.MINI_CAL_CONFIRM_SET_DATE]: { tab: 'miniCal', label: 'CALENDARIA.Settings.ConfirmSetDate.Name' },
    [SETTINGS.MINI_CAL_AUTO_OPEN_NOTES]: { tab: 'miniCal', label: 'CALENDARIA.Settings.AutoOpenNotes.Name' },
    [SETTINGS.MINI_CAL_SHOW_WEATHER]: { tab: 'miniCal', label: 'CALENDARIA.Common.ShowWeather' },
    [SETTINGS.MINI_CAL_SHOW_SEASON]: { tab: 'miniCal', label: 'CALENDARIA.Common.ShowSeason' },
    [SETTINGS.MINI_CAL_SHOW_ERA]: { tab: 'miniCal', label: 'CALENDARIA.Common.ShowEra' },
    [SETTINGS.MINI_CAL_SHOW_CYCLES]: { tab: 'miniCal', label: 'CALENDARIA.Common.ShowCycles' },
    [SETTINGS.MINI_CAL_SHOW_MOON_PHASES]: { tab: 'miniCal', label: 'CALENDARIA.Common.ShowMoonPhases' },
    [SETTINGS.MINI_CAL_WEATHER_DISPLAY_MODE]: { tab: 'miniCal', label: 'CALENDARIA.Common.WeatherDisplay' },
    [SETTINGS.MINI_CAL_SEASON_DISPLAY_MODE]: { tab: 'miniCal', label: 'CALENDARIA.Common.SeasonDisplay' },
    [SETTINGS.MINI_CAL_ERA_DISPLAY_MODE]: { tab: 'miniCal', label: 'CALENDARIA.Common.EraDisplay' },
    [SETTINGS.MINI_CAL_CYCLES_DISPLAY_MODE]: { tab: 'miniCal', label: 'CALENDARIA.Common.CyclesDisplay' },
    [SETTINGS.MINI_CAL_STICKY_STATES]: { tab: 'miniCal', label: 'CALENDARIA.SettingsPanel.Section.StickyStates' },
    [SETTINGS.MINI_CAL_TIME_JUMPS]: { tab: 'miniCal', label: 'CALENDARIA.SettingsPanel.Section.CustomTimeJumps' },
    [SETTINGS.SHOW_BIG_CAL]: { tab: 'bigcal', label: 'CALENDARIA.Settings.ShowBigCal.Name' },
    [SETTINGS.FORCE_BIG_CAL]: { tab: 'bigcal', label: 'CALENDARIA.Common.ForceDisplayForAll' },
    [SETTINGS.BIG_CAL_COMBAT_MODE]: { tab: 'bigcal', label: 'CALENDARIA.Common.CombatBehavior' },
    [SETTINGS.BIG_CAL_AUTO_FADE]: { tab: 'bigcal', label: 'CALENDARIA.Settings.AutoFade.Name' },
    [SETTINGS.BIG_CAL_IDLE_OPACITY]: { tab: 'bigcal', label: 'CALENDARIA.Settings.IdleOpacity.Name' },
    [SETTINGS.BIG_CAL_SHOW_WEATHER]: { tab: 'bigcal', label: 'CALENDARIA.Common.ShowWeather' },
    [SETTINGS.BIG_CAL_SHOW_SEASON]: { tab: 'bigcal', label: 'CALENDARIA.Common.ShowSeason' },
    [SETTINGS.BIG_CAL_SHOW_ERA]: { tab: 'bigcal', label: 'CALENDARIA.Common.ShowEra' },
    [SETTINGS.BIG_CAL_SHOW_CYCLES]: { tab: 'bigcal', label: 'CALENDARIA.Common.ShowCycles' },
    [SETTINGS.BIG_CAL_SHOW_MOON_PHASES]: { tab: 'bigcal', label: 'CALENDARIA.Common.ShowMoonPhases' },
    [SETTINGS.BIG_CAL_WEATHER_DISPLAY_MODE]: { tab: 'bigcal', label: 'CALENDARIA.Common.WeatherDisplay' },
    [SETTINGS.BIG_CAL_SEASON_DISPLAY_MODE]: { tab: 'bigcal', label: 'CALENDARIA.Common.SeasonDisplay' },
    [SETTINGS.BIG_CAL_ERA_DISPLAY_MODE]: { tab: 'bigcal', label: 'CALENDARIA.Common.EraDisplay' },
    [SETTINGS.BIG_CAL_CYCLES_DISPLAY_MODE]: { tab: 'bigcal', label: 'CALENDARIA.Common.CyclesDisplay' },
    [SETTINGS.SHOW_TIME_KEEPER]: { tab: 'timekeeper', label: 'CALENDARIA.Settings.ShowTimeKeeper.Name' },
    [SETTINGS.FORCE_TIME_KEEPER]: { tab: 'timekeeper', label: 'CALENDARIA.Common.ForceDisplayForAll' },
    [SETTINGS.TIMEKEEPER_AUTO_FADE]: { tab: 'timekeeper', label: 'CALENDARIA.Settings.AutoFade.Name' },
    [SETTINGS.TIMEKEEPER_IDLE_OPACITY]: { tab: 'timekeeper', label: 'CALENDARIA.Settings.IdleOpacity.Name' },
    [SETTINGS.TIMEKEEPER_COMBAT_MODE]: { tab: 'timekeeper', label: 'CALENDARIA.Common.CombatBehavior' },
    [SETTINGS.TIMEKEEPER_STICKY_STATES]: { tab: 'timekeeper', label: 'CALENDARIA.SettingsPanel.Section.StickyStates' },
    [SETTINGS.TIMEKEEPER_TIME_JUMPS]: { tab: 'timekeeper', label: 'CALENDARIA.SettingsPanel.Section.CustomTimeJumps' },
    [SETTINGS.SHOW_SUN_DIAL]: { tab: 'sunDial', label: 'CALENDARIA.Settings.ShowSunDial.Name' },
    [SETTINGS.FORCE_SUN_DIAL]: { tab: 'sunDial', label: 'CALENDARIA.Common.ForceDisplayForAll' },
    [SETTINGS.SUN_DIAL_AUTO_FADE]: { tab: 'sunDial', label: 'CALENDARIA.Settings.AutoFade.Name' },
    [SETTINGS.SUN_DIAL_IDLE_OPACITY]: { tab: 'sunDial', label: 'CALENDARIA.Settings.IdleOpacity.Name' },
    [SETTINGS.SUN_DIAL_COMBAT_MODE]: { tab: 'sunDial', label: 'CALENDARIA.Common.CombatBehavior' },
    [SETTINGS.SUN_DIAL_CRANK_MODE]: { tab: 'sunDial', label: 'CALENDARIA.SettingsPanel.CrankMode' },
    [SETTINGS.SUN_DIAL_STICKY_STATES]: { tab: 'sunDial', label: 'CALENDARIA.SettingsPanel.Section.StickyStates' },
    [SETTINGS.SHOW_STOPWATCH]: { tab: 'stopwatch', label: 'CALENDARIA.Settings.ShowStopwatch.Name' },
    [SETTINGS.FORCE_STOPWATCH]: { tab: 'stopwatch', label: 'CALENDARIA.Common.ForceDisplayForAll' },
    [SETTINGS.STOPWATCH_AUTO_START_TIME]: { tab: 'stopwatch', label: 'CALENDARIA.Settings.StopwatchAutoStartTime.Name' },
    [SETTINGS.STOPWATCH_COMBAT_MODE]: { tab: 'stopwatch', label: 'CALENDARIA.Common.CombatBehavior' },
    [SETTINGS.STOPWATCH_STICKY_STATES]: { tab: 'stopwatch', label: 'CALENDARIA.SettingsPanel.Section.StickyStates' },
    [SETTINGS.STOPWATCH_AUTO_FADE]: { tab: 'stopwatch', label: 'CALENDARIA.Settings.AutoFade.Name' },
    [SETTINGS.STOPWATCH_IDLE_OPACITY]: { tab: 'stopwatch', label: 'CALENDARIA.Settings.IdleOpacity.Name' },
    [SETTINGS.CUSTOM_PRESETS]: { tab: 'notes', label: 'CALENDARIA.SettingsPanel.Section.Presets' },
    [SETTINGS.MACRO_TRIGGERS]: { tab: 'macros', label: 'CALENDARIA.SettingsPanel.Tab.Macros' },
    [SETTINGS.CUSTOM_WEATHER_PRESETS]: { tab: 'weather', label: 'CALENDARIA.SettingsPanel.Section.WeatherPresets' },
    [SETTINGS.FXMASTER_ENABLED]: { tab: 'weather', label: 'CALENDARIA.Settings.FXMaster.Enabled.Name' },
    [SETTINGS.FXMASTER_TOP_DOWN]: { tab: 'weather', label: 'CALENDARIA.Settings.FXMaster.TopDown.Name' },
    [SETTINGS.FXMASTER_FORCE_DOWNWARD]: { tab: 'weather', label: 'CALENDARIA.Settings.FXMaster.ForceDownward.Name' },
    [SETTINGS.FXMASTER_BELOW_TOKENS]: { tab: 'weather', label: 'CALENDARIA.Settings.FXMaster.BelowTokens.Name' },
    [SETTINGS.FXMASTER_SOUND_FX]: { tab: 'weather', label: 'CALENDARIA.Settings.FXMaster.soundFX.Name' },
    [SETTINGS.WEATHER_INERTIA]: { tab: 'weather', label: 'CALENDARIA.Settings.WeatherInertia.Name' },
    [SETTINGS.WEATHER_HISTORY_DAYS]: { tab: 'weather', label: 'CALENDARIA.Settings.WeatherHistoryDays.Name' },
    [SETTINGS.WEATHER_SOUND_FX]: { tab: 'weather', label: 'CALENDARIA.Settings.Weather.SoundFx.Name' },
    [SETTINGS.WEATHER_SOUND_VOLUME]: { tab: 'weather', label: 'CALENDARIA.Settings.Weather.SoundVolume.Name' }
  };

  /**
   * Mapping of section IDs to their associated settings.
   */
  static SECTION_SETTINGS = {
    'hud-display': [
      SETTINGS.SHOW_CALENDAR_HUD,
      SETTINGS.FORCE_HUD,
      SETTINGS.CALENDAR_HUD_MODE,
      SETTINGS.HUD_CALENDAR_BUTTON,
      SETTINGS.HUD_DIAL_STYLE,
      SETTINGS.HUD_TRAY_DIRECTION,
      SETTINGS.HUD_COMBAT_MODE,
      SETTINGS.HUD_WEATHER_FX_MODE,
      SETTINGS.HUD_BORDER_GLOW,
      SETTINGS.HUD_DOME_BELOW,
      SETTINGS.HUD_DOME_AUTO_HIDE,
      SETTINGS.HUD_SHOW_ALL_MOONS,
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
    'minical-display': [
      SETTINGS.SHOW_MINI_CAL,
      SETTINGS.FORCE_MINI_CAL,
      SETTINGS.MINI_CAL_AUTO_FADE,
      SETTINGS.MINI_CAL_IDLE_OPACITY,
      SETTINGS.MINI_CAL_CONTROLS_DELAY,
      SETTINGS.MINI_CAL_CONFIRM_SET_DATE,
      SETTINGS.MINI_CAL_AUTO_OPEN_NOTES,
      SETTINGS.MINI_CAL_COMPACT_MODE,
      SETTINGS.MINI_CAL_COMBAT_MODE
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
    'bigcal-display': [SETTINGS.SHOW_BIG_CAL, SETTINGS.FORCE_BIG_CAL, SETTINGS.BIG_CAL_AUTO_FADE, SETTINGS.BIG_CAL_IDLE_OPACITY, SETTINGS.BIG_CAL_COMBAT_MODE],
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
    'timekeeper-display': [SETTINGS.SHOW_TIME_KEEPER, SETTINGS.FORCE_TIME_KEEPER, SETTINGS.TIMEKEEPER_AUTO_FADE, SETTINGS.TIMEKEEPER_IDLE_OPACITY, SETTINGS.TIMEKEEPER_COMBAT_MODE],
    'timekeeper-sticky': [SETTINGS.TIMEKEEPER_STICKY_STATES],
    'timekeeper-time-jumps': [SETTINGS.TIMEKEEPER_TIME_JUMPS],
    'stopwatch-display': [
      SETTINGS.SHOW_STOPWATCH,
      SETTINGS.FORCE_STOPWATCH,
      SETTINGS.STOPWATCH_AUTO_START_TIME,
      SETTINGS.STOPWATCH_AUTO_FADE,
      SETTINGS.STOPWATCH_IDLE_OPACITY,
      SETTINGS.STOPWATCH_COMBAT_MODE
    ],
    'stopwatch-sticky': [SETTINGS.STOPWATCH_STICKY_STATES],
    'sunDial-display': [SETTINGS.SHOW_SUN_DIAL, SETTINGS.FORCE_SUN_DIAL, SETTINGS.SUN_DIAL_CRANK_MODE, SETTINGS.SUN_DIAL_AUTO_FADE, SETTINGS.SUN_DIAL_IDLE_OPACITY, SETTINGS.SUN_DIAL_COMBAT_MODE],
    'sunDial-sticky': [SETTINGS.SUN_DIAL_STICKY_STATES],
    'time-realtime': [SETTINGS.TIME_SPEED_MULTIPLIER, SETTINGS.TIME_SPEED_INCREMENT, SETTINGS.TIME_ADVANCE_INTERVAL],
    'time-integration': [SETTINGS.ADVANCE_TIME_ON_REST, SETTINGS.REST_TO_SUNRISE, SETTINGS.SYNC_CLOCK_PAUSE, SETTINGS.CLOCK_RUN_DURING_COMBAT],
    'chat-timestamps': [SETTINGS.CHAT_TIMESTAMP_MODE, SETTINGS.CHAT_TIMESTAMP_SHOW_TIME],
    'canvas-sticky-zones': [SETTINGS.HUD_STICKY_ZONES_ENABLED, SETTINGS.ALLOW_SIDEBAR_OVERLAP],
    'canvas-scene-integration': [
      SETTINGS.DARKNESS_SYNC,
      SETTINGS.DARKNESS_WEATHER_SYNC,
      SETTINGS.AMBIENCE_SYNC,
      SETTINGS.COLOR_SHIFT_SYNC,
      SETTINGS.DARKNESS_MOON_SYNC,
      SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER
    ],
    'weather-units': [SETTINGS.TEMPERATURE_UNIT, SETTINGS.TEMPERATURE_SHOW_BOTH, SETTINGS.PRECIPITATION_UNIT],
    'weather-generation': [SETTINGS.AUTO_GENERATE_WEATHER, SETTINGS.WEATHER_INERTIA, SETTINGS.WEATHER_HISTORY_DAYS, SETTINGS.WEATHER_SOUND_FX, SETTINGS.WEATHER_SOUND_VOLUME],
    fxmaster: [SETTINGS.FXMASTER_ENABLED, SETTINGS.FXMASTER_TOP_DOWN, SETTINGS.FXMASTER_FORCE_DOWNWARD, SETTINGS.FXMASTER_BELOW_TOKENS, SETTINGS.FXMASTER_SOUND_FX],
    'module-sync': [SETTINGS.PRIMARY_GM],
    'module-integration': [SETTINGS.SHOW_TOOLBAR_BUTTON, SETTINGS.TOOLBAR_APPS, SETTINGS.SHOW_JOURNAL_FOOTER],
    'module-debugging': [SETTINGS.DEV_MODE, SETTINGS.LOGGING_LEVEL],
    permissions: [SETTINGS.PERMISSIONS],
    'chronicle-visibility': [
      SETTINGS.SHOW_CHRONICLE,
      SETTINGS.FORCE_CHRONICLE,
      SETTINGS.CHRONICLE_COMBAT_MODE,
      SETTINGS.CHRONICLE_BIG_CAL_BUTTON,
      SETTINGS.CHRONICLE_MINI_CAL_BUTTON,
      SETTINGS.CHRONICLE_HUD_BUTTON
    ],
    'chronicle-display': [SETTINGS.CHRONICLE_ENTRY_DEPTH, SETTINGS.CHRONICLE_SHOW_EMPTY, SETTINGS.CHRONICLE_EMPTY_CONTENT_TYPES],
    'chronicle-content': [SETTINGS.CHRONICLE_SHOW_WEATHER, SETTINGS.CHRONICLE_SHOW_MOON_PHASES, SETTINGS.CHRONICLE_SHOW_SEASON_CHANGES],
    'fog-of-war': [SETTINGS.FOG_OF_WAR_ENABLED, SETTINGS.FOG_OF_WAR_CONFIG, SETTINGS.FOG_OF_WAR_START_DATE, SETTINGS.FOG_OF_WAR_REVEAL_INTERMEDIATE, SETTINGS.FOG_OF_WAR_NAV_MODE],
    'cinematic-behavior': [SETTINGS.CINEMATIC_ENABLED, SETTINGS.CINEMATIC_THRESHOLD, SETTINGS.CINEMATIC_THRESHOLD_UNIT, SETTINGS.CINEMATIC_ON_REST],
    'cinematic-animation': [SETTINGS.CINEMATIC_PANEL_DURATION],
    'cinematic-content': [SETTINGS.CINEMATIC_SHOW_WEATHER, SETTINGS.CINEMATIC_SHOW_MOONS, SETTINGS.CINEMATIC_SHOW_EVENTS, SETTINGS.CINEMATIC_EVENT_WEIGHTING, SETTINGS.CINEMATIC_EVENT_MAX_CARDS],
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
    context.showSecretNotes = game.settings.get(MODULE.ID, SETTINGS.SHOW_SECRET_NOTES);
    const currentDefault = game.settings.get(MODULE.ID, SETTINGS.DEFAULT_NOTE_PRESET);
    const presets = getAllPresets();
    context.defaultNotePresetOptions = [
      { value: '', label: localize('CALENDARIA.Settings.DefaultNotePreset.AskEveryTime'), selected: !currentDefault },
      ...presets.map((p) => ({ value: p.id, label: p.label, selected: currentDefault === p.id }))
    ];
    const noteOpenMode = game.settings.get(MODULE.ID, SETTINGS.NOTE_OPEN_MODE);
    context.noteOpenModeOptions = [
      { value: 'default', label: localize('CALENDARIA.Settings.NoteOpenMode.Default'), selected: noteOpenMode === 'default' },
      { value: 'edit', label: localize('CALENDARIA.Settings.NoteOpenMode.Edit'), selected: noteOpenMode === 'edit' },
      { value: 'view', label: localize('CALENDARIA.Settings.NoteOpenMode.View'), selected: noteOpenMode === 'view' }
    ];
  }

  /**
   * Prepare context for the Time tab.
   * @param {object} context - The context object
   */
  async #prepareTimeContext(context) {
    context.advanceTimeOnRest = game.settings.get(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST);
    context.restToSunrise = game.settings.get(MODULE.ID, SETTINGS.REST_TO_SUNRISE);
    context.syncClockPause = game.settings.get(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE);
    context.clockRunDuringCombat = game.settings.get(MODULE.ID, SETTINGS.CLOCK_RUN_DURING_COMBAT);
    context.roundTimeDisabled = CONFIG.time.roundTime === 0;
    context.timeSpeedMultiplier = game.settings.get(MODULE.ID, SETTINGS.TIME_SPEED_MULTIPLIER);
    context.timeAdvanceInterval = game.settings.get(MODULE.ID, SETTINGS.TIME_ADVANCE_INTERVAL);
    const currentIncrement = game.settings.get(MODULE.ID, SETTINGS.TIME_SPEED_INCREMENT);
    const { labels: incrementLabels, keys: incrementKeys } = SettingsPanel.#getIncrementLabels();
    context.timeSpeedIncrements = incrementKeys.map((key) => ({ key, label: incrementLabels[key] || key, selected: key === currentIncrement }));
  }

  /**
   * Prepare context for the Chat tab.
   * @param {object} context - The context object
   */
  async #prepareChatContext(context) {
    const chatMode = game.settings.get(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE);
    context.chatTimestampModeOptions = [
      { value: 'disabled', label: localize('CALENDARIA.Common.Disabled'), selected: chatMode === 'disabled' },
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
    context.miniCalAutoOpenNotes = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_AUTO_OPEN_NOTES);
    context.miniCalCompactMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_COMPACT_MODE);
    context.miniCalCombatMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_COMBAT_MODE);
    context.forceMiniCal = game.settings.get(MODULE.ID, SETTINGS.FORCE_MINI_CAL);
    context.formatLocations = this.#prepareFormatLocationsForCategory('miniCal');
    context.openHint = format('CALENDARIA.SettingsPanel.AppTab.OpenHint', { appName: 'MiniCal' });
    context.miniCalShowTime = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_TIME);
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
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: miniCalWeatherDisplayMode === 'icon' },
      { value: 'temp', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.TempOnly'), selected: miniCalWeatherDisplayMode === 'temp' }
    ];
    const miniCalSeasonDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SEASON_DISPLAY_MODE);
    context.miniCalSeasonDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Common.DisplayIconText'), selected: miniCalSeasonDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: miniCalSeasonDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Common.DisplayTextOnly'), selected: miniCalSeasonDisplayMode === 'text' }
    ];
    const miniCalEraDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_ERA_DISPLAY_MODE);
    context.miniCalEraDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Common.DisplayIconText'), selected: miniCalEraDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: miniCalEraDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Common.DisplayTextOnly'), selected: miniCalEraDisplayMode === 'text' },
      { value: 'abbr', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.Abbreviation'), selected: miniCalEraDisplayMode === 'abbr' }
    ];
    const miniCalCyclesDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_CYCLES_DISPLAY_MODE);
    context.miniCalCyclesDisplayModeOptions = [
      { value: 'name', label: localize('CALENDARIA.Common.Name'), selected: miniCalCyclesDisplayMode === 'name' },
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: miniCalCyclesDisplayMode === 'icon' },
      { value: 'number', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.Number'), selected: miniCalCyclesDisplayMode === 'number' },
      { value: 'roman', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.Roman'), selected: miniCalCyclesDisplayMode === 'roman' }
    ];
    const miniCalJumps = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_TIME_JUMPS) || {};
    const { labels: incrementLabels, keys: incrementKeys } = SettingsPanel.#getIncrementLabels();
    context.miniCalTimeJumps = incrementKeys.map((key) => ({ key, label: incrementLabels[key] || key, jumps: miniCalJumps[key] || { dec2: null, dec1: null, inc1: null, inc2: null } }));
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
    const hudCalendarButton = game.settings.get(MODULE.ID, SETTINGS.HUD_CALENDAR_BUTTON);
    context.hudCalendarButtonOptions = [
      { value: 'bigcal', label: localize('CALENDARIA.Common.BigCal'), selected: hudCalendarButton === 'bigcal' },
      { value: 'minical', label: localize('CALENDARIA.Common.MiniCal'), selected: hudCalendarButton === 'minical' }
    ];
    const dialStyle = game.settings.get(MODULE.ID, SETTINGS.HUD_DIAL_STYLE);
    context.dialStyleOptions = [
      { value: 'dome', label: localize('CALENDARIA.Settings.HUDDialStyle.Dome'), selected: dialStyle === 'dome' },
      { value: 'slice', label: localize('CALENDARIA.Settings.HUDDialStyle.Slice'), selected: dialStyle === 'slice' }
    ];
    const trayDirection = game.settings.get(MODULE.ID, SETTINGS.HUD_TRAY_DIRECTION);
    context.trayDirectionOptions = [
      { value: 'down', label: localize('CALENDARIA.Settings.HUDTrayDirection.Down'), selected: trayDirection === 'down' },
      { value: 'up', label: localize('CALENDARIA.Settings.HUDTrayDirection.Up'), selected: trayDirection === 'up' }
    ];
    context.hudCombatMode = game.settings.get(MODULE.ID, SETTINGS.HUD_COMBAT_MODE);
    const weatherFxMode = game.settings.get(MODULE.ID, SETTINGS.HUD_WEATHER_FX_MODE);
    context.hudWeatherFxMode = weatherFxMode;
    context.weatherFxModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Common.Full'), selected: weatherFxMode === 'full' },
      { value: 'reduced', label: localize('CALENDARIA.Settings.HUDWeatherFxMode.Reduced'), selected: weatherFxMode === 'reduced' },
      { value: 'off', label: localize('CALENDARIA.Common.Off'), selected: weatherFxMode === 'off' }
    ];
    context.hudBorderGlow = game.settings.get(MODULE.ID, SETTINGS.HUD_BORDER_GLOW);
    context.hudDomeBelow = game.settings.get(MODULE.ID, SETTINGS.HUD_DOME_BELOW);
    context.hudDomeAutoHide = game.settings.get(MODULE.ID, SETTINGS.HUD_DOME_AUTO_HIDE);
    context.hudShowAllMoons = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_ALL_MOONS);
    context.hudAutoFade = game.settings.get(MODULE.ID, SETTINGS.HUD_AUTO_FADE);
    context.hudIdleOpacity = game.settings.get(MODULE.ID, SETTINGS.HUD_IDLE_OPACITY);
    context.hudWidthScale = game.settings.get(MODULE.ID, SETTINGS.HUD_WIDTH_SCALE);
    context.hudWidthScalePixels = Math.round(context.hudWidthScale * 800);
    context.hudShowWeather = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_WEATHER);
    context.hudShowSeason = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_SEASON);
    context.hudShowEra = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_ERA);
    const weatherDisplayMode = game.settings.get(MODULE.ID, SETTINGS.HUD_WEATHER_DISPLAY_MODE);
    context.weatherDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.Full'), selected: weatherDisplayMode === 'full' },
      { value: 'iconTemp', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.IconTemp'), selected: weatherDisplayMode === 'iconTemp' },
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: weatherDisplayMode === 'icon' },
      { value: 'temp', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.TempOnly'), selected: weatherDisplayMode === 'temp' }
    ];
    const seasonDisplayMode = game.settings.get(MODULE.ID, SETTINGS.HUD_SEASON_DISPLAY_MODE);
    context.seasonDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Common.DisplayIconText'), selected: seasonDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: seasonDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Common.DisplayTextOnly'), selected: seasonDisplayMode === 'text' }
    ];
    const eraDisplayMode = game.settings.get(MODULE.ID, SETTINGS.HUD_ERA_DISPLAY_MODE);
    context.eraDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Common.DisplayIconText'), selected: eraDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: eraDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Common.DisplayTextOnly'), selected: eraDisplayMode === 'text' },
      { value: 'abbr', label: localize('CALENDARIA.Settings.HUDEraDisplayMode.Abbreviation'), selected: eraDisplayMode === 'abbr' }
    ];
    context.hudShowCycles = game.settings.get(MODULE.ID, SETTINGS.HUD_SHOW_CYCLES);
    const cyclesDisplayMode = game.settings.get(MODULE.ID, SETTINGS.HUD_CYCLES_DISPLAY_MODE);
    context.cyclesDisplayModeOptions = [
      { value: 'name', label: localize('CALENDARIA.Common.Name'), selected: cyclesDisplayMode === 'name' },
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: cyclesDisplayMode === 'icon' },
      { value: 'number', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.Number'), selected: cyclesDisplayMode === 'number' },
      { value: 'roman', label: localize('CALENDARIA.Settings.HUDCyclesDisplayMode.Roman'), selected: cyclesDisplayMode === 'roman' }
    ];
    const customJumps = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_TIME_JUMPS) || {};
    const { labels: incrementLabels, keys: incrementKeys } = SettingsPanel.#getIncrementLabels();
    context.customTimeJumps = incrementKeys.map((key) => ({ key, label: incrementLabels[key] || key, jumps: customJumps[key] || { dec2: null, dec1: null, inc1: null, inc2: null } }));
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
    context.showBigCal = game.settings.get(MODULE.ID, SETTINGS.SHOW_BIG_CAL);
    context.forceBigCal = game.settings.get(MODULE.ID, SETTINGS.FORCE_BIG_CAL);
    context.bigCalAutoFade = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_AUTO_FADE);
    context.bigCalIdleOpacity = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_IDLE_OPACITY);
    context.bigCalCombatMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_COMBAT_MODE);
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
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: bigCalWeatherDisplayMode === 'icon' },
      { value: 'temp', label: localize('CALENDARIA.Settings.HUDWeatherDisplayMode.TempOnly'), selected: bigCalWeatherDisplayMode === 'temp' }
    ];
    const bigCalSeasonDisplayMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_SEASON_DISPLAY_MODE);
    context.bigCalSeasonDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Common.DisplayIconText'), selected: bigCalSeasonDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: bigCalSeasonDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Common.DisplayTextOnly'), selected: bigCalSeasonDisplayMode === 'text' }
    ];
    const bigCalEraDisplayMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_ERA_DISPLAY_MODE);
    context.bigCalEraDisplayModeOptions = [
      { value: 'full', label: localize('CALENDARIA.Common.DisplayIconText'), selected: bigCalEraDisplayMode === 'full' },
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: bigCalEraDisplayMode === 'icon' },
      { value: 'text', label: localize('CALENDARIA.Common.DisplayTextOnly'), selected: bigCalEraDisplayMode === 'text' },
      { value: 'abbr', label: localize('CALENDARIA.Settings.BigCalEraDisplayMode.Abbreviation'), selected: bigCalEraDisplayMode === 'abbr' }
    ];
    const bigCalCyclesDisplayMode = game.settings.get(MODULE.ID, SETTINGS.BIG_CAL_CYCLES_DISPLAY_MODE);
    context.bigCalCyclesDisplayModeOptions = [
      { value: 'name', label: localize('CALENDARIA.Common.Name'), selected: bigCalCyclesDisplayMode === 'name' },
      { value: 'icon', label: localize('CALENDARIA.Common.DisplayIconOnly'), selected: bigCalCyclesDisplayMode === 'icon' },
      { value: 'number', label: localize('CALENDARIA.Settings.BigCalCyclesDisplayMode.Number'), selected: bigCalCyclesDisplayMode === 'number' },
      { value: 'roman', label: localize('CALENDARIA.Settings.BigCalCyclesDisplayMode.Roman'), selected: bigCalCyclesDisplayMode === 'roman' }
    ];
  }

  /**
   * Prepare format locations for a specific category.
   * @param {string} category - The category to filter by (hud, timekeeper, miniCal, bigcal, chat, stopwatch)
   * @returns {Array<object>} Prepared format locations for the category
   */
  #prepareFormatLocationsForCategory(category) {
    const displayFormats = game.settings.get(MODULE.ID, SETTINGS.DISPLAY_FORMATS);
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
      { value: 'custom', label: localize('CALENDARIA.Common.Custom') },
      { value: 'approxDate', label: localize('CALENDARIA.Format.Preset.ApproxDate') },
      { value: 'approxDateTime', label: localize('CALENDARIA.Format.Preset.ApproxDateTime') },
      { value: 'approxTime', label: localize('CALENDARIA.Format.Preset.ApproxTime') },
      { value: 'dateShort', label: localize('CALENDARIA.Format.Preset.DateShort') },
      { value: 'dateMedium', label: localize('CALENDARIA.Format.Preset.DateMedium') },
      { value: 'dateLong', label: localize('CALENDARIA.Format.Preset.DateLong') },
      { value: 'dateFull', label: localize('CALENDARIA.Format.Preset.DateFull') },
      { value: 'dateUS', label: localize('CALENDARIA.Format.Preset.DateUS') },
      { value: 'dateUSFull', label: localize('CALENDARIA.Format.Preset.DateUSFull') },
      { value: 'dateISO', label: localize('CALENDARIA.Format.Preset.DateISO') },
      { value: 'dateNumericUS', label: localize('CALENDARIA.Format.Preset.DateNumericUS') },
      { value: 'dateNumericEU', label: localize('CALENDARIA.Format.Preset.DateNumericEU') },
      { value: 'ordinal', label: localize('CALENDARIA.Format.Preset.Ordinal') },
      { value: 'ordinalLong', label: localize('CALENDARIA.Format.Preset.OrdinalLong') },
      { value: 'ordinalEra', label: localize('CALENDARIA.Format.Preset.OrdinalEra') },
      { value: 'ordinalFull', label: localize('CALENDARIA.Format.Preset.OrdinalFull') },
      { value: 'seasonDate', label: localize('CALENDARIA.Format.Preset.SeasonDate') },
      { value: 'weekHeader', label: localize('CALENDARIA.Format.Preset.WeekHeader') },
      { value: 'yearOnly', label: localize('CALENDARIA.Format.Preset.YearOnly') },
      { value: 'yearEra', label: localize('CALENDARIA.Format.Preset.YearEra') },
      { value: 'time12', label: localize('CALENDARIA.Format.Preset.Time12') },
      { value: 'time12Sec', label: localize('CALENDARIA.Format.Preset.Time12Sec') },
      { value: 'time24', label: localize('CALENDARIA.Format.Preset.Time24') },
      { value: 'time24Sec', label: localize('CALENDARIA.Format.Preset.Time24Sec') },
      { value: 'datetimeShort12', label: localize('CALENDARIA.Format.Preset.DatetimeShort12') },
      { value: 'datetimeShort24', label: localize('CALENDARIA.Format.Preset.DatetimeShort24') },
      { value: 'datetime12', label: localize('CALENDARIA.Format.Preset.Datetime12') },
      { value: 'datetime24', label: localize('CALENDARIA.Format.Preset.Datetime24') }
    ];
    const supportsOff = ['hudDate', 'timekeeperDate'];
    const stopwatchRealtimePresets = [
      { value: 'stopwatchRealtimeFull', label: localize('CALENDARIA.Common.Full') },
      { value: 'stopwatchRealtimeNoMs', label: localize('CALENDARIA.Format.Preset.StopwatchNoMs') },
      { value: 'stopwatchRealtimeMinSec', label: localize('CALENDARIA.Format.Preset.StopwatchMinSec') },
      { value: 'stopwatchRealtimeSecOnly', label: localize('CALENDARIA.Format.Preset.StopwatchSecOnly') },
      { value: 'custom', label: localize('CALENDARIA.Common.Custom') }
    ];
    const stopwatchGametimePresets = [
      { value: 'stopwatchGametimeFull', label: localize('CALENDARIA.Common.Full') },
      { value: 'stopwatchGametimeMinSec', label: localize('CALENDARIA.Format.Preset.StopwatchMinSec') },
      { value: 'stopwatchGametimeSecOnly', label: localize('CALENDARIA.Format.Preset.StopwatchSecOnly') },
      { value: 'custom', label: localize('CALENDARIA.Common.Custom') }
    ];
    const stopwatchRealtimeKnown = ['stopwatchRealtimeFull', 'stopwatchRealtimeNoMs', 'stopwatchRealtimeMinSec', 'stopwatchRealtimeSecOnly'];
    const stopwatchGametimeKnown = ['stopwatchGametimeFull', 'stopwatchGametimeMinSec', 'stopwatchGametimeSecOnly'];
    const allLocations = [
      { id: 'hudDate', label: localize('CALENDARIA.Common.DateDisplay'), category: 'hud', contextType: 'date' },
      { id: 'hudTime', label: localize('CALENDARIA.Common.TimeDisplay'), category: 'hud', contextType: 'time' },
      { id: 'timekeeperDate', label: localize('CALENDARIA.Common.DateDisplay'), category: 'timekeeper', contextType: 'date' },
      { id: 'timekeeperTime', label: localize('CALENDARIA.Common.TimeDisplay'), category: 'timekeeper', contextType: 'time' },
      { id: 'microCalHeader', label: localize('CALENDARIA.Format.Location.MicroCalHeader'), category: 'miniCal', contextType: 'date' },
      { id: 'miniCalHeader', label: localize('CALENDARIA.Format.Location.MiniCalHeader'), category: 'miniCal', contextType: 'date' },
      { id: 'miniCalTime', label: localize('CALENDARIA.Common.TimeDisplay'), category: 'miniCal', contextType: 'time' },
      { id: 'bigCalHeader', label: localize('CALENDARIA.Format.Location.BigCalHeader'), category: 'bigcal', contextType: 'date' },
      { id: 'bigCalWeekHeader', label: localize('CALENDARIA.Common.WeekViewHeader'), category: 'bigcal', contextType: 'date' },
      { id: 'bigCalYearHeader', label: localize('CALENDARIA.Common.YearViewHeader'), category: 'bigcal', contextType: 'date' },
      { id: 'bigCalYearLabel', label: localize('CALENDARIA.Format.Location.BigCalYearLabel'), category: 'bigcal', contextType: 'date' },
      { id: 'chatTimestamp', label: localize('CALENDARIA.Format.Location.ChatTimestamp'), category: 'chat', contextType: 'date' },
      { id: 'sundialTime', label: localize('CALENDARIA.Common.TimeDisplay'), category: 'sunDial', contextType: 'time' },
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
      } else if (loc.id === 'sundialTime') {
        knownPresets = ['calendarDefault', 'time12', 'time12Sec', 'time24', 'time24Sec', 'custom'];
        locationPresets = [
          { value: 'calendarDefault', label: calendarDefaultLabel },
          { value: 'time12', label: localize('CALENDARIA.Format.Preset.Time12') },
          { value: 'time12Sec', label: localize('CALENDARIA.Format.Preset.Time12Sec') },
          { value: 'time24', label: localize('CALENDARIA.Format.Preset.Time24') },
          { value: 'time24Sec', label: localize('CALENDARIA.Format.Preset.Time24Sec') },
          { value: 'custom', label: localize('CALENDARIA.Common.Custom') }
        ];
        defaultFormat = 'time24';
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
        if (supportsOff.includes(loc.id)) locationPresets = [{ value: 'off', label: localize('CALENDARIA.Common.Hidden') }, ...locationPresets];
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
   * Prepare context for the Chronicle tab.
   * @param {object} context - The template context object
   */
  #prepareChronicleContext(context) {
    context.showChronicle = game.settings.get(MODULE.ID, SETTINGS.SHOW_CHRONICLE);
    context.forceChronicle = game.settings.get(MODULE.ID, SETTINGS.FORCE_CHRONICLE);
    context.chronicleCombatMode = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_COMBAT_MODE);
    context.chronicleEntryDepth = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_ENTRY_DEPTH);
    context.chronicleShowEmpty = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_SHOW_EMPTY);
    const emptyContentTypes = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_EMPTY_CONTENT_TYPES);
    context.chronicleEmptyContentOptions = [
      { value: 'weather', label: localize('CALENDARIA.Common.Weather'), checked: emptyContentTypes.has('weather') },
      { value: 'moon', label: localize('CALENDARIA.Common.MoonPhase'), checked: emptyContentTypes.has('moon') },
      { value: 'season', label: localize('CALENDARIA.Common.Seasons'), checked: emptyContentTypes.has('season') }
    ];
    context.chronicleShowWeather = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_SHOW_WEATHER);
    context.chronicleShowMoonPhases = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_SHOW_MOON_PHASES);
    context.chronicleShowSeasonChanges = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_SHOW_SEASON_CHANGES);
    context.chronicleBigCalButton = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_BIG_CAL_BUTTON);
    context.chronicleHudButton = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_HUD_BUTTON);
    context.chronicleMiniCalButton = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_MINI_CAL_BUTTON);
    context.openHint = format('CALENDARIA.SettingsPanel.AppTab.OpenHint', { appName: 'Chronicle' });
    const depth = context.chronicleEntryDepth;
    context.depthOptions = [
      { value: 'title', label: localize('CALENDARIA.Chronicle.Depth.Title'), selected: depth === 'title' },
      { value: 'excerpt', label: localize('CALENDARIA.Chronicle.Depth.Excerpt'), selected: depth === 'excerpt' },
      { value: 'full', label: localize('CALENDARIA.Common.Full'), selected: depth === 'full' },
      { value: 'collapsible', label: localize('CALENDARIA.Chronicle.Depth.Collapsible'), selected: depth === 'collapsible' }
    ];
  }

  /**
   * Prepare context for the Cinematics tab.
   * @param {object} context - The render context
   */
  #prepareCinematicsContext(context) {
    context.cinematicEnabled = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_ENABLED);
    context.cinematicThreshold = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_THRESHOLD);
    context.cinematicPanelDuration = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_PANEL_DURATION);
    context.cinematicShowWeather = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_SHOW_WEATHER);
    context.cinematicShowMoons = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_SHOW_MOONS);
    context.cinematicShowEvents = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_SHOW_EVENTS);
    context.cinematicEventWeighting = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_EVENT_WEIGHTING);
    context.cinematicEventMaxCards = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_EVENT_MAX_CARDS);
    context.cinematicOnRest = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_ON_REST);
    const unit = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_THRESHOLD_UNIT);
    context.thresholdUnits = [
      { value: 'day', label: localize('CALENDARIA.Common.Day'), selected: unit === 'day' },
      { value: 'week', label: localize('CALENDARIA.Common.Week'), selected: unit === 'week' },
      { value: 'month', label: localize('CALENDARIA.Common.Month'), selected: unit === 'month' },
      { value: 'season', label: localize('CALENDARIA.Common.Season'), selected: unit === 'season' },
      { value: 'year', label: localize('CALENDARIA.Common.Year'), selected: unit === 'year' }
    ];
  }

  /**
   * Prepare context for the Stopwatch tab.
   * @param {object} context - The context object
   */
  async #prepareStopwatchContext(context) {
    context.showStopwatch = game.settings.get(MODULE.ID, SETTINGS.SHOW_STOPWATCH);
    context.forceStopwatch = game.settings.get(MODULE.ID, SETTINGS.FORCE_STOPWATCH);
    context.stopwatchAutoStartTime = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_AUTO_START_TIME);
    context.stopwatchAutoFade = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_AUTO_FADE);
    context.stopwatchIdleOpacity = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_IDLE_OPACITY);
    context.stopwatchCombatMode = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_COMBAT_MODE);
    const stopwatchSticky = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STICKY_STATES);
    context.stopwatchStickyPosition = stopwatchSticky?.position ?? false;
    context.formatLocations = this.#prepareFormatLocationsForCategory('stopwatch');
    context.openHint = format('CALENDARIA.SettingsPanel.AppTab.OpenHint', { appName: 'Stop Watch' });
  }

  /**
   * Prepare context for the Sun Dial tab.
   * @param {object} context - The context object
   */
  async #prepareSunDialContext(context) {
    context.showSunDial = game.settings.get(MODULE.ID, SETTINGS.SHOW_SUN_DIAL);
    context.forceSunDial = game.settings.get(MODULE.ID, SETTINGS.FORCE_SUN_DIAL);
    context.sunDialAutoFade = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_AUTO_FADE);
    context.sunDialIdleOpacity = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_IDLE_OPACITY);
    context.sunDialCrankMode = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_CRANK_MODE);
    context.sunDialCombatMode = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_COMBAT_MODE);
    const sunDialSticky = game.settings.get(MODULE.ID, SETTINGS.SUN_DIAL_STICKY_STATES);
    context.sunDialStickyPosition = sunDialSticky?.position ?? false;
    context.formatLocations = this.#prepareFormatLocationsForCategory('sunDial');
    context.openHint = format('CALENDARIA.SettingsPanel.AppTab.OpenHint', { appName: 'Sun Dial' });
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
    context.forceTimeKeeper = game.settings.get(MODULE.ID, SETTINGS.FORCE_TIME_KEEPER);
    context.timeKeeperAutoFade = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_AUTO_FADE);
    context.timeKeeperIdleOpacity = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_IDLE_OPACITY);
    context.timeKeeperCombatMode = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_COMBAT_MODE);
    const timeKeeperSticky = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_STICKY_STATES);
    context.timeKeeperStickyPosition = timeKeeperSticky?.position ?? false;
    context.formatLocations = this.#prepareFormatLocationsForCategory('timekeeper');
    const timeKeeperJumps = game.settings.get(MODULE.ID, SETTINGS.TIMEKEEPER_TIME_JUMPS) || {};
    const { labels: incrementLabels, keys: incrementKeys } = SettingsPanel.#getIncrementLabels();
    context.timeKeeperTimeJumps = incrementKeys.map((key) => ({ key, label: incrementLabels[key] || key, jumps: timeKeeperJumps[key] || { dec2: null, dec1: null, inc1: null, inc2: null } }));
    context.openHint = format('CALENDARIA.SettingsPanel.AppTab.OpenHint', { appName: 'Time Keeper' });
  }

  /**
   * Prepare context for the Weather tab.
   * @param {object} context - The context object
   */
  async #prepareWeatherContext(context) {
    context.autoGenerateWeather = game.settings.get(MODULE.ID, SETTINGS.AUTO_GENERATE_WEATHER);
    const tempUnit = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_UNIT);
    context.temperatureUnitOptions = [
      { value: 'celsius', label: localize('CALENDARIA.Settings.TemperatureUnit.Celsius'), selected: tempUnit === 'celsius' },
      { value: 'fahrenheit', label: localize('CALENDARIA.Settings.TemperatureUnit.Fahrenheit'), selected: tempUnit === 'fahrenheit' }
    ];
    context.temperatureUnitSymbol = tempUnit === 'fahrenheit' ? '°F' : '°C';
    context.temperatureShowBoth = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_SHOW_BOTH);
    const precipUnit = game.settings.get(MODULE.ID, SETTINGS.PRECIPITATION_UNIT);
    context.precipitationUnitOptions = [
      { value: 'metric', label: localize('CALENDARIA.Settings.PrecipitationUnit.Metric'), selected: precipUnit === 'metric' },
      { value: 'imperial', label: localize('CALENDARIA.Settings.PrecipitationUnit.Imperial'), selected: precipUnit === 'imperial' }
    ];
    const windUnit = game.settings.get(MODULE.ID, SETTINGS.WIND_SPEED_UNIT);
    context.windSpeedUnitOptions = [
      { value: 'kph', label: localize('CALENDARIA.Settings.WindSpeedUnit.Kph'), selected: windUnit === 'kph' },
      { value: 'mph', label: localize('CALENDARIA.Settings.WindSpeedUnit.Mph'), selected: windUnit === 'mph' }
    ];
    const zones = WeatherManager.getCalendarZones() || [];
    const activeZone = WeatherManager.getActiveZone();
    context.hasZones = zones.length > 0;
    context.zoneOptions = zones.map((z) => ({ value: z.id, label: localize(z.name), selected: z.id === activeZone?.id }));
    context.zoneOptions.sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang));
    context.weatherInertia = game.settings.get(MODULE.ID, SETTINGS.WEATHER_INERTIA) ?? 0.3;
    context.intradayWeather = game.settings.get(MODULE.ID, SETTINGS.INTRADAY_WEATHER) ?? false;
    context.intradayCarryOver = game.settings.get(MODULE.ID, SETTINGS.INTRADAY_CARRY_OVER) ?? 50;
    context.weatherHistoryDays = game.settings.get(MODULE.ID, SETTINGS.WEATHER_HISTORY_DAYS) ?? 365;
    context.forecastAccuracy = game.settings.get(MODULE.ID, SETTINGS.FORECAST_ACCURACY) ?? 70;
    context.forecastDays = game.settings.get(MODULE.ID, SETTINGS.FORECAST_DAYS) ?? 7;
    context.gmOverrideClearsForecast = game.settings.get(MODULE.ID, SETTINGS.GM_OVERRIDE_CLEARS_FORECAST) ?? true;
    context.fxmasterActive = game.modules.get('fxmaster')?.active ?? false;
    context.fxmasterPlusActive = game.modules.get('fxmaster-plus')?.active ?? false;
    context.fxmasterEnabled = game.settings.get(MODULE.ID, SETTINGS.FXMASTER_ENABLED);
    context.fxmasterTopDown = game.settings.get(MODULE.ID, SETTINGS.FXMASTER_TOP_DOWN);
    context.fxmasterForceDownward = game.settings.get(MODULE.ID, SETTINGS.FXMASTER_FORCE_DOWNWARD);
    context.fxmasterBelowTokens = game.settings.get(MODULE.ID, SETTINGS.FXMASTER_BELOW_TOKENS);
    context.fxmasterSoundFx = game.settings.get(MODULE.ID, SETTINGS.FXMASTER_SOUND_FX);
    context.weatherSoundFx = game.settings.get(MODULE.ID, SETTINGS.WEATHER_SOUND_FX);
    context.weatherSoundVolume = game.settings.get(MODULE.ID, SETTINGS.WEATHER_SOUND_VOLUME) ?? 0.5;
  }

  /**
   * Prepare context for the Theme tab.
   * @param {object} context - The context object
   */
  async #prepareThemeContext(context) {
    const themeMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE) || 'dark';
    const forcedTheme = getForcedTheme();
    const themes = getCustomThemes();
    if (context.isGM) {
      const forceTheme = game.settings.get(MODULE.ID, SETTINGS.FORCE_THEME) || 'none';
      const forcePresets = Object.keys(THEME_PRESETS)
        .map((v) => ({ value: v, label: localize(`CALENDARIA.ThemeEditor.Presets.${v.charAt(0).toUpperCase() + v.slice(1)}`), selected: forceTheme === v }))
        .sort((a, b) => a.label.localeCompare(b.label));
      const forceCustom = Object.entries(themes)
        .map(([key, entry]) => ({ value: key, label: entry.name, selected: forceTheme === key }))
        .sort((a, b) => a.label.localeCompare(b.label));
      context.forceThemeOptions = [{ value: 'none', label: localize('CALENDARIA.Settings.ForceTheme.None'), selected: forceTheme === 'none' }, ...forcePresets, ...forceCustom];
    }
    context.themeForced = !!forcedTheme;
    const displayMode = forcedTheme || themeMode;
    context.builtInThemes = Object.keys(THEME_PRESETS)
      .map((v) => ({ key: v, label: localize(`CALENDARIA.ThemeEditor.Presets.${v.charAt(0).toUpperCase() + v.slice(1)}`), selected: displayMode === v }))
      .sort((a, b) => a.label.localeCompare(b.label));
    context.customThemes = Object.entries(themes)
      .map(([key, entry]) => ({ key, label: entry.name, selected: displayMode === key }))
      .sort((a, b) => a.label.localeCompare(b.label));
    context.isCustomThemeActive = isCustomThemeKey(themeMode);
    context.canDeleteTheme = isCustomThemeKey(themeMode) && !forcedTheme;
    context.showCustomColors = isCustomThemeKey(displayMode) && !forcedTheme;
    if (context.isCustomThemeActive) {
      const activeCustom = getCustomTheme(themeMode);
      context.activeCustomThemeName = activeCustom?.name || themeMode;
    }
    if (context.showCustomColors) {
      const activeCustom = getCustomTheme(displayMode);
      const baseColors = THEME_PRESETS[activeCustom?.basePreset]?.colors || DEFAULT_COLORS;
      const mergedColors = { ...baseColors, ...(activeCustom?.colors || {}) };
      const categories = {};
      for (const [catKey, catLabel] of Object.entries(COLOR_CATEGORIES)) categories[catKey] = { key: catKey, label: catLabel, colors: [] };
      for (const def of COLOR_DEFINITIONS) {
        const value = mergedColors[def.key] || baseColors[def.key];
        const isCustom = activeCustom?.colors?.[def.key] !== undefined;
        categories[def.category].colors.push({ key: def.key, label: def.label, value, defaultValue: baseColors[def.key], isCustom });
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
    context.colorShiftSync = game.settings.get(MODULE.ID, SETTINGS.COLOR_SHIFT_SYNC);
    context.darknessMoonSync = game.settings.get(MODULE.ID, SETTINGS.DARKNESS_MOON_SYNC);
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
    const globalTriggers = [
      { key: 'dawn', label: 'CALENDARIA.MacroTrigger.Dawn' },
      { key: 'dusk', label: 'CALENDARIA.MacroTrigger.Dusk' },
      { key: 'midday', label: 'CALENDARIA.MacroTrigger.Midday' },
      { key: 'midnight', label: 'CALENDARIA.Common.Midnight' },
      { key: 'newDay', label: 'CALENDARIA.Common.NewDay' }
    ];
    context.globalTriggers = globalTriggers.map((trigger) => ({ ...trigger, label: localize(trigger.label), macroId: config.global?.[trigger.key] || '' }));
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
      { value: '0', label: localize('CALENDARIA.Common.Off'), selected: logLevel === '0' || logLevel === 0 },
      { value: '1', label: localize('CALENDARIA.Settings.Logger.Choices.Errors'), selected: logLevel === '1' || logLevel === 1 },
      { value: '2', label: localize('CALENDARIA.Settings.Logger.Choices.Warnings'), selected: logLevel === '2' || logLevel === 2 },
      { value: '3', label: localize('CALENDARIA.Settings.Logger.Choices.Verbose'), selected: logLevel === '3' || logLevel === 3 }
    ];
    context.devMode = game.settings.get(MODULE.ID, SETTINGS.DEV_MODE);
    context.moduleVersion = game.modules.get(MODULE.ID)?.version ?? 'Unknown';
    const moduleData = game.data.modules?.find((m) => m.id === MODULE.ID);
    if (moduleData?.languages?.length) context.translations = moduleData.languages.map((lang) => lang.name).join(', ');
    context.showToolbarButton = game.settings.get(MODULE.ID, SETTINGS.SHOW_TOOLBAR_BUTTON);
    const toolbarApps = game.settings.get(MODULE.ID, SETTINGS.TOOLBAR_APPS);
    context.toolbarAppOptions = [
      { id: 'bigcal', icon: 'fa-calendar-days', label: localize('CALENDARIA.Common.BigCal'), checked: toolbarApps.has('bigcal') },
      { id: 'minical', icon: 'fa-compress', label: localize('CALENDARIA.Common.MiniCal'), checked: toolbarApps.has('minical') },
      { id: 'hud', icon: 'fa-landmark-dome', label: localize('CALENDARIA.SettingsPanel.Tab.HUD'), checked: toolbarApps.has('hud') },
      { id: 'timekeeper', icon: 'fa-gauge', label: localize('CALENDARIA.Common.TimeKeeper'), checked: toolbarApps.has('timekeeper') },
      { id: 'sundial', icon: 'fa-sun', label: localize('CALENDARIA.SettingsPanel.Tab.SunDial'), checked: toolbarApps.has('sundial') },
      { id: 'stopwatch', icon: 'fa-stopwatch', label: localize('CALENDARIA.Common.StopWatch'), checked: toolbarApps.has('stopwatch') },
      { id: 'chronicle', icon: 'fa-scroll', label: localize('CALENDARIA.Chronicle.Title'), checked: toolbarApps.has('chronicle') }
    ];
    context.showJournalFooter = game.settings.get(MODULE.ID, SETTINGS.SHOW_JOURNAL_FOOTER);
    const enricherTarget = game.settings.get(MODULE.ID, SETTINGS.ENRICHER_CLICK_TARGET);
    context.enricherClickTargetOptions = [
      { value: 'auto', label: localize('CALENDARIA.Settings.EnricherClickTarget.Auto'), selected: enricherTarget === 'auto' },
      { value: 'minical', label: localize('CALENDARIA.Settings.EnricherClickTarget.MiniCal'), selected: enricherTarget === 'minical' },
      { value: 'bigcal', label: localize('CALENDARIA.Settings.EnricherClickTarget.BigCal'), selected: enricherTarget === 'bigcal' }
    ];
  }

  /**
   * Prepare context for the Permissions tab.
   * @param {object} context - The context object
   */
  async #preparePermissionsContext(context) {
    const defaults = {
      viewBigCal: { player: false, trusted: true, assistant: true },
      viewChronicle: { player: false, trusted: true, assistant: true },
      viewHUD: { player: true, trusted: true, assistant: true },
      viewMiniCal: { player: false, trusted: true, assistant: true },
      viewStopwatch: { player: false, trusted: true, assistant: true },
      viewSunDial: { player: false, trusted: true, assistant: true },
      viewTimeKeeper: { player: false, trusted: true, assistant: true },
      addNotes: { player: true, trusted: true, assistant: true },
      changeDateTime: { player: false, trusted: false, assistant: true },
      changeActiveCalendar: { player: false, trusted: false, assistant: false },
      changeWeather: { player: false, trusted: false, assistant: true },
      deleteNotes: { player: false, trusted: false, assistant: true },
      editCalendars: { player: false, trusted: false, assistant: false },
      viewWeatherForecast: { player: false, trusted: true, assistant: true }
    };
    const saved = game.settings.get(MODULE.ID, SETTINGS.PERMISSIONS) || {};
    context.permissions = {};
    for (const [key, defaultVal] of Object.entries(defaults)) {
      context.permissions[key] = { player: saved[key]?.player ?? defaultVal.player, trusted: saved[key]?.trusted ?? defaultVal.trusted, assistant: saved[key]?.assistant ?? defaultVal.assistant };
    }
  }

  /**
   * Prepare context data for Fog of War settings.
   * @param {object} context - The context object
   */
  #prepareFogOfWarContext(context) {
    context.fogOfWarEnabled = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_ENABLED);
    const config = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_CONFIG);
    context.fogAutoReveal = config.autoReveal ?? true;
    context.fogRevealRadius = config.revealRadius ?? 0;
    context.fogRevealIntermediate = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_REVEAL_INTERMEDIATE);
    const startDate = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_START_DATE);
    const selectedMonth = startDate?.month ?? null;
    const selectedDay = startDate?.dayOfMonth ?? null;
    context.fogStartYear = startDate?.year ?? '';
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    context.fogStartMonths = calendar?.isMonthless ? [] : (calendar?.monthsArray || []).map((m, idx) => ({ value: idx + 1, label: localize(m.name), selected: selectedMonth === idx }));
    const startYear = startDate?.year ?? 0;
    const daysInMonth = selectedMonth != null && calendar ? calendar.getDaysInMonth(selectedMonth, startYear - yearZero) : 0;
    context.fogStartDays = [];
    for (let d = 0; d < daysInMonth; d++) context.fogStartDays.push({ value: d + 1, label: String(d + 1), selected: selectedDay === d });
    const navMode = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_NAV_MODE);
    context.fogNavModeOptions = [
      { value: 'skip', label: 'CALENDARIA.Settings.FogOfWar.NavModeSkip', selected: navMode === 'skip' },
      { value: 'normal', label: 'CALENDARIA.Settings.FogOfWar.NavModeNormal', selected: navMode === 'normal' }
    ];
  }

  /**
   * Handle form submission.
   * @param {Event} _event - The form submission event
   * @param {HTMLFormElement} _form - The form element
   * @param {object} formData - The form data
   */
  static async #onSubmit(_event, _form, formData) {
    const data = foundry.utils.expandObject(formData.object);
    const beforeSnapshot = SettingsPanel.#snapshotSettings();
    if ('showTimeKeeper' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_TIME_KEEPER, data.showTimeKeeper);
    if ('forceTimeKeeper' in data) await game.settings.set(MODULE.ID, SETTINGS.FORCE_TIME_KEEPER, data.forceTimeKeeper);
    if ('timeKeeperAutoFade' in data) await game.settings.set(MODULE.ID, SETTINGS.TIMEKEEPER_AUTO_FADE, data.timeKeeperAutoFade);
    if ('timeKeeperIdleOpacity' in data) await game.settings.set(MODULE.ID, SETTINGS.TIMEKEEPER_IDLE_OPACITY, Number(data.timeKeeperIdleOpacity));
    if ('timeKeeperCombatMode' in data) await game.settings.set(MODULE.ID, SETTINGS.TIMEKEEPER_COMBAT_MODE, data.timeKeeperCombatMode);
    if ('showChronicle' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_CHRONICLE, data.showChronicle);
    if ('forceChronicle' in data) await game.settings.set(MODULE.ID, SETTINGS.FORCE_CHRONICLE, data.forceChronicle);
    if ('chronicleCombatMode' in data) await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_COMBAT_MODE, data.chronicleCombatMode);
    if ('chronicleEntryDepth' in data) await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_ENTRY_DEPTH, data.chronicleEntryDepth);
    if ('chronicleShowEmpty' in data) await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_SHOW_EMPTY, data.chronicleShowEmpty);
    if ('chronicleEmptyContentTypes' in data) {
      const types = Array.isArray(data.chronicleEmptyContentTypes) ? data.chronicleEmptyContentTypes : data.chronicleEmptyContentTypes ? [data.chronicleEmptyContentTypes] : [];
      await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_EMPTY_CONTENT_TYPES, new Set(types));
    }
    if ('chronicleShowWeather' in data) await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_SHOW_WEATHER, data.chronicleShowWeather);
    if ('chronicleShowMoonPhases' in data) await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_SHOW_MOON_PHASES, data.chronicleShowMoonPhases);
    if ('chronicleShowSeasonChanges' in data) await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_SHOW_SEASON_CHANGES, data.chronicleShowSeasonChanges);
    if ('chronicleBigCalButton' in data) await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_BIG_CAL_BUTTON, data.chronicleBigCalButton);
    if ('chronicleHudButton' in data) await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_HUD_BUTTON, data.chronicleHudButton);
    if ('chronicleMiniCalButton' in data) await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_MINI_CAL_BUTTON, data.chronicleMiniCalButton);
    if ('showStopwatch' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_STOPWATCH, data.showStopwatch);
    if ('forceStopwatch' in data) await game.settings.set(MODULE.ID, SETTINGS.FORCE_STOPWATCH, data.forceStopwatch);
    if ('stopwatchAutoFade' in data) await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_AUTO_FADE, data.stopwatchAutoFade);
    if ('stopwatchIdleOpacity' in data) await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_IDLE_OPACITY, Number(data.stopwatchIdleOpacity));
    if ('stopwatchAutoStartTime' in data) await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_AUTO_START_TIME, data.stopwatchAutoStartTime);
    if ('stopwatchCombatMode' in data) await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_COMBAT_MODE, data.stopwatchCombatMode);
    if ('timeSpeedMultiplier' in data || 'timeSpeedIncrement' in data) {
      if ('timeSpeedMultiplier' in data) await game.settings.set(MODULE.ID, SETTINGS.TIME_SPEED_MULTIPLIER, Math.max(0, Number(data.timeSpeedMultiplier ?? 1)));
      if ('timeSpeedIncrement' in data) await game.settings.set(MODULE.ID, SETTINGS.TIME_SPEED_INCREMENT, data.timeSpeedIncrement);
      TimeClock.loadSpeedFromSettings();
    }
    if ('timeAdvanceInterval' in data) {
      await game.settings.set(MODULE.ID, SETTINGS.TIME_ADVANCE_INTERVAL, Math.max(1, Math.min(120, Number(data.timeAdvanceInterval) || 60)));
      TimeClock.restartIntervals();
    }
    if ('showToolbarButton' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_TOOLBAR_BUTTON, data.showToolbarButton);
    if ('toolbarApps' in data) {
      const apps = Array.isArray(data.toolbarApps) ? data.toolbarApps : data.toolbarApps ? [data.toolbarApps] : [];
      await game.settings.set(MODULE.ID, SETTINGS.TOOLBAR_APPS, new Set(apps));
    }
    if ('showJournalFooter' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_JOURNAL_FOOTER, data.showJournalFooter);
    if ('enricherClickTarget' in data) await game.settings.set(MODULE.ID, SETTINGS.ENRICHER_CLICK_TARGET, data.enricherClickTarget);
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
    if ('hudCalendarButton' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_CALENDAR_BUTTON, data.hudCalendarButton);
    if ('hudDialStyle' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_DIAL_STYLE, data.hudDialStyle);
    if ('hudTrayDirection' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_TRAY_DIRECTION, data.hudTrayDirection);
    if ('hudCombatMode' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_COMBAT_MODE, data.hudCombatMode);
    if ('hudWeatherFxMode' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_WEATHER_FX_MODE, data.hudWeatherFxMode);
    if ('hudBorderGlow' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_BORDER_GLOW, data.hudBorderGlow);
    if ('hudDomeBelow' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_DOME_BELOW, data.hudDomeBelow);
    if ('hudDomeAutoHide' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_DOME_AUTO_HIDE, data.hudDomeAutoHide);
    if ('hudShowAllMoons' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_SHOW_ALL_MOONS, data.hudShowAllMoons);
    if ('hudAutoFade' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_AUTO_FADE, data.hudAutoFade);
    if ('hudIdleOpacity' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_IDLE_OPACITY, Number(data.hudIdleOpacity));
    if ('hudWidthScale' in data) await game.settings.set(MODULE.ID, SETTINGS.HUD_WIDTH_SCALE, Number(data.hudWidthScale));
    if ('miniCalAutoFade' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_AUTO_FADE, data.miniCalAutoFade);
    if ('miniCalIdleOpacity' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_IDLE_OPACITY, Number(data.miniCalIdleOpacity));
    if ('miniCalControlsDelay' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_CONTROLS_DELAY, Number(data.miniCalControlsDelay));
    if ('miniCalConfirmSetDate' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_CONFIRM_SET_DATE, data.miniCalConfirmSetDate);
    if ('miniCalAutoOpenNotes' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_AUTO_OPEN_NOTES, data.miniCalAutoOpenNotes);
    if ('miniCalCompactMode' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_COMPACT_MODE, data.miniCalCompactMode);
    if ('miniCalCombatMode' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_COMBAT_MODE, data.miniCalCombatMode);
    if ('darknessSync' in data) {
      await game.settings.set(MODULE.ID, SETTINGS.DARKNESS_SYNC, data.darknessSync);
      if (data.darknessSync && (game.pf2e?.worldClock ?? game.sf2e?.worldClock)) {
        const systemId = game.system.id;
        const systemClockSetting = game.settings.get(systemId, 'worldClock');
        if (systemClockSetting?.syncDarkness) await game.settings.set(systemId, 'worldClock', { ...systemClockSetting, syncDarkness: false });
      }
    }
    if ('darknessSyncAllScenes' in data) await game.settings.set(MODULE.ID, SETTINGS.DARKNESS_SYNC_ALL_SCENES, data.darknessSyncAllScenes);
    if ('darknessWeatherSync' in data) await game.settings.set(MODULE.ID, SETTINGS.DARKNESS_WEATHER_SYNC, data.darknessWeatherSync);
    if ('ambienceSync' in data) await game.settings.set(MODULE.ID, SETTINGS.AMBIENCE_SYNC, data.ambienceSync);
    if ('colorShiftSync' in data) await game.settings.set(MODULE.ID, SETTINGS.COLOR_SHIFT_SYNC, data.colorShiftSync);
    if ('darknessMoonSync' in data) await game.settings.set(MODULE.ID, SETTINGS.DARKNESS_MOON_SYNC, data.darknessMoonSync);
    if ('advanceTimeOnRest' in data) await game.settings.set(MODULE.ID, SETTINGS.ADVANCE_TIME_ON_REST, data.advanceTimeOnRest);
    if ('restToSunrise' in data) await game.settings.set(MODULE.ID, SETTINGS.REST_TO_SUNRISE, data.restToSunrise);
    if ('syncClockPause' in data) await game.settings.set(MODULE.ID, SETTINGS.SYNC_CLOCK_PAUSE, data.syncClockPause);
    if ('clockRunDuringCombat' in data) await game.settings.set(MODULE.ID, SETTINGS.CLOCK_RUN_DURING_COMBAT, data.clockRunDuringCombat);
    if ('chatTimestampMode' in data) await game.settings.set(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE, data.chatTimestampMode);
    if ('chatTimestampShowTime' in data) await game.settings.set(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_SHOW_TIME, data.chatTimestampShowTime);
    if ('equivalentDateCalendars' in data) {
      const ids = Array.isArray(data.equivalentDateCalendars) ? data.equivalentDateCalendars : data.equivalentDateCalendars ? [data.equivalentDateCalendars] : [];
      await game.settings.set(MODULE.ID, SETTINGS.EQUIVALENT_DATE_CALENDARS, new Set(ids));
    }
    if ('activeCalendar' in data) {
      const current = game.settings.get(MODULE.ID, SETTINGS.ACTIVE_CALENDAR);
      if (data.activeCalendar !== current) {
        const eqCalendars = game.settings.get(MODULE.ID, SETTINGS.EQUIVALENT_DATE_CALENDARS);
        if (eqCalendars.has(data.activeCalendar)) {
          const updated = new Set(eqCalendars);
          updated.delete(data.activeCalendar);
          updated.add(current);
          await game.settings.set(MODULE.ID, SETTINGS.EQUIVALENT_DATE_CALENDARS, updated);
        }
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
    if ('autoGenerateWeather' in data) await game.settings.set(MODULE.ID, SETTINGS.AUTO_GENERATE_WEATHER, !!data.autoGenerateWeather);
    if ('temperatureUnit' in data) await game.settings.set(MODULE.ID, SETTINGS.TEMPERATURE_UNIT, data.temperatureUnit);
    if ('temperatureShowBoth' in data) await game.settings.set(MODULE.ID, SETTINGS.TEMPERATURE_SHOW_BOTH, data.temperatureShowBoth);
    if ('precipitationUnit' in data) await game.settings.set(MODULE.ID, SETTINGS.PRECIPITATION_UNIT, data.precipitationUnit);
    if ('windSpeedUnit' in data) await game.settings.set(MODULE.ID, SETTINGS.WIND_SPEED_UNIT, data.windSpeedUnit);
    if ('weatherInertia' in data) await game.settings.set(MODULE.ID, SETTINGS.WEATHER_INERTIA, parseFloat(data.weatherInertia));
    if ('intradayWeather' in data) await game.settings.set(MODULE.ID, SETTINGS.INTRADAY_WEATHER, !!data.intradayWeather);
    if ('intradayCarryOver' in data) await game.settings.set(MODULE.ID, SETTINGS.INTRADAY_CARRY_OVER, parseInt(data.intradayCarryOver));
    if ('weatherHistoryDays' in data) await game.settings.set(MODULE.ID, SETTINGS.WEATHER_HISTORY_DAYS, parseInt(data.weatherHistoryDays));
    if ('forecastAccuracy' in data) await game.settings.set(MODULE.ID, SETTINGS.FORECAST_ACCURACY, parseInt(data.forecastAccuracy));
    if ('forecastDays' in data) await game.settings.set(MODULE.ID, SETTINGS.FORECAST_DAYS, parseInt(data.forecastDays));
    if ('gmOverrideClearsForecast' in data) await game.settings.set(MODULE.ID, SETTINGS.GM_OVERRIDE_CLEARS_FORECAST, !!data.gmOverrideClearsForecast);
    if ('fxmasterEnabled' in data) {
      const enabled = !!data.fxmasterEnabled;
      await game.settings.set(MODULE.ID, SETTINGS.FXMASTER_ENABLED, enabled);
      if (!enabled) {
        const { stopAllFX } = await import('../../integrations/fxmaster.mjs');
        await stopAllFX();
      }
    }
    if ('fxmasterTopDown' in data) await game.settings.set(MODULE.ID, SETTINGS.FXMASTER_TOP_DOWN, !!data.fxmasterTopDown);
    if ('fxmasterForceDownward' in data) await game.settings.set(MODULE.ID, SETTINGS.FXMASTER_FORCE_DOWNWARD, !!data.fxmasterForceDownward);
    if ('fxmasterBelowTokens' in data) await game.settings.set(MODULE.ID, SETTINGS.FXMASTER_BELOW_TOKENS, !!data.fxmasterBelowTokens);
    if ('fxmasterSoundFx' in data) await game.settings.set(MODULE.ID, SETTINGS.FXMASTER_SOUND_FX, !!data.fxmasterSoundFx);
    if ('weatherSoundFx' in data) await game.settings.set(MODULE.ID, SETTINGS.WEATHER_SOUND_FX, !!data.weatherSoundFx);
    if ('weatherSoundVolume' in data) await game.settings.set(MODULE.ID, SETTINGS.WEATHER_SOUND_VOLUME, parseFloat(data.weatherSoundVolume));
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
    if ('timeKeeperStickySection' in data) await game.settings.set(MODULE.ID, SETTINGS.TIMEKEEPER_STICKY_STATES, { position: !!data.timeKeeperStickyPosition });
    if ('stopwatchStickySection' in data) await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_STICKY_STATES, { position: !!data.stopwatchStickyPosition });
    if ('showSunDial' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_SUN_DIAL, !!data.showSunDial);
    if ('forceSunDial' in data) await game.settings.set(MODULE.ID, SETTINGS.FORCE_SUN_DIAL, data.forceSunDial);
    if ('sunDialAutoFade' in data) await game.settings.set(MODULE.ID, SETTINGS.SUN_DIAL_AUTO_FADE, !!data.sunDialAutoFade);
    if ('sunDialIdleOpacity' in data) await game.settings.set(MODULE.ID, SETTINGS.SUN_DIAL_IDLE_OPACITY, Math.round(Number(data.sunDialIdleOpacity)));
    if ('sunDialCrankMode' in data) await game.settings.set(MODULE.ID, SETTINGS.SUN_DIAL_CRANK_MODE, !!data.sunDialCrankMode);
    if ('sunDialCombatMode' in data) await game.settings.set(MODULE.ID, SETTINGS.SUN_DIAL_COMBAT_MODE, data.sunDialCombatMode);
    if ('sunDialStickySection' in data) {
      await game.settings.set(MODULE.ID, SETTINGS.SUN_DIAL_STICKY_STATES, { position: !!data.sunDialStickyPosition });
      SunDial.refreshStickyStates();
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
    if ('miniCalShowTime' in data) await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_SHOW_TIME, data.miniCalShowTime);
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
    if ('showBigCal' in data) await game.settings.set(MODULE.ID, SETTINGS.SHOW_BIG_CAL, data.showBigCal);
    if ('forceBigCal' in data) await game.settings.set(MODULE.ID, SETTINGS.FORCE_BIG_CAL, data.forceBigCal);
    if ('bigCalAutoFade' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_AUTO_FADE, data.bigCalAutoFade);
    if ('bigCalIdleOpacity' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_IDLE_OPACITY, Number(data.bigCalIdleOpacity));
    if ('bigCalCombatMode' in data) await game.settings.set(MODULE.ID, SETTINGS.BIG_CAL_COMBAT_MODE, data.bigCalCombatMode);
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
      foundry.applications.instances.get('calendaria-timekeeper')?.render();
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
      foundry.applications.instances.get('calendaria-mini-cal')?.render();
    }
    if ('primaryGM' in data) await game.settings.set(MODULE.ID, SETTINGS.PRIMARY_GM, data.primaryGM || '');
    if ('loggingLevel' in data) await game.settings.set(MODULE.ID, SETTINGS.LOGGING_LEVEL, data.loggingLevel);
    if ('devMode' in data) await game.settings.set(MODULE.ID, SETTINGS.DEV_MODE, data.devMode);
    if (data.permissions) {
      const permissionKeys = [
        'viewBigCal',
        'viewChronicle',
        'viewHUD',
        'viewMiniCal',
        'viewStopwatch',
        'viewSunDial',
        'viewTimeKeeper',
        'addNotes',
        'changeDateTime',
        'changeActiveCalendar',
        'changeWeather',
        'deleteNotes',
        'editCalendars',
        'viewWeatherForecast'
      ];
      const permissions = {};
      for (const key of permissionKeys) {
        permissions[key] = {
          player: !!data.permissions?.[key]?.player,
          trusted: !!data.permissions?.[key]?.trusted,
          assistant: !!data.permissions?.[key]?.assistant
        };
      }
      await game.settings.set(MODULE.ID, SETTINGS.PERMISSIONS, permissions);
    }
    if ('cinematicEnabled' in data) await game.settings.set(MODULE.ID, SETTINGS.CINEMATIC_ENABLED, !!data.cinematicEnabled);
    if ('cinematicThreshold' in data) await game.settings.set(MODULE.ID, SETTINGS.CINEMATIC_THRESHOLD, Math.max(1, parseInt(data.cinematicThreshold) || 1));
    if ('cinematicThresholdUnit' in data) await game.settings.set(MODULE.ID, SETTINGS.CINEMATIC_THRESHOLD_UNIT, data.cinematicThresholdUnit);
    if ('cinematicPanelDuration' in data) await game.settings.set(MODULE.ID, SETTINGS.CINEMATIC_PANEL_DURATION, Math.max(1000, Math.min(6000, parseInt(data.cinematicPanelDuration) || 3000)));
    if ('cinematicShowWeather' in data) await game.settings.set(MODULE.ID, SETTINGS.CINEMATIC_SHOW_WEATHER, !!data.cinematicShowWeather);
    if ('cinematicShowMoons' in data) await game.settings.set(MODULE.ID, SETTINGS.CINEMATIC_SHOW_MOONS, !!data.cinematicShowMoons);
    if ('cinematicShowEvents' in data) await game.settings.set(MODULE.ID, SETTINGS.CINEMATIC_SHOW_EVENTS, !!data.cinematicShowEvents);
    if ('cinematicEventWeighting' in data) await game.settings.set(MODULE.ID, SETTINGS.CINEMATIC_EVENT_WEIGHTING, data.cinematicEventWeighting);
    if ('cinematicEventMaxCards' in data) await game.settings.set(MODULE.ID, SETTINGS.CINEMATIC_EVENT_MAX_CARDS, Math.max(1, Math.min(20, parseInt(data.cinematicEventMaxCards) || 8)));
    if ('cinematicOnRest' in data) await game.settings.set(MODULE.ID, SETTINGS.CINEMATIC_ON_REST, !!data.cinematicOnRest);
    if ('fogOfWarEnabled' in data) await game.settings.set(MODULE.ID, SETTINGS.FOG_OF_WAR_ENABLED, !!data.fogOfWarEnabled);
    if ('fogAutoReveal' in data || 'fogRevealRadius' in data) {
      const current = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_CONFIG);
      await game.settings.set(MODULE.ID, SETTINGS.FOG_OF_WAR_CONFIG, {
        autoReveal: 'fogAutoReveal' in data ? !!data.fogAutoReveal : current.autoReveal,
        revealRadius: 'fogRevealRadius' in data ? Math.max(0, parseInt(data.fogRevealRadius) || 0) : current.revealRadius
      });
    }
    if ('fogRevealIntermediate' in data) await game.settings.set(MODULE.ID, SETTINGS.FOG_OF_WAR_REVEAL_INTERMEDIATE, !!data.fogRevealIntermediate);
    if ('fogNavMode' in data) await game.settings.set(MODULE.ID, SETTINGS.FOG_OF_WAR_NAV_MODE, data.fogNavMode);
    if ('fogStartYear' in data || 'fogStartMonth' in data || 'fogStartDay' in data) {
      let y = data.fogStartYear !== '' ? parseInt(data.fogStartYear) : NaN;
      const m = data.fogStartMonth !== '' ? parseInt(data.fogStartMonth) : NaN;
      const d = data.fogStartDay !== '' ? parseInt(data.fogStartDay) : NaN;
      if (isNaN(y) && !isNaN(m)) {
        const cal = CalendarManager.getActiveCalendar();
        y = cal?.years?.yearZero ?? 0;
      }
      const startDate = {};
      if (!isNaN(y)) startDate.year = y;
      if (!isNaN(m)) startDate.month = m - 1;
      if (!isNaN(d)) startDate.dayOfMonth = d - 1;
      await game.settings.set(MODULE.ID, SETTINGS.FOG_OF_WAR_START_DATE, startDate);
      if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
        const { revealRange } = await import('../../utils/fog-of-war.mjs');
        const components = game.time.components;
        const cal = CalendarManager.getActiveCalendar();
        const yz = cal?.years?.yearZero ?? 0;
        const current = { year: components.year + yz, month: components.month, dayOfMonth: components.dayOfMonth ?? 0 };
        await revealRange({ year: y, month: m - 1, dayOfMonth: d - 1 }, current);
      }
      if (this.rendered) this.render({ parts: ['fogofwar'] });
    }
    if (data.colors) {
      const themeMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE);
      if (isCustomThemeKey(themeMode)) {
        const themes = getCustomThemes();
        const entry = themes[themeMode];
        if (entry) {
          const baseColors = THEME_PRESETS[entry.basePreset]?.colors || DEFAULT_COLORS;
          const overrides = {};
          for (const def of COLOR_DEFINITIONS) if (data.colors[def.key] && data.colors[def.key] !== baseColors[def.key]) overrides[def.key] = data.colors[def.key];
          entry.colors = overrides;
          await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, themes);
          applyCustomColors({ ...baseColors, ...overrides });
        }
      }
    }
    if ('forceTheme' in data && game.user.isGM) {
      const oldForce = game.settings.get(MODULE.ID, SETTINGS.FORCE_THEME);
      await game.settings.set(MODULE.ID, SETTINGS.FORCE_THEME, data.forceTheme);
      if (isCustomThemeKey(data.forceTheme)) await game.settings.set(MODULE.ID, SETTINGS.FORCED_THEME_COLORS, getColorsForTheme(data.forceTheme));
      else if (data.forceTheme !== 'none') await game.settings.set(MODULE.ID, SETTINGS.FORCED_THEME_COLORS, {});
      if (oldForce !== data.forceTheme) initializeTheme();
    }
    if (data.showSecretNotes !== undefined) await game.settings.set(MODULE.ID, SETTINGS.SHOW_SECRET_NOTES, !!data.showSecretNotes);
    if ('defaultNotePreset' in data) await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_NOTE_PRESET, data.defaultNotePreset || null);
    if ('noteOpenMode' in data) await game.settings.set(MODULE.ID, SETTINGS.NOTE_OPEN_MODE, data.noteOpenMode);
    if (data.defaultBrightnessMultiplier != null) await game.settings.set(MODULE.ID, SETTINGS.DEFAULT_BRIGHTNESS_MULTIPLIER, Number(data.defaultBrightnessMultiplier));
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
        microCalHeader: 'miniCal',
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
      Hooks.callAll(HOOKS.DISPLAY_FORMATS_CHANGED, newFormats);
      if (stopwatchChanged) foundry.applications.instances.get('calendaria-stopwatch')?.render();
      const settingsPanel = foundry.applications.instances.get('calendaria-settings-panel');
      if (settingsPanel?.rendered && affectedParts.size > 0) settingsPanel.render({ parts: [...affectedParts] });
    }
    const timekeeperKeys = ['timeKeeperAutoFade', 'timeKeeperIdleOpacity', 'timeKeeperStickyPosition'];
    if (timekeeperKeys.some((k) => k in data)) foundry.applications.instances.get('calendaria-timekeeper')?.render();
    const hudKeys = [
      'hudDialStyle',
      'hudTrayDirection',
      'hudCombatMode',
      'hudWeatherFxMode',
      'hudBorderGlow',
      'hudDomeBelow',
      'hudDomeAutoHide',
      'hudShowAllMoons',
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
      'miniCalAutoOpenNotes',
      'miniCalStickyTimeControls',
      'miniCalStickySidebar',
      'miniCalStickyPosition',
      'miniCalShowTime',
      'miniCalShowWeather',
      'miniCalWeatherDisplayMode',
      'miniCalShowSeason',
      'miniCalSeasonDisplayMode',
      'miniCalShowEra',
      'miniCalEraDisplayMode',
      'miniCalShowCycles',
      'miniCalCyclesDisplayMode',
      'miniCalShowMoonPhases',
      'miniCalCompactMode'
    ];
    if (miniCalKeys.some((k) => k in data)) foundry.applications.instances.get('calendaria-mini-cal')?.render();
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
   * Open the Set Date & Time dialog.
   */
  static #onOpenSetDateDialog() {
    SetDateDialog.open();
  }

  /**
   * Reset a specific UI position.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onResetPosition(_event, target) {
    const targetType = target.dataset.target;
    const config = {
      miniCal: { setting: SETTINGS.MINI_CAL_POSITION, appId: 'calendaria-mini-cal' },
      hud: { setting: SETTINGS.CALENDAR_HUD_POSITION, appId: 'calendaria-hud' },
      timekeeper: { setting: SETTINGS.TIME_KEEPER_POSITION, appId: 'calendaria-timekeeper' },
      sunDial: { setting: SETTINGS.SUN_DIAL_POSITION, appId: 'calendaria-sun-dial' },
      chronicle: { setting: SETTINGS.CHRONICLE_POSITION, appId: 'calendaria-chronicle' }
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
   * Open the Preset Manager application.
   */
  static async #onOpenPresetManager() {
    new PresetManager().render(true);
  }

  /** Open or create the Enricher Reference journal. */
  static async #onOpenEnricherReference() {
    const { cmdEnrichers } = await import('../../utils/chat/chat-command-handler.mjs');
    await cmdEnrichers();
  }

  /**
   * Reset a single color to default.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onResetColor(_event, target) {
    const app = foundry.applications.instances.get('calendaria-settings-panel');
    const colorKey = target.dataset.key;
    const themeMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE);
    if (!isCustomThemeKey(themeMode)) return;
    const themes = getCustomThemes();
    if (themes[themeMode]) {
      delete themes[themeMode].colors[colorKey];
      await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, themes);
    }
    applyCustomColors(getColorsForTheme(themeMode));
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
    const settingLabels = settingKeys
      .map((key) => {
        const meta = SettingsPanel.SETTING_METADATA[key];
        return meta ? localize(meta.label) : key;
      })
      .filter((label) => label);
    const listHtml = settingLabels.map((label) => `<li>${label}</li>`).join('');
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.SettingsPanel.ResetSection.Title'), contentClasses: ['calendaria', 'reset-section-dialog'] },
      content: `<p>${localize('CALENDARIA.SettingsPanel.ResetSection.Content')}</p><ul class="reset-list">${listHtml}</ul>`,
      yes: { label: localize('CALENDARIA.Common.Reset'), icon: 'fas fa-undo' },
      no: { label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
    });
    if (!confirmed) return;
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
   * Reset all Fog of War revealed ranges.
   */
  static async #onResetFogOfWar() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Settings.FogOfWar.ResetRanges') },
      content: `<p>${localize('CALENDARIA.Settings.FogOfWar.ResetRangesConfirm')}</p>`,
      yes: { label: localize('CALENDARIA.Common.Reset'), icon: 'fas fa-undo' },
      no: { label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
    });
    if (!confirmed) return;
    const startDate = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_START_DATE);
    const newRanges = {};
    if (startDate?.year != null && startDate?.month != null && startDate?.dayOfMonth != null) {
      const cal = CalendarManager.getActiveCalendar();
      const calId = cal?.metadata?.id;
      if (calId) {
        const yz = cal?.years?.yearZero ?? 0;
        const components = game.time.components;
        let current = { year: components.year + yz, month: components.month, dayOfMonth: components.dayOfMonth ?? 0 };
        let start = { year: startDate.year, month: startDate.month, dayOfMonth: startDate.dayOfMonth };
        const config = game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_CONFIG);
        const radius = config.revealRadius || 0;
        if (radius > 0) {
          start = addDays(start, -radius);
          current = addDays(current, radius);
        }
        newRanges[calId] = [{ start, end: current }];
      }
    }
    await game.settings.set(MODULE.ID, SETTINGS.FOG_OF_WAR_RANGES, newRanges);
    ui.notifications.info(localize('CALENDARIA.Settings.FogOfWar.ResetRangesDone'));
  }

  /**
   * Export current theme as JSON.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onExportTheme(_event, _target) {
    const themeMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE) || 'dark';
    const colors = getColorsForTheme(themeMode);
    let themeName;
    if (isCustomThemeKey(themeMode)) {
      const custom = getCustomTheme(themeMode);
      themeName = custom?.name || themeMode;
    } else {
      themeName = localize(THEME_PRESETS[themeMode]?.name) || themeMode;
    }
    const exportData = {
      name: themeName,
      basePreset: isCustomThemeKey(themeMode) ? getCustomTheme(themeMode)?.basePreset : themeMode,
      colors,
      version: game.modules.get(MODULE.ID)?.version
    };
    const filename = `calendaria-theme-${themeName.toLowerCase().replace(/\s+/g, '-')}.json`;
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
   * Import theme from JSON file — creates a new custom theme entry.
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
        const basePreset = importData.basePreset && THEME_PRESETS[importData.basePreset] ? importData.basePreset : 'dark';
        const baseColors = THEME_PRESETS[basePreset]?.colors || DEFAULT_COLORS;
        const overrides = {};
        for (const [key, value] of Object.entries(importData.colors)) if (key in DEFAULT_COLORS && baseColors[key] !== value) overrides[key] = value;
        const themes = getCustomThemes();
        const importName = importData.name || `Imported ${new Date().toLocaleDateString()}`;
        const safeKey = `custom_imported_${Date.now()}`;
        themes[safeKey] = { name: importName, basePreset, colors: overrides };
        await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, themes);
        await game.settings.set(MODULE.ID, SETTINGS.THEME_MODE, safeKey);
        applyCustomColors({ ...baseColors, ...overrides });
        ui.notifications.info('CALENDARIA.ThemeEditor.ImportSuccess', { localize: true });
        app?.render({ force: true, parts: ['theme'] });
      } catch (err) {
        log(1, 'Theme import failed:', err);
        ui.notifications.error('CALENDARIA.ThemeEditor.ImportError', { localize: true });
      }
    });
    input.click();
  }

  /** Create a new custom theme from the current preset. */
  static async #onCustomizeTheme() {
    const app = foundry.applications.instances.get('calendaria-settings-panel');
    const currentMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE) || 'dark';
    let basePreset = currentMode;
    if (isCustomThemeKey(currentMode)) {
      const custom = getCustomTheme(currentMode);
      basePreset = custom?.basePreset || 'dark';
    }
    const { key, entry } = createCustomTheme(basePreset);
    const themes = getCustomThemes();
    themes[key] = entry;
    await game.settings.set(MODULE.ID, SETTINGS.CUSTOM_THEME_COLORS, themes);
    await game.settings.set(MODULE.ID, SETTINGS.THEME_MODE, key);
    applyCustomColors(getColorsForTheme(key));
    app?.render({ force: true, parts: ['theme'] });
  }

  /** Delete the active custom theme after confirmation. */
  static async #onDeleteCustomTheme() {
    const app = foundry.applications.instances.get('calendaria-settings-panel');
    const currentMode = game.settings.get(MODULE.ID, SETTINGS.THEME_MODE);
    if (!isCustomThemeKey(currentMode)) return;
    const custom = getCustomTheme(currentMode);
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.ThemeEditor.DeleteCustom.Title') },
      content: `<p>${format('CALENDARIA.ThemeEditor.DeleteCustom.Content', { name: custom?.name || currentMode })}</p>`,
      yes: { label: localize('CALENDARIA.Common.Delete'), icon: 'fas fa-trash' },
      no: { label: localize('CALENDARIA.Common.Cancel'), icon: 'fas fa-times' }
    });
    if (!confirmed) return;
    await deleteCustomTheme(currentMode);
    app?.render({ force: true, parts: ['theme'] });
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
   * Show the BigCal Application.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onShowBigCal(_event, _target) {
    BigCal.show();
  }

  /**
   * Close the BigCal.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onCloseBigCal(_event, _target) {
    BigCal.hide();
  }

  /**
   * Open the Chronicle.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenChronicle(_event, _target) {
    Chronicle.show();
  }

  /**
   * Close the Chronicle.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onCloseChronicle(_event, _target) {
    Chronicle.hide();
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
   * Open the Sun Dial.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onOpenSunDial(_event, _target) {
    SunDial.show();
  }

  /**
   * Close the Sun Dial.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onCloseSunDial(_event, _target) {
    SunDial.hide();
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
   * Open the Weather Editor application.
   */
  static #onOpenWeatherEditor() {
    const existing = foundry.applications.instances.get('calendaria-weather-editor');
    if (existing) {
      existing.bringToFront();
      return;
    }
    new WeatherEditor().render(true);
  }

  /**
   * Open the Weather Probability dialog.
   */
  static #onOpenWeatherProbabilities() {
    WeatherProbabilityDialog.open();
  }

  /**
   * Regenerate all weather with confirmation dialog.
   */
  static async #onRegenerateAllWeather() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.Settings.RegenerateWeather.Name') },
      content: `<p>${localize('CALENDARIA.Settings.RegenerateWeather.Confirm')}</p>`
    });
    if (!confirmed) return;
    await WeatherManager.regenerateAllWeather();
    ui.notifications.info(localize('CALENDARIA.Settings.RegenerateWeather.Done'));
  }

  /**
   * Re-create missing festival notes for the active calendar.
   */
  static async #onSyncFestivals() {
    const calendarId = CalendarRegistry.getActiveId();
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendarId || !calendar) return;
    const created = await FestivalManager.ensureFestivalNotes(calendarId, calendar);
    ui.notifications.info(localize(created ? 'CALENDARIA.Settings.SyncFestivals.Done' : 'CALENDARIA.Settings.SyncFestivals.NoneCreated'));
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
    if (partId === 'theme') {
      const colorInputs = htmlElement.querySelectorAll('color-picker[data-key]');
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
      const autoFadeCheckbox = htmlElement.querySelector('input[name="miniCalAutoFade"]');
      if (autoFadeCheckbox && opacityInput && opacityGroup && opacityNumber) {
        autoFadeCheckbox.addEventListener('change', () => {
          opacityInput.disabled = !autoFadeCheckbox.checked;
          opacityNumber.disabled = !autoFadeCheckbox.checked;
          opacityGroup.classList.toggle('disabled', !autoFadeCheckbox.checked);
        });
      }
    }
    if (partId === 'sunDial') {
      const rangeInput = htmlElement.querySelector('input[name="sunDialIdleOpacity"]');
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
      const autoFadeCheckbox = htmlElement.querySelector('input[name="sunDialAutoFade"]');
      if (autoFadeCheckbox && rangeInput && rangeGroup && numberInput) {
        autoFadeCheckbox.addEventListener('change', () => {
          rangeInput.disabled = !autoFadeCheckbox.checked;
          numberInput.disabled = !autoFadeCheckbox.checked;
          rangeGroup.classList.toggle('disabled', !autoFadeCheckbox.checked);
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
      const autoFadeCheckbox = htmlElement.querySelector('input[name="hudAutoFade"]');
      if (autoFadeCheckbox && opacityInput && opacityGroup && opacityNumber) {
        autoFadeCheckbox.addEventListener('change', () => {
          opacityInput.disabled = !autoFadeCheckbox.checked;
          opacityNumber.disabled = !autoFadeCheckbox.checked;
          opacityGroup.classList.toggle('disabled', !autoFadeCheckbox.checked);
        });
      }
    }
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
    if (partId === 'cinematics') {
      const rangeInput = htmlElement.querySelector('input[name="cinematicPanelDuration"]');
      const rangeGroup = rangeInput?.closest('.form-group');
      const numberInput = rangeGroup?.querySelector('.range-value');
      if (rangeInput && numberInput) {
        rangeInput.addEventListener('input', (e) => {
          numberInput.value = e.target.value;
        });
        numberInput.addEventListener('input', (e) => {
          const val = Math.max(100, Math.min(5000, parseInt(e.target.value) || 300));
          rangeInput.value = val;
          rangeInput.dispatchEvent(new Event('input', { bubbles: true }));
        });
      }
    }
    const formatParts = ['hud', 'timekeeper', 'miniCal', 'bigcal', 'chat', 'stopwatch'];
    if (formatParts.includes(partId)) {
      const presetSelects = htmlElement.querySelectorAll('select[name*="Preset"]');
      presetSelects.forEach((select) => {
        const locationId = select.dataset.location;
        const role = select.dataset.role;
        const customInput = htmlElement.querySelector(`input[name="displayFormats.${locationId}.${role}Custom"]`);
        const previewSpan = htmlElement.querySelector(`.format-preview[data-location="${locationId}"][data-role="${role}"]`);
        select.addEventListener('change', (event) => {
          if (event.target.value === 'custom') {
            customInput?.classList.remove('hidden');
            if (customInput && !customInput.value.trim()) {
              const savedFormats = game.settings.get(MODULE.ID, SETTINGS.DISPLAY_FORMATS);
              const defaultFormat = LOCATION_DEFAULTS[locationId] || 'dateLong';
              let currentFormat = savedFormats[locationId]?.[role] || defaultFormat;
              if (currentFormat === 'calendarDefault') {
                const locationFormatKeys = {
                  hudDate: 'dateLong',
                  hudTime: 'time24',
                  timekeeperDate: 'dateLong',
                  timekeeperTime: 'time24',
                  microCalHeader: 'approxDateTime',
                  miniCalHeader: 'dateLong',
                  miniCalTime: 'time24',
                  bigCalHeader: 'dateFull',
                  chatTimestamp: 'dateLong'
                };
                const formatKey = locationFormatKeys[locationId] || 'dateLong';
                const calendar = CalendarManager.getActiveCalendar();
                currentFormat = calendar?.dateFormats?.[formatKey] || formatKey;
              }
              currentFormat = DEFAULT_FORMAT_PRESETS[currentFormat] || currentFormat;
              customInput.value = currentFormat;
            }
            customInput?.focus();
          } else {
            customInput?.classList.add('hidden');
            if (customInput) customInput.value = '';
          }
          this.#updateFormatPreview(previewSpan, locationId, event.target.value, customInput?.value);
        });
        this.#updateFormatPreview(previewSpan, locationId, select.value, customInput?.value);
      });
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
    if (preset === 'off') {
      previewSpan.textContent = '';
      previewSpan.classList.remove('error');
      return;
    }
    let formatStr;
    if (preset === 'custom') {
      formatStr = customValue?.trim();
      if (!formatStr) {
        previewSpan.textContent = '';
        previewSpan.classList.remove('error');
        return;
      }
    } else if (preset === 'calendarDefault') {
      const locationFormatKeys = {
        hudDate: 'dateLong',
        hudTime: 'time24',
        timekeeperDate: 'dateLong',
        timekeeperTime: 'time24',
        microCalHeader: 'approxDateTime',
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
    const calendar = CalendarManager.getActiveCalendar();
    const rawComponents = calendar?.timeToComponents?.(game.time.worldTime);
    const yearZero = calendar?.years?.yearZero ?? 0;
    const components = rawComponents ? { ...rawComponents, year: rawComponents.year + yearZero } : { year: 1492, month: 0, dayOfMonth: 15, hour: 14, minute: 30, second: 0 };
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
