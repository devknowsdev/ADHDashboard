/*
MODULE: widget_registry.js
LAYER: dispatcher/runtime
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: widget_registry.js responsibilities
USES: local modules
STATE_READS: state
STATE_WRITES: _widgetRegistry, id, w
PUBLIC_API: getRegisteredWidgets, getWidgetDef, registerWidget
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Widget registry — central store for all widget definitions.
// Loaded immediately after state.js in index.html.
// All render_*.js files call registerWidget() at their tail end.
// render.js and storage.js read from this registry at runtime.

let _widgetRegistry = [];

function registerWidget(def) {
  if (!def || !def.id || !def.render) {
    console.warn('registerWidget: invalid def', def);
    return;
  }
  if (_widgetRegistry.find(w => w.id === def.id)) {
    console.warn('registerWidget: duplicate id', def.id);
    return;
  }
  _widgetRegistry.push(def);
}

function getRegisteredWidgets() { return _widgetRegistry; }
function getWidgetDef(id) { return _widgetRegistry.find(w => w.id === id); }
