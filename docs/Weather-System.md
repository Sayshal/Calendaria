# Weather System

Calendaria includes a procedural weather generation system with climate zones, seasonal temperatures, and 27 built-in weather presets across four categories.

## Weather Presets

### Standard (10 presets)

| ID              | Condition     | Temp Range °C | Temp Range °F |
| --------------- | ------------- | ------------- | ------------- |
| `clear`         | Clear         | 18 to 32      | 64 to 90      |
| `partly-cloudy` | Partly Cloudy | 15 to 28      | 59 to 82      |
| `cloudy`        | Cloudy        | 12 to 24      | 54 to 75      |
| `overcast`      | Overcast      | 10 to 20      | 50 to 68      |
| `drizzle`       | Drizzle       | 8 to 18       | 46 to 64      |
| `rain`          | Rain          | 10 to 22      | 50 to 72      |
| `fog`           | Fog           | 5 to 15       | 41 to 59      |
| `mist`          | Mist          | 8 to 18       | 46 to 64      |
| `windy`         | Windy         | 10 to 25      | 50 to 77      |
| `sunshower`     | Sunshower     | 15 to 26      | 59 to 79      |

### Severe (6 presets)

| ID             | Condition    | Temp Range °C | Temp Range °F |
| -------------- | ------------ | ------------- | ------------- |
| `thunderstorm` | Thunderstorm | 15 to 28      | 59 to 82      |
| `blizzard`     | Blizzard     | -20 to -5     | -4 to 23      |
| `snow`         | Snow         | -10 to 2      | 14 to 36      |
| `hail`         | Hail         | 5 to 18       | 41 to 64      |
| `tornado`      | Tornado      | 18 to 35      | 64 to 95      |
| `hurricane`    | Hurricane    | 22 to 35      | 72 to 95      |

### Environmental (3 presets)

| ID             | Condition    | Temp Range °C | Temp Range °F |
| -------------- | ------------ | ------------- | ------------- |
| `ashfall`      | Ashfall      | 15 to 40      | 59 to 104     |
| `sandstorm`    | Sandstorm    | 25 to 45      | 77 to 113     |
| `luminous-sky` | Luminous Sky | -5 to 10      | 23 to 50      |

### Fantasy (8 presets)

| ID                 | Condition        | Temp Range °C | Temp Range °F |
| ------------------ | ---------------- | ------------- | ------------- |
| `black-sun`        | Black Sun        | 5 to 20       | 41 to 68      |
| `ley-surge`        | Ley Surge        | 10 to 25      | 50 to 77      |
| `aether-haze`      | Aether Haze      | 12 to 22      | 54 to 72      |
| `nullfront`        | Nullfront        | 0 to 15       | 32 to 59      |
| `permafrost-surge` | Permafrost Surge | -30 to -10    | -22 to 14     |
| `gravewind`        | Gravewind        | 5 to 18       | 41 to 64      |
| `veilfall`         | Veilfall         | 8 to 20       | 46 to 68      |
| `arcane`           | Arcane           | 15 to 28      | 59 to 82      |

---

## Climate Zones

Seven built-in climate zone templates define temperature ranges and weather probabilities by season.

### Available Templates

| ID            | Zone        | Temp Range °C | Temp Range °F |
| ------------- | ----------- | ------------- | ------------- |
| `arctic`      | Arctic      | -45 to 8      | -49 to 46     |
| `subarctic`   | Subarctic   | -35 to 18     | -31 to 64     |
| `temperate`   | Temperate   | -5 to 30      | 23 to 86      |
| `subtropical` | Subtropical | 5 to 35       | 41 to 95      |
| `tropical`    | Tropical    | 22 to 35      | 72 to 95      |
| `arid`        | Arid        | 5 to 48       | 41 to 118     |
| `polar`       | Polar       | -50 to 10     | -58 to 50     |

### Zone Configuration

Each zone defines:

- **Seasonal temperatures**: `Spring`, `Summer`, `Autumn`, `Winter`, and `_default` fallback
- **Weather weights**: Per-season relative probabilities for each weather preset
- **Daylight**: Optional latitude or manual shortest/longest day overrides (see [Zone Daylight](Calendar-Editor#zone-daylight))
- **Brightness multiplier**: Per-zone scene darkness scaling
- **Environment lighting**: Hue and saturation overrides for scene ambience

Zone names are inline-editable directly in the Weather Tab zone list. The **active zone** is set via a checkbox on each zone row (mutual exclusion — only one zone active at a time).

### Auto-Generation

> [!NOTE]
> **Auto-generate weather on day change** is enabled by default for new calendars. When active, weather regenerates automatically on day change (GM only).

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

1. Click the edit button on a season row in the Season Climate list
2. The [ClimateEditor](Calendar-Editor#climateeditor) opens in season mode
3. Configure:
   - **Temperature Range**: Override min/max for this season
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
- **Set as Active** checkbox: When checked, selecting a zone also updates the calendar's default climate zone
- **Randomize** button to roll new weather based on current zone/season probabilities
- **Clear** button to remove the current weather condition
- **Save** button to confirm the selected weather and close the picker

Selecting a preset populates the Custom Weather fields for preview and editing. The selected preset button shows an active highlight (colored border and tinted background). Click **Save** to apply.

### Custom Weather

The Weather Picker includes a "Custom Weather" section for one-time weather overrides:

- **Weather Name**: Custom label for the condition
- **Temperature**: Numeric temperature value
- **Icon**: FontAwesome icon class
- **Color**: Hex color for the icon

Custom weather updates live as you type. This is a one-time override, not a saved preset. Selecting a weather preset resets the custom weather.

### Preset Filtering

The Weather Picker only displays presets that are enabled in the current zone's configuration. Disabled presets are excluded from both the picker list and random generation.

---

## Preset Aliases

GMs can rename any weather preset on a per-zone basis with a custom display name. For example, rename "Rain" to "Monsoon Downpour" in a tropical zone, or "Snow" to "Ashfall" in a volcanic region.

### Configuring Aliases

In the [ClimateEditor](Calendar-Editor#climateeditor) (zone mode), each preset row has an alias input field. Type a custom name to override the default label. A reset button (undo icon) next to aliased presets restores the default localized name.

### Where Aliases Appear

Aliases are displayed everywhere the preset name appears:

- HUD weather indicator
- MiniCal weather display
- Weather Picker preset buttons
- ClimateEditor preset list

### Scope

Aliases are **zone-scoped** — each calendar + zone combination can have different names for the same preset. Aliases are stored in world settings and persist across sessions.

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
