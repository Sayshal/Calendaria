/**
 * Chronicle View — a vertical scrolling chronicle of calendar events.
 * @module Applications/Chronicle
 * @author Tyler
 */

import { HOOKS, MODULE, SETTINGS, SOCKET_TYPES, TEMPLATES } from '../../constants.mjs';
import { NoteManager, addDays } from '../../notes/_module.mjs';
import { CalendariaSocket, buildOpenAppsMenuItem, buildScrollEntries, canViewChronicle, getDefaultDateRange, isCombatBlocked, localize, warnShowToAll } from '../../utils/_module.mjs';
import { SettingsPanel } from '../_module.mjs';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;

/** @type {number} Days to load per batch when infinite-scrolling. */
const BATCH_DAYS = 30;

/** @type {number} Pixel threshold from top/bottom edge to trigger loading more entries. */
const SCROLL_THRESHOLD = 200;

/**
 * Chronicle — chronicle-style calendar viewer with infinite scroll.
 * @extends ApplicationV2
 */
export class Chronicle extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @param {object} [options] - Constructor options */
  constructor(options = {}) {
    super(options);
    this._startDate = options.startDate || null;
    this._endDate = options.endDate || null;
    this._calendarId = options.calendarId || null;
    this._entryDepth = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_ENTRY_DEPTH) || 'excerpt';
    this._showEmpty = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_SHOW_EMPTY) || false;
    this._viewMode = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_VIEW_MODE) || 'scroll';
    this._hooks = [];
    this._entries = [];
    this._loading = false;
    this._debouncedRefresh = foundry.utils.debounce(() => this.render(), 200);
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-chronicle',
    classes: ['calendaria', 'chronicle'],
    tag: 'div',
    window: { frame: false, positioned: true },
    position: { width: 480, height: 700 },
    actions: {
      today: Chronicle.#onToday,
      toggleEmptyDays: Chronicle.#onToggleEmptyDays,
      openNote: Chronicle.#onOpenNote,
      addNote: Chronicle.#onAddNote,
      expandEntry: Chronicle.#onExpandEntry,
      collapseEntry: Chronicle.#onCollapseEntry,
      closeScroll: Chronicle.#onClose
    }
  };

  /** @override */
  static PARTS = {
    toolbar: { template: TEMPLATES.CHRONICLE },
    scroll: { template: TEMPLATES.CHRONICLE_CONTENT }
  };

  /** @override */
  get title() {
    return localize('CALENDARIA.Chronicle.Title');
  }

  /**
   * Get singleton instance from Foundry registry.
   * @returns {Chronicle|undefined} The singleton instance
   */
  static get instance() {
    return foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
  }

  /**
   * Show the chronicle.
   * @param {object} [options] - Options { startDate, endDate, calendarId, theme }
   * @returns {Chronicle} The chronicle instance
   */
  static show(options = {}) {
    if (!canViewChronicle()) {
      if (!options.silent) ui.notifications.warn('CALENDARIA.Permissions.NoAccess', { localize: true });
      return null;
    }
    if (isCombatBlocked(SETTINGS.CHRONICLE_COMBAT_MODE)) return null;
    const instance = this.instance ?? new Chronicle(options);
    if (options.startDate) instance._startDate = options.startDate;
    if (options.endDate) instance._endDate = options.endDate;
    if (options.calendarId) instance._calendarId = options.calendarId;
    instance.render({ force: true });
    return instance;
  }

  /** Hide the chronicle. */
  static hide() {
    this.instance?.close();
  }

  /** Toggle the chronicle. */
  static toggle() {
    if (this.instance?.rendered) this.hide();
    else this.show();
  }

  /** @override */
  bringToFront() {
    if (!this.element) return;
    this.position.zIndex = ++ApplicationV2._maxZ;
    this.element.style.zIndex = String(this.position.zIndex);
    ui.activeWindow = this;
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    if (!this._startDate || !this._endDate) {
      const defaults = getDefaultDateRange(this._calendarId);
      this._startDate = defaults.startDate;
      this._endDate = defaults.endDate;
    }
    this._entries = buildScrollEntries(this._startDate, this._endDate, {
      calendarId: this._calendarId,
      showEmpty: this._showEmpty,
      entryDepth: this._entryDepth
    });
    const isGM = game.user.isGM;
    for (const entry of this._entries) {
      if (!entry.notes) continue;
      for (const note of entry.notes) if (note.content) note.content = await foundry.applications.ux.TextEditor.implementation.enrichHTML(note.content);
    }
    context.entries = this._entries.map((e) => ({ ...e, isGM }));
    context.entryDepth = this._entryDepth;
    context.showEmpty = this._showEmpty;
    context.hasEntries = this._entries.length > 0;
    context.isGM = game.user.isGM;
    context.depths = [
      { id: 'title', label: localize('CALENDARIA.Chronicle.Depth.Title'), active: this._entryDepth === 'title' },
      { id: 'excerpt', label: localize('CALENDARIA.Chronicle.Depth.Excerpt'), active: this._entryDepth === 'excerpt' },
      { id: 'full', label: localize('CALENDARIA.Common.Full'), active: this._entryDepth === 'full' }
    ];
    context.viewMode = this._viewMode;
    context.viewModes = [
      { id: 'scroll', label: localize('CALENDARIA.Chronicle.ViewMode.Scroll'), active: this._viewMode === 'scroll' },
      { id: 'timeline', label: localize('CALENDARIA.Chronicle.ViewMode.Timeline'), active: this._viewMode === 'timeline' }
    ];
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    this.element.dataset.depth = this._entryDepth;
    this.element.classList.remove('chronicle--scroll', 'chronicle--timeline');
    this.element.classList.add(`chronicle--${this._viewMode}`);
    this.setPosition({ width: this._viewMode === 'timeline' ? 680 : 480 });
    if (options.isFirstRender) {
      this.#restorePosition();
      this.#initContextMenu();
    }
    this.#registerHooks();
    this.#bindSelectListeners();
    this.#enableDragging();
    this._loading = true;
    this.#enableInfiniteScroll();
    if (this._restoreScrollTop != null) {
      const container = this.element?.querySelector('.scroll-container');
      if (container) container.scrollTop = this._restoreScrollTop;
      this._restoreScrollTop = null;
    } else if (this._scrollToToday) {
      this.#scrollToToday();
      this._scrollToToday = false;
    }
    requestAnimationFrame(() => {
      this._loading = false;
      const container = this.element?.querySelector('.scroll-container');
      if (container && container.scrollHeight <= container.clientHeight) this.#loadEarlier(container);
    });
  }

  /** @override */
  async _onClose(options) {
    if (this._hooks) {
      this._hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
      this._hooks = [];
    }
    await super._onClose(options);
  }

  /** Register hooks for live updates. */
  #registerHooks() {
    if (this._hooks.length) {
      this._hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
      this._hooks = [];
    }
    const refresh = this._debouncedRefresh;
    const scrollSettingKeys = new Set([
      SETTINGS.CHRONICLE_ENTRY_DEPTH,
      SETTINGS.CHRONICLE_SHOW_EMPTY,
      SETTINGS.CHRONICLE_SHOW_WEATHER,
      SETTINGS.CHRONICLE_SHOW_MOON_PHASES,
      SETTINGS.CHRONICLE_SHOW_SEASON_CHANGES,
      SETTINGS.CHRONICLE_VIEW_MODE
    ]);
    this._hooks.push({
      name: 'updateSetting',
      id: Hooks.on('updateSetting', (setting) => {
        if (setting.key?.startsWith(`${MODULE.ID}.`) && scrollSettingKeys.has(setting.key.replace(`${MODULE.ID}.`, ''))) {
          this._entryDepth = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_ENTRY_DEPTH);
          this._showEmpty = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_SHOW_EMPTY);
          this._viewMode = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_VIEW_MODE);
          refresh();
        }
      })
    });
    this._hooks.push({
      name: 'createJournalEntry',
      id: Hooks.on('createJournalEntry', (journal) => {
        if (journal.getFlag?.(MODULE.ID, 'isCalendarNote')) refresh();
      })
    });
    this._hooks.push({
      name: 'createJournalEntryPage',
      id: Hooks.on('createJournalEntryPage', (page) => {
        if (page.type === 'calendaria.calendarnote') refresh();
      })
    });
    this._hooks.push({
      name: 'updateJournalEntryPage',
      id: Hooks.on('updateJournalEntryPage', (page) => {
        if (page.type === 'calendaria.calendarnote') refresh();
      })
    });
    this._hooks.push({
      name: 'updateJournalEntry',
      id: Hooks.on('updateJournalEntry', (journal, changes) => {
        if (changes.ownership && journal.getFlag?.(MODULE.ID, 'isCalendarNote')) refresh();
      })
    });
    this._hooks.push({
      name: 'deleteJournalEntry',
      id: Hooks.on('deleteJournalEntry', (journal) => {
        if (journal.getFlag?.(MODULE.ID, 'isCalendarNote') || journal.pages.some((p) => p.type === 'calendaria.calendarnote')) refresh();
      })
    });
    this._hooks.push({ name: HOOKS.WEATHER_CHANGE, id: Hooks.on(HOOKS.WEATHER_CHANGE, () => refresh()) });
    this._hooks.push({ name: HOOKS.DAY_CHANGE, id: Hooks.on(HOOKS.DAY_CHANGE, () => refresh()) });
    this._hooks.push({ name: HOOKS.FOG_RANGE_CHANGED, id: Hooks.on(HOOKS.FOG_RANGE_CHANGED, () => refresh()) });
    this._hooks.push({ name: HOOKS.CALENDAR_UPDATED, id: Hooks.on(HOOKS.CALENDAR_UPDATED, () => refresh()) });
    this._hooks.push({ name: HOOKS.CALENDAR_SWITCHED, id: Hooks.on(HOOKS.CALENDAR_SWITCHED, () => refresh()) });
  }

  /** Bind change listeners for toolbar select elements. */
  #bindSelectListeners() {
    const el = this.element;
    if (!el) return;
    el.querySelector('.depth-select')?.addEventListener('change', async (e) => {
      this._entryDepth = e.target.value;
      this._restoreScrollTop = this.element?.querySelector('.scroll-container')?.scrollTop ?? null;
      await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_ENTRY_DEPTH, this._entryDepth);
      await this.render();
    });
    el.querySelector('.view-mode-select')?.addEventListener('change', async (e) => {
      this._viewMode = e.target.value;
      this._restoreScrollTop = this.element?.querySelector('.scroll-container')?.scrollTop ?? null;
      await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_VIEW_MODE, this._viewMode);
      await this.render();
    });
  }

  /** Restore saved position or default to center-screen. */
  #restorePosition() {
    const saved = game.settings.get(MODULE.ID, SETTINGS.CHRONICLE_POSITION);
    if (saved && Number.isFinite(saved.top) && Number.isFinite(saved.left)) {
      this.setPosition({ left: saved.left, top: saved.top });
    } else {
      const { width, height } = this.position;
      const left = (window.innerWidth - (width || 480)) / 2;
      const top = (window.innerHeight - (height || 700)) / 2;
      this.setPosition({ left, top });
    }
  }

  /** Initialize the right-click context menu on the toolbar. */
  #initContextMenu() {
    new foundry.applications.ux.ContextMenu.implementation(this.element, '.scroll-toolbar', this.#getContextMenuItems(), {
      fixed: true,
      jQuery: false,
      onOpen: () => document.getElementById('context-menu')?.classList.add('calendaria')
    });
  }

  /**
   * Build context menu items for the Chronicle toolbar.
   * @returns {object[]} Context menu item definitions
   */
  #getContextMenuItems() {
    const items = [];
    items.push({
      name: 'CALENDARIA.Chronicle.ContextMenu.Settings',
      icon: '<i class="fas fa-gear"></i>',
      callback: () => {
        const panel = new SettingsPanel();
        panel.render(true).then(() => {
          requestAnimationFrame(() => panel.changeTab('chronicle', 'primary'));
        });
      }
    });
    items.push(buildOpenAppsMenuItem());
    if (game.user.isGM) {
      const forceChronicle = game.settings.get(MODULE.ID, SETTINGS.FORCE_CHRONICLE);
      items.push({
        name: forceChronicle ? 'CALENDARIA.Common.HideFromAll' : 'CALENDARIA.Common.ShowToAll',
        icon: `<i class="fas fa-${forceChronicle ? 'eye-slash' : 'eye'}"></i>`,
        callback: async () => {
          const newValue = !forceChronicle;
          if (newValue) warnShowToAll('viewChronicle', game.i18n.localize('CALENDARIA.Permissions.ViewChronicle'));
          await game.settings.set(MODULE.ID, SETTINGS.FORCE_CHRONICLE, newValue);
          CalendariaSocket.emit(SOCKET_TYPES.CHRONICLE_VISIBILITY, { visible: newValue });
        }
      });
    }
    items.push({ name: 'CALENDARIA.Common.Close', icon: '<i class="fas fa-times"></i>', callback: () => this.close() });
    return items;
  }

  /** Enable header-based dragging for the frameless window. */
  #enableDragging() {
    const dragHandle = this.element?.querySelector('.scroll-toolbar');
    if (!dragHandle) return;
    const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, dragHandle, false);
    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
      if (event.target.closest('button, a, input, select, [data-action]')) return;
      originalMouseDown(event);
    };
    const originalMouseUp = drag._onDragMouseUp.bind(drag);
    drag._onDragMouseUp = (event) => {
      originalMouseUp(event);
      const { left, top } = this.position;
      game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_POSITION, { left, top });
    };
  }

  /** Set up infinite scroll — load more entries when near top/bottom edges. */
  #enableInfiniteScroll() {
    const container = this.element?.querySelector('.scroll-container');
    if (!container) return;
    container.addEventListener('scroll', () => {
      if (this._loading) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollTop < SCROLL_THRESHOLD) this.#loadEarlier(container);
      else if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD) this.#loadLater(container);
    });
  }

  /** Scroll to the today entry if it exists. */
  #scrollToToday() {
    const container = this.element?.querySelector('.scroll-container');
    const today = container?.querySelector('.scroll-entry--today, .timeline-entry--today');
    if (container && today) container.scrollTop = today.offsetTop - container.offsetTop;
  }

  /**
   * Load earlier entries and prepend to scroll. Retries through empty ranges up to MAX_EMPTY_RETRIES.
   * @param {HTMLElement} container - The scroll container element
   * @param {number} [retries] - Current retry count
   */
  async #loadEarlier(container, retries = 0) {
    this._loading = true;
    const prevScrollHeight = container.scrollHeight;
    const newEnd = addDays(this._startDate, -1);
    const newStart = addDays(this._startDate, -BATCH_DAYS);
    this._startDate = newStart;
    const batch = buildScrollEntries(newStart, newEnd, {
      calendarId: this._calendarId,
      showEmpty: this._showEmpty,
      entryDepth: this._entryDepth
    });
    if (batch.length > 0) {
      this._entries = [...batch, ...this._entries];
      const entryHtml = await this.#renderEntryBatch(batch);
      const scrollContent = container.querySelector('.scroll-entries, .timeline-entries') || container;
      scrollContent.insertAdjacentHTML('afterbegin', entryHtml);
      container.scrollTop = container.scrollHeight - prevScrollHeight + container.scrollTop;
      this._loading = false;
    } else if (retries < 12) {
      await this.#loadEarlier(container, retries + 1);
    } else {
      this._loading = false;
    }
  }

  /**
   * Load later entries and append to scroll. Retries through empty ranges up to MAX_EMPTY_RETRIES.
   * @param {HTMLElement} container - The scroll container element
   * @param {number} [retries] - Current retry count
   */
  async #loadLater(container, retries = 0) {
    this._loading = true;
    const newStart = addDays(this._endDate, 1);
    const newEnd = addDays(this._endDate, BATCH_DAYS);
    this._endDate = newEnd;
    const batch = buildScrollEntries(newStart, newEnd, {
      calendarId: this._calendarId,
      showEmpty: this._showEmpty,
      entryDepth: this._entryDepth
    });
    if (batch.length > 0) {
      this._entries = [...this._entries, ...batch];
      const entryHtml = await this.#renderEntryBatch(batch);
      const scrollContent = container.querySelector('.scroll-entries, .timeline-entries') || container;
      scrollContent.insertAdjacentHTML('beforeend', entryHtml);
      this._loading = false;
    } else if (retries < 12) {
      await this.#loadLater(container, retries + 1);
    } else {
      this._loading = false;
    }
  }

  /**
   * Render a batch of entries to HTML using the entry partial.
   * @param {object[]} entries - Array of entry objects to render
   * @returns {Promise<string>} Combined HTML string
   */
  async #renderEntryBatch(entries) {
    const template = this._viewMode === 'timeline' ? TEMPLATES.CHRONICLE_TIMELINE_ENTRY : TEMPLATES.CHRONICLE_ENTRY;
    for (const entry of entries) {
      if (!entry.notes) continue;
      for (const note of entry.notes) if (note.content) note.content = await foundry.applications.ux.TextEditor.implementation.enrichHTML(note.content);
    }
    const parts = [];
    for (const entry of entries) {
      const html = await foundry.applications.handlebars.renderTemplate(template, { ...entry, isGM: game.user.isGM });
      parts.push(html);
    }
    return parts.join('');
  }

  /**
   * Toggle empty day display.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onToggleEmptyDays(_event, _target) {
    this._showEmpty = !this._showEmpty;
    await game.settings.set(MODULE.ID, SETTINGS.CHRONICLE_SHOW_EMPTY, this._showEmpty);
    await this.render();
  }

  /**
   * Open a note's page in view mode.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static #onOpenNote(_event, target) {
    const pageId = target.dataset.noteId;
    if (!pageId) return;
    const page = NoteManager.getFullNote(pageId);
    if (page) page.sheet.render(true, { mode: 'view' });
  }

  /**
   * Add a new note for a specific date.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onAddNote(_event, target) {
    const year = parseInt(target.dataset.year);
    const month = parseInt(target.dataset.month);
    const dayOfMonth = parseInt(target.dataset.day);
    if (isNaN(year) || isNaN(month) || isNaN(dayOfMonth)) return;
    await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: { startDate: { year, month, dayOfMonth, hour: 12, minute: 0 }, endDate: { year, month, dayOfMonth, hour: 13, minute: 0 } },
      source: 'ui'
    });
  }

  /**
   * Expand a collapsible entry.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static #onExpandEntry(_event, target) {
    const entry = target.closest('.scroll-entry, .timeline-entry');
    entry?.classList.add('expanded');
  }

  /**
   * Collapse a collapsible entry.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static #onCollapseEntry(_event, target) {
    const entry = target.closest('.scroll-entry, .timeline-entry');
    entry?.classList.remove('expanded');
  }

  /**
   * Jump to today — reset range and scroll to today entry.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onToday(_event, _target) {
    const defaults = getDefaultDateRange(this._calendarId);
    this._startDate = defaults.startDate;
    this._endDate = defaults.endDate;
    this._scrollToToday = true;
    await this.render();
  }

  /**
   * Close the scroll.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onClose(_event, _target) {
    await this.close();
  }
}
