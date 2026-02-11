# Eras and Cycles

## Eras

Eras define historical periods with custom year formatting. Configure eras in the **Calendar Editor > Eras** tab.

### Era Fields

| Field        | Description                            |
| ------------ | -------------------------------------- |
| Name         | Full era name (e.g., "Dale Reckoning") |
| Abbreviation | Short form (e.g., "DR")                |
| Start Year   | First year of this era                 |
| End Year     | Last year (leave empty if ongoing)     |

### Overlapping Eras

Eras may overlap — multiple eras can cover the same year range. When eras overlap, use indexed format tokens to reference a specific matching era by position.

### Era Resolution

When displaying a year, Calendaria finds all matching eras by checking which eras contain that year. The `yearInEra` is calculated as `displayYear - startYear + 1`.

### Displaying Eras in Date Formats

Use era format tokens in date format strings to include era information:

| Token           | Description                                              |
| --------------- | -------------------------------------------------------- |
| `G`             | Era abbreviation (e.g., DR)                              |
| `GGGG`          | Full era name (e.g., Dale Reckoning)                     |
| `[era=N]`       | Full name of the Nth matching era (for overlapping eras) |
| `[eraAbbr=N]`   | Abbreviation of the Nth matching era                     |
| `[yearInEra=N]` | Year within the Nth matching era                         |

Examples:

- `Y G` produces "1492 DR"
- `Do of MMMM, Y GGGG` produces "15th of Hammer, 1492 Dale Reckoning"
- `[era=1] / [era=2]` produces "Dale Reckoning / Age of Mortals" when both eras overlap

---

## Cycles

Cycles are repeating sequences (zodiac signs, elemental weeks, etc.). Configure cycles in the **Calendar Editor > Cycles** tab.

### Cycle Fields

| Field    | Description                              |
| -------- | ---------------------------------------- |
| Name     | Cycle name (e.g., "Zodiac")              |
| Length   | How many stages before the cycle repeats |
| Offset   | Starting offset for calculation          |
| Based On | Time unit driving the cycle              |
| Stages   | List of cycle stages with names          |

### Based On Options

| Value      | Description                   |
| ---------- | ----------------------------- |
| `year`     | Calendar year                 |
| `eraYear`  | Year within current era       |
| `month`    | Month index                   |
| `monthDay` | Day of month                  |
| `day`      | Absolute day count from epoch |
| `yearDay`  | Day of year                   |

### Display Format

The cycle format field controls how cycles appear in the UI. Use numbered placeholders for each cycle:

- `[1]`, `[2]`, etc. — Current entry name for each cycle
- `[n]` — Line break

Example: `[1] - Week of [2]` produces "Gemini - Week of Fire"

> [!TIP]
> To display era and cycle information in date format strings, use the format tokens documented in [Format Tokens](Format-Tokens).

---

## For Developers

See [API Reference](API-Reference#eras-and-cycles) for era and cycle methods.
