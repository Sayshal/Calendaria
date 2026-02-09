/**
 * Reusable range slider with multiple draggable handles.
 * Used for moon phases, sunrise/sunset, etc.
 * @module Utils/RangeSlider
 */

/**
 * Range slider with draggable handles for dividing a range into segments.
 */
export class RangeSlider {
  /**
   * @param {object} options - Slider configuration
   * @param {HTMLElement} options.container - Parent element containing slider and inputs
   * @param {string} options.sliderSelector - Selector for the slider element
   * @param {string} options.trackSelector - Selector for the track element within slider
   * @param {string} options.segmentSelector - Selector for segment elements
   * @param {string} options.handleSelector - Selector for handle elements
   * @param {string} options.inputStartSelector - Selector pattern for start inputs (use {key} for segment key)
   * @param {string} options.inputEndSelector - Selector pattern for end inputs (use {key} for segment key)
   * @param {string[]} options.keys - Array of segment keys matching DOM data attributes
   * @param {string} [options.handleKeyAttr] - Attribute name for handle keys (default: 'data-handle-key')
   * @param {string} [options.segmentKeyAttr] - Attribute name for segment keys (default: 'data-segment-key')
   * @param {string} [options.labelClass] - CSS class for labels (default: 'slider-label')
   * @param {number} [options.minGap] - Minimum gap between handles
   * @param {number} [options.labelMinWidth] - Minimum segment width to show label
   * @param {Function} options.getData - Returns array of {start, end} decimals (0-1)
   * @param {Function} options.setData - Commits boundary changes (receives array of {start, end} decimals)
   * @param {Function} [options.formatLabel] - Custom label formatter (receives width%, mode) returns string
   * @param {string[]} [options.labelModes] - Array of label modes to cycle through (default: ['percent'])
   */
  constructor(options) {
    this.container = options.container;
    this.sliderSelector = options.sliderSelector;
    this.trackSelector = options.trackSelector;
    this.segmentSelector = options.segmentSelector;
    this.handleSelector = options.handleSelector;
    this.inputStartSelector = options.inputStartSelector;
    this.inputEndSelector = options.inputEndSelector;
    this.keys = options.keys;
    this.handleKeyAttr = options.handleKeyAttr || 'data-handle-key';
    this.segmentKeyAttr = options.segmentKeyAttr || 'data-segment-key';
    this.labelClass = options.labelClass || 'slider-label';
    this.minGap = options.minGap ?? 1;
    this.labelMinWidth = options.labelMinWidth ?? 3;
    this.getData = options.getData;
    this.setData = options.setData;
    this.formatLabel = options.formatLabel || this.#defaultFormatLabel.bind(this);
    this.labelModes = options.labelModes || ['percent'];
    this.positions = [];
    this.numSegments = 0;
    this.labelModeIndex = 0;
    this.#init();
  }

  /**
   * Current label mode.
   * @returns {string} The active label mode
   */
  get labelMode() {
    return this.labelModes[this.labelModeIndex];
  }

  /**
   * Default label formatter showing percentage.
   * @param {number} widthPercent - Width as percentage
   * @returns {string} Formatted label
   * @private
   */
  #defaultFormatLabel(widthPercent) {
    return `${widthPercent.toFixed(1)}%`;
  }

  /**
   * Resolve a key attribute value to a numeric index.
   * @param {string} key - Key attribute value
   * @returns {number} Numeric index, or -1 if not found
   * @private
   */
  #keyToIndex(key) {
    return this.keys.indexOf(key);
  }

  /**
   * Initialize the slider.
   * @private
   */
  #init() {
    this.#loadPositions();
    this.#attachListeners();
  }

  /**
   * Load current positions from data.
   * @private
   */
  #loadPositions() {
    const data = this.getData();
    this.numSegments = data.length;
    this.positions = data.slice(0, -1).map((d) => d.end * 100);
  }

  /**
   * Get the slider element.
   * @returns {HTMLElement|null} The slider element or null
   * @private
   */
  #getSlider() {
    return this.container.querySelector(this.sliderSelector);
  }

  /**
   * Get the track element.
   * @returns {HTMLElement|null} The track element or null
   * @private
   */
  #getTrack() {
    return this.#getSlider()?.querySelector(this.trackSelector);
  }

  /**
   * Attach event listeners.
   * @private
   */
  #attachListeners() {
    const track = this.#getTrack();
    if (!track) return;

    for (const handle of track.querySelectorAll(this.handleSelector)) {
      if (handle.dataset.rangeSliderAttached) continue;
      handle.dataset.rangeSliderAttached = 'true';
      handle.addEventListener('mousedown', (e) => this.#onDragStart(e, handle));
    }

    for (const segment of track.querySelectorAll(this.segmentSelector)) {
      if (segment.dataset.rangeSliderAttached) continue;
      segment.dataset.rangeSliderAttached = 'true';
      const segmentIdx = this.#keyToIndex(segment.getAttribute(this.segmentKeyAttr));
      if (segmentIdx === -1) continue;
      segment.addEventListener('dblclick', () => this.#onDoubleClick(segmentIdx));
    }

    for (const label of track.querySelectorAll(`.${this.labelClass}`)) {
      if (label.dataset.rangeSliderAttached) continue;
      label.dataset.rangeSliderAttached = 'true';
      label.addEventListener('click', (e) => {
        e.stopPropagation();
        this.#toggleLabelMode();
      });
    }

    for (let i = 0; i < this.numSegments; i++) {
      const key = this.keys[i];
      const startInput = this.container.querySelector(this.inputStartSelector.replace('{key}', key));
      const endInput = this.container.querySelector(this.inputEndSelector.replace('{key}', key));
      if (startInput && !startInput.dataset.rangeSliderAttached) {
        startInput.dataset.rangeSliderAttached = 'true';
        startInput.addEventListener('input', () => this.#onInputChange(i, 'start', startInput));
      }
      if (endInput && !endInput.dataset.rangeSliderAttached) {
        endInput.dataset.rangeSliderAttached = 'true';
        endInput.addEventListener('input', () => this.#onInputChange(i, 'end', endInput));
      }
    }
  }

  /**
   * Handle drag start.
   * @param {MouseEvent} event - Mousedown event
   * @param {HTMLElement} handle - The handle element
   * @private
   */
  #onDragStart(event, handle) {
    event.preventDefault();
    const handleIdx = this.#keyToIndex(handle.getAttribute(this.handleKeyAttr));
    if (handleIdx === -1) return;

    this.#loadPositions();
    handle.classList.add('dragging');
    const track = this.#getTrack();
    const trackRect = track.getBoundingClientRect();

    const onMove = (e) => {
      const x = Math.max(0, Math.min(e.clientX - trackRect.left, trackRect.width));
      const percent = (x / trackRect.width) * 100;
      const boundaries = this.#calculateBoundaries(percent, handleIdx);
      this.#updateVisuals(boundaries);
      this.#updateInputs(boundaries);
    };

    const onUp = (e) => {
      handle.classList.remove('dragging');
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      const x = Math.max(0, Math.min(e.clientX - trackRect.left, trackRect.width));
      const percent = (x / trackRect.width) * 100;
      const boundaries = this.#calculateBoundaries(percent, handleIdx);
      this.#commitData(boundaries);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /**
   * Calculate boundaries from dragging.
   * @param {number} targetPercent - Target position
   * @param {number} handleIdx - Handle index
   * @returns {Array<{start: number, end: number}>} Boundaries (0-100)
   * @private
   */
  #calculateBoundaries(targetPercent, handleIdx) {
    const minDragPos = (handleIdx + 1) * this.minGap;
    const maxDragPos = 100 - (this.positions.length - handleIdx) * this.minGap;
    const clampedTarget = Math.max(minDragPos, Math.min(maxDragPos, targetPercent));

    this.positions[handleIdx] = clampedTarget;

    for (let i = handleIdx; i < this.positions.length - 1; i++) {
      if (this.positions[i + 1] < this.positions[i] + this.minGap) {
        this.positions[i + 1] = this.positions[i] + this.minGap;
      }
    }

    for (let i = handleIdx; i > 0; i--) {
      if (this.positions[i - 1] > this.positions[i] - this.minGap) {
        this.positions[i - 1] = this.positions[i] - this.minGap;
      }
    }

    return this.#positionsToBoundaries();
  }

  /**
   * Convert positions to boundaries.
   * @returns {Array<{start: number, end: number}>} Boundaries (0-100)
   * @private
   */
  #positionsToBoundaries() {
    const boundaries = [];
    for (let i = 0; i < this.numSegments; i++) {
      const start = i === 0 ? 0 : this.positions[i - 1];
      const end = i === this.numSegments - 1 ? 100 : this.positions[i];
      boundaries.push({ start, end });
    }
    return boundaries;
  }

  /**
   * Update visuals.
   * @param {Array<{start: number, end: number}>} boundaries - Boundaries
   * @private
   */
  #updateVisuals(boundaries) {
    const track = this.#getTrack();
    if (!track) return;

    for (let i = 0; i < this.numSegments; i++) {
      const key = this.keys[i];
      const segment = track.querySelector(`${this.segmentSelector}[${this.segmentKeyAttr}="${key}"]`);
      const width = boundaries[i].end - boundaries[i].start;

      if (segment) {
        segment.style.left = `${boundaries[i].start}%`;
        segment.style.width = `${width}%`;

        let label = segment.querySelector(`.${this.labelClass}`);
        if (width >= this.labelMinWidth) {
          if (!label) {
            label = document.createElement('span');
            label.className = this.labelClass;
            label.addEventListener('click', (e) => {
              e.stopPropagation();
              this.#toggleLabelMode();
            });
            segment.appendChild(label);
          }
          label.textContent = this.formatLabel(width, this.labelMode);
          label.style.display = '';
        } else if (label) {
          label.style.display = 'none';
        }
      }

      if (i < this.numSegments - 1) {
        const handle = track.querySelector(`${this.handleSelector}[${this.handleKeyAttr}="${key}"]`);
        if (handle) handle.style.left = `${boundaries[i].end}%`;
      }
    }
  }

  /**
   * Update inputs.
   * @param {Array<{start: number, end: number}>} boundaries - Boundaries
   * @private
   */
  #updateInputs(boundaries) {
    for (let i = 0; i < this.numSegments; i++) {
      const key = this.keys[i];
      const startInput = this.container.querySelector(this.inputStartSelector.replace('{key}', key));
      const endInput = this.container.querySelector(this.inputEndSelector.replace('{key}', key));
      if (startInput) startInput.value = boundaries[i].start.toFixed(2);
      if (endInput) endInput.value = boundaries[i].end.toFixed(2);
    }
  }

  /**
   * Commit data.
   * @param {Array<{start: number, end: number}>} boundaries - Boundaries (percent)
   * @private
   */
  #commitData(boundaries) {
    const data = boundaries.map((b) => ({ start: b.start / 100, end: b.end / 100 }));
    this.setData(data);
  }

  /**
   * Handle input change.
   * @param {number} segmentIdx - Segment index
   * @param {string} field - 'start' or 'end'
   * @param {HTMLInputElement} input - Input element
   * @private
   */
  #onInputChange(segmentIdx, field, input) {
    const value = parseFloat(input.value) || 0;
    const data = this.getData();

    if (field === 'start') {
      data[segmentIdx].start = value / 100;
      if (segmentIdx > 0) data[segmentIdx - 1].end = value / 100;
    } else {
      data[segmentIdx].end = value / 100;
      if (segmentIdx < data.length - 1) data[segmentIdx + 1].start = value / 100;
    }

    this.setData(data);
    this.#loadPositions();
    const boundaries = data.map((d) => ({ start: d.start * 100, end: d.end * 100 }));
    this.#updateVisuals(boundaries);
  }

  /**
   * Handle double-click to normalize segment.
   * @param {number} segmentIdx - Segment index
   * @private
   */
  #onDoubleClick(segmentIdx) {
    const fairWidth = 100 / this.numSegments;
    const boundaries = this.#positionsToBoundaries();
    const currentWidth = boundaries[segmentIdx].end - boundaries[segmentIdx].start;
    const diff = fairWidth - currentWidth;

    if (Math.abs(diff) < 0.01) return;

    const hasLeft = segmentIdx > 0;
    const hasRight = segmentIdx < this.numSegments - 1;
    let leftAdjust = 0;
    let rightAdjust = 0;

    if (hasLeft && hasRight) {
      leftAdjust = diff / 2;
      rightAdjust = diff / 2;
    } else if (hasLeft) {
      leftAdjust = diff;
    } else if (hasRight) {
      rightAdjust = diff;
    }

    if (hasLeft) {
      const newLeftBoundary = boundaries[segmentIdx].start - leftAdjust;
      const minLeft = segmentIdx === 1 ? this.minGap : boundaries[segmentIdx - 1].start + this.minGap;
      boundaries[segmentIdx].start = Math.max(minLeft, newLeftBoundary);
      boundaries[segmentIdx - 1].end = boundaries[segmentIdx].start;
    }

    if (hasRight) {
      const newRightBoundary = boundaries[segmentIdx].end + rightAdjust;
      const maxRight = segmentIdx === this.numSegments - 2 ? 100 - this.minGap : boundaries[segmentIdx + 1].end - this.minGap;
      boundaries[segmentIdx].end = Math.min(maxRight, newRightBoundary);
      boundaries[segmentIdx + 1].start = boundaries[segmentIdx].end;
    }

    for (let i = 0; i < this.positions.length; i++) {
      this.positions[i] = boundaries[i].end;
    }

    this.#updateVisuals(boundaries);
    this.#updateInputs(boundaries);
    this.#commitData(boundaries);
  }

  /**
   * Toggle label mode.
   * @private
   */
  #toggleLabelMode() {
    if (this.labelModes.length <= 1) return;
    this.labelModeIndex = (this.labelModeIndex + 1) % this.labelModes.length;
    const boundaries = this.#positionsToBoundaries();
    this.#updateVisuals(boundaries);
  }

  /** Refresh the slider. */
  refresh() {
    this.#loadPositions();
    const boundaries = this.#positionsToBoundaries();
    this.#updateVisuals(boundaries);
  }

  /** Destroy the slider. */
  destroy() {
    const track = this.#getTrack();
    if (!track) return;

    for (const handle of track.querySelectorAll(this.handleSelector)) {
      delete handle.dataset.rangeSliderAttached;
    }
    for (const segment of track.querySelectorAll(this.segmentSelector)) {
      delete segment.dataset.rangeSliderAttached;
    }
    for (let i = 0; i < this.numSegments; i++) {
      const key = this.keys[i];
      const startInput = this.container.querySelector(this.inputStartSelector.replace('{key}', key));
      const endInput = this.container.querySelector(this.inputEndSelector.replace('{key}', key));
      if (startInput) delete startInput.dataset.rangeSliderAttached;
      if (endInput) delete endInput.dataset.rangeSliderAttached;
    }
  }
}
