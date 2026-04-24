# Cinematic Time Skip

A fullscreen animated overlay that plays during large time advances. The sky cycles through day and night, celestial bodies move overhead, weather changes, and event title cards appear as time skips forward.

---

## What It Looks Like

The cinematic fills the screen with an animated sky that tracks the in-world time of day across the skipped range. The sun and moons sit where they belong for the current hour, so the opening frame matches the hour the skip started and the closing frame matches the hour the skip ended. Stars twinkle in and out, and occasional shooting stars streak past at night. A date counter ticks through the days, event title cards appear for days with festivals or notes, and weather conditions update as the seasons shift.

---

## Theming

The overlay reads the active Calendaria theme. The page card, season pill, moon strip, event cards, festival highlight, and progress bar pick up the theme's background, border, text, and accent colors.

---

## Trigger Behavior

The cinematic plays when both conditions are met:

1. The cinematic system is **enabled** in settings
2. The time advance meets or exceeds the configured **threshold** (e.g., 1 week)

Any time jump that meets the threshold triggers the cinematic, including the time jump buttons on the HUD, MiniCal, and Time Keeper, as well as the **Cinematic Advance** button in the Set Date dialog. Chat commands (`/advance`) also follow the threshold by default.

### Rest-Time Trigger

When the **Trigger on Rest** setting is enabled, rest-initiated time advances (long rests) trigger the cinematic regardless of threshold. Any forward advance during rest plays the overlay.

The "Trigger on Rest" setting requires **Advance Time on Rest** (in the Time tab) to be enabled. When that setting is off, "Trigger on Rest" is disabled with a tooltip explaining the dependency.

---

## Multiplayer

The animation plays on all connected clients at once. Any player can skip their own view with Escape or the skip button. If the GM aborts, all clients stop.

---

## Abort Controls

Stop the cinematic at any time:

| Control         | Action                      |
| --------------- | --------------------------- |
| **Escape** key  | Abort and close the overlay |
| **Skip** button | On-screen button to abort   |

The time advance has already been applied. Aborting only skips the remaining animation.
