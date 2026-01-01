# Moon Phases

Calendaria tracks lunar cycles with support for multiple moons, custom phases, and moon-triggered events.

## Viewing Moon Phases

### In the HUD

The current moon phase displays in the dome:

- The moon icon shows the current phase visually
- Position changes based on time of night
- Moon color reflects your calendar's configuration

### Via API

```javascript
// Get the first moon's current phase
const phase = CALENDARIA.api.getMoonPhase(0);
console.log(phase.name); // e.g., "Full Moon"

// Get all moons
const allMoons = CALENDARIA.api.getAllMoonPhases();
```

---

## How Phases Work

Moon phases are calculated from a reference date (a known new moon) and the cycle length:

1. **Cycle Length** — Days for one complete lunar cycle
2. **Reference Date** — A date when the moon was new
3. **Phase Percentages** — How the cycle divides into phases

Calendaria calculates the current day within the cycle and determines which phase applies.

---

## Default Phases

Standard lunar phases:

| Phase | Cycle Position |
|-------|----------------|
| New Moon | 0% |
| Waxing Crescent | 1-24% |
| First Quarter | 25% |
| Waxing Gibbous | 26-49% |
| Full Moon | 50% |
| Waning Gibbous | 51-74% |
| Last Quarter | 75% |
| Waning Crescent | 76-99% |

---

## Multiple Moons

Many fantasy settings have multiple moons. Each moon can have:

- Its own cycle length
- Unique phase names
- Different colors
- Independent reference dates

### Example: Eberron

Eberron has 12 moons, each with different cycles and associations. Configure each in the Calendar Editor.

### Example: Krynn

Krynn has three moons (Solinari, Lunitari, Nuitari) with their own colors and cycles affecting magic.

---

## Configuring Moons

### In the Calendar Editor

1. Open **Calendar Editor** → **Moons** tab
2. Click **Add Moon**
3. Configure:
   - **Name** — Display name
   - **Cycle Length** — Days per cycle
   - **Reference Date** — A known new moon date
   - **Color** — Visual color in the HUD

### Custom Phase Names

Replace default phase names with setting-appropriate ones:

1. In the moon configuration, expand **Phases**
2. Edit each phase name
3. Optionally add **Rising** and **Fading** sub-phases

Example for a "Blood Moon":
- New Blood
- Rising Crimson
- Half Blood
- Waxing Crimson
- Full Blood
- Waning Crimson
- Half Shadow
- Fading Crimson

---

## Moon-Triggered Events

Create events that occur on specific moon phases:

1. Create a note
2. Set **Repeat** to **Moon Phase**
3. Select the moon (if multiple)
4. Select the phase(s)

Use cases:
- Werewolf transformations on full moons
- Ritual timing
- Tidal effects
- Religious observances

---

## Moon Convergence

When multiple moons align, you might want special effects. Use the API to check for convergences:

```javascript
const moons = CALENDARIA.api.getAllMoonPhases();
const allFull = moons.every(m => m.name === "Full Moon");
if (allFull) {
  console.log("Lunar convergence!");
}
```

---

## API Reference

### getMoonPhase(moonIndex)

Get the current phase of a specific moon.

```javascript
const phase = CALENDARIA.api.getMoonPhase(0);
// Returns: { name: "Full Moon", index: 4, moon: "Luna", ... }
```

### getAllMoonPhases()

Get phases for all moons.

```javascript
const moons = CALENDARIA.api.getAllMoonPhases();
// Returns: [{ name: "Full Moon", moon: "Luna" }, { name: "New Moon", moon: "Celene" }]
```

---

## Tips

- Set reference dates to historical events in your setting (eclipses, prophecies)
- Use moon colors that match your setting's lore
- Consider how moon phases affect magic, creatures, or tides in your world
