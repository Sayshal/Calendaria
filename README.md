# Calendaria

Your campaign's time deserves more than a number in the corner. Calendaria brings your world's calendar to life with beautiful widgets and smart scheduling.

![Calendaria Hero](.github/assets/hero.gif)

![GitHub release](https://img.shields.io/github/v/release/Sayshal/calendaria?style=for-the-badge)
![GitHub Downloads (specific asset, all releases)](<https://img.shields.io/github/downloads/Sayshal/calendaria/module.zip?style=for-the-badge&logo=foundryvirtualtabletop&logoColor=white&logoSize=auto&label=Downloads%20(Total)&color=ff144f>)

![Foundry Version](https://img.shields.io/endpoint?url=https%3A%2F%2Ffoundryshields.com%2Fversion%3Fstyle%3Dfor-the-badge%26url%3Dhttps%3A%2F%2Fgithub.com%2FSayshal%2Fcalendaria%2Freleases%2Flatest%2Fdownload%2Fmodule.json)
[![Discord](https://dcbadge.limes.pink/api/server/PzzUwU9gdz)](https://discord.gg/PzzUwU9gdz)

**[Read the Wiki](https://github.com/Sayshal/calendaria/wiki)** for guides, API docs, and tips.

---

## What You Get

**Calendar HUD** — A gorgeous dome widget with animated skies, sun/moon tracking, and drag-anywhere convenience. Collapse it to a sleek bar when you need more screen space.

![Calendar HUD - Compact](.github/assets/hud-compact.png)

**MiniCal & BigCal** — Quick month view for daily use, plus full month/week/year views when you need the big picture. Hover for details, click to add notes.

![MiniCal](.github/assets/mini-calendar.png)

![Calendar - Month View](.github/assets/calendar-month.png)

**Notes & Events** — Tie journal entries to dates with smart recurrence ("every full moon", "2nd Tuesday", "winter only"). Get reminded via toast, chat, or popup.

![Note Editor](.github/assets/note-form.png)

**Weather & Moons** — 27 weather presets with climate zones. Multiple moons with independent cycles. All displayed beautifully on the HUD.

![Weather Picker](.github/assets/weather-picker.png)

**Scene Darkness** — Your scenes automatically dim at sunset and brighten at dawn. Override per-scene when the story calls for eternal night.

---

## 15+ Ready-to-Use Calendars

Jump right in with calendars for Forgotten Realms, Greyhawk, Eberron, Exandria, Golarion, Dark Sun, Dragonlance, Ravenloft, and more. Or build your own with the Calendar Editor—import from Simple Calendar, Fantasy-Calendar.com, and others.

![Calendar Editor](.github/assets/calendar-editor.png)

---

## Make It Yours

Themes, custom colors, and a searchable settings panel that remembers your recent changes. Export your setup to share between worlds.

![Theme Comparison](.github/assets/theme-comparison.png)

---

## For the Tinkerers

Full API at `CALENDARIA.api` for macros and module integration. Chat commands like `/date`, `/weather`, `/advance 8 hours`. Keybinds for everything.

```javascript
const now = CALENDARIA.api.getCurrentDateTime();
await CALENDARIA.api.advanceTime({ hour: 8 });
const phase = CALENDARIA.api.getMoonPhase(0);
```

---

## Installation

Find **Calendaria** in Foundry's Module Browser, or paste this manifest URL:

```
https://github.com/Sayshal/calendaria/releases/latest/download/module.json
```

Questions? Ideas? Join us on [Discord](https://discord.gg/PzzUwU9gdz) or check the [Wiki](https://github.com/Sayshal/calendaria/wiki).
