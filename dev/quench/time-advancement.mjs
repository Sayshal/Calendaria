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
          const changed = dtBefore.hour !== dtAfter.hour || dtBefore.dayOfMonth !== dtAfter.dayOfMonth || dtBefore.minute !== dtAfter.minute;
          assert.ok(changed, 'DateTime should reflect time advancement');
        });
        it('should advance time by 1 day using object form', async function () {
          const timeBefore = game.time.worldTime;
          const calendar = CALENDARIA.api.getActiveCalendar();
          const hpd = calendar?.days?.hoursPerDay ?? 24;
          const mph = calendar?.days?.minutesPerHour ?? 60;
          const spm = calendar?.days?.secondsPerMinute ?? 60;
          const expectedDelta = hpd * mph * spm;
          const result = await api.advanceTime({ day: 1 });
          assert.typeOf(result, 'number');
          assert.strictEqual(game.time.worldTime - timeBefore, expectedDelta, 'Should advance by exactly 1 day in seconds');
        });
        it('should advance time using mixed object form', async function () {
          const timeBefore = game.time.worldTime;
          const calendar = CALENDARIA.api.getActiveCalendar();
          const mph = calendar?.days?.minutesPerHour ?? 60;
          const spm = calendar?.days?.secondsPerMinute ?? 60;
          const expectedDelta = 2 * mph * spm + 30 * spm;
          const result = await api.advanceTime({ hour: 2, minute: 30 });
          assert.typeOf(result, 'number');
          assert.strictEqual(game.time.worldTime - timeBefore, expectedDelta, 'Should advance by 2h30m in seconds');
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
