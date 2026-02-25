/* global PIXI */
/**
 * Unified PixiJS scene renderer for HUD overlays.
 * @module Applications/HudSceneRenderer
 */

import { log } from '../../utils/logger.mjs';

/**
 * Sky color keyframes for interpolation throughout the day.
 */
export const SKY_KEYFRAMES = [
  { hour: 0, top: '#0a0a12', mid: '#0f0f1a', bottom: '#151525' },
  { hour: 4, top: '#0a0a15', mid: '#151530', bottom: '#1a1a35' },
  { hour: 5, top: '#1a1a35', mid: '#2d2d50', bottom: '#4a4a6a' },
  { hour: 6, top: '#4a4a6a', mid: '#7a5a70', bottom: '#ff9966' },
  { hour: 7, top: '#6a8cba', mid: '#9ec5e0', bottom: '#ffe4b3' },
  { hour: 8, top: '#4a90d9', mid: '#87ceeb', bottom: '#c9e8f5' },
  { hour: 10, top: '#3a7fc8', mid: '#6bb5e0', bottom: '#a8d8f0' },
  { hour: 12, top: '#2e6ab3', mid: '#4a90d9', bottom: '#87ceeb' },
  { hour: 14, top: '#3a7fc8', mid: '#6bb5e0', bottom: '#a8d8f0' },
  { hour: 16, top: '#5a8ac0', mid: '#8bb8d8', bottom: '#c5dff0' },
  { hour: 17.5, top: '#6a6a8a', mid: '#aa7a6a', bottom: '#ffaa66' },
  { hour: 18.5, top: '#3d3d5a', mid: '#8a5a5a', bottom: '#ff7744' },
  { hour: 19.5, top: '#25253a', mid: '#4a4a6a', bottom: '#885544' },
  { hour: 20.5, top: '#151525', mid: '#1a1a35', bottom: '#2a2a45' },
  { hour: 24, top: '#0a0a12', mid: '#0f0f1a', bottom: '#151525' }
];

/**
 * Per-effect sky color overrides (RGB arrays for top/mid/bottom gradient).
 */
export const SKY_OVERRIDES = {
  'clouds-light': { strength: 0.5, top: [160, 170, 185], mid: [175, 185, 200], bottom: [190, 200, 215] },
  'clouds-heavy': { strength: 0.7, top: [115, 120, 130], mid: [130, 135, 145], bottom: [150, 155, 165] },
  'clouds-overcast': { strength: 0.85, top: [95, 95, 100], mid: [110, 110, 115], bottom: [130, 130, 135] },
  rain: { strength: 0.75, top: [70, 75, 90], mid: [85, 90, 105], bottom: [100, 105, 120] },
  'rain-heavy': { strength: 0.85, top: [50, 55, 70], mid: [65, 68, 82], bottom: [80, 82, 95] },
  snow: { strength: 0.6, top: [185, 195, 210], mid: [195, 205, 220], bottom: [210, 218, 230] },
  'snow-heavy': { strength: 0.7, top: [195, 200, 215], mid: [205, 210, 225], bottom: [215, 220, 235] },
  fog: { strength: 0.8, top: [175, 178, 180], mid: [185, 188, 190], bottom: [200, 202, 205] },
  lightning: { strength: 0.9, top: [35, 35, 55], mid: [45, 48, 68], bottom: [60, 62, 80] },
  sand: { strength: 0.85, top: [185, 160, 100], mid: [200, 175, 115], bottom: [215, 190, 130] },
  ashfall: { strength: 0.85, top: [90, 70, 50], mid: [120, 95, 70], bottom: [150, 120, 90] },
  embers: { strength: 0.85, top: [160, 110, 60], mid: [180, 125, 70], bottom: [195, 140, 80] },
  ice: { strength: 0.6, top: [160, 195, 220], mid: [175, 205, 230], bottom: [190, 215, 240] },
  hail: { strength: 0.8, top: [70, 75, 95], mid: [90, 95, 115], bottom: [110, 115, 130] },
  tornado: { strength: 0.9, top: [45, 50, 40], mid: [60, 65, 50], bottom: [75, 78, 65] },
  hurricane: { strength: 0.9, top: [50, 55, 65], mid: [65, 68, 80], bottom: [80, 82, 95] },
  nullstatic: { strength: 0.95, top: [12, 10, 16], mid: [18, 15, 22], bottom: [25, 22, 30] },
  gust: { strength: 0.15, top: [180, 190, 200], mid: [190, 200, 210], bottom: [200, 210, 220] },
  aurora: { strength: 0.85, top: [10, 8, 35], mid: [20, 60, 50], bottom: [15, 25, 60] },
  aether: { strength: 0.8, top: [100, 40, 90], mid: [130, 60, 120], bottom: [160, 80, 150] },
  void: { strength: 0.95, top: [15, 10, 12], mid: [22, 15, 18], bottom: [30, 22, 25] },
  spectral: { strength: 0.8, top: [30, 40, 50], mid: [45, 60, 50], bottom: [60, 80, 65] },
  arcane: { strength: 0.7, top: [40, 80, 160], mid: [60, 120, 200], bottom: [100, 180, 230] },
  'arcane-wind': { strength: 0.8, top: [80, 40, 100], mid: [110, 60, 130], bottom: [140, 80, 160] },
  veil: { strength: 0.75, top: [80, 70, 110], mid: [110, 100, 140], bottom: [140, 130, 170] },
  petals: { strength: 0.4, top: [140, 130, 180], mid: [180, 150, 170], bottom: [220, 180, 190] },
  sleet: { strength: 0.75, top: [80, 85, 100], mid: [95, 100, 115], bottom: [115, 120, 135] },
  haze: { strength: 0.5, top: [200, 180, 140], mid: [215, 195, 155], bottom: [230, 210, 170] },
  leaves: { strength: 0.35, top: [160, 130, 90], mid: [180, 150, 100], bottom: [200, 170, 120] },
  smoke: { strength: 0.9, top: [60, 50, 40], mid: [80, 65, 50], bottom: [100, 85, 65] },
  'rain-acid': { strength: 0.8, top: [40, 80, 30], mid: [55, 100, 45], bottom: [70, 120, 60] },
  'rain-blood': { strength: 0.85, top: [80, 20, 25], mid: [100, 30, 35], bottom: [120, 40, 45] },
  meteors: { strength: 0.6, top: [15, 10, 30], mid: [30, 20, 45], bottom: [50, 35, 60] },
  spores: { strength: 0.7, top: [60, 80, 40], mid: [75, 100, 55], bottom: [90, 120, 70] },
  divine: { strength: 0.6, top: [200, 180, 100], mid: [220, 200, 130], bottom: [240, 220, 160] },
  miasma: { strength: 0.85, top: [50, 60, 30], mid: [65, 78, 40], bottom: [80, 95, 55] },
  'ley-surge': { strength: 0.75, top: [50, 30, 120], mid: [80, 60, 160], bottom: [120, 100, 200] }
};

/**
 * Effect configuration definitions.
 * @type {Object<string, object>}
 */
export const EFFECT_CONFIGS = {
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
 * @param {number[]} tints - Array of two hex color numbers
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
 * @returns {number} Random hex color number
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
 * Convert HSL to hex color number.
 * @param {number} h - Hue (0-360)
 * @param {number} s - Saturation (0-1)
 * @param {number} l - Lightness (0-1)
 * @returns {number} Hex color number
 */
function hslToHex(h, s, l) {
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
 * Unified PixiJS scene renderer for HUD dome/slice views.
 */
export class HudSceneRenderer {
  /** @type {PIXI.Application} */
  #app = null;

  /** @type {HTMLCanvasElement} */
  canvas = null;

  /** @type {string} 'dome' or 'slice' */
  #mode = 'dome';

  /** @type {boolean} */
  #destroyed = false;

  /** @type {PIXI.Sprite} Sky gradient background (current/old) */
  #skySpriteBg = null;

  /** @type {PIXI.Sprite} Sky gradient foreground (crossfade target) */
  #skySpriteFg = null;

  /** @type {PIXI.Container} Star container */
  #starContainer = null;

  /** @type {PIXI.Sprite[]} Star sprites */
  #stars = [];

  /** @type {object[]} Per-star animation state */
  #starStates = [];

  /** @type {PIXI.Container} Weather particle container */
  #weatherContainer = null;

  /** @type {PIXI.Sprite} Sun sprite */
  #sunSprite = null;

  /** @type {PIXI.Sprite} Sun corona sprite */
  #sunCorona = null;

  /** @type {PIXI.Container} Moon layer container */
  #moonContainer = null;

  /** @type {PIXI.Texture} Shared moon texture */
  #moonTexture = null;

  /** @type {{glow: PIXI.Graphics, sprite: PIXI.Sprite, shadow: PIXI.Graphics}[]} Moon sprite pool */
  #moonPool = [];

  /** @type {PIXI.Graphics|null} Flash overlay */
  #flashOverlay = null;

  /** @type {PIXI.Graphics|null} Bolt overlay */
  #boltOverlay = null;

  /** @type {string} */
  #currentEffect = 'clear';

  /** @type {object} */
  #weatherOptions = { windSpeed: 0, windDirection: 0, precipIntensity: 0 };

  /** @type {object|null} */
  #visualOverrides = null;

  /** @type {Map<string, PIXI.Texture>} */
  #textures = new Map();

  /** @type {object[]} Particle state */
  #particles = [];

  /** @type {PIXI.Sprite[]} */
  #sprites = [];

  /** @type {number} Flash cooldown */
  #flashTimer = 0;

  /** @type {number[]} Current displayed sky RGB (9 values) */
  #currentSkyRgb = null;

  /** @type {number[]} Target sky RGB (9 values) */
  #targetSkyRgb = null;

  /** @type {PIXI.Texture|null} Background sky texture (current) */
  #skyTextureBg = null;

  /** @type {PIXI.Texture|null} Foreground sky texture (crossfade target) */
  #skyTextureFg = null;

  /** @type {number} Sky crossfade progress (0 = showing bg only, 1 = fg fully visible) */
  #skyFade = 0;

  /** @type {boolean} Whether a sky crossfade is active */
  #skyFading = false;

  /** @type {string|null} Pending effect to swap to after fade-out */
  #pendingEffect = null;

  /** @type {object|null} Pending visual overrides */
  #pendingOverrides = null;

  /** @type {number} Weather crossfade alpha (1 = fully visible, fading toward 0 then back to 1) */
  #weatherFade = 1;

  /** @type {'idle'|'out'|'in'} Weather fade direction */
  #weatherFadeDir = 'idle';

  /** @type {number} Last known star layer alpha */
  #starAlpha = 0;

  /** @type {number} Global time accumulator for animations */
  #time = 0;

  /** @type {{particleScale: number, enableStarTwinkle: boolean, enableCoronaPulse: boolean, maxFPS: number}} */
  #perfConfig = null;

  /**
   * @param {HTMLCanvasElement} canvas - Target canvas element
   * @param {string} mode - 'dome' or 'slice'
   */
  constructor(canvas, mode = 'dome') {
    this.canvas = canvas;
    this.#mode = mode;
    this.#perfConfig = this.#getPerformanceConfig();
    const parent = canvas.parentElement;
    log(3, 'HudSceneRenderer | constructor', { mode, perf: this.#perfConfig });
    this.#app = new PIXI.Application({ view: canvas, backgroundAlpha: 0, resizeTo: parent, antialias: true });
    this.#app.ticker.maxFPS = this.#perfConfig.maxFPS;
    this.#buildSkyLayer();
    this.#buildStarLayer();
    this.#weatherContainer = new PIXI.Container();
    this.#app.stage.addChild(this.#weatherContainer);
    this.#buildSunLayer();
    this.#buildMoonLayer();
    this.#generateTextures();
    this.#app.ticker.add(this.#tick, this);
  }

  /**
   * Read Foundry performance settings and return a config object.
   * @returns {{particleScale: number, enableStarTwinkle: boolean, enableCoronaPulse: boolean, maxFPS: number}} Performance config
   */
  #getPerformanceConfig() {
    const mode = game.settings?.get('core', 'performanceMode') ?? 2;
    const maxFPS = game.settings?.get('core', 'maxFPS') ?? 60;
    switch (mode) {
      case 0:
        return { particleScale: 0, enableStarTwinkle: false, enableCoronaPulse: false, maxFPS };
      case 1:
        return { particleScale: 0.5, enableStarTwinkle: false, enableCoronaPulse: false, maxFPS };
      default:
        return { particleScale: 1, enableStarTwinkle: true, enableCoronaPulse: true, maxFPS };
    }
  }

  /**
   * Full state update called from hud.mjs on each visual tick.
   * @param {object} params - Celestial and sky state
   * @param {number} params.hour - Decimal hour (0-hoursPerDay)
   * @param {number} params.sunrise - Sunrise hour
   * @param {number} params.sunset - Sunset hour
   * @param {number} params.hoursPerDay - Hours per day
   * @param {{phase: number, color: string|null, name: string}[]} params.moons - Moon data array
   * @param {object} params.skyColors - {top, mid, bottom} as [r,g,b] arrays
   * @param {number} params.starAlpha - Star layer target alpha (0-1)
   */
  update({ hour, sunrise, sunset, hoursPerDay, moons = [], skyColors, starAlpha }) {
    if (this.#destroyed) return;
    this.#updateSky(skyColors);
    this.#updateStars(starAlpha);
    this.#updateSun(hour, sunrise, sunset);
    this.#updateMoons(hour, sunrise, sunset, hoursPerDay, moons);
  }

  /**
   * Set weather effect and options. Rebuilds particle pool when changed.
   * @param {string} effect - Effect ID
   * @param {object} [options] - Wind/precip options
   * @param {number} [options.windSpeed] - Wind speed value
   * @param {number} [options.windDirection] - Wind direction in degrees
   * @param {number} [options.precipIntensity] - Precipitation intensity
   * @param {object|null} [visualOverrides] - Visual overrides
   */
  setEffect(effect, { windSpeed = 0, windDirection = 0, precipIntensity = 0 } = {}, visualOverrides = null) {
    if (this.#destroyed) return;
    const newPerf = this.#getPerformanceConfig();
    const perfChanged = newPerf.particleScale !== this.#perfConfig.particleScale;
    this.#perfConfig = newPerf;
    this.#app.ticker.maxFPS = newPerf.maxFPS;
    this.#weatherOptions = { windSpeed, windDirection, precipIntensity };
    const overridesChanged = JSON.stringify(this.#visualOverrides) !== JSON.stringify(visualOverrides);
    const changed = effect !== this.#currentEffect || overridesChanged || perfChanged;
    if (!changed) return;
    if (this.#sprites.length > 0) {
      this.#pendingEffect = effect;
      this.#pendingOverrides = visualOverrides;
      this.#weatherFadeDir = 'out';
    } else {
      this.#currentEffect = effect;
      this.#visualOverrides = visualOverrides;
      this.#clearParticles();
      this.#buildParticles();
      this.#weatherFade = 0;
      this.#weatherFadeDir = 'in';
    }
  }

  /**
   * Toggle vertical flip for dome-below mode.
   * @param {boolean} flipped - Whether the dome is rendered below the bar
   */
  setFlipped(flipped) {
    if (this.#destroyed) return;
    const h = this.#app.renderer.height;
    this.#app.stage.scale.y = flipped ? -1 : 1;
    this.#app.stage.y = flipped ? h : 0;
    this.#weatherContainer.scale.y = flipped ? -1 : 1;
    this.#weatherContainer.y = flipped ? h : 0;
    this.#starContainer.scale.y = flipped ? -1 : 1;
    this.#starContainer.y = flipped ? h : 0;
  }

  /** Destroy application and free all GPU resources. */
  destroy() {
    if (this.#destroyed) return;
    log(3, 'HudSceneRenderer | destroy');
    this.#destroyed = true;
    this.#app.ticker.remove(this.#tick, this);
    this.#clearParticles();
    for (const { glow, sprite, shadow } of this.#moonPool) {
      sprite.mask = null;
      glow.mask = null;
      if (shadow._prevMask && shadow._prevMask !== shadow) shadow._prevMask.destroy();
      glow.destroy();
      sprite.destroy();
      shadow.destroy();
    }
    this.#moonPool = [];
    if (this.#moonTexture) {
      this.#moonTexture.destroy(true);
      this.#moonTexture = null;
    }
    if (this.#flashOverlay) {
      this.#flashOverlay.destroy();
      this.#flashOverlay = null;
    }
    if (this.#boltOverlay) {
      this.#boltOverlay.destroy();
      this.#boltOverlay = null;
    }
    if (this.#skyTextureBg) {
      this.#skyTextureBg.destroy(true);
      this.#skyTextureBg = null;
    }
    if (this.#skyTextureFg) {
      this.#skyTextureFg.destroy(true);
      this.#skyTextureFg = null;
    }
    for (const tex of this.#textures.values()) tex.destroy(true);
    this.#textures.clear();
    this.#app.destroy(false, { children: true, texture: true });
  }

  /**
   * Build the sky gradient layer (Layer 0). Two sprites for crossfade.
   * @private
   */
  #buildSkyLayer() {
    const w = this.#app.screen.width;
    const h = this.#app.screen.height;
    this.#skySpriteBg = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.#skySpriteBg.width = w;
    this.#skySpriteBg.height = h;
    this.#app.stage.addChild(this.#skySpriteBg);

    this.#skySpriteFg = new PIXI.Sprite(PIXI.Texture.EMPTY);
    this.#skySpriteFg.width = w;
    this.#skySpriteFg.height = h;
    this.#skySpriteFg.alpha = 0;
    this.#app.stage.addChild(this.#skySpriteFg);
  }

  /**
   * Build the star field layer (Layer 1).
   * @private
   */
  #buildStarLayer() {
    this.#starContainer = new PIXI.Container();
    this.#starContainer.alpha = 0;
    this.#app.stage.addChild(this.#starContainer);
    const g = new PIXI.Graphics();
    g.beginFill(0xffffff, 1);
    g.drawCircle(1, 1, 1);
    g.endFill();
    const starTex = this.#app.renderer.generateTexture(g, { resolution: 2 });
    g.destroy();
    const w = this.#app.screen.width;
    const h = this.#app.screen.height;
    for (let i = 0; i < 25; i++) {
      const sprite = new PIXI.Sprite(starTex);
      sprite.anchor.set(0.5);
      sprite.x = rand(4, w - 4);
      sprite.y = rand(4, h * 0.85);
      sprite.scale.set(rand(0.5, 1.2));
      sprite.alpha = 0.5;
      this.#starContainer.addChild(sprite);
      this.#stars.push(sprite);
      this.#starStates.push({ phase: rand(0, Math.PI * 2), speed: rand(0.015, 0.04) });
    }
  }

  /**
   * Build the sun layer (Layer 3).
   * @private
   */
  #buildSunLayer() {
    const size = 32;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = size;
    offCanvas.height = size;
    const ctx = offCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255, 250, 220, 1)');
    grad.addColorStop(0.3, 'rgba(255, 230, 100, 0.9)');
    grad.addColorStop(0.6, 'rgba(255, 200, 50, 0.5)');
    grad.addColorStop(1, 'rgba(255, 165, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    const sunTex = PIXI.Texture.from(offCanvas);
    this.#sunSprite = new PIXI.Sprite(sunTex);
    this.#sunSprite.anchor.set(0.5);
    this.#sunSprite.alpha = 0;
    this.#app.stage.addChild(this.#sunSprite);
    this.#sunCorona = new PIXI.Sprite(sunTex);
    this.#sunCorona.anchor.set(0.5);
    this.#sunCorona.alpha = 0;
    this.#app.stage.addChild(this.#sunCorona);
  }

  /**
   * Build the moon layer (Layer 4). Creates container and shared texture.
   * @private
   */
  #buildMoonLayer() {
    const size = 24;
    const offCanvas = document.createElement('canvas');
    offCanvas.width = size;
    offCanvas.height = size;
    const ctx = offCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(size * 0.4, size * 0.4, 0, size / 2, size / 2, size / 2);
    grad.addColorStop(0, 'rgba(255, 255, 248, 1)');
    grad.addColorStop(0.4, 'rgba(232, 232, 224, 0.9)');
    grad.addColorStop(1, 'rgba(200, 200, 184, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
    this.#moonTexture = PIXI.Texture.from(offCanvas);
    this.#moonContainer = new PIXI.Container();
    this.#app.stage.addChild(this.#moonContainer);
  }

  /**
   * Sync the moon sprite pool to match the desired count.
   * @param {number} count - Number of moons to render
   * @private
   */
  #syncMoonPool(count) {
    while (this.#moonPool.length > count) {
      const entry = this.#moonPool.pop();
      entry.sprite.mask = null;
      entry.glow.mask = null;
      if (entry.shadow._prevMask && entry.shadow._prevMask !== entry.shadow) entry.shadow._prevMask.destroy();
      entry.glow.destroy();
      entry.sprite.destroy();
      entry.shadow.destroy();
    }
    while (this.#moonPool.length < count) {
      const glow = new PIXI.Graphics();
      this.#moonContainer.addChild(glow);
      const sprite = new PIXI.Sprite(this.#moonTexture);
      sprite.anchor.set(0.5);
      sprite.alpha = 0;
      this.#moonContainer.addChild(sprite);
      const shadow = new PIXI.Graphics();
      this.#moonContainer.addChild(shadow);
      this.#moonPool.push({ glow, sprite, shadow });
    }
  }

  /**
   * Update sky gradient — crossfade between old and new colors.
   * @param {{top: number[], mid: number[], bottom: number[]}} colors - RGB arrays
   * @private
   */
  #updateSky(colors) {
    const target = [...colors.top, ...colors.mid, ...colors.bottom];
    if (this.#targetSkyRgb && target.every((v, i) => Math.abs(v - this.#targetSkyRgb[i]) < 0.5)) {
      this.#resizeSkySprites();
      return;
    }
    this.#targetSkyRgb = target;
    const texture = this.#generateSkyTexture(target);
    if (!this.#currentSkyRgb) {
      this.#currentSkyRgb = [...target];
      if (this.#skyTextureBg) this.#skyTextureBg.destroy(true);
      this.#skyTextureBg = texture;
      this.#skySpriteBg.texture = texture;
      this.#skySpriteBg.alpha = 1;
      this.#resizeSkySprites();
      return;
    }
    if (this.#skyTextureFg) this.#skyTextureFg.destroy(true);
    this.#skyTextureFg = texture;
    this.#skySpriteFg.texture = texture;
    this.#skySpriteFg.alpha = 0;
    this.#skyFade = 0;
    this.#skyFading = true;
    this.#resizeSkySprites();
  }

  /**
   * Generate a 1-pixel-wide gradient texture from 9 RGB values.
   * @param {number[]} c - Flat array of 9 values: [topR, topG, topB, midR, midG, midB, botR, botG, botB]
   * @returns {PIXI.Texture} Generated gradient texture
   * @private
   */
  #generateSkyTexture(c) {
    const gh = 64;
    const offCanvas = document.createElement('canvas');
    const isSlice = this.#mode === 'slice';
    offCanvas.width = isSlice ? gh : 1;
    offCanvas.height = isSlice ? 1 : gh;
    const ctx = offCanvas.getContext('2d');
    const grad = isSlice ? ctx.createLinearGradient(0, 0, gh, 0) : ctx.createLinearGradient(0, 0, 0, gh);
    grad.addColorStop(0, `rgb(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])})`);
    grad.addColorStop(0.5, `rgb(${Math.round(c[3])},${Math.round(c[4])},${Math.round(c[5])})`);
    grad.addColorStop(1, `rgb(${Math.round(c[6])},${Math.round(c[7])},${Math.round(c[8])})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, offCanvas.width, offCanvas.height);
    return PIXI.Texture.from(offCanvas);
  }

  /**
   * Resize both sky sprites to match app screen.
   * @private
   */
  #resizeSkySprites() {
    const w = this.#app.screen.width;
    const h = this.#app.screen.height;
    this.#skySpriteBg.width = w;
    this.#skySpriteBg.height = h;
    this.#skySpriteFg.width = w;
    this.#skySpriteFg.height = h;
  }

  /**
   * Update star container alpha (fades in at night).
   * @param {number} alpha - Target alpha 0-1
   * @private
   */
  #updateStars(alpha) {
    this.#starAlpha = alpha;
    this.#starContainer.alpha = alpha;
  }

  /**
   * Update sun position and visibility.
   * @param {number} hour - Current decimal hour
   * @param {number} sunrise - Sunrise hour
   * @param {number} sunset - Sunset hour
   * @private
   */
  #updateSun(hour, sunrise, sunset) {
    const isSunVisible = hour >= sunrise && hour < sunset;
    const sunAlpha = isSunVisible ? 1 : 0;
    this.#sunSprite.alpha = sunAlpha;
    this.#sunCorona.alpha = isSunVisible ? 0.12 : 0;
    if (!isSunVisible) return;
    const daylightHours = sunset - sunrise;
    const normalizedHour = Math.max(0, Math.min(daylightHours, hour - sunrise));
    const w = this.#app.screen.width;
    const h = this.#app.screen.height;
    if (this.#mode === 'dome') {
      const sunSize = w > 120 ? 20 : 16;
      const trackWidth = w > 120 ? 140 : 100;
      const trackHeight = w > 120 ? 70 : 50;
      const angle = (normalizedHour / daylightHours) * Math.PI;
      const centerX = w / 2;
      const centerY = h;
      const radius = Math.min(trackWidth / 2, trackHeight) - sunSize / 2 - 4;
      const x = centerX - radius * Math.cos(angle);
      const y = centerY - radius * Math.sin(angle);
      this.#sunSprite.x = x;
      this.#sunSprite.y = y;
      this.#sunSprite.scale.set(sunSize / 32);
      this.#sunCorona.x = x;
      this.#sunCorona.y = y;
      this.#sunCorona.scale.set((sunSize * 2) / 32);
    } else {
      const sunSize = w > 110 ? 14 : 12;
      const padding = sunSize / 2 + 4;
      const availableWidth = w - padding * 2;
      const x = padding + (normalizedHour / daylightHours) * availableWidth;
      this.#sunSprite.x = x;
      this.#sunSprite.y = h / 2;
      this.#sunSprite.scale.set(sunSize / 32);
      this.#sunCorona.x = x;
      this.#sunCorona.y = h / 2;
      this.#sunCorona.scale.set((sunSize * 2) / 32);
    }
  }

  /**
   * Update all moon positions, visibility, and phase shadows.
   * @param {number} hour - Current decimal hour
   * @param {number} sunrise - Sunrise hour
   * @param {number} sunset - Sunset hour
   * @param {number} hoursPerDay - Total hours per day
   * @param {{phase: number, color: string|null, name: string}[]} moons - Moon data array
   * @private
   */
  #updateMoons(hour, sunrise, sunset, hoursPerDay, moons) {
    this.#syncMoonPool(moons.length);
    const fadeDuration = 0.25;
    let moonAlpha = 1;
    if (hour >= sunrise && hour < sunset) {
      if (hour < sunrise + fadeDuration) moonAlpha = 1 - (hour - sunrise) / fadeDuration;
      else moonAlpha = 0;
    } else {
      if (hour >= sunset && hour < sunset + fadeDuration) moonAlpha = (hour - sunset) / fadeDuration;
      if (hour < sunrise && hour > sunrise - fadeDuration) moonAlpha = (sunrise - hour) / fadeDuration;
    }
    moonAlpha = Math.max(0, Math.min(1, moonAlpha));
    if (moonAlpha <= 0) {
      for (const { glow, sprite, shadow } of this.#moonPool) {
        glow.alpha = 0;
        sprite.alpha = 0;
        shadow.alpha = 0;
      }
      return;
    }
    const nightHours = hoursPerDay - (sunset - sunrise);
    let normalizedHour;
    if (hour >= sunset) normalizedHour = hour - sunset;
    else normalizedHour = hoursPerDay - sunset + hour;
    normalizedHour = Math.max(0, Math.min(nightHours, normalizedHour));
    const w = this.#app.screen.width;
    const h = this.#app.screen.height;
    const count = moons.length;
    const baseMoonSize = this.#mode === 'dome' ? (w > 120 ? 18 : 14) : w > 110 ? 12 : 10;
    const secondaryScale = Math.max(0.6, 0.92 - Math.max(0, count - 3) * 0.03);
    const trailSpacing = baseMoonSize * secondaryScale * 1.3;
    let arcPixels;
    if (this.#mode === 'dome') {
      const trackWidth = w > 120 ? 140 : 100;
      const trackHeight = w > 120 ? 70 : 50;
      const arcRadius = Math.min(trackWidth / 2, trackHeight) - baseMoonSize / 2 - 4;
      arcPixels = arcRadius * Math.PI;
    } else {
      const padding = baseMoonSize / 2 + 4;
      arcPixels = w - padding * 2;
    }
    const hoursPerPixel = nightHours / arcPixels;
    const trailHours = trailSpacing * hoursPerPixel;
    for (let i = 0; i < count; i++) {
      const { phase: moonPhase, color } = moons[i];
      const { glow, sprite, shadow } = this.#moonPool[i];
      glow.alpha = moonAlpha;
      sprite.alpha = moonAlpha;
      shadow.alpha = moonAlpha;
      let moonSize = i === 0 ? baseMoonSize : baseMoonSize * secondaryScale;
      const trailingHour = normalizedHour - i * trailHours;
      let moonX, moonY;
      if (this.#mode === 'dome') {
        const trackWidth = w > 120 ? 140 : 100;
        const trackHeight = w > 120 ? 70 : 50;
        const angle = (trailingHour / nightHours) * Math.PI;
        const centerX = w / 2;
        const centerY = h;
        const arcRadius = Math.min(trackWidth / 2, trackHeight) - baseMoonSize / 2 - 4;
        moonX = centerX - arcRadius * Math.cos(angle);
        moonY = centerY - arcRadius * Math.sin(angle);
      } else {
        const padding = baseMoonSize / 2 + 4;
        const availableWidth = w - padding * 2;
        moonX = padding + (trailingHour / nightHours) * availableWidth;
        moonY = h / 2;
      }
      sprite.x = moonX;
      sprite.y = moonY;
      sprite.scale.set(moonSize / 24);
      sprite.tint = 0xffffff;
      const rad = moonSize / 2;
      const illumination = 1 - Math.abs(moonPhase * 2 - 1);
      const isWaxing = moonPhase < 0.5;
      glow.clear();
      if (color) {
        const cHex = parseInt(color.replace('#', ''), 16);
        const cr = (((cHex >> 16) & 0xff) + 255) >> 1;
        const cg = (((cHex >> 8) & 0xff) + 255) >> 1;
        const cb = ((cHex & 0xff) + 255) >> 1;
        const mixed = (cr << 16) | (cg << 8) | cb;
        glow.beginFill(mixed, 0.45);
        glow.drawCircle(moonX, moonY, rad);
        glow.endFill();
      }
      glow.lineStyle(1, 0xffffff, 0.12);
      glow.drawCircle(moonX, moonY, rad + 1);
      shadow.clear();
      if (illumination < 0.02) {
        sprite.alpha = 0;
        glow.alpha = 0;
        shadow.alpha = 0;
        continue;
      }
      if (illumination > 0.98) {
        sprite.mask = null;
        glow.mask = null;
        if (shadow._prevMask && shadow._prevMask !== shadow) {
          shadow._prevMask.destroy();
          shadow._prevMask = null;
        }
        continue;
      }
      const terminatorRx = rad * Math.cos(illumination * Math.PI);
      const k = 0.5522847498;
      shadow.beginFill(0xffffff);
      if (isWaxing) {
        shadow.moveTo(moonX, moonY - rad);
        shadow.arc(moonX, moonY, rad, -Math.PI / 2, Math.PI / 2);
        shadow.bezierCurveTo(moonX + terminatorRx * k, moonY + rad, moonX + terminatorRx, moonY + rad * k, moonX + terminatorRx, moonY);
        shadow.bezierCurveTo(moonX + terminatorRx, moonY - rad * k, moonX + terminatorRx * k, moonY - rad, moonX, moonY - rad);
      } else {
        shadow.moveTo(moonX, moonY - rad);
        shadow.arc(moonX, moonY, rad, -Math.PI / 2, -Math.PI * 1.5, true);
        shadow.bezierCurveTo(moonX - terminatorRx * k, moonY + rad, moonX - terminatorRx, moonY + rad * k, moonX - terminatorRx, moonY);
        shadow.bezierCurveTo(moonX - terminatorRx, moonY - rad * k, moonX - terminatorRx * k, moonY - rad, moonX, moonY - rad);
      }
      shadow.endFill();
      sprite.mask = shadow;
      glow.mask = shadow;
      if (shadow._prevMask && shadow._prevMask !== shadow) shadow._prevMask.destroy();
      shadow._prevMask = shadow;
    }
  }

  /**
   * Merge visual overrides onto a base effect config.
   * @param {object} base - Base effect configuration
   * @param {object|null} overrides - Override values to apply
   * @returns {object} Merged configuration
   * @private
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

  /**
   * Destroy all particle sprites (including trails), clear arrays, and remove children from container.
   * @private
   */
  #clearParticles() {
    for (const state of this.#particles) if (state.trailSprites) for (const ts of state.trailSprites) ts.destroy();
    for (const sprite of this.#sprites) sprite.destroy();
    this.#sprites = [];
    this.#particles = [];
    this.#weatherContainer.removeChildren();
  }

  /**
   * Generate all procedural particle textures (rain, snow, clouds, fog, etc.) via PIXI.Graphics.
   * @private
   */
  #generateTextures() {
    const g = new PIXI.Graphics();
    const gen = (name, drawFn) => {
      g.clear();
      drawFn(g);
      this.#textures.set(name, this.#app.renderer.generateTexture(g, { resolution: 2 }));
    };
    gen('raindrop', (g) => {
      g.beginFill(0xffffff, 0.7);
      g.drawRect(0, 0, 1.5, 8);
      g.endFill();
    });
    gen('snowflake', (g) => {
      const cx = 6,
        cy = 6,
        arm = 5,
        thick = 1.2;
      g.beginFill(0xffffff, 0.85);
      for (let a = 0; a < 3; a++) {
        const angle = (a * Math.PI) / 3;
        const cos = Math.cos(angle),
          sin = Math.sin(angle);
        const dx = cos * arm,
          dy = sin * arm;
        const nx = -sin * thick * 0.5,
          ny = cos * thick * 0.5;
        g.moveTo(cx - dx + nx, cy - dy + ny);
        g.lineTo(cx + dx + nx, cy + dy + ny);
        g.lineTo(cx + dx - nx, cy + dy - ny);
        g.lineTo(cx - dx - nx, cy - dy - ny);
        g.closePath();
      }
      g.endFill();
    });
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
    gen('fogBlob', (g) => {
      g.beginFill(0xffffff, 0.2);
      g.drawCircle(12, 10, 10);
      g.drawCircle(20, 12, 8);
      g.drawCircle(8, 14, 7);
      g.drawCircle(16, 8, 9);
      g.endFill();
    });
    gen('hailstone', (g) => {
      g.beginFill(0xffffff, 0.8);
      g.drawRoundedRect(0, 0, 4, 5, 1);
      g.endFill();
    });
    gen('debris', (g) => {
      g.beginFill(0xffffff, 0.7);
      g.drawRect(0, 0, 3, 2);
      g.endFill();
    });
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
    gen('grain', (g) => {
      g.beginFill(0xffffff, 0.6);
      g.drawCircle(1, 1, 1.5);
      g.endFill();
    });
    gen('ash', (g) => {
      g.beginFill(0xffffff, 0.6);
      g.drawEllipse(2, 2, 2.5, 1.5);
      g.endFill();
    });
    gen('ember', (g) => {
      g.beginFill(0xffffff, 0.25);
      g.drawCircle(4, 4, 4);
      g.endFill();
      g.beginFill(0xffffff, 0.9);
      g.drawCircle(4, 4, 1.8);
      g.endFill();
    });
    gen('shard', (g) => {
      g.beginFill(0xffffff, 0.7);
      g.moveTo(3, 0);
      g.lineTo(6, 4);
      g.lineTo(3, 8);
      g.lineTo(0, 4);
      g.closePath();
      g.endFill();
    });
    gen('pixel', (g) => {
      g.beginFill(0xffffff, 0.8);
      g.drawRect(0, 0, 2, 2);
      g.endFill();
    });
    gen('band', (g) => {
      g.beginFill(0xffffff, 0.2);
      g.drawEllipse(24, 4, 22, 3);
      g.drawEllipse(20, 8, 18, 3);
      g.drawEllipse(28, 6, 16, 2.5);
      g.drawEllipse(16, 10, 14, 2);
      g.endFill();
    });
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
    gen('mote', (g) => {
      g.beginFill(0xffffff, 0.9);
      g.drawCircle(2, 2, 2);
      g.endFill();
    });
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

  /**
   * Build the particle pool for the current effect based on config, intensity, and performance settings.
   * @private
   */
  #buildParticles() {
    const baseConfig = EFFECT_CONFIGS[this.#currentEffect];
    if (!baseConfig || baseConfig.particles === 0) return;
    if (this.#perfConfig.particleScale === 0) return;
    const config = this.#mergeConfig(baseConfig, this.#visualOverrides);
    const w = this.#app.screen.width;
    const h = this.#app.screen.height;
    const intensity = this.#weatherOptions.precipIntensity || 0.5;
    const countRange = config.count;
    const count = Math.round((countRange[0] + (countRange[1] - countRange[0]) * intensity) * this.#perfConfig.particleScale);
    const texture = this.#textures.get(config.texture);
    if (!texture) return;
    const variants = config.textureVariants?.map((name) => this.#textures.get(name)).filter(Boolean) ?? [];
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
      this.#weatherContainer.addChild(sprite);
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
            this.#weatherContainer.addChildAt(ts, 0);
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
        this.#weatherContainer.addChild(sprite);
        this.#sprites.push(sprite);
        this.#particles.push(state);
      }
    }
  }

  /**
   * Main animation tick.
   * @param {number} delta - Frame delta
   * @private
   */
  #tick(delta) {
    if (this.#destroyed) return;
    this.#time += delta;
    if (this.#starAlpha > 0 && this.#perfConfig.enableStarTwinkle) {
      for (let i = 0; i < this.#stars.length; i++) {
        const star = this.#stars[i];
        const state = this.#starStates[i];
        star.alpha = 0.3 + 0.7 * Math.abs(Math.sin(this.#time * state.speed + state.phase));
      }
    }
    if (this.#sunCorona.alpha > 0 && this.#perfConfig.enableCoronaPulse) this.#sunCorona.alpha = 0.1 + 0.05 * Math.sin(this.#time * 0.02);
    if (this.#skyFading) {
      this.#skyFade = Math.min(1, this.#skyFade + 0.02 * delta);
      this.#skySpriteFg.alpha = this.#skyFade;
      if (this.#skyFade >= 1) {
        const oldBg = this.#skyTextureBg;
        this.#skyTextureBg = this.#skyTextureFg;
        this.#skySpriteBg.texture = this.#skyTextureBg;
        this.#skySpriteBg.alpha = 1;
        this.#skySpriteFg.texture = PIXI.Texture.EMPTY;
        this.#skySpriteFg.alpha = 0;
        this.#skyTextureFg = null;
        if (oldBg) oldBg.destroy(true);
        this.#currentSkyRgb = [...this.#targetSkyRgb];
        this.#skyFading = false;
      }
    }
    if (this.#weatherFadeDir === 'out') {
      this.#weatherFade = Math.max(0, this.#weatherFade - 0.04 * delta);
      this.#weatherContainer.alpha = this.#weatherFade;
      if (this.#weatherFade <= 0) {
        this.#currentEffect = this.#pendingEffect;
        this.#visualOverrides = this.#pendingOverrides;
        this.#pendingEffect = null;
        this.#pendingOverrides = null;
        this.#clearParticles();
        this.#buildParticles();
        this.#weatherFadeDir = 'in';
      }
    } else if (this.#weatherFadeDir === 'in') {
      this.#weatherFade = Math.min(1, this.#weatherFade + 0.04 * delta);
      this.#weatherContainer.alpha = this.#weatherFade;
      if (this.#weatherFade >= 1) this.#weatherFadeDir = 'idle';
    }
    if (this.#currentEffect === 'clear') return;
    const config = EFFECT_CONFIGS[this.#currentEffect];
    if (!config) return;
    const w = this.#app.screen.width;
    const h = this.#app.screen.height;
    const windFactor = this.#weatherOptions.windSpeed * 0.4;
    const windRad = ((this.#weatherOptions.windDirection ?? 0) * Math.PI) / 180;
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
   * Trigger a lightning flash with segmented bolt graphic and animated strobe decay.
   * @private
   */
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
    const segColor = (s) => (isRainbow ? hslToHex((baseHue + (s * 360) / segments) % 360, 1, 0.65) : 0xffffff);
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
