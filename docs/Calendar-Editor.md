# Calendar Editor

The Calendar Editor lets you create custom calendars or modify existing ones. Access it from **Settings** → **Module Settings** → **Calendaria** → **Open Calendar Editor**.

## Overview

The editor is organized into tabs, each handling a different aspect of your calendar:

| Tab       | Purpose                                                   |
| --------- | --------------------------------------------------------- |
| Basic     | Name, description, year settings, leap year configuration |
| Months    | Define months and their lengths                           |
| Weekdays  | Set weekday names, rest days, and named weeks             |
| Time      | Hours per day, daylight, date formats, canonical hours    |
| Seasons   | Seasonal periods (dated or periodic)                      |
| Eras      | Historical periods and year formatting                    |
| Festivals | Holidays and special days                                 |
| Moons     | Lunar cycles, phases, and reference dates                 |
| Cycles    | Repeating patterns (zodiac, elements, etc.)               |
| Weather   | Climate zones and weather presets                         |

---

## Basic Tab

Configure fundamental calendar properties.

### Calendar Selector

- **Calendar** label above the dropdown
- **Calendar Dropdown** — Select an existing calendar template or custom calendar to edit (auto-loads on selection)
- **Duplicate Calendar** — Create a copy of the currently loaded calendar (below dropdown, right-aligned)
- **Create From Scratch** — Start a fresh blank calendar (below dropdown, right-aligned)

### Calendar Identity

- **Name** — Display name for the calendar (required)
- **System** — Game system or setting this calendar is for (e.g., "Forgotten Realms", "Golarion")
- **Description** — Optional notes about the calendar

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

## Weekdays Tab

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

### Named Weeks List

| Column           | Description    |
| ---------------- | -------------- |
| **Week Name**    | Full week name |
| **Abbreviation** | Short form     |

---

## Time Tab

Set how time works in your world, including daylight and date formatting.

### Time Structure

- **Days Per Year** — Calculated automatically from month definitions; displays normal and leap year totals if different
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

### Daylight Configuration

Control sunrise and sunset times throughout the year.

- **Enabled** — Toggle daylight calculations on/off
- **Shortest Day** — Hours of daylight on the winter solstice
- **Longest Day** — Hours of daylight on the summer solstice
- **Winter Solstice** — Month and day of the shortest day
- **Summer Solstice** — Month and day of the longest day

Calendaria interpolates daylight hours between these solstices using a sinusoidal curve.

### AM/PM Notation

Customize 12-hour time labels for your setting.

- **AM Notation** — Text for morning hours (default: "AM")
- **PM Notation** — Text for afternoon/evening hours (default: "PM")

Examples: "Sunward" / "Moonward", "Before Noon" / "After Noon"

### Canonical Hours

Define named time periods like "Dawn", "Midday", or "Dusk".

| Column           | Description                    |
| ---------------- | ------------------------------ |
| **Name**         | Period name (e.g., "Matins")   |
| **Abbreviation** | Short form                     |
| **Start Hour**   | When this period begins (0-23) |
| **End Hour**     | When this period ends (0-23)   |

### Date Formats

Customize how dates and times display using template variables.

| Format             | Purpose                    | Example Output                  |
| ------------------ | -------------------------- | ------------------------------- |
| **Short**          | Compact date display       | "15 Jan 1492"                   |
| **Long**           | Detailed date display      | "15th of January, 1492"         |
| **Full**           | Complete date with weekday | "Sunday, 15th of January, 1492" |
| **Time**           | 24-hour time format        | "14:30"                         |
| **Time (12-hour)** | 12-hour time format        | "2:30 PM"                       |

---

## Seasons Tab

Define seasonal periods with visual styling.

### Season Type

- **Dated** — Seasons have fixed start and end dates (e.g., Spring starts March 20)
- **Periodic** — Seasons cycle by duration in days (e.g., 91 days each)

### Season Offset (Periodic Only)

- **Offset** — Number of days into the year before the first season begins

### Season Fields

| Field            | Description                              |
| ---------------- | ---------------------------------------- |
| **Name**         | Season name (e.g., "Spring")             |
| **Abbreviation** | Short form                               |
| **Icon**         | Font Awesome class (e.g., `fas fa-leaf`) |
| **Color**        | Color picker for visual theming          |

#### Dated Season Fields

- **Start Month/Day** — When this season begins
- **End Month/Day** — When this season ends

#### Periodic Season Fields

- **Duration** — Number of days this season lasts

### Season Controls

- **Add** (+) — Insert a new season after this one
- **Remove** (trash icon) — Delete this season
- **Climate** (thermometer icon) — Configure per-season temperature ranges and weather chance overrides

### Season Climate Configuration

Each season can have its own climate settings that override the zone defaults:

- **Temperature Range** — Min/max temperatures for this season (in your configured unit)
- **Weather Chances** — Per-weather-type probability overrides for this season

---

## Eras Tab

Define historical periods for your calendar.

### Era Fields

| Column           | Description                                           |
| ---------------- | ----------------------------------------------------- |
| **Name**         | Era name (e.g., "Age of Humanity")                    |
| **Abbreviation** | Short form (e.g., "AH")                               |
| **Start Year**   | First year of this era                                |
| **End Year**     | Last year of this era (leave blank for ongoing)       |
| **Format**       | How years display: Before/After, prefix, suffix, etc. |

### Era Template

- **Template** — Custom format string for year display using UTS#35 tokens:
  - `YYYY` — Absolute display year (e.g., 1492)
  - `YY` — 2-digit year (e.g., 92)
  - `yy` — Year within current era
  - `G` — Era abbreviation (e.g., DR)
  - `GGGG` — Full era name (e.g., Dale Reckoning)
- **Preview** — Live preview of the template output

**Examples:**

- `YYYY G` → "1492 DR"
- `G yy` → "DR 5"
- `Year yy of the GGGG` → "Year 5 of the Dale Reckoning"

### Era Controls

- **Add** (+) — Insert a new era after this one
- **Remove** (trash icon) — Delete this era

---

## Festivals Tab

Create holidays and special days that appear on the calendar.

### Festival Fields

| Column                 | Description                                                                                                            |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Name**               | Festival name (e.g., "Midwinter")                                                                                      |
| **Month**              | Which month the festival falls in                                                                                      |
| **Day**                | Day of the month                                                                                                       |
| **Duration**           | Number of days the festival lasts (default: 1)                                                                         |
| **Leap Duration**      | Duration on leap years (leave blank to use standard duration)                                                          |
| **Leap Year Only**     | Checkbox — festival only occurs in leap years                                                                          |
| **Counts for Weekday** | Checkbox — whether this day advances weekday counting (uncheck for intercalary days that exist "outside" normal weeks) |

> [!NOTE]
> For monthless calendars (like Traveller), festival positioning uses the internal `dayOfYear` field (1-365) instead of Month/Day. This is set programmatically when importing calendars.

### Festival Controls

- **Add** (+) — Insert a new festival after this one
- **Remove** (trash icon) — Delete this festival

Festivals appear as indicators on the calendar grid and in the day detail view.

---

## Moons Tab

Add one or more moons with customizable phases.

### Moon Fields

| Field            | Description                                                                                                                  |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Name**         | Moon name (e.g., "Selûne")                                                                                                   |
| **Cycle Length** | Days for a complete lunar cycle (new moon to new moon). Accepts decimal values (e.g., `29.53059` for Earth's synodic month). |
| **Color**        | Tint color for the moon icon                                                                                                 |

### Reference Date

A known date when the moon was at a specific phase (typically new moon at day 0 of the cycle). The moon's phase on any date is calculated from this reference point.

- **Year** — Reference year
- **Month** — Reference month (0-indexed internally; displays as month name in dropdown)
- **Day** — Reference day of the month
- **Cycle Day Adjust** — Offset in days to fine-tune phase alignment (positive or negative)
- **Hidden** — Checkbox to hide this moon from players (GM-only visibility)

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
| **Length**   | How many entries before the cycle repeats      |
| **Offset**   | Starting offset (which entry is "first")       |
| **Based On** | What unit drives the cycle (see options below) |

#### Based On Options

- **Year** — Cycle advances each calendar year
- **Era Year** — Cycle advances based on years within the current era
- **Month** — Cycle advances each month
- **Month Day** — Cycle advances each day of the month (resets monthly)
- **Day** — Cycle advances each day (total days since epoch)
- **Year Day** — Cycle advances each day of the year (resets yearly)

### Cycle Entries

Each cycle has numbered entries that repeat in order.

- **Entry Name** — Name for this position in the cycle (e.g., "Year of the Dragon")

### Cycle Controls

- **Add Cycle** (+) — Add a new cycle
- **Remove Cycle** (trash icon) — Delete this cycle
- **Add Entry** (+) — Add an entry to this cycle
- **Remove Entry** (trash icon) — Delete this entry

---

## Weather Tab

Configure climate zones and weather conditions. A zone could be a region of your world, a city, etc.

### Climate Zone Controls

- **Zone Dropdown** — Select which climate zone to edit
- **Add Zone** (+) — Create a new climate zone
- **Edit Zone** (pencil) — Rename or configure the selected zone
- **Delete Zone** (trash) — Remove the selected zone

### Auto Generate

- **Auto Generate Weather** — Checkbox to automatically generate daily weather based on season and chance values

### Weather Categories

Weather presets are organized into collapsible categories:

- **Standard** — Clear, cloudy, rain, snow, etc.
- **Severe** — Storms, blizzards, extreme conditions
- **Environmental** — Fog, heat wave, drought
- **Fantasy** — Magical weather effects

#### Category Controls

- **Collapse/Expand** — Click header to toggle visibility
- **Select All** — Checkbox to enable/disable all presets in this category
- **Stats** — Shows total chance and enabled count

### Weather Preset Fields

| Field            | Description                                          |
| ---------------- | ---------------------------------------------------- |
| **Enabled**      | Checkbox — include this weather in random generation |
| **Icon**         | Visual indicator (display only)                      |
| **Name**         | Weather condition name (display only)                |
| **Chance**       | Percentage chance when rolling weather (0-100%)      |
| **Temp Min/Max** | Temperature range modifiers for this condition       |

### Weather Preset Actions

- **Description** (comment icon) — Toggle description popover for custom flavor text
- **Reset** (undo icon) — Restore this preset to default values

### Total Chance

Displays the sum of all enabled weather chances. Shows a warning if the total doesn't equal 100%.

### Climate Zone Editor

Click the **Edit Zone** (pencil) button to configure zone-specific settings:

- **Name** — Display name for the zone
- **Description** — Optional notes about this climate zone
- **Brightness Multiplier** — Scene darkness adjustment (0.5x to 1.5x, default 1.0x)
- **Environment Lighting** — Optional hue and saturation overrides for base and dark lighting
- **Temperatures** — Per-season temperature ranges (min/max) for this zone

---

## Exporting Calendars

Click **Export** to download the current calendar as a JSON file.

### Export Contents

The exported file includes:

- All calendar configuration (months, weekdays, seasons, moons, etc.)
- Calendar metadata (name, system, description)
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
