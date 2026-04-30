/**
 * Patch TooltipManager#activate to work around a Foundry core bug where nested
 * tooltip elements (parent with data-tooltip-html, child with data-tooltip + aria-label)
 * produce blank tooltips on first hover due to a stale activation timeout race condition.
 * @see https://github.com/foundryvtt/foundryvtt/issues/13865
 */
export function patchTooltipActivate() {
  const t = game.tooltip;
  const o = t.activate.bind(t);
  t.activate = function (element, options = {}) {
    if (!options.text && !options.html && element?.ariaLabel && element?.dataset?.tooltip === '') options.text = element.ariaLabel;
    return o(element, options);
  };
}
