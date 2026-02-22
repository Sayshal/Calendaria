# Weather System

Calendaria includes a procedural weather generation system with climate zones, seasonal temperatures, wind, precipitation, weather inertia, forecast plans, and 42 built-in weather presets across four categories.

> [!TIP]
> For the complete preset reference, see [Weather Presets](Weather-Presets). For the manual weather picker, see [Weather Picker](Weather-Picker). For visual customization, see [Weather Editor](Weather-Editor).

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

- **Seasonal temperatures**: Per-season min/max with optional relative modifier syntax (`5+`/`3-`)
- **Weather weights**: Per-season relative probabilities for each weather preset
- **Wind**: Speed range and cardinal direction weights
- **Daylight**: Optional latitude or manual shortest/longest day overrides (see [Climate Editor](Climate-Editor#daylight-hours))
- **Brightness multiplier**: Per-zone scene darkness scaling
- **Environment lighting**: Hue and saturation overrides for scene ambience
- **Color shift**: Dawn/dusk/night hue values for time-of-day atmospheric transitions

Zone configuration is done via the [Climate Editor](Climate-Editor) in zone mode.

---

## Season-Specific Climate

Each season can override the base zone climate with custom temperature ranges and weather preset chances.

### Climate Layering

Climate configuration follows a layered approach (first matching value wins):

1. **Season override in zone** — Per-season settings within a zone
2. **Zone defaults** — Base zone temperature and preset chances
3. **Global defaults** — Fallback values

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

Generated temperatures are clamped to the configured seasonal/zone temperature range after all modifiers (inertia blending, preset overrides) are applied.

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

A 16-point compass system: N, NNE, NE, ENE, E, ESE, SE, SSE, S, SSW, SW, WSW, W, WNW, NW, NNW (stored as degrees 0–337.5°).

### Zone Wind Configuration

Zones can define:

- **Speed range**: Min/max speed tier constraining generated wind
- **Direction weights**: Proportional weights per compass direction for prevailing winds

### Forced Wind

Some presets (thunderstorm, blizzard, tornado, hurricane, ice storm, monsoon) have `forced: true` wind — their speed and direction are locked to preset values and ignore zone configuration.

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

### Intensity Scale

Intensity ranges from 0 to 1 (0 = trace, 1 = maximum). During generation, intensity varies ±15% from the preset's base value.

---

## Weather Generation

### Algorithm

1. Build probability map from enabled presets in active zone config
2. Apply inertia weighting (if current weather exists)
3. Weighted random selection using `chance` values
4. Generate temperature from zone's seasonal range (clamped to preset overrides if configured)
5. Generate wind from preset + zone config
6. Generate precipitation with intensity variance
7. Blend temperature and wind with previous values using inertia

### Auto-Generation

When **Auto-Generate Weather** is enabled (Settings Panel > Weather tab), weather regenerates automatically on day change (GM only). Each zone generates weather independently.

---

## Weather Inertia

Weather inertia creates smoother, more realistic transitions by favoring the current weather when generating new conditions.

**Setting:** `Weather Inertia` (range 0–1, default 0.3)

- **0** = no inertia (fully random each day)
- **1** = maximum inertia (strongly favors current weather)

### Per-Preset Inertia Weight

Each preset has an `inertiaWeight` multiplier (default 1.0) that scales the global inertia setting:

- **0** = never persists (tornado, hurricane, sunshower, most fantasy presets)
- **0.3–0.5** = low persistence (thunderstorm, blizzard, hail, sandstorm, ashfall)
- **1.0** = normal persistence (partly cloudy, drizzle, mist, windy)
- **1.2–1.5** = sticky (clear, cloudy, overcast, fog, rain, snow)

Custom presets can set their own inertia weight (0–2 range). Zone-level overrides can also be configured per-preset in the [Climate Editor](Climate-Editor).

### Season Boundary

When a season boundary is crossed, inertia is automatically halved to allow the new season's weather profile to take effect faster.

### Value Blending

Beyond preset selection, inertia also blends **temperature** and **wind speed/direction** between the previous and new weather. Wind direction interpolation takes the shortest angular path and snaps to the nearest compass point. Forced wind is not blended.

---

## Forecast Plan

Calendaria pre-generates and stores future weather as a **forecast plan** — a structured record of upcoming weather for each zone.

### Plan Storage

Forecast plans are stored per-zone in a nested structure: `{ [zoneId]: { [year]: { [month]: { [day]: forecastEntry } } } }`.

### Plan Lifecycle

1. When auto-generation is enabled, the forecast plan is generated on initialization and after day changes
2. The plan covers the configured **Forecast Days** window (1–30, default 7)
3. Each entry uses **path-dependent inertia**: each forecast day chains from the previous day's result
4. Plans are pruned to remove entries older than the forecast window

### GM Override Behavior

When a GM manually sets weather via the [Weather Picker](Weather-Picker) and the **GM Override Affects Forecast** setting is enabled, the forecast plan for the affected zone is cleared and regenerated from the new weather state.

---

## Forecast Variance

The forecast accuracy system adds uncertainty to forecasts shown to players.

**Setting:** `Forecast Accuracy` (0–100, default 70)

- **100** = perfect accuracy (forecast matches plan exactly)
- **0** = maximum variance (forecast is heavily randomized)

### How Variance Works

- **Temperature offset**: Random offset up to ±8°C, scaled down by accuracy and proximity (closer days are more accurate)
- **Preset swapping**: Chance to swap to another preset in the same category, probability increasing with distance and lower accuracy
- **`isVaried` flag**: Forecast entries that differ from the plan are marked with `isVaried: true`
- **GM always accurate**: GMs always see the true forecast plan without variance

---

## Weather History

Weather is automatically recorded in a per-zone history when it changes.

### Storage

History is nested: `{ [year]: { [month]: { [day]: { [zoneId]: weatherEntry } } } }`.

### Behavior

- History is recorded whenever weather is set (auto-generated or manual)
- On time jumps that skip multiple days, history is backfilled for skipped dates
- History is pruned to the configured **Weather History Days** (0–3650, default 365)
- History can be queried via API or the `/weather` chat command

---

## Per-Zone Weather Model

Each climate zone maintains independent weather state:

- **Current weather**: Separate current conditions per zone
- **Forecast plan**: Independent forecast chain per zone
- **Weather history**: Zone-scoped entries

### Batched Day Change

When the day changes, all zones generate weather in a single batched operation. The `WEATHER_CHANGE` hook fires with `bulk: true` for these batch updates.

### Zone-Scoped Plan Clearing

GM overrides only clear the forecast plan for the affected zone, leaving other zones' plans intact.

---

## Time-of-Day Color Shifting

Climate zones can define hue values for dawn, dusk, and nighttime that shift scene environment lighting based on time of day.

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

Enable globally via **Settings Panel > Canvas tab > Sync Scene Ambience with Time of Day**.

---

## Moon Illumination

Moons contribute illumination to nighttime scenes, reducing darkness.

### How It Works

- Each moon defines a `moonBrightnessMax` value (0–0.3) configurable in Calendar Editor > Moons tab
- Illumination follows a cosine curve based on the moon's phase position — maximum at full moon, zero at new moon
- Multiple moons sum their illumination contributions
- Total illumination is capped at 0.3 to prevent nights from becoming too bright
- Moon color tinting applies colored light based on the moon's configured color

### Effect on Darkness

Moon illumination reduces the nighttime darkness value:

```
Final darkness = Base darkness - Moon illumination (capped at 0.3)
```

Enable via **Settings Panel > Canvas tab > Moon Illumination**.

See [Moon Phases](Moon-Phases#moon-brightness) for configuration details.

---

## HUD Particle Rendering

The [HUD](HUD) dome uses a unified Pixi.js renderer for weather particle effects. Each preset maps to a `hudEffect` that controls particle behavior.

### Available Effects

37 particle effects covering all built-in weather types. Each effect defines:

- Texture variants and tint colors
- Particle count, scale, alpha, and speed
- Gravity, wobble, and special behaviors (flash, tumble, vortex)
- Sky gradient override (top/mid/bottom colors)

### Wind and Precipitation Influence

- Wind speed affects particle direction and intensity in the HUD renderer
- Precipitation intensity scales particle count

### Customization

HUD visuals can be overridden per-preset via the [Weather Editor](Weather-Editor), including particle count, scale, alpha, speed, gravity, wobble, tint colors, and sky gradient.

---

## Ambient Sound System

Weather presets can trigger looping ambient audio through Foundry's environment audio context.

### Categories

Nine sound categories covering all weather types with sound. See [FXMaster Integration — Ambient Sound](FXMaster-Integration#ambient-sound-system) for the complete list.

### Behavior

- Sounds crossfade over 2 seconds when weather changes
- Controlled by the **Sound Effects** setting (Settings Panel > Weather tab)
- Per-scene **Disable Weather FX** flag silences sound
- Sound assignments can be customized per-preset via the [Weather Editor](Weather-Editor)
- Independent of FXMaster — works without any external modules

---

## Scene Ambience

Weather and climate zones affect scene lighting when ambience sync is enabled.

### Darkness Penalty

Weather presets apply additive darkness adjustments to scenes. See [Weather Presets](Weather-Presets) for per-preset darkness values.

### Environment Lighting

Hue and saturation adjustments create atmospheric effects. When both weather preset and climate zone define lighting values, weather takes precedence, with zone values as fallback.

### Weather Tooltips

Weather tooltips throughout the UI (HUD, MiniCal, BigCal, calendar day cells) display rich HTML with:

- Weather icon, name, and temperature
- Wind speed label and direction
- Precipitation type and intensity

---

## Preset Aliases

GMs can rename any weather preset on a per-zone basis. Aliases appear everywhere the preset name is displayed.

Aliases are **zone-scoped** — each calendar + zone combination can have different names for the same preset. Configure aliases in the [Climate Editor](Climate-Editor) > Preset Overrides tab.

---

## For Developers

See [API Reference](API-Reference#weather) for weather-related methods .

See [Hooks](Hooks#calendariaweatherchange) for the `calendaria.weatherChange` hook.
