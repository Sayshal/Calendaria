# Eclipses

Lunar and solar eclipses are simulated based on each moon's orbital settings. Eclipse dates are calculated deterministically; no randomness is involved.

> [!TIP]
> Eclipses are enabled by default on the Gregorian **Luna** moon and the Renescara **Aela** and **Ruan** moon presets. Other calendars can enable eclipses per-moon in the Calendar Editor.

---

## Eclipse Types

### Solar Eclipses

Solar eclipses occur when a moon passes between the world and the sun during a **new moon** phase. The type depends on alignment and apparent moon size:

| Type          | Description                                                                            |
| ------------- | -------------------------------------------------------------------------------------- |
| Total Solar   | The moon fully covers the sun                                                          |
| Annular Solar | The moon is centered on the sun but too small to fully cover it, leaving a bright ring |
| Partial Solar | The moon only partially covers the sun                                                 |

### Lunar Eclipses

Lunar eclipses occur when the world's shadow falls on a moon during a **full moon** phase. The type depends on how deeply the moon enters the shadow:

| Type            | Description                                          |
| --------------- | ---------------------------------------------------- |
| Total Lunar     | The moon passes fully into the world's shadow        |
| Partial Lunar   | The moon partially enters the shadow                 |
| Penumbral Lunar | The moon passes through the outer edge of the shadow |

---

## How Eclipses Work

Eclipses occur when a moon's orbital path crosses the sun's plane. The **frequency** setting controls how often alignment happens. Lower frequency means longer gaps between eclipse opportunities, and higher frequency means shorter gaps.

Not every alignment produces an eclipse. The moon must also be at the right phase (new moon for solar, full moon for lunar) at the time of alignment.

---

## Configuration

Configure eclipses per-moon in **Calendar Editor > Moons tab**:

| Setting           | Description                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| Eclipse Frequency | How often eclipses can occur: None, Rare, Occasional, Frequent, or Custom                                    |
| Nodal Period      | Exact alignment cycle length in days (only shown when frequency is Custom)                                   |
| Apparent Size     | How large the moon appears relative to the sun. Determines whether close solar eclipses are total or annular |

### Frequency Modes

| Mode       | Description                                 |
| ---------- | ------------------------------------------- |
| None       | Eclipses disabled                           |
| Rare       | Eclipses happen infrequently                |
| Occasional | Eclipses happen at a moderate rate          |
| Frequent   | Eclipses happen often                       |
| Custom     | Set an exact alignment cycle length in days |

---

## Scheduling Notes on Eclipses

Schedule notes to trigger on eclipses using the condition engine. When at least one moon has eclipses enabled, the condition preset dropdown includes an **Eclipse** group with pre-built presets:

- **Any Eclipse.** Triggers on any eclipse type
- **Any Solar Eclipse.** Triggers on total, partial, or annular solar eclipses
- **Any Lunar Eclipse.** Triggers on total, partial, or penumbral lunar eclipses
- **Solar Eclipse (Moon Name).** Solar eclipse for a specific moon
- **Lunar Eclipse (Moon Name).** Lunar eclipse for a specific moon

---

## Text Enrichers

Eclipse data can be embedded in journals, chat, and item descriptions using the `[[cal.eclipse]]` and `[[cal.nexteclipse]]` enrichers. See [Text Enrichers](Text-Enrichers) for syntax and parameters.

---

## For Developers

See [API Reference](API-Reference) and [Hooks](Hooks).
