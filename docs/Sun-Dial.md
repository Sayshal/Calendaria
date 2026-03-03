# Sun Dial

A circular floating clock that displays an animated sky and lets GMs drag the sun to set the time of day.

---

## Opening the Sun Dial

- Toolbar button (if enabled in Settings > Advanced > Toolbar Apps)
- Journal footer button (if enabled)
- Settings Panel > Calendar tab
- Automatically on world load (if "Show Sun Dial on Load" is enabled)
- Use the API: `CALENDARIA.api.showSunDial()`

---

## Display

The Sun Dial shows an animated sky inside a circular frame with hour markers around the edge. The sky reflects the current time of day — blue sky and sun during the day, stars at night.

A draggable **sun handle** sits on the dial edge at the current hour. Drag it clockwise or counterclockwise to change the time. The time updates as you drag and is applied when you release.

### Time Input

A time input below the dial shows the current time. Edit it directly to set a specific time.

### Resize

Drag the bottom-right handle to resize the Sun Dial.

---

## Hover Controls

Hovering over the Sun Dial reveals control buttons:

| Button      | Action                                     |
| ----------- | ------------------------------------------ |
| Play/Pause  | Toggle the real-time clock                 |
| Create Note | Create a note at the current date and time |
| Settings    | Open the Settings Panel                    |

---

## Crank Mode

Crank Mode allows fast multi-day time changes by dragging the sun handle past midnight.

- Each time you drag past midnight, a day is added (or subtracted when dragging counterclockwise)
- A **day-offset indicator** above the time input shows the total (e.g., "+2 days")
- When you release, the accumulated days and final time are applied together
- You can right click while still dragging to cancel the adjustment
- Enable via the context menu or Settings Panel > Sun Dial tab

---

## Context Menu

Right-click the Sun Dial to access:

| Option                    | Description                                     |
| ------------------------- | ----------------------------------------------- |
| Settings                  | Opens the Settings Panel to the Sun Dial tab    |
| Show/Hide to All Players  | Toggle visibility for all players (GM only)     |
| Enable/Disable Crank Mode | Toggle Crank Mode for this user                 |
| Lock/Unlock Position      | Toggle position locking                         |
| Reset Position            | Reset to default position and clear sticky zone |
| Close                     | Close the Sun Dial                              |

---

## Positioning

### Dragging

Drag the Sun Dial by its frame to reposition it.

### Sticky Zones

The Sun Dial snaps to predefined screen positions when dragged nearby. See [HUD > Sticky Zones](HUD#sticky-zones) for zone locations.

---

## Settings

Configure via **Settings Panel > Sun Dial** tab. See [Settings](Settings#sun-dial) for all options.

The Sun Dial requires the `viewSunDial` permission (default: Trusted Player and above). See [Permissions](Permissions) for details.
