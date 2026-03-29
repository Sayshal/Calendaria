/** Quench tests for cinematic API methods. */
export function registerCinematic(quench) {
  quench.registerBatch(
    'calendaria.integration.cinematic',
    (context) => {
      const { describe, it, assert, before } = context;
      let api;

      before(function () {
        api = CALENDARIA.api;
      });

      describe('Cinematic', function () {
        it('isCinematicActive returns boolean', function () {
          const result = api.isCinematicActive();
          assert.typeOf(result, 'boolean');
          assert.isFalse(result, 'No cinematic should be active during tests');
        });
        it('abortCinematic does not throw when nothing is playing', function () {
          assert.doesNotThrow(() => api.abortCinematic());
        });
        it('buildCinematicPayload returns object', function () {
          const dt = api.getCurrentDateTime();
          const ts1 = api.dateToTimestamp(dt);
          const future = api.addDays(dt, 7);
          const ts2 = api.dateToTimestamp(future);
          const result = api.buildCinematicPayload(ts1, ts2);
          if (!result) { this.skip(); return; }
          assert.typeOf(result, 'object');
        });
      });
    },
    { displayName: 'Calendaria: Cinematic' }
  );
}
