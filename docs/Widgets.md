# Widgets

Calendaria provides a widget system for external modules to add custom UI elements to Calendaria applications.

---

## Overview

Widgets allow module developers to:

- Add custom buttons to the HUD, BigCal, and MiniCal
- Add custom indicator displays
- Replace built-in indicators with custom implementations

---

## Widget Points

Widgets can be inserted at these locations:

| Point               | Location                     | Widget Types |
| ------------------- | ---------------------------- | ------------ |
| `hud.buttons.left`  | Left side of HUD bar         | Buttons      |
| `hud.buttons.right` | Right side of HUD bar        | Buttons      |
| `hud.indicators`    | Indicator section of HUD bar | Indicators   |
| `hud.tray`          | Time controls tray           | Buttons      |
| `minical.sidebar`   | MiniCal sidebar              | Buttons      |
| `bigcal.actions`    | BigCal action bar            | Buttons      |

Access these via `CALENDARIA.api.widgetPoints`.

---

## Replaceable Elements

Built-in indicator elements that can be replaced by custom widgets. Replacements apply across all three applications (HUD, MiniCal, BigCal):

| Element ID          | Description                  |
| ------------------- | ---------------------------- |
| `weather-indicator` | Weather condition display    |
| `season-indicator`  | Current season display       |
| `era-indicator`     | Era/year display             |
| `cycle-indicator`   | Cycle (zodiac, etc.) display |

Access these via `CALENDARIA.api.replaceableElements`.

> [!NOTE]
> When you replace an indicator, the replacement applies wherever that indicator appears in any Calendaria application.

---

## Registering a Widget

### Basic Button Widget

```javascript
Hooks.once('calendaria.ready', () => {
  CALENDARIA.api.registerWidget('my-module', {
    id: 'my-button',
    type: 'button',
    insertAt: 'hud.buttons.right',
    icon: 'fas fa-star',
    label: 'My Button',
    tooltip: 'Click to do something',
    onClick: () => {
      console.log('Button clicked!');
    }
  });
});
```

### Custom Indicator Widget

```javascript
CALENDARIA.api.registerWidget('my-module', {
  id: 'custom-indicator',
  type: 'indicator',
  insertAt: 'hud.indicators',
  render: (container) => {
    container.innerHTML = `
      <span class="indicator-icon"><i class="fas fa-gem"></i></span>
      <span class="indicator-label">Mana: 50</span>
    `;
  },
  onAttach: (element) => {
    // Called when widget is added to DOM
  },
  onDetach: (element) => {
    // Called when widget is removed from DOM
  }
});
```

### Replacement Widget

```javascript
CALENDARIA.api.registerWidget('my-module', {
  id: 'custom-weather',
  type: 'indicator',
  replaces: 'weather-indicator',
  render: (container) => {
    const weather = CALENDARIA.api.getCurrentWeather();
    container.innerHTML = `<span>Custom: ${weather?.label || 'None'}</span>`;
  }
});
```

---

## Widget Configuration

### Required Properties

| Property | Type   | Description                                 |
| -------- | ------ | ------------------------------------------- |
| `id`     | string | Unique widget identifier within your module |
| `type`   | string | `'button'` or `'indicator'`                 |

### Insertion Properties

One of these is required:

| Property   | Type   | Description                           |
| ---------- | ------ | ------------------------------------- |
| `insertAt` | string | Widget point ID from `widgetPoints`   |
| `replaces` | string | Element ID from `replaceableElements` |

### Button Properties

| Property   | Type                | Description                                 |
| ---------- | ------------------- | ------------------------------------------- |
| `icon`     | string              | FontAwesome icon class                      |
| `label`    | string              | Button text (optional)                      |
| `tooltip`  | string              | Hover tooltip text                          |
| `color`    | string              | Icon color (CSS color value)                |
| `onClick`  | function            | Click handler                               |
| `disabled` | boolean or function | Disable state or function returning boolean |

### Indicator Properties

| Property   | Type     | Description                                 |
| ---------- | -------- | ------------------------------------------- |
| `render`   | function | Receives container element, renders content |
| `onAttach` | function | Called when added to DOM                    |
| `onDetach` | function | Called when removed from DOM                |

---

## Managing Widgets

### Get Registered Widgets

```javascript
// Get all widgets at a specific point
const hudButtons = CALENDARIA.api.getRegisteredWidgets('hud.buttons.right');

// Get widget replacing a specific element
const weatherWidget = CALENDARIA.api.getWidgetByReplacement('weather-indicator');
```

### Refresh Widgets

Force all widgets to re-render:

```javascript
CALENDARIA.api.refreshWidgets();
```

---

## Hooks

Widget-related hooks are documented in [Hooks > Widget Hooks](Hooks#widget-hooks):

- `calendaria.widgetRegistered` — Fired when a widget is registered
- `calendaria.widgetsRefresh` — Fired when widgets are refreshed

---

## CSS Styling

Each widget receives a class based on its module ID for targeted styling:

```css
/* Style all widgets from your module */
.widget-my-module {
  /* Your styles */
}

/* Style a specific widget */
.widget-my-module[data-widget-id='my-button'] {
  /* Your styles */
}
```

---

## Example: Complete Module Integration

```javascript
// my-module.js
Hooks.once('calendaria.ready', ({ api }) => {
  // Add a button to show party resources
  api.registerWidget('my-module', {
    id: 'party-resources',
    type: 'button',
    insertAt: 'hud.buttons.right',
    icon: 'fas fa-coins',
    tooltip: 'Party Resources',
    onClick: () => openResourceTracker()
  });

  // Add a custom indicator
  api.registerWidget('my-module', {
    id: 'party-gold',
    type: 'indicator',
    insertAt: 'hud.indicators',
    render: (container) => {
      const gold = getPartyGold();
      container.innerHTML = `
        <span class="indicator-icon"><i class="fas fa-coins" style="color: gold;"></i></span>
        <span class="indicator-label">${gold} gp</span>
      `;
    }
  });

  // Update indicator when gold changes
  Hooks.on('updatePartyGold', () => {
    api.refreshWidgets();
  });
});
```

---

## Best Practices

1. **Register on `calendaria.ready`** — Ensure Calendaria is fully loaded
2. **Use unique IDs** — Combine module ID with descriptive widget ID
3. **Use semantic icons** — Match Calendaria's FontAwesome icon style
4. **Respect user settings** — Check permissions before showing controls
