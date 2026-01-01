# Eras and Cycles

Calendaria supports historical eras and repeating cycles to add depth to your calendar.

## Eras

Eras represent major historical periods in your setting.

### What Eras Do

- Display in the calendar header
- Format dates with era abbreviations
- Track which era the current date falls in

### Examples

- "1492 DR" (Dale Reckoning, Forgotten Realms)
- "3E 433" (Third Era, Elder Scrolls)
- "Year 5 of the New Kingdom"

---

## Configuring Eras

### In the Calendar Editor

1. Open **Calendar Editor** → **Eras** tab
2. Click **Add Era**
3. Set:
   - **Name** — Full era name (e.g., "Dale Reckoning")
   - **Abbreviation** — Short form (e.g., "DR")
   - **Start Year** — When this era begins
4. Set the **Format Template**

### Format Templates

Use placeholders to format era display:

| Placeholder | Description |
|-------------|-------------|
| `{{year}}` | Year number within the era |
| `{{abbreviation}}` | Era abbreviation |
| `{{name}}` | Full era name |

Examples:
- `{{year}} {{abbreviation}}` → "1492 DR"
- `{{abbreviation}} {{year}}` → "DR 1492"
- `Year {{year}} of the {{name}}` → "Year 5 of the Third Age"

### Multiple Eras

Add multiple eras for historical transitions:

| Era | Abbreviation | Start Year |
|-----|--------------|------------|
| First Age | FA | -5000 |
| Second Age | SA | -1000 |
| Third Age | TA | 0 |
| Fourth Age | 4A | 1000 |

Calendaria uses the most recent era that starts before the current year.

---

## Cycles

Cycles are repeating patterns like zodiac signs, elemental weeks, or seasonal festivals.

### What Cycles Do

- Track position within a repeating sequence
- Display current cycle value in the calendar
- Enable cycle-based event triggers

### Examples

- Zodiac signs (12 entries, year-based)
- Elemental weeks (4 entries, week-based)
- Planetary days (7 entries, day-based)

---

## Configuring Cycles

### In the Calendar Editor

1. Open **Calendar Editor** → **Cycles** tab
2. Click **Add Cycle**
3. Set:
   - **Name** — Cycle name (e.g., "Zodiac")
   - **Based On** — What drives the cycle (day, week, month, year)
   - **Duration** — How many units per cycle entry
4. Add **Entries** with names

### Cycle Types

| Based On | Description |
|----------|-------------|
| Day | Changes daily |
| Week | Changes weekly |
| Month | Changes monthly |
| Year | Changes yearly |

### Example: Zodiac

A 12-sign zodiac that changes monthly:

- **Based On:** Month
- **Duration:** 1
- **Entries:** Aries, Taurus, Gemini, Cancer, Leo, Virgo, Libra, Scorpio, Sagittarius, Capricorn, Aquarius, Pisces

### Example: Elemental Week

A 4-element cycle that changes weekly:

- **Based On:** Week
- **Duration:** 1
- **Entries:** Fire, Water, Earth, Air

---

## Viewing Cycle Values

### In the Calendar

The current cycle value displays in the header when configured.

### Via API

```javascript
const cycles = CALENDARIA.api.getCycleValues();
// Returns: { zodiac: "Gemini", elements: "Fire", ... }
```

---

## Cycle-Based Events

Create events that trigger based on cycle position:

1. Create a note
2. Use conditions to match cycle values
3. The event fires when the cycle matches

---

## Advanced: The Renescara Example

The Renescara showcase calendar demonstrates advanced era and cycle usage:

**Eras:**
- First Age (ancient history)
- Dark Centuries (time of strife)
- Second Age (current era)

**Cycles:**
- Five Wanderers (5-year planetary cycle)
- Named Weeks (Rising, Fullness, Turning, Fading)

Check the Renescara calendar in the editor for implementation details.

---

## API Reference

### getCycleValues()

Get all current cycle values.

```javascript
const cycles = CALENDARIA.api.getCycleValues();
```

Returns an object with cycle names as keys and current entry names as values.
