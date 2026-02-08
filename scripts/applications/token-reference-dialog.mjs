/**
 * Token Reference Dialog - Modal showing format tokens with contextual highlighting.
 * @module Applications/TokenReferenceDialog
 * @author Tyler
 */

import { getAvailableTokens } from '../utils/format-utils.mjs';
import { localize } from '../utils/localization.mjs';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Token categories for contextual highlighting.
 * @enum {string[]}
 */
const TOKEN_CATEGORIES = {
  date: ['Y', 'YY', 'YYYY', '[yearName]', 'M', 'MM', 'MMM', 'MMMM', 'Mo', 'D', 'DD', 'Do', 'DDD', 'EEEE', 'EEE', 'EE', 'E', 'EEEEE', 'e', 'w', 'ww', 'W', '[namedWeek]', '[namedWeekAbbr]'],
  fantasy: [
    'GGGG',
    'GGG',
    'GG',
    'G',
    '[yearInEra]',
    '[era=N]',
    '[eraAbbr=N]',
    '[yearInEra=N]',
    'QQQQ',
    'QQQ',
    'QQ',
    'Q',
    'zzzz',
    'z',
    '[moon]',
    '[moonIcon]',
    '[ch]',
    '[chAbbr]',
    '[cycle]',
    '[cycleName]',
    '[cycleRoman]',
    '[approxTime]',
    '[approxDate]'
  ],
  time: ['H', 'HH', 'h', 'hh', 'm', 'mm', 's', 'ss', 'A', 'a', '[meridiemFull]'],
  stopwatch: ['HH', 'mm', 'ss', 'SSS']
};

/**
 * Modal dialog displaying format tokens with contextual highlighting.
 */
export class TokenReferenceDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  /** @type {string} Field context type: 'date', 'time', 'stopwatch', or 'all' */
  #contextType = 'all';

  /**
   * Create a new TokenReferenceDialog.
   * @param {object} options - Application options
   * @param {string} [options.contextType] - Context type for highlighting
   */
  constructor(options = {}) {
    super(options);
    this.#contextType = options.contextType || 'all';
  }

  /** @override */
  static DEFAULT_OPTIONS = {
    id: 'calendaria-token-reference',
    classes: ['calendaria', 'token-reference-dialog'],
    position: { width: 420, height: Math.min(Math.floor(window.innerHeight * 0.8), 1100) },
    window: { title: 'CALENDARIA.TokenReference.Title', resizable: false }
  };

  /** @override */
  static PARTS = {
    content: { template: 'modules/calendaria/templates/settings/token-reference.hbs' }
  };

  /** @override */
  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const tokens = getAvailableTokens();
    const groups = [
      { id: 'year', label: localize('CALENDARIA.TokenReference.Group.Year'), tokens: [] },
      { id: 'month', label: localize('CALENDARIA.TokenReference.Group.Month'), tokens: [] },
      { id: 'day', label: localize('CALENDARIA.TokenReference.Group.Day'), tokens: [] },
      { id: 'weekday', label: localize('CALENDARIA.TokenReference.Group.Weekday'), tokens: [] },
      { id: 'week', label: localize('CALENDARIA.TokenReference.Group.Week'), tokens: [] },
      { id: 'time', label: localize('CALENDARIA.TokenReference.Group.Time'), tokens: [] },
      { id: 'era', label: localize('CALENDARIA.TokenReference.Group.Era'), tokens: [] },
      { id: 'season', label: localize('CALENDARIA.TokenReference.Group.Season'), tokens: [] },
      { id: 'fantasy', label: localize('CALENDARIA.TokenReference.Group.Fantasy'), tokens: [] },
      { id: 'stopwatch', label: localize('CALENDARIA.TokenReference.Group.Stopwatch'), tokens: [] }
    ];

    const tokenGroups = {
      Y: 'year',
      YY: 'year',
      YYYY: 'year',
      '[yearName]': 'year',
      M: 'month',
      MM: 'month',
      MMM: 'month',
      MMMM: 'month',
      Mo: 'month',
      D: 'day',
      DD: 'day',
      Do: 'day',
      DDD: 'day',
      EEEE: 'weekday',
      EEE: 'weekday',
      EE: 'weekday',
      E: 'weekday',
      EEEEE: 'weekday',
      e: 'weekday',
      w: 'week',
      ww: 'week',
      W: 'week',
      '[namedWeek]': 'week',
      '[namedWeekAbbr]': 'week',
      H: 'time',
      HH: 'time',
      h: 'time',
      hh: 'time',
      m: 'time',
      mm: 'time',
      s: 'time',
      ss: 'time',
      A: 'time',
      a: 'time',
      '[meridiemFull]': 'time',
      GGGG: 'era',
      GGG: 'era',
      GG: 'era',
      G: 'era',
      '[yearInEra]': 'era',
      '[era=N]': 'era',
      '[eraAbbr=N]': 'era',
      '[yearInEra=N]': 'era',
      QQQQ: 'season',
      QQQ: 'season',
      QQ: 'season',
      Q: 'season',
      zzzz: 'season',
      z: 'season',
      '[moon]': 'fantasy',
      '[moonIcon]': 'fantasy',
      '[ch]': 'fantasy',
      '[chAbbr]': 'fantasy',
      '[cycle]': 'fantasy',
      '[cycleName]': 'fantasy',
      '[cycleRoman]': 'fantasy',
      '[approxTime]': 'fantasy',
      '[approxDate]': 'fantasy'
    };

    const highlightedTokens = this.#getHighlightedTokens();
    for (const tokenDef of tokens) {
      const groupId = tokenGroups[tokenDef.token] || 'fantasy';
      const group = groups.find((g) => g.id === groupId);
      if (group) {
        group.tokens.push({ token: tokenDef.token, description: localize(tokenDef.descriptionKey), highlighted: highlightedTokens.has(tokenDef.token), isCustom: tokenDef.type === 'custom' });
      }
    }

    if (this.#contextType === 'stopwatch' || this.#contextType === 'all') {
      const stopwatchGroup = groups.find((g) => g.id === 'stopwatch');
      stopwatchGroup.tokens = [
        { token: 'HH', description: localize('CALENDARIA.TokenReference.Stopwatch.HH'), highlighted: this.#contextType === 'stopwatch', isCustom: false },
        { token: 'mm', description: localize('CALENDARIA.TokenReference.Stopwatch.mm'), highlighted: this.#contextType === 'stopwatch', isCustom: false },
        { token: 'ss', description: localize('CALENDARIA.TokenReference.Stopwatch.ss'), highlighted: this.#contextType === 'stopwatch', isCustom: false },
        { token: 'SSS', description: localize('CALENDARIA.TokenReference.Stopwatch.SSS'), highlighted: this.#contextType === 'stopwatch', isCustom: false }
      ];
    }

    context.groups = groups.filter((g) => g.tokens.length > 0);
    return context;
  }

  /**
   * Get the set of tokens that should be highlighted for the current context.
   * @returns {Set<string>} Set of token strings to highlight
   */
  #getHighlightedTokens() {
    const tokens = new Set();

    switch (this.#contextType) {
      case 'date':
        TOKEN_CATEGORIES.date.forEach((t) => tokens.add(t));
        TOKEN_CATEGORIES.fantasy.forEach((t) => tokens.add(t));
        break;
      case 'time':
        TOKEN_CATEGORIES.time.forEach((t) => tokens.add(t));
        break;
      case 'stopwatch':
        TOKEN_CATEGORIES.stopwatch.forEach((t) => tokens.add(t));
        break;
      default:
        getAvailableTokens().forEach((t) => tokens.add(t.token));
    }

    return tokens;
  }

  /**
   * Calculate position relative to settings panel.
   * @returns {{top: number, left: number}} Position coordinates
   */
  static #calculatePosition() {
    const settingsPanel = document.querySelector('.calendaria.settings-panel');
    if (!settingsPanel) return {};
    const panelRect = settingsPanel.getBoundingClientRect();
    const dialogWidth = 420;
    const gap = 8;
    const rightSpace = window.innerWidth - panelRect.right;
    if (rightSpace >= dialogWidth + gap) return { top: panelRect.top, left: panelRect.right + gap };
    const leftSpace = panelRect.left;
    if (leftSpace >= dialogWidth + gap) return { top: panelRect.top, left: panelRect.left - dialogWidth - gap };
    return {};
  }

  /**
   * Open the Token Reference Dialog.
   * @param {object} [options] - Options
   * @param {string} [options.contextType] - Context type for highlighting
   * @returns {TokenReferenceDialog} The dialog instance
   */
  static open(options = {}) {
    const existingId = 'calendaria-token-reference';
    const existing = foundry.applications.instances.get(existingId);
    if (existing) {
      if (options.contextType && existing.#contextType !== options.contextType) {
        existing.#contextType = options.contextType;
        existing.render({ force: true });
      } else {
        existing.bringToFront();
      }
      return existing;
    }

    const position = TokenReferenceDialog.#calculatePosition();
    const dialog = new TokenReferenceDialog({ ...options, position: { ...TokenReferenceDialog.DEFAULT_OPTIONS.position, ...position } });
    dialog.render({ force: true });
    return dialog;
  }
}
