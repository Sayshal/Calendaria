# API Reference

Calendaria exposes a public API at `CALENDARIA.api` for macros and module integration.

> [!IMPORTANT]
> Methods marked "GM only" will fail silently or show a warning when called by non-GM users.

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

| Parameter | Type     | Description                            |
| --------- | -------- | -------------------------------------- |
| `delta`   | `object` | Time delta (e.g., `{day: 1, hour: 2}`) |

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

| Parameter    | Type     | Description            |
| ------------ | -------- | ---------------------- |
| `components` | `object` | Time components to set |

**Returns:** `Promise<number>` - New world time in seconds.

---

### jumpToDate(options)

Jump to a specific date while preserving current time of day. GM only.

```javascript
await CALENDARIA.api.jumpToDate({
  year: 1492,
  month: 5, // 0-indexed
  day: 1
});
```

| Parameter       | Type     | Description              |
| --------------- | -------- | ------------------------ |
| `options.year`  | `number` | Target year              |
| `options.month` | `number` | Target month (0-indexed) |
| `options.day`   | `number` | Target day of month      |

**Returns:** `Promise<void>`

---

### advanceTimeToPreset(preset)

Advance time to the next occurrence of a preset time. GM only.

```javascript
await CALENDARIA.api.advanceTimeToPreset('sunrise');
await CALENDARIA.api.advanceTimeToPreset('midnight');
```

| Parameter | Type     | Description                                                    |
| --------- | -------- | -------------------------------------------------------------- |
| `preset`  | `string` | `'sunrise'`, `'midday'`, `'noon'`, `'sunset'`, or `'midnight'` |

**Returns:** `Promise<number>` - New world time in seconds.

---

## Clock Control

### isClockRunning()

Check if the real-time clock is currently running.

```javascript
const running = CALENDARIA.api.isClockRunning();
```

**Returns:** `boolean` - True if the clock is running.

---

### startClock()

Start the real-time clock. Requires time-change permission. Blocked during active combat or when the game is paused with sync enabled.

```javascript
CALENDARIA.api.startClock();
```

**Returns:** `void`

---

### stopClock()

Stop the real-time clock.

```javascript
CALENDARIA.api.stopClock();
```

**Returns:** `void`

---

### toggleClock()

Toggle the real-time clock on or off.

```javascript
CALENDARIA.api.toggleClock();
```

**Returns:** `void`

---

### isClockLocked()

Check if the clock is currently locked. When locked, all time advancement is blocked.

```javascript
const locked = CALENDARIA.api.isClockLocked();
```

**Returns:** `boolean` - True if the clock is locked.

---

### toggleClockLock()

Toggle the clock lock state. GM only.

```javascript
await CALENDARIA.api.toggleClockLock();
```

**Returns:** `Promise<void>`

---

### getClockSpeed()

Get the current real-time clock speed (game seconds per real second).

```javascript
const speed = CALENDARIA.api.getClockSpeed();
// Returns: 1 (1 game second per real second at default speed)
```

**Returns:** `number` - Clock speed multiplier.

---

## Calendar Access

Calendar collections (months, weekdays, seasons, moons, etc.) are stored as keyed objects with string IDs, not arrays. Use the convenience getter arrays for ordered iteration:

| Getter                | Collection       |
| --------------------- | ---------------- |
| `monthsArray`         | `months.values`  |
| `weekdaysArray`       | `days.values`    |
| `seasonsArray`        | `seasons.values` |
| `moonsArray`          | `moons`          |
| `cyclesArray`         | `cycles`         |
| `erasArray`           | `eras`           |
| `festivalsArray`      | `festivals`      |
| `canonicalHoursArray` | `canonicalHours` |
| `namedWeeksArray`     | `weeks.names`    |
| `weatherZonesArray`   | `weather.zones`  |

The `daysInWeek` getter returns `weekdaysArray.length || 7`.

```javascript
const calendar = CALENDARIA.api.getActiveCalendar();
const months = calendar.monthsArray; // ordered array
const weekCount = calendar.daysInWeek; // number of weekdays or 7
```

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
const calendar = CALENDARIA.api.getCalendar('harptos');
```

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `id`      | `string` | Calendar ID |

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
await CALENDARIA.api.switchCalendar('greyhawk');
```

| Parameter | Type     | Description              |
| --------- | -------- | ------------------------ |
| `id`      | `string` | Calendar ID to switch to |

**Returns:** `Promise<boolean>` - True if switched successfully.

---

## Moon Phases

### getMoonPhase(moonIndex)

Get the current phase of a specific moon.

```javascript
const phase = CALENDARIA.api.getMoonPhase(0);
// Returns: { name, icon, position, dayInCycle }
```

| Parameter   | Type     | Description                    |
| ----------- | -------- | ------------------------------ |
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

### getMoonPhasePosition(moonIndex, date)

Get the exact phase position (0–1) for a moon on a given date.

```javascript
const position = CALENDARIA.api.getMoonPhasePosition(0);
// Returns: 0.5 (full moon)
```

| Parameter   | Type     | Description                       |
| ----------- | -------- | --------------------------------- |
| `moonIndex` | `number` | Moon index (default: 0)           |
| `date`      | `object` | Optional date (defaults to today) |

**Returns:** `number` - Phase position from 0 (new moon) to 1.

---

### isMoonFull(moonIndex, date)

Check if a moon is currently in its full phase.

```javascript
const isFull = CALENDARIA.api.isMoonFull(0);
```

| Parameter   | Type     | Description             |
| ----------- | -------- | ----------------------- |
| `moonIndex` | `number` | Moon index (default: 0) |
| `date`      | `object` | Optional date           |

**Returns:** `boolean` - True if the moon is in its full phase.

---

### getNextFullMoon(moonIndex, fromDate)

Get the date of the next full moon.

```javascript
const date = CALENDARIA.api.getNextFullMoon(0);
// Returns: { year, month, day }
```

| Parameter   | Type     | Description                    |
| ----------- | -------- | ------------------------------ |
| `moonIndex` | `number` | Moon index (default: 0)        |
| `fromDate`  | `object` | Start date (defaults to today) |

**Returns:** `object` - Date of next full moon.

---

### getNextConvergence(fromDate)

Get the date when all moons are simultaneously full.

```javascript
const date = CALENDARIA.api.getNextConvergence();
```

| Parameter  | Type     | Description                    |
| ---------- | -------- | ------------------------------ |
| `fromDate` | `object` | Start date (defaults to today) |

**Returns:** `object|null` - Date of next convergence, or null if not found within search range.

---

### getConvergencesInRange(startDate, endDate)

Get all dates within a range where all moons are simultaneously full.

```javascript
const dates = CALENDARIA.api.getConvergencesInRange({ year: 1492, month: 0, day: 1 }, { year: 1493, month: 0, day: 1 });
```

| Parameter   | Type     | Description |
| ----------- | -------- | ----------- |
| `startDate` | `object` | Range start |
| `endDate`   | `object` | Range end   |

**Returns:** `object[]` - Array of convergence dates.

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

### getSunrise(zone)

Get today's sunrise time in hours.

```javascript
const sunrise = CALENDARIA.api.getSunrise();
// With explicit zone:
const sunrise = CALENDARIA.api.getSunrise(myZone);
// Returns: 6.5 (meaning 6:30 AM)
```

| Parameter | Type           | Description                                        |
| --------- | -------------- | -------------------------------------------------- |
| `zone`    | `object\|null` | Climate zone object (default: active scene's zone) |

**Returns:** `number|null` - Sunrise time in hours.

---

### getSunset(zone)

Get today's sunset time in hours.

```javascript
const sunset = CALENDARIA.api.getSunset();
// With explicit zone:
const sunset = CALENDARIA.api.getSunset(myZone);
// Returns: 18.5 (meaning 6:30 PM)
```

| Parameter | Type           | Description                                        |
| --------- | -------------- | -------------------------------------------------- |
| `zone`    | `object\|null` | Climate zone object (default: active scene's zone) |

**Returns:** `number|null` - Sunset time in hours.

---

### getDaylightHours(zone)

Get hours of daylight today.

```javascript
const hours = CALENDARIA.api.getDaylightHours();
// With explicit zone:
const hours = CALENDARIA.api.getDaylightHours(myZone);
```

| Parameter | Type           | Description                                        |
| --------- | -------------- | -------------------------------------------------- |
| `zone`    | `object\|null` | Climate zone object (default: active scene's zone) |

**Returns:** `number|null` - Hours of daylight.

---

### getProgressDay(zone)

Get progress through the day period (0 = sunrise, 1 = sunset).

```javascript
const progress = CALENDARIA.api.getProgressDay();
// With explicit zone:
const progress = CALENDARIA.api.getProgressDay(myZone);
```

| Parameter | Type           | Description                                        |
| --------- | -------------- | -------------------------------------------------- |
| `zone`    | `object\|null` | Climate zone object (default: active scene's zone) |

**Returns:** `number|null` - Progress value between 0-1.

---

### getProgressNight(zone)

Get progress through the night period (0 = sunset, 1 = sunrise).

```javascript
const progress = CALENDARIA.api.getProgressNight();
// With explicit zone:
const progress = CALENDARIA.api.getProgressNight(myZone);
```

| Parameter | Type           | Description                                        |
| --------- | -------------- | -------------------------------------------------- |
| `zone`    | `object\|null` | Climate zone object (default: active scene's zone) |

**Returns:** `number|null` - Progress value between 0-1.

---

### getTimeUntilTarget(targetHour)

Get time until a specific hour of day.

```javascript
const time = CALENDARIA.api.getTimeUntilTarget(12);
// Returns: { hours, minutes, seconds }
```

| Parameter    | Type     | Description                    |
| ------------ | -------- | ------------------------------ |
| `targetHour` | `number` | Target hour (0 to hoursPerDay) |

**Returns:** `object|null` - Time remaining as `{ hours, minutes, seconds }`.

> [!NOTE]
> For calendars with non-standard time (e.g., 20 hours/day), the targetHour range is 0 to `hoursPerDay`.

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
const formatted = CALENDARIA.api.formatDate(null, 'dateLong');
const formatted = CALENDARIA.api.formatDate(null, 'datetime12');

// Using custom format
const formatted = CALENDARIA.api.formatDate({ year: 1492, month: 5, day: 15 }, 'DD MMMM YYYY');
```

| Parameter        | Type     | Description                                          |
| ---------------- | -------- | ---------------------------------------------------- |
| `components`     | `object` | Time components (defaults to current time)           |
| `formatOrPreset` | `string` | Preset name or format string (default: `'dateLong'`) |

**Presets:**

| Category        | Presets                                                                       |
| --------------- | ----------------------------------------------------------------------------- |
| Utility         | `'off'`, `'calendarDefault'`, `'custom'`                                      |
| Approximate     | `'approxDate'`, `'approxTime'`                                                |
| Standard        | `'dateShort'`, `'dateMedium'`, `'dateLong'`, `'dateFull'`                     |
| Regional        | `'dateUS'`, `'dateUSFull'`, `'dateISO'`, `'dateNumericUS'`, `'dateNumericEU'` |
| Ordinal/Fantasy | `'ordinal'`, `'ordinalLong'`, `'ordinalEra'`, `'ordinalFull'`, `'seasonDate'` |
| Time            | `'time12'`, `'time12Sec'`, `'time24'`, `'time24Sec'`                          |
| DateTime        | `'datetimeShort12'`, `'datetimeShort24'`, `'datetime12'`, `'datetime24'`      |

**Returns:** `string` - Formatted date/time string.

> [!NOTE]
> When passing custom `components`, the `day` property should be 1-indexed (1-31). Internal time components use 0-indexed `dayOfMonth` (0-30). The `formatDate()` function automatically converts to 1-indexed for display when using `D` or `DD` tokens.

---

### timeSince(targetDate, currentDate)

Get relative time description between two dates.

```javascript
const relative = CALENDARIA.api.timeSince({ year: 1492, month: 5, dayOfMonth: 15 });
// Returns: "3 days ago" or "in 2 weeks"
```

| Parameter     | Type               | Description                               |
| ------------- | ------------------ | ----------------------------------------- |
| `targetDate`  | `object`           | Target date `{ year, month, dayOfMonth }` |
| `currentDate` | `object` or `null` | Current date (defaults to current time)   |

**Returns:** `string` - Relative time string.

---

### getFormatTokens()

Get available format tokens and their descriptions.

```javascript
const tokens = CALENDARIA.api.getFormatTokens();
// Returns: [{ token, descriptionKey, type }, ...]
```

**Returns:** `Array<{token: string, descriptionKey: string, type: string}>` - Available format tokens.

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

| Parameter   | Type     | Description           |
| ----------- | -------- | --------------------- |
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

| Parameter | Type     | Description     |
| --------- | -------- | --------------- |
| `date`    | `object` | Date components |

**Returns:** `number` - World time in seconds.

---

### chooseRandomDate(startDate, endDate)

Generate a random date within a range.

```javascript
const randomDate = CALENDARIA.api.chooseRandomDate({ year: 1492, month: 0, day: 1 }, { year: 1492, month: 11, day: 31 });
```

| Parameter   | Type     | Description                              |
| ----------- | -------- | ---------------------------------------- |
| `startDate` | `object` | Start date (defaults to current date)    |
| `endDate`   | `object` | End date (defaults to 1 year from start) |

**Returns:** `object` - Random date components.

---

## Date Arithmetic

### addDays(date, days)

Add days to a date.

```javascript
const newDate = CALENDARIA.api.addDays({ year: 1492, month: 5, day: 15 }, 10);
// Returns date 10 days later
```

| Parameter | Type     | Description                        |
| --------- | -------- | ---------------------------------- |
| `date`    | `object` | Date `{ year, month, day }`        |
| `days`    | `number` | Days to add (negative to subtract) |

**Returns:** `object` - New date components.

---

### addMonths(date, months)

Add months to a date.

```javascript
const newDate = CALENDARIA.api.addMonths({ year: 1492, month: 5, day: 15 }, 3);
```

| Parameter | Type     | Description                          |
| --------- | -------- | ------------------------------------ |
| `date`    | `object` | Date `{ year, month, day }`          |
| `months`  | `number` | Months to add (negative to subtract) |

**Returns:** `object` - New date components.

---

### addYears(date, years)

Add years to a date.

```javascript
const newDate = CALENDARIA.api.addYears({ year: 1492, month: 5, day: 15 }, 10);
```

| Parameter | Type     | Description                         |
| --------- | -------- | ----------------------------------- |
| `date`    | `object` | Date `{ year, month, day }`         |
| `years`   | `number` | Years to add (negative to subtract) |

**Returns:** `object` - New date components.

---

### daysBetween(startDate, endDate)

Calculate the number of days between two dates.

```javascript
const days = CALENDARIA.api.daysBetween({ year: 1492, month: 5, day: 1 }, { year: 1492, month: 5, day: 15 });
// Returns: 14
```

| Parameter   | Type     | Description                       |
| ----------- | -------- | --------------------------------- |
| `startDate` | `object` | Start date `{ year, month, day }` |
| `endDate`   | `object` | End date `{ year, month, day }`   |

**Returns:** `number` - Days between dates (positive if endDate is later).

---

### monthsBetween(startDate, endDate)

Calculate the number of months between two dates.

```javascript
const months = CALENDARIA.api.monthsBetween({ year: 1492, month: 0, day: 1 }, { year: 1492, month: 6, day: 1 });
// Returns: 6
```

| Parameter   | Type     | Description                       |
| ----------- | -------- | --------------------------------- |
| `startDate` | `object` | Start date `{ year, month, day }` |
| `endDate`   | `object` | End date `{ year, month, day }`   |

**Returns:** `number` - Months between dates.

---

### compareDates(date1, date2)

Compare two dates including time components.

```javascript
const result = CALENDARIA.api.compareDates({ year: 1492, month: 5, day: 15, hour: 10 }, { year: 1492, month: 5, day: 15, hour: 14 });
// Returns: -1 (date1 is earlier)
```

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `date1`   | `object` | First date  |
| `date2`   | `object` | Second date |

**Returns:** `number` - `-1` if date1 < date2, `0` if equal, `1` if date1 > date2.

---

### compareDays(date1, date2)

Compare two dates ignoring time components.

```javascript
const result = CALENDARIA.api.compareDays({ year: 1492, month: 5, day: 15 }, { year: 1492, month: 5, day: 20 });
// Returns: -1 (date1 is earlier)
```

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `date1`   | `object` | First date  |
| `date2`   | `object` | Second date |

**Returns:** `number` - `-1` if date1 < date2, `0` if same day, `1` if date1 > date2.

---

### isSameDay(date1, date2)

Check if two dates are the same day.

```javascript
const same = CALENDARIA.api.isSameDay({ year: 1492, month: 5, day: 15, hour: 10 }, { year: 1492, month: 5, day: 15, hour: 20 });
// Returns: true
```

| Parameter | Type     | Description |
| --------- | -------- | ----------- |
| `date1`   | `object` | First date  |
| `date2`   | `object` | Second date |

**Returns:** `boolean` - True if same calendar day.

---

### dayOfWeek(date)

Get the weekday index for a date.

```javascript
const weekday = CALENDARIA.api.dayOfWeek({ year: 1492, month: 5, day: 15 });
// Returns: 0-6 depending on calendar weekdays
```

| Parameter | Type     | Description                 |
| --------- | -------- | --------------------------- |
| `date`    | `object` | Date `{ year, month, day }` |

**Returns:** `number` - Weekday index (0-based).

---

### isValidDate(date)

Check if a date is valid for the active calendar.

```javascript
const valid = CALENDARIA.api.isValidDate({ year: 1492, month: 5, day: 31 });
```

| Parameter | Type     | Description                 |
| --------- | -------- | --------------------------- |
| `date`    | `object` | Date `{ year, month, day }` |

**Returns:** `boolean` - True if date exists in the calendar.

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
const note = CALENDARIA.api.getNote('abc123');
```

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| `pageId`  | `string` | Journal entry page ID |

**Returns:** `object|null` - Note stub or null.

---

### getNoteDocument(pageId)

Get the full Foundry JournalEntryPage document for a note.

```javascript
const page = CALENDARIA.api.getNoteDocument('abc123');
// Access full document properties
console.log(page.text.content);
```

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| `pageId`  | `string` | Journal entry page ID |

**Returns:** `JournalEntryPage|null` - Full Foundry document or null.

> [!NOTE]
> Use `getNote()` for calendar-specific data (stub). Use `getNoteDocument()` when you need the full Foundry document for content access or document methods.

---

### createNote(options)

Create a new calendar note. Players can create their own notes; GM can create notes for anyone.

```javascript
const note = await CALENDARIA.api.createNote({
  name: 'Council Meeting',
  content: "<p>Meeting with the Lords' Alliance</p>",
  startDate: { year: 1492, month: 5, day: 15, hour: 14, minute: 0 },
  endDate: { year: 1492, month: 5, day: 15, hour: 16, minute: 0 },
  allDay: false,
  repeat: 'never',
  categories: ['meeting'],
  icon: 'fas fa-handshake',
  color: '#4a90e2',
  gmOnly: false,
  openSheet: 'edit'
});
```

| Parameter            | Type                    | Description                                                                   |
| -------------------- | ----------------------- | ----------------------------------------------------------------------------- |
| `options.name`       | `string`                | Note title                                                                    |
| `options.content`    | `string`                | Note content (HTML)                                                           |
| `options.startDate`  | `object`                | Start date `{year, month, day, hour?, minute?}`                               |
| `options.endDate`    | `object`                | End date (optional)                                                           |
| `options.allDay`     | `boolean`               | All-day event (default: `true`)                                               |
| `options.repeat`     | `string`                | `'never'`, `'daily'`, `'weekly'`, `'monthly'`, `'yearly'`                     |
| `options.categories` | `string[]`              | Category IDs                                                                  |
| `options.icon`       | `string`                | Icon path or class                                                            |
| `options.color`      | `string`                | Event color (hex)                                                             |
| `options.gmOnly`     | `boolean`               | GM-only visibility                                                            |
| `options.openSheet`  | `false\|'edit'\|'view'` | Open the note sheet after creation in the given mode (default: `'edit'`). Pass boolean `false` to skip. |

**Returns:** `Promise<object|null>` - Created note page.

---

### updateNote(pageId, updates)

Update an existing note. GM only.

```javascript
await CALENDARIA.api.updateNote('abc123', {
  name: 'Rescheduled Meeting',
  startDate: { year: 1492, month: 5, day: 16, hour: 14 }
});
```

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| `pageId`  | `string` | Journal entry page ID |
| `updates` | `object` | Updates to apply      |

**Returns:** `Promise<object|null>` - Updated note page.

---

### deleteNote(pageId)

Delete a calendar note.

```javascript
await CALENDARIA.api.deleteNote('abc123');
```

| Parameter | Type     | Description           |
| --------- | -------- | --------------------- |
| `pageId`  | `string` | Journal entry page ID |

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
await CALENDARIA.api.openNote('abc123', { mode: 'edit' });
```

| Parameter      | Type     | Description                              |
| -------------- | -------- | ---------------------------------------- |
| `pageId`       | `string` | Journal entry page ID                    |
| `options.mode` | `string` | `'view'` or `'edit'` (default: `'view'`) |

**Returns:** `Promise<void>`

---

## Note Queries

### getNotesForDate(year, month, day)

Get notes on a specific date.

```javascript
const notes = CALENDARIA.api.getNotesForDate(1492, 5, 15);
```

| Parameter | Type     | Description       |
| --------- | -------- | ----------------- |
| `year`    | `number` | Display year      |
| `month`   | `number` | Month (0-indexed) |
| `day`     | `number` | Day of month      |

**Returns:** `object[]` - Array of note stubs.

---

### getNotesForMonth(year, month)

Get all notes in a month.

```javascript
const notes = CALENDARIA.api.getNotesForMonth(1492, 5);
```

| Parameter | Type     | Description       |
| --------- | -------- | ----------------- |
| `year`    | `number` | Display year      |
| `month`   | `number` | Month (0-indexed) |

**Returns:** `object[]` - Array of note stubs.

---

### getNotesInRange(startDate, endDate)

Get notes within a date range.

```javascript
const notes = CALENDARIA.api.getNotesInRange({ year: 1492, month: 5, day: 1 }, { year: 1492, month: 5, day: 31 });
```

| Parameter   | Type     | Description                     |
| ----------- | -------- | ------------------------------- |
| `startDate` | `object` | Start date `{year, month, day}` |
| `endDate`   | `object` | End date `{year, month, day}`   |

**Returns:** `object[]` - Array of note stubs.

---

### searchNotes(searchTerm, options)

Search notes by name or content.

```javascript
const results = CALENDARIA.api.searchNotes('dragon', {
  caseSensitive: false,
  categories: ['quest']
});
```

| Parameter               | Type       | Description                              |
| ----------------------- | ---------- | ---------------------------------------- |
| `searchTerm`            | `string`   | Text to search for                       |
| `options.caseSensitive` | `boolean`  | Case-sensitive search (default: `false`) |
| `options.categories`    | `string[]` | Filter by category IDs                   |

**Returns:** `object[]` - Array of note stubs.

---

### getNotesByCategory(categoryId)

Get notes with a specific category.

```javascript
const notes = CALENDARIA.api.getNotesByCategory('meeting');
```

| Parameter    | Type     | Description |
| ------------ | -------- | ----------- |
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
const results = CALENDARIA.api.search('council', {
  searchContent: true,
  limit: 10
});
```

| Parameter               | Type      | Description                        |
| ----------------------- | --------- | ---------------------------------- |
| `term`                  | `string`  | Search term (minimum 2 characters) |
| `options.searchContent` | `boolean` | Search note content                |
| `options.limit`         | `number`  | Max results                        |

**Returns:** `object[]` - Array of results with type field.

---

## UI

### openBigCal(options)

Open the BigCal application.

```javascript
await CALENDARIA.api.openBigCal();
await CALENDARIA.api.openBigCal({ view: 'week' });
```

| Parameter      | Type     | Description                              |
| -------------- | -------- | ---------------------------------------- |
| `options.date` | `object` | Date to display `{year, month, day}`     |
| `options.view` | `string` | View mode: `'month'`, `'week'`, `'year'` |

**Returns:** `Promise<object>` - The BigCal application.

---

### openCalendarEditor(calendarId)

Open the calendar editor. GM only.

```javascript
await CALENDARIA.api.openCalendarEditor(); // New calendar
await CALENDARIA.api.openCalendarEditor('custom'); // Edit existing
```

| Parameter    | Type     | Description                        |
| ------------ | -------- | ---------------------------------- |
| `calendarId` | `string` | Calendar ID to edit (omit for new) |

**Returns:** `Promise<object|null>` - The editor application.

---

### showMiniCal()

Show the MiniCal widget.

```javascript
await CALENDARIA.api.showMiniCal();
```

**Returns:** `Promise<object>` - The MiniCal application.

---

### hideMiniCal()

Hide the MiniCal widget.

```javascript
await CALENDARIA.api.hideMiniCal();
```

**Returns:** `Promise<void>`

---

### toggleMiniCal()

Toggle the MiniCal widget visibility.

```javascript
await CALENDARIA.api.toggleMiniCal();
```

**Returns:** `Promise<void>`

---

## Toggle Methods

These static methods provide quick access to toggle UI components.

### HUD.toggle()

Toggle the HUD visibility.

```javascript
CALENDARIA.apps.HUD.toggle();
```

---

### BigCal.toggle()

Toggle the BigCal application.

```javascript
CALENDARIA.apps.BigCal.toggle();
```

---

## Weather

### getCurrentWeather(zoneId)

Get current weather state, optionally for a specific zone.

```javascript
const weather = CALENDARIA.api.getCurrentWeather();
// With specific zone:
const weather = CALENDARIA.api.getCurrentWeather('desert');
// Returns: { id, label, icon, color, temperature, wind, precipitation, ... }
```

| Parameter | Type     | Description                                        |
| --------- | -------- | -------------------------------------------------- |
| `zoneId`  | `string` | Optional zone ID (defaults to active scene's zone) |

**Returns:** `object|null` - Current weather state including wind `{ speed, direction, forced }` and precipitation `{ type, intensity }`.

---

### setWeather(presetId, options)

Set weather by preset ID.

```javascript
await CALENDARIA.api.setWeather('thunderstorm', { temperature: 65 });
```

| Parameter             | Type     | Description                                                     |
| --------------------- | -------- | --------------------------------------------------------------- |
| `presetId`            | `string` | Weather preset ID (e.g., `'clear'`, `'rain'`, `'thunderstorm'`) |
| `options.temperature` | `number` | Optional temperature value                                      |

**Returns:** `Promise<object>` - The set weather.

---

### setCustomWeather(weatherData)

Set custom weather with arbitrary values.

```javascript
await CALENDARIA.api.setCustomWeather({
  label: 'Magical Storm',
  icon: 'fas fa-bolt',
  color: '#9b59b6',
  description: 'Arcane lightning crackles overhead',
  temperature: 45
});
```

| Parameter                 | Type     | Description             |
| ------------------------- | -------- | ----------------------- |
| `weatherData.label`       | `string` | Display label           |
| `weatherData.icon`        | `string` | Font Awesome icon class |
| `weatherData.color`       | `string` | Display color           |
| `weatherData.description` | `string` | Description text        |
| `weatherData.temperature` | `number` | Temperature value       |

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
await CALENDARIA.api.generateWeather({ climate: 'tropical', season: 'summer' });
```

| Parameter         | Type     | Description      |
| ----------------- | -------- | ---------------- |
| `options.climate` | `string` | Climate override |
| `options.season`  | `string` | Season override  |

**Returns:** `Promise<object>` - Generated weather.

---

### getWeatherForecast(options)

Get a weather forecast for upcoming days.

```javascript
const forecast = CALENDARIA.api.getWeatherForecast();
// With options:
const forecast = CALENDARIA.api.getWeatherForecast({ zoneId: 'desert', accuracy: 100 });
// Returns: [{ year, month, day, preset, temperature, wind, precipitation, isVaried }, ...]
```

| Parameter          | Type     | Description                                                |
| ------------------ | -------- | ---------------------------------------------------------- |
| `options.zoneId`   | `string` | Zone to get forecast for (defaults to active scene's zone) |
| `options.accuracy` | `number` | Override forecast accuracy (0–100). GMs default to 100.    |
| `options.days`     | `number` | Number of days (defaults to Forecast Days setting)         |

**Returns:** `object[]` - Array of forecast entries. Each entry includes an `isVaried` flag indicating whether variance was applied.

**Permission:** Requires `viewWeatherForecast` permission for non-GM users.

---

### getWeatherForDate(year, month, day, zoneId)

Get recorded weather for a specific historical date.

```javascript
const weather = CALENDARIA.api.getWeatherForDate(1492, 7, 15);
// With zone:
const weather = CALENDARIA.api.getWeatherForDate(1492, 7, 15, 'desert');
```

| Parameter | Type     | Description                                |
| --------- | -------- | ------------------------------------------ |
| `year`    | `number` | Year                                       |
| `month`   | `number` | Month (0-indexed)                          |
| `day`     | `number` | Day of month (1-indexed)                   |
| `zoneId`  | `string` | Optional zone ID (defaults to active zone) |

**Returns:** `object|null` - Historical weather entry or null.

---

### getWeatherHistory(options)

Get the full weather history, optionally filtered by zone.

```javascript
const history = CALENDARIA.api.getWeatherHistory();
// Zone-filtered:
const history = CALENDARIA.api.getWeatherHistory({ zoneId: 'desert' });
```

| Parameter        | Type     | Description          |
| ---------------- | -------- | -------------------- |
| `options.zoneId` | `string` | Optional zone filter |

**Returns:** `object` - Nested history structure.

---

### setSceneZoneOverride(scene, zoneId)

Set a per-scene climate zone override.

```javascript
await CALENDARIA.managers.WeatherManager.setSceneZoneOverride(game.scenes.active, 'tropical');
// Explicitly disable zone (No Zone):
await CALENDARIA.managers.WeatherManager.setSceneZoneOverride(game.scenes.active, null);
// Clear override (revert to calendar default):
await CALENDARIA.managers.WeatherManager.setSceneZoneOverride(game.scenes.active, undefined);
```

> **Note:** This method is on `WeatherManager`, not on the public API object.

| Parameter | Type                      | Description                                            |
| --------- | ------------------------- | ------------------------------------------------------ |
| `scene`   | `Scene`                   | Scene document                                         |
| `zoneId`  | `string\|null\|undefined` | Zone ID, `null` for "No Zone", or `undefined` to clear |

**Returns:** `Promise<void>`

---

### isZoneDisabled(scene)

Check if a scene has explicitly disabled zone-based weather ("No Zone" selected).

```javascript
const disabled = CALENDARIA.managers.WeatherManager.isZoneDisabled(game.scenes.active);
```

> **Note:** This method is on `WeatherManager`, not on the public API object.

| Parameter | Type    | Description    |
| --------- | ------- | -------------- |
| `scene`   | `Scene` | Scene document |

**Returns:** `boolean` - True if the scene has "No Zone" set.

---

### refreshEnvironmentOverrides(presetId)

Invalidate cached environment overrides for a preset. Called internally by the Weather Editor after saving changes.

```javascript
CALENDARIA.managers.WeatherManager.refreshEnvironmentOverrides('thunderstorm');
```

> **Note:** This method is on `WeatherManager`, not on the public API object.

| Parameter  | Type     | Description       |
| ---------- | -------- | ----------------- |
| `presetId` | `string` | Weather preset ID |

**Returns:** `void`

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
await CALENDARIA.api.setActiveZone('desert');
```

| Parameter | Type     | Description     |
| --------- | -------- | --------------- |
| `zoneId`  | `string` | Climate zone ID |

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
  id: 'acid-rain',
  label: 'Acid Rain',
  icon: 'fas fa-skull',
  color: '#2ecc71',
  description: 'Corrosive precipitation',
  tempMin: 10,
  tempMax: 25,
  wind: { speed: 1, direction: null },
  precipitation: { type: 'rain', intensity: 0.6 },
  inertiaWeight: 0,
  hudEffect: 'rain-acid',
  fxPreset: 'acid-rain',
  soundFx: 'rain-acid-rain-blood-rain'
});
```

| Parameter              | Type     | Description                    |
| ---------------------- | -------- | ------------------------------ |
| `preset.id`            | `string` | Unique ID                      |
| `preset.label`         | `string` | Display label                  |
| `preset.icon`          | `string` | Icon class                     |
| `preset.color`         | `string` | Display color                  |
| `preset.description`   | `string` | Description                    |
| `preset.tempMin`       | `number` | Min temperature (°C)           |
| `preset.tempMax`       | `number` | Max temperature (°C)           |
| `preset.wind`          | `object` | `{ speed, direction, forced }` |
| `preset.precipitation` | `object` | `{ type, intensity }`          |
| `preset.inertiaWeight` | `number` | Inertia multiplier (0–2)       |
| `preset.hudEffect`     | `string` | HUD particle effect            |
| `preset.fxPreset`      | `string` | FXMaster effect name           |
| `preset.soundFx`       | `string` | Sound loop filename            |

**Returns:** `Promise<object>` - The added preset.

---

### removeWeatherPreset(presetId)

Remove a custom weather preset.

```javascript
await CALENDARIA.api.removeWeatherPreset('acid-rain');
```

| Parameter  | Type     | Description         |
| ---------- | -------- | ------------------- |
| `presetId` | `string` | Preset ID to remove |

**Returns:** `Promise<boolean>` - True if removed.

---

### getTemperature(zoneId)

Get the current temperature for a zone.

```javascript
const temp = CALENDARIA.api.getTemperature();
// With specific zone:
const temp = CALENDARIA.api.getTemperature('desert');
// Returns: { celsius, display, unit }
```

| Parameter | Type     | Description                                        |
| --------- | -------- | -------------------------------------------------- |
| `zoneId`  | `string` | Optional zone ID (defaults to active scene's zone) |

**Returns:** `object|null` - Temperature data with celsius, display value, and unit.

---

### getPreset(presetId)

Get a specific weather preset by ID.

```javascript
const preset = CALENDARIA.api.getPreset('thunderstorm');
// Returns: { id, label, icon, color, description, tempMin, tempMax, wind, precipitation, ... }
```

| Parameter  | Type     | Description                                             |
| ---------- | -------- | ------------------------------------------------------- |
| `presetId` | `string` | Preset ID (e.g., `'clear'`, `'rain'`, `'thunderstorm'`) |

**Returns:** `object|null` - Preset definition or null if not found.

---

### updateWeatherPreset(presetId, updates)

Update an existing custom weather preset. Only custom presets can be updated.

```javascript
await CALENDARIA.api.updateWeatherPreset('acid-rain', {
  label: 'Caustic Rain',
  color: '#e74c3c',
  tempMax: 30
});
```

| Parameter  | Type     | Description                                     |
| ---------- | -------- | ----------------------------------------------- |
| `presetId` | `string` | Preset ID to update                             |
| `updates`  | `object` | Properties to update (label, icon, color, etc.) |

**Returns:** `Promise<object|null>` - Updated preset or null if not found.

---

### formatTemperature(celsius)

Format a temperature value for display using the world's temperature unit setting.

```javascript
const display = CALENDARIA.api.formatTemperature(22);
// Returns: "72°F" (if unit is Fahrenheit) or "22°C" (if unit is Celsius)
```

| Parameter | Type     | Description            |
| --------- | -------- | ---------------------- |
| `celsius` | `number` | Temperature in Celsius |

**Returns:** `string` - Formatted temperature string.

---

### getClimateZoneTemplates()

Get all available climate zone templates for creating new zones.

```javascript
const templates = CALENDARIA.api.getClimateZoneTemplates();
// Returns array of template objects
```

**Returns:** `Array<object>` - Climate zone templates with id, name, temperatures, and weather weights.

---

### diagnoseWeather(showDialog)

Diagnose weather configuration issues. Useful for troubleshooting when weather isn't loading properly.

```javascript
const results = await CALENDARIA.api.diagnoseWeather();
// Or silently get results:
const results = await CALENDARIA.api.diagnoseWeather(false);
```

| Parameter    | Type      | Description                              |
| ------------ | --------- | ---------------------------------------- |
| `showDialog` | `boolean` | Show results in a dialog (default: true) |

**Returns:** `Promise<object>` - Diagnostic results with settingsData and activeCalendar info.

---

### isBundledCalendar(calendarId)

Check if a calendar is a bundled (built-in) calendar.

```javascript
const isBundled = CALENDARIA.api.isBundledCalendar('harptos');
// Returns: true
const isBundled = CALENDARIA.api.isBundledCalendar('custom-mycal');
// Returns: false
```

| Parameter    | Type     | Description          |
| ------------ | -------- | -------------------- |
| `calendarId` | `string` | Calendar ID to check |

**Returns:** `boolean` - True if bundled calendar.

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

## Permissions

Individual permission checks are available on the `CALENDARIA.permissions` namespace. See [Permissions](Permissions) for the full permission list and defaults.

### hasPermission(permission)

Check if current user has a specific permission.

```javascript
const canChange = CALENDARIA.permissions.hasPermission('changeDateTime');
```

| Parameter    | Type     | Description    |
| ------------ | -------- | -------------- |
| `permission` | `string` | Permission key |

**Permission Keys:** `viewBigCal`, `viewMiniCal`, `viewTimeKeeper`, `addNotes`, `editNotes`, `deleteNotes`, `changeDateTime`, `changeWeather`, `viewWeatherForecast`, `changeActiveCalendar`, `editCalendars`

**Returns:** `boolean`

---

### canViewBigCal()

Check if current user can view the BigCal.

```javascript
const canView = CALENDARIA.permissions.canViewBigCal();
```

**Returns:** `boolean`

---

### canViewMiniCal()

Check if current user can view the MiniCal.

```javascript
const canView = CALENDARIA.permissions.canViewMiniCal();
```

**Returns:** `boolean`

---

### canViewTimeKeeper()

Check if current user can view the TimeKeeper.

```javascript
const canView = CALENDARIA.permissions.canViewTimeKeeper();
```

**Returns:** `boolean`

---

### canAddNotes()

Check if current user can create notes.

```javascript
const canAdd = CALENDARIA.permissions.canAddNotes();
```

**Returns:** `boolean`

---

### canEditNotes()

Check if current user can edit notes owned by other players.

```javascript
const canEdit = CALENDARIA.permissions.canEditNotes();
```

**Returns:** `boolean`

---

### canDeleteNotes()

Check if current user can delete notes.

```javascript
const canDelete = CALENDARIA.permissions.canDeleteNotes();
```

**Returns:** `boolean`

---

### canChangeDateTime()

Check if current user can modify date/time.

```javascript
const canChange = CALENDARIA.permissions.canChangeDateTime();
```

**Returns:** `boolean`

---

### canChangeWeather()

Check if current user can change weather.

```javascript
const canChange = CALENDARIA.permissions.canChangeWeather();
```

**Returns:** `boolean`

---

### canViewWeatherForecast()

Check if current user can view weather forecasts.

```javascript
const canView = CALENDARIA.permissions.canViewWeatherForecast();
```

**Returns:** `boolean`

---

### canChangeActiveCalendar()

Check if current user can switch the active calendar.

```javascript
const canChange = CALENDARIA.permissions.canChangeActiveCalendar();
```

**Returns:** `boolean`

---

### canEditCalendars()

Check if current user can access the Calendar Editor.

```javascript
const canEdit = CALENDARIA.permissions.canEditCalendars();
```

**Returns:** `boolean`

---

## Widgets

For external module integration. See [Widgets](Widgets) for full documentation.

### widgetPoints

Available widget insertion points.

```javascript
const points = CALENDARIA.api.widgetPoints;
// { HUD_BUTTONS_LEFT, HUD_BUTTONS_RIGHT, HUD_INDICATORS, HUD_TRAY, MINICAL_SIDEBAR, BIGCAL_ACTIONS }
```

---

### replaceableElements

Built-in indicator elements that can be replaced by widgets.

```javascript
const elements = CALENDARIA.api.replaceableElements;
// { WEATHER_INDICATOR, SEASON_INDICATOR, ERA_INDICATOR, CYCLE_INDICATOR }
```

---

### registerWidget(moduleId, config)

Register a custom widget.

```javascript
CALENDARIA.api.registerWidget('my-module', {
  id: 'my-button',
  type: 'button',
  insertAt: 'hud.buttons.right',
  icon: 'fas fa-star',
  label: 'My Button',
  onClick: () => console.log('Clicked!')
});
```

| Parameter  | Type     | Description          |
| ---------- | -------- | -------------------- |
| `moduleId` | `string` | Your module's ID     |
| `config`   | `object` | Widget configuration |

See [Widgets](Widgets#widget-configuration) for config options.

---

### getRegisteredWidgets(insertPoint)

Get widgets registered at a specific point.

```javascript
const widgets = CALENDARIA.api.getRegisteredWidgets('hud.buttons.right');
```

| Parameter     | Type     | Description     |
| ------------- | -------- | --------------- |
| `insertPoint` | `string` | Widget point ID |

**Returns:** `array` - Registered widget configs.

---

### getWidgetByReplacement(elementId)

Get widget that replaces a built-in element.

```javascript
const widget = CALENDARIA.api.getWidgetByReplacement('weather-indicator');
```

| Parameter   | Type     | Description            |
| ----------- | -------- | ---------------------- |
| `elementId` | `string` | Replaceable element ID |

**Returns:** `object|null` - Widget config or null.

---

### refreshWidgets()

Force all widgets to re-render.

```javascript
CALENDARIA.api.refreshWidgets();
```

---

## Hooks

### hooks

Get all available Calendaria hook name constants. See [Hooks](Hooks) for full documentation, parameters, and examples.

```javascript
const hooks = CALENDARIA.api.hooks;
// Use: Hooks.on(hooks.DAY_CHANGE, (data) => { ... });
```

**Returns:** `object` - Hook name constants (e.g., `DAY_CHANGE`, `WEATHER_CHANGE`, `CLOCK_START_STOP`).
