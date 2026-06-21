# ADHDashboard — Handoff: Task Scoping + Dump Widget

**For the implementing Claude. Read this fully before touching any file.**
**Target: 285 tests passing after all changes.**

---

## Context

Two related changes, implemented together in one session:

1. **Task scoping** — tasks currently persist forever and done tasks never
   disappear. Repeat tasks generate "missed days" warnings for old
   occurrences. Fix: add a `taskScope` field that controls visibility
   lifetime.

2. **Journal → Dump** — the journal widget is misnamed and misframed.
   Rename it to "Dump", reframe as a capture-first inbox with a
   promote-to-task flow.

These touch overlapping concepts (what is a task vs a capture) so they
are designed and implemented together.

---

## Part 1: Task Scoping

### New fields on every task

```js
taskScope: 'day' | 'project' | 'fixed'   // default 'day' for new tasks
doneDate:  ''    | 'YYYY-MM-DD'           // set when toggled to done, cleared on un-done
```

### Scope semantics

| Scope | Behaviour |
|-------|-----------|
| `day` | Default for new tasks. Hides from task list the next day, whether done or not. Repeat-generated instances are always `day`. |
| `project` | Persists until manually deleted. Stays visible after done. Used for multi-step or ongoing work. |
| `fixed` | Has a `dueDate`. Stays visible until done or the due date passes (future feature — plumb the field now, no special UI needed yet). |

### Migration rule

In `migrateTasks()` (helpers.js), add to the per-task loop:

```js
if (t.taskScope === undefined) {
  // Preserve existing behavior for all current tasks
  t.taskScope = 'project';
}
if (t.doneDate === undefined) t.doneDate = '';
```

Repeat-generated instances already have `templateId` set. The
`ensureRepeatTasksForToday` function should additionally set
`taskScope: 'day'` on every generated instance.

### Visibility filter

In `getVisibleTasksSorted()` (helpers.js), add a pre-filter before
`sortTasksList`:

```js
function getVisibleTasksSorted() {
  const todayYmd = dateToYMD(new Date());
  const filtered = tasks.filter(t => {
    // Category filter (existing)
    if (taskFilter !== 'all' && t.catId !== taskFilter) return false;
    // Hide day-scope done tasks from previous days
    if (t.status === 'done' && t.taskScope === 'day'
        && t.doneDate && t.doneDate !== todayYmd) return false;
    // Hide day-scope not-done tasks created before today (stale captures)
    // Only if they have no scheduled time (ts) — scheduled tasks are intentional
    if (t.status !== 'done' && t.taskScope === 'day'
        && !t.ts && t.createdAt
        && dateToYMD(new Date(t.createdAt)) !== todayYmd) return false;
    return true;
  });
  return sortTasksList(filtered);
}
```

Note: `dateToYMD` is defined in `actions_planner.js` and is available
globally. Confirm it's loaded before `helpers.js` in `index.html` —
if not, inline a copy in helpers.js or reorder. Check load order in
ARCHITECTURE.md before assuming.

### toggleTask change (actions_tasks.js)

When a task is toggled to `done`, record today's date:

```js
// Inside toggleTask, in the branch that sets status='done':
t.doneDate = dateToYMD(new Date());

// In the branch that sets status='todo' or 'inprogress' (un-done):
t.doneDate = '';
```

Find the exact location by reading the current `toggleTask` function
before editing.

### ensureRepeatTasksForToday change (actions_tasks.js)

When pushing a generated repeat instance, add `taskScope: 'day'`:

```js
tasks.push({
  ...templateFields,
  taskScope: 'day',   // ADD THIS
  doneDate: '',       // ADD THIS
  // ... rest of existing fields
});
```

Find the exact push call by reading the function before editing.

### New task creation (actions_tasks.js — addTask)

New tasks default to `day` scope. In `addTask()`, add to the pushed
object:

```js
taskScope: 'day',
doneDate: '',
```

### UI: scope badge on task rows (render_tasks.js)

Show a small badge on `project` scope tasks so users know they persist.
Keep it subtle — only show on `project`, not on `day` (day is the
normal case and shouldn't add noise):

```js
// In the task row render, near the category dot:
${t.taskScope === 'project'
  ? `<span title="Project task — stays until deleted"
       style="font-size:9px;padding:1px 5px;border-radius:10px;
              border:1px solid ${T.border};color:${T.muted2};
              margin-left:3px;">proj</span>`
  : ''}
```

Also add a scope selector when creating a task (in the add-task form,
near the repeat selector). A simple toggle or select:

```html
<select id="task-scope" style="${selectStyle('font-size:11px;')}">
  <option value="day">Day task</option>
  <option value="project">Project</option>
</select>
```

Read this in `addTask()`:

```js
const scopeEl = document.getElementById('task-scope');
const taskScope = scopeEl ? (scopeEl.value || 'day') : 'day';
```

### test_workflows.js changes for Part 1

Every hardcoded task fixture in the test file must include the new
fields. Search for all objects matching the pattern:

```
{id:NNN,text:'...',catId:'...',done:...,status:'...',...,anxiety:0}
```

And add `taskScope:'project',doneDate:''` to each one. There are
roughly 40–50 such fixtures across WF1–WF27.

Add new tests in a new **WF28: Task Scoping** block:

```js
console.log('\n═══ WF28: Task Scoping ═══');
resetState();

test('new task defaults to day scope', () => {
  withEl({'task-in':{value:'Quick thing'},'task-cat':{value:''},'task-time-in':{value:''},
          'task-repeat':{value:'none'},'task-scope':{value:'day'}}, ()=>run('addTask()'));
  eq(get('tasks[tasks.length-1].taskScope'), 'day');
  eq(get('tasks[tasks.length-1].doneDate'), '');
});

test('toggleTask to done sets doneDate', () => {
  const id = get('tasks[tasks.length-1].id');
  run(`toggleTask(${id}); toggleTask(${id})`); // todo→inprogress→done
  eq(get(`tasks.find(t=>t.id===${id}).doneDate`), run('dateToYMD(new Date())'));
});

test('toggleTask un-done clears doneDate', () => {
  const id = get('tasks[tasks.length-1].id');
  run(`toggleTask(${id})`); // done→todo
  eq(get(`tasks.find(t=>t.id===${id}).doneDate`), '');
});

test('getVisibleTasksSorted hides day-scope done tasks from yesterday', () => {
  const yesterday = run("dateToYMD(new Date(Date.now()-86400000))");
  run(`tasks=[{id:28001,text:'Stale',catId:'',done:true,status:'done',
    taskScope:'day',doneDate:'${yesterday}',ts:'',order:0,
    createdAt:Date.now()-86400000,repeat:null,templateId:null,
    generatedForDate:null,pinned:false,urgency:0,subtasks:[],
    estimatedMins:null,note:'',anxiety:0,durationMins:null}];
    taskFilter='all'; taskSortMode='manual'`);
  eq(run('getVisibleTasksSorted().length'), 0, 'stale done day task hidden');
});

test('getVisibleTasksSorted shows project-scope done tasks', () => {
  run(`tasks=[{id:28002,text:'Ongoing',catId:'',done:true,status:'done',
    taskScope:'project',doneDate:'2020-01-01',ts:'',order:0,
    createdAt:Date.now(),repeat:null,templateId:null,
    generatedForDate:null,pinned:false,urgency:0,subtasks:[],
    estimatedMins:null,note:'',anxiety:0,durationMins:null}]`);
  eq(run('getVisibleTasksSorted().length'), 1, 'project done task stays visible');
});

test('migrateTasks sets taskScope=project on existing tasks', () => {
  run(`tasks=[{id:28003,text:'Old',catId:'',done:false,status:'todo',
    ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,
    generatedForDate:null,pinned:false,urgency:0,subtasks:[],
    estimatedMins:null,note:'',anxiety:0,durationMins:null}]; migrateTasks()`);
  eq(get('tasks.find(t=>t.id===28003).taskScope'), 'project');
  eq(get('tasks.find(t=>t.id===28003).doneDate'), '');
});

test('repeat-generated instance gets taskScope day', () => {
  run(`tasks=[{id:28004,text:'Daily',catId:'',done:false,status:'todo',
    ts:'',order:0,createdAt:Date.now(),repeat:'daily',templateId:null,
    generatedForDate:null,pinned:false,urgency:0,subtasks:[],
    estimatedMins:null,note:'',anxiety:0,durationMins:null,
    taskScope:'project',doneDate:''}]; ensureRepeatTasksForToday()`);
  const gen = run(`tasks.find(t=>t.templateId===28004)`);
  eq(gen.taskScope, 'day', 'generated instance is day scope');
});
```

---

## Part 2: Journal → Dump

### Concept

The journal widget is renamed **Dump** and reframed as a capture-first
inbox. The core UX insight: ADHD brains need to externalise thoughts
immediately with zero friction, categorise later. "Journal" implies
reflection; "Dump" implies relief.

**Nothing in the Dump is a commitment.** It's a staging area.
Items can be promoted to Tasks when you're ready to commit.

### Data model — no migration needed

The `journalEntries` array and `adhd4_journal` localStorage key stay
unchanged. Only the UI and item type labels change.

Current type values and their new display names:

| Stored `type` value | Old label | New label |
|---------------------|-----------|-----------|
| `dump` | Brain dump | Note |
| `reflect` | Reflection | Reflect |
| `voice` | Voice note | Voice |
| *(new)* `todo` | — | To-do |

The new `todo` type is the key addition: a dump item that the user
intends to eventually promote to a task. It renders with a promote
button and a checkbox-style indicator instead of a text block.

### Capture bar changes (render_journal.js)

Default `journalNewType` changes from `'dump'` to `'todo'` in `state.js`.

The capture bar type selector relabels options:
- **To-do** (was: Dump) — default
- **Note** (was: Dump, type='dump')
- **Reflect**
- **Voice** (existing, unchanged)

Placeholder text on the textarea:
- To-do: `"What do you need to do? (promote to task when ready)"`
- Note: `"Any thought, link, name — capture it now, sort it later"`
- Reflect: `"How's it going?"`

### Promote-to-task button (render_journal.js)

For entries where `type === 'todo'`, add a promote button alongside
the existing delete button:

```js
${e.type === 'todo'
  ? `<button onclick="promoteDumpToTask(${e.id})"
       title="Add to Tasks"
       style="${btnStyle('accent','font-size:10px;padding:2px 8px;')}">
       <i class="ti ti-list-check"></i> Task
     </button>`
  : ''}
```

### promoteDumpToTask action (actions.js or new section)

Add this function. It opens a small inline prompt (use `prompt()` for
now — keep it simple, avoid a new modal):

```js
function promoteDumpToTask(journalId) {
  const entry = journalEntries.find(e => e.id === journalId);
  if (!entry) return;
  const now = Date.now();
  // Scope choice: simple confirm for now
  // true = project, false/cancel = day
  const isProject = confirm(
    '"' + entry.text.slice(0, 60) + '"\n\nMake this a Project task? (stays until deleted)\nCancel = Day task (disappears tomorrow)'
  );
  tasks.push({
    id: now,
    text: entry.text,
    catId: entry.catId || '',
    done: false,
    status: 'todo',
    taskScope: isProject ? 'project' : 'day',
    doneDate: '',
    ts: '',
    durationMins: null,
    order: nextTaskOrder(),
    createdAt: now,
    repeat: null,
    templateId: null,
    generatedForDate: null,
    pinned: false,
    energyRequired: null,
    anxiety: 0,
    urgency: 0,
    subtasks: [],
    estimatedMins: null,
    note: '',
  });
  journalEntries = journalEntries.filter(e => e.id !== journalId);
  save();
  showToast('"' + entry.text.slice(0, 40) + '" added to Tasks', 'ok');
  render();
}
```

Note: `confirm()` is already mocked in the test harness (returns `true`).

### Widget label and icon

In `render_journal.js`, the `registerWidget` call at the bottom:

```js
registerWidget({
  id: 'journal',          // keep ID — changing breaks localStorage layout
  label: 'Dump',          // was: 'Journal'
  icon: 'ti-inbox',       // was: ti-notebook or similar
  ...
});
```

### Section header copy changes (render_journal.js)

Replace any heading text like "Journal", "Brain Dump", or "Capture":

```js
// Header label above capture bar:
`<div style="${labelStyle()}">
   <i class="ti ti-inbox"></i>dump — capture now, sort later
 </div>`

// Sub-label below the type selector:
`<div style="font-size:10px;color:${T.muted2};margin-bottom:6px;">
   Nothing here is a commitment. Promote to task when ready.
 </div>`
```

### Date filter label

The existing date filter (`today` / `yesterday` / `week`) stays. No
change needed.

### Planner day-dump promote button

The planner's existing promote button (`plannerPromoteDump`) already
creates a task. Update it to also set `taskScope: 'day'` and
`doneDate: ''` on the created task — it was likely missing these fields
before Part 1 added them. Find the `tasks.push(...)` call in
`plannerPromoteDump` (actions_planner.js) and add the new fields.

### test_workflows.js changes for Part 2

Add new tests in a **WF29: Dump Widget** block:

```js
console.log('\n═══ WF29: Dump Widget ═══');
resetState();

test('promoteDumpToTask creates task and removes journal entry', () => {
  run(`journalEntries=[{id:29001,type:'todo',text:'Buy oat milk',
    catId:'',createdAt:Date.now()}]`);
  const tasksBefore = get('tasks.length');
  run('promoteDumpToTask(29001)');
  eq(get('tasks.length'), tasksBefore + 1, 'task created');
  eq(get('tasks[tasks.length-1].text'), 'Buy oat milk');
  // confirm() mock returns true → project scope
  eq(get('tasks[tasks.length-1].taskScope'), 'project');
  eq(get('journalEntries.find(e=>e.id===29001)'), undefined, 'entry removed');
});

test('promoteDumpToTask on missing entry is no-op', () => {
  const before = get('tasks.length');
  run('promoteDumpToTask(99999)');
  eq(get('tasks.length'), before);
});

test('promoteDumpToTask sets all required task fields', () => {
  run(`journalEntries=[{id:29002,type:'todo',text:'Call dentist',
    catId:'health',createdAt:Date.now()}]`);
  run('promoteDumpToTask(29002)');
  const t = get('tasks[tasks.length-1]');
  eq(t.text, 'Call dentist');
  eq(t.catId, 'health');
  eq(t.status, 'todo');
  eq(t.done, false);
  eq(t.doneDate, '');
  assert(t.id != null, 'has id');
  assert(Array.isArray(t.subtasks), 'has subtasks array');
});

test('addJournalEntry with type todo creates todo entry', () => {
  withEl({'journal-capture-text':{value:'Fix the login bug'},
          'journal-capture-cat':{value:'work'}},
    ()=>run('journalNewType="todo"; addJournalEntry()'));
  eq(get('journalEntries[0].type'), 'todo');
  eq(get('journalEntries[0].text'), 'Fix the login bug');
});
```

---

## File change summary

| File | What changes |
|------|-------------|
| `state.js` | `journalNewType` default: `'dump'` → `'todo'` |
| `helpers.js` | `migrateTasks()`: add `taskScope`, `doneDate` fields; `getVisibleTasksSorted()`: add day-scope visibility filter |
| `actions_tasks.js` | `toggleTask()`: set/clear `doneDate`; `ensureRepeatTasksForToday()`: add `taskScope:'day'`,`doneDate:''` to generated instances; `addTask()`: add `taskScope`, `doneDate` to new task object |
| `actions_planner.js` | `plannerPromoteDump()`: add `taskScope:'day'`, `doneDate:''` to pushed task |
| `actions.js` (or `actions_tasks.js`) | Add `promoteDumpToTask()` function |
| `render_journal.js` | Rename widget label to "Dump"; update icon; update copy/placeholders; add `todo` type option in capture bar; add promote button on todo-type entries |
| `render_tasks.js` | Add `proj` badge on `taskScope==='project'` tasks; add scope selector to add-task form |
| `test_workflows.js` | Add `taskScope:'project',doneDate:''` to all ~45 task fixtures; add WF28 and WF29 test blocks |
| `ARCHITECTURE.md` | Update `## Current Status / Next Step` section |

### Files that do NOT change
- `storage.js` — `taskScope` and `doneDate` live on task objects, already persisted via `adhd4_tasks`
- `core.js` — no changes
- `render_checkin.js` — untouched
- `render_planner.js` — untouched (the promote button calls `plannerPromoteDump` which is in actions_planner.js)
- `render_focus.js`, `render_habits.js`, `render_daylog.js` — untouched
- `constants.js`, `widget_registry.js`, `render_modals.js` — untouched
- `index.html` — no new files, no load-order changes needed

---

## Implementation order

Do these in sequence, running `node test_workflows.js` between steps:

1. **Add fields to all test fixtures** (test_workflows.js) — this will
   fail until migrateTasks() is updated, but gets the noise out of the
   way first. Expect ~45 fixture failures initially.

2. **migrateTasks() + getVisibleTasksSorted()** (helpers.js) — fixes
   the fixture failures and adds the filter logic.

3. **toggleTask + ensureRepeatTasksForToday + addTask** (actions_tasks.js)
   — sets doneDate correctly on state mutations.

4. **plannerPromoteDump** (actions_planner.js) — one-line addition.

5. **promoteDumpToTask** (actions.js or actions_tasks.js) — new function.

6. **render_tasks.js** — scope badge + scope selector in add form.

7. **render_journal.js** — rename, recopy, promote button.

8. **state.js** — change `journalNewType` default.

9. **Add WF28 + WF29 tests** (test_workflows.js) — should all pass now.

10. **Update ARCHITECTURE.md** — update status section and task field docs.

Run `node test_workflows.js` after step 2, after step 5, and after
step 9 to catch regressions early.

---

## Load-order note

`dateToYMD` is currently defined in `actions_planner.js`, which loads
**after** `helpers.js` in the current load order. If `getVisibleTasksSorted`
in helpers.js calls `dateToYMD`, this will fail at runtime (not in tests,
since all files are loaded before any function is called in the test harness).

**Fix options (pick one):**
- Move `dateToYMD` and `ymdToDate` to `helpers.js` (cleanest — they are
  pure date utilities, not planner-specific)
- Duplicate a local `_dateToYMD` in helpers.js
- Move the filter into `render_tasks.js` instead of `helpers.js` (keeps
  helpers.js clean but hides the filter in render code)

Recommended: move `dateToYMD` and `ymdToDate` to `helpers.js`, remove
them from `actions_planner.js`, and confirm no breakage. These are
general utilities and don't belong in a planner-specific file anyway.

---

## Carry-forward note for ARCHITECTURE.md

Replace the `## Current Status / Next Step` section with:

```
## Current Status / Next Step

**Verify before reading anything — run, don't view:**
\`\`\`
grep -c "registerWidget(" *.js    # expect 8
node test_workflows.js | tail -3  # expect 285+ passed, 0 failed
\`\`\`

**Next implementation:** Task scoping + Dump widget
See HANDOFF_task_scope_and_dump.md for full spec.
Changes: taskScope/doneDate fields on tasks, day-scope visibility
filter, journal widget renamed to Dump with promote-to-task flow.
No new files, no load-order changes, no new widgets.
```
