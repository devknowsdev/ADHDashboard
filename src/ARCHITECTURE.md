## Current Status / Next Step

**Verify before reading anything — run, don't view:**
```
grep -c "^registerWidget(" *.js | awk -F: '{s+=$2} END{print s}'  # expect 8 (wizard is NOT a widget — does not add to this count)
node test_workflows.js | tail -3  # expect 331 passed, 0 failed
```

**Completed: AI Integration Layer (HANDOFF_ai.md)**

331 tests passing — WF31 (AI Layer) added on top of the prior 313.

### AI layer (`src/ai.js`)
Provider abstraction: Ollama (local-first) + Anthropic Claude. Settings stored
separately under `adhd4_ai_settings` + `adhd4_ai_key` (never in JSON backup).
All AI calls return `null` on failure — full graceful degradation when disabled
or unreachable. Privacy: only task text + aggregate stats sent; voice/journal
never sent.

Integration points: Dump NL parse, task AI breakdown, wizard personalised
prompts, weekly nudge in Check-in. Settings modal (gear icon in header).

**Previously completed: Day Wizard (HANDOFF_day_wizard.md)**

### What it is
A guided Day Start / Day End overlay, triggered by a dismissable banner at
the top of the page (not auto-opened, not a blocking modal). Lives entirely
in two new files — `actions_wizard.js` (state mutations) and
`render_wizard.js` (the overlay + banner renderers) — wired into the
existing app at three small points:
- `render.js` `_doRender()`: prepends `_renderWizardBanner(todayYmd,now)`,
  appends `renderDayWizard(todayYmd,now)` when `dayWizardOpen` (normal
  render path only — crisis mode is intentionally unaffected, since its
  whole point is to hide everything except the timer)
- `storage.js`: `load()`/`_flushSave()` persist `dayWizardState` under
  `adhd4_day_wizard`, and `dayEndHour` under `adhd4_day_end_hour`
- `runtime.js` `_handleDateRollover()`: resets `dayWizardState` (new day →
  prompts reappear) and `wizReviewMode`

### New state (state.js)
`dayWizardState` (persisted: `date`,`phase`,`step`,`startDone`,`endDone`,
`wizBannerDismissedAt`), plus five ephemeral (never persisted) fields:
`dayWizardOpen`, `wizCaptureInput`, `wizCaptureList`, `wizShowAllCarryOver`,
`wizReviewMode`. `dayEndHour` (persisted, default 17) controls when the
Day End banner becomes eligible to show.

### Step sequencing
Both phases' step lists are computed fresh every render via
`_wizStepsFor(phase, todayYmd)` rather than hardcoded indices — `step` is
just an integer index into whatever that function currently returns. This
is what lets Day End's two conditional steps (Untracked Day, Priority
outcome) drop out of the sequence cleanly when they don't apply, without
the action layer needing to know about the condition at all.

### Known deviations from the literal handoff spec (intentional)
- `wizMarkCarryOver(id,'done')` sets `t.status`/`t.done`/`t.doneDate`
  directly rather than calling `toggleTask()` — `toggleTask` cycles
  todo→inprogress→done→todo, so a single call wouldn't reliably land on
  `'done'` from an arbitrary starting state.
- Energy-step "already logged" checks use `now.toDateString()`
  (`energyLog`/`dailyIntentions`'s native key), not `todayYmd` — the spec's
  own pseudocode named the parameter `todayYmd` in a couple of places where
  it meant the `toDateString()` value; this file computes both and passes
  the right one to each callee.
- Untracked Day's "It went differently" branch is a small persisted-free
  sub-mode (`wizReviewMode`) rather than new per-task wizard step state —
  reuses the same done/drop button pattern as Carry-over.

### Files touched
New: `actions_wizard.js`, `render_wizard.js`.
Changed: `state.js`, `storage.js`, `runtime.js`, `render.js`,
`test_workflows.js` (WF30 block + `resetState()` additions), `index.html`
(two script tags, after `render_planner.js`, before `actions.js`).
Untouched, as specced: `core.js`, `helpers.js`, `constants.js`,
`widget_registry.js`, all other `render_*.js` files, `actions_tasks.js`,
`actions_planner.js`, `actions.js`, `actions_alarms_habits.js`.

**Next implementation:** none queued. Settings UI for `dayEndHour` lives in the
Day Log widget (alongside `dayStartHour`), range 14–22.



# ADHDashboard — Architecture

Local-first, no-build-step productivity dashboard. Classic `<script>` tags,
shared global scope, `localStorage` persistence. This doc is the map —
read it before grepping the codebase.

---

## 1. Load order & shared global scope

`index.html` loads files in a fixed order via classic `<script>` tags.
There is **one global scope** — every `let`/`function` declared at top
level in any file is visible to every file loaded after it.

Current order (abridged, see `index.html` for exact):

```
constants.js   → DAYS, COLOR_OPTS, LIGHT/DARK themes, HABIT_ANCHORS
state.js       → all mutable global state (let declarations)
widget_registry.js → registerWidget, getRegisteredWidgets, getWidgetDef
helpers.js     → esc, getCat, getTask, fmtDur, caches, sort/compare helpers
core.js        → btnStyle/inputStyle/etc, widget chrome, energy/intentions
storage.js     → load(), save(), _flushSave(), widget layout persistence
audio.js       → IndexedDB audio recording
ui.js          → showToast
render_*.js    → one render*Widget() function per widget area
actions.js     → quick-log / idle-prompt action layer
render_modals.js → modal HTML builders
render.js      → render(), renderNow(), _doRender() — the orchestrator
music.js, render_music.js → music tools widget
actions_*.js   → action/state-mutation functions, grouped by subsystem
runtime.js     → global listeners, intervals, keyboard shortcuts (singletons)
init.js        → load(), seed data, migrations, first render()
```

---

## 2. Render pipeline

### `render()` vs `renderNow()` vs `_doRender()`
- `render()` — debounced via `requestAnimationFrame`.
- `renderNow()` — synchronous, skips debounce.
- `_doRender()` — rebuilds `#root` innerHTML from scratch.

### `data-no-clobber` — focus-preservation escape hatch
If the focused element (or ancestor) has `data-no-clobber="true"`, a full
render is skipped — only `_partialTimerUpdate()` runs. Any input whose
`oninput` handler calls `render()` MUST be in a `data-no-clobber` container.

For live feedback without full render, use targeted DOM patches (see
`_qlPatchUI`, `_idlePatchUI`, `stQlInputChange`, `tlPointerMove`).

### `_partialTimerUpdate()`
Updates per-second: float bar, SVG clock, focus-board ring1, board card
elapsed. Add new live elements here by stable ID.

---

## 3. Widget system

### Current shape (registry-based — migration complete)
- `widget_registry.js` — `registerWidget(def)`, `getRegisteredWidgets()`,
  `getWidgetDef(id)`. Loaded immediately after `state.js` in `index.html`.
- Each `render_*.js` file calls `registerWidget({id, label, icon, pinnable,
  collapsible, fullWidth, defaultVisible, render})` at its tail end.
- `widgetLayout` (state.js) — runtime/persisted array, reconciled by
  `loadWidgetLayout()` (storage.js) against `getRegisteredWidgets()`.
- `render.js` `_doRender()` resolves each widget's def and render fn via
  `getWidgetDef(w.id)` — no static map. focusboard is the one exception:
  its `render` is called with an extra `focusTask` first argument via an
  inline `w.id==='focusboard'` branch (every other widget's registered
  `render` takes `(todayStr, now)` only).
- `renderWidgetChrome()` (core.js) — generic card/header/collapse/hide/drag
  wrapper, unchanged; reads `def` via `getWidgetDef(id)`.
- `constants.js` no longer has a `WIDGETS` array — deleted once all 8
  widgets (habits, journal, daylog, checkin, tools, tasks, planner,
  focusboard) were converted.

### Adding a new widget
Per `WIDGET_GUIDE.md`: a new widget needs only a render file + actions file
+ `registerWidget()` call + two `<script>` tags in `index.html` + a FILES
entry in `test_workflows.js`. No edits to `state.js`, `core.js`,
`storage.js`, or `constants.js` should be required — if they are, that's a
signal the new widget needs something genuinely new.

---

## 4. Persistence model

Each widget owns global state in `state.js` with its own localStorage key,
read in `load()` and written in `_flushSave()` (storage.js).

### Planner / Timeline
- **Removed**: `plannedTasks` array and `adhd4_planned` localStorage key
- **Source of truth**: `tasks` array, extended with `ts` (scheduled time,
  already existed) and `durationMins` (new — calendar block duration in minutes)
- `migrateTasks()` in helpers.js sets `durationMins=null` on existing tasks,
  `taskScope:'project'` and `doneDate:''` on pre-migration tasks

### Task scope / visibility
- `taskScope: 'day' | 'project' | 'fixed'` on every task (added this session)
- `doneDate: '' | 'YYYY-MM-DD'` on every task (added this session)
- Visibility filter in `getVisibleTasksSorted()` hides stale day-scope tasks
- Timeline state (drag, draft, highlight) lives in state.js as ephemeral
  variables (not persisted): `timelineDragState`, `timelineNewTaskDraft`,
  `timelineNewTaskText`, `timelineNewTaskCatId`, `plannerHighlightTaskId`

### Save/load mechanics
- `save()` — debounced 300ms, call from any mutation
- `saveNow()` — synchronous flush, used on beforeunload and in tests
- 90-day pruning of timeSessions/offTaskLog in `load()`

---

## 5. Planner / Timeline widget

### Files
- `actions_planner.js` — date helpers, navigation, `plannerJumpToTask`,
  timeline constants (TL_START_HOUR, TL_PX_PER_MIN etc.), pointer handlers
  (`tlCreateStart`, `tlMoveStart`, `tlResizeStart`, `tlPointerMove`,
  `tlPointerUp`), `tlCommitNewTask`, `tlCancelNewTask`, `tlClearTaskTime`
- `render_planner.js` — `renderPlannerWidget()` → month grid or timeline;
  `_renderPlannerTimeline()`, `_renderPlannerMonthView()`

### Timeline interaction model
- 6am–midnight vertical axis, 1.4px/minute, snaps to 5-min increments
- **Create**: pointerdown on empty space → drag → release → inline text input appears
- **Move**: pointerdown on pill body → drag → release saves new `ts`
- **Resize**: pointerdown on pill bottom handle → drag → release saves new `durationMins`
- **Copy**: Alt/Ctrl + move-drag → duplicates task at new time
- **Click** (no drag): `plannerJumpToTask()` — scrolls Tasks widget, highlights row 1.5s
- **Remove from timeline**: × button on pill → clears `ts` and `durationMins`
- All drags use `setPointerCapture` for reliable cross-element tracking
- DOM patches during drag (no full render until pointerup)

### Month grid
Dots reflect tasks with `ts` set (not `plannedTasks`). Clicking a day opens
the timeline view for that date.

---

## 6. Established patterns

- Targeted DOM patches over full re-renders for input focus
- Surgical edits (str_replace) over full-file rewrites
- File-header dependency comments maintained on every change
- Caches invalidated on save: `_avoidanceCache`, `_taskHitsCache`
- Singletons in runtime.js: global addEventListener/setInterval registered once
- Modular extraction by feature group (e.g. render_daylog.js from render_tasks.js)

---

## 7. Testing

`test_workflows.js` — Node harness, 29 workflow groups (WF1–WF29), 296 tests.
Run: `node test_workflows.js`. Must stay green every session.

Files loaded from `src/` via `__dirname` during test runs.
Any new source file → add to `FILES` array in `test_workflows.js`.
