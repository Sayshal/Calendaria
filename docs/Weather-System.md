# Weather System

A procedural weather system with climate zones, seasonal temperatures, wind, precipitation, forecasts, and 42 built-in weather presets across four categories.

> [!TIP]
> For the complete preset reference, see [Weather Presets](Weather-Presets). For the manual weather picker, see [Weather Picker](Weather-Picker). For visual customization, see [Weather Editor](Weather-Editor).

---

## Getting Started

All 20 bundled calendar presets include default climate zone configurations with full weather data. Weather generation works out of the box when using a bundled calendar, no manual zone setup required.

To customize the weather profile, open the [Climate Editor](Climate-Editor) and modify the bundled zone or add additional zones.

---

## Climate Zones

Seven built-in climate zone templates with temperature ranges and weather probabilities by season.

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

- **Seasonal temperatures**: Per-season min/max with optional relative modifier syntax (`5+`/`3-`)
- **Weather weights**: Per-season relative probabilities for each weather preset
- **Wind**: Speed range and cardinal direction weights
- **Daylight**: Optional latitude or manual shortest/longest day overrides (see [Climate Editor](Climate-Editor#daylight-hours))
- **Brightness multiplier**: Per-zone scene darkness scaling
- **Environment lighting**: Luminosity, saturation, shadows, hue, and intensity overrides per channel (day/night), plus blend ambience toggle
- **Color shift**: Dawn/dusk/night hue values for time-of-day atmospheric transitions

Zone configuration is done via the [Climate Editor](Climate-Editor) in zone mode.

---

## Season-Specific Climate

Each season overrides the base zone climate with custom temperature ranges and weather preset chances.

### Climate Layering

Climate settings follow a layered approach. The first matching value wins:

1. **Zone season override.** Per-season weight and temperature overrides within a zone
2. **Season base.** Season climate temperatures and preset weights
3. **Zone base.** Enabled/disabled filter and base temperatures

### Temperature Constraint Resolution

Temperature ranges follow a three-tier fallback chain:

1. **Season preset override.** Per-season temp min/max set in the Climate Editor for a specific preset
2. **Zone preset override.** Zone-level temp min/max override for the preset
3. **Built-in preset constraint.** The preset's own `tempMin`/`tempMax` values (e.g., Snow requires cold temperatures)

When multiple tiers provide ranges, they are **intersected** (`Math.max` for min, `Math.min` for max) rather than replaced, preventing impossible temperature outputs.

### Preset Selection Filtering

Before weather generation, presets whose temperature range has zero overlap with the current season's temperature range are automatically excluded. This prevents selecting a preset (e.g., Snow) when the season's temperatures make it impossible. 4. **Global defaults.** Fallback values

### Configuring Season Climate

In Calendar Editor > Seasons tab:

1. Click the edit button on a season row
2. The [Climate Editor](Climate-Editor) opens in season mode
3. Configure temperature range and preset chance weights

---

## Temperature

> [!NOTE]
> Temperature is stored in Celsius internally regardless of display preference.

Display unit configurable via **Temperature Unit** setting (Settings Panel > Weather tab):

- Celsius (default)
- Fahrenheit

---

## Wind System

Weather includes a wind model with speed and direction.

### Wind Speed Scale

| Tier | Label    | kph | mph |
| ---- | -------- | --- | --- |
| 0    | Calm     | ≤5  | ≤3  |
| 1    | Light    | ≤20 | ≤12 |
| 2    | Moderate | ≤40 | ≤25 |
| 3    | Strong   | ≤60 | ≤37 |
| 4    | Severe   | ≤90 | ≤56 |
| 5    | Extreme  | >90 | >56 |

Wind displays as mph when the temperature unit is set to Fahrenheit, and kph when set to Celsius.

### Wind Direction

Wind direction uses meteorological convention: the labeled direction indicates where the wind is coming **from**. A "North" wind originates from the north and blows southward.

The wind arrow indicator points in the direction the wind blows (opposite the labeled origin). HUD particles and FXMaster effects also move in the blowing direction.

### Zone Wind Configuration

Zones can define:

- **Speed range**: Min/max speed tier constraining generated wind
- **Direction weights**: Proportional weights per compass direction for prevailing winds

### Forced Wind

Some presets (thunderstorm, blizzard, tornado, hurricane, ice storm, monsoon) lock their wind speed and direction to preset values, ignoring zone configuration.

---

## Precipitation System

Weather presets can define precipitation with type and intensity.

### Precipitation Types

| Type    | Used By                                                                                     |
| ------- | ------------------------------------------------------------------------------------------- |
| Drizzle | Drizzle, Fog                                                                                |
| Rain    | Rain, Sunshower, Thunderstorm, Tornado, Hurricane, Monsoon, Veilfall, Acid Rain, Blood Rain |
| Snow    | Snow, Blizzard, Permafrost Surge                                                            |
| Sleet   | Sleet                                                                                       |
| Hail    | Hail, Ice Storm                                                                             |

### Intensity

Intensity ranges from trace to maximum. During generation, intensity varies slightly from the preset's base value to keep things feeling natural.

---

## Weather Generation

Weather generates based on the climate zone's presets and season settings, with natural variation in temperature and wind. Enabled preset weights determine what weather is most likely, and inertia keeps transitions smooth.

### Auto-Generation

When **Auto-Generate Weather** is enabled (Settings Panel > Weather tab), weather regenerates automatically on day change (GM only). Each zone generates weather independently.

The "Regenerate All Weather" button in the Weather settings tab clears and rebuilds forecasts for all climate zones (with confirmation dialog).

---

## Weather Inertia

Weather inertia favors the current weather when generating new conditions, creating smoother transitions.

**Setting:** `Weather Inertia` (range 0–1, default 0.3)

- **0** = no inertia (fully random each day)
- **1** = maximum inertia (strongly favors current weather)

### Per-Preset Behavior

Some weather types persist longer while others change quickly. Stable conditions like clear skies, overcast, fog, rain, and snow tend to stick around; dramatic events like tornadoes, hurricanes, and sunshowers pass quickly. Custom presets configure their own persistence in the [Climate Editor](Climate-Editor).

### Season Boundary

When a season boundary is crossed, inertia is reduced so the new season's weather profile takes effect faster.

### Value Blending

Beyond preset selection, inertia also smooths **temperature** and **wind** transitions between the previous and new weather so changes feel gradual rather than abrupt.

---

## Forecast Plan

Future weather is pre-generated and stored as a **forecast plan**: upcoming weather for each zone over a configurable window.

### How It Works

1. When auto-generation is enabled, the forecast plan generates on initialization and after day changes
2. The plan covers the configured **Forecast Days** window (1–30, default 7)
3. Forecasts account for the previous day's weather to create realistic patterns
4. Old entries are pruned automatically

### GM Override Behavior

When a GM manually sets weather via the [Weather Picker](Weather-Picker) and the **GM Override Affects Forecast** setting is enabled, the forecast plan for the affected zone is cleared and regenerated from the new weather state.

---

## Forecast Variance

Adds uncertainty to forecasts shown to players, simulating imperfect weather prediction.

**Setting:** `Forecast Accuracy` (0–100, default 70)

- **100** = perfect accuracy (forecast matches reality exactly)
- **0** = maximum variance (forecast is heavily randomized)

### How Variance Works

- **Temperature**: Forecasts may show temperatures slightly off from the actual plan, with closer days being more accurate
- **Preset swapping**: Distant forecasts have a chance to show a different weather type from the same category
- **GM always accurate**: GMs always see the true forecast plan without variance

---

## Intraday Weather

Splits each day into four periods so weather changes throughout the day rather than remaining fixed from dawn to dawn.

**Setting:** `Intraday Weather` (toggle, default off). Opt-in per world in Settings Panel > Weather tab.

### Periods

| Period        | Changes At |
| ------------- | ---------- |
| **Night**     | Midnight   |
| **Morning**   | Sunrise    |
| **Afternoon** | Midday     |
| **Evening**   | Sunset     |

Period boundaries are derived from the calendar's sunrise, midday, and sunset times, which depend on the active climate zone's daylight configuration. Weather changes when the world clock crosses a period boundary.

### Period Carry-Over Chance

**Setting:** `Period Carry-Over Chance` (0–100%, default 50%). Controls how often a period keeps the previous period's weather instead of generating new conditions.

- **0%** = every period generates independently (maximum variation throughout the day)
- **100%** = weather always carries over (each period matches the previous one)

### Cross-Day Transitions

The evening period's weather influences the next day's night period for smooth overnight transitions.

### HUD and Tooltip Display

When intraday weather is enabled, the HUD and calendar day tooltips show a per-period weather breakdown instead of a single daily condition. The per-period breakdown in tooltips is only visible to GMs and users with the `viewWeatherForecast` permission. Players without forecast permission see only the aggregate daily condition.

> [!CAUTION]
> Enabling intraday weather triggers irreversible regeneration of the forecast plan. Existing single-period forecasts are replaced with multi-period data and cannot be reverted by toggling the setting off.

### Weather Picker Integration

The [Weather Picker](Weather-Picker) gains period selector tabs when intraday weather is enabled. GMs can set weather for individual periods rather than the whole day.

---

## Probability Guide

Verify the weather distribution your climate zone setup produces.

### Access

- **Chat command**: `/weatherprob` or `/wp` (optionally pass a season name, e.g. `/weatherprob Winter`)
- **Settings**: Settings > Weather > Climate section > **Weather Probabilities** button (visible when zones are configured)
- **Climate Editor**: Preset Overrides tab > **Weather Probabilities** button (uses unsaved editor data for live preview)
- **Weather Picker**: **Weather Probabilities** button in footer on any weather picker instance

### Dialog

Shows:

- **Zone selector.** Compare probabilities across zones (disabled when only one zone exists)
- **Season selector.** Switch between seasons to see how weights change
- **Probability table.** Each enabled weather preset with its weight, percentage, and a colored bar visualization
- **Temperature range.** Effective min/max for the selected zone and season

When opened from the Climate Editor, the dialog uses the editor's in-progress data so you can preview changes before saving.

---

## Weather History

Weather is recorded in a per-zone history when it changes.

### Behavior

- History is recorded whenever weather is set (auto-generated or manual)
- On time jumps that skip multiple days, history is backfilled for skipped dates
- History is pruned to the configured **Weather History Days** (0–3650, default 365)
- History can be queried via the `/weather` chat command

---

## Per-Zone Weather Model

Each climate zone maintains independent weather state:

- **Current weather**: Separate current conditions per zone
- **Forecast plan**: Independent forecast chain per zone
- **Weather history**: Zone-scoped entries
- **No Zone**: Scenes with "No Zone" selected disable zone-based weather for that scene

### Batched Day Change

When the day changes, all zones generate weather in a single batched operation.

### Zone-Scoped Plan Clearing

GM overrides only clear the forecast plan for the affected zone, leaving other zones' plans intact.

---

## Scene Integration

Weather syncs to the active scene's climate zone when switching scenes. When a scene is activated:

1. The scene's assigned climate zone is resolved
2. If weather data exists for that zone, it applies immediately: sound, visual effects, and HUD update without delay
3. If no weather data exists and **Auto-Generate Weather** is enabled, new weather is generated for the zone on the spot

Players always see the correct weather for their active scene, even when different scenes use different climate zones.

---

## Time-of-Day Color Shifting

Climate zones define hue values for dawn, dusk, and nighttime that shift scene environment lighting based on time of day.

### Phases

| Phase     | Description                                                        |
| --------- | ------------------------------------------------------------------ |
| **Night** | Full night hue applied                                             |
| **Dawn**  | Transitions from night hue to daytime over the configured duration |
| **Day**   | No color shift (uses zone/weather base lighting)                   |
| **Dusk**  | Transitions from daytime to dusk hue over the configured duration  |
| **Night** | Dusk hue transitions to night hue                                  |

### Configuration

Per-zone in the [Climate Editor](Climate-Editor) > Environment tab:

- **Dawn Hue**: Environment hue at sunrise
- **Dusk Hue**: Environment hue at sunset
- **Night Hue**: Environment hue during full darkness
- **Transition Duration**: Hours for the color shift transition

Color Shift Sync is disabled by default. Dawn and dusk tint intensity is 15%. Midday applies no color tint.

Enable globally via **Settings Panel > Canvas tab > Sync Scene Ambience with Time of Day**.

---

## Moon Illumination

Moons add illumination to nighttime scenes, reducing darkness.

### How It Works

- Each moon has a maximum brightness set in Calendar Editor > Moons tab
- Illumination follows phase: brightest at full moon, dark at new moon
- Multiple moons combine their illumination (capped to prevent over-bright nights)
- Moon color tinting applies colored light based on the moon's configured color

### Effect on Darkness

Moon illumination reduces the nighttime darkness value. Enable via **Settings Panel > Canvas tab > Moon Illumination**.

See [Moon Phases](Moon-Phases#moon-brightness) for configuration details.

---

## HUD Particle Rendering

The [HUD](HUD) dome displays animated weather effects with a unique visual per preset.

### Available Effects

37 effects covering all built-in weather types. Each defines a visual style, animation density and speed, special behaviors (flash, tumble, vortex), and sky color overrides.

### Wind and Precipitation Influence

- Wind speed affects animation direction and intensity
- Precipitation intensity scales animation density

### Customization

Customize HUD visuals per-preset via the [Weather Editor](Weather-Editor), including animation density, speed, colors, and sky appearance.

---

## Ambient Sound System

Weather presets trigger looping ambient audio through Foundry's environment audio context.

### Categories

Nine sound categories covering all weather types with sound. See [Weather Presets](Weather-Presets) for the Sound column listing which presets trigger which sound loops.

### Behavior

- Sounds crossfade over 2 seconds when weather changes
- Controlled by the **Sound Effects** setting (Settings Panel > Weather tab)
- Volume is controlled by the **Sound Volume** slider (Settings Panel > Weather tab)
- Per-scene **Disable Weather Sound** flag suppresses sound on a specific scene without affecting visual effects
- The global **Enable Weather FX** toggle stops all sounds when disabled
- Sound assignments can be customized per-preset via the [Weather Editor](Weather-Editor)
- Independent of FXMaster. Works without any external modules

---

## Scene Ambience

Weather and climate zones affect scene lighting when ambience sync is enabled.

### Darkness Penalty

Weather presets apply additive darkness adjustments. See [Weather Presets](Weather-Presets) for per-preset values.

### Environment Lighting

Weather presets and climate zones override Foundry's scene environment properties: hue, intensity, luminosity, saturation, and shadows per channel (day/night), plus the blend ambience toggle. Weather takes precedence, with zone values as fallback. When nothing overrides, the scene's existing environment settings are preserved.

### Weather Tooltips

Weather tooltips throughout the UI (HUD, MiniCal, BigCal, calendar day cells) display:

- Weather icon, name, and temperature
- Wind speed label and direction
- Precipitation type and intensity

---

## Preset Aliases

GMs can rename any weather preset on a per-zone basis. Aliases appear everywhere the preset name is displayed.

Aliases are **zone-scoped**: each calendar + zone combination can have different names for the same preset. Configure aliases in the [Climate Editor](Climate-Editor) > Preset Overrides tab.

### Display Name Resolution

Display names resolve in priority order:

1. **Per-zone alias** from the [Climate Editor](Climate-Editor) > Preset Overrides tab
2. **Name override** from the [Weather Editor](Weather-Editor)
3. **Built-in localized name**

This resolution applies to the HUD, MiniCal, BigCal day cells, Weather Picker grid, and probability views.

---

## For Developers

See [API Reference](API-Reference) and [Hooks](Hooks).
