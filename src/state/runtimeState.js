/*
MODULE: runtimeState.js
LAYER: state
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: runtimeState.js responsibilities
USES: local modules
STATE_READS: state
STATE_WRITES: activeSession, audioRecState, audioStream, currentAudioEl, dragSourceId, dragSourceWidgetId, dragSubtaskSourceId, energyPending, kbActiveNotes, kbAudioCtx
PUBLIC_API: none
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// NOT CURRENTLY LOADED — see src/state/index.js header for context.
// state/runtimeState.js
//
// Phase 1 migration: declarations copied verbatim from state.js (still the
// live source of truth). See src/state/data.js header for migration rules.
//
// energyToday (declared in state.js, never read/written anywhere else in
// the app) is intentionally NOT included here — see
// state_migration_findings.md section 3/4 for the dead-code finding. Flag
// it for removal from state.js directly rather than migrating it.

export let timerRunning = false;
export let timerMode = 'countdown'; // 'countdown' | 'stopwatch'
export let timerCountdownMins = 25;
export let timerSecs = 25*60; // remaining for countdown, elapsed for stopwatch
export let timerPlannedSecs = 25*60; // countdown original duration
export let timerInterval = null;
export let activeSession = null; // {id, taskId, startedAt, mode}
export let audioRecState = 'idle'; // idle | recording
export let mediaRecorder = null;
export let audioStream = null;
export let recChunks = [];
export let recStartedAt = 0;
export let recTickInterval = null;
export let playingAudioId = null;
export let currentAudioEl = null;
export let dragSourceId = null;
export let dragSubtaskSourceId = null; // {taskId, subtaskId}
export let dragSourceWidgetId = null;
export let lastInteractionAt = Date.now(); // updated on any user action
export let metroBpm = 120;
export let metroRunning = false;
export let metroInterval = null;
export let metroBeat = 0; // current beat index (0-based within bar)
export let metroBeats = 4; // beats per bar
export let metroSubdivision = 1; // 1=quarter, 2=eighth, 4=sixteenth
export let metroFlash = false; // true for one render tick on each beat for visual flash
export let metroAudioCtx = null;
export let metroNextTime = 0; // Web Audio scheduler lookahead time
export let tunerStream = null;
export let tunerAnalyser = null;
export let tunerAudioCtx = null;
export let tunerActive = false;
export let tunerNote = '—';
export let tunerCents = 0;
export let tunerFreq = 0;
export let tunerRafId = null;
export let kbOctave = 4;
export let kbVolume = 0.5;
export let kbWaveform = 'sine';
export let kbActiveNotes = new Set(); // currently pressed note names
export let kbAudioCtx = null;
export let kbOscillators = new Map(); // noteName → {osc, gain}
export let timelineDragState = null; // {type,taskId?,startY,startMins,curMins,origTs?,origDur?,scroll?,altCopy?}
export let timelineNewTaskDraft = null; // {startMins,endMins} — shown while drag-to-create is in progress
export let energyPending = {energy:null,sensory:null,tag:''};
