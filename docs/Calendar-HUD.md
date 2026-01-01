# Calendar HUD

The Calendar HUD is the main interface for viewing and controlling time in Calendaria. It displays as an animated dome widget on your screen.

## Opening the HUD

- Click the **calendar icon** in the token controls (left sidebar)
- Press **Ctrl+C** to toggle visibility
- The HUD appears automatically when you load a world (configurable)

---

## The Dome Display

The dome shows a dynamic sky that changes based on time of day:

- **Daytime** — Blue sky with sun, animated clouds
- **Dawn/Dusk** — Gradient transitions with color shifts
- **Nighttime** — Dark sky with moon and stars

The sun and moon positions reflect the actual time. Moon phase is accurate to your calendar's lunar cycle.

---

## The Info Bar

Below the dome, the bar displays:

- **Current Date** — Formatted according to your calendar
- **Current Time** — Hours and minutes
- **Era** — If configured
- **Active Events** — Icons for today's events (hover for details)
- **Weather Badge** — Current weather condition (click to regenerate)

The date and active events rotate every 30 seconds.

---

## Time Controls

### Opening the Controls Tray

Click the **clock icon** or the time display to expand the controls tray.

### Advancing Time

Use the increment buttons to advance time:

- **Minute** / **Hour** / **Day** / **Week** / **Month**
- Click the increment selector to change the step size

### Time Multiplier

Set how fast time passes during real-time mode:

- **0.25x** — Quarter speed
- **1x** — Real-time (1 second = 1 second)
- **10x** — Ten times faster

### Play/Pause

Click the **play button** to start real-time progression. Click again to pause.

---

## Positioning

### Dragging

Click and drag the HUD to move it anywhere on screen. Position is saved per-client.

### Locking Position

Right-click the HUD and select **Lock Position** to prevent accidental movement.

### Resetting Position

If the HUD goes off-screen:

1. Go to **Settings** → **Module Settings** → **Calendaria**
2. Click **Reset HUD Position**

---

## Sticky Options

Right-click the HUD to access sticky options:

- **Always Show Controls** — Keep the time controls tray open
- **Lock Position** — Prevent dragging
- **Collapse to Bar** — Minimize to just the info bar

These preferences persist across sessions.

---

## The Time Dial

Right-click the HUD (on the dome area) to open the **Time Dial**:

- Drag the pointer around the dial to change the hour
- The dial shows 24 hours with the current time highlighted
- Release to set the new time

---

## Search

Click the **search icon** in the bar to search notes:

- Type a query to search note names and content
- Click a result to open the note or navigate to its date
- Press **Escape** to clear the search

---

## Compact Calendar

For a smaller footprint, use the **Compact Calendar** instead:

1. Go to **Settings** → **Module Settings** → **Calendaria**
2. Enable **Show Compact Calendar**

The compact view shows a minimal calendar grid with date navigation.

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| Ctrl+C | Toggle HUD visibility |
| Enter/Space | Open time dial (when HUD focused) |
| Escape | Close search panel |
