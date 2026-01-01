# Macros

Common macro examples for Calendaria automation.

## Time Control

### Advance Time

```javascript
// Advance 1 hour
await CALENDARIA.api.advanceTime({ hour: 1 });

// Advance 8 hours (long rest)
await CALENDARIA.api.advanceTime({ hour: 8 });

// Advance 1 day
await CALENDARIA.api.advanceTime({ day: 1 });

// Advance 1 week
await CALENDARIA.api.advanceTime({ day: 7 });
```

### Short Rest (1 hour)

```javascript
await CALENDARIA.api.advanceTime({ hour: 1 });
ui.notifications.info("Short rest complete. 1 hour has passed.");
```

### Long Rest (8 hours)

```javascript
await CALENDARIA.api.advanceTime({ hour: 8 });
ui.notifications.info("Long rest complete. 8 hours have passed.");
```

### Advance to Specific Time

```javascript
// Jump to 6:00 AM
const now = CALENDARIA.api.getCurrentDateTime();
let hoursToAdvance = 6 - now.hour;
if (hoursToAdvance <= 0) hoursToAdvance += 24;
await CALENDARIA.api.advanceTime({ hour: hoursToAdvance });
```

---

## Display Information

### Show Current Date/Time

```javascript
const now = CALENDARIA.api.getCurrentDateTime();
const formatted = CALENDARIA.api.formatDate(now, 'datetime');
ChatMessage.create({
  content: `<b>Current Time:</b> ${formatted}`
});
```

### Show Weather

```javascript
const weather = CALENDARIA.api.getWeather();
ChatMessage.create({
  content: `<b>Weather:</b> ${weather.condition}, ${weather.temperature}°`
});
```

### Show Moon Phase

```javascript
const phase = CALENDARIA.api.getMoonPhase(0);
ChatMessage.create({
  content: `<b>Moon:</b> ${phase.name}`
});
```

### Show Season

```javascript
const season = CALENDARIA.api.getCurrentSeason();
ChatMessage.create({
  content: `<b>Season:</b> ${season.name}`
});
```

---

## Check Conditions

### Is It Night?

```javascript
const now = CALENDARIA.api.getCurrentDateTime();
const sunrise = CALENDARIA.api.getSunrise();
const sunset = CALENDARIA.api.getSunset();

const isNight = now.hour < sunrise || now.hour >= sunset;
ui.notifications.info(isNight ? "It is nighttime" : "It is daytime");
```

### Is It a Full Moon?

```javascript
const phase = CALENDARIA.api.getMoonPhase(0);
if (phase.name.toLowerCase().includes("full")) {
  ui.notifications.warn("The moon is full!");
}
```

### Is Today a Festival?

```javascript
if (CALENDARIA.api.isFestivalDay()) {
  const festival = CALENDARIA.api.getCurrentFestival();
  ui.notifications.info(`Today is ${festival.name}!`);
}
```

---

## Notes Management

### Create a Quick Note

```javascript
const now = CALENDARIA.api.getCurrentDateTime();
await CALENDARIA.api.createNote({
  name: "Session Note",
  content: "<p>Something important happened here.</p>",
  startDate: { year: now.year, month: now.month, day: now.day },
  allDay: true
});
ui.notifications.info("Note created!");
```

### List Today's Events

```javascript
const now = CALENDARIA.api.getCurrentDateTime();
const notes = await CALENDARIA.api.getNotesForDate(now.year, now.month, now.day);

if (notes.length === 0) {
  ui.notifications.info("No events today");
} else {
  const list = notes.map(n => n.name).join(", ");
  ui.notifications.info(`Today: ${list}`);
}
```

---

## Weather

### Generate New Weather

```javascript
await CALENDARIA.api.generateWeather();
const weather = CALENDARIA.api.getWeather();
ui.notifications.info(`New weather: ${weather.condition}`);
```

### Set Specific Weather

```javascript
// Options: clear, cloudy, rain, thunderstorm, snow, fog, etc.
await CALENDARIA.api.setWeather("thunderstorm", 55);
ui.notifications.info("A storm rolls in!");
```

---

## Travel Time

### Travel by Distance

```javascript
// Calculate travel time (assuming 3 mph walking speed)
const miles = 24;
const speed = 3; // mph
const hours = Math.ceil(miles / speed);

await CALENDARIA.api.advanceTime({ hour: hours });
ui.notifications.info(`Traveled ${miles} miles in ${hours} hours.`);
```

### Travel with Rest

```javascript
// 8 hours travel, 8 hours rest, repeat for days
const travelDays = 3;
for (let i = 0; i < travelDays; i++) {
  await CALENDARIA.api.advanceTime({ hour: 8 }); // Travel
  await CALENDARIA.api.advanceTime({ hour: 8 }); // Rest
  await CALENDARIA.api.advanceTime({ hour: 8 }); // Downtime
}
ui.notifications.info(`${travelDays} days of travel complete.`);
```

---

## Dialog-Based Macros

### Time Advance Dialog

```javascript
new Dialog({
  title: "Advance Time",
  content: `
    <form>
      <div class="form-group">
        <label>Hours:</label>
        <input type="number" name="hours" value="1" min="0">
      </div>
      <div class="form-group">
        <label>Days:</label>
        <input type="number" name="days" value="0" min="0">
      </div>
    </form>
  `,
  buttons: {
    advance: {
      label: "Advance",
      callback: async (html) => {
        const hours = parseInt(html.find('[name="hours"]').val()) || 0;
        const days = parseInt(html.find('[name="days"]').val()) || 0;
        await CALENDARIA.api.advanceTime({ hour: hours, day: days });
        ui.notifications.info(`Advanced ${days} days, ${hours} hours`);
      }
    },
    cancel: { label: "Cancel" }
  }
}).render(true);
```

---

## Hook-Based Automation

### Announce Sunrise

```javascript
// Put this in a world script or always-on macro
Hooks.on("calendaria.sunrise", () => {
  ChatMessage.create({
    content: "<b>The sun rises.</b> A new day begins."
  });
});
```

### Full Moon Warning

```javascript
Hooks.on("calendaria.moonPhaseChange", (data) => {
  for (const moon of data.moons) {
    if (moon.phase.toLowerCase().includes("full")) {
      ChatMessage.create({
        content: `<b>${moon.name} is full!</b> Beware the creatures of the night.`,
        whisper: game.users.filter(u => u.isGM).map(u => u.id)
      });
    }
  }
});
```
