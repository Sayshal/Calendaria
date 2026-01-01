# Hooks

Calendaria fires hooks at key events for module integration and custom automation.

## Lifecycle Hooks

### calendaria.init

Fired during module initialization, before the calendar system is ready.

```javascript
Hooks.on("calendaria.init", () => {
  console.log("Calendaria initializing");
});
```

### calendaria.ready

Fired when Calendaria is fully loaded and ready.

```javascript
Hooks.on("calendaria.ready", () => {
  console.log("Calendaria ready");
});
```

---

## Calendar Hooks

### calendaria.calendarSwitched

Fired when the active calendar changes.

```javascript
Hooks.on("calendaria.calendarSwitched", (id, calendar) => {
  console.log(`Switched to calendar: ${id}`);
});
```

### calendaria.calendarAdded

Fired when a new calendar is added.

```javascript
Hooks.on("calendaria.calendarAdded", (id, calendar) => {
  console.log(`Added calendar: ${calendar.name}`);
});
```

### calendaria.calendarUpdated

Fired when a calendar is modified.

```javascript
Hooks.on("calendaria.calendarUpdated", (id, calendar) => {
  console.log(`Updated calendar: ${id}`);
});
```

### calendaria.calendarRemoved

Fired when a calendar is deleted.

```javascript
Hooks.on("calendaria.calendarRemoved", (id) => {
  console.log(`Removed calendar: ${id}`);
});
```

---

## Time Hooks

### calendaria.dateTimeChange

Fired whenever world time changes.

```javascript
Hooks.on("calendaria.dateTimeChange", (data) => {
  console.log(`Time: ${data.hour}:${data.minute}`);
});
```

### calendaria.dayChange

Fired when the day changes.

```javascript
Hooks.on("calendaria.dayChange", (data) => {
  console.log(`New day: ${data.day}`);
});
```

### calendaria.monthChange

Fired when the month changes.

```javascript
Hooks.on("calendaria.monthChange", (data) => {
  console.log(`New month: ${data.month}`);
});
```

### calendaria.yearChange

Fired when the year changes.

```javascript
Hooks.on("calendaria.yearChange", (data) => {
  console.log(`New year: ${data.year}`);
});
```

### calendaria.seasonChange

Fired when the season changes.

```javascript
Hooks.on("calendaria.seasonChange", (data) => {
  console.log(`Season: ${data.season.name}`);
});
```

---

## Solar Hooks

### calendaria.sunrise

Fired at sunrise.

```javascript
Hooks.on("calendaria.sunrise", (data) => {
  ui.notifications.info("The sun rises!");
});
```

### calendaria.sunset

Fired at sunset.

```javascript
Hooks.on("calendaria.sunset", (data) => {
  ui.notifications.info("The sun sets!");
});
```

### calendaria.midnight

Fired at midnight.

```javascript
Hooks.on("calendaria.midnight", (data) => {
  console.log("A new day begins");
});
```

### calendaria.midday

Fired at noon.

```javascript
Hooks.on("calendaria.midday", (data) => {
  console.log("High noon");
});
```

---

## Moon Hooks

### calendaria.moonPhaseChange

Fired when any moon's phase changes.

```javascript
Hooks.on("calendaria.moonPhaseChange", (data) => {
  for (const moon of data.moons) {
    console.log(`${moon.name}: ${moon.phase}`);
  }
});
```

---

## Rest Day Hooks

### calendaria.restDayChange

Fired when transitioning to or from a rest day.

```javascript
Hooks.on("calendaria.restDayChange", (data) => {
  if (data.isRestDay) {
    console.log("It's a day of rest");
  }
});
```

---

## Clock Hooks

### calendaria.clockStartStop

Fired when real-time clock starts or stops.

```javascript
Hooks.on("calendaria.clockStartStop", (data) => {
  if (data.running) {
    console.log("Clock started");
  } else {
    console.log("Clock stopped");
  }
});
```

### calendaria.clockUpdate

Fired periodically while clock is running.

```javascript
Hooks.on("calendaria.clockUpdate", (data) => {
  // data.running, data.ratio
});
```

---

## Note Hooks

### calendaria.noteCreated

Fired when a note is created.

```javascript
Hooks.on("calendaria.noteCreated", (note) => {
  console.log(`Created: ${note.name}`);
});
```

### calendaria.noteUpdated

Fired when a note is modified.

```javascript
Hooks.on("calendaria.noteUpdated", (note) => {
  console.log(`Updated: ${note.name}`);
});
```

### calendaria.noteDeleted

Fired when a note is deleted.

```javascript
Hooks.on("calendaria.noteDeleted", (pageId) => {
  console.log(`Deleted: ${pageId}`);
});
```

---

## Event Hooks

### calendaria.eventTriggered

Fired when a scheduled event occurs.

```javascript
Hooks.on("calendaria.eventTriggered", (data) => {
  console.log(`Event: ${data.name}`);
  if (data.isReminder) {
    console.log("This is a reminder");
  }
});
```

### calendaria.eventDayChanged

Fired when a multi-day event progresses to a new day.

```javascript
Hooks.on("calendaria.eventDayChanged", (data) => {
  console.log(`Day ${data.progress} of event: ${data.name}`);
});
```

---

## Weather Hooks

### calendaria.weatherChange

Fired when weather changes.

```javascript
Hooks.on("calendaria.weatherChange", (weather) => {
  console.log(`Weather: ${weather.condition}, ${weather.temperature}°`);
});
```

---

## Import Hooks

### calendaria.importStarted

Fired when a calendar import begins.

```javascript
Hooks.on("calendaria.importStarted", (data) => {
  console.log(`Importing from ${data.importerId}`);
});
```

### calendaria.importComplete

Fired when import finishes successfully.

```javascript
Hooks.on("calendaria.importComplete", (data) => {
  console.log(`Imported: ${data.calendarId}`);
});
```

### calendaria.importFailed

Fired when import fails.

```javascript
Hooks.on("calendaria.importFailed", (data) => {
  console.error(`Import failed: ${data.error}`);
});
```

---

## Render Hooks

### calendaria.preRenderCalendar

Fired before the calendar renders. Can modify render data.

```javascript
Hooks.on("calendaria.preRenderCalendar", (app, data) => {
  // Modify data before render
});
```

### calendaria.renderCalendar

Fired after the calendar renders.

```javascript
Hooks.on("calendaria.renderCalendar", (app, html) => {
  // Modify rendered HTML
});
```
