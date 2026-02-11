# Settings

Calendaria settings are accessed via **Settings > Module Settings > Calendaria > Calendaria Settings**.

The settings panel is organized into tabs. GM-only tabs are marked below.

![Settings Navigation](https://github.com/Sayshal/Calendaria/blob/main/.github/assets/settings-navigation.png)

---

## Searching Settings

A search input at the top of the sidebar navigation allows quick access to any setting.

- Type 2+ characters to see matching results
- Results match setting labels, hints, and section headings
- Click a result to navigate (auto-switches tab, scrolls, highlights target)
- Press Escape or click outside to dismiss

---

## Per-Section Reset Buttons

Each settings section has a reset button in the fieldset legend. Clicking shows a confirmation dialog listing the affected settings before resetting them to defaults.

---

## Calendar (GM Only)

### Active Calendar

Select which calendar system to use. Changing this requires a world reload.

- Default: `gregorian`

### Open Calendar Editor

Button to launch the Calendar Editor for creating/modifying calendars.

### Import Calendar

Button to open the calendar importer for Simple Calendar, Fantasy Calendar, and other formats.

### Open/Close Buttons

Context-specific buttons to open or close the HUD, MiniCal, and TimeKeeper applications.

> [!NOTE]
> Changes in the Calendar tab are automatically saved. An "Changes saved automatically" indicator confirms this.

---

## Permissions (GM Only)

Configure which user roles can access Calendaria features.

### Available Permissions

| Permission           | Description                                 |
| -------------------- | ------------------------------------------- |
| **View MiniCal**     | Can see the MiniCal widget                  |
| **View TimeKeeper**  | Can see the TimeKeeper                      |
| **View HUD**         | Can see the main HUD                        |
| **Manage Notes**     | Can create, edit, and delete calendar notes |
| **Change Date/Time** | Can modify the world date and time          |
| **Change Weather**   | Can set weather conditions                  |
| **Change Calendar**  | Can switch the active calendar              |
| **Edit Calendars**   | Can access the Calendar Editor              |

### Configurable Roles

The permissions grid shows columns for:

- **Player** — Standard player role
- **Trusted** — Trusted player role
- **Assistant** — Assistant GM role

See [Permissions](Permissions) for detailed documentation.

---

## Notes (GM Only)

### Custom Categories

Create custom note categories with:

- **Name**: Category display name
- **Color**: Category color (hex)
- **Icon**: FontAwesome icon class (e.g., `fas fa-bookmark`)

---

## Time (GM Only)

### Advance Time on Rest

Advance world time when players take short/long rests.

- Default: `false`

### Real-Time Clock Speed

Configure how fast the in-game clock advances in real-time mode.

- **Multiplier**: How many units pass per real second (minimum 1)
- **Unit**: What time unit advances (second, round, minute, hour, day, week, month, season, year)
- Example: "10 minutes per second" means 1 real second = 10 in-game minutes
- Default: `1 second per second`

> [!TIP]
> Hover over the HUD and press the pause button to stop real-time clock advancement without disabling the feature.

### Sync with Game Pause

Clock automatically stops when the game is paused. When enabled, the clock also pauses during active combat.

- Default: `false`

> [!NOTE]
> When sync is enabled and blocked (paused or in combat), manually starting the clock shows a warning notification.

---

## Weather (GM Only)

### Temperature Unit

Choose temperature display format.

- Options: `Celsius`, `Fahrenheit`
- Default: `Celsius`

### Climate Zone

Select the active climate zone (if defined in the calendar).

### Custom Weather Presets

Create custom weather conditions with an inline editor UI:

- **Name**: Condition display name
- **Icon**: FontAwesome icon class
- **Color**: Condition color (hex)
- **Temperature Range**: Min/max temperature for this condition

Custom presets appear in the Calendar Editor Weather tab and Climate dialogs alongside built-in conditions.

---

## Canvas (GM Only)

### Scene Integration

#### Darkness Sync

Automatically adjust scene darkness based on time of day.

- Default: `true`

#### Darkness Weather Sync

Adjust scene darkness based on current weather conditions.

- Default: `true`

#### Ambience Sync

Automatically update scene environment lighting based on current weather and climate zone.

- Default: `true`

#### Default Brightness Multiplier

Global default brightness multiplier for scene ambience.

- Range: `0.5` to `1.5`
- Default: `1.0`

### Sticky Zones

#### Enable Sticky Zones

Allow draggable windows (HUD, MiniCal, TimeKeeper) to snap to predefined positions.

- Default: `true`

---

## Appearance

### Theme Mode

Select the visual theme for Calendaria UI components.

- Options: `Dark`, `High Contrast`, `Custom`
- Default: `Dark`

### Theme Colors

When Theme Mode is set to `Custom`, you can customize all UI colors. See [Theming](Theming) for details on color categories, export/import, and CSS variables.

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
- TimeKeeper
- Stopwatch

#### Show Journal Footer

Replaces Journal sidebar footer with app toggle buttons.

- Default: `false`

### Backup & Transfer (GM Only)

#### Export Settings

Opens an export dialog with options:

- **Include active calendar**: When checked, exports the active calendar data along with settings. The exported file can then be used with the Calendar Importer or Import Settings.

Downloads all Calendaria settings as a JSON file for backup or transfer between worlds.

#### Import Settings

Opens a file picker, then shows an import dialog with options (when the file contains calendar data):

- **Import calendar**: Import the embedded calendar data as a custom calendar
- **Set as active calendar**: Automatically switch to the imported calendar

Loads settings from a previously exported JSON file.

---

## HUD

### Show on World Load

Display the HUD when the world loads.

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
> Compact mode forces slice style. When switching back to fullsize mode, your saved dial style preference is automatically restored.

### Compact During Combat

Automatically switch to slice style during combat to reduce screen space.

- Default: `true`

### Hide During Combat

Automatically hide the HUD during active combat. When enabled, disables auto-compact behavior.

- Default: `false`

### Dome Auto-Hide

Fade and hide the sundial dome as the HUD approaches the top of the viewport.

- Default: `true`

### Block Visibility

Toggle visibility of indicator blocks in the HUD bar. Hiding blocks automatically shrinks HUD width. Settings are user-scoped (each player can customize their view).

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

### Sticky States

#### Enable Sticky Zones

Allow HUD to snap to predefined positions when dragging:

- `top-center`: Centered at top of viewport
- `above-hotbar`: Above the macro hotbar
- `above-players`: Above the players list
- `below-controls`: Below the scene controls
- Default: `true`

Position is preserved when switching between display modes (dome/slice/compact). Bottom-anchored zones (like above-hotbar) maintain position relative to the bar bottom across mode changes.

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

Display the MiniCal when the world loads.

- Default: `true`

> [!NOTE]
> This setting is also accessible from **Settings > Module Settings > Calendaria** in Foundry's native settings menu.

### Confirm Set Current Date (GM Only)

Show a confirmation dialog before changing the world date via the "Set Current Date" button.

- Default: `true`

### Block Visibility

Toggle visibility of indicator blocks in the MiniCal. Settings are user-scoped (each player can customize their view).

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

### Force MiniCal (GM Only)

Force MiniCal display for all connected clients.

- Default: `false`

### Reset Position

Button to reset position to default.

---

## BigCal

### Block Visibility

Toggle visibility of indicator blocks in the BigCal. Settings are user-scoped (each player can customize their view).

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

---

## TimeKeeper

### Show on World Load (GM Only)

Display the TimeKeeper when the world loads.

- Default: `false`

> [!NOTE]
> This setting is also accessible from **Settings > Module Settings > Calendaria** in Foundry's native settings menu.

### Custom Time Jumps

Configure custom time jump buttons per increment. Each increment can have its own forward/reverse jump values.

> [!TIP]
> Leave a field blank (empty) to hide that button. This applies to both increment and decrement buttons.

### Auto-start Game Time (Stopwatch)

When enabled, the game-time stopwatch automatically starts when world time begins advancing.

- Default: `false`

### Sticky States

#### Lock Position

Prevent dragging the TimeKeeper.

- Default: `false`

### Auto-Fade

Enable opacity fade when mouse leaves the TimeKeeper.

- Default: `true`

### Idle Opacity

Opacity level when TimeKeeper is faded (when Auto-Fade is enabled).

- Range: `0` to `100` (percentage)
- Default: `40`

### Reset Position

Button to reset position to default.

---

## Stopwatch

### Display Formats

Configure display format for stopwatch time. A live preview appears next to GM/Player format labels showing how the format will render.

#### Elapsed Time (Real Time)

Format for real-time stopwatch display.

#### Elapsed Time (Game Time)

Format for game-time stopwatch display.

### Stopwatch Format Tokens

| Token | Description            | Example |
| ----- | ---------------------- | ------- |
| `HH`  | Hours (2-digit)        | 01      |
| `mm`  | Minutes (2-digit)      | 05      |
| `ss`  | Seconds (2-digit)      | 30      |
| `SSS` | Milliseconds (3-digit) | 250     |

### Sticky States

#### Lock Position

Prevent dragging the Stopwatch.

- Default: `false`

---

## Display Formats Reference

Display format settings appear throughout various app tabs (HUD, MiniCal, BigCal, TimeKeeper, Stopwatch, Chat). Each location supports separate GM and player formats.

### Format Preview

A live preview appears next to GM/Player format labels showing how the format will render with the current date. Invalid custom formats display an error message.

### Token Reference Dialog

Click the help icon (?) next to Display Formats headings to open an interactive reference showing all format tokens organized by category with examples.

### Format Presets

#### Utility

- `off`: Hide the element entirely (available for HUD Date and TimeKeeper Date formats)
- `calendarDefault`: Uses the active calendar's built-in format for that location
- `custom`: User-defined format string

#### Approximate

- `approxDate`: Approximate date (e.g., "Midsummer")
- `approxTime`: Approximate time of day (e.g., "Afternoon")

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

Override global settings on individual scenes via **Scene Configuration > Ambiance**:

### Darkness Sync Override

- `Use Global`: Follow the module setting
- `Enabled`: Always sync this scene
- `Disabled`: Never sync this scene

### Brightness Multiplier

Override the global brightness multiplier for this specific scene.

- Range: `0.5` to `1.5`
- Default: Uses global setting

### Hide HUD for Players

Automatically hide the Calendaria HUD for players when this scene becomes active. When navigating to a non-hidden scene, HUD visibility is restored for users who have "Show HUD on load" enabled.

- Default: `false`

### Climate Zone Override

Override the calendar's default climate zone for this specific scene. Affects weather generation, darkness calculations, and environment lighting.

- Default: Uses calendar's default zone
