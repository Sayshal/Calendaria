# Weather System

Calendaria includes a procedural weather generation system with climate zones, seasonal temperatures, and 27 built-in weather presets across four categories.

## Weather Presets

### Standard (10 presets)

| ID              | Condition     | Temp Range (C) |
| --------------- | ------------- | -------------- |
| `clear`         | Clear         | 18-32          |
| `partly-cloudy` | Partly Cloudy | 15-28          |
| `cloudy`        | Cloudy        | 12-24          |
| `overcast`      | Overcast      | 10-20          |
| `drizzle`       | Drizzle       | 8-18           |
| `rain`          | Rain          | 10-22          |
| `fog`           | Fog           | 5-15           |
| `mist`          | Mist          | 8-18           |
| `windy`         | Windy         | 10-25          |
| `sunshower`     | Sunshower     | 15-26          |

### Severe (6 presets)

| ID             | Condition    | Temp Range (C) |
| -------------- | ------------ | -------------- |
| `thunderstorm` | Thunderstorm | 15-28          |
| `blizzard`     | Blizzard     | -20 to -5      |
| `snow`         | Snow         | -10 to 2       |
| `hail`         | Hail         | 5-18           |
| `tornado`      | Tornado      | 18-35          |
| `hurricane`    | Hurricane    | 22-35          |

### Environmental (3 presets)

| ID             | Condition    | Temp Range (C) |
| -------------- | ------------ | -------------- |
| `ashfall`      | Ashfall      | 15-40          |
| `sandstorm`    | Sandstorm    | 25-45          |
| `luminous-sky` | Luminous Sky | -5 to 10       |

### Fantasy (8 presets)

| ID                 | Condition        | Temp Range (C) |
| ------------------ | ---------------- | -------------- |
| `black-sun`        | Black Sun        | 5-20           |
| `ley-surge`        | Ley Surge        | 10-25          |
| `aether-haze`      | Aether Haze      | 12-22          |
| `nullfront`        | Nullfront        | 0-15           |
| `permafrost-surge` | Permafrost Surge | -30 to -10     |
| `gravewind`        | Gravewind        | 5-18           |
| `veilfall`         | Veilfall         | 8-20           |
| `arcane`           | Arcane           | 15-28          |

---

## Climate Zones

Seven built-in climate zone templates define temperature ranges and weather probabilities by season.

### Available Templates

| ID            | Zone        | Temperature Range (C) |
| ------------- | ----------- | --------------------- |
| `arctic`      | Arctic      | -45 to 8              |
| `subarctic`   | Subarctic   | -35 to 18             |
| `temperate`   | Temperate   | -5 to 30              |
| `subtropical` | Subtropical | 5 to 35               |
| `tropical`    | Tropical    | 22 to 35              |
| `arid`        | Arid        | 5 to 48               |
| `polar`       | Polar       | -50 to 10             |

### Zone Configuration

Each zone defines:

- **Seasonal temperatures**: `Spring`, `Summer`, `Autumn`, `Winter`, and `_default` fallback
- **Weather weights**: Per-season relative probabilities for each weather preset

Climate zones are stored in the calendar's `weather.zones` array. The `weather.activeZone` property determines which zone is used for generation.

### Auto-Generation

> [!NOTE]
> When **Auto-generate weather on day change** is enabled, weather regenerates automatically on day change (GM only).

---

## Season-Specific Climate

Each season can override the base zone climate with custom temperature ranges and weather preset chances.

### Climate Layering

Climate configuration follows a layered approach (first matching value wins):

1. **Season override in zone** - Per-season settings within a zone
2. **Zone defaults** - Base zone temperature and preset chances
3. **Global defaults** - Fallback values

### Configuring Season Climate

In Calendar Editor > Weather tab:

1. Select a climate zone
2. Click the gear icon next to a season name
3. Configure:
   - **Temperature Range**: Override min/max for this season in this zone
   - **Preset Chances**: Adjust probability weights for weather conditions

---

## Temperature Units

> [!NOTE]
> Temperature is stored in Celsius internally regardless of display preference.

Display unit configurable via **Temperature Unit** setting (Settings Panel > Weather tab):

- Celsius (default)
- Fahrenheit

---

## Scene Ambience

Weather and climate zones can affect scene lighting when "Sync Scene Ambience with Weather" is enabled (Settings > Time tab).

### Darkness Penalty

Weather presets apply darkness adjustments to scenes:

- Overcast conditions increase darkness slightly
- Storms and blizzards reduce visibility significantly
- Magical weather may brighten or alter scene lighting

### Environment Lighting

Hue and saturation adjustments create atmospheric effects:

- **Hue**: Shift environment color (0-360 degrees)
- **Saturation**: Adjust color intensity (-100% to +100%)

### Brightness Multiplier

Control how strongly weather affects scene brightness at three levels:

| Level            | Description                                 |
| ---------------- | ------------------------------------------- |
| Per-Scene        | Override in Scene Configuration > Ambiance  |
| Per-Climate-Zone | Set in Calendar Editor > Weather tab        |
| Global Default   | Set in Settings > Weather tab (default 1.0) |

### Value Priority

When both weather preset and climate zone define lighting values:

1. Weather preset values take precedence when set
2. Climate zone values used as fallback
3. Global defaults if neither is configured

### Color Reset Behavior

When switching to a weather preset that does not define custom colors (hue/saturation), the environment lighting intensity is reset to 0. This removes any color tinting from previous weather conditions, ensuring predictable visual transitions.

### Darkness Penalty Values

Each weather preset defines a `darknessPenalty` that increases scene darkness:

| Category      | Preset                     | Darkness Penalty  |
| ------------- | -------------------------- | ----------------- |
| Standard      | Clear, Windy               | 0                 |
| Standard      | Partly Cloudy, Sunshower   | 0.05              |
| Standard      | Cloudy, Drizzle, Mist      | 0.1               |
| Standard      | Rain, Overcast             | 0.15              |
| Standard      | Fog                        | 0.2               |
| Severe        | Snow                       | 0.1               |
| Severe        | Hail                       | 0.2               |
| Severe        | Thunderstorm               | 0.25              |
| Severe        | Blizzard, Tornado          | 0.3               |
| Severe        | Hurricane                  | 0.35              |
| Environmental | Sandstorm                  | 0.2               |
| Environmental | Ashfall                    | 0.25              |
| Environmental | Luminous Sky               | -0.1 (brightens)  |
| Fantasy       | Arcane                     | -0.05 (brightens) |
| Fantasy       | Ley Surge                  | -0.1 (brightens)  |
| Fantasy       | Permafrost Surge, Veilfall | 0.1               |
| Fantasy       | Gravewind, Aether Haze     | 0.15              |
| Fantasy       | Nullfront                  | 0.2               |
| Fantasy       | Black Sun                  | 0.4               |

### Built-in Preset Defaults

| Category      | Preset    | Lighting Effect   |
| ------------- | --------- | ----------------- |
| Standard      | Overcast  | Desaturated       |
| Severe        | Blizzard  | Blue-tinted, dark |
| Environmental | Sandstorm | Warm orange       |
| Fantasy       | Various   | Magical coloring  |

### Climate Zone Templates

Built-in climate zones include environment lighting defaults (`environmentBase` and `environmentDark`):

| Zone        | Hue | Saturation | Notes                                |
| ----------- | --- | ---------- | ------------------------------------ |
| Arctic      | 200 | 0.6        | Blue-tinted, dark variant at 210/0.5 |
| Subarctic   | 200 | 0.7        | Blue-tinted                          |
| Temperate   | -   | -          | Neutral (no override)                |
| Subtropical | -   | -          | Neutral (no override)                |
| Tropical    | 40  | 0.9        | Warm/golden                          |
| Arid        | 35  | 0.8        | Warm/orange tinted                   |
| Polar       | 210 | 0.5        | Blue-tinted, dark variant at 220/0.4 |

---

## Weather Generation

### Algorithm

1. Build probability map from enabled presets in active zone config
2. Weighted random selection using `chance` values
3. Temperature generated from zone's seasonal range (or preset's `tempMin`/`tempMax` override)
4. Optional seeded randomness via `dateSeed(year, month, day)` for deterministic forecasts

### Weather Inertia (Coming Soon)

Weather inertia creates smoother, more realistic transitions by favoring the current weather when generating new conditions. For example, if it's raining, it's more likely to continue raining rather than suddenly becoming clear.

---

## Weather Picker

GMs can manually set weather by clicking the weather indicator on the HUD or MiniCal. This opens the Weather Picker dialog with:

- All weather presets grouped by category (Standard, Severe, Fantasy, Environmental, Custom)
- Climate zone selector with "None" option (always visible)
- Random generation button to roll new weather based on current zone/season probabilities
- **Clear Weather** button to remove the current weather condition

### Preset Filtering

The Weather Picker only displays presets that are enabled in the current zone's configuration. Disabled presets are excluded from both the picker list and random generation.

---

## Custom Presets

GMs can create custom weather conditions that appear alongside built-in presets.

### Settings UI

Access via **Settings > Weather tab > Custom Weather Presets**:

1. Click "Add Preset" to create a new condition
2. Configure:
   - **Name**: Display name for the condition
   - **Icon**: FontAwesome icon class (e.g., `fa-cloud`)
   - **Color**: Hex color for the icon
   - **Temperature Range**: Min/max temperature for this condition
3. Click Save

Custom presets appear in:

- Weather Picker under "Custom" category
- Calendar Editor Weather tab preset lists
- Climate settings dialog preset chances

Custom presets are stored in the `calendaria.customWeatherPresets` setting with `category: 'custom'`. See [API Reference](API-Reference) for `addWeatherPreset()`, `removeWeatherPreset()`, and `updateWeatherPreset()`.

---

## For Developers

See [API Reference](API-Reference#weather) for weather-related methods including `getCurrentWeather()`, `setWeather()`, `generateWeather()`, and more.

See [Hooks](Hooks#calendariaweatherchange) for the `calendaria.weatherChange` hook.
