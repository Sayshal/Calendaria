# Secondary Calendar

View any loaded calendar side-by-side with the primary calendar. Shows the equivalent date on a different calendar system, with a month grid and navigation controls.

---

## Opening the Secondary Calendar Viewer

- Click an equivalent date link in the BigCal/MiniCal header
- API: `CALENDARIA.api.showSecondaryCalendar(calendarId)`

---

## Display

Shows a month grid for the selected secondary calendar, centered on the equivalent date of the primary calendar's current view.

### Month Grid

- Weekday headers
- Day cells showing the current equivalent date highlighted
- Previous/next month days shown in faded style

### Calendar Selector

A dropdown in the header lists all loaded calendars except the active primary calendar. Selecting a different calendar switches the viewer to that calendar's month grid.

### Monthless Calendars

For calendars without months (like Traveller), the viewer displays a week-based grid:

- 3-week sliding window (previous, current, next week)
- Navigation moves by week instead of month
- Header displays "Week X, Year" instead of month name

---

## Navigation

| Action            | Result                                          |
| ----------------- | ----------------------------------------------- |
| Arrow buttons     | Move by month (or week for monthless calendars) |
| Today button      | Return to the equivalent of the current date    |
| Calendar dropdown | Switch to a different secondary calendar        |

---

## Date Conversion

Cross-calendar date translation works through shared world time. All loaded calendars share the same underlying `game.time.worldTime` value. The viewer converts the primary calendar's current date to the equivalent position on the secondary calendar by resolving through this shared time reference.

- Every calendar interprets the same world time according to its own structure (months, weeks, year length, epoch)
- Advancing time on the primary calendar updates equivalent dates on all secondary calendars
- No manual mapping is needed. Conversion is derived from world time.

---

## Equivalent Date Display

When calendars are selected in the "Equivalent Date Calendars" setting (**Settings Panel > Home** tab), equivalent dates from those calendars appear in several locations:

### BigCal Header

Equivalent dates from all other loaded calendars appear below the primary date. Clicking one opens the Secondary Calendar Viewer for that calendar.

### MiniCal Header

Equivalent date links appear in the header, same as BigCal. Hidden in compact mode.

### Note Sheets

Note sheets show when the note's date falls on each loaded calendar.

### Day Tooltips

Hovering over a day cell shows equivalent dates from other calendars in the tooltip.

---

## API

See [API Reference](API-Reference) for full details.
