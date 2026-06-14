/**
 * Calendaria ProseMirror inserts, grouped by category.
 * @type {Array<{id: string, types: Array<string|string[]>}>}
 */
const INSERT_GROUPS = [
  { id: 'datetime', types: ['date', 'time', 'weekday', 'season', 'era', 'cycle', 'festival', 'restday'] },
  {
    id: 'timemath',
    types: [
      ['countdown', '1 1 2030'],
      ['countup', '1 1 2020'],
      ['between', '1 1 2020 to 1 6 2025'],
      ['timeuntil', 'sunset'],
      ['datemath', '+30d']
    ]
  },
  { id: 'calendar', types: ['calname', 'month', 'year', 'dayofyear', 'yearprogress', 'leapyear', 'intercalary', 'daysinyear'] },
  { id: 'sun', types: ['sunrise', 'sunset', 'daylight', 'isdaytime', 'dayprogress', 'nightprogress', 'untilsunrise', 'untilsunset'] },
  { id: 'moon', types: ['moon', 'moons', 'nextfullmoon', 'convergence', 'eclipse', 'nexteclipse'] },
  { id: 'weather', types: ['weather', 'temperature', 'wind', 'precipitation', 'weathericon', 'zone', 'forecast'] },
  { id: 'notes', types: [['event', 'Winter Solstice'], 'notes', 'next', ['category', 'quest'], ['chronicle', '1 1 1500 to 14 1 1500']] },
  { id: 'composite', types: ['summary', 'almanac', ['format', 'MMMM YYYY'], ['compare', '1 1 2025'], ['peek', '+7d']] },
  {
    id: 'actions',
    types: [
      ['advancetotime', '[HH:MM]'],
      ['advanceinterval', 'hour=[HOURS]'],
      ['advancetopreset', '[PRESET]'],
      ['settime', '[HH:MM]'],
      ['jumptodate', '[DAY] [MONTH] [YEAR]'],
      'toggleclock',
      ['setweather', '[PRESET]']
    ]
  }
];

/**
 * Recursively sort insert entries and their submenus alphabetically by localized title.
 * @param {object[]} entries - Insert entries to sort in place.
 */
function sortInserts(entries) {
  entries.sort((a, b) => _loc(a.title).localeCompare(_loc(b.title), game.i18n.lang));
  for (const entry of entries) if (entry.children) sortInserts(entry.children);
}

/** Register Calendaria's enrichers as a grouped ProseMirror editor insert menu. */
export function registerInserts() {
  if (!Array.isArray(CONFIG.TextEditor?.inserts)) return;
  const children = INSERT_GROUPS.map((group) => ({
    action: `cal-${group.id}`,
    title: `CALENDARIA.Editor.Inserts.Group.${group.id}`,
    children: group.types.map((entry) => {
      const [type, sample] = Array.isArray(entry) ? entry : [entry];
      return { action: `cal-${type}`, title: `CALENDARIA.Editor.Inserts.Label.${type}`, inline: true, html: `[[cal.${type}${sample ? ` ${sample}` : ''}]]` };
    })
  }));
  sortInserts(children);
  CONFIG.TextEditor.inserts.push({ action: 'calendaria', title: 'CALENDARIA.Editor.Inserts.Title', children });
}
