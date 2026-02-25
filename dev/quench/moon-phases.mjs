/**
 * Integration tests for moon phase calculations.
 * @param {object} quench  Quench test runner instance
 */
export function registerMoonPhases(quench) {
  quench.registerBatch(
    'calendaria.integration.moon-phases',
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

      describe('Moon Phases', function () {
        it('getAllMoonPhases returns array', function () {
          const phases = api.getAllMoonPhases();
          assert.isArray(phases);
          if (phases.length === 0) {
            this.skip();
            return;
          }
        });

        it('each moon phase has name', function () {
          const phases = api.getAllMoonPhases();
          if (phases.length === 0) {
            this.skip();
            return;
          }

          for (const phase of phases) {
            assert.property(phase, 'name', 'Moon phase should have a name');
            assert.typeOf(phase.name, 'string');
          }
        });

        it('getMoonPhase returns phase for first moon', function () {
          const phases = api.getAllMoonPhases();
          if (phases.length === 0) {
            this.skip();
            return;
          }

          const phase = api.getMoonPhase(0);
          assert.isNotNull(phase, 'getMoonPhase(0) should return a phase');
          assert.property(phase, 'name');
        });

        it('getMoonPhasePosition returns 0-1 value', function () {
          const cal = api.getActiveCalendar();
          const moons = cal?.moonsArray;
          if (!moons || moons.length === 0) {
            this.skip();
            return;
          }

          const dt = api.getCurrentDateTime();
          const position = api.getMoonPhasePosition(moons[0], {
            year: dt.year,
            month: dt.month,
            day: dt.dayOfMonth
          });

          if (position == null) {
            this.skip();
            return;
          }
          assert.typeOf(position, 'number');
          assert.isAtLeast(position, 0, 'Position should be >= 0');
          assert.isBelow(position, 1, 'Position should be < 1');
        });

        it('moon phase changes after advancing time significantly', async function () {
          const phases = api.getAllMoonPhases();
          if (phases.length === 0) {
            this.skip();
            return;
          }

          const phaseBefore = api.getMoonPhase(0);
          // Advance 15 days to ensure phase change
          await api.advanceTime(15 * 86400);
          const phaseAfter = api.getMoonPhase(0);

          assert.isNotNull(phaseBefore);
          assert.isNotNull(phaseAfter);
          // The phase name or position should differ after 15 days
          const changed = phaseBefore.name !== phaseAfter.name;
          assert.ok(changed, 'Moon phase should change after 15 days');
        });
      });
    },
    { displayName: 'Calendaria: Moon Phases' }
  );
}
