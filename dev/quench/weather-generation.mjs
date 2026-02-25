/**
 * Integration tests for weather generation.
 * @param {object} quench  Quench test runner instance
 */
export function registerWeatherGeneration(quench) {
  quench.registerBatch(
    'calendaria.integration.weather-generation',
    (context) => {
      const { describe, it, assert, before, after } = context;

      let api;
      let originalWeather;

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
      });

      describe('Weather Generation', function () {
        it('should generate weather', async function () {
          const calendar = api.getActiveCalendar();
          if (!calendar) {
            this.skip();
            return;
          }

          const result = await api.generateWeather();
          assert.isNotNull(result, 'generateWeather should return a result');
        });

        it('should return current weather after generation', async function () {
          const calendar = api.getActiveCalendar();
          if (!calendar) {
            this.skip();
            return;
          }

          await api.generateWeather();
          const weather = api.getCurrentWeather();
          assert.isNotNull(weather, 'getCurrentWeather should return non-null after generation');
        });

        it('should set weather to a specific preset', async function () {
          const result = await api.setWeather('clear');
          assert.isNotNull(result, 'setWeather should return a result');

          const weather = api.getCurrentWeather();
          assert.isNotNull(weather);
          assert.strictEqual(weather.id, 'clear');
        });

        it('should clear weather', async function () {
          await api.setWeather('clear');
          await api.clearWeather();
          const weather = api.getCurrentWeather();
          assert.isNull(weather, 'Weather should be null after clearing');
        });

        it('should return a weather forecast array', function () {
          const forecast = api.getWeatherForecast();
          assert.isArray(forecast, 'getWeatherForecast should return an array');
        });
      });
    },
    { displayName: 'Calendaria: Weather Generation' }
  );
}
