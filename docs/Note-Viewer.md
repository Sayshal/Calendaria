# Note Viewer

Standalone app for browsing, filtering, and managing calendar notes.

---

## Access Points

- **MiniCal.** Sidebar button (book icon)
- **BigCal.** Header button (book icon)
- **HUD.** Bar button (book icon)

---

## Layout

Four areas:

| Area           | Description                                                           |
| -------------- | --------------------------------------------------------------------- |
| Search bar     | Text search input and close button; also serves as the drag handle    |
| Filter sidebar | Dropdowns and checkboxes for narrowing results                        |
| Results list   | Scrollable list of matching notes with batch-loaded rendering         |
| Footer         | Note count, selection mode toggle, and bulk action controls (GM only) |

---

## Filters

Filter sidebar options:

### Preset

Multi-select dropdown for filtering by note preset (category). Includes an "Uncategorized" option for notes with no preset assigned.

### Visibility (GM Only)

| Option  | Description                             |
| ------- | --------------------------------------- |
| All     | Show all notes regardless of visibility |
| Visible | Only visible notes                      |
| Hidden  | Only hidden notes                       |
| Secret  | Only secret notes                       |

### Sort

| Option            | Description          |
| ----------------- | -------------------- |
| Date (Ascending)  | Oldest first         |
| Date (Descending) | Newest first         |
| Name (A-Z)        | Alphabetical         |
| Name (Z-A)        | Reverse alphabetical |

### Author (GM Only)

Filter notes by the user who created them.

### Checkbox Filters

| Filter       | Description                            |
| ------------ | -------------------------------------- |
| All Day      | Show only all-day notes                |
| Has Duration | Show only notes with a duration set    |
| Is Recurring | Show only notes with a condition tree  |
| Is Festival  | Show only notes linked to a festival   |

### Text Search

Type in the search bar to filter notes by name.

### Clear Filters

When any filter is active, a **Clear Filters** button appears at the bottom of the filter sidebar to reset all filters at once.

---

## Results List

Each note row displays:

| Element       | Description                                                    |
| ------------- | -------------------------------------------------------------- |
| Color bar     | Left border in the note's custom color                         |
| Icon          | The note's configured icon                                     |
| Name          | Note title                                                     |
| Date          | Formatted start date                                           |
| Preset badges | Up to 4 preset icons with colors                               |
| Status tags   | Icons for hidden/secret, has duration, recurring, and festival |

### Interactions

- **Click** a note row to open it in view mode
- **Double-click** a note row to open it in edit mode (requires edit permission)
- **Right-click** a note row for the context menu

### Note Count

The footer shows "Showing X of Y" where Y reflects only notes from the active calendar and any equivalent-date calendars (not all loaded calendars). Hover the count for a tooltip listing included calendar names.

---

## Context Menu

Right-click any note row for these options:

| Action       | Description                                                             |
| ------------ | ----------------------------------------------------------------------- |
| Open         | Open the note in view mode                                              |
| Edit         | Open the note in edit mode (requires edit permission)                   |
| Jump to Date | Navigate the calendar to the note's start date                          |
| Delete       | Delete the note with confirmation (GM only, requires delete permission) |
| Add Note     | Create a new note at the current date/time (requires add permission)    |

---

## Creating Notes

Two ways to create notes from the Note Viewer:

### Floating Action Button (FAB)

A "+" button appears in the bottom-right corner of the results list. Click it to create a new note at the current game date and time. Only visible to users with the **Add Notes** permission.

### Context Menu

Right-click any note row and select **Add Note** to create a new note. Also gated by the Add Notes permission.

---

## Bulk Operations

GMs can operate on multiple notes at once using selection mode.

### Entering Selection Mode

Click the **selection toggle** button in the footer (check-square icon) to enter selection mode. Checkboxes appear on each note row.

### Selecting Notes

- **Click** a checkbox to select or deselect an individual note
- **Shift-click** a checkbox to select all notes in the range between the last selected note and the clicked note
- **Select All** checkbox in the footer to select or deselect all filtered notes

### Available Bulk Actions

When notes are selected, the following action buttons appear in the footer:

| Action               | Icon    | Description                                                                       |
| -------------------- | ------- | --------------------------------------------------------------------------------- |
| Delete               | Trash   | Delete all selected notes (with confirmation). Festival-linked notes are skipped. |
| Change Preset        | Tag     | Set a new preset for all selected notes via a dialog                              |
| Change Visibility    | Eye     | Set visibility (visible/hidden/secret) for all selected notes via a dialog        |
| Change Display Style | Palette | Set display style (icon/pip/banner) for all selected notes via a dialog           |

Bulk action buttons are disabled until at least one note is selected. Click the selection toggle again (X icon) to exit selection mode.

---

## For Developers

See [API Reference](API-Reference) and [Hooks](Hooks).
