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
          const position = api.getMoonPhasePosition(moons[0], { year: dt.year, month: dt.month, day: dt.day });
          if (position == null) {
            this.skip();
            return;
          }
          assert.typeOf(position, 'number');
          assert.isAtLeast(position, 0, 'Position should be >= 0');
          assert.isBelow(position, 1, 'Position should be < 1');
        });
        it('moon phase changes after advancing time significantly', async function () {
          this.timeout(10000);
          const phases = api.getAllMoonPhases();
          if (phases.length === 0) {
            this.skip();
            return;
          }
          const phaseBefore = api.getMoonPhase(0);
          await api.advanceTime(15 * 86400);
          const phaseAfter = api.getMoonPhase(0);
          assert.isNotNull(phaseBefore);
          assert.isNotNull(phaseAfter);
          const changed = phaseBefore.name !== phaseAfter.name;
          assert.ok(changed, 'Moon phase should change after 15 days');
        });
        it('reset anchors keep the cycle aligned when yearZero is not 0', function () {
          const cal = api.getActiveCalendar();
          if (!cal) {
            this.skip();
            return;
          }
          const data = cal.toObject();
          data.years.yearZero = 1;
          const year = 5;
          const prevYearDays = cal.getDaysInYear(year - 1);
          const cycleLength = prevYearDays % 28 === 0 ? 29 : 28;
          const phases = ['Full', 'Waning', 'New', 'Waxing'].map((name, i) => [`p${i}`, { name, start: i / 4, end: (i + 1) / 4 }]);
          data.moons = {
            test: {
              name: 'Test Moon',
              cycleLength,
              phaseMode: 'fixed',
              referenceDate: { year: 1, month: 0, dayOfMonth: 0 },
              phases: Object.fromEntries(phases),
              anchorPhases: { a0: { year: null, month: 0, dayOfMonth: 0, phaseIndex: 0, resetCycle: true } }
            }
          };
          const testCal = new cal.constructor(data);
          const lastDay = Math.min(cal.monthsArray[0].days, cycleLength) - 1;
          for (let day = 1; day <= lastDay; day++) {
            const phase = testCal.getMoonPhase(0, { year, month: 0, dayOfMonth: day, hour: 0, minute: 0, second: 0 });
            assert.strictEqual(phase.dayInCycle, day, `Day ${day} after the anchor should be day ${day} of the cycle`);
          }
        });
      });
    },
    { displayName: 'Calendaria: Moon Phases' }
  );
}
