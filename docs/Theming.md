# Theming

Customizable color themes for all Calendaria application windows (BigCal, MiniCal, Note Viewer, Chronicle, etc.). Non-app elements like journal footers, toolbar buttons, and info boxes use Foundry's native styling.

---

## Global Theme Presets

Calendaria ships with 15 built-in theme presets:

| Preset            | Description                                              |
| ----------------- | -------------------------------------------------------- |
| **Dark**          | Dark gray background, light text, blue accents (default) |
| **Light**         | White background, dark text, blue accents                |
| **High Contrast** | Black background, white borders, maximum contrast        |
| **Parchment**     | Warm tan background, sepia text, golden accents          |
| **Arcane**        | Deep purple background, lavender text, gold headings     |
| **Verdant**       | Dark forest green background, pale green text            |
| **Infernal**      | Near-black red background, warm text, fiery accents      |
| **Frost**         | Light steel-blue background, dark text, blue accents     |
| **Steampunk**     | Dark brown background, tan text, brass/copper accents    |
| **Neon**          | Near-black background, cyan and magenta highlights       |
| **Minimalist**    | White background, black borders, red accent only         |
| **Solarized**     | Solarized Dark palette with teal and orange accents      |
| **Royal**         | Dark navy background, gold headings, crimson today       |
| **Sakura**        | Deep plum background, soft pink text, rose accents       |
| **Slate**         | Dark sage-green background, warm cream text              |

Select a preset from the dropdown in **Settings Panel > Appearance** tab. Presets apply to all Calendaria applications including the note sheet and Chronicle.

**Settings Panel**, **Preset Manager**, and minor dialogs are excluded from theming and always use Foundry defaults.

---

## Force Theme (GM Only)

The GM can pin a theme for all connected clients from the Force Theme dropdown in the **Settings Panel > Theme** tab. Set it to any preset or a saved **Custom** theme to force that palette on every player, or set it to **None** to let each user pick their own theme again. While Force Theme is set to anything other than **None**, the per-user preset dropdown and Customize button are disabled and show the forced palette.

---

## Customizing Colors

1. Select **Custom** from the preset dropdown
2. Click any color swatch to open the color picker
3. Changes apply immediately to all Calendaria widgets
4. Colors are saved per-user

---

## Resetting Theme

Click the reset button (undo icon) in the Theme section header to restore default colors. A confirmation dialog lists which settings will be reset.

---

## Exporting and Importing Themes

Import and Export buttons are next to the preset dropdown.

### Export

1. Open Appearance tab
2. Click the **Export** button
3. Save the JSON file

### Import

1. Open Appearance tab
2. Click the **Import** button
3. Select a previously exported JSON file
4. Colors update immediately

Theme files contain a `colors` object with all customizable color values.

---

## CSS Variables

Themes modify CSS custom properties prefixed with `--calendaria-`. Inspect in browser dev tools for additional customization via world scripts or custom CSS modules.
