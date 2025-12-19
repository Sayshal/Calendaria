/**
 * Event Scheduler
 * Monitors world time changes and triggers notifications when events/notes are reached.
 * Handles multi-day event progress tracking and reminder notifications.
 *
 * ## Features
 *
 * - Monitors `updateWorldTime` hook for time changes
 * - Triggers `ui.notifications` when an event's start time is reached
 * - Shows progress notifications for multi-day events
 * - Respects the `silent` flag on notes to suppress announcements
 * - Fires hooks for other modules to respond to event triggers
 *
 * ## Usage
 *
 * The EventScheduler is initialized automatically during module setup.
 * It listens to world time changes and compares against all calendar notes.
 *
 * ```javascript
 * // Listen for event triggers
 * Hooks.on('calendaria.eventTriggered', (event) => {
 *   console.log(`Event triggered: ${event.name}`);
 * });
 * ```
 *
 * @module Time/EventScheduler
 * @author Tyler
 */

import { MODULE, HOOKS } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { compareDates, getCurrentDate } from '../notes/utils/date-utils.mjs';
import { generateRandomOccurrences, needsRandomRegeneration } from '../notes/utils/recurrence.mjs';

/**
 * Event Scheduler class that monitors time changes and triggers event notifications.
 */
export default class EventScheduler {
  /** @type {Object|null} Last processed date components */
  static #lastDate = null;

  /** @type {Set<string>} Set of event IDs that have been triggered today (prevents duplicate notifications) */
  static #triggeredToday = new Set();

  /** @type {Map<string, number>} Map of multi-day event IDs to their current progress notification ID */
  static #activeProgressNotifications = new Map();

  /** @type {number} Last world time when triggers were checked (throttle to every 30 game minutes) */
  static #lastTriggerCheckTime = 0;

  /** @type {number} Minimum interval between trigger checks in game seconds (30 minutes) */
  static TRIGGER_CHECK_INTERVAL = 1800;

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /**
   * Initialize the event scheduler.
   * Called during module initialization.
   *
   * @returns {void}
   */
  static initialize() {
    log(3, 'Initializing Event Scheduler...');

    // Store current date as baseline
    this.#lastDate = getCurrentDate();

    log(3, 'Event Scheduler initialized');
  }

  /* -------------------------------------------- */
  /*  Time Update Handler                         */
  /* -------------------------------------------- */

  /**
   * Handle world time updates.
   * Called by the updateWorldTime hook.
   *
   * @param {number} worldTime - The new world time in seconds
   * @param {number} delta - The time delta in seconds
   * @returns {void}
   */
  static onUpdateWorldTime(worldTime, delta) {
    // Only GM should process events to prevent duplicate notifications
    if (!game.user.isGM) return;

    // Get current date
    const currentDate = getCurrentDate();
    if (!currentDate) return;

    // Skip if NoteManager isn't initialized
    if (!NoteManager.isInitialized()) return;

    // Check if we've crossed into a new day
    if (this.#lastDate && this.#hasDateChanged(this.#lastDate, currentDate)) {
      // Reset triggered events on day change
      this.#triggeredToday.clear();

      // Update multi-day event progress
      this.#updateMultiDayEventProgress(currentDate);

      // Check if random events need regeneration (approaching year end)
      this.#checkRandomEventRegeneration(currentDate);
    }

    // Throttle trigger checks to every 30 game minutes
    if (worldTime - this.#lastTriggerCheckTime >= this.TRIGGER_CHECK_INTERVAL) {
      this.#checkEventTriggers(this.#lastDate, currentDate, delta);
      this.#lastTriggerCheckTime = worldTime;
    }

    // Update last date
    this.#lastDate = { ...currentDate };
  }

  /* -------------------------------------------- */
  /*  Event Trigger Logic                         */
  /* -------------------------------------------- */

  /**
   * Check if any events should trigger based on time change.
   *
   * @param {Object} previousDate - Previous date components
   * @param {Object} currentDate - Current date components
   * @param {number} delta - Time delta in seconds
   * @private
   */
  static #checkEventTriggers(previousDate, currentDate, delta) {
    const allNotes = NoteManager.getAllNotes();

    for (const note of allNotes) {
      // Skip if already triggered today
      if (this.#triggeredToday.has(note.id)) continue;

      // Skip if note is silent (don't announce)
      if (note.flagData.silent) continue;

      // Check if this note should trigger
      if (this.#shouldTrigger(note, previousDate, currentDate)) {
        this.#triggerEvent(note, currentDate);
        this.#triggeredToday.add(note.id);
      }
    }
  }

  /**
   * Determine if a note should trigger based on time crossing its start time.
   *
   * @param {Object} note - The note stub
   * @param {Object} previousDate - Previous date components
   * @param {Object} currentDate - Current date components
   * @returns {boolean} True if the note should trigger
   * @private
   */
  static #shouldTrigger(note, previousDate, currentDate) {
    // Need both dates to compare
    if (!previousDate || !currentDate) return false;

    const startDate = note.flagData.startDate;
    if (!startDate) return false;

    // Build full start datetime
    const eventStart = {
      year: startDate.year,
      month: startDate.month,
      day: startDate.day,
      hour: note.flagData.allDay ? 0 : (startDate.hour ?? 0),
      minute: note.flagData.allDay ? 0 : (startDate.minute ?? 0)
    };

    // Check if we crossed the event start time
    // Previous time was before event, current time is at or after event
    const prevComparison = this.#compareDateTimes(previousDate, eventStart);
    const currComparison = this.#compareDateTimes(currentDate, eventStart);

    // Trigger if we were before the event and now we're at or past it
    return prevComparison < 0 && currComparison >= 0;
  }

  /**
   * Compare two date-time objects.
   *
   * @param {Object} a - First date-time
   * @param {Object} b - Second date-time
   * @returns {number} -1 if a < b, 0 if equal, 1 if a > b
   * @private
   */
  static #compareDateTimes(a, b) {
    // Compare year
    if (a.year !== b.year) return a.year < b.year ? -1 : 1;
    // Compare month
    if (a.month !== b.month) return a.month < b.month ? -1 : 1;
    // Compare day
    if (a.day !== b.day) return a.day < b.day ? -1 : 1;
    // Compare hour
    const aHour = a.hour ?? 0;
    const bHour = b.hour ?? 0;
    if (aHour !== bHour) return aHour < bHour ? -1 : 1;
    // Compare minute
    const aMinute = a.minute ?? 0;
    const bMinute = b.minute ?? 0;
    if (aMinute !== bMinute) return aMinute < bMinute ? -1 : 1;

    return 0;
  }

  /**
   * Trigger an event and show notification.
   *
   * @param {Object} note - The note stub
   * @param {Object} currentDate - Current date components
   * @private
   */
  static #triggerEvent(note, currentDate) {
    log(3, `Triggering event: ${note.name}`);

    // Determine notification type based on category
    const notificationType = this.#getNotificationType(note);

    // Format the notification message
    const message = this.#formatEventMessage(note, currentDate);

    // Show notification
    ui.notifications[notificationType](message, { permanent: false });

    // Send chat announcement
    this.#sendChatAnnouncement(note, currentDate);

    // Fire hook for other modules
    Hooks.callAll(HOOKS.EVENT_TRIGGERED, { id: note.id, name: note.name, flagData: note.flagData, currentDate });

    // Execute macro if attached
    this.#executeMacro(note);
  }

  /**
   * Get notification type based on note category.
   *
   * @param {Object} note - The note stub
   * @returns {'info'|'warn'|'error'} Notification type
   * @private
   */
  static #getNotificationType(note) {
    const categories = note.flagData.categories || [];

    // Use warning for important categories
    if (categories.includes('deadline') || categories.includes('combat')) return 'warn';

    return 'info';
  }

  /**
   * Format the event notification message.
   *
   * @param {Object} note - The note stub
   * @param {Object} currentDate - Current date components
   * @returns {string} Formatted message
   * @private
   */
  static #formatEventMessage(note, currentDate) {
    const calendar = CalendarManager.getActiveCalendar();
    let message = `<strong>${note.name}</strong>`;

    // Add time if not all-day
    if (!note.flagData.allDay) {
      const hour = String(note.flagData.startDate.hour ?? 0).padStart(2, '0');
      const minute = String(note.flagData.startDate.minute ?? 0).padStart(2, '0');
      message += ` at ${hour}:${minute}`;
    }

    // Add category if present
    const categories = note.flagData.categories || [];
    if (categories.length > 0) {
      const categoryDef = NoteManager.getCategoryDefinition(categories[0]);
      if (categoryDef) message = `<i class="${categoryDef.icon}" style="color:${categoryDef.color}"></i> ${message}`;
    }

    return message;
  }

  /**
   * Execute the macro attached to a note.
   *
   * @param {Object} note - The note stub
   * @param {Object} [context={}] - Additional context to pass to the macro
   * @private
   */
  static #executeMacro(note, context = {}) {
    const macroId = note.flagData.macro;
    if (!macroId) return;

    const macro = game.macros.get(macroId);
    if (!macro) return;

    log(3, `Executing macro for event ${note.name}: ${macro.name}`);

    // Build scope object with event data and context
    const scope = { event: { id: note.id, name: note.name, flagData: note.flagData }, ...context };

    macro.execute(scope);
  }

  /* -------------------------------------------- */
  /*  Chat Announcements                          */
  /* -------------------------------------------- */

  /**
   * Send a chat announcement for an event.
   * Respects gmOnly visibility setting.
   *
   * @param {Object} note - The note stub
   * @param {Object} currentDate - Current date components
   * @private
   */
  static async #sendChatAnnouncement(note, currentDate) {
    const calendar = CalendarManager.getActiveCalendar();
    const flagData = note.flagData;

    // Get full note document for content
    const fullNote = NoteManager.getFullNote(note.id);
    const noteContent = fullNote?.text?.content || '';

    // Strip HTML and truncate content to 140 chars
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = noteContent;
    let plainContent = tempDiv.textContent || tempDiv.innerText || '';
    plainContent = plainContent.trim();
    if (plainContent.length > 140) plainContent = plainContent.substring(0, 140).trim() + '…';

    // Build date range string
    let dateRange = this.#formatDateRange(calendar, flagData);

    // Build icon - clickable to open note
    const color = flagData.color || '#4a9eff';
    let iconHtml = '';
    if (flagData.icon) {
      if (flagData.icon.startsWith('fa') || flagData.iconType === 'fontawesome') iconHtml = `<i class="${flagData.icon}"></i>`;
      else iconHtml = `<img src="${flagData.icon}" alt="" style="width: 24px; height: 24px; object-fit: contain;" />`;
    } else {
      iconHtml = `<i class="fas fa-calendar"></i>`;
    }

    // Build the chat message content
    const content = `
      <div class="calendaria-announcement">
        <div class="announcement-date">${dateRange}</div>
        ${plainContent ? `<div class="announcement-content">${plainContent}</div>` : ''}
        <a class="announcement-open" data-action="openNote" data-note-id="${note.id}" data-journal-id="${note.journalId}">
          ${iconHtml} Open Note
        </a>
      </div>
    `.trim();

    // Determine whisper recipients based on gmOnly
    let whisper = [];
    if (flagData.gmOnly) whisper = game.users.filter((u) => u.isGM).map((u) => u.id);

    // Create the chat message
    await ChatMessage.create({
      content,
      whisper,
      speaker: { alias: note.name },
      flavor: `<span style="color: ${color};">${iconHtml}</span> Calendar Event`,
      flags: { [MODULE.ID]: { isAnnouncement: true, noteId: note.id, journalId: note.journalId } }
    });

    log(3, `Chat announcement sent for event: ${note.name}`, { gmOnly: flagData.gmOnly });
  }

  /**
   * Format date range for display.
   * @param {Object} calendar - The active calendar
   * @param {Object} flagData - Note flag data
   * @returns {string} Formatted date range
   * @private
   */
  static #formatDateRange(calendar, flagData) {
    if (!calendar || !flagData.startDate) return '';

    const formatDate = (date) => {
      const monthData = calendar.months?.values?.[date.month];
      const monthName = monthData?.name ? game.i18n.localize(monthData.name) : `Month ${date.month + 1}`;
      return `${date.day} ${monthName}, ${date.year}`;
    };

    const formatTime = (date) => {
      if (flagData.allDay) return '';
      const hour = String(date.hour ?? 0).padStart(2, '0');
      const minute = String(date.minute ?? 0).padStart(2, '0');
      return ` at ${hour}:${minute}`;
    };

    let result = formatDate(flagData.startDate) + formatTime(flagData.startDate);

    // Add end date if different
    if (flagData.endDate && flagData.endDate.year) {
      const startKey = `${flagData.startDate.year}-${flagData.startDate.month}-${flagData.startDate.day}`;
      const endKey = `${flagData.endDate.year}-${flagData.endDate.month}-${flagData.endDate.day}`;
      if (startKey !== endKey) {
        result += ` — ${formatDate(flagData.endDate)}`;
        if (!flagData.allDay && flagData.endDate.hour !== undefined) result += formatTime(flagData.endDate);
      }
    }

    if (flagData.allDay) result += ' (All Day)';

    return result;
  }

  /* -------------------------------------------- */
  /*  Random Event Regeneration                   */
  /* -------------------------------------------- */

  /**
   * Check and regenerate random event occurrences when approaching year end.
   * Regenerates occurrences for next year during the last week of the last month.
   *
   * @param {Object} currentDate - Current date components
   * @private
   */
  static async #checkRandomEventRegeneration(currentDate) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar?.months?.values) return;

    const allNotes = NoteManager.getAllNotes();

    for (const note of allNotes) {
      // Only process random repeat events
      if (note.flagData.repeat !== 'random') continue;

      // Get full note document to check/update flags
      const fullNote = NoteManager.getFullNote(note.id);
      if (!fullNote) continue;

      // Check if regeneration is needed
      const cachedData = fullNote.getFlag(MODULE.ID, 'randomOccurrences');
      if (!needsRandomRegeneration(cachedData)) continue;

      // Calculate target year (current or next)
      const yearZero = calendar?.years?.yearZero ?? 0;
      const currentYear = currentDate.year;
      const targetYear = cachedData?.year >= currentYear ? currentYear + 1 : currentYear;

      // Build note data for generation
      const noteData = { startDate: fullNote.system.startDate, randomConfig: fullNote.system.randomConfig, repeatEndDate: fullNote.system.repeatEndDate };

      // Generate occurrences
      const occurrences = generateRandomOccurrences(noteData, targetYear);

      // Store in flag
      await fullNote.setFlag(MODULE.ID, 'randomOccurrences', { year: targetYear, generatedAt: Date.now(), occurrences });

      log(2, `Auto-regenerated ${occurrences.length} random occurrences for ${fullNote.name} until year ${targetYear}`);
    }
  }

  /* -------------------------------------------- */
  /*  Multi-Day Event Progress                    */
  /* -------------------------------------------- */

  /**
   * Check if the date has changed (day/month/year).
   *
   * @param {Object} previous - Previous date
   * @param {Object} current - Current date
   * @returns {boolean} True if date changed
   * @private
   */
  static #hasDateChanged(previous, current) {
    return previous.year !== current.year || previous.month !== current.month || previous.day !== current.day;
  }

  /**
   * Update progress for multi-day events.
   *
   * @param {Object} currentDate - Current date components
   * @private
   */
  static #updateMultiDayEventProgress(currentDate) {
    const allNotes = NoteManager.getAllNotes();

    for (const note of allNotes) {
      // Skip if silent
      if (note.flagData.silent) continue;

      // Check if this is a multi-day event currently in progress
      const progress = this.#getMultiDayProgress(note, currentDate);
      if (!progress) continue;

      // Show or update progress notification
      this.#showProgressNotification(note, progress);
    }
  }

  /**
   * Calculate progress for a multi-day event.
   *
   * @param {Object} note - The note stub
   * @param {Object} currentDate - Current date
   * @returns {Object|null} Progress info or null if not a multi-day event in progress
   * @private
   */
  static #getMultiDayProgress(note, currentDate) {
    const startDate = note.flagData.startDate;
    const endDate = note.flagData.endDate;

    // Must have both start and end dates
    if (!startDate || !endDate) return null;

    // Check if current date is within the event range
    const start = { year: startDate.year, month: startDate.month, day: startDate.day };
    const end = { year: endDate.year, month: endDate.month, day: endDate.day };
    const current = { year: currentDate.year, month: currentDate.month, day: currentDate.day };

    // Current must be >= start and <= end
    if (compareDates(current, start) < 0 || compareDates(current, end) > 0) return null;

    // Calculate total days and current day
    const totalDays = this.#daysBetween(start, end) + 1;
    const currentDay = this.#daysBetween(start, current) + 1;

    if (totalDays <= 1) return null; // Not multi-day

    return { currentDay, totalDays, percentage: Math.round((currentDay / totalDays) * 100), isFirstDay: currentDay === 1, isLastDay: currentDay === totalDays };
  }

  /**
   * Calculate days between two dates.
   *
   * @param {Object} start - Start date
   * @param {Object} end - End date
   * @returns {number} Number of days between
   * @private
   */
  static #daysBetween(start, end) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return 0;

    // Convert to total days from epoch for each date
    const startSeconds = calendar.componentsToTime({ year: start.year, month: start.month, dayOfMonth: start.day - 1, hour: 0, minute: 0, second: 0 });
    const endSeconds = calendar.componentsToTime({ year: end.year, month: end.month, dayOfMonth: end.day - 1, hour: 0, minute: 0, second: 0 });
    const secondsPerDay = 24 * 60 * 60;
    return Math.floor((endSeconds - startSeconds) / secondsPerDay);
  }

  /**
   * Show or update a progress notification for a multi-day event.
   *
   * @param {Object} note - The note stub
   * @param {Object} progress - Progress info
   * @todo localize
   * @private
   */
  static #showProgressNotification(note, progress) {
    const message = `<strong>${note.name}</strong> - Day ${progress.currentDay} of ${progress.totalDays}`;

    // For first day, show a starting notification
    if (progress.isFirstDay) ui.notifications.info(`${message} (starting today)`, { permanent: false });
    // For last day, show a completion notification
    else if (progress.isLastDay) ui.notifications.info(`${message} (final day)`, { permanent: false });
    // For days in between, show progress
    else ui.notifications.info(`${message} (${progress.percentage}% complete)`, { permanent: false });

    // Fire hook for multi-day progress
    Hooks.callAll(HOOKS.EVENT_DAY_CHANGED, { id: note.id, name: note.name, progress });

    // Execute macro for multi-day events (fires daily)
    this.#executeMacro(note, { trigger: 'multiDayProgress', progress });
  }
}
