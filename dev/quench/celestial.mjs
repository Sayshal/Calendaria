/** Quench tests for celestial API methods (eclipses, convergences, full moon). */
export function registerCelestial(quench) {
  quench.registerBatch(
    'calendaria.integration.celestial',
    (context) => {
      const { describe, it, assert, before } = context;
      let api;
      let hasMoons;

      before(function () {
        api = CALENDARIA.api;
        const cal = api.getActiveCalendar();
        hasMoons = (cal?.moonsArray?.length ?? 0) > 0;
      });

      describe('Celestial — Moon Helpers', function () {
        it('isMoonFull returns boolean', function () {
          if (!hasMoons) { this.skip(); return; }
          const cal = api.getActiveCalendar();
          const moon = cal.moonsArray[0];
          const result = api.isMoonFull(moon);
          assert.typeOf(result, 'boolean');
        });
        it('getNextFullMoon returns date object', function () {
          if (!hasMoons) { this.skip(); return; }
          const cal = api.getActiveCalendar();
          const moon = cal.moonsArray[0];
          const result = api.getNextFullMoon(moon);
          if (!result) { this.skip(); return; }
          assert.property(result, 'year');
          assert.property(result, 'month');
          assert.property(result, 'day');
        });
        it('getNextConvergence returns date or null', function () {
          const cal = api.getActiveCalendar();
          const moons = cal?.moonsArray;
          if (!moons || moons.length < 2) { this.skip(); return; }
          const result = api.getNextConvergence(moons);
          if (result) {
            assert.property(result, 'year');
            assert.property(result, 'day');
          }
        });
        it('getConvergencesInRange returns array', function () {
          const cal = api.getActiveCalendar();
          const moons = cal?.moonsArray;
          if (!moons || moons.length < 2) { this.skip(); return; }
          const dt = api.getCurrentDateTime();
          const start = { year: dt.year, month: dt.month, day: dt.day };
          const end = api.addYears(start, 1);
          const result = api.getConvergencesInRange(moons, start, end);
          assert.isArray(result);
        });
      });

      describe('Celestial — Eclipses', function () {
        it('getEclipse returns object or null', function () {
          if (!hasMoons) { this.skip(); return; }
          const result = api.getEclipse(0);
          if (result) {
            assert.property(result, 'type');
          }
        });
        it('isEclipse returns boolean', function () {
          if (!hasMoons) { this.skip(); return; }
          const result = api.isEclipse();
          assert.typeOf(result, 'boolean');
        });
        it('getNextEclipse returns result or null', function () {
          if (!hasMoons) { this.skip(); return; }
          const result = api.getNextEclipse(0);
          if (result) {
            assert.property(result, 'date');
            assert.property(result, 'type');
            assert.property(result.date, 'year');
          }
        });
        it('getEclipsesInRange returns array', function () {
          if (!hasMoons) { this.skip(); return; }
          const dt = api.getCurrentDateTime();
          const start = { year: dt.year, month: dt.month, day: dt.day };
          const end = api.addYears(start, 2);
          const result = api.getEclipsesInRange(0, start, end);
          assert.isArray(result);
        });
      });

      describe('Celestial — Sun Cycle', function () {
        it('getDaylightHours returns number or null', function () {
          const result = api.getDaylightHours();
          if (result == null) { this.skip(); return; }
          assert.typeOf(result, 'number');
          assert.isAtLeast(result, 0);
          assert.isAtMost(result, 24);
        });
        it('getProgressDay returns number', function () {
          const result = api.getProgressDay();
          if (result == null) { this.skip(); return; }
          assert.typeOf(result, 'number');
          if (api.isDaytime()) {
            assert.isAtLeast(result, 0);
            assert.isAtMost(result, 1);
          }
        });
        it('getProgressNight returns number 0-1', function () {
          const result = api.getProgressNight();
          if (result == null) { this.skip(); return; }
          assert.typeOf(result, 'number');
          assert.isAtLeast(result, 0);
          assert.isAtMost(result, 1);
        });
        it('getTimeUntilSunrise returns time object', function () {
          const result = api.getTimeUntilSunrise();
          if (result == null) { this.skip(); return; }
          assert.typeOf(result, 'object');
          assert.property(result, 'hours');
          assert.property(result, 'minutes');
          assert.property(result, 'seconds');
        });
        it('getTimeUntilSunset returns time object', function () {
          const result = api.getTimeUntilSunset();
          if (result == null) { this.skip(); return; }
          assert.typeOf(result, 'object');
          assert.property(result, 'hours');
          assert.property(result, 'minutes');
          assert.property(result, 'seconds');
        });
        it('getTimeUntilMidnight returns time object', function () {
          const result = api.getTimeUntilMidnight();
          assert.typeOf(result, 'object');
          assert.property(result, 'hours');
          assert.isAtLeast(result.hours, 0);
        });
        it('getTimeUntilMidday returns time object', function () {
          const result = api.getTimeUntilMidday();
          assert.typeOf(result, 'object');
          assert.property(result, 'hours');
        });
        it('getTimeUntilTarget returns time object', function () {
          const result = api.getTimeUntilTarget(12);
          assert.typeOf(result, 'object');
          assert.property(result, 'hours');
          assert.property(result, 'minutes');
          assert.property(result, 'seconds');
        });
      });

      describe('Celestial — Season & Weekday', function () {
        it('getCurrentSeason returns object or null', function () {
          const result = api.getCurrentSeason();
          if (!result) { this.skip(); return; }
          assert.property(result, 'name');
        });
        it('getCycleValues returns object', function () {
          const result = api.getCycleValues();
          if (!result) { this.skip(); return; }
          assert.typeOf(result, 'object');
        });
        it('isRestDay returns boolean', function () {
          const result = api.isRestDay();
          assert.typeOf(result, 'boolean');
        });
        it('isFestivalDay returns boolean', function () {
          const result = api.isFestivalDay();
          assert.typeOf(result, 'boolean');
        });
        it('getCurrentFestival returns object or null', function () {
          const result = api.getCurrentFestival();
          // null if no festival today, object if there is one
          if (result) assert.property(result, 'name');
        });
      });
    },
    { displayName: 'Calendaria: Celestial & Sun Cycle' }
  );
}
