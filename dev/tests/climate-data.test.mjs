/**
 * Tests for climate-data.mjs
 * Covers: temperature conversions, data integrity, getDefaultZoneConfig, normalizeSeasonName.
 * @module Tests/ClimateData
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('../../scripts/utils/localization.mjs', () => ({
  localize: vi.fn((key) => key),
  format: vi.fn((key) => key)
}));
vi.mock('../../scripts/constants.mjs', () => ({
  MODULE: { ID: 'calendaria' },
  SETTINGS: { TEMPERATURE_UNIT: 'temperatureUnit' }
}));

import {
  celsiusToFahrenheit,
  fahrenheitToCelsius,
  toDisplayUnit,
  fromDisplayUnit,
  toDisplayDelta,
  fromDisplayDelta,
  CLIMATE_ZONE_TEMPLATES,
  getClimateZoneTemplate,
  getClimateZoneTemplateIds,
  getDefaultZoneConfig,
  normalizeSeasonName,
  getClimateTemplateOptions
} from '../../scripts/weather/data/climate-data.mjs';
import { ALL_PRESETS } from '../../scripts/weather/data/weather-presets.mjs';

/* -------------------------------------------- */
/*  Temperature Conversions                      */
/* -------------------------------------------- */

describe('celsiusToFahrenheit()', () => {
  it('converts 0°C to 32°F', () => expect(celsiusToFahrenheit(0)).toBe(32));
  it('converts 100°C to 212°F', () => expect(celsiusToFahrenheit(100)).toBe(212));
  it('converts -40°C to -40°F', () => expect(celsiusToFahrenheit(-40)).toBe(-40));
  it('converts 20°C to 68°F', () => expect(celsiusToFahrenheit(20)).toBe(68));
});

describe('fahrenheitToCelsius()', () => {
  it('converts 32°F to 0°C', () => expect(fahrenheitToCelsius(32)).toBe(0));
  it('converts 212°F to 100°C', () => expect(fahrenheitToCelsius(212)).toBe(100));
  it('converts -40°F to -40°C', () => expect(fahrenheitToCelsius(-40)).toBe(-40));
});

describe('toDisplayUnit()', () => {
  it('returns Celsius when unit is Celsius', () => {
    game.settings.get.mockReturnValue('celsius');
    expect(toDisplayUnit(20)).toBe(20);
  });

  it('converts to Fahrenheit when unit is Fahrenheit', () => {
    game.settings.get.mockReturnValue('fahrenheit');
    expect(toDisplayUnit(20)).toBe(68);
  });

  it('returns null for null input', () => {
    expect(toDisplayUnit(null)).toBeNull();
  });
});

describe('fromDisplayUnit()', () => {
  it('returns value unchanged in Celsius mode', () => {
    game.settings.get.mockReturnValue('celsius');
    expect(fromDisplayUnit(20)).toBe(20);
  });

  it('converts from Fahrenheit when in Fahrenheit mode', () => {
    game.settings.get.mockReturnValue('fahrenheit');
    expect(fromDisplayUnit(68)).toBe(20);
  });

  it('returns null for null input', () => {
    expect(fromDisplayUnit(null)).toBeNull();
  });
});

describe('toDisplayDelta()', () => {
  it('returns Celsius delta unchanged', () => {
    game.settings.get.mockReturnValue('celsius');
    expect(toDisplayDelta(10)).toBe(10);
  });

  it('converts delta to Fahrenheit scale', () => {
    game.settings.get.mockReturnValue('fahrenheit');
    expect(toDisplayDelta(10)).toBe(18);
  });

  it('returns null for null', () => {
    expect(toDisplayDelta(null)).toBeNull();
  });
});

describe('fromDisplayDelta()', () => {
  it('returns Celsius delta unchanged', () => {
    game.settings.get.mockReturnValue('celsius');
    expect(fromDisplayDelta(10)).toBe(10);
  });

  it('converts from Fahrenheit delta scale', () => {
    game.settings.get.mockReturnValue('fahrenheit');
    expect(fromDisplayDelta(18)).toBe(10);
  });

  it('returns null for null', () => {
    expect(fromDisplayDelta(null)).toBeNull();
  });
});

/* -------------------------------------------- */
/*  Climate Zone Templates — Data Integrity      */
/* -------------------------------------------- */

describe('CLIMATE_ZONE_TEMPLATES', () => {
  const templateIds = ['arctic', 'subarctic', 'temperate', 'subtropical', 'tropical', 'arid', 'polar'];

  it('has all expected templates', () => {
    for (const id of templateIds) {
      expect(CLIMATE_ZONE_TEMPLATES, `Missing template: ${id}`).toHaveProperty(id);
    }
  });

  it('all templates have required fields', () => {
    for (const [id, template] of Object.entries(CLIMATE_ZONE_TEMPLATES)) {
      expect(template.id, `${id} missing id`).toBe(id);
      expect(template.name, `${id} missing name`).toBeDefined();
      expect(template.description, `${id} missing description`).toBeDefined();
      expect(template.temperatures, `${id} missing temperatures`).toBeDefined();
      expect(template.temperatures._default, `${id} missing default temperatures`).toBeDefined();
      expect(template.weather, `${id} missing weather`).toBeDefined();
      expect(template.windSpeedRange, `${id} missing windSpeedRange`).toBeDefined();
      expect(typeof template.brightnessMultiplier, `${id} brightnessMultiplier not number`).toBe('number');
    }
  });

  it('all weather entries reference valid preset IDs', () => {
    const validIds = new Set(ALL_PRESETS.map((p) => p.id));
    for (const [templateId, template] of Object.entries(CLIMATE_ZONE_TEMPLATES)) {
      for (const [season, presets] of Object.entries(template.weather)) {
        for (const presetId of Object.keys(presets)) {
          expect(validIds.has(presetId), `${templateId}.weather.${season} references unknown preset "${presetId}"`).toBe(true);
        }
      }
    }
  });

  it('all templates have valid windSpeedRange', () => {
    for (const [id, template] of Object.entries(CLIMATE_ZONE_TEMPLATES)) {
      expect(template.windSpeedRange.min, `${id} windSpeedRange.min`).toBeLessThanOrEqual(template.windSpeedRange.max);
    }
  });
});

/* -------------------------------------------- */
/*  Lookup functions                             */
/* -------------------------------------------- */

describe('getClimateZoneTemplate()', () => {
  it('returns template by ID', () => {
    const template = getClimateZoneTemplate('temperate');
    expect(template).not.toBeNull();
    expect(template.id).toBe('temperate');
  });

  it('returns null for unknown ID', () => {
    expect(getClimateZoneTemplate('unknown')).toBeNull();
  });
});

describe('getClimateZoneTemplateIds()', () => {
  it('returns all template IDs', () => {
    const ids = getClimateZoneTemplateIds();
    expect(ids).toContain('arctic');
    expect(ids).toContain('temperate');
    expect(ids).toContain('tropical');
  });
});

describe('getClimateTemplateOptions()', () => {
  it('returns options with value and label', () => {
    const options = getClimateTemplateOptions();
    expect(options.length).toBe(Object.keys(CLIMATE_ZONE_TEMPLATES).length);
    for (const opt of options) {
      expect(opt).toHaveProperty('value');
      expect(opt).toHaveProperty('label');
    }
  });
});

/* -------------------------------------------- */
/*  normalizeSeasonName                          */
/* -------------------------------------------- */

describe('normalizeSeasonName()', () => {
  it('normalizes spring variants', () => {
    expect(normalizeSeasonName('Spring')).toBe('spring');
    expect(normalizeSeasonName('CALENDARIA.Season.Spring')).toBe('spring');
    expect(normalizeSeasonName('Vernal')).toBe('spring');
  });

  it('normalizes summer variants', () => {
    expect(normalizeSeasonName('Summer')).toBe('summer');
    expect(normalizeSeasonName('Estival')).toBe('summer');
  });

  it('normalizes autumn variants', () => {
    expect(normalizeSeasonName('Autumn')).toBe('autumn');
    expect(normalizeSeasonName('Fall')).toBe('autumn');
    expect(normalizeSeasonName('Autumnal')).toBe('autumn');
  });

  it('normalizes winter variants', () => {
    expect(normalizeSeasonName('Winter')).toBe('winter');
    expect(normalizeSeasonName('Hibernal')).toBe('winter');
  });

  it('returns default for unknown season', () => {
    expect(normalizeSeasonName('Monsoon')).toBe('default');
  });

  it('returns default for null/empty', () => {
    expect(normalizeSeasonName(null)).toBe('default');
    expect(normalizeSeasonName('')).toBe('default');
  });
});

/* -------------------------------------------- */
/*  getDefaultZoneConfig                         */
/* -------------------------------------------- */

describe('getDefaultZoneConfig()', () => {
  it('returns null for unknown template', () => {
    expect(getDefaultZoneConfig('nonexistent')).toBeNull();
  });

  it('returns config with required fields', () => {
    game.settings.get.mockReturnValue('celsius');
    const config = getDefaultZoneConfig('temperate');
    expect(config).not.toBeNull();
    expect(config.id).toBe('temperate');
    expect(config.temperatures).toBeDefined();
    expect(config.temperatures._default).toBeDefined();
    expect(config.presets).toBeDefined();
    expect(Array.isArray(config.presets)).toBe(true);
  });

  it('populates presets from ALL_PRESETS', () => {
    game.settings.get.mockReturnValue('celsius');
    const config = getDefaultZoneConfig('temperate');
    expect(config.presets.length).toBe(ALL_PRESETS.length);
  });

  it('marks presets with weight > 0 as enabled', () => {
    game.settings.get.mockReturnValue('celsius');
    const config = getDefaultZoneConfig('temperate');
    const enabledPresets = config.presets.filter((p) => p.enabled);
    expect(enabledPresets.length).toBeGreaterThan(0);
  });

  it('generates season overrides', () => {
    game.settings.get.mockReturnValue('celsius');
    const config = getDefaultZoneConfig('temperate');
    expect(config.seasonOverrides).toBeDefined();
  });

  it('accepts custom season names', () => {
    game.settings.get.mockReturnValue('celsius');
    const config = getDefaultZoneConfig('temperate', ['Spring', 'Summer']);
    expect(config).not.toBeNull();
  });
});
