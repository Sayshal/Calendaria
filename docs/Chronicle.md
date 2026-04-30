# Chronicle

A vertical timeline viewer displaying calendar notes, festivals, season changes, moon phases, and weather history in a scrollable layout with fog-of-war support and live updates.

---

## Opening the Chronicle

- BigCal header button (if enabled in settings)
- MiniCal header button (if enabled in settings)
- HUD bar button (if enabled in settings)
- Right-click context menu on any widget (Open submenu)
- Scene controls toolbar button (if Chronicle is added to toolbar apps)
- Journal sidebar footer button
- Keybind (configurable, no default; see [Keybinds](Keybinds))
- Automatically on world load (if "Show Chronicle" is enabled)

---

## View Modes

Switch between layouts using the view mode dropdown in the toolbar.

### Scroll

The default mode. Entries appear as a continuous vertical list. Each day with content shows its date, weekday, notes, and banners. Entries load automatically as you scroll.

### Timeline

A vertical spine layout with cards alternating left and right. Today's entry is highlighted.

---

## Entries

Each entry represents a single day and can contain:

| Element   | Description                                                            |
| --------- | ---------------------------------------------------------------------- |
| Date      | Formatted date and weekday name                                        |
| Notes     | Calendar notes with icon, color, title, and content                    |
| Festivals | Festival-linked notes highlighted with a festival indicator            |
| Banners   | Season changes, moon phase milestones, and weather history (see below) |

### Banners

Banners appear as inline markers within day entries:

- **Season.** Marks season transitions with the season's icon and color
- **Moon Phase.** Shows mid-phase milestones for each moon
- **Weather.** Summarizes weather for past and current days (label, temperature, wind, precipitation)

Banners are hidden while the Category Filter is active so the chronicle shows only days with matching notes.

### Fog of War

When [Fog of War](Fog-of-War) is enabled, unrevealed dates display as fogged placeholders. GMs always see full content regardless of fog state.

---

## Depth Modes

Control how much note content is shown via the depth dropdown in the toolbar or in settings. GMs see an Add Note button on each entry when hovering.

| Mode       | Description                      |
| ---------- | -------------------------------- |
| Title Only | Note icon, color, and title only |
| Excerpts   | Title plus a plain-text excerpt  |
| Full       | Title plus full rendered content |

---

## Toolbar

The toolbar across the top of the Chronicle provides:

| Control         | Description                                     |
| --------------- | ----------------------------------------------- |
| Today           | Reset date range and scroll to today's entry    |
| Show Empty Days | Toggle display of days with no notes or banners |
| Category Filter | Toggle visibility by note preset                |
| Depth Dropdown  | Switch between depth modes                      |
| View Mode       | Switch between Scroll and Timeline layouts      |
| Close           | Close the Chronicle                             |

Right-click the toolbar to access:

| Option                      | Description                                           |
| --------------------------- | ----------------------------------------------------- |
| Settings                    | Opens the Chronicle settings tab                      |
| Open                        | Submenu to open other Calendaria widgets              |
| Show to All / Hide from All | Toggle Chronicle visibility for all players (GM only) |
| Close                       | Close the Chronicle                                   |

---

## Live Updates

The Chronicle refreshes when notes change, weather updates, the day advances, fog of war shifts, the active calendar switches, or settings change.

---

## API

See [API Reference](API-Reference) for developer methods.
