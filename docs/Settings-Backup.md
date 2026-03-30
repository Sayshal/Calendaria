# Settings Backup & Transfer

GMs can export and import world settings, calendar data, and notes for backup or transfer between worlds.

---

## Accessing Backup & Transfer

Open the settings panel and navigate to **Module** tab > **Backup & Transfer** section.

> [!NOTE]
> This feature is GM-only.

---

## Exporting

1. Open the Settings Panel
2. Navigate to the **Module** tab
3. Click **Export Settings**
4. Optionally check **Include Calendar Data** to embed the active calendar's full definition
5. Optionally check **Include Notes** to embed all notes for the active calendar
6. Save the JSON file

The exported file is named `calendaria-settings-{timestamp}.json` and includes:

| Category          | Examples                                                                             |
| ----------------- | ------------------------------------------------------------------------------------ |
| Display Formats   | Date/time formats for HUD, MiniCal, BigCal, Time Keeper, Stop Watch, Chat            |
| Time Settings     | Real-time clock speed, multiplier, unit, sync-clock-pause                            |
| Weather           | Current weather, history, forecast plans, intraday settings, inertia, custom presets |
| Fog of War        | Enabled state, revealed ranges, start date, nav mode, reveal settings                |
| Cinematic         | Enabled, threshold, panel duration, per-element toggles, event weighting             |
| Chronicle         | Depth mode, view mode, visibility toggles, button visibility, combat mode            |
| UI Visibility     | Show/force settings for all 7 widgets, toolbar apps, journal footer                  |
| Permissions       | All role-based permissions                                                           |
| Categories        | Custom note presets (via custom presets setting)                                     |
| Custom Time Jumps | HUD, Time Keeper, MiniCal jump configurations                                        |
| Macro Triggers    | Season and moon phase trigger assignments                                            |
| Theme             | Theme mode, custom colors, forced theme colors                                       |
| Scene Integration | Ambience sync, darkness sync, color shift sync, brightness multiplier                |
| Equivalent Dates  | Multi-calendar sync calendar list                                                    |

### Calendar Data (optional)

When **Include Calendar Data** is checked, the active calendar's full definition is embedded in the export, including the current date. On import, this creates a new custom calendar in the target world.

### Notes (optional)

When **Include Notes** is checked, all notes for the active calendar are serialized into the export. On import, notes are recreated and cross-references between notes are re-linked automatically. Scene-specific, macro, and playlist references are cleared since they won't resolve in the target world.

---

## What Is NOT Exported

User-scoped (per-client) settings are not included:

- Window positions (HUD, MiniCal, BigCal, Time Keeper, Stop Watch, Sun Dial)
- Sticky zone states (per-user)
- Lock position states
- Block visibility preferences
- Per-user combat behavior settings
- Per-user auto-fade and idle opacity settings

---

## Importing

1. Open the Settings Panel
2. Navigate to the **Module** tab
3. Click **Import Settings**
4. Select a previously exported JSON file
5. Review the confirmation dialog showing:
   - Number of settings to import
   - Source version
   - Checkboxes for calendar data and notes (if present in the file)
   - Option to set the imported calendar as active
6. Click **Confirm** to apply

> [!WARNING]
> Importing settings overwrites your current world settings.

---

## Transferring Between Worlds

1. Export settings from the source world (with calendar data and notes checked)
2. Open the target world
3. Enable Calendaria
4. Import the settings file
5. Check "Set as Active" to switch to the imported calendar

---

## Version Compatibility

Settings files include version metadata. When importing from a different version:

- Settings that exist in both versions are imported
- New settings in the current version keep their defaults
- Removed settings from older versions are ignored

---

## Troubleshooting

### Import fails with error

- Verify the file is a valid Calendaria settings export (must contain a `settings` object)
- Check that the file is not corrupted
- Try exporting fresh settings to compare file structure

### Settings don't apply after import

- Refresh the page after importing
- Check that all players have refreshed their browsers
