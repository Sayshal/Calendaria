import { vi } from 'vitest';

export const CalendariaSocket = {
  isPrimaryGM: vi.fn(() => true),
  emit: vi.fn()
};
