import { CalendarManager } from '../calendar/_module.mjs';
import { HOOKS } from '../constants.mjs';
import { dayOfWeek } from '../notes/_module.mjs';
import { getSeasonDayOfYearBounds } from '../utils/calendar-math.mjs';

/**
 * Abstract base class for calendar importers.
 */
export default class BaseImporter {
  /** @type {string} Unique importer identifier */
  static id = 'base';

  /** @type {string} Localization key for importer name */
  static label = 'CALENDARIA.Importer.Base';

  /** @type {string} FontAwesome icon class */
  static icon = 'fa-file-import';

  /** @type {string} Localization key for importer description */
  static description = 'CALENDARIA.Importer.BaseDescription';

  /** @type {string|null} Optional localization key for an instructions panel rendered above the upload zone. */
  static instructions = null;

  /** @type {string|null} Optional macro source displayed alongside instructions for the user to copy. */
  static exportMacro = null;

  /** @type {boolean} Whether this importer supports file upload */
  static supportsFileUpload = true;

  /** @type {boolean} Whether this importer can read from an installed module */
  static supportsLiveImport = false;

  /** @type {string} Module ID to detect for live import (if supported) */
  static moduleId = null;

  /** @type {string[]} Accepted file extensions */
  static fileExtensions = ['.json'];

  /** @type {object[]} Undated events to migrate to journal entries */
  _undatedEvents = [];

  /**
   * Check if the source module is installed and active.
   * @returns {boolean} True if module is available for live import
   */
  static detect() {
    if (!this.moduleId) return false;
    return game.modules.get(this.moduleId)?.active ?? false;
  }

  /**
   * Load calendar data from an installed module's settings.
   * @returns {Promise<object>} Raw calendar data from module
   * @throws {Error} If not implemented or module not available
   */
  async loadFromModule() {
    throw new Error(`${this.constructor.name}.loadFromModule() not implemented`);
  }

  /**
   * Parse an uploaded file into raw data.
   * @param {File} file - The uploaded file
   * @returns {Promise<object>} Parsed data object
   */
  async parseFile(file) {
    const text = await file.text();
    return JSON.parse(text);
  }

  /**
   * Transform raw source data into CalendariaCalendar format.
   * @param {object} data - Raw source data
   * @returns {Promise<object>} CalendariaCalendar-compatible data object
   * @throws {Error} If not implemented
   */
  async transform(data) {
    ATLAS.log(1, `${this.constructor.name}.transform() not implemented`, { data });
    return null;
  }

  /**
   * Extract notes/events from source data.
   * @param {object} data - Raw source data
   * @returns {Promise<object[]>} Array of note data objects
   */
  async extractNotes(data) {
    ATLAS.log(1, `${this.constructor.name}.extractNotes() not implemented`, { data });
    return null;
  }

  /**
   * Get available calendar choices from source data.
   * @param {object} _data - Raw source data
   * @returns {Array<{name: string, index: number}>|null} Calendar choices or null if single/unsupported
   */
  getCalendarChoices(_data) {
    return null;
  }

  /**
   * Extract the current date from source data.
   * @param {object} _data - Raw source data
   * @param {number} [_calendarIndex] - Index of calendar to extract date from
   * @returns {{year: number, month: number, dayOfMonth: number, hour: number, minute: number}|null} Current date or null
   */
  extractCurrentDate(_data, _calendarIndex = 0) {
    return null;
  }

  /**
   * Apply a date to the imported calendar by setting worldTime.
   * @param {{year: number, month: number, dayOfMonth: number, hour: number, minute: number}} dateComponents - Date to apply
   * @param {string} calendarId - Calendar ID to apply the date to
   * @returns {Promise<boolean>} True if date was applied successfully
   */
  async applyCurrentDate(dateComponents, calendarId) {
    if (!dateComponents) return false;
    try {
      const calendar = CalendarManager.getCalendar(calendarId);
      if (!calendar) {
        ATLAS.log(2, `Cannot apply date: calendar ${calendarId} not found`);
        return false;
      }
      const yearZero = calendar.years?.yearZero ?? 0;
      const displayYear = dateComponents.year + yearZero;
      ATLAS.log(3, `Applying imported date: ${displayYear}/${dateComponents.month + 1}/${(dateComponents.dayOfMonth ?? 0) + 1}`);
      await calendar.jumpToDate({ year: displayYear, month: dateComponents.month, dayOfMonth: dateComponents.dayOfMonth });
      return true;
    } catch (error) {
      ATLAS.log(2, `Failed to apply current date:`, error);
      return false;
    }
  }

  /**
   * Validate transformed data against CalendariaCalendar schema.
   * @param {object} data - Transformed calendar data
   * @returns {{valid: boolean, errors: string[]}} Validation result
   */
  validate(data) {
    const errors = [];
    if (!data.name) errors.push(_loc('CALENDARIA.Importer.Error.MissingName'));
    const months = data.months?.values ? Object.values(data.months.values) : [];
    if (!months.length) errors.push(_loc('CALENDARIA.Importer.Error.NoMonths'));
    if (!data.days) errors.push(_loc('CALENDARIA.Importer.Error.MissingTimeConfig'));
    if (data.days) {
      if (!data.days.hoursPerDay || data.days.hoursPerDay < 1) errors.push(_loc('CALENDARIA.Importer.Error.InvalidHoursPerDay'));
      if (!data.days.minutesPerHour || data.days.minutesPerHour < 1) errors.push(_loc('CALENDARIA.Importer.Error.InvalidMinutesPerHour'));
      if (!data.days.secondsPerMinute || data.days.secondsPerMinute < 1) errors.push(_loc('CALENDARIA.Importer.Error.InvalidSecondsPerMinute'));
    }
    for (let i = 0; i < months.length; i++) {
      const month = months[i];
      if (!month.name) errors.push(_loc('CALENDARIA.Importer.Error.MonthMissingName', { num: i + 1 }));
      if (!month.days || month.days < 1) errors.push(_loc('CALENDARIA.Importer.Error.MonthNoDays', { num: i + 1 }));
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Import a calendar into Calendaria.
   * @param {object} data - Transformed calendar data
   * @param {object} options - Import options
   * @param {string} options.id - Calendar ID (will be prefixed with 'custom-')
   * @param {string} [options.name] - Override calendar name
   * @returns {Promise<object>} imported calendar data
   */
  async importCalendar(data, options = {}) {
    const calendarId = options.id || this.#generateId(data.name);
    if (options.name) data.name = options.name;
    if (!data.metadata) data.metadata = {};
    data.metadata.importedFrom = this.constructor.id;
    data.metadata.importedAt = Date.now();
    Hooks.callAll(HOOKS.IMPORT_STARTED, { importerId: this.constructor.id, calendarId });
    try {
      const calendar = await CalendarManager.createCustomCalendar(calendarId, data);
      if (calendar) {
        const actualCalendarId = calendar.metadata?.id || `custom-${calendarId}`;
        ATLAS.log(3, `Successfully imported calendar: ${actualCalendarId}`);
        Hooks.callAll(HOOKS.IMPORT_COMPLETE, { importerId: this.constructor.id, calendarId: actualCalendarId, calendar });
        return { success: true, calendar, calendarId: actualCalendarId };
      } else {
        throw new Error('Calendar creation returned null');
      }
    } catch (error) {
      ATLAS.log(2, `Import failed for ${calendarId}:`, error);
      Hooks.callAll(HOOKS.IMPORT_FAILED, { importerId: this.constructor.id, calendarId, error: error.message });
      return { success: false, error: error.message };
    }
  }

  /**
   * Import notes from source data.
   * @param {object[]} notes - Extracted note data
   * @param {object} options - Import options
   * @param {string} options.calendarId - Target calendar ID
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>} - Import result
   */
  async importNotes(notes, options = {}) {
    ATLAS.log(1, `${this.constructor.name}.importNotes() not implemented`, { notes, options });
    return null;
  }

  /**
   * Import festivals (fixed calendar events) from source data.
   * @param {object[]} festivals - Extracted festival data
   * @param {object} options - Import options
   * @param {string} options.calendarId - Target calendar ID
   * @returns {Promise<{success: boolean, count: number, errors: string[]}>} - Import result
   */
  async importFestivals(festivals, options = {}) {
    ATLAS.log(1, `${this.constructor.name}.importFestivals() not implemented`, { festivals, options });
    return null;
  }

  /**
   * Migrate undated events to Foundry journal entries.
   * @param {string} calendarName - Name of the calendar for folder organization
   * @returns {Promise<{count: number}>} - Migration result with count
   */
  async migrateUndatedEvents(calendarName) {
    if (!this._undatedEvents?.length) return { count: 0 };
    const parts = ['Calendaria Imports', calendarName, 'Undated Events'];
    let parentId = null;
    for (const part of parts) {
      let existing = game.folders.find((f) => f.name === part && f.folder?.id === parentId && f.type === 'JournalEntry');
      if (!existing) existing = await Folder.create({ name: part, type: 'JournalEntry', folder: parentId });
      parentId = existing.id;
    }
    const journalData = this._undatedEvents.map((event) => ({ name: event.name, folder: parentId, pages: [{ name: event.name, type: 'text', text: { content: event.content || '' } }] }));
    await JournalEntry.createDocuments(journalData);
    const count = this._undatedEvents.length;
    ui.notifications.info(_loc('CALENDARIA.Importer.UndatedEventsMigrated', { count }));
    ATLAS.log(3, `Migrated ${count} undated events to journal entries`);
    return { count };
  }

  /**
   * Generate preview data for the import UI.
   * @param {object} rawData - Raw source data
   * @param {object} transformedData - Transformed calendar data
   * @returns {object} Preview summary
   */
  getPreviewData(rawData, transformedData) {
    const notes = this.#countNotes(rawData);
    return {
      name: transformedData.name || 'Unknown',
      monthCount: transformedData.months?.values ? Object.values(transformedData.months.values).length : 0,
      weekdayCount: transformedData.days?.values ? Object.values(transformedData.days.values).length : 0,
      moonCount: transformedData.moons ? Object.values(transformedData.moons).length : 0,
      seasonCount: transformedData.seasons?.values ? Object.values(transformedData.seasons.values).length : 0,
      eraCount: transformedData.eras ? Object.values(transformedData.eras).length : 0,
      festivalCount: transformedData.festivals ? Object.values(transformedData.festivals).length : 0,
      noteCount: notes,
      undatedCount: this._undatedEvents?.length ?? 0,
      hasLeapYear: !!transformedData.years?.leapYear?.rule,
      daysPerYear: this.#calculateDaysPerYear(transformedData)
    };
  }

  /**
   * Generate a URL-safe ID from a name.
   * @param {string} name - Calendar name
   * @returns {string} Generated ID
   * @private
   */
  #generateId(name) {
    if (!name) return `imported-${Date.now()}`;
    return name
      .toLowerCase()
      .replace(/[^\da-z]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 32);
  }

  /**
   * Count notes in raw data.
   * @param {object} _data - Raw source data
   * @returns {number} Note count
   * @private
   */
  #countNotes(_data) {
    return 0;
  }

  /**
   * Calculate total days per year from calendar data.
   * @param {object} data - Transformed calendar data
   * @returns {number} Days per year
   * @private
   */
  #calculateDaysPerYear(data) {
    const months = data.months?.values ? Object.values(data.months.values) : [];
    return months.reduce((sum, month) => sum + (month.days || 0), 0);
  }

  /**
   * Rewrite an importer-built note so foreign recurrence descriptors become a condition tree.
   * @param {object} noteData - Note data as assembled by an importer
   * @returns {object} Note data carrying conditionTree and a live repeat value
   */
  _convertForeignRecurrence(noteData) {
    return convertForeignRecurrence(noteData);
  }
}

/** Converter dispatch table for foreign recurrence descriptors. */
const CONDITION_TREE_CONVERTERS = {
  daily: convertDaily,
  weekly: convertWeekly,
  monthly: convertMonthly,
  yearly: convertYearly,
  seasonal: convertSeasonal,
  weekOfMonth: convertWeekOfMonth,
  range: convertRange,
  moon: convertMoon,
  random: convertRandom,
  linked: convertLinked
};

/**
 * Build an AND group, flattening single-child groups.
 * @param {object[]} children - Condition/group entries
 * @returns {object|null} Condition tree root or null if empty
 */
function buildAndGroup(children) {
  if (!children.length) return null;
  if (children.length === 1) return children[0];
  return { type: 'group', mode: 'and', children };
}

/**
 * Create a condition entry.
 * @param {string} field - Condition field name
 * @param {string} op - Operator
 * @param {*} value - Comparison value
 * @param {object} [extras] - Additional fields (value2, offset)
 * @returns {object} Condition entry
 */
function ct(field, op, value, extras = {}) {
  return { type: 'condition', field, op, value, ...extras };
}

/**
 * Convert daily repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object} Condition tree root
 */
function convertDaily(noteData) {
  const interval = noteData.repeatInterval || 1;
  if (interval === 1) return { type: 'group', mode: 'and', children: [] };
  return ct('date', '%', interval);
}

/**
 * Convert weekly repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object} Condition tree root
 */
function convertWeekly(noteData) {
  const interval = noteData.repeatInterval || 1;
  const children = [ct('weekday', '==', dayOfWeek(noteData.startDate) + 1)];
  if (interval > 1) children.push(ct('totalWeek', '%', interval));
  return buildAndGroup(children);
}

/**
 * Convert monthly repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object} Condition tree root
 */
function convertMonthly(noteData) {
  const interval = noteData.repeatInterval || 1;
  const children = [ct('day', '==', noteData.startDate.dayOfMonth + 1)];
  if (interval > 1) children.push(ct('month', '%', interval));
  return buildAndGroup(children);
}

/**
 * Convert yearly repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object} Condition tree root
 */
function convertYearly(noteData) {
  const interval = noteData.repeatInterval || 1;
  const children = [ct('month', '==', noteData.startDate.month + 1), ct('day', '==', noteData.startDate.dayOfMonth + 1)];
  if (interval > 1) children.push(ct('year', '%', interval));
  return buildAndGroup(children);
}

/**
 * Convert seasonal repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object|null} Condition tree root or null
 */
function convertSeasonal(noteData) {
  const config = noteData.seasonalConfig;
  if (!config) return null;
  const children = [ct('season', '==', (config.seasonIndex ?? 0) + 1)];
  if (config.trigger === 'firstDay' || config.trigger === 'lastDay') {
    const calendar = CalendarManager.getActiveCalendar();
    const season = calendar?.seasonsArray?.[config.seasonIndex];
    const bounds = getSeasonDayOfYearBounds(season, calendar);
    if (bounds) {
      const months = calendar?.monthsArray ?? [];
      let remaining = config.trigger === 'firstDay' ? bounds.startDoY : bounds.endDoY;
      let month = 0;
      for (; month < months.length; month++) {
        const days = months[month]?.days ?? 30;
        if (remaining < days) break;
        remaining -= days;
      }
      children.push(ct('month', '==', month + 1));
      children.push(ct('day', '==', remaining + 1));
    }
  }
  return buildAndGroup(children);
}

/**
 * Convert weekOfMonth repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object} Condition tree root
 */
function convertWeekOfMonth(noteData) {
  const interval = noteData.repeatInterval || 1;
  const daysInWeek = CalendarManager.getActiveCalendar()?.daysInWeek ?? 7;
  const children = [ct('weekday', '==', (noteData.weekday ?? dayOfWeek(noteData.startDate)) + 1)];
  const weekNumber = noteData.weekNumber ?? Math.ceil((noteData.startDate.dayOfMonth + 1) / daysInWeek);
  if (weekNumber > 0) children.push(ct('weekNumberInMonth', '==', weekNumber));
  else children.push(ct('inverseWeekNumber', '==', Math.abs(weekNumber)));
  if (interval > 1) children.push(ct('month', '%', interval));
  return buildAndGroup(children);
}

/**
 * Convert range pattern repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object|null} Condition tree root or null
 */
function convertRange(noteData) {
  const pattern = noteData.rangePattern;
  if (!pattern) return null;
  const children = [];
  addRangeBit(children, 'year', pattern.year);
  addRangeBit(children, 'month', offsetRangeBit(pattern.month, 1));
  addRangeBit(children, 'day', pattern.dayOfMonth);
  if (!children.length) return { type: 'group', mode: 'and', children: [] };
  return buildAndGroup(children);
}

/**
 * Offset a range bit value (number or [min, max]) by a fixed amount.
 * @param {*} rangeBit - Range specification (number, [min, max], or null)
 * @param {number} offset - Amount to add
 * @returns {*} Offset range bit
 */
function offsetRangeBit(rangeBit, offset) {
  if (rangeBit == null) return null;
  if (typeof rangeBit === 'number') return rangeBit + offset;
  if (Array.isArray(rangeBit) && rangeBit.length === 2) return [rangeBit[0] !== null ? rangeBit[0] + offset : null, rangeBit[1] !== null ? rangeBit[1] + offset : null];
  return rangeBit;
}

/**
 * Add conditions for a range bit specification.
 * @param {object[]} children - Array to push conditions onto
 * @param {string} field - Condition field name
 * @param {*} rangeBit - Range specification (number, [min, max], or null)
 */
function addRangeBit(children, field, rangeBit) {
  if (rangeBit == null) return;
  if (typeof rangeBit === 'number') {
    children.push(ct(field, '==', rangeBit));
    return;
  }
  if (Array.isArray(rangeBit) && rangeBit.length === 2) {
    if (rangeBit[0] !== null) children.push(ct(field, '>=', rangeBit[0]));
    if (rangeBit[1] !== null) children.push(ct(field, '<=', rangeBit[1]));
  }
}

/**
 * Convert moon repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object|null} Condition tree root or null
 */
function convertMoon(noteData) {
  const moonConditions = noteData.moonConditions;
  if (!moonConditions?.length) return null;
  const calendar = CalendarManager.getActiveCalendar();
  const orChildren = [];
  for (const cond of moonConditions) {
    const moon = calendar?.moonsArray?.[cond.moonIndex];
    if (!moon) continue;
    const phases = Object.values(moon.phases ?? {});
    const phaseIdx = phases.findIndex((p) => Math.abs(p.start - cond.phaseStart) < 0.01 && Math.abs(p.end - cond.phaseEnd) < 0.01);
    if (phaseIdx === -1) continue;
    const phaseCondition = ct('moonPhaseIndex', '==', phaseIdx, { value2: cond.moonIndex });
    const modifier = cond.modifier || 'any';
    if (modifier === 'any') {
      orChildren.push(phaseCondition);
    } else {
      const modValue = modifier === 'rising' ? 1 : modifier === 'true' ? 2 : 3;
      orChildren.push(buildAndGroup([phaseCondition, ct('moonSubPhase', '==', modValue, { value2: cond.moonIndex })]));
    }
  }
  if (!orChildren.length) return null;
  if (orChildren.length === 1) return orChildren[0];
  return { type: 'group', mode: 'or', children: orChildren };
}

/**
 * Convert random repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object|null} Condition tree root or null
 */
function convertRandom(noteData) {
  const config = noteData.randomConfig;
  if (!config) return null;
  const { seed, probability, checkInterval } = config;
  if (probability <= 0) return null;
  if (probability >= 100) return { type: 'group', mode: 'and', children: [] };
  const children = [ct('random', '<=', probability, { value2: seed })];
  if (checkInterval === 'weekly') children.push(ct('weekday', '==', dayOfWeek(noteData.startDate) + 1));
  else if (checkInterval === 'monthly') children.push(ct('day', '==', noteData.startDate.dayOfMonth + 1));
  return buildAndGroup(children);
}

/**
 * Convert linked repeat to condition tree.
 * @param {object} noteData - Note flag data
 * @returns {object|null} Condition tree root or null
 */
function convertLinked(noteData) {
  const { linkedEvent } = noteData;
  if (!linkedEvent?.noteId) return null;
  const { noteId, offset } = linkedEvent;
  if (offset >= 0) return ct('event', 'daysAgo', offset, { value2: { noteId } });
  return ct('event', 'daysFromNow', Math.abs(offset), { value2: { noteId } });
}

/**
 * Normalize conditions array entries to include type discriminator.
 * @param {object[]} conditions - Existing conditions from the note
 * @returns {object[]} Normalized conditions
 */
function normalizeConditions(conditions) {
  if (!conditions?.length) return [];
  return conditions.map((entry) => {
    if (entry.type === 'condition' || entry.type === 'group') return entry;
    if (entry.mode && entry.children) return { type: 'group', ...entry };
    return { type: 'condition', ...entry };
  });
}

/**
 * Convert a foreign recurrence descriptor to a condition tree.
 * @param {object} noteData - Note data with a legacy repeat value
 * @returns {object|null} Condition tree root, or null if not convertible
 */
function convertToConditionTree(noteData) {
  if (noteData.conditionTree) return noteData.conditionTree;
  const { repeat, conditions } = noteData;
  if (repeat === 'never' || !repeat) {
    const normalized = normalizeConditions(conditions);
    return normalized.length ? buildAndGroup(normalized) : null;
  }
  const converter = CONDITION_TREE_CONVERTERS[repeat];
  if (!converter) return null;
  const recurrenceTree = converter(noteData);
  if (!recurrenceTree) return null;
  const normalized = normalizeConditions(conditions);
  if (!normalized.length) return recurrenceTree;
  const allChildren = recurrenceTree.type === 'group' && recurrenceTree.mode === 'and' ? [...recurrenceTree.children, ...normalized] : [recurrenceTree, ...normalized];
  return buildAndGroup(allChildren);
}

/**
 * Rewrite an importer-built note so foreign recurrence descriptors become a condition tree.
 * @param {object} noteData - Note data as assembled by an importer
 * @returns {object} Note data carrying conditionTree and a live repeat value
 */
function convertForeignRecurrence(noteData) {
  const repeat = noteData?.repeat;
  if (!noteData || noteData.conditionTree || repeat === 'computed') return noteData;
  if ((repeat === 'never' || !repeat) && !noteData.conditions?.length) return noteData;
  const tree = convertToConditionTree(noteData);
  if (!tree) return { ...noteData, repeat: 'never' };
  const result = { ...noteData, conditionTree: tree, repeat: 'never' };
  delete result.conditions;
  return result;
}
