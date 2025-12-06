# Calendaria

> **ALPHA RELEASE WARNING**
> This module is currently in alpha development and is **NOT recommended for use in live games**. Features are incomplete, bugs are expected, and breaking changes may occur between updates. Use at your own risk.

A hopefully-system-agnostic Foundry VTT module  that provides calendar and time tracking with journal integration.

## Features

### Completed (Alpha)

- **Multi-calendar system** - Switch between different calendar configurations
- **Moon phase tracking** - Customizable lunar cycles with phase calculations
- **Notes & events** - Journal integration with recurring patterns (daily/weekly/monthly/yearly)
- **Time tracking** - Date utilities and current date management
- **Darkness sync** - Automatic scene darkness based on time of day
- **Draggable HUD** - Persistent calendar widget
- **Public API** - Module integration via `CALENDARIA` global

### Planned (Beta & Beyond)

- **Multiplayer sync** - Socket-based real-time updates for multi-GM games
- **System integrations** - Combat rounds, rest mechanics, active effects
- **Enhanced UI** - Theme system, search, compact/full views
- **Event reminders** - Notification system for upcoming events

## API Usage

Calendaria provides a comprehensive public API for macros and module integration. Access it via `CALENDARIA.api`.

**Quick Examples:**

```javascript
// Get current date/time
const now = CALENDARIA.api.getCurrentDateTime();

// Advance time (GM only)
await CALENDARIA.api.advanceTime({ hour: 8 });

// Get moon phase
const moon = CALENDARIA.api.getMoonPhase(0);

// Check for festivals
const festival = CALENDARIA.api.getCurrentFestival();
```

## Development

- **Alpha Release Milestone**: [View Milestone](https://github.com/Sayshal/Calendaria/milestone/1)
- **Beta Release Milestone**: [View Milestone](https://github.com/Sayshal/Calendaria/milestone/2)
- **Project Tracker**: [View Project](https://github.com/users/Sayshal/projects/3)
