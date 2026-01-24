# Settings Backup & Transfer

Calendaria allows GMs to export and import world settings for backup or transfer between worlds.

---

## Accessing Backup & Transfer

Open the settings panel and navigate to **Module** tab > **Backup & Transfer** section.

> [!NOTE]
> This feature is GM-only.

---

## Exporting Settings

1. Open the Settings Panel
2. Navigate to the **Module** tab
3. Click **Export Settings**
4. Save the JSON file to your computer

The exported file is named `calendaria-settings-{timestamp}.json` and includes:

| Category          | Examples                                                                |
| ----------------- | ----------------------------------------------------------------------- |
| Display Formats   | Date/time formats for HUD, MiniCal, BigCal, TimeKeeper, Stopwatch, Chat |
| Time Settings     | Real-time clock, time progression, increment multiplier                 |
| Weather           | Weather enabled, weather patterns, brightness multiplier                |
| UI Integration    | Toolbar buttons, Journal footer                                         |
| Permissions       | All role-based permissions                                              |
| Custom Time Jumps | HUD, TimeKeeper, MiniCal jump configurations                            |
| Note Categories   | Category names, colors, icons                                           |
| Macro Triggers    | Season and moon phase trigger assignments                               |

---

## What Is NOT Exported

User-scoped settings are **not** included in the export:

- Window positions (HUD, MiniCal, TimeKeeper, Stopwatch)
- Sticky zone states
- Lock position states
- Block visibility preferences (per-user display settings)
- Theme colors (per-user customization)

These settings are stored per-client and would not be appropriate to transfer between worlds or users.

---

## Importing Settings

1. Open the Settings Panel
2. Navigate to the **Module** tab
3. Click **Import Settings**
4. Select a previously exported JSON file
5. Review the confirmation dialog showing:
   - Number of settings to import
   - Source version
6. Click **Confirm** to apply settings

> [!WARNING]
> Importing settings will overwrite your current world settings.

---

## Transferring Between Worlds

To transfer settings to a new world:

1. Export settings from the source world
2. Open the target world
3. Enable Calendaria
4. Import the settings file

---

## Version Compatibility

Settings files include version metadata. When importing from a different version:

- Settings that exist in both versions are imported
- New settings in the current version use defaults
- Removed settings from older versions are ignored

For best results, use matching module versions between export and import.

---

## Troubleshooting

### Import fails with error

- Verify the file is a valid Calendaria settings export
- Check that the file is not corrupted
- Try exporting fresh settings to compare file structure

### Settings don't apply after import

- Refresh the page after importing
- Check that all players have refreshed their browsers
- Some settings require a world reload to take full effect
