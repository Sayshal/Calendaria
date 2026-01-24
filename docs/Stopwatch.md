# Stopwatch

A versatile stopwatch application for tracking elapsed time in real-time or game-time modes.

---

## Opening the Stopwatch

- Press **Alt+W** to toggle visibility
- Click the stopwatch button on the TimeKeeper

---

## Display Modes

The Stopwatch supports two timing modes:

| Mode          | Description                                             |
| ------------- | ------------------------------------------------------- |
| **Real Time** | Tracks actual elapsed time regardless of game state     |
| **Game Time** | Tracks elapsed in-game time based on world time changes |

Click the mode indicator to switch between modes.

### Real Time Mode

- Counts real seconds, minutes, and hours
- Continues running even when the game is paused
- Useful for tracking real-world session time or breaks

### Game Time Mode

- Tracks elapsed time based on Foundry's world time
- Advances when game time advances (via time controls or real-time clock)
- Pauses when game time is paused
- Useful for tracking in-game durations (spell effects, travel time, etc.)

---

## Controls

| Button          | Action                               |
| --------------- | ------------------------------------ |
| **Start/Pause** | Toggle the stopwatch running state   |
| **Reset**       | Clear elapsed time and lap history   |
| **Lap**         | Record current elapsed time as a lap |

### Keyboard Shortcuts

All stopwatch keybinds are unbound by default. See [Keybinds](Keybinds) for configuration instructions.

---

## Lap Timing

Click the **Lap** button to record the current elapsed time. Laps appear in a scrollable list below the main display.

Each lap shows:

- Lap number
- Elapsed time at that lap
- Time since previous lap (split time)

Use laps to track intervals, phases, or checkpoints during timed activities.

---

## Display Format

The elapsed time display format is configurable per mode in **Settings Panel > Stopwatch tab**:

- **Elapsed Time (Real Time)** — Format for real-time mode
- **Elapsed Time (Game Time)** — Format for game-time mode

The Display Formats section shows a live preview of how the format will render.

### Format Tokens

| Token | Description            | Example |
| ----- | ---------------------- | ------- |
| `HH`  | Hours (2-digit)        | 01      |
| `mm`  | Minutes (2-digit)      | 05      |
| `ss`  | Seconds (2-digit)      | 30      |
| `SSS` | Milliseconds (3-digit) | 250     |

**Example Formats:**

- `HH:mm:ss` → 01:05:30
- `mm:ss.SSS` → 05:30.250
- `HH:mm:ss.SSS` → 01:05:30.250

---

## Auto-Start Game Time

When enabled, the game-time stopwatch automatically starts when world time begins advancing. Configure in **Settings Panel > Stopwatch tab > Auto-start Game Time**.

This is useful for automatically tracking in-game duration when the real-time clock starts.

---

## Context Menu

Right-click on the Stopwatch face to access the context menu:

| Option                   | Description                                                                                  |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| **Lock/Unlock Position** | Toggle position locking (also available in Settings > Stopwatch tab > Sticky States section) |
| **Reset Position**       | Restore to default position (150, 150) and clear any sticky zone snapping                    |
| **Close**                | Close the Stopwatch window                                                                   |

---

## Positioning

### Dragging

Drag the stopwatch by the title bar to reposition it.

### Resizing

Drag the edges or corners to resize the stopwatch window.

### Sticky Zones

The Stopwatch supports sticky zone snapping when dragged near predefined positions. See [HUD > Sticky Zones](HUD#sticky-zones) for zone locations.

---

## State Persistence

The Stopwatch saves its state per-client:

- Current elapsed time
- Running/paused state
- Current mode (real-time vs game-time)
- Lap history
- Window position and size

State persists across page reloads within the same session.

---

## Settings

See [Settings > Stopwatch](Settings#stopwatch) for stopwatch-related settings and display format configuration.
