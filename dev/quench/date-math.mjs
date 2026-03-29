/** Quench tests for date arithmetic API methods. */
export function registerDateMath(quench) {
  quench.registerBatch(
    'calendaria.integration.date-math',
    (context) => {
      const { describe, it, assert, before } = context;
      let api;

      before(function () {
        api = CALENDARIA.api;
      });

      describe('Date Math — addDays / addMonths / addYears', function () {
        it('addDays forward', function () {
          const result = api.addDays({ year: 2024, month: 1, day: 1 }, 10);
          assert.strictEqual(result.year, 2024);
          assert.strictEqual(result.day, 11);
        });
        it('addDays negative', function () {
          const result = api.addDays({ year: 2024, month: 1, day: 15 }, -10);
          assert.strictEqual(result.day, 5);
        });
        it('addDays wraps month', function () {
          const cal = api.getActiveCalendar();
          const months = cal?.monthsArray;
          if (!months?.length) { this.skip(); return; }
          const daysInFirst = months[0].days;
          const result = api.addDays({ year: 2024, month: 1, day: daysInFirst }, 1);
          assert.strictEqual(result.month, 2);
          assert.strictEqual(result.day, 1);
        });
        it('addMonths forward', function () {
          const result = api.addMonths({ year: 2024, month: 1, day: 1 }, 3);
          assert.strictEqual(result.month, 4);
          assert.strictEqual(result.year, 2024);
        });
        it('addMonths wraps year', function () {
          const cal = api.getActiveCalendar();
          const totalMonths = cal?.monthsArray?.length ?? 12;
          const result = api.addMonths({ year: 2024, month: totalMonths, day: 1 }, 1);
          assert.strictEqual(result.year, 2025);
          assert.strictEqual(result.month, 1);
        });
        it('addYears forward', function () {
          const result = api.addYears({ year: 2024, month: 1, day: 1 }, 5);
          assert.strictEqual(result.year, 2029);
          assert.strictEqual(result.month, 1);
          assert.strictEqual(result.day, 1);
        });
        it('addYears negative', function () {
          const result = api.addYears({ year: 2024, month: 1, day: 1 }, -2);
          assert.strictEqual(result.year, 2022);
        });
      });

      describe('Date Math — addHours / addMinutes / addSeconds', function () {
        it('addHours forward', function () {
          const result = api.addHours({ year: 2024, month: 1, day: 1, hour: 10 }, 5);
          assert.strictEqual(result.hour, 15);
        });
        it('addHours wraps day', function () {
          const result = api.addHours({ year: 2024, month: 1, day: 1, hour: 20 }, 8);
          assert.strictEqual(result.day, 2);
          assert.strictEqual(result.hour, 4);
        });
        it('addMinutes forward', function () {
          const result = api.addMinutes({ year: 2024, month: 1, day: 1, hour: 10, minute: 30 }, 45);
          assert.strictEqual(result.hour, 11);
          assert.strictEqual(result.minute, 15);
        });
        it('addSeconds forward', function () {
          const result = api.addSeconds({ year: 2024, month: 1, day: 1, hour: 10, minute: 0, second: 0 }, 3661);
          assert.strictEqual(result.hour, 11);
          assert.strictEqual(result.minute, 1);
          assert.strictEqual(result.second, 1);
        });
      });

      describe('Date Math — between / compare', function () {
        it('daysBetween same day is 0', function () {
          const d = { year: 2024, month: 1, day: 1 };
          assert.strictEqual(api.daysBetween(d, d), 0);
        });
        it('daysBetween forward is positive', function () {
          const result = api.daysBetween({ year: 2024, month: 1, day: 1 }, { year: 2024, month: 1, day: 11 });
          assert.strictEqual(result, 10);
        });
        it('daysBetween backward is negative', function () {
          const result = api.daysBetween({ year: 2024, month: 1, day: 11 }, { year: 2024, month: 1, day: 1 });
          assert.strictEqual(result, -10);
        });
        it('monthsBetween', function () {
          const result = api.monthsBetween({ year: 2024, month: 1 }, { year: 2024, month: 4 });
          assert.strictEqual(result, 3);
        });
        it('hoursBetween', function () {
          const result = api.hoursBetween({ year: 2024, month: 1, day: 1, hour: 2 }, { year: 2024, month: 1, day: 1, hour: 14 });
          assert.strictEqual(result, 12);
        });
        it('minutesBetween', function () {
          const result = api.minutesBetween({ year: 2024, month: 1, day: 1, hour: 0, minute: 0 }, { year: 2024, month: 1, day: 1, hour: 1, minute: 30 });
          assert.strictEqual(result, 90);
        });
        it('secondsBetween', function () {
          const result = api.secondsBetween({ year: 2024, month: 1, day: 1, hour: 0, minute: 0, second: 0 }, { year: 2024, month: 1, day: 1, hour: 0, minute: 1, second: 30 });
          assert.strictEqual(result, 90);
        });
        it('compareDates returns -1, 0, 1', function () {
          const d1 = { year: 2024, month: 1, day: 1, hour: 0 };
          const d2 = { year: 2024, month: 1, day: 1, hour: 12 };
          assert.strictEqual(api.compareDates(d1, d1), 0);
          assert.strictEqual(api.compareDates(d1, d2), -1);
          assert.strictEqual(api.compareDates(d2, d1), 1);
        });
        it('compareDays ignores time', function () {
          const d1 = { year: 2024, month: 1, day: 1, hour: 0 };
          const d2 = { year: 2024, month: 1, day: 1, hour: 23 };
          assert.strictEqual(api.compareDays(d1, d2), 0);
        });
        it('isSameDay', function () {
          assert.isTrue(api.isSameDay({ year: 2024, month: 1, day: 1 }, { year: 2024, month: 1, day: 1, hour: 18 }));
          assert.isFalse(api.isSameDay({ year: 2024, month: 1, day: 1 }, { year: 2024, month: 1, day: 2 }));
        });
      });

      describe('Date Math — dayOfWeek / isValidDate', function () {
        it('dayOfWeek returns number', function () {
          const result = api.dayOfWeek({ year: 2024, month: 1, day: 1 });
          assert.typeOf(result, 'number');
          const cal = api.getActiveCalendar();
          const daysInWeek = cal?.daysInWeek ?? 7;
          assert.isAtLeast(result, 0);
          assert.isBelow(result, daysInWeek);
        });
        it('isValidDate accepts valid date', function () {
          assert.isTrue(api.isValidDate({ year: 2024, month: 1, day: 1 }));
        });
        it('isValidDate rejects out-of-range month', function () {
          const cal = api.getActiveCalendar();
          const totalMonths = cal?.monthsArray?.length ?? 12;
          assert.isFalse(api.isValidDate({ year: 2024, month: totalMonths + 5, day: 1 }));
        });
        it('isValidDate rejects out-of-range day', function () {
          assert.isFalse(api.isValidDate({ year: 2024, month: 1, day: 999 }));
        });
      });

      describe('Date Math — timestamp conversion', function () {
        it('timestampToDate returns date object', function () {
          const result = api.timestampToDate(0);
          assert.property(result, 'year');
          assert.property(result, 'month');
          assert.property(result, 'day');
        });
        it('dateToTimestamp returns number', function () {
          const dt = api.getCurrentDateTime();
          const ts = api.dateToTimestamp(dt);
          assert.typeOf(ts, 'number');
        });
        it('timestampToDate and dateToTimestamp are inverse operations', function () {
          const dt = api.getCurrentDateTime();
          const ts = api.dateToTimestamp(dt);
          const roundTrip = api.timestampToDate(ts);
          assert.strictEqual(roundTrip.year, dt.year);
          assert.strictEqual(roundTrip.month, dt.month);
          assert.strictEqual(roundTrip.day, dt.day);
        });
        it('chooseRandomDate returns date in range', function () {
          const start = { year: 2024, month: 1, day: 1 };
          const end = { year: 2024, month: 1, day: 28 };
          const result = api.chooseRandomDate(start, end);
          assert.property(result, 'year');
          assert.strictEqual(result.year, 2024);
          assert.strictEqual(result.month, 1);
          assert.isAtLeast(result.day, 1);
          assert.isAtMost(result.day, 28);
        });
      });
    },
    { displayName: 'Calendaria: Date Math' }
  );
}
