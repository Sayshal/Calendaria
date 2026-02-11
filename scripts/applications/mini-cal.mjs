/**
 * MiniCal - All-in-one calendar widget with timekeeping.
 * Frameless, draggable, with persistent position and open state.
 * @module Applications/MiniCal
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, REPLACEABLE_ELEMENTS, SETTINGS, SOCKET_TYPES, TEMPLATES, WIDGET_POINTS } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { dayOfWeek } from '../notes/utils/date-utils.mjs';
import { isRecurringMatch } from '../notes/utils/recurrence.mjs';
import SearchManager from '../search/search-manager.mjs';
import TimeClock, { getTimeIncrements } from '../time/time-clock.mjs';
import { formatForLocation, hasMoonIconMarkers, renderMoonIcons, toRomanNumeral } from '../utils/format-utils.mjs';
import { format, localize } from '../utils/localization.mjs';
import { canChangeDateTime, canChangeWeather, canViewMiniCal } from '../utils/permissions.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';
import * as StickyZones from '../utils/sticky-zones.mjs';
import * as WidgetManager from '../utils/widget-manager.mjs';
import WeatherManager from '../weather/weather-manager.mjs';
import { openWeatherPicker } from '../weather/weather-picker.mjs';
import { getPresetAlias } from '../weather/weather-presets.mjs';
import { BigCal } from './big-cal.mjs';
import * as ViewUtils from './calendar-view-utils.mjs';
import { SettingsPanel } from './settings/settings-panel.mjs';
import { TimeKeeper } from './time-keeper.mjs';

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

  /** @type {boolean} Whether sidebar is locked due to notes panel */
  #sidebarLocked = false;

  /** @type {boolean} Search panel visibility state */
  #searchOpen = false;

  /** @type {string} Current search term */
  #searchTerm = '';

  /** @type {object[]|null} Current search results */
  #searchResults = null;

  /** @type {Function|null} Click-outside handler for search panel */
  #clickOutsideHandler = null;

  /** @type {HTMLElement|null} Active moons tooltip element */
  #moonsTooltip = null;

  /** @type {Function|null} Click-outside handler for moons tooltip */
  #moonsClickOutsideHandler = null;

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'mini-calendar',
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
      openSettings: MiniCal._onOpenSettings,
      toggleSearch: MiniCal._onToggleSearch,
      closeSearch: MiniCal._onCloseSearch,
      openSearchResult: MiniCal._onOpenSearchResult,
      showMoons: MiniCal._onShowMoons,
      closeMoonsPanel: MiniCal._onCloseMoonsPanel
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
    return ViewUtils.getCurrentViewedDate(this.calendar);
  }

  /**
   * Set the date being viewed.
   * @param {object} date - The date to view
   */
  set viewedDate(date) {
    this._viewedDate = date;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    const viewedDate = this.viewedDate;
    context.isGM = game.user.isGM;
    context.canChangeDateTime = canChangeDateTime();
    context.canChangeWeather = canChangeWeather();
    context.running = TimeClock.running;
    const components = game.time.components;
    const yearZero = calendar?.years?.yearZero ?? 0;
    const rawTime = calendar
      ? formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: (components.dayOfMonth ?? 0) + 1 }, 'miniCalTime')
      : TimeClock.getFormattedTime();
    context.currentTime = hasMoonIconMarkers(rawTime) ? renderMoonIcons(rawTime) : rawTime;
    context.currentDate = TimeClock.getFormattedDate();
    const isMonthless = calendar?.isMonthless ?? false;
    const appSettings = TimeClock.getAppSettings('mini-calendar');
    context.increments = Object.entries(getTimeIncrements())
      .filter(([key]) => !isMonthless || key !== 'month')
      .map(([key, seconds]) => ({ key, label: this.#formatIncrementLabel(key), seconds, selected: key === appSettings.incrementKey }));
    const customJumps = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_TIME_JUMPS) || {};
    const currentJumps = customJumps[appSettings.incrementKey] || {};
    context.customJumps = { dec2: currentJumps.dec2 ?? null, dec1: currentJumps.dec1 ?? null, inc1: currentJumps.inc1 ?? null, inc2: currentJumps.inc2 ?? null };
    const allNotes = ViewUtils.getCalendarNotes();
    const visibleNotes = ViewUtils.getVisibleNotes(allNotes);
    if (calendar) context.calendarData = this._generateMiniCalData(calendar, viewedDate, visibleNotes);
    context.showSetCurrentDate = false;
    if (game.user.isGM && this._selectedDate) {
      const today = ViewUtils.getCurrentViewedDate(calendar);
      context.showSetCurrentDate = this._selectedDate.year !== today.year || this._selectedDate.month !== today.month || this._selectedDate.day !== today.day;
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
      context.selectedDateNotes = this._getSelectedDateNotes(visibleNotes);
      context.selectedDateLabel = this._formatSelectedDate();
    }

    context.showViewNotes = false;
    const checkDate = this._selectedDate || ViewUtils.getCurrentViewedDate(calendar);
    if (checkDate) {
      const noteCount = this._countNotesOnDay(visibleNotes, checkDate.year, checkDate.month, checkDate.day);
      context.showViewNotes = noteCount > 0;
    }

    context.weather = this._getWeatherContext();
    context.searchOpen = this.#searchOpen;
    context.searchTerm = this.#searchTerm;
    context.searchResults = this.#searchResults || [];

    // Block visibility settings
    context.showWeather = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_WEATHER);
    context.showSeason = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_SEASON);
    context.showEra = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_ERA);
    context.showCycles = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_CYCLES);
    context.showMoonPhases = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SHOW_MOON_PHASES);
    context.weatherDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_WEATHER_DISPLAY_MODE);
    context.seasonDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_SEASON_DISPLAY_MODE);
    context.eraDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_ERA_DISPLAY_MODE);
    context.cyclesDisplayMode = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_CYCLES_DISPLAY_MODE);

    if (calendar && calendar.cyclesArray?.length && context.showCycles) {
      const yearZeroOffset = calendar.years?.yearZero ?? 0;
      const viewedComponents = { year: viewedDate.year - yearZeroOffset, month: viewedDate.month, dayOfMonth: (viewedDate.day ?? 1) - 1, hour: 12, minute: 0, second: 0 };
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
    widgets.sidebar = WidgetManager.renderWidgetsForPoint(WIDGET_POINTS.MINICAL_SIDEBAR, 'minical');
    widgets.weatherIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.WEATHER_INDICATOR, this.#renderWeatherIndicator(context), 'minical');
    widgets.seasonIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.SEASON_INDICATOR, this.#renderSeasonIndicator(context), 'minical');
    widgets.eraIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.ERA_INDICATOR, this.#renderEraIndicator(context), 'minical');
    widgets.cycleIndicator = WidgetManager.renderReplacementOrOriginal(REPLACEABLE_ELEMENTS.CYCLE_INDICATOR, this.#renderCycleIndicator(context), 'minical');
    widgets.indicators = WidgetManager.renderWidgetsForPoint(WIDGET_POINTS.HUD_INDICATORS, 'minical');
    widgets.hasIndicators = WidgetManager.hasWidgetsForPoint(WIDGET_POINTS.HUD_INDICATORS);
    return widgets;
  }

  /**
   * Render weather indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  #renderWeatherIndicator(context) {
    if (!context.showWeather) return '';
    const { weather, canChangeWeather, weatherDisplayMode } = context;
    if (weather) {
      const clickable = canChangeWeather ? ' clickable' : '';
      const action = canChangeWeather ? 'data-action="openWeatherPicker"' : '';
      const showIcon = weatherDisplayMode === 'full' || weatherDisplayMode === 'icon' || weatherDisplayMode === 'iconTemp';
      const showLabel = weatherDisplayMode === 'full';
      const showTemp = weatherDisplayMode === 'full' || weatherDisplayMode === 'temp' || weatherDisplayMode === 'iconTemp';
      const icon = showIcon ? `<i class="fas ${weather.icon}"></i>` : '';
      const label = showLabel ? ` ${weather.label}` : '';
      const temp = showTemp && weather.temperature ? `<span class="weather-temp">${weather.temperature}</span>` : '';
      return `<span class="weather-indicator${clickable}" ${action}
        style="--weather-color: ${weather.color}" data-tooltip="${weather.tooltip}">
        ${icon}${label} ${temp}
      </span>`;
    } else if (canChangeWeather) {
      return `<span class="weather-indicator clickable no-weather" data-action="openWeatherPicker"
        data-tooltip="${localize('CALENDARIA.Weather.ClickToGenerate')}">
        <i class="fas fa-cloud"></i> ${localize('CALENDARIA.Weather.None')}
      </span>`;
    }
    return '';
  }

  /**
   * Render season indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  #renderSeasonIndicator(context) {
    if (!context.showSeason) return '';
    const season = context.calendarData?.currentSeason;
    if (!season) return '';
    const mode = context.seasonDisplayMode;
    const showIcon = mode === 'full' || mode === 'icon';
    const showLabel = mode === 'full' || mode === 'text';
    const icon = showIcon ? `<i class="${season.icon}"></i>` : '';
    const label = showLabel ? ` ${localize(season.name)}` : '';
    return `<span class="season-indicator" style="--season-color: ${season.color}" data-tooltip="${localize(season.name)}">${icon}${label}</span>`;
  }

  /**
   * Render era indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  #renderEraIndicator(context) {
    if (!context.showEra) return '';
    const era = context.calendarData?.currentEra;
    if (!era) return '';
    const mode = context.eraDisplayMode;
    const showIcon = mode === 'full' || mode === 'icon';
    const showLabel = mode === 'full' || mode === 'text';
    const showAbbr = mode === 'abbr';
    const icon = showIcon ? '<i class="fas fa-hourglass-half"></i>' : '';
    let label = '';
    if (showLabel) label = ` ${localize(era.name)}`;
    else if (showAbbr) label = ` ${localize(era.abbreviation || era.name)}`;
    return `<span class="era-indicator" data-tooltip="${localize(era.name)}">${icon}${label}</span>`;
  }

  /**
   * Render cycle indicator HTML.
   * @param {object} context - Template context
   * @returns {string} HTML string
   */
  #renderCycleIndicator(context) {
    if (!context.showCycles || !context.cycleData?.values?.length) return '';
    const mode = context.cyclesDisplayMode;
    const icon = '<i class="fas fa-arrows-rotate"></i>';
    // Icon only mode - just show icon with tooltip
    if (mode === 'icon') {
      return `<span class="cycle-indicator" data-tooltip="${context.cycleText}">${icon}</span>`;
    }
    let displayText = '';
    if (mode === 'number') {
      displayText = context.cycleData.values.map((v) => v.index + 1).join(', ');
    } else if (mode === 'roman') {
      displayText = context.cycleData.values.map((v) => toRomanNumeral(v.index + 1)).join(', ');
    } else {
      displayText = context.cycleData.values.map((v) => v.entryName).join(', ');
    }
    const label = `<span class="cycle-label">${displayText}</span>`;
    return `<span class="cycle-indicator" data-tooltip="${context.cycleText || displayText}">${icon}${label}</span>`;
  }

  /**
   * Get weather context for template.
   * @returns {object|null} Weather context or null if no weather set
   */
  _getWeatherContext() {
    const weather = WeatherManager.getCurrentWeather();
    if (!weather) return null;
    const calendarId = this.calendar?.metadata?.id;
    const zoneId = WeatherManager.getActiveZone(null, game.scenes.active)?.id;
    const alias = getPresetAlias(weather.id, calendarId, zoneId);
    const label = alias || localize(weather.label);
    return {
      id: weather.id,
      label,
      icon: weather.icon,
      color: weather.color,
      temperature: WeatherManager.formatTemperature(WeatherManager.getTemperature()),
      tooltip: weather.description ? localize(weather.description) : label
    };
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
    const startDayOfWeek = hasFixedStart ? monthData.startingWeekday : dayOfWeek({ year, month, day: 1 });
    if (startDayOfWeek > 0) {
      const totalMonths = calendar.monthsArray.length ?? 12;
      let prevDays = [];
      let remainingSlots = startDayOfWeek;
      let checkMonth = month === 0 ? totalMonths - 1 : month - 1;
      let checkYear = month === 0 ? year - 1 : year;
      let checkDay = calendar.getDaysInMonth(checkMonth, checkYear - yearZero);

      // Collect previous month days, skipping intercalary days
      while (remainingSlots > 0 && checkDay > 0) {
        const festivalDay = calendar.findFestivalDay({ year: checkYear - yearZero, month: checkMonth, dayOfMonth: checkDay - 1 });
        const isIntercalary = festivalDay?.countsForWeekday === false;

        if (!isIntercalary) {
          prevDays.unshift({ day: checkDay, year: checkYear, month: checkMonth });
          remainingSlots--;
        }

        checkDay--;
        if (checkDay < 1 && remainingSlots > 0) {
          checkMonth = checkMonth === 0 ? totalMonths - 1 : checkMonth - 1;
          if (checkMonth === totalMonths - 1) checkYear--;
          checkDay = calendar.getDaysInMonth(checkMonth, checkYear - yearZero);
        }
      }

      for (const pd of prevDays) currentWeek.push({ day: pd.day, year: pd.year, month: pd.month, isFromOtherMonth: true, isToday: ViewUtils.isToday(pd.year, pd.month, pd.day, calendar) });
    }

    // Collect intercalary days to insert after regular days
    const intercalaryDays = [];

    for (let day = 1; day <= daysInMonth; day++) {
      const noteCount = this._countNotesOnDay(visibleNotes, year, month, day);
      const festivalDay = calendar.findFestivalDay({ year: internalYear, month, dayOfMonth: day - 1 });
      const moonData = showMoons ? ViewUtils.getFirstMoonPhase(calendar, year, month, day) : null;

      // Check if this is a non-counting festival (intercalary day)
      const isIntercalary = festivalDay?.countsForWeekday === false;

      if (isIntercalary) {
        // Don't add to weekday grid - collect separately
        intercalaryDays.push({
          day,
          year,
          month,
          isToday: ViewUtils.isToday(year, month, day, calendar),
          isSelected: this._isSelected(year, month, day),
          hasNotes: noteCount > 0,
          noteCount,
          isFestival: true,
          festivalName: festivalDay ? localize(festivalDay.name) : null,
          festivalColor: festivalDay?.color || '',
          festivalDescription: festivalDay?.description || '',
          moonIcon: moonData?.icon ?? null,
          moonPhase: moonData?.tooltip ?? null,
          moonColor: moonData?.color ?? null,
          isIntercalary: true
        });
      } else {
        currentWeek.push({
          day,
          year,
          month,
          isToday: ViewUtils.isToday(year, month, day, calendar),
          isSelected: this._isSelected(year, month, day),
          hasNotes: noteCount > 0,
          noteCount,
          isFestival: !!festivalDay,
          festivalName: festivalDay ? localize(festivalDay.name) : null,
          festivalColor: festivalDay?.color || '',
          festivalDescription: festivalDay?.description || '',
          moonIcon: moonData?.icon ?? null,
          moonPhase: moonData?.tooltip ?? null,
          moonColor: moonData?.color ?? null
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
          currentWeek.push({ day: dayInMonth, year: checkYear, month: checkMonth, isFromOtherMonth: true, isToday: ViewUtils.isToday(checkYear, checkMonth, dayInMonth, calendar) });
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
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();
    const monthWeekdays = calendar.getWeekdaysForMonth?.(month) ?? calendar.weekdaysArray ?? [];
    const showSelectedInHeader = game.settings.get(MODULE.ID, SETTINGS.MINI_CAL_HEADER_SHOW_SELECTED);
    const headerDate = showSelectedInHeader && this._selectedDate ? this._selectedDate : { year, month, day: date.day };
    const headerComponents = { year: headerDate.year, month: headerDate.month, dayOfMonth: headerDate.day };
    const rawHeader = formatForLocation(calendar, headerComponents, 'miniCalHeader');
    const formattedHeader = hasMoonIconMarkers(rawHeader) ? renderMoonIcons(rawHeader) : rawHeader;

    return {
      year,
      month,
      monthName: localize(monthData.name),
      yearDisplay: String(year),
      formattedHeader,
      currentSeason,
      currentEra,
      weeks,
      daysInWeek,
      weekdays: monthWeekdays.map((wd) => ({ name: localize(wd.name).substring(0, 2), isRestDay: wd.isRestDay || false }))
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
    const viewedDay = date.day || 1;
    const daysInWeek = calendar.daysInWeek;
    const yearZero = calendar.years?.yearZero ?? 0;
    const daysInYear = calendar.getDaysInYear(year - yearZero);
    const weekNumber = Math.floor((viewedDay - 1) / daysInWeek);
    const totalWeeks = Math.ceil(daysInYear / daysInWeek);
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
        const noteCount = this._countNotesOnDay(visibleNotes, dayYear, 0, dayNum);
        const festivalDay = calendar.findFestivalDay({ year: dayYear - yearZero, month: 0, dayOfMonth: dayNum - 1 });
        const moonData = ViewUtils.getFirstMoonPhase(calendar, dayYear, 0, dayNum);
        const isIntercalary = festivalDay?.countsForWeekday === false;
        const dayData = {
          day: dayNum,
          year: dayYear,
          month: 0,
          isToday: ViewUtils.isToday(dayYear, 0, dayNum, calendar),
          isSelected: this._isSelected(dayYear, 0, dayNum),
          hasNotes: noteCount > 0,
          noteCount,
          isFestival: !!festivalDay,
          festivalName: festivalDay ? localize(festivalDay.name) : null,
          festivalColor: festivalDay?.color || '',
          festivalDescription: festivalDay?.description || '',
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

    const viewedComponents = { month: 0, dayOfMonth: viewedDay - 1 };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();
    const weekdayData = calendar.weekdaysArray ?? [];
    const displayWeek = weekNumber + 1;
    const yearDisplay = String(year);
    const formattedHeader = `${localize('CALENDARIA.Common.Week')} ${displayWeek}, ${yearDisplay}`;
    return {
      year,
      month: 0,
      monthName: '',
      yearDisplay,
      formattedHeader,
      currentSeason,
      currentEra,
      weeks,
      daysInWeek,
      weekdays: weekdayData.map((wd) => ({ name: localize(wd.name).substring(0, 2), isRestDay: wd.isRestDay || false })),
      isMonthless: true,
      weekNumber: displayWeek,
      totalWeeks
    };
  }

  /**
   * Check if a date is selected.
   * @param {number} year - Display year
   * @param {number} month - Month
   * @param {number} day - Day (1-indexed)
   * @returns {boolean} True if the date matches the selected date
   */
  _isSelected(year, month, day) {
    if (!this._selectedDate) return false;
    return this._selectedDate.year === year && this._selectedDate.month === month && this._selectedDate.day === day;
  }

  /**
   * Count notes on a specific day.
   * @param {object[]} notes - Visible notes
   * @param {number} year - Year
   * @param {number} month - Month
   * @param {number} day - Day (1-indexed)
   * @returns {number} Number of notes on the specified day
   */
  _countNotesOnDay(notes, year, month, day) {
    const targetDate = { year, month, day };
    return notes.filter((page) => {
      const noteData = {
        startDate: page.system.startDate,
        endDate: page.system.endDate,
        repeat: page.system.repeat,
        repeatInterval: page.system.repeatInterval,
        repeatEndDate: page.system.repeatEndDate,
        maxOccurrences: page.system.maxOccurrences,
        moonConditions: page.system.moonConditions,
        randomConfig: page.system.randomConfig,
        cachedRandomOccurrences: page.flags?.[MODULE.ID]?.randomOccurrences,
        linkedEvent: page.system.linkedEvent,
        weekday: page.system.weekday,
        weekNumber: page.system.weekNumber,
        seasonalConfig: page.system.seasonalConfig,
        conditions: page.system.conditions
      };
      return isRecurringMatch(noteData, targetDate);
    }).length;
  }

  /**
   * Get notes for the selected date, sorted by time (all-day first, then by start time).
   * @param {object[]} visibleNotes - Pre-fetched visible notes
   * @returns {object[]} Array of note objects for the selected date
   */
  _getSelectedDateNotes(visibleNotes) {
    if (!this._selectedDate) return [];
    const { year, month, day } = this._selectedDate;
    const targetDate = { year, month, day };
    const notes = visibleNotes.filter((page) => {
      const noteData = {
        startDate: page.system.startDate,
        endDate: page.system.endDate,
        repeat: page.system.repeat,
        repeatInterval: page.system.repeatInterval,
        repeatEndDate: page.system.repeatEndDate,
        maxOccurrences: page.system.maxOccurrences,
        moonConditions: page.system.moonConditions,
        randomConfig: page.system.randomConfig,
        cachedRandomOccurrences: page.flags?.[MODULE.ID]?.randomOccurrences,
        linkedEvent: page.system.linkedEvent,
        weekday: page.system.weekday,
        weekNumber: page.system.weekNumber,
        seasonalConfig: page.system.seasonalConfig,
        conditions: page.system.conditions
      };
      return isRecurringMatch(noteData, targetDate);
    });
    return notes
      .map((page) => {
        const start = page.system.startDate;
        const end = page.system.endDate;
        const isAllDay = page.system.allDay;
        const icon = page.system.icon || 'fas fa-sticky-note';
        const color = page.system.color || '#4a90e2';
        let timeLabel = '';
        if (isAllDay) {
          timeLabel = localize('CALENDARIA.MiniCal.AllDay');
        } else {
          const startTime = this._formatTime(start.hour, start.minute);
          const endTime = this._formatTime(end.hour, end.minute);
          timeLabel = `${startTime} - ${endTime}`;
        }

        const authorName = page.system.author?.name || localize('CALENDARIA.Common.Unknown');
        return {
          id: page.id,
          parentId: page.parent.id,
          name: page.name,
          icon,
          isImageIcon: icon.includes('/'),
          color,
          timeLabel,
          isAllDay,
          startHour: start.hour ?? 0,
          startMinute: start.minute ?? 0,
          author: authorName,
          isOwner: page.isOwner
        };
      })
      .sort((a, b) => {
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
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
    const { year, month, day } = this._selectedDate;
    const calendar = this.calendar;
    const monthData = calendar.monthsArray[month];
    const monthName = monthData ? localize(monthData.name) : '';
    const yearDisplay = String(year);
    return `${monthName} ${day}, ${yearDisplay}`;
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
    const components = { year: 0, month: 0, dayOfMonth: 1, hour: hour ?? 0, minute: minute ?? 0, second: 0 };
    return formatForLocation(calendar, components, 'miniCalTime');
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (options.isFirstRender) this.#restorePosition();
    else this.#updateDockedPosition();
    this.#enableDragging();
    const incrementSelect = this.element.querySelector('[data-action="increment"]');
    incrementSelect?.addEventListener('change', (event) => {
      TimeClock.setAppIncrement('mini-calendar', event.target.value);
      TimeClock.setIncrement(event.target.value);
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
          this.render();
        },
        { passive: false }
      );
    }
    if (!this.#timeHookId) this.#timeHookId = Hooks.on(HOOKS.VISUAL_TICK, this.#onVisualTick.bind(this));
    if (!this.#worldTimeHookId) this.#worldTimeHookId = Hooks.on(HOOKS.WORLD_TIME_UPDATED, this.#onWorldTimeUpdated.bind(this));
    if (!this.#hooks.some((h) => h.name === HOOKS.CLOCK_START_STOP)) this.#hooks.push({ name: HOOKS.CLOCK_START_STOP, id: Hooks.on(HOOKS.CLOCK_START_STOP, this.#onClockStateChange.bind(this)) });
    const container = this.element.querySelector('.mini-cal-container');
    const sidebar = this.element.querySelector('.mini-sidebar');

    // Double-click anywhere (except interactive elements) opens BigCal
    container?.addEventListener('dblclick', (e) => {
      if (e.target.closest('button, a, input, select, .note-badge')) return;
      e.preventDefault();
      this.close();
      new BigCal().render(true);
    });

    container?.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#context-menu, .mini-day')) return;
      e.preventDefault();
      document.getElementById('context-menu')?.remove();
      const menu = new foundry.applications.ux.ContextMenu.implementation(this.element, '.mini-cal-container', this.#getContextMenuItems(), { fixed: true, jQuery: false });
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

    const searchInput = this.element.querySelector('.calendaria-hud-search-panel .search-input');
    if (searchInput) {
      if (this.#searchOpen) searchInput.focus();
      const debouncedSearch = foundry.utils.debounce((term) => {
        this.#searchTerm = term;
        if (term.length >= 2) this.#searchResults = SearchManager.search(term, { searchContent: true });
        else this.#searchResults = null;
        this.#updateSearchResults();
      }, 300);

      searchInput.addEventListener('input', (e) => debouncedSearch(e.target.value));
      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') this.#closeSearch();
      });
    }

    if (this.#searchOpen) {
      this.#positionSearchPanel();
      const panel = this.element.querySelector('.calendaria-hud-search-panel');
      if (panel && !this.#clickOutsideHandler) {
        setTimeout(() => {
          this.#clickOutsideHandler = (event) => {
            if (!panel.contains(event.target) && !this.element.contains(event.target)) this.#closeSearch();
          };
          document.addEventListener('mousedown', this.#clickOutsideHandler);
        }, 100);
      }
    }

    const timeDisplay = this.element.querySelector('.mini-time-display');
    const timeControls = this.element.querySelector('.mini-time-controls');
    if (timeDisplay && timeControls) {
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
      timeDisplay.addEventListener('mouseenter', showControls);
      timeDisplay.addEventListener('mouseleave', hideControls);
      timeControls.addEventListener('mouseenter', showControls);
      timeControls.addEventListener('mouseleave', hideControls);
    }

    WidgetManager.attachWidgetListeners(this.element);
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.#restoreStickyStates();
    const c = game.time.components;
    this.#lastDay = `${c.year}-${c.month}-${c.dayOfMonth}`;
    ViewUtils.setupDayContextMenu(this.element, '.mini-day:not(.empty)', this.calendar, {
      onSetDate: () => {
        this._selectedDate = null;
        this.render();
      },
      onCreateNote: () => this.render()
    });
    const debouncedRender = foundry.utils.debounce(() => this.render(), 100);

    this.#hooks.push({
      name: 'updateJournalEntryPage',
      id: Hooks.on('updateJournalEntryPage', (page) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
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
        if (journal.pages.some((p) => p.type === 'calendaria.calendarnote')) debouncedRender();
      })
    });

    this.#hooks.push({ name: HOOKS.WEATHER_CHANGE, id: Hooks.on(HOOKS.WEATHER_CHANGE, () => debouncedRender()) });
    this.#hooks.push({ name: HOOKS.WIDGETS_REFRESH, id: Hooks.on(HOOKS.WIDGETS_REFRESH, () => this.render()) });
    this.#hooks.push({ name: 'calendaria.displayFormatsChanged', id: Hooks.on('calendaria.displayFormatsChanged', () => this.render()) });

    // Right-click context menu for close
    new foundry.applications.ux.ContextMenu.implementation(
      this.element,
      '.mini-cal-container',
      [{ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => MiniCal.hide() }],
      { fixed: true, jQuery: false }
    );
  }

  /** @override */
  async close(options = {}) {
    // Prevent non-GMs from closing if force display is enabled
    if (!game.user.isGM && game.settings.get(MODULE.ID, SETTINGS.FORCE_MINI_CAL)) {
      ui.notifications.warn('CALENDARIA.Common.ForcedDisplayWarning', { localize: true });
      return;
    }
    return super.close({ animate: false, ...options });
  }

  /** @override */
  async _onClose(options) {
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
    if (this.#clickOutsideHandler) {
      document.removeEventListener('mousedown', this.#clickOutsideHandler);
      this.#clickOutsideHandler = null;
    }
    this.#closeMoonsTooltip();
    StickyZones.unregisterFromZoneUpdates(this);
    StickyZones.unpinFromZone(this.element);
    StickyZones.cleanupSnapIndicator();
    await super._onClose(options);
  }

  /**
   * Override setPosition to prevent position updates when pinned to a DOM-parented zone.
   * @override
   */
  setPosition(position) {
    if (this.#snappedZoneId && StickyZones.usesDomParenting(this.#snappedZoneId)) {
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
      if (this.#snappedZoneId && StickyZones.restorePinnedState(this.element, this.#snappedZoneId)) {
        StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
        return;
      }

      if (this.#snappedZoneId) {
        const rect = this.element.getBoundingClientRect();
        const zonePos = StickyZones.getRestorePosition(this.#snappedZoneId, rect.width, rect.height);
        if (zonePos) {
          this.setPosition({ left: zonePos.left, top: zonePos.top });
          StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
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
    let rightBuffer = StickyZones.getSidebarBuffer();
    // Account for MiniCal's own expanding sidebar
    const miniSidebar = this.element.querySelector('.mini-sidebar');
    if (miniSidebar) rightBuffer += miniSidebar.offsetWidth;
    let { left, top } = this.position;
    left = Math.max(0, Math.min(left, window.innerWidth - rect.width - rightBuffer));
    top = Math.max(0, Math.min(top, window.innerHeight - rect.height));
    this.setPosition({ left, top });
  }

  /**
   * Update position when docked to a sticky zone.
   */
  #updateDockedPosition() {
    if (!this.#snappedZoneId) return;
    if (StickyZones.usesDomParenting(this.#snappedZoneId)) {
      requestAnimationFrame(() => {
        if (this.rendered && this.#snappedZoneId && StickyZones.usesDomParenting(this.#snappedZoneId)) StickyZones.pinToZone(this.element, this.#snappedZoneId);
      });
      return;
    }
    const rect = this.element.getBoundingClientRect();
    const zonePos = StickyZones.getRestorePosition(this.#snappedZoneId, rect.width, rect.height);
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
    const timeControls = this.element.querySelector('.mini-time-controls');
    const sidebar = this.element.querySelector('.mini-sidebar');
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
   * Save sticky states to settings.
   */
  async #saveStickyStates() {
    await game.settings.set(MODULE.ID, SETTINGS.MINI_CAL_STICKY_STATES, {
      timeControls: this.#stickyTimeControls,
      sidebar: this.#stickySidebar,
      position: this.#stickyPosition
    });
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
        name: forceMiniCal ? 'CALENDARIA.MiniCal.ContextMenu.HideFromAll' : 'CALENDARIA.MiniCal.ContextMenu.ShowToAll',
        icon: forceMiniCal ? '<i class="fas fa-eye-slash"></i>' : '<i class="fas fa-eye"></i>',
        callback: async () => {
          const newValue = !forceMiniCal;
          await game.settings.set(MODULE.ID, SETTINGS.FORCE_MINI_CAL, newValue);
          CalendariaSocket.emit(SOCKET_TYPES.MINI_CAL_VISIBILITY, { visible: newValue });
        }
      });
    }
    items.push({ name: 'CALENDARIA.MiniCal.ContextMenu.ResetPosition', icon: '<i class="fas fa-arrows-to-dot"></i>', callback: () => MiniCal.resetPosition() });
    items.push({
      name: this.#stickyPosition ? 'CALENDARIA.MiniCal.ContextMenu.UnlockPosition' : 'CALENDARIA.MiniCal.ContextMenu.LockPosition',
      icon: this.#stickyPosition ? '<i class="fas fa-lock-open"></i>' : '<i class="fas fa-lock"></i>',
      callback: () => this._toggleStickyPosition()
    });
    items.push({
      name: 'CALENDARIA.MiniCal.ContextMenu.SwapToBigCal',
      icon: '<i class="fas fa-calendar"></i>',
      callback: () => {
        this.close();
        new BigCal().render(true);
      }
    });
    items.push({
      name: 'CALENDARIA.MiniCal.ContextMenu.SwapToTimeKeeper',
      icon: '<i class="fas fa-clock"></i>',
      callback: () => {
        MiniCal.hide();
        TimeKeeper.show();
      }
    });
    items.push({ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => MiniCal.hide() });
    return items;
  }

  /**
   * Toggle sticky position state.
   */
  _toggleStickyPosition() {
    this.#stickyPosition = !this.#stickyPosition;
    this.#saveStickyStates();
  }

  /**
   * Enable dragging on the top row.
   */
  #enableDragging() {
    const dragHandle = this.element.querySelector('.mini-top-row');
    if (!dragHandle) return;
    const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, dragHandle, false);
    let dragStartX = 0;
    let dragStartY = 0;
    let elementStartLeft = 0;
    let elementStartTop = 0;
    let previousZoneId = null;
    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
      if (this.#stickyPosition) return;
      if (event.target.closest('button, a, input, select, [data-action]')) return;
      previousZoneId = this.#snappedZoneId;
      this.#snappedZoneId = null;
      if (previousZoneId && StickyZones.usesDomParenting(previousZoneId)) {
        const preserved = StickyZones.unpinFromZone(this.element);
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
      let rightBuffer = StickyZones.getSidebarBuffer();
      // Account for MiniCal's own expanding sidebar
      const miniSidebar = this.element.querySelector('.mini-sidebar');
      if (miniSidebar) rightBuffer += miniSidebar.offsetWidth;
      let newLeft = elementStartLeft + deltaX;
      let newTop = elementStartTop + deltaY;
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width - rightBuffer));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
      this.setPosition({ left: newLeft, top: newTop });
      this.#activeSnapZone = StickyZones.checkStickyZones(dragHandle, newLeft, newTop, rect.width, rect.height);
    };

    drag._onDragMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener(...drag.handlers.dragMove);
      window.removeEventListener(...drag.handlers.dragUp);
      const rect = this.element.getBoundingClientRect();
      const result = StickyZones.finalizeDrag(dragHandle, this.#activeSnapZone, this, rect.width, rect.height, previousZoneId);
      this.#snappedZoneId = result.zoneId;
      StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
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
   * Uses predicted world time when clock is running for smooth updates.
   * @returns {object} Time components
   */
  #getPredictedComponents() {
    if (TimeClock.running) {
      const cal = game.time?.calendar;
      if (cal) return cal.timeToComponents(TimeClock.predictedWorldTime);
    }
    return game.time.components;
  }

  /**
   * Handle visual tick — update time/date text every 1s.
   */
  #onVisualTick() {
    if (!this.rendered) return;
    const timeEl = this.element.querySelector('.time-value');
    const dateEl = this.element.querySelector('.date-value');
    const calendar = this.calendar;
    const components = this.#getPredictedComponents();
    if (timeEl && calendar) {
      const yearZero = calendar.years?.yearZero ?? 0;
      const timeFormatted = formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: (components.dayOfMonth ?? 0) + 1 }, 'miniCalTime');
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
   * Fires every ~60s when clock is running, or immediately on manual advance.
   */
  #onWorldTimeUpdated() {
    if (!this.rendered) return;
    const components = game.time.components;
    const currentDay = `${components.year}-${components.month}-${components.dayOfMonth}`;
    if (currentDay !== this.#lastDay) {
      this.#lastDay = currentDay;
      this.render();
    }
    // Also update display to sync with real world time
    this.#onVisualTick();
  }

  /**
   * Handle clock state changes (from other sources like TimeKeeper).
   */
  #onClockStateChange() {
    if (!this.rendered) return;
    const running = TimeClock.running;
    const tooltip = running ? localize('CALENDARIA.TimeKeeper.Stop') : localize('CALENDARIA.TimeKeeper.Start');
    const timeToggle = this.element.querySelector('.time-toggle');
    if (timeToggle) {
      timeToggle.classList.toggle('active', running);
      timeToggle.dataset.tooltip = tooltip;
      const icon = timeToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-play', !running);
        icon.classList.toggle('fa-pause', running);
      }
    }
  }

  /**
   * Navigate to the next or previous month (or week for monthless calendars).
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onNavigate(_event, target) {
    const direction = target.dataset.direction === 'next' ? 1 : -1;
    const current = this.viewedDate;
    const calendar = this.calendar;
    if (calendar.isMonthless) {
      const daysInWeek = calendar.daysInWeek;
      const yearZero = calendar.years?.yearZero ?? 0;
      const daysInYear = calendar.getDaysInYear(current.year - yearZero);
      let newDay = (current.day || 1) + direction * daysInWeek;
      let newYear = current.year;
      if (newDay > daysInYear) {
        newDay -= daysInYear;
        newYear++;
      } else if (newDay < 1) {
        const prevYearDays = calendar.getDaysInYear(newYear - yearZero - 1);
        newDay += prevYearDays;
        newYear--;
      }

      this.viewedDate = { year: newYear, month: 0, day: newDay };
      await this.render();
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

    this.viewedDate = { year: newYear, month: newMonth, day: 1 };
    await this.render();
  }

  /**
   * Navigate to a specific month (from clicking other-month day).
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onNavigateToMonth(_event, target) {
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);
    this.viewedDate = { year, month, day: 1 };
    await this.render();
  }

  /**
   * Reset view to today's date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onToday(_event, _target) {
    this._viewedDate = null;
    this._selectedDate = null;
    await this.render();
  }

  /**
   * Select a day on the calendar.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onSelectDay(_event, target) {
    const day = parseInt(target.dataset.day);
    const month = parseInt(target.dataset.month);
    const year = parseInt(target.dataset.year);
    if (this._selectedDate?.year === year && this._selectedDate?.month === month && this._selectedDate?.day === day) this._selectedDate = null;
    else this._selectedDate = { year, month, day };
    await this.render();
  }

  /**
   * Add a new note on the selected or current date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onAddNote(_event, _target) {
    let day, month, year;
    if (this._selectedDate) {
      ({ day, month, year } = this._selectedDate);
    } else {
      const today = game.time.components;
      const calendar = this.calendar;
      const yearZero = calendar?.years?.yearZero ?? 0;
      year = today.year + yearZero;
      month = today.month;
      day = (today.dayOfMonth ?? 0) + 1;
    }

    const page = await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: 12, minute: 0 },
        endDate: { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: 13, minute: 0 }
      }
    });
    if (page) page.sheet.render(true, { mode: 'edit' });
  }

  /**
   * Open the BigCal application.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onOpenFull(_event, _target) {
    await this.close();
    new BigCal().render(true);
  }

  /**
   * Toggle the clock running state.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onToggleClock(_event, _target) {
    TimeClock.toggle();
    const timeToggle = this.element.querySelector('.time-toggle');
    if (timeToggle) {
      timeToggle.classList.toggle('active', TimeClock.running);
      const icon = timeToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-play', !TimeClock.running);
        icon.classList.toggle('fa-pause', TimeClock.running);
      }
      timeToggle.dataset.tooltip = TimeClock.running ? localize('CALENDARIA.TimeKeeper.Stop') : localize('CALENDARIA.TimeKeeper.Start');
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
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onSetCurrentDate(_event, _target) {
    if (!this._selectedDate) return;

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

    const { year, month, day } = this._selectedDate;
    await ViewUtils.setDateTo(year, month, day, this.calendar);
    this._selectedDate = null;
    await this.render();
  }

  /**
   * Open the notes panel for the selected date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onViewNotes(_event, _target) {
    if (!this._selectedDate) {
      const today = ViewUtils.getCurrentViewedDate(this.calendar);
      if (today) this._selectedDate = { year: today.year, month: today.month, day: today.day };
    }
    if (!this._selectedDate) return;
    this.#notesPanelVisible = true;
    this.#sidebarLocked = true;
    this.#sidebarVisible = true;
    await this.render();
  }

  /**
   * Close the notes panel.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onCloseNotesPanel(_event, _target) {
    this.#notesPanelVisible = false;
    this.#sidebarLocked = false;
    await this.render();
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

  /**
   * Cycle through weather presets or open weather picker.
   * For now, generates new weather based on climate/season.
   */
  static async _onOpenWeatherPicker() {
    if (!canChangeWeather()) return;
    await openWeatherPicker();
  }

  /**
   * Open the settings panel.
   */
  static _onOpenSettings() {
    new SettingsPanel().render(true);
  }

  /**
   * Toggle the search panel.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onToggleSearch(_event, _target) {
    this.#searchOpen = !this.#searchOpen;
    if (!this.#searchOpen) {
      this.#searchTerm = '';
      this.#searchResults = null;
    }
    await this.render();
  }

  /**
   * Close the search panel.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onCloseSearch(_event, _target) {
    this.#closeSearch();
  }

  /**
   * Open a search result (note).
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onOpenSearchResult(_event, target) {
    const id = target.dataset.id;
    const journalId = target.dataset.journalId;
    const page = NoteManager.getFullNote(id);
    if (page) page.sheet.render(true, { mode: 'view' });
    else if (journalId) {
      const journal = game.journal.get(journalId);
      if (journal) journal.sheet.render(true, { pageId: id });
    }

    this.#closeSearch();
  }

  /**
   * Update search results without full re-render.
   */
  #updateSearchResults() {
    const panel = this.element.querySelector('.calendaria-hud-search-panel');
    if (!panel) return;
    const resultsContainer = panel.querySelector('.search-panel-results');
    if (!resultsContainer) return;
    if (this.#searchResults?.length) {
      resultsContainer.innerHTML = this.#searchResults
        .map((r) => {
          const icons = [];
          if (r.data?.icon) icons.push(`<i class="result-note-icon ${r.data.icon}" style="color: ${r.data.color || '#4a9eff'}" data-tooltip="${localize('CALENDARIA.Search.NoteIcon')}"></i>`);
          if (r.data?.gmOnly) icons.push(`<i class="result-gm-icon fas fa-lock" data-tooltip="${localize('CALENDARIA.Search.GMOnly')}"></i>`);
          if (r.data?.repeatIcon) icons.push(`<i class="result-repeat-icon ${r.data.repeatIcon}"${r.data.repeatTooltip ? ` data-tooltip="${r.data.repeatTooltip}"` : ''}></i>`);
          if (r.data?.categoryIcons?.length) {
            for (const cat of r.data.categoryIcons) icons.push(`<i class="result-category-icon fas ${cat.icon}" style="color: ${cat.color}" data-tooltip="${cat.label}"></i>`);
          }
          return `<div class="search-result-item" data-action="openSearchResult" data-id="${r.id}" data-journal-id="${r.data?.journalId || ''}">
            <div class="result-content">
              <span class="result-name">${r.name}</span>
              ${r.description ? `<span class="result-description">${r.description}</span>` : ''}
            </div>
            ${icons.length ? `<div class="result-icons">${icons.join('')}</div>` : ''}
          </div>`;
        })
        .join('');
      resultsContainer.classList.add('has-results');
    } else if (this.#searchTerm?.length >= 2) {
      resultsContainer.innerHTML = `<div class="no-results"><i class="fas fa-search"></i><span>${localize('CALENDARIA.Search.NoResults')}</span></div>`;
      resultsContainer.classList.add('has-results');
    } else {
      resultsContainer.innerHTML = '';
      resultsContainer.classList.remove('has-results');
    }
  }

  /**
   * Position search panel with edge awareness.
   */
  #positionSearchPanel() {
    const panel = this.element.querySelector('.calendaria-hud-search-panel');
    const button = this.element.querySelector('[data-action="toggleSearch"]');
    if (!panel || !button) return;
    const buttonRect = button.getBoundingClientRect();
    const panelWidth = 280;
    const panelMaxHeight = 300;
    let left = buttonRect.left - panelWidth - 8;
    let top = buttonRect.top;
    if (left < 10) left = buttonRect.right + 8;
    if (top + panelMaxHeight > window.innerHeight - 10) top = window.innerHeight - panelMaxHeight - 10;
    top = Math.max(10, top);
    panel.style.position = 'fixed';
    panel.style.left = `${left}px`;
    panel.style.top = `${top}px`;
    panel.style.width = `${panelWidth}px`;
    panel.style.maxHeight = `${panelMaxHeight}px`;
  }

  /**
   * Close search and clean up.
   */
  #closeSearch() {
    if (this.#clickOutsideHandler) {
      document.removeEventListener('mousedown', this.#clickOutsideHandler);
      this.#clickOutsideHandler = null;
    }
    this.#searchTerm = '';
    this.#searchResults = null;
    this.#searchOpen = false;
    this.render();
  }

  /**
   * Show the moons tooltip for a specific day.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onShowMoons(_event, target) {
    this.#closeMoonsTooltip();
    const dayCell = target.closest('[data-year][data-month][data-day]');
    if (!dayCell) return;
    const year = parseInt(dayCell.dataset.year);
    const month = parseInt(dayCell.dataset.month);
    const day = parseInt(dayCell.dataset.day);
    const moons = ViewUtils.getAllMoonPhases(this.calendar, year, month, day);
    if (!moons?.length) return;
    const selectedMoon = ViewUtils.getSelectedMoon() || moons[0]?.moonName;
    const tooltip = document.createElement('div');
    tooltip.className = 'calendaria-moons-tooltip';
    const radialSize = Math.min(250, Math.round(50 * Math.sqrt(moons.length) + 17 * (moons.length - 1)));
    tooltip.innerHTML = `
      <div class="moons-radial" style="--moon-count: ${moons.length}; --radial-size: ${radialSize}px">
        ${moons
          .map(
            (moon, i) => `
          <div class="moon-radial-item${moon.moonName === selectedMoon ? ' selected' : ''}" style="--moon-index: ${i}" data-tooltip="${moon.phaseName}" data-moon-name="${moon.moonName}">
            <span class="moon-name">${moon.moonName}</span>
            <div class="moon-radial-icon${moon.color ? ' tinted' : ''}"${moon.color ? ` style="--moon-color: ${moon.color}"` : ''}>
              <img src="${moon.icon}" alt="${moon.phaseName}">
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;
    document.body.appendChild(tooltip);
    this.#moonsTooltip = tooltip;
    tooltip.querySelectorAll('.moon-radial-item').forEach((item) => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        const moonName = item.dataset.moonName;
        ViewUtils.setSelectedMoon(moonName);
        this.#closeMoonsTooltip();
        this.render();
      });
    });
    const targetRect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
    let top = targetRect.bottom + 8;
    if (left < 10) left = 10;
    if (left + tooltipRect.width > window.innerWidth - 10) left = window.innerWidth - tooltipRect.width - 10;
    if (top + tooltipRect.height > window.innerHeight - 10) top = targetRect.top - tooltipRect.height - 8;
    top = Math.max(10, top);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
    this.#setupTooltipDrag(tooltip);
    setTimeout(() => {
      this.#moonsClickOutsideHandler = (event) => {
        if (!tooltip.contains(event.target) && !event.target.closest('[data-action="showMoons"]')) this.#closeMoonsTooltip();
      };
      document.addEventListener('mousedown', this.#moonsClickOutsideHandler);
    }, 100);
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
   * Set up drag behavior for the moons tooltip.
   * @param {HTMLElement} tooltip - The tooltip element
   */
  #setupTooltipDrag(tooltip) {
    let isDragging = false;
    let startX, startY, startLeft, startTop;
    const onMouseDown = (e) => {
      if (e.target.closest('[data-tooltip]')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startLeft = parseInt(tooltip.style.left) || 0;
      startTop = parseInt(tooltip.style.top) || 0;
      tooltip.style.cursor = 'grabbing';
      e.preventDefault();
    };
    const onMouseMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      tooltip.style.left = `${startLeft + dx}px`;
      tooltip.style.top = `${startTop + dy}px`;
    };
    const onMouseUp = () => {
      isDragging = false;
      tooltip.style.cursor = '';
    };
    tooltip.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    tooltip._dragCleanup = () => {
      tooltip.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }

  /**
   * Close moons tooltip and clean up.
   */
  #closeMoonsTooltip() {
    if (this.#moonsClickOutsideHandler) {
      document.removeEventListener('mousedown', this.#moonsClickOutsideHandler);
      this.#moonsClickOutsideHandler = null;
    }
    if (this.#moonsTooltip) {
      this.#moonsTooltip._dragCleanup?.();
      this.#moonsTooltip.remove();
      this.#moonsTooltip = null;
    }
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
   * Called when settings change externally (e.g., from settings panel).
   */
  static refreshStickyStates() {
    const instance = this.instance;
    if (instance) instance.#restoreStickyStates();
  }
}
