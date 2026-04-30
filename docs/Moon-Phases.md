# Moon Phases

Multiple moons with configurable cycle lengths, phases, and colors.

---

## Configuring Moons

Configure moons via **Calendar Editor > Moons tab**:

| Setting          | Description                                      |
| ---------------- | ------------------------------------------------ |
| Name             | Moon display name                                |
| Cycle Length     | Days for one complete cycle                      |
| Color            | Tint color for icon display                      |
| Reference Date   | A known new moon date (year, month, day)         |
| Cycle Day Adjust | Fine-tune phase alignment                        |
| Reference Phase  | Which phase the moon is at on the reference date |

### Phase Configuration

Each phase can be customized with:

- **Name**: Phase name (e.g., "Full Moon")
- **Rising/Fading**: Optional sub-phase names for multi-day phases
- **Icon**: SVG path or emoji
- **Start/End**: Cycle position (0-1)

An interactive **phase slider** in the Moons tab lets you adjust phase boundaries by dragging handles between segments. See [Calendar Editor: Moon Phases](Calendar-Editor#moon-phases) for details.

---

## Phase Modes

Each moon has a **Phase Mode** setting that determines how its phase is calculated over time.

### Fixed (Default)

The moon follows a predictable, repeating cycle. The phase on any given day is determined by:

1. Days since the reference date
2. Position within the cycle (`daysSinceReference % cycleLength`)
3. Which phase contains that position

Phases repeat at exact intervals, producing a regular, real-world-style lunar cycle.

### Randomized

The moon follows an erratic, non-cyclical pattern driven by seeded randomness. The base cycle length still influences overall pacing, but the actual phase on any day varies unpredictably. Good for alien, magical, or chaotic moons (e.g., Warhammer's Morrslieb).

Randomized moons are configured with:

| Setting        | Description                                                                                                                                                                                                             |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Seed           | Integer seed for randomization. The same seed always produces the same sequence. Use the dice button to randomize                                                                                                       |
| Cycle Variance | Slider (`0`–`1`) controlling how much the moon deviates from its base cycle length. At `0`, the moon behaves identically to fixed mode. At `1`, phases shift dramatically and unpredictably between days                |
| Phase Weight   | Per-phase number (minimum `1`) controlling how likely that phase is relative to the others. A phase with weight `2` occupies twice as much of the cycle as a phase with weight `1`, making it twice as likely to appear |

Same seed always produces the same results.

### Anchor Phases

Anchor phases are date-specific phase overrides available in **Randomized** mode. They guarantee a moon is in a specific phase on a specific date, regardless of what the randomization would otherwise produce.

Configure anchor phases in **Calendar Editor > Moons tab** by clicking **Add Anchor Phase**. Each anchor defines:

| Field | Description                                                                                |
| ----- | ------------------------------------------------------------------------------------------ |
| Year  | The year to match. Leave blank for **yearly recurrence** (the anchor repeats every year)   |
| Month | The month the anchor falls on                                                              |
| Day   | The day of the month                                                                       |
| Phase | Which phase the moon should display on the anchored date (selected from the moon's phases) |

For example, an anchor with no year, month "Hexenstag", day 1, and phase "Full Moon" ensures the moon is always full on the first day of Hexenstag every year.

---

## Sub-Phases

When a phase spans multiple days:

- **First third**: "Rising [Phase]" (or custom rising name)
- **Middle third**: Main phase name
- **Last third**: "Fading [Phase]" (or custom fading name)

---

## Display

### Calendar View

Moon phases display on calendar day cells when **Show Moon Phases** is enabled. Controlled per-application:

- **Settings Panel > MiniCal tab > Block Visibility > Show Moon Phases**
- **Settings Panel > BigCal tab > Block Visibility > Show Moon Phases**

**BigCal:** Shows moon icons for each configured moon, tinted with their colors. When there are many moons, a `+X` indicator appears to show how many additional moons exist beyond the displayed icons.

**MiniCal:** Shows a single moon icon due to space constraints. Click the moon icon to cycle through available moons when multiple are configured.

### HUD Dome

The HUD dome renders moons with phase-accurate shadows and color glow. With **Show All Moons** enabled (Settings > HUD tab), secondary moons trail behind the primary moon at a smaller size.

---

## Moon Brightness

Moons reduce nighttime scene darkness based on their phase. Each moon has a **Brightness Max** slider (`0`–`0.3`, default `0`) in **Calendar Editor > Moons tab**.

Illumination follows a cosine curve: maximum at full moon, zero at new moon. Multiple moons sum their values (capped at 0.3). Each moon's light is tinted with its configured color.

Enable/disable via **Settings Panel > Canvas tab > Moon Illumination**.

See [Scene Ambience: Moon Illumination](Scene-Ambience#moon-illumination) for how this affects darkness calculations.

---

## Moon-Based Note Recurrence

Notes repeat on specific moon phases. In the note editor:

1. Set repeat pattern to **Moon Phase**
2. Select which moon(s) to track
3. Choose the phase range (e.g., Full Moon only, or a range like 0.5-0.625)
4. Optionally select a **modifier** to target a specific portion of multi-day phases:

| Modifier | Description                         |
| -------- | ----------------------------------- |
| Any      | Any time during the phase (default) |
| Rising   | First third of the phase            |
| True     | Middle third of the phase           |
| Fading   | Last third of the phase             |

Modifiers align with the sub-phase display system (Rising/True/Fading). For example, "Full Moon (Rising)" triggers only during the first third of the Full Moon phase.

See [Notes and Events](Notes-and-Events#recurrence-patterns) for more on recurrence patterns.

---

## For Developers

See [API Reference](API-Reference) and [Hooks](Hooks).
