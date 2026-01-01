# Weather System

Calendaria includes a weather generation system with climate zones, seasonal temperatures, and 27 weather presets.

## Current Weather

### Viewing Weather

The current weather displays as a badge in the HUD info bar. Hover for details including:

- Condition name
- Temperature
- Description

### Regenerating Weather

Click the weather badge to generate new weather based on your climate zone settings.

---

## Weather Presets

Calendaria includes 27 weather conditions across four categories:

### Standard

| Condition | Description |
|-----------|-------------|
| Clear | Blue skies, no clouds |
| Partly Cloudy | Scattered clouds |
| Cloudy | Overcast |
| Light Rain | Drizzle |
| Rain | Steady rain |
| Heavy Rain | Downpour |
| Thunderstorm | Rain with lightning |
| Light Snow | Flurries |
| Snow | Steady snowfall |
| Heavy Snow | Blizzard conditions |
| Sleet | Mixed rain and snow |
| Hail | Ice pellets |

### Severe

| Condition | Description |
|-----------|-------------|
| Hurricane | Extreme winds and rain |
| Tornado | Violent rotating winds |
| Blizzard | Heavy snow with high winds |
| Ice Storm | Freezing rain |

### Environmental

| Condition | Description |
|-----------|-------------|
| Fog | Low visibility |
| Mist | Light fog |
| Dust Storm | Airborne dust/sand |
| Heat Wave | Extreme heat |
| Cold Snap | Extreme cold |
| Drought | No precipitation |

### Fantasy

| Condition | Description |
|-----------|-------------|
| Magical Storm | Arcane disturbance |
| Blood Rain | Ominous red precipitation |
| Ashfall | Volcanic ash |
| Wild Magic | Unstable magical weather |
| Fey Mist | Enchanted fog |

---

## Climate Zones

Climate zones define temperature ranges and weather probabilities for different regions.

### Default Temperate Zone

The default climate provides realistic temperate weather with seasonal variation.

### Creating Climate Zones

1. Open **Calendar Editor** → **Weather** tab
2. Click **Add Climate Zone**
3. Set **Name** (e.g., "Northern Tundra")
4. Configure seasonal temperatures:
   - Winter: -20°F to 10°F
   - Spring: 30°F to 55°F
   - Summer: 55°F to 75°F
   - Fall: 35°F to 55°F
5. Set weather chances for each condition

### Weather Chances

Assign percentage chances for each weather type. Chances should total 100% per season.

Example for a rainy region:
- Clear: 20%
- Cloudy: 30%
- Rain: 35%
- Heavy Rain: 15%

---

## Manual Weather Selection

### Weather Picker

Open the weather picker to manually set conditions:

1. Click the weather badge in the HUD
2. Select **Choose Weather**
3. Pick a condition from the list
4. Optionally set temperature

### Via API

```javascript
// Set specific weather
await CALENDARIA.api.setWeather("thunderstorm", 72);

// Generate random weather from climate zone
await CALENDARIA.api.generateWeather();
```

---

## Temperature Units

Configure Celsius or Fahrenheit:

1. Go to **Settings** → **Module Settings** → **Calendaria**
2. Find **Temperature Unit**
3. Select your preference

---

## Weather Hooks

React to weather changes in your modules or macros:

```javascript
Hooks.on("calendaria.weatherChange", (weather) => {
  console.log(`Weather changed to ${weather.condition}`);
  console.log(`Temperature: ${weather.temperature}°`);
});
```

---

## API Reference

### getWeather()

Get current weather conditions.

```javascript
const weather = CALENDARIA.api.getWeather();
// Returns: { condition: "Rain", temperature: 58, description: "Steady rain" }
```

### setWeather(condition, temperature)

Set weather manually.

```javascript
await CALENDARIA.api.setWeather("clear", 75);
```

### generateWeather()

Generate weather based on current climate zone and season.

```javascript
await CALENDARIA.api.generateWeather();
```

### getWeatherForecast(days)

Get a forecast for upcoming days.

```javascript
const forecast = await CALENDARIA.api.getWeatherForecast(7);
// Returns array of weather predictions
```

---

## Integration Ideas

- Trigger weather-based encounters (storms bring monsters)
- Apply weather modifiers to travel pace
- Use weather for atmospheric scene descriptions
- Connect to lighting/sound modules for ambiance
