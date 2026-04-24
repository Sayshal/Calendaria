import { vi } from 'vitest';

export function addCalendarGetters(cal) {
  Object.defineProperties(cal, {
    monthsArray: { get() { return this.months?.values ? Object.values(this.months.values) : []; }, configurable: true, enumerable: true },
    weekdaysArray: { get() { return this.days?.values ? Object.values(this.days.values) : []; }, configurable: true, enumerable: true },
    seasonsArray: { get() { return this.seasons?.values ? Object.values(this.seasons.values) : []; }, configurable: true, enumerable: true },
    moonsArray: { get() { return this.moons ? Object.values(this.moons) : []; }, configurable: true, enumerable: true },
    cyclesArray: { get() { return this.cycles ? Object.values(this.cycles) : []; }, configurable: true, enumerable: true },
    erasArray: { get() { return this.eras ? Object.values(this.eras) : []; }, configurable: true, enumerable: true },
    festivalsArray: { get() { return this.festivals ? Object.values(this.festivals) : []; }, configurable: true, enumerable: true },
    daysInWeek: { get() { return this.weekdaysArray?.length || 7; }, configurable: true, enumerable: true }
  });
  return cal;
}

const defaultCalendar = addCalendarGetters({
  months: {
    values: [
      { name: 'January', abbreviation: 'Jan', days: 31 },
      { name: 'February', abbreviation: 'Feb', days: 28 },
      { name: 'March', abbreviation: 'Mar', days: 31 },
      { name: 'April', abbreviation: 'Apr', days: 30 },
      { name: 'May', abbreviation: 'May', days: 31 },
      { name: 'June', abbreviation: 'Jun', days: 30 },
      { name: 'July', abbreviation: 'Jul', days: 31 },
      { name: 'August', abbreviation: 'Aug', days: 31 },
      { name: 'September', abbreviation: 'Sep', days: 30 },
      { name: 'October', abbreviation: 'Oct', days: 31 },
      { name: 'November', abbreviation: 'Nov', days: 30 },
      { name: 'December', abbreviation: 'Dec', days: 31 }
    ]
  },
  days: {
    values: [
      { name: 'Sunday', abbreviation: 'Sun' },
      { name: 'Monday', abbreviation: 'Mon' },
      { name: 'Tuesday', abbreviation: 'Tue' },
      { name: 'Wednesday', abbreviation: 'Wed' },
      { name: 'Thursday', abbreviation: 'Thu' },
      { name: 'Friday', abbreviation: 'Fri' },
      { name: 'Saturday', abbreviation: 'Sat' }
    ],
    hoursPerDay: 24,
    minutesPerHour: 60,
    secondsPerMinute: 60,
    daysPerYear: 365
  },
  years: { yearZero: 0, firstWeekday: 0 },
  isMonthless: false,
  moons: [
    {
      name: 'Luna',
      cycleLength: 29.5,
      referenceDate: { year: 2000, month: 0, day: 6 },
      cycleDayAdjust: 0,
      phases: [
        { name: 'New Moon', start: 0, end: 0.125 },
        { name: 'Waxing Crescent', start: 0.125, end: 0.25 },
        { name: 'First Quarter', start: 0.25, end: 0.375 },
        { name: 'Waxing Gibbous', start: 0.375, end: 0.5 },
        { name: 'Full Moon', start: 0.5, end: 0.625 },
        { name: 'Waning Gibbous', start: 0.625, end: 0.75 },
        { name: 'Last Quarter', start: 0.75, end: 0.875 },
        { name: 'Waning Crescent', start: 0.875, end: 1 }
      ]
    }
  ],
  seasons: {
    values: [
      { name: 'Spring', seasonalType: 'spring', dayStart: 80, dayEnd: 171 },
      { name: 'Summer', seasonalType: 'summer', dayStart: 172, dayEnd: 264 },
      { name: 'Autumn', seasonalType: 'autumn', dayStart: 265, dayEnd: 354 },
      { name: 'Winter', seasonalType: 'winter', dayStart: 355, dayEnd: 79 }
    ]
  },
  eras: [
    { name: 'First Age', abbreviation: 'FA', startYear: 1, endYear: 999 },
    { name: 'Second Age', abbreviation: 'SA', startYear: 1000, endYear: 1999 },
    { name: 'Third Age', abbreviation: 'TA', startYear: 2000 }
  ],
  cycles: [
    { name: 'Weekday Cycle', length: 7, basedOn: 'day', offset: 0, entries: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }
  ],
  daylight: { summerSolstice: 172, winterSolstice: 355 },

  getDaysInMonth: vi.fn((month, year) => {
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return days[month] || 30;
  }),

  getDaysInYear: vi.fn((year) => 365),

  componentsToTime: vi.fn((components) => {
    const hoursPerDay = 24;
    const minutesPerHour = 60;
    const secondsPerMinute = 60;
    const secondsPerHour = minutesPerHour * secondsPerMinute;
    const secondsPerDay = hoursPerDay * secondsPerHour;
    const daysPerYear = 365;
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let totalDays = components.year * daysPerYear;
    if (components.month != null || components.dayOfMonth != null) {
      for (let m = 0; m < (components.month || 0); m++) totalDays += days[m];
      totalDays += components.dayOfMonth || 0;
    } else {
      totalDays += components.day || 0;
    }
    const hours = components.hour || 0;
    const minutes = components.minute || 0;
    const seconds = components.second || 0;
    return totalDays * secondsPerDay + hours * secondsPerHour + minutes * secondsPerMinute + seconds;
  }),

  timeToComponents: vi.fn((time) => {
    const hoursPerDay = 24;
    const minutesPerHour = 60;
    const secondsPerMinute = 60;
    const secondsPerHour = minutesPerHour * secondsPerMinute;
    const secondsPerDay = hoursPerDay * secondsPerHour;
    const daysPerYear = 365;
    const totalDays = Math.floor(time / secondsPerDay);
    const remainingSeconds = time % secondsPerDay;
    const year = Math.floor(totalDays / daysPerYear);
    const dayOfYear = totalDays % daysPerYear;
    const hour = Math.floor(remainingSeconds / secondsPerHour);
    const minute = Math.floor((remainingSeconds % secondsPerHour) / secondsPerMinute);
    const second = remainingSeconds % secondsPerMinute;
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let month = 0;
    let dayOfMonth = dayOfYear;
    for (let i = 0; i < days.length; i++) {
      if (dayOfMonth < days[i]) {
        month = i;
        break;
      }
      dayOfMonth -= days[i];
    }
    return { year, month, dayOfMonth, hour, minute, second };
  }),

  countNonWeekdayFestivalsBefore: vi.fn(() => 0),
  countNonWeekdayFestivalsBeforeYear: vi.fn(() => 0),
  countIntercalaryDaysBefore: vi.fn(() => 0),
  countIntercalaryDaysBeforeYear: vi.fn(() => 0),

  _computeDayOfWeek: vi.fn((components) => {
    const daysInWeek = 7;
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let dayOfYear = components.dayOfMonth ?? 0;
    for (let m = 0; m < (components.month || 0); m++) dayOfYear += days[m];
    const totalDays = (components.year || 0) * 365 + dayOfYear;
    return ((totalDays % daysInWeek) + daysInWeek) % daysInWeek;
  }),

  isLeapYear: vi.fn((year) => year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)),

  getMoonPhase: vi.fn((moonIndex, components) => {
    const moon = defaultCalendar.moonsArray[moonIndex];
    if (!moon) return null;
    const refDate = moon.referenceDate || { year: 2000, month: 0, day: 6 };
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let totalDays = 0;
    totalDays += (components.year - refDate.year) * 365;
    for (let m = 0; m < components.month; m++) totalDays += days[m];
    totalDays += components.dayOfMonth + 1;
    for (let m = 0; m < refDate.month; m++) totalDays -= days[m];
    totalDays -= refDate.day;
    const cyclePosition = ((totalDays % moon.cycleLength) + moon.cycleLength) % moon.cycleLength;
    const position = cyclePosition / moon.cycleLength;
    const phaseCount = Object.keys(moon.phases).length;
    const phaseIndex = Math.floor(position * phaseCount);
    const phaseFraction = 1 / phaseCount;
    const phaseStartPos = phaseIndex * phaseFraction;
    const phaseDuration = Math.round(moon.cycleLength * phaseFraction);
    const dayWithinPhase = Math.floor((position - phaseStartPos) * moon.cycleLength);
    return { position, phase: moon.phases[phaseIndex], phaseIndex, dayWithinPhase, phaseDuration };
  })
});

let activeCalendar = { ...defaultCalendar };
addCalendarGetters(activeCalendar);

const CalendarManager = {
  getActiveCalendar: vi.fn(() => activeCalendar),
  setActiveCalendar: vi.fn((calendar) => {
    activeCalendar = calendar;
  }),

  _reset: () => {
    activeCalendar = addCalendarGetters({
      ...defaultCalendar,
      getDaysInMonth: vi.fn(defaultCalendar.getDaysInMonth),
      getDaysInYear: vi.fn(defaultCalendar.getDaysInYear),
      componentsToTime: vi.fn(defaultCalendar.componentsToTime),
      timeToComponents: vi.fn(defaultCalendar.timeToComponents),
      countNonWeekdayFestivalsBefore: vi.fn(() => 0),
      countNonWeekdayFestivalsBeforeYear: vi.fn(() => 0),
      countIntercalaryDaysBefore: vi.fn(() => 0),
      countIntercalaryDaysBeforeYear: vi.fn(() => 0),
      _computeDayOfWeek: vi.fn(defaultCalendar._computeDayOfWeek),
      isLeapYear: vi.fn(defaultCalendar.isLeapYear),
      getMoonPhase: vi.fn(defaultCalendar.getMoonPhase)
    });
  },

  _configure: (config) => {
    activeCalendar = addCalendarGetters({
      ...activeCalendar,
      ...config,
      getDaysInMonth: config.getDaysInMonth || activeCalendar.getDaysInMonth,
      getDaysInYear: config.getDaysInYear || activeCalendar.getDaysInYear,
      componentsToTime: config.componentsToTime || activeCalendar.componentsToTime,
      timeToComponents: config.timeToComponents || activeCalendar.timeToComponents,
      isLeapYear: config.isLeapYear || activeCalendar.isLeapYear,
      getMoonPhase: config.getMoonPhase || activeCalendar.getMoonPhase
    });
  },

  _getDefault: () => ({ ...defaultCalendar })
};

export default CalendarManager;
export { defaultCalendar };
