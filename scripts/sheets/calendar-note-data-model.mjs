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
      repeat: new fields.StringField({ choices: ['never', 'daily', 'weekly', 'monthly', 'yearly', 'moon', 'random', 'linked', 'seasonal', 'weekOfMonth', 'range'], initial: 'never' }),

      repeatInterval: new fields.NumberField({ integer: true, min: 1, initial: 1 }),

      repeatEndDate: new fields.SchemaField(
        { year: new fields.NumberField({ integer: true }), month: new fields.NumberField({ integer: true, min: 0 }), day: new fields.NumberField({ integer: true, min: 1 }) },
        { nullable: true }
      ),

      // Max number of times the event repeats (0 = unlimited)
      maxOccurrences: new fields.NumberField({ integer: true, min: 0, initial: 0 }),

      // Moon conditions - array of { moonIndex, phaseStart, phaseEnd }
      moonConditions: new fields.ArrayField(
        new fields.SchemaField({
          moonIndex: new fields.NumberField({ required: true, integer: true, min: 0 }),
          phaseStart: new fields.NumberField({ required: true, min: 0, max: 1 }),
          phaseEnd: new fields.NumberField({ required: true, min: 0, max: 1 })
        }),
        { initial: [] }
      ),

      // Random event configuration (for repeat: 'random')
      randomConfig: new fields.SchemaField(
        {
          seed: new fields.NumberField({ integer: true, initial: 0 }),
          probability: new fields.NumberField({ min: 0, max: 100, initial: 10 }),
          checkInterval: new fields.StringField({ choices: ['daily', 'weekly', 'monthly'], initial: 'daily' })
        },
        { nullable: true }
      ),

      // Linked event configuration (for repeat: 'linked')
      linkedEvent: new fields.SchemaField({ noteId: new fields.StringField({ required: true, blank: false }), offset: new fields.NumberField({ integer: true, initial: 0 }) }, { nullable: true }),

      // Range pattern configuration (for repeat: 'range')
      rangePattern: new fields.SchemaField(
        { year: new fields.JSONField({ nullable: true }), month: new fields.JSONField({ nullable: true }), day: new fields.JSONField({ nullable: true }) },
        { nullable: true }
      ),

      // Week-based recurrence fields
      weekday: new fields.NumberField({ integer: true, min: 0, nullable: true }), // For weekly: 0-indexed day of week
      seasonIndex: new fields.NumberField({ integer: true, min: 0, nullable: true }), // For seasonal: 0-indexed season
      weekNumber: new fields.NumberField({ integer: true, min: 1, nullable: true }), // For weekOfMonth: 1-indexed week

      // Organization
      categories: new fields.ArrayField(new fields.StringField(), { initial: [] }),

      color: new fields.ColorField({ initial: '#4a9eff' }),
      icon: new fields.StringField({ initial: 'fas fa-calendar', blank: true }),
      iconType: new fields.StringField({ choices: ['image', 'fontawesome'], initial: 'fontawesome' }),

      // Reminders
      remindUsers: new fields.ArrayField(new fields.StringField(), { initial: [] }),

      reminderOffset: new fields.NumberField({ integer: true, min: 0, initial: 0 }),

      // Integration
      macro: new fields.StringField({ nullable: true, blank: true }),
      sceneId: new fields.StringField({ nullable: true, blank: true }),
      playlistId: new fields.StringField({ nullable: true, blank: true }),

      // Visibility
      gmOnly: new fields.BooleanField({ initial: false }),

      // Notification control - when true, suppresses automatic notifications when event triggers
      silent: new fields.BooleanField({ initial: false }),

      // Author - user ID of the creator (auto-set on creation)
      author: new fields.DocumentAuthorField(foundry.documents.BaseUser)
    };
  }
}
