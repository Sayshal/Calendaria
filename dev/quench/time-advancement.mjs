/**
 * Integration tests for time advancement.
 * @param {object} quench  Quench test runner instance
 */
export function registerTimeAdvancement(quench) {
  quench.registerBatch(
    'calendaria.integration.time-advancement',
    (context) => {
      const { describe, it, assert, before, after } = context;

      let api;
      let savedWorldTime;

      before(function () {
        api = CALENDARIA.api;
        savedWorldTime = game.time.worldTime;
      });

      after(async function () {
        // Restore original worldTime
        if (savedWorldTime !== undefined) {
          const delta = savedWorldTime - game.time.worldTime;
          if (delta !== 0) await api.advanceTime(delta);
        }
      });

      describe('Time Advancement', function () {
        it('should record current worldTime', function () {
          assert.typeOf(game.time.worldTime, 'number');
        });

        it('should advance time by 1 hour (3600s)', async function () {
          const timeBefore = game.time.worldTime;
          const result = await api.advanceTime(3600);

          assert.typeOf(result, 'number');
          assert.ok(game.time.worldTime > timeBefore, 'worldTime should have increased');
          assert.strictEqual(game.time.worldTime - timeBefore, 3600);
        });

        it('should reflect time change in getCurrentDateTime', async function () {
          const dtBefore = api.getCurrentDateTime();
          await api.advanceTime(3600);
          const dtAfter = api.getCurrentDateTime();

          // At least one time component should differ
          const changed = dtBefore.hour !== dtAfter.hour || dtBefore.dayOfMonth !== dtAfter.dayOfMonth || dtBefore.minute !== dtAfter.minute;
          assert.ok(changed, 'DateTime should reflect time advancement');
        });

        it('should advance to midday preset', async function () {
          const result = await api.advanceTimeToPreset('midday');
          assert.typeOf(result, 'number');

          const dt = api.getCurrentDateTime();
          assert.strictEqual(dt.hour, 12, 'Hour should be 12 after midday preset');
          assert.strictEqual(dt.minute, 0, 'Minute should be 0 after midday preset');
        });
      });
    },
    { displayName: 'Calendaria: Time Advancement' }
  );
}
