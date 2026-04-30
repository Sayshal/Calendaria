# MiniCal

A compact month-view calendar widget with integrated time controls.

---

## Display

Monthly grid with the current date highlighted. For monthless calendars (like Traveller), shows a 3-week view instead.

### Indicators

Below the navigation row, contextual indicators show:

- **Weather** - Current weather with icon, label, and temperature. GMs click to open weather picker. Shows "click to generate" when no weather is set.
- **Season** - Current season with icon and name
- **Era** - Current era indicator (if calendar has eras)
- **Cycle** - Current cycle values (if calendar has cycles configured)

### Navigation

- **Arrow buttons** - Previous/next month (or week for monthless calendars)
- **Today button** - Return to current date
- Click a day to select it
- Click a grayed-out day to navigate to that month

### Monthless Calendars

For calendars without months (like Traveller), shows a 3-week view:

- Previous week, current week, and next week
- Navigation moves by week instead of month
- Header displays "Week X, Year"

### Day Cells

Each day cell may show:

- **Note count badge.** Colored badge showing the number of notes on that day. Badge background uses the first note's category color.
- Festival highlight
- Moon phase icon
- Weather icon
- Today indicator
- Selected indicator

### Day Tooltips

Hovering over a day cell shows:

- Full date (Month Day, Year with era)
- Festival name and description (if applicable)
- Current season name
- Sunrise and sunset times
- Weather summary (icon, name, temperature)

---

## Sidebar

Four button groups separated by visual dividers: navigation, date management, notes, and system.

Appears on hover over the calendar area (or always visible when sticky):

- **Close** - Close the MiniCal
- **Open BigCal** - Opens the BigCal Application
- **Today** - Return to current date view
- **Set Current Date** (thumbtack icon) - Set world time to selected date (GM only). Always visible; disabled when no date is selected. Shows confirmation dialog by default (can be disabled in settings).
- **Add Note** - Create a new note on selected/current date
- **Search Notes** - Open search panel
- **View Notes** - View notes on selected date. Always visible; disabled when the selected day has no notes.
- **Settings** - Open the settings panel

Right-click the MiniCal container for a context menu:

- **Settings** - Opens the Settings panel to the MiniCal tab
- **Show/Hide to All Players** - Toggle visibility for all players (GM only)
- **Reset Position** - Reset MiniCal to default screen position
- **Lock/Unlock Position** - Toggle position locking to prevent accidental dragging
- **Open BigCal** - Opens the BigCal Application
- **Open Time Keeper** - Opens the Time Keeper application
- **Close** - Close the MiniCal

### Notes Panel

Click "View Notes" to see all notes for the selected date:

- Notes sorted by time. Festivals appear first, then remaining notes sorted by display priority
- Click a note to open in view mode
- Click edit icon to open in edit mode (if owner)

#### Visibility Indicators

Visibility status shown as icon overlays:

- **Eye-slash** icon for hidden notes
- **Lock** icon for secret notes
- Visible notes show no additional indicator

#### Festival Notes

Festival notes have a left border accent in the notes panel, colored by the note's category.

#### Occurrence Badges

Each recurring note shows an occurrence info badge indicating its repeat type (daily, weekly, yearly, etc.).

#### Filters

Preset filter dropdown for narrowing displayed notes:

- **Festivals.** Show only festival notes
- Additional filter presets as configured

When filters exclude all results, a "No matching notes" empty state appears. Filters auto-clear when the notes panel closes.

#### Tooltips

Hovering over a note panel item shows a rich HTML tooltip with the note's name, time, visibility, presets, condition summary, and description preview.

---

## Time Display

Shows current time. GMs:

- Click to toggle time flow (play/pause)
- Shift-click to lock/unlock the clock (see [HUD: Clock Lock](HUD#clock-lock))
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

Custom time jump buttons show the configured jump amount on the button. Configure in **Settings > MiniCal > Custom Time Jumps**.

---

## Double-Click Behavior

Double-click anywhere in the calendar area to toggle between MiniCal and BigCal. Works on all non-interactive areas (excludes buttons, inputs, and note badges).

---

## Block Visibility

Configure which information blocks appear below the navigation row via **Settings > MiniCal**:

| Setting          | Description                                                       |
| ---------------- | ----------------------------------------------------------------- |
| Show Weather     | Display weather block. Weather Display Mode controls detail level |
| Show Season      | Display season block. Season Display Mode controls detail level   |
| Show Era         | Display era block. Era Display Mode controls detail level         |
| Show Cycles      | Display cycles block. Cycles Display Mode controls detail level   |
| Show Moon Phases | Display moon phase icons in day cells                             |

---

## Compact Mode

Compact mode ("MicroCal") reduces the MiniCal's footprint while staying functional. Toggle via the context menu or the "Compact Mode" per-user setting.

### Layout

- Day cells render as circular cells
- Weekday headers and time controls are hidden
- Indicators display as icon-only
- Entire application becomes draggable (not just the header)

### Hover Controls

Play/pause overlay appears on hover over the title group for quick clock control.

### Compact Sidebar

Sidebar fades in smoothly with hidden separators for a minimal look.

### Compact Notes Panel

Notes panel hides the header and author, with reduced width.

### Compact Mode Header

"Compact Mode Header" per-user setting controls what text appears. Default: "Approximate Date & Time".
