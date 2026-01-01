# Importing Calendars

Calendaria can import calendars from other modules, websites, and software, letting you migrate existing setups.

## Supported Sources

| Source | Notes |
|--------|-------|
| Simple Calendar | Live import from installed module |
| Fantasy-Calendar.com | JSON export file |
| Seasons & Stars | JSON export file |
| Simple Timekeeping | JSON export file |
| Calendarium (Obsidian.MD) | JSON export file |

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

## Simple Calendar

### Live Import

If Simple Calendar is installed and has calendar data:

1. Choose **Simple Calendar** as the source
2. Calendaria detects the installed calendar automatically
3. Review the preview
4. Import

### What Imports

- Calendar structure (months, weekdays)
- Time settings
- Moon configurations
- Seasons
- Categories
- Notes and events with recurrence

---

## Fantasy-Calendar.com

### Exporting from Fantasy Calendar

1. Open your calendar on fantasy-calendar.com
2. Go to **Settings** → **Export**
3. Download the JSON file

### Importing

1. Choose **Fantasy-Calendar.com** as the source
2. Upload your JSON file
3. Review the preview
4. Import

### What Imports

- Full calendar structure
- Moons with phase distributions
- Events and conditions
- Advanced recurrence patterns

---

## Seasons & Stars

### Exporting

1. In Seasons & Stars, export your calendar configuration
2. Save the JSON file

### Importing

1. Choose **Seasons & Stars** as the source
2. Upload your JSON file
3. Review the preview
4. Import

### What Imports

- Calendar structure
- Moon phase lengths (converted to percentages)
- Intercalary days (as festivals)
- Solar anchors (as daylight config)
- Events with recurrence

---

## Simple Timekeeping

### Exporting

1. Export your Simple Timekeeping configuration
2. Save the JSON file

### Importing

1. Choose **Simple Timekeeping** as the source
2. Upload your JSON file
3. Import

### What Imports

- Calendar and event data
- Weather configurations (if using weather picker)

---

## Calendarium (Obsidian.MD)

### Exporting

1. In Obsidian with Calendarium plugin
2. Export your calendar data as JSON

### Importing

1. Choose **Calendarium** as the source
2. Upload your JSON file
3. Import

### What Imports

- Calendar structure
- Range events
- Intercalary months
- Leap patterns
- Per-month custom weekdays

---

## Import Preview

Before finalizing, the import preview shows:

- **Source Panel** — Original data from your file
- **Preview Panel** — How Calendaria will interpret it
- **Notes Panel** — Any events/notes detected

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

### Setting as Active

Check **Set as active calendar** when saving to switch immediately. The world will reload.

---

## Troubleshooting

### Import Fails

- Verify the JSON file is valid
- Check that it's from a supported source
- Try re-exporting from the source

### Missing Data

Some fields may not have direct equivalents:
- Complex recurrence patterns may simplify
- Custom fields might not transfer
- Source-specific features may not import

Review the preview carefully and adjust in the editor.

### Notes Not Appearing

After import, notes belong to the imported calendar. Make sure:
1. The imported calendar is active
2. Notes are assigned to the correct dates
