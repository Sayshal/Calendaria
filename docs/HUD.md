# HUD

Draggable widget showing date, time, weather, and events. Two display modes: full HUD with animated dome (or slice), or compact calendar view.

---

## Opening the HUD

- Press **Alt+C** to toggle visibility
- Opens on world load (if enabled in settings)
- Double-click the HUD bar to toggle between fullsize and compact modes

> See also: [MiniCal](MiniCal) and [Time Keeper](Time Keeper) for alternative display options.

---

## HUD Mode

Configured via Settings > HUD tab:

| Mode       | Description                                      |
| ---------- | ------------------------------------------------ |
| `fullsize` | Animated sky view with sun/moon arc and info bar |
| `compact`  | Condensed bar with slice dial (no dome)          |

Double-click the HUD bar to toggle between fullsize and compact modes. Right-click the bar for a context menu with options:

- **Settings** - Opens the HUD settings tab
- **Show/Hide to All Players** - Toggle HUD visibility for all players (GM only)
- **Reset Position** - Reset HUD to default position
- **Lock/Unlock Position** - Toggle position locking
- **Switch to Compact/Fullsize** - Toggle between display modes
- **Close** - Close the HUD

---

## Dial Styles

Two dial styles for the sun/moon display:

| Style   | Description                                                       |
| ------- | ----------------------------------------------------------------- |
| `dome`  | Semi-circular dome above the bar with sun/moon arc                |
| `slice` | Horizontal strip in the bar with sun/moon traveling left-to-right |

Configure via Settings > HUD tab > Dial Style.

### Combat Behavior

"Combat Behavior" per-user dropdown in Settings > HUD tab. Uses the same shared combat behavior system as all other Calendaria widgets (BigCal, MiniCal, Chronicle, Stopwatch, Sun Dial, Time Keeper).

Two additional options beyond the standard set:

| Option               | Description                                                |
| -------------------- | ---------------------------------------------------------- |
| None                 | No change during combat                                    |
| Compact on Combat    | Switch to compact/slice when combat starts                 |
| Compact on Encounter | Switch to compact/slice when a combat encounter is created |
| Hide on Combat       | Hide the HUD entirely when combat starts                   |
| Hide on Encounter    | Hide the HUD entirely when a combat encounter is created   |

"On Encounter" modes trigger when a combat encounter is created in the tracker, before the "Start Combat" button is pressed. "On Combat" modes trigger only when combat actively starts.

Other widgets share the three common options: None, Hide on Combat Start, and Hide on Encounter Creation. Widgets automatically restore when combat ends. See [Settings](Settings#combat-behavior) for per-widget configuration.

---

## Full HUD

### Dome Display

Draws sky, sun, moon, stars, and weather particles in a single animated display.

#### Sky and Celestial Bodies

Sky shifts through 14 color keyframes over the day, crossfading smoothly between them. Sun arcs across the dome during daylight with a subtle corona pulse, while the moon takes over at night. Phase shadow is drawn with bezier curve terminators for accurate crescent shapes. Stars twinkle in the background and fade around twilight.

#### Multi-Moon Rendering

When **Show All Moons** is enabled (Settings > HUD tab), secondary moons trail behind the primary moon with scaled size. Each moon displays its correct phase and color glow based on calendar configuration.

#### Weather Particle Overlay

Weather conditions render as particle effects directly in the dome. Each weather preset maps to a `hudEffect` with unique particle behavior. See [Weather Presets: HUD Effects](Weather-Presets#hud-effects) for the full list.

Wind speed and direction influence particle movement. Sky gradient colors can override per-weather-effect (e.g., greenish sky for tornado, orange for sandstorm).

#### Weather FX Mode

Per-client dropdown (Settings > HUD tab) for weather particle effects in the HUD dome and Sun Dial:

| Mode    | Description                                             |
| ------- | ------------------------------------------------------- |
| Full    | All weather particle effects rendered at full density   |
| Reduced | Lower particle density for improved performance         |
| Off     | No weather particle effects (sky, sun, moon unaffected) |

Useful for players on low-end hardware or who prefer a cleaner display.

#### Performance Mode

Particle rendering scales with Foundry's core performance mode:

| Mode   | Description                     |
| ------ | ------------------------------- |
| Low    | Reduced particle count          |
| Medium | Standard particle count         |
| High   | Full particle count and effects |

#### Dome Below Bar

When enabled (Settings > HUD tab), the dome renders below the info bar instead of above it.

**GM Only**: Click the dome to open the Time Dial for quick time adjustments.

**Players**: The dome is view-only and cannot be clicked.

### Non-Standard Time Support

Supports calendars with non-standard time units:

- Time dial and hour markers automatically scale to `hoursPerDay`
- Sunrise/sunset positions calculated from calendar's daylight settings
- All time displays respect `minutesPerHour` and `secondsPerMinute`

### Time Dial (GM Only)

Click the dome or slice to open the Time Dial overlay:

- Drag the sun/moon around the arc to set time visually
- Time updates in real-time as you drag
- Release to confirm the new time
- Click outside or press Escape to cancel

### Slice Display

Alternative to the dome. A horizontal sky strip:

- Sun/moon travels left-to-right across the bar
- Time displayed over the sky gradient
- Used in compact mode automatically

### Info Bar

Bar contents (left to right):

- **Search button** - Opens note search panel
- **Add Note button** - Creates a new note at the current game time
- **Events** - Icons for today's notes (up to 5 displayed); click to open note
- **Date** - Click to open Set Date dialog (GM only)
- **Time.** Current time with play/pause button (GM only); shift-click to lock/unlock the clock
- **Weather** - Current weather; click to open weather picker (GM only). Shows "click to generate" prompt when no weather set. When [Intraday Weather](Weather-System#intraday-weather) is enabled, hovering the weather block shows a tooltip with per-period weather breakdown (Night, Morning, Afternoon, Evening), highlighting the active period.
- **Season** - Current season name and icon
- **Era** - Current era indicator (toggle via Show Era setting)
- **Cycle** - Current cycle value (toggle via Show Cycles setting)
- **Open Calendar** - Opens BigCal or MiniCal based on Calendar Button setting (hidden if user lacks view permission)
- **Settings** - Opens the settings panel

### Block Visibility

Each indicator block (weather, season, era/cycle) can be hidden via Settings > HUD tab. Hiding blocks shrinks HUD width automatically.

**Weather Display Modes:**

- Full (icon + label + temperature)
- Icon + Temperature
- Icon Only
- Temperature Only

**Season Display Modes:**

- Icon + Text
- Icon Only
- Text Only

Settings are user-scoped - each player can customize their view.

#### Event Border Glow

When events exist on the current day, the HUD shows a glowing border effect. "Event Border Glow" toggle (Settings > HUD tab, display fieldset) controls this. Disabling it removes the glow but keeps event icons, tooltips, and note actions. Enabled by default.

### Time Controls Tray (GM Only)

Hover over the bar to reveal time controls:

| Button             | Action                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Sunrise            | Advance to next sunrise                                                                                                                |
| Midday             | Advance to solar noon                                                                                                                  |
| Custom Dec 2       | Jump backward by custom amount (if configured)                                                                                         |
| Custom Dec 1       | Jump backward by custom amount (if configured)                                                                                         |
| Reverse            | Step backward by one increment                                                                                                         |
| Increment dropdown | Set step size (second, round, minute, hour, day, week, month, season, year). Scroll mouse wheel over dropdown to cycle through options |
| Forward            | Step forward by one increment                                                                                                          |
| Custom Inc 1       | Jump forward by custom amount (if configured)                                                                                          |
| Custom Inc 2       | Jump forward by custom amount (if configured)                                                                                          |
| Sunset             | Advance to next sunset                                                                                                                 |
| Midnight           | Advance to next midnight                                                                                                               |

Configure tray to open upward or downward via Settings > HUD tab > Tray Open Direction.

> [!NOTE]
> Real-time clock speed is configured in Settings > Time tab, not on the HUD.

### Custom Time Jumps

Configure custom jump buttons (e.g., skip 8 hours) via Settings > HUD tab > Custom Time Jumps. Each increment type can have its own jump values for four buttons (two decrement, two increment). Leave blank to hide the button.

---

### Clock Lock

Shift-click the play/pause button (on the HUD, MiniCal, or Time Keeper) to lock the clock. When locked:

- All time advancement is blocked (manual toggle, real-time sync, combat time, rest advancement)
- The play/pause icon changes to a lock icon with updated tooltip
- Lock state persists across page refresh (stored as a world setting)

Shift-click again to unlock. Requires time-change permission.

---

## Clock Sync

Real-time clock syncs with game state:

- **Pause Sync**: Clock stops when game is paused, resumes at 1:1 when unpaused
- **Combat Sync**: Clock stops during combat (time advances per-turn via system)

When sync is enabled and blocked (paused or in combat), manually starting the clock shows a warning notification.

> [!TIP]
> Hover over the HUD to reveal a pause button that stops the real-time clock without disabling the feature.

Configure sync behavior in Settings > Time tab.

---

## Search

Both HUD modes include a search panel:

- Type at least 2 characters to search note names and category names
- Use `category:` prefix to filter by category (e.g., `category:quest`)
- Click a result to open the note
- Press **Escape** to close

---

## Positioning

### Dragging

- **Full HUD**: Drag the info bar
- **MiniCal**: Drag the top row (month/year header)

Position is saved for each user.

### Sticky Zones

Drag the HUD near predefined zones for automatic snapping:

| Zone             | Location                    |
| ---------------- | --------------------------- |
| `top-center`     | Centered at top of viewport |
| `above-hotbar`   | Above the macro hotbar      |
| `above-players`  | Above the players list      |
| `below-controls` | Below the scene controls    |

When dragging into a zone, the HUD wobbles to indicate snapping will occur. Release to snap into position.

**Mode Switching**: Position is preserved when switching between display modes (dome/slice/compact).

Toggle sticky zones via Settings > HUD tab > Enable Sticky Zones.

### Dome Visibility (Full HUD)

Dome fades when approaching the top of the viewport and hides entirely if there's insufficient space. Disable via Settings > HUD tab > Dome Auto-Hide.

### Locking Position

Enable "Lock Position" in settings to prevent dragging. Position can also be locked/unlocked via right-click context menu. Snapping to a sticky zone also locks position.

### Resetting Position

Settings > HUD tab (or MiniCal tab) > Reset Position

---

## Auto-Fade

When enabled, the HUD fades to a configurable opacity after the mouse leaves:

- Fade triggers after a brief delay when the mouse exits
- Hovering restores full opacity immediately
- Idle opacity configurable from 0% to 100%

Configure via Settings > HUD tab.

---

## Keyboard Shortcuts

| Shortcut | Action                |
| -------- | --------------------- |
| Alt+C    | Toggle HUD visibility |
| Escape   | Close search panel    |

See [Keybinds](Keybinds) for all available keyboard shortcuts and configuration instructions.

---

## Player Permissions

Player HUD access:

- **Can**: View date/time/weather, search notes, view non-GM notes, create notes
- **Cannot**: Open Set Date dialog, change time, change weather, access time controls

Dome and time-related controls are non-interactive for players.

---

## Per-Scene Visibility

GMs can hide the HUD from players on individual scenes. When a player navigates to a scene with "Hide HUD for Players" enabled, their HUD closes. Navigating to a non-hidden scene restores the HUD if they have "Show HUD on load" enabled.

Configure via **Scene Configuration > Calendaria tab > Hide HUD for Players**.
