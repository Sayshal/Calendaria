# Permissions

Role-based permission system controlling what actions different user roles can perform.

---

## Overview

GMs configure which features are available to:

- **Players.** Standard player role
- **Trusted Players.** Trusted player role
- **Assistant GMs.** Assistant GM role

GMs always have full access to all features.

### Widget View Permissions

Every widget has a dedicated view permission. Without it, the widget does not render; users see nothing in its place. Applies to all 7 widgets: BigCal, MiniCal, HUD, Time Keeper, Sun Dial, Chronicle, and Stopwatch.

When a GM uses **Show to All**, Calendaria checks whether any active players are blocked by view permissions. If so, the GM gets a notification listing blocked users by name. Permitted users see the widget; blocked users are unaffected.

---

## Configuring Permissions

1. Open the Settings Panel (gear icon on any Calendaria application)
2. Navigate to the **Permissions** tab (GM only)
3. Configure permissions for each role (Player, Trusted, Assistant GM) using checkboxes
4. Changes save automatically

---

## Available Permissions

### UI Visibility Permissions

| Permission           | Key              | Description                    |
| -------------------- | ---------------- | ------------------------------ |
| **View BigCal**      | `viewBigCal`     | Can see the BigCal             |
| **View MiniCal**     | `viewMiniCal`    | Can see the MiniCal widget     |
| **View HUD**         | `viewHUD`        | Can see the HUD                |
| **View Time Keeper** | `viewTimeKeeper` | Can see the Time Keeper        |
| **View Sun Dial**    | `viewSunDial`    | Can see the Sun Dial           |
| **View Chronicle**   | `viewChronicle`  | Can see the Chronicle timeline |
| **View Stopwatch**   | `viewStopwatch`  | Can see the Stopwatch          |

### Action Permissions

| Permission                | Key                    | Description                                            |
| ------------------------- | ---------------------- | ------------------------------------------------------ |
| **Manage Notes**          | `addNotes`             | Can create own calendar notes                          |
| **Delete Notes**          | `deleteNotes`          | Can delete own calendar notes                          |
| **Change Date/Time**      | `changeDateTime`       | Can modify the world date and time                     |
| **Change Weather**        | `changeWeather`        | Can set weather conditions                             |
| **View Weather Forecast** | `viewWeatherForecast`  | Can view weather forecasts and day-cell forecast icons |
| **Change Calendar**       | `changeActiveCalendar` | Can switch the active calendar                         |
| **Edit Calendars**        | `editCalendars`        | Can access the Calendar Editor                         |

---

## Default Permissions

By default, all non-GM roles have restricted access:

| Permission            | Player | Trusted | Assistant GM |
| --------------------- | :----: | :-----: | :----------: |
| View BigCal           |   -    |    ✓    |      ✓       |
| View MiniCal          |   -    |    ✓    |      ✓       |
| View HUD              |   ✓    |    ✓    |      ✓       |
| View Time Keeper      |   -    |    ✓    |      ✓       |
| View Sun Dial         |   -    |    ✓    |      ✓       |
| View Chronicle        |   -    |    ✓    |      ✓       |
| View Stopwatch        |   -    |    ✓    |      ✓       |
| Manage Notes          |   ✓    |    ✓    |      ✓       |
| Delete Notes          |   -    |    -    |      ✓       |
| Change Date/Time      |   -    |    -    |      ✓       |
| Change Weather        |   -    |    -    |      ✓       |
| View Weather Forecast |   -    |    ✓    |      ✓       |
| Change Calendar       |   -    |    -    |      -       |
| Edit Calendars        |   -    |    -    |      -       |

---

## How Permissions Work

### UI Controls

Without permission for an action, UI controls are hidden or disabled:

- Time control buttons hidden without Change Date/Time permission
- Weather picker disabled without Change Weather permission
- Note creation buttons hidden without Manage Notes permission
- Calendar button visibility gated by `canViewBigCal` or `canViewMiniCal` based on Calendar Button setting
- Calendar Editor button hidden without Edit Calendars permission

### Socket Relay

Non-GM users with appropriate permissions relay world-state-modifying actions through a socket to the GM for execution.

Socket relay is used for:

- **Time changes**: Non-GM users with "Change Date/Time" permission
- **Note creation**: Users with "Manage Notes" permission but without Foundry's core `JOURNAL_CREATE` permission

---

## For Developers

See [API Reference](API-Reference) and [Hooks](Hooks).

---

## Permission Inheritance

Permission UI has cascade-up behavior:

- **Cascade Up**: Checking a lower role (e.g., Player) automatically checks higher roles (Trusted, Assistant GM)
- **Independent Unchecking**: Unchecking a role does not affect other roles; each can be unchecked individually

---

## Notes on Specific Permissions

### Manage Notes

- Users view non-GM-only notes they have at least OBSERVER permission on (respects Foundry journal permissions)
- Grants note creation
- Users can only delete their own notes (original author); GMs can delete any note
- If the user lacks Foundry's core `JOURNAL_CREATE` permission, note creation is relayed to a connected GM via socket

### Note Editing

Note editing is gated exclusively by per-note Foundry document ownership. Each note's ownership is set via the Ownership section on the note sheet's Settings tab. Users with at least Owner-level permission on a note can edit it. GMs can always edit any note.

### View Weather Forecast

- Gates access to the `getWeatherForecast()` API method
- Gates the `/forecast` chat command
- Controls visibility of forecast weather icons on calendar day cells
- GMs always have access regardless of this setting

### Change Date/Time

- Affects all time controls (HUD, MiniCal, Time Keeper)
- Includes advancing time, setting specific dates, and real-time clock control
- Time changes are broadcast to all clients

### Settings Tab Access

- **Stopwatch** and **Sun Dial** settings tabs expose user-scope settings (fade, opacity, combat behavior) to non-GM users for personal customization
- World-scope settings on these tabs remain GM-only
- Settings panel tabs for BigCal, HUD, Chronicle, Stopwatch, and Sun Dial are hidden from users who lack the corresponding view permission

### Change Calendar

- Controls whether users can switch the active calendar
- Player visibility of the active calendar is controlled separately via "Show Active Calendar to Players" in Settings > Home tab

### Edit Calendars

- Allows modifying calendar structure. Restrict to GM only in most games
- Changes affect all players in the world
