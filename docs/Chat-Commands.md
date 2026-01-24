# Chat Commands

Calendaria provides 11 slash commands for interacting with the calendar directly from chat.

---

## Available Commands

| Command     | Description                   | Permission       |
| ----------- | ----------------------------- | ---------------- |
| `/date`     | Display current date          | Everyone         |
| `/time`     | Display current time          | Everyone         |
| `/today`    | Display full date and time    | Everyone         |
| `/sunrise`  | Display today's sunrise time  | Everyone         |
| `/sunset`   | Display today's sunset time   | Everyone         |
| `/moon`     | Display current moon phase(s) | Everyone         |
| `/season`   | Display current season        | Everyone         |
| `/weather`  | Display current weather       | Everyone         |
| `/note`     | Create a quick note           | Note permissions |
| `/advance`  | Advance time                  | GM only          |
| `/calendar` | Open the calendar             | Everyone         |

---

## Command Reference

### /date

Display the current in-game date.

```text
/date
/date EEEE, MMMM Do
```

**Arguments:**

- Optional format string using [format tokens](Format-Tokens)

**Output:** Formatted date posted to chat.

---

### /time

Display the current in-game time.

```text
/time
/time HH:mm:ss
```

**Arguments:**

- Optional format string using [format tokens](Format-Tokens)

**Output:** Formatted time posted to chat.

---

### /today

Display the complete current date and time.

```text
/today
```

**Output:** Full date and time summary posted to chat.

---

### /sunrise

Display today's sunrise time.

```text
/sunrise
/sunrise h:mm A
```

**Arguments:**

- Optional format string using [format tokens](Format-Tokens)

**Output:** Formatted sunrise time for the current day.

---

### /sunset

Display today's sunset time.

```text
/sunset
/sunset h:mm A
```

**Arguments:**

- Optional format string using [format tokens](Format-Tokens)

**Output:** Formatted sunset time for the current day.

---

### /moon

Display current moon phase information.

```text
/moon
```

**Output:** Moon name(s) and current phase(s) for all moons in the active calendar.

---

### /season

Display the current season.

```text
/season
```

**Output:** Current season name and icon.

---

### /weather

Display the current weather conditions.

```text
/weather
```

**Output:** Weather condition, icon, and temperature.

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

**Output:** Creates a calendar note and confirms in chat.

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
| month  | months                |
| year   | years, y              |
| round  | rounds, r             |

**Examples:**

```text
/advance 8 hours       # Skip to 8 hours later
/advance 1 week        # Advance one week
/advance 10 rounds     # Advance 10 combat rounds
/advance 30 m          # Advance 30 minutes
```

**Output:** Advances time and posts confirmation to chat.

---

### /calendar

Open the BigCal application.

```text
/calendar
```

**Output:** Opens the BigCal window.

---

## Output Format

All chat commands produce rich HTML messages with:

- Formatted text with icons
- Calendar-themed styling
- Clickable elements where applicable
