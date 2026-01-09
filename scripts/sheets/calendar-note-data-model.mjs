/**
 * Calendar Note Page Data Model
 * Defines the schema for individual calendar note journal entry pages.
 * @module Sheets/CalendarNoteDataModel
 * @author Tyler
 */

/**
 * Data model for calendar note journal entry pages.
 * @extends foundry.abstract.TypeDataModel
 */
export class CalendarNoteDataModel extends foundry.abstract.TypeDataModel {
  /**
   * Define the schema for calendar note data.
   * @returns {object} Schema definition
   */
  static defineSchema() {
    const fields = foundry.data.fields;
    return {
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
      repeat: new fields.StringField({ choices: ['never', 'daily', 'weekly', 'monthly', 'yearly', 'moon', 'random', 'linked', 'seasonal', 'weekOfMonth', 'range', 'computed'], initial: 'never' }),
      repeatInterval: new fields.NumberField({ integer: true, min: 1, initial: 1 }),
      repeatEndDate: new fields.SchemaField(
        { year: new fields.NumberField({ integer: true }), month: new fields.NumberField({ integer: true, min: 0 }), day: new fields.NumberField({ integer: true, min: 1 }) },
        { nullable: true }
      ),
      maxOccurrences: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      moonConditions: new fields.ArrayField(
        new fields.SchemaField({
          moonIndex: new fields.NumberField({ required: true, integer: true, min: 0 }),
          phaseStart: new fields.NumberField({ required: true, min: 0, max: 1 }),
          phaseEnd: new fields.NumberField({ required: true, min: 0, max: 1 })
        }),
        { initial: [] }
      ),
      randomConfig: new fields.SchemaField(
        {
          seed: new fields.NumberField({ integer: true, initial: 0 }),
          probability: new fields.NumberField({ min: 0, max: 100, initial: 10 }),
          checkInterval: new fields.StringField({ choices: ['daily', 'weekly', 'monthly'], initial: 'daily' })
        },
        { nullable: true }
      ),
      linkedEvent: new fields.SchemaField({ noteId: new fields.StringField({ required: true, blank: false }), offset: new fields.NumberField({ integer: true, initial: 0 }) }, { nullable: true }),
      rangePattern: new fields.SchemaField(
        { year: new fields.JSONField({ nullable: true }), month: new fields.JSONField({ nullable: true }), day: new fields.JSONField({ nullable: true }) },
        { nullable: true }
      ),
      weekday: new fields.NumberField({ integer: true, min: 0, nullable: true }),
      weekNumber: new fields.NumberField({ integer: true, min: -5, max: 5, nullable: true }),
      seasonalConfig: new fields.SchemaField(
        {
          seasonIndex: new fields.NumberField({ required: true, integer: true, min: 0, initial: 0 }),
          trigger: new fields.StringField({ choices: ['entire', 'firstDay', 'lastDay'], initial: 'entire' })
        },
        { nullable: true }
      ),
      computedConfig: new fields.SchemaField(
        {
          chain: new fields.ArrayField(
            new fields.SchemaField({
              type: new fields.StringField({ required: true, choices: ['anchor', 'firstAfter', 'daysAfter', 'weekdayOnOrAfter'] }),
              value: new fields.StringField({ nullable: true }),
              condition: new fields.StringField({ choices: ['moonPhase', 'weekday', 'seasonStart', 'seasonEnd'], nullable: true }),
              params: new fields.ObjectField({ nullable: true })
            }),
            { initial: [] }
          ),
          yearOverrides: new fields.ObjectField({ initial: {} })
        },
        { nullable: true }
      ),
      conditions: new fields.ArrayField(
        new fields.SchemaField({
          field: new fields.StringField({
            required: true,
            choices: [
              'year',
              'month',
              'day',
              'dayOfYear',
              'daysBeforeMonthEnd',
              'weekday',
              'weekNumberInMonth',
              'inverseWeekNumber',
              'weekInMonth',
              'weekInYear',
              'totalWeek',
              'weeksBeforeMonthEnd',
              'weeksBeforeYearEnd',
              'season',
              'seasonPercent',
              'seasonDay',
              'isLongestDay',
              'isShortestDay',
              'isSpringEquinox',
              'isAutumnEquinox',
              'moonPhase',
              'moonPhaseIndex',
              'moonPhaseCountMonth',
              'moonPhaseCountYear',
              'cycle',
              'era',
              'eraYear',
              'intercalary'
            ]
          }),
          op: new fields.StringField({ required: true, choices: ['==', '!=', '>=', '<=', '>', '<', '%'], initial: '==' }),
          value: new fields.JSONField({ required: true }),
          value2: new fields.JSONField({ nullable: true }),
          offset: new fields.NumberField({ integer: true, initial: 0 })
        }),
        { initial: [] }
      ),
      categories: new fields.ArrayField(new fields.StringField(), { initial: [] }),
      color: new fields.ColorField({ initial: '#4a9eff' }),
      icon: new fields.StringField({ initial: 'fas fa-calendar', blank: true }),
      iconType: new fields.StringField({ choices: ['image', 'fontawesome'], initial: 'fontawesome' }),
      reminderOffset: new fields.NumberField({ integer: true, min: 0, initial: 0 }),
      reminderType: new fields.StringField({ choices: ['none', 'toast', 'chat', 'dialog'], initial: 'toast' }),
      reminderTargets: new fields.StringField({ choices: ['all', 'gm', 'author', 'specific'], initial: 'all' }),
      reminderUsers: new fields.ArrayField(new fields.StringField(), { initial: [] }),
      macro: new fields.StringField({ nullable: true, blank: true }),
      sceneId: new fields.StringField({ nullable: true, blank: true }),
      playlistId: new fields.StringField({ nullable: true, blank: true }),
      gmOnly: new fields.BooleanField({ initial: false }),
      silent: new fields.BooleanField({ initial: false }),
      author: new fields.DocumentAuthorField(foundry.documents.BaseUser)
    };
  }
}
