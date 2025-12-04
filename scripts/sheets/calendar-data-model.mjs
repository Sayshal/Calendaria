/**
 * Calendar Page Data Model
 * Defines the schema for calendar journal entry pages.
 * This stores the calendar configuration, display settings, and notes.
 * @todo Localization
 * @module Sheets/CalendarDataModel
 * @author Tyler
 */

export class CalendarDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      // Calendar Configuration
      calendarId: new fields.StringField({
        initial: '',
        blank: true,
        label: 'Calendar ID',
        hint: 'ID of the calendar to display. Leave blank for active calendar.'
      }),

      // Display Settings
      displayMode: new fields.StringField({
        initial: 'month',
        choices: ['month', 'week', 'year'],
        label: 'Display Mode'
      }),

      showWeekNumbers: new fields.BooleanField({
        initial: false,
        label: 'Show Week Numbers'
      }),

      showMoonPhases: new fields.BooleanField({
        initial: true,
        label: 'Show Moon Phases'
      }),

      showSeasons: new fields.BooleanField({
        initial: true,
        label: 'Show Seasons'
      }),

      // Current View State
      currentDate: new fields.SchemaField(
        {
          year: new fields.NumberField({ integer: true, initial: null, nullable: true }),
          month: new fields.NumberField({ integer: true, min: 0, initial: null, nullable: true }),
          day: new fields.NumberField({ integer: true, min: 1, initial: null, nullable: true })
        },
        {
          label: 'Current Viewed Date',
          hint: 'The date currently being viewed. Null means use current game time.'
        }
      )
    };
  }

  prepareDerivedData() {
    // Reserved for future computed properties
  }
}
