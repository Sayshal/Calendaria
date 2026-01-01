# Settings

Calendaria settings are found in **Settings** → **Module Settings** → **Calendaria**.

## Calendar Settings

### Active Calendar

Select which calendar to use. Changing this reloads the world.

### Primary GM

Designate which GM controls time advancement in multi-GM games.

### Open Calendar Editor

Button to open the calendar editor for creating or modifying calendars.

---

## Display Settings

### Show Calendar HUD

Toggle the main calendar HUD visibility on world load.

### Show Compact Calendar

Toggle the compact calendar widget on world load.

### Show Moon Phases

Display moon phase information in the calendar interface.

---

## Time Settings

### Advance Time on Rest

Automatically advance world time when players take rests.

### Advance Time on Combat

Advance time based on combat rounds (using secondsPerRound setting).

---

## Darkness Settings

### Sync Scene Darkness

Automatically adjust scene darkness based on time of day. Can be overridden per-scene.

---

## Weather Settings

### Temperature Unit

Choose between Celsius and Fahrenheit for temperature display.

---

## Chat Settings

### Chat Timestamp Mode

How to display in-game time on chat messages:

| Mode | Description |
|------|-------------|
| Disabled | No timestamps |
| Replace | Replace real-world time with in-game time |
| Augment | Show both real and in-game time |

### Show Time in Timestamps

Include hours/minutes in chat timestamps (not just date).

---

## Position Settings

### Reset HUD Position

Button to reset the calendar HUD to its default centered position.

### Lock HUD Position

Prevent accidentally dragging the HUD.

---

## Developer Settings

### Logging Level

Control how much debug information appears in the console:

| Level | Description |
|-------|-------------|
| None | No logging |
| Error | Only errors |
| Warning | Errors and warnings |
| Info | General information |
| Debug | Verbose debugging |

### Dev Mode

Enable developer features like calendar journal deletion.

---

## Per-Scene Settings

Some settings can be overridden per-scene in **Scene Configuration** → **Ambiance**:

### Darkness Sync Override

| Option | Description |
|--------|-------------|
| Use Global | Follow the module setting |
| Enabled | Always sync this scene |
| Disabled | Never sync this scene |

---

## Macro Triggers

Configure macros to run at specific times or events:

- **Dawn** — Run at sunrise
- **Dusk** — Run at sunset
- **Midday** — Run at noon
- **Midnight** — Run at midnight
- **New Day** — Run when the day changes
- **Season Change** — Run when season changes (can specify which season)
- **Moon Phase** — Run on specific moon phases

Access macro trigger configuration from the settings menu.
