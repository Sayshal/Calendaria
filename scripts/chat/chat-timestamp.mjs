/**
 * Chat Message Timestamp System
 * Stores world time with chat messages and optionally displays in-game dates.
 * @module ChatTimestamp
 * @author Tyler
 */

import CalendarManager from '../calendar/calendar-manager.mjs';
import { MODULE, SETTINGS } from '../constants.mjs';
import NoteManager from '../notes/note-manager.mjs';
import { formatForLocation, hasMoonIconMarkers, renderMoonIcons } from '../utils/format-utils.mjs';

const ChatLog = foundry.applications.sidebar.tabs.ChatLog;

/**
 * Hook handler for preCreateChatMessage.
 * Stores current world time and formatted fantasy date in message flags.
 * @param {ChatMessage} message - The chat message being created
 * @param {object} _data - The creation data
 * @param {object} _options - Creation options
 * @param {string} _userId - The creating user's ID
 */
export function onPreCreateChatMessage(message, _data, _options, _userId) {
  const mode = game.settings.get(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE);
  if (mode === 'disabled') return;
  const worldTime = game.time.worldTime;
  const fantasyDate = formatWorldTime(worldTime);
  message.updateSource({ [`flags.${MODULE.ID}.worldTime`]: worldTime, [`flags.${MODULE.ID}.fantasyDate`]: fantasyDate });
}

/**
 * Hook handler for renderChatMessageHTML.
 * Replaces or augments the timestamp display with in-game date/time.
 * @param {ChatMessage} message - The chat message document
 * @param {HTMLElement} html - The rendered HTML element
 * @param {object} _context - Render context
 */
export function onRenderChatMessageHTML(message, html, _context) {
  const mode = game.settings.get(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE);
  if (mode === 'disabled') return;
  const flags = message.flags?.[MODULE.ID];
  if (!flags?.worldTime && !flags?.fantasyDate) return;
  const timestampEl = html.querySelector('.message-timestamp');
  if (!timestampEl) return;
  const formattedDate = flags.fantasyDate || formatWorldTime(flags.worldTime);
  if (!formattedDate) return;
  if (mode === 'replace') {
    if (hasMoonIconMarkers(formattedDate)) timestampEl.innerHTML = renderMoonIcons(formattedDate);
    else timestampEl.textContent = formattedDate;
  } else if (mode === 'augment') {
    const wrapper = document.createElement('span');
    wrapper.className = 'calendaria-timestamp-wrapper';
    const gameDate = document.createElement('span');
    gameDate.className = 'calendaria-timestamp';
    if (hasMoonIconMarkers(formattedDate)) gameDate.innerHTML = `${renderMoonIcons(formattedDate)} `;
    else gameDate.textContent = `${formattedDate} `;
    const realDate = document.createElement('span');
    realDate.className = 'calendaria-timestamp-real';
    realDate.textContent = timestampEl.textContent;
    wrapper.appendChild(gameDate);
    wrapper.appendChild(realDate);
    timestampEl.replaceChildren(wrapper);
  }
}

/**
 * Override ChatLog.prototype.updateTimestamps to prevent Foundry from
 * overwriting our custom timestamps.
 */
export function overrideChatLogTimestamps() {
  const originalUpdateTimestamps = ChatLog.prototype.updateTimestamps;
  ChatLog.prototype.updateTimestamps = function () {
    const mode = game.settings.get(MODULE.ID, SETTINGS.CHAT_TIMESTAMP_MODE);
    if (mode === 'disabled') return originalUpdateTimestamps.call(this);
    for (const li of document.querySelectorAll('.chat-message[data-message-id]')) {
      const message = game.messages.get(li.dataset.messageId);
      if (!message?.timestamp) continue;
      const stamp = li.querySelector('.message-timestamp');
      if (!stamp) continue;
      const flags = message.flags?.[MODULE.ID];
      if (flags?.worldTime !== undefined || flags?.fantasyDate) {
        const formattedDate = flags.fantasyDate || formatWorldTime(flags.worldTime);
        if (formattedDate) {
          if (mode === 'replace') {
            if (hasMoonIconMarkers(formattedDate)) stamp.innerHTML = renderMoonIcons(formattedDate);
            else stamp.textContent = formattedDate;
            stamp.dataset.tooltip = foundry.utils.timeSince(message.timestamp);
          } else if (mode === 'augment') {
            const gameDate = stamp.querySelector('.calendaria-timestamp');
            if (gameDate) {
              if (hasMoonIconMarkers(formattedDate)) gameDate.innerHTML = `${renderMoonIcons(formattedDate)} `;
              else gameDate.textContent = `${formattedDate} `;
            }
            const realDate = stamp.querySelector('.calendaria-timestamp-real');
            if (realDate) realDate.textContent = foundry.utils.timeSince(message.timestamp);
          }
        }
      } else {
        stamp.textContent = foundry.utils.timeSince(message.timestamp);
      }
    }
  };
}

/**
 * Format world time to a readable date string using display format settings.
 * @param {number} worldTime - The world time in seconds
 * @returns {string} Formatted date string
 */
export function formatWorldTime(worldTime) {
  const calendar = CalendarManager.getActiveCalendar();
  if (!calendar) return '';
  const components = calendar.timeToComponents(worldTime);
  const yearZero = calendar.years?.yearZero ?? 0;
  return formatForLocation(calendar, { ...components, year: components.year + yearZero, dayOfMonth: (components.dayOfMonth ?? 0) + 1 }, 'chatTimestamp');
}

/**
 * Handle renderChatMessage hook for calendar announcements and reminders.
 * @param {object} message - The chat message document
 * @param {HTMLElement} html - The rendered HTML element
 * @param {object} _context - Render context
 */
export function onRenderAnnouncementMessage(message, html, _context) {
  const flags = message.flags?.[MODULE.ID];
  if (!flags?.isAnnouncement && !flags?.isReminder) return;
  const openLink = html.querySelector('.announcement-open');
  if (!openLink) return;
  openLink.addEventListener('click', async (event) => {
    event.preventDefault();
    const noteId = openLink.dataset.noteId || flags?.noteId;
    const journalId = openLink.dataset.journalId || flags?.journalId;
    if (!noteId) return;
    const page = NoteManager.getFullNote(noteId);
    if (page) {
      page.sheet.render(true, { mode: 'view' });
    } else if (journalId) {
      const journal = game.journal.get(journalId);
      if (journal) journal.sheet.render(true, { pageId: noteId });
    }
  });
}
