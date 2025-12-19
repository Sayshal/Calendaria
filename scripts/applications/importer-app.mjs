/**
 * Importer Application
 * AppV2 dialog for importing calendars from external sources.
 *
 * @module Applications/ImporterApp
 * @author Tyler
 */

import { MODULE, TEMPLATES } from '../constants.mjs';
import { log } from '../utils/logger.mjs';
import { getImporterOptions, createImporter } from '../importers/index.mjs';
import { CalendarEditor } from './calendar-editor.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Calendar Importer Application.
 * Provides UI for selecting an import source, loading data, previewing, and importing.
 * @extends ApplicationV2
 * @mixes HandlebarsApplicationMixin
 */
export class ImporterApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-importer',
    classes: ['calendaria', 'importer-app'],
    tag: 'form',
    window: { icon: 'fas fa-file-import', title: 'CALENDARIA.Importer.Title', resizable: false },
    position: { width: 700, height: 'auto' },
    form: {
      handler: ImporterApp.#onSubmit,
      submitOnChange: false,
      closeOnSubmit: false
    },
    actions: {
      uploadFile: ImporterApp.#onUploadFile,
      importFromModule: ImporterApp.#onImportFromModule,
      clearData: ImporterApp.#onClearData,
      setAllNoteTypes: ImporterApp.#onSetAllNoteTypes
    }
  };

  /** @override */
  static PARTS = {
    form: { template: TEMPLATES.IMPORTER.APP, scrollable: [''] }
  };

  /* -------------------------------------------- */
  /*  Instance Properties                         */
  /* -------------------------------------------- */

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

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    // Get available importers
    const importers = getImporterOptions();
    context.importers = importers;
    context.hasImporters = importers.length > 0;

    // Current state
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

    // Determine available actions
    if (context.selectedImporter) {
      context.canUpload = context.selectedImporter.supportsFileUpload;
      context.canImportFromModule = context.selectedImporter.supportsLiveImport && context.selectedImporter.detected;
      context.fileExtensions = this.#getSelectedImporter()?.constructor.fileExtensions?.join(',') || '.json';
    }

    // Footer button
    context.buttons = [{ type: 'submit', icon: 'fas fa-file-import', label: 'CALENDARIA.Importer.Import', disabled: !context.hasData || this.#importing }];

    return context;
  }

  /** @override */
  _onRender(context, options) {
    super._onRender?.(context, options);

    // Source select change handler (data-action doesn't work with change events)
    const sourceSelect = this.element.querySelector('select[name="importerId"]');
    if (sourceSelect) sourceSelect.addEventListener('change', this.#onSourceChange.bind(this));

    // Set up drag and drop for file upload
    const dropZone = this.element.querySelector('.file-upload-zone');
    if (dropZone) {
      dropZone.addEventListener('dragover', this.#onDragOver.bind(this));
      dropZone.addEventListener('dragleave', this.#onDragLeave.bind(this));
      dropZone.addEventListener('drop', this.#onDrop.bind(this));
    }

    // File input change handler
    const fileInput = this.element.querySelector('input[type="file"]');
    if (fileInput) fileInput.addEventListener('change', this.#onFileSelected.bind(this));
  }

  /* -------------------------------------------- */
  /*  Helpers                                     */
  /* -------------------------------------------- */

  /**
   * Get the currently selected importer instance.
   * @returns {BaseImporter|null}
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
      // Transform data
      this.#rawData = data;
      this.#transformedData = await importer.transform(data);

      // Validate
      const validation = importer.validate(this.#transformedData);
      if (!validation.valid) {
        this.#errorMessage = validation.errors.join('\n');
        this.#transformedData = null;
        this.#previewData = null;
        this.render();
        return;
      }

      // Generate preview
      this.#previewData = importer.getPreviewData(this.#rawData, this.#transformedData);
      this.#suggestedId = this.#generateId(this.#transformedData.name);

      // Add current date to preview if available
      const currentTime = this.#transformedData.time?.current;
      if (currentTime) {
        const month = (currentTime.month ?? 0) + 1;
        const day = (currentTime.day ?? 0) + 1;
        const year = currentTime.year ?? 1;
        this.#previewData.currentDate = `${month}/${day}/${year}`;
      } else {
        this.#previewData.currentDate = '—';
      }

      // Extract notes for selection UI and add display date
      this.#extractedNotes = await importer.extractNotes(this.#rawData);
      if (this.#extractedNotes) {
        this.#extractedNotes.forEach((note) => {
          const month = (note.startDate?.month ?? 0) + 1;
          const day = (note.startDate?.day ?? 0) + 1;
          note.displayDate = `${month}/${day}`;
        });
      }

      log(3, 'Data processed successfully:', this.#previewData);
    } catch (error) {
      log(2, 'Error processing import data:', error);
      this.#errorMessage = error.message;
      this.#transformedData = null;
      this.#previewData = null;
    }

    this.render();
  }

  /**
   * Generate a suggested calendar ID from name.
   * @param {string} name - Calendar name
   * @returns {string}
   */
  #generateId(name) {
    if (!name) return `imported-${Date.now()}`;
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
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
  }

  /* -------------------------------------------- */
  /*  Event Handlers                              */
  /* -------------------------------------------- */

  /**
   * Handle source selection change.
   * @param {Event} event
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
   * Handle dragover event on drop zone.
   * @param {DragEvent} event
   */
  #onDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add('dragover');
  }

  /**
   * Handle dragleave event on drop zone.
   * @param {DragEvent} event
   */
  #onDragLeave(event) {
    event.currentTarget.classList.remove('dragover');
  }

  /**
   * Handle drop event on drop zone.
   * @param {DragEvent} event
   */
  async #onDrop(event) {
    event.preventDefault();
    event.currentTarget.classList.remove('dragover');

    const file = event.dataTransfer?.files?.[0];
    if (file) await this.#handleFile(file);
  }

  /**
   * Handle file input selection.
   * @param {Event} event
   */
  async #onFileSelected(event) {
    const file = event.target.files?.[0];
    if (file) await this.#handleFile(file);
  }

  /**
   * Process an uploaded file.
   * @param {File} file
   */
  async #handleFile(file) {
    const importer = this.#getSelectedImporter();
    if (!importer) {
      ui.notifications.warn(game.i18n.localize('CALENDARIA.Importer.SelectSourceFirst'));
      return;
    }

    try {
      const data = await importer.parseFile(file);
      this.#loadedFileName = file.name;
      this.#loadedFromModule = false;
      await this.#processData(data);
    } catch (error) {
      log(2, 'Error parsing file:', error);
      this.#errorMessage = game.i18n.format('CALENDARIA.Importer.ParseError', { error: error.message });
      this.render();
    }
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  /**
   * Handle upload file button click.
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static #onUploadFile(event, target) {
    const fileInput = this.element.querySelector('input[type="file"]');
    fileInput?.click();
  }

  /**
   * Handle import from module button click.
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static async #onImportFromModule(event, target) {
    const importer = this.#getSelectedImporter();
    if (!importer) return;

    try {
      const data = await importer.loadFromModule();
      this.#loadedFromModule = true;
      this.#loadedFileName = null;
      await this.#processData(data);
    } catch (error) {
      log(2, 'Error loading from module:', error);
      this.#errorMessage = error.message;
      this.render();
    }
  }

  /**
   * Handle clear data button click.
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static #onClearData(event, target) {
    this.#clearData();
    this.render();
  }

  /**
   * Handle set all note types button click.
   * @param {Event} event
   * @param {HTMLElement} target
   */
  static #onSetAllNoteTypes(event, target) {
    const type = target.dataset.type;
    const radios = this.element.querySelectorAll(`input[type="radio"][value="${type}"]`);
    radios.forEach((radio) => (radio.checked = true));
  }

  /**
   * Handle form submission (import).
   * Opens the Calendar Editor with the imported data for polishing before saving.
   * @param {Event} event
   * @param {HTMLFormElement} form
   * @param {FormDataExtended} formData
   */
  static async #onSubmit(event, form, formData) {
    if (!this.#transformedData) {
      ui.notifications.warn(game.i18n.localize('CALENDARIA.Importer.NoData'));
      return;
    }

    const data = formData.object;
    const calendarId = data.calendarId || this.#suggestedId;
    const calendarName = data.calendarName || this.#transformedData.name;

    // Parse note type selections from form data
    const noteTypes = {};
    for (const [key, value] of Object.entries(data)) {
      const match = key.match(/^noteType\[(\d+)\]$/);
      if (match) noteTypes[parseInt(match[1])] = value;
    }

    // Process festivals to add to calendar data
    if (this.#extractedNotes?.length > 0) {
      const festivals = [];
      this.#extractedNotes.forEach((note, index) => {
        const noteType = noteTypes[index] || note.suggestedType;
        if (noteType === 'festival') {
          // Convert to festival format (month is 1-indexed, day is 1-indexed)
          festivals.push({
            name: note.name,
            month: (note.startDate?.month ?? 0) + 1,
            day: (note.startDate?.day ?? 0) + 1
          });
        }
      });

      // Merge festivals into transformed data
      if (festivals.length > 0) {
        if (!this.#transformedData.festivals) this.#transformedData.festivals = [];
        this.#transformedData.festivals.push(...festivals);
        log(3, `Added ${festivals.length} festivals to calendar data`);
      }
    }

    // Apply name override
    this.#transformedData.name = calendarName;

    // Store pending notes for later import (after calendar is saved)
    const pendingNotes = [];
    if (this.#extractedNotes?.length > 0) {
      log(3, `Processing ${this.#extractedNotes.length} extracted notes for pending import`);
      this.#extractedNotes.forEach((note, index) => {
        const noteType = noteTypes[index] || note.suggestedType;
        log(3, `Note ${index} "${note.name}": type=${noteType}, suggestedType=${note.suggestedType}`);
        if (noteType === 'note') pendingNotes.push(note);
      });
    }

    log(3, `Pending notes to import: ${pendingNotes.length}`);

    // Store pending notes in metadata for the editor to handle after save
    if (pendingNotes.length > 0) {
      if (!this.#transformedData.metadata) this.#transformedData.metadata = {};
      this.#transformedData.metadata.pendingNotes = pendingNotes;
      this.#transformedData.metadata.importerId = this.#selectedImporterId;
      log(3, `Stored ${pendingNotes.length} pending notes with importerId: ${this.#selectedImporterId}`);
    }

    // Close importer and open Calendar Editor with the transformed data
    await this.close();
    CalendarEditor.createFromData(this.#transformedData, { suggestedId: calendarId });

    ui.notifications.info(game.i18n.localize('CALENDARIA.Importer.OpeningEditor'));
  }

  /* -------------------------------------------- */
  /*  Static API                                  */
  /* -------------------------------------------- */

  /**
   * Open the importer application.
   * @param {object} [options] - Application options
   * @returns {ImporterApp}
   */
  static open(options = {}) {
    const app = new this(options);
    app.render(true);
    return app;
  }
}
