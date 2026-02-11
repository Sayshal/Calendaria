/**
 * Shared utilities for calendar view applications.
 * Provides common methods used by BigCal and MiniCal.
 * @module Applications/CalendarViewUtils
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { MODULE, SOCKET_TYPES } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { isRecurringMatch } from '../notes/utils/recurrence.mjs';
import { formatCustom } from '../utils/format-utils.mjs';
import { format, localize } from '../utils/localization.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';
import WeatherManager from '../weather/weather-manager.mjs';

const ContextMenu = foundry.applications.ux.ContextMenu.implementation;

/** @type {string|null} User-selected moon name override for display */
let selectedMoonOverride = null;

/**
 * Set the moon override for display.
 * @param {string|null} moonName - Moon name to display, or null to use default (first alphabetically)
 */
export function setSelectedMoon(moonName) {
  selectedMoonOverride = moonName;
}

/**
 * Get the current moon override.
 * @returns {string|null} Selected moon name or null
 */
export function getSelectedMoon() {
  return selectedMoonOverride;
}

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
  if (game.user.isGM) return notes;
  return notes.filter((page) => {
    if (page.system.gmOnly) return false;
    const journal = page.parent;
    return journal ? journal.testUserPermission(game.user, 'OBSERVER') : page.testUserPermission(game.user, 'OBSERVER');
  });
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
 * Get the selected moon's phase for a specific day.
 * Uses override if set, otherwise first alphabetically.
 * @param {object} calendar - The calendar
 * @param {number} year - Display year
 * @param {number} month - Month
 * @param {number} day - Day (1-indexed)
 * @returns {object|null} Moon phase data with icon and tooltip
 */
export function getFirstMoonPhase(calendar, year, month, day) {
  if (!calendar?.moonsArray?.length) return null;
  const sortedMoons = [...calendar.moonsArray].map((m, i) => ({ ...m, originalIndex: i })).sort((a, b) => localize(a.name).localeCompare(localize(b.name)));
  let moon = sortedMoons[0];
  if (selectedMoonOverride) {
    const overrideMoon = sortedMoons.find((m) => localize(m.name) === selectedMoonOverride);
    if (overrideMoon) moon = overrideMoon;
  }
  const internalYear = year - (calendar.years?.yearZero ?? 0);
  const dayComponents = { year: internalYear, month, dayOfMonth: day - 1, hour: 12, minute: 0, second: 0 };
  const dayWorldTime = calendar.componentsToTime(dayComponents);
  const phase = calendar.getMoonPhase(moon.originalIndex, dayWorldTime);
  if (!phase) return null;
  const color = moon.color || null;
  return { icon: phase.icon, color, hue: color ? hexToHue(color) : null, tooltip: `${localize(moon.name)}: ${phase.subPhaseName || localize(phase.name)}` };
}

/**
 * Get all moon phases for a specific day, sorted alphabetically.
 * @param {object} calendar - The calendar
 * @param {number} year - Display year
 * @param {number} month - Month
 * @param {number} day - Day (1-indexed)
 * @returns {Array|null} Array of moon phase data sorted alphabetically by moon name
 */
export function getAllMoonPhases(calendar, year, month, day) {
  if (!calendar?.moonsArray?.length) return null;
  const internalYear = year - (calendar.years?.yearZero ?? 0);
  const dayComponents = { year: internalYear, month, dayOfMonth: day - 1, hour: 12, minute: 0, second: 0 };
  const dayWorldTime = calendar.componentsToTime(dayComponents);
  return calendar.moonsArray
    .map((moon, index) => {
      const phase = calendar.getMoonPhase(index, dayWorldTime);
      if (!phase) return null;
      const color = moon.color || null;
      return { moonName: localize(moon.name), phaseName: phase.subPhaseName || localize(phase.name), icon: phase.icon, color, hue: color ? hexToHue(color) : null };
    })
    .filter(Boolean)
    .sort((a, b) => a.moonName.localeCompare(b.moonName));
}

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
  const internalYear = year - yearZero;
  const currentComponents = game.time.components;
  const newComponents = { year: internalYear, month, dayOfMonth: day - 1, hour: currentComponents.hour, minute: currentComponents.minute, second: currentComponents.second };
  const newWorldTime = calendar.componentsToTime(newComponents);
  const delta = newWorldTime - game.time.worldTime;
  if (!game.user.isGM) {
    CalendariaSocket.emit(SOCKET_TYPES.TIME_REQUEST, { action: 'advance', delta });
    return;
  }
  await game.time.advance(delta);
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
 * @param {object[]} [options.extraItems] - Additional context menu items to append
 * @returns {Array<object>} Context menu items
 */
export function getDayContextMenuItems({ calendar, onSetDate, onCreateNote, extraItems } = {}) {
  return (target) => {
    const year = parseInt(target.dataset.year);
    const month = parseInt(target.dataset.month);
    const day = parseInt(target.dataset.day);
    const notes = getNotesOnDay(year, month, day);
    const today = getCurrentViewedDate(calendar);
    const isToday = year === today.year && month === today.month && day === today.day;
    const items = [];
    items.push({
      name: 'CALENDARIA.Common.AddNote',
      icon: '<i class="fas fa-plus"></i>',
      callback: async () => {
        await createNoteOnDate(year, month, day);
        onCreateNote?.();
      }
    });

    if (game.user.isGM && !isToday) {
      items.push({
        name: 'CALENDARIA.MiniCal.SetCurrentDate',
        icon: '<i class="fas fa-calendar-check"></i>',
        callback: async () => {
          await setDateTo(year, month, day, calendar);
          onSetDate?.();
        }
      });
    }

    if (extraItems?.length) items.push(...extraItems);

    if (notes.length > 0) {
      const sortedNotes = [...notes].sort((a, b) => a.name.localeCompare(b.name));
      for (const note of sortedNotes) {
        const isOwner = note.isOwner;
        const noteIcon = note.system?.icon || 'fas fa-sticky-note';
        const noteColor = note.system?.color || '#4a9eff';
        const iconHtml = note.system?.iconType === 'fontawesome' ? `<i class="${noteIcon}" style="color: ${noteColor}"></i>` : `<i class="fas fa-sticky-note" style="color: ${noteColor}"></i>`;
        items.push({
          name: note.name,
          icon: iconHtml,
          group: 'notes',
          _noteData: { note, isOwner },
          callback: () => note.sheet.render(true, { mode: isOwner ? 'edit' : 'view' })
        });
      }
    }

    return items;
  };
}

/** @type {ContextMenu|null} Active day cell context menu instance */
let activeDayContextMenu = null;

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
  const internalYear = year - (calendar.years?.yearZero ?? 0);
  const internalComponents = { year: internalYear, month, dayOfMonth: day - 1, hour: 12, minute: 0, second: 0 };
  const displayComponents = { year, month, dayOfMonth: day, hour: 12, minute: 0, second: 0 };
  const fullDate = formatCustom(calendar, displayComponents, 'Do of MMMM, Y GGGG');
  const season = calendar.getCurrentSeason?.(internalComponents);
  const seasonName = season ? localize(season.name) : null;
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const sunriseHour = calendar.sunrise?.(internalComponents, zone) ?? 6;
  const sunsetHour = calendar.sunset?.(internalComponents, zone) ?? 18;
  const formatTime = (hours) => {
    let h = Math.floor(hours);
    let m = Math.round((hours - h) * 60);
    if (m === 60) {
      m = 0;
      h += 1;
    }
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
 * Escape text content for safe HTML embedding.
 * @param {string} str - Text to escape
 * @returns {string} Escaped text
 */
function escapeText(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Encode HTML for safe use in data-tooltip-html attribute.
 * @param {string} html - HTML string to encode
 * @returns {string} HTML-encoded string (< becomes &lt; etc.)
 */
function encodeHtmlAttribute(html) {
  return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Generate HTML tooltip content for a day cell.
 * @param {object} calendar - The calendar
 * @param {number} year - Display year (with yearZero applied)
 * @param {number} month - Month (0-indexed)
 * @param {number} day - Day of month (1-indexed)
 * @param {object} [festival] - Optional festival data
 * @param {string} [festival.name] - Festival name
 * @param {string} [festival.description] - Festival description
 * @param {string} [festival.color] - Festival color
 * @returns {string} HTML tooltip content (HTML-encoded for use in data-tooltip-html attribute)
 */
export function generateDayTooltip(calendar, year, month, day, festival = null) {
  const internalYear = year - (calendar.years?.yearZero ?? 0);
  const internalComponents = { year: internalYear, month, dayOfMonth: day - 1, hour: 12, minute: 0, second: 0 };
  const displayComponents = { year, month, dayOfMonth: day, hour: 12, minute: 0, second: 0 };
  const fullDate = formatCustom(calendar, displayComponents, 'Do of MMMM, Y GGGG');
  const season = calendar.getCurrentSeason?.(internalComponents);
  const seasonName = season ? localize(season.name) : null;
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const sunriseHour = calendar.sunrise?.(internalComponents, zone) ?? 6;
  const sunsetHour = calendar.sunset?.(internalComponents, zone) ?? 18;
  const formatTime = (hours) => {
    let h = Math.floor(hours);
    let m = Math.round((hours - h) * 60);
    if (m === 60) {
      m = 0;
      h += 1;
    }
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  };

  const rows = [];
  rows.push(`<div class="calendaria-day-tooltip-date"><strong>${escapeText(fullDate)}</strong></div>`);
  if (festival?.name) {
    const colorStyle = festival.color ? ` style="color: ${festival.color}"` : '';
    let festivalText = escapeText(festival.name);
    if (festival.description) festivalText += `: ${escapeText(festival.description)}`;
    rows.push(`<div class="calendaria-day-tooltip-festival"${colorStyle}><em>${festivalText}</em></div>`);
  }
  if (seasonName) rows.push(`<div class="calendaria-day-tooltip-season">${escapeText(seasonName)}</div>`);
  rows.push(`<div class="calendaria-day-tooltip-sun"><i class="fas fa-sun"></i> ${formatTime(sunriseHour)} <i class="fas fa-moon"></i> ${formatTime(sunsetHour)}</div>`);
  const rawHtml = `<div class="calendaria-day-tooltip">${rows.join('')}</div>`;
  return encodeHtmlAttribute(rawHtml);
}

/**
 * Set up a context menu for day cells.
 * @param {HTMLElement} container - The container element
 * @param {string} selector - CSS selector for day cells
 * @param {object} calendar - The calendar
 * @param {object} [options] - Additional options
 * @param {Function} [options.onSetDate] - Callback after setting date
 * @param {Function} [options.onCreateNote] - Callback after creating note
 * @param {object[]} [options.extraItems] - Additional context menu items to append
 * @returns {ContextMenu} The created context menu
 */
export function setupDayContextMenu(container, selector, calendar, options = {}) {
  const itemsGenerator = getDayContextMenuItems({ calendar, ...options });
  let currentItems = [];

  activeDayContextMenu = new ContextMenu(container, selector, [], {
    fixed: true,
    jQuery: false,
    onOpen: (target) => {
      currentItems = itemsGenerator(target);
      ui.context.menuItems = currentItems;
      setTimeout(() => {
        const menu = document.getElementById('context-menu');
        if (!menu) return;
        const menuItems = menu.querySelectorAll('.context-item');
        menuItems.forEach((li, idx) => {
          const item = currentItems[idx];
          if (!item?._noteData) return;
          const { note, isOwner } = item._noteData;
          const nameSpan = li.querySelector('span:not(.note-row)');
          if (!nameSpan) return;
          nameSpan.classList.add('note-row');
          nameSpan.innerHTML = `<span class="note-name">${note.name}</span>`;
          if (isOwner) {
            const actions = document.createElement('span');
            actions.className = 'note-actions';
            actions.innerHTML = `<i class="fas fa-edit" data-action="edit" data-tooltip="${localize('CALENDARIA.ContextMenu.Edit')}"></i><i class="fas fa-trash" data-action="delete" data-tooltip="${localize('CALENDARIA.ContextMenu.Delete')}"></i>`;
            nameSpan.appendChild(actions);
            actions.addEventListener('click', async (e) => {
              e.stopPropagation();
              const action = e.target.closest('[data-action]')?.dataset?.action;
              if (action === 'edit') {
                note.sheet.render(true, { mode: 'edit' });
                ui.context?.close();
              } else if (action === 'delete') {
                ui.context?.close();
                const confirmed = await foundry.applications.api.DialogV2.confirm({
                  window: { title: localize('CALENDARIA.ContextMenu.DeleteNote') },
                  content: `<p>${format('CALENDARIA.ContextMenu.DeleteConfirm', { name: note.name })}</p>`,
                  rejectClose: false,
                  modal: true
                });
                if (confirmed) {
                  const journal = note.parent;
                  if (journal.pages.size === 1) await journal.delete();
                  else await note.delete();
                }
              }
            });
          }
        });
      }, 220);
    }
  });

  return activeDayContextMenu;
}
