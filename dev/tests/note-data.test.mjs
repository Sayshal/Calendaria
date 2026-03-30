import { beforeEach, describe, expect, it, vi } from 'vitest';
import { addCustomPreset, deleteCustomPreset, getAllPresets, getDefaultNoteData, getPresetDefinition, invalidatePresetCache, isCustomPreset, sanitizeNoteData, validateNoteData } from '../../scripts/notes/note-data.mjs';

vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: vi.fn((key) => key),
  format: vi.fn((key, _data) => key)
}));
vi.mock('../../scripts/constants.mjs', () => ({
  MODULE: { ID: 'calendaria' },
  SETTINGS: { CUSTOM_PRESETS: 'customPresets' },
  NOTE_VISIBILITY: { VISIBLE: 'visible', HIDDEN: 'hidden', SECRET: 'secret' },
  DISPLAY_STYLES: { ICON: 'icon', PIP: 'pip', BANNER: 'banner' },
  HOOKS: { PRESETS_CHANGED: 'calendaria.presetsChanged' }
}));
vi.mock('../../scripts/calendar/calendar-manager.mjs', () => ({
  default: {
    getActiveCalendar: vi.fn(() => ({
      monthsArray: [{ name: 'January', days: 31 }, { name: 'February', days: 28 }, { name: 'March', days: 31 }],
      years: { yearZero: 0 },
      isMonthless: false,
      getDaysInMonth: vi.fn((month) => [31, 28, 31][month] || 30),
      getDaysInYear: vi.fn(() => 365)
    }))
  }
}));
vi.mock('../../scripts/notes/date-utils.mjs', () => ({
  isValidDate: vi.fn((date) => {
    if (!date || typeof date !== 'object') return false;
    if (typeof date.year !== 'number') return false;
    if (typeof date.month !== 'number') return false;
    if (typeof date.dayOfMonth !== 'number') return false;
    return true;
  }),
  getCurrentDate: vi.fn(() => ({ year: 1, month: 0, dayOfMonth: 0, hour: 12, minute: 0 }))
}));

beforeEach(() => {
  invalidatePresetCache();
  game.settings.get.mockReturnValue([]);
  game.settings.set.mockResolvedValue(true);
  globalThis.CONFIG = {
    JournalEntryPage: { dataModels: { 'calendaria.calendarnote': { _schema: { fields: { repeat: { choices: ['never', 'daily', 'weekly', 'monthly', 'yearly', 'moon', 'random', 'linked', 'seasonal', 'weekOfMonth', 'range'] } } } } } }
  };
});

describe('getDefaultNoteData()', () => {
  it('returns object with required fields', () => {
    const data = getDefaultNoteData();
    expect(data).toHaveProperty('startDate');
    expect(data).toHaveProperty('endDate', null);
    expect(data).toHaveProperty('allDay', false);
    expect(data).toHaveProperty('repeat', 'never');
    expect(data).toHaveProperty('categories');
    expect(data).toHaveProperty('color');
    expect(data).toHaveProperty('icon');
    expect(data).toHaveProperty('isCalendarNote', true);
  });
  it('uses current game time for startDate', () => {
    game.time.components = { year: 5, month: 3, dayOfMonth: 10, hour: 14, minute: 30 };
    const data = getDefaultNoteData();
    expect(data.startDate.year).toBe(5);
    expect(data.startDate.month).toBe(3);
    expect(data.startDate.dayOfMonth).toBe(10);
    expect(data.startDate.hour).toBe(14);
    expect(data.startDate.minute).toBe(30);
  });
  it('sets visibility based on user.isGM', () => {
    game.user.isGM = true;
    expect(getDefaultNoteData().visibility).toBe('hidden');
    game.user.isGM = false;
    expect(getDefaultNoteData().visibility).toBe('visible');
    game.user.isGM = true;
  });
});

describe('validateNoteData()', () => {
  const validNote = { startDate: { year: 1, month: 0, dayOfMonth: 0 }, allDay: true, repeat: 'never', categories: ['quest'], color: '#4a9eff' };
  it('validates a correct note', () => {
    const result = validateNoteData(validNote);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
  it('rejects null note data', () => {
    const result = validateNoteData(null);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Note data is required');
  });
  it('rejects missing startDate', () => {
    const result = validateNoteData({});
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Start date is required');
  });
  it('rejects invalid startDate', () => {
    const result = validateNoteData({ startDate: 'bad' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Start date is invalid');
  });
  it('rejects invalid endDate', () => {
    const result = validateNoteData({ ...validNote, endDate: 'bad' });
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('End date is invalid');
  });
  it('accepts valid endDate', () => {
    const result = validateNoteData({ ...validNote, endDate: { year: 1, month: 0, dayOfMonth: 4 } });
    expect(result.valid).toBe(true);
  });
  it('rejects non-boolean allDay', () => {
    const result = validateNoteData({ ...validNote, allDay: 'yes' });
    expect(result.valid).toBe(false);
  });
  it('rejects invalid repeat value', () => {
    const result = validateNoteData({ ...validNote, repeat: 'biweekly' });
    expect(result.valid).toBe(false);
  });
  it('accepts valid repeat values', () => {
    for (const repeat of ['never', 'daily', 'weekly', 'monthly', 'yearly', 'moon', 'random']) {
      const result = validateNoteData({ ...validNote, repeat });
      expect(result.valid, `repeat=${repeat} should be valid`).toBe(true);
    }
  });
  it('rejects negative weekday', () => {
    const result = validateNoteData({ ...validNote, weekday: -1 });
    expect(result.valid).toBe(false);
  });
  it('accepts valid weekday', () => {
    const result = validateNoteData({ ...validNote, weekday: 3 });
    expect(result.valid).toBe(true);
  });
  it('rejects non-number weekday', () => {
    const result = validateNoteData({ ...validNote, weekday: 'Monday' });
    expect(result.valid).toBe(false);
  });
  it('accepts null weekday', () => {
    const result = validateNoteData({ ...validNote, weekday: null });
    expect(result.valid).toBe(true);
  });
  it('rejects negative seasonIndex', () => {
    const result = validateNoteData({ ...validNote, seasonIndex: -1 });
    expect(result.valid).toBe(false);
  });
  it('rejects zero weekNumber', () => {
    const result = validateNoteData({ ...validNote, weekNumber: 0 });
    expect(result.valid).toBe(false);
  });
  it('rejects negative repeatInterval', () => {
    const result = validateNoteData({ ...validNote, repeatInterval: 0 });
    expect(result.valid).toBe(false);
  });
  it('rejects non-array moonConditions', () => {
    const result = validateNoteData({ ...validNote, moonConditions: 'bad' });
    expect(result.valid).toBe(false);
  });
  it('validates moonConditions entries', () => {
    const result = validateNoteData({ ...validNote, moonConditions: [{ moonIndex: -1, phaseStart: 0.5, phaseEnd: 1.0 }] });
    expect(result.valid).toBe(false);
  });
  it('accepts valid moonConditions', () => {
    const result = validateNoteData({ ...validNote, moonConditions: [{ moonIndex: 0, phaseStart: 0.0, phaseEnd: 0.5 }] });
    expect(result.valid).toBe(true);
  });
  it('rejects moonConditions with out-of-range phaseStart', () => {
    const result = validateNoteData({ ...validNote, moonConditions: [{ moonIndex: 0, phaseStart: 1.5, phaseEnd: 0.5 }] });
    expect(result.valid).toBe(false);
  });
  it('rejects invalid linkedEvent', () => {
    const result = validateNoteData({ ...validNote, linkedEvent: 'bad' });
    expect(result.valid).toBe(false);
  });
  it('rejects linkedEvent without noteId', () => {
    const result = validateNoteData({ ...validNote, linkedEvent: { noteId: '', offset: 1 } });
    expect(result.valid).toBe(false);
  });
  it('accepts valid linkedEvent', () => {
    const result = validateNoteData({ ...validNote, linkedEvent: { noteId: 'abc123', offset: 5 } });
    expect(result.valid).toBe(true);
  });
  it('rejects invalid rangePattern field types', () => {
    const result = validateNoteData({ ...validNote, rangePattern: { year: 'bad' } });
    expect(result.valid).toBe(false);
  });
  it('accepts rangePattern with number values', () => {
    const result = validateNoteData({ ...validNote, rangePattern: { year: 2024 } });
    expect(result.valid).toBe(true);
  });
  it('accepts rangePattern with [min, max] arrays', () => {
    const result = validateNoteData({ ...validNote, rangePattern: { month: [0, 5] } });
    expect(result.valid).toBe(true);
  });
  it('rejects rangePattern with invalid array', () => {
    const result = validateNoteData({ ...validNote, rangePattern: { month: [0] } });
    expect(result.valid).toBe(false);
  });
  it('rejects non-array categories', () => {
    const result = validateNoteData({ ...validNote, categories: 'quest' });
    expect(result.valid).toBe(false);
  });
  it('rejects categories with non-string entries', () => {
    const result = validateNoteData({ ...validNote, categories: [123] });
    expect(result.valid).toBe(false);
  });
  it('rejects invalid hex color', () => {
    const result = validateNoteData({ ...validNote, color: 'red' });
    expect(result.valid).toBe(false);
  });
  it('rejects short hex color', () => {
    const result = validateNoteData({ ...validNote, color: '#fff' });
    expect(result.valid).toBe(false);
  });
  it('accepts valid hex color', () => {
    const result = validateNoteData({ ...validNote, color: '#FF00AA' });
    expect(result.valid).toBe(true);
  });
  it('rejects non-string icon', () => {
    const result = validateNoteData({ ...validNote, icon: 123 });
    expect(result.valid).toBe(false);
  });
  it('rejects non-array remindUsers', () => {
    const result = validateNoteData({ ...validNote, remindUsers: 'user1' });
    expect(result.valid).toBe(false);
  });
  it('rejects remindUsers with non-string entries', () => {
    const result = validateNoteData({ ...validNote, remindUsers: [123] });
    expect(result.valid).toBe(false);
  });
  it('rejects non-number reminderOffset', () => {
    const result = validateNoteData({ ...validNote, reminderOffset: '5' });
    expect(result.valid).toBe(false);
  });
  it('rejects non-string macro', () => {
    const result = validateNoteData({ ...validNote, macro: 123 });
    expect(result.valid).toBe(false);
  });
  it('rejects non-string sceneId', () => {
    const result = validateNoteData({ ...validNote, sceneId: 123 });
    expect(result.valid).toBe(false);
  });
  it('collects multiple errors', () => {
    const result = validateNoteData({ allDay: 'bad', repeat: 'bad', categories: 'bad' });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(2);
  });
});

describe('sanitizeNoteData()', () => {
  it('fills in defaults for missing fields', () => {
    const result = sanitizeNoteData({});
    expect(result.allDay).toBe(false);
    expect(result.repeat).toBe('never');
    expect(result.repeatInterval).toBe(1);
    expect(result.isCalendarNote).toBe(true);
    expect(result.categories).toEqual([]);
  });
  it('preserves provided values', () => {
    const result = sanitizeNoteData({ allDay: true, repeat: 'daily', categories: ['quest'] });
    expect(result.allDay).toBe(true);
    expect(result.repeat).toBe('daily');
    expect(result.categories).toEqual(['quest']);
  });
  it('normalizes non-array moonConditions to default', () => {
    const result = sanitizeNoteData({ moonConditions: 'bad' });
    expect(result.moonConditions).toEqual([]);
  });
  it('preserves valid moonConditions array', () => {
    const conditions = [{ moonIndex: 0, phaseStart: 0, phaseEnd: 0.5 }];
    const result = sanitizeNoteData({ moonConditions: conditions });
    expect(result.moonConditions).toEqual(conditions);
  });
  it('sets endDate to null when missing', () => {
    expect(sanitizeNoteData({}).endDate).toBeNull();
  });
  it('sets macro to null when missing', () => {
    expect(sanitizeNoteData({}).macro).toBeNull();
  });
});

describe('getAllPresets()', () => {
  it('combines built-in and custom categories', () => {
    game.settings.get.mockReturnValue([{ id: 'custom-1', label: 'Custom', color: '#aaa' }]);
    const all = getAllPresets();
    const builtinCount = all.filter((c) => c.builtin).length;
    expect(all.length).toBe(builtinCount + 1);
  });
  it('all categories have required fields', () => {
    for (const cat of getAllPresets()) {
      expect(cat).toHaveProperty('id');
      expect(cat).toHaveProperty('label');
      expect(cat).toHaveProperty('color');
      expect(cat).toHaveProperty('icon');
    }
  });
  it('includes expected built-in categories', () => {
    const ids = getAllPresets().filter((c) => c.builtin).map((c) => c.id);
    expect(ids).toContain('quest');
    expect(ids).toContain('session');
    expect(ids).toContain('birthday');
    expect(ids).toContain('deadline');
  });
});

describe('addCustomPreset()', () => {
  it('creates and saves a new category', async () => {
    game.settings.get.mockReturnValue([]);
    const result = await addCustomPreset('My Category', '#ff0000', 'fa-star');
    expect(result.id).toBe('my-category');
    expect(result.label).toBe('My Category');
    expect(result.builtin).toBe(false);
    expect(game.settings.set).toHaveBeenCalled();
  });
  it('returns existing category if ID matches', async () => {
    const result = await addCustomPreset('Quest');
    expect(result.id).toBe('quest');
    expect(game.settings.set).not.toHaveBeenCalled();
  });
  it('generates ID from label (lowercase, hyphens)', async () => {
    game.settings.get.mockReturnValue([]);
    const result = await addCustomPreset('My Special Event!');
    expect(result.id).toBe('my-special-event');
  });
});

describe('deleteCustomPreset()', () => {
  it('returns false for predefined category', async () => {
    const result = await deleteCustomPreset('holiday');
    expect(result).toBe(false);
  });
  it('returns false for non-existent custom category', async () => {
    game.settings.get.mockReturnValue([]);
    const result = await deleteCustomPreset('nonexistent');
    expect(result).toBe(false);
  });
  it('deletes custom category and saves', async () => {
    game.settings.get.mockReturnValue([{ id: 'custom-1', label: 'Custom', color: '#aaa', custom: true }]);
    const result = await deleteCustomPreset('custom-1');
    expect(result).toBe(true);
    expect(game.settings.set).toHaveBeenCalled();
  });
});

describe('isCustomPreset()', () => {
  it('returns false for predefined category', () => {
    game.settings.get.mockReturnValue([]);
    expect(isCustomPreset('holiday')).toBe(false);
  });
  it('returns true for custom category', () => {
    game.settings.get.mockReturnValue([{ id: 'my-cat', label: 'My', color: '#000' }]);
    expect(isCustomPreset('my-cat')).toBe(true);
  });
});

describe('getPresetDefinition()', () => {
  it('finds predefined category', () => {
    game.settings.get.mockReturnValue([]);
    const result = getPresetDefinition('quest');
    expect(result).not.toBeNull();
    expect(result.id).toBe('quest');
  });
  it('finds custom category', () => {
    game.settings.get.mockReturnValue([{ id: 'custom-1', label: 'Custom', color: '#aaa' }]);
    const result = getPresetDefinition('custom-1');
    expect(result).not.toBeNull();
  });
  it('returns null for unknown category', () => {
    game.settings.get.mockReturnValue([]);
    expect(getPresetDefinition('nonexistent')).toBeNull();
  });
});
