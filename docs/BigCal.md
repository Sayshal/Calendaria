# BigCal

The BigCal window provides month, week, and year views with full note management and navigation.

---

## Opening BigCal

- Double-click the HUD or MiniCal
- Use the API: `CALENDARIA.api.openBigCal()`
- Scene controls button (if enabled in settings)

---

## Display Modes

Switch between views using the Month/Week/Year buttons in the header.

### Month View

The default view displays a monthly grid:

- Weekday headers with rest-day highlighting
- Day cells showing notes, moon phases, and festival indicators
- Multi-day events rendered as horizontal bars spanning weeks
- Previous/next month days shown in faded style (click to navigate)
- Intercalary days displayed in a separate row above the grid

### Week View

A detailed 7-day view with hourly time slots:

- 24-hour time grid with current hour highlighted
- All-day events displayed at the top of each column
- Timed events positioned by start hour and duration
- Click any time slot to select it, then click Add Note to create an event at that hour
- Each time cell (day:hour intersection) has a "+" button for quick note creation at that specific hour

### Year View

A 9-year overview grid for quick navigation:

- Current year highlighted in the center
- Click any month to jump directly to that month view
- Navigate between year ranges with Previous/Next buttons

---

## Header Controls

| Button           | Action                                             |
| ---------------- | -------------------------------------------------- |
| Previous/Next    | Navigate by month, week, or year depending on view |
| Month/Week/Year  | Switch display mode                                |
| Today            | Jump to current date                               |
| Add Note         | Create note on selected or current date            |
| Search           | Toggle search panel                                |
| Settings         | Open settings panel                                |
| Compact          | Switch to MiniCal                                  |
| Set Current Date | Set world time to selected date (GM only)          |

---

## Indicators

Below the header, contextual indicators display:

- **Weather** — Current conditions with icon and temperature (GM can click to open weather picker)
- **Season** — Current season with icon and color
- **Era** — Current era name (if calendar has eras configured)
- **Cycle** — Current cycle values (if calendar has cycles configured)

---

## Day Cells

Each day cell in month view displays:

| Element         | Description                                            |
| --------------- | ------------------------------------------------------ |
| Day number      | The date, with today highlighted                       |
| Festival star   | Indicates a festival day                               |
| Moon icons      | Up to 3 visible, hover "+N" badge for additional moons |
| Note indicators | Custom icons and colors for each note                  |
| Add button      | Quick note creation (appears on hover)                 |

**Hover Tooltip:**
Hovering over a day cell displays a tooltip with:

- Full date (Month Day, Year with era)
- Festival name (if applicable)
- Season name
- Sunrise/sunset times

**Interactions:**

- Click a day to select it (click again to deselect)
- Right-click for context menu with notes (sorted alphabetically) showing inline edit/delete icons, plus BigCal-specific items (Settings, Open MiniCal, Close)
- Right-click the BigCal window header to also open the context menu
- Click a grayed-out day from another month to navigate there

---

## Multi-Day Events

Events spanning multiple days appear as horizontal bars:

- Color-coded with the note's custom color
- Display note icon and title
- Arrow indicators show events continuing from previous weeks
- Overlapping events stack in separate rows
- Click any bar to open the note

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

GMs have additional capabilities:

- **Set Current Date** — Updates world time to the selected or viewed date
- **Weather Picker** — Click the weather indicator to change weather
- **All time controls** — Players cannot modify world time

---

## Intercalary Days

Special days that don't count toward the normal weekday cycle (configured via Festival Days with "Counts for Weekday" disabled) appear in a separate row above the calendar grid. These are typically used for festival days that exist "outside" the regular calendar.

---

## Monthless Calendars

For calendars without months (like Traveller), the month view displays a 3-week sliding window:

- Shows previous week, current week, and next week
- Navigation moves by week instead of month
- Header displays "Week X, Year" instead of month name

---

## Settings

Configure via **Settings Panel > BigCal** tab. See [Settings](Settings#bigcal) for all options.

### Block Visibility

Control which information blocks appear on the BigCal interface:

| Setting          | Description                                       |
| ---------------- | ------------------------------------------------- |
| Show Weather     | Display weather block (with Weather Display Mode) |
| Show Season      | Display season block (with Season Display Mode)   |
| Show Era         | Display era block (with Era Display Mode)         |
| Show Cycles      | Display cycles block (with Cycles Display Mode)   |
| Show Moon Phases | Display moon phase indicators on day cells        |
