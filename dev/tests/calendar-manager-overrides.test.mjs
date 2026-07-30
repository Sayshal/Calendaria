import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../../foundry/common/primitives/_module.mjs';
import * as operators from '../../../foundry/common/data/operators.mjs';
import * as realUtils from '../../../foundry/common/utils/_module.mjs';
import CalendarManager from '../../scripts/calendar/calendar-manager.mjs';
import { MODULE, SETTINGS } from '../../scripts/constants.mjs';

/** Shared registry state usable inside hoisted vi.mock factories. */
const h = vi.hoisted(() => {
  const registry = new Map();
  return {
    registry,
    CalendarRegistry: {
      register: (id, cal) => registry.set(id, cal),
      get: (id) => registry.get(id) ?? null,
      has: (id) => registry.has(id),
      getAllIds: () => [...registry.keys()],
      setActive: () => {},
      getActive: () => null,
      getActiveId: () => null,
      get size() {
        return registry.size;
      }
    }
  };
});

vi.mock('../../scripts/calendar/_module.mjs', () => ({
  BUNDLED_CALENDARS: ['testcal'],
  DEFAULT_CALENDAR: 'testcal',
  isBundledCalendar: (id) => id === 'testcal',
  loadBundledCalendars: async () => {},
  CalendarRegistry: h.CalendarRegistry
}));
vi.mock('../../scripts/data/_module.mjs', () => ({
  CalendariaCalendar: class {
    constructor(data) {
      this.__source = JSON.parse(JSON.stringify(data));
      Object.assign(this, JSON.parse(JSON.stringify(data)));
    }
    toObject() {
      return JSON.parse(JSON.stringify(this.__source));
    }
  }
}));
vi.mock('../../scripts/festivals/_module.mjs', () => ({ FestivalManager: {} }));
vi.mock('../../scripts/integrations/luxon-sync.mjs', () => ({
  getSystemWorldClock: () => null,
  isLuxonSyncRequired: () => false,
  syncWithLuxon: () => {}
}));
vi.mock('../../scripts/utils/formatting/format-utils.mjs', () => ({
  FRAMEWORK_INITIAL_DISPLAY_FORMATS: {},
  buildDisplayFormatsFromCalendar: () => ({})
}));

const bundled = {
  name: 'Test Calendar',
  metadata: { id: 'testcal', description: 'A test calendar' },
  days: { hoursPerDay: 24, minutesPerHour: 60, secondsPerMinute: 60 },
  eras: {
    first: { name: 'First Era', abbreviation: 'FE' },
    second: { name: 'Second Era', abbreviation: 'SE' }
  },
  months: {
    values: {
      jan: { name: 'January', days: 31 },
      feb: { name: 'February', days: 28 }
    }
  }
};

const clone = (obj) => JSON.parse(JSON.stringify(obj));
const settingsStore = new Map();

/** Mirror of ObjectField#reconstructOperators (fields.mjs): settings reads hand back live operators. */
function rehydrate(obj) {
  for (const [k, v] of Object.entries(obj)) {
    if (!v || typeof v !== 'object') continue;
    if (v[operators.OPERATOR_IDENTIFIER]) obj[k] = operators.reconstructOperator(v);
    else rehydrate(v);
  }
  return obj;
}

describe('bundled calendar override round trip', () => {
  beforeEach(async () => {
    settingsStore.clear();
    h.registry.clear();
    game.settings.get.mockImplementation((ns, key) => settingsStore.get(`${ns}.${key}`));
    game.settings.set.mockImplementation(async (ns, key, value) => {
      settingsStore.set(`${ns}.${key}`, value);
      return value;
    });
    Object.assign(globalThis.foundry.utils, {
      diffObject: realUtils.diffObject,
      mergeObject: realUtils.mergeObject,
      deepClone: realUtils.deepClone,
      equals: realUtils.equals
    });
    globalThis.foundry.data.operators = operators;
    globalThis._del = new operators.ForcedDeletion();
    h.registry.set('testcal', { toObject: () => clone(bundled) });
    await CalendarManager.initialize();
  });

  it('keeps deletion markers in the stored delta and strips stale defaults', async () => {
    const edited = clone(bundled);
    delete edited.eras.second;
    edited.name = 'Renamed Calendar';
    edited.metadata.description = '';
    const result = await CalendarManager.saveDefaultOverride('testcal', edited);
    expect(result).not.toBeNull();
    const delta = settingsStore.get(`${MODULE.ID}.${SETTINGS.DEFAULT_OVERRIDES}`).testcal;
    expect(delta._isDelta).toBe(true);
    expect(delta.name).toBe('Renamed Calendar');
    expect(delta.eras.second).toBeInstanceOf(operators.ForcedDeletion);
    expect(delta.eras.first).toBeUndefined();
    expect(delta.months).toBeUndefined();
    expect(delta.metadata?.description).toBeUndefined();
  });

  it('applies a stored deletion after a reload', async () => {
    const edited = clone(bundled);
    delete edited.eras.second;
    edited.name = 'Renamed Calendar';
    await CalendarManager.saveDefaultOverride('testcal', edited);
    const serialized = clone(settingsStore.get(`${MODULE.ID}.${SETTINGS.DEFAULT_OVERRIDES}`));
    expect(serialized.testcal.eras.second).toEqual({ [operators.OPERATOR_IDENTIFIER]: 'ForcedDeletion' });
    settingsStore.set(`${MODULE.ID}.${SETTINGS.DEFAULT_OVERRIDES}`, rehydrate(serialized));
    h.registry.clear();
    h.registry.set('testcal', { toObject: () => clone(bundled) });
    await CalendarManager.initialize();
    const reloaded = h.registry.get('testcal');
    expect(reloaded.name).toBe('Renamed Calendar');
    expect(reloaded.eras.second).toBeUndefined();
    expect(reloaded.eras.first).toEqual(bundled.eras.first);
    expect(reloaded.months.values.jan.days).toBe(31);
  });

  it('drops a previously deleted entry once the user re-adds it', async () => {
    const edited = clone(bundled);
    delete edited.eras.second;
    await CalendarManager.saveDefaultOverride('testcal', edited);
    await CalendarManager.saveDefaultOverride('testcal', clone(bundled));
    const delta = settingsStore.get(`${MODULE.ID}.${SETTINGS.DEFAULT_OVERRIDES}`).testcal;
    expect(delta.eras).toBeUndefined();
  });
});
