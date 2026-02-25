/**
 * Foundry VTT globals mock for testing.
 * @module Mocks/Foundry
 */

import { vi } from 'vitest';

// Mock game.i18n
const i18n = {
  localize: vi.fn((key) => key),
  format: vi.fn((key, data) => {
    let result = key;
    for (const [k, v] of Object.entries(data || {})) {
      result = result.replace(`{${k}}`, String(v));
    }
    return result;
  })
};

// Mock user
const user = {
  id: 'test-user',
  name: 'Test User',
  isGM: true,
  active: true
};

// Mock time
const time = {
  worldTime: 0,
  components: { year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0, second: 0 },
  advance: vi.fn()
};

// Mock settings
const settings = {
  get: vi.fn(),
  set: vi.fn(() => Promise.resolve(true)),
  register: vi.fn(),
  registerMenu: vi.fn()
};

// Mock users collection
const users = [
  { id: 'test-user', name: 'Test User', isGM: true, active: true },
  { id: 'player-1', name: 'Player 1', isGM: false, active: true },
  { id: 'player-2', name: 'Player 2', isGM: false, active: true }
];
users.filter = (fn) => Array.prototype.filter.call(users, fn);
users.map = (fn) => Array.prototype.map.call(users, fn);
users.find = (fn) => Array.prototype.find.call(users, fn);

// Mock scenes collection
const scenes = {
  active: null,
  filter: vi.fn(() => [])
};

// Mock macros collection
const macros = {
  get: vi.fn(() => null)
};

// Global game object
globalThis.game = {
  i18n,
  user,
  users,
  time,
  settings,
  scenes,
  macros,
  modules: { get: vi.fn() },
  system: { id: 'dnd5e' },
  world: { id: 'test-world' }
};

// Mock ui
globalThis.ui = {
  notifications: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
};

// Mock Hooks
globalThis.Hooks = {
  on: vi.fn(),
  once: vi.fn(),
  off: vi.fn(),
  call: vi.fn(),
  callAll: vi.fn()
};

// Mock CONFIG
globalThis.CONFIG = {};

// Mock ChatMessage
globalThis.ChatMessage = {
  create: vi.fn(() => Promise.resolve({}))
};

// Mock document.createElement (for DOM-dependent code)
if (typeof document === 'undefined') {
  globalThis.document = {
    createElement: vi.fn((tag) => ({
      tagName: tag.toUpperCase(),
      innerHTML: '',
      textContent: '',
      innerText: '',
      style: {},
      querySelector: vi.fn(() => null),
      querySelectorAll: vi.fn(() => []),
      addEventListener: vi.fn(),
      insertAdjacentHTML: vi.fn(),
      parentElement: null
    }))
  };
}

// Mock foundry namespace
globalThis.foundry = {
  utils: {
    mergeObject: vi.fn((target, source) => ({ ...target, ...source })),
    deepClone: vi.fn((obj) => JSON.parse(JSON.stringify(obj))),
    Color: {
      from: vi.fn((hex) => {
        // Simple hex to HSL mock
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
    saveDataToFile: vi.fn(),
    readTextFromFile: vi.fn()
  },
  applications: {
    handlebars: {
      renderTemplate: vi.fn(() => Promise.resolve(''))
    },
    api: {
      DialogV2: {
        wait: vi.fn(() => Promise.resolve('cancel'))
      }
    }
  }
};
