/**
 * Event dependency resolution: cycle detection and connectedEvents extraction.
 * @module Notes/EventDependencyResolver
 * @author Tyler
 */

import { CONDITION_FIELDS } from '../constants.mjs';
import { NoteManager } from './_module.mjs';

/**
 * Walk a condition tree and collect all referenced event note IDs.
 * @param {object|null} tree - Condition tree (group or single condition)
 * @returns {string[]} Deduplicated array of referenced note IDs
 */
export function extractEventDependencies(tree) {
  if (!tree) return [];
  const deps = new Set();
  _walkTree(tree, deps);
  return [...deps];
}

/**
 * Recursively walk a condition tree and collect EVENT field noteIds.
 * @param {object} node - Condition or group node
 * @param {Set<string>} deps - Accumulator set
 * @private
 */
function _walkTree(node, deps) {
  if (!node) return;
  if (node.type === 'group' || (node.mode && node.children)) {
    if (Array.isArray(node.children)) for (const child of node.children) _walkTree(child, deps);
    return;
  }
  if (node.field === CONDITION_FIELDS.EVENT && node.value2?.noteId) deps.add(node.value2.noteId);
}

/**
 * Detect if adding dependencies for a note would create a cycle.
 * @param {string} noteId - The note being saved
 * @param {string[]} newDeps - Proposed connectedEvents for this note
 * @returns {{ hasCycle: boolean, cycleNodes: string[] }} Cycle detection result
 */
export function detectCycles(noteId, newDeps) {
  const adjacency = new Map();
  const inDegree = new Map();
  const allNodes = new Set();
  for (const [id, noteStub] of _getNoteEntries()) {
    allNodes.add(id);
    const deps = id === noteId ? newDeps : (noteStub.flagData?.connectedEvents ?? []);
    if (!adjacency.has(id)) adjacency.set(id, []);
    for (const depId of deps) {
      allNodes.add(depId);
      if (!adjacency.has(depId)) adjacency.set(depId, []);
      adjacency.get(depId).push(id);
      inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
    }
  }
  allNodes.add(noteId);
  if (!adjacency.has(noteId)) adjacency.set(noteId, []);
  for (const depId of newDeps) {
    allNodes.add(depId);
    if (!adjacency.has(depId)) adjacency.set(depId, []);
  }
  for (const id of allNodes) if (!inDegree.has(id)) inDegree.set(id, 0);
  const queue = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
  let processed = 0;
  while (queue.length) {
    const node = queue.shift();
    processed++;
    for (const neighbor of adjacency.get(node) ?? []) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }
  if (processed === allNodes.size) return { hasCycle: false, cycleNodes: [] };
  const cycleNodes = [];
  for (const [id, deg] of inDegree) if (deg > 0) cycleNodes.push(id);
  return { hasCycle: true, cycleNodes };
}

/**
 * Sort note pages by dependency order so independent notes come first.
 * @param {object[]} pages - Array of JournalEntryPage documents
 * @returns {object[]} Sorted array (independent notes first, dependent notes later)
 */
export function topologicalSortNotes(pages) {
  if (pages.length <= 1) return pages;
  if (!pages.some((p) => p.system?.connectedEvents?.length > 0)) return pages;
  const pageMap = new Map(pages.map((p) => [p.id, p]));
  const adjacency = new Map();
  const inDegree = new Map();
  for (const page of pages) {
    const id = page.id;
    if (!adjacency.has(id)) adjacency.set(id, []);
    if (!inDegree.has(id)) inDegree.set(id, 0);
    const deps = page.system?.connectedEvents ?? [];
    for (const depId of deps) {
      if (!pageMap.has(depId)) continue;
      if (!adjacency.has(depId)) adjacency.set(depId, []);
      adjacency.get(depId).push(id);
      inDegree.set(id, (inDegree.get(id) ?? 0) + 1);
    }
  }
  const sorted = [];
  const queue = [];
  for (const [id, deg] of inDegree) if (deg === 0) queue.push(id);
  while (queue.length) {
    const id = queue.shift();
    if (pageMap.has(id)) sorted.push(pageMap.get(id));
    for (const neighbor of adjacency.get(id) ?? []) {
      const newDeg = inDegree.get(neighbor) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }
  if (sorted.length < pages.length) {
    const sortedIds = new Set(sorted.map((p) => p.id));
    for (const page of pages) if (!sortedIds.has(page.id)) sorted.push(page);
  }
  return sorted;
}

/**
 * Get all note entries from the NoteManager index.
 * @returns {Array<Array>} Array of [noteId, noteStub] pairs
 * @private
 */
function _getNoteEntries() {
  const notes = NoteManager.getAllNotes?.() ?? [];
  return notes.map((n) => [n.id, n]);
}
