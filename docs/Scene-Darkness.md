# Scene Darkness

Calendaria can automatically adjust scene darkness based on the time of day. As in-game time passes, scenes transition from bright daylight to dark night.

## How It Works

Scene darkness follows a cosine curve tied to the sun's position:

- **Noon (12:00)** — Brightest (0.0 darkness)
- **Midnight (00:00)** — Darkest (1.0 darkness)
- **Dawn/Dusk** — Gradual transitions

The calculation uses your calendar's sunrise and sunset times, which can vary by season.

---

## Enabling Darkness Sync

### Global Setting

1. Go to **Settings** → **Module Settings** → **Calendaria**
2. Find **Sync Scene Darkness**
3. Enable it

This applies to all scenes by default.

### Per-Scene Override

Override the global setting for individual scenes:

1. Open **Scene Configuration**
2. Go to the **Ambiance** tab
3. Find **Darkness Sync**
4. Choose:
   - **Use Global Setting** — Follow the module setting
   - **Enabled** — Always sync this scene
   - **Disabled** — Never sync this scene

---

## Seasonal Variation

If your calendar has daylight configuration (summer/winter solstice settings), sunrise and sunset times vary throughout the year:

- **Summer** — Longer days, shorter nights
- **Winter** — Shorter days, longer nights
- **Equinoxes** — Equal day and night

Configure this in the **Calendar Editor** → **Seasons** tab → **Daylight Configuration**.

---

## Smooth Transitions

Darkness changes use smooth interpolation with `requestAnimationFrame`. When time advances, darkness doesn't jump instantly but transitions smoothly over a brief period.

---

## API Access

### Get Current Daylight Info

```javascript
// Sunrise time today
const sunrise = CALENDARIA.api.getSunrise();
// Returns: { hour: 6, minute: 30 }

// Sunset time today
const sunset = CALENDARIA.api.getSunset();
// Returns: { hour: 19, minute: 45 }

// Hours of daylight
const daylight = CALENDARIA.api.getDaylightHours();
// Returns: 13.25
```

### Day Progress

```javascript
// How far through daylight hours (0-1)
const dayProgress = CALENDARIA.api.getProgressDay();

// How far through night hours (0-1)
const nightProgress = CALENDARIA.api.getProgressNight();
```

### Time Until Events

```javascript
// Seconds until sunrise
const untilSunrise = CALENDARIA.api.getTimeUntilSunrise();

// Seconds until sunset
const untilSunset = CALENDARIA.api.getTimeUntilSunset();

// Seconds until midnight
const untilMidnight = CALENDARIA.api.getTimeUntilMidnight();

// Seconds until midday
const untilMidday = CALENDARIA.api.getTimeUntilMidday();
```

---

## Use Cases

### Vampire Campaigns

Track when it's safe for vampires to emerge. Use the API to check if it's currently night:

```javascript
const now = CALENDARIA.api.getCurrentDateTime();
const sunrise = CALENDARIA.api.getSunrise();
const sunset = CALENDARIA.api.getSunset();

const isNight = now.hour < sunrise.hour || now.hour >= sunset.hour;
```

### Travel Encounters

Adjust encounter difficulty based on time of day. Night encounters might be more dangerous.

### Stealth Missions

Plan heists for the darkest hours. Check darkness level before proceeding.

---

## Troubleshooting

### Darkness Not Changing

1. Verify **Sync Scene Darkness** is enabled
2. Check the scene override isn't set to Disabled
3. Ensure world time is advancing
4. Confirm you're viewing the active scene

### Darkness Too Dark/Bright

The darkness calculation uses calendar sunrise/sunset. If times seem wrong:

1. Open **Calendar Editor** → **Seasons** tab
2. Check **Daylight Configuration**
3. Adjust solstice dates and times

### Jumpy Transitions

If darkness jumps instead of transitioning smoothly, time might be advancing in large increments. Smaller time steps produce smoother transitions.
