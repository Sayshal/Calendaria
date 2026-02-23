# Scene Ambience

Calendaria can automatically sync scene darkness, lighting, and color with time of day, weather, and moon phases.

## Darkness Sync

Darkness follows a smooth cosine curve throughout the day:

- **Midnight**: Maximum darkness (1.0)
- **Noon**: Minimum darkness (0.0)
- **Dawn/Dusk**: Gradual transitions

Darkness recalculates when the hour changes (with smooth transitions) and immediately syncs when switching to a new scene. Only the GM can update scene darkness.

Enable via **Settings Panel > Canvas tab > Sync Scene Darkness with Time** (default: enabled).

### Brightness Multiplier

A global brightness multiplier (0.5x–1.5x, default 1.0x) is applied to all scenes unless overridden per-scene. Configure in **Settings Panel > Canvas tab**.

### Per-Scene Override

Override settings for individual scenes via **Scene Configuration > Ambiance tab**:

| Setting               | Options                                                          |
| --------------------- | ---------------------------------------------------------------- |
| Darkness Sync         | Use Global / Enabled / Disabled                                  |
| Brightness Multiplier | 0.5x - 1.5x slider                                               |
| Hide HUD for Players  | Automatically hide the HUD for players when this scene is active |
| Climate Zone Override | Use a different climate zone than the calendar's default         |

---

## Dynamic Daylight

When **Enable Dynamic Daylight** is enabled in Calendar Editor > Time tab, daylight hours vary throughout the year. Sunrise and sunset times shift to reflect longer summer days and shorter winter days.

Darkness is shaped by the actual sunrise and sunset times. The curve transitions smoothly from full darkness at midnight through dawn, stays minimal during daylight, then rises again through dusk.

### Per-Zone Daylight

Climate zones can override the global daylight curve with zone-specific settings. This means different scenes can have different sunrise/sunset times based on their assigned zone.

Daylight is resolved using the following priority (first match wins):

| Priority | Source              | Description                                                                     |
| -------- | ------------------- | ------------------------------------------------------------------------------- |
| 1        | **Zone Latitude**   | Astronomical hour-angle calculation based on the zone's latitude (-90° to +90°) |
| 2        | **Zone Manual**     | Custom shortest/longest day hours set directly on the zone                      |
| 3        | **Global Daylight** | Calendar-wide solstice settings from the Time tab                               |
| 4        | **Static Fallback** | 50% of the day (e.g., 12h for a 24h day)                                        |

### Latitude-Based Daylight

When a zone has a latitude set, Calendaria uses an astronomical hour-angle formula to compute daylight hours for each day of the year. This produces realistic seasonal variation:

- **Equator (0°)**: ~12 hours year-round
- **Mid-latitudes (±45°)**: ~8-16 hours depending on season
- **Polar regions (±66°+)**: Polar day/night extremes near solstices

> [!NOTE]
> The formula adapts to the calendar's year length, hours per day, and configured summer solstice date — so it works with non-Earth calendars too.

---

## Moon Illumination

Moons can reduce nighttime darkness based on their phase. Each moon's `moonBrightnessMax` (0–0.3) is set in Calendar Editor > Moons tab. Illumination follows a cosine curve — maximum at full moon, zero at new moon. Multiple moons sum their contributions (capped at 0.3), each tinted with its configured color.

Enable via **Settings Panel > Canvas tab > Moon Illumination**.

See [Moon Phases — Moon Brightness](Moon-Phases#moon-brightness) for configuration details.

---

## Time-of-Day Color Shifting

Climate zones can define dawn/dusk/night hue values that shift scene environment lighting throughout the day. Five phases control the hue: night, dawn transition, day (neutral), dusk transition, and night transition. Transition durations are configurable per-zone.

Color shifting is independent of darkness — hue changes apply to environment lighting while darkness is controlled separately by time, weather, and moon illumination.

Configure per-zone in the [Climate Editor](Climate-Editor) > Environment tab. Enable globally via **Settings Panel > Canvas tab > Sync Scene Ambience with Time of Day**.

---

## Darkness Modifiers

The final darkness value combines multiple factors:

```text
Base darkness (from time of day)
  × Scene brightness multiplier
  × Climate zone brightness multiplier
  + Weather darkness penalty
  - Moon illumination (capped at 0.3)
= Final darkness (clamped 0-1)
```

### Weather Darkness Penalty

Weather conditions add darkness:

| Condition    | Penalty |
| ------------ | ------- |
| Clear        | 0       |
| Overcast     | +0.1    |
| Heavy Rain   | +0.2    |
| Thunderstorm | +0.3    |

### Climate Zone Brightness

Climate zones can define a brightness multiplier that scales overall scene brightness.

---

## Environment Lighting

When **Sync Scene Ambience with Weather** is enabled (default), Calendaria syncs the full set of Foundry scene environment properties with weather and climate settings:

- **Per channel (Day/Night)**: Hue, intensity, luminosity, saturation, shadows
- **Global**: Blend ambience (cycle) toggle

Weather preset values take precedence, with climate zone values as fallback. When neither defines overrides, the scene's existing environment settings are preserved — no values are reset.

Configure per-preset in the [Weather Editor](Weather-Editor) and per-zone in the [Climate Editor](Climate-Editor) > Environment tab.

---

## For Developers

See [API Reference](API-Reference#daynight--sun-position) for sunrise/sunset methods, day/night checks, and time-until calculations.

See [Hooks](Hooks) for `updateWorldTime` and `calendaria.weatherChange` hooks that trigger darkness updates.
