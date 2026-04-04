/**
 * MiniCal - All-in-one calendar widget with timekeeping.
 * @module Applications/MiniCal
 * @author Tyler
 */

import { CalendarManager, CalendarRegistry, getEquivalentDates } from '../../calendar/_module.mjs';
import { HOOKS, MODULE, REPLACEABLE_ELEMENTS, SETTINGS, SOCKET_TYPES, TEMPLATES, WIDGET_POINTS } from '../../constants.mjs';
import {
  NoteManager,
  clearDisplayPropsCache,
  dayOfWeek,
  enrichNoteForDisplay,
  extractNoteMatchData,
  getAllPresets,
  isRecurringMatch,
  resolveNoteDisplayProps,
  summarizeConditionTree,
  topologicalSortNotes
} from '../../notes/_module.mjs';
import { TimeClock, getTimeIncrements } from '../../time/_module.mjs';
import {
  CalendariaSocket,
  attachWidgetListeners,
  buildOpenAppsMenuItem,
  buildWeatherLookup,
  buildWeatherPillData,
  canChangeDateTime,
  canChangeWeather,
  canViewMiniCal,
  checkStickyZones,
  cleanupSnapIndicator,
  closeMoonPicker,
  encodeHtmlAttribute,
  enrichSeasonData,
  escapeText,
  finalizeDrag,
  format,
  formatForLocation,
  generateDayTooltip,
  getAllMoonPhases,
  getCalendarNotes,
  getCurrentViewedDate,
  getDayWeather,
  getEquivalentDateTooltip,
  getFestivalNoteForDay,
  getFirstMoonPhase,
  getLeadingDays,
  getRestorePosition,
  getSelectedMoon,
  getSidebarBuffer,
  getVisibleNotes,
  hasFogRevealedMonthInDirection,
  hasMoonIconMarkers,
  hasWidgetsForPoint,
  isCombatBlocked,
  isFogEnabled,
  isMonthFullyFogged,
  isRevealed,
  isToday,
  localize,
  pinToZone,
  previewSnippet,
  registerForZoneUpdates,
  renderCycleIndicator,
  renderEraIndicator,
  renderMoonIcons,
  renderReplacementOrOriginal,
  renderSeasonIndicator,
  renderWeatherIndicator,
  renderWidgetsForPoint,
  restorePinnedState,
  setDateTo,
  setSelectedMoon,
  setupDayContextMenu,
  showMoonPicker,
  stripSecrets,
  unpinFromZone,
  unregisterFromZoneUpdates,
  usesDomParenting,
  warnShowToAll
} from '../../utils/_module.mjs';
import { WeatherManager, getPresetAlias } from '../../weather/_module.mjs';
import { BigCal, NoteViewer, SecondaryCalendar, SettingsPanel, WeatherPickerApp } from '../_module.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * MiniCal widget combining mini month view with time controls.
 */
export class MiniCal extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {object|null} Currently selected date */
  _selectedDate = null;

  /** @type {object|null} Currently viewed month/year */
  _viewedDate = null;

  /** @type {number|null} Hook ID for visual tick */
  #timeHookId = null;

  /** @type {number|null} Hook ID for world time updated */
  #worldTimeHookId = null;

  /** @type {Array} Hook references for cleanup */
  #hooks = [];

  /** @type {boolean} Sticky time controls */
  #stickyTimeControls = false;

  /** @type {boolean} Sticky sidebar */
  #stickySidebar = false;

  /** @type {boolean} Sticky position (immovable) */
  #stickyPosition = false;

  /** @type {number|null} Timeout ID for hiding controls */
  #hideTimeout = null;

  /** @type {number|null} Timeout ID for hiding sidebar */
  #sidebarTimeout = null;

  /** @type {number|null} Last rendered day (for change detection) */
  #lastDay = null;

  /** @type {boolean} Sidebar visibility state (survives re-render) */
  #sidebarVisible = false;

  /** @type {boolean} Time controls visibility state (survives re-render) */
  #controlsVisible = false;

  /** @type {boolean} Notes panel visibility state */
  #notesPanelVisible = false;

  /** @type {object|null} Currently active sticky zone during drag */
  #activeSnapZone = null;

  /** @type {string|null} ID of zone HUD is currently snapped to */
  #snappedZoneId = null;

  /** @type {Function|null} Debounced resize handler */
  #resizeHandler = null;

  /** @type {boolean} Whether sidebar is locked due to notes panel */
  #sidebarLocked = false;

  /** @type {string|null} Notes panel category filter */
  #noteFilterPreset = null;

  /** @type {string|null} Notes panel visibility filter */
  #noteFilterVisibility = null;

  /** @type {string|null} Notes panel display style filter */
  #noteFilterDisplayStyle = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-mini-cal',
    classes: ['calendaria', 'mini-cal'],
    position: { width: 'auto', height: 'auto' },
    window: { frame: false, positioned: true },
    actions: {
      navigate: MiniCal._onNavigate,
      today: MiniCal._onToday,
      selectDay: MiniCal._onSelectDay,
      navigateToMonth: MiniCal._onNavigateToMonth,
      addNote: MiniCal._onAddNote,
      openFull: MiniCal._onOpenFull,
      toggle: MiniCal._onToggleClock,
      forward: MiniCal._onForward,
      reverse: MiniCal._onReverse,
      customDec2: MiniCal.#onCustomDec2,
      customDec1: MiniCal.#onCustomDec1,
      customInc1: MiniCal.#onCustomInc1,
      customInc2: MiniCal.#onCustomInc2,
      setCurrentDate: MiniCal._onSetCurrentDate,
      viewNotes: MiniCal._onViewNotes,
      closeNotesPanel: MiniCal._onCloseNotesPanel,
      openNote: MiniCal._onOpenNote,
      editNote: MiniCal._onEditNote,
      toSunrise: MiniCal._onToSunrise,
      toMidday: MiniCal._onToMidday,
      toSunset: MiniCal._onToSunset,
      toMidnight: MiniCal._onToMidnight,
      openWeatherPicker: MiniCal._onOpenWeatherPicker,
      openChronicle: MiniCal._onOpenChronicle,
      openSettings: MiniCal._onOpenSettings,
      showMoons: MiniCal._onShowMoons,
      closeMoonsPanel: MiniCal._onCloseMoonsPanel,
      clearNoteFilters: MiniCal._onClearNoteFilters,
      openSecondaryCalendar: MiniCal._onOpenSecondaryCalendar,
      openNoteViewer: MiniCal._onOpenNoteViewer
    }
  };

  /** @override */
  static PARTS = { main: { template: TEMPLATES.MINI_CAL } };

  /**
   * Get the active calendar.
   * @returns {object} The active calendar instance
   */
  get calendar() {
    return CalendarManager.getActiveCalendar();
  }

  /**
   * Get the date being viewed (month/year).
   * @returns {object} The viewed date with year, month, day
   */
  get viewedDate() {
    if (this._viewedDate) return this._viewedDate;
    return getCurrentViewedDate(this.calendar);
  }

  /**
   * Set the date being viewed.
   * @param {object} date - The date to view
   */
  set viewedDate(date) {
    this._viewedDate = date;
  }

  /**
   * Navigate the calendar view to a specific date and select it.
   * @param {object} date - Date to select {year, month, dayOfMonth}
   */
  selectDate(date) {
    this._viewedDate = { year: date.year, month: date.month };
    this._selectedDate = { year: date.year, month: date.month, dayOfMonth: date.dayOfMonth ?? 0 };
  }

  /** @override */
  async _prepareContext(options) {
    clearDisplayPropsCache();
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    const viewedDate = this.viewedDate;
    context.isGM = game.user.isGM;
    context.showChronicleButton = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_MINI_CAL_BUTTON);
    context.canChangeDateTime = canChangeDateTime();
    context.canChangeWeather = canChangeWeather();
    context.running = TimeClock.running;
    context.clockDisabled = TimeClock.disabled;
    context.clockLocked = TimeClock.locked || TimeClock.disabled;
    const components = game.time.components;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const rawTime = calendar ? formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: components.dayOfMonth ?? 0 }, 'miniCalTime') : TimeClock.getFormattedTime();
    context.currentTime = hasMoonIconMarkers(rawTime) ? renderMoonIcons(rawTime) : rawTime;
    context.currentDate = TimeClock.getFormattedDate();
    const isMonthless = calendar?.isMonthless ?? false;
    const stickyIncrement = (game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_STICKY_STATES) || {}).increment;
    const appSettings = TimeClock.getAppSettings('mini-calendar');
    if (stickyIncrement && stickyIncrement !== appSettings.incrementKey) {
      TimeClock.setAppIncrement('mini-calendar', stickyIncrement);
      TimeClock.setIncrement(stickyIncrement);
    }
    context.increments = Object.entries(getTimeIncrements())
      .filter(([key]) => !isMonthless || key !== 'month')
      .map(([key, seconds]) => ({ key, label: this.#formatIncrementLabel(key), seconds, selected: key === appSettings.incrementKey }));
    const customJumps = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_TIME_JUMPS) || {};
    const currentJumps = customJumps[appSettings.incrementKey] || {};
    context.customJumps = { dec2: currentJumps.dec2 ?? null, dec1: currentJumps.dec1 ?? null, inc1: currentJumps.inc1 ?? null, inc2: currentJumps.inc2 ?? null };
    const allNotes = getCalendarNotes();
    const visibleNotes = topologicalSortNotes(getVisibleNotes(allNotes));
    if (calendar) context.calendarData = this._generateMiniCalData(calendar, viewedDate, visibleNotes);
    if (!game.user.isGM && isFogEnabled() && game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_NAV_MODE) === 'skip' && calendar) {
      context.fogNavDisablePrev = !hasFogRevealedMonthInDirection(viewedDate.year, viewedDate.month, -1, calendar);
      context.fogNavDisableNext = !hasFogRevealedMonthInDirection(viewedDate.year, viewedDate.month, 1, calendar);
    }
    context.disableSetCurrentDate = true;
    if (game.user.isGM && this._selectedDate) {
      const today = getCurrentViewedDate(calendar);
      context.disableSetCurrentDate = this._selectedDate.year === today.year && this._selectedDate.month === today.month && this._selectedDate.dayOfMonth === today.dayOfMonth;
    }
    context.sidebarVisible = this.#sidebarVisible || this.#sidebarLocked || this.#stickySidebar;
    context.controlsVisible = this.#controlsVisible || this.#stickyTimeControls;
    context.controlsLocked = this.#stickyTimeControls;
    context.notesPanelVisible = this.#notesPanelVisible;
    context.sidebarLocked = this.#sidebarLocked || this.#stickySidebar;
    context.stickyTimeControls = this.#stickyTimeControls;
    context.stickySidebar = this.#stickySidebar;
    context.stickyPosition = this.#stickyPosition;
    context.hasAnyStickyMode = this.#stickyTimeControls || this.#stickySidebar || this.#stickyPosition;
    if (this.#notesPanelVisible && this._selectedDate) {
      const selectedFogged = isFogEnabled() && !isRevealed(this._selectedDate.year, this._selectedDate.month, this._selectedDate.dayOfMonth);
      const allPanelNotes = selectedFogged ? [] : this._getSelectedDateNotes(visibleNotes);
      context.selectedDateNotes = allPanelNotes;
      context.selectedDateLabel = this._formatSelectedDate();
      context.noteFilterPreset = this.#noteFilterPreset;
      context.hasActiveFilters = !!this.#noteFilterPreset;
      const { year, month, dayOfMonth } = this._selectedDate;
      const targetDate = { year, month, dayOfMonth };
      const unfilteredNotes = visibleNotes.filter((page) => isRecurringMatch(extractNoteMatchData(page), targetDate));
      const activePresetIds = new Set(unfilteredNotes.flatMap((p) => p.system.categories || []));
      const hasFestivals = unfilteredNotes.some((p) => resolveNoteDisplayProps(p).isFestival);
      context.noteFilterPresets = [
        { id: '__festival__', label: localize('CALENDARIA.Common.Festivals'), selected: this.#noteFilterPreset === '__festival__', hasNotes: hasFestivals },
        ...getAllPresets().map((c) => ({ id: c.id, label: c.label, selected: c.id === this.#noteFilterPreset, hasNotes: activePresetIds.has(c.id) }))
      ];
    }
    context.hasMultipleCalendars = CalendarRegistry.getAll().size > 1;
    context.disableViewNotes = true;
    const checkDate = this._selectedDate || getCurrentViewedDate(calendar);
    if (checkDate) {
      const checkFogged = isFogEnabled() && !isRevealed(checkDate.year, checkDate.month, checkDate.dayOfMonth);
      const { count, hasFestival } = checkFogged ? { count: 0, hasFestival: false } : this._getNotesOnDay(visibleNotes, checkDate.year, checkDate.month, checkDate.dayOfMonth);
      context.disableViewNotes = count === 0 && !hasFestival;
    }
    context.weather = this._getWeatherContext();
    context.showTime = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_TIME);
    context.showWeather = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_WEATHER);
    context.showSeason = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_SEASON);
    context.showEra = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_ERA);
    context.showCycles = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_CYCLES);
    context.showMoonPhases = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_MOON_PHASES);
    context.weatherDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_WEATHER_DISPLAY_MODE);
    context.seasonDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SEASON_DISPLAY_MODE);
    context.eraDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_ERA_DISPLAY_MODE);
    context.cyclesDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_CYCLES_DISPLAY_MODE);
    const compact = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_COMPACT_MODE);
    context.compact = compact;
    if (compact) {
      context.weatherDisplayMode = 'icon';
      context.seasonDisplayMode = 'icon';
      context.eraDisplayMode = 'icon';
      context.cyclesDisplayMode = 'icon';
    }
    if (calendar && calendar.cyclesArray?.length && context.showCycles) {
      const yearZeroOffset = calendar.years?.yearZero ?? 0;
      const viewedComponents = { year: viewedDate.year - yearZeroOffset, month: viewedDate.month, dayOfMonth: viewedDate.dayOfMonth ?? 0, hour: 12, minute: 0, second: 0 };
      const cycleResult = calendar.getCycleValues(viewedComponents);
      context.cycleText = cycleResult.text;
      context.cycleValues = cycleResult.values;
      context.cycleData = cycleResult;
    }
    context.widgets = this.#prepareWidgetContext(context);
    return context;
  }

  /**
   * Prepare widget context for template rendering.
   * @param {object} context - The template context
   * @returns {object} Widget context
   */
  #prepareWidgetContext(context) {
    const widgets = {};
    widgets.sidebar = renderWidgetsForPoint(WIDGET_POINTS.MINICAL_SIDEBAR, 'minical');
    const weatherObj = context.showWeather && context.weather ? { ...context.weather, icon: this.#normalizeWeatherIcon(context.weather.icon) } : null;
    widgets.weatherIndicator = renderReplacementOrOriginal(
      REPLACEABLE_ELEMENTS.WEATHER_INDICATOR,
      renderWeatherIndicator({
        weather: weatherObj,
        displayMode: context.weatherDisplayMode,
        canInteract: context.canChangeWeather,
        showBlock: context.showWeather && context.canChangeWeather
      }),
      'minical'
    );
    const season = context.showSeason ? this.#normalizeSeasonData(context.calendarData?.currentSeason) : null;
    widgets.seasonIndicator = renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.SEASON_INDICATOR, renderSeasonIndicator({ season, displayMode: context.seasonDisplayMode }), 'minical');
    const era = context.showEra ? this.#normalizeEraData(context.calendarData?.currentEra) : null;
    widgets.eraIndicator = renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.ERA_INDICATOR, renderEraIndicator({ era, displayMode: context.eraDisplayMode }), 'minical');
    const cycleData = context.showCycles ? context.cycleData : null;
    widgets.cycleIndicator = renderReplacementOrOriginal(
      REPLACEABLE_ELEMENTS.CYCLE_INDICATOR,
      renderCycleIndicator({ cycleData, displayMode: context.cyclesDisplayMode, cycleText: context.cycleText }),
      'minical'
    );
    widgets.indicators = renderWidgetsForPoint(WIDGET_POINTS.HUD_INDICATORS, 'minical');
    widgets.hasIndicators = hasWidgetsForPoint(WIDGET_POINTS.HUD_INDICATORS);
    return widgets;
  }

  /**
   * Normalize weather icon to include font-awesome class prefix.
   * @param {string} icon - Raw icon class
   * @returns {string} Normalized icon class
   */
  #normalizeWeatherIcon(icon) {
    if (!icon) return 'fas fa-cloud';
    if (icon.includes('fa-solid') || icon.includes('fa-regular') || icon.includes('fa-light') || icon.includes('fas ') || icon.includes('far ')) return icon;
    return `fas ${icon}`;
  }

  /**
   * Normalize season data for shared indicator function.
   * @param {object|null} season - Raw season data
   * @returns {object|null} Normalized season with localized name
   */
  #normalizeSeasonData(season) {
    if (!season) return null;
    return { name: localize(season.name), icon: season.icon || 'fas fa-sun', color: season.color || '#888' };
  }

  /**
   * Normalize era data for shared indicator function.
   * @param {object|null} era - Raw era data
   * @returns {object|null} Normalized era with localized name and abbreviation
   */
  #normalizeEraData(era) {
    if (!era) return null;
    return { name: localize(era.name), abbreviation: localize(era.abbreviation || era.name) };
  }

  /**
   * Get weather context for template.
   * @returns {object|null} Weather context or null if no weather set
   */
  _getWeatherContext() {
    const zone = WeatherManager.getActiveZone(null, game.scenes?.active);
    const zoneId = zone?.id;
    const weather = WeatherManager.getCurrentWeather(zoneId);
    if (!weather) return null;
    const calendarId = this.calendar?.metadata?.id;
    const alias = getPresetAlias(weather.id, calendarId, zoneId);
    const label = alias || localize(weather.label);
    const windSpeed = weather.wind?.speed ?? 0;
    const windDirection = weather.wind?.direction;
    const precipType = weather.precipitation?.type ?? null;
    const temp = WeatherManager.formatTemperature(WeatherManager.getTemperature());
    const windKph = weather.wind?.kph ?? null;
    const tooltipHtml = WeatherManager.buildWeatherTooltip({
      label,
      description: weather.description ? localize(weather.description) : null,
      temp,
      windSpeed,
      windKph,
      windDirection,
      precipType,
      precipIntensity: weather.precipitation?.intensity
    });
    return { id: weather.id, label, icon: weather.icon, color: weather.color, temperature: temp, tooltipHtml, windSpeed, windKph, windDirection, precipType };
  }

  /**
   * Generate simplified calendar data for the mini month grid.
   * @param {object} calendar - The calendar
   * @param {object} date - The viewed date
   * @param {object[]} visibleNotes - Pre-fetched visible notes
   * @returns {object} Calendar grid data
   */
  _generateMiniCalData(calendar, date, visibleNotes) {
    if (calendar.isMonthless) return this._generateWeekViewData(calendar, date, visibleNotes);
    const { year, month } = date;
    const monthData = calendar.monthsArray[month];
    if (!monthData) return null;
    const yearZero = calendar.years?.yearZero ?? 0;
    const internalYear = year - yearZero;
    const daysInMonth = calendar.getDaysInMonth(month, internalYear);
    const daysInWeek = calendar.daysInWeek;
    const weeks = [];
    let currentWeek = [];
    const showMoons = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_MOON_PHASES) && calendar.moonsArray.length;
    const hasFixedStart = monthData?.startingWeekday != null;
    const startDayOfWeek = hasFixedStart ? monthData.startingWeekday : dayOfWeek({ year, month, dayOfMonth: 0 });
    if (startDayOfWeek > 0) {
      const prevDays = getLeadingDays(calendar, year, month, startDayOfWeek);
      for (const pd of prevDays) currentWeek.push({ ...pd, isToday: isToday(pd.year, pd.month, pd.dayOfMonth, calendar) });
    }
    const showWeatherIcons = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_WEATHER);
    let weatherLookup = null;
    if (showWeatherIcons) weatherLookup = buildWeatherLookup();
    const intercalaryDays = [];
    const fogEnabled = isFogEnabled();
    for (let dayOfMonth = 0; dayOfMonth < daysInMonth; dayOfMonth++) {
      const displayDay = dayOfMonth + 1;
      const isFogged = fogEnabled && !isRevealed(year, month, dayOfMonth);
      const noteInfo = isFogged ? { count: 0, color: null, enriched: [], hasFestival: false, festivalColor: null } : this._getNotesOnDay(visibleNotes, year, month, dayOfMonth);
      const noteColor = noteInfo.color;
      const noteTextColor = noteColor ? MiniCal._getContrastTextColor(noteColor) : null;
      const festivalDay = isFogged ? null : calendar.findFestivalDay({ year: internalYear, month, dayOfMonth });
      const fi = isFogged ? null : getFestivalNoteForDay(visibleNotes, year, month, dayOfMonth);
      const moonData = showMoons && !isFogged ? getFirstMoonPhase(calendar, year, month, dayOfMonth) : null;
      const wd = weatherLookup && !isFogged ? getDayWeather(year, month, dayOfMonth, weatherLookup, weatherLookup.lookup) : null;
      const isIntercalary = fi ? !fi.countsForWeekday : festivalDay?.countsForWeekday === false;
      const festivalInfo = fi ? { name: fi.name, description: fi.description, color: fi.color, position: fi.position } : null;

      const dayTooltip = isFogged ? '' : generateDayTooltip(calendar, year, month, dayOfMonth, festivalInfo, wd, noteInfo.enriched);
      if (isIntercalary) {
        intercalaryDays.push({
          day: displayDay,
          dayOfMonth,
          year,
          month,
          isFogged,
          isToday: isToday(year, month, dayOfMonth, calendar),
          isSelected: this._isSelected(year, month, dayOfMonth),
          hasNotes: noteInfo.count > 0,
          noteCount: noteInfo.count,
          noteColor,
          noteTextColor,
          hasFestivalNote: noteInfo.hasFestival,
          festivalNoteColor: noteInfo.festivalColor,
          isFestival: !!fi?.showVisuals,
          festivalName: fi?.showVisuals ? fi.name : '',
          festivalColor: fi?.showVisuals ? fi.color : '',
          festivalDescription: fi?.description || '',
          dayTooltip,
          moonIcon: moonData?.icon ?? null,
          moonPhase: moonData?.tooltip ?? null,
          moonColor: moonData?.color ?? null,
          isIntercalary: true,
          weatherIcon: wd?.icon ?? null,
          weatherColor: wd?.color ?? null,
          weatherTooltipHtml: buildWeatherPillData(wd).weatherTooltipHtml,
          isForecast: wd?.isForecast ?? false
        });
      } else {
        currentWeek.push({
          day: displayDay,
          dayOfMonth,
          year,
          month,
          isFogged,
          isToday: isToday(year, month, dayOfMonth, calendar),
          isSelected: this._isSelected(year, month, dayOfMonth),
          hasNotes: noteInfo.count > 0,
          noteCount: noteInfo.count,
          noteColor,
          noteTextColor,
          hasFestivalNote: noteInfo.hasFestival,
          festivalNoteColor: noteInfo.festivalColor,
          isFestival: !!fi?.showVisuals,
          festivalName: fi?.showVisuals ? fi.name : '',
          festivalColor: fi?.showVisuals ? fi.color : '',
          festivalDescription: fi?.description || '',
          dayTooltip,
          moonIcon: moonData?.icon ?? null,
          moonPhase: moonData?.tooltip ?? null,
          moonColor: moonData?.color ?? null,
          weatherIcon: wd?.icon ?? null,
          weatherColor: wd?.color ?? null,
          weatherTooltipHtml: buildWeatherPillData(wd).weatherTooltipHtml,
          isForecast: wd?.isForecast ?? false
        });
        if (currentWeek.length === daysInWeek) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }
    }
    const lastRegularWeekLength = currentWeek.length;
    if (currentWeek.length > 0) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    if (intercalaryDays.length > 0) {
      weeks.push({ isIntercalaryRow: true, days: intercalaryDays });
      currentWeek = [];
    }
    const lastRegularWeek = weeks.filter((w) => !w.isIntercalaryRow).pop();
    const needsNextMonth = intercalaryDays.length > 0 || (lastRegularWeek && lastRegularWeek.length < daysInWeek);
    if (needsNextMonth) {
      const totalMonths = calendar.monthsArray.length ?? 12;
      const startPosition = intercalaryDays.length > 0 ? lastRegularWeekLength : lastRegularWeek?.length || 0;
      let remainingSlots = daysInWeek - startPosition;
      let checkMonth = month;
      let checkYear = year;
      let dayInMonth = 1;
      checkMonth = checkMonth === totalMonths - 1 ? 0 : checkMonth + 1;
      if (checkMonth === 0) checkYear++;
      if (intercalaryDays.length > 0 && startPosition > 0) for (let i = 0; i < startPosition; i++) currentWeek.push({ empty: true });
      while (remainingSlots > 0) {
        const checkMonthDays = calendar.getDaysInMonth(checkMonth, checkYear - yearZero);
        const festivalDay = calendar.findFestivalDay({ year: checkYear - yearZero, month: checkMonth, dayOfMonth: dayInMonth - 1 });
        const isIntercalary = festivalDay?.countsForWeekday === false;
        if (!isIntercalary) {
          currentWeek.push({
            day: dayInMonth,
            dayOfMonth: dayInMonth - 1,
            year: checkYear,
            month: checkMonth,
            isFromOtherMonth: true,
            isToday: isToday(checkYear, checkMonth, dayInMonth - 1, calendar)
          });
          remainingSlots--;
        }
        dayInMonth++;
        if (dayInMonth > checkMonthDays && remainingSlots > 0) {
          checkMonth = checkMonth === totalMonths - 1 ? 0 : checkMonth + 1;
          if (checkMonth === 0) checkYear++;
          dayInMonth = 1;
        }
      }
      if (intercalaryDays.length > 0) weeks.push(currentWeek);
      else if (lastRegularWeek) lastRegularWeek.push(...currentWeek);
    }
    const viewedComponents = { month, dayOfMonth: Math.floor(daysInMonth / 2) };
    const currentSeason = enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();
    const monthWeekdays = calendar.getWeekdaysForMonth?.(month) ?? calendar.weekdaysArray ?? [];
    const showSelectedInHeader = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_HEADER_SHOW_SELECTED);
    const headerDate = showSelectedInHeader && this._selectedDate ? this._selectedDate : { year, month, dayOfMonth: date.dayOfMonth ?? 0 };
    const compact = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_COMPACT_MODE);
    const headerComponents = {
      year: headerDate.year,
      month: headerDate.month,
      dayOfMonth: headerDate.dayOfMonth ?? 0,
      hour: game.time.components.hour,
      minute: game.time.components.minute,
      second: game.time.components.second
    };
    const headerLocation = compact ? 'microCalHeader' : 'miniCalHeader';
    const rawHeader = formatForLocation(calendar, headerComponents, headerLocation);
    const formattedHeader = hasMoonIconMarkers(rawHeader) ? renderMoonIcons(rawHeader) : rawHeader;
    const weekdays = monthWeekdays.map((wd) => ({ name: wd.abbreviation ? localize(wd.abbreviation) : localize(wd.name).substring(0, 2), isRestDay: wd.isRestDay || false }));
    const headerEquivalentTooltip = getEquivalentDateTooltip(headerDate.year, headerDate.month, headerDate.dayOfMonth ?? 0);
    const eqCalendars = game.settings.get(MODULE.ID, SETTINGS.EQUIVALENT_DATE_CALENDARS);
    let equivalentDates = [];
    if (eqCalendars.size) {
      const activeId = CalendarRegistry.getActiveId();
      equivalentDates = getEquivalentDates({ year: headerDate.year, month: headerDate.month, dayOfMonth: headerDate.dayOfMonth ?? 0 }, activeId, [...eqCalendars]).map((eq) => ({
        label: eq.formatted,
        calendarName: eq.calendarName,
        calendarId: eq.calendarId
      }));
    }
    return {
      year,
      month,
      monthName: localize(monthData.name),
      yearDisplay: String(year),
      formattedHeader,
      headerEquivalentTooltip,
      equivalentDates,
      currentSeason,
      currentEra,
      weeks,
      daysInWeek,
      weekdays
    };
  }

  /**
   * Generate week-based view data for monthless calendars.
   * @param {object} calendar - The calendar
   * @param {object} date - The viewed date (year, day for monthless)
   * @param {object[]} visibleNotes - Pre-fetched visible notes
   * @returns {object} Week view grid data
   */
  _generateWeekViewData(calendar, date, visibleNotes) {
    const { year } = date;
    const viewedDayOfMonth = date.dayOfMonth ?? 0;
    const daysInWeek = calendar.daysInWeek;
    const yearZero = calendar.years?.yearZero ?? 0;
    const daysInYear = calendar.getDaysInYear(year - yearZero);
    const weekNumber = Math.floor(viewedDayOfMonth / daysInWeek);
    const totalWeeks = Math.ceil(daysInYear / daysInWeek);
    const fogEnabled = isFogEnabled();
    const weeks = [];
    for (let weekOffset = -1; weekOffset <= 1; weekOffset++) {
      const targetWeek = weekNumber + weekOffset;
      const weekStartDay = targetWeek * daysInWeek + 1;
      const currentWeek = [];
      for (let i = 0; i < daysInWeek; i++) {
        let dayNum = weekStartDay + i;
        let dayYear = year;
        const targetYearDays = calendar.getDaysInYear(dayYear - yearZero);
        if (dayNum > targetYearDays) {
          dayNum -= targetYearDays;
          dayYear++;
        } else if (dayNum < 1) {
          const prevYearDays = calendar.getDaysInYear(dayYear - yearZero - 1);
          dayNum += prevYearDays;
          dayYear--;
        }
        const dayOfMonth = dayNum - 1;
        const dayIsFogged = fogEnabled && !isRevealed(dayYear, 0, dayOfMonth);
        const noteInfo = dayIsFogged ? { count: 0, color: null, enriched: [], hasFestival: false, festivalColor: null } : this._getNotesOnDay(visibleNotes, dayYear, 0, dayOfMonth);
        const noteColor = noteInfo.color;
        const noteTextColor = noteColor ? MiniCal._getContrastTextColor(noteColor) : null;
        const festivalDay = dayIsFogged ? null : calendar.findFestivalDay({ year: dayYear - yearZero, month: 0, dayOfMonth });
        const moonData = !dayIsFogged ? getFirstMoonPhase(calendar, dayYear, 0, dayOfMonth) : null;
        const isIntercalary = festivalDay?.countsForWeekday === false;
        const festivalNameStr = festivalDay ? localize(festivalDay.name) : null;
        const festivalInfo = festivalDay ? { name: festivalNameStr, description: festivalDay.description || '', color: festivalDay.color || '' } : null;
        const dayData = {
          day: dayNum,
          dayOfMonth,
          year: dayYear,
          month: 0,
          isFogged: dayIsFogged,
          isToday: isToday(dayYear, 0, dayOfMonth, calendar),
          isSelected: this._isSelected(dayYear, 0, dayOfMonth),
          hasNotes: noteInfo.count > 0,
          noteCount: noteInfo.count,
          noteColor,
          noteTextColor,
          hasFestivalNote: noteInfo.hasFestival,
          festivalNoteColor: noteInfo.festivalColor,
          isFestival: !dayIsFogged && !!festivalDay,
          festivalName: dayIsFogged ? null : festivalNameStr,
          festivalColor: dayIsFogged ? '' : festivalDay?.color || '',
          festivalDescription: dayIsFogged ? '' : festivalDay?.description || '',
          dayTooltip: dayIsFogged ? '' : generateDayTooltip(calendar, dayYear, 0, dayOfMonth, festivalInfo),
          moonIcon: moonData?.icon ?? null,
          moonPhase: moonData?.tooltip ?? null,
          moonColor: moonData?.color ?? null,
          isFromOtherWeek: weekOffset !== 0
        };
        if (isIntercalary) dayData.isIntercalary = true;
        currentWeek.push(dayData);
      }
      weeks.push(currentWeek);
    }
    const viewedComponents = { month: 0, dayOfMonth: viewedDayOfMonth };
    const currentSeason = enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();
    const weekdayData = calendar.weekdaysArray ?? [];
    const displayWeek = weekNumber + 1;
    const yearDisplay = String(year);
    const formattedHeader = `${localize('CALENDARIA.Common.Week')} ${displayWeek}, ${yearDisplay}`;
    const weekdays = weekdayData.map((wd) => ({ name: wd.abbreviation ? localize(wd.abbreviation) : localize(wd.name).substring(0, 2), isRestDay: wd.isRestDay || false }));
    return { year, month: 0, monthName: '', yearDisplay, formattedHeader, currentSeason, currentEra, weeks, daysInWeek, weekdays, isMonthless: true, weekNumber: displayWeek, totalWeeks };
  }

  /**
   * Check if a date is selected.
   * @param {number} year - Display year
   * @param {number} month - Month
   * @param {number} dayOfMonth - Day (0-indexed)
   * @returns {boolean} True if the date matches the selected date
   */
  _isSelected(year, month, dayOfMonth) {
    if (!this._selectedDate) return false;
    return this._selectedDate.year === year && this._selectedDate.month === month && this._selectedDate.dayOfMonth === dayOfMonth;
  }

  /**
   * Return a contrast text color (black or white) for a given hex background.
   * @param {string} hex - Hex color string (e.g. "#ff0000")
   * @returns {string} "#000000" or "#ffffff"
   */
  static _getContrastTextColor(hex) {
    const c = foundry.utils.Color.from(hex);
    const [r, g, b] = [c.r, c.g, c.b];
    const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  /**
   * Get note info for a specific day (count and first note's color).
   * @param {object[]} notes - Array of visible note pages
   * @param {number} year - Year
   * @param {number} month - Month index
   * @param {number} dayOfMonth - Day of month index
   * @returns {{ count: number, color: string|null, hasFestival: boolean, festivalColor: string|null, festivalNote: object|null, enriched: object[] }} Note display info
   */
  _getNotesOnDay(notes, year, month, dayOfMonth) {
    const targetDate = { year, month, dayOfMonth };
    const matching = notes.filter((page) => isRecurringMatch(extractNoteMatchData(page), targetDate));
    let hasFestival = false;
    let festivalColor = null;
    let festivalNote = null;
    for (const page of matching) {
      const props = resolveNoteDisplayProps(page);
      if (props.isFestival && !hasFestival) {
        hasFestival = true;
        festivalColor = props.color;
        festivalNote = page;
        break;
      }
    }
    const nonFestival = matching.filter((p) => !resolveNoteDisplayProps(p).isFestival);
    const enriched = matching.map((p) => enrichNoteForDisplay(p));
    return { count: nonFestival.length, color: nonFestival[0]?.system?.color || null, hasFestival, festivalColor, festivalNote, enriched };
  }

  /**
   * Get notes for the selected date, sorted by time (all-day first, then by start time).
   * @param {object[]} visibleNotes - Pre-fetched visible notes
   * @returns {object[]} Array of note objects for the selected date
   */
  _getSelectedDateNotes(visibleNotes) {
    if (!this._selectedDate) return [];
    const { year, month, dayOfMonth } = this._selectedDate;
    const targetDate = { year, month, dayOfMonth };
    const notes = visibleNotes.filter((page) => isRecurringMatch(extractNoteMatchData(page), targetDate));
    let filtered = notes;
    if (this.#noteFilterPreset === '__festival__') filtered = filtered.filter((p) => resolveNoteDisplayProps(p).isFestival);
    else if (this.#noteFilterPreset) filtered = filtered.filter((p) => (p.system.categories || []).includes(this.#noteFilterPreset));
    if (this.#noteFilterVisibility) filtered = filtered.filter((p) => resolveNoteDisplayProps(p).visibility === this.#noteFilterVisibility);
    if (this.#noteFilterDisplayStyle) filtered = filtered.filter((p) => resolveNoteDisplayProps(p).displayStyle === this.#noteFilterDisplayStyle);
    return filtered
      .map((page) => {
        const enriched = enrichNoteForDisplay(page);
        const start = page.system.startDate;
        const end = page.system.endDate;
        const isAllDay = enriched.allDay;
        let timeLabel = '';
        if (isAllDay) {
          timeLabel = localize('CALENDARIA.Common.AllDay');
        } else {
          const startTime = this._formatTime(start.hour, start.minute);
          const endTime = this._formatTime(end?.hour, end?.minute);
          timeLabel = `${startTime} - ${endTime}`;
        }
        const authorName = enriched.author || localize('CALENDARIA.Common.Unknown');
        let repeatLabel = MiniCal._getRepeatLabel(page.system.repeat);
        if (!repeatLabel && page.system.conditionTree) {
          const calendar = CalendarManager.getActiveCalendar();
          repeatLabel = summarizeConditionTree(page.system.conditionTree, calendar) || null;
        }
        const tooltipHtml = MiniCal._buildNoteTooltip(page, enriched, timeLabel, repeatLabel);
        return {
          ...enriched,
          isImageIcon: enriched.icon.includes('/'),
          timeLabel,
          repeatLabel,
          startHour: start.hour ?? 0,
          startMinute: start.minute ?? 0,
          authorLabel: authorName,
          tooltipHtml
        };
      })
      .sort((a, b) => {
        if (a.isFestival !== b.isFestival) return a.isFestival ? -1 : 1;
        if (a.allDay && !b.allDay) return -1;
        if (!a.allDay && b.allDay) return 1;
        if (a.startHour !== b.startHour) return a.startHour - b.startHour;
        return a.startMinute - b.startMinute;
      });
  }

  /**
   * Format the selected date as a label.
   * @returns {string} Formatted date string (e.g., "January 15, 1492")
   */
  _formatSelectedDate() {
    if (!this._selectedDate) return '';
    const { year, month, dayOfMonth } = this._selectedDate;
    const calendar = this.calendar;
    const monthData = calendar.monthsArray[month];
    const monthName = monthData ? localize(monthData.name) : '';
    const yearDisplay = String(year);
    return `${monthName} ${dayOfMonth + 1}, ${yearDisplay}`;
  }

  /**
   * Format hour and minute as time string using display settings.
   * @param {number} hour - Hour (0-23)
   * @param {number} minute - Minute (0-59)
   * @returns {string} Formatted time string respecting user's time format preference
   */
  _formatTime(hour, minute) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) {
      const h = (hour ?? 0).toString().padStart(2, '0');
      const m = (minute ?? 0).toString().padStart(2, '0');
      return `${h}:${m}`;
    }
    const components = { year: 0, month: 0, dayOfMonth: 0, hour: hour ?? 0, minute: minute ?? 0, second: 0 };
    return formatForLocation(calendar, components, 'miniCalTime');
  }

  /**
   * Get a human-readable label for a repeat type.
   * @param {string} repeat - Repeat type from note data
   * @returns {string|null} Localized label or null for non-repeating
   */
  static _getRepeatLabel(repeat) {
    if (!repeat || repeat === 'never') return null;
    const key = `CALENDARIA.Notes.Repeat.${repeat.charAt(0).toUpperCase()}${repeat.slice(1)}`;
    return localize(key);
  }

  /**
   * Build an HTML tooltip summarizing a note's properties.
   * @param {object} page - The note page document
   * @param {object} enriched - Enriched note display data
   * @param {string} timeLabel - Formatted time label
   * @param {string|null} repeatLabel - Repeat frequency label
   * @returns {string} HTML tooltip content
   */
  static _buildNoteTooltip(page, enriched, timeLabel, repeatLabel) {
    const esc = escapeText;
    const lines = [];
    lines.push(`<strong style="color: ${enriched.color}">${esc(enriched.name)}</strong>`);
    lines.push(`<span>${esc(timeLabel)}</span>`);
    if (enriched.visibility !== 'visible') {
      const visKey = enriched.visibility === 'hidden' ? 'CALENDARIA.Common.Hidden' : 'CALENDARIA.Note.Visibility.Secret';
      const visIcon = enriched.visibility === 'hidden' ? 'fa-eye-slash' : 'fa-lock';
      lines.push(`<span><i class="fas ${visIcon}"></i> ${esc(localize(visKey))}</span>`);
    }
    const categories = enriched.categories || [];
    if (categories.length) {
      const presets = getAllPresets();
      const labels = categories.map((id) => presets.find((p) => p.id === id)?.label).filter(Boolean);
      if (labels.length) lines.push(`<span><i class="fas fa-tag"></i> ${esc(labels.join(', '))}</span>`);
    }
    const conditionTree = page.system.conditionTree;
    if (conditionTree) {
      const calendar = CalendarManager.getActiveCalendar();
      const summary = summarizeConditionTree(conditionTree, calendar);
      if (summary) lines.push(`<span><i class="fas fa-repeat"></i> ${esc(summary)}</span>`);
    } else if (repeatLabel) {
      lines.push(`<span><i class="fas fa-repeat"></i> ${esc(repeatLabel)}</span>`);
    }
    const content = stripSecrets(page.text?.content?.trim());
    if (content) {
      const snippet = previewSnippet(content, 120);
      if (snippet) {
        lines.push(`<hr style="margin: 0.25rem 0; border-color: var(--calendaria-border-light)"><span style="font-style: italic">${snippet}</span>`);
      }
    }
    const rawHtml = `<div class="calendaria"><div class="day-tooltip">${lines.join('<br>')}</div></div>`;
    return encodeHtmlAttribute(rawHtml);
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const compact = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_COMPACT_MODE);
    this.element.classList.toggle('micro', compact);
    if (options.isFirstRender) this.#restorePosition();
    else this.#updateDockedPosition();
    this.#enableDragging();
    const incrementSelect = this.element.querySelector('[data-action="increment"]');
    incrementSelect?.addEventListener('change', (event) => {
      TimeClock.setAppIncrement('mini-calendar', event.target.value);
      TimeClock.setIncrement(event.target.value);
      game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_STICKY_STATES, {
        timeControls: this.#stickyTimeControls,
        sidebar: this.#stickySidebar,
        position: this.#stickyPosition,
        increment: event.target.value
      });
      this.render();
    });
    if (incrementSelect && canChangeDateTime()) {
      incrementSelect.addEventListener(
        'wheel',
        (event) => {
          event.preventDefault();
          const calendar = game.time?.calendar;
          const isMonthless = calendar?.isMonthless ?? false;
          const appSettings = TimeClock.getAppSettings('mini-calendar');
          const incrementKeys = Object.keys(getTimeIncrements()).filter((key) => !isMonthless || key !== 'month');
          const currentIndex = incrementKeys.indexOf(appSettings.incrementKey);
          if (currentIndex === -1) return;
          const direction = event.deltaY < 0 ? -1 : 1;
          const newIndex = Math.max(0, Math.min(incrementKeys.length - 1, currentIndex + direction));
          if (newIndex === currentIndex) return;
          TimeClock.setAppIncrement('mini-calendar', incrementKeys[newIndex]);
          TimeClock.setIncrement(incrementKeys[newIndex]);
          game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_STICKY_STATES, {
            timeControls: this.#stickyTimeControls,
            sidebar: this.#stickySidebar,
            position: this.#stickyPosition,
            increment: incrementKeys[newIndex]
          });
          this.render();
        },
        { passive: false }
      );
    }
    if (!this.#timeHookId) this.#timeHookId = Hooks.on(HOOKS.VISUAL_TICK, this.#onVisualTick.bind(this));
    if (!this.#worldTimeHookId) this.#worldTimeHookId = Hooks.on(HOOKS.WORLD_TIME_UPDATED, this.#onWorldTimeUpdated.bind(this));
    if (!this.#hooks.some((h) => h.name === HOOKS.CLOCK_START_STOP)) this.#hooks.push({ name: HOOKS.CLOCK_START_STOP, id: Hooks.on(HOOKS.CLOCK_START_STOP, this.#onClockStateChange.bind(this)) });
    const container = this.element.querySelector('.minical-container');
    const sidebar = this.element.querySelector('.minical-sidebar');
    container?.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, a, input, select, .note-badge')) return;
      e.preventDefault();
      this.close();
      BigCal.show();
    });
    container?.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#context-menu, .minical-day')) return;
      e.preventDefault();
      document.getElementById('context-menu')?.remove();
      const menu = new foundry.applications.ux.ContextMenu.implementation(this.element, '.minical-container', this.#getContextMenuItems(), {
        fixed: true,
        jQuery: false,
        onOpen: () => document.getElementById('context-menu')?.classList.add('calendaria')
      });
      menu._onActivate(e);
    });
    if (container && sidebar) {
      container.addEventListener('mouseenter', () => {
        clearTimeout(this.#sidebarTimeout);
        this.#sidebarVisible = true;
        sidebar.classList.add('visible');
      });
      container.addEventListener('mouseleave', () => {
        if (this.#sidebarLocked || this.#stickySidebar) return;
        const delay = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_CONTROLS_DELAY) * 1000;
        this.#sidebarTimeout = setTimeout(() => {
          this.#sidebarVisible = false;
          sidebar.classList.remove('visible');
        }, delay);
      });
    }
    const filterSelects = this.element.querySelectorAll('.notes-filter-select');
    for (const select of filterSelects) {
      select.addEventListener('change', (e) => {
        const filterType = e.target.dataset.filterType;
        const value = e.target.value || null;
        if (filterType === 'preset') this.#noteFilterPreset = value;
        else if (filterType === 'visibility') this.#noteFilterVisibility = value;
        else if (filterType === 'displayStyle') this.#noteFilterDisplayStyle = value;
        this.render();
      });
    }
    const timeDisplay = this.element.querySelector('.minical-time-display');
    const timeControls = this.element.querySelector('.minical-time-controls');
    if (timeControls) {
      const showControls = () => {
        clearTimeout(this.#hideTimeout);
        this.#controlsVisible = true;
        timeControls.classList.add('visible');
      };
      const hideControls = () => {
        if (this.#stickyTimeControls) return;
        const delay = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_CONTROLS_DELAY) * 1000;
        this.#hideTimeout = setTimeout(() => {
          this.#controlsVisible = false;
          timeControls.classList.remove('visible');
        }, delay);
      };
      if (timeDisplay) {
        timeDisplay.addEventListener('mouseenter', showControls);
        timeDisplay.addEventListener('mouseleave', hideControls);
      }
      timeControls.addEventListener('mouseenter', showControls);
      timeControls.addEventListener('mouseleave', hideControls);
      if (compact) {
        const grid = this.element.querySelector('.minical-grid');
        if (grid) {
          grid.addEventListener('mouseenter', showControls);
          grid.addEventListener('mouseleave', hideControls);
        }
      }
    }
    attachWidgetListeners(this.element);
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.#restoreStickyStates();
    this.#resizeHandler = foundry.utils.debounce(() => requestAnimationFrame(() => this.#onViewportResize()), 200);
    window.addEventListener('resize', this.#resizeHandler);
    const c = game.time.components;
    this.#lastDay = `${c.year}-${c.month}-${c.dayOfMonth}`;
    setupDayContextMenu(this.element, '.minical-day:not(.empty)', this.calendar, {
      onSetDate: () => {
        this._selectedDate = null;
        this.render();
      },
      onCreateNote: () => this.render()
    });
    this._debouncedRender = foundry.utils.debounce(() => this.render(), 100);
    const debouncedRender = this._debouncedRender;
    this.#hooks.push({
      name: 'updateJournalEntryPage',
      id: Hooks.on('updateJournalEntryPage', (page) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });
    this.#hooks.push({
      name: 'updateJournalEntry',
      id: Hooks.on('updateJournalEntry', (journal, changes) => {
        if (changes.ownership && journal.getFlag?.(MODULE.ID, 'isCalendarNote')) debouncedRender();
      })
    });
    this.#hooks.push({
      name: 'createJournalEntry',
      id: Hooks.on('createJournalEntry', (journal) => {
        if (journal.getFlag?.(MODULE.ID, 'isCalendarNote')) debouncedRender();
      })
    });
    this.#hooks.push({
      name: 'createJournalEntryPage',
      id: Hooks.on('createJournalEntryPage', (page) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });
    this.#hooks.push({
      name: 'deleteJournalEntry',
      id: Hooks.on('deleteJournalEntry', (journal) => {
        if (journal.getFlag?.(MODULE.ID, 'isCalendarNote') || journal.pages.some((p) => p.type === 'calendaria.calendarnote')) debouncedRender();
      })
    });
    this.#hooks.push({ name: HOOKS.WEATHER_CHANGE, id: Hooks.on(HOOKS.WEATHER_CHANGE, () => debouncedRender()) });
    this.#hooks.push({ name: HOOKS.WIDGETS_REFRESH, id: Hooks.on(HOOKS.WIDGETS_REFRESH, () => this.render()) });
    this.#hooks.push({ name: HOOKS.DISPLAY_FORMATS_CHANGED, id: Hooks.on(HOOKS.DISPLAY_FORMATS_CHANGED, () => this.render()) });
    new foundry.applications.ux.ContextMenu.implementation(
      this.element,
      '.minical-container',
      [{ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => MiniCal.hide() }],
      {
        fixed: true,
        jQuery: false,
        onOpen: () => document.getElementById('context-menu')?.classList.add('calendaria')
      }
    );
  }

  /** @override */
  async close(options = {}) {
    if (!options.combat && !game.user.isGM && game.settings.get(MODULE.ID, SETTINGS.FORCE_MINI_CAL)) {
      ui.notifications.warn('CALENDARIA.Common.ForcedDisplayWarning', { localize: true });
      return;
    }
    return super.close(options);
  }

  /** @override */
  async _onClose(options) {
    if (this.#resizeHandler) {
      window.removeEventListener('resize', this.#resizeHandler);
      this.#resizeHandler = null;
    }
    if (this.#timeHookId) {
      Hooks.off(HOOKS.VISUAL_TICK, this.#timeHookId);
      this.#timeHookId = null;
    }
    if (this.#worldTimeHookId) {
      Hooks.off(HOOKS.WORLD_TIME_UPDATED, this.#worldTimeHookId);
      this.#worldTimeHookId = null;
    }
    this.#hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
    this.#hooks = [];
    this.#closeMoonsTooltip();
    unregisterFromZoneUpdates(this);
    unpinFromZone(this.element);
    cleanupSnapIndicator();
    await super._onClose(options);
  }

  /**
   * Override setPosition to prevent position updates when pinned to a DOM-parented zone.
   * @override
   */
  setPosition(position) {
    if (this.#snappedZoneId && usesDomParenting(this.#snappedZoneId)) {
      if (position?.width || position?.height) {
        const limited = {};
        if (position.width) limited.width = position.width;
        if (position.height) limited.height = position.height;
        return super.setPosition(limited);
      }
      return;
    }
    return super.setPosition(position);
  }

  /**
   * Restore saved position from settings.
   */
  #restorePosition() {
    const savedPos = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_POSITION);
    if (savedPos && Number.isFinite(savedPos.top) && Number.isFinite(savedPos.left)) {
      this.#snappedZoneId = savedPos.zoneId || null;
      if (this.#snappedZoneId && restorePinnedState(this.element, this.#snappedZoneId)) {
        registerForZoneUpdates(this, this.#snappedZoneId);
        return;
      }
      if (this.#snappedZoneId) {
        const rect = this.element.getBoundingClientRect();
        const zonePos = getRestorePosition(this.#snappedZoneId, rect.width, rect.height);
        if (zonePos) {
          this.setPosition({ left: zonePos.left, top: zonePos.top });
          registerForZoneUpdates(this, this.#snappedZoneId);
          return;
        }
      }
      this.setPosition({ left: savedPos.left, top: savedPos.top });
    } else {
      const rect = this.element.getBoundingClientRect();
      const players = document.getElementById('players');
      const playersTop = players?.getBoundingClientRect().top ?? window.innerHeight - 100;
      const left = 16;
      const top = playersTop - rect.height - 16;
      this.setPosition({ left, top });
    }
    this.#clampToViewport();
  }

  /**
   * Clamp position to viewport bounds.
   */
  #clampToViewport() {
    const rect = this.element.getBoundingClientRect();
    let rightBuffer = getSidebarBuffer();
    const sidebarEl = this.element.querySelector('.minical-sidebar');
    if (sidebarEl) rightBuffer += sidebarEl.offsetWidth;
    let { left, top } = this.position;
    left = Math.max(0, Math.min(left, window.innerWidth - rect.width - rightBuffer));
    top = Math.max(0, Math.min(top, window.innerHeight - rect.height));
    this.setPosition({ left, top });
  }

  /**
   * Handle viewport resize — restore from saved position then clamp.
   */
  #onViewportResize() {
    if (!this.rendered || !this.element) return;
    if (this.#snappedZoneId && usesDomParenting(this.#snappedZoneId)) return;
    if (this.#snappedZoneId) {
      const rect = this.element.getBoundingClientRect();
      const zonePos = getRestorePosition(this.#snappedZoneId, rect.width, rect.height);
      if (zonePos) this.setPosition({ left: zonePos.left, top: zonePos.top });
    } else {
      const savedPos = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_POSITION);
      if (savedPos && Number.isFinite(savedPos.left) && Number.isFinite(savedPos.top)) {
        this.setPosition({ left: savedPos.left, top: savedPos.top });
      }
    }
    this.#clampToViewport();
  }

  /**
   * Update position when docked to a sticky zone.
   */
  #updateDockedPosition() {
    if (!this.#snappedZoneId) return;
    if (usesDomParenting(this.#snappedZoneId)) {
      requestAnimationFrame(() => {
        if (this.rendered && this.#snappedZoneId && usesDomParenting(this.#snappedZoneId)) pinToZone(this.element, this.#snappedZoneId);
      });
      return;
    }
    const rect = this.element.getBoundingClientRect();
    const zonePos = getRestorePosition(this.#snappedZoneId, rect.width, rect.height);
    if (zonePos) this.setPosition({ left: zonePos.left, top: zonePos.top });
  }

  /**
   * Restore sticky states from settings.
   */
  #restoreStickyStates() {
    const states = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_STICKY_STATES);
    if (!states) return;
    this.#stickyTimeControls = states.timeControls ?? false;
    this.#stickySidebar = states.sidebar ?? false;
    this.#stickyPosition = states.position ?? false;
    if (!this.element) return;
    const timeControls = this.element.querySelector('.minical-time-controls');
    const sidebar = this.element.querySelector('.minical-sidebar');
    if (this.#stickyTimeControls) {
      timeControls?.classList.add('visible');
      this.#controlsVisible = true;
    } else {
      timeControls?.classList.remove('visible');
      this.#controlsVisible = false;
    }
    if (this.#stickySidebar) {
      sidebar?.classList.add('visible');
      this.#sidebarVisible = true;
    } else {
      sidebar?.classList.remove('visible');
      this.#sidebarVisible = false;
    }
  }

  /**
   * Build context menu items for MiniCal.
   * @returns {object[]} Array of context menu item definitions
   */
  #getContextMenuItems() {
    const items = [];
    items.push({
      name: 'CALENDARIA.MiniCal.ContextMenu.Settings',
      icon: '<i class="fas fa-gear"></i>',
      callback: () => {
        const panel = new SettingsPanel();
        panel.render(true).then(() => {
          requestAnimationFrame(() => panel.changeTab('miniCal', 'primary'));
        });
      }
    });
    if (game.user.isGM) {
      const forceMiniCal = game.settings.get(MODULE.ID, SETTINGS.FORCE_MINI_CAL);
      items.push({
        name: forceMiniCal ? 'CALENDARIA.Common.HideFromAll' : 'CALENDARIA.Common.ShowToAll',
        icon: forceMiniCal ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>',
        callback: async () => {
          const newValue = !forceMiniCal;
          if (newValue) warnShowToAll('viewMiniCal', game.i18n.localize('CALENDARIA.Permissions.ViewMiniCal'));
          await game.settings.set(MODULE.ID, SETTINGS.FORCE_MINI_CAL, newValue);
          CalendariaSocket.emit(SOCKET_TYPES.MINI_CAL_VISIBILITY, { visible: newValue });
        }
      });
    }
    const compact = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_COMPACT_MODE);
    items.push({
      name: compact ? 'CALENDARIA.MiniCal.ContextMenu.NormalMode' : 'CALENDARIA.MiniCal.ContextMenu.CompactMode',
      icon: '<i class="fas fa-compress"></i>',
      callback: async () => {
        await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_COMPACT_MODE, !compact);
      }
    });
    items.push({ name: 'CALENDARIA.Common.ResetPosition', icon: '<i class="fas fa-arrows-to-dot"></i>', callback: () => MiniCal.resetPosition() });
    items.push({
      name: this.#stickyPosition ? 'CALENDARIA.Common.UnlockPosition' : 'CALENDARIA.Common.LockPosition',
      icon: this.#stickyPosition ? '<i class="fas fa-lock-open"></i>' : '<i class="fas fa-lock"></i>',
      callback: () => this._toggleStickyPosition()
    });
    items.push(buildOpenAppsMenuItem());
    items.push({ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => MiniCal.hide() });
    return items;
  }

  /**
   * Toggle sticky position state.
   */
  _toggleStickyPosition() {
    this.#stickyPosition = !this.#stickyPosition;
    game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_STICKY_STATES, {
      timeControls: this.#stickyTimeControls,
      sidebar: this.#stickySidebar,
      position: this.#stickyPosition,
      increment: TimeClock.getAppSettings('mini-calendar').incrementKey
    });
  }

  /**
   * Enable dragging on the entire application, excluding interactive elements.
   */
  #enableDragging() {
    const dragHandle = this.element;
    const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, dragHandle, false);
    let dragStartX = 0;
    let dragStartY = 0;
    let elementStartLeft = 0;
    let elementStartTop = 0;
    let previousZoneId = null;
    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
      if (this.#stickyPosition) return;
      if (event.target.closest('button, a, input, select, [data-action], .time-toggle')) return;
      previousZoneId = this.#snappedZoneId;
      this.#snappedZoneId = null;
      if (previousZoneId && usesDomParenting(previousZoneId)) {
        const preserved = unpinFromZone(this.element);
        if (preserved) {
          elementStartLeft = preserved.left;
          elementStartTop = preserved.top;
        }
      } else {
        const rect = this.element.getBoundingClientRect();
        elementStartLeft = rect.left;
        elementStartTop = rect.top;
      }
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      originalMouseDown(event);
    };
    drag._onDragMouseMove = (event) => {
      event.preventDefault();
      const now = Date.now();
      if (!drag._moveTime) drag._moveTime = 0;
      if (now - drag._moveTime < 1000 / 60) return;
      drag._moveTime = now;
      const deltaX = event.clientX - dragStartX;
      const deltaY = event.clientY - dragStartY;
      const rect = this.element.getBoundingClientRect();
      let rightBuffer = getSidebarBuffer();
      const sidebarEl = this.element.querySelector('.minical-sidebar');
      if (sidebarEl) rightBuffer += sidebarEl.offsetWidth;
      let newLeft = elementStartLeft + deltaX;
      let newTop = elementStartTop + deltaY;
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width - rightBuffer));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
      this.setPosition({ left: newLeft, top: newTop });
      this.#activeSnapZone = checkStickyZones(dragHandle, newLeft, newTop, rect.width, rect.height);
    };
    drag._onDragMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener(...drag.handlers.dragMove);
      window.removeEventListener(...drag.handlers.dragUp);
      const rect = this.element.getBoundingClientRect();
      const result = finalizeDrag(dragHandle, this.#activeSnapZone, this, rect.width, rect.height, previousZoneId);
      this.#snappedZoneId = result.zoneId;
      registerForZoneUpdates(this, this.#snappedZoneId);
      this.#activeSnapZone = null;
      previousZoneId = null;
      const finalRect = this.element.getBoundingClientRect();
      const left = Number.isFinite(finalRect.left) ? finalRect.left : 16;
      const top = Number.isFinite(finalRect.top) ? finalRect.top : 100;
      await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_POSITION, { left, top, zoneId: this.#snappedZoneId });
    };
  }

  /**
   * Get predicted time components for UI display.
   * @returns {object} Time components
   */
  #getPredictedComponents() {
    if (TimeClock.running && game.time?.calendar) return game.time?.calendar.timeToComponents(TimeClock.predictedWorldTime);
    return game.time.components;
  }

  /**
   * Handle visual tick — update time/date text every 1s.
   */
  #onVisualTick() {
    if (!this.rendered) return;
    const components = this.#getPredictedComponents();
    const predictedDay = `${components.year}-${components.month}-${components.dayOfMonth}`;
    if (predictedDay !== this.#lastDay) {
      this.#lastDay = predictedDay;
      this._debouncedRender();
      return;
    }
    const timeEl = this.element.querySelector('.time-value');
    const dateEl = this.element.querySelector('.date-value');
    const calendar = this.calendar;
    if (timeEl && calendar) {
      const yearZero = calendar.years?.yearZero ?? 0;
      const timeFormatted = formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: components.dayOfMonth ?? 0 }, 'miniCalTime');
      if (hasMoonIconMarkers(timeFormatted)) timeEl.innerHTML = renderMoonIcons(timeFormatted);
      else timeEl.textContent = timeFormatted;
    }
    if (dateEl) {
      const yearZero = calendar?.years?.yearZero ?? 0;
      const monthData = calendar?.monthsArray?.[components.month];
      const monthNameRaw = monthData?.name ?? `Month ${components.month + 1}`;
      const monthName = localize(monthNameRaw);
      const day = (components.dayOfMonth ?? 0) + 1;
      const year = components.year + yearZero;
      dateEl.textContent = `${day} ${monthName}, ${year}`;
    }
  }

  /**
   * Handle real world time update — day-change detection and display sync.
   */
  #onWorldTimeUpdated() {
    if (!this.rendered) return;
    const components = game.time.components;
    const currentDay = `${components.year}-${components.month}-${components.dayOfMonth}`;
    if (currentDay !== this.#lastDay) {
      this.#lastDay = currentDay;
      this._debouncedRender();
    }
    this.#onVisualTick();
  }

  /**
   * Handle clock state changes (from other sources like TimeKeeper).
   */
  #onClockStateChange() {
    if (!this.rendered) return;
    MiniCal.#updateClockIcon(this.element);
  }

  /**
   * Navigate to the next or previous month (or week for monthless calendars).
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onNavigate(_event, target) {
    const direction = target.dataset.direction === 'next' ? 1 : -1;
    const current = this.viewedDate;
    const calendar = this.calendar;
    if (calendar.isMonthless) {
      const daysInWeek = calendar.daysInWeek;
      const yearZero = calendar.years?.yearZero ?? 0;
      const daysInYear = calendar.getDaysInYear(current.year - yearZero);
      let newDayOfMonth = (current.dayOfMonth ?? 0) + direction * daysInWeek;
      let newYear = current.year;
      if (newDayOfMonth >= daysInYear) {
        newDayOfMonth -= daysInYear;
        newYear++;
      } else if (newDayOfMonth < 0) {
        const prevYearDays = calendar.getDaysInYear(newYear - yearZero - 1);
        newDayOfMonth += prevYearDays;
        newYear--;
      }
      this.viewedDate = { year: newYear, month: 0, dayOfMonth: newDayOfMonth };
      this.render();
      return;
    }
    let newMonth = current.month + direction;
    let newYear = current.year;
    const yearZero = calendar.years?.yearZero ?? 0;
    if (newMonth >= calendar.monthsArray.length) {
      newMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      newMonth = calendar.monthsArray.length - 1;
      newYear--;
    }
    let attempts = 0;
    const maxAttempts = calendar.monthsArray.length;
    while (calendar.getDaysInMonth(newMonth, newYear - yearZero) === 0 && attempts < maxAttempts) {
      newMonth += direction;
      if (newMonth >= calendar.monthsArray.length) {
        newMonth = 0;
        newYear++;
      } else if (newMonth < 0) {
        newMonth = calendar.monthsArray.length - 1;
        newYear--;
      }
      attempts++;
    }
    if (!game.user.isGM && isFogEnabled() && game.settings.get(MODULE.ID, SETTINGS.FOG_OF_WAR_NAV_MODE) === 'skip') {
      let fogAttempts = 0;
      const maxFogAttempts = calendar.monthsArray.length * 10;
      while (isMonthFullyFogged(newYear, newMonth) && fogAttempts < maxFogAttempts) {
        newMonth += direction;
        if (newMonth >= calendar.monthsArray.length) {
          newMonth = 0;
          newYear++;
        } else if (newMonth < 0) {
          newMonth = calendar.monthsArray.length - 1;
          newYear--;
        }
        fogAttempts++;
      }
      if (isMonthFullyFogged(newYear, newMonth)) return;
    }
    this.viewedDate = { year: newYear, month: newMonth, dayOfMonth: 0 };
    this.render();
  }

  /**
   * Navigate to a specific month (from clicking other-month day).
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onNavigateToMonth(_event, target) {
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);
    this.viewedDate = { year, month, dayOfMonth: 0 };
    this.render();
  }

  /**
   * Reset view to today's date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onToday(_event, _target) {
    this._viewedDate = null;
    this._selectedDate = null;
    this.render();
  }

  /**
   * Select a day on the calendar.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onSelectDay(_event, target) {
    const dayOfMonth = parseInt(target.dataset.day);
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);
    if (this._selectedDate?.year === year && this._selectedDate?.month === month && this._selectedDate?.dayOfMonth === dayOfMonth) this._selectedDate = null;
    else this._selectedDate = { year, month, dayOfMonth };
    if (game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_AUTO_OPEN_NOTES)) {
      if (this._selectedDate) {
        const allNotes = getCalendarNotes();
        const visibleNotes = getVisibleNotes(allNotes);
        const { count } = this._getNotesOnDay(visibleNotes, year, month, dayOfMonth);
        if (count > 0) {
          this.#notesPanelVisible = true;
          this.#sidebarLocked = true;
          this.#sidebarVisible = true;
        } else {
          this.#notesPanelVisible = false;
        }
      } else {
        this.#notesPanelVisible = false;
      }
    }
    this.render();
  }

  /**
   * Add a new note on the selected or current date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onAddNote(_event, _target) {
    let dayOfMonth, month, year;
    if (this._selectedDate) {
      ({ dayOfMonth, month, year } = this._selectedDate);
    } else {
      const today = game.time.components;
      const calendar = this.calendar;
      const yearZero = calendar?.years?.yearZero ?? 0;
      year = today.year + yearZero;
      month = today.month;
      dayOfMonth = today.dayOfMonth ?? 0;
    }
    await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: parseInt(year), month: parseInt(month), dayOfMonth: parseInt(dayOfMonth), hour: 12, minute: 0 },
        endDate: { year: parseInt(year), month: parseInt(month), dayOfMonth: parseInt(dayOfMonth), hour: 13, minute: 0 }
      },
      source: 'ui'
    });
  }

  /**
   * Open the BigCal application.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onOpenFull(_event, _target) {
    await this.close();
    BigCal.show();
  }

  /**
   * Toggle the clock running state. Shift-click toggles lock.
   * @param {PointerEvent} event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onToggleClock(event, _target) {
    if (event.shiftKey) {
      TimeClock.toggleLock();
      MiniCal.#updateClockIcon(this.element);
      return;
    }
    TimeClock.toggle();
    MiniCal.#updateClockIcon(this.element);
  }

  /**
   * Update the clock toggle button icon/tooltip to reflect current state.
   * @param {HTMLElement} el - The application element
   */
  static #updateClockIcon(el) {
    const toggles = el.querySelectorAll('.time-toggle');
    if (!toggles.length) return;
    const locked = TimeClock.locked || TimeClock.disabled;
    const running = TimeClock.running;
    const tooltip = TimeClock.disabled
      ? localize('CALENDARIA.TimeClock.Disabled')
      : locked
        ? localize('CALENDARIA.TimeClock.Locked')
        : running
          ? localize('CALENDARIA.TimeKeeper.Stop')
          : localize('CALENDARIA.TimeKeeper.Start');
    for (const timeToggle of toggles) {
      timeToggle.classList.toggle('active', running);
      timeToggle.classList.toggle('clock-locked', locked);
      const icon = timeToggle.querySelector('i');
      if (icon) {
        icon.classList.remove('fa-play', 'fa-pause', 'fa-lock');
        if (locked) icon.classList.add('fa-lock');
        else if (running) icon.classList.add('fa-pause');
        else icon.classList.add('fa-play');
      }
      timeToggle.dataset.tooltip = tooltip;
    }
  }

  /**
   * Advance time forward.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onForward(_event, _target) {
    TimeClock.forwardFor('mini-calendar');
  }

  /**
   * Reverse time.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onReverse(_event, _target) {
    TimeClock.reverseFor('mini-calendar');
  }

  /** Handle custom decrement 2 (larger). */
  static #onCustomDec2() {
    MiniCal.#applyCustomJump('dec2');
  }

  /** Handle custom decrement 1 (smaller). */
  static #onCustomDec1() {
    MiniCal.#applyCustomJump('dec1');
  }

  /** Handle custom increment 1 (smaller). */
  static #onCustomInc1() {
    MiniCal.#applyCustomJump('inc1');
  }

  /** Handle custom increment 2 (larger). */
  static #onCustomInc2() {
    MiniCal.#applyCustomJump('inc2');
  }

  /**
   * Apply a custom time jump based on the current increment.
   * @param {string} jumpKey - The jump key (dec2, dec1, inc1, inc2)
   */
  static #applyCustomJump(jumpKey) {
    if (!canChangeDateTime()) return;
    const appSettings = TimeClock.getAppSettings('mini-calendar');
    const incrementKey = appSettings.incrementKey || 'minute';
    const customJumps = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_TIME_JUMPS) || {};
    const jumps = customJumps[incrementKey] || {};
    const amount = jumps[jumpKey];
    if (!amount) return;
    const increments = getTimeIncrements();
    const secondsPerUnit = increments[incrementKey] || 60;
    const totalSeconds = amount * secondsPerUnit;
    if (!game.user.isGM) {
      CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: totalSeconds });
      return;
    }
    game.time.advance(totalSeconds);
  }

  /**
   * Set the current world date to the selected date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onSetCurrentDate(_event, target) {
    if (target.disabled || !this._selectedDate) return;
    const confirmEnabled = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_CONFIRM_SET_DATE);
    if (confirmEnabled) {
      const dateStr = this._formatSelectedDate();
      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: localize('CALENDARIA.MiniCal.SetCurrentDate') },
        content: `<p>${format('CALENDARIA.MiniCal.SetCurrentDateConfirm', { date: dateStr })}</p>`,
        rejectClose: false,
        modal: true
      });
      if (!confirmed) return;
    }
    const { year, month, dayOfMonth } = this._selectedDate;
    await setDateTo(year, month, dayOfMonth, this.calendar);
    this._selectedDate = null;
    this.render();
  }

  /**
   * Open the notes panel for the selected date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onViewNotes(_event, target) {
    if (target.disabled) return;
    if (!this._selectedDate) {
      const today = getCurrentViewedDate(this.calendar);
      if (today) this._selectedDate = { year: today.year, month: today.month, dayOfMonth: today.dayOfMonth };
    }
    if (!this._selectedDate) return;
    this.#notesPanelVisible = true;
    this.#sidebarLocked = true;
    this.#sidebarVisible = true;
    this.render();
  }

  /**
   * Close the notes panel.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onCloseNotesPanel(_event, _target) {
    this.#notesPanelVisible = false;
    this.#sidebarLocked = false;
    this.#noteFilterPreset = null;
    this.#noteFilterVisibility = null;
    this.#noteFilterDisplayStyle = null;
    this.render();
  }

  /**
   * Clear all notes panel filters.
   */
  static _onClearNoteFilters() {
    this.#noteFilterPreset = null;
    this.#noteFilterVisibility = null;
    this.#noteFilterDisplayStyle = null;
    this.render();
  }

  /**
   * Open a secondary calendar viewer. Shows a picker if no calendarId on the target.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onOpenSecondaryCalendar(_event, target) {
    const calendarId = target.dataset.calendarId;
    if (calendarId) {
      SecondaryCalendar.open(calendarId);
      return;
    }
    const activeId = CalendarRegistry.getActiveId();
    const calendars = [...CalendarRegistry.getAll().entries()].filter(([id]) => id !== activeId).map(([id, cal]) => ({ id, name: cal.name ? localize(cal.name) : id }));
    if (!calendars.length) return;
    if (calendars.length === 1) {
      SecondaryCalendar.open(calendars[0].id);
      return;
    }
    const options = calendars.map((c) => `<option value="${c.id}">${c.name}</option>`).join('');
    const content = `<form><div class="form-group"><label>${localize('CALENDARIA.Common.Calendar')}</label><select name="calendarId">${options}</select></div></form>`;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: localize('CALENDARIA.MiniCal.SecondaryCalendar') },
      content,
      ok: { label: localize('CALENDARIA.Common.Open'), callback: (_event, button) => button.form.elements.calendarId.value }
    });
    if (result) SecondaryCalendar.open(result);
  }

  /**
   * Open a note in view mode.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onOpenNote(_event, target) {
    const pageId = target.dataset.pageId;
    const journalId = target.dataset.journalId;
    const journal = game.journal.get(journalId);
    const page = journal?.pages.get(pageId);
    if (page) page.sheet.render(true, { mode: 'view' });
  }

  /**
   * Open a note in edit mode.
   * @param {PointerEvent} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onEditNote(event, target) {
    event.stopPropagation();
    const pageId = target.dataset.pageId;
    const journalId = target.dataset.journalId;
    const journal = game.journal.get(journalId);
    const page = journal?.pages.get(pageId);
    if (page) page.sheet.render(true, { mode: 'edit' });
  }

  /**
   * Advance time to sunrise.
   */
  static async _onToSunrise() {
    const calendar = this.calendar;
    if (!calendar?.sunrise) return;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const targetHour = calendar.sunrise(undefined, zone);
    if (targetHour === null) return;
    await this.#advanceToHour(targetHour);
  }

  /**
   * Advance time to solar midday (midpoint between sunrise and sunset).
   */
  static async _onToMidday() {
    const calendar = this.calendar;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const targetHour = calendar?.solarMidday?.(undefined, zone) ?? (game.time.calendar?.days?.hoursPerDay ?? 24) / 2;
    await this.#advanceToHour(targetHour);
  }

  /**
   * Advance time to sunset.
   */
  static async _onToSunset() {
    const calendar = this.calendar;
    if (!calendar?.sunset) return;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    const targetHour = calendar.sunset(undefined, zone);
    if (targetHour === null) return;
    await this.#advanceToHour(targetHour);
  }

  /**
   * Advance time to solar midnight (midpoint of night period).
   */
  static async _onToMidnight() {
    const calendar = this.calendar;
    const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
    if (calendar?.solarMidnight) {
      const targetHour = calendar.solarMidnight(undefined, zone);
      const hoursPerDay = game.time.calendar?.days?.hoursPerDay ?? 24;
      if (targetHour >= hoursPerDay) await this.#advanceToHour(targetHour - hoursPerDay, true);
      else await this.#advanceToHour(targetHour);
    } else {
      await this.#advanceToHour(0, true);
    }
  }

  /**
   * Advance time to a specific hour of day.
   * @param {number} targetHour - Target hour (fractional, e.g. 6.5 = 6:30)
   * @param {boolean} [nextDay] - If true, always advance to next day
   */
  async #advanceToHour(targetHour, nextDay = false) {
    if (!canChangeDateTime()) return;
    const cal = game.time.calendar;
    if (!cal) return;
    const days = cal.days ?? {};
    const secondsPerMinute = days.secondsPerMinute ?? 60;
    const minutesPerHour = days.minutesPerHour ?? 60;
    const hoursPerDay = days.hoursPerDay ?? 24;
    const secondsPerHour = secondsPerMinute * minutesPerHour;
    const components = game.time.components;
    const currentHour = components.hour + components.minute / minutesPerHour + components.second / secondsPerHour;
    let hoursUntil;
    if (nextDay || currentHour >= targetHour) hoursUntil = hoursPerDay - currentHour + targetHour;
    else hoursUntil = targetHour - currentHour;
    const secondsToAdvance = Math.round(hoursUntil * secondsPerHour);
    if (secondsToAdvance > 0) {
      if (!game.user.isGM) {
        CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta: secondsToAdvance });
        return;
      }
      await game.time.advance(secondsToAdvance);
    }
  }

  /** Cycle through weather presets or open weather picker. */
  static async _onOpenWeatherPicker() {
    if (!canChangeWeather()) return;
    new WeatherPickerApp().render({ force: true });
  }

  /** Open the Chronicle chronicle. */
  static _onOpenChronicle() {
    CALENDARIA.apps.Chronicle.toggle();
  }

  /** Open the Note Viewer. */
  static _onOpenNoteViewer() {
    NoteViewer.toggle();
  }

  /** Open the settings panel. */
  static _onOpenSettings() {
    new SettingsPanel().render(true);
  }

  /**
   * Show the moons tooltip for a specific day.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onShowMoons(_event, target) {
    this.#closeMoonsTooltip();
    const dayCell = target.closest('[data-year][data-month][data-day]');
    if (!dayCell) return;
    const year = parseInt(dayCell.dataset.year);
    const month = parseInt(dayCell.dataset.month);
    const dayOfMonth = parseInt(dayCell.dataset.day);
    const moons = getAllMoonPhases(this.calendar, year, month, dayOfMonth);
    if (!moons?.length) return;
    const selectedMoon = getSelectedMoon() || moons[0]?.moonName;
    await showMoonPicker(target, moons, selectedMoon, (moonName) => {
      setSelectedMoon(moonName);
      this.render();
    });
  }

  /**
   * Close the moons tooltip.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onCloseMoonsPanel(_event, _target) {
    this.#closeMoonsTooltip();
  }

  /**
   * Close moons tooltip and clean up.
   */
  #closeMoonsTooltip() {
    closeMoonPicker();
  }

  /**
   * Format increment key for display.
   * @param {string} key - Increment key
   * @returns {string} Formatted label
   */
  #formatIncrementLabel(key) {
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
    return labels[key] || key;
  }

  /**
   * Get the singleton instance from Foundry's application registry.
   * @returns {MiniCal|undefined} The instance if it exists
   */
  static get instance() {
    return foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
  }

  /**
   * Show the MiniCal singleton.
   * @param {object} [options] - Show options
   * @param {boolean} [options.silent] - If true, don't show permission warning
   * @returns {MiniCal} The singleton instance
   */
  static show({ silent = false } = {}) {
    if (!canViewMiniCal()) {
      if (!silent) ui.notifications.warn('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    if (isCombatBlocked(SETTINGS.MINI_CAL_COMBAT_MODE)) return null;
    const instance = this.instance ?? new MiniCal();
    instance.render({ force: true });
    return instance;
  }

  /** Hide the MiniCal. */
  static hide() {
    this.instance?.close();
  }

  /** Reset position to default. */
  static async resetPosition() {
    await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_POSITION, null);
    if (this.instance?.rendered) {
      this.hide();
      this.show();
    }
  }

  /** Toggle the MiniCal visibility. */
  static toggle() {
    if (this.instance?.rendered) this.hide();
    else this.show();
  }

  /**
   * Update the idle opacity CSS variable from settings.
   */
  static updateIdleOpacity() {
    const autoFade = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_AUTO_FADE);
    const opacity = autoFade ? game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_IDLE_OPACITY) / 100 : 1;
    document.documentElement.style.setProperty('--calendaria-minical-idle-opacity', opacity);
  }

  /**
   * Refresh sticky states from settings on the current instance.
   */
  static refreshStickyStates() {
    const instance = this.instance;
    if (instance) instance.#restoreStickyStates();
  }
}
