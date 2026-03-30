# Note Preset Editor

Two-panel app for creating and managing note presets. Presets define icon, color, and defaults applied when creating notes. Open from **Settings Panel > Notes tab > Manage Presets** button (GM only).

---

## Layout

### Left Panel: Preset List

A scrollable list of all presets, sorted alphabetically. Each entry shows:

- **Label.** The preset name (click to select)
- **Icon button.** Colored icon; click to edit icon and color via dialog

If any built-in presets have been hidden (soft-deleted), a **Restore Hidden Presets** button appears below the list.

### Right Panel: Preset Editor

Displays the editor for the currently selected preset, split into two fieldsets: Basic Settings and Defaults.

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

## Defaults & Overrides

The Defaults fieldset defines values that apply when a note is created with this preset. Each field has a **lock toggle** button beside it:

- **Unlocked** (default). The value acts as a default. It is applied to new notes but can be changed per-note afterward.
- **Locked.** The value becomes an override. Only displayStyle and visibility overrides are enforced at display time. Other locked fields apply at creation time only.

### Configurable Fields

| Field               | Type    | Description                                                 |
| ------------------- | ------- | ----------------------------------------------------------- |
| **All Day**         | Boolean | Whether new notes default to all-day events                 |
| **Display Style**   | Select  | How the note renders on the calendar (banner, icon, or pip) |
| **Visibility**      | Select  | Note visibility level (visible, hidden, or secret)          |
| **Reminder Type**   | Select  | Default notification type (Toast, Chat, or Dialog)          |
| **Reminder Offset** | Number  | Hours before the event to trigger the reminder              |
| **Has Duration**    | Boolean | Whether the note has a duration by default                  |
| **Duration**        | Number  | Default duration in days (minimum 1)                        |
| **Macro**           | Select  | Macro to execute when the note triggers (from world macros) |

Any field set to "No Default" is left to the user's choice at note creation time.

---

## Content Template

The Content Template fieldset provides an optional editor for defining default note content. When a note is created with this preset and no content is provided, the template HTML is pre-filled into the note body.

- Leave the editor empty for no template
- Use the reset button to restore the built-in seed template (if one exists for this preset)
- Content templates only apply to **new** notes — they do not affect existing notes

> [!TIP]
> Content templates are useful for standardizing session logs, quest write-ups, or any recurring note format. The template is inserted as the note's initial content and can be freely edited afterward.

### How Overrides Work

- When displaying notes on the calendar, overridden display styles and visibility take effect
- Notes sort by display style: banner > icon > pip

---

## Built-in vs Custom Presets

### Built-in Presets

8 built-in presets ship with every world (Birthday, Deadline, Downtime, Lore, Meeting, Quest, Reminder, Session). Built-in presets:

- Can be edited (name, icon, color, defaults, overrides)
- Can be **soft-deleted** (hidden) rather than permanently removed. A "Restore Hidden Presets" button appears when any are hidden
- Support **per-fieldset reset**: the reset button on the Basic Settings fieldset restores the original seed data (name, icon, color, player usable flag); the reset button on Defaults restores seed defaults and clears overrides

### Custom Presets

Custom presets are fully user-created. They:

- Store all fields directly (no seed data to restore)
- Can be permanently deleted
- Support **per-fieldset reset**: the reset button clears fields to empty defaults

---

## Import & Export

Export and import individual presets as JSON files.

### Export

Click **Export** in the footer to download the selected preset as a `.json` file. The file includes all preset data: label, icon, color, defaults, and overrides.

### Import

Click **Import** in the footer and select a `.json` file. On import:

- The preset gets a fresh ID (no collisions with existing presets)
- If a preset with the same label already exists, the imported one is renamed with an "(Imported)" suffix
- Imported presets are added as custom presets regardless of original type

---

## Footer Actions

| Action     | Description                                           |
| ---------- | ----------------------------------------------------- |
| **Import** | Import a preset from a JSON file                      |
| **Export** | Export the selected preset to a JSON file             |
| **Delete** | Remove the selected preset (soft-delete for built-in) |
| **Add**    | Create a new custom preset                            |
| **Save**   | Save all changes to settings                          |

---

## Deleting Presets

When a preset is deleted and saved, notes that referenced it have the preset removed from their category list.

---

## Preset Selection on Note Creation

When creating a new note, a preset selection dialog appears. A per-user default preset can be set in **Settings Panel > Notes tab > Default Note Category**, which pre-selects that preset in the dialog.

> [!NOTE]
> Changes in the Preset Manager are held in memory until you click **Save**. Closing the window without saving discards all changes.
