# Time Keeper

A minimal time-only display for GMs who want a smaller footprint.

---

## Features

- Fixed compact width
- Controls hidden on idle, revealed on hover
- Play/pause button as hover overlay on time display (GM only); shift-click to lock/unlock the clock
- Stop Watch button to open the Stop Watch application
- Right-click for context menu (8 options including Settings, visibility toggle, position controls, and more)
- Four configurable time jump buttons per increment type
- Date display can be hidden by setting the Time Keeper date format to "off"
- Draggable via the time display area

See [Stop Watch](Stop Watch) for stopwatch feature documentation.

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

Default jump amounts are -5, -1, +1, +5 per increment. Configure via Settings > Time Keeper tab.

---

## Settings

Configure via **Settings Panel > Time Keeper** tab. See [Settings](Settings#timekeeper) for all options.

---

## Context Menu

Right-click the Time Keeper to access:

| Option                   | Description                                                                  |
| ------------------------ | ---------------------------------------------------------------------------- |
| Settings                 | Opens the Settings Panel to the Time Keeper tab                               |
| Show/Hide to All Players | Toggle visibility for all players (GM only)                                  |
| Reset Position           | Reset to default position (120, 120) and clear sticky zone snapping          |
| Lock/Unlock Position     | Toggle whether Time Keeper can be dragged; displays notification when toggled |
| Open Stop Watch           | Open the Stop Watch application                                               |
| Open MiniCal             | Open the MiniCal application                                                 |
| Close                    | Close the Time Keeper                                                         |

---

## Position Controls

- **Reset Position**: Returns Time Keeper to default coordinates (120, 120) and clears any sticky zone snapping
- **Lock/Unlock Position**: Prevents dragging when locked; available via context menu or Settings > Time Keeper tab; shows notification when toggling
