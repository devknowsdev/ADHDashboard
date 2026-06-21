/*
MODULE: state.js
LAYER: state
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: state.js responsibilities
USES: local modules
STATE_READS: DATA, T, darkMode, habits, state, tasks
STATE_WRITES: T, activeSession, addingSubtaskForTaskId, alarms, audioRecState, audioRecordings, audioStream, boardCardNoteEditId, boardSubExpandedTaskIds, categories
PUBLIC_API: none
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Mutable application state lives here so the rest of the app can focus on
// behavior instead of also owning the global declarations.

let darkMode=false; // MIGRATED TO state/uiState.js (pending removal)
let T=LIGHT; // MIGRATED TO state/uiState.js (pending removal)

let categories=[],tasks=[],alarms=[],habits=[],templates=[]; // MIGRATED TO state/data.js (pending removal)
let offTaskLog=[]; // MIGRATED TO state/data.js (pending removal)
let dayStartHour=8; // MIGRATED TO state/uiState.js (pending removal)
let taskFilter='all',focusTaskId=null,newCatColorIdx=0,editingCatId=null,showCatModal=false; // MIGRATED TO state/uiState.js / state/data.js (split across files, pending removal)
let taskSortMode='manual'; // manual | time | added | status // MIGRATED TO state/uiState.js (pending removal)
let editingTimeId=null; // MIGRATED TO state/uiState.js (pending removal)
let editingEstimateId=null; // MIGRATED TO state/uiState.js (pending removal)
let editingSubtaskEstimateId=null; // {taskId, subtaskId} or null // MIGRATED TO state/uiState.js (pending removal)
let editingTaskCatId=null; // MIGRATED TO state/uiState.js (pending removal)
let editingMusicField=null; // {taskId, subtaskId, field} — 'key' | 'tuning' | 'bpm' // MIGRATED TO state/uiState.js (pending removal)
let expandedLyricsId=null;  // {taskId, subtaskId} with lyrics textarea open // MIGRATED TO state/uiState.js (pending removal)
let editingOffTaskId=null; // MIGRATED TO state/uiState.js (pending removal)
let editingHabitHitId=null; // MIGRATED TO state/uiState.js (pending removal)
let urgencyPickerTaskId=null; // task id with flame picker open // MIGRATED TO state/uiState.js (pending removal)
let taskOverflowOpenId=null;  // task id with ••• overflow panel open // MIGRATED TO state/uiState.js (pending removal)
let clockColWidth=220; // px width of the resizable clock column (rings layout) // MIGRATED TO state/uiState.js (pending removal)
let expandedHabitId=null; // MIGRATED TO state/uiState.js (pending removal)
let hitInputHabitId=null;  // habit id with the inline hit-entry popover open // MIGRATED TO state/uiState.js (pending removal)
let hitInputMins=0;        // pending minutes in the open popover // MIGRATED TO state/uiState.js (pending removal)
let hitInputTime='';       // pending HH:MM time-of-day in the open popover // MIGRATED TO state/uiState.js (pending removal)
let dragSourceId=null; // MIGRATED TO state/runtimeState.js (pending removal)
let dragSubtaskSourceId=null; // {taskId, subtaskId} // MIGRATED TO state/runtimeState.js (pending removal)
let focusBoardMode='all'; // 'all' | 'urgent' | 'manual' // MIGRATED TO state/uiState.js (pending removal)
let focusBoardManualIds=[]; // task ids pinned to focus board in manual mode // MIGRATED TO state/data.js (pending removal)
let focusBoardPickerOpen=false; // task picker dropdown open in manual mode // MIGRATED TO state/uiState.js (pending removal)
let focusBoardPickerSearch='';  // search text in manual-mode picker // MIGRATED TO state/uiState.js (pending removal)
let focusWindowMode='clean'; // 'clean' | 'tasklog' | 'daylog' // MIGRATED TO state/uiState.js (pending removal)
let timerLayout='rings';   // 'rings' | 'bars' — focus board timer display mode // MIGRATED TO state/uiState.js (pending removal)
let energyFilterOn=false; // MIGRATED TO state/uiState.js (pending removal)
let showTimeTargets=false; // focus board: time targets panel open // MIGRATED TO state/uiState.js (pending removal)
let showBreakBar=false;    // break shortcuts panel — hidden by default, toggled by user // MIGRATED TO state/uiState.js (pending removal)

// Focus picker + time tracking
let showFocusModal=false; // MIGRATED TO state/uiState.js (pending removal)
let focusSearch=''; // MIGRATED TO state/uiState.js (pending removal)
let showSessionsModal=false; // MIGRATED TO state/uiState.js (pending removal)
let timeSessions=[]; // {id, taskId, subtaskId?, startedAt, endedAt, seconds, mode, type} // MIGRATED TO state/data.js (pending removal)
let editingSessionId=null; // MIGRATED TO state/uiState.js (pending removal)
let editingSessionSecs=0;   // canonical backing store in seconds // MIGRATED TO state/uiState.js (pending removal)
let editingSessionMmSs='00:00'; // MM:SS string shown in the edit field // MIGRATED TO state/uiState.js (pending removal)
let sessionsViewTaskId=null; // MIGRATED TO state/uiState.js (pending removal)

// Subtask state
let focusSubtaskId=null; // id of the sub-task currently focused (null = parent task is focus) // MIGRATED TO state/data.js (pending removal)
let expandedSubtaskTaskIds=new Set(); // set of parent task IDs whose subtask list is expanded (task list) // MIGRATED TO state/uiState.js (pending removal)
let boardSubExpandedTaskIds=new Set(); // set of parent task IDs whose subtask pills are shown on the focus board // MIGRATED TO state/uiState.js (pending removal)
let boardCardNoteEditId=null; // task id whose note is being edited inline on the board card // MIGRATED TO state/uiState.js (pending removal)
let addingSubtaskForTaskId=null;  // task id where inline "add subtask" input is open // MIGRATED TO state/uiState.js (pending removal)
let expandedNoteTaskId=null; // task id with note textarea open // MIGRATED TO state/uiState.js (pending removal)
let subtaskQuickLogId=null; // {taskId, subtaskId} or null // MIGRATED TO state/uiState.js (pending removal)
let subtaskQuickLogInput=''; // raw text input in subtask quick-log popover // MIGRATED TO state/uiState.js (pending removal)
let timeSummaryTab='today'; // 'today' | 'week' | 'alltime' // MIGRATED TO state/uiState.js (pending removal)

// Timer state (tied to focused task)
let timerRunning=false; // MIGRATED TO state/runtimeState.js (pending removal)
let timerMode='countdown'; // 'countdown' | 'stopwatch' // MIGRATED TO state/runtimeState.js (pending removal)
let timerCountdownMins=25; // MIGRATED TO state/runtimeState.js (pending removal)
let timerSecs=25*60; // remaining for countdown, elapsed for stopwatch // MIGRATED TO state/runtimeState.js (pending removal)
let timerPlannedSecs=25*60; // countdown original duration // MIGRATED TO state/runtimeState.js (pending removal)
let timerInterval=null; // MIGRATED TO state/runtimeState.js (pending removal)
let activeSession=null; // {id, taskId, startedAt, mode} // MIGRATED TO state/runtimeState.js (pending removal)

// Quick-log modal (shown after timer stops, or via Shift+Enter / double-click on timer)
let showQuickLog=false; // MIGRATED TO state/uiState.js (pending removal)
let quickLogTaskId=null; // MIGRATED TO state/uiState.js (pending removal)
let quickLogSecs=0;        // pre-filled from timer; user can override // MIGRATED TO state/uiState.js (pending removal)
let quickLogInput='';      // raw digit buffer typed by user // MIGRATED TO state/uiState.js (pending removal)
let quickLogNote='';       // optional note // MIGRATED TO state/uiState.js (pending removal)
let quickLogStartedAt=0;   // wall time of session start (for accurate record) // MIGRATED TO state/uiState.js (pending removal)

// Audio recorder
let audioRecordings=[]; // {id, label, createdAt, durationSecs, mimeType} // MIGRATED TO state/data.js (pending removal)
let editingAudioLabelId=null; // MIGRATED TO state/uiState.js (pending removal)
let audioRecState='idle'; // idle | recording // MIGRATED TO state/runtimeState.js (pending removal)
let mediaRecorder=null,audioStream=null,recChunks=[],recStartedAt=0,recTickInterval=null; // MIGRATED TO state/runtimeState.js (pending removal)
let playingAudioId=null,currentAudioEl=null; // MIGRATED TO state/runtimeState.js (pending removal)

// Journal
let journalEntries=[];        // {id, type, text, catId, createdAt, audioId?} // MIGRATED TO state/data.js (pending removal)
let journalDateFilter='today'; // 'today' | 'yesterday' | 'week' // MIGRATED TO state/uiState.js (pending removal)
let journalNewType='todo';     // type selected in capture bar // MIGRATED TO state/uiState.js (pending removal)

// Widget registry / layout
let widgetLayout=[];      // [{id, visible, collapsed, order}] // MIGRATED TO state/data.js (pending removal)
let showWidgetDrawer=false; // MIGRATED TO state/uiState.js (pending removal)
let dragSourceWidgetId=null; // MIGRATED TO state/runtimeState.js (pending removal)
let showWarnings=true; // tasks widget: show/hide risk badges + resolution prompts // MIGRATED TO state/uiState.js (pending removal)

// Crisis / focus-mode overlay
let crisisMode=false; // MIGRATED TO state/uiState.js (pending removal)

// Idle prompt ("Been busy?")
let idlePromptShown=false;        // true once the modal is visible // MIGRATED TO state/uiState.js (pending removal)
let lastInteractionAt=Date.now(); // updated on any user action // MIGRATED TO state/runtimeState.js (pending removal)
let idlePromptThresholdMins=20;   // configurable N minutes // MIGRATED TO state/uiState.js (pending removal)
let idlePromptInput='';           // time-field text for the idle log // MIGRATED TO state/uiState.js (pending removal)
let idlePromptTaskId=null;        // task selected in the idle sheet // MIGRATED TO state/uiState.js (pending removal)

// Break timer
let timerSessionType='work'; // 'work' | 'break' // MIGRATED TO state/uiState.js (pending removal)

// Transition prompt (shown when countdown reaches zero on a work session)
let showTransitionPrompt=false; // MIGRATED TO state/uiState.js (pending removal)
let transitionReflect='';     // pending one-line reflection // MIGRATED TO state/uiState.js (pending removal)

// Energy / mood check-in
let energyLog=[];  // [{date, energy, sensory, tag}] // MIGRATED TO state/data.js (pending removal)
let energyToday=null; // today's pending entry before save // DEAD CODE — not migrated, candidate for deletion (see state_migration_findings.md)
let energyPending={energy:null,sensory:null,tag:''}; // MIGRATED TO state/runtimeState.js (pending removal)

// Daily planning questions — CBT/ADHD framing
let dailyIntentions={date:'',answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null}; // winOutcome: null | 'yes' | 'partial' | 'no' // MIGRATED TO state/data.js (pending removal)

// ── Music Tools state ────────────────────────────────────────────────────────
let toolsTab='metronome'; // 'metronome' | 'tuner' | 'keyboard' // MIGRATED TO state/uiState.js (pending removal)

// Metronome
let metroBpm=120; // MIGRATED TO state/runtimeState.js (pending removal)
let metroRunning=false; // MIGRATED TO state/runtimeState.js (pending removal)
let metroInterval=null; // MIGRATED TO state/runtimeState.js (pending removal)
let metroBeat=0;        // current beat index (0-based within bar) // MIGRATED TO state/runtimeState.js (pending removal)
let metroBeats=4;       // beats per bar // MIGRATED TO state/runtimeState.js (pending removal)
let metroSubdivision=1; // 1=quarter, 2=eighth, 4=sixteenth // MIGRATED TO state/runtimeState.js (pending removal)
let metroFlash=false;   // true for one render tick on each beat for visual flash // MIGRATED TO state/runtimeState.js (pending removal)
let metroAudioCtx=null; // MIGRATED TO state/runtimeState.js (pending removal)
let metroNextTime=0;    // Web Audio scheduler lookahead time // MIGRATED TO state/runtimeState.js (pending removal)

// Tuner
let tunerStream=null; // MIGRATED TO state/runtimeState.js (pending removal)
let tunerAnalyser=null; // MIGRATED TO state/runtimeState.js (pending removal)
let tunerAudioCtx=null; // MIGRATED TO state/runtimeState.js (pending removal)
let tunerActive=false; // MIGRATED TO state/runtimeState.js (pending removal)
let tunerNote='—'; // MIGRATED TO state/runtimeState.js (pending removal)
let tunerCents=0; // MIGRATED TO state/runtimeState.js (pending removal)
let tunerFreq=0; // MIGRATED TO state/runtimeState.js (pending removal)
let tunerRafId=null; // MIGRATED TO state/runtimeState.js (pending removal)

// Keyboard
let kbOctave=4; // MIGRATED TO state/runtimeState.js (pending removal)
let kbVolume=0.5; // MIGRATED TO state/runtimeState.js (pending removal)
let kbWaveform='sine'; // MIGRATED TO state/runtimeState.js (pending removal)
let kbActiveNotes=new Set(); // currently pressed note names // MIGRATED TO state/runtimeState.js (pending removal)
let kbAudioCtx=null; // MIGRATED TO state/runtimeState.js (pending removal)
let kbOscillators=new Map(); // noteName → {osc, gain} // MIGRATED TO state/runtimeState.js (pending removal)

// ── Planner state ─────────────────────────────────────────────────────────────
// plannedTasks removed — tasks with ts+durationMins is the source of truth
let plannerView='month';          // 'month' | 'dump' | 'day' | 'week' // MIGRATED TO state/uiState.js (pending removal)
let plannerSelectedDate=null;     // 'YYYY-MM-DD' | null // MIGRATED TO state/uiState.js (pending removal)
let plannerMonth=null;            // {year, month} | null (null = current month) // MIGRATED TO state/uiState.js (pending removal)
let plannerHighlightTaskId=null;  // task id briefly highlighted after plannerJumpToTask // MIGRATED TO state/uiState.js (pending removal)
let plannerDayDumps={};           // {[ymd]: [{id,text,catId,done,createdAt}]} — quick captures per day // MIGRATED TO state/data.js (pending removal)
let plannerDumpInput='';          // text field for new dump entry // MIGRATED TO state/uiState.js (pending removal)
let plannerZoom=1.0;              // zoom multiplier 0.4–2.5 // MIGRATED TO state/uiState.js (pending removal)
let plannerDayLayout='vertical';  // 'vertical' | 'horizontal' — day timeline orientation // MIGRATED TO state/uiState.js (pending removal)

// Timeline interaction state (ephemeral — never persisted)
let timelineDragState=null;       // {type,taskId?,startY,startMins,curMins,origTs?,origDur?,scroll?,altCopy?} // MIGRATED TO state/runtimeState.js (pending removal)
let timelineNewTaskDraft=null;    // {startMins,endMins} — shown while drag-to-create is in progress // MIGRATED TO state/runtimeState.js (pending removal)
let timelineNewTaskText='';       // text input value for the new-task overlay // MIGRATED TO state/uiState.js (pending removal)
let timelineNewTaskCatId='';      // category selection for the new-task overlay // MIGRATED TO state/uiState.js (pending removal)

// ── Day Wizard state ─────────────────────────────────────────────────────────
// Not yet categorized in the state/ split (see state_migration_findings.md) —
// added after that audit. dayWizardState → DATA, the rest → UI/runtime if the
// split is ever revisited.
let dayWizardState={
  date:'',              // YYYY-MM-DD — which day this run is for
  phase:null,           // null | 'start' | 'end'
  step:0,               // current step index within the phase
  startDone:false,
  endDone:false,
  wizBannerDismissedAt:0, // ms timestamp — banner re-shows 2h after dismiss
};
let dayWizardOpen=false;          // overlay visible (ephemeral — never persisted)
let wizCaptureInput='';           // ephemeral rapid-capture text buffer (not persisted)
let wizCaptureList=[];            // ephemeral list of items captured this wizard session (not persisted)
let wizShowAllCarryOver=false;    // ephemeral UI toggle for the carry-over step's "show all" (not persisted)
let wizReviewMode=false;          // ephemeral — true while inside the Untracked Day "it went differently" per-task review sub-flow (not persisted)
let dayEndHour=17;                // hour (0-23) after which the Day End banner can appear
