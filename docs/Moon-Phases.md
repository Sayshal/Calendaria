# Moon Phases

Calendaria supports multiple moons with configurable cycle lengths, phases, and colors.

---

## Moon Configuration

Each moon is defined with the following properties:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Display name |
| `cycleLength` | number | Days per complete lunar cycle |
| `cycleDayAdjust` | number | Offset to shift phase timing (default: 0) |
| `color` | string | Hex color for display tinting |
| `hidden` | boolean | Hide moon from display |
| `referenceDate` | object | Known new moon date `{ year, month, day }` |
| `phases` | array | Phase definitions (see below) |

### Phase Definition

Each phase entry:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Phase name (e.g., "Full Moon") |
| `rising` | string | Optional sub-phase name for early portion |
| `fading` | string | Optional sub-phase name for late portion |
| `icon` | string | SVG path or emoji for display |
| `start` | number | Cycle position start (0-1) |
| `end` | number | Cycle position end (0-1) |

---

## Calendar Editor (Moons Tab)

Configure moons via **Calendar Editor > Moons**:

- **Name**: Moon display name
- **Cycle Length**: Days for one complete cycle
- **Color**: Tint color (affects icon display)
- **Reference Date**: A date when the moon was new (year, month, day)
- **Cycle Day Adjust**: Fine-tune phase alignment
- **Hidden**: Exclude from UI display
- **Phases**: Configure each phase with name, rising/fading names, icon, and start/end percentages

---

## Phase Calculation

Phase calculation uses FC-style distribution for 8-phase moons:

1. Primary phases (New Moon at index 0, Full Moon at index 4) each get `floor(cycleLength / 8)` days
2. Remaining 6 phases split the leftover days evenly
3. Extra days are distributed to earlier phases first

The algorithm (`getMoonPhase` in `calendaria-calendar.mjs`):

1. Calculate days since reference date
2. Apply `cycleDayAdjust` offset
3. Compute `daysIntoCycle = daysSinceReference % cycleLength`
4. Determine which phase index contains that day
5. Compute sub-phase (rising/fading) based on position within the phase

### Sub-Phases

When a phase spans multiple days, sub-phase names are generated:
- **First third**: Uses `rising` name if defined, otherwise "Rising [Phase]"
- **Middle third**: Uses the main phase name
- **Last third**: Uses `fading` name if defined, otherwise "Fading [Phase]"

---

## Phase Icons

Default phase icons are SVG files in `assets/moon-phases/`:

| File | Phase |
|------|-------|
| `01_newmoon.svg` | New Moon |
| `02_waxingcrescent.svg` | Waxing Crescent |
| `03_firstquarter.svg` | First Quarter |
| `04_waxinggibbous.svg` | Waxing Gibbous |
| `05_fullmoon.svg` | Full Moon |
| `06_waninggibbous.svg` | Waning Gibbous |
| `07_lastquarter.svg` | Last Quarter |
| `08_waningcrescent.svg` | Waning Crescent |

Custom icons can be paths to image files or emoji characters.

---

## Display

### Calendar View

Moon phases display on calendar day cells when the **Show Moon Phases** setting is enabled (Settings Panel > Moons tab). Each day shows the primary moon's phase icon, tinted with the moon's configured color.

### HUD Dome

The HUD dome displays a generic moon body that appears during nighttime hours (sun hidden). This is purely visual and does not reflect the actual lunar phase.

---

## API Reference

### `CALENDARIA.api.getMoonPhase(moonIndex)`

Get the current phase of a specific moon.

```javascript
const phase = CALENDARIA.api.getMoonPhase(0);
// Returns:
// {
//   name: "Full Moon",
//   subPhaseName: "Full Moon",
//   icon: "modules/calendaria/assets/moon-phases/05_fullmoon.svg",
//   position: 0.5,
//   dayInCycle: 14,
//   phaseIndex: 4,
//   dayWithinPhase: 1,
//   phaseDuration: 3
// }
```

### `CALENDARIA.api.getAllMoonPhases()`

Get phases for all moons at current time.

```javascript
const moons = CALENDARIA.api.getAllMoonPhases();
// Returns array of phase objects for each moon
```

---

## Moon Utilities (`moon-utils.mjs`)

Additional utility functions:

| Function | Description |
|----------|-------------|
| `getMoonPhasePosition(moon, date, calendar)` | Returns phase position (0-1) for a date |
| `isMoonFull(moon, date, calendar)` | Returns true if position is 0.5-0.625 |
| `getNextFullMoon(moon, startDate, options)` | Finds next full moon date |
| `getNextConvergence(moons, startDate, options)` | Finds next date when all moons are full |
| `getConvergencesInRange(moons, startDate, endDate, options)` | All convergences in a date range |

### Convergence Example

```javascript
import { getNextConvergence } from './scripts/utils/moon-utils.mjs';

const calendar = CALENDARIA.api.getActiveCalendar();
const moons = calendar.moons;
const today = { year: 1492, month: 0, day: 1 };

const convergence = getNextConvergence(moons, today, { maxDays: 1000 });
if (convergence) {
  console.log(`Next convergence: ${convergence.year}/${convergence.month}/${convergence.day}`);
}
```

---

## Note Recurrence

Notes can repeat on moon phases using the recurrence system. Conditions supported:

- `moonPhase`: Phase position (0-1) of a specific moon
- `moonPhaseIndex`: Discrete phase index
- `moonPhaseCountMonth`: Nth occurrence of a phase in the month
- `moonPhaseCountYear`: Nth occurrence of a phase in the year

These are evaluated in `scripts/notes/utils/recurrence.mjs`.
