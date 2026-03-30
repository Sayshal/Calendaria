/** Quench tests for extended weather API methods. */
export function registerWeatherExtended(quench) {
  quench.registerBatch(
    'calendaria.integration.weather-extended',
    (context) => {
      const { describe, it, assert, before } = context;
      let api;
      let hasZones;

      before(function () {
        api = CALENDARIA.api;
        hasZones = (api.getCalendarZones()?.length ?? 0) > 0;
      });

      describe('Weather — Presets & Zones', function () {
        it('getWeatherPresets returns array', async function () {
          const result = await api.getWeatherPresets();
          assert.isArray(result);
        });
        it('getClimateZoneTemplates returns array', function () {
          const result = api.getClimateZoneTemplates();
          assert.isArray(result);
          if (result.length > 0) {
            assert.property(result[0], 'id');
            assert.property(result[0], 'name');
          }
        });
        it('getActiveZone returns object or null', function () {
          const result = api.getActiveZone();
          if (result != null) {
            assert.typeOf(result, 'object');
            assert.property(result, 'id');
          }
        });
      });

      describe('Weather — Intraday Periods', function () {
        it('getCurrentWeatherPeriod returns string', function () {
          const result = api.getCurrentWeatherPeriod();
          if (result == null) { this.skip(); return; }
          assert.typeOf(result, 'string');
        });
        it('getWeatherForPeriod returns object or null', function () {
          if (!hasZones) { this.skip(); return; }
          const period = api.getCurrentWeatherPeriod();
          if (!period) { this.skip(); return; }
          const result = api.getWeatherForPeriod(period);
          if (result) assert.property(result, 'name');
        });
      });

      describe('Weather — History & Forecast', function () {
        it('getWeatherHistory returns object', function () {
          const result = api.getWeatherHistory();
          assert.typeOf(result, 'object');
        });
        it('getWeatherForDate returns object or null', function () {
          if (!hasZones) { this.skip(); return; }
          const dt = api.getCurrentDateTime();
          const result = api.getWeatherForDate(dt.year, dt.month, dt.day);
          if (result) assert.property(result, 'name');
        });
        it('getWeatherProbabilities returns object', function () {
          if (!hasZones) { this.skip(); return; }
          const result = api.getWeatherProbabilities();
          assert.typeOf(result, 'object');
        });
      });

      describe('Weather — Sound & FX', function () {
        it('stopWeatherFX does not throw', function () {
          assert.doesNotThrow(() => api.stopWeatherFX());
        });
      });
    },
    { displayName: 'Calendaria: Weather Extended' }
  );
}
