# Weather Editor

The Weather Editor is used to customize the visual appearance, sound, and FXMaster mapping of weather presets. Launch it from **Settings Panel > Weather tab > Weather Editor** button.

---

## Sidebar Navigation

The left sidebar lists all presets grouped by category with color-coded headers:

- **Standard** — Common weather
- **Severe** — Dangerous conditions
- **Environmental** — Location phenomena
- **Fantasy** — Magical weather
- **Custom** — GM-created presets

Click a preset to load it in the main editor area.

---

## Per-Preset Editor

### Weather Info

| Field               | Description                                                    |
| ------------------- | -------------------------------------------------------------- |
| **Name**            | Display name (localized for built-in, editable for custom)     |
| **Icon**            | FontAwesome icon class                                         |
| **Color**           | Hex color                                                      |
| **HUD Effect**      | Dropdown to assign a particle effect for the HUD dome renderer |
| **FXMaster Preset** | Dropdown of available FXMaster effects (or "None")             |
| **Sound Effect**    | Dropdown of ambient sound loops (or "None")                    |

### Environment Lighting

Per-preset overrides for scene environment properties, split into Day (Base) and Night (Dark) sections. Labels use Foundry's native scene property names.

#### Day (Base)

| Field              | Description                                 |
| ------------------ | ------------------------------------------- |
| **Hue**            | Hue angle (0–360°) for daytime lighting     |
| **Intensity**      | Hue intensity (0 to 1)                      |
| **Luminosity**     | Scene luminosity (-1 to 1)                  |
| **Saturation**     | Color saturation (-1 to 1)                  |
| **Shadows**        | Shadow intensity (0 to 1)                   |
| **Blend Ambience** | Checkbox — enable ambience blending (cycle) |

#### Night (Dark)

| Field          | Description                               |
| -------------- | ----------------------------------------- |
| **Hue**        | Hue angle (0–360°) for nighttime lighting |
| **Intensity**  | Hue intensity (0 to 1)                    |
| **Luminosity** | Scene luminosity (-1 to 1)                |
| **Saturation** | Color saturation (-1 to 1)                |
| **Shadows**    | Shadow intensity (0 to 1)                 |

### HUD Visuals

Fine-tune the particle rendering in the HUD dome:

| Field              | Description                                         |
| ------------------ | --------------------------------------------------- |
| **Particle Count** | Number of particles                                 |
| **Scale**          | Particle size multiplier                            |
| **Alpha**          | Particle transparency                               |
| **Speed**          | Particle movement speed                             |
| **Gravity**        | Downward pull strength                              |
| **Wobble**         | Lateral oscillation                                 |
| **Tint Colors**    | Array of particle tint colors                       |
| **Sky Gradient**   | Top/mid/bottom colors and strength for sky override |

---

## Override System

### Built-in Presets

Built-in presets are read-only by default. The Weather Editor saves your changes as **visual overrides** (deltas) — only the fields you modify are stored. The original preset data is preserved.

- **Reset to Defaults** — Removes all visual overrides for this preset, restoring factory settings

### Custom Presets

Custom presets store all fields directly — there is no delta system since there are no factory defaults to preserve.

- **Delete Weather** — Permanently removes a custom preset

---

## Actions

| Action                | Description                                   |
| --------------------- | --------------------------------------------- |
| **Create New**        | Add a new custom weather preset               |
| **Reset to Defaults** | Remove visual overrides for a built-in preset |
| **Delete Weather**    | Remove a custom preset                        |

> [!NOTE]
> Changes in the Weather Editor update the active scene in real-time. Only visual/lighting changes preview — FX and sound effects are not triggered during editing.
