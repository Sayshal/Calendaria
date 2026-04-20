# Weather Picker

The Weather Picker is a dialog for manually setting weather conditions. Open it by clicking the weather indicator on the [HUD](HUD), [MiniCal](MiniCal), or [BigCal](BigCal).

## Layout

### Period Tabs

When the **Intraday Weather** setting is enabled, a row of period tabs appears at the top of the picker (below the zone info bar). There are four periods: **Night**, **Morning**, **Afternoon**, and **Evening**. Each tab shows an icon and label, with the current real-time period marked.

- Click a tab to switch the picker context to that period
- The preset grid and detail panel reflect the selected period's weather
- Saving applies weather only to the selected period, so each time of day can have different weather
- If no period is selected, the picker defaults to the current period

### Zone Info Bar

A bar at the top displays the current climate zone with a dropdown for per-scene zone override. Changing the zone here overrides the active scene's climate zone, affecting weather generation and scene ambience for that scene only. Select "No Zone" to explicitly disable zone-based weather. This selection persists across scene reloads.

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
| **Color**                   | Color picker                                                                |
| **Temperature**             | Numeric input (in display unit); rolled within the preset's range on select |
| **Wind Speed**              | Select dropdown (0–5 scale: Calm through Extreme)                           |
| **Wind Direction**          | 16-point compass select                                                     |
| **Precipitation Type**      | Select: None, Drizzle, Rain, Snow, Sleet, Hail                              |
| **Precipitation Intensity** | Range slider (0–1)                                                          |
| **FX Density**              | Override particle density: Default, Very Low, Low, Medium, High, Very High  |
| **FX Speed**                | Override particle speed: Default, Very Low, Low, Medium, High, Very High    |
| **FX Color**                | Override effect tint color                                                  |
| **FXMaster Preset**         | Dropdown of available FXMaster effects (only shown when FXMaster is active) |
| **Sound Effect**            | Sound file path with a file picker button for browsing custom audio files   |
| **FX Macro**                | Dropdown of world macros to execute when this weather activates (GM only)   |

### Save as Preset

A checkbox near the footer labeled "Save as Preset." When checked, clicking Save also creates a new custom preset with the full configuration (name, icon, color, temperature range, wind, precipitation, HUD effect, FX preset, sound).

## Footer

| Button        | Action                                                                            |
| ------------- | --------------------------------------------------------------------------------- |
| **Clear**     | Remove current weather from the active zone                                       |
| **Randomize** | Generate random weather for the active scene's climate zone using true randomness |
| **Save**      | Apply the selected/configured weather                                             |

## Behavior

- Selecting a built-in preset populates all detail fields with that preset's defaults, honoring any overrides configured in the [Weather Editor](Weather-Editor) (label, icon, color, FXMaster preset, sound, FX macro)
- Temperature is rolled within the preset's configured range (zone and season overrides applied) each time a preset is selected; edit the field afterward to override
- Editing detail fields creates a one-time weather override; the original preset is not modified
- Randomize respects the current zone's enabled presets and chance weights
- When a GM override is applied and the "GM Override Affects Forecast" setting is enabled, the forecast plan for the current zone is cleared and regenerated
- The picker is permission-gated. Only users with the **Change Weather** permission can access it
