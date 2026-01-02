# Getting Started

This guide covers installation and initial setup of Calendaria.

## Installation

### From Foundry

1. Open Foundry's **Setup** screen
2. Go to **Add-on Modules**
3. Click **Install Module**
4. Search for "Calendaria"
5. Click **Install**

### Manual Installation

Paste this manifest URL in the Install Module dialog:

```
https://github.com/Sayshal/calendaria/releases/latest/download/module.json
```

### The Forge

Search for "Calendaria" in The Forge's Bazaar.

---

## First-Time Setup

### 1. Enable the Module

1. Launch your world
2. Go to **Settings** → **Manage Modules**
3. Enable **Calendaria**
4. Save and reload

### 2. Choose a Calendar

Calendaria includes 15+ pre-built calendars:

| Calendar | Setting |
|----------|---------|
| Gregorian | Real-world calendar |
| Greyhawk | World of Greyhawk |
| Harptos | Forgotten Realms |
| Khorvaire | Eberron |
| Exandrian | Critical Role / Exandria |
| Barovian | Ravenloft / Barovia |
| Athasian | Dark Sun / Athas |
| Krynn (Elven) | Dragonlance |
| Krynn (Solamnic) | Dragonlance |
| Golarion | Pathfinder |
| Cerilian | Birthright |
| Thyatian | Mystara |
| Galifar | Eberron variant |
| Drakkenheim | Drakkenheim |
| Forbidden Lands | Forbidden Lands |
| Renescara | Showcase calendar with advanced features |

To select a calendar:

1. Go to **Settings** → **Module Settings** → **Calendaria**
2. Find **Active Calendar**
3. Select your calendar from the dropdown
4. The world will reload to apply the change

### 3. Show the Calendar

The calendar HUD appears automatically based on your settings. If you don't see it:

1. Go to **Settings** → **Calendaria** → **Calendaria Settings**
2. Click the **HUD**, **MiniCalendar**, or **Time Keeper** tab
3. Enable **Show** to display that widget

You can also use the keyboard shortcut **Alt+C** to toggle HUD visibility.

---

## Setting the Date

To set the initial date for your campaign:

1. Right-click the calendar HUD to open the time dial
2. Use the time controls to adjust hours
3. Click dates on the calendar to navigate months
4. Use the API for precise control:

```javascript
// Set to a specific date
await CALENDARIA.api.setDateTime({
  year: 1492,
  month: 5,    // 0-indexed (0 = first month)
  day: 15,
  hour: 10,
  minute: 30
});
```
