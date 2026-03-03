/**
 * NoteManager mock for testing.
 * @module Mocks/NoteManager
 */

import { vi } from 'vitest';

const NoteManager = {
  getAllNotes: vi.fn(() => []),
  getNote: vi.fn(() => null),
  getFullNote: vi.fn(() => null),
  isInitialized: vi.fn(() => true),
  getCategoryDefinition: vi.fn(() => null),
  initialize: vi.fn(),
  onCalendarSwitched: vi.fn()
};

export default NoteManager;
