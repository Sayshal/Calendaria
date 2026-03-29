/**
 * Field schema registry for the condition builder UI.
 * @module Notes/ConditionFieldSchema
 * @author Tyler
 */

import { CONDITION_FIELDS, CONDITION_OPERATORS, MOON_PHASE_LABELS } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { WeatherManager } from '../weather/_module.mjs';
import { NoteManager } from './_module.mjs';

/** @type {string[]} All numeric operators including modulo */
const ALL_OPS = [
  CONDITION_OPERATORS.EQUAL,
  CONDITION_OPERATORS.NOT_EQUAL,
  CONDITION_OPERATORS.GREATER_EQUAL,
  CONDITION_OPERATORS.LESS_EQUAL,
  CONDITION_OPERATORS.GREATER,
  CONDITION_OPERATORS.LESS,
  CONDITION_OPERATORS.MODULO
];

/** @type {string[]} Comparison operators without modulo */
const COMPARE_OPS = [
  CONDITION_OPERATORS.EQUAL,
  CONDITION_OPERATORS.NOT_EQUAL,
  CONDITION_OPERATORS.GREATER_EQUAL,
  CONDITION_OPERATORS.LESS_EQUAL,
  CONDITION_OPERATORS.GREATER,
  CONDITION_OPERATORS.LESS
];

/** @type {string[]} Equality-only operators */
const EQUALITY_OPS = [CONDITION_OPERATORS.EQUAL, CONDITION_OPERATORS.NOT_EQUAL];

/** @type {string[]} Boolean-only operators */
const BOOLEAN_OPS = [CONDITION_OPERATORS.EQUAL];

/** @type {string[]} Event-specific operators for linked event conditions */
const EVENT_OPS = [CONDITION_OPERATORS.DAYS_AGO, CONDITION_OPERATORS.DAYS_FROM_NOW, CONDITION_OPERATORS.WITHIN_LAST, CONDITION_OPERATORS.WITHIN_NEXT];

/** @type {Object<string, string>} Category labels for the field selector optgroups. */
const CATEGORY_LABELS = {
  date: 'CALENDARIA.Common.Date',
  weekday: 'CALENDARIA.Common.Weekday',
  week: 'CALENDARIA.Common.Week',
  season: 'CALENDARIA.Common.Season',
  moon: 'CALENDARIA.Common.Moon',
  cycle: 'CALENDARIA.Common.Cycle',
  era: 'CALENDARIA.Common.Era',
  other: 'CALENDARIA.Common.Other'
};

/** @type {string[]} Category display order */
const CATEGORY_ORDER = ['date', 'weekday', 'week', 'season', 'moon', 'cycle', 'era', 'other'];

/** @type {Object<string, string>} Operator display labels */
const OPERATOR_LABELS = {
  [CONDITION_OPERATORS.EQUAL]: 'CALENDARIA.Condition.Operator.equal',
  [CONDITION_OPERATORS.NOT_EQUAL]: 'CALENDARIA.Condition.Operator.notEqual',
  [CONDITION_OPERATORS.GREATER_EQUAL]: 'CALENDARIA.Condition.Operator.greaterEqual',
  [CONDITION_OPERATORS.LESS_EQUAL]: 'CALENDARIA.Condition.Operator.lessEqual',
  [CONDITION_OPERATORS.GREATER]: 'CALENDARIA.Condition.Operator.greater',
  [CONDITION_OPERATORS.LESS]: 'CALENDARIA.Condition.Operator.less',
  [CONDITION_OPERATORS.MODULO]: 'CALENDARIA.Condition.Operator.modulo',
  [CONDITION_OPERATORS.DAYS_AGO]: 'CALENDARIA.Condition.Operator.daysAgo',
  [CONDITION_OPERATORS.DAYS_FROM_NOW]: 'CALENDARIA.Condition.Operator.daysFromNow',
  [CONDITION_OPERATORS.WITHIN_LAST]: 'CALENDARIA.Condition.Operator.withinLast',
  [CONDITION_OPERATORS.WITHIN_NEXT]: 'CALENDARIA.Condition.Operator.withinNext'
};

/**
 * Complete field registry mapping CONDITION_FIELDS to their UI metadata.
 * @type {Object<string, object>}
 */
const FIELD_REGISTRY = {
  [CONDITION_FIELDS.YEAR]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'date',
    label: 'CALENDARIA.Common.Year'
  },
  [CONDITION_FIELDS.MONTH]: {
    inputType: 'select',
    operators: COMPARE_OPS,
    category: 'date',
    label: 'CALENDARIA.Common.Month',
    getOptions: (cal) => (cal?.monthsArray ?? []).map((m, i) => ({ value: i + 1, label: localize(m.name) }))
  },
  [CONDITION_FIELDS.DAY]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'date',
    label: 'CALENDARIA.Common.Day'
  },
  [CONDITION_FIELDS.DAY_OF_YEAR]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'date',
    label: 'CALENDARIA.Condition.Field.dayOfYear'
  },
  [CONDITION_FIELDS.DAYS_BEFORE_MONTH_END]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'date',
    label: 'CALENDARIA.Condition.Field.daysBeforeMonthEnd'
  },
  [CONDITION_FIELDS.WEEKDAY]: {
    inputType: 'select',
    operators: COMPARE_OPS,
    category: 'weekday',
    label: 'CALENDARIA.Common.Weekday',
    getOptions: (cal) => (cal?.weekdaysArray ?? []).map((d, i) => ({ value: i + 1, label: localize(d.name) }))
  },
  [CONDITION_FIELDS.WEEK_NUMBER_IN_MONTH]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'weekday',
    label: 'CALENDARIA.Condition.Field.weekNumberInMonth'
  },
  [CONDITION_FIELDS.INVERSE_WEEK_NUMBER]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'weekday',
    label: 'CALENDARIA.Condition.Field.inverseWeekNumber'
  },
  [CONDITION_FIELDS.WEEK_IN_MONTH]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'week',
    label: 'CALENDARIA.Condition.Field.weekInMonth'
  },
  [CONDITION_FIELDS.WEEK_IN_YEAR]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'week',
    label: 'CALENDARIA.Condition.Field.weekInYear'
  },
  [CONDITION_FIELDS.TOTAL_WEEK]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'week',
    label: 'CALENDARIA.Condition.Field.totalWeek'
  },
  [CONDITION_FIELDS.WEEKS_BEFORE_MONTH_END]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'week',
    label: 'CALENDARIA.Condition.Field.weeksBeforeMonthEnd'
  },
  [CONDITION_FIELDS.WEEKS_BEFORE_YEAR_END]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'week',
    label: 'CALENDARIA.Condition.Field.weeksBeforeYearEnd'
  },
  [CONDITION_FIELDS.SEASON]: {
    inputType: 'select',
    operators: EQUALITY_OPS,
    category: 'season',
    label: 'CALENDARIA.Common.Season',
    getOptions: (cal) => (cal?.seasonsArray ?? []).map((s, i) => ({ value: i + 1, label: localize(s.name) })),
    available: (cal) => (cal?.seasonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.SEASON_PERCENT]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'season',
    label: 'CALENDARIA.Condition.Field.seasonPercent',
    available: (cal) => (cal?.seasonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.SEASON_DAY]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'season',
    label: 'CALENDARIA.Condition.Field.seasonDay',
    available: (cal) => (cal?.seasonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.IS_LONGEST_DAY]: {
    inputType: 'boolean',
    operators: BOOLEAN_OPS,
    category: 'season',
    label: 'CALENDARIA.Condition.Field.isLongestDay',
    available: (cal) => (cal?.seasonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.IS_SHORTEST_DAY]: {
    inputType: 'boolean',
    operators: BOOLEAN_OPS,
    category: 'season',
    label: 'CALENDARIA.Condition.Field.isShortestDay',
    available: (cal) => (cal?.seasonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.IS_SPRING_EQUINOX]: {
    inputType: 'boolean',
    operators: BOOLEAN_OPS,
    category: 'season',
    label: 'CALENDARIA.Condition.Field.isSpringEquinox',
    available: (cal) => (cal?.seasonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.IS_AUTUMN_EQUINOX]: {
    inputType: 'boolean',
    operators: BOOLEAN_OPS,
    category: 'season',
    label: 'CALENDARIA.Condition.Field.isAutumnEquinox',
    available: (cal) => (cal?.seasonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.MOON_PHASE_INDEX]: {
    inputType: 'select',
    operators: EQUALITY_OPS,
    category: 'moon',
    label: 'CALENDARIA.Condition.Field.moonPhaseIndex',
    needsValue2: true,
    value2Label: 'CALENDARIA.Common.Moon',
    value2Hint: 'CALENDARIA.Condition.Builder.Tooltip.MoonSelect',
    value2Type: 'number',
    value2Semantic: 'moonIndex',
    getOptions: () => MOON_PHASE_LABELS.map((name, i) => ({ value: i, label: localize(name) })),
    getValue2Options: (cal) => (cal?.moonsArray ?? []).map((m, i) => ({ value: i, label: localize(m.name) })),
    available: (cal) => (cal?.moonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.MOON_PHASE]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'moon',
    label: 'CALENDARIA.Condition.Field.moonPhase',
    needsValue2: true,
    value2Label: 'CALENDARIA.Common.Moon',
    value2Hint: 'CALENDARIA.Condition.Builder.Tooltip.MoonSelect',
    value2Type: 'number',
    value2Semantic: 'moonIndex',
    getValue2Options: (cal) => (cal?.moonsArray ?? []).map((m, i) => ({ value: i, label: localize(m.name) })),
    available: (cal) => (cal?.moonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.MOON_PHASE_COUNT_MONTH]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'moon',
    label: 'CALENDARIA.Condition.Field.moonPhaseCountMonth',
    needsValue2: true,
    value2Label: 'CALENDARIA.Common.Moon',
    value2Hint: 'CALENDARIA.Condition.Builder.Tooltip.MoonSelect',
    value2Type: 'number',
    value2Semantic: 'moonIndex',
    getValue2Options: (cal) => (cal?.moonsArray ?? []).map((m, i) => ({ value: i, label: localize(m.name) })),
    available: (cal) => (cal?.moonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.MOON_PHASE_COUNT_YEAR]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'moon',
    label: 'CALENDARIA.Condition.Field.moonPhaseCountYear',
    needsValue2: true,
    value2Label: 'CALENDARIA.Common.Moon',
    value2Hint: 'CALENDARIA.Condition.Builder.Tooltip.MoonSelect',
    value2Type: 'number',
    value2Semantic: 'moonIndex',
    getValue2Options: (cal) => (cal?.moonsArray ?? []).map((m, i) => ({ value: i, label: localize(m.name) })),
    available: (cal) => (cal?.moonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.MOON_PHASE_COUNT_EPOCH]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'moon',
    label: 'CALENDARIA.Condition.Field.moonPhaseCountEpoch',
    needsValue2: true,
    value2Label: 'CALENDARIA.Common.Moon',
    value2Hint: 'CALENDARIA.Condition.Builder.Tooltip.MoonSelect',
    value2Type: 'number',
    value2Semantic: 'moonIndex',
    getValue2Options: (cal) => (cal?.moonsArray ?? []).map((m, i) => ({ value: i, label: localize(m.name) })),
    available: (cal) => (cal?.moonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.MOON_SUB_PHASE]: {
    inputType: 'select',
    operators: EQUALITY_OPS,
    category: 'moon',
    label: 'CALENDARIA.Condition.Field.moonSubPhase',
    needsValue2: true,
    value2Label: 'CALENDARIA.Common.Moon',
    value2Hint: 'CALENDARIA.Condition.Builder.Tooltip.MoonSelect',
    value2Type: 'number',
    value2Semantic: 'moonIndex',
    getOptions: () => [
      { value: 1, label: localize('CALENDARIA.Common.Rising') },
      { value: 2, label: localize('CALENDARIA.Condition.MoonSubPhase.True') },
      { value: 3, label: localize('CALENDARIA.Common.Fading') }
    ],
    getValue2Options: (cal) => (cal?.moonsArray ?? []).map((m, i) => ({ value: i, label: localize(m.name) })),
    available: (cal) => (cal?.moonsArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.CYCLE]: {
    inputType: 'select',
    operators: EQUALITY_OPS,
    category: 'cycle',
    label: 'CALENDARIA.Condition.Field.cycle',
    needsValue2: true,
    value2Label: 'CALENDARIA.Common.Cycle',
    value2Hint: 'CALENDARIA.Condition.Builder.Tooltip.CycleSelect',
    value2Type: 'number',
    value2Semantic: 'cycleIndex',
    getOptions: (cal, value2) => {
      const cycles = cal?.cyclesArray ?? [];
      const cycle = cycles[value2 ?? 0];
      return (cycle?.entries ?? []).map((e, i) => ({ value: i, label: localize(e.name ?? `Entry ${i}`) }));
    },
    getValue2Options: (cal) => (cal?.cyclesArray ?? []).map((c, i) => ({ value: i, label: localize(c.name) })),
    available: (cal) => (cal?.cyclesArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.ERA]: {
    inputType: 'select',
    operators: EQUALITY_OPS,
    category: 'era',
    label: 'CALENDARIA.Common.Era',
    getOptions: (cal) => (cal?.erasArray ?? []).map((e, i) => ({ value: i + 1, label: localize(e.name) })),
    available: (cal) => (cal?.erasArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.ERA_YEAR]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'era',
    label: 'CALENDARIA.Condition.Field.eraYear',
    available: (cal) => (cal?.erasArray?.length ?? 0) > 0
  },
  [CONDITION_FIELDS.INTERCALARY]: {
    inputType: 'boolean',
    operators: BOOLEAN_OPS,
    category: 'other',
    label: 'CALENDARIA.Condition.Field.intercalary'
  },
  [CONDITION_FIELDS.IS_LEAP_YEAR]: {
    inputType: 'boolean',
    operators: BOOLEAN_OPS,
    category: 'other',
    label: 'CALENDARIA.Condition.Field.isLeapYear'
  },
  [CONDITION_FIELDS.RANDOM]: {
    inputType: 'number',
    operators: COMPARE_OPS,
    category: 'other',
    label: 'CALENDARIA.Condition.Field.random',
    needsValue2: true,
    value2Label: 'CALENDARIA.Condition.Builder.Seed',
    value2Hint: 'CALENDARIA.Condition.Builder.Tooltip.Seed',
    value2InputType: 'number',
    value2Type: 'number',
    value2Semantic: 'seed'
  },
  [CONDITION_FIELDS.DATE]: {
    inputType: 'date',
    operators: COMPARE_OPS,
    category: 'other',
    label: 'CALENDARIA.Common.Date'
  },
  [CONDITION_FIELDS.EPOCH]: {
    inputType: 'number',
    operators: ALL_OPS,
    category: 'date',
    label: 'CALENDARIA.Condition.Field.epoch'
  },
  [CONDITION_FIELDS.WEATHER]: {
    inputType: 'select',
    operators: EQUALITY_OPS,
    category: 'other',
    label: 'CALENDARIA.Condition.Field.weather',
    getOptions: () => {
      const presets = game.settings?.get?.('calendaria', 'customWeatherPresets') ?? {};
      return Object.entries(presets).map(([id, p]) => ({ value: id, label: p.name || id }));
    },
    needsValue2: true,
    value2Label: 'CALENDARIA.Common.ClimateZone',
    value2Hint: 'CALENDARIA.Condition.Builder.Tooltip.ZoneSelect',
    value2Type: 'string',
    value2Semantic: 'zoneId',
    getValue2Options: () => {
      const zones = WeatherManager.getCalendarZones();
      if (zones.length <= 1) return [];
      return zones.map((z) => ({ value: z.id, label: localize(z.name ?? z.id) }));
    },
    available: () => {
      const presets = game.settings?.get?.('calendaria', 'customWeatherPresets') ?? {};
      return Object.keys(presets).length > 0;
    }
  },
  [CONDITION_FIELDS.COMPUTED]: {
    inputType: 'special',
    operators: BOOLEAN_OPS,
    category: 'other',
    label: 'CALENDARIA.Condition.Field.computed'
  },
  [CONDITION_FIELDS.EVENT]: {
    inputType: 'number',
    operators: EVENT_OPS,
    category: 'other',
    label: 'CALENDARIA.Condition.Field.event',
    needsValue2: true,
    value2Label: 'CALENDARIA.Condition.Builder.EventNoteSelect',
    value2Hint: 'CALENDARIA.Condition.Builder.Tooltip.EventSelect',
    value2Type: 'object',
    value2Semantic: 'eventRef',
    getValue2Options: () => {
      const notes = NoteManager?.getAllNotes?.() ?? [];
      return notes.map((n) => ({ value: n.id, label: n.name || n.id }));
    }
  }
};

/**
 * Get the schema for a specific field.
 * @param {string} fieldId - CONDITION_FIELDS value
 * @returns {object|null} Field schema or null
 */
export function getFieldSchema(fieldId) {
  return FIELD_REGISTRY[fieldId] ?? null;
}

/**
 * Get grouped field options for the field selector dropdown.
 * @param {object} calendar - Active calendar
 * @returns {Array<{label: string, options: Array<{value: string, label: string}>}>} Grouped field options
 */
export function getGroupedFieldOptions(calendar) {
  const groups = [];
  for (const category of CATEGORY_ORDER) {
    const options = [];
    for (const [fieldId, schema] of Object.entries(FIELD_REGISTRY)) {
      if (schema.category !== category) continue;
      if (schema.inputType === 'special') continue;
      if (schema.available && !schema.available(calendar)) continue;
      options.push({ value: fieldId, label: localize(schema.label) });
    }
    if (options.length) groups.push({ label: localize(CATEGORY_LABELS[category]), options });
  }
  return groups;
}

/**
 * Get operator options for a specific field.
 * @param {string} fieldId - CONDITION_FIELDS value
 * @returns {Array<{value: string, label: string}>} Operator options for the field
 */
export function getOperatorOptions(fieldId) {
  const schema = FIELD_REGISTRY[fieldId];
  if (!schema) return [];
  return schema.operators.map((op) => ({ value: op, label: localize(OPERATOR_LABELS[op] ?? op) }));
}

/**
 * Get value options for a select-type field.
 * @param {string} fieldId - CONDITION_FIELDS value
 * @param {object} calendar - Active calendar
 * @param {*} [value2] - Secondary value for context-dependent options
 * @returns {Array<{value: *, label: string}>|null} Options array or null for number/boolean inputs
 */
export function getValueOptions(fieldId, calendar, value2) {
  const schema = FIELD_REGISTRY[fieldId];
  if (!schema?.getOptions) return null;
  return schema.getOptions(calendar, value2);
}

/**
 * Get value2 options for fields that require a secondary selector.
 * @param {string} fieldId - CONDITION_FIELDS value
 * @param {object} calendar - Active calendar
 * @returns {Array<{value: *, label: string}>|null} Options array or null
 */
export function getValue2Options(fieldId, calendar) {
  const schema = FIELD_REGISTRY[fieldId];
  if (!schema?.getValue2Options) return null;
  return schema.getValue2Options(calendar);
}
