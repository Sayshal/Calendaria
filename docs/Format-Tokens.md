# Format Tokens

Format tokens are placeholders used in display format strings. Use tokens directly: `YYYY`, `MMMM`, `HH:mm`

---

## Year Tokens

| Token  | Description  | Example |
| ------ | ------------ | ------- |
| `YYYY` | Full year    | 2026    |
| `YY`   | 2-digit year | 26      |

---

## Month Tokens

| Token  | Description       | Example |
| ------ | ----------------- | ------- |
| `MMMM` | Full month name   | January |
| `MMM`  | Abbreviated month | Jan     |
| `MM`   | 2-digit month     | 01      |
| `M`    | Month number      | 1       |

---

## Day Tokens

| Token | Description | Example |
| ----- | ----------- | ------- |
| `DD`  | 2-digit day | 05      |
| `D`   | Day number  | 5       |
| `Do`  | Ordinal day | 5th     |

---

## Weekday Tokens

| Token  | Description         | Example |
| ------ | ------------------- | ------- |
| `EEEE` | Full weekday        | Monday  |
| `EEE`  | Abbreviated weekday | Mon     |
| `E`    | Weekday number      | 1       |

---

## Week Tokens

| Token | Description         | Example |
| ----- | ------------------- | ------- |
| `ww`  | 2-digit week number | 03      |
| `w`   | Week number         | 3       |

---

## Time Tokens

| Token | Description      | Example |
| ----- | ---------------- | ------- |
| `HH`  | 24-hour (padded) | 09, 14  |
| `H`   | 24-hour          | 9, 14   |
| `hh`  | 12-hour (padded) | 09, 02  |
| `h`   | 12-hour          | 9, 2    |
| `mm`  | Minutes (padded) | 05      |
| `m`   | Minutes          | 5       |
| `ss`  | Seconds (padded) | 08      |
| `s`   | Seconds          | 8       |
| `A`   | AM/PM            | AM, PM  |
| `a`   | am/pm            | am, pm  |

---

## Era Tokens

| Token  | Description      | Example       |
| ------ | ---------------- | ------------- |
| `GGGG` | Full era name    | Age of Heroes |
| `GGG`  | Era abbreviation | AoH           |
| `GG`   | Era short form   | AH            |

---

## Season Tokens

| Token  | Description         | Example |
| ------ | ------------------- | ------- |
| `QQQQ` | Full season name    | Summer  |
| `QQQ`  | Season abbreviation | Sum     |

---

## Fantasy Tokens

| Token  | Description            | Example   |
| ------ | ---------------------- | --------- |
| `FFFF` | Festival name (if any) | Midsummer |

---

## Stopwatch Tokens

| Token | Description      | Example |
| ----- | ---------------- | ------- |
| `HH`  | Hours (padded)   | 01      |
| `mm`  | Minutes (padded) | 30      |
| `ss`  | Seconds (padded) | 45      |
| `SSS` | Milliseconds     | 123     |

---

## Escape Syntax

Use square brackets `[]` to include literal text that won't be parsed as tokens:

- `[Year of] YYYY` outputs `Year of 2026`
- `[The] Do [of] MMMM` outputs `The 5th of January`

Text inside square brackets is preserved exactly as written.

---

## Preset Formats

### Utility

| Preset            | Description                               |
| ----------------- | ----------------------------------------- |
| `off`             | Hide the element entirely                 |
| `calendarDefault` | Use the active calendar's built-in format |
| `custom`          | User-defined format string                |

### Approximate

| Preset       | Description                                 |
| ------------ | ------------------------------------------- |
| `approxDate` | Approximate date (e.g., "Midsummer")        |
| `approxTime` | Approximate time of day (e.g., "Afternoon") |

### Standard Dates

| Preset       | Format            | Example                |
| ------------ | ----------------- | ---------------------- |
| `dateShort`  | D MMM             | 5 Jan                  |
| `dateMedium` | D MMMM            | 5 January              |
| `dateLong`   | D MMMM, YYYY      | 5 January, 2026        |
| `dateFull`   | EEEE, D MMMM YYYY | Monday, 5 January 2026 |

### Regional Dates

| Preset          | Format             | Example                 |
| --------------- | ------------------ | ----------------------- |
| `dateUS`        | MMMM D, YYYY       | January 5, 2026         |
| `dateUSFull`    | EEEE, MMMM D, YYYY | Monday, January 5, 2026 |
| `dateISO`       | YYYY-MM-DD         | 2026-01-05              |
| `dateNumericUS` | MM/DD/YYYY         | 01/05/2026              |
| `dateNumericEU` | DD/MM/YYYY         | 05/01/2026              |

### Ordinal/Fantasy

| Preset        | Format                      | Example                                    |
| ------------- | --------------------------- | ------------------------------------------ |
| `ordinal`     | Do of MMMM                  | 5th of January                             |
| `ordinalLong` | Do of MMMM, YYYY            | 5th of January, 2026                       |
| `ordinalEra`  | Do of MMMM, YYYY GGGG       | 5th of January, 2026 Age of Heroes         |
| `ordinalFull` | EEEE, Do of MMMM, YYYY GGGG | Monday, 5th of January, 2026 Age of Heroes |
| `seasonDate`  | QQQQ, Do of MMMM            | Winter, 5th of January                     |

### Time

| Preset      | Format    | Example    |
| ----------- | --------- | ---------- |
| `time12`    | h:mm A    | 9:30 AM    |
| `time12Sec` | h:mm:ss A | 9:30:45 AM |
| `time24`    | HH:mm     | 09:30      |
| `time24Sec` | HH:mm:ss  | 09:30:45   |

### DateTime

| Preset            | Format              | Example                 |
| ----------------- | ------------------- | ----------------------- |
| `datetimeShort12` | D MMM, h:mm A       | 5 Jan, 9:30 AM          |
| `datetimeShort24` | D MMM, HH:mm        | 5 Jan, 09:30            |
| `datetime12`      | D MMMM YYYY, h:mm A | 5 January 2026, 9:30 AM |
| `datetime24`      | D MMMM YYYY, HH:mm  | 5 January 2026, 09:30   |

---

## In-App Reference

This same information is available in-app by clicking the help icon (?) next to any Display Formats section in the Settings Panel.
