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
3. Set **Logging Level** to **Verbose**
4. Console will show detailed `CALENDARIA |` prefixed messages

---

## Permission Errors

These errors appear when a non-GM user attempts GM-only actions:

| Error Message | Cause |
|---------------|-------|
| `Only GMs can advance time` | Player tried to use time controls |
| `Only GMs can set date/time` | Player tried to set specific date/time |
| `Only GMs can jump to date` | Player tried to navigate to a date |
| `Only GMs can switch calendars` | Player tried to change active calendar |
| `Only GMs can create notes` | Player tried to create a calendar note |
| `Only GMs can update notes` | Player tried to modify a note |
| `Only GMs can edit calendars` | Player tried to access Calendar Editor |

**Solution:** Only GM users can modify time and calendar data.

---

## Calendar Issues

### "Calendar not found" / "No active calendar"

- The configured calendar ID doesn't exist in the registry
- **Solution:** Switch to a valid calendar in **Settings** > **Calendaria** > **Active Calendar**

### "Cannot remove the active calendar"

- Cannot delete the currently active calendar
- **Solution:** Switch to a different calendar first, then delete

### Calendar Stuck Loading

1. Refresh the page (F5)
2. Check console for specific errors
3. Disable conflicting calendar modules (Simple Calendar, etc.)
4. Clear browser cache

### Calendar Not Appearing

1. Check **Settings** > **Calendaria** > **Settings Panel** > **MiniCalendar** tab
2. Enable **Show MiniCalendar**
3. Try resetting position: **Settings Panel** > **MiniCalendar** > **Reset Position**
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

| Error | Solution |
|-------|----------|
| `Invalid Calendarium export format` | File must contain `calendars` array with `static.months` and `static.weekdays` |
| `Invalid Fantasy-Calendar export format` | File must contain `static_data` and `dynamic_data` fields |
| `Simple Calendar module is not installed or active` | Install and enable the Simple Calendar module first |
| `No calendars found in Simple Calendar module settings` | Configure a calendar in Simple Calendar before importing |
| `No calendars found` | Source module has no calendar data configured |

### "No data loaded"

- No file uploaded or module data loaded
- **Solution:** Upload a valid JSON file or click "Import from Installed Module"

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

---

## Resetting Settings

### Reset UI Positions

1. Open **Settings** > **Module Settings** > **Calendaria** > **Settings Panel**
2. Navigate to the relevant tab (MiniCalendar, HUD, or TimeKeeper)
3. Click **Reset Position**

### Reset Theme Colors

1. **Settings Panel** > **Appearance** tab
2. Click **Reset All** to restore default colors

### Full Settings Reset

To completely reset Calendaria:

1. Close Foundry VTT
2. Delete the module settings from your world's database
3. Restart Foundry

---

## Console Debugging

### Log Level Reference

| Level | Output |
|-------|--------|
| Off | No logging |
| Errors | Only errors (red) |
| Warnings | Errors + warnings (orange) |
| Verbose | All debug output (purple) |

### Common Console Patterns

```
CALENDARIA | Error initializing logger: [error details]
CALENDARIA | Active calendar "X" not found, using "Y"
CALENDARIA | Loaded X calendars from settings
CALENDARIA | Migrated calendar "X": added missing fields
```

---

## Multi-GM Sessions

### Time Desync Between GMs

1. Designate a single Primary GM in **Settings Panel** > **Time**
2. Verify all GMs have the same module version
3. Refresh all clients if issues persist

### Calendar Changes Not Syncing

1. Check socket connection (no Foundry connection warnings)
2. Verify both GMs are viewing the same calendar
3. Refresh pages for all GMs

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
3. Enable **Verbose** logging and capture relevant console output
