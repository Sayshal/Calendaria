/**
 * Compact Calendar - All-in-one calendar widget with timekeeping.
 * Frameless, draggable, with persistent position and open state.
 *
 * @module Applications/CompactCalendar
 * @author Tyler
 */

import { MODULE, SETTINGS, TEMPLATES, HOOKS } from '../constants.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import NoteManager from '../notes/note-manager.mjs';
import TimeKeeper, { getTimeIncrements } from '../time/time-keeper.mjs';
import { dayOfWeek } from '../notes/utils/date-utils.mjs';
import { isRecurringMatch } from '../notes/utils/recurrence.mjs';
import { CalendarApplication } from './calendar-application.mjs';
import * as ViewUtils from './calendar-view-utils.mjs';
import WeatherManager from '../weather/weather-manager.mjs';
import { openWeatherPicker } from '../weather/weather-picker.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Compact calendar widget combining mini month view with time controls.
 */
export class CompactCalendar extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {CompactCalendar|null} Singleton instance */
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

  /** @type {ContextMenu|null} Active sticky options menu */
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

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'compact-calendar',
    classes: ['calendaria', 'compact-calendar'],
    position: { width: 'auto', height: 'auto', zIndex: 250 },
    window: { frame: false, positioned: true },
    actions: {
      navigate: CompactCalendar._onNavigate,
      today: CompactCalendar._onToday,
      selectDay: CompactCalendar._onSelectDay,
      addNote: CompactCalendar._onAddNote,
      openFull: CompactCalendar._onOpenFull,
      toggle: CompactCalendar._onToggleClock,
      forward: CompactCalendar._onForward,
      forward5x: CompactCalendar._onForward5x,
      reverse: CompactCalendar._onReverse,
      reverse5x: CompactCalendar._onReverse5x,
      setCurrentDate: CompactCalendar._onSetCurrentDate,
      toggleLock: CompactCalendar._onToggleLock,
      viewNotes: CompactCalendar._onViewNotes,
      closeNotesPanel: CompactCalendar._onCloseNotesPanel,
      openNote: CompactCalendar._onOpenNote,
      editNote: CompactCalendar._onEditNote,
      toSunrise: CompactCalendar._onToSunrise,
      toMidday: CompactCalendar._onToMidday,
      toSunset: CompactCalendar._onToSunset,
      toMidnight: CompactCalendar._onToMidnight,
      openWeatherPicker: CompactCalendar._onOpenWeatherPicker
    }
  };

  /** @override */
  static PARTS = { main: { template: TEMPLATES.COMPACT_CALENDAR } };

  /* -------------------------------------------- */
  /*  Properties                                  */
  /* -------------------------------------------- */

  /**
   * Get the active calendar.
   * @returns {CalendariaCalendar}
   */
  get calendar() {
    return CalendarManager.getActiveCalendar();
  }

  /**
   * Get the date being viewed (month/year).
   * @returns {object}
   */
  get viewedDate() {
    if (this._viewedDate) return this._viewedDate;
    return ViewUtils.getCurrentViewedDate(this.calendar);
  }

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

    // Time increment dropdown
    context.increments = Object.entries(getTimeIncrements()).map(([key, seconds]) => ({
      key,
      label: this._formatIncrement(key),
      seconds,
      selected: key === TimeKeeper.incrementKey
    }));

    if (calendar) context.calendarData = this._generateMiniCalendarData(calendar, viewedDate);

    // Show "Set Current Date" button if selected date differs from today (GM only)
    context.showSetCurrentDate = false;
    if (game.user.isGM && this._selectedDate) {
      const today = ViewUtils.getCurrentViewedDate(calendar);
      context.showSetCurrentDate = this._selectedDate.year !== today.year || this._selectedDate.month !== today.month || this._selectedDate.day !== today.day;
    }

    // Pass visibility states to template to prevent flicker on re-render
    context.sidebarVisible = this.#sidebarVisible || this.#sidebarLocked || this.#stickySidebar;
    context.controlsVisible = this.#controlsVisible || this.#stickyTimeControls;
    context.controlsLocked = this.#stickyTimeControls;
    context.notesPanelVisible = this.#notesPanelVisible;
    context.sidebarLocked = this.#sidebarLocked || this.#stickySidebar;
    context.stickyTimeControls = this.#stickyTimeControls;
    context.stickySidebar = this.#stickySidebar;
    context.stickyPosition = this.#stickyPosition;
    context.hasAnyStickyMode = this.#stickyTimeControls || this.#stickySidebar || this.#stickyPosition;

    // Get notes for selected date if notes panel is visible
    if (this.#notesPanelVisible && this._selectedDate) {
      context.selectedDateNotes = this._getSelectedDateNotes();
      context.selectedDateLabel = this._formatSelectedDate();
    }

    // Show view notes button if selected date has notes
    context.showViewNotes = false;
    if (this._selectedDate) {
      const allNotes = ViewUtils.getCalendarNotes();
      const visibleNotes = ViewUtils.getVisibleNotes(allNotes);
      const noteCount = this._countNotesOnDay(visibleNotes, this._selectedDate.year, this._selectedDate.month, this._selectedDate.day);
      context.showViewNotes = noteCount > 0;
    }

    // Weather badge data
    context.weather = this._getWeatherContext();

    // Get cycle values for display in header (based on viewed date, not world time)
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
      label: game.i18n.localize(weather.label),
      icon: weather.icon,
      color: weather.color,
      temperature: WeatherManager.formatTemperature(WeatherManager.getTemperature()),
      tooltip: weather.description ? game.i18n.localize(weather.description) : game.i18n.localize(weather.label)
    };
  }

  /**
   * Generate simplified calendar data for the mini month grid.
   * @param {CalendariaCalendar} calendar - The calendar
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

    // Get visible notes using shared utility
    const allNotes = ViewUtils.getCalendarNotes();
    const visibleNotes = ViewUtils.getVisibleNotes(allNotes);

    // Calculate starting day of week
    // If month has startingWeekday set, use that; otherwise calculate normally
    const hasFixedStart = monthData?.startingWeekday != null;
    const startDayOfWeek = hasFixedStart ? monthData.startingWeekday : dayOfWeek({ year, month, day: 1 });

    // Add empty cells before month starts
    for (let i = 0; i < startDayOfWeek; i++) currentWeek.push({ empty: true });

    // Add days
    for (let day = 1; day <= daysInMonth; day++) {
      const noteCount = this._countNotesOnDay(visibleNotes, year, month, day);
      const festivalDay = calendar.findFestivalDay({ year, month, dayOfMonth: day - 1 });

      // Get first moon phase only using shared utility
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
        festivalName: festivalDay ? game.i18n.localize(festivalDay.name) : null,
        moonIcon: moonData?.icon ?? null,
        moonPhase: moonData?.tooltip ?? null,
        moonColor: moonData?.color ?? null
      });

      if (currentWeek.length === daysInWeek) {
        weeks.push(currentWeek);
        currentWeek = [];
      }
    }

    // Fill remaining empty cells
    while (currentWeek.length > 0 && currentWeek.length < daysInWeek) currentWeek.push({ empty: true });

    if (currentWeek.length > 0) weeks.push(currentWeek);

    // Get season and era for the viewed month (use mid-month day for accuracy)
    const viewedComponents = { month, dayOfMonth: Math.floor(daysInMonth / 2) };
    const currentSeason = ViewUtils.enrichSeasonData(calendar.getCurrentSeason?.(viewedComponents));
    const currentEra = calendar.getCurrentEra?.();

    return {
      year,
      month,
      monthName: game.i18n.localize(monthData.name),
      yearDisplay: calendar.formatYearWithEra?.(year) ?? String(year),
      currentSeason,
      currentEra,
      weeks,
      daysInWeek,
      weekdays:
        calendar.days?.values?.map((wd) => {
          const name = game.i18n.localize(wd.name);
          return name.substring(0, 2); // First 2 chars for compact view
        }) || []
    };
  }

  /**
   * Check if a date is selected.
   * @param {number} year - Display year
   * @param {number} month - Month
   * @param {number} day - Day (1-indexed)
   * @returns {boolean}
   */
  _isSelected(year, month, day) {
    if (!this._selectedDate) return false;
    return this._selectedDate.year === year && this._selectedDate.month === month && this._selectedDate.day === day;
  }

  /**
   * Count notes on a specific day.
   * @param {JournalEntryPage[]} notes - Visible notes
   * @param {number} year - Year
   * @param {number} month - Month
   * @param {number} day - Day (1-indexed)
   * @returns {number}
   */
  _countNotesOnDay(notes, year, month, day) {
    const targetDate = { year, month, day };
    return notes.filter((page) => {
      // Build noteData from page.system for recurrence check
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
        linkedEvent: page.system.linkedEvent
      };
      return isRecurringMatch(noteData, targetDate);
    }).length;
  }

  /**
   * Get notes for the selected date, sorted by time (all-day first, then by start time).
   * @returns {object[]}
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

        // Format time range
        let timeLabel = '';
        if (isAllDay) {
          timeLabel = game.i18n.localize('CALENDARIA.CompactCalendar.AllDay');
        } else {
          const startTime = this._formatTime(start.hour, start.minute);
          const endTime = this._formatTime(end.hour, end.minute);
          timeLabel = `${startTime} - ${endTime}`;
        }

        // Get author name from author document
        const authorName = page.system.author?.name || game.i18n.localize('CALENDARIA.CompactCalendar.Unknown');

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
        // All-day events first
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        // Then by start time
        if (a.startHour !== b.startHour) return a.startHour - b.startHour;
        return a.startMinute - b.startMinute;
      });
  }

  /**
   * Format the selected date as a label.
   * @returns {string}
   */
  _formatSelectedDate() {
    if (!this._selectedDate) return '';
    const { year, month, day } = this._selectedDate;
    const calendar = this.calendar;
    const monthData = calendar.months?.values?.[month];
    const monthName = monthData ? game.i18n.localize(monthData.name) : '';
    const yearDisplay = calendar.formatYearWithEra?.(year) ?? String(year);
    return `${monthName} ${day}, ${yearDisplay}`;
  }

  /**
   * Format hour and minute as time string.
   * @param {number} hour - Hour (0-23)
   * @param {number} minute - Minute (0-59)
   * @returns {string}
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

    // Restore position
    this.#restorePosition();

    // Enable dragging
    this.#enableDragging();

    // Increment selector listener
    this.element.querySelector('[data-action="increment"]')?.addEventListener('change', (event) => {
      TimeKeeper.setIncrement(event.target.value);
    });

    // Set up time update hook
    if (!this.#timeHookId) this.#timeHookId = Hooks.on('updateWorldTime', this.#onUpdateWorldTime.bind(this));

    // Clock state hook
    Hooks.on(HOOKS.CLOCK_START_STOP, this.#onClockStateChange.bind(this));

    // Sidebar auto-hide (respects lock state and sticky sidebar)
    const container = this.element.querySelector('.compact-calendar-container');
    const sidebar = this.element.querySelector('.compact-sidebar');
    if (container && sidebar) {
      container.addEventListener('mouseenter', () => {
        clearTimeout(this.#sidebarTimeout);
        this.#sidebarVisible = true;
        sidebar.classList.add('visible');
      });
      container.addEventListener('mouseleave', () => {
        if (this.#sidebarLocked || this.#stickySidebar) return;
        const delay = game.settings.get(MODULE.ID, SETTINGS.COMPACT_CONTROLS_DELAY) * 1000;
        this.#sidebarTimeout = setTimeout(() => {
          this.#sidebarVisible = false;
          sidebar.classList.remove('visible');
        }, delay);
      });
    }

    // Time controls auto-hide (GM only)
    const timeDisplay = this.element.querySelector('.compact-time-display');
    const timeControls = this.element.querySelector('.compact-time-controls');
    if (timeDisplay && timeControls) {
      const showControls = () => {
        clearTimeout(this.#hideTimeout);
        this.#controlsVisible = true;
        timeControls.classList.add('visible');
      };
      const hideControls = () => {
        if (this.#stickyTimeControls) return;
        const delay = game.settings.get(MODULE.ID, SETTINGS.COMPACT_CONTROLS_DELAY) * 1000;
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

    // Restore sticky states from settings
    this.#restoreStickyStates();

    // Initialize day tracking for re-render optimization
    this.#lastDay = ViewUtils.getCurrentViewedDate(this.calendar)?.day;

    // Set up context menu for day cells
    ViewUtils.setupDayContextMenu(this.element, '.compact-day:not(.empty)', this.calendar, {
      onSetDate: () => {
        this._selectedDate = null;
        this.render();
      },
      onCreateNote: () => this.render()
    });

    // Debounced render for note changes
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

    // Weather change hook
    this.#hooks.push({
      name: HOOKS.WEATHER_CHANGE,
      id: Hooks.on(HOOKS.WEATHER_CHANGE, () => debouncedRender())
    });
  }

  /** @override */
  async _onClose(options) {
    // Cleanup hooks
    if (this.#timeHookId) {
      Hooks.off('updateWorldTime', this.#timeHookId);
      this.#timeHookId = null;
    }

    this.#hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
    this.#hooks = [];

    await super._onClose(options);
  }

  /* -------------------------------------------- */
  /*  Position & Dragging                         */
  /* -------------------------------------------- */

  /**
   * Restore saved position from settings.
   */
  #restorePosition() {
    const savedPos = game.settings.get(MODULE.ID, SETTINGS.COMPACT_CALENDAR_POSITION);

    if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
      // Use setPosition to properly update internal position state
      this.setPosition({ left: savedPos.left, top: savedPos.top });
    } else {
      // Default position: top right (calculate from viewport)
      const rect = this.element.getBoundingClientRect();
      const left = window.innerWidth - rect.width - 310;
      const top = 10;
      this.setPosition({ left, top });
    }
  }

  /**
   * Restore sticky states from settings.
   */
  #restoreStickyStates() {
    const states = game.settings.get(MODULE.ID, SETTINGS.COMPACT_STICKY_STATES);
    if (!states) return;

    this.#stickyTimeControls = states.timeControls ?? false;
    this.#stickySidebar = states.sidebar ?? false;
    this.#stickyPosition = states.position ?? false;

    // Apply restored states
    if (this.#stickyTimeControls) {
      const timeControls = this.element.querySelector('.compact-time-controls');
      timeControls?.classList.add('visible');
      this.#controlsVisible = true;
    }

    if (this.#stickySidebar) {
      const sidebar = this.element.querySelector('.compact-sidebar');
      sidebar?.classList.add('visible');
      this.#sidebarVisible = true;
    }

    this._updatePinButtonState();
  }

  /**
   * Save sticky states to settings.
   */
  async #saveStickyStates() {
    await game.settings.set(MODULE.ID, SETTINGS.COMPACT_STICKY_STATES, { timeControls: this.#stickyTimeControls, sidebar: this.#stickySidebar, position: this.#stickyPosition });
  }

  /**
   * Enable dragging on the top row.
   */
  #enableDragging() {
    const dragHandle = this.element.querySelector('.compact-top-row');
    if (!dragHandle) return;

    const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, dragHandle, false);

    let dragStartX = 0;
    let dragStartY = 0;
    let elementStartLeft = 0;
    let elementStartTop = 0;

    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
      // Prevent dragging when position is locked
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

      // Clamp to viewport
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));

      // Use setPosition to properly update internal position state
      this.setPosition({ left: newLeft, top: newTop });
    };

    drag._onDragMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener(...drag.handlers.dragMove);
      window.removeEventListener(...drag.handlers.dragUp);

      // Save position from internal state
      await game.settings.set(MODULE.ID, SETTINGS.COMPACT_CALENDAR_POSITION, { left: this.position.left, top: this.position.top });
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

    if (timeEl) timeEl.textContent = TimeKeeper.getFormattedTime();
    if (dateEl) dateEl.textContent = TimeKeeper.getFormattedDate();

    // Only re-render if day changed (to update today highlight)
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
    const tooltip = running ? game.i18n.localize('CALENDARIA.TimeKeeper.Stop') : game.i18n.localize('CALENDARIA.TimeKeeper.Start');

    // Update time-toggle in time-display
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

  static async _onNavigate(event, target) {
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

  static async _onToday(event, target) {
    this._viewedDate = null;
    this._selectedDate = null;
    await this.render();
  }

  static async _onSelectDay(event, target) {
    // Check for double-click first (manual detection since re-render breaks native dblclick)
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

    // Toggle selection
    if (this._selectedDate?.year === year && this._selectedDate?.month === month && this._selectedDate?.day === day) this._selectedDate = null;
    else this._selectedDate = { year, month, day };

    await this.render();
  }

  static async _onAddNote(event, target) {
    // Use selected date or today
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
      name: game.i18n.localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: 12, minute: 0 },
        endDate: { year: parseInt(year), month: parseInt(month), day: parseInt(day), hour: 13, minute: 0 }
      }
    });

    if (page) page.sheet.render(true, { mode: 'edit' });
  }

  static async _onOpenFull(event, target) {
    // Close this compact calendar
    await this.close();

    // Open the full calendar
    new CalendarApplication().render(true);
  }

  static _onToggleClock(event, target) {
    TimeKeeper.toggle();
    // Update time-toggle state directly without re-render
    const timeToggle = this.element.querySelector('.time-toggle');
    if (timeToggle) {
      timeToggle.classList.toggle('active', TimeKeeper.running);
      const icon = timeToggle.querySelector('i');
      if (icon) {
        icon.classList.toggle('fa-play', !TimeKeeper.running);
        icon.classList.toggle('fa-pause', TimeKeeper.running);
      }
      timeToggle.dataset.tooltip = TimeKeeper.running ? game.i18n.localize('CALENDARIA.TimeKeeper.Stop') : game.i18n.localize('CALENDARIA.TimeKeeper.Start');
    }
  }

  static _onForward(event, target) {
    TimeKeeper.forward();
  }

  static _onForward5x(event, target) {
    TimeKeeper.forward(5);
  }

  static _onReverse(event, target) {
    TimeKeeper.reverse();
  }

  static _onReverse5x(event, target) {
    TimeKeeper.reverse(5);
  }

  static async _onSetCurrentDate(event, target) {
    if (!this._selectedDate) return;
    await ViewUtils.setDateTo(this._selectedDate.year, this._selectedDate.month, this._selectedDate.day, this.calendar);
    this._selectedDate = null;
    await this.render();
  }

  /**
   * Show sticky options context menu.
   * @param {PointerEvent} event - Click event
   * @param {HTMLElement} target - Button element
   */
  static _onToggleLock(event, target) {
    // Close menu if already open
    if (this.#stickyMenu) {
      this.#stickyMenu.close();
      this.#stickyMenu = null;
      return;
    }

    const ContextMenu = foundry.applications.ux.ContextMenu.implementation;

    // Bind toggle methods to preserve instance context
    const toggleTime = this._toggleStickyTimeControls.bind(this);
    const toggleSidebar = this._toggleStickySidebar.bind(this);
    const togglePosition = this._toggleStickyPosition.bind(this);

    const menuItems = [
      { name: 'CALENDARIA.CompactCalendar.StickyTimeControls', icon: `<i class="fas fa-clock"></i>`, callback: toggleTime, classes: this.#stickyTimeControls ? ['sticky-active'] : [] },
      { name: 'CALENDARIA.CompactCalendar.StickySidebar', icon: `<i class="fas fa-bars"></i>`, callback: toggleSidebar, classes: this.#stickySidebar ? ['sticky-active'] : [] },
      { name: 'CALENDARIA.CompactCalendar.StickyPosition', icon: `<i class="fas fa-lock"></i>`, callback: togglePosition, classes: this.#stickyPosition ? ['sticky-active'] : [] }
    ];

    // Create and render context menu at button position
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
    const timeControls = this.element.querySelector('.compact-time-controls');

    if (this.#stickyTimeControls) {
      clearTimeout(this.#hideTimeout);
      timeControls?.classList.add('visible');
      this.#controlsVisible = true;
    } else {
      const delay = game.settings.get(MODULE.ID, SETTINGS.COMPACT_CONTROLS_DELAY) * 1000;
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
    const sidebar = this.element.querySelector('.compact-sidebar');

    // Update locked class based on combined state
    const shouldBeLocked = this.#stickySidebar || this.#sidebarLocked;
    sidebar?.classList.toggle('locked', shouldBeLocked);

    if (this.#stickySidebar) {
      clearTimeout(this.#sidebarTimeout);
      sidebar?.classList.add('visible');
      this.#sidebarVisible = true;
    } else if (!this.#sidebarLocked) {
      const delay = game.settings.get(MODULE.ID, SETTINGS.COMPACT_CONTROLS_DELAY) * 1000;
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
    const topRow = this.element.querySelector('.compact-top-row');

    if (pinBtn) {
      const hasAnySticky = this.#stickyTimeControls || this.#stickySidebar || this.#stickyPosition;
      pinBtn.classList.toggle('has-sticky', hasAnySticky);
      pinBtn.classList.toggle('sticky-time', this.#stickyTimeControls);
      pinBtn.classList.toggle('sticky-sidebar', this.#stickySidebar);
      pinBtn.classList.toggle('sticky-position', this.#stickyPosition);
    }

    // Update cursor on drag handle when position is locked
    if (topRow) topRow.classList.toggle('position-locked', this.#stickyPosition);
  }

  /**
   * Open the notes panel for the selected date.
   */
  static async _onViewNotes(event, target) {
    if (!this._selectedDate) return;
    this.#notesPanelVisible = true;
    this.#sidebarLocked = true;
    this.#sidebarVisible = true;
    await this.render();
  }

  /**
   * Close the notes panel.
   */
  static async _onCloseNotesPanel(event, target) {
    this.#notesPanelVisible = false;
    this.#sidebarLocked = false;
    await this.render();
  }

  /**
   * Open a note in view mode.
   * @param {PointerEvent} event - Click event
   * @param {HTMLElement} target - Element with data-page-id and data-journal-id
   */
  static _onOpenNote(event, target) {
    const pageId = target.dataset.pageId;
    const journalId = target.dataset.journalId;
    const journal = game.journal.get(journalId);
    const page = journal?.pages.get(pageId);
    if (page) page.sheet.render(true);
  }

  /**
   * Open a note in edit mode.
   * @param {PointerEvent} event - Click event
   * @param {HTMLElement} target - Element with data-page-id and data-journal-id
   */
  static _onEditNote(event, target) {
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
      // Solar midnight may exceed hoursPerDay, meaning it's technically tomorrow
      if (targetHour >= hoursPerDay) await this.#advanceToHour(targetHour - hoursPerDay, true);
      else await this.#advanceToHour(targetHour);
    } else {
      // Fallback: midnight = 0:00 next day
      await this.#advanceToHour(0, true);
    }
  }

  /**
   * Advance time to a specific hour of day.
   * @param {number} targetHour - Target hour (fractional, e.g. 6.5 = 6:30)
   * @param {boolean} [nextDay=false] - If true, always advance to next day
   */
  static async #advanceToHour(targetHour, nextDay = false) {
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

  /* -------------------------------------------- */
  /*  Helper Methods                              */
  /* -------------------------------------------- */

  /**
   * Format increment key for display.
   * @param {string} key - Increment key
   * @returns {string} Formatted label
   */
  _formatIncrement(key) {
    const labels = {
      second: game.i18n.localize('CALENDARIA.TimeKeeper.Second'),
      round: game.i18n.localize('CALENDARIA.TimeKeeper.Round'),
      minute: game.i18n.localize('CALENDARIA.TimeKeeper.Minute'),
      hour: game.i18n.localize('CALENDARIA.TimeKeeper.Hour'),
      day: game.i18n.localize('CALENDARIA.TimeKeeper.Day'),
      week: game.i18n.localize('CALENDARIA.TimeKeeper.Week'),
      month: game.i18n.localize('CALENDARIA.TimeKeeper.Month'),
      season: game.i18n.localize('CALENDARIA.TimeKeeper.Season'),
      year: game.i18n.localize('CALENDARIA.TimeKeeper.Year')
    };
    return labels[key] || key;
  }

  /* -------------------------------------------- */
  /*  Static Methods                              */
  /* -------------------------------------------- */

  /**
   * Show the compact calendar singleton.
   * @returns {CompactCalendar}
   */
  static show() {
    if (!this._instance) this._instance = new CompactCalendar();
    this._instance.render(true);
    return this._instance;
  }

  /**
   * Hide the compact calendar.
   */
  static hide() {
    this._instance?.close();
  }

  /**
   * Toggle the compact calendar visibility.
   */
  static toggle() {
    if (this._instance?.rendered) this.hide();
    else this.show();
  }

  /**
   * Get the singleton instance.
   * @returns {CompactCalendar|null}
   */
  static get instance() {
    return this._instance;
  }
}
