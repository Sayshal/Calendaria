/**
 * Shared utilities for calendar view applications.
 * Provides common methods used by CalendarApplication and MiniCalendar.
 * @module Applications/CalendarViewUtils
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { isRecurringMatch } from '../notes/utils/recurrence.mjs';
import { format, localize } from '../utils/localization.mjs';

const ContextMenu = foundry.applications.ux.ContextMenu.implementation;

/** @type {number} Double-click detection threshold in milliseconds */
const DOUBLE_CLICK_THRESHOLD = 400;

/** @type {{time: number, year: number|null, month: number|null, day: number|null}} Click state for double-click detection */
const clickState = { time: 0, year: null, month: null, day: null };

/**
 * Convert hex color to hue angle for CSS filter.
 * @param {string} hex - Hex color (e.g., '#ff0000')
 * @returns {number} Hue angle in degrees (0-360)
 */
function hexToHue(hex) {
  if (!hex) return 0;
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) return 0;
  let h;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = Math.round(h * 60);
  return h < 0 ? h + 360 : h;
}

/**
 * Enrich season data with icon and color based on season name.
 * @param {object|null} season - Season object with name property
 * @returns {object|null} Season with icon and color added
 */
export function enrichSeasonData(season) {
  if (!season) return null;
  if (season.icon && season.color) return season;
  const seasonName = localize(season.name).toLowerCase();
  const SEASON_DEFAULTS = {
    autumn: { icon: 'fas fa-leaf', color: '#d2691e' },
    fall: { icon: 'fas fa-leaf', color: '#d2691e' },
    winter: { icon: 'fas fa-snowflake', color: '#87ceeb' },
    spring: { icon: 'fas fa-seedling', color: '#90ee90' },
    summer: { icon: 'fas fa-sun', color: '#ffd700' }
  };
  const match = Object.keys(SEASON_DEFAULTS).find((key) => seasonName.includes(key));
  const defaults = match ? SEASON_DEFAULTS[match] : { icon: 'fas fa-leaf', color: '#666666' };
  return { ...season, icon: season.icon || defaults.icon, color: season.color || defaults.color };
}

/**
 * Get all calendar note pages from journal entries for the active calendar.
 * @returns {object[]} Array of calendar note pages
 */
export function getCalendarNotes() {
  const notes = [];
  const activeCalendarId = CalendarManager.getActiveCalendar()?.metadata?.id;
  for (const journal of game.journal) {
    for (const page of journal.pages) {
      if (page.type !== 'calendaria.calendarnote') continue;
      const noteCalendarId = page.getFlag(MODULE.ID, 'calendarId') || page.parent?.getFlag(MODULE.ID, 'calendarId');
      if (activeCalendarId && noteCalendarId !== activeCalendarId) continue;
      notes.push(page);
    }
  }
  return notes;
}

/**
 * Filter notes to only those visible to the current user.
 * @param {object[]} notes - All notes
 * @returns {object[]} Notes visible to the current user
 */
export function getVisibleNotes(notes) {
  return notes.filter((page) => !page.system.gmOnly || game.user.isGM);
}

/**
 * Check if a date is today.
 * @param {number} year - Display year (with yearZero applied)
 * @param {number} month - Month (0-indexed)
 * @param {number} day - Day of month (1-indexed)
 * @param {object} [calendar] - Calendar to use (defaults to active)
 * @returns {boolean} True if the given date matches today's date
 */
export function isToday(year, month, day, calendar = null) {
  const today = game.time.components;
  calendar = calendar || CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  const displayYear = today.year + yearZero;
  const todayDay = (today.dayOfMonth ?? 0) + 1;
  return displayYear === year && today.month === month && todayDay === day;
}

/**
 * Get the current viewed date based on game time.
 * @param {object} [calendar] - Calendar to use
 * @returns {object} Date object with year, month, day
 */
export function getCurrentViewedDate(calendar = null) {
  const components = game.time.components;
  calendar = calendar || CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  const dayOfMonth = (components.dayOfMonth ?? 0) + 1;
  return { ...components, year: components.year + yearZero, day: dayOfMonth };
}

/**
 * Check if a day has any notes.
 * @param {object[]} notes - Notes to check
 * @param {number} year - Year
 * @param {number} month - Month
 * @param {number} day - Day (1-indexed)
 * @returns {boolean} True if at least one note exists on the specified day
 */
export function hasNotesOnDay(notes, year, month, day) {
  const targetDate = { year, month, day };
  return notes.some((page) => {
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
}

/**
 * Get notes that start on a specific day.
 * @param {object[]} notes - Notes to filter
 * @param {number} year - Year
 * @param {number} month - Month
 * @param {number} day - Day (1-indexed)
 * @returns {object[]} Notes that start on the specified day
 */
export function getNotesForDay(notes, year, month, day) {
  return notes.filter((page) => {
    const start = page.system.startDate;
    const end = page.system.endDate;
    if (start.year !== year || start.month !== month || start.day !== day) return false;
    const hasValidEndDate = end && end.year != null && end.month != null && end.day != null;
    if (!hasValidEndDate) return true;
    if (end.year !== start.year || end.month !== start.month || end.day !== start.day) return false;
    return true;
  });
}

/**
 * Get the first moon's phase for a specific day.
 * @param {object} calendar - The calendar
 * @param {number} year - Display year
 * @param {number} month - Month
 * @param {number} day - Day (1-indexed)
 * @returns {object|null} Moon phase data with icon and tooltip
 */
export function getFirstMoonPhase(calendar, year, month, day) {
  if (!game.settings.get(MODULE.ID, SETTINGS.SHOW_MOON_PHASES)) return null;
  if (!calendar?.moons?.[0]) return null;
  let dayOfYear = day - 1;
  for (let idx = 0; idx < month; idx++) dayOfYear += calendar.months.values[idx].days;
  const dayComponents = { year: year - (calendar.years?.yearZero ?? 0), month, day: dayOfYear, hour: 12, minute: 0, second: 0 };
  const dayWorldTime = calendar.componentsToTime(dayComponents);
  const phase = calendar.getMoonPhase(0, dayWorldTime);
  if (!phase) return null;
  const color = calendar.moons[0].color || null;
  return { icon: phase.icon, color, hue: color ? hexToHue(color) : null, tooltip: `${localize(calendar.moons[0].name)}: ${localize(phase.name)}` };
}

/**
 * Get all moon phases for a specific day.
 * @param {object} calendar - The calendar
 * @param {number} year - Display year
 * @param {number} month - Month
 * @param {number} day - Day (1-indexed)
 * @returns {Array|null} Array of moon phase data
 */
export function getAllMoonPhases(calendar, year, month, day) {
  if (!game.settings.get(MODULE.ID, SETTINGS.SHOW_MOON_PHASES)) return null;
  if (!calendar?.moons?.length) return null;
  let dayOfYear = day - 1;
  for (let idx = 0; idx < month; idx++) dayOfYear += calendar.months.values[idx].days;
  const dayComponents = { year: year - (calendar.years?.yearZero ?? 0), month, day: dayOfYear, hour: 12, minute: 0, second: 0 };
  const dayWorldTime = calendar.componentsToTime(dayComponents);
  return calendar.moons
    .map((moon, index) => {
      const phase = calendar.getMoonPhase(index, dayWorldTime);
      if (!phase) return null;
      const color = moon.color || null;
      return { moonName: localize(moon.name), phaseName: localize(phase.name), icon: phase.icon, color, hue: color ? hexToHue(color) : null };
    })
    .filter(Boolean);
}

/* -------------------------------------------- */
/*  Shared Day Cell Interactions                */
/* -------------------------------------------- */

/**
 * Get notes on a specific day for context menu display.
 * @param {number} year - Display year
 * @param {number} month - Month (0-indexed)
 * @param {number} day - Day (1-indexed)
 * @returns {object[]} Notes on this day
 */
export function getNotesOnDay(year, month, day) {
  const allNotes = getCalendarNotes();
  const visibleNotes = getVisibleNotes(allNotes);
  const targetDate = { year, month, day };
  return visibleNotes.filter((page) => {
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
}

/**
 * Set the game time to a specific date.
 * @param {number} year - Display year
 * @param {number} month - Month (0-indexed)
 * @param {number} day - Day (1-indexed)
 * @param {object} [calendar] - Calendar to use
 */
export async function setDateTo(year, month, day, calendar = null) {
  calendar = calendar || CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  let dayOfYear = day - 1;
  for (let i = 0; i < month; i++) dayOfYear += calendar.months.values[i].days;
  const currentComponents = game.time.components;
  const newComponents = { year: year - yearZero, month, day: dayOfYear, hour: currentComponents.hour, minute: currentComponents.minute, second: currentComponents.second };
  const newWorldTime = calendar.componentsToTime(newComponents);
  await game.time.advance(newWorldTime - game.time.worldTime);
}

/**
 * Create a new note on a specific date.
 * @param {number} year - Display year
 * @param {number} month - Month (0-indexed)
 * @param {number} day - Day (1-indexed)
 * @returns {Promise<object|null>} The created note page, or null if creation failed
 */
export async function createNoteOnDate(year, month, day) {
  const page = await NoteManager.createNote({
    name: localize('CALENDARIA.Note.NewNote'),
    noteData: { startDate: { year, month, day, hour: 12, minute: 0 }, endDate: { year, month, day, hour: 13, minute: 0 } }
  });
  if (page) page.sheet.render(true, { mode: 'edit' });
  return page;
}

/**
 * Build context menu items for a day cell.
 * @param {object} options - Options
 * @param {object} options.calendar - The calendar
 * @param {Function} [options.onSetDate] - Callback after setting date
 * @param {Function} [options.onCreateNote] - Callback after creating note
 * @returns {Array<object>} Context menu items
 */
export function getDayContextMenuItems({ calendar, onSetDate, onCreateNote } = {}) {
  return [
    {
      name: 'CALENDARIA.MiniCalendar.SetCurrentDate',
      icon: '<i class="fas fa-calendar-plus"></i>',
      condition: (target) => {
        if (!game.user.isGM) return false;
        const year = parseInt(target.dataset.year);
        const month = parseInt(target.dataset.month);
        const day = parseInt(target.dataset.day);
        const today = getCurrentViewedDate(calendar);
        return !(year === today.year && month === today.month && day === today.day);
      },
      callback: async (target) => {
        const year = parseInt(target.dataset.year);
        const month = parseInt(target.dataset.month);
        const day = parseInt(target.dataset.day);
        await setDateTo(year, month, day, calendar);
        onSetDate?.();
      }
    },
    {
      name: 'CALENDARIA.Common.AddNote',
      icon: '<i class="fas fa-plus"></i>',
      callback: async (target) => {
        const year = parseInt(target.dataset.year);
        const month = parseInt(target.dataset.month);
        const day = parseInt(target.dataset.day);
        await createNoteOnDate(year, month, day);
        onCreateNote?.();
      }
    },
    {
      name: 'CALENDARIA.ContextMenu.EditNote',
      icon: '<i class="fas fa-edit"></i>',
      group: 'notes',
      condition: (target) => {
        const year = parseInt(target.dataset.year);
        const month = parseInt(target.dataset.month);
        const day = parseInt(target.dataset.day);
        const notes = getNotesOnDay(year, month, day).filter((n) => n.isOwner);
        return notes.length === 1;
      },
      callback: (target) => {
        const year = parseInt(target.dataset.year);
        const month = parseInt(target.dataset.month);
        const day = parseInt(target.dataset.day);
        const notes = getNotesOnDay(year, month, day).filter((n) => n.isOwner);
        if (notes.length === 1) notes[0].sheet.render(true, { mode: 'edit' });
      }
    },
    {
      name: 'CALENDARIA.ContextMenu.ViewNote',
      icon: '<i class="fas fa-eye"></i>',
      group: 'notes',
      condition: (target) => {
        const year = parseInt(target.dataset.year);
        const month = parseInt(target.dataset.month);
        const day = parseInt(target.dataset.day);
        const notes = getNotesOnDay(year, month, day);
        return notes.length === 1;
      },
      callback: (target) => {
        const year = parseInt(target.dataset.year);
        const month = parseInt(target.dataset.month);
        const day = parseInt(target.dataset.day);
        const notes = getNotesOnDay(year, month, day);
        if (notes.length === 1) notes[0].sheet.render(true, { mode: 'view' });
      }
    },
    {
      name: 'CALENDARIA.ContextMenu.DeleteNote',
      icon: '<i class="fas fa-trash"></i>',
      group: 'notes',
      condition: (target) => {
        const year = parseInt(target.dataset.year);
        const month = parseInt(target.dataset.month);
        const day = parseInt(target.dataset.day);
        const notes = getNotesOnDay(year, month, day).filter((n) => n.isOwner);
        return notes.length === 1;
      },
      callback: async (target) => {
        const year = parseInt(target.dataset.year);
        const month = parseInt(target.dataset.month);
        const day = parseInt(target.dataset.day);
        const notes = getNotesOnDay(year, month, day).filter((n) => n.isOwner);
        if (notes.length !== 1) return;

        const page = notes[0];
        const confirmed = await foundry.applications.api.DialogV2.confirm({
          window: { title: localize('CALENDARIA.ContextMenu.DeleteNote') },
          content: `<p>${format('CALENDARIA.ContextMenu.DeleteConfirm', { name: page.name })}</p>`,
          rejectClose: false,
          modal: true
        });

        if (confirmed) {
          const journal = page.parent;
          if (journal.pages.size === 1) await journal.delete();
          else await page.delete();
        }
      }
    }
  ];
}

/**
 * Inject date info header into context menu.
 * @param {HTMLElement} target - The day cell element
 * @param {object} calendar - The calendar
 */
export function injectContextMenuInfo(target, calendar) {
  const menu = document.getElementById('context-menu');
  if (!menu) return;
  const year = parseInt(target.dataset.year);
  const month = parseInt(target.dataset.month);
  const day = parseInt(target.dataset.day);
  const monthData = calendar.months?.values?.[month];
  const monthName = monthData ? localize(monthData.name) : '';
  const yearDisplay = calendar.formatYearWithEra?.(year) ?? String(year);
  const fullDate = `${monthName} ${day}, ${yearDisplay}`;
  const season = calendar.getCurrentSeason?.();
  const seasonName = season ? localize(season.name) : null;
  const sunriseHour = calendar.sunrise?.() ?? 6;
  const sunsetHour = calendar.sunset?.() ?? 18;
  const formatTime = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };
  const infoHeader = document.createElement('div');
  infoHeader.className = 'context-info-header';
  infoHeader.innerHTML = `
    <div class="info-row date"><strong>${fullDate}</strong></div>
    ${seasonName ? `<div class="info-row season">${seasonName}</div>` : ''}
    <div class="info-row sun"><i class="fas fa-sun" data-tooltip="${localize('CALENDARIA.Common.Sunrise')}"></i> ${formatTime(sunriseHour)}
    <i class="fas fa-moon" data-tooltip="${localize('CALENDARIA.Common.Sunset')}"></i> ${formatTime(sunsetHour)}</div>
  `;
  menu.insertBefore(infoHeader, menu.firstChild);
}

/**
 * Set up a context menu for day cells.
 * @param {HTMLElement} container - The container element
 * @param {string} selector - CSS selector for day cells
 * @param {object} calendar - The calendar
 * @param {object} [options] - Additional options
 * @param {Function} [options.onSetDate] - Callback after setting date
 * @param {Function} [options.onCreateNote] - Callback after creating note
 * @returns {ContextMenu} The created context menu
 */
export function setupDayContextMenu(container, selector, calendar, options = {}) {
  return new ContextMenu(container, selector, getDayContextMenuItems({ calendar, ...options }), {
    fixed: true,
    jQuery: false,
    onOpen: (target) => {
      requestAnimationFrame(() => injectContextMenuInfo(target, calendar));
    }
  });
}

/**
 * Handle click on a day cell, detecting double-clicks manually.
 * Native dblclick doesn't work because re-render destroys the element between clicks.
 * @param {MouseEvent} event - The click event
 * @param {object} calendar - The calendar
 * @param {object} [options] - Additional options
 * @param {Function} [options.onSetDate] - Callback after setting date
 * @param {Function} [options.onCreateNote] - Callback after creating note
 * @returns {boolean} True if double-click was handled (caller should skip single-click logic)
 */
export async function handleDayClick(event, calendar, options = {}) {
  const dayCell = event.target.closest('[data-year][data-month][data-day]');
  if (!dayCell || dayCell.classList.contains('empty')) return false;
  const year = parseInt(dayCell.dataset.year);
  const month = parseInt(dayCell.dataset.month);
  const day = parseInt(dayCell.dataset.day);
  const now = Date.now();
  const isDoubleClick = now - clickState.time < DOUBLE_CLICK_THRESHOLD && clickState.year === year && clickState.month === month && clickState.day === day;
  clickState.time = now;
  clickState.year = year;
  clickState.month = month;
  clickState.day = day;
  if (!isDoubleClick) return false;
  clickState.time = 0;
  const today = getCurrentViewedDate(calendar);
  const isTodayCell = year === today.year && month === today.month && day === today.day;
  if (isTodayCell) {
    await createNoteOnDate(year, month, day);
    options.onCreateNote?.();
  } else if (game.user.isGM) {
    await setDateTo(year, month, day, calendar);
    options.onSetDate?.();
  }
  return true;
}
