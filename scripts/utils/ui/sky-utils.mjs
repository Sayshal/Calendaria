/**
 * Shared sky color utilities for HUD dome and Sun Dial.
 * @module Utils/SkyUtils
 * @author Tyler
 */

import { MODULE, SETTINGS } from '../../constants.mjs';
import { getPreset } from '../../weather/data/weather-presets.mjs';
import WeatherManager from '../../weather/weather-manager.mjs';
import { SKY_KEYFRAMES, SKY_OVERRIDES } from '../../applications/hud/hud-scene-renderer.mjs';

/**
 * Linearly interpolate between two hex color strings, returning [r,g,b].
 * @param {string} color1 - Start color (#RRGGBB)
 * @param {string} color2 - End color (#RRGGBB)
 * @param {number} t - Interpolation factor (0-1)
 * @returns {number[]} [r, g, b] array
 */
export function lerpColorRgb(color1, color2, t) {
  const r1 = parseInt(color1.slice(1, 3), 16);
  const g1 = parseInt(color1.slice(3, 5), 16);
  const b1 = parseInt(color1.slice(5, 7), 16);
  const r2 = parseInt(color2.slice(1, 3), 16);
  const g2 = parseInt(color2.slice(3, 5), 16);
  const b2 = parseInt(color2.slice(5, 7), 16);
  return [Math.round(r1 + (r2 - r1) * t), Math.round(g1 + (g2 - g1) * t), Math.round(b1 + (b2 - b1) * t)];
}

/**
 * Get interpolated sky colors for a given hour as RGB arrays.
 * @param {number} hour - Hour (0-hoursPerDay, decimal)
 * @param {object} [calendar] - Calendar instance (for hoursPerDay)
 * @returns {{top: number[], mid: number[], bottom: number[]}} Sky gradient colors as [r,g,b]
 */
export function getSkyColorsRgb(hour, calendar) {
  const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
  hour = ((hour / hoursPerDay) * 24 + 24) % 24;
  let kf1 = SKY_KEYFRAMES[0];
  let kf2 = SKY_KEYFRAMES[1];
  for (let i = 0; i < SKY_KEYFRAMES.length - 1; i++) {
    if (hour >= SKY_KEYFRAMES[i].hour && hour < SKY_KEYFRAMES[i + 1].hour) {
      kf1 = SKY_KEYFRAMES[i];
      kf2 = SKY_KEYFRAMES[i + 1];
      break;
    }
  }
  const range = kf2.hour - kf1.hour;
  const t = range > 0 ? (hour - kf1.hour) / range : 0;
  return { top: lerpColorRgb(kf1.top, kf2.top, t), mid: lerpColorRgb(kf1.mid, kf2.mid, t), bottom: lerpColorRgb(kf1.bottom, kf2.bottom, t) };
}

/**
 * Resolve visual and sky overrides for a weather preset.
 * @param {object|null} preset - The weather preset object
 * @returns {{hudEffect: string|null, visualOverrides: object|null, skyOverrides: object|null}}
 */
function resolveOverrides(preset) {
  if (!preset) return { hudEffect: null, visualOverrides: null, skyOverrides: null };
  if (preset.category === 'custom') return { hudEffect: preset.hudEffect || null, visualOverrides: preset.visualOverrides || null, skyOverrides: preset.skyOverrides || null };
  const overrides = game.settings.get(MODULE.ID, SETTINGS.WEATHER_VISUAL_OVERRIDES) || {};
  const entry = overrides[preset.id];
  if (!entry) return { hudEffect: null, visualOverrides: null, skyOverrides: null };
  return { hudEffect: entry.hudEffect || null, visualOverrides: entry.visualOverrides || null, skyOverrides: entry.skyOverrides || null };
}

/**
 * Apply weather-based sky color tint to gradient colors (RGB array form).
 * @param {{top: number[], mid: number[], bottom: number[]}} colors - Sky colors as [r,g,b]
 * @returns {{top: number[], mid: number[], bottom: number[]}} Tinted colors
 */
export function applyWeatherSkyTint(colors) {
  const weather = WeatherManager.getCurrentWeather(null, game.scenes?.active);
  if (!weather) return colors;
  const customPresets = game.settings.get(MODULE.ID, SETTINGS.CUSTOM_WEATHER_PRESETS) || [];
  const preset = getPreset(weather.id, customPresets);
  const resolved = resolveOverrides(preset);
  const effect = resolved.hudEffect || preset?.hudEffect || 'clear';
  const { skyOverrides } = resolved;
  const override = skyOverrides
    ? {
        strength: skyOverrides.strength ?? SKY_OVERRIDES[effect]?.strength ?? 0.7,
        top: skyOverrides.top ?? SKY_OVERRIDES[effect]?.top,
        mid: skyOverrides.mid ?? SKY_OVERRIDES[effect]?.mid,
        bottom: skyOverrides.bottom ?? SKY_OVERRIDES[effect]?.bottom
      }
    : SKY_OVERRIDES[effect];
  if (!override || !override.top) return colors;
  const strength = override.strength ?? 0.7;
  const blend = (rgb, overrideRgb) => [
    Math.round(rgb[0] * (1 - strength) + overrideRgb[0] * strength),
    Math.round(rgb[1] * (1 - strength) + overrideRgb[1] * strength),
    Math.round(rgb[2] * (1 - strength) + overrideRgb[2] * strength)
  ];
  return { top: blend(colors.top, override.top), mid: blend(colors.mid, override.mid), bottom: blend(colors.bottom, override.bottom) };
}

/**
 * Compute star alpha based on hour and sunrise/sunset.
 * @param {number} hour - Current decimal hour
 * @param {number} sunrise - Sunrise hour
 * @param {number} sunset - Sunset hour
 * @returns {number} Star alpha (0-1)
 */
export function computeStarAlpha(hour, sunrise, sunset) {
  const dawnStart = sunrise - 0.5;
  const dawnEnd = sunrise + 1;
  const duskStart = sunset - 0.5;
  const duskEnd = sunset + 1;
  if (hour < dawnStart || hour > duskEnd) return 1;
  if (hour >= dawnStart && hour < dawnEnd) return Math.max(0, Math.min(1, 1 - (hour - dawnStart) / 1.5));
  if (hour > duskStart && hour <= duskEnd) return Math.max(0, Math.min(1, (hour - duskStart) / 1.5));
  return 0;
}
