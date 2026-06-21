/*
MODULE: data.js
LAYER: state
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: data.js responsibilities
USES: local modules
STATE_READS: habits, state, tasks
STATE_WRITES: alarms, audioRecordings, categories, dailyIntentions, energyLog, focusBoardManualIds, focusSubtaskId, focusTaskId, habits, journalEntries
PUBLIC_API: none
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// NOT CURRENTLY LOADED — see src/state/index.js header for context.
// state/data.js
//
// Phase 1 migration: declarations copied verbatim from state.js (still the
// live source of truth — index.html loads state.js, not this file). Each
// line below has a matching `// MIGRATED TO state/data.js (pending removal)`
// comment added next to the original in state.js. Do not delete the
// originals until app loads without console errors, all references resolve,
// and no undefined globals remain — per the project's migration rules.

export let categories = [];
export let tasks = [];
export let alarms = [];
export let habits = [];
export let templates = [];
export let offTaskLog = [];
export let timeSessions = []; // {id, taskId, subtaskId?, startedAt, endedAt, seconds, mode, type}
export let journalEntries = []; // {id, type, text, catId, createdAt, audioId?}
export let energyLog = []; // [{date, energy, sensory, tag}]
export let dailyIntentions = {date:'',answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null}; // winOutcome: null | 'yes' | 'partial' | 'no'
export let focusBoardManualIds = []; // task ids pinned to focus board in manual mode
export let plannerDayDumps = {}; // {[ymd]: [{id,text,catId,done,createdAt}]} — quick captures per day
export let audioRecordings = []; // {id, label, createdAt, durationSecs, mimeType}
export let widgetLayout = []; // [{id, visible, collapsed, order}]
export let focusTaskId = null;
export let focusSubtaskId = null; // id of the sub-task currently focused (null = parent task is focus)
