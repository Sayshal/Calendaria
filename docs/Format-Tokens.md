# Format Tokens

Format tokens are placeholders used in display format strings.

---

## Year

| Token        | Description                                                        |
| ------------ | ------------------------------------------------------------------ |
| `Y`          | Year (541, 2026)                                                   |
| `YY`         | Year, 2-digit (26 from 2026)                                       |
| `YYYY`       | Year, 4-digit (2026)                                               |
| `[yearName]` | Named year (e.g., "Year of the Dragon") — empty if no name defined |

---

## Month

| Token  | Description                       |
| ------ | --------------------------------- |
| `M`    | Month index (1, 6, 12)            |
| `MM`   | Month index, 2-digit (01, 06, 12) |
| `MMM`  | Month short (Jan, Jun, Dec)       |
| `MMMM` | Month full (January, December)    |
| `Mo`   | Month ordinal (1st, 6th, 12th)    |

---

## Day

| Token | Description                          |
| ----- | ------------------------------------ |
| `D`   | Day of month (1, 15, 31)             |
| `DD`  | Day of month, 2-digit (01, 15, 31)   |
| `Do`  | Day ordinal (1st, 15th, 31st)        |
| `DDD` | Day of year, 3-digit (001, 166, 365) |

---

## Weekday

| Token   | Description                         |
| ------- | ----------------------------------- |
| `EEEE`  | Weekday full (Monday, Tuesday)      |
| `EEE`   | Weekday short (Mon, Tue, Wed)       |
| `EE`    | Weekday short (Mon, Tue, Wed)       |
| `E`     | Weekday short (Mon, Tue, Wed)       |
| `EEEEE` | Weekday narrow (M, T, W)            |
| `e`     | Weekday index (0, 1, 2, 3, 4, 5, 6) |

---

## Week

| Token             | Description                                |
| ----------------- | ------------------------------------------ |
| `w`               | Week of year (1, 26, 52)                   |
| `ww`              | Week of year, 2-digit (01, 26, 52)         |
| `W`               | Week of month (1, 2, 3, 4, 5)              |
| `[namedWeek]`     | Named week name (e.g., "Week of the Wolf") |
| `[namedWeekAbbr]` | Named week abbreviation                    |

---

## Time

| Token            | Description                                            |
| ---------------- | ------------------------------------------------------ |
| `H`              | Hour 24h (0, 14, 23)                                   |
| `HH`             | Hour 24h, 2-digit (00, 14, 23)                         |
| `h`              | Hour 12h (1, 2, 12)                                    |
| `hh`             | Hour 12h, 2-digit (01, 02, 12)                         |
| `m`              | Minute (0, 30, 59)                                     |
| `mm`             | Minute, 2-digit (00, 30, 59)                           |
| `s`              | Second (0, 30, 59)                                     |
| `ss`             | Second, 2-digit (00, 30, 59)                           |
| `A`              | Meridiem abbreviated uppercase (AM, PM)                |
| `a`              | Meridiem abbreviated lowercase (am, pm)                |
| `[meridiemFull]` | Full meridiem label (e.g., "Ante Meridiem", "Sunward") |

---

## Era

| Token           | Description                                              |
| --------------- | -------------------------------------------------------- |
| `GGGG`          | Era full (Anno Domini)                                   |
| `GGG`           | Era short (AD, BC)                                       |
| `GG`            | Era short (AD, BC)                                       |
| `G`             | Era short (AD, BC)                                       |
| `[yearInEra]`   | Year within era (1, 541)                                 |
| `[era=N]`       | Full name of the Nth matching era (for overlapping eras) |
| `[eraAbbr=N]`   | Abbreviation of the Nth matching era                     |
| `[yearInEra=N]` | Year within the Nth matching era                         |

---

## Season & Climate

| Token  | Description                             |
| ------ | --------------------------------------- |
| `QQQQ` | Season full (Spring, Summer)            |
| `QQQ`  | Season short (Spr, Sum, Aut, Win)       |
| `QQ`   | Season index, 2-digit (01, 02, 03, 04)  |
| `Q`    | Season index (1, 2, 3, 4)               |
| `zzzz` | Climate zone full (Temperate, Tropical) |
| `z`    | Climate zone short (Tmp, Tro)           |

---

## Fantasy

| Token          | Description                                                                   |
| -------------- | ----------------------------------------------------------------------------- |
| `[moon]`       | Moon phase (Full Moon, New Moon)                                              |
| `[moonIcon]`   | Moon phase icon (use `[moonIcon=0]` or `[moonIcon='Name']` for specific moon) |
| `[ch]`         | Canonical hour (Matins, Vespers)                                              |
| `[chAbbr]`     | Canonical hour short (Mat, Ves)                                               |
| `[cycle]`      | Cycle number (1, 2, 3)                                                        |
| `[cycleName]`  | Cycle name                                                                    |
| `[cycleRoman]` | Cycle roman numeral (I, II, III)                                              |
| `[approxTime]` | Approximate time (Dawn, Noon, Dusk)                                           |
| `[approxDate]` | Approximate date (Early Spring)                                               |

---

## Syntax

Combine tokens to create custom formats:

- `D MMM` → 15 Jan
- `D MMMM, Y` → 15 January, 2026
- `EEEE, D MMMM Y` → Thursday, 15 January 2026
- `HH:mm` → 14:30
- `h:mm A` → 2:30 PM

Use square brackets `[]` to include literal text:

- `[Year of] YYYY` → Year of 2026
- `[The] Do [of] MMMM` → The 5th of January

### Pipe Fallback

Use the pipe `|` **(shift + \)** character inside bracket tokens to define a fallback when the primary value is empty:

- `[yearName|YYYY]` → Shows the year name if defined, otherwise the 4-digit year
- `[namedWeek|w]` → Shows the named week if defined, otherwise the week number
- `[era|]` → Shows the era name if defined, otherwise nothing

> [!NOTE]
> Custom tokens like `[moon]`, `[cycle]`, etc. use brackets but are recognized as tokens, not literals.

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

| Preset       | Format         | Example                |
| ------------ | -------------- | ---------------------- |
| `dateShort`  | D MMM          | 5 Jan                  |
| `dateMedium` | D MMMM         | 5 January              |
| `dateLong`   | D MMMM, Y      | 5 January, 2026        |
| `dateFull`   | EEEE, D MMMM Y | Monday, 5 January 2026 |

### Regional Dates

| Preset          | Format          | Example                 |
| --------------- | --------------- | ----------------------- |
| `dateUS`        | MMMM D, Y       | January 5, 2026         |
| `dateUSFull`    | EEEE, MMMM D, Y | Monday, January 5, 2026 |
| `dateISO`       | YYYY-MM-DD      | 2026-01-05              |
| `dateNumericUS` | MM/DD/YYYY      | 01/05/2026              |
| `dateNumericEU` | DD/MM/YYYY      | 05/01/2026              |

### Ordinal/Fantasy

| Preset        | Format                   | Example                                    |
| ------------- | ------------------------ | ------------------------------------------ |
| `ordinal`     | Do of MMMM               | 5th of January                             |
| `ordinalLong` | Do of MMMM, Y            | 5th of January, 2026                       |
| `ordinalEra`  | Do of MMMM, Y GGGG       | 5th of January, 2026 Age of Heroes         |
| `ordinalFull` | EEEE, Do of MMMM, Y GGGG | Monday, 5th of January, 2026 Age of Heroes |
| `seasonDate`  | QQQQ, Do of MMMM         | Winter, 5th of January                     |

### Time

| Preset      | Format    | Example    |
| ----------- | --------- | ---------- |
| `time12`    | h:mm A    | 9:30 AM    |
| `time12Sec` | h:mm:ss A | 9:30:45 AM |
| `time24`    | HH:mm     | 09:30      |
| `time24Sec` | HH:mm:ss  | 09:30:45   |

### DateTime

| Preset            | Format           | Example                 |
| ----------------- | ---------------- | ----------------------- |
| `datetimeShort12` | D MMM, h:mm A    | 5 Jan, 9:30 AM          |
| `datetimeShort24` | D MMM, HH:mm     | 5 Jan, 09:30            |
| `datetime12`      | D MMMM Y, h:mm A | 5 January 2026, 9:30 AM |
| `datetime24`      | D MMMM Y, HH:mm  | 5 January 2026, 09:30   |

---

## In-App Reference

This same information is available in-app by clicking the **Token Reference** button on the Calendar Editor's Display tab or the help icon (?) next to any Display Formats section in the Settings Panel. The Display tab also provides live preview feedback as you type format strings.
