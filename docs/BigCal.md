# BigCal

A borderless floating calendar window with rounded corners, showing month, week, and year views with note management. BigCal's height caps at the browser viewport. If the calendar grid has too many rows to fit on screen, the content area scrolls while the header stays fixed. The window re-constrains on browser resize.

---

## Opening BigCal

- Double-click the HUD or MiniCal
- Use the API: `CALENDARIA.api.showBigCal()`
- Scene controls button (if enabled in settings)
- Automatically on world load (if "Show BigCal on Load" is enabled)

---

## Display Modes

Switch between views using the dropdown in the header.

### Month View

Default view. Displays a monthly grid:

- Weekday headers with rest-day highlighting
- Day cells showing notes, moon phases, and festival indicators
- Multi-day events rendered as horizontal bars spanning weeks
- Previous/next month days shown in faded style (click to navigate)
- Intercalary days displayed in a separate row above the grid

### Week View

Detailed 7-day layout with hourly time slots:

- 24-hour time grid with current hour highlighted
- All-day events displayed at the top of each column
- Timed events positioned by start hour and duration
- Click any time slot to select it, then click Add Note to create an event at that hour
- Each time cell (day:hour intersection) has a "+" button for quick note creation at that specific hour

### Year View

9-year overview grid for quick navigation:

- Current year and current month highlighted with visual emphasis
- Click any month to jump directly to that month view
- Navigate between year ranges with Previous/Next buttons

---

## Header

Compact two-row layout:

**Row 1:** Search, compact toggle, calendar title, settings, close button

**Row 2:** Previous/next navigation, dropdown view selector (Month/Week/Year), indicators

| Button           | Action                                             |
| ---------------- | -------------------------------------------------- |
| Previous/Next    | Navigate by month, week, or year depending on view |
| View Selector    | Dropdown to switch between Month, Week, Year views |
| Today            | Jump to current date                               |
| Search           | Toggle search panel                                |
| Settings         | Open settings panel                                |
| Compact          | Switch to MiniCal                                  |
| Close            | Close BigCal                                       |
| Set Current Date | Set world time to selected date (GM only)          |

### Equivalent Dates

When multiple calendars are loaded and "Show Equivalent Dates" is enabled, the header shows an extra row with the current date converted to each secondary calendar. Each equivalent date links to the Secondary Calendar Viewer for that calendar.

Create notes by hovering over day cells (the "+" button appears on hover).

---

## Indicators

Below the header, contextual indicators show:

- **Weather.** Current conditions with icon and temperature (GM can click to open weather picker)
- **Season.** Current season with icon and color
- **Era.** Current era name (if calendar has eras configured)
- **Cycle.** Current cycle values (if calendar has cycles configured)

---

## Day Cells

Each day cell in month view shows:

| Element         | Description                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------------ |
| Day number      | Date, with today highlighted                                                                           |
| Festival star   | Indicates a festival day                                                                               |
| Moon icons      | Up to 3 visible, hover "+N" badge for additional moons; clickable for radial moon picker when >3 moons |
| Note indicators | Custom icons and colors for each note                                                                  |
| Weather pill    | Icon + temperature + wind direction for the day's weather                                              |
| Add button      | Quick note creation (appears on hover)                                                                 |

### Weather Pills

Day cells show weather as compact pills:

- **Today**: Current weather (full opacity)
- **Past days**: Historical weather from the weather history
- **Future days**: Forecast weather (dimmed at 50% opacity)

Each pill shows weather icon, temperature, and wind direction.

**Hover Tooltip:**
Hovering over a day cell shows:

- Full date (Month Day, Year with era)
- Festival name (if applicable)
- Season name
- Sunrise/sunset times
- Weather conditions (icon, name, temperature, wind, precipitation)
- Equivalent dates from other calendars (if configured)
- **Note listing.** Festivals listed first with a star icon, then regular notes with colored dots matching each note's color. Capped at 5 entries; extra notes show a "+N more" overflow indicator.

**Interactions:**

- Click a day to select it (click again to deselect)
- Right-click for context menu with notes (sorted alphabetically) showing inline edit/delete icons, plus BigCal-specific items (Settings, Open MiniCal, Close). Capped at 5 entries. Days with more than 5 notes show a "+N more" item that opens the Note Viewer pre-filtered to that date.
- Right-click the BigCal window header to also open the context menu
- Click a grayed-out day from another month to navigate there

---

## Multi-Day Events

Events with duration span multiple days, rendered as horizontal bars across the calendar grid:

- Color-coded with the note's custom color
- Show note icon and title
- Arrow indicators mark events continuing from previous weeks
- When multiple events overlap, bars condense to thin lines. On hover, they expand to full height showing icon and title with a smooth CSS transition.
- Click any bar to open the note
- Optional bookend markers indicate the start and end days of the event

### Display Styles

Multi-day events render differently depending on their display style:

| Style      | Rendering                                                                                |
| ---------- | ---------------------------------------------------------------------------------------- |
| **Icon**   | Default style. Event bar shows the note's icon and title text across its duration span   |
| **Pip**    | Compact dot indicator. A minimal colored bar with reduced height for less visual weight  |
| **Banner** | Full-width bar. A prominent colored bar emphasizing the event across its entire duration |

Events sort by start date, then by display priority: banners first, then icons, then pips. Festival notes always sort above regular notes.

---

## Notes

### Viewing Notes

- Click any note indicator or event bar to open it
- Notes open in view mode by default
- Click the edit icon to modify (if you have permission)

### Creating Notes

- Click the **Add Note** button in the header
- Click the **+** button on any day cell (appears on hover)
- In week view, select a time slot first then click Add Note

### Searching Notes

1. Click the **Search** button to open the search panel
2. Type at least 2 characters
3. Results appear in real-time with icons showing categories and status
4. Click a result to open that note

---

## Navigation

| Action                            | Result                                            |
| --------------------------------- | ------------------------------------------------- |
| Arrow buttons                     | Move by month, week, or 9 years depending on view |
| Today button                      | Return to current date                            |
| Click other-month day             | Navigate to that month                            |
| Click month in year view          | Jump to that month in month view                  |
| Double-click anywhere in calendar | Switch to MiniCal                                 |

---

## GM Controls

GM-only controls:

- **Set Current Date.** Updates world time to the selected or viewed date
- **Weather Picker.** Click the weather indicator to change weather
- **Show to All Players** / **Hide from All Players.** Context menu actions to toggle BigCal visibility for all connected players
- **All time controls.** Players cannot modify world time

---

## Intercalary Days

Special days that don't count toward the normal weekday cycle (configured via Festival Days with "Counts for Weekday" disabled) appear in a separate row above the calendar grid, typically festival days that exist "outside" the regular calendar.

---

## Monthless Calendars

For calendars without months (like Traveller), the month view displays a 3-week sliding window:

- Shows previous week, current week, and next week
- Navigation moves by week instead of month
- Header displays "Week X, Year" instead of month name
