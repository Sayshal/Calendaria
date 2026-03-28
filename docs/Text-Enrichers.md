# Text Enrichers

Calendaria provides inline enrichers for journals, chat, items, and anywhere Foundry renders rich text.

```text
[[cal.<type>]]                 → basic
[[cal.<type> <params>]]        → with parameters
[[cal.<type>]]{Custom Label}   → custom display label
[[cal.<type> cal=<id>]]        → cross-calendar query
```

> [!TIP]
> Custom labels replace the display text but the tooltip still shows the real value. Custom labels disable live updates.

---

## Date & Time

### date

Display a date. Clickable — navigates calendar to that date.

```text
[[cal.date]]                 → 5 Shadowmoon, 1499
[[cal.date 15 Mirtul 1492]]  → 15 Mirtul, 1492
[[cal.date 15 5 1492]]       → 15 Mirtul, 1492
[[cal.date format=dateFull]] → Mercday, 5 Shadowmoon 1499
[[cal.date approx=true]]     → Late Winter
[[cal.date time=true]]       → 5 Shadowmoon 1499, 14:30
```

| Parameter  | Type             | Description                                                |
| ---------- | ---------------- | ---------------------------------------------------------- |
| positional | `day month year` | Specific date (month name or index). Omit for current date |
| `format`   | `string`         | Format preset or token string                              |
| `approx`   | `boolean`        | Approximate date description                               |
| `time`     | `boolean`        | Include time                                               |

---

### time

Display the current time.

```text
[[cal.time]]              → 14:30
[[cal.time 12h=true]]     → 2:30 PM
[[cal.time approx=true]]  → Afternoon
```

| Parameter | Type      | Description             |
| --------- | --------- | ----------------------- |
| `12h`     | `boolean` | 12-hour format          |
| `approx`  | `boolean` | Approximate time of day |

---

### weekday

```text
[[cal.weekday]] → Mercday
```

---

### season

```text
[[cal.season]] → Spring
```

---

### era

```text
[[cal.era]] → Second Age
```

---

### cycle

```text
[[cal.cycle]] → Temporis
```

---

### festival

Clickable — opens festival note if one exists.

```text
[[cal.festival]] → Midsummer
```

---

### restday

```text
[[cal.restday]] → Work Day
```

---

## Time Math

### countdown

Days until a target date. Clickable — navigates to target.

```text
[[cal.countdown 1 Mirtul 1500]] → in 45 days
[[cal.countdown 1 6 1500]]      → in 45 days
```

---

### countup / elapsed

Days since a target date. Clickable — navigates to target.

```text
[[cal.countup 1 Mirtul 1490]]               → 730 days
[[cal.countup 1 Mirtul 1490 relative=true]] → in 2 years
[[cal.elapsed 1 Mirtul 1490]]               → 730 days
```

| Parameter  | Type      | Description                  |
| ---------- | --------- | ---------------------------- |
| `relative` | `boolean` | Human-readable relative text |

---

### between

Distance between two dates.

```text
[[cal.between 1 1 1490 to 1 6 1490]]             → 150 days
[[cal.between 1 1 1490 to 1 6 1490 unit=months]] → 5 months
```

| Parameter | Type     | Description              |
| --------- | -------- | ------------------------ |
| `unit`    | `string` | `months` for month count |

---

### timeuntil

Time until a target event.

```text
[[cal.timeuntil sunrise]]           → 3h 20m
[[cal.timeuntil sunset]]            → 8h 15m
[[cal.timeuntil midnight]]          → 9h 30m
[[cal.timeuntil midday]]            → 2h 10m
[[cal.timeuntil sunset hours=true]] → 8h 15m
```

| Parameter | Type      | Description            |
| --------- | --------- | ---------------------- |
| `hours`   | `boolean` | Compact "Xh Ym" format |

**Targets:** `sunrise`, `sunset`, `midnight`, `midday`

---

### datemath

Date arithmetic from current date. Clickable — navigates to result.

```text
[[cal.datemath +30d]]    → 6 Thawmoon, 1500
[[cal.datemath +2m -5d]] → 1 Shadowmoon, 1499
[[cal.datemath +1y]]     → 5 Shadowmoon, 1500
```

**Units:** `d` (days), `m` (months), `y` (years)

---

## Calendar

### calname

```text
[[cal.calname]] → Forgotten Realms
```

---

### month

```text
[[cal.month]] → Shadowmoon
```

---

### year

```text
[[cal.year]] → 1499
```

---

### dayofyear

```text
[[cal.dayofyear]] → 287
```

---

### yearprogress

Renders a progress bar.

```text
[[cal.yearprogress]] → [========--] 79%
```

---

### leapyear

```text
[[cal.leapyear]] → Not a Leap Year
```

---

### intercalary

```text
[[cal.intercalary]] → Standard
```

---

### daysinyear

```text
[[cal.daysinyear]] → 365
```

---

## Sun & Daylight

### sunrise / sunset

```text
[[cal.sunrise]] → 06:30
[[cal.sunset]]  → 18:45
```

---

### daylight

```text
[[cal.daylight]] → 12.3h
```

---

### isdaytime

```text
[[cal.isdaytime]] → Daytime
```

---

### dayprogress / nightprogress

```text
[[cal.dayprogress]]   → 65%
[[cal.nightprogress]] → 23%
```

---

### untilsunrise / untilsunset

```text
[[cal.untilsunrise]] → 5h 30m
[[cal.untilsunset]]  → 2h 15m
```

---

## Moon

### moon

Display moon phase info.

```text
[[cal.moon]]               → Waxing Crescent (with icon)
[[cal.moon 1]]             → Full Moon (second moon)
[[cal.moon icon=true]]     → (icon only)
[[cal.moon position=true]] → 45%
[[cal.moon cycleday=true]] → 12
[[cal.moon isfull=true]]   → Not Full Moon
```

| Parameter  | Type      | Description          |
| ---------- | --------- | -------------------- |
| positional | `number`  | Moon index (0-based) |
| `icon`     | `boolean` | Icon only            |
| `position` | `boolean` | Cycle position %     |
| `cycleday` | `boolean` | Day in cycle         |
| `isfull`   | `boolean` | Full moon check      |

---

### moons

```text
[[cal.moons]] → Selune: Full Moon, Tears: Waning
```

---

### nextfullmoon

Date mode is clickable.

```text
[[cal.nextfullmoon]]           → 22 Shadowmoon, 1499
[[cal.nextfullmoon countdown]] → in 8 days
[[cal.nextfullmoon 1]]         → 15 Thawmoon, 1499
```

---

### convergence

Clickable. Requires 2+ moons.

```text
[[cal.convergence]] → 15 Thawmoon, 1501
```

---

## Weather

### weather

```text
[[cal.weather]] → Clear Skies (with icon)
```

---

### temperature

```text
[[cal.temperature]] → 72F
```

---

### wind

```text
[[cal.wind]] → Moderate SSE
```

---

### precipitation

```text
[[cal.precipitation]] → None
```

---

### weathericon

```text
[[cal.weathericon]] → (icon only)
```

---

### zone

```text
[[cal.zone]] → Temperate
```

---

### forecast

Weather forecast block.

```text
[[cal.forecast]]   → 3-day forecast (default)
[[cal.forecast 5]] → 5-day forecast
```

| Parameter  | Type     | Description                  |
| ---------- | -------- | ---------------------------- |
| positional | `number` | Days to forecast (default 3) |

---

## Notes

### event

Clickable — opens note.

```text
[[cal.event The Council Meeting]] → The Council Meeting
```

---

### notes

```text
[[cal.notes]]                        → Council Meeting, Dragon Attack
[[cal.notes 15 5 1492]]              → Session Recap
[[cal.notes count=true]]             → 3 notes
[[cal.notes count=true scope=month]] → 12 notes
```

| Parameter | Type      | Description                 |
| --------- | --------- | --------------------------- |
| `count`   | `boolean` | Show count instead of names |
| `scope`   | `string`  | `month` for monthly count   |

---

### next

Date mode is clickable — opens note.

```text
[[cal.next Council Meeting]]           → 22 Mirtul, 1492
[[cal.next Council Meeting countdown]] → in 7 days
```

---

### category

Uses the category's icon.

```text
[[cal.category Holidays]] → Midsummer, Shieldmeet
```

---

## Composite

### summary

Clickable — navigates to today.

```text
[[cal.summary]] → 5 Shadowmoon, 1499 · Clear · Waxing
```

---

### almanac

```text
[[cal.almanac]] → (multi-line block)
```

---

### format

See [Format Tokens](Format-Tokens).

```text
[[cal.format EEEE, Do MMMM Y]] → Mercday, 5th Shadowmoon 1499
```

---

### compare

Clickable — navigates to target.

```text
[[cal.compare 1 1 1490]] → in 9 years (3285 days)
```

---

### peek

Clickable — navigates to result.

```text
[[cal.peek +7d]] → 12 Shadowmoon, 1499
[[cal.peek +1m]] → 5 Thawmoon, 1499
```

---

## Cross-Calendar

Any enricher accepts `cal=<id>` to query a non-active calendar.

```text
[[cal.date cal=harptos]]     → 15 Mirtul, 1492
[[cal.moon cal=krynn]]       → Full Moon
[[cal.season cal=gregorian]] → Winter
```

This is read-only — click navigation still targets the active calendar.

---

## Settings

| Setting               | Description                                              | Default     |
| --------------------- | -------------------------------------------------------- | ----------- |
| Enricher Click Target | Calendar view for date clicks (Auto, MiniCal, or BigCal) | Auto-detect |
