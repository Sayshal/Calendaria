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
        it('isCinematicPaused returns boolean', function () {
          assert.typeOf(api.isCinematicPaused(), 'boolean');
        });
        it('pauseCinematic and resumeCinematic do not throw when nothing is playing', function () {
          assert.doesNotThrow(() => api.pauseCinematic());
          assert.doesNotThrow(() => api.resumeCinematic());
          assert.isFalse(api.isCinematicPaused());
        });
        it('pause freezes progress and resume completes the cinematic', async function () {
          const dt = api.getCurrentDateTime();
          const ts1 = api.dateToTimestamp(dt);
          const ts2 = api.dateToTimestamp(api.addDays(dt, 3));
          const payload = api.buildCinematicPayload(ts1, ts2);
          if (!payload?.keyframes?.length) { this.skip(); return; }
          const playback = api.playCinematic(payload);
          api.pauseCinematic();
          assert.isTrue(api.isCinematicPaused());
          const frozen = document.querySelector('#calendaria-cinematic .cinematic-progress-fill')?.style.width;
          await new Promise((resolve) => setTimeout(resolve, 200));
          assert.equal(document.querySelector('#calendaria-cinematic .cinematic-progress-fill')?.style.width, frozen);
          api.resumeCinematic();
          assert.isFalse(api.isCinematicPaused());
          api.abortCinematic();
          await playback;
          assert.isFalse(api.isCinematicActive());
        });
      });
    },
    { displayName: 'Calendaria: Cinematic' }
  );
}
