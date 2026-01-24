# Hooks

Calendaria fires hooks for module integration and automation.

---

## Calendar Hooks

### calendaria.calendarSwitched

Fired when the active calendar changes (local switch).

**Parameters:**

- `id` (string) - Calendar ID
- `calendar` (CalendariaCalendar) - Calendar instance

```javascript
Hooks.on('calendaria.calendarSwitched', (id, calendar) => {
  console.log(`Switched to: ${id}`);
});
```

### calendaria.remoteCalendarSwitch

Fired when another client switches the active calendar.

**Parameters:**

- `id` (string) - Calendar ID
- `calendar` (CalendariaCalendar) - Calendar instance

```javascript
Hooks.on('calendaria.remoteCalendarSwitch', (id, calendar) => {
  console.log(`Remote switch to: ${id}`);
});
```

### calendaria.calendarAdded

Fired when a calendar is created or imported.

**Parameters:**

- `id` (string) - Calendar ID
- `calendar` (CalendariaCalendar) - Calendar instance

```javascript
Hooks.on('calendaria.calendarAdded', (id, calendar) => {
  console.log(`Added: ${calendar.name}`);
});
```

### calendaria.calendarUpdated

Fired when a calendar is modified.

**Parameters:**

- `id` (string) - Calendar ID
- `calendar` (CalendariaCalendar) - Updated calendar instance

```javascript
Hooks.on('calendaria.calendarUpdated', (id, calendar) => {
  console.log(`Updated: ${id}`);
});
```

### calendaria.calendarRemoved

Fired when a calendar is deleted.

**Parameters:**

- `id` (string) - Calendar ID

```javascript
Hooks.on('calendaria.calendarRemoved', (id) => {
  console.log(`Removed: ${id}`);
});
```

---

## Time Hooks

### calendaria.dateTimeChange

Fired on every world time change. Primary hook for time tracking.

**Parameters:**

- `data` (object)
  - `previous` (object) - Previous time components (year, month, dayOfMonth, hour, minute, second)
  - `current` (object) - Current time components
  - `diff` (number) - Time delta in seconds
  - `calendar` (CalendariaCalendar) - Active calendar
  - `worldTime` (number) - Current world time in seconds

```javascript
Hooks.on('calendaria.dateTimeChange', (data) => {
  console.log(`Time: ${data.current.hour}:${data.current.minute}`);
  console.log(`Delta: ${data.diff}s`);
});
```

### calendaria.dayChange

Fired when the day changes.

**Parameters:**

- `data` (object)
  - `previous` (object) - Previous time components
  - `current` (object) - Current time components
  - `calendar` (CalendariaCalendar) - Active calendar

```javascript
Hooks.on('calendaria.dayChange', (data) => {
  console.log(`Day ${data.current.dayOfMonth}`);
});
```

### calendaria.monthChange

Fired when the month changes.

**Parameters:**

- `data` (object) - Same structure as `calendaria.dayChange`

```javascript
Hooks.on('calendaria.monthChange', (data) => {
  console.log(`Month ${data.current.month}`);
});
```

### calendaria.yearChange

Fired when the year changes.

**Parameters:**

- `data` (object) - Same structure as `calendaria.dayChange`

```javascript
Hooks.on('calendaria.yearChange', (data) => {
  console.log(`Year ${data.current.year}`);
});
```

### calendaria.seasonChange

Fired when the season changes.

**Parameters:**

- `data` (object)
  - `previous` (object) - Previous time components
  - `current` (object) - Current time components
  - `calendar` (CalendariaCalendar) - Active calendar
  - `previousSeason` (object|null) - Previous season definition
  - `currentSeason` (object|null) - Current season definition

```javascript
Hooks.on('calendaria.seasonChange', (data) => {
  console.log(`Season: ${data.currentSeason?.name}`);
});
```

### calendaria.remoteDateChange

Fired when time changes from another client.

**Parameters:**

- `data` (object)
  - `worldTime` (number) - New world time in seconds
  - `delta` (number) - Time delta in seconds

```javascript
Hooks.on('calendaria.remoteDateChange', (data) => {
  console.log(`Remote time update: ${data.worldTime}`);
});
```

---

## Solar Hooks

Fired when crossing time-of-day thresholds.

### calendaria.sunrise

**Parameters:**

- `data` (object)
  - `worldTime` (number) - World time in seconds
  - `components` (object) - Time components
  - `calendar` (CalendariaCalendar) - Active calendar

```javascript
Hooks.on('calendaria.sunrise', (data) => {
  ui.notifications.info('The sun rises!');
});
```

### calendaria.sunset

**Parameters:** Same as `calendaria.sunrise`

```javascript
Hooks.on('calendaria.sunset', (data) => {
  ui.notifications.info('The sun sets!');
});
```

### calendaria.midnight

**Parameters:** Same as `calendaria.sunrise`

```javascript
Hooks.on('calendaria.midnight', (data) => {
  console.log('Midnight');
});
```

### calendaria.midday

**Parameters:** Same as `calendaria.sunrise`

```javascript
Hooks.on('calendaria.midday', (data) => {
  console.log('Noon');
});
```

---

## Moon Hooks

### calendaria.moonPhaseChange

Fired when any moon's phase changes.

**Parameters:**

- `data` (object)
  - `moons` (array) - Array of changed moon data
    - `moonIndex` (number) - Index of the moon
    - `moonName` (string) - Localized moon name
    - `previousPhaseIndex` (number) - Previous phase index
    - `previousPhaseName` (string|null) - Previous phase name
    - `currentPhaseIndex` (number) - Current phase index
    - `currentPhaseName` (string|null) - Current phase name
  - `calendar` (CalendariaCalendar) - Active calendar
  - `worldTime` (number) - World time in seconds

```javascript
Hooks.on('calendaria.moonPhaseChange', (data) => {
  for (const moon of data.moons) {
    console.log(`${moon.moonName}: ${moon.currentPhaseName}`);
  }
});
```

---

## Rest Day Hooks

### calendaria.restDayChange

Fired when transitioning to or from a rest day.

**Parameters:**

- `data` (object)
  - `isRestDay` (boolean) - Current rest day status
  - `wasRestDay` (boolean) - Previous rest day status
  - `weekday` (object|null) - Weekday info (index, name, abbreviation)
  - `worldTime` (number) - World time in seconds
  - `calendar` (CalendariaCalendar) - Active calendar

```javascript
Hooks.on('calendaria.restDayChange', (data) => {
  if (data.isRestDay) console.log('Rest day begins');
});
```

---

## Clock Hooks

### calendaria.clockStartStop

Fired when the real-time clock starts or stops.

**Parameters:**

- `data` (object)
  - `running` (boolean) - Whether clock is running
  - `increment` (number) - Time increment in seconds

```javascript
Hooks.on('calendaria.clockStartStop', (data) => {
  console.log(data.running ? 'Clock started' : 'Clock stopped');
});
```

### calendaria.clockUpdate

Fired when clock state is updated from another client. Used to sync real-time clock state across all connected clients.

**Parameters:**

- `data` (object)
  - `running` (boolean) - Whether clock is running
  - `ratio` (number) - Real-time to game-time ratio

```javascript
Hooks.on('calendaria.clockUpdate', (data) => {
  console.log(`Remote clock sync: running=${data.running}, ratio=${data.ratio}`);
});
```

---

## Note Hooks

### calendaria.noteCreated

Fired when a calendar note is created.

**Parameters:**

- `stub` (object) - Note stub with id, name, flagData

```javascript
Hooks.on('calendaria.noteCreated', (stub) => {
  console.log(`Created: ${stub.name}`);
});
```

### calendaria.noteUpdated

Fired when a calendar note is modified.

**Parameters:**

- `stub` (object) - Note stub with id, name, flagData

```javascript
Hooks.on('calendaria.noteUpdated', (stub) => {
  console.log(`Updated: ${stub.name}`);
});
```

### calendaria.noteDeleted

Fired when a calendar note is deleted.

**Parameters:**

- `pageId` (string) - Journal page ID

```javascript
Hooks.on('calendaria.noteDeleted', (pageId) => {
  console.log(`Deleted: ${pageId}`);
});
```

---

## Event Hooks

### calendaria.eventTriggered

Fired when a scheduled event or reminder occurs.

**Parameters:**

- `data` (object)
  - `id` (string) - Note/event ID
  - `name` (string) - Event name
  - `flagData` (object) - Event calendar data
  - `currentDate` (object) - Current date components (events only)
  - `reminderType` (string) - Reminder type (reminders only)
  - `isReminder` (boolean) - True if this is a reminder

```javascript
Hooks.on('calendaria.eventTriggered', (data) => {
  console.log(`Event: ${data.name}`);
  if (data.isReminder) console.log('This is a reminder');
});
```

### calendaria.eventDayChanged

Fired when a multi-day event progresses to a new day.

**Parameters:**

- `data` (object)
  - `id` (string) - Note ID
  - `name` (string) - Event name
  - `progress` (object) - Progress info (currentDay, totalDays, percentage, isFirstDay, isLastDay)

```javascript
Hooks.on('calendaria.eventDayChanged', (data) => {
  console.log(`Day ${data.progress.currentDay} of ${data.progress.totalDays}`);
});
```

---

## Reminder Hooks

### calendaria.reminderReceived

Fired when a reminder notification is received from another client. Used internally by `ReminderScheduler` to display notifications, but also available for module integration.

**Parameters:**

- `data` (object)
  - `type` (string) - Reminder type (`"toast"` or `"dialog"`)
  - `noteId` (string) - Journal page ID
  - `noteName` (string) - Note name
  - `journalId` (string) - Parent journal entry ID
  - `message` (string) - Formatted reminder message
  - `icon` (string|null) - Icon identifier
  - `iconType` (string|null) - Icon type (`"fontawesome"`, `"image"`, etc.)
  - `color` (string|null) - Icon color
  - `targets` (string[]) - Array of user IDs who should receive the reminder

```javascript
Hooks.on('calendaria.reminderReceived', (data) => {
  if (data.targets.includes(game.user.id)) {
    console.log(`Reminder: ${data.noteName}`);
  }
});
```

---

## Weather Hooks

### calendaria.weatherChange

Fired when weather changes. Note: This hook is fired with varying payloads depending on the source.

**Parameters:**

- `data` (object|undefined) - May be undefined when triggered from UI picker
  - `previous` (object|null) - Previous weather state
  - `current` (object|null) - Current weather state
  - `remote` (boolean) - True if change originated from another client (optional)

```javascript
Hooks.on('calendaria.weatherChange', (data) => {
  // data may be undefined when triggered from weather picker UI
  if (data?.current) {
    console.log(`Weather: ${data.current.id}`);
  }
});
```

---

## Import Hooks

### calendaria.importStarted

Fired when a calendar import begins.

**Parameters:**

- `data` (object)
  - `importerId` (string) - Importer ID
  - `calendarId` (string) - Target calendar ID

```javascript
Hooks.on('calendaria.importStarted', (data) => {
  console.log(`Importing via ${data.importerId}`);
});
```

### calendaria.importComplete

Fired when import finishes successfully.

**Parameters:**

- `data` (object)
  - `importerId` (string) - Importer ID
  - `calendarId` (string) - Created calendar ID
  - `calendar` (CalendariaCalendar) - Imported calendar

```javascript
Hooks.on('calendaria.importComplete', (data) => {
  console.log(`Imported: ${data.calendarId}`);
});
```

### calendaria.importFailed

Fired when import fails.

**Parameters:**

- `data` (object)
  - `importerId` (string) - Importer ID
  - `calendarId` (string) - Target calendar ID
  - `error` (string) - Error message

```javascript
Hooks.on('calendaria.importFailed', (data) => {
  console.error(`Import failed: ${data.error}`);
});
```

---

## Display Hooks

### calendaria.displayFormatsChanged

Fired when display format settings are saved.

**Parameters:**

- `newFormats` (object) - Updated display format configuration

```javascript
Hooks.on('calendaria.displayFormatsChanged', (newFormats) => {
  console.log('Display formats updated');
});
```

---

## Widget Hooks

### calendaria.widgetRegistered

Fired when a widget is registered via the Widget API.

**Parameters:**

- `fullId` (string) - Full widget ID (`moduleId.widgetId`)
- `config` (object) - Widget configuration

```javascript
Hooks.on('calendaria.widgetRegistered', (fullId, config) => {
  console.log(`Widget registered: ${fullId}`);
});
```

### calendaria.widgetsRefresh

Fired when widgets are refreshed (re-rendered).

**Parameters:** None

```javascript
Hooks.on('calendaria.widgetsRefresh', () => {
  console.log('Widgets refreshed');
});
```
