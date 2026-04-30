import { CalendarManager, CalendarRegistry } from '../calendar/_module.mjs';
import { HOOKS, MODULE, SOCKET_TYPES } from '../constants.mjs';
import { NoteManager, getCurrentDate, isRecurringMatch } from '../notes/_module.mjs';
import { CalendariaSocket, format, localize, log } from '../utils/_module.mjs';

/**
 * Reminder Scheduler class that monitors time and triggers pre-event reminders.
 */
export default class ReminderScheduler {
  /** @type {Set<string>} Set of reminder keys that have fired today (noteId:offset) */
  static #firedToday = new Set();

  /** @type {object | null} Last processed date */
  static #lastDate = null;

  /** @type {number} Minimum interval between checks in game seconds (1 minute) */
  static CHECK_INTERVAL = 60;

  /** @type {number} Last world time when reminders were checked */
  static #lastCheckTime = 0;

  /** @type {boolean} Flag to skip reminders on next update (for timepoint jumps) */
  static #skipNext = false;

  /** Skip reminders on the next time update. */
  static skipNext() {
    this.#skipNext = true;
  }

  /**
   * Initialize the reminder scheduler.
   * @returns {void}
   */
  static initialize() {
    this.#lastDate = getCurrentDate();
    Hooks.on(HOOKS.REMINDER_RECEIVED, (data) => this.handleReminderNotify(data));
  }

  /**
   * Handle world time updates.
   * @param {number} worldTime - The new world time in seconds
   * @param {number} _delta - The time delta in seconds
   * @returns {void}
   */
  static onUpdateWorldTime(worldTime, _delta) {
    if (!CalendariaSocket.isPrimaryGM()) return;
    if (this.#skipNext) {
      this.#skipNext = false;
      this.#lastDate = getCurrentDate();
      log(3, 'Skipping reminders (timepoint jump)');
      return;
    }
    const currentDate = getCurrentDate();
    if (!currentDate) return;
    if (!NoteManager.isInitialized()) return;
    if (worldTime < this.#lastCheckTime) {
      this.#firedToday.clear();
      this.#lastCheckTime = worldTime;
      this.#checkReminders(currentDate);
      this.#lastDate = { ...currentDate };
      return;
    }
    if (this.#lastDate && this.#hasDateChanged(this.#lastDate, currentDate)) this.#firedToday.clear();
    if (worldTime - this.#lastCheckTime >= this.CHECK_INTERVAL) {
      this.#checkReminders(currentDate);
      this.#lastCheckTime = worldTime;
    }
    this.#lastDate = { ...currentDate };
  }

  /**
   * Check all notes for pending reminders.
   * @param {object} currentDate - Current date components
   * @private
   */
  static #checkReminders(currentDate) {
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return;
    const activeCalendarId = calendar.metadata?.id || CalendarRegistry.getActiveId() || 'unknown';
    const allNotes = NoteManager.getAllNotes();
    let fired = 0;
    for (const note of allNotes) {
      if (note.calendarId && note.calendarId !== activeCalendarId) continue;
      if (note.flagData.reminderOffset == null || note.flagData.reminderOffset < 0) continue;
      if (note.flagData.silent) continue;
      const reminderKey = `${note.id}:${currentDate.year}-${currentDate.month}-${currentDate.dayOfMonth}`;
      if (this.#firedToday.has(reminderKey)) continue;
      if (this.#shouldFireReminder(note, calendar, currentDate)) {
        this.#fireReminder(note);
        this.#firedToday.add(reminderKey);
        fired++;
      }
    }
    if (fired > 0) log(3, `Fired ${fired} reminder(s) at ${currentDate.year}-${currentDate.month}-${currentDate.dayOfMonth} ${currentDate.hour}:${currentDate.minute}`);
  }

  /**
   * Determine if a reminder should fire based on current time and offset.
   * @param {object} note - The note stub
   * @param {object} calendar - Active calendar
   * @param {object} currentDate - Current date components
   * @returns {boolean} - Should reminder fire?
   * @private
   */
  static #shouldFireReminder(note, calendar, currentDate) {
    const startDate = note.flagData.startDate;
    if (!startDate) return false;
    if (!currentDate) return false;
    const minutesPerHour = calendar?.days?.minutesPerHour ?? 60;
    const hoursPerDay = calendar?.days?.hoursPerDay ?? 24;
    const minutesInDay = hoursPerDay * minutesPerHour;
    const offsetMinutes = (note.flagData.reminderOffset ?? 0) * minutesPerHour;
    const allDay = !!note.flagData.allDay;
    const eventMinuteOfDay = allDay ? 0 : (startDate.hour ?? 0) * minutesPerHour + (startDate.minute ?? 0);
    const shift = offsetMinutes - eventMinuteOfDay;
    const daysBefore = shift > 0 ? Math.floor((shift - 1) / minutesInDay) + 1 : 0;
    const reminderMinuteOfDay = eventMinuteOfDay + daysBefore * minutesInDay - offsetMinutes;
    const currentMinutes = currentDate.hour * minutesPerHour + currentDate.minute;
    const hasRecurrence = note.flagData.repeat && note.flagData.repeat !== 'never';
    const tree = note.flagData.conditionTree;
    const hasConditions = note.flagData.conditions?.length > 0 || (tree && (tree.children?.length > 0 || (tree.type === 'condition' && tree.field)));
    if (hasRecurrence || hasConditions) {
      const occursToday = isRecurringMatch(note.flagData, currentDate);
      let occursOnReminderDay = false;
      if (daysBefore > 0) {
        const reminderDay = this.#getDateNDaysAhead(currentDate, calendar, daysBefore);
        occursOnReminderDay = isRecurringMatch(note.flagData, reminderDay);
      }
      if (!occursToday && !occursOnReminderDay) return false;
      if (occursOnReminderDay && currentMinutes >= reminderMinuteOfDay) return true;
      if (occursToday && allDay) {
        if (offsetMinutes === 0) return true;
        if (currentMinutes <= offsetMinutes) return true;
      }
      if (occursToday && !allDay && daysBefore === 0) {
        if (offsetMinutes === 0) return currentMinutes >= eventMinuteOfDay;
        return currentMinutes >= reminderMinuteOfDay && currentMinutes < eventMinuteOfDay;
      }
      return false;
    }
    if (daysBefore > 0) {
      const reminderDay = this.#getDateNDaysAhead(currentDate, calendar, daysBefore);
      if (reminderDay.year === startDate.year && reminderDay.month === startDate.month && reminderDay.dayOfMonth === startDate.dayOfMonth) return currentMinutes >= reminderMinuteOfDay;
      return false;
    }
    const endDate = note.flagData.endDate;
    if (this.#isDateInRange(currentDate, startDate, endDate)) {
      const isFirstDay = currentDate.year === startDate.year && currentDate.month === startDate.month && currentDate.dayOfMonth === startDate.dayOfMonth;
      const eventHour = allDay ? 0 : isFirstDay ? (startDate.hour ?? 0) : 0;
      const eventMinute = allDay ? 0 : isFirstDay ? (startDate.minute ?? 0) : 0;
      const eventMinutes = eventHour * minutesPerHour + eventMinute;
      if (offsetMinutes === 0) return currentMinutes >= eventMinutes;
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
    const dateVal = date.year * 10000 + date.month * 100 + date.dayOfMonth;
    const startVal = startDate.year * 10000 + startDate.month * 100 + startDate.dayOfMonth;
    if (dateVal < startVal) return false;
    if (!endDate || !endDate.year) return dateVal === startVal;
    const endVal = endDate.year * 10000 + endDate.month * 100 + endDate.dayOfMonth;
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
    let nextDayOfMonth = currentDate.dayOfMonth + 1;
    let nextMonth = currentDate.month;
    let nextYear = currentDate.year;
    if (nextDayOfMonth >= daysInMonth) {
      nextDayOfMonth = 0;
      nextMonth++;
      if (nextMonth >= calendar.monthsArray.length) {
        nextMonth = 0;
        nextYear++;
      }
    }
    return { year: nextYear, month: nextMonth, dayOfMonth: nextDayOfMonth };
  }

  /**
   * Walk forward N days from the given date.
   * @param {object} currentDate - Starting date components
   * @param {object} calendar - Active calendar
   * @param {number} n - Number of days to walk forward
   * @returns {object} Date components N days ahead
   * @private
   */
  static #getDateNDaysAhead(currentDate, calendar, n) {
    let date = currentDate;
    for (let i = 0; i < n; i++) date = this.#getNextDay(date, calendar);
    return date;
  }

  /**
   * Fire a reminder notification.
   * @param {object} note - The note stub
   * @private
   */
  static #fireReminder(note) {
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
      case 'viewers': {
        const visibility = note.flagData.visibility || 'visible';
        if (visibility === 'hidden' || visibility === 'secret') return game.users.filter((u) => u.isGM).map((u) => u.id);
        return game.users.filter((u) => u.isGM || note.page?.testUserPermission(u, 'OBSERVER')).map((u) => u.id);
      }
      default:
        return game.users.map((u) => u.id);
    }
  }

  /**
   * Format the reminder message.
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
    if (note.flagData.visibility && note.flagData.visibility !== 'visible') whisper = game.users.filter((u) => u.isGM).map((u) => u.id);
    const content = `
      <div class="calendaria chat-reminder">
        <div class="reminder-message">${message}</div>
        <a class="open-note" data-action="openNote" data-note-id="${note.id}" data-journal-id="${note.journalId}">
          ${icon} ${localize('CALENDARIA.Common.OpenNote')}
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
        { action: 'open', label: localize('CALENDARIA.Common.OpenNote'), icon: 'fas fa-book-open', callback: () => 'open' },
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
    return previous.year !== current.year || previous.month !== current.month || previous.dayOfMonth !== current.dayOfMonth;
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
            label: localize('CALENDARIA.Common.OpenNote'),
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
