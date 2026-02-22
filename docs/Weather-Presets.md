# Weather Presets

Complete reference for all 42 built-in weather presets across four categories, plus support for custom presets.

> [!NOTE]
> Chance values are proportional weights, not percentages. A preset with `chance: 10` is twice as likely as one with `chance: 5` when both are enabled in the same zone.

## Standard (13 presets)

Common everyday weather conditions.

| ID              | Name          | Icon                      | Color     | Chance | Temp °C     | Darkness | Wind         | Precip        | Inertia | HUD Effect        | FX Preset       | Sound                       |
| --------------- | ------------- | ------------------------- | --------- | ------ | ----------- | -------- | ------------ | ------------- | ------- | ----------------- | --------------- | --------------------------- |
| `clear`         | Clear         | `fa-sun`                  | `#FFEE88` | `15`   | `18` – `32` | `0`      | `0` Calm     | —             | `1.2`   | `clear`           | —               | —                           |
| `partly-cloudy` | Partly Cloudy | `fa-cloud-sun`            | `#D0E8FF` | `18`   | `15` – `28` | `0`      | `1` Light    | —             | `1.0`   | `clouds-light`    | `partly-cloudy` | —                           |
| `cloudy`        | Cloudy        | `fa-cloud`                | `#B0C4DE` | `14`   | `12` – `24` | `0`      | `1` Light    | —             | `1.2`   | `clouds-heavy`    | `cloudy`        | —                           |
| `overcast`      | Overcast      | `fa-smog`                 | `#CCCCCC` | `10`   | `10` – `20` | `0.05`   | `1` Light    | —             | `1.5`   | `clouds-overcast` | `overcast`      | —                           |
| `drizzle`       | Drizzle       | `fa-cloud-rain`           | `#CDEFFF` | `8`    | `8` – `18`  | `0`      | `0` Calm     | Drizzle `0.2` | `1.0`   | `rain`            | `drizzle`       | `sunshower-drizzle`         |
| `rain`          | Rain          | `fa-cloud-showers-heavy`  | `#A0D8EF` | `10`   | `10` – `22` | `0.05`   | `2` Moderate | Rain `0.6`    | `1.3`   | `rain`            | `rain`          | `rain-acid-rain-blood-rain` |
| `fog`           | Fog           | `fa-smog`                 | `#E6E6E6` | `5`    | `5` – `15`  | `0.05`   | `0` Calm     | Drizzle `0.1` | `1.5`   | `fog`             | `fog`           | —                           |
| `mist`          | Mist          | `fa-water`                | `#F0F8FF` | `4`    | `8` – `18`  | `0`      | `0` Calm     | —             | `1.0`   | `fog`             | `mist`          | —                           |
| `windy`         | Windy         | `fa-wind`                 | `#E0F7FA` | `4`    | `10` – `25` | `0`      | `3` Strong   | —             | `1.0`   | `gust`            | `windy` ✦       | `wind`                      |
| `sunshower`     | Sunshower     | `fa-cloud-sun-rain`       | `#FCEABB` | `2`    | `15` – `26` | `0`      | `1` Light    | Rain `0.3`    | `0`     | `rain`            | `sunshower` ★   | `sunshower-drizzle`         |
| `snow`          | Snow          | `fa-snowflake`            | `#FFFFFF` | `1`    | `−10` – `2` | `0`      | `1` Light    | Snow `0.5`    | `1.3`   | `snow`            | `snow`          | `snow-frost`                |
| `sleet`         | Sleet         | `fa-cloud-rain`           | `#C0D8E8` | `1`    | `−2` – `4`  | `0.05`   | `2` Moderate | Sleet `0.5`   | `1.0`   | `sleet`           | `sleet`         | `sleet-hail`                |
| `heat-wave`     | Heat Wave     | `fa-temperature-arrow-up` | `#FF9944` | `1`    | `35` – `48` | `0`      | `0` Calm     | —             | `1.5`   | `haze`            | `heat-wave`     | —                           |

✦ = FXMaster+ only, ★ = Enhanced by FXMaster+

## Severe (7 presets)

Dangerous or extreme weather events. Most have **forced wind** — wind speed and direction are locked to the preset's values and cannot be modified by zone configuration.

| ID             | Name         | Icon                     | Color     | Chance | Temp °C      | Darkness | Wind          | Precip     | Inertia | HUD Effect   | FX Preset      | Sound                       |
| -------------- | ------------ | ------------------------ | --------- | ------ | ------------ | -------- | ------------- | ---------- | ------- | ------------ | -------------- | --------------------------- |
| `thunderstorm` | Thunderstorm | `fa-cloud-bolt`          | `#3D3560` | `2`    | `15` – `28`  | `0.1`    | `4` Severe †  | Rain `0.9` | `0.3`   | `lightning`  | `thunderstorm` | `thunderstorm`              |
| `blizzard`     | Blizzard     | `fa-snowflake`           | `#C8DCE8` | `0.5`  | `−20` – `−5` | `0.15`   | `5` Extreme † | Snow `1.0` | `0.5`   | `snow-heavy` | `blizzard` ★   | `blizzard-ice-storm`        |
| `hail`         | Hail         | `fa-cloud-meatball`      | `#D1EFFF` | `0.5`  | `5` – `18`   | `0.05`   | `3` Strong    | Hail `0.7` | `0.3`   | `hail`       | `hail`         | `sleet-hail`                |
| `tornado`      | Tornado      | `fa-tornado`             | `#4A5A3A` | `0.5`  | `18` – `35`  | `0.15`   | `5` Extreme † | Rain `0.8` | `0`     | `tornado`    | `tornado` ✦    | `hurricane-monsoon-tornado` |
| `hurricane`    | Hurricane    | `fa-hurricane`           | `#445566` | `0.5`  | `22` – `35`  | `0.15`   | `5` Extreme † | Rain `1.0` | `0`     | `hurricane`  | `hurricane`    | `hurricane-monsoon-tornado` |
| `ice-storm`    | Ice Storm    | `fa-icicles`             | `#A0C8E0` | `0.5`  | `−10` – `0`  | `0.1`    | `4` Severe †  | Hail `0.8` | `0.3`   | `ice`        | `ice-storm`    | `blizzard-ice-storm`        |
| `monsoon`      | Monsoon      | `fa-cloud-showers-water` | `#3A6080` | `0.5`  | `22` – `35`  | `0.1`    | `4` Severe †  | Rain `1.0` | `0.5`   | `rain-heavy` | `monsoon` ★    | `hurricane-monsoon-tornado` |

† = Forced wind (ignores zone config), ✦ = FXMaster+ only, ★ = Enhanced by FXMaster+

## Environmental (8 presets)

Location-specific natural phenomena.

| ID               | Name           | Icon         | Color     | Chance | Temp °C     | Darkness | Wind       | Precip | Inertia | HUD Effect | FX Preset        | Sound                  |
| ---------------- | -------------- | ------------ | --------- | ------ | ----------- | -------- | ---------- | ------ | ------- | ---------- | ---------------- | ---------------------- |
| `ashfall`        | Ashfall        | `fa-volcano` | `#8B5A30` | `1.5`  | `15` – `40` | `0.1`    | `1` Light  | —      | `0.5`   | `ashfall`  | `ashfall` ✦      | —                      |
| `sandstorm`      | Sandstorm      | `fa-wind`    | `#C49A44` | `1.5`  | `25` – `45` | `0.1`    | `4` Severe | —      | `0.3`   | `sand`     | `sandstorm` ✦    | `sandstorm-dust-devil` |
| `luminous-sky`   | Luminous Sky   | `fa-star`    | `#2E8B57` | `1.5`  | `−5` – `10` | `−0.1` ☀ | `0` Calm   | —      | `0`     | `aurora`   | `luminous-sky` ✦ | —                      |
| `sakura-bloom`   | Sakura Bloom   | `fa-spa`     | `#ffb7c5` | `1.5`  | `18` – `32` | `0`      | `1` Light  | —      | `0`     | `petals`   | `sakura-bloom` ✦ | —                      |
| `autumn-leaves`  | Autumn Leaves  | `fa-leaf`    | `#CC7733` | `1.5`  | `5` – `18`  | `0`      | `1` Light  | —      | `0`     | `leaves`   | `autumn-leaves`  | —                      |
| `rolling-fog`    | Rolling Fog    | `fa-smog`    | `#D0D0D0` | `1.5`  | `2` – `12`  | `0.05`   | `0` Calm   | —      | `1.5`   | `fog`      | `rolling-fog`    | —                      |
| `wildfire-smoke` | Wildfire Smoke | `fa-fire`    | `#8B6040` | `1`    | `20` – `40` | `0.1`    | `1` Light  | —      | `0.5`   | `smoke`    | `wildfire-smoke` | —                      |
| `dust-devil`     | Dust Devil     | `fa-wind`    | `#C8A060` | `1`    | `28` – `45` | `0.1`    | `3` Strong | —      | `0`     | `sand`     | `dust-devil` ✦   | `sandstorm-dust-devil` |

☀ = Negative darkness (brightens scene), ✦ = FXMaster+ only

## Fantasy (15 presets)

Magical or supernatural phenomena. All fantasy presets have `chance: 0` by default — they must be explicitly enabled and given a weight in the climate zone configuration to appear in auto-generation.

| ID                 | Name             | Icon               | Color     | Chance | Temp °C       | Darkness  | Wind         | Precip     | Inertia | HUD Effect    | FX Preset            | Sound                       |
| ------------------ | ---------------- | ------------------ | --------- | ------ | ------------- | --------- | ------------ | ---------- | ------- | ------------- | -------------------- | --------------------------- |
| `black-sun`        | Black Sun        | `fa-circle`        | `#1A0E22` | `0`    | `5` – `20`    | `0.3`     | `1` Light    | —          | `0`     | `void`        | `black-sun` ✦        | —                           |
| `ley-surge`        | Ley Surge        | `fa-wand-sparkles` | `#3A9BDC` | `0`    | `10` – `25`   | `−0.1` ☀  | `2` Moderate | —          | `0`     | `ley-surge`   | `ley-surge` ✦        | —                           |
| `aether-haze`      | Aether Haze      | `fa-smog`          | `#7B3F96` | `0`    | `12` – `22`   | `0.15`    | `0` Calm     | —          | `0`     | `aether`      | `aether-haze` ✦      | —                           |
| `nullfront`        | Nullfront        | `fa-ban`           | `#2A2030` | `0`    | `0` – `15`    | `0.15`    | `0` Calm     | —          | `0`     | `nullstatic`  | `nullfront`          | —                           |
| `permafrost-surge` | Permafrost Surge | `fa-icicles`       | `#A8D8EA` | `0`    | `−30` – `−10` | `0.1`     | `3` Strong   | Snow `0.4` | `0`     | `ice`         | `permafrost-surge` ✦ | `snow-frost`                |
| `gravewind`        | Gravewind        | `fa-ghost`         | `#3A5040` | `0`    | `5` – `18`    | `0.15`    | `3` Strong   | —          | `0`     | `spectral`    | `gravewind` ✦        | `wind`                      |
| `veilfall`         | Veilfall         | `fa-droplet`       | `#6A5A8E` | `0`    | `8` – `20`    | `0.1`     | `1` Light    | Rain `0.3` | `0`     | `veil`        | `veilfall` ✦         | —                           |
| `arcane-winds`     | Arcane Winds     | `fa-hat-wizard`    | `#8A40B0` | `0`    | `15` – `28`   | `−0.05` ☀ | `2` Moderate | —          | `0`     | `arcane-wind` | `arcane-winds` ✦     | `wind`                      |
| `acid-rain`        | Acid Rain        | `fa-flask`         | `#55BB33` | `0`    | `10` – `25`   | `0.05`    | `1` Light    | Rain `0.6` | `0`     | `rain-acid`   | `acid-rain`          | `rain-acid-rain-blood-rain` |
| `blood-rain`       | Blood Rain       | `fa-droplet`       | `#880022` | `0`    | `12` – `28`   | `0.1`     | `1` Light    | Rain `0.7` | `0`     | `rain-blood`  | `blood-rain`         | `rain-acid-rain-blood-rain` |
| `meteor-shower`    | Meteor Shower    | `fa-meteor`        | `#FF6622` | `0`    | `10` – `30`   | `−0.1` ☀  | `0` Calm     | —          | `0`     | `meteors`     | `meteor-shower` ✦    | —                           |
| `spore-cloud`      | Spore Cloud      | `fa-disease`       | `#88AA44` | `0`    | `15` – `28`   | `0.15`    | `0` Calm     | —          | `0`     | `spores`      | `spore-cloud`        | —                           |
| `divine-light`     | Divine Light     | `fa-sun`           | `#FFD700` | `0`    | `18` – `30`   | `−0.2` ☀  | `0` Calm     | —          | `0`     | `divine`      | `divine-light` ✦     | —                           |
| `plague-miasma`    | Plague Miasma    | `fa-biohazard`     | `#556B2F` | `0`    | `10` – `22`   | `0.25`    | `0` Calm     | —          | `0`     | `miasma`      | `plague-miasma` ✦    | —                           |

☀ = Negative darkness (brightens scene), ✦ = FXMaster+ only

## Custom Presets

GMs can create custom weather presets that appear alongside built-in ones under the "Custom" category. Custom presets are created via:

- **Weather Picker** — Check "Save as Preset" before saving
- **Weather Editor** — Click "Create New" in the sidebar
- **API** — `CALENDARIA.api.addWeatherPreset()`

Custom presets support all the same fields as built-in presets including wind, precipitation, inertia weight, HUD effects, FXMaster integration, and sound effects.

## Column Reference

| Column         | Description                                                     |
| -------------- | --------------------------------------------------------------- |
| **Chance**     | Default proportional weight for auto-generation                 |
| **Temp °C**    | Default temperature range (min – max) in Celsius                |
| **Darkness**   | Additive darkness penalty applied to scene (☀ = brightens)      |
| **Wind**       | Default speed tier (`0`–`5`); † = forced (ignores zone config)  |
| **Precip**     | Precipitation type and base intensity (`0`–`1` scale)           |
| **Inertia**    | Per-preset inertia weight (`0` = never persists, >`1` = sticky) |
| **HUD Effect** | Particle animation in the HUD dome renderer                     |
| **FX Preset**  | FXMaster effect; ✦ = FXMaster+ only, ★ = Enhanced by FXMaster+  |
| **Sound**      | Ambient sound loop filename (— = silent)                        |
