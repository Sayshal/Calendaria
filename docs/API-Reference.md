# API Reference

Calendaria exposes a public API at `CALENDARIA.api` for macros and module integration.

---

## Time Management

### getCurrentDateTime()

Get the current world date and time.

```javascript
const now = CALENDARIA.api.getCurrentDateTime();
// Returns: { year, month, dayOfMonth, hour, minute, second, ... }
```

**Returns:** `object` - Time components including year adjusted for yearZero.

---

### advanceTime(delta)

Advance time by a delta. GM only.

```javascript
await CALENDARIA.api.advanceTime({ hour: 8 });
await CALENDARIA.api.advanceTime({ day: 1, hour: 6 });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `delta` | `object` | Time delta (e.g., `{day: 1, hour: 2}`) |

**Returns:** `Promise<number>` - New world time in seconds.

---

### setDateTime(components)

Set time to specific values. GM only.

```javascript
await CALENDARIA.api.setDateTime({
  year: 1492,
  month: 5,
  day: 15,
  hour: 10,
  minute: 30
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `components` | `object` | Time components to set |

**Returns:** `Promise<number>` - New world time in seconds.

---

### jumpToDate(options)

Jump to a specific date while preserving current time of day. GM only.

```javascript
await CALENDARIA.api.jumpToDate({
  year: 1492,
  month: 5,  // 0-indexed
  day: 1
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.year` | `number` | Target year |
| `options.month` | `number` | Target month (0-indexed) |
| `options.day` | `number` | Target day of month |

**Returns:** `Promise<void>`

---

### advanceTimeToPreset(preset)

Advance time to the next occurrence of a preset time. GM only.

```javascript
await CALENDARIA.api.advanceTimeToPreset('sunrise');
await CALENDARIA.api.advanceTimeToPreset('midnight');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `preset` | `string` | `'sunrise'`, `'midday'`, `'noon'`, `'sunset'`, or `'midnight'` |

**Returns:** `Promise<number>` - New world time in seconds.

---

## Calendar Access

### getActiveCalendar()

Get the currently active calendar.

```javascript
const calendar = CALENDARIA.api.getActiveCalendar();
```

**Returns:** `object|null` - The active calendar or null.

---

### getCalendar(id)

Get a specific calendar by ID.

```javascript
const calendar = CALENDARIA.api.getCalendar("harptos");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Calendar ID |

**Returns:** `object|null` - The calendar or null if not found.

---

### getAllCalendars()

Get all registered calendars.

```javascript
const calendars = CALENDARIA.api.getAllCalendars();
```

**Returns:** `Map<string, object>` - Map of calendar ID to calendar.

---

### getAllCalendarMetadata()

Get metadata for all calendars.

```javascript
const metadata = CALENDARIA.api.getAllCalendarMetadata();
```

**Returns:** `object[]` - Array of calendar metadata.

---

### switchCalendar(id)

Switch to a different calendar. GM only.

```javascript
await CALENDARIA.api.switchCalendar("greyhawk");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | `string` | Calendar ID to switch to |

**Returns:** `Promise<boolean>` - True if switched successfully.

---

## Moon Phases

### getMoonPhase(moonIndex)

Get the current phase of a specific moon.

```javascript
const phase = CALENDARIA.api.getMoonPhase(0);
// Returns: { name, icon, position, dayInCycle }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `moonIndex` | `number` | Index of the moon (default: 0) |

**Returns:** `object|null` - Moon phase data.

---

### getAllMoonPhases()

Get phases for all moons in the active calendar.

```javascript
const moons = CALENDARIA.api.getAllMoonPhases();
```

**Returns:** `Array<object>` - Array of moon phase data.

---

## Seasons and Sun

### getCurrentSeason()

Get the current season.

```javascript
const season = CALENDARIA.api.getCurrentSeason();
```

**Returns:** `object|null` - Season data with name and properties.

---

### getCycleValues()

Get current values for all cycles (zodiac signs, elemental weeks, etc).

```javascript
const cycles = CALENDARIA.api.getCycleValues();
// Returns: { text, values: [{ cycleName, entryName, index }] }
```

**Returns:** `object|null` - Current cycle values.

---

### getSunrise()

Get today's sunrise time in hours.

```javascript
const sunrise = CALENDARIA.api.getSunrise();
// Returns: 6.5 (meaning 6:30 AM)
```

**Returns:** `number|null` - Sunrise time in hours.

---

### getSunset()

Get today's sunset time in hours.

```javascript
const sunset = CALENDARIA.api.getSunset();
// Returns: 18.5 (meaning 6:30 PM)
```

**Returns:** `number|null` - Sunset time in hours.

---

### getDaylightHours()

Get hours of daylight today.

```javascript
const hours = CALENDARIA.api.getDaylightHours();
```

**Returns:** `number|null` - Hours of daylight.

---

### getProgressDay()

Get progress through the day period (0 = sunrise, 1 = sunset).

```javascript
const progress = CALENDARIA.api.getProgressDay();
```

**Returns:** `number|null` - Progress value between 0-1.

---

### getProgressNight()

Get progress through the night period (0 = sunset, 1 = sunrise).

```javascript
const progress = CALENDARIA.api.getProgressNight();
```

**Returns:** `number|null` - Progress value between 0-1.

---

### getTimeUntilTarget(targetHour)

Get time until a specific hour of day.

```javascript
const time = CALENDARIA.api.getTimeUntilTarget(12);
// Returns: { hours, minutes, seconds }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `targetHour` | `number` | Target hour (0-24) |

**Returns:** `object|null` - Time remaining as `{ hours, minutes, seconds }`.

---

### getTimeUntilSunrise()

Get time until next sunrise.

```javascript
const time = CALENDARIA.api.getTimeUntilSunrise();
// Returns: { hours, minutes, seconds }
```

**Returns:** `object|null` - Time remaining.

---

### getTimeUntilSunset()

Get time until next sunset.

```javascript
const time = CALENDARIA.api.getTimeUntilSunset();
```

**Returns:** `object|null` - Time remaining.

---

### getTimeUntilMidnight()

Get time until midnight.

```javascript
const time = CALENDARIA.api.getTimeUntilMidnight();
```

**Returns:** `object|null` - Time remaining.

---

### getTimeUntilMidday()

Get time until midday (noon).

```javascript
const time = CALENDARIA.api.getTimeUntilMidday();
```

**Returns:** `object|null` - Time remaining.

---

### isDaytime()

Check if it's currently daytime.

```javascript
const daytime = CALENDARIA.api.isDaytime();
```

**Returns:** `boolean` - True if between sunrise and sunset.

---

### isNighttime()

Check if it's currently nighttime.

```javascript
const nighttime = CALENDARIA.api.isNighttime();
```

**Returns:** `boolean` - True if before sunrise or after sunset.

---

## Weekdays and Rest Days

### getCurrentWeekday()

Get the current weekday information.

```javascript
const weekday = CALENDARIA.api.getCurrentWeekday();
// Returns: { index, name, abbreviation, isRestDay }
```

**Returns:** `object|null` - Weekday data.

---

### isRestDay()

Check if today is a rest day.

```javascript
const isRest = CALENDARIA.api.isRestDay();
```

**Returns:** `boolean` - True if current day is a rest day.

---

## Festivals

### getCurrentFestival()

Get the festival on the current date, if any.

```javascript
const festival = CALENDARIA.api.getCurrentFestival();
```

**Returns:** `object|null` - Festival data with name, month, day.

---

### isFestivalDay()

Check if today is a festival day.

```javascript
const isFestival = CALENDARIA.api.isFestivalDay();
```

**Returns:** `boolean` - True if current date is a festival.

---

## Formatting

### formatDate(components, formatOrPreset)

Format date and time components as a string.

```javascript
// Using presets
const formatted = CALENDARIA.api.formatDate(null, 'long');
const formatted = CALENDARIA.api.formatDate(null, 'datetime');

// Using custom format
const formatted = CALENDARIA.api.formatDate({ year: 1492, month: 5, day: 15 }, '{DD} {MMMM} {YYYY}');
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `components` | `object` | Time components (defaults to current time) |
| `formatOrPreset` | `string` | Preset name or format string (default: `'long'`) |

**Presets:** `'short'`, `'long'`, `'full'`, `'time'`, `'time12'`, `'datetime'`

**Returns:** `string` - Formatted date/time string.

---

### timeSince(targetDate, currentDate)

Get relative time description between two dates.

```javascript
const relative = CALENDARIA.api.timeSince({ year: 1492, month: 5, dayOfMonth: 15 });
// Returns: "3 days ago" or "in 2 weeks"
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `targetDate` | `object` | Target date `{ year, month, dayOfMonth }` |
| `currentDate` | `object|null` | Current date (defaults to current time) |

**Returns:** `string` - Relative time string.

---

### getFormatTokens()

Get available format tokens and their descriptions.

```javascript
const tokens = CALENDARIA.api.getFormatTokens();
// Returns: [{ token, description, type }, ...]
```

**Returns:** `Array<object>` - Available format tokens.

---

### getFormatPresets()

Get default format presets.

```javascript
const presets = CALENDARIA.api.getFormatPresets();
```

**Returns:** `object` - Format preset definitions.

---

## Date/Time Conversion

### timestampToDate(timestamp)

Convert a world time timestamp to date components.

```javascript
const date = CALENDARIA.api.timestampToDate(86400);
// Returns: { year, month, dayOfMonth, hour, minute, second }
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `timestamp` | `number` | World time in seconds |

**Returns:** `object|null` - Date components.

---

### dateToTimestamp(date)

Convert date components to a world time timestamp.

```javascript
const timestamp = CALENDARIA.api.dateToTimestamp({
  year: 1492,
  month: 5,
  day: 15,
  hour: 10,
  minute: 30
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `date` | `object` | Date components |

**Returns:** `number` - World time in seconds.

---

### chooseRandomDate(startDate, endDate)

Generate a random date within a range.

```javascript
const randomDate = CALENDARIA.api.chooseRandomDate(
  { year: 1492, month: 0, day: 1 },
  { year: 1492, month: 11, day: 31 }
);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | `object` | Start date (defaults to current date) |
| `endDate` | `object` | End date (defaults to 1 year from start) |

**Returns:** `object` - Random date components.

---

## Notes

### getAllNotes()

Get all calendar notes.

```javascript
const notes = CALENDARIA.api.getAllNotes();
```

**Returns:** `object[]` - Array of note stubs with id, name, flagData, etc.

---

### getNote(pageId)

Get a specific note by ID.

```javascript
const note = CALENDARIA.api.getNote("abc123");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pageId` | `string` | Journal entry page ID |

**Returns:** `object|null` - Note stub or null.

---

### createNote(options)

Create a new calendar note. GM only.

```javascript
const note = await CALENDARIA.api.createNote({
  name: "Council Meeting",
  content: "<p>Meeting with the Lords' Alliance</p>",
  startDate: { year: 1492, month: 5, day: 15, hour: 14, minute: 0 },
  endDate: { year: 1492, month: 5, day: 15, hour: 16, minute: 0 },
  allDay: false,
  repeat: "never",
  categories: ["meeting"],
  icon: "fas fa-handshake",
  color: "#4a90e2",
  gmOnly: false
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.name` | `string` | Note title |
| `options.content` | `string` | Note content (HTML) |
| `options.startDate` | `object` | Start date `{year, month, day, hour?, minute?}` |
| `options.endDate` | `object` | End date (optional) |
| `options.allDay` | `boolean` | All-day event (default: `true`) |
| `options.repeat` | `string` | `'never'`, `'daily'`, `'weekly'`, `'monthly'`, `'yearly'` |
| `options.categories` | `string[]` | Category IDs |
| `options.icon` | `string` | Icon path or class |
| `options.color` | `string` | Event color (hex) |
| `options.gmOnly` | `boolean` | GM-only visibility |

**Returns:** `Promise<object|null>` - Created note page.

---

### updateNote(pageId, updates)

Update an existing note. GM only.

```javascript
await CALENDARIA.api.updateNote("abc123", {
  name: "Rescheduled Meeting",
  startDate: { year: 1492, month: 5, day: 16, hour: 14 }
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pageId` | `string` | Journal entry page ID |
| `updates` | `object` | Updates to apply |

**Returns:** `Promise<object|null>` - Updated note page.

---

### deleteNote(pageId)

Delete a calendar note.

```javascript
await CALENDARIA.api.deleteNote("abc123");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pageId` | `string` | Journal entry page ID |

**Returns:** `Promise<boolean>` - True if deleted successfully.

---

### deleteAllNotes()

Delete all calendar notes. GM only.

```javascript
await CALENDARIA.api.deleteAllNotes();
```

**Returns:** `Promise<number>` - Number of notes deleted.

---

### openNote(pageId, options)

Open a note in the UI.

```javascript
await CALENDARIA.api.openNote("abc123", { mode: "edit" });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `pageId` | `string` | Journal entry page ID |
| `options.mode` | `string` | `'view'` or `'edit'` (default: `'view'`) |

**Returns:** `Promise<void>`

---

## Note Queries

### getNotesForDate(year, month, day)

Get notes on a specific date.

```javascript
const notes = CALENDARIA.api.getNotesForDate(1492, 5, 15);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `year` | `number` | Display year |
| `month` | `number` | Month (0-indexed) |
| `day` | `number` | Day of month |

**Returns:** `object[]` - Array of note stubs.

---

### getNotesForMonth(year, month)

Get all notes in a month.

```javascript
const notes = CALENDARIA.api.getNotesForMonth(1492, 5);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `year` | `number` | Display year |
| `month` | `number` | Month (0-indexed) |

**Returns:** `object[]` - Array of note stubs.

---

### getNotesInRange(startDate, endDate)

Get notes within a date range.

```javascript
const notes = CALENDARIA.api.getNotesInRange(
  { year: 1492, month: 5, day: 1 },
  { year: 1492, month: 5, day: 31 }
);
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `startDate` | `object` | Start date `{year, month, day}` |
| `endDate` | `object` | End date `{year, month, day}` |

**Returns:** `object[]` - Array of note stubs.

---

### searchNotes(searchTerm, options)

Search notes by name or content.

```javascript
const results = CALENDARIA.api.searchNotes("dragon", {
  caseSensitive: false,
  categories: ["quest"]
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `searchTerm` | `string` | Text to search for |
| `options.caseSensitive` | `boolean` | Case-sensitive search (default: `false`) |
| `options.categories` | `string[]` | Filter by category IDs |

**Returns:** `object[]` - Array of note stubs.

---

### getNotesByCategory(categoryId)

Get notes with a specific category.

```javascript
const notes = CALENDARIA.api.getNotesByCategory("meeting");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `categoryId` | `string` | Category ID |

**Returns:** `object[]` - Array of note stubs.

---

### getCategories()

Get all category definitions.

```javascript
const categories = CALENDARIA.api.getCategories();
```

**Returns:** `object[]` - Array of category definitions.

---

## Search

### search(term, options)

Search all content including notes and dates.

```javascript
const results = CALENDARIA.api.search("council", {
  searchContent: true,
  limit: 10
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `term` | `string` | Search term (minimum 2 characters) |
| `options.searchContent` | `boolean` | Search note content |
| `options.limit` | `number` | Max results |

**Returns:** `object[]` - Array of results with type field.

---

## UI

### openCalendar(options)

Open the main calendar application.

```javascript
await CALENDARIA.api.openCalendar();
await CALENDARIA.api.openCalendar({ view: 'week' });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.date` | `object` | Date to display `{year, month, day}` |
| `options.view` | `string` | View mode: `'month'`, `'week'`, `'year'` |

**Returns:** `Promise<object>` - The calendar application.

---

### openCalendarEditor(calendarId)

Open the calendar editor. GM only.

```javascript
await CALENDARIA.api.openCalendarEditor();          // New calendar
await CALENDARIA.api.openCalendarEditor("custom");  // Edit existing
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `calendarId` | `string` | Calendar ID to edit (omit for new) |

**Returns:** `Promise<object|null>` - The editor application.

---

### showMiniCalendar()

Show the MiniCalendar widget.

```javascript
await CALENDARIA.api.showMiniCalendar();
```

**Returns:** `Promise<object>` - The MiniCalendar application.

---

### hideMiniCalendar()

Hide the MiniCalendar widget.

```javascript
await CALENDARIA.api.hideMiniCalendar();
```

**Returns:** `Promise<void>`

---

### toggleMiniCalendar()

Toggle the MiniCalendar widget visibility.

```javascript
await CALENDARIA.api.toggleMiniCalendar();
```

**Returns:** `Promise<void>`

---

## Weather

### getCurrentWeather()

Get current weather state.

```javascript
const weather = CALENDARIA.api.getCurrentWeather();
// Returns: { id, label, icon, color, temperature }
```

**Returns:** `object|null` - Current weather state.

---

### setWeather(presetId, options)

Set weather by preset ID.

```javascript
await CALENDARIA.api.setWeather("thunderstorm", { temperature: 65 });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `presetId` | `string` | Weather preset ID (e.g., `'clear'`, `'rain'`, `'thunderstorm'`) |
| `options.temperature` | `number` | Optional temperature value |

**Returns:** `Promise<object>` - The set weather.

---

### setCustomWeather(weatherData)

Set custom weather with arbitrary values.

```javascript
await CALENDARIA.api.setCustomWeather({
  label: "Magical Storm",
  icon: "fas fa-bolt",
  color: "#9b59b6",
  description: "Arcane lightning crackles overhead",
  temperature: 45
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `weatherData.label` | `string` | Display label |
| `weatherData.icon` | `string` | Font Awesome icon class |
| `weatherData.color` | `string` | Display color |
| `weatherData.description` | `string` | Description text |
| `weatherData.temperature` | `number` | Temperature value |

**Returns:** `Promise<object>` - The set weather.

---

### clearWeather()

Clear the current weather.

```javascript
await CALENDARIA.api.clearWeather();
```

**Returns:** `Promise<void>`

---

### generateWeather(options)

Generate and set weather based on climate and season.

```javascript
await CALENDARIA.api.generateWeather();
await CALENDARIA.api.generateWeather({ climate: "tropical", season: "summer" });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.climate` | `string` | Climate override |
| `options.season` | `string` | Season override |

**Returns:** `Promise<object>` - Generated weather.

---

### getWeatherForecast(options)

Get a weather forecast for upcoming days.

```javascript
const forecast = await CALENDARIA.api.getWeatherForecast({ days: 7 });
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `options.days` | `number` | Number of days to forecast |
| `options.climate` | `string` | Climate override |

**Returns:** `Promise<object[]>` - Array of forecast entries.

---

### getActiveZone()

Get the active climate zone.

```javascript
const zone = CALENDARIA.api.getActiveZone();
```

**Returns:** `object|null` - Active zone config.

---

### setActiveZone(zoneId)

Set the active climate zone.

```javascript
await CALENDARIA.api.setActiveZone("desert");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `zoneId` | `string` | Climate zone ID |

**Returns:** `Promise<void>`

---

### getWeatherPresets()

Get all available weather presets.

```javascript
const presets = await CALENDARIA.api.getWeatherPresets();
```

**Returns:** `Promise<object[]>` - Array of weather presets.

---

### getCalendarZones()

Get all climate zones for the active calendar.

```javascript
const zones = CALENDARIA.api.getCalendarZones();
```

**Returns:** `object[]` - Array of zone configs.

---

### addWeatherPreset(preset)

Add a custom weather preset.

```javascript
await CALENDARIA.api.addWeatherPreset({
  id: "acid-rain",
  label: "Acid Rain",
  icon: "fas fa-skull",
  color: "#2ecc71",
  description: "Corrosive precipitation"
});
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `preset.id` | `string` | Unique ID |
| `preset.label` | `string` | Display label |
| `preset.icon` | `string` | Icon class |
| `preset.color` | `string` | Display color |
| `preset.description` | `string` | Description |

**Returns:** `Promise<object>` - The added preset.

---

### removeWeatherPreset(presetId)

Remove a custom weather preset.

```javascript
await CALENDARIA.api.removeWeatherPreset("acid-rain");
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `presetId` | `string` | Preset ID to remove |

**Returns:** `Promise<boolean>` - True if removed.

---

## Multiplayer & Permissions

### isPrimaryGM()

Check if current user is the primary GM (responsible for time saves and sync).

```javascript
const isPrimary = CALENDARIA.api.isPrimaryGM();
```

**Returns:** `boolean`

---

### canModifyTime()

Check if current user can modify time.

```javascript
const canModify = CALENDARIA.api.canModifyTime();
```

**Returns:** `boolean`

---

### canManageNotes()

Check if current user can create/edit notes.

```javascript
const canManage = CALENDARIA.api.canManageNotes();
```

**Returns:** `boolean`

---

## Hooks

### hooks

Get all available Calendaria hook names.

```javascript
const hooks = CALENDARIA.api.hooks;
```

**Returns:** `object` - Hook name constants.

**Available Hooks:**

| Hook | Description |
|------|-------------|
| `calendaria.init` | Module initialization |
| `calendaria.ready` | Module ready (provides `{api, calendar, version}`) |
| `calendaria.calendarSwitched` | Active calendar changed |
| `calendaria.remoteCalendarSwitch` | Remote calendar switch received |
| `calendaria.calendarAdded` | New calendar added |
| `calendaria.calendarUpdated` | Calendar updated |
| `calendaria.calendarRemoved` | Calendar removed |
| `calendaria.dateTimeChange` | Date/time changed |
| `calendaria.dayChange` | Day changed |
| `calendaria.monthChange` | Month changed |
| `calendaria.yearChange` | Year changed |
| `calendaria.seasonChange` | Season changed |
| `calendaria.remoteDateChange` | Remote date change received |
| `calendaria.sunrise` | Sunrise occurred |
| `calendaria.sunset` | Sunset occurred |
| `calendaria.midnight` | Midnight occurred |
| `calendaria.midday` | Midday occurred |
| `calendaria.moonPhaseChange` | Moon phase changed |
| `calendaria.restDayChange` | Rest day status changed |
| `calendaria.clockStartStop` | Clock started/stopped |
| `calendaria.clockUpdate` | Clock tick |
| `calendaria.noteCreated` | Note created |
| `calendaria.noteUpdated` | Note updated |
| `calendaria.noteDeleted` | Note deleted |
| `calendaria.eventTriggered` | Scheduled event triggered |
| `calendaria.eventDayChanged` | Event day changed |
| `calendaria.preRenderCalendar` | Before calendar render |
| `calendaria.renderCalendar` | After calendar render |
| `calendaria.importStarted` | Import started |
| `calendaria.importComplete` | Import completed |
| `calendaria.importFailed` | Import failed |
| `calendaria.weatherChange` | Weather changed |

**Hook Example:**

```javascript
Hooks.on('calendaria.ready', ({ api, calendar, version }) => {
  console.log(`Calendaria v${version} ready with calendar: ${calendar?.id}`);
});

Hooks.on('calendaria.dayChange', (components) => {
  console.log(`New day: ${components.dayOfMonth}/${components.month}/${components.year}`);
});
```
