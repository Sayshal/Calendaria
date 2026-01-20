/**
 * Widget Manager - Handles registration and rendering of external module widgets.
 * @module Utils/WidgetManager
 * @author Tyler
 */

import { HOOKS, REPLACEABLE_ELEMENTS, WIDGET_POINTS } from '../constants.mjs';
import { log } from './logger.mjs';

/** @type {Map<string, object>} fullId -> widget config */
const widgets = new Map();

/** @type {Map<string, string>} elementId -> fullId (replacement tracking) */
const replacements = new Map();

/**
 * Register a widget.
 * @param {string} moduleId - Module ID
 * @param {object} config - Widget configuration
 * @param {string} config.id - Unique widget ID within module
 * @param {string} config.type - Widget type: 'button' | 'indicator' | 'custom'
 * @param {string} [config.insertAt] - Insertion point (from WIDGET_POINTS)
 * @param {string} [config.replaces] - Built-in element ID to replace
 * @param {string|Function} [config.icon] - Icon class or function returning icon
 * @param {string|Function} [config.label] - Label text or function
 * @param {string|Function} [config.color] - Color or function
 * @param {string|Function} [config.tooltip] - Tooltip or function
 * @param {Function} [config.onClick] - Click handler
 * @param {Function} [config.render] - Custom render function (for type='custom')
 * @param {Function} [config.onAttach] - Called when widget attached to DOM
 * @param {Function} [config.onDetach] - Called when widget detached
 * @param {boolean} [config.disabled] - If true with replaces, hides element entirely
 * @returns {boolean} Success
 */
export function registerWidget(moduleId, config) {
  if (!moduleId || !config?.id) {
    log(2, 'registerWidget requires moduleId and config.id');
    return false;
  }

  if (!config.insertAt && !config.replaces) {
    log(2, 'registerWidget requires either insertAt or replaces');
    return false;
  }

  if (config.insertAt && !Object.values(WIDGET_POINTS).includes(config.insertAt)) {
    log(2, `Invalid insertion point: ${config.insertAt}`);
    return false;
  }

  if (config.replaces && !Object.values(REPLACEABLE_ELEMENTS).includes(config.replaces)) {
    log(2, `Invalid replaceable element: ${config.replaces}`);
    return false;
  }

  const fullId = `${moduleId}.${config.id}`;

  if (widgets.has(fullId)) {
    log(2, `Widget ${fullId} already registered`);
    return false;
  }

  if (config.replaces && replacements.has(config.replaces)) {
    log(2, `Element ${config.replaces} already replaced by ${replacements.get(config.replaces)}`);
    return false;
  }

  widgets.set(fullId, { moduleId, fullId, ...config });
  if (config.replaces) replacements.set(config.replaces, fullId);
  log(3, `Widget registered: ${fullId}`);
  Hooks.callAll(HOOKS.WIDGET_REGISTERED, fullId, config);
  refreshWidgets();
  return true;
}

/**
 * Get all registered widgets.
 * @param {string} [insertPoint] - Filter by insertion point
 * @returns {Array<object>} Widget configs
 */
export function getRegisteredWidgets(insertPoint) {
  const all = Array.from(widgets.values());
  if (!insertPoint) return all;
  return all.filter((w) => w.insertAt === insertPoint);
}

/**
 * Get widgets for a specific insertion point (excludes replacements).
 * @param {string} insertPoint - Insertion point
 * @returns {Array<object>} Widget configs
 */
export function getWidgetsForPoint(insertPoint) {
  return Array.from(widgets.values()).filter((w) => w.insertAt === insertPoint && !w.replaces);
}

/**
 * Get widget that replaces a built-in element.
 * @param {string} elementId - Element ID
 * @returns {object|null} Widget config or null
 */
export function getWidgetByReplacement(elementId) {
  const fullId = replacements.get(elementId);
  return fullId ? widgets.get(fullId) : null;
}

/**
 * Check if an element has been replaced.
 * @param {string} elementId - Element ID
 * @returns {boolean} True if replaced
 */
export function isElementReplaced(elementId) {
  return replacements.has(elementId);
}

/**
 * Trigger refresh of all widget displays.
 */
export function refreshWidgets() {
  Hooks.callAll(HOOKS.WIDGETS_REFRESH);
}

/**
 * Resolve a value that may be a function.
 * @param {*} value - Value or function
 * @returns {*} Resolved value
 */
function resolveValue(value) {
  return typeof value === 'function' ? value() : value;
}

/**
 * Get button class for location.
 * @param {string} location - Location identifier (hud, minical, bigcal)
 * @returns {string} CSS class
 */
function getButtonClass(location) {
  switch (location) {
    case 'hud':
      return 'calendaria-hud-btn';
    case 'minical':
      return 'sidebar-btn';
    default:
      return '';
  }
}

/**
 * Render a button widget to HTML.
 * @param {object} widget - Widget config
 * @param {string} location - Location identifier
 * @returns {string} HTML string
 */
function renderButton(widget, location) {
  const icon = resolveValue(widget.icon);
  const tooltip = resolveValue(widget.tooltip);
  const label = resolveValue(widget.label);
  const baseClass = getButtonClass(location);
  const moduleClass = `widget-${widget.moduleId}`;
  return `<button type="button" class="${baseClass} calendaria-widget ${moduleClass}" data-widget-id="${widget.fullId}" ${tooltip ? `data-tooltip="${tooltip}"` : ''}>${icon ? `<i class="${icon}"></i>` : ''}${label && !icon ? label : ''}</button>`;
}

/**
 * Render an indicator widget to HTML.
 * @param {object} widget - Widget config
 * @param {string} location - Location identifier
 * @returns {string} HTML string
 */
function renderIndicator(widget, location) {
  const icon = resolveValue(widget.icon);
  const label = resolveValue(widget.label);
  const color = resolveValue(widget.color);
  const tooltip = resolveValue(widget.tooltip);
  const style = color ? `style="--widget-color: ${color}"` : '';
  const clickable = widget.onClick ? ' clickable' : '';
  const moduleClass = `widget-${widget.moduleId}`;
  return `<span class="calendaria-widget-indicator ${moduleClass}${clickable}" data-widget-id="${widget.fullId}" ${style} ${tooltip ? `data-tooltip="${tooltip}"` : ''}>${icon ? `<i class="${icon}"></i>` : ''}${label ? `<span class="widget-label">${label}</span>` : ''}</span>`;
}

/**
 * Render a custom widget to HTML.
 * @param {object} widget - Widget config
 * @param {string} location - Location identifier
 * @returns {string} HTML string
 */
function renderCustom(widget, location) {
  if (typeof widget.render !== 'function') return '';
  const content = widget.render(location);
  const moduleClass = `widget-${widget.moduleId}`;
  return `<div class="calendaria-widget-custom ${moduleClass}" data-widget-id="${widget.fullId}">${content || ''}</div>`;
}

/**
 * Render widgets for an insertion point.
 * @param {string} insertPoint - Insertion point
 * @param {string} [location] - Location identifier for custom widgets
 * @returns {string} HTML string
 */
export function renderWidgetsForPoint(insertPoint, location = 'hud') {
  const pointWidgets = getWidgetsForPoint(insertPoint);
  if (!pointWidgets.length) return '';
  return pointWidgets
    .map((widget) => {
      switch (widget.type) {
        case 'button':
          return renderButton(widget, location);
        case 'indicator':
          return renderIndicator(widget, location);
        case 'custom':
          return renderCustom(widget, location);
        default:
          return '';
      }
    })
    .join('');
}

/**
 * Render a replacement widget or return original HTML.
 * @param {string} elementId - Built-in element ID
 * @param {string} originalHtml - Original HTML if not replaced
 * @param {string} [location] - Location identifier
 * @returns {string} HTML string
 */
export function renderReplacementOrOriginal(elementId, originalHtml, location = 'hud') {
  const replacement = getWidgetByReplacement(elementId);
  if (!replacement) return originalHtml;
  if (replacement.disabled) return '';
  switch (replacement.type) {
    case 'indicator':
      return renderIndicator(replacement, location);
    case 'button':
      return renderButton(replacement, location);
    case 'custom':
      return renderCustom(replacement, location);
    default:
      return originalHtml;
  }
}

/**
 * Attach click listeners to widget elements in a container.
 * @param {HTMLElement} container - Container element
 */
export function attachWidgetListeners(container) {
  if (!container) return;
  const widgetEls = container.querySelectorAll('[data-widget-id]');
  for (const el of widgetEls) {
    const widgetId = el.dataset.widgetId;
    const widget = widgets.get(widgetId);
    if (widget?.onClick) {
      el.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        widget.onClick(event);
      });
    }
    if (widget?.onAttach) widget.onAttach(el);
  }
}

/**
 * Detach widgets and call cleanup callbacks.
 * @param {HTMLElement} container - Container element
 */
export function detachWidgetListeners(container) {
  if (!container) return;
  const widgetEls = container.querySelectorAll('[data-widget-id]');
  for (const el of widgetEls) {
    const widgetId = el.dataset.widgetId;
    const widget = widgets.get(widgetId);
    if (widget?.onDetach) widget.onDetach(el);
  }
}

/**
 * Check if any widgets are registered.
 * @returns {boolean} True if widgets exist
 */
export function hasWidgets() {
  return widgets.size > 0;
}

/**
 * Check if any widgets target a specific point.
 * @param {string} insertPoint - Insertion point
 * @returns {boolean} True if widgets exist for point
 */
export function hasWidgetsForPoint(insertPoint) {
  return getWidgetsForPoint(insertPoint).length > 0;
}
