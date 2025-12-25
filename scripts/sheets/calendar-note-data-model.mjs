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
      weekday: new fields.NumberField({ integer: true, min: 0, nullable: true }), // For weekly/weekOfMonth: 0-indexed day of week
      weekNumber: new fields.NumberField({ integer: true, min: -5, max: 5, nullable: true }), // For weekOfMonth: 1-5 positive, -1 to -5 for inverse (last = -1)

      // Seasonal recurrence config (for repeat: 'seasonal')
      seasonalConfig: new fields.SchemaField(
        {
          seasonIndex: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          trigger: new fields.StringField({ choices: ['entire', 'firstDay', 'lastDay'], initial: 'entire' })
        },
        { nullable: true }
      ),

      // Advanced conditions array - filters applied on top of repeat pattern
      // Each condition: { field, op, value, value2?, offset? }
      conditions: new fields.ArrayField(
        new fields.SchemaField({
          field: new fields.StringField({
            required: true,
            choices: [
              // Date fields
              'year', 'month', 'day', 'dayOfYear', 'daysBeforeMonthEnd',
              // Weekday fields
              'weekday', 'weekNumberInMonth', 'inverseWeekNumber',
              // Week fields
              'weekInMonth', 'weekInYear', 'totalWeek', 'weeksBeforeMonthEnd', 'weeksBeforeYearEnd',
              // Season fields
              'season', 'seasonPercent', 'seasonDay', 'isLongestDay', 'isShortestDay', 'isSpringEquinox', 'isAutumnEquinox',
              // Moon fields (moonIndex stored in value2)
              'moonPhase', 'moonPhaseIndex', 'moonPhaseCountMonth', 'moonPhaseCountYear',
              // Other
              'cycle', 'era', 'eraYear', 'intercalary'
            ]
          }),
          op: new fields.StringField({
            required: true,
            choices: ['==', '!=', '>=', '<=', '>', '<', '%'],
            initial: '=='
          }),
          value: new fields.JSONField({ required: true }), // number, string, or boolean depending on field
          value2: new fields.JSONField({ nullable: true }), // For moon index, cycle index, etc.
          offset: new fields.NumberField({ integer: true, initial: 0 }) // For modulo operator
        }),
        { initial: [] }
      ),

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
