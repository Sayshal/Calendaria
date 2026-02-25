/**
 * Integration tests for note property validation and lifecycle.
 * @param {object} quench  Quench test runner instance
 */
export function registerNoteProperties(quench) {
  quench.registerBatch(
    'calendaria.integration.note-properties',
    (context) => {
      const { describe, it, assert, before, after } = context;

      const TEST_NOTE_PREFIX = '[Quench Test]';
      let api;
      let createdPageId;

      before(async function () {
        api = CALENDARIA.api;
        const dt = api.getCurrentDateTime();
        const page = await api.createNote({
          name: `${TEST_NOTE_PREFIX} Properties`,
          content: 'Test note content for property checks',
          startDate: { year: dt.year, month: dt.month, day: dt.dayOfMonth + 1 },
          categories: ['event']
        });
        createdPageId = page?.id;
      });

      after(async function () {
        if (createdPageId) {
          await api.deleteNote(createdPageId);
          createdPageId = null;
        }
        // Cleanup any leftover test notes
        const allNotes = api.getAllNotes();
        for (const note of allNotes) {
          if (note.name?.startsWith(TEST_NOTE_PREFIX)) {
            await api.deleteNote(note.id);
          }
        }
      });

      describe('Note Properties', function () {
        it('created note has expected shape', function () {
          if (!createdPageId) {
            this.skip();
            return;
          }
          const note = api.getNote(createdPageId);
          assert.isNotNull(note, 'Note should exist');
          assert.property(note, 'id');
          assert.property(note, 'name');
          assert.property(note, 'flagData');
          assert.property(note.flagData, 'startDate');
        });

        it('updateNote changes note content and returns updated note', async function () {
          if (!createdPageId) {
            this.skip();
            return;
          }
          const updated = await api.updateNote(createdPageId, {
            name: `${TEST_NOTE_PREFIX} Updated Properties`
          });
          assert.isNotNull(updated, 'updateNote should return a result');

          const note = api.getNote(createdPageId);
          assert.ok(note.name.includes('Updated Properties'), 'Note name should be updated');
        });

        it('note date fields are correct', function () {
          if (!createdPageId) {
            this.skip();
            return;
          }
          const note = api.getNote(createdPageId);
          const dt = api.getCurrentDateTime();
          const startDate = note.flagData.startDate;

          assert.strictEqual(startDate.year, dt.year, 'Year should match');
          assert.strictEqual(startDate.month, dt.month, 'Month should match');
          assert.strictEqual(startDate.day, dt.dayOfMonth + 1, 'Day should match');
        });

        it('note with category preserves category field', function () {
          if (!createdPageId) {
            this.skip();
            return;
          }
          const note = api.getNote(createdPageId);
          assert.isArray(note.flagData.categories, 'categories should be an array');
          assert.include(note.flagData.categories, 'event', 'Should contain the event category');
        });

        it('getAllNotes includes the test note', function () {
          if (!createdPageId) {
            this.skip();
            return;
          }
          const allNotes = api.getAllNotes();
          assert.isArray(allNotes);
          const found = allNotes.find((n) => n.id === createdPageId);
          assert.isNotNull(found, 'Test note should appear in getAllNotes');
        });

        it('deleteNote returns true and note is no longer retrievable', async function () {
          if (!createdPageId) {
            this.skip();
            return;
          }
          const result = await api.deleteNote(createdPageId);
          assert.ok(result, 'deleteNote should return truthy');

          const note = api.getNote(createdPageId);
          assert.isNull(note, 'Deleted note should not be retrievable');
          createdPageId = null;
        });
      });
    },
    { displayName: 'Calendaria: Note Properties' }
  );
}
