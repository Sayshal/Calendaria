/**
 * Integration tests for darkness sync.
 * @param {object} quench  Quench test runner instance
 */
export function registerDarknessSync(quench) {
  quench.registerBatch(
    'calendaria.integration.darkness-sync',
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

      describe('Darkness Sync', function () {
        it('should have a numeric darkness level on the active scene', function () {
          const scene = game.scenes.active;
          if (!scene) {
            this.skip();
            return;
          }

          const darkness = scene.environment?.darknessLevel ?? scene.darkness;
          assert.typeOf(darkness, 'number', 'Darkness level should be a number');
          assert.ok(darkness >= 0 && darkness <= 1, 'Darkness should be between 0 and 1');
        });

        it('should change darkness when time advances (if sync enabled)', async function () {
          const scene = game.scenes.active;
          if (!scene) {
            this.skip();
            return;
          }

          // Check if darkness sync is enabled
          const syncEnabled = game.settings.get('calendaria', 'darknessSync');
          if (!syncEnabled) {
            this.skip();
            return;
          }

          const darknessBefore = scene.environment?.darknessLevel ?? scene.darkness;

          // Wait for scene update after advancing 12 hours
          const sceneUpdated = new Promise((resolve) => {
            Hooks.once('updateScene', () => resolve());
          });
          await api.advanceTime(43200);
          await sceneUpdated;

          const darknessAfter = scene.environment?.darknessLevel ?? scene.darkness;
          assert.typeOf(darknessAfter, 'number');
          assert.notStrictEqual(darknessBefore, darknessAfter, 'Darkness should change after a 12-hour time advance');
        });
      });
    },
    { displayName: 'Calendaria: Darkness Sync' }
  );
}
