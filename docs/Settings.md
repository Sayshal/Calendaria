# Settings

Access via **Settings > Module Settings > Calendaria > Calendaria Settings**.

Organized into tabs. GM-only tabs are marked below.

![Settings Navigation](https://github.com/Sayshal/Calendaria/blob/main/.github/assets/settings-navigation.png)

---

## Searching Settings

Search input at the top of the sidebar for quick access to any setting.

- Type 2+ characters to see matching results
- Results match setting labels, hints, and section headings
- Click a result to navigate (auto-switches tab, scrolls, highlights target)
- Press Escape or click outside to dismiss

---

## Per-Section Reset Buttons

Each section has a reset button in its fieldset legend. Clicking shows a confirmation dialog listing affected settings before resetting to defaults.

---

## Calendar (GM Only)

### Active Calendar

Select which calendar system to use. Changing this requires a world reload.

- Default: `gregorian`

On PF2E and SF2E worlds, the picker tags calendars lacking a `metadata.luxonSync.theme` with a "likely incompatible" suffix and shows a warning banner. The active calendar's date theme syncs to the system World Clock when compatible; when not, the in-system Show Clock button is hidden.

### Open Calendar Editor

Launch the Calendar Editor for creating/modifying calendars.

### Import Calendar

Open the calendar importer for Simple Calendar, Fantasy Calendar, and other formats.

### Set Date & Time

Opens a dialog to set the world date and time directly. GM only.

### Open/Close Buttons

Context-specific buttons to open or close the HUD, MiniCal, and Time Keeper applications.

> [!NOTE]
> Calendar tab changes save automatically. A "Changes saved automatically" indicator confirms this.

---

## Permissions (GM Only)

Configure which user roles can access Calendaria features.

### Available Permissions

| Permission                | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| **View BigCal**           | Can see the BigCal                                     |
| **View MiniCal**          | Can see the MiniCal widget                             |
| **View HUD**              | Can see the HUD                                        |
| **View Time Keeper**      | Can see the Time Keeper                                |
| **View Sun Dial**         | Can see the Sun Dial                                   |
| **View Chronicle**        | Can see the Chronicle                                  |
| **View Stopwatch**        | Can see the Stop Watch                                 |
| **Manage Notes**          | Can create own calendar notes                          |
| **Delete Notes**          | Can delete own calendar notes                          |
| **Change Date/Time**      | Can modify the world date and time                     |
| **Change Weather**        | Can set weather conditions                             |
| **View Weather Forecast** | Can view weather forecasts and day-cell forecast icons |
| **Change Calendar**       | Can switch the active calendar                         |
| **Edit Calendars**        | Can access the Calendar Editor                         |

> [!TIP]
> All widgets check view permissions before rendering. Players without permission see nothing. When a GM clicks "Show to All" and a permission mismatch exists, a notification lists the blocked users.

See [Permissions](Permissions) for detailed documentation.

---

## Notes (GM Only)

### Manage Presets

Opens the [Note Preset Editor](Note-Preset-Editor) for creating, editing, and deleting note presets.

### Re-sync Festival Notes

Regenerates festival journal notes from the current calendar's festival definitions. Creates missing festival notes or restores accidentally deleted ones. Existing notes are not duplicated.

### Default Note Settings

#### Note Open Mode

Controls how existing notes open by default when clicked.

- Options: `Default`, `Edit`, `View`
- Default: `Default`

When set to Edit or View, notes always open in that mode. New notes always open in Edit mode regardless of this setting.

---

## Time (GM Only)

### Advance Time on Rest

Advance world time when players take short/long rests.

- Default: `false`

### Real-Time Clock Speed

Configure how fast the in-game clock advances in real-time mode.

- **Multiplier**: How many units pass per real second
- **Unit**: What time unit advances (second, round, minute, hour, day, week, month, season, year)
- Example: "10 minutes per second" means 1 real second = 10 in-game minutes
- Default: `1 second per second`

Setting the multiplier to **0** disables automatic time advancement. A lock icon with "Clock Disabled" tooltip appears on all play/pause buttons. Manual forward/reverse time jumps and rest-based advancement still work.

> [!TIP]
> Hover over the HUD and press the pause button to stop real-time clock advancement without disabling the feature.

### Update Interval

How frequently the time system processes updates (in seconds).

- Range: `1` to `120`
- Default: `6`

### Rest Advance Mode

How long rests advance time.

- **Automatic** (default): Advance by the duration the active system reports. PF1E uses the rest dialog hours, dnd5e uses the rest variant duration, PF2E uses 8 hours. If the system reports no duration, time does not advance.
- **8 AM**: Skip to 8 AM the next day.
- **Sunrise**: Skip to the zone's sunrise hour, falling back to 8 AM if not configured.
- **Custom**: Advance a fixed number of hours set via **Rest Hours**.

### Rest Hours

Number of hours to advance when Rest Advance Mode is set to **Custom**. Set to 0 to suppress time advancement entirely while still firing the rest hook.

- Minimum: `0`
- Default: `8`

### Advance Bastion Orders (dnd5e only)

Automatically advance dnd5e bastion facility orders as world time passes. When enough days elapse since the last advance (using the duration configured in the dnd5e **Bastion Configuration** menu, default 7), every player character's active facility orders are ticked forward. Large time jumps (e.g. advancing 30 days at once) collapse into a single advance covering the full span.

The dnd5e **Advance Bastion Turn** button is also patched while this setting is on: clicking it now advances the world clock by one turn's duration (with a confirmation prompt) instead of only ticking progress.

- Only visible in dnd5e worlds
- Requires **Bastion Configuration → Enabled** on the dnd5e side
- Default: `true`
- Automatic advances run on the Primary GM only
- Respects **Clock Locked**. Locked clocks block both automatic and button-triggered advances

### Sync with Game Pause

Clock automatically stops when the game is paused. When enabled, the clock also pauses during active combat.

- Default: `false`

> [!NOTE]
> When sync is enabled and blocked (paused or in combat), manually starting the clock shows a warning notification.

### Run Clock During Combat

When enabled, the real-time clock continues running during active combat. Foundry's per-round 6-second time delta is blocked to prevent double-advancement.

- Default: `false`

---

## Weather (GM Only)

### Weather Generation

#### Auto-Generate Weather

Generate weather on day change based on climate zone and season configuration.

- Default: `true`

#### Weather Inertia

Controls how strongly the current weather influences the next day's generation. Higher values produce smoother, more realistic transitions.

- Range: `0` to `1`
- Default: `0.3`

#### Weather History Days

Maximum number of days of weather history to retain.

- Range: `0` to `3650`
- Default: `365`

#### Enable Weather FX

Global toggle for FXMaster particle effects and weather sounds. When disabled, stops all FXMaster weather effects and ambient sounds. Per-scene flags still override independently.

- Default: `true`

#### Sound Effects

Enable ambient weather sound loops tied to weather presets.

- Default: `false`

#### Sound Volume

Controls weather ambient sound volume.

- Range: `0` to `100` (percentage)
- Default: `100`

#### Intraday Weather

4-period intraday weather system (Night, Morning, Afternoon, Evening). Each time-of-day period can have different weather, with transitions at sunrise, midday, sunset, and midnight.

- Default: `false`

> [!WARNING]
> Enabling this setting triggers an irreversible regeneration of all current weather and forecast data.

#### Period Carry-Over Chance

Controls how often weather persists unchanged between intraday periods. Higher values mean weather is more likely to stay the same across period transitions.

- Range: `0` to `100` (percentage)
- Default: `50`

> [!NOTE]
> Only visible when Intraday Weather is enabled.

#### Force Downward Weather

Clamps FXMaster weather particle angles to ±45° from vertical so weather always falls from above. Useful for side-view scenes where diagonal particles look unnatural.

- Default: `false`

#### Regenerate All Weather

Clears and rebuilds weather forecasts for all climate zones. Confirmation dialog shown before proceeding.

### Forecast

#### Forecast Accuracy

How accurately forecasts predict future weather for non-GM users. GMs always see the true forecast.

- Range: `0` to `100`
- Default: `70`

#### Forecast Days

Number of days to pre-generate in the forecast plan.

- Range: `1` to `30`
- Default: `7`

#### GM Override Affects Forecast

When enabled, manually setting weather via the Weather Picker clears and regenerates the forecast plan for that zone.

- Default: `true`

### FXMaster Integration

> [!NOTE]
> These settings only appear when [FXMaster](https://foundryvtt.com/packages/fxmaster) is installed.

#### Top-Down Mode

Render FXMaster weather effects from a top-down perspective.

- Default: `false`

#### Below Tokens

Render FXMaster weather effects below the token layer.

- Default: `false`

### Units

#### Temperature Unit

Choose temperature display format.

- Options: `Celsius`, `Fahrenheit`
- Default: `Celsius`

#### Show Both Temperature Units

Display both Celsius and Fahrenheit side by side in weather pills and tooltips.

- Default: `false`

#### Precipitation Unit

Choose precipitation display format.

- Options: `Metric` (mm), `Imperial` (in)
- Default: `Metric`

### Weather Editor

Button to open the [Weather Editor](Weather-Editor) for customizing preset visuals, sounds, and FXMaster mappings.

### Weather Probabilities

Button to open the [Weather Probability dialog](Weather-System#probability-guide). Only visible when climate zones are configured. Shows effective weight breakdown per preset for the selected zone and season.

---

## Canvas (GM Only)

### Scene Integration

#### Darkness Sync

Adjust scene darkness based on time of day.

- Default: `true`

#### Sync All Scenes

Sync darkness across all scenes, not just the active one.

- Default: `false`

#### Weather Affects Darkness

Adjust scene darkness based on current weather conditions.

- Default: `true`

#### Sync Scene Ambience with Weather

Update scene environment lighting (hue/saturation) based on weather and climate zone.

- Default: `true`

#### Sync Scene Ambience with Time of Day

Shift scene ambient color based on time of day (warm tones at dawn/dusk, cool blue at night). Requires "Sync Scene Ambience with Weather" to be enabled.

- Default: `true`

#### Moon Illumination

Allow moon phases to reduce nighttime darkness. Per-moon brightness is configured in Calendar Editor.

- Default: `true`

#### Default Brightness Multiplier

Global brightness multiplier for scene ambience.

- Range: `0.5` to `1.5`
- Default: `1.0`

### Sticky Zones

#### Enable Sticky Zones

Allow draggable windows (HUD, MiniCal, Time Keeper) to snap to predefined positions.

- Default: `true`

---

## Appearance

### Theme Mode

Visual theme for Calendaria UI components. 15 built-in presets plus a customizable option.

- Options: `Dark`, `Light`, `High Contrast`, `Parchment`, `Arcane`, `Verdant`, `Infernal`, `Frost`, `Steampunk`, `Neon`, `Minimalist`, `Solarized`, `Royal`, `Sakura`, `Slate`, `Custom`
- Default: `Dark`

Selected preset applies to all Calendaria applications.

### Theme Colors

When Theme Mode is set to `Custom`, you can customize all UI colors. See [Theming](Theming) for details on color categories, export/import, and CSS variables.

---

## Chronicle (GM Only)

[Chronicle](Chronicle) timeline viewer settings.

### Open / Close / Reset

Open, close, or reset the Chronicle. Reset clears scroll position and returns to default state.

### Show Chronicle on World Load

Show Chronicle on world load.

- Default: `false`

### Force Chronicle

Force Chronicle for all connected clients.

- Default: `false`

### Depth Mode

Controls how much content is shown for each entry in the Chronicle.

- `Title Only`: Only note titles
- `Excerpts`: Title with a short text preview
- `Full`: Title with full note content
- Default: `Excerpts`

### Visibility Toggles

Toggle which content types appear in the Chronicle:

- **Show Notes**: Display calendar notes
- **Show Festivals**: Display festival entries
- **Show Season Banners**: Display season transition banners
- **Show Moon Phase Banners**: Display moon phase banners
- **Show Weather History**: Display historical weather entries

### Count as Not Empty

Multi-select setting controlling which banner types count as content when determining whether a day has entries. When "Show Empty Days" is toggled off, days with only unchecked banner types are treated as empty.

- **Weather**: Weather history banners
- **Moon Phases**: Moon phase milestone banners
- **Season Changes**: Season transition banners

By default, all banner types count as content.

### Combat Behavior

Controls Chronicle behavior during combat. See [HUD > Combat Behavior](#combat-behavior) for option details.

- Default: `None`

### Category Filter Persistence

The Chronicle toolbar's active category selection is stored per-client in the `chronicleCategoryFilter` setting as a set of preset IDs. The selection persists across sessions.

> [!NOTE]
> The Chronicle inherits the global theme preset and does not have its own theme selector.

---

## Fog of War (GM Only)

[Fog of War](Fog-of-War) progressive calendar revelation system.

### Enable Fog of War

Master toggle. When enabled, players only see dates the GM has explicitly revealed.

- Default: `false`

### Campaign Start Date

Earliest date players can see. Dates before start are always fogged. Acts as a lower bound for revealed ranges.

### Auto-Reveal on Day Change

Reveal dates as the calendar advances forward.

- Default: `true`

### Reveal Radius

Number of days to reveal around the current date when auto-reveal triggers.

- Range: `0` to `30`
- Default: `0`

### Reveal Intermediate Days

When advancing multiple days at once, reveal all intermediate days between the previous and new date (not just the landing date).

- Default: `true`

### Player Navigation Mode

Controls how players navigate fogged calendars:

- `Skip`: Previous/next buttons skip over fogged months, jumping to the nearest revealed month
- `Block`: Previous/next buttons are disabled at fogged boundaries

### Reset

Clears all revealed ranges and re-creates the initial range from the campaign start date.

---

## Cinematic (GM Only)

[Cinematic Time Skip](Cinematic-Time-Skip) fullscreen animation overlay.

### Enable Cinematic

Master toggle for cinematic time skip overlay.

- Default: `true`

### Threshold

Minimum time advance to trigger the cinematic. Smaller advances play without it.

- Options: `Day`, `Week`, `Month`, `Season`, `Year`
- Default: `Week`

> [!NOTE]
> The threshold gates advances initiated from the HUD, MiniCal, and Time Keeper jump buttons, the chat `/advance` command, socket time requests, and the "Cinematic Advance" button in the Set Date dialog.

### Panel Duration

How long each intermediate day panel shows during the animation.

- Range: `1000` to `6000` (milliseconds)
- Default: `3000`

### Per-Element Toggles

Toggle individual animation elements on/off:

- **Sky**: Day/night sky cycle
- **Stars**: Twinkling star field
- **Sun**: Sun arc across the sky
- **Shooting Stars**: Random shooting star effects
- **Moon Orbs**: Moon phase orbs with trailing arcs
- **Weather Transitions**: Weather and season visual transitions
- **Event Cards**: Note title cards displayed during the animation

### Event Weighting

Controls how prominently events are featured in the cinematic display.

- Default: `Normal`

### Show During Rest

When enabled, rest-based time advances trigger the cinematic regardless of the threshold setting.

- Default: `false`

Rest integration supports D&D 5e, Pathfinder 2e, and Pathfinder 1e long rests.

---

## Module (GM Only)

### Show Equivalent Dates

Cross-calendar date display. When enabled, equivalent dates from other loaded calendars appear in day tooltips, note sheets, and calendar headers.

- Default: `false`

See [Secondary Calendar](Secondary-Calendar) for more details on multi-calendar support.

### Print / Export

Opens the browser print dialog. Save as PDF to export.

- **Print Current Month.** Full-page month grid.
- **Print Current Year.** Every month, one page each.

---

## Macros (GM Only)

### Global Triggers

Assign macros to run at specific times:

- **Dawn**: Sunrise
- **Dusk**: Sunset
- **Midday**: Noon
- **Midnight**: Midnight
- **New Day**: Day change

### Season Triggers

Assign macros to run when specific seasons begin. Supports "All Seasons" for any season change.

### Moon Phase Triggers

Assign macros to run on specific moon phases. Configure by moon and phase, or use "All Moons"/"All Phases" wildcards.

---

## Chat (GM Only)

### Chat Timestamp Mode

How to display in-game time on chat messages.

- `disabled`: No in-game timestamps
- `replace`: Replace real-world time with in-game time
- `augment`: Show both real and in-game time
- Default: `disabled`

### Show Time in Timestamps

Include hours/minutes in chat timestamps.

- Default: `true`

---

## Advanced

### Primary GM (GM Only)

Designate which GM controls time advancement in multi-GM games.

- Default: Auto (first active GM)

### Logging Level

Control console debug output. This is a per-user setting.

- `Off`: No logging
- `Errors`: Only errors
- `Warnings`: Errors and warnings
- `Verbose`: All debug information
- Default: `Warnings`

### Dev Mode (GM Only)

Enable developer features such as calendar journal deletion and sticky zone visualization.

- Default: `false`

### UI Integration (GM Only)

#### Show Toolbar Buttons

Master toggle for toolbar button visibility.

- Default: `true`

#### Toolbar Apps

Multi-select for which apps appear in the toolbar:

- BigCal
- MiniCal
- HUD
- Time Keeper
- Stop Watch

#### Show Journal Footer

Replaces Journal sidebar footer with app toggle buttons.

- Default: `false`

### Backup & Transfer (GM Only)

#### Export Settings

Opens an export dialog with options:

- **Include active calendar**: When checked, exports the active calendar data along with settings. The exported file can then be used with the Calendar Importer or Import Settings.

Downloads all settings as JSON for backup or transfer between worlds.

#### Import Settings

Opens a file picker, then shows an import dialog with options (when the file contains calendar data):

- **Import calendar**: Import the embedded calendar data as a custom calendar
- **Set as active calendar**: Automatically switch to the imported calendar

Loads settings from a previously exported JSON file.

---

## HUD

### Show on World Load

Show HUD on world load.

- Default: `false`

> [!NOTE]
> This setting is also accessible from **Settings > Module Settings > Calendaria** in Foundry's native settings menu.

### HUD Mode

- `Fullsize`: Full HUD display with dome/slice dial
- `Compact`: Condensed bar display (forces slice dial)
- Default: `fullsize`

### Width Scale

Scale HUD width from 0.5x to 2.0x (base 800px, range 400-1600px). Only applies in fullsize mode.

- Range: `0.5` to `2.0`
- Default: `1.0`

### Dial Style

Choose how the sun/moon are displayed:

- `Dome`: Semi-circular dome above the bar with sun/moon arc
- `Slice`: Horizontal strip in the bar with sun/moon traveling left-to-right
- Default: `dome`

> [!NOTE]
> Compact mode forces slice style. Switching back to fullsize restores your saved dial style preference.

### Calendar Button

Choose which calendar the HUD button opens.

- Options: `BigCal`, `MiniCal`
- Default: `bigcal`

### Combat Behavior

Controls HUD behavior during combat. This is a per-user setting.

- `None`: No change during combat
- `Hide on Combat Start`: Automatically hide when combat begins
- `Hide on Encounter Creation`: Automatically hide when a combat encounter is created
- Default: `None`

Widgets automatically restore when combat ends. Manually calling `show()` is blocked while the hide mode is active.

> [!NOTE]
> All widget tabs (HUD, MiniCal, BigCal, Time Keeper, Stop Watch, Sun Dial, Chronicle) have this same Combat Behavior dropdown with the same three options.

### Color Shift Sync

Time-of-day color shifting on the HUD. Opt in for dawn/dusk atmospheric tinting (15% intensity, no midday tint).

- Default: `false`

### Dome Auto-Hide

Fade and hide the sundial dome as the HUD approaches the top of the viewport.

- Default: `true`

### Block Visibility

Toggle indicator blocks in the HUD bar. Hiding blocks shrinks HUD width. User-scoped (each player customizes their own view).

#### Show Weather

Display weather indicator.

- Default: `true`

#### Weather Display Mode

- `Full`: Icon + label + temperature
- `Icon + Temperature`: Icon and temp only
- `Icon Only`: Just the weather icon
- `Temperature Only`: Just the temperature
- Default: `full`

#### Show Season

Display season indicator.

- Default: `true`

#### Season Display Mode

- `Icon + Text`: Both icon and season name
- `Icon Only`: Just the season icon
- `Text Only`: Just the season name
- Default: `icon + text`

#### Show Era

Display era indicator.

- Default: `true`

#### Era Display Mode

- `Full`: Icon + name + abbreviation
- `Icon`: Just the era icon
- `Text`: Just the era name
- `Abbreviation`: Just the era abbreviation
- Default: `full`

#### Show Cycles

Display cycle indicators.

- Default: `true`

#### Cycles Display Mode

- `Name`: Cycle entry name
- `Icon`: Just the cycle icon
- `Number`: Numeric value
- `Roman Numeral`: Roman numeral value
- Default: `name`

#### Show Moon Phases

Display moon phase indicators.

- Default: `true`

#### Show All Moons

Display all configured moons in the HUD dome (secondary moons trail with size scaling).

- Default: `false`

#### Weather FX Mode

Controls weather particle effects in the HUD dome and Sun Dial. Sky, sun, moon, and stars are unaffected. This is a per-client setting.

- `Full`: All weather particle effects at normal density
- `Reduced`: Lower particle density for better performance
- `Off`: No weather particle effects
- Default: `Full`

#### Event Border Glow

Glow effect around the HUD border when events exist on the current day. Disabling removes only the glow; event icons, tooltips, and note actions remain.

- Default: `true`

#### Dome Below Bar

Render the dome visual below the info bar instead of above it.

- Default: `false`

### Sticky States

#### Enable Sticky Zones

Allow HUD to snap to predefined positions when dragging:

- `top-center`: Centered at top of viewport
- `above-hotbar`: Above the macro hotbar
- `above-players`: Above the players list
- `below-controls`: Below the scene controls
- Default: `true`

Position preserved when switching display modes (dome/slice/compact). Bottom-anchored zones (like above-hotbar) maintain position relative to bar bottom across mode changes.

#### Sticky Tray

Remember tray open/closed state between sessions.

- Default: `false`

#### Lock Position

Prevent dragging the HUD.

- Default: `false`

### Custom Time Jumps

Configure custom time jump buttons per increment (e.g., skip 8 hours). Each increment can have its own jump values.

> [!TIP]
> Leave a field blank (empty) to hide that button. This applies to both increment and decrement buttons.

### Tray Open Direction

Direction the time controls tray expands when opened.

- `Down`: Tray opens downward (default, for top-positioned HUD)
- `Up`: Tray opens upward (for bottom-positioned HUD)
- Default: `down`

### Auto-Fade

Enable opacity fade when mouse leaves the HUD.

- Default: `false`

### Idle Opacity %

Opacity level when HUD is faded (when Auto-Fade is enabled). Use the slider or enter a value directly in the number input.

- Range: `0` to `100` %
- Default: `40`

### Force HUD (GM Only)

Force HUD display for all connected clients.

- Default: `false`

### Reset Position

Button to reset HUD to default position.

---

## MiniCal

### Show on World Load

Show MiniCal on world load.

- Default: `true`

> [!NOTE]
> This setting is also accessible from **Settings > Module Settings > Calendaria** in Foundry's native settings menu.

### Compact Mode

Compact mode: minimal-footprint MiniCal with circular day cells, icon-only indicators, and full-app drag.

- Default: `false`

### Compact Mode Header

Display format for the compact mode header text.

- Default: `Approximate Date & Time` (`approxDateTime`)

### Confirm Set Current Date (GM Only)

Show a confirmation dialog before changing the world date via the "Set Current Date" button.

- Default: `true`

### Auto-Open Notes Panel

Open notes panel when selecting a day that has notes.

- Default: `false`

### Block Visibility

Toggle indicator blocks in the MiniCal. User-scoped (each player customizes their own view).

#### Show Weather

Display weather indicator.

- Default: `true`

#### Weather Display Mode

- `Full`: Icon + label + temperature
- `Icon + Temperature`: Icon and temp only
- `Icon Only`: Just the weather icon
- `Temperature Only`: Just the temperature
- Default: `full`

#### Show Season

Display season indicator.

- Default: `true`

#### Season Display Mode

- `Icon + Text`: Both icon and season name
- `Icon Only`: Just the season icon
- `Text Only`: Just the season name
- Default: `icon + text`

#### Show Era

Display era indicator.

- Default: `true`

#### Era Display Mode

- `Full`: Icon + name + abbreviation
- `Icon`: Just the era icon
- `Text`: Just the era name
- `Abbreviation`: Just the era abbreviation
- Default: `full`

#### Show Cycles

Display cycle indicators.

- Default: `true`

#### Cycles Display Mode

- `Name`: Cycle entry name
- `Icon`: Just the cycle icon
- `Number`: Numeric value
- `Roman Numeral`: Roman numeral value
- Default: `name`

#### Show Moon Phases

Display moon phase indicators.

- Default: `true`

### Custom Time Jumps (GM Only)

Configure custom time jump buttons using a grid layout with four columns:

- **Major Decrement**: Large backward time jump
- **Minor Decrement**: Small backward time jump
- **Minor Increment**: Small forward time jump
- **Major Increment**: Large forward time jump

Each row represents a time unit (seconds, minutes, hours, etc.). Leave a field blank (empty) to hide that button.

### Controls Delay

Seconds before auto-hiding controls after hover.

- Range: 1-10 seconds
- Default: `3`

### Sticky Time Controls

Remember time controls visibility state.

- Default: `false`

### Sticky Sidebar

Remember sidebar visibility state.

- Default: `false`

### Lock Position

Prevent dragging the MiniCal.

- Default: `false`

### Auto-Fade

Enable opacity fade when mouse leaves the MiniCal.

- Default: `false`

### Idle Opacity

Opacity level when MiniCal is faded (when Auto-Fade is enabled).

- Range: `0` to `100` (percentage)
- Default: `40`

### Combat Behavior

Controls MiniCal behavior during combat. See [HUD > Combat Behavior](#combat-behavior) for option details.

- Default: `None`

### Force MiniCal (GM Only)

Force MiniCal display for all connected clients.

- Default: `false`

### Reset Position

Button to reset position to default.

---

## BigCal

### Show on World Load (GM Only)

Show BigCal on world load.

- Default: `false`

### Auto-Fade

Enable opacity fade when mouse leaves BigCal.

- Default: `false`

### Idle Opacity

Opacity level when BigCal is faded (when Auto-Fade is enabled).

- Range: `0` to `100` (percentage)
- Default: `40`

### Force BigCal (GM Only)

Force BigCal display for all connected clients.

- Default: `false`

### Block Visibility

Toggle indicator blocks in BigCal. User-scoped (each player customizes their own view).

#### Show Weather

Display weather indicator.

- Default: `true`

#### Weather Display Mode

- `Full`: Icon + label + temperature
- `Icon + Temperature`: Icon and temp only
- `Icon Only`: Just the weather icon
- `Temperature Only`: Just the temperature
- Default: `full`

#### Show Season

Display season indicator.

- Default: `true`

#### Season Display Mode

- `Icon + Text`: Both icon and season name
- `Icon Only`: Just the season icon
- `Text Only`: Just the season name
- Default: `icon + text`

#### Show Era

Display era indicator.

- Default: `true`

#### Era Display Mode

- `Full`: Icon + name + abbreviation
- `Icon`: Just the era icon
- `Text`: Just the era name
- `Abbreviation`: Just the era abbreviation
- Default: `full`

#### Show Cycles

Display cycle indicators.

- Default: `true`

#### Cycles Display Mode

- `Name`: Cycle entry name
- `Icon`: Just the cycle icon
- `Number`: Numeric value
- `Roman Numeral`: Roman numeral value
- Default: `name`

#### Show Moon Phases

Display moon phase indicators.

- Default: `true`

### Combat Behavior

Controls BigCal behavior during combat. See [HUD > Combat Behavior](#combat-behavior) for option details.

- Default: `None`

---

## Time Keeper

Visible to any user with the **View Time Keeper** permission.

### Show on World Load (GM Only)

Show Time Keeper on world load.

- Default: `false`

> [!NOTE]
> This setting is also accessible from **Settings > Module Settings > Calendaria** in Foundry's native settings menu.

### Force Time Keeper (GM Only)

Force Time Keeper display for all connected clients.

- Default: `false`

### Custom Time Jumps

Custom time jump buttons per increment, each with its own forward/reverse values.

> [!TIP]
> Leave a field blank (empty) to hide that button. This applies to both increment and decrement buttons.

### Auto-start Game Time (Stop Watch)

When enabled, the game-time stopwatch automatically starts when world time begins advancing.

- Default: `false`

### Sticky States

#### Lock Position

Prevent dragging the Time Keeper.

- Default: `false`

### Auto-Fade

Enable opacity fade when mouse leaves the Time Keeper.

- Default: `true`

### Idle Opacity

Opacity level when Time Keeper is faded (when Auto-Fade is enabled).

- Range: `0` to `100` (percentage)
- Default: `40`

### Combat Behavior

Controls Time Keeper behavior during combat. See [HUD > Combat Behavior](#combat-behavior) for option details.

- Default: `None`

### Reset Position

Button to reset position to default.

---

## Stop Watch

### Show Stop Watch (GM Only)

Controls whether the Stop Watch is available.

- Default: `true`

### Force Stop Watch (GM Only)

Force Stop Watch display for all connected clients.

- Default: `false`

### Display Formats

Display format for stopwatch time. Live preview next to GM/Player format labels.

#### Elapsed Time (Real Time)

Format for real-time stopwatch display.

#### Elapsed Time (Game Time)

Format for game-time stopwatch display.

### Stop Watch Format Tokens

| Token | Description            | Example |
| ----- | ---------------------- | ------- |
| `HH`  | Hours (2-digit)        | 01      |
| `mm`  | Minutes (2-digit)      | 05      |
| `ss`  | Seconds (2-digit)      | 30      |
| `SSS` | Milliseconds (3-digit) | 250     |

### Sticky States

#### Lock Position

Prevent dragging the Stop Watch.

- Default: `false`

### Combat Behavior

Controls Stop Watch behavior during combat. See [HUD > Combat Behavior](#combat-behavior) for option details.

- Default: `None`

---

## Sun Dial

Visible to any user with the **View Sun Dial** permission.

### Options

#### Show Sun Dial on Load (GM Only)

Auto-open the Sun Dial when the world loads.

- Default: `false`

#### Crank Mode

Enable cumulative day advancement by rotating the sun handle past midnight.

- Default: `false`

#### Auto Fade

Enable opacity fade when mouse leaves the Sun Dial.

- Default: `false`

#### Idle Opacity

Opacity level when Sun Dial is faded.

- Range: `0` to `100` (percentage)
- Default: `40`

#### Force Sun Dial (GM Only)

Force Sun Dial display for all connected clients.

- Default: `false`

### Display Formats

Time-only format presets for the Sun Dial time display. Separate GM and player formats with live preview.

### Sticky States

#### Lock Position

Prevent dragging the Sun Dial.

- Default: `false`

### Combat Behavior

Controls Sun Dial behavior during combat. See [HUD > Combat Behavior](#combat-behavior) for option details.

- Default: `None`

---

## Display Formats Reference

Format settings appear across app tabs, as well as `Notes` and `Cinematics` tabs. Each location supports separate GM and player formats. Fresh worlds seed display formats from the active calendar's authored defaults.

### Format Preview

Live preview next to GM/Player format labels shows how the format renders with the current date. Invalid custom formats show an error message.

### Token Reference Dialog

Click the help icon (?) next to Display Formats headings for an interactive reference of all format tokens organized by category with examples.

### Format Presets

#### Utility

- `off`: Hide the element entirely (available for HUD Date and Time Keeper Date formats)
- `calendarDefault`: Uses the active calendar's built-in format for that location
- `custom`: User-defined format string

#### Approximate

- `approxDate`: Approximate date (e.g., "Midsummer")
- `approxTime`: Approximate time of day (e.g., "Afternoon")
- `approxDateTime`: Approximate date and time combined (e.g., "Midsummer, Afternoon")

#### Standard Dates

- `dateShort`: Short date format
- `dateMedium`: Medium date format
- `dateLong`: Long date format
- `dateFull`: Complete date with all details

#### Regional Dates

- `dateUS`: US-style date
- `dateUSFull`: Full US-style date
- `dateISO`: ISO 8601 date format
- `dateNumericUS`: Numeric US format (MM/DD/YYYY)
- `dateNumericEU`: Numeric EU format (DD/MM/YYYY)

#### Ordinal/Fantasy

- `ordinal`: Day with ordinal suffix
- `ordinalLong`: Long ordinal format
- `ordinalEra`: Ordinal with era
- `ordinalFull`: Complete ordinal format
- `seasonDate`: Season-based date format

#### Time

- `time12`: 12-hour time with AM/PM
- `time12Sec`: 12-hour time with seconds
- `time24`: 24-hour time
- `time24Sec`: 24-hour time with seconds

#### DateTime

- `datetimeShort12`: Short date with 12-hour time
- `datetimeShort24`: Short date with 24-hour time
- `datetime12`: Date with 12-hour time
- `datetime24`: Date with 24-hour time

### Format Tokens

#### Year

| Token  | Description   | Example |
| ------ | ------------- | ------- |
| `YYYY` | 4-digit year  | 1492    |
| `YY`   | 2-digit year  | 92      |
| `Y`    | Unpadded year | 1492    |

#### Month

| Token  | Description            | Example   |
| ------ | ---------------------- | --------- |
| `MMMM` | Full month name        | Flamerule |
| `MMM`  | Abbreviated month name | Fla       |
| `MM`   | 2-digit month          | 07        |
| `M`    | Unpadded month         | 7         |
| `Mo`   | Month with ordinal     | 7th       |

#### Day

| Token | Description      | Example |
| ----- | ---------------- | ------- |
| `DD`  | 2-digit day      | 05      |
| `D`   | Unpadded day     | 5       |
| `Do`  | Day with ordinal | 5th     |
| `DDD` | Day of year      | 186     |

#### Weekday

| Token     | Description           | Example |
| --------- | --------------------- | ------- |
| `EEEE`    | Full weekday name     | Sunday  |
| `EEE`     | Abbreviated weekday   | Sun     |
| `E`, `EE` | Numeric weekday       | 1       |
| `e`       | Local numeric weekday | 0       |

#### Time

| Token     | Description               | Example |
| --------- | ------------------------- | ------- |
| `HH`, `H` | 24-hour (padded/unpadded) | 14, 14  |
| `hh`, `h` | 12-hour (padded/unpadded) | 02, 2   |
| `mm`, `m` | Minutes (padded/unpadded) | 05, 5   |
| `ss`, `s` | Seconds (padded/unpadded) | 09, 9   |
| `A`, `a`  | AM/PM (upper/lower)       | PM, pm  |

#### Era

| Token         | Description     | Example        |
| ------------- | --------------- | -------------- |
| `GGGG`, `GGG` | Full era name   | Dale Reckoning |
| `GG`          | Abbreviated era | DR             |
| `G`           | Narrow era      | D              |

#### Season

| Token     | Description        | Example |
| --------- | ------------------ | ------- |
| `QQQQ`    | Full season name   | Summer  |
| `QQQ`     | Abbreviated season | Sum     |
| `QQ`, `Q` | Numeric season     | 2       |

#### Week

| Token     | Description   | Example |
| --------- | ------------- | ------- |
| `ww`, `w` | Week of year  | 27, 27  |
| `W`       | Week of month | 1       |

#### Climate Zone

| Token  | Description              | Example          |
| ------ | ------------------------ | ---------------- |
| `zzzz` | Full climate zone name   | Temperate Forest |
| `z`    | Abbreviated climate zone | Temp             |

#### Fantasy

| Token               | Description                         | Example                   |
| ------------------- | ----------------------------------- | ------------------------- |
| `[approxTime]`      | Approximate time of day             | Afternoon                 |
| `[approxDate]`      | Approximate date                    | Midsummer                 |
| `[moon]`            | Current moon phase name             | Full Moon                 |
| `[moonIcon]`        | Moon phase icon (rendered as image) | (moon icon)               |
| `[moonIcon='name']` | Specific moon by name               | Moon phase for named moon |
| `[moonIcon=0]`      | Specific moon by index              | Moon phase for first moon |
| `[ch]`              | Current canonical hour              | Vespers                   |
| `[chAbbr]`          | Abbreviated canonical hour          | Ves                       |
| `[cycle]`           | Current cycle value                 | 3                         |
| `[cycleName]`       | Current cycle entry name            | Gemini                    |
| `[cycleRoman]`      | Cycle value as roman numeral        | III                       |
| `[yearInEra]`       | Year within current era             | 5                         |

> [!NOTE]
> The `[moonIcon]` token renders the actual moon phase image with color tinting matching the calendar configuration. Use `[moon]` for text-only phase names.
>
> On intercalary days, `MMMM`/`MMM` return the festival name; `D`/`DD`/`Do`/`M`/`MM`/`Mo` return empty strings.

---

## Per-Scene Settings

Override global settings on individual scenes via **Scene Configuration > Calendaria** tab:

### Darkness Sync Override

- `Use Global`: Follow the module setting
- `Enabled`: Always sync this scene
- `Disabled`: Never sync this scene

### Brightness Multiplier

Override the global brightness multiplier for this specific scene.

- Range: `0.5` to `1.5`
- Default: Uses global setting

### Hide HUD for Players

Hide the Calendaria HUD from players when this scene becomes active. Navigating to a non-hidden scene restores HUD visibility for users with "Show HUD on load" enabled.

- Default: `false`

### Climate Zone Override

Override the calendar's default climate zone for this specific scene. Affects weather generation, darkness calculations, and environment lighting. Select "No Zone" to explicitly disable zone-based weather and ambience for this scene.

- Default: Uses calendar's default zone

### Disable Weather FX

Disable FXMaster weather particle effects on this specific scene. Takes effect immediately.

- Default: `false`

### FXMaster Top-Down Override

Override the global Top-Down Mode setting for FXMaster effects on this specific scene.

- `Use Global`: Follow the module setting
- `Top-Down`: Force top-down rendering on this scene
- `Side View`: Force side-view rendering on this scene
- Default: `Use Global`

### Disable Weather Sound

Suppress weather ambient sounds on this specific scene without affecting visual effects. Independent of the "Disable Weather FX" flag.

- Default: `false`
