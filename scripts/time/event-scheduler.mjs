/**
 * Event Scheduler
 * Monitors world time changes and triggers notifications when events/notes are reached.
 * Handles multi-day event progress tracking and reminder notifications.
 * @module Time/EventScheduler
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { HOOKS, MODULE, TEMPLATES } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { compareDates, getCurrentDate } from '../notes/utils/date-utils.mjs';
import { generateRandomOccurrences, needsRandomRegeneration } from '../notes/utils/recurrence.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';

/**
 * Event Scheduler class that monitors time changes and triggers event notifications.
 */
export default class EventScheduler {
  /** @type {object | null} Last processed date components */
  static #lastDate = null;

  /** @type {Set<string>} Set of event IDs that have been triggered today (prevents duplicate notifications) */
  static #triggeredToday = new Set();

  /** @type {number} Last world time when triggers were checked (throttle to every 30 game minutes) */
  static #lastTriggerCheckTime = 0;

  /** @type {number} Minimum interval between trigger checks in game seconds (30 minutes) */
  static TRIGGER_CHECK_INTERVAL = 1800;

  /**
   * Initialize the event scheduler.
   * @returns {void}
   */
  static initialize() {
    this.#lastDate = getCurrentDate();
    log(3, 'Event Scheduler initialized');
  }

  /**
   * Handle world time updates.
   * Called by the updateWorldTime hook.
   * @param {number} worldTime - The new world time in seconds
   * @param {number} _delta - The time delta in seconds
   * @returns {void}
   */
  static onUpdateWorldTime(worldTime, _delta) {
    if (!CalendariaSocket.isPrimaryGM()) return;
    const currentDate = getCurrentDate();
    if (!currentDate) return;
    if (!NoteManager.isInitialized()) return;
    if (this.#lastDate && this.#hasDateChanged(this.#lastDate, currentDate)) {
      this.#triggeredToday.clear();
      this.#updateMultiDayEventProgress(currentDate);
      this.#checkRandomEventRegeneration(currentDate);
    }

    if (worldTime - this.#lastTriggerCheckTime >= this.TRIGGER_CHECK_INTERVAL) {
      this.#checkEventTriggers(this.#lastDate, currentDate);
      this.#lastTriggerCheckTime = worldTime;
    }

    this.#lastDate = { ...currentDate };
  }

  /**
   * Check if any events should trigger based on time change.
   * @param {object} previousDate - Previous date components
   * @param {object} currentDate - Current date components
   * @private
   */
  static #checkEventTriggers(previousDate, currentDate) {
    const allNotes = NoteManager.getAllNotes();
    for (const note of allNotes) {
      if (this.#triggeredToday.has(note.id)) continue;
      if (note.flagData.silent) continue;
      if (this.#shouldTrigger(note, previousDate, currentDate)) {
        this.#triggerEvent(note, currentDate);
        this.#triggeredToday.add(note.id);
      }
    }
  }

  /**
   * Determine if a note should trigger based on time crossing its start time.
   * @param {object} note - The note stub
   * @param {object} previousDate - Previous date components
   * @param {object} currentDate - Current date components
   * @returns {boolean} True if the note should trigger
   * @private
   */
  static #shouldTrigger(note, previousDate, currentDate) {
    if (!previousDate || !currentDate) return false;
    const startDate = note.flagData.startDate;
    if (!startDate) return false;
    const eventStart = {
      year: startDate.year,
      month: startDate.month,
      day: startDate.day,
      hour: note.flagData.allDay ? 0 : (startDate.hour ?? 0),
      minute: note.flagData.allDay ? 0 : (startDate.minute ?? 0)
    };

    const prevComparison = this.#compareDateTimes(previousDate, eventStart);
    const currComparison = this.#compareDateTimes(currentDate, eventStart);
    return prevComparison < 0 && currComparison >= 0;
  }

  /**
   * Compare two date-time objects.
   * @param {object} a - First date-time
   * @param {object} b - Second date-time
   * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
   * @private
   */
  static #compareDateTimes(a, b) {
    if (a.year !== b.year) return a.year < b.year ? -1 : 1;
    if (a.month !== b.month) return a.month < b.month ? -1 : 1;
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    const aHour = a.hour ?? 0;
    const bHour = b.hour ?? 0;
    if (aHour !== bHour) return aHour < bHour ? -1 : 1;
    const aMinute = a.minute ?? 0;
    const bMinute = b.minute ?? 0;
    if (aMinute !== bMinute) return aMinute < bMinute ? -1 : 1;
    return 0;
  }

  /**
   * Trigger an event and show notification.
   * @param {object} note - The note stub
   * @param {object} currentDate - Current date components
   * @private
   */
  static #triggerEvent(note, currentDate) {
    log(3, `Triggering event: ${note.name}`);
    const notificationType = this.#getNotificationType(note);
    const message = this.#formatEventMessage(note);
    ui.notifications[notificationType](message, { permanent: false });
    this.#sendChatAnnouncement(note);
    Hooks.callAll(HOOKS.EVENT_TRIGGERED, { id: note.id, name: note.name, flagData: note.flagData, currentDate });
    this.#executeMacro(note);
  }

  /**
   * Get notification type based on note category.
   * @param {object} note - The note stub
   * @returns {'info'|'warn'|'error'} Notification type
   * @private
   */
  static #getNotificationType(note) {
    const categories = note.flagData.categories || [];
    if (categories.includes('deadline') || categories.includes('combat')) return 'warn';
    return 'info';
  }

  /**
   * Format the event notification message.
   * @param {object} note - The note stub
   * @returns {string} Formatted message
   * @private
   */
  static #formatEventMessage(note) {
    let message = `<strong>${note.name}</strong>`;
    if (!note.flagData.allDay) {
      const hour = String(note.flagData.startDate.hour ?? 0).padStart(2, '0');
      const minute = String(note.flagData.startDate.minute ?? 0).padStart(2, '0');
      message += ` at ${hour}:${minute}`;
    }
    const categories = note.flagData.categories || [];
    if (categories.length > 0) {
      const categoryDef = NoteManager.getCategoryDefinition(categories[0]);
      if (categoryDef) message = `<i class="${categoryDef.icon}" style="color:${categoryDef.color}"></i> ${message}`;
    }
    return message;
  }

  /**
   * Execute the macro attached to a note.
   * @param {object} note - The note stub
   * @param {object} [context] - Additional context to pass to the macro
   * @private
   */
  static #executeMacro(note, context = {}) {
    const macroId = note.flagData.macro;
    if (!macroId) return;
    const macro = game.macros.get(macroId);
    if (!macro) return;
    log(3, `Executing macro for event ${note.name}: ${macro.name}`);
    const scope = { event: { id: note.id, name: note.name, flagData: note.flagData }, ...context };
    macro.execute(scope);
  }

  /**
   * Send a chat announcement for an event.
   * Respects gmOnly visibility setting.
   * @param {object} note - The note stub
   * @private
   */
  static async #sendChatAnnouncement(note) {
    const calendar = CalendarManager.getActiveCalendar();
    const flagData = note.flagData;
    const fullNote = NoteManager.getFullNote(note.id);
    const noteContent = fullNote?.text?.content || '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = noteContent;
    let plainContent = tempDiv.textContent || tempDiv.innerText || '';
    plainContent = plainContent.trim();
    if (plainContent.length > 140) plainContent = `${plainContent.substring(0, 140).trim()}…`;
    const dateRange = this.#formatDateRange(calendar, flagData);
    const color = flagData.color || '#4a9eff';
    let iconHtml;
    if (flagData.icon) {
      if (flagData.icon.startsWith('fa') || flagData.iconType === 'fontawesome') iconHtml = `<i class="${flagData.icon}"></i>`;
      else iconHtml = `<img src="${flagData.icon}" alt="" style="width: 1.5rem; height: 1.5rem; object-fit: contain;" />`;
    } else {
      iconHtml = '<i class="fas fa-calendar"></i>';
    }

    const content = await foundry.applications.handlebars.renderTemplate(TEMPLATES.PARTIALS.CHAT_ANNOUNCEMENT, {
      dateRange,
      content: plainContent,
      noteId: note.id,
      journalId: note.journalId,
      iconHtml
    });

    let whisper = [];
    if (flagData.gmOnly) whisper = game.users.filter((u) => u.isGM).map((u) => u.id);
    await ChatMessage.create({
      content,
      whisper,
      speaker: { alias: note.name },
      flavor: `<span style="color: ${color};">${iconHtml}</span> ${localize('CALENDARIA.Event.CalendarEvent')}`,
      flags: { [MODULE.ID]: { isAnnouncement: true, noteId: note.id, journalId: note.journalId } }
    });

    log(3, `Chat announcement sent for event: ${note.name}`, { gmOnly: flagData.gmOnly });
  }

  /**
   * Format date range for display.
   * @param {object} calendar - The active calendar
   * @param {object} flagData - Note flag data
   * @returns {string} Formatted date range
   * @private
   */
  static #formatDateRange(calendar, flagData) {
    if (!calendar || !flagData.startDate) return '';
    const formatDate = (date) => {
      const monthData = calendar.monthsArray?.[date.month];
      const monthName = monthData?.name ? localize(monthData.name) : `Month ${date.month + 1}`;
      return `${date.day} ${monthName}, ${date.year}`;
    };
    const formatTime = (date) => {
      if (flagData.allDay) return '';
      const hour = String(date.hour ?? 0).padStart(2, '0');
      const minute = String(date.minute ?? 0).padStart(2, '0');
      return ` ${format('CALENDARIA.Event.AtTime', { time: `${hour}:${minute}` })}`;
    };
    let result = formatDate(flagData.startDate) + formatTime(flagData.startDate);
    if (flagData.endDate && flagData.endDate.year) {
      const startKey = `${flagData.startDate.year}-${flagData.startDate.month}-${flagData.startDate.day}`;
      const endKey = `${flagData.endDate.year}-${flagData.endDate.month}-${flagData.endDate.day}`;
      if (startKey !== endKey) {
        result += ` — ${formatDate(flagData.endDate)}`;
        if (!flagData.allDay && flagData.endDate.hour !== undefined) result += formatTime(flagData.endDate);
      }
    }
    if (flagData.allDay) result += ` ${localize('CALENDARIA.Event.AllDay')}`;
    return result;
  }

  /**
   * Check and regenerate random event occurrences when approaching year end.
   * Regenerates occurrences for next year during the last week of the last month.
   * @param {object} currentDate - Current date components
   * @private
   */
  static async #checkRandomEventRegeneration(currentDate) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.monthsArray) return;
    const allNotes = NoteManager.getAllNotes();
    for (const note of allNotes) {
      if (note.flagData.repeat !== 'random') continue;
      const fullNote = NoteManager.getFullNote(note.id);
      if (!fullNote) continue;
      const cachedData = fullNote.getFlag(MODULE.ID, 'randomOccurrences');
      if (!needsRandomRegeneration(cachedData)) continue;
      const currentYear = currentDate.year;
      const targetYear = cachedData?.year >= currentYear ? currentYear + 1 : currentYear;
      const noteData = { startDate: fullNote.system.startDate, randomConfig: fullNote.system.randomConfig, repeatEndDate: fullNote.system.repeatEndDate };
      const occurrences = generateRandomOccurrences(noteData, targetYear);
      await fullNote.setFlag(MODULE.ID, 'randomOccurrences', { year: targetYear, generatedAt: Date.now(), occurrences });
      log(2, `Auto-regenerated ${occurrences.length} random occurrences for ${fullNote.name} until year ${targetYear}`);
    }
  }

  /**
   * Check if the date has changed (day/month/year).
   * @param {object} previous - Previous date
   * @param {object} current - Current date
   * @returns {boolean} True if date changed
   * @private
   */
  static #hasDateChanged(previous, current) {
    return previous.year !== current.year || previous.month !== current.month || previous.day !== current.day;
  }

  /**
   * Update progress for multi-day events.
   * @param {object} currentDate - Current date components
   * @private
   */
  static #updateMultiDayEventProgress(currentDate) {
    const notes = NoteManager.getAllNotes();
    for (const note of notes) {
      if (note.flagData.silent) continue;
      const progress = this.#getMultiDayProgress(note, currentDate);
      if (!progress) continue;
      this.#showProgressNotification(note, progress);
    }
  }

  /**
   * Calculate progress for a multi-day event.
   * @param {object} note - The note stub
   * @param {object} currentDate - Current date
   * @returns {object | null} Progress info or null if not a multi-day event in progress
   * @private
   */
  static #getMultiDayProgress(note, currentDate) {
    const startDate = note.flagData.startDate;
    const endDate = note.flagData.endDate;
    if (!startDate || !endDate) return null;
    const start = { year: startDate.year, month: startDate.month, day: startDate.day };
    const end = { year: endDate.year, month: endDate.month, day: endDate.day };
    const current = { year: currentDate.year, month: currentDate.month, day: currentDate.day };
    if (compareDates(current, start) < 0 || compareDates(current, end) > 0) return null;
    const totalDays = this.#daysBetween(start, end) + 1;
    const currentDay = this.#daysBetween(start, current) + 1;
    if (totalDays <= 1) return null;
    return { currentDay, totalDays, percentage: Math.round((currentDay / totalDays) * 100), isFirstDay: currentDay === 1, isLastDay: currentDay === totalDays };
  }

  /**
   * Calculate days between two dates.
   * @param {object} start - Start date
   * @param {object} end - End date
   * @returns {number} Number of days between
   * @private
   */
  static #daysBetween(start, end) {
    const calendar = CalendarManager.getActiveCalendar();
    const startSeconds = calendar.componentsToTime({ year: start.year, month: start.month, dayOfMonth: start.day - 1, hour: 0, minute: 0, second: 0 });
    const endSeconds = calendar.componentsToTime({ year: end.year, month: end.month, dayOfMonth: end.day - 1, hour: 0, minute: 0, second: 0 });
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
    const secondsPerMinute = calendar?.days?.secondsPerMinute ?? 60;
    const secondsPerDay = hoursPerDay * minutesPerHour * secondsPerMinute;
    return Math.floor((endSeconds - startSeconds) / secondsPerDay);
  }

  /**
   * Show or update a progress notification for a multi-day event.
   * @param {object} note - The note stub
   * @param {object} progress - Progress info
   * @private
   */
  static #showProgressNotification(note, progress) {
    const message = format('CALENDARIA.Event.DayProgress', { name: note.name, currentDay: progress.currentDay, totalDays: progress.totalDays });
    if (progress.isFirstDay) ui.notifications.info(format('CALENDARIA.Event.StartingToday', { message }), { permanent: false });
    else if (progress.isLastDay) ui.notifications.info(format('CALENDARIA.Event.FinalDay', { message }), { permanent: false });
    else ui.notifications.info(format('CALENDARIA.Event.PercentComplete', { message, percentage: progress.percentage }), { permanent: false });
    Hooks.callAll(HOOKS.EVENT_DAY_CHANGED, { id: note.id, name: note.name, progress });
    this.#executeMacro(note, { trigger: 'multiDayProgress', progress });
  }
}
