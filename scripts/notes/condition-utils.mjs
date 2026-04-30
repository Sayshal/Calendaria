import { CONDITION_FIELDS, CONDITION_GROUP_MODES, CONDITION_OPERATORS, MAX_NESTING_DEPTH } from '../constants.mjs';
import { localize } from '../utils/localization.mjs';
import { isGroup } from './condition-engine.mjs';
import { getFieldSchema, getGroupedFieldOptions, getOperatorOptions, getValue2Options, getValueOptions } from './_module.mjs';

/**
 * Get a node from the tree by its dot-separated path.
 * @param {object} rootGroup - Root group containing children
 * @param {string} path - Dot-separated path (e.g., '0', '1.2', '0.1.3')
 * @returns {object|null} Node at path or null
 */
export function getNodeAtPath(rootGroup, path) {
  if (!path && path !== 0) return rootGroup;
  const parts = String(path).split('.').map(Number);
  let current = rootGroup;
  for (const idx of parts) {
    if (!current?.children?.[idx]) return null;
    current = current.children[idx];
  }
  return current;
}

/**
 * Get the parent group and child index for a given path.
 * @param {object} rootGroup - Root group
 * @param {string} path - Dot-separated path
 * @returns {{ parent: object, index: number }|null} Parent group and index
 */
export function getParentAndIndex(rootGroup, path) {
  const parts = String(path).split('.').map(Number);
  const childIndex = parts.pop();
  const parentPath = parts.join('.');
  const parent = parentPath ? getNodeAtPath(rootGroup, parentPath) : rootGroup;
  if (!parent?.children) return null;
  return { parent, index: childIndex };
}

/**
 * Calculate the depth of a node given its path.
 * @param {string} path - Dot-separated path
 * @returns {number} Depth (0 for root children)
 */
export function getDepthFromPath(path) {
  if (!path && path !== 0) return 0;
  return String(path).split('.').length;
}

/**
 * Create a default condition object.
 * @param {string} [field] - Initial field (defaults to 'year')
 * @returns {object} New condition
 */
export function createDefaultCondition(field = CONDITION_FIELDS.YEAR) {
  const schema = getFieldSchema(field);
  const op = schema?.operators?.[0] ?? CONDITION_OPERATORS.EQUAL;
  let value = 0;
  if (schema?.inputType === 'boolean') value = true;
  return { type: 'condition', field, op, value, value2: null, offset: 0 };
}

/**
 * Create a default group object.
 * @param {string} [mode] - Boolean mode (defaults to 'and')
 * @returns {object} New group
 */
export function createDefaultGroup(mode = CONDITION_GROUP_MODES.AND) {
  return { type: 'group', mode, children: [], threshold: null };
}

/**
 * Wrap a flat conditions array into a root group for the builder.
 * @param {Array} conditions - Flat conditions array from note data
 * @returns {object} Root group containing the conditions
 */
export function wrapInRootGroup(conditions) {
  const children = foundry.utils.deepClone(conditions ?? []);
  for (const child of children) if (!child.type) child.type = 'condition';
  return { type: 'group', mode: CONDITION_GROUP_MODES.AND, children, threshold: null };
}

/**
 * Recursively remove empty groups from a conditions array.
 * @param {Array} children - Conditions array
 * @returns {Array} Cleaned conditions array
 */
function stripEmptyGroups(children) {
  return children.filter((entry) => {
    if (!isGroup(entry)) return true;
    entry.children = stripEmptyGroups(entry.children ?? []);
    return entry.children.length > 0;
  });
}

/**
 * Unwrap a root group back to a flat conditions array.
 * @param {object} rootGroup - Root group from the builder
 * @returns {Array} Conditions array for note data
 */
export function unwrapFromRootGroup(rootGroup) {
  const children = foundry.utils.deepClone(rootGroup?.children ?? []);
  return stripEmptyGroups(children);
}

/**
 * Recursively annotate a condition tree for template rendering.
 * @param {object} entry - Condition or group node
 * @param {object} calendar - Active calendar
 * @param {string} [path] - Current path prefix
 * @param {number} [depth] - Current depth
 * @returns {object} Annotated entry ready for template rendering
 */
export function annotateForRender(entry, calendar, path = '', depth = 0) {
  if (isGroup(entry)) return annotateGroup(entry, calendar, path, depth);
  return annotateCondition(entry, calendar, path, depth);
}

/**
 * Annotate a group node for rendering.
 * @param {object} group - Group node
 * @param {object} calendar - Active calendar
 * @param {string} path - Current path
 * @param {number} depth - Current depth
 * @returns {object} Annotated group
 */
function annotateGroup(group, calendar, path, depth) {
  const modeOptions = Object.values(CONDITION_GROUP_MODES).map((mode) => ({ value: mode, label: localize(`CALENDARIA.Condition.Group.Mode.${mode}`), selected: group.mode === mode }));
  let conditionCount = 0;
  const children = (group.children ?? []).map((child, i) => {
    const childPath = path ? `${path}.${i}` : `${i}`;
    const annotated = annotateForRender(child, calendar, childPath, depth + 1);
    if (annotated.entryType !== 'group') annotated.conditionNumber = ++conditionCount;
    return annotated;
  });
  return {
    entryType: 'group',
    path,
    depth,
    isRoot: depth === 0,
    mode: group.mode,
    threshold: group.threshold ?? 1,
    isCountMode: group.mode === CONDITION_GROUP_MODES.COUNT,
    canAddGroup: depth < MAX_NESTING_DEPTH - 1,
    modeOptions,
    children,
    hasChildren: children.length > 0
  };
}

/**
 * Annotate a condition node for rendering.
 * @param {object} condition - Condition node
 * @param {object} calendar - Active calendar
 * @param {string} path - Current path
 * @param {number} depth - Current depth
 * @returns {object} Annotated condition
 */
function annotateCondition(condition, calendar, path, depth) {
  const { field, op, value, value2, offset } = condition;
  const schema = getFieldSchema(field);
  const fieldGroups = getGroupedFieldOptions(calendar);
  const fieldOptions = fieldGroups.map((group) => ({ label: group.label, options: group.options.map((opt) => ({ ...opt, selected: opt.value === field })) }));
  const opOptions = getOperatorOptions(field).map((opt) => ({ ...opt, selected: opt.value === op }));
  const inputType = schema?.inputType ?? 'number';
  const isBooleanField = inputType === 'boolean';
  const isSelectField = inputType === 'select';
  const isNumberField = inputType === 'number';
  const isDateField = inputType === 'date';
  const isSpecialField = inputType === 'special';
  const showOffset = op === CONDITION_OPERATORS.MODULO;
  const needsValue2 = schema?.needsValue2 ?? false;
  let valueOptions = null;
  if (isSelectField) {
    const opts = getValueOptions(field, calendar, value2) ?? [];
    valueOptions = opts.map((opt) => ({ ...opt, selected: opt.value === value }));
  }
  let value2Options = null;
  if (needsValue2 && schema.getValue2Options) {
    const opts = getValue2Options(field, calendar) ?? [];
    value2Options = opts.map((opt) => ({ ...opt, selected: opt.value === value2 }));
  }
  let dateYear = 0;
  let dateMonth = 0;
  let dateDay = 0;
  let monthOptions = null;
  let maxDay = 30;
  if (isDateField) {
    if (typeof value === 'object' && value !== null) {
      dateYear = value.year ?? 0;
      dateMonth = value.month ?? 0;
      dateDay = value.dayOfMonth ?? 0;
    }
    const months = calendar?.monthsArray ?? [];
    monthOptions = months.map((m, i) => ({ value: i, label: localize(m.name), selected: i === dateMonth }));
    maxDay = months[dateMonth]?.days ?? 30;
  }
  let specialLabel = '';
  if (isSpecialField) specialLabel = schema ? localize(schema.label) : field;
  return {
    entryType: 'condition',
    path,
    depth,
    field,
    op,
    value,
    value2,
    offset: offset ?? 0,
    fieldOptions,
    opOptions,
    inputType,
    isBooleanField,
    isSelectField,
    isNumberField,
    isDateField,
    isSpecialField,
    specialLabel,
    showOffset,
    needsValue2,
    hasValue2Select: needsValue2 && !!value2Options?.length,
    hasValue2Number: needsValue2 && schema?.value2InputType === 'number',
    value2Label: schema?.value2Label ? localize(schema.value2Label) : '',
    value2Hint: schema?.value2Hint ? localize(schema.value2Hint) : '',
    valueOptions,
    value2Options,
    boolTrue: value === true,
    boolFalse: value === false,
    dateYear,
    dateMonth,
    dateDay,
    maxDay,
    monthOptions
  };
}

/**
 * Get default values when a condition field changes.
 * @param {string} newField - New field ID
 * @param {object} [calendar] - Active calendar for resolving value2 options
 * @returns {{ op: string, value: *, value2: *, offset: number }} Default values for the field
 */
export function getDefaultsForField(newField, calendar = null) {
  const schema = getFieldSchema(newField);
  const op = schema?.operators?.[0] ?? CONDITION_OPERATORS.EQUAL;
  let value = 0;
  if (schema?.inputType === 'boolean') value = true;
  else if (schema?.inputType === 'select') value = 0;
  else if (schema?.inputType === 'date') value = { year: 0, month: 0, dayOfMonth: 0 };
  let value2 = null;
  if (schema?.needsValue2) {
    if (schema.getValue2Options) {
      const opts = schema.getValue2Options(calendar) ?? [];
      value2 = opts[0]?.value ?? null;
    } else {
      value2 = 0;
    }
  }
  return { op, value, value2, offset: 0 };
}

/**
 * Generate human-readable descriptions of a condition tree (legacy format).
 * @param {object} tree - Root condition tree (group or condition)
 * @param {object} calendar - Active calendar
 * @returns {string[]} Array of description strings
 */
export function describeConditionTree(tree, calendar) {
  if (!tree) return [];
  return [summarizeConditionTree(tree, calendar)];
}

/**
 * Produce a single natural-language summary of a condition tree.
 * @param {object} node - Condition or group node
 * @param {object} calendar - Active calendar
 * @returns {string} Human-readable summary
 */
export function summarizeConditionTree(node, calendar) {
  if (!node) return '';
  if (node.type === 'condition') return describeOneCondition(node, calendar);
  if (node.type !== 'group' || !node.children?.length) return '';
  if (node.mode === 'and') return summarizeAndGroup(node.children, calendar);
  const parts = node.children.map((c) => summarizeConditionTree(c, calendar)).filter(Boolean);
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  if (node.mode === 'or') return parts.join(' or ');
  if (node.mode === 'none') return `not (${parts.join(' or ')})`;
  if (node.mode === 'count') return `at least ${node.threshold ?? 1} of: ${parts.join(', ')}`;
  return parts.join(', ');
}

/**
 * Summarize an AND group, merging month+day into combined phrases.
 * @param {object[]} children - Group children
 * @param {object} calendar - Calendar
 * @returns {string} Summary
 */
function summarizeAndGroup(children, calendar) {
  const monthCond = children.find((c) => c.type === 'condition' && c.field === 'month' && c.op === '==');
  const dayCond = children.find((c) => c.type === 'condition' && c.field === 'day' && c.op === '==');
  const parts = [];
  const skip = new Set();
  if (monthCond && dayCond) {
    const monthName = resolveValueName('month', monthCond.value, calendar);
    parts.push(`${monthName} ${dayCond.value}`);
    skip.add(monthCond);
    skip.add(dayCond);
  }
  for (const child of children) {
    if (skip.has(child)) continue;
    const desc = summarizeConditionTree(child, calendar);
    if (desc) parts.push(desc);
  }
  if (!parts.length) return '';
  if (parts.length === 1) return parts[0];
  return parts.join(', ');
}

/**
 * Get an array from a calendar collection.
 * @param {object} calendar - Calendar instance or plain object
 * @param {string} getter - Getter name (e.g. 'monthsArray')
 * @param {string} path - Dot path for plain objects (e.g. 'months.values')
 * @returns {object[]} Array of items
 */
function getCalendarArray(calendar, getter, path) {
  if (!calendar) return [];
  if (calendar[getter]) return calendar[getter];
  const parts = path.split('.');
  let obj = calendar;
  for (const p of parts) {
    obj = obj?.[p];
    if (!obj) return [];
  }
  return typeof obj === 'object' ? Object.values(obj) : [];
}

/**
 * Resolve a condition's value to a human-readable name using calendar data.
 * @param {string} field - Condition field
 * @param {*} value - Raw value
 * @param {object} calendar - Calendar instance or plain object
 * @returns {string} Resolved name
 */
function resolveValueName(field, value, calendar) {
  const months = getCalendarArray(calendar, 'monthsArray', 'months.values');
  const weekdays = getCalendarArray(calendar, 'weekdaysArray', 'days.values');
  const seasons = getCalendarArray(calendar, 'seasonsArray', 'seasons.values');
  const eras = getCalendarArray(calendar, 'erasArray', 'eras');
  if (field === 'month' && months[value - 1]) return localize(months[value - 1].name);
  if (field === 'weekday' && weekdays[value - 1]) return localize(weekdays[value - 1].name);
  if (field === 'season' && seasons[value - 1]) return localize(seasons[value - 1].name);
  if (field === 'era' && eras[value - 1]) return localize(eras[value - 1].name);
  if (field === 'date' && typeof value === 'object' && value !== null) {
    const monthName = months[value.month]?.name ? localize(months[value.month].name) : value.month + 1;
    return `${monthName} ${(value.dayOfMonth ?? 0) + 1}, ${value.year}`;
  }
  return String(value ?? '');
}

/**
 * Describe a single flat condition in natural language.
 * @param {object} cond - Condition object
 * @param {object} calendar - Active calendar
 * @returns {string} Description
 */
function describeOneCondition(cond, calendar) {
  const { field, op, value, offset } = cond;
  const schema = getFieldSchema(field);
  const fieldLabel = schema ? localize(schema.label) : field;
  const valueStr = resolveValueName(field, value, calendar);
  const booleanFields = ['isLongestDay', 'isShortestDay', 'isSpringEquinox', 'isAutumnEquinox', 'intercalary', 'isLeapYear'];
  if (booleanFields.includes(field)) return value ? fieldLabel : `not ${fieldLabel}`;
  if (op === '==') {
    if (field === 'month') return valueStr;
    if (field === 'weekday') return valueStr;
    if (field === 'season') return valueStr;
    if (field === 'era') return valueStr;
    if (field === 'day') return `day ${valueStr}`;
    if (field === 'dayOfYear') return `day ${valueStr} of the year`;
    if (field === 'weekNumberInMonth') return `week ${valueStr} of the month`;
    if (field === 'inverseWeekNumber') return value === 1 ? 'last week of the month' : `${valueStr} weeks before month end`;
    if (field === 'daysBeforeMonthEnd') return value === 0 ? 'last day of the month' : `${valueStr} days before month end`;
    return `${fieldLabel} ${valueStr}`;
  }
  if (op === '!=') {
    if (field === 'month' || field === 'season') return `not in ${valueStr}`;
    if (field === 'weekday') return `not on ${valueStr}`;
    return `${fieldLabel} ≠ ${valueStr}`;
  }
  const opLabels = { '>=': '≥', '<=': '≤', '>': '>', '<': '<' };
  if (opLabels[op]) {
    if (field === 'daysBeforeMonthEnd' && op === '<=') return `within last ${valueStr} days of the month`;
    return `${fieldLabel} ${opLabels[op]} ${valueStr}`;
  }
  if (op === '%') return offset ? `every ${value} ${fieldLabel} (offset ${offset})` : `every ${value} ${fieldLabel}`;
  if (op === 'daysAgo') return `${value} days ago`;
  if (op === 'daysFromNow') return `in ${value} days`;
  if (op === 'withinLast') return `within last ${value} days`;
  if (op === 'withinNext') return `within next ${value} days`;
  return `${fieldLabel} ${op} ${valueStr}`;
}
