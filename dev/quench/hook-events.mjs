/**
 * Integration tests for hook event firing.
 * @param {object} quench  Quench test runner instance
 */
export function registerHookEvents(quench) {
  quench.registerBatch(
    'calendaria.integration.hook-events',
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

      /**
       * Wait for a hook to fire within a timeout period.
       * @param {string} hookName  Hook name to listen for
       * @param {Function} action  Async function that should trigger the hook
       * @param {number} [timeout]  Max wait time in ms
       * @returns {Promise<*>}  The first argument passed to the hook
       */
      function waitForHook(hookName, action, timeout = 5000) {
        return new Promise((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error(`Hook "${hookName}" did not fire within ${timeout}ms`)), timeout);
          const hookId = Hooks.once(hookName, (...args) => {
            clearTimeout(timer);
            resolve(args[0]);
          });

          action().catch((err) => {
            clearTimeout(timer);
            Hooks.off(hookName, hookId);
            reject(err);
          });
        });
      }

      describe('Hook Events', function () {
        it('dateTimeChange hook fires on advanceTime', async function () {
          const hooks = api.hooks;
          const hookName = hooks?.DATE_TIME_CHANGE;
          if (!hookName) {
            this.skip();
            return;
          }

          const payload = await waitForHook(hookName, () => api.advanceTime(60));
          // Payload should be non-null
          assert.isNotNull(payload, 'Hook payload should not be null');
        });

        it('dayChange hook fires on advanceTime(86400)', async function () {
          const hooks = api.hooks;
          const hookName = hooks?.DAY_CHANGE;
          if (!hookName) {
            this.skip();
            return;
          }

          // Advance to midnight first to ensure a day boundary is crossed
          await api.advanceTimeToPreset('midnight');
          const payload = await waitForHook(hookName, () => api.advanceTime(86400));
          assert.isNotNull(payload, 'Day change hook payload should not be null');
        });

        it('weatherChange hook fires on setWeather', async function () {
          const hooks = api.hooks;
          const hookName = hooks?.WEATHER_CHANGE;
          if (!hookName) {
            this.skip();
            return;
          }

          const payload = await waitForHook(hookName, () => api.setWeather('rain'));
          assert.isNotNull(payload, 'Weather change hook payload should not be null');
        });

        it('hook payload contains expected data', async function () {
          const hooks = api.hooks;
          const hookName = hooks?.DATE_TIME_CHANGE;
          if (!hookName) {
            this.skip();
            return;
          }

          const payload = await waitForHook(hookName, () => api.advanceTime(60));
          assert.typeOf(payload, 'object', 'Hook payload should be an object');
        });
      });
    },
    { displayName: 'Calendaria: Hook Events' }
  );
}
