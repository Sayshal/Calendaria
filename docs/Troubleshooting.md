# Troubleshooting

Common issues and solutions for Calendaria.

## Calendar Not Appearing

### HUD Not Visible

1. Check if the HUD is enabled: **Settings** → **Module Settings** → **Calendaria** → **Show Calendar HUD**
2. Try the keyboard shortcut: **Ctrl+C**
3. Reset position: **Settings** → **Module Settings** → **Calendaria** → **Reset HUD Position**
4. Check if it's off-screen (resize your browser window)

### Calendar Stuck Loading

1. Refresh the page (F5)
2. Disable and re-enable the module
3. Check the console (F12) for errors

---

## Time Not Advancing

### Time Controls Not Working

1. Verify you have GM permissions
2. Check if another GM is designated as Primary GM
3. Ensure the clock isn't paused

### Real-Time Clock Not Running

1. Click the play button in the time controls
2. Check if time multiplier is set to 0

### Time Jumps Unexpectedly

1. Check for other modules that modify world time
2. Verify no macros are advancing time automatically
3. Check the Primary GM setting for multi-GM games

---

## Notes and Events

### Notes Not Showing

1. Verify the note is assigned to the active calendar
2. Check the date is correct
3. Ensure the note isn't GM-only (if you're a player)

### Recurrence Not Working

1. Verify the repeat pattern is set correctly
2. Check that the start date is in the past or present
3. Ensure the end date (if set) hasn't passed

### Reminders Not Firing

1. Check that world time is advancing
2. Verify reminder is enabled on the note
3. Ensure you're in the target audience

---

## Darkness Sync

### Scene Not Getting Darker

1. Enable: **Settings** → **Calendaria** → **Sync Scene Darkness**
2. Check scene override in **Scene Config** → **Ambiance**
3. Verify time is actually changing

### Darkness Too Bright/Dark

1. Check sunrise/sunset in your calendar config
2. Adjust daylight settings in **Calendar Editor** → **Seasons**
3. Verify solstice dates are configured

---

## Weather

### Weather Not Generating

1. Check that a climate zone is configured
2. Verify weather chances total 100%
3. Try manual generation: click the weather badge

### Temperature Seems Wrong

1. Check temperature unit setting (C vs F)
2. Verify seasonal temperature ranges in climate zone
3. Ensure the correct climate zone is active

---

## Importing

### Import Fails

1. Verify the file is valid JSON
2. Check it's from a supported source
3. Try re-exporting from the original module
4. Check console for specific errors

### Data Missing After Import

1. Some features may not have direct equivalents
2. Review imported data in the calendar editor
3. Manually add missing information

---

## Performance

### Calendar Slow to Load

1. Reduce the number of notes
2. Disable unused features
3. Check for conflicting modules

### Lag When Advancing Time

1. Reduce real-time multiplier
2. Minimize open applications
3. Check for many triggered events

---

## Multi-GM Issues

### Time Desync Between GMs

1. Designate a single Primary GM
2. Ensure all GMs have the same module version
3. Use the socket sync features

### Calendar Changes Not Syncing

1. Check that both GMs are on the same calendar
2. Refresh pages for all GMs
3. Verify socket connections

---

## Console Errors

### Common Errors

**"Calendar not found"**
- The active calendar ID doesn't match an installed calendar
- Solution: Switch to a valid calendar in settings

**"Permission denied"**
- Non-GM trying to modify time
- Solution: Only GMs can advance time

**"Invalid date"**
- Date components are out of range
- Solution: Check month/day values match your calendar

### Debug Mode

Enable verbose logging to diagnose issues:

1. **Settings** → **Calendaria** → **Logging Level** → **Debug**
2. Open browser console (F12)
3. Reproduce the issue
4. Check for error messages

---

## Getting Help

If you can't resolve an issue:

1. Check the [GitHub Issues](https://github.com/Sayshal/calendaria/issues)
2. Join the [Discord](https://discord.gg/PzzUwU9gdz)
3. Provide:
   - Foundry version
   - Calendaria version
   - Other active modules
   - Console errors
   - Steps to reproduce
