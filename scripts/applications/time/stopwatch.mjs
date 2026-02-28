/* global PIXI */
/**
 * Stopwatch Application - Timer with real-time and game-time modes.
 * Renders a realistic physical stopwatch face via PixiJS.
 * @module Applications/Stopwatch
 * @author Tyler
 */

import { HOOKS, MODULE, SETTINGS, SOCKET_TYPES, TEMPLATES } from '../../constants.mjs';
import TimeClock from '../../time/time-clock.mjs';
import { DEFAULT_FORMAT_PRESETS, formatDuration, formatGameDuration, getDisplayFormat } from '../../utils/formatting/format-utils.mjs';
import { localize } from '../../utils/localization.mjs';
import { CalendariaSocket } from '../../utils/socket.mjs';

import * as StickyZones from '../../utils/ui/sticky-zones.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Stopwatch HUD for tracking elapsed time.
 */
export class Stopwatch extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {boolean} Whether the stopwatch is running */
  #running = false;

  /** @type {number} Elapsed milliseconds (real-time mode) */
  #elapsedMs = 0;

  /** @type {number} Elapsed game seconds (game-time mode) */
  #elapsedGameSeconds = 0;

  /** @type {number|null} Start timestamp for real-time mode */
  #startTime = null;

  /** @type {number|null} Start world time for game-time mode */
  #startWorldTime = null;

  /** @type {number|null} Hook ID for world time updated */
  #timeHookId = null;

  /** @type {number|null} Hook ID for visual tick */
  #visualTickHookId = null;

  /** @type {Array<{elapsed: number, label: string}>} Recorded lap times */
  #laps = [];

  /** @type {string} Current mode: 'realtime' or 'gametime' */
  #mode = 'gametime';

  /** @type {object|null} Active sticky zone during drag */
  #activeSnapZone = null;

  /** @type {string|null} ID of zone stopwatch is snapped to */
  #snappedZoneId = null;

  /** @type {object|null} Notification settings */
  #notification = null;

  /** @type {number|null} Notification threshold in ms/seconds */
  #notificationThreshold = null;

  /** @type {boolean} Whether notification has fired */
  #notificationFired = false;

  /** @type {PIXI.Application|null} PixiJS application instance */
  #pixiApp = null;

  /** @type {PIXI.Graphics|null} Second hand graphic */
  #secondHand = null;

  /** @type {PIXI.Graphics|null} Minute sub-hand graphic */
  #minuteSubHand = null;

  /** @type {PIXI.Container|null} Container for all dial graphics */
  #dialContainer = null;

  /** @param {object} options - Application options */
  constructor(options = {}) {
    super(options);
    this.#restoreStateSync();
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-stopwatch',
    classes: ['calendaria', 'stopwatch'],
    position: { width: 'auto', height: 'auto', zIndex: 100 },
    window: { frame: false, positioned: true },
    actions: {
      start: Stopwatch.#onStart,
      pause: Stopwatch.#onPause,
      reset: Stopwatch.#onReset,
      lap: Stopwatch.#onLap,
      toggleMode: Stopwatch.#onToggleMode,
      clearLaps: Stopwatch.#onClearLaps,
      openNotification: Stopwatch.#onOpenNotification
    }
  };

  /** @override */
  static PARTS = { main: { template: TEMPLATES.STOPWATCH } };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.running = this.#running;
    context.mode = this.#mode;
    context.modeLabel = this.#mode === 'realtime' ? localize('CALENDARIA.Stopwatch.RealTime') : localize('CALENDARIA.Stopwatch.GameTime');
    context.elapsed = this.#getDisplayTime();
    context.laps = this.#laps.map((lap, i) => ({ index: i + 1, elapsed: this.#formatLapTime(lap.elapsed), label: lap.label }));
    context.hasLaps = this.#laps.length > 0;
    context.hasNotification = this.#notificationThreshold !== null;
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (options.isFirstRender) {
      this.#restoreState();
      this.#restorePosition();
    }
    this.#initPixi();
    this.#enableDragging();
    this.#enableResizing();
    this.#setupContextMenu();
    if (this.#running) {
      if (this.#mode === 'gametime') this.#registerTimeHook();
    }
  }

  /** @override */
  async close(options = {}) {
    if (!game.user.isGM && game.settings.get(MODULE.ID, SETTINGS.FORCE_STOPWATCH)) {
      ui.notifications.warn('CALENDARIA.Common.ForcedDisplayWarning', { localize: true });
      return;
    }
    return super.close({ animate: false, ...options });
  }

  /** @override */
  _onClose(options) {
    this.#saveState();
    this.#destroyPixi();
    this.#unregisterTimeHook();
    StickyZones.unregisterFromZoneUpdates(this);
    StickyZones.unpinFromZone(this.element);
    StickyZones.cleanupSnapIndicator();
    super._onClose(options);
  }

  // ── PixiJS Rendering ──────────────────────────────────────────────────

  /**
   * Initialize the PixiJS application and build the stopwatch face.
   * @private
   */
  #initPixi() {
    const canvas = this.element.querySelector('.stopwatch-canvas');
    if (!canvas) return;

    // Destroy previous instance if re-rendering
    this.#destroyPixi();

    const size = this.#getSize();
    canvas.width = size;
    canvas.height = size;

    this.#pixiApp = new PIXI.Application({ view: canvas, width: size, height: size, backgroundAlpha: 0, antialias: true });
    this.#buildStopwatchFace();
    this.#pixiApp.ticker.add(this.#onPixiTick, this);
  }

  /**
   * Destroy the PixiJS application and clean up references.
   * @private
   */
  #destroyPixi() {
    if (this.#pixiApp) {
      this.#pixiApp.ticker.remove(this.#onPixiTick, this);
      this.#pixiApp.destroy(true);
      this.#pixiApp = null;
    }
    this.#secondHand = null;
    this.#minuteSubHand = null;
    this.#dialContainer = null;
  }

  /**
   * Rebuild the dial after resize.
   * @private
   */
  #rebuildDial() {
    if (!this.#pixiApp) return;
    const size = this.#getSize();
    const canvas = this.element.querySelector('.stopwatch-canvas');
    if (canvas) {
      canvas.width = size;
      canvas.height = size;
    }
    this.#pixiApp.renderer.resize(size, size);
    this.#pixiApp.stage.removeChildren();
    this.#secondHand = null;
    this.#minuteSubHand = null;
    this.#dialContainer = null;
    this.#buildStopwatchFace();
  }

  /**
   * Read a CSS custom property from the element and convert to hex number.
   * @param {string} prop - CSS variable name
   * @param {number} fallback - Fallback hex color
   * @returns {number} Hex color value
   * @private
   */
  #cssColor(prop, fallback) {
    const raw = getComputedStyle(this.element).getPropertyValue(prop)?.trim();
    if (!raw) return fallback;
    // Handle hex strings
    if (raw.startsWith('#')) {
      const hex = raw.replace('#', '');
      return parseInt(
        hex.length === 3
          ? hex
              .split('')
              .map((c) => c + c)
              .join('')
          : hex,
        16
      );
    }
    // Handle rgb(r, g, b)
    const match = raw.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (match) return (parseInt(match[1]) << 16) | (parseInt(match[2]) << 8) | parseInt(match[3]);
    return fallback;
  }

  /**
   * Build all static and dynamic stopwatch face elements.
   * @private
   */
  #buildStopwatchFace() {
    const app = this.#pixiApp;
    if (!app) return;

    const size = this.#pixiApp.renderer.width;
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.46;
    const bezelWidth = size * 0.035;
    const dialR = outerR - bezelWidth;

    // Theme colors
    const textColor = this.#cssColor('--calendaria-text', 0x333333);
    const bgColor = this.#cssColor('--calendaria-bg', 0x2a2a2a);
    const borderColor = this.#cssColor('--calendaria-border', 0x888888);
    const errorColor = this.#cssColor('--calendaria-error', 0xcc3333);

    this.#dialContainer = new PIXI.Container();
    this.#pixiApp.stage.addChild(this.#dialContainer);

    // 1. Crown ring (lanyard loop)
    this.#drawCrownRing(cx, cy, outerR, size, borderColor);

    // 2. Crown stem (push button)
    this.#drawCrownStem(cx, cy, outerR, size, borderColor);

    // 3. Outer bezel ring
    this.#drawBezel(cx, cy, outerR, bezelWidth, borderColor);

    // 4. Dial face (theme background)
    this.#drawDialFace(cx, cy, dialR, bgColor);

    // 5. Minute track (60 tick marks)
    this.#drawMinuteTrack(cx, cy, dialR, textColor);

    // 6. Numerals at 5-second positions
    this.#drawNumerals(cx, cy, dialR, textColor, size);

    // 7. Sub-dial at 6 o'clock
    const subDialCy = cy + dialR * 0.38;
    const subDialR = dialR * 0.22;
    this.#drawSubDial(cx, subDialCy, subDialR, textColor, bgColor, size);

    // 8. Brand text "Calendaria"
    this.#drawBrandText(cx, cy, dialR, textColor, size);

    // 9. Second hand
    this.#secondHand = this.#drawSecondHand(cx, cy, dialR, errorColor, size);

    // 10. Minute sub-hand
    this.#minuteSubHand = this.#drawMinuteSubHand(cx, subDialCy, subDialR, textColor, size);

    // 11. Center pivot
    this.#drawCenterPivot(cx, cy, size, borderColor);
  }

  /**
   * Draw the lanyard ring above the crown.
   * @param cx
   * @param cy
   * @param outerR
   * @param size
   * @param color
   * @private
   */
  #drawCrownRing(cx, cy, outerR, size, color) {
    const g = new PIXI.Graphics();
    const ringCy = cy - outerR - size * 0.09;
    const ringR = size * 0.04;
    const thickness = size * 0.012;
    g.lineStyle(thickness, color, 0.7);
    g.drawCircle(cx, ringCy, ringR);
    this.#dialContainer.addChild(g);
  }

  /**
   * Draw the crown/stem button at 12 o'clock.
   * @param cx
   * @param cy
   * @param outerR
   * @param size
   * @param color
   * @private
   */
  #drawCrownStem(cx, cy, outerR, size, color) {
    const g = new PIXI.Graphics();
    const stemW = size * 0.06;
    const stemH = size * 0.08;
    const stemX = cx - stemW / 2;
    const stemY = cy - outerR - stemH + size * 0.01;

    // Stem body
    g.beginFill(color, 0.9);
    g.drawRoundedRect(stemX, stemY, stemW, stemH, size * 0.015);
    g.endFill();

    // Highlight
    g.beginFill(0xffffff, 0.15);
    g.drawRoundedRect(stemX + stemW * 0.15, stemY + stemH * 0.1, stemW * 0.3, stemH * 0.8, size * 0.008);
    g.endFill();

    this.#dialContainer.addChild(g);
  }

  /**
   * Draw the outer metallic bezel ring.
   * @param cx
   * @param cy
   * @param outerR
   * @param bezelWidth
   * @param color
   * @private
   */
  #drawBezel(cx, cy, outerR, bezelWidth, color) {
    const g = new PIXI.Graphics();

    // Outer shadow ring
    g.beginFill(0x000000, 0.25);
    g.drawCircle(cx, cy + 2, outerR + 2);
    g.endFill();

    // Main bezel (dark metallic)
    g.beginFill(color, 0.85);
    g.drawCircle(cx, cy, outerR);
    g.endFill();

    // Inner cutout to form ring
    g.beginFill(0x000000, 1);
    g.drawCircle(cx, cy, outerR - bezelWidth);
    g.endFill();

    // Highlight arc (top-left)
    g.lineStyle(bezelWidth * 0.4, 0xffffff, 0.12);
    g.arc(cx, cy, outerR - bezelWidth / 2, Math.PI * 1.2, Math.PI * 1.8);

    // Shadow arc (bottom-right)
    g.lineStyle(bezelWidth * 0.4, 0x000000, 0.15);
    g.arc(cx, cy, outerR - bezelWidth / 2, Math.PI * 0.2, Math.PI * 0.8);

    this.#dialContainer.addChild(g);
  }

  /**
   * Draw the dial face using the theme background color.
   * @param cx
   * @param cy
   * @param dialR
   * @param bgColor
   * @private
   */
  #drawDialFace(cx, cy, dialR, bgColor) {
    const g = new PIXI.Graphics();
    g.beginFill(bgColor, 1);
    g.drawCircle(cx, cy, dialR);
    g.endFill();

    // Subtle inner shadow
    g.lineStyle(2, 0x000000, 0.06);
    g.drawCircle(cx, cy, dialR - 1);

    this.#dialContainer.addChild(g);
  }

  /**
   * Draw 60 tick marks around the dial perimeter.
   * @param cx
   * @param cy
   * @param dialR
   * @param color
   * @private
   */
  #drawMinuteTrack(cx, cy, dialR, color) {
    const g = new PIXI.Graphics();
    const outerTick = dialR * 0.92;
    for (let i = 0; i < 60; i++) {
      const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
      const isMajor = i % 5 === 0;
      const innerTick = isMajor ? dialR * 0.8 : dialR * 0.86;
      const thickness = isMajor ? 2 : 1;
      g.lineStyle(thickness, color, isMajor ? 0.9 : 0.4);
      g.moveTo(cx + Math.cos(angle) * innerTick, cy + Math.sin(angle) * innerTick);
      g.lineTo(cx + Math.cos(angle) * outerTick, cy + Math.sin(angle) * outerTick);
    }
    this.#dialContainer.addChild(g);
  }

  /**
   * Draw numerals at 5-second positions.
   * @param cx
   * @param cy
   * @param dialR
   * @param color
   * @param size
   * @private
   */
  #drawNumerals(cx, cy, dialR, color, size) {
    const numeralR = dialR * 0.7;
    const fontSize = Math.max(8, size * 0.065);
    for (let i = 1; i <= 12; i++) {
      const num = i * 5;
      const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
      const text = new PIXI.Text(String(num), {
        fontFamily: 'Arial, sans-serif',
        fontSize,
        fontWeight: 'bold',
        fill: color,
        align: 'center'
      });
      text.anchor.set(0.5);
      text.x = cx + Math.cos(angle) * numeralR;
      text.y = cy + Math.sin(angle) * numeralR;
      this.#dialContainer.addChild(text);
    }
  }

  /**
   * Draw the minute sub-dial at the given position.
   * @param subCx
   * @param subCy
   * @param subR
   * @param color
   * @param bgColor
   * @param size
   * @private
   */
  #drawSubDial(subCx, subCy, subR, color, bgColor, size) {
    const g = new PIXI.Graphics();

    // Sub-dial background
    g.beginFill(bgColor, 1);
    g.drawCircle(subCx, subCy, subR);
    g.endFill();

    // Sub-dial border
    g.lineStyle(1.5, color, 0.5);
    g.drawCircle(subCx, subCy, subR);

    // Sub-dial tick marks (30 marks for 0-30 minutes)
    const outerTick = subR * 0.88;
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2 - Math.PI / 2;
      const isMajor = i % 5 === 0;
      const innerTick = isMajor ? subR * 0.68 : subR * 0.78;
      g.lineStyle(isMajor ? 1.5 : 0.5, color, isMajor ? 0.8 : 0.3);
      g.moveTo(subCx + Math.cos(angle) * innerTick, subCy + Math.sin(angle) * innerTick);
      g.lineTo(subCx + Math.cos(angle) * outerTick, subCy + Math.sin(angle) * outerTick);
    }

    this.#dialContainer.addChild(g);

    // Sub-dial numerals (0, 10, 20, 30 — but mapped as 0, 5, 10, 15, 20, 25, 30)
    const subFontSize = Math.max(5, size * 0.032);
    const labels = [0, 5, 10, 15, 20, 25, 30];
    // Skip 0 at top (overlaps with tick); draw 5,10,15,20,25,30 — but 30 and 0 overlap
    // Use 6 labels at even spacing: 5, 10, 15, 20, 25, 30
    for (let i = 0; i < 6; i++) {
      const num = (i + 1) * 5;
      const angle = ((i + 1) / 6) * Math.PI * 2 - Math.PI / 2;
      const numeralR = subR * 0.5;
      const text = new PIXI.Text(String(num), {
        fontFamily: 'Arial, sans-serif',
        fontSize: subFontSize,
        fill: color,
        align: 'center'
      });
      text.anchor.set(0.5);
      text.x = subCx + Math.cos(angle) * numeralR;
      text.y = subCy + Math.sin(angle) * numeralR;
      this.#dialContainer.addChild(text);
    }
  }

  /**
   * Draw the "Calendaria" brand text below 12 o'clock.
   * @param cx
   * @param cy
   * @param dialR
   * @param color
   * @param size
   * @private
   */
  #drawBrandText(cx, cy, dialR, color, size) {
    const fontSize = Math.max(6, size * 0.045);
    const text = new PIXI.Text('Calendaria', {
      fontFamily: 'serif',
      fontSize,
      fontStyle: 'italic',
      fill: color,
      align: 'center',
      letterSpacing: 1
    });
    text.anchor.set(0.5);
    text.x = cx;
    text.y = cy - dialR * 0.32;
    text.alpha = 0.6;
    this.#dialContainer.addChild(text);
  }

  /**
   * Draw the main second hand with counterweight tail.
   * @param {number} cx - Center X
   * @param {number} cy - Center Y
   * @param {number} dialR - Dial radius
   * @param {number} color - Hand color
   * @param {number} size - Total size
   * @returns {PIXI.Graphics} The second hand graphic
   * @private
   */
  #drawSecondHand(cx, cy, dialR, color, size) {
    const g = new PIXI.Graphics();
    g.pivot.set(0, 0);
    g.x = cx;
    g.y = cy;

    const handLength = dialR * 0.85;
    const tailLength = dialR * 0.2;
    const handWidth = Math.max(1, size * 0.008);
    const tailWidth = Math.max(2, size * 0.02);

    // Main hand (thin, pointing up from center)
    g.beginFill(color, 1);
    g.moveTo(-handWidth / 2, 0);
    g.lineTo(0, -handLength);
    g.lineTo(handWidth / 2, 0);
    g.endFill();

    // Counterweight tail (wider, pointing down)
    g.beginFill(color, 1);
    g.moveTo(-tailWidth / 2, 0);
    g.lineTo(0, tailLength);
    g.lineTo(tailWidth / 2, 0);
    g.endFill();

    // Small circle at base
    g.beginFill(color, 1);
    g.drawCircle(0, 0, tailWidth * 0.4);
    g.endFill();

    this.#pixiApp.stage.addChild(g);
    return g;
  }

  /**
   * Draw the minute hand inside the sub-dial.
   * @param {number} subCx - Sub-dial center X
   * @param {number} subCy - Sub-dial center Y
   * @param {number} subR - Sub-dial radius
   * @param {number} color - Hand color
   * @param {number} size - Total size
   * @returns {PIXI.Graphics} The minute sub-hand graphic
   * @private
   */
  #drawMinuteSubHand(subCx, subCy, subR, color, size) {
    const g = new PIXI.Graphics();
    g.pivot.set(0, 0);
    g.x = subCx;
    g.y = subCy;

    const handLength = subR * 0.75;
    const handWidth = Math.max(1.5, size * 0.012);

    // Tapered hand
    g.beginFill(color, 0.9);
    g.moveTo(-handWidth / 2, 0);
    g.lineTo(0, -handLength);
    g.lineTo(handWidth / 2, 0);
    g.endFill();

    // Center dot
    g.beginFill(color, 0.9);
    g.drawCircle(0, 0, handWidth);
    g.endFill();

    this.#pixiApp.stage.addChild(g);
    return g;
  }

  /**
   * Draw the center pivot dot.
   * @param cx
   * @param cy
   * @param size
   * @param color
   * @private
   */
  #drawCenterPivot(cx, cy, size, color) {
    const g = new PIXI.Graphics();
    const pivotR = size * 0.025;

    // Metallic center
    g.beginFill(color, 0.9);
    g.drawCircle(cx, cy, pivotR);
    g.endFill();

    // Highlight
    g.beginFill(0xffffff, 0.3);
    g.drawCircle(cx - pivotR * 0.2, cy - pivotR * 0.2, pivotR * 0.5);
    g.endFill();

    this.#pixiApp.stage.addChild(g);
  }

  /**
   * PixiJS ticker callback — update hand rotations each frame.
   * @private
   */
  #onPixiTick() {
    if (!this.#secondHand || !this.#minuteSubHand) return;

    const totalSeconds = this.#getTotalSeconds();
    // Rotate second hand
    this.#secondHand.rotation = ((totalSeconds % 60) / 60) * Math.PI * 2;
    // Rotate minute sub-hand (30-minute range)
    this.#minuteSubHand.rotation = (((totalSeconds / 60) % 30) / 30) * Math.PI * 2;

    // Update display text and check notification
    if (this.#running) {
      const timeEl = this.element?.querySelector('.time');
      if (timeEl) timeEl.innerHTML = this.#getDisplayTime();
      this.#checkNotification();
    }
  }

  /**
   * Get total elapsed seconds for hand positioning.
   * @returns {number} Total seconds
   * @private
   */
  #getTotalSeconds() {
    if (this.#mode === 'realtime') {
      let totalMs = this.#elapsedMs;
      if (this.#running && this.#startTime) totalMs += Date.now() - this.#startTime;
      return totalMs / 1000;
    }
    let total = this.#elapsedGameSeconds;
    if (this.#running && this.#startWorldTime !== null) {
      const worldTime = TimeClock.running ? TimeClock.predictedWorldTime : game.time.worldTime;
      total += worldTime - this.#startWorldTime;
    }
    return total;
  }

  // ── Format / Display ──────────────────────────────────────────────────

  /**
   * Get the current format setting based on mode.
   * @returns {string} Format string
   * @private
   */
  #getFormat() {
    const locationId = this.#mode === 'realtime' ? 'stopwatchRealtime' : 'stopwatchGametime';
    const defaultFormat = this.#mode === 'realtime' ? 'stopwatchRealtimeFull' : 'stopwatchGametimeFull';
    const formatSetting = getDisplayFormat(locationId) || defaultFormat;
    return DEFAULT_FORMAT_PRESETS[formatSetting] || formatSetting;
  }

  /**
   * Get formatted display time based on current mode.
   * @returns {string} Formatted elapsed time
   * @private
   */
  #getDisplayTime() {
    const format = this.#getFormat();
    let raw;
    if (this.#mode === 'realtime') {
      let total = this.#elapsedMs;
      if (this.#running && this.#startTime) total += Date.now() - this.#startTime;
      raw = formatDuration(total, format);
    } else {
      let total = this.#elapsedGameSeconds;
      if (this.#running && this.#startWorldTime !== null) {
        const worldTime = TimeClock.running ? TimeClock.predictedWorldTime : game.time.worldTime;
        total += worldTime - this.#startWorldTime;
      }
      raw = formatGameDuration(total, game.time?.calendar, format);
    }
    // Wrap millisecond portion in a span for smaller rendering
    const dotIdx = raw.lastIndexOf('.');
    if (dotIdx !== -1) return `${raw.slice(0, dotIdx)}<span class="ms">.${raw.slice(dotIdx + 1)}</span>`;
    return raw;
  }

  /**
   * Format lap time based on current mode.
   * @param {number} elapsed - Elapsed time
   * @returns {string} Formatted lap time
   * @private
   */
  #formatLapTime(elapsed) {
    const format = this.#getFormat();
    if (this.#mode === 'realtime') return formatDuration(elapsed, format);
    return formatGameDuration(elapsed, game.time?.calendar, format);
  }

  /**
   * Get current total elapsed time.
   * @returns {number} Total elapsed (ms for realtime, seconds for gametime)
   * @private
   */
  #getCurrentElapsed() {
    if (this.#mode === 'realtime') {
      let total = this.#elapsedMs;
      if (this.#running && this.#startTime) total += Date.now() - this.#startTime;
      return total;
    }
    let total = this.#elapsedGameSeconds;
    if (this.#running && this.#startWorldTime !== null) {
      const worldTime = TimeClock.running ? TimeClock.predictedWorldTime : game.time.worldTime;
      total += worldTime - this.#startWorldTime;
    }
    return total;
  }

  // ── Actions ───────────────────────────────────────────────────────────

  /**
   * Start the stopwatch.
   * @private
   */
  static #onStart() {
    this.#running = true;
    if (this.#mode === 'realtime') {
      this.#startTime = Date.now();
    } else {
      this.#startWorldTime = TimeClock.running ? TimeClock.predictedWorldTime : game.time.worldTime;
      this.#registerTimeHook();
      if (game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_AUTO_START_TIME)) TimeClock.start();
    }
    this.#notificationFired = false;
    this.#saveState();
    this.render();
    Hooks.callAll(HOOKS.STOPWATCH_START, { mode: this.#mode });
  }

  /**
   * Pause the stopwatch and accumulate elapsed time.
   * @private
   */
  static #onPause() {
    if (this.#mode === 'realtime') {
      if (this.#startTime) this.#elapsedMs += Date.now() - this.#startTime;
      this.#startTime = null;
    } else {
      if (this.#startWorldTime !== null) {
        const worldTime = TimeClock.running ? TimeClock.predictedWorldTime : game.time.worldTime;
        this.#elapsedGameSeconds += worldTime - this.#startWorldTime;
      }
      this.#startWorldTime = null;
      this.#unregisterTimeHook();
    }
    this.#running = false;
    this.#saveState();
    this.render();
    Hooks.callAll(HOOKS.STOPWATCH_PAUSE, { mode: this.#mode, elapsed: this.#getCurrentElapsed() });
  }

  /**
   * Reset the stopwatch to zero and clear laps.
   * @private
   */
  static #onReset() {
    this.#unregisterTimeHook();
    this.#running = false;
    this.#elapsedMs = 0;
    this.#elapsedGameSeconds = 0;
    this.#startTime = null;
    this.#startWorldTime = null;
    this.#laps = [];
    this.#notificationFired = false;
    this.#saveState();
    this.render();
    Hooks.callAll(HOOKS.STOPWATCH_RESET, { mode: this.#mode });
  }

  /**
   * Record a lap at the current elapsed time.
   * @private
   */
  static #onLap() {
    if (!this.#running) return;
    const elapsed = this.#getCurrentElapsed();
    this.#laps.push({ elapsed, label: `${localize('CALENDARIA.Stopwatch.Lap')} ${this.#laps.length + 1}` });
    this.#saveState();
    this.render();
    Hooks.callAll(HOOKS.STOPWATCH_LAP, { mode: this.#mode, lap: this.#laps.length, elapsed });
  }

  /**
   * Toggle between realtime and gametime modes.
   * @private
   */
  static #onToggleMode() {
    if (this.#running) {
      if (this.#mode === 'realtime') {
        if (this.#startTime) this.#elapsedMs += Date.now() - this.#startTime;
      } else {
        if (this.#startWorldTime !== null) {
          const worldTime = TimeClock.running ? TimeClock.predictedWorldTime : game.time.worldTime;
          this.#elapsedGameSeconds += worldTime - this.#startWorldTime;
        }
        this.#unregisterTimeHook();
      }
    }
    this.#mode = this.#mode === 'realtime' ? 'gametime' : 'realtime';
    this.#elapsedMs = 0;
    this.#elapsedGameSeconds = 0;
    this.#startTime = null;
    this.#startWorldTime = null;
    this.#running = false;
    this.#laps = [];
    this.#notificationFired = false;
    this.#saveState();
    this.render();
  }

  /**
   * Clear all recorded laps.
   * @private
   */
  static #onClearLaps() {
    this.#laps = [];
    this.#saveState();
    this.render();
  }

  /**
   * Open the notification configuration dialog.
   * @private
   */
  static async #onOpenNotification() {
    const currentSound = this.#notification?.sound || 'sounds/notify.wav';
    const content = `
      <div class="form-group">
        <label>${localize('CALENDARIA.Stopwatch.NotificationThreshold')}</label>
        <input type="number" name="threshold" value="${this.#notificationThreshold ?? ''}" min="1" placeholder="${localize('CALENDARIA.Stopwatch.ThresholdPlaceholder')}" />
        <p class="hint">${this.#mode === 'realtime' ? localize('CALENDARIA.Stopwatch.ThresholdHintRealtime') : localize('CALENDARIA.Stopwatch.ThresholdHintGametime')}</p>
      </div>
      <div class="form-group">
        <label>${localize('CALENDARIA.Stopwatch.NotificationType')}</label>
        <select name="type">
          <option value="toast" ${this.#notification?.type === 'toast' ? 'selected' : ''}>${localize('CALENDARIA.Stopwatch.NotificationToast')}</option>
          <option value="sound" ${this.#notification?.type === 'sound' ? 'selected' : ''}>${localize('CALENDARIA.Stopwatch.NotificationSound')}</option>
          <option value="both" ${this.#notification?.type === 'both' ? 'selected' : ''}>${localize('CALENDARIA.Stopwatch.NotificationBoth')}</option>
        </select>
      </div>
      <div class="form-group">
        <label>${localize('CALENDARIA.Stopwatch.NotificationSoundFile')}</label>
        <div class="form-fields">
          <input type="text" name="sound" value="${currentSound}" placeholder="sounds/notify.wav" />
          <button type="button" class="file-picker" data-type="audio" data-target="sound" data-tooltip="${localize('FILES.BrowseTooltip')}">
            <i class="fas fa-file-audio"></i>
          </button>
        </div>
      </div>
    `;
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: localize('CALENDARIA.Stopwatch.ConfigureNotification'), icon: 'fas fa-bell' },
      content,
      render: (_event, dialog) => {
        const form = dialog.element.querySelector('form');
        const filePickerBtn = form.querySelector('.file-picker');
        filePickerBtn?.addEventListener('click', async () => {
          const fp = new foundry.applications.apps.FilePicker({
            type: 'audio',
            current: form.sound.value || 'sounds/',
            callback: (path) => {
              form.sound.value = path;
            }
          });
          fp.browse();
        });
      },
      buttons: [
        {
          action: 'save',
          label: localize('CALENDARIA.Common.Save'),
          icon: 'fas fa-save',
          callback: (_event, _button, dialog) => {
            const form = dialog.element.querySelector('form');
            const threshold = parseInt(form.threshold.value) || null;
            const type = form.type.value;
            const sound = form.sound.value || 'sounds/notify.wav';
            return { threshold, type, sound };
          }
        },
        {
          action: 'clear',
          label: localize('CALENDARIA.Stopwatch.ClearNotification'),
          icon: 'fas fa-times',
          callback: () => ({ threshold: null, type: null, sound: null })
        }
      ],
      rejectClose: false
    });
    if (result) {
      this.#notificationThreshold = result.threshold;
      this.#notification = result.threshold ? { type: result.type, sound: result.sound } : null;
      this.#notificationFired = false;
      this.#saveState();
      this.render();
    }
  }

  // ── Game Time Hooks ───────────────────────────────────────────────────

  /**
   * Register hooks for game-time updates.
   * @private
   */
  #registerTimeHook() {
    if (!this.#timeHookId) this.#timeHookId = Hooks.on(HOOKS.WORLD_TIME_UPDATED, this.#onWorldTimeUpdated.bind(this));
    if (!this.#visualTickHookId) this.#visualTickHookId = Hooks.on(HOOKS.VISUAL_TICK, this.#onVisualTick.bind(this));
  }

  /**
   * Unregister game-time hooks.
   * @private
   */
  #unregisterTimeHook() {
    if (this.#timeHookId) {
      Hooks.off(HOOKS.WORLD_TIME_UPDATED, this.#timeHookId);
      this.#timeHookId = null;
    }
    if (this.#visualTickHookId) {
      Hooks.off(HOOKS.VISUAL_TICK, this.#visualTickHookId);
      this.#visualTickHookId = null;
    }
  }

  /**
   * Handle visual tick for game-time display updates.
   * @private
   */
  #onVisualTick() {
    if (!this.#running || this.#mode !== 'gametime') return;
    // PixiJS ticker handles hand rotation; just update digital display
    const timeEl = this.element?.querySelector('.time');
    if (timeEl) timeEl.innerHTML = this.#getDisplayTime();
  }

  /**
   * Handle world time update for notification checks.
   * @private
   */
  #onWorldTimeUpdated() {
    if (!this.#running || this.#mode !== 'gametime') return;
    this.#checkNotification();
  }

  // ── Notifications ─────────────────────────────────────────────────────

  /**
   * Check if elapsed time has reached the notification threshold.
   * @private
   */
  #checkNotification() {
    if (!this.#notificationThreshold || this.#notificationFired) return;
    const elapsed = this.#getCurrentElapsed();
    const threshold = this.#mode === 'realtime' ? this.#notificationThreshold * 1000 : this.#notificationThreshold;
    if (elapsed >= threshold) {
      this.#fireNotification();
      this.#notificationFired = true;
    }
  }

  /**
   * Fire the notification toast and/or sound.
   * @private
   */
  #fireNotification() {
    const type = this.#notification?.type || 'toast';
    const sound = this.#notification?.sound || 'sounds/notify.wav';
    const message = localize('CALENDARIA.Stopwatch.NotificationMessage');
    if (type === 'toast' || type === 'both') ui.notifications.info(`<i class="fas fa-stopwatch"></i> ${message}`);
    if (type === 'sound' || type === 'both') foundry.audio.AudioHelper.play({ src: sound, volume: 1, autoplay: true });
  }

  // ── State Persistence ─────────────────────────────────────────────────

  /**
   * Persist stopwatch state to world settings.
   * @private
   */
  #saveState() {
    const state = {
      running: this.#running,
      mode: this.#mode,
      elapsedMs: this.#elapsedMs,
      elapsedGameSeconds: this.#elapsedGameSeconds,
      savedAt: Date.now(),
      savedWorldTime: game.time?.worldTime ?? 0,
      laps: this.#laps,
      notification: this.#notification,
      notificationThreshold: this.#notificationThreshold,
      notificationFired: this.#notificationFired
    };
    game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_STATE, state);
  }

  /**
   * Restore state synchronously in constructor (for template context).
   * @private
   */
  #restoreStateSync() {
    const state = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STATE);
    if (!state) return;
    this.#mode = state.mode || 'gametime';
    this.#running = state.running || false;
    this.#laps = state.laps || [];
    this.#notification = state.notification || null;
    this.#notificationThreshold = state.notificationThreshold ?? null;
    this.#notificationFired = state.notificationFired || false;
    this.#elapsedMs = state.elapsedMs || 0;
    this.#elapsedGameSeconds = state.elapsedGameSeconds || 0;
  }

  /**
   * Restore running state after render, accounting for elapsed offline time.
   * @private
   */
  #restoreState() {
    const state = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STATE);
    if (!state?.running) return;
    if (this.#mode === 'realtime' && state.savedAt) {
      this.#elapsedMs += Date.now() - state.savedAt;
      this.#startTime = Date.now();
    } else if (this.#mode === 'gametime' && state.savedWorldTime !== undefined) {
      this.#elapsedGameSeconds += game.time.worldTime - state.savedWorldTime;
      this.#startWorldTime = TimeClock.running ? TimeClock.predictedWorldTime : game.time.worldTime;
      this.#registerTimeHook();
    }
  }

  // ── Position / Size ───────────────────────────────────────────────────

  /**
   * Restore saved position from settings.
   * @private
   */
  #restorePosition() {
    const savedPos = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_POSITION);
    if (savedPos) {
      if (savedPos.size) this.#setSize(savedPos.size);
      if (typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
        this.#snappedZoneId = savedPos.zoneId || null;
        if (this.#snappedZoneId && StickyZones.restorePinnedState(this.element, this.#snappedZoneId)) {
          StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
          return;
        }
        if (this.#snappedZoneId) {
          const rect = this.element.getBoundingClientRect();
          const zonePos = StickyZones.getRestorePosition(this.#snappedZoneId, rect.width, rect.height);
          if (zonePos) {
            this.setPosition({ left: zonePos.left, top: zonePos.top });
            StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
            return;
          }
        }
        this.setPosition({ left: savedPos.left, top: savedPos.top });
      }
    } else {
      this.setPosition({ left: 150, top: 150 });
    }
    this.#clampToViewport();
  }

  /**
   * Clamp the stopwatch position within the viewport bounds.
   * @private
   */
  #clampToViewport() {
    const rect = this.element.getBoundingClientRect();
    const rightBuffer = StickyZones.getSidebarBuffer();
    let { left, top } = this.position;
    left = Math.max(0, Math.min(left, window.innerWidth - rect.width - rightBuffer));
    top = Math.max(0, Math.min(top, window.innerHeight - rect.height));
    this.setPosition({ left, top });
  }

  /**
   * Set the stopwatch size via CSS variable and rebuild PixiJS dial.
   * @param {number} size - Size in pixels
   */
  #setSize(size) {
    const clamped = Math.max(100, Math.min(400, size));
    this.element.style.setProperty('--stopwatch-size', `${clamped}px`);
    this.#rebuildDial();
  }

  /**
   * Get current size.
   * @returns {number} Current size in pixels
   */
  #getSize() {
    if (!this.element) return 140;
    const computed = getComputedStyle(this.element).getPropertyValue('--stopwatch-size');
    return parseInt(computed) || 140;
  }

  // ── Dragging ──────────────────────────────────────────────────────────

  /**
   * Set up mouse-based dragging on the stopwatch face.
   * @private
   */
  #enableDragging() {
    const dragHandle = this.element.querySelector('.face');
    if (!dragHandle) return;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let elementStartLeft = 0;
    let elementStartTop = 0;
    let previousZoneId = null;
    const onMouseMove = (event) => {
      if (!isDragging) return;
      event.preventDefault();
      const deltaX = event.clientX - dragStartX;
      const deltaY = event.clientY - dragStartY;
      const rect = this.element.getBoundingClientRect();
      const rightBuffer = StickyZones.getSidebarBuffer();
      let newLeft = elementStartLeft + deltaX;
      let newTop = elementStartTop + deltaY;
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width - rightBuffer));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));
      this.setPosition({ left: newLeft, top: newTop });
      this.#activeSnapZone = StickyZones.checkStickyZones(dragHandle, newLeft, newTop, rect.width, rect.height);
    };
    const onMouseUp = async (event) => {
      if (!isDragging) return;
      isDragging = false;
      event.preventDefault();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      const rect = this.element.getBoundingClientRect();
      const result = StickyZones.finalizeDrag(dragHandle, this.#activeSnapZone, this, rect.width, rect.height, previousZoneId);
      this.#snappedZoneId = result.zoneId;
      StickyZones.registerForZoneUpdates(this, this.#snappedZoneId);
      this.#activeSnapZone = null;
      previousZoneId = null;
      await this.#savePosition();
    };
    dragHandle.addEventListener('mousedown', (event) => {
      if (event.target.closest('.sw-btn')) return;
      event.preventDefault();
      isDragging = true;
      previousZoneId = this.#snappedZoneId;
      if (previousZoneId && StickyZones.usesDomParenting(previousZoneId)) {
        const preserved = StickyZones.unpinFromZone(this.element);
        if (preserved) {
          elementStartLeft = preserved.left;
          elementStartTop = preserved.top;
        }
      } else {
        const rect = this.element.getBoundingClientRect();
        elementStartLeft = rect.left;
        elementStartTop = rect.top;
      }
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  /**
   * Set up mouse-based resizing via the resize handle.
   * @private
   */
  #enableResizing() {
    const handle = this.element.querySelector('.resize-handle');
    if (!handle) return;
    let startX = 0;
    let startY = 0;
    let startSize = 0;
    const onMouseMove = (event) => {
      event.preventDefault();
      const delta = event.clientX - startX;
      const clamped = Math.max(100, Math.min(400, startSize + delta));
      this.element.style.setProperty('--stopwatch-size', `${clamped}px`);
      this.#rebuildDial();
    };
    const onMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      await this.#savePosition();
    };
    handle.addEventListener('mousedown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      startX = event.clientX;
      startY = event.clientY;
      startSize = this.#getSize();
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  /**
   * Save current position and size to settings.
   * @private
   */
  async #savePosition() {
    await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_POSITION, { left: this.position.left, top: this.position.top, size: this.#getSize(), zoneId: this.#snappedZoneId });
  }

  // ── Context Menu ──────────────────────────────────────────────────────

  /**
   * Set up the right-click context menu on the stopwatch face.
   * @private
   */
  #setupContextMenu() {
    const container = this.element.querySelector('.face');
    container?.addEventListener('contextmenu', (e) => {
      if (e.target.closest('#context-menu')) return;
      e.preventDefault();
      document.getElementById('context-menu')?.remove();
      const menu = new foundry.applications.ux.ContextMenu.implementation(this.element, '.face', this.#getContextMenuItems(), { fixed: true, jQuery: false });
      menu._onActivate(e);
    });
  }

  /**
   * Get context menu items for the Stopwatch.
   * @returns {object[]} Array of context menu item configs
   * @private
   */
  #getContextMenuItems() {
    const items = [];
    items.push({
      name: 'CALENDARIA.Stopwatch.ContextMenu.ResetPosition',
      icon: '<i class="fas fa-arrows-to-dot"></i>',
      callback: () => this.resetPosition()
    });
    const stickyStates = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STICKY_STATES) || {};
    const isLocked = stickyStates.position ?? false;
    items.push({
      name: isLocked ? 'CALENDARIA.Stopwatch.ContextMenu.UnlockPosition' : 'CALENDARIA.Stopwatch.ContextMenu.LockPosition',
      icon: `<i class="fas fa-${isLocked ? 'unlock' : 'lock'}"></i>`,
      callback: () => this.#toggleStickyPosition()
    });
    if (game.user.isGM) {
      const forceStopwatch = game.settings.get(MODULE.ID, SETTINGS.FORCE_STOPWATCH);
      items.push({
        name: forceStopwatch ? 'CALENDARIA.Stopwatch.ContextMenu.HideFromAll' : 'CALENDARIA.Stopwatch.ContextMenu.ShowToAll',
        icon: `<i class="fas fa-${forceStopwatch ? 'eye-slash' : 'eye'}"></i>`,
        callback: async () => {
          const newValue = !forceStopwatch;
          await game.settings.set(MODULE.ID, SETTINGS.FORCE_STOPWATCH, newValue);
          CalendariaSocket.emit(SOCKET_TYPES.STOPWATCH_VISIBILITY, { visible: newValue });
        }
      });
    }
    items.push({ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => this.close() });
    return items;
  }

  /**
   * Toggle position lock state.
   * @private
   */
  async #toggleStickyPosition() {
    const current = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STICKY_STATES) || {};
    const newLocked = !(current.position ?? false);
    await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_STICKY_STATES, { ...current, position: newLocked });
    ui.notifications.info(newLocked ? 'CALENDARIA.Stopwatch.ContextMenu.PositionLocked' : 'CALENDARIA.Stopwatch.ContextMenu.PositionUnlocked', { localize: true });
  }

  /**
   * Reset position to default and clear any sticky zone.
   */
  async resetPosition() {
    StickyZones.unregisterFromZoneUpdates(this);
    StickyZones.unpinFromZone(this.element);
    this.#snappedZoneId = null;
    this.setPosition({ left: 150, top: 150 });
    await game.settings.set(MODULE.ID, SETTINGS.STOPWATCH_POSITION, { left: 150, top: 150, size: 140, zoneId: null });
    ui.notifications.info('CALENDARIA.Stopwatch.ContextMenu.PositionReset', { localize: true });
  }

  // ── Static API ────────────────────────────────────────────────────────

  /**
   * Get the singleton instance from Foundry's application registry.
   * @returns {Stopwatch|undefined} The instance if it exists
   */
  static get instance() {
    return foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
  }

  /**
   * Show the Stopwatch.
   * @returns {Stopwatch} The instance
   */
  static show() {
    const instance = this.instance ?? new Stopwatch();
    instance.render({ force: true });
    return instance;
  }

  /** Hide the Stopwatch. */
  static hide() {
    this.instance?.close();
  }

  /** Toggle the Stopwatch visibility. */
  static toggle() {
    if (this.instance?.rendered) this.hide();
    else this.show();
  }

  /** Show and start the Stopwatch. */
  static start() {
    const instance = this.instance?.rendered ? this.instance : this.show();
    if (!instance.#running) Stopwatch.#onStart.call(instance);
  }

  /** Pause the running Stopwatch. */
  static pause() {
    const instance = this.instance;
    if (instance && instance.#running) Stopwatch.#onPause.call(instance);
  }

  /** Toggle between start and pause. */
  static toggleStartPause() {
    const instance = this.instance?.rendered ? this.instance : this.show();
    if (instance.#running) Stopwatch.#onPause.call(instance);
    else Stopwatch.#onStart.call(instance);
  }

  /** Reset the Stopwatch to zero. */
  static reset() {
    if (this.instance) Stopwatch.#onReset.call(this.instance);
  }

  /**
   * Restore stopwatch from saved state on world load.
   */
  static restore() {
    const state = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_STATE);
    if (!state?.running) return;

    this.show();
  }

  /**
   * Update the idle opacity CSS variable from settings.
   */
  static updateIdleOpacity() {
    const autoFade = game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_AUTO_FADE);
    const opacity = autoFade ? game.settings.get(MODULE.ID, SETTINGS.STOPWATCH_IDLE_OPACITY) / 100 : 1;
    document.documentElement.style.setProperty('--calendaria-stopwatch-idle-opacity', opacity);
  }
}
