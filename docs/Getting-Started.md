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

```text
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

On first load, the MiniCal appears with the Gregorian calendar selected by default. To change calendars:

1. Click the **gear icon** on the MiniCal (or any Calendaria application) to open the Settings Panel
2. In the **Home** tab, select a calendar from the dropdown (players can also view this tab)
3. The world will reload to apply the change

> [!NOTE]
> GMs can enable **Show Active Calendar to Players** to let players see the currently active calendar name. Use the search box at the top of the sidebar to quickly find settings.

Calendaria includes 17 pre-built calendars:

| Calendar         | Setting                                  |
| ---------------- | ---------------------------------------- |
| Athasian         | Dark Sun / Athas                         |
| Barovian         | Ravenloft / Barovia                      |
| Cerilian         | Birthright                               |
| Drakkenheim      | Drakkenheim                              |
| Exandrian        | Critical Role / Exandria                 |
| Forbidden Lands  | Forbidden Lands                          |
| Galifar          | Eberron variant                          |
| Golarion         | Pathfinder                               |
| Gregorian        | Real-world calendar                      |
| Greyhawk         | World of Greyhawk                        |
| Harptos          | Forgotten Realms                         |
| Khorvaire        | Eberron                                  |
| Krynn (Elven)    | Dragonlance                              |
| Krynn (Solamnic) | Dragonlance                              |
| Renescara        | Showcase calendar with advanced features |
| Thyatian         | Mystara                                  |
| Traveller        | Traveller RPG                            |

To create a custom calendar or import from another source, use the buttons in the Calendar tab. See [Calendar Editor](Calendar-Editor) and [Importing Calendars](Importing-Calendars) for details.

### 3. Configure Applications

By default, the **MiniCal** appears on world load. Other applications are available:

- **HUD** — Floating HUD with animated sky dome
- **TimeKeeper** — Minimal time display and controls
- **BigCal** — Full calendar view via Journal footer or toolbar button

You can also access Calendaria apps via the **Journal footer button** or **toolbar button** (configurable in settings).

To configure which applications display:

1. Open the Settings Panel (gear icon on any Calendaria application)
2. Select the **HUD**, **MiniCal**, or **TimeKeeper** tab
3. Enable or disable the **Show** option for each application

> [!TIP]
> Use the keyboard shortcut **Alt+C** to quickly toggle HUD visibility. Additional keybinds for BigCal, MiniCal, and TimeKeeper are available but unbound by default—configure them in **Settings > Configure Controls > Calendaria**.

---

## Setting the Date

To set the initial date for your campaign:

1. Open the **HUD** (Alt+C) or use the **MiniCal**
2. Click on the **current date display** in the info bar
3. Use the **Set Date** dialog to choose your starting date and time
4. Click **Set** to apply the new date

---

## Backup & Transfer

GMs can export settings for backup or to transfer configurations between worlds via **Settings > Module tab > Backup & Transfer**.
