# MiniCal

A compact month-view calendar widget with integrated time controls.

---

## Display

The MiniCal shows a monthly grid with the current date highlighted. For monthless calendars (like Traveller), it displays a 3-week view instead.

### Indicators

Below the navigation row, the MiniCal displays contextual indicators:

- **Weather** - Current weather with icon, label, and temperature. GM can click to open weather picker. Shows "click to generate" prompt when no weather is set.
- **Season** - Current season with icon and name
- **Era** - Current era indicator (if calendar has eras)
- **Cycle** - Current cycle values (if calendar has cycles configured)

### Navigation

- **Arrow buttons** - Previous/next month (or week for monthless calendars)
- **Today button** - Return to current date
- Click a day to select it
- Click a grayed-out day to navigate to that month

### Monthless Calendars

For calendars without months (like Traveller), the MiniCal shows a 3-week view:

- Previous week, current week, and next week
- Navigation moves by week instead of month
- Header displays "Week X, Year"

### Day Cells

Each day cell may show:

- Note count badge — uses the first note's category color as background
- Festival highlight
- Moon phase icon
- Weather icon
- Today indicator
- Selected indicator

### Day Tooltips

Hovering over a day cell shows a detailed tooltip with:

- Full date (Month Day, Year with era)
- Festival name and description (if applicable)
- Current season name
- Sunrise and sunset times
- Weather summary (icon, name, temperature)

---

## Sidebar

The sidebar is organized into four button groups with visual dividers separating navigation, date management, notes, and system sections.

Appears on hover over the calendar area (or always visible when sticky):

- **Close** - Close the MiniCal
- **Open BigCal** - Opens the BigCal Application
- **Today** - Return to current date view
- **Set Current Date** (thumbtack icon) - Set world time to selected date (GM only). Always visible; disabled when no date is selected. Shows confirmation dialog by default (can be disabled in settings).
- **Add Note** - Create a new note on selected/current date
- **Search Notes** - Open search panel
- **View Notes** - View notes on selected date. Always visible; disabled when the selected day has no notes.
- **Settings** - Open the settings panel

Right-click the MiniCal container for a context menu with the following options:

- **Settings** - Opens the Settings panel to the MiniCal tab
- **Show/Hide to All Players** - Toggle visibility for all players (GM only)
- **Reset Position** - Reset MiniCal to default screen position
- **Lock/Unlock Position** - Toggle position locking to prevent accidental dragging
- **Open BigCal** - Opens the BigCal Application
- **Open Time Keeper** - Opens the Time Keeper application
- **Close** - Close the MiniCal

### Notes Panel

Click "View Notes" to see all notes for the selected date:

- Notes sorted by time (all-day first)
- Click a note to open in view mode
- Click edit icon to open in edit mode (if owner)

---

## Time Display

Shows current time. GM can:

- Click to toggle time flow (play/pause)
- Shift-click to lock/unlock the clock (see [HUD — Clock Lock](HUD#clock-lock))
- Hover to reveal time controls

### Time Controls (GM Only)

Revealed on hover over the time display:

| Button             | Action                                              |
| ------------------ | --------------------------------------------------- |
| Sunrise            | Advance to next sunrise                             |
| Midday             | Advance to solar noon                               |
| Custom Reverse     | Step backward by custom amount (e.g., "-5")         |
| Reverse            | Step backward by one increment                      |
| Increment selector | Set step size (scroll mouse wheel to cycle options) |
| Forward            | Step forward by one increment                       |
| Custom Forward     | Step forward by custom amount (e.g., "+30")         |
| Sunset             | Advance to next sunset                              |
| Midnight           | Advance to next midnight                            |

Custom time jump buttons display the configured jump amount directly on the button. Configure these values in **Settings > MiniCal > Custom Time Jumps**.

---

## Double-Click Behavior

Double-click anywhere in the calendar area to toggle between MiniCal and BigCal. This works on all non-interactive areas (excluding buttons, inputs, and note badges).

---

## Block Visibility

Configure which information blocks appear below the navigation row via **Settings > MiniCal**:

| Setting          | Description                                                        |
| ---------------- | ------------------------------------------------------------------ |
| Show Weather     | Display weather block. Weather Display Mode controls detail level. |
| Show Season      | Display season block. Season Display Mode controls detail level.   |
| Show Era         | Display era block. Era Display Mode controls detail level.         |
| Show Cycles      | Display cycles block. Cycles Display Mode controls detail level.   |
| Show Moon Phases | Display moon phase icons in day cells.                             |

---

## Compact Mode

MiniCal has a compact mode ("MicroCal") that dramatically reduces its footprint while remaining fully functional. Toggle via the context menu or the "Compact Mode" per-user setting.

### Layout

- Day cells render as circular cells
- Weekday headers and time controls are hidden
- Indicators display as icon-only
- The entire application becomes draggable (not just the header)

### Hover Controls

A play/pause overlay appears on hover over the title group for quick clock control.

### Compact Sidebar

The sidebar fades in smoothly with hidden separators for a minimal look.

### Compact Notes Panel

The notes panel hides the header and author, with a reduced width.

### Compact Mode Header

The "Compact Mode Header" per-user setting controls what text appears in the compact mode header. The default is "Approximate Date & Time".

---

## Settings

Configure via **Settings Panel > MiniCal** tab. See [Settings](Settings#minical) for all options.
