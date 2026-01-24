/**
 * Sticky Zones Utility for HUD Docking
 * Uses DOM reparenting (SmallTime-style) for seamless anchor tracking.
 * @module Utils/StickyZones
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../constants.mjs';
import { log } from './logger.mjs';

/** Snap detection radius in pixels */
export const SNAP_DISTANCE = 50;

/** CSS class for wobble animation */
export const WOBBLE_CLASS = 'near-snap';

/** Buffer pixels between windows and sidebar */
const SIDEBAR_BUFFER = 8;

/**
 * Get the right-side boundary buffer (Foundry sidebar width + buffer).
 * @returns {number} Pixels to reserve on the right side
 */
export function getSidebarBuffer() {
  const allowOverlap = game.settings.get(MODULE.ID, SETTINGS.ALLOW_SIDEBAR_OVERLAP);
  if (allowOverlap) return SIDEBAR_BUFFER;
  const sidebar = document.getElementById('sidebar');
  const sidebarWidth = sidebar && !sidebar.classList.contains('collapsed') ? sidebar.offsetWidth : 0;
  return sidebarWidth + SIDEBAR_BUFFER;
}

/** CSS class for pinned/docked state */
export const PINNED_CLASS = 'calendaria-pinned';

/** @type {HTMLElement|null} Shared snap indicator element */
let snapIndicator = null;

/** @type {HTMLElement[]} Debug zone indicators */
let debugIndicators = [];

/**
 * Show debug indicators for all sticky zones (temporary debugging).
 * @param {number} hudWidth - Width of the HUD element
 * @param {number} hudHeight - Height of the HUD element
 */
export function showDebugZones(hudWidth = 200, hudHeight = 100) {
  hideDebugZones();
  const zones = getStickyZones(hudWidth, hudHeight);
  for (const zone of zones) {
    const el = document.createElement('div');
    el.className = 'calendaria-debug-zone';
    el.style.cssText = `
      position: fixed;
      left: ${zone.center.x - SNAP_DISTANCE}px;
      top: ${zone.center.y - SNAP_DISTANCE}px;
      width: ${SNAP_DISTANCE * 2}px;
      height: ${SNAP_DISTANCE * 2}px;
      background: rgba(255, 0, 255, 0.3);
      border: 0.125rem solid magenta;
      border-radius: 50%;
      pointer-events: none;
      z-index: 9999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.625rem;
      color: magenta;
      font-weight: bold;
    `;
    el.textContent = zone.id;
    document.body.appendChild(el);
    debugIndicators.push(el);
  }
  log(3, 'Sticky zones:', zones);
}

/**
 * Hide debug zone indicators.
 */
export function hideDebugZones() {
  debugIndicators.forEach((el) => el.remove());
  debugIndicators = [];
}

/**
 * Zone definitions with DOM insertion info.
 * @type {Object<string, {insertMethod: string, getAnchor: Function}>}
 */
const ZONE_CONFIG = {
  'top-center': { insertMethod: 'none' },
  'above-hotbar': { insertMethod: 'none' },
  'above-players': {
    insertMethod: 'before',
    getAnchor: () => document.getElementById('players')
  },
  'below-controls': { insertMethod: 'none' }
};

/**
 * Get sticky zone definitions with current positions for detection.
 * @param {number} hudWidth - Width of the HUD element
 * @param {number} hudHeight - Height of the HUD element
 * @returns {Array<object>} Array of zone definitions
 */
export function getStickyZones(hudWidth, hudHeight) {
  const zones = [];
  const isSliceMode = !!document.querySelector('.calendaria-hud.slice-mode, .calendaria-hud.compact');
  const topCenterY = isSliceMode ? 16 + hudHeight / 2 : 80 + hudHeight / 2;
  zones.push({ id: 'top-center', center: { x: window.innerWidth / 2, y: topCenterY } });
  const hotbar = document.getElementById('hotbar');
  if (hotbar) {
    const rect = hotbar.getBoundingClientRect();
    zones.push({ id: 'above-hotbar', center: { x: rect.left + rect.width / 2, y: rect.top }, anchor: 'bottom' });
  }

  const players = document.getElementById('players');
  if (players) {
    const rect = players.getBoundingClientRect();
    zones.push({ id: 'above-players', center: { x: Math.max(rect.left + hudWidth / 2, hudWidth / 2 + 20), y: rect.top - hudHeight / 2 - 10 } });
  }

  const controls = document.getElementById('scene-controls');
  if (controls) {
    const layersItems = document.querySelectorAll('#scene-controls-layers > li');
    const toolsItems = document.querySelectorAll('#scene-controls-tools > li');
    const lastLayerItem = layersItems[layersItems.length - 1];
    const lastToolItem = toolsItems[toolsItems.length - 1];
    const layersBottom = lastLayerItem?.getBoundingClientRect().bottom ?? 0;
    const toolsBottom = lastToolItem?.getBoundingClientRect().bottom ?? 0;
    const bottomY = Math.max(layersBottom, toolsBottom);
    const controlsRect = controls.getBoundingClientRect();
    zones.push({ id: 'below-controls', center: { x: controlsRect.left + hudWidth / 2, y: bottomY + hudHeight / 2 + 10 } });
  }

  return zones;
}

/**
 * Find the active sticky zone based on HUD position.
 * @param {number} hudCenterX - HUD center X coordinate
 * @param {number} hudCenterY - HUD center Y coordinate
 * @param {number} hudWidth - Width of the HUD element
 * @param {number} hudHeight - Height of the HUD element
 * @returns {object|null} Active zone or null
 */
export function getActiveZone(hudCenterX, hudCenterY, hudWidth, hudHeight) {
  if (!game.settings.get(MODULE.ID, SETTINGS.HUD_STICKY_ZONES_ENABLED)) return null;
  const zones = getStickyZones(hudWidth, hudHeight);
  for (const zone of zones) {
    const dx = hudCenterX - zone.center.x;
    const hudCompareY = zone.anchor === 'bottom' ? hudCenterY + hudHeight / 2 : hudCenterY;
    const dy = hudCompareY - zone.center.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance <= SNAP_DISTANCE) return zone;
  }
  return null;
}

/**
 * Get snap preview position for indicator display.
 * @param {object} zone - Zone definition
 * @param {number} hudWidth - Width of the HUD element
 * @param {number} hudHeight - Height of the HUD element
 * @returns {{left: number, top: number}} Position for indicator
 */
function getIndicatorPosition(zone, hudWidth, hudHeight) {
  const left = zone.center.x - hudWidth / 2;
  const top = zone.anchor === 'bottom' ? zone.center.y - hudHeight : zone.center.y - hudHeight / 2;
  return { left, top };
}

/**
 * Show or update the snap indicator.
 * @param {object} zone - Zone to show indicator for
 * @param {number} hudWidth - Width of the HUD element
 * @param {number} hudHeight - Height of the HUD element
 */
export function showSnapIndicator(zone, hudWidth, hudHeight) {
  if (!snapIndicator) {
    snapIndicator = document.createElement('div');
    snapIndicator.className = 'calendaria-snap-indicator';
    document.body.appendChild(snapIndicator);
  }
  const pos = getIndicatorPosition(zone, hudWidth, hudHeight);
  snapIndicator.style.left = `${pos.left}px`;
  snapIndicator.style.top = `${pos.top}px`;
  snapIndicator.style.width = `${hudWidth}px`;
  snapIndicator.style.height = `${hudHeight}px`;
  snapIndicator.classList.add('visible');
}

/**
 * Hide the snap indicator.
 */
export function hideSnapIndicator() {
  if (snapIndicator) snapIndicator.classList.remove('visible');
}

/**
 * Clean up snap indicator (call on app close).
 */
export function cleanupSnapIndicator() {
  if (snapIndicator) {
    snapIndicator.remove();
    snapIndicator = null;
  }
}

/**
 * Check for sticky zones during drag and update visual feedback.
 * @param {HTMLElement} dragHandle - The drag handle element
 * @param {number} newLeft - New left position
 * @param {number} newTop - New top position
 * @param {number} hudWidth - Width of the HUD element
 * @param {number} hudHeight - Height of the HUD element
 * @returns {object|null} Active zone or null
 */
export function checkStickyZones(dragHandle, newLeft, newTop, hudWidth, hudHeight) {
  const hudCenterX = newLeft + hudWidth / 2;
  const hudCenterY = newTop + hudHeight / 2;
  const zone = getActiveZone(hudCenterX, hudCenterY, hudWidth, hudHeight);
  if (zone) {
    dragHandle.classList.add(WOBBLE_CLASS);
    showSnapIndicator(zone, hudWidth, hudHeight);
  } else {
    dragHandle.classList.remove(WOBBLE_CLASS);
    hideSnapIndicator();
  }
  return zone;
}

/**
 * Pin an element to a zone using DOM reparenting.
 * @param {HTMLElement} element - The element to pin
 * @param {string} zoneId - The zone ID
 */
export function pinToZone(element, zoneId) {
  const config = ZONE_CONFIG[zoneId];
  if (!config || config.insertMethod === 'none') return;
  const anchor = config.getAnchor?.();
  if (!anchor) return;
  element.classList.add(PINNED_CLASS);
  element.style.position = 'relative';
  element.style.left = '';
  element.style.top = '';
  if (config.insertMethod === 'before') anchor.parentElement?.insertBefore(element, anchor);
  else if (config.insertMethod === 'after') anchor.parentElement?.insertBefore(element, anchor.nextSibling);
  else if (config.insertMethod === 'prepend') anchor.prepend(element);
  else if (config.insertMethod === 'append') anchor.append(element);
}

/**
 * Unpin an element from DOM parenting back to body with fixed positioning.
 * @param {HTMLElement} element - The element to unpin
 * @returns {{left: number, top: number}|null} The preserved position, or null if not pinned
 */
export function unpinFromZone(element) {
  if (!element?.classList?.contains(PINNED_CLASS)) return null;
  const rect = element.getBoundingClientRect();
  element.classList.remove(PINNED_CLASS);
  element.style.position = 'fixed';
  element.style.left = `${rect.left}px`;
  element.style.top = `${rect.top}px`;
  document.body.appendChild(element);
  return { left: rect.left, top: rect.top };
}

/**
 * Check if a zone uses DOM parenting.
 * @param {string} zoneId - Zone ID
 * @returns {boolean} True if zone uses DOM parenting
 */
export function usesDomParenting(zoneId) {
  const config = ZONE_CONFIG[zoneId];
  return config && config.insertMethod !== 'none';
}

/**
 * Finalize drag - snap to zone if active, clean up visuals.
 * @param {HTMLElement} dragHandle - The drag handle element
 * @param {object|null} activeZone - Currently active zone
 * @param {object} app - The application instance
 * @param {number} hudWidth - Width of the HUD element
 * @param {number} hudHeight - Height of the HUD element
 * @param {string|null} previousZoneId - Previously pinned zone ID
 * @returns {{zoneId: string|null}} Zone ID if snapped
 */
export function finalizeDrag(dragHandle, activeZone, app, hudWidth, hudHeight, previousZoneId = null) {
  dragHandle.classList.remove(WOBBLE_CLASS);
  hideSnapIndicator();
  if (previousZoneId && usesDomParenting(previousZoneId)) unpinFromZone(app.element);
  if (activeZone) {
    if (usesDomParenting(activeZone.id)) {
      pinToZone(app.element, activeZone.id);
    } else {
      const pos = getZonePosition(activeZone.id, hudWidth, hudHeight);
      if (pos) app.setPosition({ left: pos.left, top: pos.top });
    }
    return { zoneId: activeZone.id };
  }

  return { zoneId: null };
}

/**
 * Check if a zone is still valid (anchor element exists and is usable).
 * @param {string} zoneId - The zone ID to check
 * @returns {boolean} Whether the zone is valid
 */
export function isZoneValid(zoneId) {
  return !!ZONE_CONFIG[zoneId];
}

/**
 * Check if a zone uses bottom anchoring.
 * @param {string} zoneId - The zone ID to check
 * @returns {boolean} Whether the zone uses bottom anchoring
 */
export function isBottomAnchored(zoneId) {
  return zoneId === 'above-hotbar';
}

/**
 * Get position for restoring a pinned zone (fixed-position zones only).
 * @param {string|null} zoneId - Zone ID to restore
 * @param {number} hudWidth - HUD width
 * @param {number} hudHeight - HUD height
 * @returns {{left: number, top: number}|null} Position or null if invalid/DOM-parented
 */
export function getRestorePosition(zoneId, hudWidth, hudHeight) {
  if (!zoneId || !isZoneValid(zoneId)) return null;
  if (usesDomParenting(zoneId)) return null;
  return getZonePosition(zoneId, hudWidth, hudHeight);
}

/**
 * Restore pinned state for a DOM-parented zone.
 * Call this on first render to re-pin elements that were saved to a DOM-parented zone.
 * @param {HTMLElement} element - The element to restore
 * @param {string|null} zoneId - The saved zone ID
 * @returns {boolean} True if element was pinned
 */
export function restorePinnedState(element, zoneId) {
  if (!zoneId || !usesDomParenting(zoneId)) return false;
  pinToZone(element, zoneId);
  return true;
}

/**
 * Get the position for a zone (for fixed-position zones).
 * @param {string} zoneId - Zone ID
 * @param {number} hudWidth - HUD width
 * @param {number} hudHeight - HUD height
 * @returns {{left: number, top: number}|null} Position or null if zone not found
 */
export function getZonePosition(zoneId, hudWidth, hudHeight) {
  const zones = getStickyZones(hudWidth, hudHeight);
  const zone = zones.find((z) => z.id === zoneId);
  if (!zone) return null;
  const left = zone.center.x - hudWidth / 2;
  const top = zone.anchor === 'bottom' ? zone.center.y - hudHeight : zone.center.y - hudHeight / 2;
  return { left, top };
}

/** @type {Set<{app: object, zoneId: string}>} Registered apps for position updates */
const registeredApps = new Set();

/**
 * Register an app for automatic position updates when its zone changes.
 * @param {object} app - The application instance
 * @param {string} zoneId - The zone ID the app is snapped to
 */
export function registerForZoneUpdates(app, zoneId) {
  for (const entry of registeredApps) {
    if (entry.app === app) {
      registeredApps.delete(entry);
      break;
    }
  }
  if (zoneId) registeredApps.add({ app, zoneId });
}

/**
 * Unregister an app from position updates.
 * @param {object} app - The application instance
 */
export function unregisterFromZoneUpdates(app) {
  for (const entry of registeredApps) {
    if (entry.app === app) {
      registeredApps.delete(entry);
      break;
    }
  }
}

/**
 * Update positions of all apps snapped to a specific zone.
 * Call this from hooks when zone anchor elements change.
 * @param {string} zoneId - The zone ID to update
 */
export function updateZonePositions(zoneId) {
  for (const { app, zoneId: appZoneId } of registeredApps) {
    if (appZoneId === zoneId && app.rendered) {
      const rect = app.element.getBoundingClientRect();
      const pos = getZonePosition(zoneId, rect.width, rect.height);
      if (pos) app.setPosition({ left: pos.left, top: pos.top });
    }
  }
}
