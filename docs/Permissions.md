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

| Permission          | Description                |
| ------------------- | -------------------------- |
| **View MiniCal**    | Can see the MiniCal widget |
| **View TimeKeeper** | Can see the TimeKeeper     |
| **View HUD**        | Can see the main HUD       |

### Action Permissions

| Permission           | Description                                 |
| -------------------- | ------------------------------------------- |
| **Manage Notes**     | Can create, edit, and delete calendar notes |
| **Change Date/Time** | Can modify the world date and time          |
| **Change Weather**   | Can set weather conditions                  |
| **Change Calendar**  | Can switch the active calendar              |
| **Edit Calendars**   | Can access the Calendar Editor              |

---

## Default Permissions

By default, all non-GM roles have restricted access:

| Permission       | Player | Trusted | Assistant GM |
| ---------------- | :----: | :-----: | :----------: |
| View MiniCal     |   ✓    |    ✓    |      ✓       |
| View TimeKeeper  |   -    |    -    |      ✓       |
| View HUD         |   ✓    |    ✓    |      ✓       |
| Manage Notes     |   -    |    ✓    |      ✓       |
| Change Date/Time |   -    |    -    |      ✓       |
| Change Weather   |   -    |    -    |      ✓       |
| Change Calendar  |   -    |    -    |      -       |
| Edit Calendars   |   -    |    -    |      -       |

---

## How Permissions Work

### UI Controls

When a user lacks permission for an action, the corresponding UI controls are hidden or disabled:

- Time control buttons hidden without Change Date/Time permission
- Weather picker disabled without Change Weather permission
- Note creation buttons hidden without Manage Notes permission
- Calendar Editor button hidden without Edit Calendars permission

### Socket Relay

For non-GM users with appropriate permissions, actions that modify world state (like changing time) are relayed through a socket system to the GM for execution. This ensures proper authority while allowing delegated control.

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

- Users can always view non-GM-only notes
- With this permission, users can create new notes
- Users can only edit/delete notes they own (GM can edit all)

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
