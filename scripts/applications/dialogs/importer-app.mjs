/**
 * Importer Application
 * AppV2 dialog for importing calendars from external sources.
 * @module Applications/ImporterApp
 * @author Tyler
 */

import { TEMPLATES } from '../../constants.mjs';
import { createImporter, getImporterOptions } from '../../importers/_module.mjs';
import { format } from '../../utils/localization.mjs';
import { log } from '../../utils/logger.mjs';
import { CalendarEditor } from '../calendar/calendar-editor.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Calendar Importer Application.
 * Provides UI for selecting an import source, loading data, previewing, and importing.
 */
export class ImporterApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-importer',
    classes: ['calendaria', 'importer-app', 'standard-form'],
    tag: 'form',
    window: { icon: 'fas fa-file-import', title: 'CALENDARIA.Importer.Title', resizable: false },
    position: { width: 700, height: 'auto' },
    form: { handler: ImporterApp.#onSubmit, submitOnChange: false, closeOnSubmit: false },
    actions: {
      uploadFile: ImporterApp.#onUploadFile,
      importFromModule: ImporterApp.#onImportFromModule,
      clearData: ImporterApp.#onClearData,
      setAllNoteTypes: ImporterApp.#onSetAllNoteTypes
    }
  };

  /** @override */
  static PARTS = { form: { template: TEMPLATES.IMPORTER.APP, scrollable: [''] } };

  /** @type {string|null} Currently selected importer ID */
  #selectedImporterId = null;

  /** @type {object|null} Raw data from source */
  #rawData = null;

  /** @type {object|null} Transformed calendar data */
  #transformedData = null;

  /** @type {object|null} Preview summary */
  #previewData = null;

  /** @type {string|null} Suggested calendar ID */
  #suggestedId = null;

  /** @type {string|null} Error message to display */
  #errorMessage = null;

  /** @type {boolean} Whether import is in progress */
  #importing = false;

  /** @type {object[]|null} Extracted notes for selection UI */
  #extractedNotes = null;

  /** @type {string|null} Name of loaded file */
  #loadedFileName = null;

  /** @type {boolean} Whether data was loaded from module */
  #loadedFromModule = false;

  /** @type {Array<{name: string, index: number}>|null} Available source calendars for selection */
  #sourceCalendars = null;

  /** @type {number} Currently selected calendar index */
  #selectedCalendarIndex = 0;

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const importers = getImporterOptions();
    context.importers = importers;
    context.hasImporters = importers.length > 0;
    context.selectedImporterId = this.#selectedImporterId;
    context.selectedImporter = importers.find((i) => i.value === this.#selectedImporterId);
    context.hasData = !!this.#transformedData;
    context.previewData = this.#previewData;
    context.suggestedId = this.#suggestedId;
    context.errorMessage = this.#errorMessage;
    context.importing = this.#importing;
    context.extractedNotes = this.#extractedNotes || [];
    context.loadedFileName = this.#loadedFileName;
    context.loadedFromModule = this.#loadedFromModule;
    context.sourceCalendars = this.#sourceCalendars?.map((cal, i) => ({ ...cal, selected: i === this.#selectedCalendarIndex })) || null;
    if (context.selectedImporter) {
      context.canUpload = context.selectedImporter.supportsFileUpload;
      context.canImportFromModule = context.selectedImporter.supportsLiveImport && context.selectedImporter.detected;
      context.fileExtensions = this.#getSelectedImporter()?.constructor.fileExtensions?.join(',') || '.json';
    }
    context.buttons = [{ type: 'submit', icon: 'fas fa-file-import', label: 'CALENDARIA.Importer.Import', disabled: !context.hasData || this.#importing }];
    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);
    const sourceSelect = this.element.querySelector('select[name="importerId"]');
    if (sourceSelect) sourceSelect.addEventListener('change', this.#onSourceChange.bind(this));
    const dropZone = this.element.querySelector('.file-upload-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', this.#onDragOver.bind(this));
      dropZone.addEventListener('dragleave', this.#onDragLeave.bind(this));
      dropZone.addEventListener('drop', this.#onDrop.bind(this));
    }
    const fileInput = this.element.querySelector('input[type="file"]');
    if (fileInput) fileInput.addEventListener('change', this.#onFileSelected.bind(this));
    const calendarSelect = this.element.querySelector('select[name="sourceCalendarIndex"]');
    if (calendarSelect) calendarSelect.addEventListener('change', this.#onCalendarChoice.bind(this));
  }

  /**
   * Get the currently selected importer instance.
   * @returns {object|null} - Importer instance or null
   */
  #getSelectedImporter() {
    if (!this.#selectedImporterId) return null;
    return createImporter(this.#selectedImporterId);
  }

  /**
   * Process loaded data through the importer.
   * @param {object} data - Raw source data
   */
  async #processData(data) {
    const importer = this.#getSelectedImporter();
    if (!importer) return;
    this.#errorMessage = null;
    try {
      this.#rawData = data;
      const choices = importer.getCalendarChoices(data);
      if (choices && choices.length > 1) this.#sourceCalendars = choices;
      this.#transformedData = await importer.transform(data, this.#selectedCalendarIndex);
      const validation = importer.validate(this.#transformedData);
      if (!validation.valid) {
        this.#errorMessage = validation.errors.join('\n');
        this.#transformedData = null;
        this.#previewData = null;
        this.render();
        return;
      }
      this.#previewData = importer.getPreviewData(this.#rawData, this.#transformedData);
      this.#suggestedId = this.#generateId(this.#transformedData.name);
      const currentDate = importer.extractCurrentDate(this.#rawData, this.#selectedCalendarIndex);
      if (currentDate) {
        const month = (currentDate.month ?? 0) + 1;
        const day = (currentDate.dayOfMonth ?? 0) + 1;
        const year = currentDate.year ?? 1;
        this.#previewData.currentDate = `${month}/${day}/${year}`;
        this.#transformedData._pendingCurrentDate = currentDate;
      } else {
        this.#previewData.currentDate = '—';
      }
      this.#extractedNotes = await importer.extractNotes(this.#rawData);
      if (this.#extractedNotes) {
        this.#extractedNotes.forEach((note) => {
          const month = (note.startDate?.month ?? 0) + 1;
          const day = (note.startDate?.dayOfMonth ?? 0) + 1;
          note.displayDate = `${month}/${day}`;
        });
      }
      log(3, 'Import data processed successfully');
    } catch (error) {
      log(1, 'Error processing import data:', error);
      this.#errorMessage = error.message;
      this.#transformedData = null;
      this.#previewData = null;
    }
    this.render();
  }

  /**
   * Generate a suggested calendar ID from name.
   * @param {string} name - Calendar name
   * @returns {string} - Generated ID
   */
  #generateId(name) {
    if (!name) return `imported-${Date.now()}`;
    return name
      .toLowerCase()
      .replace(/[^\da-z]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 32);
  }

  /**
   * Clear all loaded data.
   */
  #clearData() {
    this.#rawData = null;
    this.#transformedData = null;
    this.#previewData = null;
    this.#suggestedId = null;
    this.#errorMessage = null;
    this.#extractedNotes = null;
    this.#loadedFileName = null;
    this.#loadedFromModule = false;
    this.#sourceCalendars = null;
    this.#selectedCalendarIndex = 0;
  }

  /**
   * Handle source selection change.
   * @param {Event} event - Change event
   */
  #onSourceChange(event) {
    const importerId = event.target.value;
    if (importerId !== this.#selectedImporterId) {
      this.#selectedImporterId = importerId || null;
      this.#clearData();
      this.render();
    }
  }

  /**
   * Handle calendar selection change (multi-calendar sources).
   * @param {Event} event - Change event
   */
  async #onCalendarChoice(event) {
    this.#selectedCalendarIndex = Number(event.target.value) || 0;
    if (this.#rawData) await this.#processData(this.#rawData);
  }

  /**
   * Handle dragover event on drop zone.
   * @param {DragEvent} event - Drag event
   */
  #onDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
  }

  /**
   * Handle dragleave event on drop zone.
   * @param {DragEvent} event - Drag event
   */
  #onDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
  }

  /**
   * Handle drop event on drop zone.
   * @param {DragEvent} event - Drop event
   */
  async #onDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');
    const file = event.dataTransfer?.files?.[0];
    if (file) await this.#handleFile(file);
  }

  /**
   * Handle file input selection.
   * @param {Event} event - Change event
   */
  async #onFileSelected(event) {
    const file = event.target.files?.[0];
    if (file) await this.#handleFile(file);
  }

  /**
   * Process an uploaded file.
   * @param {File} file - Uploaded file
   */
  async #handleFile(file) {
    const importer = this.#getSelectedImporter();
    if (!importer) {
      ui.notifications.warn('CALENDARIA.Importer.SelectSourceFirst', { localize: true });
      return;
    }
    try {
      const data = await importer.parseFile(file);
      this.#loadedFileName = file.name;
      this.#loadedFromModule = false;
      await this.#processData(data);
    } catch (error) {
      log(1, 'Error parsing file:', error);
      this.#errorMessage = format('CALENDARIA.Importer.ParseError', { error: error.message });
      this.render();
    }
  }

  /**
   * Handle upload file button click.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Button element
   */
  static #onUploadFile(_event, _target) {
    const fileInput = this.element.querySelector('input[type="file"]');
    fileInput?.click();
  }

  /**
   * Handle import from module button click.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Button element
   */
  static async #onImportFromModule(_event, _target) {
    const importer = this.#getSelectedImporter();
    if (!importer) return;
    try {
      const data = await importer.loadFromModule();
      this.#loadedFromModule = true;
      this.#loadedFileName = null;
      await this.#processData(data);
    } catch (error) {
      log(1, 'Error loading from module:', error);
      this.#errorMessage = error.message;
      this.render();
    }
  }

  /**
   * Handle clear data button click.
   * @param {Event} _event - Click event
   * @param {HTMLElement} _target - Button element
   */
  static #onClearData(_event, _target) {
    this.#clearData();
    this.render();
  }

  /**
   * Handle set all note types button click.
   * @param {Event} _event - Click event
   * @param {HTMLElement} target - Button element with data-type
   */
  static #onSetAllNoteTypes(_event, target) {
    const type = target.dataset.type;
    const radios = this.element.querySelectorAll(`input[type="radio"][value="${type}"]`);
    radios.forEach((radio) => (radio.checked = true));
  }

  /**
   * Handle form submission (import).
   * Opens the Calendar Editor with the imported data for polishing before saving.
   * @param {Event} _event - Submit event
   * @param {HTMLFormElement} _form - Form element
   * @param {object} formData - Parsed form data
   */
  static async #onSubmit(_event, _form, formData) {
    if (!this.#transformedData) {
      ui.notifications.warn('CALENDARIA.Importer.NoData', { localize: true });
      return;
    }
    const data = formData.object;
    const calendarId = data.calendarId || this.#suggestedId;
    const calendarName = data.calendarName || this.#transformedData.name;
    const noteTypes = {};
    for (const [key, value] of Object.entries(data)) {
      const match = key.match(/^noteType\[(\d+)]$/);
      if (match) noteTypes[parseInt(match[1])] = value;
    }
    if (this.#extractedNotes?.length > 0) {
      const festivals = [];
      this.#extractedNotes.forEach((note, index) => {
        const noteType = noteTypes[index] || note.suggestedType;
        if (noteType === 'festival') festivals.push({ name: note.name, month: (note.startDate?.month ?? 0) + 1, day: (note.startDate?.day ?? 0) + 1 });
      });
      if (festivals.length > 0) {
        if (!this.#transformedData.festivals) this.#transformedData.festivals = [];
        this.#transformedData.festivals.push(...festivals);
        log(3, `Added ${festivals.length} festivals to calendar data`);
      }
    }
    this.#transformedData.name = calendarName;
    const pendingNotes = [];
    if (this.#extractedNotes?.length > 0) {
      this.#extractedNotes.forEach((note, index) => {
        const noteType = noteTypes[index] || note.suggestedType;
        if (noteType === 'note') pendingNotes.push(note);
      });
    }
    if (pendingNotes.length > 0) {
      log(3, `${pendingNotes.length} notes queued for pending import`);
      if (!this.#transformedData.metadata) this.#transformedData.metadata = {};
      this.#transformedData.metadata.pendingNotes = pendingNotes;
      this.#transformedData.metadata.importerId = this.#selectedImporterId;
    }
    await this.close();
    CalendarEditor.createFromData(this.#transformedData, { suggestedId: calendarId });
    ui.notifications.info('CALENDARIA.Importer.OpeningEditor', { localize: true });
  }
}
