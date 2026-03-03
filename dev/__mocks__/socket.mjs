/**
 * CalendariaSocket mock for testing.
 * @module Mocks/Socket
 */

import { vi } from 'vitest';

export const CalendariaSocket = {
  isPrimaryGM: vi.fn(() => true),
  emit: vi.fn()
};
