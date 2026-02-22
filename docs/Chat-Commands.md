# Chat Commands

Calendaria provides 20 slash commands for interacting with the calendar directly from chat. All commands and aliases work natively without any additional modules.

If the [Chat Commander](https://foundryvtt.com/packages/_chatcommands) module is installed, commands gain enhanced autocomplete with format presets and calendar suggestions.

---

## Available Commands

| Command      | Alias     | Description                           | Permission       |
| ------------ | --------- | ------------------------------------- | ---------------- |
| `/date`      | `/d`      | Display current date                  | Everyone         |
| `/time`      | `/t`      | Display current time                  | Everyone         |
| `/datetime`  | `/dt`     | Display current date and time         | Everyone         |
| `/today`     |           | List today's notes                    | Everyone         |
| `/sunrise`   |           | Display today's sunrise time          | Everyone         |
| `/sunset`    |           | Display today's sunset time           | Everyone         |
| `/moon`      |           | Display current moon phase(s)         | Everyone         |
| `/season`    |           | Display current season                | Everyone         |
| `/weather`   | `/w`      | Display current or historical weather | Everyone         |
| `/forecast`  | `/fc`     | Display weather forecast              | Permission-gated |
| `/weekday`   |           | Display current weekday               | Everyone         |
| `/festival`  |           | Display current festival              | Everyone         |
| `/cycle`     | `/zodiac` | Display zodiac/cycle values           | Everyone         |
| `/calendar`  | `/cal`    | Display full calendar summary         | Everyone         |
| `/calendars` | `/cals`   | List all available calendars          | Everyone         |
| `/note`      | `/n`      | Create a quick note                   | Note permissions |
| `/advance`   | `/adv`    | Advance time                          | GM only          |
| `/setdate`   |           | Set date (year month day)             | GM only          |
| `/settime`   |           | Set time (hour minute [second])       | GM only          |
| `/switchcal` |           | Switch active calendar                | GM only          |

---

## Command Reference

### /date

Display the current in-game date.

```text
/date
/date dateLong
/date EEEE, MMMM Do
```

**Arguments:**

- Optional format preset or custom format string using [format tokens](Format-Tokens)

**Output:** Formatted date posted to chat.

---

### /time

Display the current in-game time.

```text
/time
/time time12
/time HH:mm:ss
```

**Arguments:**

- Optional format preset or custom format string using [format tokens](Format-Tokens)

**Output:** Formatted time posted to chat.

---

### /datetime

Display the current in-game date and time.

```text
/datetime
/datetime datetime12
/datetime EEEE, D MMMM Y - h:mm A
```

**Arguments:**

- Optional format preset or custom format string using [format tokens](Format-Tokens)

**Output:** Formatted date and time posted to chat.

---

### /today

List all notes for the current day.

```text
/today
```

**Output:** List of today's calendar notes with times.

---

### /sunrise

Display today's sunrise time.

```text
/sunrise
/sunrise time12
/sunrise h:mm A
```

**Arguments:**

- Optional format preset or custom format string using [format tokens](Format-Tokens)

**Output:** Formatted sunrise time for the current day.

---

### /sunset

Display today's sunset time.

```text
/sunset
/sunset time12
/sunset h:mm A
```

**Arguments:**

- Optional format preset or custom format string using [format tokens](Format-Tokens)

**Output:** Formatted sunset time for the current day.

---

### /moon

Display current moon phase information.

```text
/moon
/moon 0
```

**Arguments:**

- Optional moon index (0-based) to display a specific moon

**Output:** Moon name(s) and current phase(s) for all moons (or specified moon) in the active calendar.

---

### /season

Display the current season.

```text
/season
```

**Output:** Current season name and icon.

---

### /weather

Display current or historical weather conditions.

```text
/weather
/weather 1492 7 15
```

**Arguments:**

- Optional: `year month day` — look up weather for a specific historical date

**Examples:**

```text
/weather                # Current weather
/weather 1492 7 15      # Weather on Flamerule 15, 1492
```

**Output:** Weather condition with icon, temperature, wind, and precipitation. Historical lookups pull from the weather history.

---

### /forecast

Display weather forecast for upcoming days.

```text
/forecast
/forecast 14
/fc
```

**Aliases:** `/fc`

**Arguments:**

- Optional: Number of days to forecast (default: configured Forecast Days setting)

**Output:** Forecast entries showing icon, day, weather label, and temperature for each upcoming day. Includes zone name subtitle.

**Permission:** Requires the `viewWeatherForecast` permission (see [Permissions](Permissions)). GMs always see the accurate forecast; non-GM users see variance-adjusted results.

---

### /weekday

Display the current weekday.

```text
/weekday
```

**Output:** Current weekday name, with rest day indicator if applicable.

---

### /festival

Display the current festival (if any).

```text
/festival
```

**Output:** Current festival name and icon, or "No festival today" message.

---

### /cycle

Display current zodiac/cycle values.

```text
/cycle
```

**Output:** All active cycle values for the current date.

---

### /calendar

Display a full calendar summary.

```text
/calendar
```

**Output:** Comprehensive summary including date, time, season, weather, moons, and daylight hours.

---

### /calendars

List all available calendars.

```text
/calendars
```

**Output:** List of all configured calendars with the active one marked.

---

### /note

Create a quick calendar note for today.

```text
/note "Meeting with the Council"
/note "Dragon Attack" "The red dragon Scorlax attacked the village"
```

**Arguments:**

1. Note title (required, in quotes)
2. Note content (optional, in quotes)

**Output:** Creates a calendar note silently.

---

### /advance

Advance the world time by a specified amount. GM only.

```text
/advance 2 hours
/advance 1 day
/advance 30 minutes
```

**Arguments:**

- Amount (number)
- Unit (see table below)

**Supported Units:**

| Unit   | Aliases               |
| ------ | --------------------- |
| second | seconds, sec, secs, s |
| minute | minutes, min, mins, m |
| hour   | hours, hr, hrs, h     |
| day    | days, d               |
| week   | weeks, w              |
| month  | months, mo            |
| year   | years, yr, yrs, y     |
| round  | rounds, rd            |

**Examples:**

```text
/advance 8 hours       # Skip to 8 hours later
/advance 1 week        # Advance one week
/advance 10 rounds     # Advance 10 combat rounds
/advance 30 m          # Advance 30 minutes
```

**Output:** Advances time silently.

---

### /setdate

Set the calendar to a specific date. GM only.

```text
/setdate 1492 3 15
```

**Arguments:**

- Year (number)
- Month (number, 1-indexed)
- Day (number)

**Output:** Sets the date silently.

---

### /settime

Set the calendar to a specific time. GM only.

```text
/settime 14 30
/settime 14 30 0
```

**Arguments:**

- Hour (number, 0-23)
- Minute (number, 0-59)
- Second (optional, number, 0-59)

**Output:** Sets the time silently.

---

### /switchcal

Switch to a different calendar. GM only.

```text
/switchcal forgotten-realms
```

**Arguments:**

- Calendar ID

With Chat Commander active, autocomplete shows available calendars.

**Output:** Switches the active calendar silently.

---

## Chat Commander Integration

When the [Chat Commander](https://foundryvtt.com/packages/_chatcommands) module is active, Calendaria commands gain:

- **Autocomplete suggestions** for format presets on `/date`, `/time`, `/datetime`, `/sunrise`, `/sunset`
- **Calendar list autocomplete** for `/switchcal`
- **Hint text** linking to the Format Tokens wiki for custom formats
- **Icons** for each command in the command menu

---

## Output Format

All chat commands produce rich HTML messages with:

- Formatted text with icons
- Calendar-themed styling
- Clickable elements where applicable
