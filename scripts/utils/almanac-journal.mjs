import { CalendarManager } from '../calendar/_module.mjs';
import { MODULE, MOON_VISIBILITY, SETTINGS } from '../constants.mjs';
import { addDays, dayOfWeek } from '../notes/_module.mjs';
import { WeatherManager } from '../weather/_module.mjs';
import { buildWeatherSentence } from './chronicle-data.mjs';
import { dateFormattingParts } from './formatting/format-utils.mjs';

/** Journal flag marking the world's almanac journal. */
const ALMANAC_JOURNAL_FLAG = 'isAlmanacJournal';

/**
 * Build one list row.
 * @param {string} label - Row label (escaped here)
 * @param {string} body - Row body (already escaped, or enricher markup)
 * @returns {string} List item HTML
 */
function row(label, body) {
  return `<li><strong>${foundry.utils.escapeHTML(label)}</strong>: ${body}</li>`;
}

/**
 * Format a date as an almanac day label.
 * @param {object} calendar - Calendar instance
 * @param {object} date - Display date { year, month, dayOfMonth }
 * @returns {string} Day label
 */
function formatDay(calendar, date) {
  const parts = dateFormattingParts(calendar, date);
  return [parts.D, parts.MMMM, parts.y].filter(Boolean).join(' ');
}

/**
 * Resolve the first day of the week containing a date.
 * @param {object} date - Display date { year, month, dayOfMonth }
 * @param {object} calendar - Calendar instance
 * @returns {object} Display date of that week's first day
 */
export function weekStartFor(date, calendar) {
  return addDays(date, -dayOfWeek(date, calendar));
}

/**
 * Build one weekday-labelled day row: its weather followed by a live lookup of that day's notes.
 * @param {object} calendar - Calendar instance
 * @param {object} date - Display date { year, month, dayOfMonth }
 * @param {object|null} weather - Weather-shaped object { label, temperature, wind, precipitation }
 * @returns {string} List item HTML
 */
function dayRow(calendar, date, weather) {
  const weekdayName = (calendar.weekdaysArray ?? [])[dayOfWeek(date, calendar)]?.name;
  const label = weekdayName ? `${formatDay(calendar, date)} (${_loc(weekdayName)})` : formatDay(calendar, date);
  const sentence = buildWeatherSentence(weather);
  const notes = `[[cal.notes ${date.dayOfMonth + 1} ${date.month + 1} ${date.year} links=true]]`;
  return row(label, sentence ? `${foundry.utils.escapeHTML(sentence)} ${notes}` : notes);
}

/**
 * Build the journal page content for one week.
 * @param {object} calendar - Calendar instance
 * @param {object} weekStart - Display date of the week's first day
 * @returns {string} Page HTML
 */
export function buildAlmanacContent(calendar, weekStart) {
  const daysPerWeek = calendar.weekdaysArray?.length || 7;
  const yearZero = calendar.years?.yearZero ?? 0;
  const moons = calendar.moonsArray ?? [];
  const reviewStart = addDays(weekStart, -daysPerWeek);
  const reviewRows = [];
  for (let i = 0; i < daysPerWeek; i++) {
    const date = addDays(reviewStart, i);
    reviewRows.push(dayRow(calendar, date, WeatherManager.getWeatherForDate(date.year - yearZero, date.month, date.dayOfMonth)));
  }
  const forecastByDay = new Map();
  for (const entry of WeatherManager.getForecast({ days: daysPerWeek, playerView: true }) ?? []) {
    forecastByDay.set(`${entry.year}.${entry.month}.${entry.dayOfMonth}`, { label: entry.preset?.label, temperature: entry.temperature, wind: entry.wind, precipitation: entry.precipitation });
  }
  const aheadRows = [];
  const moonRows = [];
  for (let i = 0; i < daysPerWeek; i++) {
    const date = addDays(weekStart, i);
    const internal = { year: date.year - yearZero, month: date.month, dayOfMonth: date.dayOfMonth };
    for (let m = 0; m < moons.length; m++) {
      if (moons[m].visibility === MOON_VISIBILITY.HIDDEN) continue;
      const phase = calendar.getMoonPhase?.(m, internal);
      if (!phase?.name || phase.dayWithinPhase !== Math.floor(phase.phaseDuration / 2)) continue;
      moonRows.push(row(formatDay(calendar, date), foundry.utils.escapeHTML(`${moons[m].name}: ${_loc(phase.name)}`)));
    }
    aheadRows.push(dayRow(calendar, date, forecastByDay.get(`${internal.year}.${internal.month}.${internal.dayOfMonth}`)));
  }
  const weekEnd = addDays(weekStart, daysPerWeek - 1);
  const range = `${weekStart.dayOfMonth + 1} ${weekStart.month + 1} ${weekStart.year} to ${weekEnd.dayOfMonth + 1} ${weekEnd.month + 1} ${weekEnd.year}`;
  const parts = [`<h2>${_loc('CALENDARIA.Almanac.Section.Review')}</h2>`, `<ul>${reviewRows.join('')}</ul>`];
  if (moonRows.length) {
    parts.push(`<h2>${_loc('CALENDARIA.Almanac.Section.Moons')}</h2>`);
    parts.push(`<ul>${moonRows.join('')}</ul>`);
  }
  parts.push(`<h2>${_loc('CALENDARIA.Almanac.Section.Ahead')}</h2>`);
  parts.push(`<ul>${aheadRows.join('')}</ul>`);
  parts.push(`<p>[[cal.chronicle ${range}]]{${_loc('CALENDARIA.Almanac.ChronicleLink')}}</p>`);
  return parts.join('');
}

/**
 * Find the almanac journal, creating it with player observer permission on first publish.
 * @returns {Promise<JournalEntry>} The almanac journal
 */
async function getAlmanacJournal() {
  const existing = game.journal.find((j) => j.getFlag(MODULE.ID, ALMANAC_JOURNAL_FLAG));
  if (existing) return existing;
  return JournalEntry.create({
    name: _loc('CALENDARIA.Almanac.JournalTitle'),
    ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
    flags: { [MODULE.ID]: { [ALMANAC_JOURNAL_FLAG]: true } }
  });
}

/**
 * Publish an almanac page for the current week on DAY_CHANGE. Only runs for the primary GM.
 * @param {object} hookData - DAY_CHANGE hook data with { current, previous, calendar }
 */
export async function publishWeeklyAlmanac(hookData) {
  if (!ATLAS.isPrimaryGM) return;
  if (!game.settings.get(MODULE.ID, SETTINGS.WEEKLY_ALMANAC)) return;
  const calendar = hookData?.calendar ?? CalendarManager.getActiveCalendar();
  const current = hookData?.current;
  if (!calendar || !current) return;
  const weekStart = weekStartFor({ year: current.year, month: current.month, dayOfMonth: current.dayOfMonth }, calendar);
  const weekKey = `${weekStart.year}.${weekStart.month}.${weekStart.dayOfMonth}`;
  if (game.settings.get(MODULE.ID, SETTINGS.ALMANAC_LAST_WEEK) === weekKey) return;
  await game.settings.set(MODULE.ID, SETTINGS.ALMANAC_LAST_WEEK, weekKey);
  const journal = await getAlmanacJournal();
  const name = _loc('CALENDARIA.Almanac.PageTitle', { date: formatDay(calendar, weekStart) });
  await journal.createEmbeddedDocuments('JournalEntryPage', [{ name, type: 'text', text: { content: buildAlmanacContent(calendar, weekStart) } }]);
  ATLAS.log(3, `Almanac page published for week ${weekKey}`);
}
