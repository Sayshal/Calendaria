# Fog of War

Players only see dates the GM has revealed. All other dates appear fogged.

> [!TIP]
> Fog of War is disabled by default. Enable it in **Settings Panel > Fog of War** tab.

---

## How It Works

The GM reveals date ranges per calendar. Any date outside a revealed range is fogged for players. GMs always see all dates.

### Progressive Revelation

As the campaign advances, dates are revealed through two mechanisms:

1. **Auto-reveal on day change.** When time advances to a new day, the current date (and optionally intermediate days) is added to the revealed ranges
2. **Manual reveal.** The GM can right-click a day cell and use "Reveal Today to Here" to reveal a range from the current date to the clicked date

### Campaign Start Date

All dates before the Campaign Start Date are always fogged, regardless of revealed ranges. Setting a start date also reveals from the start date to the current game date.

Leave the start date blank to disable the lower bound.

---

## GM Controls

### Reveal Today to Here

Right-click any day cell in BigCal or MiniCal to access the **Reveal Today to Here** context menu option. All dates between the current game date and the clicked date are revealed in a single action.

The direction is automatic: clicking a date before the current date reveals backward, and clicking a date after reveals forward.

Only appears for GMs when Fog of War is enabled.

### Reset Revealed Ranges

The **Clear All Revealed Ranges** button in Settings Panel > Fog of War tab clears all revealed ranges for all calendars. After resetting, players will only see dates covered by the campaign start date (if configured). A confirmation dialog prevents accidental resets.

---

## Visual Indicators

### BigCal

Fogged dates display a **striped overlay** pattern. Players cannot click or interact with fogged cells.

### MiniCal

Fogged dates appear as **dimmed cells**, visually distinguishing them from revealed dates.

### Player Navigation

When Player Navigation is set to **Skip Fogged Months**, the previous/next month buttons skip over fully fogged months. Navigation buttons are disabled at fogged boundaries when no revealed month exists in that direction.

---

## Content Hiding

Fogged dates hide all associated content from non-GM users:

- **Notes.** All notes attached to fogged dates are excluded from day cells and search results
- **Weather.** Weather data is not displayed for fogged dates
- **Moon phases.** Moon phase indicators are hidden on fogged cells
- **Festivals.** Festival markers and festival notes are suppressed on fogged dates

GMs always see all content on all dates regardless of fog state.

---

## For Developers

See [API Reference](API-Reference) and [Hooks](Hooks).
