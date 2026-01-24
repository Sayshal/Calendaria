# Troubleshooting

Common issues and solutions for Calendaria.

---

## Verifying Module Status

### Check if Module is Working

1. Open **Settings** > **Module Settings** > **Calendaria**
2. Verify the active calendar dropdown shows your calendar
3. Open the browser console (F12) - look for `CALENDARIA |` log entries
4. If no logs appear, verify the module is enabled in **Manage Modules**

### Enable Debug Logging

1. **Settings** > **Module Settings** > **Calendaria** > **Settings Panel**
2. Navigate to **Advanced** tab
3. Set **Logging Level** to **Verbose (All)**
4. Console will show detailed `CALENDARIA |` prefixed messages

---

## Permission Errors

These errors appear when a non-GM user attempts GM-only actions:

| Error Message                   | Cause                                  |
| ------------------------------- | -------------------------------------- |
| `Only GMs can advance time`     | Player tried to use time controls      |
| `Only GMs can set date/time`    | Player tried to set specific date/time |
| `Only GMs can jump to date`     | Player tried to navigate to a date     |
| `Only GMs can switch calendars` | Player tried to change active calendar |
| `Only GMs can create notes`     | Player tried to create a calendar note |
| `Only GMs can update notes`     | Player tried to modify a note          |
| `Only GMs can edit calendars`   | Player tried to access Calendar Editor |

> [!TIP]
> Only GM users can modify time and calendar data. Players receive these errors when attempting GM-only actions.

---

## Calendar Issues

### "Calendar not found" / "No active calendar"

- The configured calendar ID doesn't exist in the registry
- **Solution:** Switch to a valid calendar in **Settings Panel** > **Calendar** tab

### "Cannot remove the active calendar"

- Cannot delete the currently active calendar
- **Solution:** Switch to a different calendar first, then delete

### Calendar Stuck Loading

1. Refresh the page (F5)
2. Check console for specific errors
3. Disable conflicting calendar modules (Simple Calendar, etc.)
4. Clear browser cache

### Calendar Not Appearing

1. Check **Settings** > **Calendaria** > **Settings Panel** > **MiniCal** tab
2. Enable **Show MiniCal**
3. Try resetting position: **Settings Panel** > **MiniCal** > **Reset Position**
4. Check if UI is off-screen (resize browser window)

---

## Time Control Issues

### Time Controls Not Working

1. Verify you have GM permissions
2. Check **Settings Panel** > **Time** tab > **Primary GM** setting
3. In multi-GM sessions, only the Primary GM can control time

### Real-Time Clock Not Running

1. Verify the clock is started (play button active)
2. Check that increment/multiplier isn't set to zero
3. Confirm you're the Primary GM

### "Only the GM can control time"

- Non-GM user attempted to use TimeKeeper controls
- **Solution:** Only GMs can start/stop or adjust the clock

### "Clock blocked while game is paused or combat is active"

- The real-time clock pauses during combat or when the game is paused
- **Solution:** End combat or unpause the game to resume clock

---

## Calendar Editor Issues

### "Calendar must have a name"

- Calendar name field is empty
- **Solution:** Enter a valid name before saving

### "Calendar must have at least one month"

- All months were deleted from the calendar
- **Solution:** Add at least one month in the Months tab

### "Calendar must have at least one weekday"

- All weekdays were deleted
- **Solution:** Add at least one weekday in the Weekdays tab

---

## Import Issues

### Import Fails

Common import errors and solutions:

| Error                                                          | Solution                                                                       |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `Invalid Calendarium export format`                            | File must contain `calendars` array with `static.months` and `static.weekdays` |
| `Invalid Fantasy-Calendar export format`                       | File must contain `static_data` and `dynamic_data` fields                      |
| `Simple Calendar module is not installed or active`            | Enable the Simple Calendar module first                                        |
| `No calendars found in Simple Calendar module settings`        | Configure a calendar in Simple Calendar before importing                       |
| `Seasons & Stars module is not installed or active`            | Enable the Seasons & Stars module first                                        |
| `No active calendar found in Seasons & Stars module settings`  | Configure a calendar in Seasons & Stars before importing                       |
| `Simple Timekeeping module is not installed or active`         | Enable the Simple Timekeeping module first                                     |
| `No configuration found in Simple Timekeeping module settings` | Configure calendar settings in Simple Timekeeping before importing             |
| `No calendars found`                                           | Source module has no calendar data configured                                  |

### "No data loaded"

- No file uploaded or module data loaded
- **Solution:** Upload a valid JSON file or click "Import from Installed Module"

### "Select an import source first"

- No import source selected from dropdown
- **Solution:** Choose an import source before attempting to load data

### Data Missing After Import

- Some features may not have direct equivalents between systems
- Review imported calendar in the Calendar Editor
- Manually configure missing elements

---

## Weather Issues

### Weather Not Generating

1. Verify a climate zone is configured in Calendar Editor > Weather tab
2. Check that the calendar has seasons defined
3. Try manual weather generation via the weather badge

### "Only GMs can change weather"

- Non-GM user attempted to modify weather
- **Solution:** Only GMs can set/modify weather

### "Weather preset not found"

- Referenced preset ID doesn't exist
- **Solution:** Select a valid preset from the weather picker

### "No climate zones"

- Weather tab requires at least one climate zone configured
- **Solution:** Add a climate zone in Calendar Editor > Weather tab

---

## Note Issues

### "Note not found"

- Referenced note ID doesn't exist or was deleted
- **Solution:** Verify note exists in the calendar journal

### "Cannot delete calendar journal"

- The journal contains the calendar structure and events
- **Solution:** This journal is protected; delete individual notes instead

### "Cannot delete Calendar Notes folder"

- The folder contains all calendar journals
- **Solution:** This folder is protected by design

### "Cannot delete calendar folder"

- Attempting to delete a calendar-specific subfolder
- **Solution:** This folder contains all notes for this calendar and is protected

---

## UI Issues

### "This window cannot be closed"

- GM has enabled force display for this UI element
- **Solution:** Ask the GM to disable force display in Settings Panel

---

## Calendar Management Errors

### "Calendar already exists"

- Attempting to add a calendar with an ID that already exists
- **Solution:** Use a different calendar ID or edit the existing calendar

### "No active calendar available"

- No calendar is set as active
- **Solution:** Switch to a valid calendar in **Settings Panel** > **Calendar** tab

### "Error saving calendar" / "Error adding calendar"

- Failed to save calendar data to settings
- **Solution:** Check console for specific error details; may indicate format issues

---

## Macro Trigger Issues

### "Select a moon, phase, and macro"

- Moon phase trigger missing required fields
- **Solution:** Select all three options before adding the trigger

### "A trigger for this moon/phase already exists"

- Duplicate moon phase trigger detected
- **Solution:** Edit the existing trigger instead of creating a duplicate

### "Select a season and macro"

- Season trigger missing required fields
- **Solution:** Select both a season and macro before adding the trigger

### "A trigger for this season already exists"

- Duplicate season trigger detected
- **Solution:** Edit the existing trigger instead of creating a duplicate

---

## Resetting Settings

### Reset UI Positions

1. Open **Settings** > **Module Settings** > **Calendaria** > **Settings Panel**
2. Navigate to the relevant tab (MiniCal, HUD, or TimeKeeper)
3. Click **Reset Position**

### Reset Theme Colors

1. **Settings Panel** > **Appearance** tab
2. Click **Reset All** to restore default colors

### Theme Import Failed

- "Failed to import theme. Check the file format."
- **Solution:** Ensure the JSON file contains a valid `colors` object exported from Calendaria

### Full Settings Reset

> [!CAUTION]
> This will erase all calendar customizations, notes, and settings for this module.

Run this macro to completely reset Calendaria:

```javascript
if (!game.user.isGM) {
  ui.notifications.error('Only GMs can reset Calendaria');
  return;
}

const confirm = await foundry.applications.api.DialogV2.confirm({
  window: { title: 'Reset Calendaria' },
  content: '<p>This will delete ALL Calendaria settings, custom calendars, and notes. This cannot be undone.</p><p>Are you sure?</p>',
  yes: { default: false },
  no: { default: true }
});

if (!confirm) return;
await game.settings.set('calendaria', 'devMode', true);
await CALENDARIA.api.deleteAllNotes();
const folders = game.folders.filter((f) => f.flags?.calendaria && !f.folder?.flags?.calendaria);
for (const folder of folders) await folder.delete({ deleteSubfolders: true, deleteContents: true });
const settings = game.settings.storage.get('world').filter((s) => s.key.startsWith('calendaria.'));
for (const setting of settings) await setting.delete();
ui.notifications.info('Calendaria reset complete. Please refresh.');
```

---

## Console Debugging

### Log Level Reference

| Level             | Output                     |
| ----------------- | -------------------------- |
| Off               | No logging                 |
| Errors Only       | Only errors (red)          |
| Warnings & Errors | Errors + warnings (orange) |
| Verbose (All)     | All debug output (violet)  |

---

## Reporting Bugs

If you cannot resolve an issue:

1. Check existing issues: [GitHub Issues](https://github.com/Sayshal/Calendaria/issues)
2. When reporting, include:
   - Foundry VTT version
   - Calendaria version
   - Other active modules
   - Console errors (F12 > Console)
   - Steps to reproduce
3. Enable **Verbose (All)** logging and capture relevant console output
