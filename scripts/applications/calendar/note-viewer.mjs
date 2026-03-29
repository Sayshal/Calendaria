/**
 * Note Viewer — standalone frameless note browser with filter sidebar.
 * @module Applications/NoteViewer
 * @author Tyler
 */

import { CalendarManager } from '../../calendar/_module.mjs';
import { DISPLAY_STYLES, HOOKS, MODULE, NOTE_VISIBILITY, SETTINGS, TEMPLATES } from '../../constants.mjs';
import { NoteManager, filterNotes, formatNoteDate, getAllPresets, getAvailableAuthors, getPresetOverrides } from '../../notes/_module.mjs';
import { canAddNotes, canDeleteNotes, canEditNotes, localize } from '../../utils/_module.mjs';

const { HandlebarsApplicationMixin, ApplicationV2 } = foundry.applications.api;
const ContextMenu = foundry.applications.ux.ContextMenu.implementation;

/** @type {number} Debounce delay for search input (ms). */
const SEARCH_DEBOUNCE = 200;
/** @type {number} Debounce delay for date range input (ms). */
const DATE_RANGE_DEBOUNCE = 300;

/** @type {number} Number of notes per render batch. */
const BATCH_SIZE = 50;
/** @type {number} Scroll threshold to trigger next batch (px). */
const SCROLL_THRESHOLD = 50;

/**
 * Note Viewer — browse, filter, and manage calendar notes.
 * @extends ApplicationV2
 */
export class NoteViewer extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @param {object} [options] - Constructor options */
  constructor(options = {}) {
    super(options);
    this._hooks = [];
    this._filterState = {
      search: '',
      presets: new Set(),
      visibility: 'all',
      sortBy: 'dateAsc',
      author: 'all',
      allDay: false,
      hasDuration: false,
      isRecurring: false,
      isFestival: false,
      dateRangeStart: null,
      dateRangeEnd: null
    };
    this._debouncedRefresh = foundry.utils.debounce(() => this.render(), 200);
    this._debouncedSearch = foundry.utils.debounce(() => this.#renderResults(), SEARCH_DEBOUNCE);
    this._debouncedDateRange = foundry.utils.debounce(() => this.render(), DATE_RANGE_DEBOUNCE);
    this._selectionMode = false;
    this._selectedIds = new Set();
    this._lastSelectedIndex = -1;
    this._allFilteredNotes = [];
    this._renderedCount = 0;
    this._loading = false;
    if (options.search) this._filterState.search = options.search;
    if (options.preset) this._filterState.presets.add(options.preset);
    if (options.visibility) this._filterState.visibility = options.visibility;
    if (options.date) this._applyDatePreFilter(options.date);
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-note-viewer',
    classes: ['calendaria', 'note-viewer'],
    tag: 'div',
    window: { frame: false, positioned: true },
    position: { width: 720, height: 600 },
    actions: {
      clearFilters: NoteViewer.#onClearFilters,
      clearSearch: NoteViewer.#onClearSearch,
      openNote: NoteViewer.#onOpenNote,
      closeViewer: NoteViewer.#onClose,
      createNote: NoteViewer.#onCreateNote,
      toggleSelectionMode: NoteViewer.#onToggleSelectionMode,
      bulkAction: NoteViewer.#onBulkAction
    }
  };

  /** @override */
  static PARTS = {
    search: { template: TEMPLATES.NOTE_VIEWER.SEARCH },
    filters: { template: TEMPLATES.NOTE_VIEWER.FILTERS },
    results: { template: TEMPLATES.NOTE_VIEWER.RESULTS },
    footer: { template: TEMPLATES.NOTE_VIEWER.FOOTER }
  };

  /** @override */
  get title() {
    return localize('CALENDARIA.NoteViewer.Title');
  }

  /**
   * Get singleton instance.
   * @returns {NoteViewer|undefined} The singleton instance
   */
  static get instance() {
    return foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
  }

  /**
   * Show the note viewer.
   * @param {object} [options] - Pre-filter options: { date, preset, search, visibility }
   * @returns {NoteViewer} The viewer instance
   */
  static show(options = {}) {
    let instance = this.instance;
    if (instance) {
      if (options.search) instance._filterState.search = options.search;
      if (options.preset) {
        instance._filterState.presets.clear();
        instance._filterState.presets.add(options.preset);
      }
      if (options.visibility) instance._filterState.visibility = options.visibility;
      if (options.date) instance._applyDatePreFilter(options.date);
    } else {
      instance = new NoteViewer(options);
    }
    instance.render({ force: true });
    return instance;
  }

  /** Hide the note viewer. */
  static hide() {
    this.instance?.close();
  }

  /** Toggle the note viewer. */
  static toggle() {
    if (this.instance?.rendered) this.hide();
    else this.show();
  }

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const isGM = game.user.isGM;
    const allNotes = NoteManager.getAllNotes();
    const activeId = CalendarManager.getActiveCalendar()?.metadata?.id;
    const eqCalendars = game.settings.get(MODULE.ID, SETTINGS.EQUIVALENT_DATE_CALENDARS);
    const calendarIds = activeId ? [activeId, ...eqCalendars] : [];
    const filteredNotes = filterNotes(allNotes, this._filterState, { isGM, calendarId: calendarIds.length ? calendarIds : undefined });
    this._allFilteredNotes = filteredNotes.map((stub) => this.#enrichNoteRow(stub));
    this._renderedCount = Math.min(BATCH_SIZE, this._allFilteredNotes.length);
    const calendarIdSet = new Set(calendarIds);
    context.notes = this._allFilteredNotes.slice(0, this._renderedCount);
    context.totalNotes = calendarIdSet.size ? allNotes.filter((n) => calendarIdSet.has(n.calendarId)).length : allNotes.length;
    context.shownCount = filteredNotes.length;
    context.hasActiveFilters = this.#hasActiveFilters();
    context.isGM = isGM;
    context.canAdd = canAddNotes();
    context.countTooltip = this.#buildCountTooltip(calendarIds);
    context.selectionMode = this._selectionMode;
    context.selectedCount = this._selectedIds.size;
    if (this._selectionMode) for (const note of context.notes) note.selected = this._selectedIds.has(note.id);
    context.searchValue = this._filterState.search;
    const presets = getAllPresets();
    context.presets = presets.map((p) => ({ id: p.id, label: localize(p.label), color: p.color, selected: this._filterState.presets.has(p.id) }));
    context.selectedNone = this._filterState.presets.has('__none__');
    context.visibility = this._filterState.visibility;
    context.sortBy = this._filterState.sortBy;
    context.author = this._filterState.author;
    context.allDay = this._filterState.allDay;
    context.hasDuration = this._filterState.hasDuration;
    context.isRecurring = this._filterState.isRecurring;
    context.isFestival = this._filterState.isFestival;
    if (isGM) {
      const authors = getAvailableAuthors(allNotes);
      context.authors = authors.map((a) => ({ ...a, selected: this._filterState.author === a.id }));
    }
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender(context, options);
    if (options.isFirstRender) {
      this.#centerPosition();
      this.#registerHooks();
    }
    this.#bindFilterListeners();
    this.#bindResultListeners();
    this.#bindSelectionListeners();
    this.#bindBulkListeners();
    this.#enableDragging();
    this.#enableBatchScroll();
    this.#setupContextMenu();
    this.#syncSelectAllCheckbox();
  }

  /** @override */
  async _onClose(options) {
    if (this._hooks) {
      this._hooks.forEach((hook) => Hooks.off(hook.name, hook.id));
      this._hooks = [];
    }
    await super._onClose(options);
  }

  /**
   * Apply a date pre-filter from API options.
   * @param {object} date - { year, month, day } (1-indexed month/day from API)
   */
  _applyDatePreFilter(date) {
    if (!date?.year || !date?.month || !date?.day) return;
    this._filterState.dateRangeStart = { year: date.year, month: date.month - 1, dayOfMonth: date.day - 1, hour: 0, minute: 0 };
    this._filterState.dateRangeEnd = { year: date.year, month: date.month - 1, dayOfMonth: date.day - 1, hour: 23, minute: 59 };
  }

  /**
   * Enrich a note stub into a display-ready row object.
   * @param {object} stub - Note stub
   * @returns {object} Enriched row data
   */
  #enrichNoteRow(stub) {
    const flagData = stub.flagData || {};
    const overrides = getPresetOverrides(flagData.categories);
    const visibility = overrides.visibility || flagData.visibility || NOTE_VISIBILITY.VISIBLE;
    const displayStyle = overrides.displayStyle || flagData.displayStyle || DISPLAY_STYLES.ICON;
    const allPresets = getAllPresets();
    const presetBadges = (flagData.categories || [])
      .slice(0, 4)
      .map((catId) => {
        const preset = allPresets.find((p) => p.id === catId);
        return preset ? { icon: preset.icon, color: preset.color, label: localize(preset.label) } : null;
      })
      .filter(Boolean);
    let repeatIcon = null;
    let repeatTooltip = null;
    if (flagData.conditionTree) {
      repeatIcon = 'fas fa-code-branch';
      repeatTooltip = localize('CALENDARIA.Notes.Repeat.Computed');
    } else if (flagData.repeat && flagData.repeat !== 'never') {
      const icons = { daily: 'fas fa-rotate', weekly: 'fas fa-rotate', monthly: 'fas fa-rotate', yearly: 'fas fa-rotate', moon: 'fas fa-moon' };
      repeatIcon = icons[flagData.repeat] || 'fas fa-rotate';
      repeatTooltip = localize(`CALENDARIA.Notes.Repeat.${flagData.repeat[0].toUpperCase()}${flagData.repeat.slice(1)}`);
    }
    return {
      id: stub.id,
      name: stub.name,
      dateLabel: formatNoteDate(stub),
      color: flagData.color || '#4a9eff',
      icon: flagData.icon || 'fas fa-calendar',
      visibility,
      displayStyle,
      presetId: (flagData.categories || [])[0] || '',
      presetBadges,
      isHidden: visibility === NOTE_VISIBILITY.HIDDEN,
      isSecret: visibility === NOTE_VISIBILITY.SECRET,
      isFestival: !!flagData.linkedFestival,
      hasDuration: flagData.hasDuration && flagData.duration > 1,
      isRecurring: !!flagData.conditionTree || (flagData.repeat && flagData.repeat !== 'never'),
      repeatIcon,
      repeatTooltip,
      selected: false,
      selectionMode: this._selectionMode
    };
  }

  /**
   * Check if any filter is active.
   * @returns {boolean} Whether any filter is active
   */
  #hasActiveFilters() {
    const s = this._filterState;
    return (
      s.search.length > 0 ||
      s.presets.size > 0 ||
      s.visibility !== 'all' ||
      s.author !== 'all' ||
      s.hasDuration ||
      s.isRecurring ||
      s.isFestival ||
      s.allDay ||
      s.dateRangeStart !== null ||
      s.dateRangeEnd !== null
    );
  }

  /** Re-render only results and footer parts (preserves filter sidebar state). */
  async #renderResults() {
    await this.render({ parts: ['results', 'footer'] });
    const btn = this.element?.querySelector('.clear-filters-btn');
    if (btn) btn.style.display = this.#hasActiveFilters() ? '' : 'none';
    else if (this.#hasActiveFilters()) {
      const filtersEl = this.element?.querySelector('.note-viewer-filters');
      if (filtersEl && !filtersEl.querySelector('.clear-filters-btn')) {
        const newBtn = document.createElement('button');
        newBtn.type = 'button';
        newBtn.className = 'clear-filters-btn';
        newBtn.dataset.action = 'clearFilters';
        newBtn.innerHTML = `<i class="fas fa-filter-circle-xmark"></i> ${localize('CALENDARIA.NoteViewer.ClearFilters')}`;
        filtersEl.appendChild(newBtn);
      }
    }
  }

  /**
   * Build a tooltip explaining what the note count represents.
   * @param {string[]} calendarIds - Calendar IDs included in the count
   * @returns {string} Tooltip text
   */
  #buildCountTooltip(calendarIds) {
    const parts = [];
    const names = calendarIds
      .map((id) => CalendarManager.getCalendar(id)?.name)
      .filter(Boolean)
      .map((n) => localize(n));
    if (names.length) parts.push(localize('CALENDARIA.NoteViewer.TooltipCalendar').replace('{name}', names.join(', ')));
    if (!game.user.isGM) parts.push(localize('CALENDARIA.NoteViewer.TooltipPlayerVisibility'));
    if (this.#hasActiveFilters()) parts.push(localize('CALENDARIA.NoteViewer.TooltipFiltersActive'));
    return parts.join('\n') || '';
  }

  /** Center the window on first render. */
  #centerPosition() {
    const { width, height } = this.position;
    const left = (window.innerWidth - (width || 720)) / 2;
    const top = (window.innerHeight - (height || 600)) / 2;
    this.setPosition({ left, top });
  }

  /** Enable dragging via the search bar header. */
  #enableDragging() {
    const dragHandle = this.element?.querySelector('.note-viewer-search');
    if (!dragHandle) return;
    const drag = new foundry.applications.ux.Draggable.implementation(this, this.element, dragHandle, false);
    const originalMouseDown = drag._onDragMouseDown.bind(drag);
    drag._onDragMouseDown = (event) => {
      if (event.target.closest('button, a, input, select, [data-action]')) return;
      originalMouseDown(event);
    };
  }

  /** Enable scroll-based batch loading for the results list. */
  #enableBatchScroll() {
    const container = this.element?.querySelector('.note-viewer-results');
    if (!container) return;
    container.addEventListener('scroll', () => {
      if (this._loading) return;
      if (this._renderedCount >= this._allFilteredNotes.length) return;
      const { scrollTop, scrollHeight, clientHeight } = container;
      if (scrollHeight - scrollTop - clientHeight < SCROLL_THRESHOLD) {
        this.#loadNextBatch(container);
      }
    });
  }

  /**
   * Load and append the next batch of note rows.
   * @param {HTMLElement} container - The scroll container
   */
  async #loadNextBatch(container) {
    this._loading = true;
    const start = this._renderedCount;
    const end = Math.min(start + BATCH_SIZE, this._allFilteredNotes.length);
    const batch = this._allFilteredNotes.slice(start, end);
    if (this._selectionMode) {
      for (const note of batch) {
        note.selected = this._selectedIds.has(note.id);
        note.selectionMode = true;
      }
    }
    const parts = [];
    for (const note of batch) {
      const html = await foundry.applications.handlebars.renderTemplate(TEMPLATES.NOTE_VIEWER.ROW, note);
      parts.push(html);
    }
    const noteList = container.querySelector('.note-list');
    if (noteList) noteList.insertAdjacentHTML('beforeend', parts.join(''));
    this._renderedCount = end;
    this._loading = false;
  }

  /** Register hooks for live note updates. */
  #registerHooks() {
    const refresh = this._debouncedRefresh;
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
    this._hooks.push({ name: HOOKS.PRESETS_CHANGED, id: Hooks.on(HOOKS.PRESETS_CHANGED, () => refresh()) });
    this._hooks.push({ name: HOOKS.CALENDAR_SWITCHED, id: Hooks.on(HOOKS.CALENDAR_SWITCHED, () => refresh()) });
  }

  /** Bind change listeners for filter controls. */
  #bindFilterListeners() {
    const el = this.element;
    if (!el) return;
    const searchInput = el.querySelector('.note-viewer-search-input');
    searchInput?.addEventListener('input', (e) => {
      this._filterState.search = e.target.value;
      this._debouncedSearch();
    });
    const presetEl = el.querySelector('.filter-preset');
    if (presetEl) {
      const updatePresets = () => {
        const selected = Array.from(presetEl.querySelectorAll('.tag'))
          .map((t) => t.dataset.key)
          .filter(Boolean);
        this._filterState.presets = new Set(selected);
        this.#renderResults();
      };
      new MutationObserver(updatePresets).observe(presetEl, { childList: true, subtree: true });
    }
    const dropdowns = [
      { selector: '.filter-visibility', key: 'visibility' },
      { selector: '.filter-sort', key: 'sortBy' },
      { selector: '.filter-author', key: 'author' }
    ];
    for (const { selector, key } of dropdowns) {
      el.querySelector(selector)?.addEventListener('change', (e) => {
        this._filterState[key] = e.target.value;
        this.#renderResults();
      });
    }
    const checkboxes = [
      { selector: '.filter-has-duration', key: 'hasDuration' },
      { selector: '.filter-is-recurring', key: 'isRecurring' },
      { selector: '.filter-is-festival', key: 'isFestival' },
      { selector: '.filter-all-day', key: 'allDay' }
    ];
    for (const { selector, key } of checkboxes) {
      el.querySelector(selector)?.addEventListener('change', (e) => {
        this._filterState[key] = e.target.checked;
        this.#renderResults();
      });
    }
  }

  /** Bind click/double-click listeners on note rows. */
  #bindResultListeners() {
    const el = this.element;
    if (!el) return;
    let clickTimer = null;
    const noteList = el.querySelector('.note-list');
    noteList?.addEventListener('click', (e) => {
      if (this._selectionMode && e.target.closest('.note-select-checkbox')) return;
      const row = e.target.closest('.note-row');
      if (!row) return;
      if (this._selectionMode) return;
      const pageId = row.dataset.noteId;
      if (!pageId) return;
      if (clickTimer) clearTimeout(clickTimer);
      clickTimer = setTimeout(() => {
        clickTimer = null;
        const page = NoteManager.getFullNote(pageId);
        if (page) page.sheet.render(true, { mode: 'view' });
      }, 250);
    });
    noteList?.addEventListener('dblclick', (e) => {
      if (clickTimer) {
        clearTimeout(clickTimer);
        clickTimer = null;
      }
      if (this._selectionMode) return;
      const row = e.target.closest('.note-row');
      if (!row) return;
      const pageId = row.dataset.noteId;
      if (!pageId) return;
      if (!canEditNotes()) return;
      const page = NoteManager.getFullNote(pageId);
      if (page) page.sheet.render(true, { mode: 'edit' });
    });
  }

  /** Bind selection checkbox listeners. */
  #bindSelectionListeners() {
    const el = this.element;
    if (!el || !this._selectionMode) return;
    el.querySelector('.note-list')?.addEventListener('click', (e) => {
      const checkbox = e.target.closest('.note-select-checkbox');
      if (!checkbox) return;
      const row = checkbox.closest('.note-row');
      if (!row) return;
      const noteId = row.dataset.noteId;
      const rows = Array.from(el.querySelectorAll('.note-row'));
      const currentIndex = rows.indexOf(row);
      if (e.shiftKey && this._lastSelectedIndex >= 0) {
        const start = Math.min(this._lastSelectedIndex, currentIndex);
        const end = Math.max(this._lastSelectedIndex, currentIndex);
        for (let i = start; i <= end; i++) {
          const id = rows[i]?.dataset.noteId;
          if (id) {
            this._selectedIds.add(id);
            rows[i].classList.add('selected');
            const cb = rows[i].querySelector('.note-select-checkbox');
            if (cb) cb.checked = true;
          }
        }
      } else {
        if (this._selectedIds.has(noteId)) {
          this._selectedIds.delete(noteId);
          row.classList.remove('selected');
        } else {
          this._selectedIds.add(noteId);
          row.classList.add('selected');
        }
      }
      this._lastSelectedIndex = currentIndex;
      this.#updateSelectionCount();
      this.#syncSelectAllCheckbox();
    });
  }

  /** Bind bulk action footer listeners. */
  #bindBulkListeners() {
    const el = this.element;
    if (!el) return;
    const selectAllCb = el.querySelector('.select-all-checkbox');
    selectAllCb?.addEventListener('change', (e) => {
      if (e.target.checked) {
        for (const note of this._allFilteredNotes) this._selectedIds.add(note.id);
        el.querySelectorAll('.note-row').forEach((row) => {
          row.classList.add('selected');
          const cb = row.querySelector('.note-select-checkbox');
          if (cb) cb.checked = true;
        });
      } else {
        this._selectedIds.clear();
        el.querySelectorAll('.note-row').forEach((row) => {
          row.classList.remove('selected');
          const cb = row.querySelector('.note-select-checkbox');
          if (cb) cb.checked = false;
        });
      }
      this.#updateSelectionCount();
    });
  }

  /** Update the selection count display without full re-render. */
  #updateSelectionCount() {
    const countEl = this.element?.querySelector('.selection-count');
    if (countEl) countEl.textContent = this._selectedIds.size;
    const disabled = this._selectedIds.size === 0;
    this.element?.querySelectorAll('.bulk-btn').forEach((btn) => (btn.disabled = disabled));
  }

  /** Sync the select-all checkbox to reflect current selection state. */
  #syncSelectAllCheckbox() {
    const cb = this.element?.querySelector('.select-all-checkbox');
    if (!cb) return;
    const total = this._allFilteredNotes.length;
    const selected = this._selectedIds.size;
    if (selected === 0) {
      cb.checked = false;
      cb.indeterminate = false;
    } else if (selected >= total) {
      cb.checked = true;
      cb.indeterminate = false;
    } else {
      cb.checked = false;
      cb.indeterminate = true;
    }
  }

  /** Set up right-click context menu on note rows. */
  #setupContextMenu() {
    const el = this.element;
    if (!el) return;
    const isGM = game.user.isGM;
    new ContextMenu(el, '.note-row', [], {
      fixed: true,
      jQuery: false,
      onOpen: (target) => {
        const pageId = target.dataset.noteId;
        if (!pageId) return;
        const items = [
          {
            name: localize('CALENDARIA.Common.Open'),
            icon: '<i class="fas fa-eye"></i>',
            callback: () => {
              const page = NoteManager.getFullNote(pageId);
              if (page) page.sheet.render(true, { mode: 'view' });
            }
          }
        ];
        if (canEditNotes()) {
          items.push({
            name: localize('CALENDARIA.Common.Edit'),
            icon: '<i class="fas fa-edit"></i>',
            callback: () => {
              const page = NoteManager.getFullNote(pageId);
              if (page) page.sheet.render(true, { mode: 'edit' });
            }
          });
        }
        items.push({
          name: localize('CALENDARIA.NoteViewer.Context.JumpToDate'),
          icon: '<i class="fas fa-calendar-day"></i>',
          callback: () => {
            const stub = NoteManager.getNote(pageId);
            if (!stub?.flagData?.startDate) return;
            const { year, month, dayOfMonth } = stub.flagData.startDate;
            CALENDARIA.api.navigateToDate(year, month + 1, dayOfMonth + 1);
          }
        });
        if (isGM && canDeleteNotes()) {
          items.push({
            name: localize('CALENDARIA.Common.Delete'),
            icon: '<i class="fas fa-trash"></i>',
            callback: async () => {
              const stub = NoteManager.getNote(pageId);
              const confirmed = await foundry.applications.api.DialogV2.confirm({
                window: { title: localize('CALENDARIA.Common.DeleteNote') },
                content: `<p>${stub?.name || 'this note'}</p>`,
                yes: { default: false }
              });
              if (confirmed) await NoteManager.deleteNote(pageId);
            }
          });
        }
        if (canAddNotes()) {
          items.push({
            name: localize('CALENDARIA.Common.AddNote'),
            icon: '<i class="fas fa-plus"></i>',
            callback: () => NoteViewer.#onCreateNote()
          });
        }
        ui.context.menuItems = items;
      }
    });
  }

  /**
   * Clear all filters.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static #onClearFilters(_event, _target) {
    this._filterState = {
      search: '',
      presets: new Set(),
      visibility: 'all',
      sortBy: 'dateAsc',
      author: 'all',
      allDay: false,
      hasDuration: false,
      isRecurring: false,
      isFestival: false,
      dateRangeStart: null,
      dateRangeEnd: null
    };
    this.render();
  }

  /**
   * Clear the search input.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static #onClearSearch(_event, _target) {
    this._filterState.search = '';
    this.render();
  }

  /**
   * Open a note from action attribute.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static #onOpenNote(_event, target) {
    const pageId = target.closest('[data-note-id]')?.dataset.noteId;
    if (!pageId) return;
    const page = NoteManager.getFullNote(pageId);
    if (page) page.sheet.render(true, { mode: 'view' });
  }

  /**
   * Close the viewer.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onClose(_event, _target) {
    await this.close();
  }

  /**
   * Create a new note at the current date/time.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static async #onCreateNote(_event, _target) {
    const today = game.time.components;
    const calendar = CalendarManager.getActiveCalendar();
    const yearZero = calendar?.years?.yearZero ?? 0;
    await NoteManager.createNote({
      name: localize('CALENDARIA.Note.NewNote'),
      noteData: {
        startDate: { year: today.year + yearZero, month: today.month, dayOfMonth: today.dayOfMonth ?? 0, hour: today.hour ?? 0, minute: today.minute ?? 0 },
        endDate: { year: today.year + yearZero, month: today.month, dayOfMonth: today.dayOfMonth ?? 0, hour: (today.hour ?? 0) + 1, minute: today.minute ?? 0 }
      },
      source: 'ui'
    });
  }

  /**
   * Toggle selection mode.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} _target - The clicked element
   */
  static #onToggleSelectionMode(_event, _target) {
    this._selectionMode = !this._selectionMode;
    this._selectedIds.clear();
    this._lastSelectedIndex = -1;
    this.render();
  }

  /**
   * Execute selected bulk action.
   * @param {PointerEvent} _event - The click event
   * @param {HTMLElement} target - The clicked element
   */
  static async #onBulkAction(_event, target) {
    if (!game.user.isGM) return;
    const action = target.dataset.bulk;
    if (!action || this._selectedIds.size === 0) return;
    const ids = Array.from(this._selectedIds);
    let completed = false;
    switch (action) {
      case 'delete':
        completed = await this.#executeBulkDelete(ids);
        break;
      case 'preset':
        completed = await this.#executeBulkChangePreset(ids);
        break;
      case 'visibility':
        completed = await this.#executeBulkChangeVisibility(ids);
        break;
      case 'displayStyle':
        completed = await this.#executeBulkChangeDisplayStyle(ids);
        break;
    }
    if (!completed) return;
    this._selectionMode = false;
    this._selectedIds.clear();
    this._lastSelectedIndex = -1;
    this.render();
  }

  /**
   * Bulk delete selected notes.
   * @param {string[]} ids - Note page IDs
   * @returns {Promise<boolean>} Whether the operation completed
   */
  async #executeBulkDelete(ids) {
    const deletableIds = ids.filter((id) => {
      const stub = NoteManager.getNote(id);
      return !stub?.flagData?.linkedFestival;
    });
    const skipped = ids.length - deletableIds.length;
    const countLabel =
      skipped > 0
        ? `${localize('CALENDARIA.NoteViewer.BulkDeleteConfirm').replace('{count}', deletableIds.length)} (${skipped} festival notes skipped)`
        : localize('CALENDARIA.NoteViewer.BulkDeleteConfirm').replace('{count}', deletableIds.length);
    if (deletableIds.length === 0) {
      ui.notifications.warn(localize('CALENDARIA.NoteViewer.BulkDeleteAllFestivals'));
      return false;
    }
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: localize('CALENDARIA.NoteViewer.BulkDeleteTitle') },
      content: `<p>${countLabel}</p>`,
      yes: { default: false }
    });
    if (!confirmed) return false;
    let deleted = 0;
    for (const id of deletableIds) {
      try {
        await NoteManager.deleteNote(id);
        deleted++;
      } catch {}
    }
    if (deleted > 0) ui.notifications.info(localize('CALENDARIA.NoteViewer.BulkComplete').replace('{count}', deleted));
    return true;
  }

  /**
   * Bulk change preset for selected notes.
   * @param {string[]} ids - Note page IDs
   * @returns {Promise<boolean>} Whether the operation completed
   */
  async #executeBulkChangePreset(ids) {
    const presets = getAllPresets();
    const options = presets.map((p) => `<option value="${p.id}">${localize(p.label)}</option>`).join('');
    const content = `<div class="form-group"><label>${localize('CALENDARIA.NoteViewer.Filter.Preset')}</label><select id="bulk-preset-select">${options}</select></div>`;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: localize('CALENDARIA.NoteViewer.BulkAction.ChangePreset') },
      content,
      ok: { callback: (_event, button, _dialog) => button.form.elements['bulk-preset-select']?.value }
    });
    if (!result) return false;

    const updates = ids.map((id) => NoteManager.updateNote(id, { noteData: { categories: [result] } }));
    await Promise.allSettled(updates);
    ui.notifications.info(localize('CALENDARIA.NoteViewer.BulkComplete').replace('{count}', ids.length));
    return true;
  }

  /**
   * Bulk change visibility for selected notes.
   * @param {string[]} ids - Note page IDs
   * @returns {Promise<boolean>} Whether the operation completed
   */
  async #executeBulkChangeVisibility(ids) {
    const content = `<div class="form-group"><label>${localize('CALENDARIA.Common.Visibility')}</label>
      <select id="bulk-visibility-select">
        <option value="visible">${localize('CALENDARIA.Note.Visibility.Visible')}</option>
        <option value="hidden">${localize('CALENDARIA.Common.Hidden')}</option>
        <option value="secret">${localize('CALENDARIA.Note.Visibility.Secret')}</option>
      </select></div>`;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: localize('CALENDARIA.NoteViewer.BulkAction.ChangeVisibility') },
      content,
      ok: { callback: (_event, button, _dialog) => button.form.elements['bulk-visibility-select']?.value }
    });
    if (!result) return false;
    const updates = ids.map((id) => NoteManager.updateNote(id, { noteData: { visibility: result } }));
    await Promise.allSettled(updates);
    ui.notifications.info(localize('CALENDARIA.NoteViewer.BulkComplete').replace('{count}', ids.length));
    return true;
  }

  /**
   * Bulk change display style for selected notes.
   * @param {string[]} ids - Note page IDs
   * @returns {Promise<boolean>} Whether the operation completed
   */
  async #executeBulkChangeDisplayStyle(ids) {
    const content = `<div class="form-group"><label>${localize('CALENDARIA.Note.DisplayStyleLabel')}</label>
      <select id="bulk-style-select">
        <option value="icon">${localize('CALENDARIA.Common.Icon')}</option>
        <option value="pip">${localize('CALENDARIA.Note.DisplayStyle.Pip')}</option>
        <option value="banner">${localize('CALENDARIA.Note.DisplayStyle.Banner')}</option>
      </select></div>`;
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: localize('CALENDARIA.NoteViewer.BulkAction.ChangeDisplayStyle') },
      content,
      ok: { callback: (_event, button, _dialog) => button.form.elements['bulk-style-select']?.value }
    });
    if (!result) return false;
    const updates = ids.map((id) => NoteManager.updateNote(id, { noteData: { displayStyle: result } }));
    await Promise.allSettled(updates);
    ui.notifications.info(localize('CALENDARIA.NoteViewer.BulkComplete').replace('{count}', ids.length));
    return true;
  }
}
