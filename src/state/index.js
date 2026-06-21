/*
MODULE: index.js
LAYER: state
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: index.js responsibilities
USES: local modules
STATE_READS: DATA, STATE, T, darkMode, habits, state, tasks
STATE_WRITES: none
PUBLIC_API: none
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// NOT CURRENTLY LOADED ANYWHERE.
// index.html loads state.js (137 `let` globals, no import/export) via classic
// <script> tags -- this directory is a disconnected draft of a future module
// split. See state_migration_findings.md (repo root) for the full audit and
// categorization rationale, including two resolved ambiguities (focusTaskId/
// focusSubtaskId kept together; energyToday excluded as dead code).
//
// All three domain files now re-export their complete Phase-1 sets below.
// energyToday is intentionally absent everywhere -- see runtimeState.js
// header.

// DATA
export {
  categories,
  tasks,
  alarms,
  habits,
  templates,
  offTaskLog,
  timeSessions,
  journalEntries,
  energyLog,
  dailyIntentions,
  focusBoardManualIds,
  plannerDayDumps,
  audioRecordings,
  widgetLayout,
  focusTaskId,
  focusSubtaskId
} from './data.js';

// UI STATE
export {
  darkMode,
  T,
  dayStartHour,
  taskFilter,
  newCatColorIdx,
  editingCatId,
  showCatModal,
  taskSortMode,
  editingTimeId,
  editingEstimateId,
  editingSubtaskEstimateId,
  editingTaskCatId,
  editingMusicField,
  expandedLyricsId,
  editingOffTaskId,
  editingHabitHitId,
  urgencyPickerTaskId,
  taskOverflowOpenId,
  clockColWidth,
  expandedHabitId,
  hitInputHabitId,
  hitInputMins,
  hitInputTime,
  focusBoardMode,
  focusBoardPickerOpen,
  focusBoardPickerSearch,
  focusWindowMode,
  timerLayout,
  energyFilterOn,
  showTimeTargets,
  showBreakBar,
  showFocusModal,
  focusSearch,
  showSessionsModal,
  editingSessionId,
  editingSessionSecs,
  editingSessionMmSs,
  sessionsViewTaskId,
  expandedSubtaskTaskIds,
  boardSubExpandedTaskIds,
  boardCardNoteEditId,
  addingSubtaskForTaskId,
  expandedNoteTaskId,
  subtaskQuickLogId,
  subtaskQuickLogInput,
  timeSummaryTab,
  showQuickLog,
  quickLogTaskId,
  quickLogSecs,
  quickLogInput,
  quickLogNote,
  quickLogStartedAt,
  editingAudioLabelId,
  journalDateFilter,
  journalNewType,
  showWidgetDrawer,
  showWarnings,
  crisisMode,
  idlePromptShown,
  idlePromptThresholdMins,
  idlePromptInput,
  idlePromptTaskId,
  timerSessionType,
  showTransitionPrompt,
  transitionReflect,
  toolsTab,
  plannerView,
  plannerSelectedDate,
  plannerMonth,
  plannerHighlightTaskId,
  plannerDumpInput,
  plannerZoom,
  plannerDayLayout,
  timelineNewTaskText,
  timelineNewTaskCatId
} from './uiState.js';

// RUNTIME STATE
export {
  timerRunning,
  timerMode,
  timerCountdownMins,
  timerSecs,
  timerPlannedSecs,
  timerInterval,
  activeSession,
  audioRecState,
  mediaRecorder,
  audioStream,
  recChunks,
  recStartedAt,
  recTickInterval,
  playingAudioId,
  currentAudioEl,
  dragSourceId,
  dragSubtaskSourceId,
  dragSourceWidgetId,
  lastInteractionAt,
  metroBpm,
  metroRunning,
  metroInterval,
  metroBeat,
  metroBeats,
  metroSubdivision,
  metroFlash,
  metroAudioCtx,
  metroNextTime,
  tunerStream,
  tunerAnalyser,
  tunerAudioCtx,
  tunerActive,
  tunerNote,
  tunerCents,
  tunerFreq,
  tunerRafId,
  kbOctave,
  kbVolume,
  kbWaveform,
  kbActiveNotes,
  kbAudioCtx,
  kbOscillators,
  timelineDragState,
  timelineNewTaskDraft,
  energyPending
} from './runtimeState.js';
