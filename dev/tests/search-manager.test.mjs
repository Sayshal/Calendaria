/**
 * Tests for search-manager.mjs
 * Covers: search by name, content, category: prefix, limit, min length.
 * @module Tests/SearchManager
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: vi.fn((key) => key),
  format: vi.fn((key, data) => {
    let result = key;
    for (const [k, v] of Object.entries(data || {})) result = result.replace(`{${k}}`, String(v));
    return result;
  })
}));
vi.mock('../../scripts/constants.mjs', () => ({
  MODULE: { ID: 'calendaria' },
  SETTINGS: { CUSTOM_CATEGORIES: 'customCategories' }
}));
vi.mock('../../scripts/calendar/calendar-manager.mjs', () => ({
  default: {
    getActiveCalendar: vi.fn(() => ({
      monthsArray: [{ name: 'January' }, { name: 'February' }]
    }))
  }
}));
vi.mock('../../scripts/notes/note-manager.mjs', () => ({
  default: {
    getAllNotes: vi.fn(() => []),
    getFullNote: vi.fn(() => null)
  }
}));
vi.mock('../../scripts/notes/note-data.mjs', () => ({
  getAllCategories: vi.fn(() => [
    { id: 'quest', label: 'Quest', color: '#4a9eff', icon: 'fa-scroll' },
    { id: 'holiday', label: 'Holiday', color: '#ff6b6b', icon: 'fa-gift' }
  ])
}));

import SearchManager from '../../scripts/utils/search-manager.mjs';
import NoteManager from '../../scripts/notes/note-manager.mjs';

const makeNote = (id, name, flagData = {}) => ({
  id,
  name,
  visible: true,
  flagData: { startDate: { year: 1, month: 0, day: 1 }, ...flagData },
  journalId: `journal-${id}`
});

beforeEach(() => {
  NoteManager.getAllNotes.mockReturnValue([]);
  NoteManager.getFullNote.mockReturnValue(null);
  game.settings.get.mockReturnValue([]);
});

/* -------------------------------------------- */
/*  Basic search behavior                        */
/* -------------------------------------------- */

describe('SearchManager.search()', () => {
  it('returns empty for empty/null term', () => {
    expect(SearchManager.search('')).toEqual([]);
    expect(SearchManager.search(null)).toEqual([]);
  });

  it('returns empty for term shorter than 2 characters', () => {
    expect(SearchManager.search('a')).toEqual([]);
  });

  it('returns empty for whitespace-only term', () => {
    expect(SearchManager.search('  ')).toEqual([]);
  });

  it('matches note by name', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Dragon Attack')]);
    const results = SearchManager.search('dragon');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Dragon Attack');
  });

  it('is case-insensitive', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Dragon Attack')]);
    expect(SearchManager.search('DRAGON')).toHaveLength(1);
    expect(SearchManager.search('dragon')).toHaveLength(1);
  });

  it('matches partial name', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Dragon Attack')]);
    expect(SearchManager.search('rag')).toHaveLength(1);
  });

  it('does not match non-matching notes', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Dragon Attack')]);
    expect(SearchManager.search('goblin')).toHaveLength(0);
  });

  it('returns multiple matches', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Dragon Attack'), makeNote('2', 'Red Dragon Lair'), makeNote('3', 'Goblin Camp')]);
    expect(SearchManager.search('dragon')).toHaveLength(2);
  });
});

/* -------------------------------------------- */
/*  Content search                               */
/* -------------------------------------------- */

describe('SearchManager.search() — content', () => {
  it('matches note by content when searchContent enabled', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Battle Log')]);
    NoteManager.getFullNote.mockReturnValue({ text: { content: '<p>The dragon breathed fire</p>' } });
    const results = SearchManager.search('breathed');
    expect(results).toHaveLength(1);
  });

  it('does not search content when searchContent disabled', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Battle Log')]);
    NoteManager.getFullNote.mockReturnValue({ text: { content: '<p>The dragon breathed fire</p>' } });
    const results = SearchManager.search('breathed', { searchContent: false });
    expect(results).toHaveLength(0);
  });

  it('extracts snippet around match', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Battle Log')]);
    NoteManager.getFullNote.mockReturnValue({
      text: { content: 'Lorem ipsum dolor sit amet, the ancient dragon appeared in the sky above the village' }
    });
    const results = SearchManager.search('dragon');
    expect(results[0].description).toContain('dragon');
  });
});

/* -------------------------------------------- */
/*  Category prefix search                       */
/* -------------------------------------------- */

describe('SearchManager.search() — category:', () => {
  it('finds notes by category name', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Find the Sword', { categories: ['quest'] }), makeNote('2', 'Town Festival', { categories: ['holiday'] })]);
    const results = SearchManager.search('category:quest');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Find the Sword');
  });

  it('returns empty for unmatched category', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Note', { categories: ['quest'] })]);
    const results = SearchManager.search('category:combat');
    expect(results).toHaveLength(0);
  });

  it('returns empty for empty category name', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Note', { categories: ['quest'] })]);
    const results = SearchManager.search('category:');
    expect(results).toHaveLength(0);
  });

  it('matches category labels by name when searching without prefix', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Festival Note', { categories: ['holiday'] })]);
    // "holiday" matches the category label, so the note should appear
    const results = SearchManager.search('holiday');
    expect(results).toHaveLength(1);
  });
});

/* -------------------------------------------- */
/*  Limit and filtering                          */
/* -------------------------------------------- */

describe('SearchManager.search() — limits', () => {
  it('respects limit option', () => {
    const notes = Array.from({ length: 100 }, (_, i) => makeNote(`${i}`, `Dragon Note ${i}`));
    NoteManager.getAllNotes.mockReturnValue(notes);
    const results = SearchManager.search('dragon', { limit: 5 });
    expect(results).toHaveLength(5);
  });

  it('defaults to 50 results', () => {
    const notes = Array.from({ length: 100 }, (_, i) => makeNote(`${i}`, `Dragon Note ${i}`));
    NoteManager.getAllNotes.mockReturnValue(notes);
    const results = SearchManager.search('dragon');
    expect(results).toHaveLength(50);
  });

  it('skips non-visible notes', () => {
    const notes = [{ ...makeNote('1', 'Dragon'), visible: false }, makeNote('2', 'Dragon Keep')];
    NoteManager.getAllNotes.mockReturnValue(notes);
    const results = SearchManager.search('dragon');
    expect(results).toHaveLength(1);
    expect(results[0].name).toBe('Dragon Keep');
  });
});

/* -------------------------------------------- */
/*  Result structure                             */
/* -------------------------------------------- */

describe('SearchManager.search() — result structure', () => {
  it('returns results with expected fields', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Dragon Attack', { icon: 'fa-dragon', color: '#ff0000' })]);
    const results = SearchManager.search('dragon');
    expect(results[0]).toHaveProperty('type', 'note');
    expect(results[0]).toHaveProperty('id', '1');
    expect(results[0]).toHaveProperty('name', 'Dragon Attack');
    expect(results[0]).toHaveProperty('description');
    expect(results[0]).toHaveProperty('data');
    expect(results[0].data).toHaveProperty('journalId');
  });

  it('includes repeat icon data', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Daily Task', { repeat: 'daily' })]);
    const results = SearchManager.search('daily');
    expect(results[0].data.repeatIcon).toBe('fas fa-rotate');
  });

  it('includes category icons', () => {
    NoteManager.getAllNotes.mockReturnValue([makeNote('1', 'Quest Note', { categories: ['quest'] })]);
    const results = SearchManager.search('quest');
    expect(results[0].data.categoryIcons.length).toBeGreaterThan(0);
  });
});
