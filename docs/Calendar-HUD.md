# Calendar HUD

The Calendar HUD (`CalendariaHUD`) displays date, time, weather, and events in a draggable widget. Two display modes are available: the full HUD with an animated dome, or a compact calendar view.

---

## Opening the HUD

- Press **Alt+C** to toggle visibility
- Automatically opens on world load (if enabled in settings)

---

## HUD Mode

Configured via Settings > HUD tab:

| Mode | Description |
|------|-------------|
| `full` | Animated dome with sky gradient, sun/moon arc, and info bar |
| `compact` | Mini month grid with time controls |

---

## Full HUD

### Dome Display

The dome shows a dynamic sky that changes based on time of day:

- Sky gradient interpolates between 15 keyframes (0:00-24:00)
- Sun visible between hours 6-18; moon visible outside this range
- Stars fade in/out during twilight (5:30-7:00 and 17:30-19:00)
- Clouds visible during daylight (7:00-18:00)

Click the dome or press **Enter/Space** (when focused) to open the Time Dial.

### Time Dial

A circular dial for setting the time:

- Drag the handle around the 24-hour dial
- Type directly in the time input field (accepts formats like "14:30", "2:30pm")
- The dial shows sun/moon position and sky gradient preview
- Click outside the dial to close

### Info Bar

The bar displays (left to right):

- **Search button** - Opens note search panel
- **Add Note button** - Creates a new note for today
- **Date** - Click to open date picker (GM only)
- **Events** - Icons for today's notes (up to 5); click to open note
- **Time** - Current time with play/pause button (GM only)
- **Weather** - Current weather; click to open weather picker (GM only)
- **Season** - Current season name and icon
- **Era** - Current era indicator
- **Cycle** - Current cycle value (if configured)
- **Open Calendar** - Opens the full calendar application
- **Settings** - Opens the settings panel

### Time Controls Tray (GM Only)

Hover over the bar or enable sticky tray to reveal:

| Button | Action |
|--------|--------|
| Sunrise | Advance to sunrise |
| Midday | Advance to solar noon |
| Reverse | Step backward by increment |
| Multiplier dropdown | Set time multiplier (0.25x to 10x) |
| Increment dropdown | Set step size (second, round, minute, hour, day, week, month, season, year) |
| Forward | Step forward by increment |
| Sunset | Advance to sunset |
| Midnight | Advance to midnight (next day) |

---

## MiniCalendar

A mini month view with integrated time controls.

### Navigation

- **Arrow buttons** - Previous/next month
- **Today button** - Return to current date
- Click a day to select it
- Click a grayed-out day to navigate to that month
- Double-click a day to set it as current date (GM) or view notes

### Day Cells

Each day cell may show:

- Note count badge (if notes exist)
- Festival highlight
- Moon phase icon
- Today indicator
- Selected indicator

### Sidebar

Appears on hover (or sticky):

- Close
- Open Full Calendar
- Pin Controls (opens sticky options menu)
- Today
- Set Current Date (when a date is selected)
- Add Note
- Search Notes
- View Notes (when notes exist on selected date)
- Settings

### Notes Panel

Click "View Notes" to see all notes for the selected date:

- Notes sorted by time (all-day first)
- Click a note to open in view mode
- Click edit icon to open in edit mode (if owner)

### Time Display

Shows current time. GM can:

- Click to toggle time flow (play/pause)
- Hover to reveal time controls

### Time Controls (GM Only)

Revealed on hover:

- Sunrise, Midday shortcuts
- Reverse 5x, Reverse
- Increment selector
- Forward, Forward 5x
- Sunset, Midnight shortcuts

---

## Search

Both HUD modes include a search panel:

- Type at least 2 characters to search note names and content
- Click a result to open the note
- Press **Escape** to close

---

## Positioning

### Dragging

- **Full HUD**: Drag the info bar
- **MiniCalendar**: Drag the top row (month/year header)

Position is saved per-client.

### Dome Visibility (Full HUD)

The dome automatically fades when approaching the top of the viewport and hides entirely if insufficient space.

### Locking Position

Enable "Lock Position" in settings or via the pin button context menu.

### Resetting Position

Settings > HUD tab (or MiniCalendar tab) > Reset Position

---

## Sticky Options

Access via the pin button. Options persist across sessions.

### Full HUD

| Option | Effect |
|--------|--------|
| Sticky Tray | Keep time controls tray visible |
| Lock Position | Prevent dragging |

### MiniCalendar

| Option | Effect |
|--------|--------|
| Sticky Time Controls | Keep time controls visible |
| Sticky Sidebar | Keep sidebar visible |
| Lock Position | Prevent dragging |

---

## Settings

### HUD Tab

| Setting | Description |
|---------|-------------|
| Show Calendar HUD | Enable/disable HUD on world load |
| HUD Mode | `full` or `compact` |
| Sticky Tray | Keep tray open (Full HUD) |
| Lock Position | Prevent dragging |
| Reset Position | Reset to default position |

### MiniCalendar Tab

| Setting | Description |
|---------|-------------|
| Show MiniCalendar | Enable/disable on world load |
| Controls Delay | Seconds before controls auto-hide (1-10s) |
| Sticky Time Controls | Keep time controls visible |
| Sticky Sidebar | Keep sidebar visible |
| Lock Position | Prevent dragging |
| Reset Position | Reset to default position |

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Alt+C | Toggle HUD visibility |
| Enter/Space | Open time dial (when dome focused) |
| Escape | Close search panel |
