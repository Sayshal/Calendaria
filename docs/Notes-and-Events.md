# Notes and Events

Calendar notes let you schedule events, track important dates, and add annotations to your calendar. Notes are stored as journal entries and can include rich text, images, and links.

## Creating a Note

### From the Calendar

1. Click a date on the calendar grid
2. Click **Add Note** (or the + icon)
3. Fill in the note details
4. Click **Save**

### From the API

```javascript
await CALENDARIA.api.createNote({
  title: "Council Meeting",
  year: 1492,
  month: 5,
  day: 15,
  hour: 14,
  minute: 0,
  content: "Meeting with the Lords' Alliance"
});
```

---

## Note Types

### All-Day Events

Leave the time fields empty to create an all-day event. These appear at the top of the date's event list.

### Timed Events

Set specific start hours and minutes for events that occur at a particular time.

### Multi-Day Events

Set a start date and end date to span multiple days. The event appears on each day in the range.

---

## Recurrence

Notes can repeat on a schedule. Set the **Repeat** option when creating or editing a note.

### Basic Patterns

| Pattern | Description |
|---------|-------------|
| Never | One-time event |
| Daily | Every day |
| Weekly | Same day each week |
| Monthly | Same day each month |
| Yearly | Same date each year |

### Advanced Patterns

#### Week of Month

Schedule events like "Second Tuesday of each month" or "Last Friday":

1. Set Repeat to **Week of Month**
2. Choose the ordinal (First, Second, Third, Fourth, Last)
3. Choose the weekday

#### Seasonal

Trigger events based on seasons:

- First day of the season
- Last day of the season
- Every day during the season

#### Moon Phase

Events that occur on specific moon phases:

1. Set Repeat to **Moon Phase**
2. Select the moon (if multiple)
3. Select the phase(s)

#### Range Pattern

For complex patterns, use range matching with wildcards:

- Exact values: "Day 15"
- Ranges: "Days 1-7"
- Any: "Any month"

---

## Repeat Options

### Interval

Set how often the pattern repeats:

- Every 1 week = weekly
- Every 2 weeks = biweekly
- Every 3 months = quarterly

### End Date

Optionally set when the recurrence stops. Leave empty for indefinite repeating.

---

## Categories

Organize notes with categories:

1. Open a note for editing
2. In the **Categories** field, add tags
3. Use the same categories across notes for filtering

Filter notes by category in the calendar view or via API:

```javascript
const meetings = await CALENDARIA.api.getNotesByCategory("meeting");
```

---

## Linked Events

Create events that automatically spawn relative to another event:

1. Create the primary event
2. Create a linked event with Repeat set to **Linked**
3. Select the parent note
4. Set the offset (e.g., "-3 days" for 3 days before)

Use this for reminders or preparation time before major events.

---

## Viewing Notes

### On the Calendar

- Dates with notes show indicator dots
- Click a date to see the notes panel
- Note count badges show how many events exist

### In the HUD

- Active events appear as icons in the info bar
- Hover for event details
- Click to open the note

### Via Search

Use the search function to find notes by name or content.

---

## Editing and Deleting

### Edit a Note

1. Click the note to open it
2. Click **Edit**
3. Make changes
4. Click **Save**

### Delete a Note

1. Open the note
2. Click **Delete** in the header
3. Confirm deletion

Or right-click a note indicator on the calendar and select **Delete**.

---

## Chat Announcements

Configure notes to announce in chat when they occur:

1. Open the note settings
2. Enable **Announce in Chat**
3. Optionally set visibility (everyone, GM only, etc.)

---

## Macro Triggers

Run a macro when an event occurs:

1. Edit the note
2. In the **Macro** field, select a macro from your collection
3. The macro executes when the event triggers

---

## API Examples

### Get Today's Notes

```javascript
const now = CALENDARIA.api.getCurrentDateTime();
const notes = await CALENDARIA.api.getNotesForDate(now.year, now.month, now.day);
```

### Get Notes in a Range

```javascript
const notes = await CALENDARIA.api.getNotesInRange(
  { year: 1492, month: 5, day: 1 },
  { year: 1492, month: 5, day: 31 }
);
```

### Search Notes

```javascript
const results = await CALENDARIA.api.searchNotes("dragon");
```
