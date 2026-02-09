/**
 * Reminder Scheduler
 * Monitors world time changes and triggers reminders before note events occur.
 * Supports toast notifications, chat messages, and dialog popups.
 * @module Time/ReminderScheduler
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import CalendarRegistry from '../calendar/calendar-registry.mjs';
import { HOOKS, MODULE, SOCKET_TYPES } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { getCurrentDate } from '../notes/utils/date-utils.mjs';
import { isRecurringMatch } from '../notes/utils/recurrence.mjs';
import { format, localize } from '../utils/localization.mjs';
import { log } from '../utils/logger.mjs';
import { CalendariaSocket } from '../utils/socket.mjs';

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

  /**
   * Initialize the reminder scheduler.
   * Registers hook listener for socket-broadcast reminders.
   * @returns {void}
   */
  static initialize() {
    this.#lastDate = getCurrentDate();
    Hooks.on(HOOKS.REMINDER_RECEIVED, (data) => this.handleReminderNotify(data));
  }

  /**
   * Handle world time updates.
   * Only the primary GM runs reminder checks to avoid duplicates.
   * @param {number} worldTime - The new world time in seconds
   * @param {number} _delta - The time delta in seconds
   * @returns {void}
   */
  static onUpdateWorldTime(worldTime, _delta) {
    if (!CalendariaSocket.isPrimaryGM()) return;
    const currentDate = getCurrentDate();
    if (!currentDate) return;
    if (!NoteManager.isInitialized()) return;

    // Backwards time movement - reset all state and check immediately
    if (worldTime < this.#lastCheckTime) {
      this.#firedToday.clear();
      this.#lastCheckTime = worldTime;
      this.#checkReminders(worldTime, currentDate);
      this.#lastDate = { ...currentDate };
      return;
    }

    if (this.#lastDate && this.#hasDateChanged(this.#lastDate, currentDate)) this.#firedToday.clear();
    if (worldTime - this.#lastCheckTime >= this.CHECK_INTERVAL) {
      this.#checkReminders(worldTime, currentDate);
      this.#lastCheckTime = worldTime;
    }
    this.#lastDate = { ...currentDate };
  }

  /**
   * Check all notes for pending reminders.
   * Uses occurrence-based keys to support recurring events firing on each occurrence.
   * @param {number} worldTime - Current world time in seconds
   * @param {object} currentDate - Current date components
   * @private
   */
  static #checkReminders(worldTime, currentDate) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return;
    const activeCalendarId = calendar.metadata?.id || CalendarRegistry.getActiveId() || 'unknown';
    const allNotes = NoteManager.getAllNotes();
    log(3, `Checking ${allNotes.length} notes for reminders at ${currentDate.year}-${currentDate.month}-${currentDate.day} ${currentDate.hour}:${currentDate.minute}`);
    for (const note of allNotes) {
      if (note.calendarId && note.calendarId !== activeCalendarId) continue;
      if (note.flagData.reminderOffset == null || note.flagData.reminderOffset < 0) continue;
      if (note.flagData.silent) continue;
      const reminderKey = `${note.id}:${currentDate.year}-${currentDate.month}-${currentDate.day}`;
      if (this.#firedToday.has(reminderKey)) continue;
      log(3, `Evaluating reminder for "${note.name}" (offset: ${note.flagData.reminderOffset}h, allDay: ${note.flagData.allDay}, repeat: ${note.flagData.repeat})`);
      if (this.#shouldFireReminder(note, worldTime, calendar, currentDate)) {
        this.#fireReminder(note, currentDate);
        this.#firedToday.add(reminderKey);
      }
    }
  }

  /**
   * Determine if a reminder should fire based on current time and offset.
   * Reminder offset is stored in hours, converted to minutes for calculations.
   * @param {object} note - The note stub
   * @param {number} _worldTime - Current world time in seconds
   * @param {object} calendar - Active calendar
   * @param {object} currentDate - Current date components
   * @returns {boolean} - Should reminder fire?
   * @private
   */
  static #shouldFireReminder(note, _worldTime, calendar, currentDate) {
    const startDate = note.flagData.startDate;
    if (!startDate) return false;
    if (!currentDate) return false;
    const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
    const offsetMinutes = (note.flagData.reminderOffset ?? 0) * minutesPerHour;
    const hasRecurrence = note.flagData.repeat && note.flagData.repeat !== 'never';
    const hasConditions = note.flagData.conditions?.length > 0;

    if (hasRecurrence || hasConditions) {
      const occursToday = isRecurringMatch(note.flagData, currentDate);
      let occursTomorrow = false;
      if (note.flagData.allDay) {
        const tomorrow = this.#getNextDay(currentDate, calendar);
        occursTomorrow = isRecurringMatch(note.flagData, tomorrow);
        log(3, `  Tomorrow check: ${tomorrow.year}-${tomorrow.month}-${tomorrow.day}, occursTomorrow=${occursTomorrow}`);
      }

      log(3, `  Recurring: occursToday=${occursToday}, occursTomorrow=${occursTomorrow}, allDay=${note.flagData.allDay}`);
      if (!occursToday && !occursTomorrow) return false;

      // For all-day events, check if we should fire reminder tonight for tomorrow's occurrence
      if (occursTomorrow && note.flagData.allDay && offsetMinutes > 0) {
        const currentMinutes = currentDate.hour * minutesPerHour + currentDate.minute;
        const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
        const minutesInDay = hoursPerDay * minutesPerHour;
        const reminderMinutes = minutesInDay - offsetMinutes;
        log(3, `  Day-before check: currentMinutes=${currentMinutes}, reminderMinutes=${reminderMinutes}, shouldFire=${currentMinutes >= reminderMinutes}`);
        if (currentMinutes >= reminderMinutes) return true;
      }

      // For all-day events occurring today, fire reminder
      // 0-offset: fire anytime during the day (firedToday prevents repeat)
      // Non-zero offset: fire within early window (catch-up for missed evening reminder)
      if (occursToday && note.flagData.allDay) {
        if (offsetMinutes === 0) {
          log(3, `  All-day today (0-offset): shouldFire=true`);
          return true;
        }
        const currentMinutes = currentDate.hour * minutesPerHour + currentDate.minute;
        log(3, `  All-day today check: currentMinutes=${currentMinutes}, offsetMinutes=${offsetMinutes}, shouldFire=${currentMinutes <= offsetMinutes}`);
        if (currentMinutes <= offsetMinutes) return true;
      }

      // For timed events occurring today, check if we're in the reminder window
      if (occursToday && !note.flagData.allDay) {
        const currentMinutes = currentDate.hour * minutesPerHour + currentDate.minute;
        const eventHour = startDate.hour ?? 0;
        const eventMinute = startDate.minute ?? 0;
        const eventMinutes = eventHour * minutesPerHour + eventMinute;
        const reminderMinutes = eventMinutes - offsetMinutes;
        log(3, `  Same-day check: currentMinutes=${currentMinutes}, eventMinutes=${eventMinutes}, reminderMinutes=${reminderMinutes}`);
        return currentMinutes >= reminderMinutes && currentMinutes < eventMinutes;
      }

      return false;
    }

    // Non-recurring event - check if tomorrow falls within the event's date range (for multi-day events)
    const endDate = note.flagData.endDate;
    const tomorrow = this.#getNextDay(currentDate, calendar);
    const tomorrowInRange = this.#isDateInRange(tomorrow, startDate, endDate);
    const todayInRange = this.#isDateInRange(currentDate, startDate, endDate);

    log(3, `  Non-recurring: todayInRange=${todayInRange}, tomorrowInRange=${tomorrowInRange}, allDay=${note.flagData.allDay}`);

    // For all-day events, fire reminder the evening before each day of the event
    if (note.flagData.allDay && offsetMinutes > 0 && tomorrowInRange) {
      const currentMinutes = currentDate.hour * minutesPerHour + currentDate.minute;
      const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
      const minutesInDay = hoursPerDay * minutesPerHour;
      const reminderMinutes = minutesInDay - offsetMinutes;
      log(3, `  Multi-day before check: currentMinutes=${currentMinutes}, reminderMinutes=${reminderMinutes}, shouldFire=${currentMinutes >= reminderMinutes}`);
      return currentMinutes >= reminderMinutes;
    }

    // For timed events or same-day check
    if (todayInRange) {
      const isFirstDay = currentDate.year === startDate.year && currentDate.month === startDate.month && currentDate.day === startDate.day;
      const currentMinutes = currentDate.hour * minutesPerHour + currentDate.minute;
      const eventHour = note.flagData.allDay ? 0 : isFirstDay ? (startDate.hour ?? 0) : 0;
      const eventMinute = note.flagData.allDay ? 0 : isFirstDay ? (startDate.minute ?? 0) : 0;
      const eventMinutes = eventHour * minutesPerHour + eventMinute;
      const reminderMinutes = eventMinutes - offsetMinutes;
      return currentMinutes >= reminderMinutes && currentMinutes < eventMinutes;
    }

    return false;
  }

  /**
   * Check if a date falls within a date range (inclusive).
   * @param {object} date - Date to check
   * @param {object} startDate - Range start
   * @param {object} endDate - Range end (optional)
   * @returns {boolean} True if date is within range
   * @private
   */
  static #isDateInRange(date, startDate, endDate) {
    const dateVal = date.year * 10000 + date.month * 100 + date.day;
    const startVal = startDate.year * 10000 + startDate.month * 100 + startDate.day;
    if (dateVal < startVal) return false;
    if (!endDate || !endDate.year) return dateVal === startVal;
    const endVal = endDate.year * 10000 + endDate.month * 100 + endDate.day;
    return dateVal <= endVal;
  }

  /**
   * Get the next day's date components.
   * @param {object} currentDate - Current date components
   * @param {object} calendar - Active calendar
   * @returns {object} Next day's date components
   * @private
   */
  static #getNextDay(currentDate, calendar) {
    const yearZero = calendar.years?.yearZero ?? 0;
    const daysInMonth = calendar.getDaysInMonth(currentDate.month, currentDate.year - yearZero);
    let nextDay = currentDate.day + 1;
    let nextMonth = currentDate.month;
    let nextYear = currentDate.year;

    if (nextDay > daysInMonth) {
      nextDay = 1;
      nextMonth++;
      if (nextMonth >= calendar.monthsArray.length) {
        nextMonth = 0;
        nextYear++;
      }
    }

    return { year: nextYear, month: nextMonth, day: nextDay };
  }

  /**
   * Fire a reminder notification.
   * Broadcasts to all targeted users via socket for toast/dialog types.
   * @param {object} note - The note stub
   * @param {object} _currentDate - Current date components
   * @private
   */
  static #fireReminder(note, _currentDate) {
    const reminderType = note.flagData.reminderType || 'toast';
    const targets = this.#getTargetUsers(note);
    const message = this.#formatReminderMessage(note);

    switch (reminderType) {
      case 'toast':
      case 'dialog':
        CalendariaSocket.emit(SOCKET_TYPES.REMINDER_NOTIFY, {
          type: reminderType,
          noteId: note.id,
          noteName: note.name,
          journalId: note.journalId,
          message,
          icon: note.flagData.icon,
          iconType: note.flagData.iconType,
          color: note.flagData.color,
          targets
        });
        if (targets.includes(game.user.id)) {
          if (reminderType === 'toast') this.#showToast(note, message);
          else this.#showDialog(note, message);
        }
        break;
      case 'chat':
        this.#sendChatReminder(note, message, targets);
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
   * Offset is stored in hours.
   * @param {object} note - The note stub
   * @returns {string} - Formatted message
   * @private
   */
  static #formatReminderMessage(note) {
    const hours = note.flagData.reminderOffset;
    if (hours === 0) return format('CALENDARIA.Reminder.StartsNow', { name: note.name });
    const timeStr = hours > 1 ? format('CALENDARIA.Reminder.HoursPlural', { hours }) : format('CALENDARIA.Reminder.Hours', { hours });
    return format('CALENDARIA.Reminder.StartsIn', { name: note.name, time: timeStr });
  }

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
          ${icon} ${localize('CALENDARIA.Reminder.OpenNote')}
        </a>
      </div>
    `.trim();

    await ChatMessage.create({
      content,
      whisper,
      speaker: { alias: 'Calendaria' },
      flavor: `<span style="color: ${color};">${icon}</span> ${localize('CALENDARIA.Reminder.Label')}`,
      flags: { [MODULE.ID]: { isReminder: true, noteId: note.id } }
    });
  }

  /**
   * Show dialog popup.
   * @param {object} note - The note stub
   * @param {string} message - Formatted message
   * @private
   */
  static async #showDialog(note, message) {
    const icon = this.#getIconHtml(note);
    const result = await foundry.applications.api.DialogV2.wait({
      window: { title: localize('CALENDARIA.Reminder.Title'), icon: 'fas fa-bell' },
      content: `<p>${icon} ${message}</p>`,
      buttons: [
        { action: 'open', label: localize('CALENDARIA.Reminder.OpenNote'), icon: 'fas fa-book-open', callback: () => 'open' },
        { action: 'dismiss', label: localize('CALENDARIA.Reminder.Dismiss'), icon: 'fas fa-times', default: true, callback: () => 'dismiss' }
      ],
      rejectClose: false
    });

    if (result === 'open') {
      const page = NoteManager.getFullNote(note.id);
      if (page) page.sheet.render(true, { mode: 'view' });
    }
  }

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
    return `<img src="${icon}" alt="" style="width: 1rem; height: 1rem; vertical-align: middle;" />`;
  }

  /**
   * Get icon HTML from raw data (for socket messages).
   * @param {object} data - Socket data with icon, iconType, color
   * @returns {string} - Icon HTML string
   * @private
   */
  static #getIconHtmlFromData(data) {
    const icon = data.icon;
    const color = data.color || '#4a9eff';
    if (!icon) return `<i class="fas fa-bell" style="color: ${color};"></i>`;
    if (icon.startsWith('fa') || data.iconType === 'fontawesome') return `<i class="${icon}" style="color: ${color};"></i>`;
    return `<img src="${icon}" alt="" style="width: 1rem; height: 1rem; vertical-align: middle;" />`;
  }

  /**
   * Handle incoming reminder notification from socket.
   * Called by CalendariaSocket when a reminder broadcast is received.
   * @param {object} data - The reminder data
   * @param {string} data.type - 'toast' or 'dialog'
   * @param {string} data.noteId - Note page ID
   * @param {string} data.noteName - Note name
   * @param {string} data.journalId - Parent journal ID
   * @param {string} data.message - Formatted message
   * @param {string[]} data.targets - Array of target user IDs
   * @returns {void}
   */
  static handleReminderNotify(data) {
    if (!data.targets.includes(game.user.id)) return;
    const iconHtml = this.#getIconHtmlFromData(data);

    if (data.type === 'toast') {
      ui.notifications.info(`${iconHtml} ${data.message}`, { permanent: false });
    } else if (data.type === 'dialog') {
      foundry.applications.api.DialogV2.wait({
        window: { title: localize('CALENDARIA.Reminder.Title'), icon: 'fas fa-bell' },
        content: `<p>${iconHtml} ${data.message}</p>`,
        buttons: [
          {
            action: 'open',
            label: localize('CALENDARIA.Reminder.OpenNote'),
            icon: 'fas fa-book-open',
            callback: () => {
              const page = NoteManager.getFullNote(data.noteId);
              if (page) page.sheet.render(true, { mode: 'view' });
            }
          },
          { action: 'dismiss', label: localize('CALENDARIA.Reminder.Dismiss'), icon: 'fas fa-times', default: true }
        ],
        rejectClose: false
      });
    }
  }
}
