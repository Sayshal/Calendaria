/**
 * Reminder Scheduler
 * Monitors world time changes and triggers reminders before note events occur.
 * Supports toast notifications, chat messages, and dialog popups.
 * @module Time/ReminderScheduler
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import CalendarRegistry from '../calendar/calendar-registry.mjs';
import { HOOKS, MODULE } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { getCurrentDate } from '../notes/utils/date-utils.mjs';
import { isRecurringMatch } from '../notes/utils/recurrence.mjs';

/**
 * Reminder Scheduler class that monitors time and triggers pre-event reminders.
 */
export default class ReminderScheduler {
  /** @type {Set<string>} Set of reminder keys that have fired today (noteId:offset) */
  static #firedToday = new Set();

  /** @type {object | null} Last processed date */
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
    this.#lastDate = getCurrentDate();
  }

  /* -------------------------------------------- */
  /*  Time Update Handler                         */
  /* -------------------------------------------- */

  /**
   * Handle world time updates.
   * @param {number} worldTime - The new world time in seconds
   * @param {number} _delta - The time delta in seconds
   * @returns {void}
   */
  static onUpdateWorldTime(worldTime, _delta) {
    if (!game.user.isGM) return;
    const currentDate = getCurrentDate();
    if (!currentDate) return;
    if (!NoteManager.isInitialized()) return;
    if (this.#lastDate && this.#hasDateChanged(this.#lastDate, currentDate)) this.#firedToday.clear();
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
   * @param {object} currentDate - Current date components
   * @private
   */
  static #checkReminders(worldTime, currentDate) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return;
    const activeCalendarId = calendar.metadata?.id || CalendarRegistry.getActiveId() || 'unknown';
    const allNotes = NoteManager.getAllNotes();
    for (const note of allNotes) {
      if (note.flagData.calendarId && note.flagData.calendarId !== activeCalendarId) continue;
      if (!note.flagData.reminderOffset || note.flagData.reminderOffset <= 0) continue;
      if (note.flagData.silent) continue;
      const reminderKey = `${note.id}:${note.flagData.reminderOffset}`;
      if (this.#firedToday.has(reminderKey)) continue;
      if (this.#shouldFireReminder(note, worldTime, calendar)) {
        this.#fireReminder(note, currentDate);
        this.#firedToday.add(reminderKey);
      }
    }
  }

  /**
   * Determine if a reminder should fire based on current time and offset.
   * @param {object} note - The note stub
   * @param {number} _worldTime - Current world time in seconds
   * @param {object} calendar - Active calendar
   * @returns {boolean} - Should reminder fire?
   * @private
   */
  static #shouldFireReminder(note, _worldTime, calendar) {
    const startDate = note.flagData.startDate;
    if (!startDate) return false;
    const currentDate = getCurrentDate();
    if (!currentDate) return false;
    const hasRecurrence = note.flagData.repeat && note.flagData.repeat !== 'never';
    const hasConditions = note.flagData.conditions?.length > 0;
    if (hasRecurrence || hasConditions) {
      const occursToday = isRecurringMatch(note.flagData, currentDate);
      let occursTomorrow = false;
      if (note.flagData.allDay) {
        const tomorrow = this.#getNextDay(currentDate, calendar);
        occursTomorrow = isRecurringMatch(note.flagData, tomorrow);
      }

      if (!occursToday && !occursTomorrow) return false;
      if (!occursToday && occursTomorrow && note.flagData.allDay) {
        const components = game.time.components;
        const currentMinutes = components.hour * 60 + components.minute;
        const minutesInDay = 24 * 60;
        const reminderMinutes = minutesInDay - (note.flagData.reminderOffset ?? 0);
        return currentMinutes >= reminderMinutes;
      }

      if (occursToday) {
        const components = game.time.components;
        const currentMinutes = components.hour * 60 + components.minute;
        const eventHour = note.flagData.allDay ? 0 : (startDate.hour ?? 0);
        const eventMinute = note.flagData.allDay ? 0 : (startDate.minute ?? 0);
        const eventMinutes = eventHour * 60 + eventMinute;
        const reminderMinutes = eventMinutes - (note.flagData.reminderOffset ?? 0);
        return currentMinutes >= reminderMinutes && currentMinutes < eventMinutes;
      }

      return false;
    }

    const isSameDate = currentDate.year === startDate.year && currentDate.month === startDate.month && currentDate.day === startDate.day;
    if (!isSameDate) return false;
    const components = game.time.components;
    const currentMinutes = components.hour * 60 + components.minute;
    const eventHour = note.flagData.allDay ? 0 : (startDate.hour ?? 0);
    const eventMinute = note.flagData.allDay ? 0 : (startDate.minute ?? 0);
    const eventMinutes = eventHour * 60 + eventMinute;
    const reminderMinutes = eventMinutes - (note.flagData.reminderOffset ?? 0);
    return currentMinutes >= reminderMinutes && currentMinutes < eventMinutes;
  }

  /**
   * Get the next day's date components.
   * @param {object} currentDate - Current date components
   * @param {object} calendar - Active calendar
   * @returns {object} Next day's date components
   * @private
   */
  static #getNextDay(currentDate, calendar) {
    const daysInMonth = calendar.getDaysInMonth(currentDate.year, currentDate.month);
    let nextDay = currentDate.day + 1;
    let nextMonth = currentDate.month;
    let nextYear = currentDate.year;

    if (nextDay > daysInMonth) {
      nextDay = 1;
      nextMonth++;
      if (nextMonth >= calendar.months.values.length) {
        nextMonth = 0;
        nextYear++;
      }
    }

    return { year: nextYear, month: nextMonth, day: nextDay };
  }

  /* -------------------------------------------- */
  /*  Reminder Firing                             */
  /* -------------------------------------------- */

  /**
   * Fire a reminder notification.
   * @param {object} note - The note stub
   * @param {object} _currentDate - Current date components
   * @private
   */
  static #fireReminder(note, _currentDate) {
    const reminderType = note.flagData.reminderType || 'toast';
    const targets = this.#getTargetUsers(note);
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

    Hooks.callAll(HOOKS.EVENT_TRIGGERED, { id: note.id, name: note.name, flagData: note.flagData, reminderType, isReminder: true });
  }

  /**
   * Get list of user IDs who should receive the reminder.
   * @param {object} note - The note stub
   * @returns {string[]} Array of user IDs
   * @private
   */
  static #getTargetUsers(note) {
    const targets = note.flagData.reminderTargets || 'all';

    switch (targets) {
      case 'all':
        return game.users.map((u) => u.id);
      case 'gm':
        return game.users.filter((u) => u.isGM).map((u) => u.id);
      case 'author':
        return note.flagData.author ? [note.flagData.author] : [game.user.id];
      case 'specific':
        return note.flagData.reminderUsers || [];
      default:
        return game.users.map((u) => u.id);
    }
  }

  /**
   * Format the reminder message.
   * @param {object} note - The note stub
   * @returns {string} - Formatted message
   * @todo localize return statement
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
   * @param {object} note - The note stub
   * @param {string} message - Formatted message
   * @private
   */
  static #showToast(note, message) {
    const icon = this.#getIconHtml(note);
    ui.notifications.info(`${icon} ${message}`, { permanent: false });
  }

  /**
   * Send chat message reminder.
   * @param {object} note - The note stub
   * @param {string} message - Formatted message
   * @param {string[]} targets - Target user IDs
   * @todo localize the template and move to a template file
   * @private
   */
  static async #sendChatReminder(note, message, targets) {
    const icon = this.#getIconHtml(note);
    const color = note.flagData.color || '#4a9eff';
    let whisper = [];
    if (note.flagData.reminderTargets !== 'all') whisper = targets;
    if (note.flagData.gmOnly) whisper = game.users.filter((u) => u.isGM).map((u) => u.id);

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
   * Show dialog popup.
   * @param {object} note - The note stub
   * @param {string} message - Formatted message
   * @todo Localize
   * @private
   */
  static async #showDialog(note, message) {
    const icon = this.#getIconHtml(note);
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: 'Event Reminder', icon: 'fas fa-bell' },
      content: `<p>${icon} ${message}</p>`,
      buttons: [
        { action: 'open', label: 'Open Note', icon: 'fas fa-book-open', callback: () => 'open' },
        { action: 'dismiss', label: 'Dismiss', icon: 'fas fa-times', default: true, callback: () => 'dismiss' }
      ],
      rejectClose: false
    });

    if (result === 'open') {
      const page = NoteManager.getFullNote(note.id);
      if (page) page.sheet.render(true, { mode: 'view' });
    }
  }

  /* -------------------------------------------- */
  /*  Utilities                                   */
  /* -------------------------------------------- */

  /**
   * Check if date has changed.
   * @param {object} previous - Previous date
   * @param {object} current - Current date
   * @returns {boolean} - Has the date changed?
   * @private
   */
  static #hasDateChanged(previous, current) {
    return previous.year !== current.year || previous.month !== current.month || previous.day !== current.day;
  }

  /**
   * Get icon HTML for a note.
   * @param {object} note - The note stub
   * @returns {string} - Icon HTML string
   * @private
   */
  static #getIconHtml(note) {
    const icon = note.flagData.icon;
    const color = note.flagData.color || '#4a9eff';
    if (!icon) return `<i class="fas fa-bell" style="color: ${color};"></i>`;
    if (icon.startsWith('fa') || note.flagData.iconType === 'fontawesome') return `<i class="${icon}" style="color: ${color};"></i>`;
    return `<img src="${icon}" alt="" style="width: 16px; height: 16px; vertical-align: middle;" />`;
  }
}
