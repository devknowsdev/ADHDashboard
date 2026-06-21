# Widget Interaction Audit

This audit describes each registered widget in terms of responsibility, I/O,
event flow, storage, rendering, and communication paths.

The runtime widget set is registered through `registerWidget()` and currently
contains eight widgets:
`focusboard`, `tasks`, `habits`, `journal`, `checkin`, `daylog`, `planner`,
and `tools`. Evidence: `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/widget_registry.js:3-21`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_focus.js:257-265`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_tasks.js:473-481`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_habits.js:218-226`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_journal.js:120-128`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_checkin.js:166-174`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_daylog.js:283-291`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_planner.js:516-524`,
`/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_music.js:200-208`.

## focusboard

| Field | Details |
|---|---|
| Responsibilities | Primary execution dashboard: focus task card, live timer strip, urgent/manual task selection, focus window, and time targets. |
| Inputs | `focusTask`, `todayStr`, `now`, plus global focus/timer/check-in state. |
| Outputs | Board cards, timer strip, transition prompt, focus-window content, manual picker, and time target panel. |
| Events | `setFocusBoardMode`, `toggleTimeTargets`, timer controls, card-level actions, manual picker clicks, focus-window tabs. |
| Dependencies | `render_focus_timer.js`, `render_focusboard_cards.js`, `helpers.js`, `state.js`, `actions_tasktimer.js`, `actions_tasks.js`, `actions_alarms_habits.js`. |
| Storage | Reads and writes `focusBoardMode`, `focusBoardManualIds`, `timerLayout`, `showTimeTargets`, `showTransitionPrompt`, `transitionReflect`, and focus state persisted elsewhere. |
| Rendering | `renderFocusBoardWidget()` stitches `_renderTimerVisual()`, `_renderTimerBar()`, `_renderManualPicker()`, `_renderTimeTargets()`, `_renderFocusTaskLog()`, and `_renderFocusDayLog()`. |
| Communication | Talks to tasks, timer/session state, check-in, habits, and runtime hotkeys through shared globals. |

Hidden coupling: the widget directly depends on task IDs, timer text patch targets, and the global focus state used by many other modules.

## tasks

| Field | Details |
|---|---|
| Responsibilities | Task list, sorting/filtering, completion, focus selection, subtask management, notes, urgency, templates, and drag/drop ordering. |
| Inputs | `todayStr`, `taskFilter`, `taskSortMode`, `focusTaskId`, `focusSubtaskId`, `showWarnings`, and task arrays. |
| Outputs | Task rows, subtask rows, overflow panel, focus controls, category pills, note editors, and quick-log entry points. |
| Events | `toggleTask`, `setFocus`, `startTaskStopwatch`, `addTask`, `deleteTask`, `toggleSubtaskExpand`, `openAddSubtask`, `saveAsTemplate`, `openCatManager`, drag/drop handlers, overflow toggle. |
| Dependencies | `actions_tasktimer.js`, `actions_tasks.js`, `actions_export.js`, `helpers.js`, `render_modals.js`, `runtime.js`. |
| Storage | Mutates `tasks[]`, `categories[]`, `timeSessions[]`, and state flags such as `editingEstimateId`, `editingTimeId`, `taskOverflowOpenId`, `editingMusicField`, `expandedLyricsId`. |
| Rendering | `renderTasksWidget()` builds rows inline and embeds task-specific controls. |
| Communication | Opens focus, starts timers, writes planner-relevant `ts` fields, and exposes task metadata to habits, planner, and day log views. |

Hidden coupling: tasks are the hub for focus, timer, planner scheduling, and habit derivation, so this widget influences nearly every other subsystem.

## habits

| Field | Details |
|---|---|
| Responsibilities | Daily habit tracking, hit logging, streak display, anchored grouping, and add/remove/edit flows. |
| Inputs | `todayStr`, `now`, `habits[]`, `categories[]`, `hitInputHabitId`, `hitInputTime`, `hitInputMins`, `editingHabitHitId`. |
| Outputs | Habit rows, 7-day grids, streak chips, manual hit chips, and the add-habit form. |
| Events | `openHitInput`, `saveHabitHit`, `removeHabitHit`, `adjustHitMins`, `setHabitAnchor`, `deleteHabit`. |
| Dependencies | `actions_alarms_habits.js`, `helpers.js`, `storage.js`. |
| Storage | Mutates `habits[]` and habit hit timestamps/minutes. |
| Rendering | `renderHabitsWidget()` groups habits by anchor and composes a row per habit. |
| Communication | Reads synthetic task-derived hits from `helpers.js`, so habit state is partly a view over task completion and session data. |

Hidden coupling: the habit UI is not purely habit-owned because `getAllHitsForHabit()` folds in task-derived hits.

## journal

| Field | Details |
|---|---|
| Responsibilities | Text journaling, voice-note playback, date filtering, and capture bar. |
| Inputs | `todayStr`, `journalEntries[]`, `journalDateFilter`, `journalNewType`, `audioRecordings[]`, `audioRecState`, `playingAudioId`. |
| Outputs | Journal entries list, capture textarea, type/category dropdowns, voice recorder bar. |
| Events | `addJournalEntry`, `toggleAudioRecording`, `playRecording`, `deleteJournalEntry`, date filter tabs. |
| Dependencies | `audio.js`, `helpers.js`, `state.js`, `storage.js`. |
| Storage | Mutates `journalEntries[]`; voice recordings are linked by `audioId` into `audioRecordings[]`. |
| Rendering | `renderJournalWidget()` renders each entry, switching between text and audio playback UI. |
| Communication | Consumes audio metadata from the recording subsystem and writes back journal entries for voice notes. |

Hidden coupling: voice-note playback and deletion rely on both the journal list and the separate audio metadata store.

## checkin

| Field | Details |
|---|---|
| Responsibilities | Energy check-in and daily planning questions. |
| Inputs | `todayStr`, `now`, `energyLog[]`, `energyPending`, `dailyIntentions`. |
| Outputs | Energy button grid, sensory buttons, tag input, save/update button, and daily intention wizard. |
| Events | `setEnergyPending`, `saveEnergyCheckin`, `advanceIntention`, `backIntention`, `skipIntention`, `resetIntentions`, `setWinOutcome`. |
| Dependencies | `helpers.js`, `actions_alarms_habits.js`, `actions_tasktimer.js`, `storage.js`. |
| Storage | Mutates `energyLog[]`, `energyPending`, and `dailyIntentions`. |
| Rendering | `renderCheckinWidget()` composes energy and intentions sections. |
| Communication | Updates the same daily plan data consumed by the focus board and transition prompt. |

Hidden coupling: the check-in UI writes data that is later surfaced in the focus board and day log, but those consumers are not local to the widget.

## daylog

| Field | Details |
|---|---|
| Responsibilities | A daily audit trail of tracked sessions, downtime, off-task entries, and summary rollups. |
| Inputs | `todayStr`, `now`, `timeSessions[]`, `offTaskLog[]`, `habits[]`, `dayStartHour`, `editingOffTaskId`, `editingSessionId`. |
| Outputs | Timeline, summary cards, off-task editor, day-start control, export/restore controls, and time summary. |
| Events | `saveOffTask`, `startEditOffTask`, `saveEditOffTask`, `deleteOffTask`, `startSessionEdit`, `saveSessionEdit`, `deleteSession`, export/import actions. |
| Dependencies | `actions_tasks.js`, `actions_export.js`, `helpers.js`, `storage.js`. |
| Storage | Mutates `offTaskLog[]`, `dayStartHour`, and session records indirectly through edit actions. |
| Rendering | `renderDayLogWidget()` plus `_renderDayTimeline()` and `_renderTimeSummary()`. |
| Communication | Pulls from task/session/habit state to show a combined day story. |

Hidden coupling: the widget blends multiple subsystems into one report, so any schema change in tasks, sessions, or habits will surface here.

## planner

| Field | Details |
|---|---|
| Responsibilities | Month/week/day planning, task scheduling, day dumps, zoom/layout controls, and drag-to-create/edit timeline blocks. |
| Inputs | `plannerView`, `plannerSelectedDate`, `plannerMonth`, `plannerDayDumps`, `plannerDumpInput`, `plannerZoom`, `plannerDayLayout`, `tasks[]`, `timelineDragState`. |
| Outputs | Sidebar navigation, month grid, week grid, day timeline, dump view, unscheduled tray, and task placement affordances. |
| Events | `plannerNavMonth`, `plannerSelectDate`, `plannerOpenDump`, `plannerOpenTimeline`, `plannerAddDump`, `plannerToggleDump`, `plannerDeleteDump`, `plannerPromoteDump`, `plannerSetZoom`, `plannerSetDayLayout`, `tlCommitNewTask`, `tlClearTaskTime`, pointer-drag handlers. |
| Dependencies | `actions_planner.js`, `helpers.js`, `storage.js`, `render.js`. |
| Storage | Mutates `plannerDayDumps[]` and task scheduling fields (`ts`, `durationMins`) on `tasks[]`. |
| Rendering | `renderPlannerWidget()` chooses month/week/day/dump renderers and wraps them in a persistent sidebar. |
| Communication | Reaches into tasks directly for scheduling and also highlights tasks back in the task list. |

Hidden coupling: planner logic writes into the task model from multiple places and relies on task rows to reflect those writes immediately.

## tools

| Field | Details |
|---|---|
| Responsibilities | Music utility tray: metronome, tuner, keyboard. |
| Inputs | `toolsTab`, `metro*`, `tuner*`, `kb*`. |
| Outputs | Three sub-tabs and their audio/visual controls. |
| Events | Metronome controls, tuner toggle, keyboard note on/off, octave and waveform selectors. |
| Dependencies | `music.js`, `helpers.js`, `core.js`. |
| Storage | No dedicated persistence path was found in the audited code. |
| Rendering | `renderToolsWidget()` switches between `_renderMetronomeTab()`, `_renderTunerTab()`, and `_renderKeyboardTab()`. |
| Communication | The widget is mostly self-contained, but it still shares global UI state and theme state with the rest of the app. |

Hidden coupling: although it is the most isolated widget, it still depends on global theme and state variables rather than local widget state.
