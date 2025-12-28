/**
 * Reminder Scheduler
 * Monitors world time changes and triggers reminders before note events occur.
 * Supports toast notifications, chat messages, and dialog popups with snooze.
 *
 * @module Time/ReminderScheduler
 * @author Tyler
 */

import { getCurrentDate } from '../notes/utils/date-utils.mjs';
import { localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { MODULE, HOOKS } from '../constants.mjs';
import CalendarManager from '../calendar/calendar-manager.mjs';
import NoteManager from '../notes/note-manager.mjs';

/**
 * Reminder Scheduler class that monitors time and triggers pre-event reminders.
 */
export default class ReminderScheduler {
  /** @type {Set<string>} Set of reminder keys that have fired today (noteId:offset) */
  static #firedToday = new Set();

  /** @type {Object|null} Last processed date */
  static #lastDate = null;

  /** @type {number} Minimum interval between checks in game seconds (5 minutes) */
  static CHECK_INTERVAL = 300;

  /** @type {number} Last world time when reminders were checked */
  static #lastCheckTime = 0;

  /* -------------------------------------------- */
  /*  Initialization                              */
  /* -------------------------------------------- */

  /**
   * Initialize the reminder scheduler.
   * @returns {void}
   */
  static initialize() {
    log(3, 'Initializing Reminder Scheduler...');
    this.#lastDate = getCurrentDate();
    log(3, 'Reminder Scheduler initialized');
  }

  /* -------------------------------------------- */
  /*  Time Update Handler                         */
  /* -------------------------------------------- */

  /**
   * Handle world time updates.
   * @param {number} worldTime - The new world time in seconds
   * @param {number} delta - The time delta in seconds
   * @returns {void}
   */
  static onUpdateWorldTime(worldTime, delta) {
    // Only GM should process reminders
    if (!game.user.isGM) return;

    const currentDate = getCurrentDate();
    if (!currentDate) return;

    if (!NoteManager.isInitialized()) return;

    // Reset fired reminders on day change
    if (this.#lastDate && this.#hasDateChanged(this.#lastDate, currentDate)) {
      this.#firedToday.clear();
    }

    // Throttle checks
    if (worldTime - this.#lastCheckTime >= this.CHECK_INTERVAL) {
      this.#checkReminders(worldTime, currentDate);
      this.#lastCheckTime = worldTime;
    }

    this.#lastDate = { ...currentDate };
  }

  /* -------------------------------------------- */
  /*  Reminder Check Logic                        */
  /* -------------------------------------------- */

  /**
   * Check all notes for pending reminders.
   * @param {number} worldTime - Current world time in seconds
   * @param {Object} currentDate - Current date components
   * @private
   */
  static #checkReminders(worldTime, currentDate) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return;

    const allNotes = NoteManager.getAllNotes();

    for (const note of allNotes) {
      // Skip notes without reminder offset
      if (!note.flagData.reminderOffset || note.flagData.reminderOffset <= 0) continue;

      // Skip silent notes
      if (note.flagData.silent) continue;

      const reminderKey = `${note.id}:${note.flagData.reminderOffset}`;
      if (this.#firedToday.has(reminderKey)) continue;

      // Check if reminder should fire
      if (this.#shouldFireReminder(note, worldTime, calendar)) {
        this.#fireReminder(note, currentDate);
        this.#firedToday.add(reminderKey);
      }
    }
  }

  /**
   * Determine if a reminder should fire based on current time and offset.
   * @param {Object} note - The note stub
   * @param {number} worldTime - Current world time in seconds
   * @param {Object} calendar - Active calendar
   * @returns {boolean}
   * @private
   */
  static #shouldFireReminder(note, worldTime, calendar) {
    const startDate = note.flagData.startDate;
    if (!startDate) return false;

    // Convert event start to world time seconds
    const eventTime = calendar.componentsToTime({
      year: startDate.year,
      month: startDate.month,
      dayOfMonth: startDate.day - 1,
      hour: note.flagData.allDay ? 0 : (startDate.hour ?? 0),
      minute: note.flagData.allDay ? 0 : (startDate.minute ?? 0),
      second: 0
    });

    // Calculate reminder trigger time (event time minus offset in minutes)
    const offsetSeconds = note.flagData.reminderOffset * 60;
    const reminderTime = eventTime - offsetSeconds;

    // Fire if we've just crossed the reminder time
    // Check if current time is within the check interval after reminder time
    return worldTime >= reminderTime && worldTime < reminderTime + this.CHECK_INTERVAL;
  }

  /* -------------------------------------------- */
  /*  Reminder Firing                             */
  /* -------------------------------------------- */

  /**
   * Fire a reminder notification.
   * @param {Object} note - The note stub
   * @param {Object} currentDate - Current date components
   * @private
   */
  static #fireReminder(note, currentDate) {
    log(3, `Firing reminder for: ${note.name}`);

    const reminderType = note.flagData.reminderType || 'toast';
    const targets = this.#getTargetUsers(note);

    // Only fire if current user is in targets
    if (!targets.includes(game.user.id)) return;

    const message = this.#formatReminderMessage(note);

    switch (reminderType) {
      case 'toast':
        this.#showToast(note, message);
        break;
      case 'chat':
        this.#sendChatReminder(note, message, targets);
        break;
      case 'dialog':
        this.#showDialog(note, message);
        break;
    }

    // Fire hook
    Hooks.callAll(HOOKS.EVENT_TRIGGERED, {
      id: note.id,
      name: note.name,
      flagData: note.flagData,
      reminderType,
      isReminder: true
    });
  }

  /**
   * Get list of user IDs who should receive the reminder.
   * @param {Object} note - The note stub
   * @returns {string[]} Array of user IDs
   * @private
   */
  static #getTargetUsers(note) {
    const targets = note.flagData.reminderTargets || 'all';

    switch (targets) {
      case 'all':
        return game.users.map(u => u.id);
      case 'gm':
        return game.users.filter(u => u.isGM).map(u => u.id);
      case 'author':
        return note.flagData.author ? [note.flagData.author] : [game.user.id];
      case 'specific':
        return note.flagData.reminderUsers || [];
      default:
        return game.users.map(u => u.id);
    }
  }

  /**
   * Format the reminder message.
   * @param {Object} note - The note stub
   * @returns {string}
   * @private
   */
  static #formatReminderMessage(note) {
    const offset = note.flagData.reminderOffset;
    let timeStr;

    if (offset >= 60) {
      const hours = Math.floor(offset / 60);
      const mins = offset % 60;
      timeStr = mins > 0 ? `${hours}h ${mins}m` : `${hours} hour${hours > 1 ? 's' : ''}`;
    } else {
      timeStr = `${offset} minute${offset > 1 ? 's' : ''}`;
    }

    return `<strong>${note.name}</strong> starts in ${timeStr}`;
  }

  /* -------------------------------------------- */
  /*  Notification Types                          */
  /* -------------------------------------------- */

  /**
   * Show toast notification.
   * @param {Object} note - The note stub
   * @param {string} message - Formatted message
   * @private
   */
  static #showToast(note, message) {
    const icon = this.#getIconHtml(note);
    ui.notifications.info(`${icon} ${message}`, { permanent: false });
  }

  /**
   * Send chat message reminder.
   * @param {Object} note - The note stub
   * @param {string} message - Formatted message
   * @param {string[]} targets - Target user IDs
   * @private
   */
  static async #sendChatReminder(note, message, targets) {
    const icon = this.#getIconHtml(note);
    const color = note.flagData.color || '#4a9eff';

    // Determine whisper recipients
    let whisper = [];
    if (note.flagData.reminderTargets !== 'all') {
      whisper = targets;
    }
    if (note.flagData.gmOnly) {
      whisper = game.users.filter(u => u.isGM).map(u => u.id);
    }

    const content = `
      <div class="calendaria-reminder">
        <div class="reminder-message">${message}</div>
        <a class="announcement-open" data-action="openNote" data-note-id="${note.id}" data-journal-id="${note.journalId}">
          ${icon} Open Note
        </a>
      </div>
    `.trim();

    await ChatMessage.create({
      content,
      whisper,
      speaker: { alias: 'Calendaria' },
      flavor: `<span style="color: ${color};">${icon}</span> Reminder`,
      flags: { [MODULE.ID]: { isReminder: true, noteId: note.id } }
    });
  }

  /**
   * Show dialog with snooze option.
   * @param {Object} note - The note stub
   * @param {string} message - Formatted message
   * @private
   */
  static async #showDialog(note, message) {
    const icon = this.#getIconHtml(note);

    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: 'Event Reminder', icon: 'fas fa-bell' },
      content: `<p>${icon} ${message}</p>`,
      buttons: [
        {
          action: 'open',
          label: 'Open Note',
          icon: 'fas fa-book-open',
          callback: () => 'open'
        },
        {
          action: 'snooze',
          label: 'Snooze 5m',
          icon: 'fas fa-clock',
          callback: () => 'snooze'
        },
        {
          action: 'dismiss',
          label: 'Dismiss',
          icon: 'fas fa-times',
          default: true,
          callback: () => 'dismiss'
        }
      ],
      rejectClose: false
    });

    if (result === 'open') {
      const page = NoteManager.getFullNote(note.id);
      if (page) page.sheet.render(true, { mode: 'view' });
    } else if (result === 'snooze') {
      // Remove from fired set to allow re-triggering
      const reminderKey = `${note.id}:${note.flagData.reminderOffset}`;
      this.#firedToday.delete(reminderKey);
      // Will re-fire on next check (5 min interval)
    }
  }

  /* -------------------------------------------- */
  /*  Utilities                                   */
  /* -------------------------------------------- */

  /**
   * Check if date has changed.
   * @param {Object} previous - Previous date
   * @param {Object} current - Current date
   * @returns {boolean}
   * @private
   */
  static #hasDateChanged(previous, current) {
    return previous.year !== current.year ||
           previous.month !== current.month ||
           previous.day !== current.day;
  }

  /**
   * Get icon HTML for a note.
   * @param {Object} note - The note stub
   * @returns {string}
   * @private
   */
  static #getIconHtml(note) {
    const icon = note.flagData.icon;
    const color = note.flagData.color || '#4a9eff';

    if (!icon) return `<i class="fas fa-bell" style="color: ${color};"></i>`;

    if (icon.startsWith('fa') || note.flagData.iconType === 'fontawesome') {
      return `<i class="${icon}" style="color: ${color};"></i>`;
    }

    return `<img src="${icon}" alt="" style="width: 16px; height: 16px; vertical-align: middle;" />`;
  }
}
