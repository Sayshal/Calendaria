# Calendar Editor

Create custom calendars or modify existing ones. Access from **Settings** → **Module Settings** → **Calendaria** → **Open Calendar Editor**.

## Overview

12 tabs across color-coded groups:

| Group                 | Tabs                                             |
| --------------------- | ------------------------------------------------ |
| **Core** (pink)       | Overview, Display                                |
| **Structure** (green) | Months, Weeks, Years, Time                       |
| **Features** (orange) | Festivals, Eras, Cycles, Moons, Seasons, Weather |

![Editor Navigation](https://github.com/Sayshal/Calendaria/blob/main/.github/assets/editor-navigation.png)

---

## Overview Tab

Configure calendar identity and selection.

### Calendar Selector

- **Calendar Dropdown.** Select an existing calendar template or custom calendar to edit (auto-loads on selection)
- **Duplicate Calendar.** Create a copy of the currently loaded calendar
- **Create From Scratch.** Start a fresh blank calendar

### Calendar Identity

- **Name.** Display name for the calendar (required)
- **Description.** Optional notes about the calendar

---

## Display Tab

Configure date and time formatting throughout the UI. Each format field shows a **live preview** below the input using sample calendar data. Invalid format strings get a red border and error message.

**Token Reference** button opens a dialog listing all available format tokens.

> [!TIP]
> See [Format Tokens](Format-Tokens) for the full token reference.

---

## Months Tab

Define your calendar's months.

### Month Fields

| Column            | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| **Name**          | Full month name (e.g., "January")                          |
| **Abbreviation**  | Short form (e.g., "Jan")                                   |
| **Days**          | Number of days in a normal year                            |
| **Leap**          | Extra days added during leap years                         |
| **Start Weekday** | Auto (calculated) or fixed weekday for day 1 of this month |
| **Type**          | Standard or Intercalary                                    |

### Month Types

- **Standard.** Normal month in the regular calendar structure
- **Intercalary.** Days outside the normal month/week structure (e.g., festival days between months, the "Day of Threshold" in Renescara). Typically don't count toward weekday progression.

### Month Controls

- **Custom Weekdays** (calendar-week icon): Toggle custom weekday names for this month only
- **Add** (+): Insert a new month after this one
- **Move Up/Down** (chevrons): Reorder months
- **Remove** (trash icon): Delete this month

### Custom Weekdays Per Month

When enabled, a month can have its own weekday names independent of the global weekdays. Useful for intercalary periods or months with special day naming.

### Zero-Day Months

Months with 0 base days only appear during leap years when extra days are added. Useful for leap-year-only festival periods.

- Navigation automatically skips 0-day months in non-leap years
- Year view displays 0-day months with reduced opacity

---

## Weeks Tab

Configure the days of the week and optional named weeks.

### Weekdays List

| Column           | Description                                                                      |
| ---------------- | -------------------------------------------------------------------------------- |
| **Name**         | Full weekday name (e.g., "Monday")                                               |
| **Abbreviation** | Short form (e.g., "Mon")                                                         |
| **Rest Day**     | Checkbox. Marks weekends for styling (this can be hooked into to trigger events) |

### Weekday Controls

- **Add** (+): Insert a new weekday after this one
- **Move Up/Down** (chevrons): Reorder weekdays
- **Remove** (trash icon): Delete this weekday

### Named Weeks

Give each week a name (like "Week of the Wolf" or "Tenday of Stars").

- **Enabled.** Turn named weeks on/off
- **Type.** How weeks are numbered:
  - **Year-based.** Week numbers continue through the entire year
  - **Month-based.** Week numbers reset at the start of each month
- **Repeat Cycling.** When enabled, named weeks cycle through if there are more weeks in the year than named entries

### Named Weeks List

| Column           | Description                                                    |
| ---------------- | -------------------------------------------------------------- |
| **Week Number**  | Which week number this name targets (with duplicate detection) |
| **Week Name**    | Full week name                                                 |
| **Abbreviation** | Short form                                                     |

> [!TIP]
> Use the `[namedWeek]` and `[namedWeekAbbr]` format tokens to display named week names in date strings.

---

## Years Tab

Configure year settings, leap year rules, and named years.

### Year Settings

- **Year Zero.** The reference year (year 0 in your calendar's internal numbering)
- **Year Zero Weekday.** Which weekday falls on day 1 of year zero (determines weekday calculations)

### Leap Year Configuration

- **Leap Rule.** Select how leap years are calculated:
  - **None.** No leap years
  - **Simple.** Every N years
  - **Gregorian.** Standard Earth calendar rules (every 4 years, except centuries, except 400-year marks)
  - **Custom.** Pattern-based rules

#### Simple Leap Year Fields

- **Leap Interval.** How often leap years occur (e.g., 4 for every 4th year)
- **Leap Start.** First year with a leap day

#### Custom Leap Year Fields

- **Leap Pattern.** Comma-separated divisibility rules using `!` for exclusions (e.g., `400,!100,4` means divisible by 400, OR divisible by 4 but NOT by 100)
- **Leap Start.** First year the pattern applies from

### Named Years

Assign display names to specific years. When a year has a name, the `[yearName]` format token renders it in date strings. Pipe fallback syntax `[yearName|YYYY]` shows the year name when defined, falling back to the numeric year.

| Column   | Description                               |
| -------- | ----------------------------------------- |
| **Year** | The year number this name applies to      |
| **Name** | Display name (e.g., "Year of the Dragon") |

---

## Time Tab

Set how time works in your world, including daylight hours.

### Time Structure

- **Hours Per Day.** Number of hours in one day (default: 24)
- **Minutes Per Hour.** Number of minutes per hour (default: 60)
- **Seconds Per Minute.** Number of seconds per minute (default: 60)
- **Seconds Per Round.** Combat round duration in seconds (default: 6)

> [!WARNING]
> Changing time settings affects how Foundry's world time is interpreted. Existing timestamps may display differently.

### Non-Standard Time Units

Supports calendars with non-standard time structures:

- **Variable hours per day.** Any number of hours (e.g., 20-hour days)
- **Variable minutes per hour.** Any number of minutes (e.g., 100 minutes/hour)
- **Variable seconds per minute.** Any number of seconds

When using non-standard time:

- AM/PM midday calculated as `hoursPerDay / 2` instead of fixed 12
- Time dial and hour markers automatically scale to the configured hours
- All API time methods respect the calendar's time structure
- Sunrise/sunset calculations adapt to the day length

### Daylight Hours

Control sunrise and sunset times throughout the year.

- **Enabled.** Toggle daylight calculations on/off
- **Shortest Day.** Hours of daylight on the winter solstice
- **Longest Day.** Hours of daylight on the summer solstice
- **Winter Solstice.** Month and day of the shortest day
- **Summer Solstice.** Month and day of the longest day

Calendaria interpolates daylight hours between these solstices using a sinusoidal curve.

> [!NOTE]
> Climate zones can override these global daylight settings with per-zone latitude or manual shortest/longest day values. See [ClimateEditor](#climateeditor) zone mode.

### Meridiem Indicators

Customize 12-hour time labels for your setting.

- **Ante Meridiem.** Full text for morning hours (default: "AM")
- **Post Meridiem.** Full text for afternoon/evening hours (default: "PM")
- **AM Abbreviation.** Abbreviated morning label (default: "AM")
- **PM Abbreviation.** Abbreviated evening label (default: "PM")

`A` and `a` format tokens use the abbreviated forms. `[meridiemFull]` gives the full-length labels.

Examples: "Sunward" / "Moonward", "Before Noon" / "After Noon"

### Canonical Hours

Define named time periods like "Dawn", "Midday", or "Dusk".

| Column           | Description                                |
| ---------------- | ------------------------------------------ |
| **Name**         | Period name (e.g., "Matins")               |
| **Abbreviation** | Short form                                 |
| **Start Hour**   | When this period begins (0 to hoursPerDay) |
| **End Hour**     | When this period ends (0 to hoursPerDay)   |

---

## Seasons Tab

Define seasonal periods with visual styling.

### Season Type

- **Dated.** Seasons have fixed start and end dates (e.g., Spring starts March 20)
- **Periodic.** Seasons cycle by duration in days (e.g., 91 days each)

### Season Offset (Periodic Only)

- **Offset.** Number of days into the year before the first season begins

### Season Fields

| Field            | Description                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| **Name**         | Season name (e.g., "Spring")                                                 |
| **Abbreviation** | Short form                                                                   |
| **Icon/Color**   | Click the icon button to open an edit dialog for Font Awesome icon and color |

#### Dated Season Fields

- **Start Month/Day.** When this season begins
- **End Month/Day.** When this season ends

#### Periodic Season Fields

- **Duration.** Number of days this season lasts

### Season Controls

- **Add** (+): Insert a new season after this one
- **Remove** (trash icon): Delete this season
- **Climate** (edit icon): Open the [ClimateEditor](#climateeditor) to configure per-season temperature ranges and weather chance overrides

---

## Eras Tab

Define historical periods for your calendar.

> [!TIP]
> Eras may overlap. Use indexed format tokens like `[era=1]`, `[eraAbbr=2]`, `[yearInEra=1]` to reference a specific matching era.

### Era Fields

| Column           | Description                                     |
| ---------------- | ----------------------------------------------- |
| **Name**         | Era name (e.g., "Age of Humanity")              |
| **Abbreviation** | Short form (e.g., "AH")                         |
| **Start Year**   | First year of this era                          |
| **End Year**     | Last year of this era (leave blank for ongoing) |

### Indexed Era Tokens

When multiple eras overlap, use indexed tokens to reference a specific match:

| Token           | Description                          |
| --------------- | ------------------------------------ |
| `[era=N]`       | Full name of the Nth matching era    |
| `[eraAbbr=N]`   | Abbreviation of the Nth matching era |
| `[yearInEra=N]` | Year within the Nth matching era     |

Example: If year 1492 falls in both "Dale Reckoning" (era 1) and "Age of Mortals" (era 2), `[era=1]` gives "Dale Reckoning" and `[era=2]` gives "Age of Mortals".

### Era Controls

- **Add** (+): Insert a new era after this one
- **Remove** (trash icon): Delete this era

---

## Festivals Tab

Create holidays and special days that appear on the calendar.

### Festival Fields

| Column            | Description                                                                                                        |
| ----------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Icon/Color**    | Click to open icon/color picker dialog (Font Awesome class and hex color; default: `fas fa-star` / gold `#d4af37`) |
| **Name**          | Festival name (e.g., "Midwinter")                                                                                  |
| **Month**         | Which month the festival falls in                                                                                  |
| **Day**           | Day of the month                                                                                                   |
| **Duration**      | Number of days the festival lasts (default: 1)                                                                     |
| **Leap Duration** | Duration on leap years (leave blank to use standard duration)                                                      |
| **Only Leap**     | Checkbox. Festival only occurs in leap years                                                                       |
| **Non-Weekday**   | Checkbox. This day does NOT count for weekday progression (for intercalary days that exist "outside" normal weeks) |

Each festival also has a **Description** field for lore or flavor text that appears in calendar day tooltips colored with the festival's custom color.

> [!NOTE]
> For monthless calendars (like Traveller), festival positioning uses the internal `dayOfYear` field (1-365) instead of Month/Day. This is set programmatically when importing calendars.

Festival colors render throughout the calendar UI: BigCal grid cells, MiniCal day cells, and intercalary day rows all use the festival's custom color for borders, backgrounds, day numbers, and the festival icon.

### Festival Controls

- **Edit** (pencil icon): Open the festival's linked note sheet for editing (calendar must be saved first)
- **Refresh** (sync icon): Reset the festival's linked journal note back to its template defaults (name, icon, color, dates, visibility, display style, duration). User-set fields like reminders are preserved.
- **Add** (+): Insert a new festival after this one
- **Remove** (trash icon): Delete this festival **and** its associated journal note. When a festival is removed from the calendar definition, any linked note is also deleted to prevent orphaned entries.

---

## Moons Tab

Add one or more moons with customizable phases.

### Moon Fields

| Field            | Description                                                                                                               |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Name**         | Moon name (e.g., "Selûne")                                                                                                |
| **Cycle Length** | Days for a complete lunar cycle (new moon to new moon). Accepts decimal values (e.g., `29.53` for Earth's synodic month). |
| **Color**        | Tint color for the moon icon                                                                                              |

### Reference Date

A known date when the moon was at a specific phase. The moon's phase on any date is calculated from this reference point.

- **Year.** Reference year
- **Month.** Reference month
- **Day.** Reference day of the month
- **Reference Phase.** Which phase the moon is at on the reference date (dropdown)
- **Cycle Day Adjust.** Offset in days to fine-tune phase alignment (positive or negative)

### Moon Phases

Define the phases of the lunar cycle. Each phase covers a percentage range of the cycle.

| Column      | Description                                                           |
| ----------- | --------------------------------------------------------------------- |
| **Icon**    | Click to pick a phase icon (SVG or emoji)                                                                                   |
| **Phase**   | Phase name (e.g., "Full Moon")                                                                                              |
| **Rising**  | Name for the transitional sub-phase as the moon approaches this phase                                                       |
| **Fading**  | Name for the transitional sub-phase as the moon leaves this phase                                                           |
| **Start %** | Percentage through the cycle when this phase begins (fixed mode only)                                                       |
| **End %**   | Percentage through the cycle when this phase ends (fixed mode only)                                                         |
| **Weight**  | Relative likelihood of this phase in **Randomized** mode (minimum `1`). Replaces Start %/End % columns when mode is set to Randomized. Higher weight means the phase occupies a larger share of the cycle. |

### Phase Slider

Interactive visual slider showing all phases as colored segments. Syncs bidirectionally with the Start %/End % number inputs.

![Moon Phase Slider](https://github.com/Sayshal/Calendaria/blob/main/.github/assets/editor-moon-phase-slider.png)

- **Drag handles** between phases to adjust boundaries. Adjacent phases push to maintain a 1% minimum gap.
- **Double-click** a phase segment to normalize it to an equal share (100% / number of phases).
- **Click percentage labels** to toggle between percentage and days display.

> [!NOTE]
> The phase slider and the Start %/End % columns are hidden when the moon uses **Randomized** phase mode. A **Weight** column replaces them, controlling each phase's relative likelihood.

### Moon Brightness

Brightness fieldset for each moon controls illumination contributed to nighttime scenes:

- **Brightness Max.** Range slider (0 to 0.3) controlling maximum illumination at full moon
- Default: `0` (no illumination)

Moon illumination follows a cosine curve based on phase position. Multiple moons sum their contributions, capped at 0.3 total. See [Moon Phases: Moon Brightness](Moon-Phases#moon-brightness) and [Scene Ambience](Scene-Ambience#moon-illumination) for details.

### Phase Mode

Control how the moon's phase is determined on each date.

- **Phase Mode.** Dropdown with two options:
  - **Fixed** (default): Phases follow a deterministic cycle based on the cycle length and reference date. Phase boundaries are defined by Start %/End % values.
  - **Randomized.** Phases are determined by a seeded PRNG, producing erratic, non-cyclical moon behavior. Useful for chaotic or magical moons (e.g., Warhammer's Morrslieb).

#### Randomized Mode Settings

When phase mode is set to **Randomized**, additional controls appear:

- **Seed.** Integer seed for the random number generator. The same seed always produces the same phase sequence. Click the dice button to generate a random seed.
- **Cycle Variance.** Range slider (0 to 1) controlling how much the moon's effective cycle length deviates from its base cycle length. At 0, the randomized cycle stays close to the base length. At 1, cycle lengths vary widely.
- **Phase Weight** (per phase). Number input (minimum 1) in the phases table. Weight controls each phase's share of the cycle. All phases at weight 1 produces a uniform distribution; doubling a phase's weight doubles its likelihood of appearing.

#### Anchor Phases

Guaranteed phase overrides on specific dates. The moon is always at the specified phase on that date regardless of randomization.

| Column          | Description                                                                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Year**        | The year this anchor applies to (leave blank to apply every year)                                                                                 |
| **Month**       | Which month the anchor falls in                                                                                                                   |
| **Day**         | Day of the month                                                                                                                                  |
| **Phase**       | Which phase the moon is forced to on this date (dropdown of the moon's defined phases)                                                            |
| **Reset Cycle** | Checkbox (fixed-mode moons only). When enabled, restarts the phase cycle from this anchor point instead of just overriding the phase for one day. |

- **Add Anchor.** Add a new anchor phase entry
- **Remove** (trash icon): Delete an anchor phase

> [!TIP]
> Anchors with a blank year recur annually. For example, setting "Full Moon on month 1, day 15" with no year ensures the moon is always full on that date every year.

### Eclipse Settings

Configure eclipses per moon. Eclipses occur when the moon aligns with the calendar's nodal window model: solar eclipses at new moon during nodal alignment, lunar eclipses at full moon during nodal alignment.

- **Eclipse Frequency Mode.** Dropdown controlling how often eclipses occur:
  - **None** (default): Eclipses disabled for this moon
  - **Rare.** Infrequent eclipses
  - **Occasional.** Moderate eclipse frequency
  - **Frequent.** Eclipses occur often
  - **Custom.** Manually specify the nodal period (see below)

#### Custom Eclipse Fields

When frequency mode is set to **Custom**:

- **Nodal Period.** Number of days for the moon's orbital node to complete one cycle. Controls the spacing between eclipse windows. Smaller values produce more frequent eclipses.

#### Apparent Size

Visible when eclipses are enabled (any mode except None):

- **Apparent Size.** Range slider (0.1 to 2.0) controlling the moon's apparent angular size relative to the sun. Determines eclipse subtypes:
  - Values < 1.0 produce **annular** solar eclipses (moon too small to fully cover the sun)
  - Values >= 1.0 produce **total** solar eclipses
  - Affects whether lunar eclipses are **total** or **penumbral**

### Moon & Phase Controls

- **Add Moon** (+): Add a new moon
- **Remove Moon** (trash icon): Delete this moon
- **Add Phase** (+): Add a phase to this moon
- **Remove Phase** (trash icon): Delete this phase

---

## Cycles Tab

Create repeating patterns like zodiac signs, elemental weeks, or numbered years.

### Cycle Format

- **Cycle Format.** Template string for displaying cycle values using placeholders like `[1]`, `[2]`, etc.

### Cycle Fields

| Field        | Description                                    |
| ------------ | ---------------------------------------------- |
| **Name**     | Cycle name (e.g., "Zodiac")                    |
| **Length**   | How many stages before the cycle repeats       |
| **Offset**   | Starting offset (which stage is "first")       |
| **Based On** | What unit drives the cycle (see options below) |

#### Based On Options

- **Year.** Cycle advances each calendar year
- **Era Year.** Cycle advances based on years within the current era
- **Month.** Cycle advances each month
- **Month Day.** Cycle advances each day of the month (resets monthly)
- **Day.** Cycle advances each day (total days since epoch)
- **Year Day.** Cycle advances each day of the year (resets yearly)

### Cycle Stages

Each cycle has numbered stages that repeat in order.

- **Stage Name.** Name for this position in the cycle (e.g., "Year of the Dragon")

### Cycle Controls

- **Add Cycle** (+): Add a new cycle
- **Remove Cycle** (trash icon): Delete this cycle
- **Add Stage** (+): Add a stage to this cycle
- **Remove Stage** (trash icon): Delete this stage

---

## Weather Tab

Configure climate zones and weather conditions. Two-section layout: **Season Climate** and **Zone Climate**.

### Season Climate

Lists all defined seasons. Click the edit button on a season row to open the [ClimateEditor](#climateeditor) in season mode, where you can configure temperature ranges and weather preset chance overrides for that season.

### Zone Climate

Two-column list of all climate zones with inline controls:

- **Name.** Inline-editable zone name
- **Edit** (pencil icon): Open the [Climate Editor](Climate-Editor) in zone mode for full configuration
- **Add** (+): Insert a new zone after this row
- **Remove** (trash icon): Delete this zone

### Climate Editor

See the full [Climate Editor](Climate-Editor) documentation for details on both season mode and zone mode configuration.

---

## Exporting Calendars

Click **Export** to download the current calendar as a JSON file.

### Export Contents

Exported file includes:

- All calendar configuration (months, weekdays, seasons, moons, etc.)
- Calendar metadata (name, description)
- Export version and timestamp
- Current date (when exporting the active calendar)

### Use Cases

- **Backup.** Save calendar configurations before making changes
- **Migration.** Move calendars between worlds
- **Sharing.** Share custom calendars with other GMs

### Filename

Exports use the format `{calendar-name}.json` with special characters sanitized.

### Re-importing

Re-import via the **Calendaria JSON** importer. See [Importing Calendars](Importing-Calendars).

---

## Saving Your Calendar

Click **Save Changes** to store the calendar. Options:

- **Set as Active.** Checkbox to switch to this calendar immediately after saving (reloads the world)

### Unsaved Changes Confirmation

If unsaved changes exist when **closing the editor**, **switching calendars**, **creating a new calendar**, or **duplicating**, a confirmation dialog asks whether to discard or cancel.

### Editing Built-in Calendars

Modifying a bundled calendar saves changes as an override. **Delete** becomes **Reset to Default** to restore the original.

### Deleting Calendars

**Delete** behavior depends on calendar type:

- **Custom calendars.** Permanently deletes the calendar
- **Bundled calendars with overrides.** Resets to the original bundled version
- **Bundled calendars without overrides.** Cannot be deleted

> [!NOTE]
> You must save a new calendar before the Delete button becomes available.

### Reset Button

**Reset** clears all current editor data and starts with a blank template. Does not affect saved calendars.

---

## Tips

- Start with a bundled calendar close to what you need, then customize
- Use the **Renescara** calendar as a reference for advanced features
- Test your calendar before using it in a live game
