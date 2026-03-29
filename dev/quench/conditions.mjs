/** Quench tests for condition builder API and note evaluation. */
export function registerConditions(quench) {
  quench.registerBatch(
    'calendaria.integration.conditions',
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

      describe('Conditions — Enums', function () {
        it('conditionFields is non-empty object', function () {
          const fields = api.conditionFields;
          assert.typeOf(fields, 'object');
          assert.isAbove(Object.keys(fields).length, 0);
        });
        it('conditionOperators is non-empty object', function () {
          const ops = api.conditionOperators;
          assert.typeOf(ops, 'object');
          assert.isAbove(Object.keys(ops).length, 0);
        });
        it('conditionGroupModes is non-empty object', function () {
          const modes = api.conditionGroupModes;
          assert.typeOf(modes, 'object');
          assert.property(modes, 'AND');
          assert.property(modes, 'OR');
        });
        it('displayStyles is non-empty object', function () {
          const styles = api.displayStyles;
          assert.typeOf(styles, 'object');
          assert.isAbove(Object.keys(styles).length, 0);
        });
        it('noteVisibility is non-empty object', function () {
          const vis = api.noteVisibility;
          assert.typeOf(vis, 'object');
          assert.property(vis, 'VISIBLE');
          assert.property(vis, 'HIDDEN');
        });
      });

      describe('Conditions — Factory Methods', function () {
        it('createCondition returns condition object', function () {
          const fields = api.conditionFields;
          const cond = api.createCondition(fields.MONTH, '==', 1);
          assert.strictEqual(cond.type, 'condition');
          assert.strictEqual(cond.field, fields.MONTH);
          assert.strictEqual(cond.op, '==');
          assert.strictEqual(cond.value, 1);
        });
        it('createCondition with two values', function () {
          const fields = api.conditionFields;
          const cond = api.createCondition(fields.DAY, 'between', 5, 15);
          assert.strictEqual(cond.value, 5);
          assert.strictEqual(cond.value2, 15);
        });
        it('createConditionGroup returns group object', function () {
          const fields = api.conditionFields;
          const cond1 = api.createCondition(fields.MONTH, '==', 1);
          const cond2 = api.createCondition(fields.DAY, '==', 15);
          const group = api.createConditionGroup('and', [cond1, cond2]);
          assert.strictEqual(group.type, 'group');
          assert.strictEqual(group.mode, 'and');
          assert.isArray(group.children);
          assert.lengthOf(group.children, 2);
        });
        it('createConditionGroup with threshold for count mode', function () {
          const fields = api.conditionFields;
          const c1 = api.createCondition(fields.MONTH, '==', 1);
          const c2 = api.createCondition(fields.DAY, '==', 15);
          const group = api.createConditionGroup('count', [c1, c2], { threshold: 1 });
          assert.strictEqual(group.mode, 'count');
          assert.strictEqual(group.threshold, 1);
        });
      });

      describe('Conditions — Note Evaluation', function () {
        it('evaluateNote on one-time note', async function () {
          const dt = api.getCurrentDateTime();
          const note = await api.createNote({ name: '[Quench Test] Condition Eval', year: dt.year, month: dt.month, day: dt.day });
          if (!note) { this.skip(); return; }
          testNoteId = note.id;
          const result = api.evaluateNote(note.id, dt);
          assert.isTrue(result, 'One-time note should match its own start date');
          const tomorrow = api.addDays(dt, 1);
          const result2 = api.evaluateNote(note.id, tomorrow);
          assert.isFalse(result2, 'One-time note should not match a different date');
        });
        it('evaluateNote returns false for invalid pageId', function () {
          const result = api.evaluateNote('nonexistent-id', { year: 2024, month: 1, day: 1 });
          assert.isFalse(result);
        });
        it('getNextOccurrences returns array', async function () {
          if (!testNoteId) { this.skip(); return; }
          const result = api.getNextOccurrences(testNoteId, 3);
          assert.isArray(result);
        });
        it('getNextOccurrences returns empty for invalid pageId', function () {
          const result = api.getNextOccurrences('nonexistent-id');
          assert.isArray(result);
          assert.lengthOf(result, 0);
        });
        it('getNoteOccurrencesInRange returns array', async function () {
          if (!testNoteId) { this.skip(); return; }
          const dt = api.getCurrentDateTime();
          const start = { year: dt.year, month: 1, day: 1 };
          const end = { year: dt.year, month: 12, day: 28 };
          const result = api.getNoteOccurrencesInRange(testNoteId, start, end);
          assert.isArray(result);
          assert.isAbove(result.length, 0, 'Should find at least the start date occurrence');
        });
      });
    },
    { displayName: 'Calendaria: Conditions & Evaluation' }
  );
}
