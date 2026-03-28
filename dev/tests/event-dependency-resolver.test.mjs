import { describe, expect, it, vi } from 'vitest';
import { topologicalSortNotes } from '../../scripts/notes/event-dependency-resolver.mjs';

vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: (key) => key,
  format: (key, data) => {
    let result = key;
    for (const [k, v] of Object.entries(data || {})) result = result.replace(`{${k}}`, String(v));
    return result;
  }
}));
vi.mock('../../scripts/notes/note-manager.mjs', () => ({
  default: { getAllNotes: () => [] }
}));

const makePage = (id, connectedEvents = []) => ({ id, name: `Page ${id}`, system: { connectedEvents } });

describe('topologicalSortNotes()', () => {
  it('returns empty array unchanged', () => {
    expect(topologicalSortNotes([])).toEqual([]);
  });
  it('returns single page unchanged', () => {
    const pages = [makePage('a')];
    expect(topologicalSortNotes(pages)).toEqual(pages);
  });
  it('returns pages unchanged when none have connectedEvents', () => {
    const pages = [makePage('a'), makePage('b'), makePage('c')];
    const result = topologicalSortNotes(pages);
    expect(result).toEqual(pages);
  });
  it('sorts a simple A→B chain (B depends on A)', () => {
    const a = makePage('a');
    const b = makePage('b', ['a']);
    const result = topologicalSortNotes([b, a]);
    const ids = result.map((p) => p.id);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
  });
  it('sorts a three-node chain A→B→C', () => {
    const a = makePage('a');
    const b = makePage('b', ['a']);
    const c = makePage('c', ['b']);
    const result = topologicalSortNotes([c, b, a]);
    const ids = result.map((p) => p.id);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('c'));
  });
  it('handles diamond dependency D depends on B and C, both depend on A', () => {
    const a = makePage('a');
    const b = makePage('b', ['a']);
    const c = makePage('c', ['a']);
    const d = makePage('d', ['b', 'c']);
    const result = topologicalSortNotes([d, c, b, a]);
    const ids = result.map((p) => p.id);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('c'));
    expect(ids.indexOf('b')).toBeLessThan(ids.indexOf('d'));
    expect(ids.indexOf('c')).toBeLessThan(ids.indexOf('d'));
  });
  it('skips dependencies referencing pages not in the input set', () => {
    const a = makePage('a', ['z']);
    const b = makePage('b', ['a']);
    const result = topologicalSortNotes([b, a]);
    const ids = result.map((p) => p.id);
    expect(ids).toHaveLength(2);
    expect(ids.indexOf('a')).toBeLessThan(ids.indexOf('b'));
  });
  it('appends mutual cycle participants (A↔B) in original order', () => {
    const a = makePage('a', ['b']);
    const b = makePage('b', ['a']);
    const result = topologicalSortNotes([a, b]);
    const ids = result.map((p) => p.id);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).toHaveLength(2);
    expect(ids).toEqual(['a', 'b']);
  });
  it('sorts non-cycle nodes normally and appends cycle participants', () => {
    const a = makePage('a', ['c']);
    const b = makePage('b', ['a']);
    const c = makePage('c', ['b']);
    const d = makePage('d', ['a']);
    const result = topologicalSortNotes([a, b, c, d]);
    const ids = result.map((p) => p.id);
    expect(ids).toHaveLength(4);
    expect(ids).toContain('a');
    expect(ids).toContain('b');
    expect(ids).toContain('c');
    expect(ids).toContain('d');
  });
  it('handles three-node cycle with an independent node', () => {
    const x = makePage('x');
    const a = makePage('a', ['c']);
    const b = makePage('b', ['a']);
    const c = makePage('c', ['b']);
    const result = topologicalSortNotes([a, b, c, x]);
    const ids = result.map((p) => p.id);
    expect(ids[0]).toBe('x');
    expect(ids).toHaveLength(4);
  });
  it('preserves original order for cycle participants', () => {
    const a = makePage('a', ['b']);
    const b = makePage('b', ['c']);
    const c = makePage('c', ['a']);
    const result = topologicalSortNotes([c, a, b]);
    const ids = result.map((p) => p.id);
    expect(ids).toEqual(['c', 'a', 'b']);
  });
});
