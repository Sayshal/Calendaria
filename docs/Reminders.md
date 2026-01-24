# Reminders

Calendaria notifies users before scheduled note events occur. Reminders are configured per-note and support four notification types.

## Configuration

Reminders are configured in the note sheet under the **Reminder** fieldset:

| Field   | Description                                                    |
| ------- | -------------------------------------------------------------- |
| Type    | Notification method: none, toast, chat, or dialog              |
| Targets | Who receives the reminder                                      |
| Offset  | Hours before the event to trigger (0 = at event time, max 720) |
| Users   | Specific user selection (when target is "specific")            |

Selecting `none` as the type disables the reminder and disables other inputs.

### Defaults

| User Type    | Default Targets |
| ------------ | --------------- |
| GM users     | `GM`            |
| Non-GM users | `Author`        |

> [!NOTE]
> Defaults are based on the current user creating the note, not the note's `gmOnly` flag.

## Notification Types

### None

Disables reminders for this note. Other reminder fields are disabled when selected.

### Toast

Brief popup notification in the top-center of the screen. Auto-dismisses after a few seconds.

### Chat

Message posted to the chat log with a link to open the note. Can be whispered to specific users based on target settings.

> [!NOTE]
> If a note has `gmOnly: true`, chat reminders are always whispered to GM users regardless of the target setting.

### Dialog

Modal dialog requiring acknowledgment. Includes "Open Note" and "Dismiss" buttons.

## Target Options

| Target     | Recipients              |
| ---------- | ----------------------- |
| `all`      | All connected users     |
| `gm`       | Only GM users           |
| `author`   | Only the note creator   |
| `specific` | Manually selected users |

## How Reminders Work

The `ReminderScheduler` class monitors world time and triggers reminders:

1. Only runs on the primary GM client (uses `CalendariaSocket.isPrimaryGM()`)
2. Checks for pending reminders every 300 game seconds (5 minutes) as time advances
3. Compares current time against each note's start time minus the offset
4. Fires reminders when the current time falls within the reminder window (after offset time, before event time)
5. Tracks fired reminders using occurrence-based keys (`noteId:year-month-day`) to support recurring events
6. Clears the fired reminders list when the date changes
7. Resets all state and re-checks immediately if time moves backwards

### Recurring Events

For recurring notes (including those with conditions), the scheduler:

- Checks if the event occurs today or tomorrow
- For all-day events occurring tomorrow, triggers the reminder if current time is within the offset window from midnight

### Multi-Day Events

For non-recurring events spanning multiple days:

- The reminder fires the evening before each day the event spans
- For timed events, the reminder fires before the start time on the first day only

### Silent Notes

Notes with `silent: true` are skipped by the reminder system.

### Multiplayer Synchronization

For `toast` and `dialog` notification types, the primary GM broadcasts the reminder to all targeted users via socket. Each client then displays the notification locally. Chat reminders are created as `ChatMessage` documents and sync automatically.

## For Developers

See [Hooks](Hooks#calendariaeventtriggered) for the `calendaria.eventTriggered` hook that fires when reminders trigger.
