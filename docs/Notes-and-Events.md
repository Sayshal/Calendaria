# Notes and Events

Calendar notes are journal entry pages attached to specific dates, with rich text content, custom icons, recurrence patterns, categories, and macro triggers.

## Note Storage

Notes are stored as journal entries within a folder per calendar. These folders are hidden from the Journal sidebar. Access notes through the calendar UI or the [Note Viewer](Note-Viewer).

## Creating a Note

1. Click a date on the calendar grid
2. Click **Add Note** to open the note editor
3. A preset selection dialog appears where you can pick a category (or skip)
4. Configure title, icon, dates, times, and content
5. Click **Save & Close**

## Editing and Deleting

### Edit a Note

1. Click the note to open it in view mode
2. Click the edit icon in the header to switch to edit mode
3. Make changes
4. Click the save icon or close the window

### Delete a Note

1. Open the note in edit mode
2. Click the trash icon in the header
3. Confirm deletion

---

## Note Sheet

The note editor has three tabs: **Content**, **Schedule**, and **Settings**.

### Content Tab

- **Title**: Note name
- **Emblem**: FontAwesome class or image file (right-click to switch modes)
- **Color**: Note color via color picker
- **Content**: Rich text editor for the note body

Festival notes display an info banner on each tab, linking to the calendar editor (GM-only).

### Schedule Tab

- **Start Date / End Date**: Click to open a date picker
- **Start Time / End Time**: Hour and minute inputs (hidden when All Day is checked)
- **All Day**: Checkbox to hide time fields. When checked, end date fields are disabled and synced to match the start date.
- **Condition Presets**: Dropdown with presets that reflect your calendar's weekdays, months, seasons, and moon phases (e.g., "Every Monday", "Monthly on the 15th", "Every Full Moon")
- **Edit in Builder**: Opens the visual condition builder with the note's current conditions loaded
- **Condition Summary**: Displays the note's recurrence rules as readable pills. Right-click a pill to delete it.
- **Max Occurrences**: Limit how many times a recurring note appears (leave blank for unlimited)
- **Occurrence Preview**: Read-only list of the next upcoming dates for recurring notes

#### Duration

- **Has Duration**: Toggle to make the note span multiple days
- **Duration**: Number of days the event spans
- **Show Bookends**: Start/end markers on the first and last days

### Settings Tab

#### Display

- **Visibility**: Visible, Hidden, or Secret (GM only)
- **Silent**: Suppress reminders and event announcements
- **Display Style**: Icon, pip, or banner
- **Macro**: Select a macro to execute when the event triggers

#### Reminders

- **Reminder Type**: None, Toast, Chat, or Dialog
- **Reminder Targets**: All, GM, Author, Viewers, or Specific users
- **Reminder Offset**: Minutes before the event to trigger (0 = at event start, max 720)
- **Reminder Users**: User list (only shown when target is Specific)

#### Categories

- Select from existing categories
- Add new categories inline
- Categories with the player-usable flag disabled are hidden from non-GM users unless already assigned to the note
- The Default preset does not appear as a selectable category. It acts as a fallback for uncategorized notes and is hidden from category pickers and badge displays

#### Ownership

Per-user permission dropdowns. Each user can be set to **None**, **Observer**, or **Owner**. GM and note author are fixed at Owner.

Per-user grants layer on top of the visibility default and are editable in every visibility mode. Set a Hidden note to "GM and author plus Player X" by granting Player X Observer; set a Visible note to "everyone except Player Y" by granting Player Y None. Flipping visibility updates the default tier (Visible raises it to Observer, Hidden and Secret drop it to None) but does not touch existing per-user grants, so manually configured access survives visibility changes.

Only GMs can manage note permissions. Non-GM users see a disabled ownership fieldset with a tooltip explaining that permission management is restricted to the GM.

---

## Condition Engine

Rule-based scheduling for notes. Conditions check date, weekday, season, moon phase, and more to decide whether a note shows on a given day.

### Condition Fields

Conditions check:

- **Date fields**: year, month, day, day of year, full date comparison, and more
- **Weekday fields**: weekday, week number in month (e.g., "3rd Tuesday"), inverse week number
- **Season fields**: current season, percentage through the season, season day, solstices, equinoxes
- **Moon fields**: moon phase, named phase (New, Full, etc.), sub-phase (Rising, True, Fading), phase occurrence counts
- **Cycle and Era fields**: current cycle entry and era (when the calendar defines them)
- **Other fields**: intercalary days, leap years, weather, eclipses, random values, event references

See [API Reference](API-Reference) for the complete field list.

### Condition Operators

- **Comparison**: equals, not equals, greater than, less than, greater or equal, less or equal
- **Modulo**: repeating intervals like "every 4th year" with an optional offset
- **Event-relative**: days ago, days from now, within the last N days, within the next N days

See [API Reference](API-Reference) for the complete operator list.

### Condition Groups

Organize conditions into groups with boolean logic:

- **AND**: All conditions must pass (default)
- **OR**: At least one condition must pass
- **NAND**: Passes when not all conditions pass (negated AND)
- **XOR**: Passes when exactly one condition passes
- **COUNT**: Passes when a specific number of conditions pass

Groups nest inside other groups for complex rules.

**Example**: "Every 3rd Tuesday in winter during a full moon" uses an AND group with conditions for weekday, week number, season, and moon phase.

### Event-Based Conditions

A note's schedule can depend on another note's occurrences: "3 days after Festival X" or "within 5 days of Event Y".

- Select the target note using the note picker in the condition builder
- Use event-relative operators: days ago, days from now, within last, within next
- Circular references are prevented

### Condition Builder

Visual editor for condition trees.

1. Open a note in edit mode
2. Go to the **Schedule** tab
3. Click **Edit in Builder**

In the builder:

- Select a **field** from the dropdown (grouped by category)
- Choose an **operator** for the field type
- Enter a **value** using the field-specific input
- Add **groups** to organize conditions with boolean logic
- **Reorder** with move up/down controls
- **Delete** via right-click context menu

**Presets** are available from a dropdown (Basic, Weekly, Monthly, Yearly, Every Nth, Seasons, Moons, Eclipses). A merge checkbox appends conditions instead of replacing the tree.

---

## Categories

Organize notes by type. Every world starts with 8 built-in presets (Birthday, Deadline, Downtime, Lore, Meeting, Quest, Reminder, Session), and you can create your own.

Open the [Note Preset Editor](Note-Preset-Editor) from the Settings Panel to create, edit, delete, and reorder presets.

### Defaults and Overrides

Categories define **defaults** that auto-apply when creating a note: display style, visibility, reminder settings, and duration.

Categories also define **overrides** that force specific values on all notes in the category. Overridden fields are locked in the note editor. Use the lock toggle in the Note Preset Editor to promote a field from default to override.

### Player-Usable Flag

Each category has a **player-usable** flag. When disabled, non-GM users don't see that category when creating or editing notes.

---

## Visibility

Three visibility levels:

| Level       | Icon      | Who Can See                                           |
| ----------- | --------- | ----------------------------------------------------- |
| **Visible** | _(none)_  | All users with journal permissions                    |
| **Hidden**  | Eye-slash | GM only                                               |
| **Secret**  | Lock      | GM only, and only when "Show Secret Notes" is enabled |

- Hidden notes are always visible to GMs
- Secret notes are hidden from everyone by default, including GMs. Enable **Show Secret Notes** in the Settings Panel to see them.
- The **Silent** flag suppresses reminders and announcements independently
- Non-GM users need at least Observer permission on the parent journal entry to see a visible note

---

## Duration and Display Styles

### Duration

Enable **Has Duration** to make a note span multiple days. Multi-day events render as continuous bars across calendar days in BigCal.

- **Show Bookends**: Start/end markers on the first and last days

### Display Styles

| Style      | Description                                              |
| ---------- | -------------------------------------------------------- |
| **Icon**   | Default inline icon next to the note name                |
| **Pip**    | Compact dot indicator with minimal footprint             |
| **Banner** | Full-width bar spanning the event's duration across days |

Notes sort by display priority: banner > icon > pip, with festivals first.

---

## Festival Notes

Calendar festivals are created as journal notes using the condition engine. Festivals act as templates that produce independent notes.

- After creation, festival notes are independent. Editing a festival note does not change the template.
- An info banner on the note editor links to the calendar editor (GM-only)
- Reminder settings are preserved across festival updates
- Festivals support leap-year-only scheduling via the Is Leap Year condition field
- Non-GM users cannot delete festival notes
- GMs can re-sync festival notes from **Settings Panel > Notes tab**

---

## Player Permissions

Players create and edit notes based on Calendaria permissions, combined with Foundry document permissions.

> [!NOTE]
> Players with the "Add Notes" permission but without Foundry's core Journal Create permission can still create notes as long as a GM is present. The request is relayed to a connected GM.

### What Players Can Do

- Create notes using the Add Note button
- Edit notes they created (Owner permission)
- Edit others' notes if granted "Edit Notes" permission (not hidden/secret notes)
- Delete notes they created
- View notes with appropriate permissions

### What Players Cannot Do

- View hidden or secret notes
- Delete others' notes or festival notes
- Modify time, date, or weather

---

## For Developers

See [API Reference](API-Reference) and [Hooks](Hooks).
