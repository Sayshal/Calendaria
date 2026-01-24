# Scene Darkness

Calendaria can automatically sync scene darkness levels with the time of day.

## How It Works

Darkness follows a smooth cosine curve throughout the day:

- **Midnight**: Maximum darkness (1.0)
- **Noon**: Minimum darkness (0.0)
- **Dawn/Dusk**: Gradual transitions

Darkness updates in two scenarios:

1. **Time changes**: When the hour changes, darkness recalculates with smooth transitions
2. **Scene activation**: When switching to a new scene, darkness is immediately synced to the current time

Only the GM can update scene darkness.

---

## Settings

### Global Setting

Enable via **Settings Panel > Canvas tab > Sync Scene Darkness with Time** (default: enabled).

### Default Brightness Multiplier

A global brightness multiplier applied to all scenes unless overridden. Configure in **Settings Panel > Canvas tab** (range 0.5x-1.5x, default 1.0x).

### Per-Scene Override

Override settings for individual scenes via **Scene Configuration > Ambiance tab**:

| Setting               | Options                         |
| --------------------- | ------------------------------- |
| Darkness Sync         | Use Global / Enabled / Disabled |
| Brightness Multiplier | 0.5x - 1.5x slider              |

---

## Dynamic Daylight

When **Enable Dynamic Daylight** is enabled in Calendar Editor, daylight hours vary throughout the year based on solstice configuration. Sunrise and sunset times shift to reflect longer summer days and shorter winter days.

---

## Darkness Modifiers

The final darkness value combines multiple factors:

```text
Base darkness (from time of day)
  × Scene brightness multiplier
  × Climate zone brightness multiplier
  + Weather darkness penalty
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

When **Sync Scene Ambience with Weather** is enabled (default), scene hue and saturation also sync with weather and climate settings.

---

## For Developers

See [API Reference](API-Reference#daynight--sun-position) for sunrise/sunset methods, day/night checks, and time-until calculations.

See [Hooks](Hooks) for `updateWorldTime` and `calendaria.weatherChange` hooks that trigger darkness updates.
