/**
 * Integration tests for note CRUD operations.
 * @param {object} quench  Quench test runner instance
 */
export function registerNoteCrud(quench) {
  quench.registerBatch(
    'calendaria.integration.note-crud',
    (context) => {
      const { describe, it, assert, after } = context;

      const TEST_NOTE_PREFIX = '[Quench Test]';
      let api;
      let createdPageId;

      after(async function () {
        // Clean up any leftover test notes
        const allNotes = api.getAllNotes();
        for (const note of allNotes) {
          if (note.name?.startsWith(TEST_NOTE_PREFIX)) {
            await api.deleteNote(note.id);
          }
        }
      });

      describe('Note CRUD', function () {
        it('should create a note', async function () {
          api = CALENDARIA.api;
          const dt = api.getCurrentDateTime();
          const page = await api.createNote({
            name: `${TEST_NOTE_PREFIX} Create`,
            startDate: { year: dt.year, month: dt.month, day: dt.dayOfMonth + 1 }
          });

          assert.isNotNull(page, 'createNote should return a page');
          assert.ok(page.id, 'Created note should have an id');
          createdPageId = page.id;
        });

        it('should retrieve the created note', function () {
          assert.ok(createdPageId, 'A note must have been created first');
          const note = api.getNote(createdPageId);
          assert.isNotNull(note, 'getNote should return the created note');
          assert.ok(note.name.startsWith(TEST_NOTE_PREFIX));
        });

        it('should include the note in getAllNotes', function () {
          const allNotes = api.getAllNotes();
          assert.isArray(allNotes);
          const found = allNotes.find((n) => n.id === createdPageId);
          assert.isNotNull(found, 'Created note should appear in getAllNotes');
        });

        it('should update the note', async function () {
          assert.ok(createdPageId, 'A note must have been created first');
          const updated = await api.updateNote(createdPageId, {
            name: `${TEST_NOTE_PREFIX} Updated`
          });
          assert.isNotNull(updated, 'updateNote should return a result');

          const note = api.getNote(createdPageId);
          assert.ok(note.name.includes('Updated'), 'Note name should be updated');
        });

        it('should delete the note', async function () {
          assert.ok(createdPageId, 'A note must have been created first');
          const result = await api.deleteNote(createdPageId);
          assert.ok(result, 'deleteNote should return truthy');

          const note = api.getNote(createdPageId);
          assert.isNull(note, 'Deleted note should not be retrievable');
          createdPageId = null;
        });
      });
    },
    { displayName: 'Calendaria: Note CRUD' }
  );
}
