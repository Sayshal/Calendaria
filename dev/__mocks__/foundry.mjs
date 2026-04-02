import { vi } from 'vitest';

/** Simple localization overrides so tests that depend on resolved text pass. */
const LOCALIZE_OVERRIDES = {
  'CALENDARIA.Format.Ordinal.st': 'st',
  'CALENDARIA.Format.Ordinal.nd': 'nd',
  'CALENDARIA.Format.Ordinal.rd': 'rd',
  'CALENDARIA.Format.Ordinal.th': 'th',
  'CALENDARIA.Format.OrdinalDate': '{day} of {month}'
};

const i18n = {
  localize: vi.fn((key) => LOCALIZE_OVERRIDES[key] ?? key),
  format: vi.fn((key, data) => {
    let result = LOCALIZE_OVERRIDES[key] ?? key;
    for (const [k, v] of Object.entries(data || {})) result = result.replace(`{${k}}`, String(v));
    return result;
  })
};

const user = { id: 'test-user', name: 'Test User', isGM: true, active: true };

const time = { worldTime: 0, components: { year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0, second: 0 }, advance: vi.fn() };

const settings = {
  get: vi.fn(),
  set: vi.fn(() => Promise.resolve(true)),
  register: vi.fn(),
  registerMenu: vi.fn()
};

const users = [
  { id: 'test-user', name: 'Test User', isGM: true, active: true },
  { id: 'player-1', name: 'Player 1', isGM: false, active: true },
  { id: 'player-2', name: 'Player 2', isGM: false, active: true }
];
users.filter = (fn) => Array.prototype.filter.call(users, fn);
users.map = (fn) => Array.prototype.map.call(users, fn);
users.find = (fn) => Array.prototype.find.call(users, fn);
const scenes = { active: null, filter: vi.fn(() => []) };
const macros = { get: vi.fn(() => null) };
globalThis.game = { i18n, user, users, time, settings, scenes, macros, modules: { get: vi.fn() }, system: { id: 'dnd5e' }, world: { id: 'test-world' }, audio: { locked: false } };
globalThis.ui = { notifications: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } };
globalThis.Hooks = { on: vi.fn(), once: vi.fn(), off: vi.fn(), call: vi.fn(), callAll: vi.fn() };
globalThis.CONFIG = {};
globalThis.ChatMessage = { create: vi.fn(() => Promise.resolve({})) };

if (typeof window === 'undefined') {
  globalThis.window = { innerHeight: 800, innerWidth: 1200 };
}
if (typeof document === 'undefined') {
  globalThis.document = {
    createElement: vi.fn((tag) => ({
      tagName: tag.toUpperCase(),
      innerHTML: '',
      textContent: '',
      innerText: '',
      style: {},
      classList: { add: vi.fn(), remove: vi.fn(), contains: vi.fn(() => false) },
      dataset: {},
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      insertAdjacentHTML: vi.fn(),
      appendChild: vi.fn(),
      append: vi.fn(),
      setAttribute: vi.fn(),
      parentElement: null
    }))
  };
}

class MockDataModel {}
class MockTypeDataModel extends MockDataModel {}

globalThis.foundry = {
  abstract: {
    DataModel: MockDataModel,
    TypeDataModel: MockTypeDataModel
  },
  utils: {
    mergeObject: vi.fn((target, source) => ({ ...target, ...source })),
    flattenObject: vi.fn((obj) => {
      const flat = {};
      for (const [k, v] of Object.entries(obj || {})) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          for (const [k2, v2] of Object.entries(v)) flat[`${k}.${k2}`] = v2;
        } else flat[k] = v;
      }
      return flat;
    }),
    deepClone: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
    Color: {
      from: vi.fn((hex) => {
        const r = parseInt(hex.slice(1, 3), 16) / 255;
        const g = parseInt(hex.slice(3, 5), 16) / 255;
        const b = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(r, g, b);
        const min = Math.min(r, g, b);
        const l = (max + min) / 2;
        let h = 0;
        let s = 0;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          else if (max === g) h = ((b - r) / d + 2) / 6;
          else h = ((r - g) / d + 4) / 6;
        }
        return { hsl: [h, s, l] };
      })
    },
    randomID: vi.fn(() => 'mock-random-id'),
    saveDataToFile: vi.fn(),
    readTextFromFile: vi.fn(),
    logCompatibilityWarning: vi.fn()
  },
  data: {
    fields: {
      BooleanField: class BooleanField { constructor(opts) { this.initial = opts?.initial; } },
      ObjectField: class ObjectField { constructor(opts) { this.initial = opts?.initial; } }
    },
    CalendarData: class CalendarData {}
  },
  documents: {
    BaseUser: class BaseUser {}
  },
  applications: {
    handlebars: { renderTemplate: vi.fn(() => Promise.resolve('')) },
    instances: { get: vi.fn(() => null) },
    apps: {
      FilePicker: class FilePicker {}
    },
    api: {
      ApplicationV2: class ApplicationV2 {},
      HandlebarsApplicationMixin: (base) => base,
      DialogV2: {
        wait: vi.fn(() => Promise.resolve('cancel')),
        prompt: vi.fn(() => Promise.resolve(null))
      }
    },
    sheets: {
      journal: {
        JournalEntryPageSheet: class JournalEntryPageSheet {}
      },
      SceneConfig: class SceneConfig {
        static TABS = { sheet: { tabs: [] } };
        static DEFAULT_OPTIONS = { window: {} };
        static PARTS = {};
      }
    },
    sidebar: {
      tabs: {
        ChatLog: class ChatLog {}
      }
    },
    ux: {
      ContextMenu: {
        implementation: class MockContextMenu {
          constructor() {}
          static create() {}
        }
      },
      Draggable: {
        implementation: class MockDraggable {
          constructor() {}
        }
      },
      FormDataExtended: class FormDataExtended {
        constructor() { this.object = {}; }
      },
      TextEditor: {
        implementation: {
          enrichHTML: vi.fn((text) => Promise.resolve(text))
        }
      }
    }
  }
};
