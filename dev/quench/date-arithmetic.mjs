/**
 * Integration tests for date arithmetic with a live calendar.
 * @param {object} quench  Quench test runner instance
 */
export function registerDateArithmetic(quench) {
  quench.registerBatch(
    'calendaria.integration.date-arithmetic',
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

      describe('Date Arithmetic', function () {
        it('getCurrentDateTime returns valid date components', function () {
          const dt = api.getCurrentDateTime();
          assert.typeOf(dt.year, 'number');
          assert.typeOf(dt.month, 'number');
          assert.isAtLeast(dt.month, 0, 'month should be >= 0');
          assert.typeOf(dt.dayOfMonth, 'number');
          assert.isAtLeast(dt.dayOfMonth, 0, 'dayOfMonth should be >= 0');
          assert.isAtLeast(dt.hour, 0, 'hour should be >= 0');
          assert.isBelow(dt.hour, 24, 'hour should be < 24');
        });

        it('advancing 1 day increments dayOfMonth or wraps month', async function () {
          const dtBefore = api.getCurrentDateTime();
          await api.advanceTime(86400);
          const dtAfter = api.getCurrentDateTime();

          const dayChanged = dtAfter.dayOfMonth !== dtBefore.dayOfMonth || dtAfter.month !== dtBefore.month || dtAfter.year !== dtBefore.year;
          assert.ok(dayChanged, 'Day, month, or year should change after advancing 1 day');
        });

        it('getCurrentWeekday returns object with name', function () {
          const weekday = api.getCurrentWeekday();
          if (!weekday) {
            this.skip();
            return;
          }
          assert.property(weekday, 'name');
          assert.typeOf(weekday.name, 'string');
          assert.property(weekday, 'index');
          assert.typeOf(weekday.index, 'number');
        });

        it('getActiveCalendar has months with days', function () {
          const cal = api.getActiveCalendar();
          assert.isNotNull(cal);
          const months = cal.monthsArray;
          if (!months || months.length === 0) {
            this.skip();
            return;
          }
          for (const month of months) {
            assert.property(month, 'name');
            assert.property(month, 'days');
            assert.typeOf(month.days, 'number');
            assert.isAbove(month.days, 0);
          }
        });
      });
    },
    { displayName: 'Calendaria: Date Arithmetic' }
  );
}
