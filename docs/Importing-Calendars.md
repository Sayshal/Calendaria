# Importing Calendars

Calendaria can import calendars from other modules and websites, letting you migrate existing setups.

## Supported Sources

| Source | Live | JSON |
|--------|:----:|:----:|
| Calendarium (Obsidian) | | ✓ |
| Fantasy-Calendar.com | | ✓ |
| Seasons & Stars | ✓ | ✓ |
| Simple Calendar | ✓ | ✓ |
| Simple Timekeeping | ✓ | |

Missing your calendar source? [Request a new importer](https://github.com/Sayshal/Calendaria/issues/new?labels=type:feature&title=Importer%20Request%3A%20).

---

## Import Process

1. Open **Settings** → **Module Settings** → **Calendaria**
2. Click **Open Calendar Editor**
3. Click **Import** in the editor toolbar
4. Select your source
5. Upload or select your calendar data
6. Review the preview
7. Choose what to import (calendar, notes, or both)
8. Click **Import**

The imported calendar opens in the editor for review before saving.

---

## Import Preview

Before finalizing, the import preview shows:

- **Source Panel** — Original data structure from your file
- **Preview Panel** — How Calendaria will interpret the data
- **Notes Panel** — Detected events/notes

For each note, choose:
- **Skip** — Don't import this note
- **Festival** — Import as a festival day
- **Note** — Import as a calendar note

---

## Post-Import

After importing:

1. Review the calendar in the editor
2. Make any needed adjustments
3. Click **Save**
4. Optionally set as active calendar

Check **Set as active calendar** when saving to switch immediately.

---

## Troubleshooting

### Import Fails

- Verify the JSON file is valid (use a JSON validator)
- Check that it's from a supported source
- Try re-exporting from the source application

### Missing Data

Some source-specific features may not have direct equivalents. Complex recurrence patterns may simplify, and custom fields unique to the source may not transfer.

Review the preview carefully and adjust in the editor after import.

### Notes Not Appearing

After import, notes belong to the imported calendar. Verify:
1. The imported calendar is set as active
2. Notes are assigned to dates within the displayed range

Still having trouble? [Report an issue with an importer](https://github.com/Sayshal/Calendaria/issues/new?labels=type:bug&title=Importer%20Issue%3A%20).
