# Reminders

Calendaria can notify you before scheduled events occur. Configure reminders to get alerts via toast notifications, chat messages, or dialog prompts.

## Setting Up a Reminder

1. Create or edit a note
2. Find the **Reminder** section
3. Enable **Remind Before Event**
4. Set the **Offset** (e.g., 30 minutes, 1 hour, 1 day)
5. Choose the **Notification Type**
6. Set the **Target** (who receives it)

---

## Notification Types

### Toast

A brief popup notification in the corner of the screen.

- Non-intrusive
- Auto-dismisses after a few seconds
- Good for minor reminders

### Chat Message

A message posted to the chat log.

- Permanent record
- Can be whispered to specific users
- Good for important events

### Dialog

A modal dialog that requires acknowledgment.

- Most prominent
- Includes **Snooze** option
- Good for critical events

---

## Target Options

| Target | Description |
|--------|-------------|
| Everyone | All connected players see the reminder |
| GM Only | Only GMs receive the notification |
| Author Only | Only the note creator sees it |
| Specific Users | Choose which players receive it |

---

## Snooze

When using dialog notifications, players can **Snooze** the reminder:

1. Click **Snooze** on the dialog
2. Choose a snooze duration
3. The reminder reappears after that time

---

## Reminder Scheduling

Reminders are checked when world time changes. The ReminderScheduler:

- Monitors world time with a 5-minute throttle
- Fires reminders when the offset time is reached
- Handles reminders that were missed (if time jumped forward)

---

## Examples

### Combat Preparation

Remind the party 1 hour before a scheduled battle:

- Event: "Ambush at the bridge" at 14:00
- Reminder: 1 hour before
- Type: Chat message
- Target: Everyone

### GM Session Prep

Private reminder for the GM:

- Event: "Introduce BBEG" at session start
- Reminder: 30 minutes before
- Type: Dialog
- Target: GM Only

### Recurring Reminders

Combined with recurring events:

- Event: "Weekly market day" every Starday
- Reminder: 1 day before
- Type: Toast
- Target: Everyone

---

## Troubleshooting

### Reminders Not Firing

1. Check that world time is advancing
2. Verify the reminder is enabled on the note
3. Ensure you're in the target group
4. Check if time jumped past the reminder window

### Too Many Reminders

- Reduce reminder frequency
- Use longer offsets
- Target specific users instead of everyone
