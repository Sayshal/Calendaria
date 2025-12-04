/**
 * Calendar Page Sheet
 * Simple sheet for editing calendar configuration journal entry pages.
 *
 * @module Sheets/CalendarPageSheet
 * @author Tyler
 */

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class CalendarPageSheet extends HandlebarsApplicationMixin(
  foundry.applications.sheets.journal.JournalEntryPageSheet
) {
  static DEFAULT_OPTIONS = {
    classes: ['calendaria', 'calendar-page-sheet'],
    position: {
      width: 500,
      height: 'auto'
    }
  };

  static PARTS = {
    form: {
      template: 'modules/calendaria/templates/sheets/calendar-page-form.hbs'
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.system = this.document.system;
    return context;
  }
}
