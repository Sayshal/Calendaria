# Macros

Calendaria supports macro automation through **Trigger Configuration** and **Event-Attached Macros**.

---

## Macro Triggers

Configure macros to execute automatically when calendar events occur. Access via **Settings Panel > Macros tab** (GM only).

### Global Triggers

| Trigger  | Description                |
| -------- | -------------------------- |
| Dawn     | Fires at sunrise           |
| Dusk     | Fires at sunset            |
| Midday   | Fires at noon              |
| Midnight | Fires at midnight          |
| New Day  | Fires when the day changes |

### Season Triggers

Execute macros when seasons change:

- **Specific season**: Fires when entering that season
- **All Seasons**: Fires on any season change

### Moon Phase Triggers

Execute macros when moon phases change:

- **Moon**: Specific moon or "All Moons"
- **Phase**: Specific phase or "All Phases"

---

## Event-Attached Macros

Calendar notes can have an attached macro that executes when the event triggers.

### Trigger Conditions

- Event's start time is reached
- Multi-day events fire daily with progress data

> Notes with the **Silent** flag will not trigger macros or notifications.

### The Scope Parameter

When Calendaria triggers a macro, it passes context data through Foundry's `scope` parameter. This is a standard Foundry feature—when macros are executed programmatically (rather than manually clicked), the caller can provide a `scope` object containing relevant data.

Inside your macro, access this data by destructuring from `scope`:

```javascript
const { event, trigger } = scope;
```

The `scope` variable is automatically available in your macro code—you don't need to define or import it.

### Context Data

```javascript
// Event trigger context
const { event } = scope;
console.log(event.id); // Note page ID
console.log(event.name); // Note name
console.log(event.flagData); // Full note data (startDate, endDate, categories, etc.)

// Multi-day progress context (if applicable)
const { trigger, progress } = scope;
if (trigger === 'multiDayProgress') {
  console.log(progress.currentDay); // Current day number
  console.log(progress.totalDays); // Total event duration
  console.log(progress.percentage); // Completion percentage
  console.log(progress.isFirstDay); // boolean
  console.log(progress.isLastDay); // boolean
}
```

---

## Global Trigger Context

Macros executed via global triggers receive context data:

### Time Threshold Triggers (dawn, dusk, midday, midnight)

```javascript
const { trigger, worldTime, components, calendar } = scope;
console.log(trigger); // "sunrise", "sunset", "midday", "midnight"
console.log(worldTime); // Current world time in seconds
console.log(components); // { year, month, dayOfMonth, hour, minute, ... }
```

### New Day Trigger

```javascript
const { trigger, previous, current, calendar } = scope;
console.log(trigger); // "newDay"
console.log(previous.year); // Previous date components
console.log(current.year); // Current date components
console.log(calendar); // Active calendar object
```

### Season Change Trigger

```javascript
const { trigger, previous, current, previousSeason, currentSeason, calendar } = scope;
console.log(trigger); // "seasonChange"
console.log(previous); // Previous date components
console.log(current); // Current date components
console.log(previousSeason); // Previous season object { name, ... }
console.log(currentSeason); // Current season object { name, ... }
console.log(calendar); // Active calendar object
```

### Moon Phase Trigger

```javascript
const { trigger, moon } = scope;
console.log(trigger); // "moonPhaseChange"
console.log(moon.moonIndex); // Moon index
console.log(moon.moonName); // Moon name
console.log(moon.previousPhaseIndex);
console.log(moon.previousPhaseName);
console.log(moon.currentPhaseIndex);
console.log(moon.currentPhaseName);
```

---

## Example Macros

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
const formatted = CALENDARIA.api.formatDate(now, 'datetime24');
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
ui.notifications.info(isNight ? 'It is nighttime' : 'It is daytime');

// Is it a rest day?
if (CALENDARIA.api.isRestDay()) {
  ui.notifications.info('Today is a rest day');
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
  name: 'Session Note',
  content: '<p>Something important happened here.</p>',
  startDate: { year: now.year, month: now.month, day: now.dayOfMonth },
  allDay: true
});

// Get today's events
const notes = CALENDARIA.api.getNotesForDate(now.year, now.month, now.dayOfMonth);
if (notes.length > 0) {
  const list = notes.map((n) => n.name).join(', ');
  ui.notifications.info(`Today: ${list}`);
}
```

### Weather Control

```javascript
// Set specific weather
await CALENDARIA.api.setWeather('thunderstorm', { temperature: 55 });

// Generate weather from climate zone
await CALENDARIA.api.generateWeather();

// Get forecast
const forecast = await CALENDARIA.api.getWeatherForecast({ days: 7 });
```

---

## For Developers

See [API Reference](API-Reference) for all available methods.

See [Hooks](Hooks) for calendar events you can listen to in world scripts or modules.
