# Reminders

Calendaria notifies users before scheduled note events occur. Reminders are configured per-note and support three notification types.

## Configuration

Reminders are configured in the note sheet under the **Reminder** fieldset:

| Field | Description |
|-------|-------------|
| Offset | Minutes before the event to trigger the reminder (0 = disabled) |
| Type | Notification method: toast, chat, or dialog |
| Targets | Who receives the reminder |
| Users | Specific user selection (when target is "specific") |

## Notification Types

### Toast
Brief popup notification in the corner of the screen. Auto-dismisses after a few seconds.

### Chat
Message posted to the chat log with a link to open the note. Can be whispered to specific users based on target settings.

**Note:** If a note has `gmOnly: true`, chat reminders are always whispered to GM users regardless of the target setting.

### Dialog
Modal dialog requiring acknowledgment. Includes "Open Note" and "Dismiss" buttons.

**Note:** There is no snooze functionality.

## Target Options

| Target | Recipients |
|--------|------------|
| `all` | All connected users |
| `gm` | Only GM users |
| `author` | Only the note creator |
| `specific` | Manually selected users |

## How Reminders Work

The `ReminderScheduler` class monitors world time and triggers reminders:

1. Only runs on the GM client
2. Checks for pending reminders every 5 minutes (300 seconds of game time)
3. Compares current time against each note's start time minus the offset
4. Fires reminders when the current time falls within the reminder window (after offset time, before event time)
5. Tracks fired reminders per day to prevent duplicates
6. Clears the fired reminders list when the date changes

### Recurring Events

For recurring notes (including those with conditions), the scheduler:
- Checks if the event occurs today or tomorrow
- For all-day events occurring tomorrow, triggers the reminder if current time is within the offset window from midnight

### Silent Notes

Notes with `silent: true` are skipped by the reminder system.

## Data Model Fields

From `CalendarNoteDataModel`:

```javascript
reminderOffset: NumberField({ integer: true, min: 0, initial: 0 })
reminderType: StringField({ choices: ['toast', 'chat', 'dialog'], initial: 'toast' })
reminderTargets: StringField({ choices: ['all', 'gm', 'author', 'specific'], initial: 'all' })
reminderUsers: ArrayField(StringField(), { initial: [] })
```

## Hook

When a reminder fires, the following hook is called:

```javascript
Hooks.callAll('calendaria.eventTriggered', {
  id: note.id,
  name: note.name,
  flagData: note.flagData,
  reminderType,
  isReminder: true
});
```

## Relevant Files

- `scripts/time/reminder-scheduler.mjs` - Core reminder logic
- `scripts/sheets/calendar-note-data-model.mjs` - Data schema
- `scripts/sheets/calendar-note-sheet.mjs` - UI handling
- `templates/sheets/calendar-note-form.hbs` - Form template
