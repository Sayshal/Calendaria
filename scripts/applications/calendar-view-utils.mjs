/**
 * Shared utilities for calendar view applications.
 * Provides common methods used by CalendarApplication and CompactCalendar.
 *
 * @module Applications/CalendarViewUtils
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { isRecurringMatch } from '../notes/utils/recurrence.mjs';

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

  // Return as-is if already has icon and color
  if (season.icon && season.color) return season;

  // Map season names to icons and colors
  const seasonName = game.i18n.localize(season.name).toLowerCase();
  const enriched = { ...season };

  // Match common season names (English and localized variants)
  if (seasonName.includes('autumn') || seasonName.includes('fall')) {
    enriched.icon = enriched.icon || 'fas fa-leaf';
    enriched.color = enriched.color || '#d2691e';
  } else if (seasonName.includes('winter')) {
    enriched.icon = enriched.icon || 'fas fa-snowflake';
    enriched.color = enriched.color || '#87ceeb';
  } else if (seasonName.includes('spring')) {
    enriched.icon = enriched.icon || 'fas fa-seedling';
    enriched.color = enriched.color || '#90ee90';
  } else if (seasonName.includes('summer')) {
    enriched.icon = enriched.icon || 'fas fa-sun';
    enriched.color = enriched.color || '#ffd700';
  } else {
    // Default fallback
    enriched.icon = enriched.icon || 'fas fa-leaf';
    enriched.color = enriched.color || '#666666';
  }

  return enriched;
}

/**
 * Get all calendar note pages from journal entries for the active calendar.
 * @returns {JournalEntryPage[]}
 */
export function getCalendarNotes() {
  const notes = [];
  const activeCalendarId = CalendarManager.getActiveCalendar()?.metadata?.id;

  for (const journal of game.journal) {
    for (const page of journal.pages) {
      if (page.type !== 'calendaria.calendarnote') continue;

      // Filter by calendar ID - check page flags first, then parent journal
      const noteCalendarId = page.getFlag(MODULE.ID, 'calendarId') || page.parent?.getFlag(MODULE.ID, 'calendarId');
      if (activeCalendarId && noteCalendarId !== activeCalendarId) continue;

      notes.push(page);
    }
  }
  return notes;
}

/**
 * Filter notes to only those visible to the current user.
 * @param {JournalEntryPage[]} notes - All notes
 * @returns {JournalEntryPage[]}
 */
export function getVisibleNotes(notes) {
  return notes.filter((page) => !page.system.gmOnly || game.user.isGM);
}

/**
 * Check if a date is today.
 * @param {number} year - Display year (with yearZero applied)
 * @param {number} month - Month (0-indexed)
 * @param {number} day - Day of month (1-indexed)
 * @param {CalendariaCalendar} [calendar] - Calendar to use (defaults to active)
 * @returns {boolean}
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
 * @param {CalendariaCalendar} [calendar] - Calendar to use
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
 * @param {JournalEntryPage[]} notes - Notes to check
 * @param {number} year - Year
 * @param {number} month - Month
 * @param {number} day - Day (1-indexed)
 * @returns {boolean}
 */
export function hasNotesOnDay(notes, year, month, day) {
  const targetDate = { year, month, day };
  return notes.some((page) => {
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
  });
}

/**
 * Get notes that start on a specific day.
 * @param {JournalEntryPage[]} notes - Notes to filter
 * @param {number} year - Year
 * @param {number} month - Month
 * @param {number} day - Day (1-indexed)
 * @returns {JournalEntryPage[]}
 */
export function getNotesForDay(notes, year, month, day) {
  return notes.filter((page) => {
    const start = page.system.startDate;
    const end = page.system.endDate;

    // Only include events that start on this day
    if (start.year !== year || start.month !== month || start.day !== day) return false;

    // Check if end date has valid values
    const hasValidEndDate = end && end.year != null && end.month != null && end.day != null;

    // If no valid end date, treat as single-day event
    if (!hasValidEndDate) return true;

    // Exclude multi-day events (shown as bars)
    if (end.year !== start.year || end.month !== start.month || end.day !== start.day) return false;

    return true;
  });
}

/**
 * Get the first moon's phase for a specific day.
 * @param {CalendariaCalendar} calendar - The calendar
 * @param {number} year - Display year
 * @param {number} month - Month
 * @param {number} day - Day (1-indexed)
 * @returns {object|null} Moon phase data with icon and tooltip
 */
export function getFirstMoonPhase(calendar, year, month, day) {
  if (!game.settings.get(MODULE.ID, SETTINGS.SHOW_MOON_PHASES)) return null;
  if (!calendar?.moons?.[0]) return null;

  // Calculate day of year
  let dayOfYear = day - 1;
  for (let idx = 0; idx < month; idx++) dayOfYear += calendar.months.values[idx].days;

  const dayComponents = { year: year - (calendar.years?.yearZero ?? 0), month, day: dayOfYear, hour: 12, minute: 0, second: 0 };
  const dayWorldTime = calendar.componentsToTime(dayComponents);
  const phase = calendar.getMoonPhase(0, dayWorldTime);
  if (!phase) return null;

  const color = calendar.moons[0].color || null;
  return { icon: phase.icon, color, hue: color ? hexToHue(color) : null, tooltip: `${game.i18n.localize(calendar.moons[0].name)}: ${game.i18n.localize(phase.name)}` };
}

/**
 * Get all moon phases for a specific day.
 * @param {CalendariaCalendar} calendar - The calendar
 * @param {number} year - Display year
 * @param {number} month - Month
 * @param {number} day - Day (1-indexed)
 * @returns {Array|null} Array of moon phase data
 */
export function getAllMoonPhases(calendar, year, month, day) {
  if (!game.settings.get(MODULE.ID, SETTINGS.SHOW_MOON_PHASES)) return null;
  if (!calendar?.moons?.length) return null;

  // Calculate day of year
  let dayOfYear = day - 1;
  for (let idx = 0; idx < month; idx++) dayOfYear += calendar.months.values[idx].days;

  const dayComponents = { year: year - (calendar.years?.yearZero ?? 0), month, day: dayOfYear, hour: 12, minute: 0, second: 0 };
  const dayWorldTime = calendar.componentsToTime(dayComponents);

  return calendar.moons
    .map((moon, index) => {
      const phase = calendar.getMoonPhase(index, dayWorldTime);
      if (!phase) return null;
      const color = moon.color || null;
      return { moonName: game.i18n.localize(moon.name), phaseName: game.i18n.localize(phase.name), icon: phase.icon, color, hue: color ? hexToHue(color) : null };
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
 * @returns {JournalEntryPage[]} Notes on this day
 */
export function getNotesOnDay(year, month, day) {
  const allNotes = getCalendarNotes();
  const visibleNotes = getVisibleNotes(allNotes);
  return visibleNotes.filter((page) => {
    const start = page.system.startDate;
    const end = page.system.endDate;

    // Check if this day is the start date
    if (start.year === year && start.month === month && start.day === day) return true;

    // Check multi-day events
    if (end?.year != null && end?.month != null && end?.day != null) {
      const startDate = new Date(start.year, start.month, start.day);
      const endDate = new Date(end.year, end.month, end.day);
      const checkDate = new Date(year, month, day);
      if (checkDate >= startDate && checkDate <= endDate) return true;
    }

    return false;
  });
}

/**
 * Set the game time to a specific date.
 * @param {number} year - Display year
 * @param {number} month - Month (0-indexed)
 * @param {number} day - Day (1-indexed)
 * @param {CalendariaCalendar} [calendar] - Calendar to use
 */
export async function setDateTo(year, month, day, calendar = null) {
  calendar = calendar || CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;

  // Calculate day of year
  let dayOfYear = day - 1;
  for (let i = 0; i < month; i++) dayOfYear += calendar.months.values[i].days;

  // Keep current time of day
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
 * @returns {Promise<JournalEntryPage|null>}
 */
export async function createNoteOnDate(year, month, day) {
  const page = await NoteManager.createNote({
    name: game.i18n.localize('CALENDARIA.Note.NewNote'),
    noteData: { startDate: { year, month, day, hour: 12, minute: 0 }, endDate: { year, month, day, hour: 13, minute: 0 } }
  });
  if (page) page.sheet.render(true, { mode: 'edit' });
  return page;
}

/**
 * Build context menu items for a day cell.
 * @param {object} options - Options
 * @param {CalendariaCalendar} options.calendar - The calendar
 * @param {Function} [options.onSetDate] - Callback after setting date
 * @param {Function} [options.onCreateNote] - Callback after creating note
 * @returns {Array<object>} Context menu items
 */
export function getDayContextMenuItems({ calendar, onSetDate, onCreateNote } = {}) {
  return [
    // Set Current Date (GM only, not on current day)
    {
      name: 'CALENDARIA.CompactCalendar.SetCurrentDate',
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
    // Add Note
    {
      name: 'CALENDARIA.CompactCalendar.AddNote',
      icon: '<i class="fas fa-plus"></i>',
      callback: async (target) => {
        const year = parseInt(target.dataset.year);
        const month = parseInt(target.dataset.month);
        const day = parseInt(target.dataset.day);
        await createNoteOnDate(year, month, day);
        onCreateNote?.();
      }
    },
    // Edit Note (if day has exactly one note the user owns)
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
    // View Note (if day has exactly one note)
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
        if (notes.length === 1) notes[0].sheet.render(true);
      }
    },
    // Delete Note (if day has exactly one note the user owns)
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
          window: { title: game.i18n.localize('CALENDARIA.ContextMenu.DeleteNote') },
          content: `<p>${game.i18n.format('CALENDARIA.ContextMenu.DeleteConfirm', { name: page.name })}</p>`,
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
 * @param {CalendariaCalendar} calendar - The calendar
 */
export function injectContextMenuInfo(target, calendar) {
  const menu = document.getElementById('context-menu');
  if (!menu) return;

  const year = parseInt(target.dataset.year);
  const month = parseInt(target.dataset.month);
  const day = parseInt(target.dataset.day);

  // Build date string
  const monthData = calendar.months?.values?.[month];
  const monthName = monthData ? game.i18n.localize(monthData.name) : '';
  const yearDisplay = calendar.formatYearWithEra?.(year) ?? String(year);
  const fullDate = `${monthName} ${day}, ${yearDisplay}`;

  // Get season
  const season = calendar.getCurrentSeason?.();
  const seasonName = season ? game.i18n.localize(season.name) : null;

  // Get sunrise/sunset
  const sunriseHour = calendar.sunrise?.() ?? 6;
  const sunsetHour = calendar.sunset?.() ?? 18;
  const formatTime = (hours) => {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  // Create info header element
  const infoHeader = document.createElement('div');
  infoHeader.className = 'context-info-header';
  infoHeader.innerHTML = `
    <div class="info-row date"><strong>${fullDate}</strong></div>
    ${seasonName ? `<div class="info-row season">${seasonName}</div>` : ''}
    <div class="info-row sun"><i class="fas fa-sun" data-tooltip="${game.i18n.localize('CALENDARIA.CompactCalendar.Sunrise')}"></i> ${formatTime(sunriseHour)} <i class="fas fa-moon" data-tooltip="${game.i18n.localize('CALENDARIA.CompactCalendar.Sunset')}"></i> ${formatTime(sunsetHour)}</div>
  `;

  // Insert at beginning of menu
  menu.insertBefore(infoHeader, menu.firstChild);
}

/**
 * Set up a context menu for day cells.
 * @param {HTMLElement} container - The container element
 * @param {string} selector - CSS selector for day cells
 * @param {CalendariaCalendar} calendar - The calendar
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
 * @param {CalendariaCalendar} calendar - The calendar
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

  // Check if this is a double-click (same day, within threshold)
  const isDoubleClick = now - clickState.time < DOUBLE_CLICK_THRESHOLD && clickState.year === year && clickState.month === month && clickState.day === day;

  // Update click state
  clickState.time = now;
  clickState.year = year;
  clickState.month = month;
  clickState.day = day;

  if (!isDoubleClick) return false;

  // Reset state to prevent triple-click
  clickState.time = 0;

  // Handle double-click
  const today = getCurrentViewedDate(calendar);
  const isTodayCell = year === today.year && month === today.month && day === today.day;

  if (isTodayCell) {
    // Double-click on today: create new note
    await createNoteOnDate(year, month, day);
    options.onCreateNote?.();
  } else if (game.user.isGM) {
    // Double-click on other day (GM only): set as current date
    await setDateTo(year, month, day, calendar);
    options.onSetDate?.();
  }

  return true;
}
