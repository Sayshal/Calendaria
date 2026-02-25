/**
 * Smoke tests for the full Calendaria API surface.
 * @param {object} quench  Quench test runner instance
 */
export function registerApiSmoke(quench) {
  quench.registerBatch(
    'calendaria.integration.api',
    (context) => {
      const { describe, it, assert } = context;

      let api;

      describe('API Smoke Tests', function () {
        it('should expose the API on the global namespace', function () {
          api = CALENDARIA.api;
          assert.isNotNull(api);
        });

        // DateTime
        it('getCurrentDateTime() returns object with year, month, hour', function () {
          const dt = api.getCurrentDateTime();
          assert.isNotNull(dt);
          assert.typeOf(dt.year, 'number');
          assert.typeOf(dt.month, 'number');
          assert.typeOf(dt.hour, 'number');
        });

        // Formatting
        it('formatDate() returns non-empty string', function () {
          const result = api.formatDate();
          assert.typeOf(result, 'string');
          assert.ok(result.length > 0, 'formatDate should return a non-empty string');
        });

        it('getFormatTokens() returns array', function () {
          const tokens = api.getFormatTokens();
          assert.isArray(tokens);
          assert.ok(tokens.length > 0);
        });

        it('getFormatPresets() returns object', function () {
          const presets = api.getFormatPresets();
          assert.typeOf(presets, 'object');
          assert.isNotNull(presets);
        });

        // Getters
        it('hooks getter returns object with known keys', function () {
          const hooks = api.hooks;
          assert.typeOf(hooks, 'object');
          assert.isNotNull(hooks);
        });

        it('widgetPoints getter returns object', function () {
          const wp = api.widgetPoints;
          assert.typeOf(wp, 'object');
          assert.isNotNull(wp);
        });

        it('replaceableElements getter returns object', function () {
          const re = api.replaceableElements;
          assert.typeOf(re, 'object');
          assert.isNotNull(re);
        });

        // Permissions
        it('isPrimaryGM() returns boolean', function () {
          assert.typeOf(api.isPrimaryGM(), 'boolean');
        });

        it('canModifyTime() returns boolean', function () {
          assert.typeOf(api.canModifyTime(), 'boolean');
        });

        it('canManageNotes() returns boolean', function () {
          assert.typeOf(api.canManageNotes(), 'boolean');
        });

        // Clock
        it('isClockRunning() returns boolean', function () {
          assert.typeOf(api.isClockRunning(), 'boolean');
        });

        // Sun/Day
        it('isDaytime() returns boolean', function () {
          assert.typeOf(api.isDaytime(), 'boolean');
        });

        // Calendar
        it('getActiveCalendar() returns non-null', function () {
          const cal = api.getActiveCalendar();
          assert.isNotNull(cal);
        });

        it('getAllCalendars() returns Map', function () {
          const cals = api.getAllCalendars();
          assert.instanceOf(cals, Map);
          assert.ok(cals.size > 0);
        });

        // Notes
        it('getAllNotes() returns array', function () {
          const notes = api.getAllNotes();
          assert.isArray(notes);
        });

        it('getCategories() returns array', function () {
          const cats = api.getCategories();
          assert.isArray(cats);
        });

        it('searchNotes("test") returns array', function () {
          const results = api.searchNotes('test');
          assert.isArray(results);
        });

        it('search("test") returns array', function () {
          const results = api.search('test');
          assert.isArray(results);
        });

        // Weather
        it('getCalendarZones() returns array', function () {
          const zones = api.getCalendarZones();
          assert.isArray(zones);
        });
      });
    },
    { displayName: 'Calendaria: API Smoke Tests' }
  );
}
