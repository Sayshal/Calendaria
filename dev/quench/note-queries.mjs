/**
 * Integration tests for note query operations.
 * @param {object} quench  Quench test runner instance
 */
export function registerNoteQueries(quench) {
  quench.registerBatch(
    'calendaria.integration.note-queries',
    (context) => {
      const { describe, it, assert, before, after } = context;

      const TEST_NOTE_PREFIX = '[Quench Test]';
      let api;
      let noteIds = [];

      before(async function () {
        api = CALENDARIA.api;
        const dt = api.getCurrentDateTime();

        // Create 3 test notes on consecutive days
        const note1 = await api.createNote({
          name: `${TEST_NOTE_PREFIX} Query A`,
          content: 'Alpha content for searching',
          startDate: { year: dt.year, month: dt.month, day: dt.dayOfMonth + 1 },
          categories: ['event']
        });
        const note2 = await api.createNote({
          name: `${TEST_NOTE_PREFIX} Query B`,
          content: 'Beta content unique',
          startDate: { year: dt.year, month: dt.month, day: dt.dayOfMonth + 2 },
          categories: ['reminder']
        });
        const note3 = await api.createNote({
          name: `${TEST_NOTE_PREFIX} Query C`,
          content: 'Alpha recurring text',
          startDate: { year: dt.year, month: dt.month, day: dt.dayOfMonth + 3 },
          categories: ['event']
        });

        noteIds = [note1?.id, note2?.id, note3?.id].filter(Boolean);
      });

      after(async function () {
        for (const id of noteIds) {
          await api.deleteNote(id);
        }
        noteIds = [];
      });

      describe('Note Queries', function () {
        it('should skip if notes were not created', function () {
          if (noteIds.length < 3) {
            this.skip();
            return;
          }
          assert.strictEqual(noteIds.length, 3);
        });

        it('getNotesForDate returns notes for a specific date', function () {
          if (noteIds.length < 3) {
            this.skip();
            return;
          }
          const dt = api.getCurrentDateTime();
          const notes = api.getNotesForDate(dt.year, dt.month, dt.dayOfMonth + 1);
          assert.isArray(notes);
          const found = notes.some((n) => n.id === noteIds[0]);
          assert.ok(found, 'Should find note A on its date');
        });

        it('getNotesInRange returns notes spanning multiple days', function () {
          if (noteIds.length < 3) {
            this.skip();
            return;
          }
          const dt = api.getCurrentDateTime();
          const start = { year: dt.year, month: dt.month, day: dt.dayOfMonth + 1 };
          const end = { year: dt.year, month: dt.month, day: dt.dayOfMonth + 3 };
          const notes = api.getNotesInRange(start, end);
          assert.isArray(notes);
          assert.isAtLeast(notes.length, 3, 'Should find all 3 test notes in range');
        });

        it('getNotesByCategory filters by category', function () {
          if (noteIds.length < 3) {
            this.skip();
            return;
          }
          const eventNotes = api.getNotesByCategory('event');
          assert.isArray(eventNotes);
          const testEvents = eventNotes.filter((n) => noteIds.includes(n.id));
          assert.isAtLeast(testEvents.length, 2, 'Should find at least 2 event-category test notes');
        });

        it('searchNotes finds notes by name', function () {
          if (noteIds.length < 3) {
            this.skip();
            return;
          }
          const results = api.searchNotes('Query');
          assert.isArray(results);
          const testResults = results.filter((n) => noteIds.includes(n.id));
          assert.isAtLeast(testResults.length, 3, 'Should find all test notes containing "Query"');
        });

        it('searchNotes with caseSensitive option', function () {
          if (noteIds.length < 3) {
            this.skip();
            return;
          }
          const results = api.searchNotes('query', { caseSensitive: true });
          assert.isArray(results);
          // "Query" (capitalized) should not match case-sensitive "query"
          const testResults = results.filter((n) => noteIds.includes(n.id));
          assert.strictEqual(testResults.length, 0, 'Case-sensitive search for "query" should not match "Query"');
        });

        it('getNotesForMonth returns notes within a month', function () {
          if (noteIds.length < 3) {
            this.skip();
            return;
          }
          const dt = api.getCurrentDateTime();
          const notes = api.getNotesForMonth(dt.year, dt.month);
          assert.isArray(notes);
          const testNotes = notes.filter((n) => noteIds.includes(n.id));
          assert.isAtLeast(testNotes.length, 3, 'Should find all 3 test notes in the month');
        });
      });
    },
    { displayName: 'Calendaria: Note Queries' }
  );
}
