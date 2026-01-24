# Importing Calendars

Calendaria can import calendars from other modules and websites, letting you migrate existing setups.

## Supported Sources

| Source                 | Live | JSON |
| ---------------------- | :--: | :--: |
| Calendaria JSON        |      |  ✓   |
| Calendarium (Obsidian) |      |  ✓   |
| Fantasy-Calendar.com   |      |  ✓   |
| Mini Calendar          |  ✓   |  ✓   |
| Seasons & Stars        |  ✓   |  ✓   |
| Simple Calendar        |  ✓   |  ✓   |
| Simple Timekeeping     |  ✓   |      |

Missing your calendar source? [Request a new importer](https://github.com/Sayshal/Calendaria/issues/new?labels=type:feature&title=Importer%20Request%3A%20).

---

## Import Process

1. Open **Settings** > **Module Settings** > **Calendaria** > **Settings Panel**
2. Navigate to the **Calendar** tab
3. Click **Open Importer** to open the import dialog
4. Select your import source from the dropdown
5. Upload a JSON file (drag-and-drop supported) or click **Import from Module** for live import
6. Review the import preview
7. For each detected note/event, choose how to import:
   - **Skip** — Do not import this item
   - **Festival** — Import as a recurring festival day
   - **Note** — Import as a calendar note (journal entry)
8. Click **Import**

The imported calendar opens in the Calendar Editor for review. Make any needed adjustments, then click **Save** to finalize.

---

## Import Preview

Before finalizing, the import preview displays:

- **Calendar Summary** — Name, month count, weekday count, moon count, season count, era count, festival count, note count, and days per year
- **Current Date** — The current date from the source calendar
- **Detected Notes** — Events and notes found in the source data with their dates

### Current Date Preservation

Calendaria automatically tries to extract and preserve the current date from source calendars during import:

- The source calendar's current date is displayed in the import preview
- After import, the world time is set to match the source calendar's date
- This ensures your campaign continues from the same point in time

For each detected note, use the radio buttons to choose:

- **Skip** — Do not import this item
- **Festival** — Import as a festival (fixed calendar event)
- **Note** — Import as a calendar note (linked to a journal entry)

Use the **Set All** buttons to quickly mark all notes as Skip, Festival, or Note.

---

## Post-Import

After importing:

1. Review the calendar in the Calendar Editor
2. Make any needed adjustments (months, weekdays, seasons, moons, etc.)
3. Click **Save** to create the calendar
4. Optionally check **Set as active calendar** to switch immediately

### Undated Events

Some importers (Calendarium, Fantasy-Calendar) may encounter events without specific dates. These are automatically migrated to Foundry journal entries organized in the folder structure:

```text
Calendaria Imports/[Calendar Name]/Undated Events/
```

You can access these journal entries and manually assign dates if needed.

---

## Troubleshooting

### Import Fails

- Verify the JSON file is valid (use a JSON validator)
- Check that it's from a supported source
- Try re-exporting from the source application

### Missing Data

Some source-specific features may not have direct equivalents:

- **Complex recurrence patterns** may simplify to basic yearly/monthly recurrence
- **Custom fields** unique to the source may not transfer
- **OR-based conditions** (Fantasy-Calendar) are split into separate notes
- **Ordinal recurrence** (e.g., "3rd Monday of month" from Seasons & Stars) imports as the first of the month with a warning

> [!TIP]
> Review the preview carefully and adjust in the Calendar Editor after import.

### Notes Not Appearing

After import, notes belong to the imported calendar. Verify:

1. The imported calendar is set as active
2. Notes are assigned to dates within the displayed range

Still having trouble? [Report an issue with an importer](https://github.com/Sayshal/Calendaria/issues/new?labels=type:bug&title=Importer%20Issue%3A%20).
