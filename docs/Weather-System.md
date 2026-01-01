# Weather System

Calendaria includes a procedural weather generation system with climate zones, seasonal temperatures, and 27 built-in weather presets across four categories.

## Weather Presets

### Standard (10 presets)

| ID | Condition | Temp Range (C) |
|----|-----------|----------------|
| `clear` | Clear | 18-32 |
| `partly-cloudy` | Partly Cloudy | 15-28 |
| `cloudy` | Cloudy | 12-24 |
| `overcast` | Overcast | 10-20 |
| `drizzle` | Drizzle | 8-18 |
| `rain` | Rain | 10-22 |
| `fog` | Fog | 5-15 |
| `mist` | Mist | 8-18 |
| `windy` | Windy | 10-25 |
| `sunshower` | Sunshower | 15-26 |

### Severe (6 presets)

| ID | Condition | Temp Range (C) |
|----|-----------|----------------|
| `thunderstorm` | Thunderstorm | 15-28 |
| `blizzard` | Blizzard | -20 to -5 |
| `snow` | Snow | -10 to 2 |
| `hail` | Hail | 5-18 |
| `tornado` | Tornado | 18-35 |
| `hurricane` | Hurricane | 22-35 |

### Environmental (3 presets)

| ID | Condition | Temp Range (C) |
|----|-----------|----------------|
| `ashfall` | Ashfall | 15-40 |
| `sandstorm` | Sandstorm | 25-45 |
| `luminous-sky` | Luminous Sky | -5 to 10 |

### Fantasy (8 presets)

| ID | Condition | Temp Range (C) |
|----|-----------|----------------|
| `black-sun` | Black Sun | 5-20 |
| `ley-surge` | Ley Surge | 10-25 |
| `aether-haze` | Aether Haze | 12-22 |
| `nullfront` | Nullfront | 0-15 |
| `permafrost-surge` | Permafrost Surge | -30 to -10 |
| `gravewind` | Gravewind | 5-18 |
| `veilfall` | Veilfall | 8-20 |
| `arcane` | Arcane | 15-28 |

---

## Climate Zones

Seven built-in climate zone templates define temperature ranges and weather probabilities by season.

### Available Templates

| ID | Zone | Temperature Range (C) |
|----|------|----------------------|
| `arctic` | Arctic | -45 to 8 |
| `subarctic` | Subarctic | -35 to 18 |
| `temperate` | Temperate | -5 to 30 |
| `subtropical` | Subtropical | 5 to 35 |
| `tropical` | Tropical | 22 to 35 |
| `arid` | Arid | 5 to 48 |
| `polar` | Polar | -50 to 10 |

### Zone Configuration

Each zone defines:
- **Seasonal temperatures**: `Spring`, `Summer`, `Autumn`, `Winter`, and `_default` fallback
- **Weather weights**: Per-season relative probabilities for each weather preset

Climate zones are stored in the calendar's `weather.zones` array. The `weather.activeZone` property determines which zone is used for generation.

### Auto-Generation

When `calendar.weather.autoGenerate` is `true`, weather regenerates automatically on day change (GM only).

---

## Temperature Units

Stored in Celsius internally. Display unit configurable via `SETTINGS.TEMPERATURE_UNIT`:
- `celsius` (default)
- `fahrenheit`

Conversion handled by `WeatherManager.formatTemperature(celsius)`.

---

## Weather Generation

### Algorithm

1. Build probability map from enabled presets in active zone config
2. Weighted random selection using `chance` values
3. Temperature generated from zone's seasonal range (or preset's `tempMin`/`tempMax` override)
4. Optional seeded randomness via `dateSeed(year, month, day)` for deterministic forecasts

### Inertia (Not Used by Default)

`applyWeatherInertia(currentWeatherId, probabilities, inertia)` exists to smooth transitions but is not called in standard generation.

---

## Weather Picker

`openWeatherPicker()` opens a dialog displaying all presets grouped by category. Features:
- Climate zone selector (if zones configured)
- Select preset directly
- Random generation button

---

## Custom Presets

GMs can add custom weather presets stored in `SETTINGS.CUSTOM_WEATHER_PRESETS`.

```javascript
await CALENDARIA.api.addWeatherPreset({
  id: 'my-weather',
  label: 'My Weather',
  description: 'Custom description',
  icon: 'fa-cloud',
  color: '#888888'
});

await CALENDARIA.api.removeWeatherPreset('my-weather');
```

Custom presets appear in the "Custom" category with `category: 'custom'`.

---

## API Reference

### getCurrentWeather()

Returns current weather state or `null`.

```javascript
const weather = CALENDARIA.api.getCurrentWeather();
// { id, label, description, icon, color, category, temperature, setAt, setBy }
```

### setWeather(presetId, options)

Set weather by preset ID.

```javascript
await CALENDARIA.api.setWeather('thunderstorm');
await CALENDARIA.api.setWeather('rain', { temperature: 15 });
```

### setCustomWeather(weatherData)

Set arbitrary weather values.

```javascript
await CALENDARIA.api.setCustomWeather({
  label: 'Magical Storm',
  icon: 'fa-wand-magic-sparkles',
  color: '#9933FF',
  description: 'Arcane energy crackles',
  temperature: 20
});
```

### clearWeather()

Clear current weather.

```javascript
await CALENDARIA.api.clearWeather();
```

### generateWeather(options)

Generate weather from active climate zone.

```javascript
await CALENDARIA.api.generateWeather();
await CALENDARIA.api.generateWeather({ zoneId: 'arctic', season: 'Winter' });
```

### getWeatherForecast(options)

Generate multi-day forecast.

```javascript
const forecast = await CALENDARIA.api.getWeatherForecast({ days: 7 });
// [{ year, month, day, preset, temperature }, ...]
```

### getActiveZone() / setActiveZone(zoneId)

Get or set the active climate zone.

```javascript
const zone = CALENDARIA.api.getActiveZone();
await CALENDARIA.api.setActiveZone('tropical');
```

### getCalendarZones()

Get all zones configured for active calendar.

```javascript
const zones = CALENDARIA.api.getCalendarZones();
```

### getWeatherPresets()

Get all presets (built-in + custom).

```javascript
const presets = await CALENDARIA.api.getWeatherPresets();
```

---

## Hooks

### calendaria.weatherChange

Fires when weather changes.

```javascript
Hooks.on('calendaria.weatherChange', ({ previous, current, remote }) => {
  console.log(`Weather: ${previous?.id} -> ${current?.id}`);
  if (remote) console.log('Changed by another client');
});
```

---

## Data Structures

### Weather State

```javascript
{
  id: 'rain',
  label: 'CALENDARIA.Weather.Rain',
  description: 'CALENDARIA.Weather.RainDesc',
  icon: 'fa-cloud-showers-heavy',
  color: '#A0D8EF',
  category: 'standard',
  temperature: 15,
  setAt: 1234567890,
  setBy: 'userId',
  generated: true  // present if auto-generated
}
```

### Zone Config

```javascript
{
  id: 'temperate',
  name: 'CALENDARIA.Weather.Climate.Temperate',
  description: '...',
  temperatures: {
    Spring: { min: 8, max: 18 },
    Summer: { min: 18, max: 30 },
    Autumn: { min: 8, max: 18 },
    Winter: { min: -5, max: 5 },
    _default: { min: 8, max: 20 }
  },
  presets: [
    { id: 'clear', enabled: true, chance: 15, tempMin: null, tempMax: null },
    { id: 'rain', enabled: true, chance: 10, tempMin: null, tempMax: null },
    // ...
  ]
}
```
