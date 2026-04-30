import { describe, expect, it, vi } from 'vitest';

vi.mock('../../scripts/utils/logger.mjs', () => ({ log: vi.fn() }));
vi.mock('../../scripts/utils/localization.mjs', () => ({ format: (k) => k, localize: (k) => k }));
vi.mock('../../scripts/utils/macro-utils.mjs', () => ({ executeMacroById: vi.fn() }));
vi.mock('../../scripts/utils/permissions.mjs', () => ({ canChangeWeather: () => true }));
vi.mock('../../scripts/utils/socket.mjs', () => ({ CalendariaSocket: { emit: vi.fn() } }));
vi.mock('../../scripts/calendar/calendar-manager.mjs', () => ({ default: { getActiveCalendar: () => null } }));
vi.mock('../../scripts/calendar/calendar-loader.mjs', () => ({ isBundledCalendar: () => false }));
vi.mock('../../scripts/weather/weather-generator.mjs', () => ({
  applyForecastVariance: vi.fn(),
  applyTempModifier: vi.fn(),
  dateSeed: vi.fn(),
  generateForecast: vi.fn(),
  generateIntradayWeather: vi.fn(),
  generateWeather: vi.fn(),
  mergeClimateConfig: vi.fn(),
  seededRandom: vi.fn()
}));
vi.mock('../../scripts/weather/data/climate-data.mjs', () => ({ CLIMATE_ZONE_TEMPLATES: {} }));
vi.mock('../../scripts/weather/data/weather-presets.mjs', () => ({
  ALL_PRESETS: [],
  expandLegacySoundKey: vi.fn(),
  getAllPresets: () => [],
  getPreset: () => null,
  WEATHER_CATEGORIES: {}
}));
const { default: WeatherManager } = await import('../../scripts/weather/weather-manager.mjs');
const baseSeason = { name: 'Winter', abbreviation: 'Wi', icon: 'fas fa-snowflake', color: '#87ceeb' };
describe('WeatherManager.applySeasonAlias', () => {
  it('returns season unchanged when zone has no aliases', () => {
    expect(WeatherManager.applySeasonAlias(baseSeason, {})).toBe(baseSeason);
    expect(WeatherManager.applySeasonAlias(baseSeason, { seasonAliases: {} })).toBe(baseSeason);
  });
  it('returns null when season is null', () => {
    expect(WeatherManager.applySeasonAlias(null, { seasonAliases: { Winter: { name: 'Cold' } } })).toBeNull();
  });
  it('returns season unchanged when no alias entry matches season name', () => {
    const zone = { seasonAliases: { Summer: { name: 'High Sun' } } };
    expect(WeatherManager.applySeasonAlias(baseSeason, zone)).toBe(baseSeason);
  });
  it('overrides name when alias name set', () => {
    const zone = { seasonAliases: { Winter: { name: 'High Sun' } } };
    const result = WeatherManager.applySeasonAlias(baseSeason, zone);
    expect(result.name).toBe('High Sun');
    expect(result.abbreviation).toBe('Wi');
    expect(result.icon).toBe('fas fa-snowflake');
    expect(result.color).toBe('#87ceeb');
  });
  it('overrides abbreviation, icon, and color independently', () => {
    const zone = { seasonAliases: { Winter: { abbreviation: 'HS', icon: 'fas fa-sun', color: '#ffd700' } } };
    const result = WeatherManager.applySeasonAlias(baseSeason, zone);
    expect(result.name).toBe('Winter');
    expect(result.abbreviation).toBe('HS');
    expect(result.icon).toBe('fas fa-sun');
    expect(result.color).toBe('#ffd700');
  });
  it('treats whitespace-only alias values as blank', () => {
    const zone = { seasonAliases: { Winter: { name: '   ', abbreviation: '\t', icon: ' ', color: '   ' } } };
    expect(WeatherManager.applySeasonAlias(baseSeason, zone)).toBe(baseSeason);
  });
  it('returns same reference when alias resolves to identical fields', () => {
    const zone = { seasonAliases: { Winter: { name: 'Winter', icon: 'fas fa-snowflake', color: '#87ceeb' } } };
    expect(WeatherManager.applySeasonAlias(baseSeason, zone)).toBe(baseSeason);
  });
  it('returns season unchanged for null/undefined zone', () => {
    expect(WeatherManager.applySeasonAlias(baseSeason, null)).toBe(baseSeason);
    expect(WeatherManager.applySeasonAlias(baseSeason, undefined)).toBe(baseSeason);
  });
  it('handles partial alias (only some fields set)', () => {
    const zone = { seasonAliases: { Winter: { name: 'High Sun' } } };
    const result = WeatherManager.applySeasonAlias(baseSeason, zone);
    expect(result.name).toBe('High Sun');
    expect(result.color).toBe('#87ceeb');
  });
});
