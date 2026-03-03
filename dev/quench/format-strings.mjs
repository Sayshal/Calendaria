/**
 * Integration tests for format string outputs.
 * @param {object} quench  Quench test runner instance
 */
export function registerFormatStrings(quench) {
  quench.registerBatch(
    'calendaria.integration.format-strings',
    (context) => {
      const { describe, it, assert } = context;

      let api;

      describe('Format Strings', function () {
        it('should expose the API', function () {
          api = CALENDARIA.api;
          assert.isNotNull(api);
        });

        it('formatDate returns a non-empty string', function () {
          const result = api.formatDate();
          assert.typeOf(result, 'string');
          assert.ok(result.length > 0, 'formatDate should return a non-empty string');
        });

        it('formatDate with time preset returns string containing colon', function () {
          const result = api.formatDate(undefined, 'time24');
          assert.typeOf(result, 'string');
          assert.include(result, ':', 'Time format should contain colon separator');
        });

        it('formatDate with dateLong preset returns non-empty string', function () {
          const result = api.formatDate(undefined, 'dateLong');
          assert.typeOf(result, 'string');
          assert.ok(result.length > 0, 'dateLong format should be non-empty');
        });

        it('formatTemperature contains degree symbol', function () {
          const result = api.formatTemperature(20);
          assert.typeOf(result, 'string');
          assert.include(result, '°', 'Formatted temperature should contain degree symbol');
        });

        it('formatTemperature handles zero correctly', function () {
          const result = api.formatTemperature(0);
          assert.typeOf(result, 'string');
          assert.include(result, '°', 'Formatted zero temperature should contain degree symbol');
          assert.include(result, '0', 'Formatted zero temperature should contain 0');
        });

        it('getFormatTokens returns non-empty array', function () {
          const tokens = api.getFormatTokens();
          assert.isArray(tokens);
          assert.ok(tokens.length > 0, 'Should have at least one format token');
        });

        it('getFormatPresets returns object with presets', function () {
          const presets = api.getFormatPresets();
          assert.typeOf(presets, 'object');
          assert.isNotNull(presets);
          const keys = Object.keys(presets);
          assert.ok(keys.length > 0, 'Should have at least one format preset');
        });
      });
    },
    { displayName: 'Calendaria: Format Strings' }
  );
}
