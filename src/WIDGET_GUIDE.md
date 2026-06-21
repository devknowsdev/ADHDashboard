# ADHDashboard — Adding a New Widget

Checklist for adding a new single-instance widget (diet tracker, health
log, mood/sensory tracker, etc.) to the dashboard. See `ARCHITECTURE.md`
for background on the render pipeline and persistence model.

**Check first:** has the widget-registry migration (Phase A/B) landed?
Look for `registerWidget` in any `render_*.js` file, or a
`widget_registry.js` file. If not present, the registry steps below don't
apply yet — fall back to the pre-registry pattern (add to `WIDGETS` in
constants.js + `widgetRenderMap` in render.js). Ask before proceeding if
unsure which state the codebase is in.

---

## Files to create

### 1. `render_<name>.js`
- One function: `render<Name>Widget(todayStr, now)` returning an HTML
  string (innerHTML). Match the signature even if `now` is unused —
  keeps the call site in `render.js` uniform.
- Use existing helpers freely: `esc`, `btnStyle`, `inputStyle`,
  `selectStyle`, `labelStyle`, `cardStyle`, `fmtDur`, `getCat`, `getTask`,
  theme object `T` (LIGHT/DARK).
- Read/write persisted state via `getWidgetData('<name>', {...defaults})`
  / `setWidgetData('<name>', data)` (storage.js) — once Phase C lands. If
  it hasn't landed yet, add a small bespoke global + localStorage key
  following the existing pattern in storage.js (and flag this as tech debt
  to migrate later).
- End the file with:
  ```js
  registerWidget({
    id: '<name>',
    label: '<Display Name>',
    icon: 'ti-<tabler-icon-name>',
    pinnable: true,
    collapsible: true,
    fullWidth: true,        // or false for sidebar-style widgets
    defaultVisible: false,  // new widgets start hidden, opt-in via drawer
    render: render<Name>Widget,
  });
  ```
- Add a header comment block matching existing convention:
  ```js
  // <Name> widget — <one-line description>.
  // Depends on: core.js (...), helpers.js (...), state.js, actions_<name>.js
  // Registered via registerWidget() — see widget_registry.js.
  ```

### 2. `actions_<name>.js`
- All action functions: things called from `onclick`/`oninput`/etc in the
  render file. Each mutates state (via `getWidgetData`/`setWidgetData`),
  calls `save()`, calls `render()` (or `renderNow()` only if a DOM read
  must happen synchronously after).
- For any input that triggers `render()` on `oninput`, wrap it in
  `data-no-clobber="true"` in the render file (§2 of ARCHITECTURE.md) and,
  if it needs live feedback, add a targeted-patch helper here following
  `_qlPatchUI`/`stQlInputChange` as a model.
- Header comment: `// Depends on: ... // Called from: render_<name>.js`

---

## Wiring (outside the new files)

### `index.html`
Add two `<script>` tags for the new files. Placement: anywhere after
`widget_registry.js` (or after `core.js`/`storage.js` if registry hasn't
landed) and before `init.js`. Order between the two new files: render file
before actions file is conventional but not required (shared global scope).

### `test_workflows.js`
- Add both new filenames to the `FILES` array, in a position matching
  their `index.html` order.
- Add a new `console.log('\n═══ WFxx: <Name> ═══')` block with tests for
  each action function: `resetState()` → seed minimal data → call action →
  assert state. No DOM/render assertions needed (harness mocks `document`
  minimally — render functions can be smoke-tested by calling them and
  checking the result is a non-empty string, but this is optional).
- Run `node test_workflows.js` — must stay green.

---

## What you should NOT need to touch

- `state.js` — no new global `let` declarations needed if using
  `getWidgetData`/`setWidgetData`.
- `constants.js` — no `WIDGETS` entry (registry handles it).
- `render.js` — no `widgetRenderMap` entry (registry handles it); no
  changes to `_doRender`, `_partialTimerUpdate`, or float bar unless your
  widget needs a per-second live-updating element (rare — most widgets
  don't).
- `core.js` — `renderWidgetChrome` is fully generic, already handles your
  widget via the registry's `def`.
- `storage.js` — no new localStorage key, no `load()`/`_flushSave()`
  edits, if using `getWidgetData`/`setWidgetData` (Phase C).
- `actions_export.js` — `widgetData` is included in backup export/import
  wholesale; no per-widget edit needed (Phase C).

If you find yourself needing to touch any of the above, stop and check
whether the registry/widgetData migration has actually landed — if it has
and you still need to touch these files, that's a signal the new widget
needs something genuinely new (flag it rather than working around it).

---

## Quick template skeleton

```js
// <Name> widget — <description>.
// Depends on: core.js (btnStyle, inputStyle, labelStyle), helpers.js (esc),
//             state.js, storage.js (getWidgetData, setWidgetData, save),
//             render.js (render), actions_<name>.js
// Registered via registerWidget() — see widget_registry.js.

function render<Name>Widget(todayStr, now) {
  const data = getWidgetData('<name>', { entries: [], settings: {} });

  return `
    <div data-no-clobber="true">
      <!-- widget body -->
    </div>
  `;
}

registerWidget({
  id: '<name>',
  label: '<Display Name>',
  icon: 'ti-icon',
  pinnable: true,
  collapsible: true,
  fullWidth: true,
  defaultVisible: false,
  render: render<Name>Widget,
});
```

```js
// <Name> widget actions.
// Depends on: state.js, storage.js (getWidgetData, setWidgetData, save),
//             ui.js (showToast), render.js (render).
// Called from: render_<name>.js

function add<Name>Entry() {
  const data = getWidgetData('<name>', { entries: [], settings: {} });
  data.entries.push({ id: Date.now(), /* ... */ });
  setWidgetData('<name>', data);
  save();
  render();
}
```
