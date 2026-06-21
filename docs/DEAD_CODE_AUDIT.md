# Dead Code Audit

This audit only reports items that are provable from repository evidence.
Where the evidence is inconclusive, the item is marked as such rather than
called dead.

## Confirmed Dead Or Legacy

| Item | Evidence | Why it matters |
|---|---|---|
| `energyToday` | Declared in `state.js` and not referenced elsewhere in the audited runtime sources. `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/state.js:112-115` | It is a stray state slot that adds surface area without a visible owner. |
| `showBreakBar` | Declared in `state.js` and not referenced elsewhere in the audited runtime sources. `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/state.js:35-37` | Same issue as above; likely a retired UI toggle. |
| `src/\.js` | The file exists in the source tree, but `index.html` does not load it and it is not part of the runtime script order. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/index.html:141-169` and `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/\.js` | It behaves like a concatenated test/compatibility artifact, not production code. |
| `src/HANDOFF_ai.md`, `src/HANDOFF_day_wizard.md`, `src/HANDOFF_task_scope_and_dump.md`, `src/HANDOVER_SPRINT_010.md` | The docs exist under `src/`, but the runtime script list never loads them. The content is handoff-style archival material. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/index.html:141-169` and the file names themselves. | They are useful archive notes, but they are not active architecture docs. |

## Legacy Helpers

| Item | Evidence | Assessment |
|---|---|---|
| `parseQuickLogInput()` | `actions.js` defines it as a direct alias for `parseTimeInput()`, and the test artifact `src/test_workflows.js` still exercises it. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions.js:35-36`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/test_workflows.js:1866-1870` | Not dead yet, but it is only compatibility glue. It can be removed only after the remaining callers are gone. |
| `tasks[].done` | The migration and toggles write both `status` and `done`. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/helpers.js:189-191`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions_tasktimer.js:72-79` | This is duplicate canonical state, not dead code, but it is still legacy surface area. |

## Unused Widgets

No unregistered runtime widget was found.

The runtime loads eight widgets through the registry, and each corresponding
render module ends with a `registerWidget()` call. Evidence:
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/widget_registry.js:3-21`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_focus.js:257-265`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_tasks.js:473-481`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_habits.js:218-226`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_journal.js:120-128`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_checkin.js:166-174`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_daylog.js:283-291`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_planner.js:516-524`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_music.js:200-208`.

## Unused CSS

No provably unused CSS selector was found in the audited runtime.

The selectors defined in `index.html` are all referenced by render code:
`.timer-bar-grid`, `.timer-controls-col`, `.timer-clock-col`,
`.timer-drag-handle`, `.timer-task-col`, `.board-card-grid`, `.cat-tabs`,
`.task-sort-row`, and `.header-date`. Evidence:
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/index.html:86-126`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_focus_timer.js:208-310`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_focus.js:199-199`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_tasks.js:17-49`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render.js:179-188`.

## Duplicate Helpers

| Item | Evidence | Recommendation |
|---|---|---|
| `parseQuickLogInput()` alias | `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions.js:35-36` | Keep only while compatibility or tests require it. |
| Direct inline schedule mutations in planner views | `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_planner.js:222-224`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_planner.js:460-461` | Convert into a shared action helper when a refactor is justified. |
| Dual task completion flags | `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/helpers.js:189-191`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions_tasktimer.js:72-79` | Remove one field in a future cleanup pass. |

## Obsolete Documentation

The following are archive/handoff artifacts rather than active governance docs:

* `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/HANDOFF_ai.md`
* `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/HANDOFF_day_wizard.md`
* `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/HANDOFF_task_scope_and_dump.md`
* `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/HANDOVER_SPRINT_010.md`

They are not loaded by `index.html`, and the runtime docs already have more
current guidance in `START_HERE`, `ARCHITECTURE.md`, and `WIDGET_GUIDE.md`.
