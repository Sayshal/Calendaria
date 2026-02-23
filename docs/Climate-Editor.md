# Climate Editor

Configure weather behavior for climate zones and seasons. The editor opens in one of two modes:

- **Season mode** — from a season row in Calendar Editor > Weather tab
- **Zone mode** — from a zone row in Calendar Editor > Weather tab

---

## Season Mode

Set temperature ranges and weather chances for a single season.

### Temperatures

Min/max temperature range for this season. Values override the zone's base temperatures when this season is active.

### Weather Chances

A grid of weather presets with proportional chance weights. Adjust the weight value to control how likely each preset is to occur during this season.

> [!NOTE]
> Chance values are proportional weights, not percentages. See [Weather Presets](Weather-Presets) for default values.

---

## Zone Mode

Three tabs covering weather, preset overrides, and environment settings for a zone.

### Weather Tab

#### Temperatures

Per-season temperature ranges with support for **relative modifier syntax**:

| Syntax | Meaning              | Example                               |
| ------ | -------------------- | ------------------------------------- |
| `5+`   | Add 5 to base        | Zone is 5° warmer than season default |
| `3-`   | Subtract 3 from base | Zone is 3° cooler than season default |
| `25`   | Absolute value       | Fixed at 25° regardless of season     |

#### Wind Configuration

| Field                 | Description                                                  |
| --------------------- | ------------------------------------------------------------ |
| **Wind Speed Range**  | Min/max speed tier (0–5 select dropdowns)                    |
| **Direction Weights** | 16-point cardinal direction weight grid for prevailing winds |

Direction weights control how likely each compass direction is during weather generation. Higher weights mean that direction is more common.

### Preset Overrides Tab

Per-preset overrides for this zone:

| Column       | Description                                                                       |
| ------------ | --------------------------------------------------------------------------------- |
| **Enabled**  | Checkbox — disabled presets are excluded from generation and dimmed in the picker |
| **Icon**     | Preset icon (read-only)                                                           |
| **Name**     | Preset name with alias input (type to override, empty for default)                |
| **Weight**   | Chance weight override for this zone                                              |
| **Temp Min** | Minimum temperature override (supports relative modifiers)                        |
| **Temp Max** | Maximum temperature override (supports relative modifiers)                        |
| **Inertia**  | Per-preset inertia weight multiplier (0–2, overrides built-in default)            |

Each column header has a tooltip explaining the field. Presets are grouped by category.

### Environment Tab

| Field           | Description                               |
| --------------- | ----------------------------------------- |
| **Description** | Notes about this climate zone             |
| **Brightness**  | Slider controlling scene darkness scaling |

#### Base (Day) Lighting

| Field          | Description                |
| -------------- | -------------------------- |
| **Hue**        | Hue angle (0–360°)         |
| **Intensity**  | Hue intensity (0 to 1)     |
| **Luminosity** | Scene luminosity (-1 to 1) |
| **Saturation** | Color saturation (-1 to 1) |
| **Shadows**    | Shadow intensity (0 to 1)  |

#### Dark (Night) Lighting

| Field          | Description                |
| -------------- | -------------------------- |
| **Hue**        | Hue angle (0–360°)         |
| **Intensity**  | Hue intensity (0 to 1)     |
| **Luminosity** | Scene luminosity (-1 to 1) |
| **Saturation** | Color saturation (-1 to 1) |
| **Shadows**    | Shadow intensity (0 to 1)  |

#### Daylight Hours

| Field                 | Description                                      |
| --------------------- | ------------------------------------------------ |
| **Latitude**          | Astronomical daylight calculation (-90° to +90°) |
| **Override Solstice** | Manual shortest/longest day hours                |

#### Time-of-Day Color Shift

| Field                   | Description                           |
| ----------------------- | ------------------------------------- |
| **Dawn Hue**            | Environment hue at sunrise            |
| **Dusk Hue**            | Environment hue at sunset             |
| **Night Hue**           | Environment hue during nighttime      |
| **Transition Duration** | How long color shifts take (in hours) |

Color shift is per-zone — different zones can have different dawn/dusk atmospheres. See [Weather System — Time-of-Day Color Shifting](Weather-System#time-of-day-color-shifting) for details.
