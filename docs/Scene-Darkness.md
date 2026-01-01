# Scene Darkness

Calendaria can automatically sync scene darkness levels with the time of day.

## How It Works

The `calculateDarknessFromTime` function uses a cosine curve based on total minutes in the day:

```javascript
const totalMinutes = hours * 60 + minutes;
const dayProgress = totalMinutes / (24 * 60);
const darkness = (Math.cos(dayProgress * 2 * Math.PI) + 1) / 2;
```

- **Midnight (00:00)**: Maximum darkness (1.0)
- **Noon (12:00)**: Minimum darkness (0.0)
- **Dawn/Dusk**: Gradual cosine transitions

Darkness updates trigger only when the hour changes. The transition uses eased animation via `requestAnimationFrame` over 500-3000ms depending on game time speed.

---

## Settings

### Global Setting

Located in **Settings Panel > Time Integration > Sync Scene Darkness with Time**.

Registered as `calendaria.darknessSync` (boolean, default `true`).

### Per-Scene Override

A dropdown is injected into the Scene Configuration sheet (Ambiance tab):

| Value | Behavior |
|-------|----------|
| Use Global Setting | Follows the module setting |
| Enabled | Always sync this scene |
| Disabled | Never sync this scene |

Stored as scene flag `calendaria.darknessSync` with values: `"default"`, `"enabled"`, or `"disabled"`.

---

## Sunrise/Sunset Calculation

The calendar provides sunrise and sunset times via dynamic daylight calculations. These are used by the API but **not** by the darkness sync itself.

If `calendar.daylight.enabled` is true, daylight hours vary throughout the year using solstice configuration:

```javascript
// Cosine interpolation between winter and summer solstices
const cosineProgress = (1 - Math.cos(progress * Math.PI)) / 2;
return shortestDay + (longestDay - shortestDay) * cosineProgress;
```

Sunrise and sunset are calculated symmetrically around midday:

```javascript
sunrise = midday - daylightHours / 2;
sunset = midday + daylightHours / 2;
```

---

## API

### Sunrise and Sunset

```javascript
// Sunrise time in hours (e.g., 6.5 = 6:30)
CALENDARIA.api.getSunrise();

// Sunset time in hours (e.g., 18.5 = 18:30)
CALENDARIA.api.getSunset();

// Hours of daylight
CALENDARIA.api.getDaylightHours();
```

### Day/Night Progress

```javascript
// Progress through daylight period (0 = sunrise, 1 = sunset)
CALENDARIA.api.getProgressDay();

// Progress through night period (0 = sunset, 1 = sunrise)
CALENDARIA.api.getProgressNight();
```

### Time Until Events

Returns `{ hours, minutes, seconds }`:

```javascript
CALENDARIA.api.getTimeUntilSunrise();
CALENDARIA.api.getTimeUntilSunset();
CALENDARIA.api.getTimeUntilMidnight();
CALENDARIA.api.getTimeUntilMidday();
```

### Day/Night Checks

```javascript
// True if between sunrise and sunset
CALENDARIA.api.isDaytime();

// True if before sunrise or after sunset
CALENDARIA.api.isNighttime();
```

---

## Hooks

Darkness updates are triggered by the `updateWorldTime` hook. The module listens for hour changes and initiates smooth transitions when detected.

---

## Source Files

- `scripts/darkness.mjs` - Core darkness calculation and scene updates
- `scripts/constants.mjs` - `SETTINGS.DARKNESS_SYNC` and `SCENE_FLAGS.DARKNESS_SYNC`
- `scripts/settings.mjs` - Setting registration
- `scripts/calendar/data/calendaria-calendar.mjs` - Sunrise/sunset/daylight methods
- `templates/partials/scene-darkness-sync.hbs` - Scene config dropdown
