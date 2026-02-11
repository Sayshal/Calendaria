# Moon Phases

Calendaria supports multiple moons with configurable cycle lengths, phases, and colors.

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

An interactive **phase slider** in the Moons tab provides a visual way to adjust phase boundaries by dragging handles between segments. See [Calendar Editor — Moon Phases](Calendar-Editor#moon-phases) for details.

---

## Phase Calculation

The moon phase is determined by:

1. Days since reference date
2. Position within the cycle (`daysSinceReference % cycleLength`)
3. Which phase contains that position

### Sub-Phases

When a phase spans multiple days:

- **First third**: "Rising [Phase]" (or custom rising name)
- **Middle third**: Main phase name
- **Last third**: "Fading [Phase]" (or custom fading name)

---

## Display

### Calendar View

Moon phases display on calendar day cells when **Show Moon Phases** is enabled. This setting is controlled per-application:

- **Settings Panel > MiniCal tab > Block Visibility > Show Moon Phases**
- **Settings Panel > BigCal tab > Block Visibility > Show Moon Phases**

**BigCal:** Shows moon icons for each configured moon, tinted with their colors. When there are many moons, a `+X` indicator appears to show how many additional moons exist beyond the displayed icons.

**MiniCal:** Shows a single moon icon due to space constraints. Click the moon icon to cycle through available moons when multiple are configured.

### HUD Dome

The HUD dome shows a generic moon during nighttime. This is purely visual and doesn't reflect the actual phase.

---

## Moon-Based Note Recurrence

Notes can repeat on specific moon phases. In the note editor:

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

The modifier aligns with the sub-phase system used for display (Rising/True/Fading). For example, "Full Moon (Rising)" triggers only during the first third of the Full Moon phase.

See [Notes and Events](Notes-and-Events#recurrence-patterns) for more on recurrence patterns.

---

## For Developers

See [API Reference](API-Reference#moons) for `getMoonPhase()` and `getAllMoonPhases()` methods.

See [Hooks](Hooks#calendariamoonphasechange) for the `calendaria.moonPhaseChange` hook.
