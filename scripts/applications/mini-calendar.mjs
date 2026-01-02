/**
 * MiniCalendar - All-in-one calendar widget with timekeeping.
 * Frameless, draggable, with persistent position and open state.
 * @module Applications/MiniCalendar
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, SETTINGS, TEMPLATES } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { dayOfWeek } from '../notes/utils/date-utils.mjs';
import { isRecurringMatch } from '../notes/utils/recurrence.mjs';
import SearchManager from '../search/search-manager.mjs';
import TimeKeeper, { getTimeIncrements } from '../time/time-keeper.mjs';
import { formatForLocation } from '../utils/format-utils.mjs';
import { localize } from '../utils/localization.mjs';
import WeatherManager from '../weather/weather-manager.mjs';
import { openWeatherPicker } from '../weather/weather-picker.mjs';
import { CalendarApplication } from './calendar-application.mjs';
import * as ViewUtils from './calendar-view-utils.mjs';
import { SettingsPanel } from './settings/settings-panel.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * MiniCalendar widget combining mini month view with time controls.
 */
export class MiniCalendar extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {MiniCalendar|null} Singleton instance */
  static _instance = null;

  /** @type {object|null} Currently selected date */
  _selectedDate = null;

  /** @type {object|null} Currently viewed month/year */
  _viewedDate = null;

  /** @type {number|null} Hook ID for updateWorldTime */
  #timeHookId = null;

  /** @type {Array} Hook references for cleanup */
  #hooks = [];

  /** @type {boolean} Sticky time controls */
  #stickyTimeControls = false;

  /** @type {boolean} Sticky sidebar */
  #stickySidebar = false;

  /** @type {boolean} Sticky position (immovable) */
  #stickyPosition = false;

  /** @type {object|null} Active sticky options menu */
  #stickyMenu = null;

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

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'mini-calendar',
    classes: ['calendaria', 'mini-calendar'],
    position: { width: 'auto', height: 'auto' },
    window: { frame: false, positioned: true },
    actions: {
      navigate: MiniCalendar._onNavigate,
      today: MiniCalendar._onToday,
      selectDay: MiniCalendar._onSelectDay,
      navigateToMonth: MiniCalendar._onNavigateToMonth,
      addNote: MiniCalendar._onAddNote,
      openFull: MiniCalendar._onOpenFull,
      toggle: MiniCalendar._onToggleClock,
      forward: MiniCalendar._onForward,
      forward5x: MiniCalendar._onForward5x,
      reverse: MiniCalendar._onReverse,
      reverse5x: MiniCalendar._onReverse5x,
      setCurrentDate: MiniCalendar._onSetCurrentDate,
      toggleLock: MiniCalendar._onToggleLock,
      viewNotes: MiniCalendar._onViewNotes,
      closeNotesPanel: MiniCalendar._onCloseNotesPanel,
      openNote: MiniCalendar._onOpenNote,
      editNote: MiniCalendar._onEditNote,
      toSunrise: MiniCalendar._onToSunrise,
      toMidday: MiniCalendar._onToMidday,
      toSunset: MiniCalendar._onToSunset,
      toMidnight: MiniCalendar._onToMidnight,
      openWeatherPicker: MiniCalendar._onOpenWeatherPicker,
      openSettings: MiniCalendar._onOpenSettings,
      toggleSearch: MiniCalendar._onToggleSearch,
      closeSearch: MiniCalendar._onCloseSearch,
      openSearchResult: MiniCalendar._onOpenSearchResult
    }
  };

  /** @override */
  static PARTS = { main: { template: TEMPLATES.MINI_CALENDAR } };

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

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

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    const viewedDate = this.viewedDate;
    context.isGM = game.user.isGM;
    context.running = TimeKeeper.running;
    context.currentTime = TimeKeeper.getFormattedTime();
    context.currentDate = TimeKeeper.getFormattedDate();
    context.increments = Object.entries(getTimeIncrements()).map(([key, seconds]) => ({ key, label: this.#formatIncrementLabel(key), seconds, selected: key === TimeKeeper.incrementKey }));
    if (calendar) context.calendarData = this._generateMiniCalendarData(calendar, viewedDate);
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
      context.selectedDateNotes = this._getSelectedDateNotes();
      context.selectedDateLabel = this._formatSelectedDate();
    }

    context.showViewNotes = false;
    const checkDate = this._selectedDate || ViewUtils.getCurrentViewedDate(calendar);
    if (checkDate) {
      const allNotes = ViewUtils.getCalendarNotes();
      const visibleNotes = ViewUtils.getVisibleNotes(allNotes);
      const noteCount = this._countNotesOnDay(visibleNotes, checkDate.year, checkDate.month, checkDate.day);
      context.showViewNotes = noteCount > 0;
    }

    context.weather = this._getWeatherContext();
    context.searchOpen = this.#searchOpen;
    context.searchTerm = this.#searchTerm;
    context.searchResults = this.#searchResults || [];
    if (calendar && calendar.cycles?.length) {
      const yearZeroOffset = calendar.years?.yearZero ?? 0;
      const viewedComponents = { year: viewedDate.year - yearZeroOffset, month: viewedDate.month, dayOfMonth: (viewedDate.day ?? 1) - 1, hour: 12, minute: 0, second: 0 };
      const cycleResult = calendar.getCycleValues(viewedComponents);
      context.cycleText = cycleResult.text;
      context.cycleValues = cycleResult.values;
    }

    return context;
  }

  /**
   * Get weather context for template.
   * @returns {object|null} Weather context or null if no weather set
   */
  _getWeatherContext() {
    const weather = WeatherManager.getCurrentWeather();
    if (!weather) return null;

    return {
      id: weather.id,
      label: localize(weather.label),
      icon: weather.icon,
      color: weather.color,
      temperature: WeatherManager.formatTemperature(WeatherManager.getTemperature()),
      tooltip: weather.description ? localize(weather.description) : localize(weather.label)
    };
  }

  /**
   * Generate simplified calendar data for the mini month grid.
   * @param {object} calendar - The calendar
   * @param {object} date - The viewed date
   * @returns {object} Calendar grid data
   */
  _generateMiniCalendarData(calendar, date) {
    const { year, month } = date;
    const monthData = calendar.months?.values?.[month];
    if (!monthData) return null;
    const daysInMonth = monthData.days;
    const daysInWeek = calendar.days?.values?.length || 7;
    const weeks = [];
    let currentWeek = [];
    const allNotes = ViewUtils.getCalendarNotes();
    const visibleNotes = ViewUtils.getVisibleNotes(allNotes);
    const hasFixedStart = monthData?.startingWeekday != null;
    const startDayOfWeek = hasFixedStart ? monthData.startingWeekday : dayOfWeek({ year, month, day: 1 });
    if (startDayOfWeek > 0) {
      const totalMonths = calendar.months?.values?.length ?? 12;
      const prevDays = [];
      let remainingSlots = startDayOfWeek;
      let checkMonth = month;
      let checkYear = year;
      while (remainingSlots > 0) {
        checkMonth = checkMonth === 0 ? totalMonths - 1 : checkMonth - 1;
        if (checkMonth === totalMonths - 1) checkYear--;
        const checkMonthData = calendar.months?.values?.[checkMonth];
        const checkMonthDays = checkMonthData?.days ?? 30;
        const daysToTake = Math.min(remainingSlots, checkMonthDays);
        for (let d = checkMonthDays - daysToTake + 1; d <= checkMonthDays; d++) prevDays.unshift({ day: d, year: checkYear, month: checkMonth });
        remainingSlots -= daysToTake;
      }

      for (const pd of prevDays) currentWeek.push({ day: pd.day, year: pd.year, month: pd.month, isFromOtherMonth: true, isToday: ViewUtils.isToday(pd.year, pd.month, pd.day, calendar) });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const noteCount = this._countNotesOnDay(visibleNotes, year, month, day);
      const festivalDay = calendar.findFestivalDay({ year, month, dayOfMonth: day - 1 });
      const moonData = ViewUtils.getFirstMoonPhase(calendar, year, month, day);

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
        moonIcon: moonData?.icon ?? null,
        moonPhase: moonData?.tooltip ?? null,
        moonColor: moonData?.color ?? null
      });

      if (currentWeek.length === daysInWeek) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    if (currentWeek.length > 0 && currentWeek.length < daysInWeek) {
      const totalMonths = calendar.months?.values?.length ?? 12;
      let remainingSlots = daysInWeek - currentWeek.length;
      let checkMonth = month;
      let checkYear = year;
      let dayInMonth = 1;

      while (remainingSlots > 0) {
        if (dayInMonth > (calendar.months?.values?.[checkMonth]?.days ?? 30) || checkMonth === month) {
          checkMonth = checkMonth === totalMonths - 1 ? 0 : checkMonth + 1;
          if (checkMonth === 0) checkYear++;
          dayInMonth = 1;
        }

        const checkMonthDays = calendar.months?.values?.[checkMonth]?.days ?? 30;
        const daysToTake = Math.min(remainingSlots, checkMonthDays - dayInMonth + 1);
        for (let d = dayInMonth; d < dayInMonth + daysToTake; d++) {
          currentWeek.push({ day: d, year: checkYear, month: checkMonth, isFromOtherMonth: true, isToday: ViewUtils.isToday(checkYear, checkMonth, d, calendar) });
        }
        dayInMonth += daysToTake;
        remainingSlots -= daysToTake;
      }
    }

    if (currentWeek.length > 0) weeks.push(currentWeek);
    const viewedComponents = { month, dayOfMonth: Math.floor(daysInMonth / 2) };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();
    const monthWeekdays = calendar.getWeekdaysForMonth?.(month) ?? calendar.days?.values ?? [];

    // Format header using display settings
    const headerComponents = { year, month, dayOfMonth: 1 };
    const formattedHeader = formatForLocation(calendar, headerComponents, 'miniCalendarHeader');

    return {
      year,
      month,
      monthName: localize(monthData.name),
      yearDisplay: calendar.formatYearWithEra?.(year) ?? String(year),
      formattedHeader,
      currentSeason,
      currentEra,
      weeks,
      daysInWeek,
      weekdays: monthWeekdays.map((wd) => ({ name: localize(wd.name).substring(0, 2), isRestDay: wd.isRestDay || false }))
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
   * @returns {object[]} Array of note objects for the selected date
   */
  _getSelectedDateNotes() {
    if (!this._selectedDate) return [];
    const { year, month, day } = this._selectedDate;
    const notes = ViewUtils.getNotesOnDay(year, month, day);
    return notes
      .map((page) => {
        const start = page.system.startDate;
        const end = page.system.endDate;
        const isAllDay = page.system.allDay;
        const icon = page.system.icon || 'fas fa-sticky-note';
        const color = page.system.color || '#4a90e2';
        let timeLabel = '';
        if (isAllDay) {
          timeLabel = localize('CALENDARIA.MiniCalendar.AllDay');
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
    const monthData = calendar.months?.values?.[month];
    const monthName = monthData ? localize(monthData.name) : '';
    const yearDisplay = calendar.formatYearWithEra?.(year) ?? String(year);
    return `${monthName} ${day}, ${yearDisplay}`;
  }

  /**
   * Format hour and minute as time string.
   * @param {number} hour - Hour (0-23)
   * @param {number} minute - Minute (0-59)
   * @returns {string} Formatted time string (e.g., "14:30")
   */
  _formatTime(hour, minute) {
    const h = (hour ?? 0).toString().padStart(2, '0');
    const m = (minute ?? 0).toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  /* -------------------------------------------- */
  /*  Lifecycle                                   */
  /* -------------------------------------------- */

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.#restorePosition();
    this.#enableDragging();
    this.element.querySelector('[data-action="increment"]')?.addEventListener('change', (event) => {
      TimeKeeper.setIncrement(event.target.value);
    });
    if (!this.#timeHookId) this.#timeHookId = Hooks.on('updateWorldTime', this.#onUpdateWorldTime.bind(this));
    if (!this.#hooks.some((h) => h.name === HOOKS.CLOCK_START_STOP)) this.#hooks.push({ name: HOOKS.CLOCK_START_STOP, id: Hooks.on(HOOKS.CLOCK_START_STOP, this.#onClockStateChange.bind(this)) });
    const container = this.element.querySelector('.mini-calendar-container');
    const sidebar = this.element.querySelector('.mini-sidebar');
    if (container && sidebar) {
      container.addEventListener('mouseenter', () => {
        clearTimeout(this.#sidebarTimeout);
        this.#sidebarVisible = true;
        sidebar.classList.add('visible');
      });
      container.addEventListener('mouseleave', () => {
        if (this.#sidebarLocked || this.#stickySidebar) return;
        const delay = game.settings.get(MODULE.ID, SETTINGS.MINI_CALENDAR_CONTROLS_DELAY) * 1000;
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
        const delay = game.settings.get(MODULE.ID, SETTINGS.MINI_CALENDAR_CONTROLS_DELAY) * 1000;
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
  }

  /** @override */
  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    this.#restoreStickyStates();
    this.#lastDay = ViewUtils.getCurrentViewedDate(this.calendar)?.day;
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
      name: 'deleteJournalEntryPage',
      id: Hooks.on('deleteJournalEntryPage', (page) => {
        if (page.type === 'calendaria.calendarnote') debouncedRender();
      })
    });

    this.#hooks.push({ name: HOOKS.WEATHER_CHANGE, id: Hooks.on(HOOKS.WEATHER_CHANGE, () => debouncedRender()) });
    this.#hooks.push({ name: 'calendaria.displayFormatsChanged', id: Hooks.on('calendaria.displayFormatsChanged', () => this.render()) });
  }

  /** @override */
  async _onClose(options) {
    if (this.#timeHookId) {
      Hooks.off('updateWorldTime', this.#timeHookId);
      this.#timeHookId = null;
    }
    this.#hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
    this.#hooks = [];
    if (this.#clickOutsideHandler) {
      document.removeEventListener('mousedown', this.#clickOutsideHandler);
      this.#clickOutsideHandler = null;
    }
    await super._onClose(options);
  }

  /* -------------------------------------------- */
  /*  Position & Dragging                         */
  /* -------------------------------------------- */

  /**
   * Restore saved position from settings.
   */
  #restorePosition() {
    const savedPos = game.settings.get(MODULE.ID, SETTINGS.MINI_CALENDAR_POSITION);
    if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
      this.setPosition({ left: savedPos.left, top: savedPos.top });
    } else {
      const rect = this.element.getBoundingClientRect();
      const players = document.getElementById('players');
      const playersTop = players?.getBoundingClientRect().top ?? window.innerHeight - 100;
      const left = 16;
      const top = playersTop - rect.height - 16;
      this.setPosition({ left, top });
    }
  }

  /**
   * Restore sticky states from settings.
   */
  #restoreStickyStates() {
    const states = game.settings.get(MODULE.ID, SETTINGS.MINI_CALENDAR_STICKY_STATES);
    if (!states) return;
    this.#stickyTimeControls = states.timeControls ?? false;
    this.#stickySidebar = states.sidebar ?? false;
    this.#stickyPosition = states.position ?? false;
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
    this._updatePinButtonState();
  }

  /**
   * Save sticky states to settings.
   */
  async #saveStickyStates() {
    await game.settings.set(MODULE.ID, SETTINGS.MINI_CALENDAR_STICKY_STATES, { timeControls: this.#stickyTimeControls, sidebar: this.#stickySidebar, position: this.#stickyPosition });
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
    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
      if (this.#stickyPosition) return;
      const rect = this.element.getBoundingClientRect();
      elementStartLeft = rect.left;
      elementStartTop = rect.top;
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
      let newLeft = elementStartLeft + deltaX;
      let newTop = elementStartTop + deltaY;
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
      this.setPosition({ left: newLeft, top: newTop });
    };

    drag._onDragMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener(...drag.handlers.dragMove);
      window.removeEventListener(...drag.handlers.dragUp);
      await game.settings.set(MODULE.ID, SETTINGS.MINI_CALENDAR_POSITION, { left: this.position.left, top: this.position.top });
    };
  }

  /* -------------------------------------------- */
  /*  Time Updates                                */
  /* -------------------------------------------- */

  /**
   * Handle world time updates.
   */
  #onUpdateWorldTime() {
    if (!this.rendered) return;
    const timeEl = this.element.querySelector('.time-value');
    const dateEl = this.element.querySelector('.date-value');
    const calendar = this.calendar;
    const components = game.time.components;
    if (timeEl && calendar) {
      timeEl.textContent = formatForLocation(calendar, { ...components, dayOfMonth: (components.dayOfMonth ?? 0) + 1 }, 'miniCalendarTime');
    }
    if (dateEl) dateEl.textContent = TimeKeeper.getFormattedDate();
    const currentDay = ViewUtils.getCurrentViewedDate(this.calendar)?.day;
    if (currentDay !== this.#lastDay) {
      this.#lastDay = currentDay;
      this.render();
    }
  }

  /**
   * Handle clock state changes (from other sources like TimeKeeperHUD).
   */
  #onClockStateChange() {
    if (!this.rendered) return;
    const running = TimeKeeper.running;
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

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Navigate to the next or previous month.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onNavigate(_event, target) {
    const direction = target.dataset.direction === 'next' ? 1 : -1;
    const current = this.viewedDate;
    const calendar = this.calendar;
    let newMonth = current.month + direction;
    let newYear = current.year;
    if (newMonth >= calendar.months.values.length) {
      newMonth = 0;
      newYear++;
    } else if (newMonth < 0) {
      newMonth = calendar.months.values.length - 1;
      newYear--;
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
   * @param {PointerEvent} event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async _onSelectDay(event, target) {
    const wasDoubleClick = await ViewUtils.handleDayClick(event, this.calendar, {
      onSetDate: () => {
        this._selectedDate = null;
        this.render();
      },
      onCreateNote: () => this.render()
    });
    if (wasDoubleClick) return;
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
   * Open the full calendar application.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onOpenFull(_event, _target) {
    await this.close();
    new CalendarApplication().render(true);
  }

  /**
   * Toggle the clock running state.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onToggleClock(_event, _target) {
    TimeKeeper.toggle();
    const timeToggle = this.element.querySelector('.time-toggle');
    if (timeToggle) {
      timeToggle.classList.toggle('active', TimeKeeper.running);
      const icon = timeToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-play', !TimeKeeper.running);
        icon.classList.toggle('fa-pause', TimeKeeper.running);
      }
      timeToggle.dataset.tooltip = TimeKeeper.running ? localize('CALENDARIA.TimeKeeper.Stop') : localize('CALENDARIA.TimeKeeper.Start');
    }
  }

  /**
   * Advance time forward by one increment.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onForward(_event, _target) {
    TimeKeeper.forward();
  }

  /**
   * Advance time forward by five increments.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onForward5x(_event, _target) {
    TimeKeeper.forward(5);
  }

  /**
   * Reverse time by one increment.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onReverse(_event, _target) {
    TimeKeeper.reverse();
  }

  /**
   * Reverse time by five increments.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static _onReverse5x(_event, _target) {
    TimeKeeper.reverse(5);
  }

  /**
   * Set the current world date to the selected date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async _onSetCurrentDate(_event, _target) {
    if (!this._selectedDate) return;
    await ViewUtils.setDateTo(this._selectedDate.year, this._selectedDate.month, this._selectedDate.day, this.calendar);
    this._selectedDate = null;
    await this.render();
  }

  /**
   * Show sticky options context menu.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static _onToggleLock(_event, target) {
    if (this.#stickyMenu) {
      this.#stickyMenu.close();
      this.#stickyMenu = null;
      return;
    }

    const ContextMenu = foundry.applications.ux.ContextMenu.implementation;
    const toggleTime = this._toggleStickyTimeControls.bind(this);
    const toggleSidebar = this._toggleStickySidebar.bind(this);
    const togglePosition = this._toggleStickyPosition.bind(this);
    const menuItems = [
      { name: 'CALENDARIA.MiniCalendar.StickyTimeControls', icon: `<i class="fas fa-clock"></i>`, callback: toggleTime, classes: this.#stickyTimeControls ? ['sticky-active'] : [] },
      { name: 'CALENDARIA.MiniCalendar.StickySidebar', icon: `<i class="fas fa-bars"></i>`, callback: toggleSidebar, classes: this.#stickySidebar ? ['sticky-active'] : [] },
      { name: 'CALENDARIA.MiniCalendar.StickyPosition', icon: `<i class="fas fa-lock"></i>`, callback: togglePosition, classes: this.#stickyPosition ? ['sticky-active'] : [] }
    ];

    this.#stickyMenu = new ContextMenu(this.element, '.pin-btn', menuItems, {
      fixed: true,
      jQuery: false,
      onClose: () => {
        this.#stickyMenu = null;
      }
    });
    this.#stickyMenu.render(target);
  }

  /**
   * Toggle sticky time controls.
   */
  _toggleStickyTimeControls() {
    this.#stickyTimeControls = !this.#stickyTimeControls;
    const timeControls = this.element.querySelector('.mini-time-controls');
    if (this.#stickyTimeControls) {
      clearTimeout(this.#hideTimeout);
      timeControls?.classList.add('visible');
      this.#controlsVisible = true;
    } else {
      const delay = game.settings.get(MODULE.ID, SETTINGS.MINI_CALENDAR_CONTROLS_DELAY) * 1000;
      this.#hideTimeout = setTimeout(() => {
        this.#controlsVisible = false;
        timeControls?.classList.remove('visible');
      }, delay);
    }

    this._updatePinButtonState();
    this.#saveStickyStates();
  }

  /**
   * Toggle sticky sidebar.
   */
  _toggleStickySidebar() {
    this.#stickySidebar = !this.#stickySidebar;
    const sidebar = this.element.querySelector('.mini-sidebar');
    const shouldBeLocked = this.#stickySidebar || this.#sidebarLocked;
    sidebar?.classList.toggle('locked', shouldBeLocked);
    if (this.#stickySidebar) {
      clearTimeout(this.#sidebarTimeout);
      sidebar?.classList.add('visible');
      this.#sidebarVisible = true;
    } else if (!this.#sidebarLocked) {
      const delay = game.settings.get(MODULE.ID, SETTINGS.MINI_CALENDAR_CONTROLS_DELAY) * 1000;
      this.#sidebarTimeout = setTimeout(() => {
        this.#sidebarVisible = false;
        sidebar?.classList.remove('visible');
      }, delay);
    }

    this._updatePinButtonState();
    this.#saveStickyStates();
  }

  /**
   * Toggle sticky position (locks calendar in place).
   */
  _toggleStickyPosition() {
    this.#stickyPosition = !this.#stickyPosition;
    this._updatePinButtonState();
    this.#saveStickyStates();
  }

  /**
   * Update pin button visual state based on active sticky modes.
   */
  _updatePinButtonState() {
    const pinBtn = this.element.querySelector('.pin-btn');
    const topRow = this.element.querySelector('.mini-top-row');
    if (pinBtn) {
      const hasAnySticky = this.#stickyTimeControls || this.#stickySidebar || this.#stickyPosition;
      pinBtn.classList.toggle('has-sticky', hasAnySticky);
      pinBtn.classList.toggle('sticky-time', this.#stickyTimeControls);
      pinBtn.classList.toggle('sticky-sidebar', this.#stickySidebar);
      pinBtn.classList.toggle('sticky-position', this.#stickyPosition);
    }
    if (topRow) topRow.classList.toggle('position-locked', this.#stickyPosition);
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
    const targetHour = calendar.sunrise();
    if (targetHour === null) return;
    await this.#advanceToHour(targetHour);
  }

  /**
   * Advance time to solar midday (midpoint between sunrise and sunset).
   */
  static async _onToMidday() {
    const calendar = this.calendar;
    const targetHour = calendar?.solarMidday?.() ?? (game.time.calendar?.days?.hoursPerDay ?? 24) / 2;
    await this.#advanceToHour(targetHour);
  }

  /**
   * Advance time to sunset.
   */
  static async _onToSunset() {
    const calendar = this.calendar;
    if (!calendar?.sunset) return;
    const targetHour = calendar.sunset();
    if (targetHour === null) return;
    await this.#advanceToHour(targetHour);
  }

  /**
   * Advance time to solar midnight (midpoint of night period).
   */
  static async _onToMidnight() {
    const calendar = this.calendar;
    if (calendar?.solarMidnight) {
      const targetHour = calendar.solarMidnight();
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
    if (!game.user.isGM) return;
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
    if (secondsToAdvance > 0) await game.time.advance(secondsToAdvance);
  }

  /**
   * Cycle through weather presets or open weather picker.
   * For now, generates new weather based on climate/season.
   */
  static async _onOpenWeatherPicker() {
    if (!game.user.isGM) return;
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
          if (r.data?.repeatIcon) icons.push(`<i class="result-repeat-icon ${r.data.repeatIcon}" data-tooltip="${r.data.repeatTooltip || ''}"></i>`);
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

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

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

  /* -------------------------------------------- */
  /*  Static Methods                              */
  /* -------------------------------------------- */

  /**
   * Show the MiniCalendar singleton.
   * @returns {MiniCalendar} The singleton instance
   */
  static show() {
    if (!this._instance) this._instance = new MiniCalendar();
    this._instance.render(true);
    return this._instance;
  }

  /**
   * Hide the MiniCalendar.
   */
  static hide() {
    this._instance?.close();
  }

  /**
   * Toggle the MiniCalendar visibility.
   */
  static toggle() {
    if (this._instance?.rendered) this.hide();
    else this.show();
  }

  /**
   * Get the singleton instance.
   * @returns {MiniCalendar|null} The singleton instance or null if not created
   */
  static get instance() {
    return this._instance;
  }

  /**
   * Refresh sticky states from settings on the current instance.
   * Called when settings change externally (e.g., from settings panel).
   */
  static refreshStickyStates() {
    this._instance?.#restoreStickyStates();
  }
}
