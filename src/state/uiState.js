/*
MODULE: uiState.js
LAYER: state
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: uiState.js responsibilities
USES: local modules
STATE_READS: T, darkMode, state, tasks
STATE_WRITES: T, addingSubtaskForTaskId, boardCardNoteEditId, boardSubExpandedTaskIds, clockColWidth, crisisMode, darkMode, dayStartHour, editingAudioLabelId, editingCatId
PUBLIC_API: none
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// NOT CURRENTLY LOADED — see src/state/index.js header for context.
// state/uiState.js
//
// Phase 1 migration: declarations copied verbatim from state.js (still the
// live source of truth). See src/state/data.js header for migration rules.
//
// NOTE: `T = LIGHT` depends on `LIGHT`, a global `const` declared in
// constants.js and made available only via classic-script load order
// (constants.js loads before state.js in index.html). This file has no way
// to see LIGHT as an ES module — it will throw ReferenceError if ever
// actually imported as-is. Needs either an explicit import of LIGHT from a
// real module version of constants.js (doesn't exist yet), or LIGHT passed
// in some other way, before this file can be wired up for real.

export let darkMode = false;
export let T = LIGHT;
export let dayStartHour = 8;
export let taskFilter = 'all';
export let newCatColorIdx = 0;
export let editingCatId = null;
export let showCatModal = false;
export let taskSortMode = 'manual'; // manual | time | added | status
export let editingTimeId = null;
export let editingEstimateId = null;
export let editingSubtaskEstimateId = null; // {taskId, subtaskId} or null
export let editingTaskCatId = null;
export let editingMusicField = null; // {taskId, subtaskId, field} — 'key' | 'tuning' | 'bpm'
export let expandedLyricsId = null; // {taskId, subtaskId} with lyrics textarea open
export let editingOffTaskId = null;
export let editingHabitHitId = null;
export let urgencyPickerTaskId = null; // task id with flame picker open
export let taskOverflowOpenId = null; // task id with ••• overflow panel open
export let clockColWidth = 220; // px width of the resizable clock column (rings layout)
export let expandedHabitId = null;
export let hitInputHabitId = null; // habit id with the inline hit-entry popover open
export let hitInputMins = 0; // pending minutes in the open popover
export let hitInputTime = ''; // pending HH:MM time-of-day in the open popover
export let focusBoardMode = 'all'; // 'all' | 'urgent' | 'manual'
export let focusBoardPickerOpen = false; // task picker dropdown open in manual mode
export let focusBoardPickerSearch = ''; // search text in manual-mode picker
export let focusWindowMode = 'clean'; // 'clean' | 'tasklog' | 'daylog'
export let timerLayout = 'rings'; // 'rings' | 'bars' — focus board timer display mode
export let energyFilterOn = false;
export let showTimeTargets = false; // focus board: time targets panel open
export let showBreakBar = false; // break shortcuts panel — hidden by default, toggled by user
export let showFocusModal = false;
export let focusSearch = '';
export let showSessionsModal = false;
export let editingSessionId = null;
export let editingSessionSecs = 0; // canonical backing store in seconds
export let editingSessionMmSs = '00:00'; // MM:SS string shown in the edit field
export let sessionsViewTaskId = null;
export let expandedSubtaskTaskIds = new Set(); // set of parent task IDs whose subtask list is expanded (task list)
export let boardSubExpandedTaskIds = new Set(); // set of parent task IDs whose subtask pills are shown on the focus board
export let boardCardNoteEditId = null; // task id whose note is being edited inline on the board card
export let addingSubtaskForTaskId = null; // task id where inline "add subtask" input is open
export let expandedNoteTaskId = null; // task id with note textarea open
export let subtaskQuickLogId = null; // {taskId, subtaskId} or null
export let subtaskQuickLogInput = ''; // raw text input in subtask quick-log popover
export let timeSummaryTab = 'today'; // 'today' | 'week' | 'alltime'
export let showQuickLog = false;
export let quickLogTaskId = null;
export let quickLogSecs = 0; // pre-filled from timer; user can override
export let quickLogInput = ''; // raw digit buffer typed by user
export let quickLogNote = ''; // optional note
export let quickLogStartedAt = 0; // wall time of session start (for accurate record)
export let editingAudioLabelId = null;
export let journalDateFilter = 'today'; // 'today' | 'yesterday' | 'week'
export let journalNewType = 'dump'; // type selected in capture bar
export let showWidgetDrawer = false;
export let showWarnings = true; // tasks widget: show/hide risk badges + resolution prompts
export let crisisMode = false;
export let idlePromptShown = false; // true once the modal is visible
export let idlePromptThresholdMins = 20; // configurable N minutes
export let idlePromptInput = ''; // time-field text for the idle log
export let idlePromptTaskId = null; // task selected in the idle sheet
export let timerSessionType = 'work'; // 'work' | 'break'
export let showTransitionPrompt = false;
export let transitionReflect = ''; // pending one-line reflection
export let toolsTab = 'metronome'; // 'metronome' | 'tuner' | 'keyboard'
export let plannerView = 'month'; // 'month' | 'dump' | 'day' | 'week'
export let plannerSelectedDate = null; // 'YYYY-MM-DD' | null
export let plannerMonth = null; // {year, month} | null (null = current month)
export let plannerHighlightTaskId = null; // task id briefly highlighted after plannerJumpToTask
export let plannerDumpInput = ''; // text field for new dump entry
export let plannerZoom = 1.0; // zoom multiplier 0.4–2.5
export let plannerDayLayout = 'vertical'; // 'vertical' | 'horizontal' — day timeline orientation
export let timelineNewTaskText = ''; // text input value for the new-task overlay
export let timelineNewTaskCatId = ''; // category selection for the new-task overlay
