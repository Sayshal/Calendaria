/**
 * Secondary Calendar Viewer — read-only synced calendar for a non-active calendar.
 * @module Applications/SecondaryCalendar
 * @author Tyler
 */

import { CalendarRegistry, getCurrentDateOn } from '../../calendar/_module.mjs';
import { HOOKS, TEMPLATES } from '../../constants.mjs';
import { dayOfWeek } from '../../notes/_module.mjs';
import { formatCustom, getLeadingDays, localize } from '../../utils/_module.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Lightweight read-only calendar viewer for a non-active calendar.
 */
export class SecondaryCalendar extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {string} The calendar ID being displayed */
  #calendarId;

  /** @type {object|null} Currently viewed month/year */
  #viewedDate = null;

  /** @type {Array<{hook: string, id: number}>} Registered hooks for cleanup */
  #hooks = [];

  /**
   * @param {object} options - Application options
   * @param {string} options.calendarId - Calendar ID to display
   */
  constructor(options = {}) {
    const calendarId = options.calendarId;
    super({ ...options, id: `calendaria-secondary-${calendarId}` });
    this.#calendarId = calendarId;
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    classes: ['calendaria', 'secondary-calendar'],
    tag: 'div',
    window: { frame: true, positioned: true, title: 'Secondary Calendar', resizable: false },
    position: { width: 280, height: 'auto' },
    actions: {
      navigate: SecondaryCalendar.#onNavigate,
      today: SecondaryCalendar.#onToday
    }
  };

  /** @override */
  static PARTS = { main: { template: TEMPLATES.SECONDARY_CALENDAR } };

  /**
   * Get the calendar being viewed.
   * @returns {object|undefined} The calendar instance
   */
  get calendar() {
    return CalendarRegistry.get(this.#calendarId);
  }

  /**
   * Get the current viewed date, defaulting to today on this calendar.
   * @returns {{year: number, month: number}} The viewed date
   */
  get viewedDate() {
    if (this.#viewedDate) return this.#viewedDate;
    const current = getCurrentDateOn(this.#calendarId);
    return current ? { year: current.year, month: current.month } : { year: 0, month: 0 };
  }

  /** @override */
  get title() {
    const cal = this.calendar;
    const name = cal?.name ? localize(cal.name) : this.#calendarId;
    return name;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const calendar = this.calendar;
    if (!calendar) {
      context.calendarName = this.#calendarId;
      context.formattedHeader = '';
      context.calendarData = null;
      context.calendarOptions = this.#getCalendarOptions();
      return context;
    }
    const viewedDate = this.viewedDate;
    context.calendarName = localize(calendar.name) || this.#calendarId;
    const displayComponents = { year: viewedDate.year, month: viewedDate.month, dayOfMonth: 0 };
    context.formattedHeader = formatCustom(calendar, displayComponents, 'MMMM YYYY');
    context.calendarData = this.#generateGridData(calendar, viewedDate);
    context.calendarOptions = this.#getCalendarOptions();
    return context;
  }

  /**
   * Generate a simple month grid for the viewed date.
   * @param {object} calendar - Calendar instance
   * @param {object} date - {year, month}
   * @returns {object} Grid data with weekdays, weeks, intercalaryDays
   */
  #generateGridData(calendar, date) {
    const { year, month } = date;
    const yearZero = calendar.years?.yearZero ?? 0;
    const internalYear = year - yearZero;
    const monthData = calendar.monthsArray[month];
    if (!monthData) return null;
    const daysInMonth = calendar.getDaysInMonth(month, internalYear);
    const daysInWeek = calendar.daysInWeek;
    const weekdays = calendar.weekdaysArray.map((w) => ({ name: localize(w.name), abbreviation: localize(w.abbreviation || w.name).slice(0, 2) }));
    const currentDate = getCurrentDateOn(this.#calendarId);
    const todayYear = currentDate?.year;
    const todayMonth = currentDate?.month;
    const todayDay = currentDate?.dayOfMonth;
    const hasFixedStart = monthData?.startingWeekday != null;
    const startDayOfWeek = hasFixedStart ? monthData.startingWeekday : dayOfWeek({ year, month, dayOfMonth: 0 }, calendar);
    const weeks = [];
    let currentWeek = [];
    const intercalaryDays = [];
    if (startDayOfWeek > 0) {
      const prevDays = getLeadingDays(calendar, year, month, startDayOfWeek);
      for (const pd of prevDays) currentWeek.push({ day: pd.day, isFromOtherMonth: true, isToday: false });
    }
    for (let d = 0; d < daysInMonth; d++) {
      const isToday = year === todayYear && month === todayMonth && d === todayDay;
      const festivalDay = calendar.findFestivalDay({ year: internalYear, month, dayOfMonth: d });
      const isIntercalary = festivalDay?.countsForWeekday === false;
      if (isIntercalary) {
        intercalaryDays.push({ day: d + 1, isToday, festivalName: festivalDay ? localize(festivalDay.name) : '' });
      } else {
        currentWeek.push({ day: d + 1, isToday, isFromOtherMonth: false });
        if (currentWeek.length === daysInWeek) {
          weeks.push(currentWeek);
          currentWeek = [];
        }
      }
    }
    if (currentWeek.length > 0) {
      while (currentWeek.length < daysInWeek) currentWeek.push({ day: '', isFromOtherMonth: true, isToday: false });
      weeks.push(currentWeek);
    }
    return { weekdays, weeks, intercalaryDays };
  }

  /**
   * Build calendar select options excluding the active calendar.
   * @returns {Array<{id: string, name: string, selected: boolean}>} Calendar options
   */
  #getCalendarOptions() {
    const activeId = CalendarRegistry.getActiveId();
    const options = [];
    for (const [id, cal] of CalendarRegistry.getAll()) {
      if (id === activeId) continue;
      options.push({ id, name: localize(cal.name) || id, selected: id === this.#calendarId });
    }
    return options;
  }

  /** @override */
  _onFirstRender(context, options) {
    super._onFirstRender(context, options);
    this.#hooks.push({ hook: HOOKS.WORLD_TIME_UPDATED, id: Hooks.on(HOOKS.WORLD_TIME_UPDATED, () => this.render()) });
    this.#hooks.push({ hook: HOOKS.CALENDAR_SWITCHED, id: Hooks.on(HOOKS.CALENDAR_SWITCHED, () => this.render()) });
    this.#hooks.push({
      hook: HOOKS.CALENDAR_REMOVED,
      id: Hooks.on(HOOKS.CALENDAR_REMOVED, (removedId) => {
        if (removedId === this.#calendarId) this.close();
      })
    });
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    const select = this.element.querySelector('.calendar-select');
    if (select) {
      select.addEventListener('change', (e) => {
        const newId = e.target.value;
        if (newId && newId !== this.#calendarId) {
          this.#calendarId = newId;
          this.#viewedDate = null;
          this.render();
        }
      });
    }
  }

  /** @override */
  _onClose(options) {
    super._onClose(options);
    for (const { hook, id } of this.#hooks) Hooks.off(hook, id);
    this.#hooks = [];
  }

  /**
   * Navigate months forward/backward.
   * @param {Event} _event - The triggering event
   * @param {HTMLElement} target - The clicked element
   */
  static #onNavigate(_event, target) {
    const direction = target.dataset.direction;
    const calendar = this.calendar;
    if (!calendar) return;
    const current = this.viewedDate;
    const totalMonths = calendar.monthsArray.length;
    let { year, month } = current;
    if (direction === 'next') {
      month++;
      if (month >= totalMonths) {
        month = 0;
        year++;
      }
    } else {
      month--;
      if (month < 0) {
        month = totalMonths - 1;
        year--;
      }
    }
    this.#viewedDate = { year, month };
    this.render();
  }

  /** Reset to current date. */
  static #onToday() {
    this.#viewedDate = null;
    this.render();
  }

  /**
   * Open a secondary calendar viewer for a specific calendar.
   * @param {string} calendarId - Calendar ID to display
   * @returns {SecondaryCalendar} The viewer instance
   */
  static open(calendarId) {
    const existingId = `calendaria-secondary-${calendarId}`;
    const existing = foundry.applications.instances.get(existingId);
    if (existing) {
      existing.render(true);
      return existing;
    }
    const viewer = new SecondaryCalendar({ calendarId });
    viewer.render(true);
    return viewer;
  }
}
