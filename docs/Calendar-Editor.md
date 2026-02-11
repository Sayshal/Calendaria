# Calendar Editor

The Calendar Editor lets you create custom calendars or modify existing ones. Access it from **Settings** → **Module Settings** → **Calendaria** → **Open Calendar Editor**.

## Overview

The editor is organized into 12 tabs across color-coded groups:

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

- **Calendar Dropdown** — Select an existing calendar template or custom calendar to edit (auto-loads on selection)
- **Duplicate Calendar** — Create a copy of the currently loaded calendar
- **Create From Scratch** — Start a fresh blank calendar

### Calendar Identity

- **Name** — Display name for the calendar (required)
- **Description** — Optional notes about the calendar

---

## Display Tab

Configure how dates and times are formatted throughout the UI. Each format field shows a **live preview** below the input using sample data from the calendar being edited. Invalid format strings are highlighted with a red border and an error message.

Click the **Token Reference** button to open a dialog listing all available format tokens.

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

- **Standard** — A normal month that is part of the regular calendar structure
- **Intercalary** — Days that exist outside the normal month/week structure (e.g., festival days between months, the "Day of Threshold" in Renescara). Intercalary periods typically don't count toward normal weekday progression.

### Month Controls

- **Custom Weekdays** (calendar-week icon) — Toggle custom weekday names for this month only
- **Add** (+) — Insert a new month after this one
- **Move Up/Down** (chevrons) — Reorder months
- **Remove** (trash icon) — Delete this month

### Custom Weekdays Per Month

When enabled, a month can have its own weekday names independent of the global weekdays. Useful for intercalary periods or months with special day naming.

### Zero-Day Months

Months can have 0 days in their base configuration, making them only appear during leap years when extra days are added. Useful for leap-year-only festival periods.

- Navigation automatically skips 0-day months in non-leap years
- Year view displays 0-day months with reduced opacity

---

## Weeks Tab

Configure the days of the week and optional named weeks.

### Weekdays List

| Column           | Description                                                                       |
| ---------------- | --------------------------------------------------------------------------------- |
| **Name**         | Full weekday name (e.g., "Monday")                                                |
| **Abbreviation** | Short form (e.g., "Mon")                                                          |
| **Rest Day**     | Checkbox — marks weekends for styling (this can be hooked into to trigger events) |

### Weekday Controls

- **Add** (+) — Insert a new weekday after this one
- **Move Up/Down** (chevrons) — Reorder weekdays
- **Remove** (trash icon) — Delete this weekday

### Named Weeks

Give each week a name (like "Week of the Wolf" or "Tenday of Stars").

- **Enabled** — Turn named weeks on/off
- **Type** — How weeks are numbered:
  - **Year-based** — Week numbers continue through the entire year
  - **Month-based** — Week numbers reset at the start of each month
- **Repeat Cycling** — When enabled, named weeks cycle through if there are more weeks in the year than named entries

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

- **Year Zero** — The reference year (year 0 in your calendar's internal numbering)
- **Year Zero Weekday** — Which weekday falls on day 1 of year zero (determines weekday calculations)

### Leap Year Configuration

- **Leap Rule** — Select how leap years are calculated:
  - **None** — No leap years
  - **Simple** — Every N years
  - **Gregorian** — Standard Earth calendar rules (every 4 years, except centuries, except 400-year marks)
  - **Custom** — Pattern-based rules

#### Simple Leap Year Fields

- **Leap Interval** — How often leap years occur (e.g., 4 for every 4th year)
- **Leap Start** — First year with a leap day

#### Custom Leap Year Fields

- **Leap Pattern** — Comma-separated divisibility rules using `!` for exclusions (e.g., `400,!100,4` means divisible by 400, OR divisible by 4 but NOT by 100)
- **Leap Start** — First year the pattern applies from

### Named Years

Assign display names to specific years. When a year has a name, the `[yearName]` format token renders it in date strings. Use pipe fallback syntax `[yearName|YYYY]` to show the year name when defined, or fall back to the numeric year.

| Column   | Description                               |
| -------- | ----------------------------------------- |
| **Year** | The year number this name applies to      |
| **Name** | Display name (e.g., "Year of the Dragon") |

---

## Time Tab

Set how time works in your world, including daylight hours.

### Time Structure

- **Hours Per Day** — Number of hours in one day (default: 24)
- **Minutes Per Hour** — Number of minutes per hour (default: 60)
- **Seconds Per Minute** — Number of seconds per minute (default: 60)
- **Seconds Per Round** — Combat round duration in seconds (default: 6)

> [!WARNING]
> Changing time settings affects how Foundry's world time is interpreted. Existing timestamps may display differently.

### Non-Standard Time Units

Calendaria fully supports calendars with non-standard time structures:

- **Variable hours per day** — Calendars can have any number of hours (e.g., 20-hour days)
- **Variable minutes per hour** — Calendars can have any number of minutes (e.g., 100 minutes/hour)
- **Variable seconds per minute** — Calendars can have any number of seconds

When using non-standard time:

- AM/PM midday is calculated as `hoursPerDay / 2` instead of fixed 12
- Time dial and hour markers automatically scale to the configured hours
- All API time methods respect the calendar's time structure
- Sunrise/sunset calculations adapt to the day length

### Daylight Hours

Control sunrise and sunset times throughout the year.

- **Enabled** — Toggle daylight calculations on/off
- **Shortest Day** — Hours of daylight on the winter solstice
- **Longest Day** — Hours of daylight on the summer solstice
- **Winter Solstice** — Month and day of the shortest day
- **Summer Solstice** — Month and day of the longest day

Calendaria interpolates daylight hours between these solstices using a sinusoidal curve.

> [!NOTE]
> Climate zones can override these global daylight settings with per-zone latitude or manual shortest/longest day values. See [ClimateEditor](#climateeditor) zone mode.

### Meridiem Indicators

Customize 12-hour time labels for your setting.

- **Ante Meridiem** — Full text for morning hours (default: "AM")
- **Post Meridiem** — Full text for afternoon/evening hours (default: "PM")
- **AM Abbreviation** — Abbreviated morning label (default: "AM")
- **PM Abbreviation** — Abbreviated evening label (default: "PM")

The `A` and `a` format tokens use the abbreviated forms. Use `[meridiemFull]` for the full-length labels.

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

- **Dated** — Seasons have fixed start and end dates (e.g., Spring starts March 20)
- **Periodic** — Seasons cycle by duration in days (e.g., 91 days each)

### Season Offset (Periodic Only)

- **Offset** — Number of days into the year before the first season begins

### Season Fields

| Field            | Description                                                                  |
| ---------------- | ---------------------------------------------------------------------------- |
| **Name**         | Season name (e.g., "Spring")                                                 |
| **Abbreviation** | Short form                                                                   |
| **Icon/Color**   | Click the icon button to open an edit dialog for Font Awesome icon and color |

#### Dated Season Fields

- **Start Month/Day** — When this season begins
- **End Month/Day** — When this season ends

#### Periodic Season Fields

- **Duration** — Number of days this season lasts

### Season Controls

- **Add** (+) — Insert a new season after this one
- **Remove** (trash icon) — Delete this season
- **Climate** (thermometer icon) — Open the [ClimateEditor](#climateeditor) to configure per-season temperature ranges and weather chance overrides

---

## Eras Tab

Define historical periods for your calendar.

> [!TIP]
> Eras may overlap — use indexed format tokens like `[era=1]`, `[eraAbbr=2]`, `[yearInEra=1]` to reference a specific matching era.

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

- **Add** (+) — Insert a new era after this one
- **Remove** (trash icon) — Delete this era

---

## Festivals Tab

Create holidays and special days that appear on the calendar.

### Festival Fields

| Column            | Description                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Icon/Color**    | Click to open icon/color picker dialog (Font Awesome class and hex color; default: `fas fa-star` / gold `#d4af37`)  |
| **Name**          | Festival name (e.g., "Midwinter")                                                                                   |
| **Month**         | Which month the festival falls in                                                                                   |
| **Day**           | Day of the month                                                                                                    |
| **Duration**      | Number of days the festival lasts (default: 1)                                                                      |
| **Leap Duration** | Duration on leap years (leave blank to use standard duration)                                                       |
| **Only Leap**     | Checkbox — festival only occurs in leap years                                                                       |
| **Non-Weekday**   | Checkbox — this day does NOT count for weekday progression (for intercalary days that exist "outside" normal weeks) |

Each festival also has a **Description** field — lore or flavor text that appears in calendar day tooltips colored with the festival's custom color.

> [!NOTE]
> For monthless calendars (like Traveller), festival positioning uses the internal `dayOfYear` field (1-365) instead of Month/Day. This is set programmatically when importing calendars.

Festival colors render throughout the calendar UI: BigCal grid cells, MiniCal day cells, and intercalary day rows all use the festival's custom color for borders, backgrounds, day numbers, and the festival icon.

### Festival Controls

- **Add** (+) — Insert a new festival after this one
- **Remove** (trash icon) — Delete this festival

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

- **Year** — Reference year
- **Month** — Reference month
- **Day** — Reference day of the month
- **Reference Phase** — Which phase the moon is at on the reference date (dropdown)
- **Cycle Day Adjust** — Offset in days to fine-tune phase alignment (positive or negative)

### Moon Phases

Define the phases of the lunar cycle. Each phase covers a percentage range of the cycle.

| Column      | Description                                                           |
| ----------- | --------------------------------------------------------------------- |
| **Icon**    | Click to pick a phase icon (SVG or emoji)                             |
| **Phase**   | Phase name (e.g., "Full Moon")                                        |
| **Rising**  | Name for the transitional sub-phase as the moon approaches this phase |
| **Fading**  | Name for the transitional sub-phase as the moon leaves this phase     |
| **Start %** | Percentage through the cycle when this phase begins                   |
| **End %**   | Percentage through the cycle when this phase ends                     |

### Phase Slider

An interactive visual slider displays all phases as colored segments. The slider syncs bidirectionally with the Start %/End % number inputs.

![Moon Phase Slider](https://github.com/Sayshal/Calendaria/blob/main/.github/assets/editor-moon-phase-slider.png)

- **Drag handles** between phases to adjust boundaries; adjacent phases push to maintain a 1% minimum gap
- **Double-click** a phase segment to normalize it to an equal share (100% / number of phases)
- **Click percentage labels** to toggle between percentage and days display

### Moon & Phase Controls

- **Add Moon** (+) — Add a new moon
- **Remove Moon** (trash icon) — Delete this moon
- **Add Phase** (+) — Add a phase to this moon
- **Remove Phase** (trash icon) — Delete this phase

---

## Cycles Tab

Create repeating patterns like zodiac signs, elemental weeks, or numbered years.

### Cycle Format

- **Cycle Format** — Template string for displaying cycle values using placeholders like `[1]`, `[2]`, etc.

### Cycle Fields

| Field        | Description                                    |
| ------------ | ---------------------------------------------- |
| **Name**     | Cycle name (e.g., "Zodiac")                    |
| **Length**   | How many stages before the cycle repeats       |
| **Offset**   | Starting offset (which stage is "first")       |
| **Based On** | What unit drives the cycle (see options below) |

#### Based On Options

- **Year** — Cycle advances each calendar year
- **Era Year** — Cycle advances based on years within the current era
- **Month** — Cycle advances each month
- **Month Day** — Cycle advances each day of the month (resets monthly)
- **Day** — Cycle advances each day (total days since epoch)
- **Year Day** — Cycle advances each day of the year (resets yearly)

### Cycle Stages

Each cycle has numbered stages that repeat in order.

- **Stage Name** — Name for this position in the cycle (e.g., "Year of the Dragon")

### Cycle Controls

- **Add Cycle** (+) — Add a new cycle
- **Remove Cycle** (trash icon) — Delete this cycle
- **Add Stage** (+) — Add a stage to this cycle
- **Remove Stage** (trash icon) — Delete this stage

---

## Weather Tab

Configure climate zones and weather conditions. The Weather Tab has a two-section layout: **Season Climate** and **Zone Climate**.

### Auto Generate

- **Auto Generate Weather** — Checkbox to automatically generate daily weather based on season and chance values (enabled by default for new calendars)

### Season Climate

Lists all defined seasons. Click the edit button on a season row to open the [ClimateEditor](#climateeditor) in season mode, where you can configure temperature ranges and weather preset chance overrides for that season.

### Zone Climate

Lists all climate zones with inline controls:

- **Active** — Checkbox to set the active zone (mutual exclusion — only one zone active at a time)
- **Name** — Inline-editable zone name
- **Edit** (pencil icon) — Open the [ClimateEditor](#climateeditor) in zone mode for full configuration
- **Add** (+) — Insert a new zone after this row
- **Remove** (trash icon) — Delete this zone

### ClimateEditor

A dedicated application for editing climate settings. It operates in two modes:

**Season Mode** (opened from Season Climate):

- Temperature range (min/max) for this season
- Preset chance overrides — adjust probability weights for weather conditions in this season

**Zone Mode** (opened from Zone Climate):

- **Description** — Notes about this climate zone
- **Brightness Multiplier** — Scene darkness adjustment (0.5x to 1.5x, default 1.0x)
- **Daylight** — Per-zone daylight configuration (see below)
- **Environment Lighting** — Hue and saturation overrides for base and dark lighting
- **Per-Season Temperatures** — Min/max temperature ranges for each season in this zone
- **Preset Configuration** — Full preset list with enable/disable, chance %, temperature overrides, and preset aliases

#### Zone Daylight

The Daylight fieldset controls how sunrise/sunset times are calculated for scenes using this zone. Two mutually exclusive modes are available:

| Mode                   | Fields                            | Description                                                                          |
| ---------------------- | --------------------------------- | ------------------------------------------------------------------------------------ |
| **Latitude** (default) | Latitude (-90° to +90°)           | Computes daylight astronomically based on latitude and the calendar's solstice dates |
| **Override Solstice**  | Shortest Day, Longest Day (hours) | Manually set the daylight extremes for this zone                                     |

Check **Override Solstice** to switch from latitude mode to manual mode. A live preview shows the computed shortest and longest day hours with their calendar dates.

When neither latitude nor manual values are set, the zone falls back to the calendar's global daylight settings.

Preset aliases let you rename any weather preset for this zone (e.g., rename "Rain" to "Monsoon Downpour" in a tropical zone). Aliases appear on the HUD, MiniCal, and Weather Picker. A reset button restores the default name.

---

## Exporting Calendars

Click **Export** to download the current calendar as a JSON file.

### Export Contents

The exported file includes:

- All calendar configuration (months, weekdays, seasons, moons, etc.)
- Calendar metadata (name, description)
- Export version and timestamp
- Current date (when exporting the active calendar)

### Use Cases

- **Backup** — Save calendar configurations before making changes
- **Migration** — Move calendars between worlds
- **Sharing** — Share custom calendars with other GMs

### Filename

Exports use the format `{calendar-name}.json` with special characters sanitized.

### Re-importing

Exported calendars can be re-imported using the **Calendaria JSON** importer. See [Importing Calendars](Importing-Calendars).

---

## Saving Your Calendar

Click **Save Changes** to store your calendar. Options:

- **Set as Active** — Checkbox to switch to this calendar immediately after saving (reloads the world)

### Editing Built-in Calendars

When you modify a bundled calendar, Calendaria saves your changes as an override. The **Delete** button becomes **Reset to Default** to restore the original bundled calendar.

### Deleting Calendars

The **Delete** button behavior depends on the calendar type:

- **Custom calendars** — Permanently deletes the calendar
- **Bundled calendars with overrides** — Resets to the original bundled version
- **Bundled calendars without overrides** — Cannot be deleted

> [!NOTE]
> You must save a new calendar before the Delete button becomes available.

### Reset Button

The **Reset** button clears all current editor data and starts with a blank calendar template. This does not affect saved calendars.

---

## Tips

- Start with a bundled calendar close to what you need, then customize
- Use the **Renescara** calendar as a reference for advanced features
- Test your calendar before using it in a live game
