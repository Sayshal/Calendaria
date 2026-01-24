# Notes and Events

Calendar notes are journal entry pages that attach to specific dates. Notes support rich text content, custom icons, recurrence patterns, categories, and macro triggers.

## Note Storage

Notes are stored as individual `JournalEntry` documents within a dedicated folder per calendar. Each note contains a single `JournalEntryPage` of type `calendaria.calendarnote`.

Calendar infrastructure folders are hidden from the Journal sidebar to reduce clutter. Access notes through the calendar UI instead.

## Creating a Note

### From the Calendar UI

1. Click a date on the calendar grid
2. Click **Add Note** to open the note editor
3. Configure title, icon, dates, times, and content
4. Click **Save & Close**

### From the API

```javascript
await CALENDARIA.api.createNote({
  name: 'Council Meeting',
  content: "<p>Meeting with the Lords' Alliance</p>",
  startDate: { year: 1492, month: 5, day: 15, hour: 14, minute: 0 },
  allDay: false,
  categories: ['meeting']
});
```

## Note Properties

### Core Fields

| Field          | Type   | Description                     |
| -------------- | ------ | ------------------------------- |
| `name`         | String | Note title                      |
| `text.content` | HTML   | Rich text content (ProseMirror) |
| `author`       | String | User ID of the note creator     |

### Date & Time Fields

| Field       | Type    | Description                        |
| ----------- | ------- | ---------------------------------- |
| `startDate` | Object  | `{year, month, day, hour, minute}` |
| `endDate`   | Object  | Optional end date/time             |
| `allDay`    | Boolean | Ignores time fields when true      |

### Recurrence Fields

| Field            | Type   | Description                                                    |
| ---------------- | ------ | -------------------------------------------------------------- |
| `repeat`         | String | Recurrence pattern                                             |
| `repeatInterval` | Number | Interval for repeating (e.g., every N days/weeks)              |
| `repeatEndDate`  | Object | Stop repeating after this date `{year, month, day}`            |
| `maxOccurrences` | Number | Limit total recurrences (0 = unlimited)                        |
| `weekday`        | Number | Target weekday for `weekOfMonth` pattern (0-indexed)           |
| `weekNumber`     | Number | Week ordinal for `weekOfMonth` (1-5, or -1 to -5 for last)     |
| `moonConditions` | Array  | Moon phase conditions `[{moonIndex, phaseStart, phaseEnd}]`    |
| `randomConfig`   | Object | Random event config `{seed, probability, checkInterval}`       |
| `linkedEvent`    | Object | Linked event config `{noteId, offset}`                         |
| `rangePattern`   | Object | Range pattern `{year, month, day}` with values or `[min, max]` |
| `seasonalConfig` | Object | Seasonal config `{seasonIndex, trigger}`                       |
| `computedConfig` | Object | Computed event chain `{chain, yearOverrides}`                  |
| `conditions`     | Array  | Advanced conditions `[{field, op, value, value2?, offset?}]`   |

### Display Fields

| Field        | Type     | Description                        |
| ------------ | -------- | ---------------------------------- |
| `categories` | String[] | Category IDs                       |
| `color`      | Hex      | Display color (default: `#4a9eff`) |
| `icon`       | String   | FontAwesome class or image path    |
| `iconType`   | String   | `fontawesome` or `image`           |

### Visibility Fields

| Field    | Type    | Description                            |
| -------- | ------- | -------------------------------------- |
| `gmOnly` | Boolean | Visible only to GMs                    |
| `silent` | Boolean | Suppresses reminders and announcements |

### Reminder Fields

| Field             | Type     | Description                                               |
| ----------------- | -------- | --------------------------------------------------------- |
| `reminderType`    | String   | `none`, `toast`, `chat`, or `dialog`                      |
| `reminderOffset`  | Number   | Minutes before event to trigger reminder                  |
| `reminderTargets` | String   | Who receives reminders: `all`, `gm`, `author`, `specific` |
| `reminderUsers`   | String[] | User IDs when `reminderTargets` is `specific`             |

### Trigger Fields

| Field        | Type   | Description                              |
| ------------ | ------ | ---------------------------------------- |
| `macro`      | String | Macro ID to execute on trigger           |
| `sceneId`    | String | Scene ID to activate when event triggers |
| `playlistId` | String | Playlist ID to play when event triggers  |

## Editing and Deleting

When multiple notes exist on the same day, they are displayed in alphabetical order by title.

### Edit a Note

1. Click the note to open it in view mode
2. Click the pencil icon in the header to switch to edit mode
3. Make changes
4. Click the save icon or close the window

### Delete a Note

1. Open the note in edit mode
2. Click the trash icon in the header
3. Confirm deletion

## Recurrence Patterns

Set the **Repeat** dropdown to enable recurrence. Available patterns:

| Pattern       | Description                               |
| ------------- | ----------------------------------------- |
| `never`       | One-time event (default)                  |
| `daily`       | Every N days                              |
| `weekly`      | Same weekday every N weeks                |
| `monthly`     | Same day of month every N months          |
| `yearly`      | Same month/day every N years              |
| `weekOfMonth` | Ordinal weekday (e.g., "2nd Tuesday")     |
| `seasonal`    | Based on season boundaries                |
| `moon`        | Based on moon phase conditions            |
| `random`      | Probability-based with seeded randomness  |
| `range`       | Pattern matching on year/month/day values |
| `linked`      | Relative to another note's occurrences    |
| `computed`    | Complex moveable feast calculations       |

### Repeat Options

- **Repeat Interval**: For `daily`, `weekly`, `monthly`, and `yearly` patterns, set how often the event repeats (e.g., every 2 weeks)
- **Max Occurrences**: Limits total recurrences (0 = unlimited)
- **Repeat End Date**: Stop repeating after this date

> [!NOTE]
> For monthless calendars (e.g., Traveller), the `monthly` and `weekOfMonth` patterns are hidden since they don't apply.

### Week of Month

Schedule events like "Second Tuesday of each month":

1. Set Repeat to **weekOfMonth**
2. Choose the occurrence (1st through 5th, or Last / 2nd Last)
3. Choose the weekday

### Seasonal

Events tied to seasons:

1. Set Repeat to **seasonal**
2. Select the season
3. Choose trigger: **Entire Season**, **First Day**, or **Last Day**

### Moon Phase

Events triggered by moon phases:

1. Set Repeat to **moon**
2. Add moon conditions by selecting a moon and phase
3. Multiple conditions can be added (any match triggers)

Moon conditions specify a phase range (0-1 position in cycle).

### Random Events

Probability-based occurrence:

1. Set Repeat to **random**
2. Configure probability (0-100%)
3. Set check interval: daily, weekly, or monthly
4. Seed value ensures deterministic randomness across clients

Random occurrences are pre-generated and cached to ensure consistency.

### Linked Events

Events relative to another note:

1. Set Repeat to **linked**
2. Select the parent note
3. Set offset in days (negative = before, positive = after)

Example: "-3" offset creates an event 3 days before each occurrence of the linked event.

### Computed Events (Moveable Feasts)

Events that follow complex calculation rules, like Easter:

1. Set Repeat to **computed**
2. Configure a calculation chain with steps:
   - **Anchor**: Starting point (`springEquinox`, `autumnEquinox`, `summerSolstice`, `winterSolstice`, `seasonStart:N`, `seasonEnd:N`, `event:noteId`)
   - **First After**: Find first occurrence of a condition after the anchor (`moonPhase`, `weekday`)
   - **Days After**: Add a fixed number of days
   - **Weekday On Or After**: Find the next occurrence of a weekday on or after the current date
3. Optionally set year overrides for manual exceptions

Example chain for Easter: Spring Equinox -> First Full Moon After -> First Sunday After

### Range Pattern

Match dates using exact values, ranges, or wildcards:

1. Set Repeat to **range**
2. For each component (year, month, day), choose:
   - **Any**: Matches all values
   - **Exact**: Matches a specific value
   - **Range**: Matches a min-max range

### Advanced Conditions

Additional filters applied on top of recurrence patterns. All conditions must pass (AND logic).

Available condition fields:

| Category | Fields                                                                                          |
| -------- | ----------------------------------------------------------------------------------------------- |
| Date     | year, month, day, dayOfYear, daysBeforeMonthEnd                                                 |
| Weekday  | weekday, weekNumberInMonth, inverseWeekNumber                                                   |
| Week     | weekInMonth, weekInYear, totalWeek, weeksBeforeMonthEnd, weeksBeforeYearEnd                     |
| Season   | season, seasonPercent, seasonDay, isLongestDay, isShortestDay, isSpringEquinox, isAutumnEquinox |
| Moon     | moonPhase, moonPhaseIndex, moonPhaseCountMonth, moonPhaseCountYear                              |
| Cycle    | cycle (if calendar has cycles)                                                                  |
| Era      | era, eraYear (if calendar has eras)                                                             |
| Other    | intercalary (for intercalary days)                                                              |

Operators: `==`, `!=`, `>=`, `<=`, `>`, `<`, `%` (modulo)

The `%` (modulo) operator supports an optional offset for patterns like "every 3rd year starting from year 2".

## Categories

Predefined categories:

| ID         | Label    |
| ---------- | -------- |
| `holiday`  | Holiday  |
| `festival` | Festival |
| `quest`    | Quest    |
| `session`  | Session  |
| `combat`   | Combat   |
| `meeting`  | Meeting  |
| `birthday` | Birthday |
| `deadline` | Deadline |
| `reminder` | Reminder |
| `other`    | Other    |

### Custom Categories

1. Type a category name in the input field next to the multi-select
2. Click the + button to create
3. Right-click a custom category tag to delete it

Custom categories are stored in world settings and available to all notes.

## Icons

Notes support two icon types:

- **FontAwesome**: Enter a class like `fas fa-dragon`
- **Image**: Select an image file via file picker

Right-click the icon picker to switch between modes. The icon color is controlled by the color picker.

## Visibility

- **GM Only**: Note is only visible to GMs (uses Foundry ownership system)
- **Silent**: Suppresses reminders and event announcements

## Reminders

Notes can trigger reminders before the event starts.

### Reminder Types

| Type     | Description           |
| -------- | --------------------- |
| `none`   | No reminder           |
| `toast`  | UI notification popup |
| `chat`   | Message in chat log   |
| `dialog` | Modal dialog box      |

### Reminder Targets

| Target     | Description                |
| ---------- | -------------------------- |
| `all`      | All connected users        |
| `gm`       | Game Master only           |
| `author`   | Note creator only          |
| `specific` | Selected users from a list |

### Reminder Offset

Set how many minutes before the event the reminder should trigger. Set to 0 for reminders at event start time.

## Event Triggers

Notes can trigger actions when the event starts.

### Scene Activation

Select a scene to automatically activate when the event triggers. Useful for transitioning to specific locations at scheduled times.

### Playlist Playback

Select a playlist to start playing when the event triggers. Useful for ambient music or sound effects tied to in-game events.

### Macro Execution

Select a macro to execute when the event triggers. The macro runs when the event scheduler detects the event has started.

## Player Permissions

Players can create, edit, and delete their own notes. Ownership is determined by standard Foundry document permissions.

### What Players Can Do

- **Create notes**: Using the Add Note button on calendar UI
- **Edit own notes**: Notes they created (Owner permission)
- **Delete own notes**: Notes they created
- **View shared notes**: Notes with appropriate permissions

### What Players Cannot Do

- **View GM-only notes**: Hidden via ownership settings
- **Edit others' notes**: Unless given explicit permission
- **Modify time/date**: All time controls are GM-only
- **Change weather**: Weather picker is GM-only

### Note Ownership

When a player creates a note:

1. The JournalEntry is created with the player as owner
2. Other players see it based on default permissions
3. GM always has full access

When a GM creates a note:

1. "GM Only" checkbox controls player visibility
2. If checked, ownership is set to GM-only
3. If unchecked, default permissions apply

## For Developers

See [API Reference](API-Reference#notes) for note methods including `getNotesForDate()`, `getNotesInRange()`, `createNote()`, `updateNote()`, `deleteNote()`, and more.
