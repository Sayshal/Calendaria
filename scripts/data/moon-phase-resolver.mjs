/**
 * Seeded PRNG moon phase resolver for randomized moon cycles.
 * @module Calendar/Data/MoonPhaseResolver
 * @author Tyler
 */

/** @type {Map<string, {day: number, position: number}>} Per-moon position cache */
const positionCache = new Map();

/**
 * Mulberry32 seeded PRNG. Returns a function that produces 0-1 floats.
 * @param {number} seed - Integer seed value
 * @returns {function(): number} PRNG function returning 0-1
 */
function mulberry32(seed) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Get a deterministic 0-1 float for a seed and integer key.
 * @param {number} seed - Base seed
 * @param {number} key - Integer key (e.g., cycle index, day number)
 * @returns {number} 0-1 float
 */
function hash(seed, key) {
  const rng = mulberry32(seed ^ (key * 2654435761));
  rng();
  return rng();
}

/**
 * Smoothed noise function — interpolates between hashed values at integer intervals.
 * @param {number} seed - Base seed
 * @param {number} x - Continuous input value
 * @returns {number} Smooth 0-1 noise value
 */
function smoothNoise(seed, x) {
  const i = Math.floor(x);
  const f = x - i;
  const n0 = hash(seed, i);
  const n1 = hash(seed, i + 1);
  const t = f * f * (3 - 2 * f); // Smoothstep
  return n0 + (n1 - n0) * t;
}

/**
 * Resolve the phase position (0-1) for a randomized moon on a given day.
 * @param {object} moon - Moon definition with phaseMode, phaseSeed, cycleVariance, anchorPhases, cycleLength
 * @param {number} absoluteDay - Absolute day number from calendar._componentsToDays()
 * @param {object} [dateComponents] - {year, month, dayOfMonth} for anchor matching
 * @returns {number} Phase position 0-1
 */
export function resolveRandomizedPhase(moon, absoluteDay, dateComponents = null) {
  const cacheKey = `${moon.phaseSeed ?? 0}_${absoluteDay}`;
  const cached = positionCache.get(cacheKey);
  if (cached?.day === absoluteDay) return cached.position;
  const anchorPosition = findAnchorPhasePosition(moon, dateComponents);
  if (anchorPosition !== null) {
    positionCache.set(cacheKey, { day: absoluteDay, position: anchorPosition });
    return anchorPosition;
  }
  const position = calculateRandomizedPosition(moon, absoluteDay);
  positionCache.set(cacheKey, { day: absoluteDay, position });
  if (positionCache.size > 2000) {
    const keys = positionCache.keys();
    for (let i = 0; i < 500; i++) positionCache.delete(keys.next().value);
  }
  return position;
}

/**
 * Check if a date matches an anchor phase and return its position.
 * @param {object} moon - Moon definition with anchorPhases
 * @param {object} dateComponents - {year, month, dayOfMonth}
 * @returns {number|null} Phase position if anchored, null otherwise
 */
export function findAnchorPhasePosition(moon, dateComponents) {
  if (!dateComponents || !moon.anchorPhases) return null;
  const anchors = Object.values(moon.anchorPhases);
  if (!anchors.length) return null;
  for (const anchor of anchors) {
    if (anchor.year != null && anchor.year !== dateComponents.year) continue;
    if (anchor.month !== dateComponents.month) continue;
    if (anchor.dayOfMonth !== dateComponents.dayOfMonth) continue;
    return getPhasePositionFromIndex(moon, anchor.phaseIndex);
  }
  return null;
}

/**
 * Get the midpoint position (0-1) for a phase by its index.
 * @param {object} moon - Moon definition with phases
 * @param {number} phaseIndex - Index of the phase
 * @returns {number} Midpoint position 0-1
 */
export function getPhasePositionFromIndex(moon, phaseIndex) {
  const phases = moon.phases ? Object.values(moon.phases) : [];
  if (!phases.length) return 0;
  const idx = Math.min(phaseIndex, phases.length - 1);
  if (moon.phaseMode === 'randomized') {
    const weights = phases.map((p) => Math.max(1, p.weight ?? 1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let cursor = 0;
    for (let i = 0; i < idx; i++) cursor += weights[i];
    const start = cursor / totalWeight;
    const end = idx === phases.length - 1 ? 1 : (cursor + weights[idx]) / totalWeight;
    return (start + end) / 2;
  }
  const phase = phases[idx];
  if (phase?.start != null && phase?.end != null) {
    const start = phase.start;
    const end = phase.end > start ? phase.end : phase.end + 1;
    return ((start + end) / 2) % 1;
  }
  return (idx + 0.5) / phases.length;
}

/**
 * Calculate a randomized phase position using multi-octave smooth noise.
 * @param {object} moon - Moon definition
 * @param {number} absoluteDay - Absolute day number
 * @returns {number} Phase position 0-1
 */
function calculateRandomizedPosition(moon, absoluteDay) {
  const seed = moon.phaseSeed ?? 0;
  const baseCycle = moon.cycleLength || 28;
  const variance = Math.min(Math.max(moon.cycleVariance ?? 0, 0), 1);
  const basePosition = (((absoluteDay % baseCycle) + baseCycle) % baseCycle) / baseCycle;
  if (variance === 0) return basePosition;
  const rapidNoise = smoothNoise(seed ^ 0x1234abcd, absoluteDay / 3);
  const fastNoise = smoothNoise(seed ^ 0x5678ef01, absoluteDay / Math.max(3, baseCycle / 3));
  const mediumNoise = smoothNoise(seed, absoluteDay / baseCycle);
  const slowNoise = smoothNoise(seed ^ 0x9e3779b9, absoluteDay / (baseCycle * 3));
  const combinedNoise = rapidNoise * 0.35 + fastNoise * 0.25 + mediumNoise * 0.25 + slowNoise * 0.15;
  const offset = (combinedNoise - 0.5) * variance * 4;
  return (((basePosition + offset) % 1) + 1) % 1;
}

/**
 * Clear the position cache (call when calendar data changes).
 */
export function clearPhaseCache() {
  positionCache.clear();
}
