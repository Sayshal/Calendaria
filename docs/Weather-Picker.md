# Weather Picker

The Weather Picker is a dialog for manually setting weather conditions. Open it by clicking the weather indicator on the [HUD](HUD), [MiniCal](MiniCal), or [BigCal](BigCal).

## Layout

### Zone Info Bar

A bar at the top displays the current climate zone with a dropdown for per-scene zone override. Changing the zone here overrides the active scene's climate zone, affecting weather generation and scene ambience for that scene only.

### Preset Grid

All weather presets displayed in a grid, grouped by category (Standard, Severe, Environmental, Fantasy, Custom):

- Click a preset to select it and populate the detail panel
- Active preset shows a highlighted border with tinted background
- **Zone-disabled presets** (not enabled in the current zone) are dimmed and sorted after active presets
- Presets display their icon, color, and alias name (if configured)

### Detail Panel

Editable fields for the selected weather:

| Field                       | Description                                                                 |
| --------------------------- | --------------------------------------------------------------------------- |
| **Name**                    | Display label (populated from preset, editable for custom)                  |
| **Icon**                    | FontAwesome icon class                                                      |
| **Color**                   | Hex color picker                                                            |
| **Temperature**             | Numeric input (in display unit)                                             |
| **Wind Speed**              | Select dropdown (0–5 scale: Calm through Extreme)                           |
| **Wind Direction**          | 16-point compass select                                                     |
| **Precipitation Type**      | Select: None, Drizzle, Rain, Snow, Sleet, Hail                              |
| **Precipitation Intensity** | Range slider (0–1)                                                          |
| **FXMaster Preset**         | Dropdown of available FXMaster effects (only shown when FXMaster is active) |
| **Sound Effect**            | Dropdown of available ambient sound loops                                   |

### Save as Preset

A checkbox near the footer labeled "Save as Preset" — when checked, clicking Save also creates a new custom preset with the full configuration (name, icon, color, temperature range, wind, precipitation, HUD effect, FX preset, sound).

## Footer

| Button        | Action                                                          |
| ------------- | --------------------------------------------------------------- |
| **Clear**     | Remove current weather from the active zone                     |
| **Randomize** | Generate random weather using current zone/season probabilities |
| **Save**      | Apply the selected/configured weather                           |

## Behavior

- Selecting a built-in preset populates all detail fields with that preset's defaults
- Editing detail fields creates a one-time weather override; the original preset is not modified
- Randomize respects the current zone's enabled presets and chance weights
- When a GM override is applied and the "GM Override Affects Forecast" setting is enabled, the forecast plan for the current zone is cleared and regenerated
- The picker is permission-gated — only users with the **Change Weather** permission can access it
