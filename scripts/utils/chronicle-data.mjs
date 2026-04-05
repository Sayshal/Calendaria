/**
 * Data assembly for the Chronicle View.
 * @module Utils/ChronicleData
 * @author Tyler
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { COMPASS_DIRECTIONS, MODULE, SETTINGS, WIND_SPEEDS } from '../constants.mjs';
import { NoteManager, addDays, compareDates, dayOfWeek } from '../notes/_module.mjs';
import { WeatherManager } from '../weather/_module.mjs';
import { isFogEnabled, isRevealed } from './fog-of-war.mjs';
import { dateFormattingParts } from './formatting/format-utils.mjs';

/**
 * Build a journal-style weather sentence from weather data.
 * @param {object} w - Weather data object
 * @returns {string|null} Formatted weather sentence or null
 */
function buildWeatherSentence(w) {
  if (!w) return null;
  const label = w.label ? game.i18n.localize(w.label) : null;
  const temp = w.temperature != null ? WeatherManager.formatTemperature(w.temperature) : null;
  const windDef = w.wind?.speed ? Object.values(WIND_SPEEDS).find((ws) => ws.value === w.wind.speed) : null;
  const windLabel = windDef ? game.i18n.localize(windDef.label) : null;
  const dir = w.wind?.direction != null ? compassLabel(w.wind.direction) : null;
  const precip = w.precipitation?.type || null;
  const fragments = [];
  if (label) fragments.push(label);
  if (temp) fragments.push(temp);
  if (windLabel && w.wind.speed > 0) fragments.push(dir ? `${windLabel} winds from the ${dir}` : `${windLabel} winds`);
  if (precip) fragments.push(precip);
  if (!fragments.length) return null;
  return fragments.join(', ');
}

/**
 * Get display color, icon, and festival flag for a note stub.
 * @param {object} stub - Note stub object
 * @returns {object} Display properties { color, icon, isFestival }
 */
function resolveStubDisplayProps(stub) {
  const sys = stub.flagData;
  return { color: sys.color || '#4a9eff', icon: sys.icon || 'fas fa-calendar', isFestival: !!sys.linkedFestival };
}

/**
 * Build a plain text excerpt from HTML content.
 * @param {string} html - HTML content string
 * @param {number} [maxLength] - Maximum excerpt length
 * @returns {string} Plain text excerpt
 */
export function buildExcerpt(html, maxLength = 150) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  const text = div.textContent || '';
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
}

/**
 * Resolve compass direction label from degrees.
 * @param {number} degrees - Direction in degrees
 * @returns {string} Compass direction label
 */
function compassLabel(degrees) {
  if (degrees == null) return '';
  let closest = 'N';
  let minDiff = 360;
  for (const [label, deg] of Object.entries(COMPASS_DIRECTIONS)) {
    const diff = Math.abs(((degrees - deg + 540) % 360) - 180);
    if (diff < minDiff) {
      minDiff = diff;
      closest = label;
    }
  }
  return closest;
}

/**
 * Build scroll entries for a date range.
 * @param {object} startDate - Start date { year, month, dayOfMonth }
 * @param {object} endDate - End date { year, month, dayOfMonth }
 * @param {object} [options] - Build options
 * @param {string} [options.calendarId] - Calendar ID (defaults to active)
 * @param {boolean} [options.showEmpty] - Include days with no events
 * @param {string} [options.entryDepth] - Content depth: title, excerpt, full, collapsible
 * @returns {object[]} Array of day entry objects
 */
export function buildScrollEntries(startDate, endDate, options = {}) {
  const { calendarId = null, showEmpty = false, entryDepth = 'excerpt' } = options;
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return [];
  const fogEnabled = isFogEnabled();
  const isGM = game.user.isGM;
  const moons = calendar.moonsArray || [];
  const weekdays = calendar.weekdaysArray || [];
  const yearZero = calendar.years?.yearZero ?? 0;
  const showWeather = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_SHOW_WEATHER);
  const showMoons = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_SHOW_MOON_PHASES);
  const showSeasons = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_SHOW_SEASON_CHANGES);
  const emptyContentTypes = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_EMPTY_CONTENT_TYPES);
  const currentComponents = calendar.timeToComponents(game.time.worldTime);
  const today = { year: currentComponents.year + yearZero, month: currentComponents.month, dayOfMonth: currentComponents.dayOfMonth };
  let prevSeasonName = null;
  let prevSeasonIcon = null;
  let prevSeasonColor = null;
  const dayBefore = addDays(startDate, -1);
  const dayBeforeInternal = { year: dayBefore.year - yearZero, month: dayBefore.month, dayOfMonth: dayBefore.dayOfMonth };
  if (showSeasons) {
    const prevSeason = calendar.getCurrentSeason?.(dayBeforeInternal);
    prevSeasonName = prevSeason?.name ? game.i18n.localize(prevSeason.name) : null;
    prevSeasonIcon = prevSeason?.icon || 'fas fa-leaf';
    prevSeasonColor = prevSeason?.color || '#84cc16';
  }
  const entries = [];
  let current = { ...startDate };
  while (compareDates(current, endDate) <= 0) {
    const { year, month, dayOfMonth } = current;
    const fogged = !isGM && fogEnabled && !isRevealed(year, month, dayOfMonth, calendarId);
    if (fogged) {
      entries.push(buildFoggedEntry(current, calendar, weekdays));
      current = addDays(current, 1);
      continue;
    }
    const parts = dateFormattingParts(calendar, { year, month, dayOfMonth });
    const weekdayIndex = dayOfWeek(current, calendar);
    const weekdayName = weekdays[weekdayIndex]?.name ? game.i18n.localize(weekdays[weekdayIndex].name) : '';
    const isToday = year === today.year && month === today.month && dayOfMonth === today.dayOfMonth;
    const isPastOrToday = compareDates(current, today) <= 0;
    const internalComponents = { year: year - yearZero, month, dayOfMonth };
    const banners = [];
    if (showSeasons) {
      const season = calendar.getCurrentSeason?.(internalComponents);
      const seasonName = season?.name ? game.i18n.localize(season.name) : null;
      if (seasonName && prevSeasonName && seasonName !== prevSeasonName) {
        const prevEntry = entries.length > 0 ? entries[entries.length - 1] : null;
        if (prevEntry && !prevEntry.fogged) {
          prevEntry.banners ??= [];
          prevEntry.banners.push({ type: 'season', icon: prevSeasonIcon, label: `${prevSeasonName} is ending`, color: prevSeasonColor });
          if (prevEntry.isEmpty) prevEntry.isEmpty = false;
        }
        banners.push({ type: 'season', icon: season.icon || 'fas fa-leaf', label: `${seasonName} Begins`, color: season.color || '#84cc16' });
      }
      prevSeasonName = seasonName;
      prevSeasonIcon = season?.icon || 'fas fa-leaf';
      prevSeasonColor = season?.color || '#84cc16';
    }
    if (showMoons) {
      for (let i = 0; i < moons.length; i++) {
        const phase = calendar.getMoonPhase(i, internalComponents);
        if (!phase || !phase.name) continue;
        const mid = Math.floor(phase.phaseDuration / 2);
        if (phase.dayWithinPhase === mid) {
          const icon = phase.icon || '';
          const isImage = icon && !icon.startsWith('fas ') && !icon.startsWith('far ');
          const phaseName = game.i18n.localize(phase.name);
          banners.push({ type: 'moon', icon, label: `${moons[i].name}: ${phaseName}`, color: moons[i].color || '#c0c0c0', isImage });
        }
      }
    }
    const stubs = NoteManager.getNotesForDate(year, month, dayOfMonth, calendarId);
    const notes = stubs.map((stub) => {
      const props = resolveStubDisplayProps(stub);
      const note = {
        id: stub.id,
        journalId: stub.journalId,
        name: stub.name,
        color: props.color,
        icon: props.icon,
        isFestival: props.isFestival,
        isOwner: stub.isOwner,
        author: stub.flagData.author?.name || null,
        allDay: stub.flagData.allDay ?? true
      };
      if (entryDepth !== 'title') {
        const content = stub.content || '';
        const excerpt = buildExcerpt(content);
        note.content = content;
        note.excerpt = excerpt;
        note.truncated = excerpt.endsWith('...');
      }
      return note;
    });
    if (showWeather && isPastOrToday) {
      const weatherData = WeatherManager.getWeatherForDate(year - yearZero, month, dayOfMonth);
      const sentence = buildWeatherSentence(weatherData);
      if (sentence) {
        const icon = weatherData.icon ? `fas ${weatherData.icon}` : 'fas fa-cloud';
        banners.push({ type: 'weather', icon, label: sentence, color: weatherData.color || '#b0c4de' });
      }
    }
    const hasFestival = notes.some((n) => n.isFestival);
    const contentBanners = banners.filter((b) => emptyContentTypes.has(b.type));
    const isEmpty = notes.length === 0 && contentBanners.length === 0;
    if (!isEmpty || showEmpty) {
      entries.push({ date: { year, month, dayOfMonth }, formattedDate: `${parts.D} ${parts.MMMM} ${parts.y}`, weekday: weekdayName, fogged: false, isToday, notes, banners, hasFestival, isEmpty });
    }
    current = addDays(current, 1);
  }
  return entries;
}

/**
 * Build a fogged (hidden) entry placeholder.
 * @param {object} date - Date object { year, month, dayOfMonth }
 * @param {object} calendar - Calendar instance
 * @param {object[]} weekdays - Array of weekday definitions
 * @returns {object} Fogged entry object
 */
function buildFoggedEntry(date, calendar, weekdays) {
  const parts = dateFormattingParts(calendar, date);
  const weekdayIndex = dayOfWeek(date, calendar);
  const weekdayName = weekdays[weekdayIndex]?.name ? game.i18n.localize(weekdays[weekdayIndex].name) : '';
  return { date: { ...date }, formattedDate: `${parts.D} ${parts.MMMM} ${parts.y}`, weekday: weekdayName, fogged: true, isToday: false, notes: [], banners: [], hasFestival: false, isEmpty: true };
}

/**
 * Compute the default date range starting from today.
 * @param {string} [_calendarId] - Calendar ID
 * @returns {{ startDate: object, endDate: object }} Start and end date range
 */
export function getDefaultDateRange(_calendarId = null) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return { startDate: { year: 0, month: 0, dayOfMonth: 0 }, endDate: { year: 0, month: 0, dayOfMonth: 29 } };
  const yearZero = calendar.years?.yearZero ?? 0;
  const components = calendar.timeToComponents(game.time.worldTime);
  const year = components.year + yearZero;
  const month = components.month;
  const dayOfMonth = components.dayOfMonth;
  const today = { year, month, dayOfMonth };
  const startDate = addDays(today, -30);
  const endDate = addDays(today, 30);
  return { startDate, endDate };
}
