/**
 * Advanced integration tests for weather system compositional behavior.
 * Tests presets, zones, seasons, temperatures, and custom presets.
 * @param {object} quench  Quench test runner instance
 */
export function registerWeatherAdvanced(quench) {
  quench.registerBatch(
    'calendaria.integration.weather-advanced',
    (context) => {
      const { describe, it, assert, before, after } = context;

      let api;
      let originalWeather;
      const CUSTOM_ID = 'quench-custom';

      before(function () {
        api = CALENDARIA.api;
        originalWeather = api.getCurrentWeather();
      });

      after(async function () {
        // Restore original weather state
        if (originalWeather) {
          await api.setWeather(originalWeather.id);
        } else {
          await api.clearWeather();
        }

        // Cleanup custom preset if leftover
        const preset = api.getPreset(CUSTOM_ID);
        if (preset) await api.removeWeatherPreset(CUSTOM_ID);
      });

      // ── Suite 1: Temperature Ranges ──

      describe('Temperature Ranges', function () {
        it('should generate temperature within zone season range', async function () {
          const zone = api.getActiveZone();
          const season = api.getCurrentSeason();
          if (!zone || !season) {
            this.skip();
            return;
          }

          // Find temperature range for current season or _default
          const seasonKey = season.name?.toLowerCase();
          const temps = zone.temperatures?.[seasonKey] ?? zone.temperatures?._default;
          if (!temps || temps.min == null || temps.max == null) {
            this.skip();
            return;
          }

          // Allow margin for preset temperature modifiers
          const margin = 15;
          const min = temps.min - margin;
          const max = temps.max + margin;

          for (let i = 0; i < 7; i++) {
            await api.generateWeather();
            const weather = api.getCurrentWeather();
            assert.isNotNull(weather, 'Weather should exist after generation');
            assert.isAtLeast(weather.temperature, min, `Temp ${weather.temperature} below range floor ${min}`);
            assert.isAtMost(weather.temperature, max, `Temp ${weather.temperature} above range ceiling ${max}`);
          }
        });

        it('should respect explicit temperature in setWeather', async function () {
          await api.setWeather('clear', { temperature: 5 });
          const weather = api.getCurrentWeather();
          assert.isNotNull(weather);
          assert.strictEqual(weather.temperature, 5);
        });

        it('should format temperature with degree symbol', function () {
          const f0 = api.formatTemperature(0);
          const f100 = api.formatTemperature(100);
          assert.include(f0, '°', 'Formatted temp should contain degree symbol');
          assert.include(f100, '°', 'Formatted temp should contain degree symbol');
        });

        it('should return temperature as a number', function () {
          const temp = api.getTemperature();
          if (temp == null) {
            this.skip();
            return;
          }
          assert.typeOf(temp, 'number', 'getTemperature should return a number');
        });
      });

      // ── Suite 2: Preset Properties ──

      describe('Preset Properties', function () {
        it('should preserve preset metadata on setWeather', async function () {
          await api.setWeather('rain');
          const weather = api.getCurrentWeather();
          assert.isNotNull(weather);
          assert.strictEqual(weather.id, 'rain');
          assert.typeOf(weather.icon, 'string', 'icon should be a string');
          assert.typeOf(weather.color, 'string', 'color should be a string');
          assert.typeOf(weather.category, 'string', 'category should be a string');
          assert.isNotNull(weather.precipitation, 'precipitation should exist');
        });

        it('should return built-in preset by ID', function () {
          const preset = api.getPreset('clear');
          assert.isNotNull(preset, 'clear preset should exist');
          assert.strictEqual(preset.id, 'clear');
          assert.property(preset, 'label');
          assert.property(preset, 'icon');
        });

        it('should return null for nonexistent preset', function () {
          const preset = api.getPreset('nonexistent-preset-xyz');
          assert.isNull(preset);
        });

        it('should ensure all built-in presets have required fields', async function () {
          const presets = await api.getWeatherPresets();
          assert.isArray(presets);
          assert.isAbove(presets.length, 0, 'Should have at least one preset');

          for (const preset of presets) {
            assert.property(preset, 'id', `Preset missing id`);
            assert.property(preset, 'label', `Preset ${preset.id} missing label`);
            assert.property(preset, 'icon', `Preset ${preset.id} missing icon`);
            assert.property(preset, 'color', `Preset ${preset.id} missing color`);
            assert.property(preset, 'category', `Preset ${preset.id} missing category`);
          }
        });
      });

      // ── Suite 3: Custom Presets ──

      describe('Custom Presets', function () {
        it('should support full CRUD lifecycle', async function () {
          // Create
          const created = await api.addWeatherPreset({
            id: CUSTOM_ID,
            label: 'Quench Storm',
            icon: 'fa-bolt',
            color: '#FF0000'
          });
          assert.isNotNull(created, 'addWeatherPreset should return the created preset');
          assert.strictEqual(created.id, CUSTOM_ID);

          // Read
          const fetched = api.getPreset(CUSTOM_ID);
          assert.isNotNull(fetched, 'getPreset should find custom preset');
          assert.strictEqual(fetched.label, 'Quench Storm');

          // Set as active weather
          await api.setWeather(CUSTOM_ID);
          const weather = api.getCurrentWeather();
          assert.isNotNull(weather);
          assert.strictEqual(weather.id, CUSTOM_ID);

          // Update
          const updated = await api.updateWeatherPreset(CUSTOM_ID, { label: 'Updated Storm' });
          assert.isNotNull(updated, 'updateWeatherPreset should return updated preset');
          const refetched = api.getPreset(CUSTOM_ID);
          assert.strictEqual(refetched.label, 'Updated Storm');

          // Delete
          const removed = await api.removeWeatherPreset(CUSTOM_ID);
          assert.isTrue(removed, 'removeWeatherPreset should return true');
          const gone = api.getPreset(CUSTOM_ID);
          assert.isNull(gone, 'Preset should be null after removal');
        });

        it('should not add preset with duplicate built-in ID', async function () {
          const result = await api.addWeatherPreset({
            id: 'clear',
            label: 'Dupe Clear',
            icon: 'fa-sun',
            color: '#FFFFFF'
          });
          assert.isNull(result, 'Should return null for duplicate built-in ID');
        });
      });

      // ── Suite 4: Zone Behavior ──

      describe('Zone Behavior', function () {
        it('should return active zone with expected shape', function () {
          const zone = api.getActiveZone();
          if (!zone) {
            this.skip();
            return;
          }
          assert.property(zone, 'id');
          assert.property(zone, 'name');
        });

        it('should return calendar zones as array with expected shape', function () {
          const zones = api.getCalendarZones();
          assert.isArray(zones);
          if (zones.length === 0) {
            this.skip();
            return;
          }
          for (const zone of zones) {
            assert.property(zone, 'id', 'Zone missing id');
            assert.property(zone, 'name', 'Zone missing name');
            assert.property(zone, 'temperatures', 'Zone missing temperatures');
          }
        });

        it('should support scene zone override', async function () {
          const scene = game.scenes?.active;
          if (!scene) {
            this.skip();
            return;
          }

          const zones = api.getCalendarZones();
          if (zones.length === 0) {
            this.skip();
            return;
          }

          const WeatherMgr = CALENDARIA.managers.WeatherManager;
          const MODULE_ID = 'calendaria';
          const FLAG_KEY = 'climateZoneOverride';

          // Save original flag
          const originalFlag = scene.getFlag(MODULE_ID, FLAG_KEY);

          // Set override to 'none' (disables zone weather)
          await WeatherMgr.setSceneZoneOverride(scene, null);
          const flagNone = scene.getFlag(MODULE_ID, FLAG_KEY);
          assert.strictEqual(flagNone, 'none', 'Flag should be "none" after null override');

          // Set override to first zone
          await WeatherMgr.setSceneZoneOverride(scene, zones[0].id);
          const flagZone = scene.getFlag(MODULE_ID, FLAG_KEY);
          assert.strictEqual(flagZone, zones[0].id, 'Flag should match zone ID');

          // Restore original flag
          if (originalFlag === undefined) {
            await scene.unsetFlag(MODULE_ID, FLAG_KEY);
          } else {
            await scene.setFlag(MODULE_ID, FLAG_KEY, originalFlag);
          }
        });

        it('should return climate zone templates', function () {
          const templates = api.getClimateZoneTemplates();
          assert.isArray(templates);
          assert.isAbove(templates.length, 0, 'Should have at least one template');

          for (const tpl of templates) {
            assert.property(tpl, 'id', 'Template missing id');
            assert.property(tpl, 'name', 'Template missing name');
            assert.property(tpl, 'temperatures', 'Template missing temperatures');
            assert.property(tpl, 'weather', 'Template missing weather');
          }
        });
      });

      // ── Suite 5: Weather with Explicit Options ──

      describe('Weather with Explicit Options', function () {
        it('should set custom weather with setCustomWeather', async function () {
          await api.setCustomWeather({
            label: 'Quench Custom',
            icon: 'fa-cloud',
            color: '#AABBCC',
            temperature: 15
          });
          const weather = api.getCurrentWeather();
          assert.isNotNull(weather);
          assert.strictEqual(weather.id, 'custom');
          assert.strictEqual(weather.label, 'Quench Custom');
        });

        it('should apply wind and precipitation overrides in setWeather', async function () {
          await api.setWeather('clear', {
            temperature: 20,
            wind: { speed: 3, direction: 180 },
            precipitation: { type: 'rain', intensity: 0.5 }
          });
          const weather = api.getCurrentWeather();
          assert.isNotNull(weather);
          assert.strictEqual(weather.temperature, 20);
          if (weather.wind) {
            assert.strictEqual(weather.wind.speed, 3);
            assert.strictEqual(weather.wind.direction, 180);
          }
          if (weather.precipitation) {
            assert.strictEqual(weather.precipitation.type, 'rain');
            assert.strictEqual(weather.precipitation.intensity, 0.5);
          }
        });
      });

      // ── Suite 6: Forecast Validation ──

      describe('Forecast Validation', function () {
        it('should return forecast with expected structure', function () {
          const forecast = api.getWeatherForecast({ days: 3 });
          assert.isArray(forecast);
          if (forecast.length === 0) {
            this.skip();
            return;
          }
          for (const entry of forecast) {
            assert.property(entry, 'year', 'Forecast entry missing year');
            assert.property(entry, 'month', 'Forecast entry missing month');
            assert.property(entry, 'day', 'Forecast entry missing day');
            assert.property(entry, 'preset', 'Forecast entry missing preset');
            assert.property(entry.preset, 'id', 'Forecast preset missing id');
            assert.property(entry.preset, 'label', 'Forecast preset missing label');
            assert.property(entry, 'temperature', 'Forecast entry missing temperature');
          }
        });

        it('should expose weather history API', function () {
          const rawHistory = api.getWeatherHistory();
          assert.typeOf(rawHistory, 'object', 'getWeatherHistory() should return an object');

          const dt = api.getCurrentDateTime();
          const filtered = api.getWeatherHistory({ year: dt.year });
          assert.isArray(filtered, 'getWeatherHistory({ year }) should return an array');

          const day = (dt.dayOfMonth ?? 0) + 1;
          const result = api.getWeatherForDate(dt.year, dt.month, day);
          // result may be null if no history recorded yet — just verify it doesn't throw
          if (result) {
            assert.property(result, 'id');
            assert.property(result, 'label');
          }
        });
      });

      // ── Suite 7: Season-Weather Interaction ──

      describe('Season-Weather Interaction', function () {
        it('should include season context in generated weather', async function () {
          const season = api.getCurrentSeason();
          if (!season) {
            this.skip();
            return;
          }

          const result = await api.generateWeather();
          assert.isNotNull(result);
          assert.property(result, 'season', 'Generated weather should have season field');
        });

        it('should apply darkness penalty for severe presets', async function () {
          // Try thunderstorm first, fall back to blizzard
          const presetIds = ['thunderstorm', 'blizzard', 'heavy-rain'];
          let found = false;

          for (const id of presetIds) {
            const preset = api.getPreset(id);
            if (preset && preset.darknessPenalty) {
              await api.setWeather(id);
              const weather = api.getCurrentWeather();
              assert.isNotNull(weather);
              assert.isAbove(weather.darknessPenalty, 0, `${id} should have positive darknessPenalty`);
              found = true;
              break;
            }
          }

          if (!found) this.skip();
        });
      });
    },
    { displayName: 'Calendaria: Weather Advanced' }
  );
}
