/**
 * Shared utilities for calendar view applications.
 * @module Applications/CalendarViewUtils
 * @author Tyler
 */

import { BigCal, HUD, MiniCal, NoteViewer, Stopwatch, SunDial, TimeKeeper } from '../../applications/_module.mjs';
import { CalendarManager, CalendarRegistry, getEquivalentDates } from '../../calendar/_module.mjs';
import { MODULE, NOTE_VISIBILITY, SETTINGS, SOCKET_TYPES, TEMPLATES } from '../../constants.mjs';
import { NoteManager, addDays, compareDays, extractNoteMatchData, getEffectiveDuration, isRecurringMatch, resolveNoteDisplayProps } from '../../notes/_module.mjs';
import { WeatherManager } from '../../weather/_module.mjs';
import { CalendariaSocket, canViewWeatherForecast, format, formatCustom, isFogEnabled, isRevealed, localize, revealRange, toRomanNumeral } from '../_module.mjs';

const ContextMenu = foundry.applications.ux.ContextMenu.implementation;

/** @type {string|null} User-selected moon name override for display */
let selectedMoonOverride = null;

/** @type {string[]|null} BigCal visible moons override (session state) */
let visibleMoonsOverride = null;

/** @type {{tooltip: HTMLElement|null, handler: Function|null}} Active moon picker state */
const moonPickerState = { tooltip: null, handler: null };

/** @type {ContextMenu|null} Active day cell context menu instance */
let activeDayContextMenu = null;

/** @type {number} Max notes shown in day tooltip before overflow. */
const TOOLTIP_MAX_NOTES = 5;

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
 * Get the visible moons override for BigCal.
 * @returns {string[]|null} Array of moon names to display, or null for default
 */
export function getVisibleMoons() {
  return visibleMoonsOverride;
}

/**
 * Set the visible moons override for BigCal.
 * @param {string[]|null} moons - Array of moon names, or null to clear
 */
export function setVisibleMoons(moons) {
  visibleMoonsOverride = moons;
}

/**
 * Close any active moon picker tooltip.
 */
export function closeMoonPicker() {
  if (moonPickerState.handler) {
    document.removeEventListener('mousedown', moonPickerState.handler);
    moonPickerState.handler = null;
  }
  if (moonPickerState.tooltip) {
    moonPickerState.tooltip.remove();
    moonPickerState.tooltip = null;
  }
}

/**
 * Show a radial moon picker anchored to a target element.
 * @param {HTMLElement} anchor - The element to position relative to
 * @param {object[]} moons - Moon data array (from getAllMoonPhases)
 * @param {string|null} currentMoon - Currently selected moon name (highlighted)
 * @param {Function} onSelect - Callback when a moon is selected: (moonName) => void
 */
export async function showMoonPicker(anchor, moons, currentMoon, onSelect) {
  closeMoonPicker();
  if (!moons?.length) return;
  const tooltip = document.createElement('div');
  tooltip.className = 'calendaria-moon-picker';
  const radialSize = Math.min(250, Math.round(50 * Math.sqrt(moons.length) + 17 * (moons.length - 1)));
  const templateData = { moonCount: moons.length, radialSize, moons: moons.map((m) => ({ ...m, selected: m.moonName === currentMoon })) };
  tooltip.innerHTML = await foundry.applications.handlebars.renderTemplate(TEMPLATES.PARTIALS.MOON_PICKER, templateData);
  document.body.appendChild(tooltip);
  moonPickerState.tooltip = tooltip;
  tooltip.querySelectorAll('.radial-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.stopPropagation();
      const moonName = item.dataset.moonName;
      onSelect(moonName);
      closeMoonPicker();
    });
  });
  const targetRect = anchor.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  let left = targetRect.left + targetRect.width / 2 - tooltipRect.width / 2;
  let top = targetRect.bottom + 8;
  if (left < 10) left = 10;
  if (left + tooltipRect.width > window.innerWidth - 10) left = window.innerWidth - tooltipRect.width - 10;
  if (top + tooltipRect.height > window.innerHeight - 10) top = targetRect.top - tooltipRect.height - 8;
  top = Math.max(10, top);
  tooltip.style.left = `${left}px`;
  tooltip.style.top = `${top}px`;
  setTimeout(() => {
    moonPickerState.handler = (event) => {
      if (!tooltip.contains(event.target) && !event.target.closest('[data-action="showMoons"], [data-action="moonClick"]')) closeMoonPicker();
    };
    document.addEventListener('mousedown', moonPickerState.handler);
  }, 100);
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
  const showSecrets = game.user.isGM && game.settings.get(MODULE.ID, SETTINGS.SHOW_SECRET_NOTES);
  return notes.filter((page) => {
    const { visibility } = resolveNoteDisplayProps(page);
    if (visibility === NOTE_VISIBILITY.SECRET && !showSecrets) return false;
    if (game.user.isGM) return true;
    if (visibility !== NOTE_VISIBILITY.VISIBLE) return false;
    const journal = page.parent;
    return journal ? journal.testUserPermission(game.user, 'OBSERVER') : page.testUserPermission(game.user, 'OBSERVER');
  });
}

/**
 * Check if a date is today.
 * @param {number} year - Display year (with yearZero applied)
 * @param {number} month - Month (0-indexed)
 * @param {number} dayOfMonth - Day of month (0-indexed)
 * @param {object} [calendar] - Calendar to use (defaults to active)
 * @returns {boolean} True if the given date matches today's date
 */
export function isToday(year, month, dayOfMonth, calendar = null) {
  const today = game.time.components;
  calendar = calendar || CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  const displayYear = today.year + yearZero;
  return displayYear === year && today.month === month && (today.dayOfMonth ?? 0) === dayOfMonth;
}

/**
 * Get the current viewed date based on game time.
 * @param {object} [calendar] - Calendar to use
 * @returns {object} Date object with year, month, dayOfMonth (0-indexed)
 */
export function getCurrentViewedDate(calendar = null) {
  const components = game.time.components;
  calendar = calendar || CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  return { ...components, year: components.year + yearZero, dayOfMonth: components.dayOfMonth ?? 0 };
}

/**
 * Check if a day has any notes.
 * @param {object[]} notes - Notes to check
 * @param {number} year - Year
 * @param {number} month - Month
 * @param {number} dayOfMonth - Day (0-indexed)
 * @returns {boolean} True if at least one note exists on the specified day
 */
export function hasNotesOnDay(notes, year, month, dayOfMonth) {
  const targetDate = { year, month, dayOfMonth };
  return notes.some((page) => isRecurringMatch(extractNoteMatchData(page), targetDate));
}

/**
 * Build weather pill template data from a getDayWeather result.
 * @param {object|null} wd - Weather data from getDayWeather
 * @returns {object} Template properties for the weather pill
 */
export function buildWeatherPillData(wd) {
  if (!wd) return { weatherIcon: null, weatherColor: null, weatherLabel: null, weatherTemp: null, weatherWindDir: null, weatherTooltipHtml: null, isForecast: false };
  const temp = wd.temperature != null ? WeatherManager.formatTemperature(wd.temperature) : null;
  const showBothUnits = game.settings.get(MODULE.ID, SETTINGS.TEMPERATURE_SHOW_BOTH);
  const windDir = !showBothUnits && wd.wind?.direction != null ? WeatherManager.getWindDirectionLabel(wd.wind.direction) : null;
  const tooltipArgs = {
    label: wd.label,
    description: wd.description ?? null,
    temp,
    windSpeed: wd.wind?.speed ?? 0,
    windKph: wd.wind?.kph ?? null,
    windDirection: wd.wind?.direction,
    precipType: wd.precipitation?.type ?? null,
    precipIntensity: wd.precipitation?.intensity
  };
  const tooltipHtml = wd.periods ? WeatherManager.buildWeatherTooltipWithPeriods(tooltipArgs, wd.periods, wd.activePeriod) : WeatherManager.buildWeatherTooltip(tooltipArgs);
  return { weatherIcon: wd.icon, weatherColor: wd.color, weatherLabel: wd.label, weatherTemp: temp, weatherWindDir: windDir, weatherTooltipHtml: tooltipHtml, isForecast: wd.isForecast ?? false };
}

/**
 * Render weather indicator HTML.
 * @param {object} params - Normalized weather params
 * @param {object|null} params.weather - Weather data { icon, label, color, temperature, tooltipHtml, windSpeed, windDirection, precipType }
 * @param {string} params.displayMode - Display mode ('full', 'icon', 'iconTemp', 'temp')
 * @param {boolean} params.canInteract - Whether user can open weather picker
 * @param {boolean} [params.showBlock] - Whether to show empty-state block when no weather
 * @returns {string} HTML string
 */
export function renderWeatherIndicator({ weather, displayMode, canInteract, showBlock = true }) {
  if (weather) {
    const clickable = canInteract ? ' clickable' : '';
    const action = canInteract ? 'data-action="openWeatherPicker"' : '';
    const showIcon = displayMode === 'full' || displayMode === 'icon' || displayMode === 'iconTemp';
    const showLabel = displayMode === 'full';
    const showTemp = displayMode === 'full' || displayMode === 'temp' || displayMode === 'iconTemp';
    const icon = showIcon ? `<i class="${weather.icon}"></i>` : '';
    const label = showLabel ? `<span class="weather-label">${weather.label}</span>` : '';
    const temp = showTemp && weather.temperature ? `<span class="weather-temp">${weather.temperature}</span>` : '';
    let windHtml = '';
    if (showLabel && weather.windSpeed > 0) {
      const rotation = weather.windDirection != null ? (weather.windDirection + 180) % 360 : 0;
      windHtml = `<span class="weather-wind"><i class="fas fa-up-long" style="transform: rotate(${rotation}deg)"></i></span>`;
    }
    let precipHtml = '';
    if (showLabel && weather.precipType) precipHtml = `<span class="weather-precip"><i class="fas fa-droplet"></i></span>`;
    return `<span class="weather-indicator${clickable} weather-mode-${displayMode}" ${action} style="--weather-color: ${weather.color}" data-tooltip-html="${weather.tooltipHtml}">${icon}${label}${temp}${windHtml}${precipHtml}</span>`;
  } else if (showBlock && canInteract && WeatherManager.getCalendarZones().length > 0) {
    return `<span class="weather-indicator clickable no-weather" data-action="openWeatherPicker" data-tooltip="${localize('CALENDARIA.Weather.ClickToGenerate')}"><i class="fas fa-cloud"></i></span>`;
  }
  return '';
}

/**
 * Render season indicator HTML.
 * @param {object} params - Normalized season params
 * @param {object|null} params.season - Season data { name, icon, color }
 * @param {string} params.displayMode - Display mode ('full', 'icon', 'text')
 * @returns {string} HTML string
 */
export function renderSeasonIndicator({ season, displayMode }) {
  if (!season) return '';
  const showIcon = displayMode === 'full' || displayMode === 'icon';
  const showLabel = displayMode === 'full' || displayMode === 'text';
  const icon = showIcon ? `<i class="${season.icon}"></i>` : '';
  const label = showLabel ? `<span class="season-label">${season.name}</span>` : '';
  return `<span class="season-indicator" style="--season-color: ${season.color}" data-tooltip="${season.name}">${icon}${label}</span>`;
}

/**
 * Render era indicator HTML.
 * @param {object} params - Normalized era params
 * @param {object|null} params.era - Era data { name, abbreviation }
 * @param {string} params.displayMode - Display mode ('full', 'icon', 'text', 'abbr')
 * @returns {string} HTML string
 */
export function renderEraIndicator({ era, displayMode }) {
  if (!era) return '';
  const showIcon = displayMode === 'full' || displayMode === 'icon';
  const showLabel = displayMode === 'full' || displayMode === 'text';
  const showAbbr = displayMode === 'abbr';
  const icon = showIcon ? '<i class="fas fa-hourglass-half"></i>' : '';
  let label = '';
  if (showLabel) label = `<span class="era-label">${era.name}</span>`;
  else if (showAbbr) label = `<span class="era-label">${era.abbreviation || era.name}</span>`;
  return `<span class="era-indicator" data-tooltip="${era.name}">${icon}${label}</span>`;
}

/**
 * Render cycle indicator HTML.
 * @param {object} params - Normalized cycle params
 * @param {object|null} params.cycleData - Cycle data { values: [{ index, entryName }] }
 * @param {string} params.displayMode - Display mode ('icon', 'number', 'roman', 'name')
 * @param {string} [params.cycleText] - Tooltip text
 * @returns {string} HTML string
 */
export function renderCycleIndicator({ cycleData, displayMode, cycleText }) {
  if (!cycleData?.values?.length) return '';
  const icon = '<i class="fas fa-arrows-rotate"></i>';
  if (displayMode === 'icon') return `<span class="cycle-indicator" data-tooltip="${cycleText}">${icon}</span>`;
  let displayText = '';
  if (displayMode === 'number') displayText = cycleData.values.map((v) => v.index + 1).join(', ');
  else if (displayMode === 'roman') displayText = cycleData.values.map((v) => toRomanNumeral(v.index + 1)).join(', ');
  else displayText = cycleData.values.map((v) => v.entryName).join(', ');
  const label = `<span class="cycle-label">${displayText}</span>`;
  return `<span class="cycle-indicator" data-tooltip="${cycleText || displayText}">${icon}${label}</span>`;
}

/**
 * Get notes that start on a specific day.
 * @param {object[]} notes - Notes to filter
 * @param {number} year - Year
 * @param {number} month - Month
 * @param {number} dayOfMonth - Day (0-indexed)
 * @returns {object[]} Notes that start on the specified day
 */
export function getNotesForDay(notes, year, month, dayOfMonth) {
  return notes.filter((page) => {
    const start = page.system.startDate;
    const end = page.system.endDate;
    if (start.year !== year || start.month !== month || start.dayOfMonth !== dayOfMonth) return false;
    const hasValidEndDate = end && end.year != null && end.month != null && end.dayOfMonth != null;
    if (!hasValidEndDate) return true;
    if (end.year !== start.year || end.month !== start.month || end.dayOfMonth !== start.dayOfMonth) return false;
    return true;
  });
}

/**
 * Get the selected moon's phase for a specific day.
 * @param {object} calendar - The calendar
 * @param {number} year - Display year
 * @param {number} month - Month
 * @param {number} dayOfMonth - Day (0-indexed)
 * @returns {object|null} Moon phase data with icon and tooltip
 */
export function getFirstMoonPhase(calendar, year, month, dayOfMonth) {
  if (!calendar?.moonsArray?.length) return null;
  const sortedMoons = [...calendar.moonsArray].map((m, i) => ({ ...m, originalIndex: i })).sort((a, b) => localize(a.name).localeCompare(localize(b.name)));
  let moon = sortedMoons[0];
  if (selectedMoonOverride) {
    const overrideMoon = sortedMoons.find((m) => localize(m.name) === selectedMoonOverride);
    if (overrideMoon) moon = overrideMoon;
  }
  const internalYear = year - (calendar.years?.yearZero ?? 0);
  const dayComponents = { year: internalYear, month, dayOfMonth, hour: 12, minute: 0, second: 0 };
  const dayWorldTime = calendar.componentsToTime(dayComponents);
  const phase = calendar.getMoonPhase(moon.originalIndex, dayWorldTime);
  if (!phase) return null;
  const color = moon.color || null;
  return { icon: phase.icon, color, hue: color ? Math.round(foundry.utils.Color.from(color).hsv[0] * 360) : null, tooltip: `${localize(moon.name)}: ${phase.subPhaseName || localize(phase.name)}` };
}

/**
 * Get all moon phases for a specific day, sorted alphabetically.
 * @param {object} calendar - The calendar
 * @param {number} year - Display year
 * @param {number} month - Month
 * @param {number} dayOfMonth - Day (0-indexed)
 * @returns {Array|null} Array of moon phase data sorted alphabetically by moon name
 */
export function getAllMoonPhases(calendar, year, month, dayOfMonth) {
  if (!calendar?.moonsArray?.length) return null;
  const internalYear = year - (calendar.years?.yearZero ?? 0);
  const dayComponents = { year: internalYear, month, dayOfMonth, hour: 12, minute: 0, second: 0 };
  const dayWorldTime = calendar.componentsToTime(dayComponents);
  return calendar.moonsArray
    .map((moon, index) => {
      const phase = calendar.getMoonPhase(index, dayWorldTime);
      if (!phase) return null;
      const color = moon.color || null;
      return {
        moonName: localize(moon.name),
        phaseName: phase.subPhaseName || localize(phase.name),
        icon: phase.icon,
        color,
        hue: color ? Math.round(foundry.utils.Color.from(color).hsv[0] * 360) : null
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.moonName.localeCompare(b.moonName));
}

/**
 * Build a forecast lookup map for day weather resolution.
 * @returns {{ lookup: Map|null, todayYear: number, todayMonth: number, todayDayOfMonth: number }} Forecast data and today info
 */
export function buildWeatherLookup() {
  const today = game.time.components;
  const calendar = CalendarManager.getActiveCalendar();
  const yz = calendar?.years?.yearZero ?? 0;
  const todayYear = today.year + yz;
  const todayMonth = today.month;
  const todayDayOfMonth = today.dayOfMonth ?? 0;
  const zoneId = WeatherManager.getActiveZone(null, game.scenes?.active)?.id ?? null;
  let lookup = null;
  if (canViewWeatherForecast() && game.settings.get(MODULE.ID, SETTINGS.AUTO_GENERATE_WEATHER)) {
    const forecastOpts = zoneId ? { zoneId } : {};
    const forecast = WeatherManager.getForecast(forecastOpts);
    lookup = new Map(forecast.map((f) => [`${f.year + yz}-${f.month}-${f.dayOfMonth}`, f]));
  }
  return { lookup, todayYear, todayMonth, todayDayOfMonth, zoneId };
}

/**
 * Get weather data for a specific day cell.
 * @param {number} year - Display year
 * @param {number} month - Month (0-indexed)
 * @param {number} dayOfMonth - Day (0-indexed)
 * @param {object} todayInfo - Today info from buildWeatherLookup
 * @param {number} todayInfo.todayYear - Today's display year
 * @param {number} todayInfo.todayMonth - Today's month
 * @param {number} todayInfo.todayDayOfMonth - Today's day (0-indexed)
 * @param {Map|null} forecastLookup - Forecast lookup map
 * @returns {object|null} Weather data with icon, color, label, temperature, isForecast, isVaried
 */
export function getDayWeather(year, month, dayOfMonth, todayInfo, forecastLookup) {
  const { todayYear, todayMonth, todayDayOfMonth, zoneId } = todayInfo;
  const calendarId = CalendarManager.getActiveCalendar()?.metadata?.id;
  const resolveLabel = (id, label) => WeatherManager.resolveDisplayLabel(id, label, calendarId, zoneId);
  const isCurrentDay = year === todayYear && month === todayMonth && dayOfMonth === todayDayOfMonth;
  if (isCurrentDay) {
    const w = WeatherManager.getCurrentWeather(zoneId);
    if (!w) return null;
    const temp = WeatherManager.getTemperature(zoneId);
    const result = {
      icon: w.icon,
      color: w.color,
      label: resolveLabel(w.id, w.label),
      description: w.description ? localize(w.description) : null,
      temperature: temp,
      wind: w.wind ?? null,
      precipitation: w.precipitation ?? null,
      isForecast: false,
      isVaried: false
    };
    if (w.periods && (game.user.isGM || canViewWeatherForecast())) {
      result.periods = w.periods;
      result.activePeriod = w.activePeriod;
    }
    return result;
  }
  const yz = CalendarManager.getActiveCalendar()?.years?.yearZero ?? 0;
  const hist = WeatherManager.getWeatherForDate(year - yz, month, dayOfMonth, zoneId);
  if (hist)
    return {
      icon: hist.icon,
      color: hist.color,
      label: resolveLabel(hist.id, hist.label),
      description: null,
      temperature: hist.temperature ?? null,
      wind: hist.wind ?? null,
      precipitation: hist.precipitation ?? null,
      isForecast: false,
      isVaried: false
    };
  if (forecastLookup) {
    const f = forecastLookup.get(`${year}-${month}-${dayOfMonth}`);
    if (f) {
      const result = {
        icon: f.preset.icon,
        color: f.preset.color,
        label: resolveLabel(f.preset.id, f.preset.label),
        description: f.preset.description ? localize(f.preset.description) : null,
        temperature: f.temperature ?? null,
        wind: f.wind ?? null,
        precipitation: f.precipitation ?? null,
        isForecast: true,
        isVaried: f.isVaried ?? false
      };
      if (f.periods) result.periods = f.periods;
      return result;
    }
  }
  return null;
}

/**
 * Get notes on a specific day for context menu display.
 * @param {number} year - Display year
 * @param {number} month - Month (0-indexed)
 * @param {number} dayOfMonth - Day (0-indexed)
 * @returns {object[]} Notes on this day
 */
export function getNotesOnDay(year, month, dayOfMonth) {
  if (isFogEnabled() && !isRevealed(year, month, dayOfMonth)) return [];
  const allNotes = getCalendarNotes();
  const visibleNotes = getVisibleNotes(allNotes);
  const targetDate = { year, month, dayOfMonth };
  const matching = visibleNotes.filter((page) => isRecurringMatch(extractNoteMatchData(page), targetDate));
  const seenFestivals = new Set();
  return matching.filter((page) => {
    const festivalKey = page.system?.linkedFestival?.festivalKey;
    if (!festivalKey) return true;
    if (seenFestivals.has(festivalKey)) return false;
    seenFestivals.add(festivalKey);
    return true;
  });
}

/**
 * Set the game time to a specific date.
 * @param {number} year - Display year
 * @param {number} month - Month (0-indexed)
 * @param {number} dayOfMonth - Day (0-indexed)
 * @param {object} [calendar] - Calendar to use
 */
export async function setDateTo(year, month, dayOfMonth, calendar = null) {
  calendar = calendar || CalendarManager.getActiveCalendar();
  const yearZero = calendar?.years?.yearZero ?? 0;
  const internalYear = year - yearZero;
  const currentComponents = game.time.components;
  const newComponents = { year: internalYear, month, dayOfMonth, hour: currentComponents.hour, minute: currentComponents.minute, second: currentComponents.second };
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
 * @param {number} dayOfMonth - Day (0-indexed)
 * @returns {Promise<object|null>} The created note page, or null if creation failed
 */
export async function createNoteOnDate(year, month, dayOfMonth) {
  const components = game.time.components ?? {};
  const hour = components.hour ?? 12;
  const page = await NoteManager.createNote({
    name: localize('CALENDARIA.Note.NewNote'),
    noteData: { startDate: { year, month, dayOfMonth, hour, minute: 0 }, endDate: { year, month, dayOfMonth, hour: hour + 1, minute: 0 } },
    source: 'ui'
  });
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
    const dayOfMonth = parseInt(target.dataset.day);
    if (!game.user.isGM && isFogEnabled() && !isRevealed(year, month, dayOfMonth)) return [];
    const notes = getNotesOnDay(year, month, dayOfMonth);
    const today = getCurrentViewedDate(calendar);
    const isTodayDate = year === today.year && month === today.month && dayOfMonth === today.dayOfMonth;
    const items = [];
    items.push({
      name: 'CALENDARIA.Common.AddNote',
      icon: '<i class="fas fa-plus"></i>',
      callback: async () => {
        await createNoteOnDate(year, month, dayOfMonth);
        onCreateNote?.();
      }
    });
    if (game.user.isGM && !isTodayDate) {
      items.push({
        name: 'CALENDARIA.MiniCal.SetCurrentDate',
        icon: '<i class="fas fa-calendar-check"></i>',
        callback: async () => {
          await setDateTo(year, month, dayOfMonth, calendar);
          onSetDate?.();
        }
      });
    }
    if (game.user.isGM && isFogEnabled()) {
      items.push({
        name: 'CALENDARIA.FogOfWar.RevealToHere',
        icon: '<i class="fas fa-eye"></i>',
        callback: async () => {
          const currentDate = getCurrentViewedDate(calendar);
          const start = { year: currentDate.year, month: currentDate.month, dayOfMonth: currentDate.dayOfMonth };
          const end = { year, month, dayOfMonth };
          if (compareDays(start, end) > 0) await revealRange(end, start);
          else await revealRange(start, end);
        }
      });
    }
    items.push({
      name: 'CALENDARIA.Common.OpenChronicle',
      icon: '<i class="fas fa-scroll"></i>',
      callback: () => CALENDARIA.apps.Chronicle.show()
    });
    if (extraItems?.length) items.push(...extraItems);
    if (notes.length > 0) {
      const sortedNotes = [...notes].sort((a, b) => a.name.localeCompare(b.name));
      const shown = sortedNotes.slice(0, TOOLTIP_MAX_NOTES);
      for (const note of shown) {
        const isOwner = note.isOwner;
        const noteIcon = note.system?.icon || 'fas fa-sticky-note';
        const noteColor = note.system?.color || '#4a9eff';
        const iconHtml = note.system?.iconType === 'fontawesome' ? `<i class="${noteIcon}" style="color: ${noteColor}"></i>` : `<i class="fas fa-sticky-note" style="color: ${noteColor}"></i>`;
        items.push({ name: note.name, icon: iconHtml, group: 'notes', _noteData: { note, isOwner }, callback: () => note.sheet.render(true, { mode: isOwner ? 'edit' : 'view' }) });
      }
      const remaining = sortedNotes.length - shown.length;
      if (remaining > 0) {
        items.push({
          name: `+${remaining} ${localize('CALENDARIA.Common.More')}`,
          icon: '<i class="fas fa-ellipsis-h"></i>',
          group: 'notes',
          callback: () => NoteViewer.show({ date: { year, month: month + 1, day: dayOfMonth + 1 } })
        });
      }
    }
    return items;
  };
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
  const dayOfMonth = parseInt(target.dataset.day);
  const internalYear = year - (calendar.years?.yearZero ?? 0);
  const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
  const midday = Math.floor(hoursPerDay / 2);
  const internalComponents = { year: internalYear, month, dayOfMonth, hour: midday, minute: 0, second: 0 };
  const fullDate = formatCustom(calendar, internalComponents, 'Do of MMMM, Y GGGG');
  const season = calendar.getCurrentSeason?.(internalComponents);
  const seasonName = season ? localize(season.name) : null;
  const zone = WeatherManager.getActiveZone?.(null, game.scenes?.active);
  const sunriseHour = calendar.sunrise?.(internalComponents, zone) ?? 6;
  const sunsetHour = calendar.sunset?.(internalComponents, zone) ?? 18;
  const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
  const formatTime = (hours) => {
    let h = Math.floor(hours);
    let m = Math.round((hours - h) * minutesPerHour);
    if (m >= minutesPerHour) {
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
export function escapeText(str) {
  return (str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Encode HTML for safe use in data-tooltip-html attribute.
 * @param {string} html - HTML string to encode
 * @returns {string} HTML-encoded string (< becomes &lt; etc.)
 */
export function encodeHtmlAttribute(html) {
  return html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * Strip secret sections from HTML content for non-GM users.
 * @param {string} html - Raw HTML content
 * @returns {string} Sanitized HTML with secrets removed for non-GMs
 */
export function stripSecrets(html) {
  if (!html || game.user.isGM) return html ?? '';
  const temp = document.createElement('div');
  temp.innerHTML = html;
  temp.querySelectorAll('section.secret:not(.revealed)').forEach((el) => el.remove());
  return temp.innerHTML;
}

/**
 * Create a truncated HTML snippet preserving block-level line breaks.
 * @param {string} html - Raw HTML content
 * @param {number} [maxLength] - Maximum text length (default 120)
 * @returns {string} Truncated HTML snippet or empty string
 */
export function previewSnippet(html, maxLength = 120) {
  if (!html) return '';
  const clean = foundry.utils.cleanHTML(html);
  const container = document.createElement('div');
  container.innerHTML = clean;
  const text = container.textContent || '';
  if (!text.trim()) return '';
  if (text.length <= maxLength) return clean;
  let count = 0;
  const truncate = (node) => {
    for (const child of [...node.childNodes]) {
      if (count >= maxLength) {
        child.remove();
        continue;
      }
      if (child.nodeType === Node.TEXT_NODE) {
        const remaining = maxLength - count;
        if (child.textContent.length > remaining) {
          child.textContent = `${child.textContent.slice(0, remaining)}…`;
          count = maxLength;
        } else {
          count += child.textContent.length;
        }
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        truncate(child);
      }
    }
  };
  truncate(container);
  return container.innerHTML;
}

/**
 * Find festival note info for a specific day using recurrence/conditionTree matching.
 * @param {object[]} notes - All visible note pages
 * @param {number} year - Display year
 * @param {number} month - Month (0-indexed)
 * @param {number} dayOfMonth - Day (0-indexed)
 * @returns {object|null} Festival info or null
 */
export function getFestivalNoteForDay(notes, year, month, dayOfMonth) {
  const targetDate = { year, month, dayOfMonth };
  const fn = notes.find((p) => p.system?.linkedFestival && isRecurringMatch(extractNoteMatchData(p), targetDate));
  if (!fn) return null;
  const matchData = extractNoteMatchData(fn);
  const isStart = isRecurringMatch({ ...matchData, hasDuration: false, duration: 0 }, targetDate);
  const duration = getEffectiveDuration(matchData);
  let isEnd = false;
  if (duration > 0 && !isStart) {
    const potentialStart = addDays(targetDate, -duration);
    isEnd = isRecurringMatch({ ...matchData, hasDuration: false, duration: 0 }, potentialStart);
  }
  const isMiddle = !isStart && !isEnd;
  const showBookends = fn.system?.showBookends || false;
  const name = fn.name || '';
  const descEl = document.createElement('div');
  descEl.innerHTML = foundry.utils.cleanHTML(fn.text?.content || '');
  const description = descEl.textContent || '';
  const color = fn.system?.color || '';
  const icon = fn.system?.icon || '';
  const iconType = fn.system?.iconType || 'fontawesome';
  const position = isStart ? 'starting' : isEnd ? 'ending' : null;
  let countsForWeekday = true;
  const linked = fn.system?.linkedFestival;
  if (linked && isStart) {
    const cal = CalendarManager.getCalendar(linked.calendarId);
    const festDef = cal?.festivals?.[linked.festivalKey];
    if (festDef && festDef.countsForWeekday === false) countsForWeekday = false;
  }
  const effectiveBookends = countsForWeekday ? showBookends : false;
  const effectiveShowVisuals = !effectiveBookends || !isMiddle;
  return { note: fn, name, description, color, icon, iconType, isStart, isEnd, isMiddle, showBookends: effectiveBookends, showVisuals: effectiveShowVisuals, position, countsForWeekday };
}

/**
 * Generate HTML tooltip content for a day cell.
 * @param {object} calendar - The calendar
 * @param {number} year - Display year (with yearZero applied)
 * @param {number} month - Month (0-indexed)
 * @param {number} dayOfMonth - Day of month (0-indexed)
 * @param {object} [festival] - Optional festival data
 * @param {string} [festival.name] - Festival name
 * @param {string} [festival.description] - Festival description
 * @param {string} [festival.color] - Festival color
 * @param {string} [festival.position] - 'starting' or 'ending' prefix
 * @param {object|null} [weatherData] - Weather data from getDayWeather
 * @param {object[]} [notes] - Enriched note objects (from enrichNoteForDisplay)
 * @returns {string} HTML tooltip content (HTML-encoded for use in data-tooltip-html attribute)
 */
export function generateDayTooltip(calendar, year, month, dayOfMonth, festival = null, weatherData = null, notes = null) {
  const internalYear = year - (calendar.years?.yearZero ?? 0);
  const displayComponents = { year, month, dayOfMonth, hour: 12, minute: 0, second: 0 };
  const internalComponents = { year: internalYear, month, dayOfMonth, hour: 12, minute: 0, second: 0 };
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
  rows.push(`<div class="date"><strong>${escapeText(fullDate)}</strong></div>`);
  if (festival?.name) {
    const colorStyle = festival.color ? ` style="color: ${festival.color}"` : '';
    const prefix = festival.position ? `${localize(`CALENDARIA.Note.Festival.${festival.position === 'starting' ? 'Starting' : 'Ending'}`)}: ` : '';
    let festivalText = prefix + escapeText(festival.name);
    if (festival.description) festivalText += `: ${escapeText(festival.description)}`;
    rows.push(`<div class="festival"${colorStyle}><em>${festivalText}</em></div>`);
  }
  if (seasonName) rows.push(`<div class="season">${escapeText(seasonName)}</div>`);
  rows.push(`<div class="sun"><i class="fas fa-sun"></i> ${formatTime(sunriseHour)} <i class="fas fa-moon"></i> ${formatTime(sunsetHour)}</div>`);
  if (weatherData) {
    const prefix = weatherData.isForecast ? `${localize('CALENDARIA.Weather.Forecast')}: ` : '';
    const tempStr = weatherData.temperature != null ? ` ${weatherData.isForecast && weatherData.isVaried ? '~' : ''}${WeatherManager.formatTemperature(weatherData.temperature)}` : '';
    rows.push(`<div class="weather"><i class="fas ${weatherData.icon}" style="color:${weatherData.color}"></i> ${prefix}${escapeText(weatherData.label)}${tempStr}</div>`);
  }
  const eqCalendars = game.settings.get(MODULE.ID, SETTINGS.EQUIVALENT_DATE_CALENDARS);
  if (eqCalendars.size) {
    const activeId = CalendarRegistry.getActiveId();
    const equivalents = getEquivalentDates({ year, month, dayOfMonth }, activeId, [...eqCalendars]);
    if (equivalents.length) {
      const eqRows = equivalents.map((eq) => `<div class="equivalent-date"><i class="fas fa-calendar-alt"></i> ${escapeText(eq.calendarName)}: ${escapeText(eq.formatted)}</div>`);
      rows.push(`<div class="equivalent-dates">${eqRows.join('')}</div>`);
    }
  }
  if (notes?.length) {
    const festivalNotes = notes.filter((n) => n.isFestival);
    const regularNotes = notes.filter((n) => !n.isFestival);
    const noteRows = [];
    for (const n of festivalNotes) noteRows.push(`<div class="tooltip-note festival" style="color: ${n.color}"><i class="fas fa-star"></i> ${escapeText(n.name)}</div>`);
    const shown = regularNotes.slice(0, TOOLTIP_MAX_NOTES - festivalNotes.length);
    for (const n of shown) noteRows.push(`<div class="tooltip-note">${`<span class="tooltip-note-dot" style="background: ${n.color}"></span>`} ${escapeText(n.name)}</div>`);
    const remaining = notes.length - festivalNotes.length - shown.length;
    if (remaining > 0) noteRows.push(`<div class="tooltip-note more">+${remaining} ${localize('CALENDARIA.Common.More')}</div>`);
    rows.push(`<div class="tooltip-notes">${noteRows.join('')}</div>`);
  }
  const rawHtml = `<div class="calendaria"><div class="day-tooltip">${rows.join('')}</div></div>`;
  return encodeHtmlAttribute(rawHtml);
}

/**
 * Get equivalent date HTML tooltip for a given display date.
 * @param {number} year - Display year (with yearZero)
 * @param {number} month - Month index (0-indexed)
 * @param {number} dayOfMonth - Day of month (0-indexed)
 * @returns {string} HTML string for tooltip, or empty string
 */
export function getEquivalentDateTooltip(year, month, dayOfMonth) {
  const eqCalendars = game.settings.get(MODULE.ID, SETTINGS.EQUIVALENT_DATE_CALENDARS);
  if (!eqCalendars.size) return '';
  const activeId = CalendarRegistry.getActiveId();
  const equivalents = getEquivalentDates({ year, month, dayOfMonth }, activeId, [...eqCalendars]);
  if (!equivalents.length) return '';
  const eqRows = equivalents.map((eq) => `<div class="equivalent-date"><i class="fas fa-calendar-alt"></i> ${escapeText(eq.calendarName)}: ${escapeText(eq.formatted)}</div>`);
  return encodeHtmlAttribute(`<div class="calendaria"><div class="day-tooltip"><div class="equivalent-dates">${eqRows.join('')}</div></div></div>`);
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
        menu?.classList.add('calendaria');
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
            actions.innerHTML = `<i class="fas fa-pen-to-square" data-action="edit" data-tooltip="${localize('CALENDARIA.Common.Edit')}"></i><i class="fas fa-trash" data-action="delete" data-tooltip="${localize('CALENDARIA.Common.Delete')}"></i>`;
            nameSpan.appendChild(actions);
            actions.addEventListener('click', async (e) => {
              e.stopPropagation();
              const action = e.target.closest('[data-action]')?.dataset?.action;
              if (action === 'edit') {
                note.sheet.render(true, { mode: 'edit', forceMode: 'edit' });
                ui.context?.close();
              } else if (action === 'delete') {
                ui.context?.close();
                const confirmed = await foundry.applications.api.DialogV2.confirm({
                  window: { title: localize('CALENDARIA.Common.DeleteNote') },
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

/**
 * Build the "Open" context menu entry that spawns a fixed submenu with all 6 apps.
 * @returns {object} A ContextMenuEntry object
 */
export function buildOpenAppsMenuItem() {
  const pointer = { x: 0, y: 0 };
  const onMove = (e) => {
    pointer.x = e.clientX;
    pointer.y = e.clientY;
  };
  document.addEventListener('pointermove', onMove, { passive: true });
  return {
    name: 'CALENDARIA.Common.Open',
    icon: '<i class="fas fa-arrow-right"></i>',
    callback: () => {
      document.removeEventListener('pointermove', onMove);
      requestAnimationFrame(async () => {
        const subItems = [
          { name: 'CALENDARIA.Common.BigCal', icon: '<i class="fas fa-calendar-days"></i>', callback: () => BigCal.show() },
          { name: 'CALENDARIA.Common.MiniCal', icon: '<i class="fas fa-calendar-alt"></i>', callback: () => MiniCal.show() },
          { name: 'CALENDARIA.SettingsPanel.Tab.HUD', icon: '<i class="fas fa-layer-group"></i>', callback: () => HUD.show() },
          { name: 'CALENDARIA.Common.TimeKeeper', icon: '<i class="fas fa-clock"></i>', callback: () => TimeKeeper.show() },
          { name: 'CALENDARIA.Common.StopWatch', icon: '<i class="fas fa-stopwatch"></i>', callback: () => Stopwatch.show() },
          { name: 'CALENDARIA.SettingsPanel.Tab.SunDial', icon: '<i class="fas fa-sun"></i>', callback: () => SunDial.show() },
          { name: 'CALENDARIA.Chronicle.Title', icon: '<i class="fas fa-scroll"></i>', callback: () => CALENDARIA.apps.Chronicle.show() }
        ];
        const subMenu = new ContextMenu(document.body, '.calendaria-open-submenu-no-match', subItems, { fixed: true, jQuery: false });
        await subMenu.render(document.body, { event: { clientX: pointer.x, clientY: pointer.y } });
        ui.context = subMenu;
      });
    }
  };
}

/**
 * Compute leading days from the previous month to fill the first week row of a calendar grid.
 * @param {object} calendar - Calendar instance
 * @param {number} year - Display year (with yearZero applied)
 * @param {number} month - Month index (0-based)
 * @param {number} startDayOfWeek - Starting weekday index for this month
 * @returns {Array<{day: number, dayOfMonth: number, year: number, month: number, isFromOtherMonth: boolean}>} Leading day objects
 */
export function getLeadingDays(calendar, year, month, startDayOfWeek) {
  if (startDayOfWeek <= 0) return [];
  const yearZero = calendar.years?.yearZero ?? 0;
  const totalMonths = calendar.monthsArray.length;
  const prevDays = [];
  let remainingSlots = startDayOfWeek;
  let checkMonth = month === 0 ? totalMonths - 1 : month - 1;
  let checkYear = month === 0 ? year - 1 : year;
  let checkDay = calendar.getDaysInMonth(checkMonth, checkYear - yearZero);
  while (remainingSlots > 0 && checkDay > 0) {
    const festivalDay = calendar.findFestivalDay({ year: checkYear - yearZero, month: checkMonth, dayOfMonth: checkDay - 1 });
    if (festivalDay?.countsForWeekday === false) {
      checkDay--;
      continue;
    }
    prevDays.unshift({ day: checkDay, dayOfMonth: checkDay - 1, year: checkYear, month: checkMonth, isFromOtherMonth: true });
    remainingSlots--;
    checkDay--;
    if (checkDay < 1 && remainingSlots > 0) {
      checkMonth = checkMonth === 0 ? totalMonths - 1 : checkMonth - 1;
      if (checkMonth === totalMonths - 1) checkYear--;
      checkDay = calendar.getDaysInMonth(checkMonth, checkYear - yearZero);
    }
  }
  return prevDays;
}
