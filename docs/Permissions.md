# Permissions

Calendaria includes a role-based permission system that controls what actions different user roles can perform.

---

## Overview

The permission system allows GMs to configure which Calendaria features are available to:

- **Players** — Standard player role
- **Trusted Players** — Trusted player role
- **Assistant GMs** — Assistant GM role

GMs always have full access to all features.

---

## Configuring Permissions

1. Open the Settings Panel (gear icon on any Calendaria application)
2. Navigate to the **Permissions** tab (GM only)
3. Configure permissions for each role (Player, Trusted, Assistant GM) using checkboxes
4. Changes save automatically

---

## Available Permissions

### UI Visibility Permissions

| Permission          | Key              | Description                |
| ------------------- | ---------------- | -------------------------- |
| **View BigCal**     | `viewBigCal`     | Can see the BigCal         |
| **View MiniCal**    | `viewMiniCal`    | Can see the MiniCal widget |
| **View TimeKeeper** | `viewTimeKeeper` | Can see the TimeKeeper     |

### Action Permissions

| Permission                | Key                    | Description                                            |
| ------------------------- | ---------------------- | ------------------------------------------------------ |
| **Manage Notes**          | `addNotes`             | Can create own calendar notes                          |
| **Edit Notes**            | `editNotes`            | Can edit calendar notes owned by other players         |
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
| View TimeKeeper       |   -    |    ✓    |      ✓       |
| Manage Notes          |   ✓    |    ✓    |      ✓       |
| Edit Notes            |   -    |    ✓    |      ✓       |
| Delete Notes          |   -    |    -    |      ✓       |
| Change Date/Time      |   -    |    -    |      ✓       |
| Change Weather        |   -    |    -    |      ✓       |
| View Weather Forecast |   -    |    ✓    |      ✓       |
| Change Calendar       |   -    |    -    |      -       |
| Edit Calendars        |   -    |    -    |      -       |

---

## How Permissions Work

### UI Controls

When a user lacks permission for an action, the corresponding UI controls are hidden or disabled:

- Time control buttons hidden without Change Date/Time permission
- Weather picker disabled without Change Weather permission
- Note creation buttons hidden without Manage Notes permission
- Calendar Editor button hidden without Edit Calendars permission

### Socket Relay

For non-GM users with appropriate permissions, actions that modify world state are relayed through a socket system to the GM for execution. This ensures proper authority while allowing delegated control.

Socket relay is used for:

- **Time changes**: Non-GM users with "Change Date/Time" permission
- **Note creation**: Users with "Manage Notes" permission but without Foundry's core `JOURNAL_CREATE` permission

---

## For Developers

See [API Reference > Permissions](API-Reference#permissions) for programmatic permission checks.

---

## Permission Inheritance

The permission UI provides cascade-up behavior for easier configuration:

- **Cascade Up**: Checking a lower role (e.g., Player) automatically checks higher roles (Trusted, Assistant GM)
- **Independent Unchecking**: Unchecking a role does not affect other roles — each can be unchecked individually

---

## Notes on Specific Permissions

### Manage Notes

- Users can view non-GM-only notes that they have at least OBSERVER permission on (respects Foundry journal permissions)
- With this permission, users can create new notes
- Users can only delete notes they created (original author); GMs can delete any note
- If the user lacks Foundry's core `JOURNAL_CREATE` permission, note creation is relayed to a connected GM via socket

### Edit Notes

- Allows users to edit calendar notes owned by other players
- Does not apply to GM-only notes
- Ownership is automatically synced when the world loads and whenever the permission setting changes
- Removing a user from this permission revokes their ownership on all calendar notes (preserving author and GM ownership)
- When a note's "GM Only" flag is toggled off, users with this permission automatically receive owner-level access
- Only the original note author or a GM can delete a note (regardless of this permission)

### View Weather Forecast

- Gates access to the `getWeatherForecast()` API method
- Gates the `/forecast` chat command
- Controls visibility of forecast weather icons on calendar day cells
- GMs always have access regardless of this setting

### Change Date/Time

- Affects all time controls (HUD, MiniCal, TimeKeeper)
- Includes advancing time, setting specific dates, and real-time clock control
- Time changes are broadcast to all clients

### Change Calendar

- Controls whether users can switch the active calendar
- **Note**: Visibility of the active calendar for players is controlled separately via the "Show Active Calendar to Players" setting in Settings > Home tab

### Edit Calendars

- This is a powerful permission — allows modifying calendar structure
- Consider restricting to GM only in most games
- Changes affect all players in the world
