/**
 * Condition Presets — common recurrence patterns as condition trees.
 * @module Notes/ConditionPresets
 */

import { CalendarManager } from '../calendar/_module.mjs';
import { MOON_PHASE_LABELS } from '../constants.mjs';
import { format, getCalendarMoonPhaseIndex, getLastDayOfMonth, getMoonPhaseCountInYear, localize } from '../utils/_module.mjs';
import { dayOfWeek, getMoonSubPhase } from './_module.mjs';

/**
 * Build a condition tree AND group from children.
 * @param {object[]} children - Condition entries
 * @returns {object} Root AND group
 */
function andGroup(children) {
  return { type: 'group', mode: 'and', children, threshold: null };
}

/**
 * Build a single condition entry.
 * @param {string} field - Condition field
 * @param {string} op - Operator
 * @param {*} value - Value
 * @param {object} [extra] - Additional fields (offset, value2)
 * @returns {object} Condition object
 */
function cond(field, op, value, extra = {}) {
  return { type: 'condition', field, op, value, ...extra };
}

/** Sub-phase labels keyed by sub-phase value. */
const SUB_PHASE_LABELS = { 1: 'CALENDARIA.Condition.MoonSubPhase.Rising', 2: 'CALENDARIA.Condition.MoonSubPhase.True', 3: 'CALENDARIA.Condition.MoonSubPhase.Fading' };

/** Group labels for preset optgroups, keyed by group ID. */
const GROUP_LABELS = {
  basic: 'CALENDARIA.Note.PresetGroup.Basic',
  weekly: 'CALENDARIA.Note.PresetGroup.Weekly',
  monthly: 'CALENDARIA.Note.PresetGroup.Monthly',
  yearly: 'CALENDARIA.Note.PresetGroup.Yearly',
  interval: 'CALENDARIA.Note.PresetGroup.Interval',
  season: 'CALENDARIA.Note.PresetGroup.Season',
  moon: 'CALENDARIA.Note.PresetGroup.Moon',
  eclipse: 'CALENDARIA.Note.PresetGroup.Eclipse'
};

/** Stable ordering for preset groups. */
const GROUP_ORDER = ['basic', 'weekly', 'monthly', 'yearly', 'interval', 'season', 'moon', 'eclipse'];

/**
 * Format an ordinal number (1st, 2nd, 3rd, etc.).
 * @param {number} n - Number to format
 * @returns {string} Ordinal string
 */
function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/**
 * Get available condition presets based on the active calendar and note start date.
 * @param {object} startDate - The note's start date { year, month, dayOfMonth }
 * @returns {object[]} Array of preset definitions with id, label, and tree
 */
export function getConditionPresets(startDate) {
  const cal = CalendarManager.getActiveCalendar();
  if (!cal) return [];
  const p = [];
  const wd = cal.weekdaysArray ?? [];
  const mo = cal.monthsArray ?? [];
  const sn = cal.seasonsArray ?? [];
  const mn = cal.moonsArray ?? [];
  const d = (startDate?.dayOfMonth ?? 0) + 1;
  const m = startDate?.month ?? 0;
  const diw = cal.daysInWeek ?? wd.length ?? 7;
  const wdi = startDate ? dayOfWeek(startDate) + 1 : 1;
  const wn = Math.ceil(d / diw);
  const lastDay = startDate ? getLastDayOfMonth(startDate) : d;
  const iwn = Math.floor((lastDay - d) / diw) + 1;
  const wdName = wd[wdi - 1] ? localize(wd[wdi - 1].name) : `Day ${wdi}`;
  const moName = mo[m] ? localize(mo[m].name ?? '') : '';
  const L = 'CALENDARIA.Note.Preset.';
  const G = { BASIC: 'basic', WEEKLY: 'weekly', MONTHLY: 'monthly', YEARLY: 'yearly', INTERVAL: 'interval', SEASON: 'season' };
  p.push({ id: 'everyDay', group: G.BASIC, label: localize(`${L}EveryDay`), tree: andGroup([cond('day', '%', 1, { offset: 0 })]) });
  const hasLeapYears = mo.some((month) => month.leapDays != null);
  if (hasLeapYears) p.push({ id: 'leapYearOnly', group: G.BASIC, label: localize(`${L}LeapYearOnly`), tree: andGroup([cond('isLeapYear', '==', true)]) });
  for (let i = 0; i < wd.length; i++)
    p.push({ id: `everyWeekday_${i}`, group: G.WEEKLY, label: format(`${L}EveryWeekday`, { weekday: localize(wd[i].name) }), tree: andGroup([cond('weekday', '==', i + 1)]) });
  p.push({ id: 'fortnightly', group: G.WEEKLY, label: format(`${L}Fortnightly`, { weekday: wdName }), tree: andGroup([cond('weekday', '==', wdi), cond('totalWeek', '%', 2)]) });
  p.push({ id: 'monthlyOnDay', group: G.MONTHLY, label: format(`${L}MonthlyOnDay`, { day: d }), tree: andGroup([cond('day', '==', d)]) });
  p.push({
    id: 'monthlyWeekday',
    group: G.MONTHLY,
    label: format(`${L}MonthlyWeekday`, { ordinal: ordinal(wn), weekday: wdName }),
    tree: andGroup([cond('weekday', '==', wdi), cond('weekNumberInMonth', '==', wn)])
  });
  p.push({
    id: 'monthlyInverseWeekday',
    group: G.MONTHLY,
    label: format(`${L}MonthlyInverseWeekday`, { ordinal: ordinal(iwn), weekday: wdName }),
    tree: andGroup([cond('weekday', '==', wdi), cond('inverseWeekNumber', '==', iwn)])
  });
  for (let i = 0; i < wd.length; i++) {
    p.push({
      id: `firstWeekday_${i}`,
      group: G.MONTHLY,
      label: format(`${L}FirstWeekdayOfMonth`, { weekday: localize(wd[i].name) }),
      tree: andGroup([cond('weekday', '==', i + 1), cond('weekNumberInMonth', '==', 1)])
    });
  }
  for (let i = 0; i < wd.length; i++) {
    p.push({
      id: `lastWeekday_${i}`,
      group: G.MONTHLY,
      label: format(`${L}LastWeekdayOfMonth`, { weekday: localize(wd[i].name) }),
      tree: andGroup([cond('weekday', '==', i + 1), cond('inverseWeekNumber', '==', 1)])
    });
  }
  if (mo.length) {
    p.push({ id: 'yearlyOnDate', group: G.YEARLY, label: format(`${L}YearlyOnDate`, { month: moName, day: d }), tree: andGroup([cond('month', '==', m + 1), cond('day', '==', d)]) });
    p.push({
      id: 'annuallyMonthWeekday',
      group: G.YEARLY,
      label: format(`${L}AnnuallyMonthWeekday`, { ordinal: ordinal(wn), weekday: wdName, month: moName }),
      tree: andGroup([cond('month', '==', m + 1), cond('weekday', '==', wdi), cond('weekNumberInMonth', '==', wn)])
    });
    p.push({
      id: 'annuallyInverseMonthWeekday',
      group: G.YEARLY,
      label: format(`${L}AnnuallyInverseMonthWeekday`, { ordinal: ordinal(iwn), weekday: wdName, month: moName }),
      tree: andGroup([cond('month', '==', m + 1), cond('weekday', '==', wdi), cond('inverseWeekNumber', '==', iwn)])
    });
  }
  for (const n of [2, 3, 7, 14, 30]) p.push({ id: `everyNDays_${n}`, group: G.INTERVAL, label: format(`${L}EveryNDays`, { n }), tree: andGroup([cond('dayOfYear', '%', n)]) });
  p.push({ id: 'everyXWeekday', group: G.INTERVAL, label: format(`${L}EveryXWeekday`, { n: ordinal(2), weekday: wdName }), tree: andGroup([cond('weekday', '==', wdi), cond('totalWeek', '%', 2)]) });
  p.push({ id: 'everyXMonthlyDate', group: G.INTERVAL, label: format(`${L}EveryXMonthlyDate`, { n: ordinal(2), day: d }), tree: andGroup([cond('month', '%', 2), cond('day', '==', d)]) });
  p.push({
    id: 'everyXMonthlyWeekday',
    group: G.INTERVAL,
    label: format(`${L}EveryXMonthlyWeekday`, { n: ordinal(2), ordinal: ordinal(wn), weekday: wdName }),
    tree: andGroup([cond('month', '%', 2), cond('weekday', '==', wdi), cond('weekNumberInMonth', '==', wn)])
  });
  p.push({
    id: 'everyXInverseMonthlyWeekday',
    group: G.INTERVAL,
    label: format(`${L}EveryXInverseMonthlyWeekday`, { n: ordinal(2), ordinal: ordinal(iwn), weekday: wdName }),
    tree: andGroup([cond('month', '%', 2), cond('weekday', '==', wdi), cond('inverseWeekNumber', '==', iwn)])
  });
  if (mo.length) {
    p.push({
      id: 'everyXAnnuallyDate',
      group: G.INTERVAL,
      label: format(`${L}EveryXAnnuallyDate`, { n: ordinal(2), month: moName, day: d }),
      tree: andGroup([cond('year', '%', 2), cond('month', '==', m + 1), cond('day', '==', d)])
    });
    p.push({
      id: 'everyXAnnuallyWeekday',
      group: G.INTERVAL,
      label: format(`${L}EveryXAnnuallyWeekday`, { n: ordinal(2), ordinal: ordinal(wn), weekday: wdName, month: moName }),
      tree: andGroup([cond('year', '%', 2), cond('month', '==', m + 1), cond('weekday', '==', wdi), cond('weekNumberInMonth', '==', wn)])
    });
    p.push({
      id: 'everyXInverseAnnuallyWeekday',
      group: G.INTERVAL,
      label: format(`${L}EveryXInverseAnnuallyWeekday`, { n: ordinal(2), ordinal: ordinal(iwn), weekday: wdName, month: moName }),
      tree: andGroup([cond('year', '%', 2), cond('month', '==', m + 1), cond('weekday', '==', wdi), cond('inverseWeekNumber', '==', iwn)])
    });
  }
  for (let i = 0; i < sn.length; i++)
    p.push({ id: `duringSeason_${i}`, group: G.SEASON, label: format(`${L}DuringSeason`, { season: localize(sn[i].name) }), tree: andGroup([cond('season', '==', i + 1)]) });
  if (mn.length && startDate) {
    for (let mi = 0; mi < mn.length; mi++) {
      const moonName = localize(mn[mi].name);
      const phaseIdx = getCalendarMoonPhaseIndex(startDate, mi);
      const subPhase = getMoonSubPhase(startDate, mi);
      if (phaseIdx == null) continue;
      const phaseName = localize(MOON_PHASE_LABELS[phaseIdx] ?? `Phase ${phaseIdx}`);
      const subName = subPhase ? localize(SUB_PHASE_LABELS[subPhase] ?? '') : '';
      const phaseLabel = subName ? `${phaseName} ${subName}` : phaseName;
      const moonConds = [cond('moonPhaseIndex', '==', phaseIdx, { value2: mi })];
      if (subPhase) moonConds.push(cond('moonSubPhase', '==', subPhase, { value2: mi }));
      p.push({ id: `moonEvery_${mi}`, group: 'moon', label: format(`${L}MoonEvery`, { moon: moonName, phase: phaseLabel }), tree: andGroup([...moonConds]) });
      p.push({
        id: `moonXEvery_${mi}`,
        group: 'moon',
        label: format(`${L}MoonXEvery`, { moon: moonName, n: ordinal(2), phase: phaseLabel }),
        tree: andGroup([...moonConds, cond('moonPhaseCountEpoch', '%', 2, { value2: mi })])
      });
      if (mo.length) {
        p.push({
          id: `moonAnnually_${mi}`,
          group: 'moon',
          label: format(`${L}MoonAnnually`, { moon: moonName, phase: phaseLabel, month: moName }),
          tree: andGroup([cond('month', '==', m + 1), ...moonConds])
        });
        p.push({
          id: `moonXAnnually_${mi}`,
          group: 'moon',
          label: format(`${L}MoonXAnnually`, { moon: moonName, n: ordinal(2), phase: phaseLabel, month: moName }),
          tree: andGroup([cond('month', '==', m + 1), ...moonConds, cond('moonPhaseCountMonth', '%', 2, { value2: mi })])
        });
      }
      const yearCount = getMoonPhaseCountInYear(startDate, mi);
      if (yearCount > 0) {
        p.push({
          id: `moonYearly_${mi}`,
          group: 'moon',
          label: format(`${L}MoonYearly`, { moon: moonName, count: ordinal(yearCount), phase: phaseLabel }),
          tree: andGroup([...moonConds, cond('moonPhaseCountYear', '==', yearCount, { value2: mi })])
        });
      }
    }
    if (mn.length >= 2) {
      const alignConds = [];
      const names = [];
      for (let mi = 0; mi < mn.length; mi++) {
        const phaseIdx = getCalendarMoonPhaseIndex(startDate, mi);
        if (phaseIdx == null) continue;
        alignConds.push(cond('moonPhaseIndex', '==', phaseIdx, { value2: mi }));
        names.push(localize(mn[mi].name));
      }
      if (alignConds.length >= 2) p.push({ id: 'multimoonAlignment', group: 'moon', label: localize(`${L}MultimoonAlignment`), tree: andGroup(alignConds) });
    }
  }
  const eclipseMoons = mn.filter((m) => m.eclipseMode && m.eclipseMode !== 'never');
  if (eclipseMoons.length) {
    p.push({ id: 'anyEclipse', group: 'eclipse', label: localize(`${L}AnyEclipse`), tree: andGroup([cond('isEclipse', '==', true)]) });
    p.push({ id: 'anySolarEclipse', group: 'eclipse', label: localize(`${L}AnySolarEclipse`), tree: andGroup([cond('isSolarEclipse', '==', true)]) });
    p.push({ id: 'anyLunarEclipse', group: 'eclipse', label: localize(`${L}AnyLunarEclipse`), tree: andGroup([cond('isLunarEclipse', '==', true)]) });
    for (let mi = 0; mi < mn.length; mi++) {
      if (!mn[mi].eclipseMode || mn[mi].eclipseMode === 'never') continue;
      const moonName = localize(mn[mi].name);
      p.push({
        id: `solarEclipse_${mi}`,
        group: 'eclipse',
        label: format(`${L}SolarEclipse`, { moon: moonName }),
        tree: andGroup([cond('isSolarEclipse', '==', true)])
      });
      p.push({
        id: `lunarEclipse_${mi}`,
        group: 'eclipse',
        label: format(`${L}LunarEclipse`, { moon: moonName }),
        tree: andGroup([cond('isLunarEclipse', '==', true)])
      });
    }
  }
  return p;
}

/**
 * Group a flat preset array into optgroup-ready structure.
 * @param {object[]} presets - Flat array from getConditionPresets
 * @returns {object[]} Array of { label, options: [{id, label}] }
 */
export function groupPresets(presets) {
  const buckets = new Map();
  for (const p of presets) {
    const key = p.group || 'basic';
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(p);
  }
  return GROUP_ORDER.filter((k) => buckets.has(k)).map((k) => ({ label: localize(GROUP_LABELS[k] ?? k), options: buckets.get(k) }));
}
