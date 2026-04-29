/**
 * Keyframe builder for the Cinematic Time Skip animation.
 * @module CinematicKeyframeBuilder
 * @author Tyler
 */

import { NoteManager } from '../../notes/_module.mjs';
import { formatForLocation, localize } from '../../utils/_module.mjs';
import { WeatherManager } from '../../weather/_module.mjs';

/** @type {number} */
const MAX_KEYFRAMES = 60;

/** Builds keyframe snapshots for cinematic time skip animations. */
export default class CinematicKeyframeBuilder {
  /**
   * Build an array of keyframe snapshots for a time range.
   * @param {number} startTime - Current world time (seconds)
   * @param {number} endTime - Target world time (seconds)
   * @param {object} calendar - CalendariaCalendar instance
   * @param {object} settings - Cinematic settings snapshot
   * @returns {object[]} Array of keyframe objects
   */
  static build(startTime, endTime, calendar, settings) {
    const secondsPerDay = this.#getSecondsPerDay(calendar);
    const totalDays = Math.ceil((endTime - startTime) / secondsPerDay);
    const interval = this.#getSampleInterval(totalDays, calendar);
    const startComponents = calendar.timeToComponents(startTime);
    const endComponents = calendar.timeToComponents(endTime);
    const festivalDates = this.#getFestivalDates(startComponents, endComponents, calendar, settings);
    const keyframes = [];
    let prevKeyframe = null;
    for (let day = 1; day <= totalDays && keyframes.length < MAX_KEYFRAMES; day += interval) {
      const worldTime = startTime + day * secondsPerDay;
      if (worldTime > endTime) break;
      const components = calendar.timeToComponents(worldTime);
      const date = { year: components.year, month: components.month, dayOfMonth: components.dayOfMonth };
      const kf = this.#buildKeyframe(date, worldTime, calendar, prevKeyframe, settings);
      keyframes.push(kf);
      prevKeyframe = kf;
    }
    for (const fDate of festivalDates) {
      const already = keyframes.some((kf) => kf.date.year === fDate.year && kf.date.month === fDate.month && kf.date.dayOfMonth === fDate.dayOfMonth);
      if (already || keyframes.length >= MAX_KEYFRAMES) continue;
      const fWorldTime = calendar.componentsToTime({ ...fDate, hour: 0, minute: 0, second: 0 });
      if (fWorldTime < startTime || fWorldTime > endTime) continue;
      keyframes.push(this.#buildKeyframe(fDate, fWorldTime, calendar, null, settings));
    }
    const lastKf = keyframes[keyframes.length - 1];
    const endDate = { year: endComponents.year, month: endComponents.month, dayOfMonth: endComponents.dayOfMonth };
    if (!lastKf || lastKf.worldTime !== endTime) keyframes.push(this.#buildKeyframe(endDate, endTime, calendar, lastKf, settings));
    keyframes.sort((a, b) => a.worldTime - b.worldTime);
    for (let i = 1; i < keyframes.length; i++) {
      if (keyframes[i].seasonLabel === keyframes[i - 1].seasonLabel) {
        keyframes[i].seasonLabel = null;
        keyframes[i].seasonColor = null;
      }
    }
    return keyframes;
  }

  /**
   * Determine sampling interval based on skip duration and calendar structure.
   * @param {number} totalDays - Total days in the skip
   * @param {object} calendar - Calendar instance
   * @returns {number} Sample every Nth day
   */
  static #getSampleInterval(totalDays, calendar) {
    const daysPerWeek = calendar?.weekdaysArray?.length ?? 7;
    const daysPerMonth = calendar?.monthsArray?.[0]?.days ?? 30;
    const daysPerYear = calendar?.days?.daysPerYear ?? 365;
    const daysPerSeason = calendar?.seasonsArray?.length ? Math.floor(daysPerYear / calendar.seasonsArray.length) : Math.floor(daysPerYear / 4);
    if (totalDays <= daysPerMonth) return 1;
    if (totalDays <= daysPerMonth * 3) return daysPerWeek;
    if (totalDays <= daysPerMonth * 6) return daysPerWeek * 2;
    if (totalDays <= daysPerYear) return daysPerMonth;
    if (totalDays <= daysPerYear * 5) return daysPerSeason;
    return Math.max(daysPerYear, Math.ceil(totalDays / MAX_KEYFRAMES));
  }

  /**
   * Build a single keyframe snapshot for a date.
   * @param {object} date - { year, month, dayOfMonth }
   * @param {number} worldTime - World time in seconds
   * @param {object} calendar - Calendar instance
   * @param {object|null} prevKeyframe - Previous keyframe for change detection
   * @param {object} settings - Cinematic settings snapshot
   * @returns {object} Keyframe object
   */
  static #buildKeyframe(date, worldTime, calendar, prevKeyframe, settings) {
    const components = { ...date, hour: 12, minute: 0, second: 0 };
    const dateLabel = formatForLocation(calendar, components, 'cinematicDate');
    const season = calendar.getCurrentSeason?.(worldTime);
    const seasonLabel = season ? localize(season.name) : null;
    const seasonColor = season?.color ?? null;
    const seasonChanged = prevKeyframe ? seasonLabel !== prevKeyframe.seasonLabel : !!seasonLabel;
    let weather = null;
    if (settings.showWeather) {
      const w = WeatherManager.getWeatherForDate(date.year, date.month, date.dayOfMonth) ?? WeatherManager.getCurrentWeather?.();
      if (w) {
        const windKph = w.wind?.speed ? WeatherManager.getWindSpeedKph(w.wind.speed) : null;
        weather = {
          id: w.id,
          label: localize(w.label ?? w.id),
          icon: w.icon ?? null,
          color: w.color ?? null,
          temperature: w.temperature != null ? WeatherManager.formatTemperature(w.temperature) : null,
          wind: windKph ? WeatherManager.formatWindSpeed(windKph) : null,
          windDirection: w.wind?.direction != null ? WeatherManager.getWindDirectionLabel(w.wind.direction) : null
        };
      }
    }
    const moons = [];
    if (settings.showMoons && calendar.moonsArray?.length) {
      for (let i = 0; i < calendar.moonsArray.length; i++) {
        const moonDef = calendar.moonsArray[i];
        const phase = calendar.getMoonPhase(i, worldTime);
        if (!phase) continue;
        const phases = moonDef.phases ? Object.values(moonDef.phases) : [];
        moons.push({
          name: localize(moonDef.name),
          color: moonDef.color ?? '#cccccc',
          phaseName: phase.name ? localize(phase.name) : '',
          phaseIcon: phase.icon ?? '',
          phaseIndex: phase.phaseIndex ?? 0,
          position: phase.position ?? 0,
          cycleLength: moonDef.cycleLength ?? 28,
          allPhases: phases.map((p) => ({ name: p.name ? localize(p.name) : '', icon: p.icon ?? '' }))
        });
      }
    }
    const events = settings.showEvents ? this.#gatherEvents(date, settings) : [];
    return {
      worldTime,
      date,
      dateLabel,
      seasonLabel: seasonChanged ? seasonLabel : null,
      seasonColor: seasonChanged ? seasonColor : null,
      weather,
      moons,
      events,
      isFestival: events.some((e) => e.isFestival)
    };
  }

  /**
   * Gather visible events for a date, filtered by weighting settings.
   * @param {object} date - { year, month, dayOfMonth }
   * @param {object} settings - Cinematic settings snapshot
   * @returns {object[]} Filtered event array
   */
  static #gatherEvents(date, settings) {
    const notes = NoteManager.getNotesForDate(date.year, date.month, date.dayOfMonth);
    if (!notes?.length) return [];
    const mapped = notes.map((note) => ({
      id: note.id,
      name: note.name,
      icon: note.flagData?.icon ?? 'fas fa-bookmark',
      color: note.flagData?.color ?? null,
      isFestival: !!note.flagData?.linkedFestival
    }));
    if (settings.eventWeighting === 'festivals-only') return mapped.filter((e) => e.isFestival);
    if (settings.eventWeighting === 'weighted') {
      const festivals = mapped.filter((e) => e.isFestival);
      const regular = mapped.filter((e) => !e.isFestival);
      return [...festivals, ...regular].slice(0, settings.eventMaxCards);
    }
    return mapped.slice(0, settings.eventMaxCards);
  }

  /**
   * Collect festival dates in range for guaranteed keyframe inclusion.
   * @param {object} startDate - Start date components
   * @param {object} endDate - End date components
   * @param {object} _calendar - Calendar instance
   * @param {object} settings - Cinematic settings snapshot
   * @returns {object[]} Array of { year, month, dayOfMonth }
   */
  static #getFestivalDates(startDate, endDate, _calendar, settings) {
    if (!settings.showEvents) return [];
    const notes = NoteManager.getNotesInRange?.(startDate, endDate) ?? [];
    return notes.filter((n) => !!n.flagData?.linkedFestival).map((n) => ({ year: n.flagData.startDate.year, month: n.flagData.startDate.month, dayOfMonth: n.flagData.startDate.dayOfMonth }));
  }

  /**
   * Calculate seconds per calendar day.
   * @param {object} calendar - Calendar instance
   * @returns {number} Seconds per day
   */
  static #getSecondsPerDay(calendar) {
    const hours = calendar?.days?.hoursPerDay ?? 24;
    const minutes = calendar?.days?.minutesPerHour ?? 60;
    const seconds = calendar?.days?.secondsPerMinute ?? 60;
    return hours * minutes * seconds;
  }
}
