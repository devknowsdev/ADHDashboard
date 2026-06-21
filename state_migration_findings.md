# State migration — audit + categorization proposal

**Status: proposal only.** Nothing in this document has been applied to
`state.js`, and no variable references in the 28 loaded files have been
touched. The only changes made directly to the repo are dead-code/bug fixes,
listed in section 2 — not part of the actual migration.

---

## 1. The brief didn't match the repo

Before doing anything, I read the actual files instead of trusting the task
description. Four things were wrong or missing from the brief:

1. **`state/data.js`, `state/uiState.js`, `state/runtimeState.js` were not
   empty.** They already contained partial `export let` declarations — a
   subset of `state.js`'s variables, already split into the three domains
   described as a future goal.
2. **A fourth file existed that the brief never mentioned: `state/index.js`.**
   It re-exported `modalState`, `selectedView`, `energyPending`, and
   `aiPendingParse` — none of which are declared in `uiState.js` or
   `runtimeState.js`. Importing it would have thrown immediately.
3. **None of `src/state/` is wired up.** `index.html` loads 28 classic
   `<script>` tags in order, starting with `constants.js` → `state.js`. There
   is no `type="module"` anywhere and zero `import`/`export` statements in any
   loaded file. `src/state/` was fully disconnected dead code.
4. **`src/core/core.js` and `src/render/render.js`** existed as byte-identical
   duplicates of the loaded `src/core.js` / `src/render.js`, referenced
   nowhere. Unrelated to the state migration but found during the audit.

`ARCHITECTURE.md` (the project's own architecture doc) still describes
`state.js` as the single canonical state file and has no knowledge of the
`state/` split — so whatever produced that directory did so without updating
the doc that's supposed to track this.

## 2. Changes already applied (low-risk, no judgment calls)

- **Deleted `src/core/` and `src/render/`** — confirmed via grep across the
  whole repo (including docs and `test_workflows.js`) that nothing references
  `core/core.js` or `render/render.js`. Safe removal of exact duplicates.
- **Fixed `state/index.js`'s broken re-exports** — removed `modalState`,
  `selectedView`, `energyPending`, `aiPendingParse` (don't exist in their
  source files), left a comment explaining the file's disconnected status and
  pointing here.
- **Fixed a type mismatch** — `state/data.js` had `dailyIntentions = []`
  (array) but the real `state.js` has it as a single object:
  `{date:'', answers:{...}, step:0, winOutcome:null}`. Updated to match.
- **Added a "NOT CURRENTLY LOADED" header** to all four files in `src/state/`
  so anyone opening them in an editor doesn't mistake them for live code.

None of this changes app behavior — `index.html`'s script list and load order
are untouched, verified by re-checking every `src=` path still resolves.

## 3. Categorization: all 137 `state.js` variables

Grounded in what `storage.js` actually persists to `localStorage`, not in
guessing from variable names. Anything `storage.js` reads/writes is
unambiguously **data**. Everything else splits by whether it's a UI
affordance (open/closed, filter, selection, in-progress form field) vs. live
runtime machinery (intervals, audio nodes, drag state, scheduler state).

Two pairs looked ambiguous on a first pass; both were resolved by tracing
every real call site (not just the declaration) — see "Resolved ambiguities"
below for the evidence. The lists here already reflect those resolutions.

### DATA (persisted via storage.js)
```
categories, tasks, alarms, habits, templates, offTaskLog, timeSessions,
journalEntries, energyLog, dailyIntentions, focusBoardManualIds,
plannerDayDumps, audioRecordings, widgetLayout, focusTaskId, focusSubtaskId
```

### UI STATE (modal/panel open-closed, filters, selections, in-progress form input)
```
darkMode, T, dayStartHour, taskFilter, newCatColorIdx, editingCatId,
showCatModal, taskSortMode, editingTimeId, editingEstimateId,
editingSubtaskEstimateId, editingTaskCatId, editingMusicField,
expandedLyricsId, editingOffTaskId, editingHabitHitId, urgencyPickerTaskId,
taskOverflowOpenId, clockColWidth, expandedHabitId, hitInputHabitId,
hitInputMins, hitInputTime, focusBoardMode, focusBoardPickerOpen,
focusBoardPickerSearch, focusWindowMode, timerLayout, energyFilterOn,
showTimeTargets, showBreakBar, showFocusModal, focusSearch,
showSessionsModal, editingSessionId, editingSessionSecs, editingSessionMmSs,
sessionsViewTaskId, expandedSubtaskTaskIds, boardSubExpandedTaskIds,
boardCardNoteEditId, addingSubtaskForTaskId, expandedNoteTaskId,
subtaskQuickLogId, subtaskQuickLogInput, timeSummaryTab, showQuickLog,
quickLogTaskId, quickLogSecs, quickLogInput, quickLogNote,
quickLogStartedAt, editingAudioLabelId, journalDateFilter, journalNewType,
showWidgetDrawer, showWarnings, crisisMode, idlePromptShown,
idlePromptThresholdMins, idlePromptInput, idlePromptTaskId,
timerSessionType, showTransitionPrompt, transitionReflect, toolsTab,
plannerView, plannerSelectedDate, plannerMonth, plannerHighlightTaskId,
plannerDumpInput, plannerZoom, plannerDayLayout, timelineNewTaskText,
timelineNewTaskCatId
```

### RUNTIME STATE (timers, live audio/recording, drag, intervals, scheduler state)
```
timerRunning, timerMode, timerCountdownMins, timerSecs, timerPlannedSecs,
timerInterval, activeSession, audioRecState, mediaRecorder, audioStream,
recChunks, recStartedAt, recTickInterval, playingAudioId, currentAudioEl,
dragSourceId, dragSubtaskSourceId, dragSourceWidgetId, lastInteractionAt,
metroBpm, metroRunning, metroInterval, metroBeat, metroBeats,
metroSubdivision, metroFlash, metroAudioCtx, metroNextTime, tunerStream,
tunerAnalyser, tunerAudioCtx, tunerActive, tunerNote, tunerCents, tunerFreq,
tunerRafId, kbOctave, kbVolume, kbWaveform, kbActiveNotes, kbAudioCtx,
kbOscillators, timelineDragState, timelineNewTaskDraft, energyPending
```

### Drop — dead code, not migrated to any domain
```
energyToday
```
Declared once in `state.js:114` (`let energyToday=null;`) and never read or
written anywhere else in the app — not in `core.js`, not in
`render_checkin.js`, not in `storage.js`, not in `test_workflows.js`.
Carrying a dead variable into the new architecture just relocates the cruft.
Recommend leaving it out of all three domain files; flag for removal from
`state.js` separately, on its own, since that's a behavior-irrelevant cleanup
not a migration step.

**Coverage check:** all 137 declared variables in `state.js` are accounted
for across DATA (16) + UI STATE (75) + RUNTIME STATE (45) + Drop (1) = 137.
No variable appears in more than one bucket.

## 4. Resolved ambiguities (evidence, not guesses)

**`focusTaskId` / `focusSubtaskId` → DATA, kept together.**
`storage.js:17-18` and `storage.js:102` persist these as a single unit under
one localStorage key (`adhd4_focus`), saved/loaded together as
`{id, subtaskId}`. Every real call site that touches one also touches the
other in the same statement — `actions_tasks.js`, `actions_tasktimer.js`,
`helpers.js` (`ensureFocusValid`), `runtime.js` (keyboard nav), and the
render files all treat them as one concept: "what's currently focused."
Splitting them across two domains, as I did before checking, would have been
wrong — they're one concept with two fields and should migrate together.

**`energyToday` vs `energyPending` → `energyToday` is dead code, drop it;
`energyPending` → RUNTIME STATE.**
`energyToday` appears exactly once in the whole codebase: its own
declaration. `energyPending` is the real, actively-used object — the live
in-progress check-in form (`core.js:88-102`'s `setEnergyPending` /
`saveEnergyCheckin`, `render_checkin.js:104,119`'s capture UI) that only gets
pushed into `energyLog` on save, then reset. These were never duplicate
concepts; `energyToday` was simply never wired up to anything.

## 5. Phase 1 — completed

Applied the categorization from section 3, mechanically, with no new
judgment calls (both ambiguities were already resolved in section 4):

- **`src/state/data.js`, `uiState.js`, `runtimeState.js`** now each contain
  the complete, correct set of `export let` declarations for their domain —
  16 / 75 / 45 variables respectively, copied with their original
  initializers and inline comments from `state.js`. `energyToday` is
  excluded everywhere (dead code, see section 3/4).
- **`src/state/index.js`** rewritten to re-export the full set from all
  three files (previously only re-exported a handful and had broken names).
- **`src/state.js` (the live, loaded file) is functionally untouched.** Every
  declaration line got a trailing `// MIGRATED TO state/X.js (pending
  removal)` comment appended — nothing else changed. Verified by diffing
  every line against the original upload: stripping the appended comment
  reproduces the original line exactly, for all 167 lines of the file.
- **Verified by actually importing each file as a real ES module** (Node
  `import()`, not just reading the code):
  - `data.js` — imports cleanly, 16 exports resolve.
  - `runtimeState.js` — imports cleanly, 45 exports resolve.
  - `uiState.js` — **throws `ReferenceError: LIGHT is not defined`.** This
    isn't a theoretical risk, it's reproducible right now: `T = LIGHT`
    depends on `LIGHT`, a `const` declared in `constants.js` and only
    available via classic-script global scope (`constants.js` loads before
    `state.js` in `index.html`'s script order). An ES module has no access
    to that global.
  - `index.js` — **also throws the same error**, because it re-exports from
    `uiState.js`. This means the entire `state/` module tree is currently
    non-importable as a whole, not just `uiState.js` in isolation — worth
    knowing before anyone tries to wire this up and gets a confusing failure
    three files away from the actual cause.
  - Not fixed here: doing so means either exporting `LIGHT`/`DARK` from a
    module version of `constants.js` (which doesn't exist, and `constants.js`
    is itself a live classic-script file every other loaded script depends
    on — touching it is a bigger decision than this pass covers) or some
    other bridging mechanism. Flagging precisely so it's not a surprise
    later, not silently working around it.

**Verification:** ran the project's own test suite, `src/test_workflows.js`
(285 tests covering tasks, focus state, timers, planner, journal, energy
check-in, and more) directly against the post-edit `state.js`.

```
RESULTS: 285 passed, 0 failed out of 285 total
```

This is strong evidence the comment-only edit to `state.js` changed no
behavior — the suite exercises `focusTaskId`/`focusSubtaskId`,
`dailyIntentions`, `energyPending`, timer/planner state, and more, and
nothing regressed.

**Side note, not acted on:** `src/\.js` (a literally-named file —
`src/\.js`, not a typo here) is a near-duplicate of `test_workflows.js`
itself (60 lines of diff out of ~2,300, looks like an older/partial copy)
and isn't referenced by `index.html` or anything else. Outside the scope of
this migration; flagging rather than deleting since you didn't ask for a
general repo cleanup pass.

## 6. State of the repo now

- `index.html` and the 28 loaded scripts: unchanged in behavior, verified by
  test suite.
- `src/state/`: fully populated with the Phase 1 split, internally
  consistent, still disconnected from the running app (by design — no
  `type="module"` exists yet, and wiring it up is a separate decision with
  its own risk, not something to do silently as part of this pass).
- `state_migration_findings.md` (this file): the full record — audit,
  categorization, resolved ambiguities, and now Phase 1 completion.

**Not done, deliberately:** Phase 2 (shim `state.js` to delegate to the new
files) and Phase 3 (rewire the 28 loaded files to import from `state/`
instead of relying on globals) are real architectural changes — they'd
require either introducing `type="module"` (changes script loading
semantics/timing) or some other bridging mechanism, and that's a call for
you to make, not something to infer from "proceed as you think best."
