import { getAllPresets, NoteManager } from '../notes/_module.mjs';

/**
 * Offer Calendaria note categories as selectable Item Piles merchant holidays.
 * @param {object[]} holidays - Holiday definitions ({ id, label }) the hook collects
 * @returns {void}
 */
export function onItemPilesGetHolidays(holidays) {
  for (const preset of getAllPresets()) {
    holidays.push({ id: preset.id, label: preset.label });
  }
}

/**
 * Report note categories that occur within an Item Piles time range. The query's
 * startDate/endDate are Foundry TimeComponents, whose 0-based month and dayOfMonth
 * match Calendaria's internal note dates directly.
 * @param {object} query - Item Piles query with { startDate, endDate } time components
 * @param {Set<string>} active - Active holiday ids the hook collects
 * @returns {void}
 */
export function onItemPilesGetActiveHolidays(query, active) {
  const start = { year: query.startDate.year, month: query.startDate.month, dayOfMonth: query.startDate.dayOfMonth };
  const end = { year: query.endDate.year, month: query.endDate.month, dayOfMonth: query.endDate.dayOfMonth };
  for (const note of NoteManager.getNotesInRange(start, end)) {
    for (const category of note.flagData.categories ?? []) active.add(category);
  }
}
