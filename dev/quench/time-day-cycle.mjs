/**
 * Integration tests for time-of-day cycle and season queries.
 * @param {object} quench  Quench test runner instance
 */
export function registerTimeDayCycle(quench) {
  quench.registerBatch(
    'calendaria.integration.time-day-cycle',
    (context) => {
      const { describe, it, assert, before, after } = context;

      let api;
      let savedWorldTime;

      before(function () {
        api = CALENDARIA.api;
        savedWorldTime = game.time.worldTime;
      });

      after(async function () {
        if (savedWorldTime !== undefined) {
          const delta = savedWorldTime - game.time.worldTime;
          if (delta !== 0) await api.advanceTime(delta);
        }
      });

      describe('Time & Day Cycle', function () {
        it('getCurrentDateTime returns object with expected fields', function () {
          const dt = api.getCurrentDateTime();
          assert.isNotNull(dt);
          assert.typeOf(dt.year, 'number');
          assert.typeOf(dt.month, 'number');
          assert.typeOf(dt.dayOfMonth, 'number');
          assert.typeOf(dt.hour, 'number');
          assert.typeOf(dt.minute, 'number');
          assert.typeOf(dt.second, 'number');
        });

        it('advanceTime(3600) advances by 1 hour', async function () {
          const dtBefore = api.getCurrentDateTime();
          await api.advanceTime(3600);
          const dtAfter = api.getCurrentDateTime();

          const changed = dtBefore.hour !== dtAfter.hour || dtBefore.dayOfMonth !== dtAfter.dayOfMonth;
          assert.ok(changed, 'Hour or day should change after advancing 1 hour');
        });

        it('isDaytime and isNighttime are complementary', function () {
          const day = api.isDaytime();
          const night = api.isNighttime();
          assert.typeOf(day, 'boolean');
          assert.typeOf(night, 'boolean');
          assert.notStrictEqual(day, night, 'isDaytime and isNighttime should be opposite');
        });

        it('getCurrentSeason returns season object or null', function () {
          const season = api.getCurrentSeason();
          if (season == null) {
            // No seasons configured — acceptable
            return;
          }
          assert.property(season, 'name');
        });

        it('advanceTimeToPreset changes time of day', async function () {
          await api.advanceTimeToPreset('midday');
          const dt = api.getCurrentDateTime();
          assert.strictEqual(dt.hour, 12, 'Hour should be 12 after midday preset');
        });

        it('getSunrise and getSunset return numeric hours', function () {
          const sunrise = api.getSunrise();
          const sunset = api.getSunset();

          if (sunrise == null || sunset == null) {
            this.skip();
            return;
          }
          assert.typeOf(sunrise, 'number');
          assert.typeOf(sunset, 'number');
          assert.ok(sunrise < sunset, 'Sunrise should be before sunset');
        });
      });
    },
    { displayName: 'Calendaria: Time & Day Cycle' }
  );
}
