# State Ownership Audit

Scope: this audit uses the full repo source under `ADHDashboard Repo/` as evidence.
All claims below are tied to observable code paths, not inferred intent.

## Subsystem Ownership Map

| Subsystem | Owner | Canonical state | Derived state | Persistence | Consumers |
|---|---|---|---|---|---|
| Tasks | `actions_tasktimer.js`, `actions_tasks.js`, `helpers.js` | `tasks[]` and task fields such as `status`, `ts`, `subtasks`, `note`, `urgency`, `estimatedMins`, `durationMins` | `done` mirrors `status === 'done'`; filtered task lists; task-hit summaries for habits; task totals | `adhd4_tasks` via `storage.js` | `render_tasks.js`, `render_focus.js`, `render_focusboard_cards.js`, `render_daylog.js`, `render_planner.js`, `helpers.js`, `runtime.js`, `actions_export.js` |
| Timer and sessions | `actions_tasktimer.js`, `runtime.js`, `storage.js` | `timerRunning`, `timerMode`, `timerSecs`, `timerPlannedSecs`, `timerSessionType`, `activeSession`, `timeSessions[]` | Partial timer labels, live elapsed labels, quick-log defaults, session edit strings | `adhd4_time_sessions`, plus timer-related UI keys like `adhd4_timer_layout` and `adhd4_focus` | `render.js`, `render_focus_timer.js`, `render_focus.js`, `render_tasks.js`, `render_daylog.js`, `render_focusboard_cards.js`, `render_modals.js`, `actions_export.js` |
| Habits / daily tasks | `actions_alarms_habits.js`, `helpers.js`, `render_habits.js` | `habits[]` and each habit’s `hits[]` | Synthetic task-derived hits from category matches; streak counts; 7-day dot grid; today totals | `adhd4_habits` | `render_habits.js`, `render_daylog.js`, `actions_export.js`, `helpers.js` |
| Journal + voice notes | `audio.js`, `actions_tasktimer.js`, `helpers.js`, `storage.js` | `journalEntries[]` and `audioRecordings[]` | Voice journal entries are duplicated across journal and audio metadata; filtered journal views by date/type | `adhd4_journal` and `adhd4_audio_meta` | `render_journal.js`, `render_focus.js`, `render_daylog.js`, `actions_export.js`, `audio.js`, `init.js` |
| Check-in / intentions | `actions_alarms_habits.js`, `render_checkin.js`, `helpers.js`, `storage.js` | `energyLog[]`, `energyPending`, `dailyIntentions` | `getEnergyToday(todayStr)`, today completion state, intention step completion, summary spark strip | `adhd4_energy`, `adhd4_intentions` | `render_checkin.js`, `render_focus.js`, `render_daylog.js`, `actions_tasktimer.js` |
| Planner | `actions_planner.js`, `render_planner.js`, `storage.js` | `plannerView`, `plannerSelectedDate`, `plannerMonth`, `plannerDayDumps`, `plannerDumpInput`, `plannerZoom`, `plannerDayLayout`, `timelineDragState`, `timelineNewTaskDraft`, `timelineNewTaskText`, `timelineNewTaskCatId` | Month/week/day/dump view selection, timeline positions, unscheduled trays, dump counts, zoom scaling | `adhd4_day_dumps` and normal app save cycle | `render_planner.js`, `actions_planner.js`, `render_tasks.js` |
| Widget registry / layout | `widget_registry.js`, `storage.js`, `core.js`, `render.js` | `_widgetRegistry[]`, `widgetLayout[]` | Ordered visible widget list, hidden count, per-widget collapsed state, migrated widget IDs | `adhd4_widget_layout` | `render.js`, `core.js`, `render_music.js`, `render_planner.js`, `render_checkin.js`, `render_daylog.js`, `render_journal.js`, `render_habits.js`, `render_tasks.js`, `render_focus.js` |
| Global render/runtime shell | `state.js`, `render.js`, `runtime.js`, `init.js`, `storage.js` | Shared global UI flags such as `darkMode`, `crisisMode`, `showFocusModal`, `showSessionsModal`, `showWidgetDrawer`, `showWarnings`, `focusTaskId`, `focusSubtaskId`, `clockColWidth`, `focusBoardMode`, `focusBoardManualIds`, `timerLayout` | `orderedWidgets`, `hiddenCount`, `ensureFocusValid()` correction, partial timer patch targets, idle prompt visibility | `adhd4_dark`, `adhd4_crisis_mode`, `adhd4_focus_board_mode`, `adhd4_focus_board_manual`, `adhd4_clock_col_width`, `adhd4_focus`, `adhd4_timer_layout` | `render.js`, `runtime.js`, `render_modals.js`, `render_focus.js`, `render_tasks.js`, `render_daylog.js`, `render_checkin.js`, `render_journal.js`, `render_habits.js`, `render_music.js` |
| Categories, alarms, and export | `actions_export.js`, `actions_alarms_habits.js`, `storage.js` | `categories[]`, `alarms[]` | Category colors, alarm fire state, exported backup payloads | `adhd4_cats`, `adhd4_alarms` | `render_tasks.js`, `render_modals.js`, `render_focusboard_cards.js`, `render_habits.js`, `render_journal.js`, `render_daylog.js`, `actions_export.js` |
| Music tools | `music.js`, `render_music.js`, `state.js` | `toolsTab`, `metro*`, `tuner*`, `kb*` | Active beat, tuner needle, active keyboard notes | No dedicated persistence found in the audited code | `render_music.js`, `music.js` |

## Duplicate State

* `tasks[].status` and `tasks[].done` represent the same completion concept. `migrateTasks()` forces them to match, and `toggleTask()` / `doneFocus()` write both fields together. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/helpers.js:189-191`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions_tasktimer.js:72-79`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions_tasktimer.js:145-153`.
* Voice-note content is stored twice: once in `audioRecordings[]` and again as `journalEntries[]` with `type:'voice'` and `audioId`. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/audio.js:116-123`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/audio.js:175-181`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/helpers.js:235-243`.
* Task-derived habit hits are stored as synthetic read models, not as primary habit state. That is intentional, but it means the same completion event can appear in `tasks`, `timeSessions`, and the habit UI. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/helpers.js:99-144`.

## Unclear Ownership

* `energyToday` is declared in `state.js` but has no visible runtime consumers in the audited source. `showBreakBar` appears the same way. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/state.js:112-115`.
* `plannerDayDumps` is owned by the planner, but planner actions also mutate `tasks[].ts` and `tasks[].durationMins` directly from planner views. That keeps task scheduling canonical in `tasks`, but the write path is split between planner and task code. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions_planner.js:110-116`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions_planner.js:197-215`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_planner.js:460-483`.
* `focusTaskId` and `focusSubtaskId` are shared across storage, runtime shortcuts, timer controls, focus board rendering, and task actions. That is workable, but the ownership boundary is global rather than local to a single widget. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/state.js:7-18`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/storage.js:14-19`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/runtime.js:45-210`.

## Derived Values Stored as Canonical

* `editingSessionMmSs` is a transient UI representation of `editingSessionSecs`; it is necessary for editing, but it is still a derived value rather than source data. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/state.js:43-47`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions_tasktimer.js:165-190`.
* The focus board and timer use patched DOM labels keyed by `focusTaskId` and current timer mode instead of recomputing from state on every tick. That is a deliberate render optimization, but it means the render layer owns a second live representation of timer text. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render.js:3-47`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_focusboard_cards.js:335-335`.

## Simplification Opportunities

* Collapse task completion into one field and migrate all reads to that field.
* Keep voice-note metadata in one place and derive the journal entry view from it.
* Move planner task placement into a shared helper so the month, dump, and timeline views stop mutating `tasks` inline in separate places.
* Remove or repurpose dead-looking state such as `energyToday` and `showBreakBar` once a consumer is confirmed absent.
* Reduce global UI flags where a widget-local owner exists, especially for focus and planner workflows.
