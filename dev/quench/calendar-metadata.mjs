/**
 * Integration tests for calendar metadata and structure queries.
 * @param {object} quench  Quench test runner instance
 */
export function registerCalendarMetadata(quench) {
  quench.registerBatch(
    'calendaria.integration.calendar-metadata',
    (context) => {
      const { describe, it, assert } = context;

      let api;

      describe('Calendar Metadata', function () {
        it('should expose the API', function () {
          api = CALENDARIA.api;
          assert.isNotNull(api);
        });

        it('getActiveCalendar returns non-null object with name', function () {
          const cal = api.getActiveCalendar();
          assert.isNotNull(cal, 'Active calendar should exist');
          assert.property(cal, 'name');
          assert.typeOf(cal.name, 'string');
        });

        it('getAllCalendars returns non-empty Map', function () {
          const cals = api.getAllCalendars();
          assert.instanceOf(cals, Map);
          assert.ok(cals.size > 0, 'Should have at least one calendar');
        });

        it('calendar has months array with name and days', function () {
          const cal = api.getActiveCalendar();
          const months = cal.monthsArray;
          if (!months || months.length === 0) {
            this.skip();
            return;
          }
          assert.isArray(months);
          for (const month of months) {
            assert.property(month, 'name', 'Month should have a name');
            assert.property(month, 'days', 'Month should have days');
            assert.typeOf(month.days, 'number');
          }
        });

        it('calendar has weekdays array with name', function () {
          const cal = api.getActiveCalendar();
          const weekdays = cal.weekdaysArray;
          if (!weekdays || weekdays.length === 0) {
            this.skip();
            return;
          }
          assert.isArray(weekdays);
          for (const day of weekdays) {
            assert.property(day, 'name', 'Weekday should have a name');
            assert.typeOf(day.name, 'string');
          }
        });

        it('getCurrentDateTime year is a number', function () {
          const dt = api.getCurrentDateTime();
          assert.typeOf(dt.year, 'number');
        });

        it('getAllCalendarMetadata returns array', function () {
          const meta = api.getAllCalendarMetadata();
          assert.isArray(meta);
          assert.ok(meta.length > 0, 'Should have at least one calendar metadata entry');
          for (const entry of meta) {
            assert.property(entry, 'id');
            assert.property(entry, 'name');
          }
        });

        it('seasons array has expected shape or is empty', function () {
          const cal = api.getActiveCalendar();
          const seasons = cal.seasonsArray;
          assert.isArray(seasons);
          for (const season of seasons) {
            assert.property(season, 'name', 'Season should have a name');
          }
        });
      });
    },
    { displayName: 'Calendaria: Calendar Metadata' }
  );
}
