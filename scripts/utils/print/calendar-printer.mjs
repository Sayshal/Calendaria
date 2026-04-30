import { CalendarManager } from '../../calendar/_module.mjs';
import { topologicalSortNotes } from '../../notes/event-dependency-resolver.mjs';
import { isFogEnabled, isRevealed } from '../fog-of-war.mjs';
import { localize } from '../localization.mjs';
import { getCalendarNotes, getFestivalNoteForDay, getVisibleNotes } from '../ui/calendar-view-utils.mjs';

const PRINT_CSS = `
  @page { size: letter; margin: 0.4in; }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: #fff; color: #000; font-family: 'Helvetica', 'Arial', sans-serif; }
  body { padding: 0; height: 10.2in; display: flex; flex-direction: column; }
  h1.cal-title { margin: 0 0 0.15in; font-size: 24pt; text-align: center; letter-spacing: 0.05em; flex: 0 0 auto; }
  table.cal-grid { width: 100%; border-collapse: collapse; table-layout: fixed; flex: 1 1 auto; }
  table.cal-grid.intercalary { width: auto; margin: 0 auto; max-width: 100%; }
  table.cal-grid.intercalary tbody td { width: 1.5in; height: 1.5in; }
  table.cal-grid thead th { padding: 0.05in; border: 1px solid #444; background: #ddd; font-size: 10pt; text-transform: uppercase; letter-spacing: 0.05em; }
  table.cal-grid tbody { height: 100%; }
  table.cal-grid tbody td { border: 1px solid #888; vertical-align: top; padding: 0.05in; font-size: 11pt; position: relative; overflow: hidden; }
  table.cal-grid tbody td.empty { background: #f4f4f4; }
  table.cal-grid tbody td.fogged { background: #ddd; color: transparent; }
  table.cal-grid tbody td.festival { background: #fff5d8; }
  table.cal-grid tbody td .day-num { display: block; font-weight: bold; font-size: 12pt; }
  table.cal-grid tbody td .festival-block { display: flex; align-items: center; gap: 0.04in; margin-top: 0.04in; padding: 0.02in 0.04in; border-radius: 0.04in; background: #f3e6b8; max-width: 100%; }
  table.cal-grid tbody td .festival-block .festival-icon { width: 0.14in; height: 0.14in; flex: 0 0 auto; }
  table.cal-grid tbody td .festival-block .festival-icon-img { width: 0.14in; height: 0.14in; object-fit: contain; flex: 0 0 auto; }
  table.cal-grid tbody td .festival-block .festival-name { font-size: 7pt; line-height: 1.15; color: #5a4500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  table.cal-grid tbody td .moons { position: absolute; bottom: 0.04in; right: 0.04in; display: flex; gap: 0.02in; max-width: calc(100% - 0.08in); align-items: center; }
  table.cal-grid tbody td .moons .moon { display: block; flex: 1 1 0; min-width: 0; width: 100%; max-width: 0.18in; aspect-ratio: 1; object-fit: contain; }
  /* Year layout: 1 month per page */
  body.year { height: auto; display: block; }
  body.year .year-month { page-break-after: always; break-after: page; height: 10.2in; display: flex; flex-direction: column; }
  body.year .year-month:last-of-type { page-break-after: auto; break-after: auto; }
  body.year .year-month h2 { margin: 0 0 0.15in; font-size: 22pt; text-align: center; flex: 0 0 auto; }
`;

/**
 * Build a printable per-day descriptor for a single month.
 * @param {object} calendar - Active calendar instance
 * @param {number} year - Display year (with yearZero offset applied)
 * @param {number} month - Month index in monthsArray
 * @param {object[]} notes - Pre-sorted, visible calendar notes used for festival lookup
 * @returns {{ name:string, weekdays:string[], rows:Array<Array<object|null>>, intercalary:boolean }|null} Grid data, or null if month has no days
 */
function buildMonthGrid(calendar, year, month, notes) {
  const yearZero = calendar.years?.yearZero ?? 0;
  const internalYear = year - yearZero;
  const monthData = calendar.monthsArray[month];
  if (!monthData) return null;
  const daysInMonth = calendar.getDaysInMonth(month, internalYear);
  if (daysInMonth === 0) return null;
  const isIntercalary = monthData.type === 'intercalary';
  const daysInWeek = calendar.daysInWeek;
  const weekdays = calendar.weekdaysArray.map((w) => {
    const name = localize(w.name || '');
    return w.abbreviation ? localize(w.abbreviation) : name.slice(0, 3);
  });
  const fogActive = isFogEnabled() && !game.user.isGM;
  const moons = calendar.moonsArray || [];
  const resolveAbsoluteIcon = (icon) => {
    if (!icon || icon.startsWith('fa') || icon.startsWith('http://') || icon.startsWith('https://') || icon.startsWith('data:')) return icon;
    if (icon.startsWith('/')) return `${location.origin}${icon}`;
    return `${location.origin}/${icon}`;
  };
  const buildCell = (d) => {
    const fogged = fogActive && !isRevealed(year, month, d);
    const fn = !fogged ? getFestivalNoteForDay(notes, year, month, d) : null;
    let festival = null;
    if (fn?.showVisuals) {
      const iconRaw = fn.icon || '';
      const iconResolved = fn.iconType === 'image' ? resolveAbsoluteIcon(iconRaw) : iconRaw;
      festival = { name: fn.name || '', icon: iconResolved, iconType: fn.iconType, color: fn.color || null };
    }
    let moonIcons = [];
    if (!fogged && moons.length) {
      const dayComponents = { year: internalYear, month, dayOfMonth: d, hour: 12, minute: 0, second: 0 };
      const dayWorldTime = calendar.componentsToTime(dayComponents);
      moonIcons = moons
        .map((moon, idx) => {
          const phase = calendar.getMoonPhase(idx, dayWorldTime);
          if (!phase?.icon) return null;
          return { icon: resolveAbsoluteIcon(phase.icon), color: moon.color || null };
        })
        .filter(Boolean);
    }
    return { day: d + 1, fogged, festival, moons: moonIcons };
  };
  if (isIntercalary) {
    const cells = [];
    for (let d = 0; d < daysInMonth; d++) cells.push(buildCell(d));
    return { name: localize(monthData.name), weekdays: [], rows: [cells], intercalary: true };
  }
  const startWeekday = calendar._computeDayOfWeek({ year: internalYear, month, dayOfMonth: 0 });
  const cells = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 0; d < daysInMonth; d++) cells.push(buildCell(d));
  while (cells.length % daysInWeek !== 0) cells.push(null);
  const rows = [];
  for (let i = 0; i < cells.length; i += daysInWeek) rows.push(cells.slice(i, i + daysInWeek));
  return { name: localize(monthData.name), weekdays, rows, intercalary: false };
}

/**
 * Escape HTML special characters.
 * @param {*} s - Value to escape
 * @returns {string} Escaped string safe for HTML interpolation
 */
function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/**
 * Track unique moon-tint colors per render so each gets a single SVG filter definition.
 * @type {Map<string, string>}
 */
const moonFilters = new Map();

/** Reset the moon-tint filter registry between renders. */
function resetMoonFilters() {
  moonFilters.clear();
}

/**
 * Register a moon-tint color and return its filter id.
 * @param {string} color - CSS color value
 * @returns {string} Filter id usable as filter: url(#id)
 */
function registerMoonFilter(color) {
  if (!moonFilters.has(color)) moonFilters.set(color, `cal-moon-tint-${moonFilters.size}`);
  return moonFilters.get(color);
}

/**
 * Parse a CSS color into normalized [r, g, b] floats in 0..1. Falls back to white on failure.
 * @param {string} color - CSS color value
 * @returns {number[]} Normalized RGB triplet [r, g, b]
 */
function parseColorRgb(color) {
  if (!color) return [1, 1, 1];
  const probe = document.createElement('div');
  probe.style.color = color;
  document.body.appendChild(probe);
  const computed = getComputedStyle(probe).color;
  probe.remove();
  const match = /rgba?\((\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(computed);
  if (!match) return [1, 1, 1];
  return [Number(match[1]) / 255, Number(match[2]) / 255, Number(match[3]) / 255];
}

/**
 * Build the SVG <defs> block with one filter per registered moon color.
 * @returns {string} SVG markup, or empty string if no filters needed
 */
function renderMoonFilterDefs() {
  if (!moonFilters.size) return '';
  const filters = [];
  for (const [color, id] of moonFilters) {
    const [r, g, b] = parseColorRgb(color);
    const matrix = `${r} 0 0 0 0  0 ${g} 0 0 0  0 0 ${b} 0 0  0 0 0 1 0`;
    filters.push(`<filter id="${esc(id)}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${matrix}"/></filter>`);
  }
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${filters.join('')}</defs></svg>`;
}

/**
 * Render a single month grid (or intercalary row) as table HTML.
 * @param {object} grid - Month grid produced by buildMonthGrid
 * @returns {string} HTML string
 */
function renderMonthTable(grid) {
  const renderCell = (cell) => {
    if (cell == null) return `<td class="empty"></td>`;
    const cls = ['day'];
    if (cell.fogged) cls.push('fogged');
    if (cell.festival) cls.push('festival');
    const num = `<span class="day-num">${cell.day}</span>`;
    const moons =
      cell.moons && cell.moons.length
        ? `<span class="moons">${cell.moons
            .map((m) => {
              if (!m.color) return `<img class="moon" src="${esc(m.icon)}" alt="">`;
              const filterId = registerMoonFilter(m.color);
              return `<img class="moon tinted" src="${esc(m.icon)}" alt="" style="filter: url(#${filterId});">`;
            })
            .join('')}</span>`
        : '';
    let festBlock = '';
    if (cell.festival && !cell.fogged) {
      const f = cell.festival;
      const tint = f.color || '#8a5a00';
      const icon =
        f.iconType === 'image' && f.icon
          ? `<img class="festival-icon-img" src="${esc(f.icon)}" alt="">`
          : `<svg class="festival-icon" viewBox="0 0 24 24" aria-hidden="true"><path fill="${esc(tint)}" d="M12 2l2.95 6.36 6.99.84-5.14 4.78 1.4 6.92L12 17.5l-6.2 3.4 1.4-6.92L2.06 9.2l6.99-.84z"/></svg>`;
      festBlock = `<div class="festival-block">${icon}<span class="festival-name">${esc(f.name || '')}</span></div>`;
    }
    return `<td class="${cls.join(' ')}">${num}${festBlock}${moons}</td>`;
  };
  if (grid.intercalary) {
    const cells = grid.rows[0].map(renderCell).join('');
    return `<table class="cal-grid intercalary"><tbody><tr>${cells}</tr></tbody></table>`;
  }
  const head = `<thead><tr>${grid.weekdays.map((w) => `<th>${esc(w)}</th>`).join('')}</tr></thead>`;
  const rowPct = (100 / grid.rows.length).toFixed(4);
  const body = grid.rows.map((row) => `<tr style="height: ${rowPct}%">${row.map(renderCell).join('')}</tr>`).join('');
  return `<table class="cal-grid">${head}<tbody>${body}</tbody></table>`;
}

/**
 * Clone parent-doc stylesheet links so the print iframe inherits FontAwesome and other fonts.
 * @returns {string} HTML for cloned link tags
 */
function collectParentStylesheets() {
  const parts = [];
  for (const link of document.querySelectorAll('link[rel="stylesheet"]')) if (link.href) parts.push(`<link rel="stylesheet" href="${esc(link.href)}">`);
  return parts.join('');
}

/**
 * Build the full HTML document for the print iframe.
 * @param {object} opts - Document options
 * @param {string} opts.title - Document title
 * @param {string} opts.bodyClass - Class applied to body (controls per-view layout)
 * @param {string} opts.content - Inner HTML for the body
 * @returns {string} Full HTML document string
 */
function buildDocument({ title, bodyClass, content }) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>${esc(title)}</title>
    ${collectParentStylesheets()}
    <style>${PRINT_CSS}</style>
  </head>
  <body class="${bodyClass}">${content}</body>
</html>`;
}

/**
 * Mount a hidden iframe with the given document, wait for images and fonts to load, then trigger print.
 * @param {string} htmlDoc - Full HTML document string
 */
function printDocument(htmlDoc) {
  const existing = document.getElementById('calendaria-print-frame');
  if (existing) existing.remove();
  const iframe = document.createElement('iframe');
  iframe.id = 'calendaria-print-frame';
  iframe.setAttribute('aria-hidden', 'true');
  Object.assign(iframe.style, { position: 'fixed', left: '0', top: '0', width: '1px', height: '1px', border: '0', opacity: '0', pointerEvents: 'none' });
  iframe.srcdoc = htmlDoc;
  iframe.addEventListener(
    'load',
    async () => {
      try {
        const imgs = Array.from(iframe.contentDocument.querySelectorAll('img'));
        await Promise.all(
          imgs.map(
            (img) =>
              new Promise((resolve) => {
                if (img.complete && img.naturalWidth > 0) resolve();
                else {
                  img.addEventListener('load', () => resolve(), { once: true });
                  img.addEventListener('error', () => resolve(), { once: true });
                }
              })
          )
        );
        if (iframe.contentDocument.fonts?.ready) await iframe.contentDocument.fonts.ready;
        iframe.contentWindow.focus();
        iframe.contentWindow.print();
      } catch {
        ui.notifications.error('CALENDARIA.Print.Failed', { localize: true });
      }
      setTimeout(() => iframe.remove(), 2500);
    },
    { once: true }
  );
  document.body.appendChild(iframe);
}

/**
 * Get sorted, visible calendar notes for festival lookup.
 * @returns {object[]} Notes ready to pass to getFestivalNoteForDay
 */
function getNotes() {
  return topologicalSortNotes(getVisibleNotes(getCalendarNotes()));
}

/** Print a single full-page month grid for the active calendar's current month. */
export function printCurrentMonth() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return;
  const { year, month } = game.time.components;
  const yearZero = calendar.years?.yearZero ?? 0;
  const displayYear = year + yearZero;
  const grid = buildMonthGrid(calendar, displayYear, month, getNotes());
  if (!grid) return;
  resetMoonFilters();
  const title = `${grid.name} ${displayYear}`;
  const table = renderMonthTable(grid);
  const content = `${renderMoonFilterDefs()}<h1 class="cal-title">${esc(title)}</h1>${table}`;
  printDocument(buildDocument({ title, bodyClass: 'month', content }));
}

/** Print the full active year, one month per page. */
export function printCurrentYear() {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return;
  const { year } = game.time.components;
  const yearZero = calendar.years?.yearZero ?? 0;
  const displayYear = year + yearZero;
  const notes = getNotes();
  resetMoonFilters();
  const months = calendar.monthsArray.map((_, idx) => buildMonthGrid(calendar, displayYear, idx, notes)).filter(Boolean);
  const monthsHtml = months.map((g) => `<section class="year-month"><h2>${esc(`${g.name} ${displayYear}`)}</h2>${renderMonthTable(g)}</section>`).join('');
  const title = String(displayYear);
  const content = `${renderMoonFilterDefs()}${monthsHtml}`;
  printDocument(buildDocument({ title, bodyClass: 'year', content }));
}
