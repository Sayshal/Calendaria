import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vitest/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptsPath = resolve(__dirname, 'scripts').replace(/\\/g, '/');

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: resolve(__dirname),
    include: ['dev/tests/**/*.test.mjs'],
    setupFiles: ['./dev/__mocks__/index.mjs'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      all: true,
      include: [`${scriptsPath}/**/*.mjs`],
      exclude: [
        '**/dev/**',
        '**/applications/**',
        '**/sheets/**',
        '**/importers/**',
        '**/integrations/**',
        '**/utils/ui/**',
        '**/utils/chat/**',
        '**/_module.mjs',
        '**/hooks.mjs',
        '**/weather/weather-manager.mjs',
        '**/weather/weather-sound.mjs',
        '**/weather/weather-picker.mjs',
        '**/notes/note-manager.mjs',
        '**/calendar/calendar-manager.mjs',
        '**/data/calendaria-calendar.mjs',
        '**/utils/socket.mjs',
        '**/utils/permissions.mjs',
        '**/utils/migrations.mjs',
        '**/utils/widget-manager.mjs',
        '**/utils/macro-utils.mjs',
        '**/time/time-clock.mjs'
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60
      }
    },
    mockReset: true,
    restoreMocks: true
  }
});
