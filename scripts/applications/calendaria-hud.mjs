/**
 * Draggable Calendar HUD
 * Extends the D&D 5e CalendarHUD to add drag functionality when available.
 * For non-dnd5e systems, this module does not provide a HUD - systems must provide their own.
 * @module Applications/CalendariaHUD
 * @author Tyler
 */

import { MODULE, SETTINGS, TEMPLATES, SYSTEM } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import { CalendarApplication } from './calendar-application.mjs';

/**
 * Determine base class - extends dnd5e CalendarHUD when available, otherwise stub.
 * Check for dnd5e global at module load time (game.system not yet initialized).
 */
const BaseClass = typeof dnd5e !== 'undefined' && dnd5e.applications?.calendar?.CalendarHUD ? dnd5e.applications.calendar.CalendarHUD : class CalendarHUDStub {};

/**
 * Enhanced Calendar HUD with dragging, positioning, and time rotation features.
 * Only functional when running on the dnd5e system.
 */
export class CalendariaHUD extends BaseClass {
  /** @override */
  static DEFAULT_OPTIONS = typeof dnd5e !== 'undefined' && dnd5e.applications?.calendar?.CalendarHUD ? { ...super.DEFAULT_OPTIONS } : {};

  /* -------------------------------------------- */

  /** @override */
  _insertElement(element) {
    const existing = document.getElementById(element.id);
    if (existing) existing.replaceWith(element);
    else document.body.append(this.element);
  }

  /* -------------------------------------------- */

  /** @override */
  async _onRender(context, options) {
    await super._onRender(context, options);

    // Restore saved position if available
    this.#restorePosition();

    // Make the calendar core draggable
    this.#enableDragging();

    // Reverse the calendar widget animation
    this.#reverseWidgetAnimation();

    // Add right-click handler for time rotation
    this.#enableTimeRotation();

    // Inject the Open Calendar button
    this.#injectOpenCalendarButton();

    // Inject the Lock Position button
    this.#injectLockButton();
  }

  /* -------------------------------------------- */

  /**
   * Restore saved position from settings, or center if none saved.
   */
  #restorePosition() {
    try {
      const savedPos = game.settings.get(MODULE.ID, SETTINGS.CALENDAR_POSITION);
      this.element.style.position = 'fixed';
      this.element.style.zIndex = '100';

      if (savedPos && typeof savedPos.top === 'number' && typeof savedPos.left === 'number') {
        this.element.style.left = `${savedPos.left}px`;
        this.element.style.top = `${savedPos.top}px`;
      } else {
        // Center horizontally when no saved position
        const rect = this.element.getBoundingClientRect();
        const left = (window.innerWidth - rect.width) / 2;
        const top = 16;
        this.element.style.left = `${left}px`;
        this.element.style.top = `${top}px`;
      }
    } catch (error) {
      log(2, 'Error restoring calendar position:', error);
    }
  }

  /* -------------------------------------------- */

  /**
   * Enable dragging functionality on the calendar core element.
   */
  #enableDragging() {
    const dragHandle = this.element.querySelector('.calendar-core');
    if (!dragHandle) return;

    // Check if position is locked
    const isLocked = game.settings.get(MODULE.ID, SETTINGS.POSITION_LOCKED);

    // Add/update blocking handler for locked state
    if (!dragHandle._lockHandler) {
      dragHandle._lockHandler = (event) => {
        if (game.settings.get(MODULE.ID, SETTINGS.POSITION_LOCKED)) {
          event.stopImmediatePropagation();
          event.preventDefault();
        }
      };
      // Block both mousedown and pointerdown in capture phase
      dragHandle.addEventListener('mousedown', dragHandle._lockHandler, true);
      dragHandle.addEventListener('pointerdown', dragHandle._lockHandler, true);
    }

    // Set cursor based on lock state
    dragHandle.style.cursor = isLocked ? 'default' : 'move';

    // Always create Draggable - blocking handler prevents it when locked
    const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, dragHandle, false);

    let dragStartX = 0;
    let dragStartY = 0;
    let elementStartLeft = 0;
    let elementStartTop = 0;

    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
      const rect = this.element.getBoundingClientRect();
      elementStartLeft = rect.left;
      elementStartTop = rect.top;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      originalMouseDown(event);
    };

    drag._onDragMouseMove = (event) => {
      event.preventDefault();
      const now = Date.now();
      if (!drag._moveTime) drag._moveTime = 0;
      if (now - drag._moveTime < 1000 / 60) return;
      drag._moveTime = now;

      const deltaX = event.clientX - dragStartX;
      const deltaY = event.clientY - dragStartY;
      const rect = this.element.getBoundingClientRect();

      // Calculate new position
      let newLeft = elementStartLeft + deltaX;
      let newTop = elementStartTop + deltaY;

      // Clamp position to viewport bounds
      newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - rect.width));
      newTop = Math.max(0, Math.min(newTop, window.innerHeight - rect.height));

      this.element.style.left = `${newLeft}px`;
      this.element.style.top = `${newTop}px`;
    };

    drag._onDragMouseUp = async (event) => {
      event.preventDefault();
      window.removeEventListener(...drag.handlers.dragMove);
      window.removeEventListener(...drag.handlers.dragUp);

      const rect = this.element.getBoundingClientRect();
      await game.settings.set(MODULE.ID, SETTINGS.CALENDAR_POSITION, { left: rect.left, top: rect.top });
    };
  }

  /* -------------------------------------------- */

  /**
   * Reverse the calendar widget animation direction.
   */
  #reverseWidgetAnimation() {
    const widget = this.element.querySelector('.calendar-widget');
    if (widget) widget.classList.add('reverse-animation');
  }

  /* -------------------------------------------- */

  /**
   * Enable right-click handler to open time rotation dial.
   */
  #enableTimeRotation() {
    const widget = this.element.querySelector('.calendar-widget');
    if (!widget) return;

    widget.addEventListener('contextmenu', (event) => {
      event.preventDefault();
      event.stopPropagation();
      this.#openTimeRotationDial(event);
    });
  }

  /* -------------------------------------------- */

  /**
   * Inject the Open Calendar button into the startButtons menu.
   */
  #injectOpenCalendarButton() {
    const startButtons = this.element.querySelector('[data-application-part="startButtons"]');
    if (!startButtons) return;

    // Check if already injected
    if (startButtons.querySelector('[data-action="openCalendar"]')) return;

    // Create button element
    const label = game.i18n.localize('CALENDARIA.HUD.OpenCalendar');
    const li = document.createElement('li');
    li.className = 'calendar-button';
    li.innerHTML = `
      <button type="button" data-action="openCalendar" data-tooltip="${label}" aria-label="${label}" data-tooltip-direction="LEFT">
        <i class="fas fa-calendar-plus"></i>
      </button>
    `;

    // Insert as first child
    startButtons.insertBefore(li, startButtons.firstChild);

    // Add click handler
    li.querySelector('button').addEventListener('click', () => {
      new CalendarApplication().render(true);
    });
  }

  /* -------------------------------------------- */

  /**
   * Inject the Lock Position button into the endButtons menu.
   */
  #injectLockButton() {
    const endButtons = this.element.querySelector('[data-application-part="endButtons"]');
    if (!endButtons) return;

    // Check if already injected
    if (endButtons.querySelector('[data-action="toggleLock"]')) return;

    // Get current lock state
    const isLocked = game.settings.get(MODULE.ID, SETTINGS.POSITION_LOCKED);
    const label = game.i18n.localize(isLocked ? 'CALENDARIA.HUD.UnlockPosition' : 'CALENDARIA.HUD.LockPosition');
    const icon = isLocked ? 'fa-lock' : 'fa-lock-open';

    // Create button element
    const li = document.createElement('li');
    li.className = 'calendar-button';
    li.innerHTML = `
      <button type="button" data-action="toggleLock" data-tooltip="${label}" aria-label="${label}" data-tooltip-direction="RIGHT">
        <i class="fas ${icon}"></i>
      </button>
    `;

    // Append as last child
    endButtons.appendChild(li);

    // Add click handler
    const button = li.querySelector('button');
    button.addEventListener('click', async () => {
      const currentLock = game.settings.get(MODULE.ID, SETTINGS.POSITION_LOCKED);
      const newLock = !currentLock;
      await game.settings.set(MODULE.ID, SETTINGS.POSITION_LOCKED, newLock);

      // Update button UI in-place (avoid full re-render which causes position jump)
      const newLabel = game.i18n.localize(newLock ? 'CALENDARIA.HUD.UnlockPosition' : 'CALENDARIA.HUD.LockPosition');
      const newIcon = newLock ? 'fa-lock' : 'fa-lock-open';
      button.dataset.tooltip = newLabel;
      button.setAttribute('aria-label', newLabel);
      button.querySelector('i').className = `fas ${newIcon}`;

      // Update cursor on drag handle
      const dragHandle = this.element.querySelector('.calendar-core');
      if (dragHandle) dragHandle.style.cursor = newLock ? 'default' : 'move';
    });
  }

  /* -------------------------------------------- */

  /**
   * Open the circular time rotation dial
   * @param {MouseEvent} event - The right-click event
   */
  async #openTimeRotationDial(event) {
    log(3, 'Opening time rotation dial', { x: event.clientX, y: event.clientY });

    // Remove any existing dial
    const existingDial = document.getElementById('calendaria-time-dial');
    if (existingDial) existingDial.remove();

    // Get current calendar time
    const currentTime = game.time.worldTime;
    const date = new Date(currentTime * 1000);
    const hours = date.getUTCHours();
    const minutes = date.getUTCMinutes();

    // Prepare template data
    const templateData = {
      currentTime: this.#formatTime(hours, minutes),
      hourMarkers: this.#generateHourMarkers()
    };

    // Render the template
    const html = await foundry.applications.handlebars.renderTemplate(TEMPLATES.TIME_DIAL, templateData);

    // Create the dial container
    const dial = document.createElement('div');
    dial.id = 'calendaria-time-dial';
    dial.className = 'calendaria-time-dial';
    dial.innerHTML = html;

    // Position relative to calendar HUD (20px below, or 20px above if not enough room)
    document.body.appendChild(dial);
    const dialContainer = dial.querySelector('.dial-container');
    const dialRect = dialContainer.getBoundingClientRect();
    const hudElement = this.element[0] || this.element;
    const hudRect = hudElement.getBoundingClientRect();

    // Calculate horizontal position (centered on HUD)
    let left = hudRect.left + hudRect.width / 2 - dialRect.width / 2;
    left = Math.min(Math.max(left, 0), window.innerWidth - dialRect.width);

    // Calculate vertical position (20px below HUD, or 20px above if not enough room)
    let top;
    const spaceBelow = window.innerHeight - hudRect.bottom;
    const spaceAbove = hudRect.top;

    if (spaceBelow >= dialRect.height + 20) top = hudRect.bottom + 20;
    else if (spaceAbove >= dialRect.height + 20) top = hudRect.top - dialRect.height - 20;
    else top = hudRect.bottom + 20;

    dial.style.left = `${left}px`;
    dial.style.top = `${top}px`;

    // Store initial values
    this._dialState = { currentHours: hours, currentMinutes: minutes, initialTime: currentTime };

    // Set initial rotation
    const initialAngle = this.#timeToAngle(hours, minutes);
    this.#updateDialRotation(dial, initialAngle);

    // Add interaction handlers
    this.#setupDialInteraction(dial);
  }

  /* -------------------------------------------- */

  /**
   * Generate hour marker data for the dial template
   * @returns {Array} Array of hour marker objects
   */
  #generateHourMarkers() {
    const markers = [];
    for (let hour = 0; hour < 24; hour++) {
      const angle = hour * 15 + 90;
      const radians = (angle * Math.PI) / 180;
      const x1 = 100 + Math.cos(radians) * 80;
      const y1 = 100 + Math.sin(radians) * 80;
      const x2 = 100 + Math.cos(radians) * 90;
      const y2 = 100 + Math.sin(radians) * 90;

      // Text position
      const textX = 100 + Math.cos(radians) * 70;
      const textY = 100 + Math.sin(radians) * 70;

      markers.push({
        hour,
        x1: x1.toFixed(2),
        y1: y1.toFixed(2),
        x2: x2.toFixed(2),
        y2: y2.toFixed(2),
        textX: textX.toFixed(2),
        textY: textY.toFixed(2),
        strokeWidth: hour % 6 === 0 ? 2 : 1,
        showLabel: hour % 6 === 0
      });
    }
    return markers;
  }

  /* -------------------------------------------- */

  /**
   * Format time for display
   * @param {number} hours - Hours (0-23)
   * @param {number} minutes - Minutes (0-59)
   * @returns {string} Formatted time string
   */
  #formatTime(hours, minutes) {
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  /* -------------------------------------------- */

  /**
   * Parse flexible time input string into hours and minutes.
   * Supports: "3p", "3pm", "3:30pm", "15:00", "3:30 PM", "15", etc.
   * @param {string} input - The time input string
   * @returns {{hours: number, minutes: number}|null} Parsed time or null if invalid
   */
  #parseTimeInput(input) {
    if (!input) return null;

    const str = input.trim().toLowerCase();
    if (!str) return null;

    // Check for AM/PM indicator
    const isPM = /p/.test(str);
    const isAM = /a/.test(str);

    // Remove AM/PM suffixes and clean up
    const cleaned = str.replace(/[ap]\.?m?\.?/gi, '').trim();

    let hours = 0;
    let minutes = 0;

    // Try HH:MM format
    if (cleaned.includes(':')) {
      const [h, m] = cleaned.split(':').map((s) => parseInt(s, 10));
      if (isNaN(h)) return null;
      hours = h;
      minutes = isNaN(m) ? 0 : m;
    } else {
      // Just a number (hours only)
      const h = parseInt(cleaned, 10);
      if (isNaN(h)) return null;
      hours = h;
      minutes = 0;
    }

    // Apply AM/PM conversion
    if (isPM && hours < 12) hours += 12;
    else if (isAM && hours === 12) hours = 0;

    // Validate ranges
    if (hours < 0 || hours > 23) return null;
    if (minutes < 0 || minutes > 59) return null;

    return { hours, minutes };
  }

  /* -------------------------------------------- */

  /**
   * Convert time to angle in degrees
   * @param {number} hours - Hours (0-23)
   * @param {number} minutes - Minutes (0-59)
   * @returns {number} Angle in degrees (0 = top/noon, clockwise)
   */
  #timeToAngle(hours, minutes) {
    const totalMinutes = hours * 60 + minutes;
    let angle = (totalMinutes / (24 * 60)) * 360;
    // Adjust so noon (12:00) is at top (0°) instead of midnight
    angle = (angle + 180) % 360;
    return angle;
  }

  /* -------------------------------------------- */

  /**
   * Convert angle to time
   * @param {number} angle - Angle in degrees (0 = top/noon, clockwise)
   * @returns {Object} Object with hours and minutes
   */
  #angleToTime(angle) {
    // Normalize angle to 0-360
    angle = ((angle % 360) + 360) % 360;
    // Adjust for noon at top - reverse the transformation from timeToAngle
    angle = (angle - 180 + 360) % 360;
    const totalMinutes = Math.round((angle / 360) * (24 * 60));
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return { hours, minutes };
  }

  /* -------------------------------------------- */

  /**
   * Update the dial's visual rotation
   * @param {HTMLElement} dial - The dial element
   * @param {number} angle - Angle in degrees
   */
  #updateDialRotation(dial, angle) {
    const handleContainer = dial.querySelector('.dial-handle-container');
    const sky = dial.querySelector('.dial-sky');
    const sunContainer = dial.querySelector('.dial-sun');

    if (!handleContainer || !sky || !sunContainer) return;

    // Update time display (only if input not focused)
    const time = this.#angleToTime(angle);
    const timeDisplay = dial.querySelector('.dial-time');
    if (timeDisplay && document.activeElement !== timeDisplay) timeDisplay.value = this.#formatTime(time.hours, time.minutes);

    // Normalize angle to 0-360
    const normalizedAngle = ((angle % 360) + 360) % 360;

    // Calculate sun opacity with smooth fading
    // Sun fades in from 270° (6 AM), peaks at 0° (noon), fades out at 90° (6 PM)
    let sunOpacity;
    let adjustedAngle;

    if (normalizedAngle >= 270) adjustedAngle = normalizedAngle - 360;
    else if (normalizedAngle <= 90) adjustedAngle = normalizedAngle;
    else adjustedAngle = null;

    if (adjustedAngle !== null) {
      // Use cosine for smooth fade: cos(0°) = 1, cos(±90°) = 0
      const radians = (adjustedAngle * Math.PI) / 180;
      sunOpacity = Math.max(0, Math.cos(radians));
    } else {
      sunOpacity = 0;
    }

    // Calculate moon opacity with smooth fading (same logic as sun, but for moon position)
    const moonPosition = (normalizedAngle + 180) % 360;
    let moonAdjustedAngle;

    if (moonPosition >= 270) moonAdjustedAngle = moonPosition - 360;
    else if (moonPosition <= 90) moonAdjustedAngle = moonPosition;
    else moonAdjustedAngle = null;

    let moonOpacity;
    if (moonAdjustedAngle !== null) {
      // Use cosine for smooth fade: cos(0°) = 1, cos(±90°) = 0
      const radians = (moonAdjustedAngle * Math.PI) / 180;
      moonOpacity = Math.max(0, Math.cos(radians));
    } else {
      moonOpacity = 0;
    }

    // Apply horizon blocker - force opacity to 0 if below horizon (91° to 269°)
    const sunPosition = normalizedAngle;
    if (sunPosition >= 91 && sunPosition <= 269) sunOpacity = 0;
    if (moonPosition >= 91 && moonPosition <= 269) moonOpacity = 0;

    // Calculate day progress for sky brightness (0-2, adjusted so noon=0.5 brightest, midnight=1.5 darkest)
    const totalMinutes = time.hours * 60 + time.minutes;
    const dayProgress = ((totalMinutes / (24 * 60)) * 2 + 1.5) % 2;

    // Update CSS custom properties
    sky.style.setProperty('--calendar-day-progress', dayProgress);
    sky.style.setProperty('--calendar-night-progress', dayProgress);
    sky.style.setProperty('--sun-opacity', sunOpacity);
    sky.style.setProperty('--moon-opacity', moonOpacity);

    // Rotate sun/moon container to follow handle (sun at handle, moon opposite)
    // Subtract 90° because sun orb is positioned at "right" (90° in CSS coords)
    // Add 6° compensation for observed timing offset
    sunContainer.style.transform = `rotate(${angle - 84}deg)`;

    // Position the handle at the angle
    handleContainer.style.transform = `rotate(${angle}deg)`;

    // Store current time in state
    if (this._dialState) {
      this._dialState.currentHours = time.hours;
      this._dialState.currentMinutes = time.minutes;
    }
  }

  /* -------------------------------------------- */

  /**
   * Setup interaction handlers for the dial
   * @param {HTMLElement} dial - The dial element
   */
  #setupDialInteraction(dial) {
    const sky = dial.querySelector('.dial-sky');
    const backdrop = dial.querySelector('.dial-backdrop');
    const handle = dial.querySelector('.dial-handle');
    let isDragging = false;
    let initialAngle = 0;
    let initialMouseAngle = 0;

    const getAngleFromEvent = (event) => {
      const rect = sky.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const deltaX = event.clientX - centerX;
      const deltaY = event.clientY - centerY;
      let angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI + 90;
      return angle;
    };

    const onMouseDown = (event) => {
      if (event.button !== 0) return;
      isDragging = true;

      // Store the current dial angle and mouse angle at click time
      initialAngle = this.#timeToAngle(this._dialState.currentHours, this._dialState.currentMinutes);
      initialMouseAngle = getAngleFromEvent(event);

      handle.style.cursor = 'grabbing';
      event.preventDefault();
      event.stopPropagation();
    };

    const onMouseMove = (event) => {
      if (!isDragging) return;

      // Calculate the delta angle from where we clicked
      const currentMouseAngle = getAngleFromEvent(event);
      const deltaAngle = currentMouseAngle - initialMouseAngle;
      const newAngle = initialAngle + deltaAngle;

      this.#updateDialRotation(dial, newAngle);
      event.preventDefault();
    };

    const onMouseUp = async (event) => {
      if (!isDragging) return;
      isDragging = false;
      handle.style.cursor = 'grab';

      // Apply the time change
      await this.#applyTimeChange();
      event.preventDefault();
    };

    const onBackdropClick = () => {
      dial.remove();
    };

    // Time input handlers
    const timeInput = dial.querySelector('.dial-time');
    const applyTimeFromInput = async () => {
      const parsed = this.#parseTimeInput(timeInput.value);
      if (parsed) {
        // Update dial state
        this._dialState.currentHours = parsed.hours;
        this._dialState.currentMinutes = parsed.minutes;

        // Update dial rotation to match
        const newAngle = this.#timeToAngle(parsed.hours, parsed.minutes);
        this.#updateDialRotation(dial, newAngle);

        // Apply the time change
        await this.#applyTimeChange();
      } else {
        // Reset to current state if invalid
        timeInput.value = this.#formatTime(this._dialState.currentHours, this._dialState.currentMinutes);
      }
    };

    const onTimeInputKeydown = (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        timeInput.blur();
      } else if (event.key === 'Escape') {
        // Reset and blur without applying
        timeInput.value = this.#formatTime(this._dialState.currentHours, this._dialState.currentMinutes);
        timeInput.blur();
      }
    };

    const onTimeInputBlur = async () => {
      await applyTimeFromInput();
    };

    const onTimeInputFocus = () => {
      timeInput.select();
    };

    // Add event listeners - only handle can start dragging
    handle.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    backdrop.addEventListener('click', onBackdropClick);
    timeInput.addEventListener('keydown', onTimeInputKeydown);
    timeInput.addEventListener('blur', onTimeInputBlur);
    timeInput.addEventListener('focus', onTimeInputFocus);

    // Store cleanup function
    dial._cleanup = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }

  /* -------------------------------------------- */

  /**
   * Apply the time change to the calendar
   */
  async #applyTimeChange() {
    if (!this._dialState) return;

    const { currentHours, currentMinutes, initialTime } = this._dialState;

    // Calculate the new world time
    const currentDate = new Date(initialTime * 1000);
    currentDate.setUTCHours(currentHours, currentMinutes, 0, 0);
    const newWorldTime = Math.floor(currentDate.getTime() / 1000);

    // Calculate the time difference
    const timeDiff = newWorldTime - initialTime;

    if (timeDiff !== 0) {
      // Advance or rewind game time
      await game.time.advance(timeDiff);
      log(3, `Time adjusted by ${timeDiff} seconds to ${this.#formatTime(currentHours, currentMinutes)}`);
    }

    // Update state with the new current time as the baseline for next adjustment
    this._dialState.initialTime = newWorldTime;
  }

  /* -------------------------------------------- */

  /**
   * Reset the calendar position to default (centered horizontally).
   * @static
   */
  static resetPosition() {
    try {
      game.settings.set(MODULE.ID, SETTINGS.CALENDAR_POSITION, null);
      log(3, 'Calendar position reset to default');

      // If the calendar is currently rendered, center it on the viewport
      if (dnd5e?.ui?.calendar?.element) {
        const calendar = dnd5e.ui.calendar.element;
        const rect = calendar.getBoundingClientRect();

        // Center horizontally in the viewport
        const left = (window.innerWidth - rect.width) / 2;
        const top = 16;

        calendar.style.left = `${left}px`;
        calendar.style.top = `${top}px`;

        log(3, `Calendar centered at left: ${left}px, top: ${top}px`);
      }
    } catch (error) {
      log(1, 'Error resetting calendar position:', error);
    }
  }
}
