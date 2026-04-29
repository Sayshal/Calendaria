/**
 * Cinematic Time Skip overlay — fullscreen animated transition.
 * @module CinematicOverlay
 * @author Tyler
 */

import { CalendarManager } from '../../calendar/_module.mjs';
import { HOOKS, MODULE, SETTINGS } from '../../constants.mjs';
import { getTimeIncrements } from '../../time/_module.mjs';
import { CalendariaSocket, formatForLocation, getSkyColorsRgb, log } from '../../utils/_module.mjs';
import CinematicKeyframeBuilder from './cinematic-keyframe-builder.mjs';

/** @type {number} */
const FADE_MS = 300;
/** @type {number} */
const MAX_PARTICLES = 30;
/** @type {object[]} */
const SKY_WAYPOINTS = [
  { t: 0.0, hour: 0 },
  { t: 0.1, hour: 5 },
  { t: 0.2, hour: 6.5 },
  { t: 0.35, hour: 10 },
  { t: 0.5, hour: 12 },
  { t: 0.65, hour: 16 },
  { t: 0.75, hour: 17.5 },
  { t: 0.85, hour: 19.5 },
  { t: 1.0, hour: 24 }
];

/** Cinematic overlay for fullscreen time skip animations. */
export default class CinematicOverlay {
  static #active = false;
  static #aborted = false;
  static #element = null;
  static #pixiApp = null;
  static #payload = null;
  static #currentFrame = -1;
  static #animationId = null;
  static #startRealTime = 0;
  static #totalDuration = 0;
  static #resolvePromise = null;
  static #keydownHandler = null;
  static #particles = [];
  static #stars = null;
  static #sun = null;
  static #moonContainer = null;
  static #moonPool = [];
  static #moonTexture = null;
  static #currentMoons = [];
  static #shootingStars = [];

  /** @returns {boolean} Whether a cinematic is currently playing. */
  static get active() {
    return this.#active;
  }

  /**
   * Check whether a time advance exceeds the cinematic threshold.
   * @param {number} seconds - Advance amount in seconds
   * @returns {boolean} Whether the cinematic should trigger
   */
  static shouldTrigger(seconds) {
    if (!game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_ENABLED)) return false;
    if (this.#active || seconds <= 0) return false;
    const unit = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_THRESHOLD_UNIT);
    const count = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_THRESHOLD);
    const thresholdSeconds = (getTimeIncrements()[unit] ?? 86400) * count;
    return seconds >= thresholdSeconds;
  }

  /**
   * Check whether a rest-initiated advance should trigger a cinematic.
   * @param {number} seconds - Advance amount in seconds
   * @returns {boolean} Whether the cinematic should trigger on rest
   */
  static shouldTriggerOnRest(seconds) {
    if (!game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_ENABLED)) return false;
    if (!game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_ON_REST)) return false;
    if (this.#active) return false;
    return seconds > 0;
  }

  /**
   * Advance time with cinematic threshold check. Drop-in replacement for game.time.advance().
   * @param {number} seconds - Seconds to advance
   * @param {object} [options] - Advance options
   * @param {string} [options.source] - Source identifier ('rest' for rest-time advances)
   */
  static async gatedAdvance(seconds, { source } = {}) {
    const shouldPlay = source === 'rest' ? this.shouldTriggerOnRest(seconds) : this.shouldTrigger(seconds);
    if (shouldPlay && game.user.isGM) {
      await this.triggerFromAdvance(seconds);
      return;
    }
    await game.time.advance(seconds);
  }

  /**
   * Show overlay, advance time (so weather/history populates), build keyframes, then animate.
   * @param {number} seconds - Seconds to advance
   */
  static async triggerFromAdvance(seconds) {
    const startTime = game.time.worldTime;
    const endTime = startTime + seconds;
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) {
      await game.time.advance(seconds);
      return;
    }
    this.#showOverlay();
    await this.#fadeIn();
    await game.time.advance(seconds);
    const payload = this.buildPayload(startTime, endTime);
    if (!payload.keyframes.length) {
      this.#cleanup();
      return;
    }
    CalendariaSocket.emitCinematicPlay(payload);
    await this.play(payload);
  }

  /**
   * Build the cinematic payload from current calendar state.
   * @param {number} startTime - Start world time (seconds)
   * @param {number} endTime - End world time (seconds)
   * @returns {object} Cinematic payload with keyframes and settings
   */
  static buildPayload(startTime, endTime) {
    const calendar = CalendarManager.getActiveCalendar();
    const settings = this.#getSettingsSnapshot();
    return {
      startTime,
      endTime,
      deltaSeconds: endTime - startTime,
      calendarId: calendar?.metadata?.id ?? null,
      keyframes: calendar ? CinematicKeyframeBuilder.build(startTime, endTime, calendar, settings) : [],
      settings
    };
  }

  /**
   * Prepare the overlay DOM and make it visible (but don't start animation).
   */
  static #showOverlay() {
    if (!this.#element) this.#buildDOM();
  }

  /**
   * Play the cinematic animation on this client.
   * @param {object} payload - Cinematic payload
   * @returns {Promise<void>} Resolves on completion or abort
   */
  static async play(payload) {
    if (this.#active) return;
    this.#active = true;
    this.#aborted = false;
    this.#payload = payload;
    this.#currentFrame = -1;
    Hooks.callAll(HOOKS.CINEMATIC_START, payload);
    log(3, `Cinematic starting: ${payload.keyframes.length} keyframes, ${payload.deltaSeconds}s skip`);
    const panelMs = game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_PANEL_DURATION) || 3000;
    this.#totalDuration = Math.max(1000, payload.keyframes.length * panelMs);
    if (!this.#element) this.#buildDOM();
    this.#initPixi();
    this.#seedFirstFrame(payload.keyframes[0]);
    this.#keydownHandler = this.#onKeydown.bind(this);
    document.addEventListener('keydown', this.#keydownHandler);
    return new Promise((resolve) => {
      this.#resolvePromise = resolve;
      this.#startRealTime = performance.now();
      this.#animationId = requestAnimationFrame((ts) => this.#animate(ts));
      if (this.#element?.style.opacity !== '1') this.#fadeIn();
    });
  }

  /** Abort the cinematic and clean up. */
  static abort() {
    if (!this.#active) return;
    this.#aborted = true;
    log(3, 'Cinematic aborted');
    if (game.user.isGM) CalendariaSocket.emitCinematicAbort();
    this.#cleanup();
    Hooks.callAll(HOOKS.CINEMATIC_ABORT, this.#payload);
  }

  /**
   * Main requestAnimationFrame loop.
   * @param {number} timestamp - RAF timestamp in milliseconds
   */
  static #animate(timestamp) {
    if (this.#aborted) return;
    const elapsed = timestamp - this.#startRealTime;
    const progress = Math.min(1, elapsed / this.#totalDuration);
    const keyframes = this.#payload.keyframes;
    const frameIndex = Math.min(keyframes.length - 1, Math.floor(progress * keyframes.length));
    const panelProgress = progress * keyframes.length - frameIndex;
    const dayFraction = this.#computeDayFraction(progress);
    if (frameIndex !== this.#currentFrame) {
      const prevKf = this.#currentFrame >= 0 ? keyframes[this.#currentFrame] : null;
      this.#currentFrame = frameIndex;
      this.#renderKeyframe(keyframes[frameIndex], prevKf);
      if (this.#pixiApp) this.#emitPageFlipParticles();
    }
    this.#updateBackground(dayFraction);
    this.#updateEffects(dayFraction);
    this.#tickDateCounter(frameIndex, panelProgress);
    this.#updateProgressBar(progress);
    if (progress >= 1) {
      this.#complete();
      return;
    }
    this.#animationId = requestAnimationFrame((ts) => this.#animate(ts));
  }

  /**
   * Compute the fraction of the current in-world day (0 to 1, where 0 = 00:00 and 1 = end of day).
   * @param {number} progress - Overall animation progress (0 to 1)
   * @returns {number} Day fraction (0 to 1)
   */
  static #computeDayFraction(progress) {
    const { startTime, endTime } = this.#payload ?? {};
    if (startTime == null || endTime == null) return progress;
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) return progress;
    const worldTime = startTime + (endTime - startTime) * progress;
    const components = calendar.timeToComponents(worldTime);
    const hoursPerDay = calendar.days?.hoursPerDay ?? 24;
    const minutesPerHour = calendar.days?.minutesPerHour ?? 60;
    const secondsPerMinute = calendar.days?.secondsPerMinute ?? 60;
    const hoursInDay = components.hour + components.minute / minutesPerHour + components.second / (minutesPerHour * secondsPerMinute);
    return Math.max(0, Math.min(1, hoursInDay / hoursPerDay));
  }

  /** Complete the cinematic naturally. */
  static async #complete() {
    await this.#fadeOut();
    this.#cleanup();
    Hooks.callAll(HOOKS.CINEMATIC_END, this.#payload);
  }

  /** Release all resources and resolve the play() promise. */
  static #cleanup() {
    if (this.#animationId) {
      cancelAnimationFrame(this.#animationId);
      this.#animationId = null;
    }
    if (this.#keydownHandler) {
      document.removeEventListener('keydown', this.#keydownHandler);
      this.#keydownHandler = null;
    }
    this.#destroyPixi();
    this.#destroyDOM();
    this.#active = false;
    this.#payload = null;
    this.#currentFrame = -1;
    if (this.#resolvePromise) {
      this.#resolvePromise();
      this.#resolvePromise = null;
    }
  }

  /** Build and inject the overlay DOM. */
  static #buildDOM() {
    const overlay = document.createElement('div');
    overlay.id = 'calendaria-cinematic';
    overlay.classList.add('calendaria', 'calendaria-cinematic');
    overlay.style.opacity = '0';
    overlay.innerHTML = `
      <div class="cinematic-bg"></div>
      <canvas class="cinematic-pixi-canvas"></canvas>
      <div class="cinematic-vignette-pulse"></div>
      <div class="cinematic-content">
        <div class="cinematic-fixed-section">
          <div class="cinematic-calendar-page">
            <div class="cinematic-date-counter">
              <span class="cinematic-date-label"></span>
            </div>
            <div class="cinematic-season-badge">
              <i class="cinematic-season-icon fas fa-leaf"></i>
              <span class="cinematic-season-label"></span>
            </div>
            <div class="cinematic-weather-display">
              <i class="cinematic-weather-icon"></i>
              <span class="cinematic-weather-label"></span>
              <span class="cinematic-weather-temp"></span>
              <span class="cinematic-weather-wind"></span>
            </div>
          </div>
        </div>
        <div class="cinematic-dynamic-section">
          <div class="cinematic-moon-strip"></div>
          <div class="cinematic-event-stage"></div>
        </div>
        <div class="cinematic-bottom-section">
          <div class="cinematic-progress-bar"><div class="cinematic-progress-fill"></div></div>
          <div class="cinematic-controls">
            <button class="cinematic-skip" type="button">
              <i class="fas fa-forward"></i> ${game.i18n.localize('CALENDARIA.Common.Skip')}
            </button>
          </div>
        </div>
      </div>`;
    overlay.querySelector('.cinematic-skip')?.addEventListener('click', () => this.abort());
    document.body.appendChild(overlay);
    this.#element = overlay;
  }

  /** Remove the overlay from DOM. */
  static #destroyDOM() {
    this.#element?.remove();
    this.#element = null;
  }

  /**
   * Apply all DOM updates for a new keyframe.
   * @param {object} kf - Current keyframe data
   * @param {object|null} prevKf - Previous keyframe data
   */
  static #renderKeyframe(kf, prevKf) {
    if (!this.#element || !kf) return;
    this.#updateSeasonDisplay(kf);
    this.#updateWeatherDisplay(kf);
    this.#updateMoonDisplay(kf, prevKf);
    this.#showEventCards(kf);
    this.#currentMoons = kf.moons ?? [];
  }

  /**
   * Seed the first keyframe's date label so the overlay never shows an empty pad on the first frame.
   * @param {object|undefined} kf - First keyframe data
   */
  static #seedFirstFrame(kf) {
    if (!kf) return;
    const label = this.#element?.querySelector('.cinematic-date-label');
    if (!label) return;
    label.textContent = kf.dateLabel ?? '';
    label._lastDateKey = `${kf.date?.year}-${kf.date?.month}-${kf.date?.dayOfMonth}`;
    this.#element?.setAttribute('data-content-ready', 'true');
  }

  /**
   * Tick the date counter by interpolating worldTime between keyframes.
   * @param {number} frameIndex - Current keyframe index
   * @param {number} panelProgress - 0-1 within current panel
   */
  static #tickDateCounter(frameIndex, panelProgress) {
    const label = this.#element?.querySelector('.cinematic-date-label');
    if (!label) return;
    const keyframes = this.#payload.keyframes;
    const current = keyframes[frameIndex];
    const next = keyframes[frameIndex + 1];
    if (!current) return;
    const startWt = current.worldTime;
    const endWt = next ? next.worldTime : current.worldTime;
    const interpWt = Math.floor(startWt + (endWt - startWt) * panelProgress);
    const calendar = CalendarManager.getActiveCalendar();
    if (!calendar) {
      label.textContent = current.dateLabel;
      return;
    }
    const components = calendar.timeToComponents(interpWt);
    const dateKey = `${components.year}-${components.month}-${components.dayOfMonth}`;
    if (label._lastDateKey === dateKey) return;
    label._lastDateKey = dateKey;
    if (current.date.year === components.year && current.date.month === components.month && current.date.dayOfMonth === components.dayOfMonth) label.textContent = current.dateLabel;
    else if (next?.date.year === components.year && next?.date.month === components.month && next?.date.dayOfMonth === components.dayOfMonth) label.textContent = next.dateLabel;
    else label.textContent = this.#formatDate(calendar, components);
  }

  /**
   * Format a date from time components.
   * @param {object} calendar - Calendar instance
   * @param {object} components - Time components
   * @returns {string} Formatted date string
   */
  static #formatDate(calendar, components) {
    return formatForLocation(calendar, { ...components, hour: components.hour ?? 12, minute: components.minute ?? 0, second: components.second ?? 0 }, 'cinematicDate');
  }

  /**
   * Update season badge text and color.
   * @param {object} kf - Current keyframe data
   */
  static #updateSeasonDisplay(kf) {
    const badge = this.#element?.querySelector('.cinematic-season-badge');
    if (!badge || !kf.seasonLabel) return;
    badge.querySelector('.cinematic-season-label').textContent = kf.seasonLabel;
    if (kf.seasonColor) badge.style.setProperty('--cinematic-season-color', kf.seasonColor);
  }

  /**
   * Update weather icon and label.
   * @param {object} kf - Current keyframe data
   */
  static #updateWeatherDisplay(kf) {
    const display = this.#element?.querySelector('.cinematic-weather-display');
    if (!display) return;
    if (!kf.weather) {
      display.style.opacity = '0';
      return;
    }
    display.style.opacity = '1';
    const icon = display.querySelector('.cinematic-weather-icon');
    const label = display.querySelector('.cinematic-weather-label');
    const temp = display.querySelector('.cinematic-weather-temp');
    const wind = display.querySelector('.cinematic-weather-wind');
    if (icon) icon.className = `cinematic-weather-icon ${kf.weather.icon ?? 'fas fa-cloud'}`;
    if (label) label.textContent = kf.weather.label;
    if (temp) temp.textContent = kf.weather.temperature ?? '';
    if (wind) {
      const parts = [kf.weather.windDirection, kf.weather.wind].filter(Boolean);
      wind.textContent = parts.length ? parts.join(' ') : '';
    }
    if (kf.weather.color) display.style.setProperty('--cinematic-weather-color', kf.weather.color);
  }

  /**
   * Animate sky gradient based on the current in-world time of day.
   * @param {number} dayFraction - 0-1 representing time-of-day (0 = 00:00, 1 = end of day)
   */
  static #updateBackground(dayFraction) {
    const bg = this.#element?.querySelector('.cinematic-bg');
    if (!bg) return;
    const calendar = CalendarManager.getActiveCalendar();
    let hour = 0;
    for (let i = 0; i < SKY_WAYPOINTS.length - 1; i++) {
      if (dayFraction >= SKY_WAYPOINTS[i].t && dayFraction <= SKY_WAYPOINTS[i + 1].t) {
        const segT = (dayFraction - SKY_WAYPOINTS[i].t) / (SKY_WAYPOINTS[i + 1].t - SKY_WAYPOINTS[i].t);
        hour = SKY_WAYPOINTS[i].hour + segT * (SKY_WAYPOINTS[i + 1].hour - SKY_WAYPOINTS[i].hour);
        break;
      }
    }
    const sky = getSkyColorsRgb(hour, calendar);
    const mute = ([r, g, b]) => {
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const t = 0.45;
      return [Math.round(r + (lum - r) * t), Math.round(g + (lum - g) * t), Math.round(b + (lum - b) * t)];
    };
    const top = mute(sky.top);
    const mid = mute(sky.mid);
    const bot = mute(sky.bottom);
    bg.style.setProperty('--sky-top', `rgb(${top[0]}, ${top[1]}, ${top[2]})`);
    bg.style.setProperty('--sky-mid', `rgb(${mid[0]}, ${mid[1]}, ${mid[2]})`);
    bg.style.setProperty('--sky-bot', `rgb(${bot[0]}, ${bot[1]}, ${bot[2]})`);
  }

  /**
   * Update moon phase display with crossfade transitions.
   * @param {object} kf - Current keyframe
   * @param {object|null} prevKf - Previous keyframe
   */
  static #updateMoonDisplay(kf, prevKf) {
    const strip = this.#element?.querySelector('.cinematic-moon-strip');
    if (!strip) return;
    if (!kf.moons?.length) {
      strip.style.opacity = '0';
      return;
    }
    strip.style.opacity = '1';
    if (!prevKf || strip.children.length !== kf.moons.length) {
      strip.innerHTML = kf.moons
        .map(
          (m, i) => `
        <div class="cinematic-moon" style="--moon-color: ${m.color}" data-moon-index="${i}">
          <div class="cinematic-moon-icon-wrap">
            <img class="cinematic-moon-img cinematic-moon-img--prev" src="" alt="" />
            <img class="cinematic-moon-img cinematic-moon-img--next" src="" alt="" />
          </div>
          <span class="cinematic-moon-name">${m.name}</span>
          <span class="cinematic-moon-phase-name">${m.phaseName}</span>
        </div>`
        )
        .join('');
    }
    for (let i = 0; i < kf.moons.length; i++) {
      const moon = kf.moons[i];
      const prevMoon = prevKf?.moons?.[i];
      const container = strip.querySelector(`[data-moon-index="${i}"]`);
      if (!container) continue;
      const prevImg = container.querySelector('.cinematic-moon-img--prev');
      const nextImg = container.querySelector('.cinematic-moon-img--next');
      const phaseLabel = container.querySelector('.cinematic-moon-phase-name');
      container.classList.toggle('cinematic-moon--full', moon.position >= 0.45 && moon.position <= 0.55);
      if (phaseLabel) phaseLabel.textContent = moon.phaseName;
      const phaseChanged = !prevMoon || prevMoon.phaseIndex !== moon.phaseIndex;
      if (phaseChanged && moon.phaseIcon) {
        prevImg.src = prevMoon?.phaseIcon || moon.phaseIcon;
        prevImg.style.opacity = '1';
        nextImg.src = moon.phaseIcon;
        nextImg.style.opacity = '0';
        requestAnimationFrame(() => {
          prevImg.style.opacity = '0';
          nextImg.style.opacity = '1';
        });
      } else if (!prevMoon && moon.phaseIcon) {
        nextImg.src = moon.phaseIcon;
        nextImg.style.opacity = '1';
        prevImg.style.opacity = '0';
      }
    }
  }

  /**
   * Display event title cards and pulse the vignette.
   * @param {object} kf - Current keyframe data
   */
  static #showEventCards(kf) {
    const stage = this.#element?.querySelector('.cinematic-event-stage');
    if (!stage || !kf.events?.length) return;
    this.#pulseVignette(kf.events.some((e) => e.isFestival));
    for (const event of kf.events) {
      const card = document.createElement('div');
      card.classList.add('cinematic-event-card');
      if (event.isFestival) card.classList.add('cinematic-event--festival');
      if (event.color) card.style.setProperty('--event-color', event.color);
      card.innerHTML = `<i class="${event.icon}"></i><span class="cinematic-event-name">${event.name}</span>`;
      stage.appendChild(card);
      setTimeout(() => card.remove(), event.isFestival ? 2500 : 1800);
    }
  }

  /**
   * Update the progress bar.
   * @param {number} progress - Progress value from 0 to 1
   */
  static #updateProgressBar(progress) {
    const fill = this.#element?.querySelector('.cinematic-progress-fill');
    if (fill) fill.style.width = `${progress * 100}%`;
  }

  /**
   * Flash the vignette overlay on event appearance.
   * @param {boolean} isFestival - Whether the event is a festival
   */
  static #pulseVignette(isFestival) {
    const el = this.#element?.querySelector('.cinematic-vignette-pulse');
    if (!el) return;
    el.style.setProperty('--pulse-color', isFestival ? 'rgb(212 175 55)' : 'rgb(168 144 96)');
    el.classList.remove('active');
    void el.offsetHeight;
    el.classList.add('active');
  }

  /** Initialize PixiJS with star field, sun disc, and particle system. */
  static #initPixi() {
    const canvas = this.#element?.querySelector('.cinematic-pixi-canvas');
    if (!canvas || typeof PIXI === 'undefined') return;
    this.#pixiApp = new PIXI.Application({ view: canvas, resizeTo: window, backgroundAlpha: 0, antialias: false });
    this.#particles = [];
    this.#shootingStars = [];
    const sw = this.#pixiApp.screen.width;
    const sh = this.#pixiApp.screen.height;
    this.#stars = new PIXI.Container();
    this.#stars.pivot.set(sw / 2, sh / 2);
    this.#stars.x = sw / 2;
    this.#stars.y = sh / 2;
    this.#stars.alpha = 0;
    const starCount = 80 + Math.floor(Math.random() * 40);
    for (let i = 0; i < starCount; i++) {
      const s = new PIXI.Graphics();
      const brightness = 0.4 + Math.random() * 0.6;
      s.beginFill(0xffffff, brightness);
      s.drawCircle(0, 0, 0.5 + Math.random() * 1.5);
      s.endFill();
      s.x = Math.random() * sw * 1.4 - sw * 0.2;
      s.y = Math.random() * sh * 0.7;
      s._twinklePhase = Math.random() * Math.PI * 2;
      s._twinkleSpeed = 0.02 + Math.random() * 0.04;
      s._baseAlpha = brightness;
      this.#stars.addChild(s);
    }
    this.#pixiApp.stage.addChild(this.#stars);
    this.#sun = new PIXI.Container();
    this.#sun.alpha = 0;
    const sunSize = 48;
    const sunCanvas = document.createElement('canvas');
    sunCanvas.width = sunSize;
    sunCanvas.height = sunSize;
    const ctx = sunCanvas.getContext('2d');
    const grad = ctx.createRadialGradient(sunSize / 2, sunSize / 2, 0, sunSize / 2, sunSize / 2, sunSize / 2);
    grad.addColorStop(0, 'rgba(255, 250, 220, 1)');
    grad.addColorStop(0.25, 'rgba(255, 230, 100, 0.9)');
    grad.addColorStop(0.55, 'rgba(255, 200, 50, 0.5)');
    grad.addColorStop(1, 'rgba(255, 165, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, sunSize, sunSize);
    const sunTex = PIXI.Texture.from(sunCanvas);
    const sunSprite = new PIXI.Sprite(sunTex);
    sunSprite.anchor.set(0.5);
    sunSprite.scale.set(1.5);
    this.#sun.addChild(sunSprite);
    const corona = new PIXI.Sprite(sunTex);
    corona.anchor.set(0.5);
    corona.scale.set(3.5);
    corona.alpha = 0.15;
    corona.name = 'corona';
    this.#sun.addChild(corona);
    this.#pixiApp.stage.addChild(this.#sun);
    const moonSize = 32;
    const moonCanvas = document.createElement('canvas');
    moonCanvas.width = moonSize;
    moonCanvas.height = moonSize;
    const mCtx = moonCanvas.getContext('2d');
    const mGrad = mCtx.createRadialGradient(moonSize * 0.4, moonSize * 0.4, 0, moonSize / 2, moonSize / 2, moonSize / 2);
    mGrad.addColorStop(0, 'rgba(255, 255, 248, 1)');
    mGrad.addColorStop(0.4, 'rgba(232, 232, 224, 0.9)');
    mGrad.addColorStop(1, 'rgba(200, 200, 184, 0)');
    mCtx.fillStyle = mGrad;
    mCtx.fillRect(0, 0, moonSize, moonSize);
    this.#moonTexture = PIXI.Texture.from(moonCanvas);
    this.#moonContainer = new PIXI.Container();
    this.#pixiApp.stage.addChild(this.#moonContainer);
    this.#pixiApp.ticker.add(() => this.#tickEffects());
  }

  /** Destroy PixiJS application and all effects. */
  static #destroyPixi() {
    if (!this.#pixiApp) return;
    for (const p of this.#particles) p.destroy();
    for (const s of this.#shootingStars) s.destroy();
    this.#particles = [];
    this.#shootingStars = [];
    this.#stars = null;
    this.#sun = null;
    this.#moonContainer = null;
    this.#moonPool = [];
    this.#moonTexture = null;
    this.#currentMoons = [];
    this.#pixiApp.destroy(true, { children: true, texture: true });
    this.#pixiApp = null;
  }

  /**
   * Update PixiJS effects based on the in-world time of day.
   * @param {number} dayFraction - 0-1 representing time-of-day (0 = 00:00, 1 = end of day)
   */
  static #updateEffects(dayFraction) {
    if (!this.#pixiApp) return;
    const sw = this.#pixiApp.screen.width;
    const sh = this.#pixiApp.screen.height;
    let daylight = 0;
    if (dayFraction >= 0.15 && dayFraction <= 0.85) daylight = Math.sin(((dayFraction - 0.15) / 0.7) * Math.PI);
    if (this.#stars) {
      this.#stars.alpha = (1 - daylight) * 0.9;
      this.#stars.rotation += 0.0003;
    }
    if (this.#sun) {
      this.#sun.alpha = daylight * 0.9;
      const t = Math.max(0, Math.min(1, (dayFraction - 0.12) / 0.76));
      this.#sun.x = sw * 0.1 + t * sw * 0.8;
      this.#sun.y = sh * 0.45 - Math.sin(t * Math.PI) * sh * 0.35;
    }
    this.#updatePixiMoons(dayFraction, daylight, sw, sh);
    if (1 - daylight > 0.5 && Math.random() < 0.008) this.#spawnShootingStar();
  }

  /**
   * Update Pixi moon orbs with trailing arc across the night sky.
   * @param {number} dayFraction - 0-1 representing time-of-day (0 = 00:00, 1 = end of day)
   * @param {number} daylight - 0-1 daylight intensity
   * @param {number} sw - Screen width
   * @param {number} sh - Screen height
   */
  static #updatePixiMoons(dayFraction, daylight, sw, sh) {
    if (!this.#moonContainer || !this.#moonTexture) return;
    const moons = this.#currentMoons;
    const count = moons.length;
    while (this.#moonPool.length > count) {
      const entry = this.#moonPool.pop();
      entry.glow.destroy();
      entry.sprite.destroy();
      entry.shadow.destroy();
    }
    while (this.#moonPool.length < count) {
      const glow = new PIXI.Graphics();
      this.#moonContainer.addChild(glow);
      const sprite = new PIXI.Sprite(this.#moonTexture);
      sprite.anchor.set(0.5);
      sprite.alpha = 0;
      this.#moonContainer.addChild(sprite);
      const shadow = new PIXI.Graphics();
      this.#moonContainer.addChild(shadow);
      this.#moonPool.push({ glow, sprite, shadow });
    }
    const moonAlpha = Math.max(0, Math.min(1, (1 - daylight) * 1.2));
    if (moonAlpha <= 0) {
      for (const { glow, sprite, shadow } of this.#moonPool) {
        glow.alpha = 0;
        sprite.alpha = 0;
        shadow.alpha = 0;
      }
      return;
    }
    const nightProgress = dayFraction <= 0.15 ? 0.5 + dayFraction / 0.3 : dayFraction >= 0.85 ? (dayFraction - 0.85) / 0.3 : null;
    if (nightProgress === null) {
      for (const { glow, sprite, shadow } of this.#moonPool) {
        glow.alpha = 0;
        sprite.alpha = 0;
        shadow.alpha = 0;
      }
      return;
    }
    const baseMoonSize = 28;
    const secondaryScale = Math.max(0.6, 0.92 - Math.max(0, count - 3) * 0.03);
    const trailSpacing = baseMoonSize * secondaryScale * 1.6;
    const arcPixels = sw * 0.7;
    const hoursPerPixel = 1 / arcPixels;
    const trailOffset = trailSpacing * hoursPerPixel;
    for (let i = 0; i < count; i++) {
      const moon = moons[i];
      const { glow, sprite, shadow } = this.#moonPool[i];
      const moonSize = i === 0 ? baseMoonSize : baseMoonSize * secondaryScale;
      const trailedProgress = Math.max(0, Math.min(1, nightProgress - i * trailOffset));
      const angle = trailedProgress * Math.PI;
      const moonX = sw * 0.15 + sw * 0.7 * trailedProgress;
      const moonY = sh * 0.45 - Math.sin(angle) * sh * 0.3;
      sprite.x = moonX;
      sprite.y = moonY;
      sprite.scale.set(moonSize / 32);
      sprite.alpha = moonAlpha;
      const rad = moonSize / 2;
      const illumination = 1 - Math.abs(moon.position * 2 - 1);
      const isWaxing = moon.position < 0.5;
      glow.clear();
      if (moon.color) {
        const cHex = parseInt(moon.color.replace('#', ''), 16);
        const cr = (((cHex >> 16) & 0xff) + 255) >> 1;
        const cg = (((cHex >> 8) & 0xff) + 255) >> 1;
        const cb = ((cHex & 0xff) + 255) >> 1;
        glow.beginFill((cr << 16) | (cg << 8) | cb, 0.35);
        glow.drawCircle(moonX, moonY, rad + 4);
        glow.endFill();
      }
      glow.alpha = moonAlpha;
      shadow.clear();
      if (illumination < 0.02) {
        sprite.alpha = 0;
        glow.alpha = 0;
        shadow.alpha = 0;
        continue;
      }
      if (illumination > 0.98) {
        sprite.mask = null;
        glow.lineStyle(1, 0xffffff, 0.15);
        glow.drawCircle(moonX, moonY, rad + 1);
        continue;
      }
      const terminatorRx = rad * Math.cos(illumination * Math.PI);
      const k = 0.5522847498;
      shadow.beginFill(0xffffff);
      if (isWaxing) {
        shadow.moveTo(moonX, moonY - rad);
        shadow.arc(moonX, moonY, rad, -Math.PI / 2, Math.PI / 2);
        shadow.bezierCurveTo(moonX + terminatorRx * k, moonY + rad, moonX + terminatorRx, moonY + rad * k, moonX + terminatorRx, moonY);
        shadow.bezierCurveTo(moonX + terminatorRx, moonY - rad * k, moonX + terminatorRx * k, moonY - rad, moonX, moonY - rad);
      } else {
        shadow.moveTo(moonX, moonY - rad);
        shadow.arc(moonX, moonY, rad, -Math.PI / 2, -Math.PI * 1.5, true);
        shadow.bezierCurveTo(moonX - terminatorRx * k, moonY + rad, moonX - terminatorRx, moonY + rad * k, moonX - terminatorRx, moonY);
        shadow.bezierCurveTo(moonX - terminatorRx, moonY - rad * k, moonX - terminatorRx * k, moonY - rad, moonX, moonY - rad);
      }
      shadow.endFill();
      sprite.mask = shadow;
      shadow.alpha = moonAlpha;
    }
  }

  /** Spawn a shooting star during night phases. */
  static #spawnShootingStar() {
    if (!this.#pixiApp?.stage) return;
    const sw = this.#pixiApp.screen.width;
    const sh = this.#pixiApp.screen.height;
    const star = new PIXI.Graphics();
    const angle = 0.4 + Math.random() * 0.6;
    const speed = 8 + Math.random() * 6;
    const len = 40 + Math.random() * 60;
    star.lineStyle(2, 0xffffff, 0.8);
    star.moveTo(0, 0);
    star.lineTo(-Math.cos(angle) * len, -Math.sin(angle) * len);
    star.lineStyle(1, 0xffffff, 0.3);
    star.lineTo(-Math.cos(angle) * len * 1.5, -Math.sin(angle) * len * 1.5);
    star.x = sw * (0.2 + Math.random() * 0.6);
    star.y = sh * (0.05 + Math.random() * 0.25);
    star._vx = Math.cos(angle) * speed;
    star._vy = Math.sin(angle) * speed;
    star._life = 30 + Math.floor(Math.random() * 20);
    star._age = 0;
    this.#pixiApp.stage.addChild(star);
    this.#shootingStars.push(star);
  }

  /** Emit page-flip particles on keyframe transition. */
  static #emitPageFlipParticles() {
    if (!this.#pixiApp?.stage) return;
    const count = Math.min(MAX_PARTICLES, 3 + Math.floor(Math.random() * 5));
    for (let i = 0; i < count; i++) {
      const p = new PIXI.Graphics();
      const w = 12 + Math.random() * 18;
      const h = 16 + Math.random() * 24;
      const a = 0.15 + Math.random() * 0.35;
      p.beginFill(0xf5f0e6, a);
      p.lineStyle(0.5, 0xc4b99a, a * 0.6);
      p.drawRect(0, 0, w, h);
      p.endFill();
      p.x = Math.random() * (this.#pixiApp.screen.width * 0.8) + this.#pixiApp.screen.width * 0.1;
      p.y = -30;
      p.rotation = Math.random() * Math.PI * 2;
      p.pivot.set(w / 2, h / 2);
      p._vx = (Math.random() - 0.5) * 2;
      p._vy = 1 + Math.random() * 2;
      p._vr = (Math.random() - 0.5) * 0.08;
      p._life = 60 + Math.floor(Math.random() * 60);
      p._age = 0;
      this.#pixiApp.stage.addChild(p);
      this.#particles.push(p);
    }
  }

  /** Per-frame PixiJS ticker for all sprite animations. */
  static #tickEffects() {
    if (this.#stars) {
      for (const s of this.#stars.children) {
        s._twinklePhase += s._twinkleSpeed;
        s.alpha = s._baseAlpha * (0.5 + 0.5 * Math.sin(s._twinklePhase));
      }
    }
    for (let i = this.#particles.length - 1; i >= 0; i--) {
      const p = this.#particles[i];
      p._age++;
      p.x += p._vx;
      p.y += p._vy;
      p.rotation += p._vr;
      p.alpha = Math.max(0, 1 - p._age / p._life);
      if (p._age >= p._life || p.y > (this.#pixiApp?.screen?.height ?? 800) + 50) {
        p.destroy();
        this.#particles.splice(i, 1);
      }
    }
    for (let i = this.#shootingStars.length - 1; i >= 0; i--) {
      const s = this.#shootingStars[i];
      s._age++;
      s.x += s._vx;
      s.y += s._vy;
      s.alpha = Math.max(0, 1 - s._age / s._life);
      if (s._age >= s._life) {
        s.destroy();
        this.#shootingStars.splice(i, 1);
      }
    }
  }

  /** @returns {Promise<void>} Resolves after fade-in completes */
  static #fadeIn() {
    return new Promise((resolve) => {
      if (!this.#element) return resolve();
      this.#element.style.transition = `opacity ${FADE_MS}ms ease-in`;
      requestAnimationFrame(() => {
        this.#element.style.opacity = '1';
        setTimeout(resolve, FADE_MS);
      });
    });
  }

  /** @returns {Promise<void>} Resolves after fade-out completes */
  static #fadeOut() {
    return new Promise((resolve) => {
      if (!this.#element) return resolve();
      this.#element.style.transition = `opacity ${FADE_MS}ms ease-out`;
      this.#element.style.opacity = '0';
      setTimeout(resolve, FADE_MS);
    });
  }

  /**
   * Handle ESC key to abort cinematic.
   * @param {KeyboardEvent} e - The keyboard event
   */
  static #onKeydown(e) {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      this.abort();
    }
  }

  /**
   * Snapshot current cinematic settings for payload.
   * @returns {object} Settings snapshot
   */
  static #getSettingsSnapshot() {
    return {
      showWeather: game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_SHOW_WEATHER),
      showMoons: game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_SHOW_MOONS),
      showEvents: game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_SHOW_EVENTS),
      eventWeighting: game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_EVENT_WEIGHTING),
      eventMaxCards: game.settings.get(MODULE.ID, SETTINGS.CINEMATIC_EVENT_MAX_CARDS)
    };
  }
}
