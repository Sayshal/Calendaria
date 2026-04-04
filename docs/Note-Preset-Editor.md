# Note Preset Editor

Two-panel app for creating and managing note presets. Presets define icon, color, and defaults applied when creating notes. Open from **Settings Panel > Notes tab > Manage Presets** button (GM only).

---

## Layout

### Left Panel: Preset List

A scrollable list of all presets. The **Default** preset is always sorted first; remaining presets are sorted alphabetically. Each entry shows:

- **Label.** The preset name (click to select)
- **Icon button.** Colored icon; click to edit icon and color via dialog

If any built-in presets have been hidden (soft-deleted), a **Restore Hidden Presets** button appears below the list.

### Right Panel: Preset Editor

Displays the editor for the currently selected preset, organized into three sections: **Content**, **Schedule**, and **Settings** (mirroring the note sheet tab structure).

---

## Default Preset

A special built-in preset that:

- **Cannot be deleted.** The delete button is disabled when the Default preset is selected.
- **Auto-applied.** Any note without an explicit category assignment uses the Default preset's defaults.
- **Hidden from pickers.** The Default preset does not appear in category dropdowns on the note sheet, note badge displays, or filter dropdowns. It acts as a fallback, not a visible category.

The Default preset can be edited like any other preset (name, icon, color, defaults). It is always the first entry in the preset list.

---

## Basic Settings

| Field             | Description                                                                                     |
| ----------------- | ----------------------------------------------------------------------------------------------- |
| **Name**          | Display name for the preset                                                                     |
| **Icon / Color**  | FontAwesome icon class and hex color. Click the icon button to open the edit dialog             |
| **Player Usable** | Checkbox. When enabled, non-GM users can see and select this preset when creating/editing notes |

### Player Usable Flag

When disabled, the preset is hidden from the category dropdown for non-GM users. GMs always see all presets. Use this to restrict certain categories (e.g., "GM Notes", "Secret Plot") to GM-only usage while keeping general categories available to players.

---

## Content Section

### Title Template

Optional default title for new notes created with this preset. Leave blank for no default title.

### Content Template

Optional editor for defining default note content. When a note is created with this preset and no content is provided, the template HTML is pre-filled into the note body.

- Leave the editor empty for no template
- Use the reset button to restore the built-in seed template (if one exists for this preset)
- Content templates only apply to **new** notes

> [!TIP]
> Content templates are useful for standardizing session logs, quest write-ups, or any recurring note format. The template is inserted as the note's initial content and can be freely edited afterward.

---

## Schedule Section

- **All Day**: Whether new notes default to all-day events
- **Max Occurrences**: Default maximum occurrences for recurring notes (0 = unlimited)

---

## Settings Section

#### Display

- **Display Style**: How the note renders on the calendar (banner, icon, or pip)
- **Visibility**: Note visibility level (visible, hidden, or secret)
- **Silent**: Suppress chat announcements and reminders for this note
- **Color**: Default note color
- **Icon**: Default FontAwesome icon class

#### Duration

- **Has Duration**: Whether the note has a duration by default
- **Duration**: Default duration in days (minimum 1)
- **Show Bookends**: Show start/end markers on multi-day events
- **Limited Repeat**: Cap how far back the recurrence engine searches for historical occurrences
- **Limited Repeat Days**: Number of days to search back

When **Has Duration** is unchecked, the Duration, Show Bookends, and Limited Repeat fields are disabled. When **Limited Repeat** is unchecked, the Limited Repeat Days field is disabled.

#### Reminders

- **Reminder Type**: Default notification type (Toast, Chat, or Dialog)
- **Reminder Targets**: Who receives reminders (All, GM, Author, Viewers, Specific)
- **Reminder Offset**: Hours before the event to trigger the reminder

#### Ownership & Automation

- **Ownership**: Default player ownership level for new notes (None / Observer / Owner)
- **Macro**: Macro to execute when the note triggers (selected from world macros)

Any field left unset uses the system default at note creation time.

---

## Sync to Notes

The **Sync to Notes** button in the footer batch-updates all existing notes that use the selected preset to match its current defaults. A confirmation dialog shows the number of affected notes before proceeding.

Synced fields include all Settings and Schedule defaults. The following fields are **not** synced to preserve per-note customization:

- Title
- Content
- Schedule dates and conditions

> [!NOTE]
> Sync only affects notes that already use this preset as their category. It does not assign the preset to uncategorized notes.

---

## Built-in vs Custom Presets

### Built-in Presets

8 built-in presets ship with every world (Birthday, Deadline, Downtime, Lore, Meeting, Quest, Reminder, Session), plus the Default preset. Built-in presets:

- Can be edited (name, icon, color, defaults)
- Can be **soft-deleted** (hidden) rather than permanently removed. A "Restore Hidden Presets" button appears when any are hidden. The Default preset cannot be soft-deleted.
- Support **per-section reset**: the reset button on Basic Settings restores the original seed data; the reset button on each section restores seed defaults

### Custom Presets

Custom presets are fully user-created. They:

- Store all fields directly (no seed data to restore)
- Can be permanently deleted
- Support **per-section reset**: the reset button clears fields to empty defaults

---

## Import & Export

Export and import individual presets as JSON files.

### Export

Click **Export** in the footer to download the selected preset as a `.json` file. The file includes all preset data: label, icon, color, and defaults.

### Import

Click **Import** in the footer and select a `.json` file. On import:

- The preset gets a fresh ID (no collisions with existing presets)
- If a preset with the same label already exists, the imported one is renamed with an "(Imported)" suffix
- Imported presets are added as custom presets regardless of original type

---

## Footer Actions

| Action            | Description                                           |
| ----------------- | ----------------------------------------------------- |
| **Import**        | Import a preset from a JSON file                      |
| **Export**        | Export the selected preset to a JSON file             |
| **Sync to Notes** | Batch-update existing notes to match preset defaults  |
| **Delete**        | Remove the selected preset (soft-delete for built-in) |
| **Add**           | Create a new custom preset                            |
| **Save**          | Save all changes to settings                          |

---

## Deleting Presets

When a preset is deleted and saved, notes that referenced it have the preset removed from their category list.

---

## Preset Selection on Note Creation

When creating a new note, a preset selection dialog appears. A per-user default preset can be set in **Settings Panel > Notes tab > Default Note Category**, which pre-selects that preset in the dialog.

> [!NOTE]
> Changes in the Preset Manager are held in memory until you click **Save**. Closing the window without saving discards all changes.
