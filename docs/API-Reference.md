# API Reference

Calendaria exposes a public API at `CALENDARIA.api` for macros and module integration.

## Time Management

### getCurrentDateTime()

Get the current world time.

```javascript
const now = CALENDARIA.api.getCurrentDateTime();
// Returns: { year, month, day, hour, minute, second, weekday, ... }
```

### advanceTime(delta)

Advance time by a delta. GM only.

```javascript
await CALENDARIA.api.advanceTime({ hour: 8 });
await CALENDARIA.api.advanceTime({ day: 1, hour: 6 });
// Returns: New world time (seconds)
```

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

### jumpToDate(options)

Jump to a specific date.

```javascript
await CALENDARIA.api.jumpToDate({
  year: 1492,
  month: 5,
  day: 1
});
```

---

## Calendar Access

### getActiveCalendar()

Get the currently active calendar.

```javascript
const calendar = CALENDARIA.api.getActiveCalendar();
```

### getCalendar(id)

Get a specific calendar by ID.

```javascript
const calendar = CALENDARIA.api.getCalendar("harptos");
```

### getAllCalendars()

Get all available calendars.

```javascript
const calendars = CALENDARIA.api.getAllCalendars();
// Returns: Map<string, object>
```

### switchCalendar(id)

Switch to a different calendar. Reloads the world.

```javascript
await CALENDARIA.api.switchCalendar("greyhawk");
```

---

## Moon Phases

### getMoonPhase(moonIndex)

Get the current phase of a moon.

```javascript
const phase = CALENDARIA.api.getMoonPhase(0);
// Returns: { name, icon, position, dayInCycle }
```

### getAllMoonPhases()

Get phases for all moons.

```javascript
const moons = CALENDARIA.api.getAllMoonPhases();
// Returns: Array of moon phase objects
```

---

## Seasons and Sun

### getCurrentSeason()

Get the current season.

```javascript
const season = CALENDARIA.api.getCurrentSeason();
// Returns: { name, icon, color, ... }
```

### getCycleValues()

Get current values for all cycles.

```javascript
const cycles = CALENDARIA.api.getCycleValues();
// Returns: { text, values: [{ cycleName, entryName, index }] }
```

### getSunrise()

Get today's sunrise time.

```javascript
const sunrise = CALENDARIA.api.getSunrise();
// Returns: number (hours, e.g., 6.5 = 6:30 AM)
```

### getSunset()

Get today's sunset time.

```javascript
const sunset = CALENDARIA.api.getSunset();
// Returns: number (hours, e.g., 18.5 = 6:30 PM)
```

### getDaylightHours()

Get hours of daylight today.

```javascript
const hours = CALENDARIA.api.getDaylightHours();
// Returns: number (e.g., 12.5)
```

### getProgressDay()

Get progress through daylight hours (0-1).

```javascript
const progress = CALENDARIA.api.getProgressDay();
```

### getProgressNight()

Get progress through night hours (0-1).

```javascript
const progress = CALENDARIA.api.getProgressNight();
```

### getTimeUntilSunrise() / getTimeUntilSunset()

Get seconds until sunrise or sunset.

```javascript
const seconds = CALENDARIA.api.getTimeUntilSunrise();
```

### getTimeUntilMidnight() / getTimeUntilMidday()

Get seconds until midnight or midday.

```javascript
const seconds = CALENDARIA.api.getTimeUntilMidnight();
```

---

## Weekdays and Rest Days

### getCurrentWeekday()

Get the current weekday.

```javascript
const weekday = CALENDARIA.api.getCurrentWeekday();
// Returns: { index, name, abbreviation, isRestDay }
```

### isRestDay()

Check if today is a rest day.

```javascript
const isRest = CALENDARIA.api.isRestDay();
// Returns: boolean
```

---

## Festivals

### getCurrentFestival()

Get the festival on the current date, if any.

```javascript
const festival = CALENDARIA.api.getCurrentFestival();
// Returns: { name, month, day } or null
```

### isFestivalDay()

Check if today is a festival.

```javascript
const isFestival = CALENDARIA.api.isFestivalDay();
// Returns: boolean
```

---

## Formatting

### formatDate(components, formatter)

Format a date/time.

```javascript
const formatted = CALENDARIA.api.formatDate(null, 'date');
const formatted = CALENDARIA.api.formatDate({ year: 1492, month: 5, day: 15 }, 'datetime');
```

---

## Notes

### getAllNotes()

Get all calendar notes.

```javascript
const notes = CALENDARIA.api.getAllNotes();
// Returns: Array of note stubs
```

### getNote(pageId)

Get a specific note by ID.

```javascript
const note = CALENDARIA.api.getNote("abc123");
```

### createNote(options)

Create a new calendar note.

```javascript
const note = await CALENDARIA.api.createNote({
  name: "Council Meeting",
  content: "<p>Meeting with the Lords' Alliance</p>",
  startDate: { year: 1492, month: 5, day: 15, hour: 14, minute: 0 },
  allDay: false,
  repeat: "never",
  categories: ["meeting"],
  gmOnly: false
});
```

### updateNote(pageId, updates)

Update an existing note.

```javascript
await CALENDARIA.api.updateNote("abc123", {
  name: "Rescheduled Meeting",
  startDate: { year: 1492, month: 5, day: 16, hour: 14 }
});
```

### deleteNote(pageId)

Delete a note.

```javascript
await CALENDARIA.api.deleteNote("abc123");
```

### deleteAllNotes()

Delete all calendar notes. GM only.

```javascript
await CALENDARIA.api.deleteAllNotes();
```

### openNote(pageId, options)

Open a note sheet.

```javascript
await CALENDARIA.api.openNote("abc123", { mode: "edit" });
```

---

## Note Queries

### getNotesForDate(year, month, day)

Get notes on a specific date.

```javascript
const notes = await CALENDARIA.api.getNotesForDate(1492, 5, 15);
```

### getNotesForMonth(year, month)

Get all notes in a month.

```javascript
const notes = await CALENDARIA.api.getNotesForMonth(1492, 5);
```

### getNotesInRange(startDate, endDate)

Get notes within a date range.

```javascript
const notes = await CALENDARIA.api.getNotesInRange(
  { year: 1492, month: 5, day: 1 },
  { year: 1492, month: 5, day: 31 }
);
```

### searchNotes(term)

Search notes by name or content.

```javascript
const results = await CALENDARIA.api.searchNotes("dragon");
```

### getNotesByCategory(category)

Get notes with a specific category.

```javascript
const notes = await CALENDARIA.api.getNotesByCategory("meeting");
```

### getCategories()

Get all note categories.

```javascript
const categories = CALENDARIA.api.getCategories();
```

---

## Search

### search(term, options)

Search across calendar content.

```javascript
const results = CALENDARIA.api.search("council", {
  searchContent: true,
  limit: 10
});
```

---

## UI

### openCalendar()

Open the main calendar application.

```javascript
CALENDARIA.api.openCalendar();
```

### openCalendarEditor()

Open the calendar editor.

```javascript
CALENDARIA.api.openCalendarEditor();
```

### openCompactCalendar()

Open the compact calendar widget.

```javascript
CALENDARIA.api.openCompactCalendar();
```

---

## Weather

### getWeather()

Get current weather.

```javascript
const weather = CALENDARIA.api.getWeather();
// Returns: { condition, temperature, description }
```

### setWeather(condition, temperature)

Set weather manually.

```javascript
await CALENDARIA.api.setWeather("thunderstorm", 65);
```

### generateWeather()

Generate weather from climate zone.

```javascript
await CALENDARIA.api.generateWeather();
```

### getWeatherForecast(days)

Get a weather forecast.

```javascript
const forecast = await CALENDARIA.api.getWeatherForecast(7);
```
