# TimeKeeper

A minimal time-only display for GMs who want a smaller footprint.

---

## Features

- Fixed compact width
- Controls hidden on idle, revealed on hover
- Play/pause button as hover overlay on time display (GM only)
- Stopwatch button to open the Stopwatch application
- Right-click for context menu (8 options including Settings, visibility toggle, position controls, and more)
- Four configurable time jump buttons per increment type
- Date display can be hidden by setting the TimeKeeper date format to "off"
- Draggable via the time display area

See [Stopwatch](Stopwatch) for stopwatch feature documentation.

---

## Controls

Hover to reveal (GM only):

| Button             | Action                                        |
| ------------------ | --------------------------------------------- |
| Fast Reverse (<<)  | Jump backward by dec2 amount                  |
| Reverse (<)        | Jump backward by dec1 amount                  |
| Increment selector | Set step size (scroll wheel to cycle options) |
| Forward (>)        | Jump forward by inc1 amount                   |
| Fast Forward (>>)  | Jump forward by inc2 amount                   |

Default jump amounts are -5, -1, +1, +5 per increment. Configure via Settings > TimeKeeper tab.

---

## Settings

Configure via **Settings Panel > TimeKeeper** tab. See [Settings](Settings#timekeeper) for all options.

---

## Context Menu

Right-click the TimeKeeper to access:

| Option                   | Description                                                                  |
| ------------------------ | ---------------------------------------------------------------------------- |
| Settings                 | Opens the Settings Panel to the TimeKeeper tab                               |
| Show/Hide to All Players | Toggle visibility for all players (GM only)                                  |
| Reset Position           | Reset to default position (120, 120) and clear sticky zone snapping          |
| Lock/Unlock Position     | Toggle whether TimeKeeper can be dragged; displays notification when toggled |
| Open Stopwatch           | Open the Stopwatch application                                               |
| Open MiniCal             | Open the MiniCal application                                                 |
| Close                    | Close the TimeKeeper                                                         |

---

## Position Controls

- **Reset Position**: Returns TimeKeeper to default coordinates (120, 120) and clears any sticky zone snapping
- **Lock/Unlock Position**: Prevents dragging when locked; available via context menu or Settings > TimeKeeper tab; shows notification when toggling
