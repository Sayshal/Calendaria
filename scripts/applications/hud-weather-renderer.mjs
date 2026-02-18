/**
 * PixiJS-based weather particle renderer for HUD overlays.
 * Works identically in dome (semicircular) and slice (rectangular) modes.
 * Creates randomized particle effects driven by weather state.
 * Uses Foundry's bundled PIXI global (v7.4.3).
 * @module Applications/HudWeatherRenderer
 */

/* global PIXI */

import { log } from '../utils/logger.mjs';

/**
 * Effect configuration definitions.
 * Each effect maps to particle textures, counts, colors, and behaviors.
 * @type {Object<string, object>}
 */
const EFFECT_CONFIGS = {
  clear: { particles: 0 },
  'clouds-light': {
    texture: 'cloud',
    textureVariants: ['cloud', 'cloud2', 'cloud3', 'cloud4', 'cloud5', 'cloud6', 'cloud7'],
    count: [3, 5],
    tint: [0xffffff, 0xe8e8ee],
    alpha: [0.85, 1.0],
    scale: [1.2, 2.2],
    speed: { x: [0.15, 0.3], y: [0, 0] },
    gravity: 0,
    wobble: 0,
    noWindY: true
  },
  'clouds-heavy': {
    texture: 'cloud',
    textureVariants: ['cloud', 'cloud2', 'cloud3', 'cloud4', 'cloud5', 'cloud6', 'cloud7'],
    count: [10, 16],
    tint: [0xccccdd, 0xffffff],
    alpha: [0.85, 1.0],
    scale: [1.5, 2.5],
    speed: { x: [0.08, 0.2], y: [0, 0] },
    gravity: 0,
    wobble: 0,
    noWindY: true
  },
  'clouds-overcast': {
    texture: 'cloud',
    textureVariants: ['cloud', 'cloud2', 'cloud3', 'cloud4', 'cloud5', 'cloud6', 'cloud7'],
    count: [18, 25],
    tint: [0x999999, 0x777788],
    alpha: [0.85, 1.0],
    scale: [2.0, 3.5],
    speed: { x: [0.02, 0.05], y: [0, 0] },
    gravity: 0,
    wobble: 0,
    noWindY: true
  },
  rain: {
    texture: 'raindrop',
    count: [20, 45],
    tint: [0xaaccee, 0xccddff],
    alpha: [0.5, 0.8],
    scale: [0.6, 1.0],
    speed: { x: [0.2, 0.4], y: [3, 5] },
    gravity: 0.05,
    wobble: 0
  },
  'rain-heavy': {
    texture: 'raindrop',
    count: [60, 100],
    tint: [0x99bbdd, 0xaaccee],
    alpha: [0.6, 0.9],
    scale: [1.0, 1.8],
    speed: { x: [0.8, 1.5], y: [5, 8] },
    gravity: 0.08,
    wobble: 0
  },
  snow: {
    texture: 'snowflake',
    count: [20, 40],
    tint: [0xffffff, 0xeeeeff],
    alpha: [0.6, 1.0],
    scale: [0.3, 0.8],
    speed: { x: [0.1, 0.3], y: [0.5, 1.2] },
    gravity: 0.01,
    wobble: 0.02
  },
  'snow-heavy': {
    texture: 'snowflake',
    count: [100, 180],
    tint: [0xffffff, 0xddeeff],
    alpha: [0.7, 1.0],
    scale: [0.15, 0.4],
    speed: { x: [1.0, 2.0], y: [1.5, 3.0] },
    gravity: 0.02,
    wobble: 0.015
  },
  fog: {
    texture: 'fogBlob',
    count: [8, 14],
    tint: [0xdddddd, 0xeeeeee],
    alpha: [0.15, 0.35],
    scale: [2.0, 3.5],
    speed: { x: [0.05, 0.15], y: [0, 0.02] },
    gravity: 0,
    wobble: 0.001
  },
  lightning: {
    texture: 'raindrop',
    count: [40, 70],
    tint: [0x99bbdd, 0xaaccee],
    alpha: [0.5, 0.8],
    scale: [1.0, 1.8],
    speed: { x: [0.5, 1.0], y: [4, 7] },
    gravity: 0.06,
    wobble: 0,
    flash: true
  },
  hail: {
    texture: 'hailstone',
    count: [15, 30],
    tint: [0xccddee, 0xffffff],
    alpha: [0.7, 1.0],
    scale: [0.8, 1.5],
    speed: { x: [0.2, 0.5], y: [3.5, 5] },
    gravity: 0.04,
    wobble: 0,
    tumble: 0.1
  },
  tornado: {
    texture: 'debris',
    count: [40, 65],
    tint: [0x887766, 0x665544],
    alpha: [0.6, 0.9],
    scale: [0.6, 1.5],
    speed: { x: [1, 3], y: [0.5, 1.5] },
    gravity: -0.02,
    wobble: 0,
    vortex: true
  },
  hurricane: {
    texture: 'raindrop',
    count: [60, 100],
    tint: [0x88aacc, 0xaabbdd],
    alpha: [0.6, 0.9],
    scale: [1.0, 1.8],
    speed: { x: [3, 6], y: [0.5, 1.5] },
    gravity: 0.01,
    wobble: 0,
    horizontal: true
  },
  sand: {
    texture: 'grain',
    count: [240, 390],
    tint: [0x996633, 0xbb8844],
    alpha: [0.6, 0.9],
    scale: [0.8, 1.4],
    speed: { x: [2, 4], y: [0.3, 0.8] },
    gravity: 0.01,
    wobble: 0.005
  },
  ashfall: {
    texture: 'ash',
    count: [25, 45],
    tint: [0x888888, 0xaaaaaa],
    alpha: [0.5, 0.8],
    scale: [0.4, 1.0],
    speed: { x: [0.05, 0.2], y: [0.5, 1.2] },
    gravity: 0.008,
    wobble: 0.01,
    tumble: 0.03,
    mixed: { texture: 'ember', ratio: 0.2, tint: [0xff6600, 0xff9933], alpha: [0.7, 1.0] }
  },
  embers: {
    texture: 'ember',
    count: [12, 25],
    tint: [0xff6600, 0xff9933],
    alpha: [0.6, 1.0],
    scale: [0.5, 1.0],
    speed: { x: [0.1, 0.4], y: [-1.5, -0.5] },
    gravity: -0.02,
    wobble: 0.015
  },
  ice: {
    texture: 'shard',
    count: [8, 16],
    tint: [0xaaddff, 0xccefff],
    alpha: [0.6, 0.9],
    scale: [0.6, 1.2],
    speed: { x: [0.05, 0.15], y: [0.2, 0.5] },
    gravity: 0.005,
    wobble: 0.008,
    tumble: 0.02
  },
  nullstatic: {
    texture: 'pixel',
    count: [40, 65],
    tint: [0xffffff, 0x888888],
    alpha: [0.3, 0.7],
    scale: [0.8, 1.5],
    speed: { x: [0, 0], y: [0, 0] },
    gravity: 0,
    wobble: 0,
    flicker: true
  },
  gust: {
    texture: 'wisp',
    count: [5, 8],
    tint: [0xdddddd, 0xeeeeee],
    alpha: [0.08, 0.18],
    scale: [1.5, 3.0],
    speed: { x: [1.5, 3.0], y: [0, 0] },
    gravity: 0,
    wobble: 0
  },
  aurora: {
    texture: 'band',
    count: [6, 11],
    tint: [0x22ff66, 0xdd44ff],
    alpha: [0.3, 0.8],
    scale: [1.5, 2.8],
    speed: { x: [0.02, 0.08], y: [0, 0] },
    gravity: 0,
    wobble: 0,
    pulse: true
  },
  aether: {
    texture: 'fogBlob',
    count: [10, 18],
    tint: [0xee88dd, 0xcc66bb],
    alpha: [0.15, 0.35],
    scale: [1.5, 2.5],
    speed: { x: [0.05, 0.15], y: [0.01, 0.05] },
    gravity: 0,
    wobble: 0.003
  },
  void: {
    texture: 'wisp',
    count: [8, 12],
    tint: [0x880022, 0x440011],
    alpha: [0.5, 0.8],
    scale: [1.0, 2.0],
    speed: { x: [0.05, 0.15], y: [0.02, 0.08] },
    gravity: 0,
    wobble: 0.005,
    inward: true
  },
  spectral: {
    texture: 'wraith',
    count: [10, 16],
    tint: [0x66bbaa, 0x99ddcc],
    alpha: [0.5, 0.85],
    scale: [0.8, 1.8],
    speed: { x: [0.05, 0.12], y: [0, 0] },
    gravity: 0,
    wobble: 0,
    tumble: 0.008,
    swirl: true,
    noWindY: true
  },
  arcane: {
    texture: 'mote',
    count: [15, 28],
    tint: [0x4488ff, 0x66aaff],
    alpha: [0.6, 1.0],
    scale: [0.6, 1.2],
    speed: { x: [0.2, 0.6], y: [-2, -0.5] },
    gravity: -0.03,
    wobble: 0.02
  },
  'arcane-wind': {
    texture: 'fogBlob',
    count: [6, 10],
    tint: [0x000000, 0x000000],
    rainbow: true,
    alpha: [0.15, 0.35],
    scale: [1.5, 3.0],
    speed: { x: [0.4, 1.0], y: [0, 0] },
    gravity: 0,
    wobble: 0.002,
    pulse: true,
    mixed: { texture: 'mote', ratio: 0.5, tint: [0x000000, 0x000000], alpha: [0.8, 1.0], scale: [0.3, 0.6], flicker: true, extra: 20, rainbow: true }
  },
  veil: {
    texture: 'sheet',
    count: [4, 8],
    tint: [0xccbbdd, 0xeeddff],
    alpha: [0.2, 0.45],
    scale: [1.5, 2.5],
    speed: { x: [0.1, 0.25], y: [0.3, 0.6] },
    gravity: 0.005,
    wobble: 0.002
  },
  petals: {
    texture: 'petal',
    count: [12, 20],
    tint: [0xffaacc, 0xffd0e0],
    alpha: [0.6, 0.9],
    scale: [0.8, 1.5],
    speed: { x: [0.15, 0.4], y: [0.3, 0.8] },
    gravity: 0.01,
    wobble: 0.02,
    tumble: 0.05
  },
  sleet: {
    texture: 'raindrop',
    count: [30, 55],
    tint: [0xbbccdd, 0xddeeff],
    alpha: [0.5, 0.8],
    scale: [0.5, 0.9],
    speed: { x: [0.3, 0.6], y: [2.5, 4.5] },
    gravity: 0.04,
    wobble: 0.005,
    mixed: { texture: 'snowflake', ratio: 0.35, tint: [0xeeeeff, 0xffffff], alpha: [0.6, 0.9], scale: [0.2, 0.5] }
  },
  haze: {
    texture: 'wisp',
    count: [6, 10],
    tint: [0xffddaa, 0xffcc88],
    alpha: [0.06, 0.15],
    scale: [2.0, 3.5],
    speed: { x: [0.02, 0.06], y: [-0.3, -0.1] },
    gravity: -0.005,
    wobble: 0.001
  },
  leaves: {
    texture: 'petal',
    count: [10, 18],
    tint: [0xcc6622, 0xdd9933],
    alpha: [0.7, 1.0],
    scale: [0.8, 1.6],
    speed: { x: [0.2, 0.5], y: [0.4, 1.0] },
    gravity: 0.012,
    wobble: 0.025,
    tumble: 0.06
  },
  smoke: {
    texture: 'fogBlob',
    count: [10, 18],
    tint: [0x444444, 0x666666],
    alpha: [0.2, 0.45],
    scale: [1.8, 3.0],
    speed: { x: [0.06, 0.15], y: [-0.8, -0.3] },
    gravity: -0.01,
    wobble: 0.002
  },
  'rain-acid': {
    texture: 'raindrop',
    count: [25, 50],
    tint: [0x44cc44, 0x88ff66],
    alpha: [0.5, 0.8],
    scale: [0.6, 1.0],
    speed: { x: [0.2, 0.4], y: [3, 5] },
    gravity: 0.05,
    wobble: 0
  },
  'rain-blood': {
    texture: 'raindrop',
    count: [25, 50],
    tint: [0xaa1122, 0xcc3344],
    alpha: [0.5, 0.8],
    scale: [0.6, 1.0],
    speed: { x: [0.2, 0.4], y: [3, 5] },
    gravity: 0.05,
    wobble: 0
  },
  meteors: {
    texture: 'meteorRock',
    count: [1, 3],
    tint: [0x332211, 0x554433],
    alpha: [0.9, 1.0],
    scale: [1.35, 2.6],
    speed: { x: [0.8, 1.5], y: [1.5, 3] },
    gravity: 0.04,
    wobble: 0,
    tumble: 0.03,
    trail: { texture: 'ember', count: 14, tint: [0xff4400, 0xffaa22], alphaDecay: 0.82, scaleDecay: 0.88, spacing: 8 }
  },
  spores: {
    texture: 'mote',
    count: [15, 28],
    tint: [0x88bb44, 0xaadd66],
    alpha: [0.5, 0.9],
    scale: [0.4, 0.9],
    speed: { x: [0.05, 0.15], y: [-0.6, -0.2] },
    gravity: -0.008,
    wobble: 0.015
  },
  divine: {
    texture: 'mote',
    count: [12, 22],
    tint: [0xffdd44, 0xffee88],
    alpha: [0.6, 1.0],
    scale: [0.5, 1.2],
    speed: { x: [0.02, 0.08], y: [0.3, 0.8] },
    gravity: 0.005,
    wobble: 0.01,
    pulse: true
  },
  miasma: {
    texture: 'fogBlob',
    count: [10, 18],
    tint: [0x556b2f, 0x7a8b3a],
    alpha: [0.15, 0.35],
    scale: [1.8, 3.0],
    speed: { x: [0.03, 0.1], y: [0.01, 0.04] },
    gravity: 0,
    wobble: 0.002
  },
  'ley-surge': {
    texture: 'mote',
    count: [18, 32],
    tint: [0x000000, 0x000000],
    rainbow: true,
    alpha: [0.7, 1.0],
    scale: [0.5, 1.2],
    speed: { x: [0.15, 0.4], y: [-2.5, -0.8] },
    gravity: -0.04,
    wobble: 0.02,
    flash: true,
    flashUp: true,
    flashRainbow: true
  }
};

/**
 * Get the default effect configuration for a given effect ID.
 * @param {string} effectId - Effect ID from HUD_EFFECTS
 * @returns {object|null} Copy of the effect config, or null if not found
 */
export function getEffectDefaults(effectId) {
  const config = EFFECT_CONFIGS[effectId];
  if (!config) return null;
  return { ...config, speed: { ...config.speed } };
}

/**
 * Random number in range.
 * @param {number} min - Lower bound
 * @param {number} max - Upper bound
 * @returns {number} Random value between min and max
 */
function rand(min, max) {
  return min + Math.random() * (max - min);
}

/**
 * Random tint between two hex values.
 * @param {number[]} tints - [min, max] hex tints
 * @returns {number} Interpolated hex color
 */
function randTint(tints) {
  const t = Math.random();
  const r1 = (tints[0] >> 16) & 0xff;
  const g1 = (tints[0] >> 8) & 0xff;
  const b1 = tints[0] & 0xff;
  const r2 = (tints[1] >> 16) & 0xff;
  const g2 = (tints[1] >> 8) & 0xff;
  const b2 = tints[1] & 0xff;
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return (r << 16) | (g << 8) | b;
}

/**
 * Generate a fully saturated random hue as a hex color.
 * @returns {number} Hex color at full saturation
 */
function randHue() {
  const h = Math.random() * 360;
  const s = 1;
  const l = 0.55;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
}

/**
 * PixiJS-based weather particle renderer for HUD overlays.
 */
export class HudWeatherRenderer {
  /** @type {PIXI.Application} */
  #app = null;

  /** @type {PIXI.Container} */
  #container = null;

  /** @type {HTMLCanvasElement} The canvas this renderer is bound to */
  canvas = null;

  /** @type {string} */
  #currentEffect = 'clear';

  /** @type {Map<string, PIXI.Texture>} */
  #textures = new Map();

  /** @type {object[]} Particle state parallel to sprites */
  #particles = [];

  /** @type {PIXI.Sprite[]} Active sprite instances */
  #sprites = [];

  /** @type {object} Current weather options */
  #options = { windSpeed: 0, windDirection: 0, precipIntensity: 0 };

  /** @type {PIXI.Graphics|null} Lightning flash overlay */
  #flashOverlay = null;

  /** @type {PIXI.Graphics|null} Lightning bolt graphic */
  #boltOverlay = null;

  /** @type {number} Flash cooldown counter */
  #flashTimer = 0;

  /** @type {object|null} Active visual overrides */
  #visualOverrides = null;

  /** @type {boolean} Whether renderer has been destroyed */
  #destroyed = false;

  /**
   * @param {HTMLCanvasElement} canvas - Target canvas element
   */
  constructor(canvas) {
    this.canvas = canvas;
    const parent = canvas.parentElement;
    const parentRect = parent?.getBoundingClientRect();
    log(3, 'HudWeatherRenderer | constructor', { parentSize: parentRect ? `${parentRect.width}x${parentRect.height}` : 'no parent', canvasSize: `${canvas.width}x${canvas.height}` });
    this.#app = new PIXI.Application({ view: canvas, backgroundAlpha: 0, resizeTo: parent, antialias: true });
    log(3, 'HudWeatherRenderer | app created', { rendererType: this.#app.renderer?.type, screen: `${this.#app.screen.width}x${this.#app.screen.height}` });
    this.#container = new PIXI.Container();
    this.#app.stage.addChild(this.#container);
    this.#generateTextures();
    log(3, 'HudWeatherRenderer | textures generated:', [...this.#textures.keys()]);
    this.#app.ticker.add(this.#tick, this);
  }

  /**
   * Set the active weather effect and options. Rebuilds particle pool.
   * @param {string} effect - Effect ID from HUD_EFFECTS
   * @param {object} [options] - Weather parameters
   * @param {number} [options.windSpeed] - Wind speed (0-5)
   * @param {number} [options.windDirection] - Wind direction in degrees
   * @param {number} [options.precipIntensity] - Precipitation intensity (0-1)
   * @param {object|null} [visualOverrides] - Optional visual overrides to merge with base config
   */
  setEffect(effect, { windSpeed = 0, windDirection = 0, precipIntensity = 0 } = {}, visualOverrides = null) {
    if (this.#destroyed) return;
    this.#options = { windSpeed, windDirection, precipIntensity };
    const overridesChanged = JSON.stringify(this.#visualOverrides) !== JSON.stringify(visualOverrides);
    const changed = effect !== this.#currentEffect || overridesChanged;
    log(3, 'HudWeatherRenderer | setEffect', { effect, changed, windSpeed, windDirection, precipIntensity, hasOverrides: !!visualOverrides });
    if (!changed) return;
    this.#currentEffect = effect;
    this.#visualOverrides = visualOverrides;
    this.#clearParticles();
    this.#buildParticles();
  }

  /**
   * Merge visual overrides onto a base effect config.
   * @param {object} base - Base EFFECT_CONFIG entry
   * @param {object} overrides - Visual override fields
   * @returns {object} Merged config
   */
  #mergeConfig(base, overrides) {
    if (!overrides) return base;
    const merged = { ...base };
    if (overrides.count) merged.count = overrides.count;
    if (overrides.scale) merged.scale = overrides.scale;
    if (overrides.alpha) merged.alpha = overrides.alpha;
    if (overrides.tint) merged.tint = overrides.tint;
    if (overrides.speedX || overrides.speedY) {
      merged.speed = { ...base.speed };
      if (overrides.speedX) merged.speed.x = overrides.speedX;
      if (overrides.speedY) merged.speed.y = overrides.speedY;
    }
    if (overrides.gravity !== undefined) merged.gravity = overrides.gravity;
    if (overrides.wobble !== undefined) merged.wobble = overrides.wobble;
    return merged;
  }

  /** Destroy application and free all GPU resources. */
  destroy() {
    if (this.#destroyed) return;
    log(3, 'HudWeatherRenderer | destroy', { effect: this.#currentEffect, spriteCount: this.#sprites.length });
    this.#destroyed = true;
    this.#app.ticker.remove(this.#tick, this);
    this.#clearParticles();
    if (this.#flashOverlay) {
      this.#flashOverlay.destroy();
      this.#flashOverlay = null;
    }
    if (this.#boltOverlay) {
      this.#boltOverlay.destroy();
      this.#boltOverlay = null;
    }
    for (const tex of this.#textures.values()) tex.destroy(true);
    this.#textures.clear();
    this.#app.destroy(false, { children: true, texture: true });
  }

  /** Destroy all particle sprites (including trails) and clear arrays. */
  #clearParticles() {
    for (const state of this.#particles) if (state.trailSprites) for (const ts of state.trailSprites) ts.destroy();
    for (const sprite of this.#sprites) sprite.destroy();
    this.#sprites = [];
    this.#particles = [];
    this.#container.removeChildren();
  }

  /** Generate all procedural particle textures via PIXI.Graphics. */
  #generateTextures() {
    const g = new PIXI.Graphics();
    const gen = (name, drawFn) => {
      g.clear();
      drawFn(g);
      this.#textures.set(name, this.#app.renderer.generateTexture(g, { resolution: 2 }));
    };

    // Raindrop: thin elongated rectangle
    gen('raindrop', (g) => {
      g.beginFill(0xffffff, 0.7);
      g.drawRect(0, 0, 1.5, 8);
      g.endFill();
    });

    // Snowflake: cross-star from 3 rotated thin rects
    gen('snowflake', (g) => {
      const cx = 6;
      const cy = 6;
      const arm = 5;
      const thick = 1.2;
      g.beginFill(0xffffff, 0.85);
      for (let a = 0; a < 3; a++) {
        const angle = (a * Math.PI) / 3;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const dx = cos * arm;
        const dy = sin * arm;
        const nx = -sin * thick * 0.5;
        const ny = cos * thick * 0.5;
        g.moveTo(cx - dx + nx, cy - dy + ny);
        g.lineTo(cx + dx + nx, cy + dy + ny);
        g.lineTo(cx + dx - nx, cy + dy - ny);
        g.lineTo(cx - dx - nx, cy - dy - ny);
        g.closePath();
      }
      g.endFill();
    });

    // Cloud variants: 7 different irregular shapes using rounded rects + ellipses
    gen('cloud', (g) => {
      g.beginFill(0xffffff, 1.0);
      g.drawRoundedRect(4, 6, 24, 8, 4);
      g.drawEllipse(10, 5, 7, 5);
      g.drawEllipse(20, 4, 8, 5);
      g.drawEllipse(26, 7, 5, 4);
      g.drawRoundedRect(6, 8, 18, 6, 3);
      g.endFill();
    });
    gen('cloud2', (g) => {
      g.beginFill(0xffffff, 1.0);
      g.drawRoundedRect(2, 7, 28, 7, 3);
      g.drawEllipse(8, 5, 6, 4);
      g.drawEllipse(18, 3, 9, 5);
      g.drawEllipse(25, 6, 5, 4);
      g.endFill();
    });
    gen('cloud3', (g) => {
      g.beginFill(0xffffff, 1.0);
      g.drawRoundedRect(0, 6, 32, 8, 4);
      g.drawEllipse(7, 5, 6, 5);
      g.drawEllipse(16, 3, 8, 5);
      g.drawEllipse(24, 5, 7, 4);
      g.drawEllipse(12, 8, 5, 3);
      g.endFill();
    });
    gen('cloud4', (g) => {
      g.beginFill(0xffffff, 1.0);
      g.drawRoundedRect(3, 8, 20, 6, 3);
      g.drawEllipse(8, 6, 5, 4);
      g.drawEllipse(16, 5, 7, 5);
      g.drawRoundedRect(12, 6, 12, 5, 2);
      g.endFill();
    });
    gen('cloud5', (g) => {
      g.beginFill(0xffffff, 1.0);
      g.drawRoundedRect(1, 7, 30, 7, 4);
      g.drawEllipse(6, 5, 5, 4);
      g.drawEllipse(14, 3, 7, 5);
      g.drawEllipse(22, 4, 8, 5);
      g.drawEllipse(28, 7, 4, 3);
      g.drawRoundedRect(8, 9, 16, 4, 2);
      g.endFill();
    });
    gen('cloud6', (g) => {
      g.beginFill(0xffffff, 1.0);
      g.drawRoundedRect(5, 7, 22, 7, 3);
      g.drawEllipse(10, 4, 8, 5);
      g.drawEllipse(20, 5, 6, 4);
      g.drawEllipse(14, 9, 6, 3);
      g.endFill();
    });
    gen('cloud7', (g) => {
      g.beginFill(0xffffff, 1.0);
      g.drawRoundedRect(2, 6, 26, 8, 4);
      g.drawEllipse(9, 4, 7, 4);
      g.drawEllipse(19, 3, 6, 4);
      g.drawEllipse(26, 6, 5, 4);
      g.drawRoundedRect(4, 8, 22, 5, 3);
      g.endFill();
    });

    // Fog blob: diffuse amorphous mass from overlapping soft circles
    gen('fogBlob', (g) => {
      g.beginFill(0xffffff, 0.2);
      g.drawCircle(12, 10, 10);
      g.drawCircle(20, 12, 8);
      g.drawCircle(8, 14, 7);
      g.drawCircle(16, 8, 9);
      g.endFill();
    });

    // Hailstone: irregular chunky shape
    gen('hailstone', (g) => {
      g.beginFill(0xffffff, 0.8);
      g.drawRoundedRect(0, 0, 4, 5, 1);
      g.endFill();
    });

    // Debris: small angular shape
    gen('debris', (g) => {
      g.beginFill(0xffffff, 0.7);
      g.drawRect(0, 0, 3, 2);
      g.endFill();
    });

    // Meteor rock: large dark jagged boulder
    gen('meteorRock', (g) => {
      g.beginFill(0xffffff, 1.0);
      g.moveTo(6, 0);
      g.lineTo(11, 1);
      g.lineTo(14, 4);
      g.lineTo(15, 8);
      g.lineTo(13, 12);
      g.lineTo(10, 14);
      g.lineTo(5, 13);
      g.lineTo(2, 10);
      g.lineTo(0, 6);
      g.lineTo(2, 2);
      g.closePath();
      g.endFill();
      g.beginFill(0xffffff, 0.3);
      g.moveTo(5, 3);
      g.lineTo(8, 7);
      g.lineTo(6, 11);
      g.lineTo(4, 8);
      g.closePath();
      g.endFill();
    });

    // Grain: tiny dot
    gen('grain', (g) => {
      g.beginFill(0xffffff, 0.6);
      g.drawCircle(1, 1, 1.5);
      g.endFill();
    });

    // Ash: small irregular flake
    gen('ash', (g) => {
      g.beginFill(0xffffff, 0.6);
      g.drawEllipse(2, 2, 2.5, 1.5);
      g.endFill();
    });

    // Ember: glowing dot with outer glow ring
    gen('ember', (g) => {
      g.beginFill(0xffffff, 0.25);
      g.drawCircle(4, 4, 4);
      g.endFill();
      g.beginFill(0xffffff, 0.9);
      g.drawCircle(4, 4, 1.8);
      g.endFill();
    });

    // Shard: diamond shape
    gen('shard', (g) => {
      g.beginFill(0xffffff, 0.7);
      g.moveTo(3, 0);
      g.lineTo(6, 4);
      g.lineTo(3, 8);
      g.lineTo(0, 4);
      g.closePath();
      g.endFill();
    });

    // Pixel: tiny square
    gen('pixel', (g) => {
      g.beginFill(0xffffff, 0.8);
      g.drawRect(0, 0, 2, 2);
      g.endFill();
    });

    // Band: undulating aurora ribbon from stacked wavy ellipses
    gen('band', (g) => {
      g.beginFill(0xffffff, 0.2);
      g.drawEllipse(24, 4, 22, 3);
      g.drawEllipse(20, 8, 18, 3);
      g.drawEllipse(28, 6, 16, 2.5);
      g.drawEllipse(16, 10, 14, 2);
      g.endFill();
    });

    // Wisp: ghostly tendril — tapered body with trailing ellipses
    gen('wisp', (g) => {
      g.beginFill(0xffffff, 0.35);
      g.drawEllipse(8, 4, 7, 3);
      g.endFill();
      g.beginFill(0xffffff, 0.25);
      g.drawEllipse(18, 5, 5, 2);
      g.endFill();
      g.beginFill(0xffffff, 0.15);
      g.drawEllipse(25, 5, 3, 1.5);
      g.endFill();
    });

    // Wraith: ragged smoke silhouette — single solid irregular polygon
    gen('wraith', (g) => {
      g.beginFill(0xffffff, 1.0);
      g.moveTo(6, 18);
      g.lineTo(4, 14);
      g.lineTo(3, 11);
      g.lineTo(5, 8);
      g.lineTo(3, 6);
      g.lineTo(5, 3);
      g.lineTo(7, 0);
      g.lineTo(9, 2);
      g.lineTo(11, 1);
      g.lineTo(12, 4);
      g.lineTo(14, 6);
      g.lineTo(12, 9);
      g.lineTo(13, 12);
      g.lineTo(11, 15);
      g.lineTo(10, 18);
      g.closePath();
      g.endFill();
    });

    // Mote: bright small circle
    gen('mote', (g) => {
      g.beginFill(0xffffff, 0.9);
      g.drawCircle(2, 2, 2);
      g.endFill();
    });

    // Sheet: draped curtain from overlapping translucent rounded rects
    gen('sheet', (g) => {
      g.beginFill(0xffffff, 0.15);
      g.drawRoundedRect(0, 0, 18, 10, 3);
      g.endFill();
      g.beginFill(0xffffff, 0.12);
      g.drawRoundedRect(3, 2, 16, 9, 3);
      g.endFill();
      g.beginFill(0xffffff, 0.1);
      g.drawRoundedRect(6, 1, 14, 11, 3);
      g.endFill();
    });

    // Petal: teardrop shape — ellipse body + triangle tip
    gen('petal', (g) => {
      g.beginFill(0xffffff, 0.7);
      g.drawEllipse(4, 4, 3, 2.5);
      g.moveTo(7, 4);
      g.lineTo(10, 3.5);
      g.lineTo(7.5, 5);
      g.closePath();
      g.endFill();
    });

    g.destroy();
  }

  /** Build the particle pool for the current effect, including trail sprites. */
  #buildParticles() {
    const baseConfig = EFFECT_CONFIGS[this.#currentEffect];
    if (!baseConfig || baseConfig.particles === 0) return;
    const config = this.#mergeConfig(baseConfig, this.#visualOverrides);
    const w = this.#app.screen.width;
    const h = this.#app.screen.height;
    const intensity = this.#options.precipIntensity || 0.5;
    const countRange = config.count;
    const count = Math.round(countRange[0] + (countRange[1] - countRange[0]) * intensity);
    const texture = this.#textures.get(config.texture);
    if (!texture) return;
    const variants = config.textureVariants?.map((name) => this.#textures.get(name)).filter(Boolean) ?? [];
    log(3, 'buildParticles', { effect: this.#currentEffect, texture: config.texture, variants: variants.length, count, screenSize: `${w}x${h}`, intensity });
    const mixedCount = config.mixed ? Math.round(count * config.mixed.ratio) : 0;
    const mixedTexture = config.mixed ? this.#textures.get(config.mixed.texture) : null;
    for (let i = 0; i < count; i++) {
      const isMixed = i < mixedCount && mixedTexture;
      const baseTex = variants.length ? variants[Math.floor(Math.random() * variants.length)] : texture;
      const sprite = new PIXI.Sprite(isMixed ? mixedTexture : baseTex);
      sprite.anchor.set(0.5);
      sprite.x = rand(0, w);
      sprite.y = rand(0, h);
      const tintRange = isMixed ? config.mixed.tint : config.tint;
      const alphaRange = isMixed ? config.mixed.alpha : config.alpha;
      sprite.alpha = rand(alphaRange[0], alphaRange[1]);
      const scaleRange = isMixed && config.mixed?.scale ? config.mixed.scale : config.scale;
      sprite.scale.set(rand(scaleRange[0], scaleRange[1]));
      const useRainbow = isMixed ? config.mixed?.rainbow : config.rainbow;
      sprite.tint = useRainbow ? randHue() : randTint(tintRange);
      sprite.rotation = config.tumble ? rand(0, Math.PI * 2) : 0;
      if (config.horizontal && config.texture === 'raindrop') sprite.rotation = Math.PI / 2 + rand(-0.15, 0.15);
      const isTwinkle = isMixed && config.mixed?.flicker;
      const state = {
        vx: isTwinkle ? 0 : rand(config.speed.x[0], config.speed.x[1]),
        vy: isTwinkle ? 0 : rand(config.speed.y[0], config.speed.y[1]),
        wobbleOffset: rand(0, Math.PI * 2),
        wobbleSpeed: rand(0.02, 0.05),
        lifetime: 0,
        maxLifetime: config.flicker || isTwinkle ? rand(5, 30) : Infinity,
        pulseOffset: rand(0, Math.PI * 2),
        twinkle: isTwinkle,
        trailSprites: null
      };

      this.#container.addChild(sprite);
      this.#sprites.push(sprite);
      this.#particles.push(state);
      if (config.trail && !isMixed) {
        const trailTex = this.#textures.get(config.trail.texture);
        if (trailTex) {
          const trailSprites = [];
          for (let t = 0; t < config.trail.count; t++) {
            const ts = new PIXI.Sprite(trailTex);
            ts.anchor.set(0.5);
            ts.x = sprite.x;
            ts.y = sprite.y;
            ts.tint = randTint(config.trail.tint);
            ts.alpha = 0;
            ts.scale.set(sprite.scale.x * 0.6);
            this.#container.addChildAt(ts, 0);
            trailSprites.push(ts);
          }
          state.trailSprites = trailSprites;
        }
      }
    }

    if (config.mixed?.extra && mixedTexture) {
      const extraCount = config.mixed.extra;
      const extraScale = config.mixed.scale ?? config.scale;
      for (let i = 0; i < extraCount; i++) {
        const sprite = new PIXI.Sprite(mixedTexture);
        sprite.anchor.set(0.5);
        sprite.x = rand(0, w);
        sprite.y = rand(0, h);
        sprite.alpha = rand(config.mixed.alpha[0], config.mixed.alpha[1]);
        sprite.scale.set(rand(extraScale[0], extraScale[1]));
        sprite.tint = config.mixed.rainbow ? randHue() : randTint(config.mixed.tint);
        const state = { vx: 0, vy: 0, wobbleOffset: 0, wobbleSpeed: 0, lifetime: 0, maxLifetime: Infinity, pulseOffset: rand(0, Math.PI * 2), twinkle: true };
        this.#container.addChild(sprite);
        this.#sprites.push(sprite);
        this.#particles.push(state);
      }
    }
  }

  /**
   * Animation tick — receives deltaTime as a number from Pixi v7.
   * @param {number} delta - Frame delta time
   */
  #tick(delta) {
    if (this.#destroyed || this.#currentEffect === 'clear') return;
    const config = EFFECT_CONFIGS[this.#currentEffect];
    if (!config) return;
    const w = this.#app.screen.width;
    const h = this.#app.screen.height;
    const windFactor = this.#options.windSpeed * 0.4;
    const windRad = ((this.#options.windDirection ?? 0) * Math.PI) / 180;
    const windX = Math.sin(windRad) * windFactor;
    const windY = -Math.cos(windRad) * windFactor * 0.3;
    const centerX = w / 2;
    const centerY = h / 2;
    for (let i = 0; i < this.#sprites.length; i++) {
      const sprite = this.#sprites[i];
      const state = this.#particles[i];
      state.lifetime += delta;
      if (config.flicker) {
        if (state.lifetime >= state.maxLifetime) {
          sprite.x = rand(0, w);
          sprite.y = rand(0, h);
          sprite.alpha = rand(config.alpha[0], config.alpha[1]);
          sprite.tint = randTint(config.tint);
          state.lifetime = 0;
          state.maxLifetime = rand(5, 30);
        }
        continue;
      }

      if (config.vortex) {
        const angle = state.lifetime * (0.03 + state.vx * 0.02) + state.wobbleOffset;
        const verticalProgress = 1 - (sprite.y + 10) / (h + 20);
        const funnelWidth = 5 + verticalProgress * 30;
        const radius = funnelWidth + Math.sin(state.lifetime * 0.03 + state.wobbleOffset) * 8;
        sprite.x = centerX + Math.cos(angle) * radius + windX * delta + Math.sin(state.lifetime * 0.07) * 3;
        sprite.y -= state.vy * delta * 0.4;
        sprite.rotation += (0.03 + state.vx * 0.02) * delta;
        sprite.alpha = 0.4 + verticalProgress * 0.5;
        if (sprite.y < -10) {
          sprite.y = h + rand(0, 10);
          sprite.x = centerX + rand(-15, 15);
          state.wobbleOffset = rand(0, Math.PI * 2);
        }
        continue;
      }

      if (config.inward) {
        const dx = centerX - sprite.x;
        const dy = centerY - sprite.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 2) {
          sprite.x += (dx / dist) * 0.2 * delta;
          sprite.y += (dy / dist) * 0.2 * delta;
        }
        sprite.alpha = Math.max(0.1, config.alpha[1] * (dist / Math.max(w, h)));
        if (dist < 5) {
          sprite.x = rand(0, w);
          sprite.y = rand(0, h);
        }
        state.wobbleOffset += state.wobbleSpeed * delta;
        sprite.x += Math.sin(state.wobbleOffset) * config.wobble * delta * 60;
        continue;
      }
      if (state.twinkle) {
        sprite.alpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(state.lifetime * 0.08 + state.pulseOffset));
        sprite.tint = randHue();
        continue;
      }
      if (config.pulse) sprite.alpha = config.alpha[0] + (config.alpha[1] - config.alpha[0]) * (0.5 + 0.5 * Math.sin(state.lifetime * 0.04 + state.pulseOffset));
      sprite.x += (state.vx + windX) * delta;
      const effectiveWindY = config.noWindY ? 0 : windY;
      sprite.y += (state.vy + effectiveWindY + config.gravity * state.lifetime * 0.1) * delta;
      if (config.wobble) {
        state.wobbleOffset += state.wobbleSpeed * delta;
        sprite.x += Math.sin(state.wobbleOffset) * config.wobble * delta * 60;
      }
      if (config.swirl) {
        state.wobbleOffset += state.wobbleSpeed * delta;
        sprite.x += Math.sin(state.wobbleOffset) * 0.4 * delta;
        sprite.y += Math.cos(state.wobbleOffset * 0.7) * 0.35 * delta;
      }
      if (config.tumble) sprite.rotation += config.tumble * delta;
      if (state.trailSprites && config.trail) {
        const speed = Math.sqrt(state.vx * state.vx + state.vy * state.vy) || 1;
        const dirX = -state.vx / speed;
        const dirY = -state.vy / speed;
        const { alphaDecay, scaleDecay, spacing } = config.trail;
        for (let t = 0; t < state.trailSprites.length; t++) {
          const ts = state.trailSprites[t];
          const offset = (t + 1) * spacing;
          ts.x = sprite.x + dirX * offset;
          ts.y = sprite.y + dirY * offset;
          ts.alpha = sprite.alpha * Math.pow(alphaDecay, t + 1);
          ts.scale.set(sprite.scale.x * Math.pow(scaleDecay, t + 1));
          ts.tint = randTint(config.trail.tint);
        }
      }
      const margin = 20;
      if (sprite.y > h + margin) {
        sprite.y = -margin;
        sprite.x = rand(0, w);
        state.lifetime = 0;
      } else if (sprite.y < -margin && state.vy < 0) {
        sprite.y = h + margin;
        sprite.x = rand(0, w);
        state.lifetime = 0;
      }
      if (sprite.x > w + margin) {
        sprite.x = -margin;
        sprite.y = rand(0, h);
        state.lifetime = 0;
      } else if (sprite.x < -margin) {
        sprite.x = w + margin;
        sprite.y = rand(0, h);
        state.lifetime = 0;
      }
    }
    if (config.flash) {
      this.#flashTimer -= delta;
      if (this.#flashTimer <= 0) {
        this.#triggerFlash();
        this.#flashTimer = rand(90, 300);
      }
    }
  }

  /**
   * Convert HSL to hex color number.
   * @param {number} h - Hue (0-360)
   * @param {number} s - Saturation (0-1)
   * @param {number} l - Lightness (0-1)
   * @returns {number} Hex color
   */
  static #hslToHex(h, s, l) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    let r, g, b;
    if (h < 60) [r, g, b] = [c, x, 0];
    else if (h < 120) [r, g, b] = [x, c, 0];
    else if (h < 180) [r, g, b] = [0, c, x];
    else if (h < 240) [r, g, b] = [0, x, c];
    else if (h < 300) [r, g, b] = [x, 0, c];
    else [r, g, b] = [c, 0, x];
    return (Math.round((r + m) * 255) << 16) | (Math.round((g + m) * 255) << 8) | Math.round((b + m) * 255);
  }

  /** Trigger a lightning flash with bolt graphic and strobe decay. */
  #triggerFlash() {
    if (!this.#flashOverlay) {
      this.#flashOverlay = new PIXI.Graphics();
      this.#app.stage.addChild(this.#flashOverlay);
    }
    if (!this.#boltOverlay) {
      this.#boltOverlay = new PIXI.Graphics();
      this.#app.stage.addChild(this.#boltOverlay);
    }
    const config = EFFECT_CONFIGS[this.#currentEffect] ?? {};
    const isUpward = config.flashUp ?? false;
    const isRainbow = config.flashRainbow ?? false;
    const w = this.#app.screen.width;
    const h = this.#app.screen.height;
    const skyIntensity = rand(0.15, 0.35);
    this.#flashOverlay.clear();
    this.#flashOverlay.beginFill(isRainbow ? 0xeeddff : 0xffffff, skyIntensity);
    this.#flashOverlay.drawRect(0, 0, w, h);
    this.#flashOverlay.endFill();
    this.#flashOverlay.alpha = 1;
    this.#boltOverlay.clear();
    const boltX = rand(w * 0.15, w * 0.85);
    const segments = Math.floor(rand(5, 9));
    const segH = h / segments;
    let x = boltX;
    let y = isUpward ? h : 0;
    const baseHue = Math.random() * 360;
    const segColor = (s) => (isRainbow ? HudWeatherRenderer.#hslToHex((baseHue + (s * 360) / segments) % 360, 1, 0.65) : 0xffffff);
    this.#boltOverlay.lineStyle(2.5, segColor(0), 0.95);
    this.#boltOverlay.moveTo(x, y);
    for (let s = 1; s <= segments; s++) {
      x += rand(-12, 12);
      y = isUpward ? h - s * segH : s * segH;
      this.#boltOverlay.lineStyle(2.5, segColor(s), 0.95);
      this.#boltOverlay.lineTo(x, y);
      if (s > 1 && s < segments - 1 && Math.random() < 0.3) {
        const branchLen = rand(8, 20);
        const branchDir = Math.random() < 0.5 ? -1 : 1;
        const branchColor = isRainbow ? segColor(s) : 0xccddff;
        this.#boltOverlay.lineStyle(1.2, branchColor, 0.7);
        const branchDy = isUpward ? -rand(4, 10) : rand(4, 10);
        this.#boltOverlay.lineTo(x + branchDir * branchLen, y + branchDy);
        this.#boltOverlay.moveTo(x, y);
        this.#boltOverlay.lineStyle(2.5, segColor(s), 0.95);
      }
    }
    const glowColor = isRainbow ? 0xddbbff : 0xaaccff;
    this.#boltOverlay.lineStyle(6, glowColor, 0.25);
    x = boltX;
    y = isUpward ? h : 0;
    this.#boltOverlay.moveTo(x, y);
    for (let s = 1; s <= segments; s++) {
      x += rand(-12, 12);
      y = isUpward ? h - s * segH : s * segH;
      this.#boltOverlay.lineTo(x, y);
    }
    this.#boltOverlay.alpha = 1;
    const flickerPattern = [1, 0.1, 0.9, 0.05, 0.7, 0.4, 0.2, 0.05, 0];
    if (Math.random() < 0.35) flickerPattern.push(0, 0, 0.6, 0.3, 0.1, 0);
    let step = 0;
    const strobe = () => {
      if (this.#destroyed || !this.#flashOverlay || !this.#boltOverlay) return;
      if (step >= flickerPattern.length) {
        this.#flashOverlay.clear();
        this.#flashOverlay.alpha = 1;
        this.#boltOverlay.clear();
        this.#boltOverlay.alpha = 1;
        return;
      }
      const val = flickerPattern[step];
      this.#flashOverlay.alpha = val * skyIntensity * 2;
      this.#boltOverlay.alpha = val;
      step++;
      requestAnimationFrame(strobe);
    };
    requestAnimationFrame(strobe);
  }
}
