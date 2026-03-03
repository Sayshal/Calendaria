/**
 * Integration tests for calendar switching.
 * @param {object} quench  Quench test runner instance
 */
export function registerCalendarSwitching(quench) {
  quench.registerBatch(
    'calendaria.integration.calendar-switching',
    (context) => {
      const { describe, it, assert, before, after } = context;

      let api;
      let originalCalendarId;

      before(function () {
        api = CALENDARIA.api;
        const active = api.getActiveCalendar();
        assert.isNotNull(active, 'An active calendar must exist');
        originalCalendarId = game.settings.get('calendaria', 'activeCalendar');
      });

      after(async function () {
        // Restore original calendar
        if (originalCalendarId) {
          await api.switchCalendar(originalCalendarId);
        }
      });

      describe('Calendar Switching', function () {
        it('should get the active calendar', function () {
          const calendar = api.getActiveCalendar();
          assert.isNotNull(calendar);
          const activeId = game.settings.get('calendaria', 'activeCalendar');
          assert.ok(activeId, 'Should have an active calendar ID');
        });

        it('should return valid datetime components from active calendar', function () {
          const dt = api.getCurrentDateTime();
          assert.isNotNull(dt);
          assert.typeOf(dt.year, 'number');
          assert.typeOf(dt.month, 'number');
          assert.typeOf(dt.dayOfMonth, 'number');
          assert.typeOf(dt.hour, 'number');
          assert.typeOf(dt.minute, 'number');
        });

        it('should list all available calendars', function () {
          const calendars = api.getAllCalendars();
          assert.instanceOf(calendars, Map);
          assert.ok(calendars.size > 0, 'Should have at least one calendar');
        });

        it('should switch to another calendar and back', async function () {
          const calendars = api.getAllCalendars();
          if (calendars.size < 2) {
            this.skip();
            return;
          }

          // Find a different calendar
          let targetId;
          for (const [id] of calendars) {
            if (id !== originalCalendarId) {
              targetId = id;
              break;
            }
          }

          // Switch to different calendar
          const switched = await api.switchCalendar(targetId);
          assert.ok(switched, 'switchCalendar should return truthy');

          const activeId = game.settings.get('calendaria', 'activeCalendar');
          assert.strictEqual(activeId, targetId);

          // Verify datetime still valid after switch
          const dt = api.getCurrentDateTime();
          assert.isNotNull(dt);
          assert.typeOf(dt.year, 'number');

          // Switch back
          const restored = await api.switchCalendar(originalCalendarId);
          assert.ok(restored);
          const restoredId = game.settings.get('calendaria', 'activeCalendar');
          assert.strictEqual(restoredId, originalCalendarId);
        });
      });
    },
    { displayName: 'Calendaria: Calendar Switching' }
  );
}
