# Calendar Editor

The Calendar Editor lets you create custom calendars or modify existing ones. Access it from **Settings** → **Module Settings** → **Calendaria** → **Open Calendar Editor**.

## Overview

The editor is organized into tabs, each handling a different aspect of your calendar:

| Tab | Purpose |
|-----|---------|
| Basic | Name, description, year settings, leap year configuration |
| Months | Define months and their lengths |
| Weekdays | Set weekday names, rest days, and named weeks |
| Time | Hours per day, daylight, date formats, canonical hours |
| Seasons | Seasonal periods (dated or periodic) |
| Eras | Historical periods and year formatting |
| Festivals | Holidays and special days |
| Moons | Lunar cycles, phases, and reference dates |
| Cycles | Repeating patterns (zodiac, elements, etc.) |
| Weather | Climate zones and weather presets |

---

## Basic Tab

Configure fundamental calendar properties.

### Calendar Selector

- **Calendar Dropdown** — Select an existing calendar template or custom calendar to load
- **Load Calendar** — Load the selected calendar into the editor
- **Create New** — Start a fresh calendar from scratch

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

| Column | Description |
|--------|-------------|
| **Name** | Full month name (e.g., "January") |
| **Abbreviation** | Short form (e.g., "Jan") |
| **Days** | Number of days in a normal year |
| **Leap** | Extra days added during leap years |
| **Start Weekday** | Auto (calculated) or fixed weekday for day 1 of this month |
| **Type** | Standard or Intercalary |

### Month Types

- **Standard** — A normal month that is part of the regular calendar structure
- **Intercalary** — Days that exist outside the normal month/week structure (e.g., festival days between months, the "Day of Threshold" in Renescara). Intercalary periods typically don't count toward normal weekday progression.

### Month Controls

- **Custom Weekdays** (calendar-week icon) — Toggle custom weekday names for this month only
- **Add** (+) — Insert a new month after this one
- **Move Up/Down** (chevrons) — Reorder months
- **Remove** (−) — Delete this month

### Custom Weekdays Per Month

When enabled, a month can have its own weekday names independent of the global weekdays. Useful for intercalary periods or months with special day naming.

---

## Weekdays Tab

Configure the days of the week and optional named weeks.

### Weekdays List

| Column | Description |
|--------|-------------|
| **Name** | Full weekday name (e.g., "Monday") |
| **Abbreviation** | Short form (e.g., "Mon") |
| **Rest Day** | Checkbox — marks weekends for styling (this can be hooked into to trigger events) |

### Weekday Controls

- **Add** (+) — Insert a new weekday after this one
- **Move Up/Down** (chevrons) — Reorder weekdays
- **Remove** (−) — Delete this weekday

### Named Weeks

Give each week a name (like "Week of the Wolf" or "Tenday of Stars").

- **Enabled** — Turn named weeks on/off
- **Type** — How weeks are numbered:
  - **Yearly** — Week numbers continue through the entire year
  - **Monthly** — Week numbers reset at the start of each month

### Named Weeks List

| Column | Description |
|--------|-------------|
| **Week Name** | Full week name |
| **Abbreviation** | Short form |

---

## Time Tab

Set how time works in your world, including daylight and date formatting.

### Time Structure

- **Days Per Year** — Computed automatically from months (display only)
- **Hours Per Day** — Number of hours in one day (default: 24)
- **Minutes Per Hour** — Number of minutes per hour (default: 60)
- **Seconds Per Minute** — Number of seconds per minute (default: 60)
- **Seconds Per Round** — Combat round duration in seconds (default: 6)

> **Warning**: Changing time settings affects how Foundry's world time is interpreted. Existing timestamps may display differently.

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

| Column | Description |
|--------|-------------|
| **Name** | Period name (e.g., "Matins") |
| **Abbreviation** | Short form |
| **Start Hour** | When this period begins (0-23) |
| **End Hour** | When this period ends (0-23) |

### Date Formats

Customize how dates and times display using template variables.

| Format | Purpose | Example Output |
|--------|---------|----------------|
| **Short** | Compact date display | "15 Jan 1492" |
| **Long** | Detailed date display | "15th of January, 1492" |
| **Full** | Complete date with weekday | "Sunday, 15th of January, 1492" |
| **Time** | 24-hour time format | "14:30" |
| **Time (12-hour)** | 12-hour time format | "2:30 PM" |

---

## Seasons Tab

Define seasonal periods with visual styling.

### Season Type

- **Dated** — Seasons have fixed start and end dates (e.g., Spring starts March 20)
- **Periodic** — Seasons cycle by duration in days (e.g., 91 days each)

### Season Offset (Periodic Only)

- **Offset** — Number of days into the year before the first season begins

### Season Fields

| Field | Description |
|-------|-------------|
| **Name** | Season name (e.g., "Spring") |
| **Abbreviation** | Short form |
| **Icon** | Font Awesome class (e.g., `fas fa-leaf`) |
| **Color** | Color picker for visual theming |

#### Dated Season Fields

- **Start Month/Day** — When this season begins
- **End Month/Day** — When this season ends

#### Periodic Season Fields

- **Duration** — Number of days this season lasts

### Season Controls

- **Add** (+) — Insert a new season after this one
- **Remove** (−) — Delete this season

---

## Eras Tab

Define historical periods for your calendar.

### Era Fields

| Column | Description |
|--------|-------------|
| **Name** | Era name (e.g., "Age of Humanity") |
| **Abbreviation** | Short form (e.g., "AH") |
| **Start Year** | First year of this era |
| **End Year** | Last year of this era (leave blank for ongoing) |
| **Format** | How years display: Before/After, prefix, suffix, etc. |

### Era Template
<!-- TODO: Convert to new formatting system -->
- **Template** — Custom format string for year display using placeholders:
  - `{{year}}` — The year number
  - `{{abbreviation}}` — Era abbreviation
  - Example: `{{year}} {{abbreviation}}` → "1492 DR"
- **Preview** — Live preview of the template output

### Era Controls

- **Add** (+) — Insert a new era after this one
- **Remove** (−) — Delete this era

---

## Festivals Tab

Create holidays and special days that appear on the calendar.

### Festival Fields

| Column | Description |
|--------|-------------|
| **Name** | Festival name (e.g., "Midwinter") |
| **Month** | Which month the festival falls in |
| **Day** | Day of the month |
| **Leap Year Only** | Checkbox — festival only occurs in leap years |
| **Counts for Weekday** | Checkbox — whether this day advances weekday counting (uncheck for intercalary days that exist "outside" normal weeks) |

### Festival Controls

- **Add** (+) — Insert a new festival after this one
- **Remove** (−) — Delete this festival

Festivals appear as indicators on the calendar grid and in the day detail view.

---

## Moons Tab

Add one or more moons with customizable phases.

### Moon Fields

| Field | Description |
|-------|-------------|
| **Name** | Moon name (e.g., "Selûne") |
| **Cycle Length** | Days for a complete lunar cycle (new moon to new moon). Earth's moon is ~29.5 days. |
| **Color** | Tint color for the moon icon |

### Reference Date

A known date when the moon was at a specific phase (typically new moon at day 0 of the cycle).

- **Year** — Reference year
- **Month** — Reference month
- **Day** — Reference day
- **Cycle Day Adjust** — Offset in days to fine-tune phase alignment
- **Hidden** — Checkbox to hide this moon from players (GM only)

### Moon Phases

Define the phases of the lunar cycle. Each phase covers a percentage range of the cycle.

| Column | Description |
|--------|-------------|
| **Icon** | Click to pick a phase icon (SVG or emoji) |
| **Phase** | Phase name (e.g., "Full Moon") |
| **Rising** | Name for the transitional sub-phase as the moon approaches this phase |
| **Fading** | Name for the transitional sub-phase as the moon leaves this phase |
| **Start %** | Percentage through the cycle when this phase begins |
| **End %** | Percentage through the cycle when this phase ends |

### Moon & Phase Controls

- **Add Moon** (+) — Add a new moon
- **Remove Moon** (−) — Delete this moon
- **Add Phase** (+) — Add a phase to this moon
- **Remove Phase** (−) — Delete this phase

---

## Cycles Tab
<!-- TODO: Convert to new formatting system -->
Create repeating patterns like zodiac signs, elemental weeks, or numbered years.

### Cycle Format

- **Cycle Format** — Template string for displaying cycle values using placeholders like `{{CycleName}}`

### Cycle Fields

| Field | Description |
|-------|-------------|
| **Name** | Cycle name (e.g., "Zodiac") |
| **Length** | How many entries before the cycle repeats |
| **Offset** | Starting offset (which entry is "first") |
| **Based On** | What unit drives the cycle: Day, Month, or Year |

### Cycle Entries

Each cycle has numbered entries that repeat in order.

- **Entry Name** — Name for this position in the cycle (e.g., "Year of the Dragon")

### Cycle Controls

- **Add Cycle** (+) — Add a new cycle
- **Remove Cycle** (−) — Delete this cycle
- **Add Entry** (+) — Add an entry to this cycle
- **Remove Entry** (−) — Delete this entry

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

| Field | Description |
|-------|-------------|
| **Enabled** | Checkbox — include this weather in random generation |
| **Icon** | Visual indicator (display only) |
| **Name** | Weather condition name (display only) |
| **Chance** | Percentage chance when rolling weather (0-100%) |
| **Temp Min/Max** | Temperature range modifiers for this condition |

### Weather Preset Actions

- **Description** (comment icon) — Toggle description popover for custom flavor text
- **Reset** (undo icon) — Restore this preset to default values

### Total Chance

Displays the sum of all enabled weather chances. Shows a warning if the total doesn't equal 100%.

---

## Saving Your Calendar

Click **Save** to store your calendar. Options:

- **Set as Active** — Switch to this calendar immediately (reloads the world)
- **Save as New** — Create a copy with a new name

### Editing Built-in Calendars

When you modify a bundled calendar, Calendaria saves your changes as an override. Click **Reset to Default** to restore the original.

---

## Tips

- Start with a bundled calendar close to what you need, then customize
- Use the **Renescara** calendar as a reference for advanced features
- Test your calendar before using it in a live game
