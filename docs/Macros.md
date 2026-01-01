# Macros

Calendaria supports macro automation through two mechanisms: **Trigger Configuration** and **Event-Attached Macros**.

---

## Macro Triggers

Configure macros to execute automatically when calendar events occur. Access via **Settings Panel > Macros** tab (GM only).

### Global Triggers

Time-based triggers that fire when thresholds are crossed:

| Trigger | Description |
|---------|-------------|
| Dawn | Fires at sunrise |
| Dusk | Fires at sunset |
| Midday | Fires at noon (12:00) |
| Midnight | Fires at midnight (00:00) |
| New Day | Fires when the day changes |

### Season Triggers

Execute macros when seasons change. Options:
- **Specific season**: Fires when entering that season
- **All seasons**: Fires on any season change

### Moon Phase Triggers

Execute macros when moon phases change. Configure:
- **Moon**: Specific moon or "All Moons"
- **Phase**: Specific phase or "All Phases"

Wildcard combinations allow broad triggers (e.g., "All Moons + Full Moon" fires for any full moon).

---

## Event-Attached Macros

Calendar notes can have an attached macro that executes when the event triggers.

### Trigger Conditions

Macros attached to notes execute when:
- The event's start time is reached
- Multi-day events progress (fires daily with progress data)

### Context Data

Macros receive context via the `scope` parameter:

```javascript
// Event trigger context
const { event } = scope;
console.log(event.id);       // Note page ID
console.log(event.name);     // Note name
console.log(event.flagData); // Full note data (startDate, endDate, categories, etc.)

// Multi-day progress context (if applicable)
const { trigger, progress } = scope;
if (trigger === 'multiDayProgress') {
  console.log(progress.currentDay);  // Current day number
  console.log(progress.totalDays);   // Total event duration
  console.log(progress.percentage);  // Completion percentage
  console.log(progress.isFirstDay);  // boolean
  console.log(progress.isLastDay);   // boolean
}
```

---

## Global Trigger Context

Macros executed via global triggers receive context data:

### Time Threshold Triggers (dawn, dusk, midday, midnight)

```javascript
const { trigger, worldTime, components, calendar } = scope;
console.log(trigger);      // "sunrise", "sunset", "midday", "midnight"
console.log(worldTime);    // Current world time in seconds
console.log(components);   // { year, month, dayOfMonth, hour, minute, ... }
```

### New Day Trigger

```javascript
const { trigger, previous, current, calendar } = scope;
console.log(trigger);         // "newDay"
console.log(previous.year);   // Previous year
console.log(current.year);    // Current year
```

### Season Change Trigger

```javascript
const { trigger, previousSeason, currentSeason, calendar } = scope;
console.log(trigger);          // "seasonChange"
console.log(previousSeason);   // Previous season object { name, ... }
console.log(currentSeason);    // Current season object { name, ... }
```

### Moon Phase Trigger

```javascript
const { trigger, moon } = scope;
console.log(trigger);              // "moonPhaseChange"
console.log(moon.moonIndex);       // Moon index
console.log(moon.moonName);        // Moon name
console.log(moon.previousPhaseIndex);
console.log(moon.previousPhaseName);
console.log(moon.currentPhaseIndex);
console.log(moon.currentPhaseName);
```

---

## Common Macro Examples

### Time Control

```javascript
// Advance 1 hour
await CALENDARIA.api.advanceTime({ hour: 1 });

// Advance 8 hours (long rest)
await CALENDARIA.api.advanceTime({ hour: 8 });

// Advance 1 day
await CALENDARIA.api.advanceTime({ day: 1 });

// Jump to specific date
await CALENDARIA.api.jumpToDate({ year: 1492, month: 5, day: 15 });

// Advance to next sunrise
await CALENDARIA.api.advanceTimeToPreset('sunrise');

// Advance to next sunset
await CALENDARIA.api.advanceTimeToPreset('sunset');
```

### Display Information

```javascript
// Show current date/time
const now = CALENDARIA.api.getCurrentDateTime();
const formatted = CALENDARIA.api.formatDate(now, 'datetime');
ChatMessage.create({ content: `<b>Current Time:</b> ${formatted}` });

// Show weather
const weather = CALENDARIA.api.getCurrentWeather();
ChatMessage.create({
  content: `<b>Weather:</b> ${weather.label}, ${weather.temperature}`
});

// Show moon phase
const phase = CALENDARIA.api.getMoonPhase(0);
ChatMessage.create({ content: `<b>Moon:</b> ${phase.name}` });

// Show season
const season = CALENDARIA.api.getCurrentSeason();
ChatMessage.create({ content: `<b>Season:</b> ${season.name}` });
```

### Check Conditions

```javascript
// Is it night?
const isNight = CALENDARIA.api.isNighttime();
ui.notifications.info(isNight ? "It is nighttime" : "It is daytime");

// Is it a rest day?
if (CALENDARIA.api.isRestDay()) {
  ui.notifications.info("Today is a rest day");
}

// Is it a festival?
if (CALENDARIA.api.isFestivalDay()) {
  const festival = CALENDARIA.api.getCurrentFestival();
  ui.notifications.info(`Today is ${festival.name}!`);
}
```

### Notes Management

```javascript
// Create a quick note
const now = CALENDARIA.api.getCurrentDateTime();
await CALENDARIA.api.createNote({
  name: "Session Note",
  content: "<p>Something important happened here.</p>",
  startDate: { year: now.year, month: now.month, day: now.dayOfMonth },
  allDay: true
});

// Get today's events
const notes = CALENDARIA.api.getNotesForDate(now.year, now.month, now.dayOfMonth);
if (notes.length > 0) {
  const list = notes.map(n => n.name).join(", ");
  ui.notifications.info(`Today: ${list}`);
}
```

### Weather Control

```javascript
// Set specific weather
await CALENDARIA.api.setWeather("thunderstorm", { temperature: 55 });

// Generate weather from climate zone
await CALENDARIA.api.generateWeather();

// Get forecast
const forecast = await CALENDARIA.api.getWeatherForecast({ days: 7 });
```

---

## Hooks

Listen for Calendaria events in world scripts or modules:

```javascript
// Time thresholds
Hooks.on("calendaria.sunrise", (data) => {
  ChatMessage.create({ content: "<b>The sun rises.</b>" });
});

Hooks.on("calendaria.sunset", (data) => {
  ChatMessage.create({ content: "<b>The sun sets.</b>" });
});

// Day/period changes
Hooks.on("calendaria.dayChange", (data) => {
  console.log("New day:", data.current);
});

Hooks.on("calendaria.seasonChange", (data) => {
  console.log("Season changed to:", data.currentSeason?.name);
});

// Moon phases
Hooks.on("calendaria.moonPhaseChange", (data) => {
  for (const moon of data.moons) {
    if (moon.currentPhaseName?.includes("Full")) {
      ChatMessage.create({
        content: `<b>${moon.moonName} is full!</b>`,
        whisper: game.users.filter(u => u.isGM).map(u => u.id)
      });
    }
  }
});

// Events
Hooks.on("calendaria.eventTriggered", (data) => {
  console.log("Event triggered:", data.name);
});

Hooks.on("calendaria.weatherChange", (data) => {
  console.log("Weather changed:", data);
});
```

### Available Hooks

| Hook | Description |
|------|-------------|
| `calendaria.sunrise` | Sunrise threshold crossed |
| `calendaria.sunset` | Sunset threshold crossed |
| `calendaria.midnight` | Midnight threshold crossed |
| `calendaria.midday` | Midday threshold crossed |
| `calendaria.dayChange` | Day changed |
| `calendaria.monthChange` | Month changed |
| `calendaria.yearChange` | Year changed |
| `calendaria.seasonChange` | Season changed |
| `calendaria.moonPhaseChange` | Moon phase changed |
| `calendaria.restDayChange` | Rest day status changed |
| `calendaria.eventTriggered` | Calendar event triggered |
| `calendaria.weatherChange` | Weather changed |
| `calendaria.dateTimeChange` | Any time change |

---

## API Reference

Access via `CALENDARIA.api`. See [API Reference](API-Reference.md) for full documentation.

### Key Methods

| Method | Description |
|--------|-------------|
| `getCurrentDateTime()` | Get current time components |
| `advanceTime(delta)` | Advance time by delta |
| `setDateTime(components)` | Set absolute time |
| `jumpToDate(options)` | Jump to specific date |
| `advanceTimeToPreset(preset)` | Advance to sunrise/sunset/midday/midnight |
| `formatDate(components, format)` | Format date string |
| `getMoonPhase(index)` | Get moon phase |
| `getCurrentSeason()` | Get current season |
| `getCurrentWeather()` | Get current weather |
| `isDaytime()` / `isNighttime()` | Check time of day |
| `isRestDay()` | Check if rest day |
| `isFestivalDay()` | Check if festival |
| `createNote(options)` | Create calendar note |
| `getNotesForDate(y, m, d)` | Get notes on date |
