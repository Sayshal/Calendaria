import { vi } from 'vitest';

const WeatherManager = {
  getActiveZone: vi.fn(() => null),
  getCurrentWeather: vi.fn(() => null),
  getWeatherForDate: vi.fn(() => null),
  getCalendarZones: vi.fn(() => []),
  setSceneZoneOverride: vi.fn(),
  addCustomPreset: vi.fn(),
  initialize: vi.fn(),
  onUpdateWorldTime: vi.fn(),
  generateWeather: vi.fn()
};

export default WeatherManager;
