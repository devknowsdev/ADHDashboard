# ADHDashboard — Handoff: Day Wizard

**For the implementing Claude. Read HANDOFF_task_scope_and_dump.md first —
this feature builds on the taskScope and Dump changes described there.
Implement those before implementing this.**

**Target: all prior tests still passing + new WF30 block green.**

---

## What this is

A lightweight guided touchpoint at the start and end of each day. Not a
modal that demands attention — a gentle prompt that surfaces when relevant
and can be dismissed without guilt.

Three phases: **Day Start** → *(optional Midday)* → **Day End Debrief**.

The wizard is an *overlay*, not a widget. It renders above the normal
dashboard layout, triggered by conditions or explicit user action.

The wizard is not a replacement for the check-in widget, planner, or
task list. It is a guided shortcut *through* them — for users who want
a structured start/end rather than free-form navigation.

---

## Core UX principles

- Every step answerable in under 10 seconds, or skippable without penalty
- No step should feel like homework
- Capacity-aware: low energy → fewer prompts, smaller scope
- Pre-populated schedules are respected and surfaced, not overwritten
- The untracked day is handled with grace, not accusation

---

## State

Add to `state.js`:

```js
// Day wizard
let dayWizardState = {
  date: '',        // YYYY-MM-DD — which day this run is for
  phase: null,     // null | 'start' | 'end'
  step: 0,         // current step index within the phase
  startDone: false,
  endDone: false,
};
let dayWizardOpen = false;    // overlay visible
let wizCaptureInput = '';     // ephemeral rapid-capture text buffer (not persisted)
let wizCaptureList = [];      // ephemeral list of items captured this wizard session
```

Persist `dayWizardState` under key `adhd4_day_wizard`.

Add to `load()` in `storage.js`:

```js
try {
  const raw = JSON.parse(localStorage.getItem('adhd4_day_wizard') || 'null');
  const todayYmd2 = dateToYMD(new Date());
  if (raw && raw.date === todayYmd2) {
    dayWizardState = raw;
  } else {
    dayWizardState = { date: todayYmd2, phase: null, step: 0,
                       startDone: false, endDone: false };
  }
} catch(e) {
  dayWizardState = { date: dateToYMD(new Date()), phase: null, step: 0,
                     startDone: false, endDone: false };
}
```

Add to `_flushSave()` in `storage.js`:

```js
localStorage.setItem('adhd4_day_wizard', JSON.stringify(dayWizardState));
```

Add to `_handleDateRollover()` in `runtime.js` (in the rollover block):

```js
const newYmd = dateToYMD(new Date());
dayWizardState = { date: newYmd, phase: null, step: 0,
                   startDone: false, endDone: false };
dayWizardOpen = false;
```

---

## Day Start Wizard — steps

Triggered when: `dayWizardState.startDone === false` and user either
opens the app fresh (check in `init.js` after load) or clicks a
"Plan my day" button (add to the planner widget header, or as a
floating prompt — see Surfacing section below).

### Step 0 — Capacity check

Reuses the existing energy check-in UI and state. If energy was already
logged today (`getEnergyToday(todayYmd)` returns a value), show it and
offer to update, then auto-advance after 1.5 seconds or on tap.

If not yet logged, show the energy picker (same as check-in widget,
same `setEnergyPending` / `saveEnergyCheckin` calls).

Render function should read `getEnergyToday(todayYmd)` to know which
branch to show.

Store the logged energy level in a local variable for use in step 2
(capacity-aware prompting). No new state needed — read from `energyLog`.

### Step 1 — What's already on the calendar

Read `tasks.filter(t => t.ts && t.status !== 'done')` and
`plannerDayDumps[todayYmd] || []`.

**If nothing scheduled:**
Show: *"Nothing on the calendar yet — let's capture what needs to
happen today."* Auto-advance to step 2.

**If things are scheduled:**
Show a compact read-only list: time + task name, sorted by `ts`.
Show: *"You've already got N things planned."*
Two buttons: **"Add more"** (→ step 2) and **"Looks good, skip to commit"**
(→ step 3, skipping capture).

Calculate and show free blocks between scheduled items if there are
gaps ≥ 30 minutes. This is purely informational here — used as hints
in step 2.

Free block calculation:
```js
function _wizFreeBlocks(todayYmd) {
  const scheduled = tasks
    .filter(t => t.ts && t.status !== 'done')
    .map(t => {
      const [h, m] = t.ts.split(':').map(Number);
      const start = h * 60 + m;
      const end = start + (t.durationMins || 30);
      return { start, end, text: t.text };
    })
    .sort((a, b) => a.start - b.start);
  const blocks = [];
  let cursor = 8 * 60; // start looking from 8am
  scheduled.forEach(s => {
    if (s.start - cursor >= 30) {
      blocks.push({ start: cursor, end: s.start,
                    mins: s.start - cursor });
    }
    cursor = Math.max(cursor, s.end);
  });
  // Gap after last task until 18:00
  if (18 * 60 - cursor >= 30) {
    blocks.push({ start: cursor, end: 18 * 60,
                  mins: 18 * 60 - cursor });
  }
  return blocks;
}
```

### Step 2 — Rapid capture

*"What needs to happen today?"*

Capacity-aware prompt text:
- Energy 1-2: *"What's the ONE thing that has to happen today?"*
- Energy 3: *"What are the two or three things that matter most today?"*
- Energy 4-5: *"What needs to happen today? Dump it all."*

UI: a text input + Enter to add, building a list below.
Each item added goes into `wizCaptureList` (ephemeral) AND into
`plannerDayDumps[todayYmd]` immediately (so they persist if wizard
is dismissed mid-step).

Also show unscheduled tasks from the main list as suggestions:
```js
const suggestions = tasks
  .filter(t => !t.ts && t.status !== 'done')
  .slice(0, 5);
```
Each suggestion has a "+" button to add it to today's captures.
Clicking "+" calls `plannerOpenTimeline` preparation — actually just
notes the task id so step 3 can offer to schedule it.

"Done capturing" button advances to step 3.
"Skip" advances to step 3 with nothing captured.

### Step 3 — Schedule (optional)

*"Want to put times on these?"*

Shows today's unscheduled captures + any tasks added in step 2 as chips.

For each chip, offer quick-slot buttons:
- **Morning** → 09:00
- **Midday** → 12:00
- **Afternoon** → 14:00
- **Evening** → 16:00
- **[time]** → inline HH:MM input

Selecting a slot calls:
```js
tasks.find(t => t.id === taskId).ts = selectedTime;
// or for dump items, convert to task first via plannerPromoteDump
save();
```

If free blocks were found in step 1, surface them as suggestions:
*"You have a free 90 mins at 14:00 — good slot for deep work?"*

This step is explicitly skippable. Button: "I'll figure it out as I go →"

### Step 4 — Commit

*"You're set."*

Show their `dailyIntentions.answers.oneWin` if already set.
If not set, show a single text input: *"What's the one thing that
would make today a success?"* — saves to `dailyIntentions.answers.oneWin`.

A summary: energy level badge, N tasks scheduled, today's priority.

Button: **"Start my day →"**

On click:
```js
dayWizardState.startDone = true;
dayWizardState.phase = null;
dayWizardOpen = false;
save(); render();
```

---

## Day End Debrief — steps

Triggered when: `dayWizardState.endDone === false` AND current hour ≥
`dayEndHour` (configurable, default 17). Show a soft banner prompt
(not a blocking modal). User can dismiss the banner; it reappears once
per hour until debrief is done or day rolls over.

Add `dayEndHour` to settings (default 17). Store in `localStorage`
under `adhd4_day_end_hour`. Read in `load()`, save in `_flushSave()`.

### Untracked day detection

Run this check at the start of the debrief:

```js
function _wizUntrackedDay(todayYmd) {
  const todayScheduled = tasks.filter(t => {
    if (!t.ts || t.status === 'done') return false;
    // Only tasks whose scheduled end time has passed
    const [h, m] = t.ts.split(':').map(Number);
    const endMins = h * 60 + m + (t.durationMins || 30);
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    return endMins < nowMins;
  });
  if (!todayScheduled.length) return false;
  const tracked = timeSessions.filter(s => {
    return todayScheduled.some(t => t.id === s.taskId) &&
           new Date(s.startedAt).toDateString() === new Date().toDateString();
  });
  return tracked.length === 0 && todayScheduled.length >= 2;
}
```

### Step 0 — Untracked day (conditional)

Only shown when `_wizUntrackedDay()` returns true.

*"You had N things scheduled today but nothing was tracked. How did it go?"*

Show the scheduled tasks in a list. Three options:

**"Mostly to plan"** →
For each scheduled task with `ts` + `durationMins`:
- Create a time session: `startedAt = today at ts time`,
  `seconds = durationMins * 60`, `mode = 'manual'`, `type = 'work'`
- Mark task as done, set `doneDate = todayYmd`
Call `save()`. Advance to step 1.

```js
function wizBulkLogScheduled(todayYmd) {
  const now = new Date();
  tasks
    .filter(t => t.ts && t.status !== 'done')
    .forEach(t => {
      const [h, m] = t.ts.split(':').map(Number);
      const startedAt = new Date(now);
      startedAt.setHours(h, m, 0, 0);
      const seconds = (t.durationMins || 30) * 60;
      timeSessions.push({
        id: Date.now() + Math.random(),
        taskId: t.id,
        subtaskId: null,
        startedAt: startedAt.getTime(),
        endedAt: startedAt.getTime() + seconds * 1000,
        seconds,
        mode: 'manual',
        type: 'work',
      });
      t.status = 'done';
      t.done = true;
      t.doneDate = todayYmd;
    });
  save();
}
```

**"It went differently"** →
Step through each scheduled task one at a time:
- Task name shown
- Buttons: **Done ✓** / **Didn't happen ✗** / **Log time manually**
- "Done" marks done + logs session from scheduled time
- "Didn't happen" leaves as-is (will surface in carry-over step)
- "Log time manually" opens a quick-log input (reuse `parseTimeInput`)
After all tasks reviewed, advance to step 1.

**"I'll log it myself"** → skips to step 1 with no changes.

### Step 1 — How did it go?

*"One word or phrase — how was today?"*

Short text input. On submit (or skip):
- If text entered: creates a `reflect`-type journal entry with the text
- Advance to step 2

### Step 2 — Did your priority happen?

Only shown if `dailyIntentions.answers.oneWin` is set and
`dailyIntentions.winOutcome` is null.

Shows the `oneWin` text.
Buttons: **Done ✓** / **Partial ~** / **Didn't happen ✗**
Calls `setWinOutcome(outcome)` on selection.

If `winOutcome` is already set, show it briefly and auto-advance.

### Step 3 — Carry-over

*"What's carrying forward to tomorrow?"*

Show incomplete tasks (status !== 'done'):

For each:
- **Keep** (default — no action, task stays as-is)
- **Drop** → `deleteTask(id)`
- **Done** → `toggleTask` to done

Show max 6 tasks. If more, a "show all" toggle.

This step is skippable: "All good →"

### Step 4 — Last capture

*"Anything to get out of your head before you close?"*

Same rapid-capture UI as Day Start step 2.
Items go to `plannerDayDumps[todayYmd]` as normal.

Skippable.

### Step 5 — Close

*"Good work today."*

Show a brief summary:
- Time tracked (sum of today's timeSessions seconds, formatted)
- Tasks completed today
- Energy level badge

Button: **"Close"**

```js
dayWizardState.endDone = true;
dayWizardState.phase = null;
dayWizardOpen = false;
save(); render();
```

---

## Surfacing (when/how the wizard appears)

### Day Start prompt

In `init.js`, after `load()` and `render()`, add:

```js
// Show day start prompt if not done
const todayYmd = dateToYMD(new Date());
if (!dayWizardState.startDone && dayWizardState.date === todayYmd) {
  // Don't auto-open — show a soft banner instead
  // The banner is rendered in _doRender() as part of the top of the page
}
```

The banner renders as a dismissable strip at the very top of the page
(above the widget grid), not as a blocking modal:

```html
<div style="background:${T.accent}11;border-bottom:1px solid ${T.accent}33;
            padding:8px 16px;display:flex;align-items:center;gap:10px;">
  <i class="ti ti-sun" style="color:${T.accent};"></i>
  <span style="font-size:13px;color:${T.text};flex:1;">
    Ready to plan your day?
  </span>
  <button onclick="openDayWizard('start')"
    style="${btnStyle('accent','font-size:12px;padding:4px 12px;')}">
    Plan my day
  </button>
  <button onclick="dismissWizardBanner()"
    style="${btnStyle('default','font-size:11px;padding:4px 8px;')}">
    Later
  </button>
</div>
```

The banner is hidden after: user clicks "Plan my day", user dismisses
it (stores `wizBannerDismissedAt` timestamp, re-shows after 2 hours),
or `startDone` becomes true.

### Day End prompt

A separate banner shown after `dayEndHour`:

```html
<div style="background:${T.accent2}11;border-bottom:1px solid ${T.accent2}33; ...">
  <i class="ti ti-moon"></i>
  <span>Time to wrap up?</span>
  <button onclick="openDayWizard('end')">End my day</button>
  <button onclick="dismissWizardBanner()">Later</button>
</div>
```

Both banners render in `_doRender()` (render.js) at the top of the
page, before the widget grid. Add a helper:

```js
function _renderWizardBanner(todayYmd, now) {
  if (dayWizardOpen) return ''; // wizard is open, no banner
  const hour = now.getHours();
  // Start banner
  if (!dayWizardState.startDone) {
    if (/* not dismissed recently */) {
      return `<!-- start banner html -->`;
    }
  }
  // End banner
  if (!dayWizardState.endDone && hour >= dayEndHour) {
    if (/* not dismissed recently */) {
      return `<!-- end banner html -->`;
    }
  }
  return '';
}
```

Banner dismiss state: add `wizBannerDismissedAt: 0` to `dayWizardState`.
Re-show after 2 hours. This is ephemeral enough to not need its own key.

### Overlay rendering

When `dayWizardOpen` is true, render the wizard as a full-screen overlay
in `_doRender()`:

```js
// In _doRender(), after building the page HTML:
if (dayWizardOpen) {
  html += renderDayWizard(todayYmd, now);
}
```

The wizard overlay sits above everything with `position:fixed;inset:0;
z-index:2000`. It does NOT use the modal pattern from `render_modals.js`
— it's a full-page stepped experience, not a dialog.

---

## New files

### `render_wizard.js`

Contains `renderDayWizard(todayYmd, now)` — the main overlay renderer.
Switches on `dayWizardState.phase` and `dayWizardState.step` to render
the correct step UI.

Internal helpers:
- `_renderWizStep_CapacityCheck(todayYmd, now)`
- `_renderWizStep_CalendarReview(todayYmd)`
- `_renderWizStep_RapidCapture(todayYmd)`
- `_renderWizStep_Schedule(todayYmd)`
- `_renderWizStep_Commit(todayYmd)`
- `_renderWizStep_UntrackedDay(todayYmd)`
- `_renderWizStep_HowDidItGo(todayYmd)`
- `_renderWizStep_Priority(todayYmd)`
- `_renderWizStep_CarryOver(todayYmd)`
- `_renderWizStep_LastCapture(todayYmd)`
- `_renderWizStep_Close(todayYmd)`
- `_renderWizardBanner(todayYmd, now)` (used by render.js)
- `_wizFreeBlocks(todayYmd)` (calculation helper)

Does NOT call `registerWidget()` — the wizard is not a widget.

### `actions_wizard.js`

Contains all state mutations for the wizard:

```js
function openDayWizard(phase)         // sets phase, step=0, dayWizardOpen=true
function closeDayWizard()             // dayWizardOpen=false, save
function wizAdvanceStep()             // step++, save, render
function wizBackStep()                // step--, save, render
function wizCompleteStart()           // startDone=true, close
function wizCompleteEnd()             // endDone=true, close
function dismissWizardBanner()        // sets wizBannerDismissedAt
function wizAddCapture(todayYmd)      // adds wizCaptureInput to dumps + wizCaptureList
function wizScheduleCapture(...)      // assigns ts to a task/dump item
function wizBulkLogScheduled(...)     // bulk session creation (see above)
function wizMarkCarryOver(taskId, action)  // keep/drop/done
function _wizUntrackedDay(todayYmd)   // detection (can be here or render_wizard.js)
function _wizFreeBlocks(todayYmd)     // free block calculation
```

---

## Load order additions (index.html)

Add two `<script>` tags in load order, after `actions_planner.js`
and before `runtime.js`:

```html
<script src="src/actions_wizard.js"></script>
<script src="src/render_wizard.js"></script>
```

Also add `_renderWizardBanner(todayYmd, now)` call in `render.js`
`_doRender()` — find where the page HTML is assembled and prepend
the banner output.

---

## Settings additions

Add `dayEndHour` (default 17) to the settings modal (Behaviour tab
or a new Day tab). Store as `adhd4_day_end_hour`. Integer, range 14–22.

---

## Integration points with existing systems

| Wizard action | Calls into |
|---------------|-----------|
| Energy step | `setEnergyPending`, `saveEnergyCheckin` (core.js) |
| Rapid capture | `plannerAddDump` / direct push to `plannerDayDumps` (actions_planner.js) |
| Schedule | `tasks[id].ts = ...`, `save()` |
| Bulk log | Push to `timeSessions`, mutate `tasks` status/doneDate |
| Priority commit | `setIntentionAnswer('oneWin', text)`, `advanceIntention` or direct set |
| Win outcome | `setWinOutcome(outcome)` (core.js) |
| Carry-over done | `toggleTask(id)` (actions_tasks.js) |
| Carry-over drop | `deleteTask(id)` (actions_tasks.js) |
| Last capture | `plannerAddDump` |

The wizard never directly manipulates `journalEntries`, `habits`, or
`timeSessions` except for the bulk-log case. All mutations go through
existing action functions where they exist.

---

## test_workflows.js additions

Add **WF30: Day Wizard** block. Because the wizard is mostly UI + state
orchestration, focus tests on the pure logic functions:

```js
console.log('\n═══ WF30: Day Wizard ═══');
resetState();
run(`
  // Setup: a scheduled task for today
  tasks.push({id:30001,text:'Standup',catId:'work',done:false,status:'todo',
    ts:'09:00',durationMins:30,order:0,createdAt:Date.now(),
    repeat:null,templateId:null,generatedForDate:null,
    pinned:false,urgency:0,subtasks:[],estimatedMins:null,
    note:'',anxiety:0,taskScope:'day',doneDate:'',durationMins:30});
  tasks.push({id:30002,text:'Deep work',catId:'work',done:false,status:'todo',
    ts:'10:00',durationMins:90,order:1,createdAt:Date.now(),
    repeat:null,templateId:null,generatedForDate:null,
    pinned:false,urgency:0,subtasks:[],estimatedMins:null,
    note:'',anxiety:0,taskScope:'day',doneDate:'',durationMins:90});
`);

test('openDayWizard sets phase, step, open flag', () => {
  run("openDayWizard('start')");
  eq(get('dayWizardOpen'), true);
  eq(get('dayWizardState.phase'), 'start');
  eq(get('dayWizardState.step'), 0);
});

test('closeDayWizard clears open flag', () => {
  run('closeDayWizard()');
  eq(get('dayWizardOpen'), false);
});

test('wizAdvanceStep increments step', () => {
  run("openDayWizard('start'); wizAdvanceStep()");
  eq(get('dayWizardState.step'), 1);
});

test('wizBackStep decrements step, not below 0', () => {
  run('dayWizardState.step=1; wizBackStep()');
  eq(get('dayWizardState.step'), 0);
  run('wizBackStep()');
  eq(get('dayWizardState.step'), 0, 'clamped at 0');
});

test('wizCompleteStart sets startDone and closes', () => {
  run('wizCompleteStart()');
  eq(get('dayWizardState.startDone'), true);
  eq(get('dayWizardOpen'), false);
});

test('wizCompleteEnd sets endDone and closes', () => {
  run('wizCompleteEnd()');
  eq(get('dayWizardState.endDone'), true);
  eq(get('dayWizardOpen'), false);
});

test('wizAddCapture adds to plannerDayDumps and clears input', () => {
  const ymd = run('dateToYMD(new Date())');
  run(`plannerDayDumps={}; wizCaptureInput='Write tests'; wizAddCapture('${ymd}')`);
  const arr = get(`plannerDayDumps['${ymd}']`);
  assert(Array.isArray(arr) && arr.length === 1, 'item added to dumps');
  eq(arr[0].text, 'Write tests');
  eq(get('wizCaptureInput'), '', 'input cleared');
});

test('wizAddCapture empty input is no-op', () => {
  const ymd = run('dateToYMD(new Date())');
  run(`plannerDayDumps={}; wizCaptureInput='   '; wizAddCapture('${ymd}')`);
  eq(get(`(plannerDayDumps['${ymd}']||[]).length`), 0);
});

test('_wizFreeBlocks finds gap between scheduled tasks', () => {
  const ymd = run('dateToYMD(new Date())');
  const blocks = run(`_wizFreeBlocks('${ymd}')`);
  assert(Array.isArray(blocks), 'returns array');
  // 09:00-09:30 standup, 10:00-11:30 deep work → gap 09:30-10:00 = 30 mins (exactly threshold)
  // Before 09:00 → 8:00-9:00 = 60 mins gap
  assert(blocks.length >= 1, 'at least one free block found');
  assert(blocks.every(b => b.mins >= 30), 'all blocks at least 30 mins');
});

test('_wizUntrackedDay returns false when no scheduled tasks', () => {
  run(`tasks=[]; timeSessions=[]`);
  const ymd = run('dateToYMD(new Date())');
  eq(run(`_wizUntrackedDay('${ymd}')`), false);
});

test('_wizUntrackedDay returns false when sessions exist', () => {
  const ymd = run('dateToYMD(new Date())');
  run(`
    tasks=[{id:30010,text:'T',catId:'',done:false,status:'todo',
      ts:'08:00',durationMins:60,order:0,createdAt:Date.now(),
      repeat:null,templateId:null,generatedForDate:null,
      pinned:false,urgency:0,subtasks:[],estimatedMins:null,
      note:'',anxiety:0,taskScope:'day',doneDate:''}];
    timeSessions=[{id:1,taskId:30010,subtaskId:null,
      startedAt:Date.now()-3600000,endedAt:Date.now(),
      seconds:3600,mode:'stopwatch',type:'work'}];
  `);
  eq(run(`_wizUntrackedDay('${ymd}')`), false, 'session exists → not untracked');
});

test('wizBulkLogScheduled creates sessions and marks tasks done', () => {
  const ymd = run('dateToYMD(new Date())');
  run(`
    tasks=[
      {id:30020,text:'A',catId:'',done:false,status:'todo',
        ts:'08:00',durationMins:30,order:0,createdAt:Date.now(),
        repeat:null,templateId:null,generatedForDate:null,
        pinned:false,urgency:0,subtasks:[],estimatedMins:null,
        note:'',anxiety:0,taskScope:'day',doneDate:''},
      {id:30021,text:'B',catId:'',done:false,status:'todo',
        ts:'09:00',durationMins:60,order:1,createdAt:Date.now(),
        repeat:null,templateId:null,generatedForDate:null,
        pinned:false,urgency:0,subtasks:[],estimatedMins:null,
        note:'',anxiety:0,taskScope:'day',doneDate:''}
    ];
    timeSessions=[];
    wizBulkLogScheduled('${ymd}');
  `);
  eq(get('timeSessions.length'), 2, 'two sessions created');
  eq(get('timeSessions[0].seconds'), 1800, '30min task = 1800s');
  eq(get('timeSessions[1].seconds'), 3600, '60min task = 3600s');
  eq(get('tasks.find(t=>t.id===30020).status'), 'done');
  eq(get('tasks.find(t=>t.id===30020).doneDate'), '${ymd}');
  eq(get('tasks.find(t=>t.id===30021).status'), 'done');
  assert(
    get('timeSessions[0].mode') === 'manual',
    'session mode is manual'
  );
});

test('wizMarkCarryOver done marks task done', () => {
  const ymd = run('dateToYMD(new Date())');
  run(`tasks=[{id:30030,text:'C',catId:'',done:false,status:'todo',
    ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,
    generatedForDate:null,pinned:false,urgency:0,subtasks:[],
    estimatedMins:null,note:'',anxiety:0,taskScope:'day',doneDate:''}]`);
  run(`wizMarkCarryOver(30030,'done')`);
  eq(get('tasks.find(t=>t.id===30030).status'), 'done');
});

test('wizMarkCarryOver drop removes task', () => {
  run(`tasks=[{id:30031,text:'D',catId:'',done:false,status:'todo',
    ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,
    generatedForDate:null,pinned:false,urgency:0,subtasks:[],
    estimatedMins:null,note:'',anxiety:0,taskScope:'day',doneDate:''}]`);
  run(`wizMarkCarryOver(30031,'drop')`);
  eq(get('tasks.find(t=>t.id===30031)'), undefined, 'task removed');
});

test('wizMarkCarryOver keep is a no-op on task fields', () => {
  run(`tasks=[{id:30032,text:'E',catId:'',done:false,status:'todo',
    ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,
    generatedForDate:null,pinned:false,urgency:0,subtasks:[],
    estimatedMins:null,note:'',anxiety:0,taskScope:'day',doneDate:''}]`);
  run(`wizMarkCarryOver(30032,'keep')`);
  eq(get('tasks.find(t=>t.id===30032).status'), 'todo', 'status unchanged');
});

test('dismissWizardBanner sets dismiss timestamp', () => {
  const before = Date.now();
  run('dismissWizardBanner()');
  assert(get('dayWizardState.wizBannerDismissedAt') >= before,
    'timestamp set');
});

test('dayWizardState resets on date rollover', () => {
  run(`
    dayWizardState.startDone=true;
    dayWizardState.endDone=true;
    _lastDateStr='Mon Jan 01 2024';
  `);
  run(`_handleDateRollover('${run("dateToYMD(new Date())")}') `);
  eq(get('dayWizardState.startDone'), false, 'startDone reset');
  eq(get('dayWizardState.endDone'), false, 'endDone reset');
  eq(get('dayWizardOpen'), false);
});
```

---

## File change summary

| File | What changes |
|------|-------------|
| `state.js` | Add `dayWizardState`, `dayWizardOpen`, `wizCaptureInput`, `wizCaptureList` declarations; add `dayEndHour` |
| `storage.js` | `load()`: read `adhd4_day_wizard`, `adhd4_day_end_hour`; `_flushSave()`: write both |
| `runtime.js` | `_handleDateRollover()`: reset `dayWizardState`, set `dayWizardOpen=false` |
| `render.js` | `_doRender()`: prepend `_renderWizardBanner()` output; append `renderDayWizard()` when `dayWizardOpen` |
| `init.js` | After first `render()`: check if start wizard should be prompted |
| *(new)* `actions_wizard.js` | All wizard action functions |
| *(new)* `render_wizard.js` | `renderDayWizard()`, step renderers, banner renderer, calculation helpers |
| `test_workflows.js` | Add WF30 block; add `taskScope`, `doneDate`, `durationMins` to relevant WF30 fixtures |
| `ARCHITECTURE.md` | Update status/next-step; document wizard overlay pattern; document `dayWizardState` persistence |
| `index.html` | Two new `<script>` tags for `actions_wizard.js` and `render_wizard.js`, after `actions_planner.js` |

### Files that do NOT change
- `core.js`, `helpers.js`, `constants.js`, `widget_registry.js`
- All `render_*.js` files except `render.js`
- `actions_tasks.js`, `actions_planner.js`, `actions.js`, `actions_alarms_habits.js`
- `storage.js` `loadWidgetLayout` / `saveWidgetLayout` — untouched

---

## Implementation order

Implement Part 1 (task scoping) and Part 2 (dump widget) from
HANDOFF_task_scope_and_dump.md first. Then:

1. `state.js` — add wizard state declarations
2. `storage.js` — load/save wizard state
3. `actions_wizard.js` — all action functions (no render yet)
4. `runtime.js` — add rollover reset
5. Run tests: `node test_workflows.js` — WF30 logic tests should pass
6. `render_wizard.js` — overlay and banner renderers
7. `render.js` — wire in banner and overlay
8. `init.js` — startup check
9. `index.html` — script tags
10. Run full test suite: `node test_workflows.js`
11. Update `ARCHITECTURE.md`

---

## Carry-forward note for ARCHITECTURE.md

Add to the `## Current Status / Next Step` section after completing
the task scoping + dump changes:

```
**Next implementation:** Day Wizard
See HANDOFF_day_wizard.md for full spec.
New files: actions_wizard.js, render_wizard.js.
No new widgets — wizard is a fixed overlay rendered in _doRender().
New state: dayWizardState (persisted), dayWizardOpen (ephemeral).
Key integration: bulk-log untracked days, capacity-aware capture,
free-block scheduling hints.
```
