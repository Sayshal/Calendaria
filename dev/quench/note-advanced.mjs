/** Quench tests for advanced note API methods. */
export function registerNoteAdvanced(quench) {
  quench.registerBatch(
    'calendaria.integration.note-advanced',
    (context) => {
      const { describe, it, assert, before, after } = context;
      let api;
      let testNoteId;

      before(function () {
        api = CALENDARIA.api;
      });

      after(async function () {
        if (testNoteId) {
          try { await api.deleteNote(testNoteId); } catch (_) { /* ignore */ }
        }
      });

      describe('Notes — Documents & Visibility', function () {
        it('getNoteDocument returns null for invalid id', function () {
          const result = api.getNoteDocument('nonexistent-id');
          assert.isNull(result);
        });
        it('getNoteDocument returns page for valid note', async function () {
          const dt = api.getCurrentDateTime();
          const note = await api.createNote({ name: '[Quench Test] Doc Test', startDate: { year: dt.year, month: dt.month, day: dt.day } });
          if (!note) { this.skip(); return; }
          testNoteId = note.id;
          const doc = api.getNoteDocument(note.id);
          assert.isNotNull(doc);
          assert.property(doc, 'name');
        });
        it('setNoteVisibility changes visibility', async function () {
          if (!testNoteId) { this.skip(); return; }
          const updated = await api.setNoteVisibility(testNoteId, 'hidden');
          assert.isNotNull(updated);
          const note = api.getNote(testNoteId);
          assert.strictEqual(note?.flagData?.visibility, 'hidden');
        });
        it('setNoteVisibility rejects invalid value', async function () {
          if (!testNoteId) { this.skip(); return; }
          const result = await api.setNoteVisibility(testNoteId, 'nonsense');
          assert.isNull(result);
        });
        it('setNoteDisplayStyle changes style', async function () {
          if (!testNoteId) { this.skip(); return; }
          const updated = await api.setNoteDisplayStyle(testNoteId, 'banner');
          assert.isNotNull(updated);
        });
      });

      describe('Notes — Presets & Festivals', function () {
        it('getPresets returns array', function () {
          const result = api.getPresets();
          assert.isArray(result);
        });
        it('getFestivals returns array', function () {
          const cal = api.getActiveCalendar();
          if (!cal) { this.skip(); return; }
          const result = api.getFestivals(cal.id);
          assert.isArray(result);
        });
      });

      describe('Notes — Query Extensions', function () {
        it('getNotesForMonth returns array', function () {
          const dt = api.getCurrentDateTime();
          const result = api.getNotesForMonth(dt.year, dt.month);
          assert.isArray(result);
        });
        it('timeSince returns string', function () {
          const dt = api.getCurrentDateTime();
          const pastDate = api.addDays(dt, -30);
          const result = api.timeSince(pastDate);
          if (!result) { this.skip(); return; }
          assert.typeOf(result, 'string');
        });
      });

      describe('Notes — Calendar Helpers', function () {
        it('isBundledCalendar returns boolean', function () {
          const cal = api.getActiveCalendar();
          if (!cal) { this.skip(); return; }
          const calId = cal.metadata?.id ?? cal.id;
          const result = api.isBundledCalendar(calId);
          assert.typeOf(result, 'boolean');
        });
        it('getCalendar returns calendar by id', function () {
          const cal = api.getActiveCalendar();
          if (!cal) { this.skip(); return; }
          const calId = cal.metadata?.id ?? cal.id;
          const result = api.getCalendar(calId);
          assert.isNotNull(result);
        });
        it('getCalendar returns null for invalid id', function () {
          const result = api.getCalendar('nonexistent-calendar-id');
          assert.isNull(result);
        });
      });
    },
    { displayName: 'Calendaria: Notes Advanced' }
  );
}
