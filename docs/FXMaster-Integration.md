# FXMaster Integration

Calendaria integrates with the [FXMaster](https://foundryvtt.com/packages/fxmaster) module to project weather visual effects onto the Foundry canvas.

---

## How It Works

Each weather preset can map to an FXMaster effect. When weather changes, Calendaria sends the mapped effect to FXMaster for rendering on the canvas.

- If FXMaster is not installed or inactive, canvas effects are skipped. The HUD dome effects and ambient sound still work independently
- FXMaster effects can be overridden per-preset in the [Weather Editor](Weather-Editor) or temporarily in the [Weather Picker](Weather-Picker)
- The effect dropdowns in Weather Editor and Weather Picker only show effects available to your installation

See [Weather Presets](Weather-Presets) for the complete mapping of presets to FXMaster effects.

### FXMaster+

Some canvas effects are enhanced or only available with [FXMaster+](https://foundryvtt.com/packages/fxmaster-plus) (the premium version). Calendaria automatically detects which version is installed and filters the available effects accordingly.

---

## Wind Direction Passthrough

Calendaria passes the current wind direction to FXMaster, so effects like rain and snow angle with the wind.

---

## Density, Speed, and Color

The [Weather Picker](Weather-Picker) includes FX Density, FX Speed, and FX Color controls that override the particle behavior sent to FXMaster:

- **FX Density**: Default, Very Low, Low, Medium, High, Very High
- **FX Speed**: Same levels as density
- **FX Color**: Color input for effect tint override

All 35 built-in presets include tuned density and speed defaults. Saved custom presets include these values.

---

## Global Disable

The **Enable Weather FX** world setting (Settings Panel > Weather tab > Weather Generation fieldset) is a global toggle. When disabled, all FXMaster particle effects and weather sounds are stopped. The per-scene "Disable Weather FX" flag still overrides independently.

---

## Per-Scene Top-Down Override

Individual scenes can override the global Top-Down Mode setting via **Scene Configuration > Calendaria tab > FX Top-Down Override**:

- **Use Global**: Follow the module-level Top-Down Mode setting
- **Top-Down**: Force top-down rendering on this scene regardless of global setting
- **Side View**: Force side-view rendering on this scene regardless of global setting

---

## Per-Scene Disable

Individual scenes can disable weather FX via a checkbox in the **Scene Configuration > Calendaria tab > Disable Weather FX**. When enabled:

- FXMaster weather effects are not sent to this scene
- Ambient weather sounds are silenced on this scene
- Takes effect immediately when the flag changes (no reload needed)
- HUD dome effects are not affected (they render in the HUD widget, not on the canvas)

---

## Ambient Sound System

Calendaria includes a **native ambient sound system** independent of FXMaster. Weather presets can trigger looping audio files that play through Foundry's environment audio context.

### Crossfade Behavior

When weather changes, the old sound fades out over 2 seconds while the new sound fades in simultaneously, preventing abrupt audio cuts.

### Controls

- **Sound Effects** setting (Settings Panel > Weather tab > Weather Generation) enables/disables ambient sound globally
- **Sound Volume** slider (Settings Panel > Weather tab) controls weather sound volume
- Per-scene **Disable Weather Sound** flag suppresses sound on a specific scene without affecting visual effects
- Sounds play through Foundry's environment audio channel
- Sound assignments can be customized per-preset via the [Weather Editor](Weather-Editor)
