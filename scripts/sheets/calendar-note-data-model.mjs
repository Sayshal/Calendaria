/**
 * Calendar Note Page Data Model
 * Defines the schema for individual calendar note journal entry pages.
 *
 * @module Sheets/CalendarNoteDataModel
 * @author Tyler
 */

export class CalendarNoteDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    const fields = foundry.data.fields;

    return {
      // Date/Time
      startDate: new fields.SchemaField(
        {
          year: new fields.NumberField({ required: true, integer: true, initial: 1492 }),
          month: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          day: new fields.NumberField({ required: true, integer: true, min: 1, initial: 1 }),
          hour: new fields.NumberField({ integer: true, min: 0, max: 23, initial: 12 }),
          minute: new fields.NumberField({ integer: true, min: 0, max: 59, initial: 0 })
        },
        { required: true }
      ),

      endDate: new fields.SchemaField(
        {
          year: new fields.NumberField({ integer: true }),
          month: new fields.NumberField({ integer: true, min: 0 }),
          day: new fields.NumberField({ integer: true, min: 1 }),
          hour: new fields.NumberField({ integer: true, min: 0, max: 23 }),
          minute: new fields.NumberField({ integer: true, min: 0, max: 59 })
        },
        { nullable: true }
      ),

      allDay: new fields.BooleanField({ initial: false }),

      // Recurrence
      repeat: new fields.StringField({
        choices: ['never', 'daily', 'weekly', 'monthly', 'yearly'],
        initial: 'never'
      }),

      repeatInterval: new fields.NumberField({
        integer: true,
        min: 1,
        initial: 1
      }),

      repeatEndDate: new fields.SchemaField(
        {
          year: new fields.NumberField({ integer: true }),
          month: new fields.NumberField({ integer: true, min: 0 }),
          day: new fields.NumberField({ integer: true, min: 1 })
        },
        { nullable: true }
      ),

      // Organization
      categories: new fields.ArrayField(new fields.StringField(), { initial: [] }),

      color: new fields.ColorField({ initial: '#4a9eff' }),
      icon: new fields.StringField({ initial: 'fas fa-calendar', blank: true }),
      iconType: new fields.StringField({ choices: ['image', 'fontawesome'], initial: 'fontawesome' }),

      // Reminders
      remindUsers: new fields.ArrayField(new fields.StringField(), { initial: [] }),

      reminderOffset: new fields.NumberField({
        integer: true,
        min: 0,
        initial: 0
      }),

      // Integration
      macro: new fields.StringField({ nullable: true, blank: true }),
      sceneId: new fields.StringField({ nullable: true, blank: true }),
      playlistId: new fields.StringField({ nullable: true, blank: true }),

      // Visibility
      gmOnly: new fields.BooleanField({ initial: false })
    };
  }
}
