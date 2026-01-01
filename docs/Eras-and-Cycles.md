# Eras and Cycles

## Eras

Eras define historical periods with custom year formatting. Each era has:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Full era name (e.g., "Dale Reckoning") |
| `abbreviation` | string | Short form (e.g., "DR") |
| `startYear` | number | First year of this era |
| `endYear` | number | Last year (optional, leave empty if ongoing) |
| `format` | string | `prefix` or `suffix` - position of abbreviation relative to year |
| `template` | string | Custom template (overrides format if set) |

### Era Resolution

When displaying a year, Calendaria finds the matching era by:
1. Sorting eras by `startYear` descending
2. Finding the first era where `displayYear >= startYear` and `displayYear <= endYear` (or endYear is null)
3. If no match, falls back to the first era in the list

The `yearInEra` is calculated as `displayYear - startYear + 1`.

### Template Variables

Custom templates support these placeholders:

| Placeholder | Description |
|-------------|-------------|
| `{{year}}` | Absolute display year |
| `{{yearInEra}}` | Year within the current era |
| `{{short}}` / `{{abbreviation}}` | Era abbreviation |
| `{{era}}` / `{{name}}` | Full era name |

Examples:
- `{{year}} {{short}}` produces "1492 DR"
- `{{short}} {{yearInEra}}` produces "DR 5"
- `Year {{yearInEra}} of the {{era}}` produces "Year 5 of the Third Age"

When no template is set, the `format` field controls output:
- `suffix`: "1492 DR"
- `prefix`: "DR 1492"

---

## Cycles

Cycles are repeating sequences (zodiac signs, elemental weeks, etc.). Each cycle has:

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Cycle name (e.g., "Zodiac") |
| `length` | number | How many units before advancing to next entry |
| `offset` | number | Starting offset for calculation |
| `basedOn` | string | Time unit driving the cycle |
| `entries` | array | List of entries with `name` property |

### basedOn Options

| Value | Description |
|-------|-------------|
| `year` | Calendar year (with yearZero applied) |
| `eraYear` | Year within current era |
| `month` | Month index (0-based) |
| `monthDay` | Day of month |
| `day` | Absolute day count from epoch |
| `yearDay` | Day of year |

### Cycle Calculation

The current entry is determined by:
```javascript
epochValue = epochValues[cycle.basedOn];
let cycleNum = Math.floor(epochValue / cycle.length);
// Handle negative epoch values
if (cycleNum < 0) {
  cycleNum += Math.ceil(Math.abs(epochValue) / cycle.entries.length) * cycle.entries.length;
}
const cycleIndex = (cycleNum + Math.floor((cycle.offset || 0) / cycle.length)) % cycle.entries.length;
// Normalize to ensure positive index
const normalizedIndex = ((cycleIndex % cycle.entries.length) + cycle.entries.length) % cycle.entries.length;
```

### Display Format

The `cycleFormat` field controls how cycles appear. Placeholders:
- `{{1}}`, `{{2}}`, etc. - current entry name for each cycle
- `{{n}}` - line break

Example: `{{1}} - Week of {{2}}`

---

## API

### getCycleValues()

Returns current cycle state.

```javascript
const result = CALENDARIA.api.getCycleValues();
// Returns: { text: "Gemini - Week of Fire", values: [...] }
```

The `values` array contains objects with:
- `cycleName` - name of the cycle
- `entryName` - current entry name
- `index` - current entry index

### getCurrentEra()

Returns current era data. This is a method on the calendar instance, not the public API.

```javascript
const calendar = CALENDARIA.api.getActiveCalendar();
const era = calendar.getCurrentEra();
// Returns: { name, abbreviation, format, template, yearInEra }
```

### formatYearWithEra()

Formats a year using era configuration. This is a method on the calendar instance, not the public API.

```javascript
const calendar = CALENDARIA.api.getActiveCalendar();
const formatted = calendar.formatYearWithEra(1492);
// Returns: "1492 DR"
```
