/**
 * Integration tests for clock control operations.
 * @param {object} quench  Quench test runner instance
 */
export function registerClockControls(quench) {
  quench.registerBatch(
    'calendaria.integration.clock-controls',
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

      describe('Clock Controls', function () {
        it('advanceTime(60) advances by 1 minute', async function () {
          const timeBefore = game.time.worldTime;
          await api.advanceTime(60);
          const timeAfter = game.time.worldTime;
          assert.strictEqual(timeAfter - timeBefore, 60, 'Should advance exactly 60 seconds');
        });

        it('advanceTime(-60) rewinds by 1 minute', async function () {
          const timeBefore = game.time.worldTime;
          const result = await api.advanceTime(-60);
          if (result == null) {
            this.skip();
            return;
          }
          const timeAfter = game.time.worldTime;
          assert.strictEqual(timeBefore - timeAfter, 60, 'Should rewind exactly 60 seconds');
        });

        it('advanceTime(86400) advances by exactly 1 day', async function () {
          const timeBefore = game.time.worldTime;
          await api.advanceTime(86400);
          const timeAfter = game.time.worldTime;
          assert.strictEqual(timeAfter - timeBefore, 86400, 'Should advance exactly 86400 seconds');
        });

        it('setDateTime sets specific time if supported', async function () {
          if (typeof api.setDateTime !== 'function') {
            this.skip();
            return;
          }
          await api.setDateTime({ hour: 12, minute: 0 });
          const dt = api.getCurrentDateTime();
          assert.strictEqual(dt.hour, 12, 'Hour should be 12');
          assert.strictEqual(dt.minute, 0, 'Minute should be 0');
        });

        it('advanceTimeToPreset noon sets hour to 12', async function () {
          await api.advanceTimeToPreset('midday');
          const dt = api.getCurrentDateTime();
          assert.strictEqual(dt.hour, 12, 'Hour should be 12 after midday preset');
        });

        it('multiple rapid advanceTime calls do not corrupt state', async function () {
          const timeBefore = game.time.worldTime;
          await api.advanceTime(60);
          await api.advanceTime(60);
          await api.advanceTime(60);
          const timeAfter = game.time.worldTime;
          assert.strictEqual(timeAfter - timeBefore, 180, 'Should advance exactly 180 seconds total');
        });
      });
    },
    { displayName: 'Calendaria: Clock Controls' }
  );
}
