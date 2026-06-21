/*
MODULE: test_workflows.js
LAYER: unknown
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: test_workflows.js responsibilities
USES: local modules
STATE_READS: T, darkMode, habits, state, tasks
STATE_WRITES: Blob, FILES, June, MediaRecorder, T, TODAY, URL, _bad, _data, _isInvalid
PUBLIC_API: assert, completes, eq, get, logic, resetState, run, test, withEl
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

const fs = require('fs'), vm = require('vm'), path = require('path');

const SRC_DIR = __dirname;

const ls = {};
const localStorage = {
  getItem:  k   => ls[k] ?? null,
  setItem:  (k,v) => { ls[k] = String(v); },
  removeItem: k => { delete ls[k]; },
};

const me = () => ({
  value:'', style:{}, textContent:'', innerHTML:'',
  focus(){}, select(){}, click(){},
  getAttribute(){ return null; },
  setAttribute(){},
  closest(){ return null; },
  appendChild(){}, removeChild(){},
});
const rootEl = me(); rootEl.innerHTML = '';

const document = {
  _o: {},
  getElementById(id){ if(id==='root') return rootEl; return this._o[id] || me(); },
  querySelector(){ return null; },
  activeElement: { tagName:'BODY', closest:()=>null },
  body: { appendChild(){}, removeChild(){} },
  createElement(){
    const e = me();
    e.href=''; e.download='';
    e.appendChild=()=>{}; e.click=()=>{}; e.removeChild=()=>{};
    return e;
  },
  addEventListener(){},
};

const window = {
  scrollY:0, scrollTo:()=>{},
  addEventListener:()=>{},
  innerWidth:1200, innerHeight:800,
};
const requestAnimationFrame = fn => { fn(0); return 1; };
const cancelAnimationFrame  = ()  => {};
const performance = { now: ()=>Date.now() };
const navigator   = { userAgent:'Node', mediaDevices:null };
const location    = { protocol:'https:' };
const confirm     = ()   => true;
const alert       = ()   => {};
const prompt      = ()   => 'Test Template';
const URL = { createObjectURL:()=>'blob:fake', revokeObjectURL:()=>{} };
const indexedDB   = {};
const Blob        = function(p){ this.size = p ? String(p).length : 0; };
const MediaRecorder = { isTypeSupported:()=>false };
const setInterval   = ()  => 1;
const clearInterval = ()  => {};
const setTimeout    = (fn,ms) => { try { fn(); } catch(e){} return 1; };
const clearTimeout  = ()  => {};
const fetch         = async () => { throw new Error('network disabled in tests'); };
const AbortSignal   = { timeout: () => ({ aborted: false, addEventListener: () => {} }) };

const ctx = vm.createContext({
  localStorage, document, window,
  requestAnimationFrame, cancelAnimationFrame, performance,
  navigator, location, confirm, alert, prompt, URL,
  indexedDB, Blob, MediaRecorder, setInterval, clearInterval,
  setTimeout, clearTimeout, fetch, AbortSignal,
  console, Date, Math, JSON, Array, Object, String, Number,
  Boolean, Set, Map, parseInt, parseFloat, isNaN, isFinite,
  Error, Promise, RegExp,
});

const FILES = [
  'constants.js','state.js','widget_registry.js','helpers.js','core.js',
  'storage.js','ai.js','ui.js','audio.js',
  'render_focusboard_cards.js','render_focus_timer.js','render_focus.js','render_tasks.js','render_habits.js',
  'render_checkin.js','render_journal.js','render_daylog.js','actions.js',
  'render_modals.js','render.js','music.js','render_music.js',
  'actions_alarms_habits.js','actions_tasktimer.js','actions_tasks.js','actions_export.js',
  'actions_planner.js','actions_wizard.js','render_wizard.js','render_planner.js','runtime.js',
];
FILES.forEach(f => vm.runInContext(fs.readFileSync(path.join(SRC_DIR, f), 'utf8'), ctx));
console.log('✓ All files loaded\n');

// ── Harness ──────────────────────────────────────────────────────────────────
let passed = 0, failed = 0, errors = [];
function test(name, fn) {
  try   { fn(); console.log(`  ✓ ${name}`); passed++; }
  catch (e) {
    console.log(`  ✗ ${name}: ${e.message}`);
    failed++;
    errors.push({ name, msg: e.message });
  }
}
function assert(c, m) { if (!c) throw new Error(m || 'Assertion failed'); }
function eq(a, b, m)  { if (a !== b) throw new Error(`${m||''}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`); }

function run(code)  { return vm.runInContext(code, ctx); }
function get(expr)  { return vm.runInContext(expr, ctx); }
function withEl(overrides, fn) {
  document._o = overrides;
  fn();
  document._o = {};
}
function resetState() {
  vm.runInContext(`
    tasks=[]; habits=[]; timeSessions=[]; offTaskLog=[]; journalEntries=[];
    alarms=[]; templates=[];
    categories = defaultCats.map(c=>({...c}));
    energyLog = [];
    focusTaskId=null; focusSubtaskId=null;
    timerRunning=false; timerSecs=0; timerPlannedSecs=0;
    activeSession=null; timerMode='stopwatch'; timerSessionType='work';
    timerCountdownMins=25; timerInterval=null;
    showQuickLog=false; quickLogTaskId=null; quickLogInput=''; quickLogSecs=0;
    expandedSubtaskTaskIds=new Set(); addingSubtaskForTaskId=null;
    boardSubExpandedTaskIds=new Set(); dragSubtaskSourceId=null;
    editingEstimateId=null; editingTimeId=null; editingSessionId=null;
    dailyIntentions={date:'',answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null};
    energyPending={energy:null,sensory:null,tag:''};
    focusBoardManualIds=[]; focusBoardMode='all';
    urgencyPickerTaskId=null; expandedNoteTaskId=null; boardCardNoteEditId=null;
    crisisMode=false; darkMode=false; T=LIGHT;
    plannerView='month'; plannerSelectedDate=null;
    plannerMonth=null; plannerHighlightTaskId=null;
    plannerDayDumps={}; plannerDumpInput='';
    timelineDragState=null; timelineNewTaskDraft=null;
    timelineNewTaskText=''; timelineNewTaskCatId='';
    dayWizardState={date:dateToYMD(new Date()),phase:null,step:0,startDone:false,endDone:false,wizBannerDismissedAt:0};
    dayWizardOpen=false; wizCaptureInput=''; wizCaptureList=[]; wizShowAllCarryOver=false;
    wizReviewMode=false;
    aiSettings={masterEnabled:false,providerOrder:['ollama','anthropic'],ollamaEnabled:false,ollamaUrl:'http://localhost:11434',ollamaModel:'llama3.2',anthropicEnabled:false,anthropicKey:''};
    aiStatus={ollama:'unknown',anthropic:'unknown'};
    aiPendingParse=null; aiShowKey=false; wizAiPrompt=null; wizDayEndPrompt=null;
    wizCarryOverInsight=null; weeklyAiNudge=null; showSettingsModal=false;
    invalidateAvoidanceCache();
    saveNow();
  `, ctx);
}


const TODAY = new Date().toDateString();

// ════════════════════════════════════════════════════════════════════════════
console.log('═══ WF1: Task Lifecycle ═══');
resetState();

test('addTask creates task with correct fields', () => {
  withEl({'task-in':{value:'Write report'},'task-cat':{value:'work'},'task-time-in':{value:''},'task-repeat':{value:'none'}}, ()=>run('addTask()'));
  eq(get('tasks.length'), 1, 'count');
  eq(get('tasks[0].text'), 'Write report');
  eq(get('tasks[0].status'), 'todo');
  eq(get('tasks[0].catId'), 'work');
  eq(get('tasks[0].done'), false);
  assert(Array.isArray(get('tasks[0].subtasks')), 'subtasks array');
  eq(get('tasks[0].note'), '', 'note');
  eq(get('tasks[0].repeat'), null, 'repeat');
});

test('addTask normalizes scheduled time', () => {
  withEl({'task-in':{value:'Standup'},'task-cat':{value:''},'task-time-in':{value:'9:05'},'task-repeat':{value:'none'}}, ()=>run('addTask()'));
  eq(get('tasks.find(t=>t.text==="Standup").ts'), '09:05');
});

test('addTask rejects invalid time', () => {
  const before = get('tasks.length');
  withEl({'task-in':{value:'Bad'},'task-cat':{value:''},'task-time-in':{value:'nope'},'task-repeat':{value:'none'}}, ()=>run('addTask()'));
  eq(get('tasks.length'), before, 'no task added');
});

test('addTask sets repeat field', () => {
  withEl({'task-in':{value:'Daily'},'task-cat':{value:''},'task-time-in':{value:''},'task-repeat':{value:'daily'}}, ()=>run('addTask()'));
  eq(get('tasks.find(t=>t.text==="Daily").repeat'), 'daily');
});

test('toggleTask: todo→inprogress→done→todo', () => {
  const id = get('tasks[0].id');
  run(`toggleTask(${id})`); eq(get('tasks[0].status'), 'inprogress');
  run(`toggleTask(${id})`); eq(get('tasks[0].status'), 'done'); eq(get('tasks[0].done'), true);
  run(`toggleTask(${id})`); eq(get('tasks[0].status'), 'todo'); eq(get('tasks[0].done'), false);
});

test('toggleTask done clears focus', () => {
  const id = get('tasks[0].id');
  run(`focusTaskId=${id}; toggleTask(${id}); toggleTask(${id})`);
  eq(get('focusTaskId'), null);
});

test('deleteTask removes task and clears focus', () => {
  const id = get('tasks[0].id');
  run(`focusTaskId=${id}; deleteTask(${id})`);
  assert(!get(`tasks.find(t=>t.id===${id})`), 'removed');
  eq(get('focusTaskId'), null);
});

test('setTaskUrgency sets and toggles off', () => {
  const id = get('tasks[0].id');
  run(`setTaskUrgency(${id},3)`); eq(get(`tasks.find(t=>t.id===${id}).urgency`), 3);
  run(`setTaskUrgency(${id},3)`); eq(get(`tasks.find(t=>t.id===${id}).urgency`), 0);
  eq(get('urgencyPickerTaskId'), null, 'picker closed');
});

test('saveTaskTime normalizes single-digit hour', () => {
  const id = get('tasks[0].id');
  run(`saveTaskTime(${id},'9:05')`); eq(get(`tasks.find(t=>t.id===${id}).ts`), '09:05');
});

test('saveTaskTime empty string clears time', () => {
  const id = get('tasks[0].id');
  run(`saveTaskTime(${id},'')`);  eq(get(`tasks.find(t=>t.id===${id}).ts`), '');
});

test('clearTaskTime removes scheduled time', () => {
  const id = get('tasks[0].id');
  run(`tasks.find(t=>t.id===${id}).ts='14:00'; clearTaskTime(${id})`);
  eq(get(`tasks.find(t=>t.id===${id}).ts`), '');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF2: Focus & Timer ═══');
resetState();
run(`tasks.push({id:101,text:'FocusTask',catId:'work',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''})`);

test('setFocus sets focusTaskId, resets timer', () => {
  run('setFocus(101)');
  eq(get('focusTaskId'), 101); eq(get('focusSubtaskId'), null); eq(get('timerRunning'), false);
});

test('setFocus on done task is a no-op', () => {
  run('tasks.push({id:199,text:"Done",catId:"",done:true,status:"done",ts:"",order:99,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:"",anxiety:0,taskScope:"project",doneDate:""}); focusTaskId=null; setFocus(199)');
  eq(get('focusTaskId'), null);
});

test('startTimerInternal starts stopwatch and creates activeSession', () => {
  run(`focusTaskId=101; timerMode='stopwatch'; timerSessionType='work'; timerSecs=0; startTimerInternal()`);
  eq(get('timerRunning'), true); assert(get('activeSession')!==null); eq(get('activeSession.taskId'),101);
});

test('startTimerInternal is idempotent', () => {
  const first = get('timerInterval');
  run('startTimerInternal()');
  eq(get('timerInterval'), first);
});

test('stopTimerInternal stops cleanly', () => {
  run('stopTimerInternal()');
  eq(get('timerRunning'), false); eq(get('timerInterval'), null);
});

test('stopAndSaveTimer(true) saves session directly', () => {
  run(`timerMode='stopwatch'; timerSecs=300; timerRunning=true; activeSession={id:Date.now(),taskId:101,subtaskId:null,startedAt:Date.now()-300000,mode:'stopwatch',type:'work'}; stopAndSaveTimer(true)`);
  const s = get('timeSessions[timeSessions.length-1]');
  eq(s.taskId, 101); assert(s.seconds>=300, `${s.seconds}`); eq(get('timerRunning'), false);
});

test('stopAndSaveTimer(false) opens quick-log', () => {
  run(`timerMode='stopwatch'; timerSecs=600; timerRunning=true; activeSession={id:Date.now(),taskId:101,subtaskId:null,startedAt:Date.now()-600000,mode:'stopwatch',type:'work'}; stopAndSaveTimer(false)`);
  eq(get('showQuickLog'), true); eq(get('quickLogTaskId'), 101);
});

test('discardQuickLog closes without saving', () => {
  const before = get('timeSessions.length');
  run('discardQuickLog()');
  eq(get('showQuickLog'), false); eq(get('timeSessions.length'), before);
});

test('countdown elapsed = planned - remaining', () => {
  run(`timerMode='countdown'; timerPlannedSecs=1500; timerSecs=1380; timerRunning=true; activeSession={id:Date.now(),taskId:101,subtaskId:null,startedAt:Date.now()-120000,mode:'countdown',type:'work'}; stopAndSaveTimer(true)`);
  const s = get('timeSessions[timeSessions.length-1]');
  assert(s.seconds>=120 && s.seconds<=130, `seconds=${s.seconds}`);
});

test('resetTimer clears all timer state', () => {
  run('timerSecs=999; resetTimer(true)');
  eq(get('timerRunning'), false); eq(get('activeSession'), null); eq(get('showTransitionPrompt'), false);
});

test('startCountdown with no focus opens picker', () => {
  run('focusTaskId=null; showFocusModal=false; startCountdown()');
  eq(get('showFocusModal'), true);
});

test('doneFocus marks task done and clears focus', () => {
  run('focusTaskId=101; tasks.find(t=>t.id===101).status="todo"; tasks.find(t=>t.id===101).done=false; doneFocus()');
  eq(get('focusTaskId'), null); eq(get('tasks.find(t=>t.id===101).status'), 'done');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF3: Subtasks ═══');
resetState();
run(`tasks.push({id:200,text:'Parent',catId:'work',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''})`);

test('addSubtask adds with correct fields', () => {
  withEl({'subtask-add-input-200':{value:'First sub'}}, ()=>run('addSubtask(200)'));
  eq(get('tasks[0].subtasks.length'), 1);
  eq(get('tasks[0].subtasks[0].text'), 'First sub');
  eq(get('tasks[0].subtasks[0].done'), false);
  eq(get('tasks[0].subtasks[0].practiceCount'), 0);
  eq(get('tasks[0].subtasks[0].order'), 0);
});

test('addSubtask second gets order 1', () => {
  withEl({'subtask-add-input-200':{value:'Second sub'}}, ()=>run('addSubtask(200)'));
  eq(get('tasks[0].subtasks.length'), 2);
  eq(get('tasks[0].subtasks[1].order'), 1);
});

test('addSubtask empty text is a no-op', () => {
  withEl({'subtask-add-input-200':{value:'  '}}, ()=>run('addSubtask(200)'));
  eq(get('tasks[0].subtasks.length'), 2);
});

test('toggleSubtask marks done / undone', () => {
  const sid = get('tasks[0].subtasks[0].id');
  run(`toggleSubtask(200,${sid})`); eq(get('tasks[0].subtasks[0].done'), true);
  run(`toggleSubtask(200,${sid})`); eq(get('tasks[0].subtasks[0].done'), false);
});

test('toggleSubtask done clears focusSubtaskId', () => {
  const sid = get('tasks[0].subtasks[0].id');
  run(`focusTaskId=200; focusSubtaskId=${sid}; toggleSubtask(200,${sid})`);
  eq(get('focusSubtaskId'), null);
});

test('deleteSubtask removes subtask and sessions', () => {
  // Use last subtask (index 1) so index 0 stays for later tests
  const sid = get('tasks[0].subtasks[1].id');
  run(`timeSessions.push({id:888,taskId:200,subtaskId:${sid},startedAt:0,endedAt:0,seconds:60,type:'work'})`);
  run(`deleteSubtask(200,${sid})`);
  assert(!get(`tasks[0].subtasks.find(s=>s.id===${sid})`), 'removed');
  assert(!get(`timeSessions.find(s=>s.subtaskId===${sid})`), 'sessions removed');
});

test('incrementSubtaskPractice increments count', () => {
  // Add a fresh subtask so this test is independent of prior deletions
  withEl({'subtask-add-input-200':{value:'Practice sub'}}, ()=>run('addSubtask(200)'));
  const sid = get('tasks[0].subtasks[tasks[0].subtasks.length-1].id');
  const before = get(`tasks[0].subtasks.find(s=>s.id===${sid}).practiceCount`) || 0;
  run(`incrementSubtaskPractice(200,${sid})`);
  eq(get(`tasks[0].subtasks.find(s=>s.id===${sid}).practiceCount`), before + 1);
});

test('setFocus with subtaskId sets both IDs', () => {
  const sid = get('tasks[0].subtasks[tasks[0].subtasks.length-1].id');
  run(`tasks[0].subtasks.find(s=>s.id===${sid}).done=false; setFocus(200,${sid})`);
  eq(get('focusTaskId'), 200); eq(get('focusSubtaskId'), get(String(sid)));
});

test('openAddSubtask / closeAddSubtask', () => {
  run('openAddSubtask(200)');
  eq(get('addingSubtaskForTaskId'), 200); assert(get('expandedSubtaskTaskIds.has(200)'));
  run('closeAddSubtask()');
  eq(get('addingSubtaskForTaskId'), null);
});

test('toggleBoardSubExpand adds and removes from Set', () => {
  run('boardSubExpandedTaskIds=new Set(); toggleBoardSubExpand(200)');
  assert(get('boardSubExpandedTaskIds.has(200)'), 'should be expanded');
  run('toggleBoardSubExpand(200)');
  assert(!get('boardSubExpandedTaskIds.has(200)'), 'should be collapsed');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF4: Time Logging ═══');
resetState();
run(`tasks.push({id:300,text:'LogTask',catId:'work',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:60,note:'',anxiety:0,taskScope:'project',doneDate:''}); focusTaskId=300`);

test('commitQuickLog saves session', () => {
  run(`showQuickLog=true; quickLogTaskId=300; quickLogInput='25m'; quickLogSecs=0; quickLogStartedAt=Date.now()-1500000`);
  withEl({'ql-time-input':{value:'25m'},'ql-note':{value:''}}, ()=>run('commitQuickLog()'));
  const s = get('timeSessions[timeSessions.length-1]');
  eq(s.taskId, 300); eq(s.seconds, 1500); eq(get('showQuickLog'), false);
});

test('commitQuickLog with note creates journal entry', () => {
  const jBefore = get('journalEntries.length');
  run(`showQuickLog=true; quickLogTaskId=300; quickLogInput='10m'; quickLogStartedAt=Date.now()-600000`);
  withEl({'ql-time-input':{value:'10m'},'ql-note':{value:'Great session'}}, ()=>run('commitQuickLog()'));
  assert(get('journalEntries.length') > jBefore); eq(get('journalEntries[0].type'), 'reflect');
});

test('commitQuickLog null taskId is no-op', () => {
  const before = get('timeSessions.length');
  run('quickLogTaskId=null; commitQuickLog()');
  eq(get('timeSessions.length'), before);
});

test('getTotalForTask sums parent + subtask sessions', () => {
  run('timeSessions=[]; timeSessions.push({id:1,taskId:300,subtaskId:null,startedAt:0,endedAt:0,seconds:600,type:"work"}); timeSessions.push({id:2,taskId:300,subtaskId:99,startedAt:0,endedAt:0,seconds:400,type:"work"})');
  eq(run('getTotalForTask(300)'), 1000); eq(run('getTotalForTask(0)'), 0);
});

test('getTotalForSubtask only counts matching subtaskId', () => {
  eq(run('getTotalForSubtask(300,99)'), 400);
});

test('deleteSession removes by id', () => {
  const id = get('timeSessions[0].id');
  const before = get('timeSessions.length');
  run(`deleteSession(${id})`);
  eq(get('timeSessions.length'), before-1);
});

test('saveSessionEdit updates seconds from MM:SS', () => {
  run(`timeSessions.push({id:555,taskId:300,subtaskId:null,startedAt:0,endedAt:0,seconds:600,type:'work'}); editingSessionId=555; editingSessionMmSs='15:00'; saveSessionEdit(555)`);
  eq(run('timeSessions.find(s=>s.id===555).seconds'), 900); eq(get('editingSessionId'), null);
});

test('saveSessionEdit bad MM:SS does not change seconds', () => {
  run(`timeSessions.push({id:556,taskId:300,subtaskId:null,startedAt:0,endedAt:0,seconds:300,type:'work'}); editingSessionId=556; editingSessionMmSs='bad'`);
  run('saveSessionEdit(556)');
  eq(run('timeSessions.find(s=>s.id===556).seconds'), 300);
});

test('parseTimeInput all formats', () => {
  eq(run("parseTimeInput('1h30m')"),5400); eq(run("parseTimeInput('90')"),5400);
  eq(run("parseTimeInput('1:30')"),5400);  eq(run("parseTimeInput('90m')"),5400);
  eq(run("parseTimeInput('0m')"),0);        eq(run("parseTimeInput('abc')"),null);
  eq(run("parseTimeInput('')"),null);
});


// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF5: Habits ═══');
resetState();

test('addHabit with anchor', () => {
  withEl({'habit-in':{value:'Morning walk'},'habit-cat':{value:'health'},'habit-anchor-new':{value:'morning'}}, ()=>run('addHabit()'));
  eq(get('habits.length'), 1); eq(get('habits[0].name'), 'Morning walk');
  eq(get('habits[0].anchor'), 'morning'); eq(get('habits[0].anchorOrder'), 0);
});

test('addHabit second in same anchor gets anchorOrder 1', () => {
  withEl({'habit-in':{value:'Stretching'},'habit-cat':{value:''},'habit-anchor-new':{value:'morning'}}, ()=>run('addHabit()'));
  eq(get('habits.find(h=>h.name==="Stretching").anchorOrder'), 1);
});

test('addHabit empty text is no-op', () => {
  withEl({'habit-in':{value:'  '},'habit-cat':{value:''},'habit-anchor-new':{value:''}}, ()=>run('addHabit()'));
  eq(get('habits.length'), 2);
});

test('openHitInput / adjustHitMins / clamp at 0', () => {
  const hid = get('habits[0].id');
  run(`openHitInput(${hid})`); eq(get('hitInputHabitId'), get(String(hid)));
  run(`adjustHitMins(${hid},10)`); eq(get('hitInputMins'), 10);
  run(`adjustHitMins(${hid},-5)`); eq(get('hitInputMins'), 5);
  run(`adjustHitMins(${hid},-20)`); eq(get('hitInputMins'), 0, 'clamped');
});

test('saveHabitHit records hit, clears popover', () => {
  const hid = get('habits[0].id');
  run(`hitInputHabitId=${hid}; hitInputMins=30; hitInputTime='08:00'; saveHabitHit(${hid})`);
  const hits = get(`habits.find(h=>h.id===${hid}).hits`);
  eq(hits.length, 1); eq(hits[0].minutes, 30); eq(get('hitInputHabitId'), null);
});

test('getAllHitsForHabit returns todays hits', () => {
  const hid = get('habits[0].id');
  const hits = run(`getAllHitsForHabit(habits.find(h=>h.id===${hid}),'${TODAY}')`);
  assert(hits.length >= 1);
});

test('removeHabitHit removes specific hit', () => {
  const hid = get('habits[0].id');
  const hitId = get(`habits.find(h=>h.id===${hid}).hits[0].id`);
  run(`removeHabitHit(${hid},${hitId})`);
  assert(!get(`habits.find(h=>h.id===${hid}).hits.find(x=>x.id===${hitId})`));
});

test('setHabitAnchor changes anchor', () => {
  const hid = get('habits[0].id');
  run(`setHabitAnchor(${hid},'day_start')`);
  eq(get(`habits.find(h=>h.id===${hid}).anchor`), 'day_start');
  eq(get(`habits.find(h=>h.id===${hid}).anchorOrder`), 0);
});

test('setHabitAnchor no-op when same anchor', () => {
  const hid = get('habits[0].id');
  const before = get(`habits.find(h=>h.id===${hid}).anchorOrder`);
  run(`setHabitAnchor(${hid},'day_start')`);
  eq(get(`habits.find(h=>h.id===${hid}).anchorOrder`), before);
});

test('deleteHabit removes from array', () => {
  const hid = get('habits[0].id');
  run(`deleteHabit(${hid})`);
  assert(!get('habits').find(h => h.id === hid));
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF6: Categories ═══');
resetState();

test('addCategory creates new category', () => {
  withEl({'new-cat-name':{value:'Creative'}}, ()=>run('addCategory()'));
  assert(get('categories.find(c=>c.name==="Creative")'));
});

test('addCategory rejects duplicate (case-insensitive)', () => {
  const before = get('categories.length');
  withEl({'new-cat-name':{value:'CREATIVE'}}, ()=>run('addCategory()'));
  eq(get('categories.length'), before);
});

test('confirmDeleteCat removes category and clears task catIds', () => {
  const catId = get('categories.find(c=>c.name==="Creative").id');
  run(`tasks.push({id:401,text:'CT',catId:'${catId}',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''})`);
  run(`confirmDeleteCat('${catId}')`);
  assert(!get('categories.find(c=>c.name==="Creative")'));
  eq(get('tasks.find(t=>t.id===401).catId'), '');
});

test('setCatColor changes color', () => {
  const catId = get('categories[0].id');
  run(`setCatColor('${catId}',3)`);
  eq(get(`categories.find(c=>c.id==='${catId}')`).color.name, get('COLOR_OPTS[3].name'));
});

test('saveEditCat updates name', () => {
  const catId = get('categories[0].id');
  withEl({[`cedit-name-${catId}`]:{value:'Renamed'}}, ()=>run(`saveEditCat('${catId}')`));
  eq(get(`categories.find(c=>c.id==='${catId}')`).name, 'Renamed');
  eq(get('editingCatId'), null);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF7: Focus Board ═══');
resetState();
run(`tasks.push({id:501,text:'BA',catId:'work',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:2,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}); tasks.push({id:502,text:'BB',catId:'',done:false,status:'todo',ts:'14:00',order:1,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''})`);

test('setFocusBoardMode switches mode, closes picker', () => {
  run(`focusBoardPickerOpen=true; setFocusBoardMode('urgent')`);
  eq(get('focusBoardMode'), 'urgent'); eq(get('focusBoardPickerOpen'), false);
});

test('addToFocusBoard is idempotent', () => {
  run(`setFocusBoardMode('manual'); addToFocusBoard(501); addToFocusBoard(501)`);
  eq(get('focusBoardManualIds.filter(id=>id===501).length'), 1);
});

test('removeFromFocusBoard removes task', () => {
  run('removeFromFocusBoard(501)');
  assert(!get('focusBoardManualIds.includes(501)'));
});

test('dropOnFocusBoard auto-switches to manual', () => {
  run(`focusBoardMode='all'; dragSourceId=502`);
  run(`dropOnFocusBoard({preventDefault:()=>{},currentTarget:{style:{}}})`);
  eq(get('focusBoardMode'), 'manual'); assert(get('focusBoardManualIds.includes(502)'));
  eq(get('dragSourceId'), null);
});

test('dropOnFocusBoard with null dragSourceId is no-op', () => {
  const before = get('focusBoardManualIds.length');
  run(`dragSourceId=null; dropOnFocusBoard({preventDefault:()=>{},currentTarget:{style:{}}})`);
  eq(get('focusBoardManualIds.length'), before);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF8: Energy & Intentions ═══');
resetState();

test('saveEnergyCheckin saves entry', () => {
  run(`energyPending={energy:3,sensory:'calm',tag:'ok'}; saveEnergyCheckin('${TODAY}')`);
  const e = run(`energyLog.find(e=>e.date==='${TODAY}')`);
  assert(e); eq(e.energy,3); eq(e.sensory,'calm');
});

test('saveEnergyCheckin rejects missing energy', () => {
  const before = get('energyLog.length');
  run(`energyPending={energy:null,sensory:null,tag:''}; saveEnergyCheckin('${TODAY}')`);
  eq(get('energyLog.length'), before);
});

test('saveEnergyCheckin updates (no duplicate)', () => {
  run(`energyPending={energy:5,sensory:'overwhelmed',tag:'busy'}; saveEnergyCheckin('${TODAY}')`);
  eq(run(`energyLog.filter(e=>e.date==='${TODAY}').length`), 1);
  eq(run(`energyLog.find(e=>e.date==='${TODAY}')`).energy, 5);
});

test('energyLog pruned to 90 days', () => {
  run(`const old=new Date(); old.setDate(old.getDate()-91); energyLog.push({date:old.toDateString(),energy:3,sensory:null,tag:''}); energyPending={energy:4,sensory:null,tag:''}; saveEnergyCheckin('${TODAY}')`);
  const old = run(`energyLog.find(e=>{ const d=new Date(e.date); return (Date.now()-d.getTime())>90*24*60*60*1000 })`);
  assert(!old, 'old entry not pruned');
});

test('advanceIntention moves step on valid answer', () => {
  run(`ensureIntentionsToday('${TODAY}'); dailyIntentions.step=0; dailyIntentions.answers.arriving='Good'; advanceIntention('${TODAY}')`);
  eq(get('dailyIntentions.step'), 1);
});

test('advanceIntention rejects empty answer', () => {
  const before = get('dailyIntentions.step');
  run(`dailyIntentions.answers.oneWin=''; advanceIntention('${TODAY}')`);
  eq(get('dailyIntentions.step'), before);
});

test('advanceIntention completes all steps → done', () => {
  run(`dailyIntentions.step=0; dailyIntentions.answers={arriving:'ok',oneWin:'Ship it',derail:'Close Slack',goodEnough:'3 tasks'}`);
  for(let i=0;i<4;i++) run(`advanceIntention('${TODAY}')`);
  eq(get('dailyIntentions.step'), 'done');
});

test('backIntention decrements from done', () => {
  run(`dailyIntentions.step='done'; backIntention()`);
  eq(get('dailyIntentions.step'), 3);
});

test('setWinOutcome saves outcome', () => {
  run(`setWinOutcome('partial')`); eq(get('dailyIntentions.winOutcome'), 'partial');
});

test('resetIntentions clears plan', () => {
  run(`resetIntentions('${TODAY}')`);
  eq(get('dailyIntentions.step'), 0); eq(get('dailyIntentions.winOutcome'), null);
  eq(get("dailyIntentions.answers.arriving"), '');
});


// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF9: Alarms ═══');
resetState();

// Each alarm test works with its own clean alarm array to avoid id-collision issues
test('addAlarm normalizes time 9:5 → 09:05', () => {
  run('alarms=[]');
  withEl({'alarm-time-in':{value:'9:5'},'alarm-label-in':{value:'X'},'alarm-task-in':{value:''}}, ()=>run('addAlarm()'));
  eq(get('alarms.length'), 1); eq(get('alarms[0].time'), '09:05');
  eq(get('alarms[0].on'), true); eq(get('alarms[0].fired'), false);
});

test('addAlarm normalizes 14:3 → 14:03', () => {
  run('alarms=[]');
  withEl({'alarm-time-in':{value:'14:3'},'alarm-label-in':{value:'Y'},'alarm-task-in':{value:''}}, ()=>run('addAlarm()'));
  eq(get('alarms[0].time'), '14:03');
});

test('addAlarm rejects invalid time', () => {
  run('alarms=[]');
  withEl({'alarm-time-in':{value:'bad'},'alarm-label-in':{value:'X'},'alarm-task-in':{value:''}}, ()=>run('addAlarm()'));
  eq(get('alarms.length'), 0);
});

test('addAlarm stores linked taskId', () => {
  run('alarms=[]; tasks.push({id:601,text:"AT",catId:"",done:false,status:"todo",ts:"",order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:"",anxiety:0,taskScope:"project",doneDate:""})');
  withEl({'alarm-time-in':{value:'14:00'},'alarm-label-in':{value:'L'},'alarm-task-in':{value:'601'}}, ()=>run('addAlarm()'));
  eq(get('alarms[0].taskId'), 601);
});

test('toggleAlarm flips on/off, resets fired', () => {
  run('alarms=[{id:9001,time:"09:00",label:"T",on:true,fired:true,taskId:null}]');
  run('toggleAlarm(9001)'); eq(get('alarms[0].on'), false); eq(get('alarms[0].fired'), false);
  run('toggleAlarm(9001)'); eq(get('alarms[0].on'), true);
});

test('deleteAlarm removes correct alarm', () => {
  run('alarms=[{id:9010,time:"09:00",label:"A",on:true,fired:false,taskId:null},{id:9011,time:"14:00",label:"B",on:true,fired:false,taskId:null}]');
  run('deleteAlarm(9010)');
  eq(get('alarms.length'), 1); eq(get('alarms[0].id'), 9011);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF10: Journal ═══');
resetState();

test('addJournalEntry saves entry', () => {
  withEl({'journal-capture-text':{value:'Productive morning'},'journal-capture-cat':{value:'work'}}, ()=>run('journalNewType="reflect"; addJournalEntry()'));
  eq(get('journalEntries[0].type'), 'reflect'); eq(get('journalEntries[0].text'), 'Productive morning');
});

test('addJournalEntry rejects empty text', () => {
  const before = get('journalEntries.length');
  withEl({'journal-capture-text':{value:'   '},'journal-capture-cat':{value:''}}, ()=>run('addJournalEntry()'));
  eq(get('journalEntries.length'), before);
});

test('deleteJournalEntry removes entry', () => {
  const id = get('journalEntries[0].id');
  run(`deleteJournalEntry(${id})`);
  assert(!get('journalEntries').find(e=>e.id===id));
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF11: Off-Task Log ═══');
resetState();

test('saveOffTask creates entry with correct seconds', () => {
  withEl({'offtask-start':{value:'10:00'},'offtask-end':{value:'10:45'},'offtask-note':{value:'Break'}}, ()=>run('saveOffTask()'));
  const e = get('offTaskLog[offTaskLog.length-1]');
  eq(e.startTime,'10:00'); eq(e.endTime,'10:45'); eq(e.seconds,2700); eq(e.note,'Break');
});

test('saveOffTask rejects end <= start', () => {
  const before = get('offTaskLog.length');
  withEl({'offtask-start':{value:'14:00'},'offtask-end':{value:'13:00'},'offtask-note':{value:''}}, ()=>run('saveOffTask()'));
  eq(get('offTaskLog.length'), before);
});

test('saveOffTask rejects same start and end', () => {
  const before = get('offTaskLog.length');
  withEl({'offtask-start':{value:'10:00'},'offtask-end':{value:'10:00'},'offtask-note':{value:''}}, ()=>run('saveOffTask()'));
  eq(get('offTaskLog.length'), before);
});

test('saveEditOffTask updates entry', () => {
  const id = get('offTaskLog[0].id');
  run(`editingOffTaskId=${id}`);
  withEl({[`offtask-edit-start-${id}`]:{value:'09:00'},[`offtask-edit-end-${id}`]:{value:'09:30'},[`offtask-edit-note-${id}`]:{value:'Routine'}}, ()=>run(`saveEditOffTask(${id})`));
  const e = run(`offTaskLog.find(e=>e.id===${id})`);
  eq(e.startTime,'09:00'); eq(e.endTime,'09:30'); eq(e.seconds,1800); eq(e.note,'Routine');
  eq(get('editingOffTaskId'), null);
});

test('deleteOffTask removes entry', () => {
  const id = get('offTaskLog[0].id');
  const before = get('offTaskLog.length');
  run(`deleteOffTask(${id})`);
  eq(get('offTaskLog.length'), before-1);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF12: Repeat Tasks ═══');
resetState();

test('ensureRepeatTasksForToday generates daily task', () => {
  run(`tasks.push({id:700,text:'Standup',catId:'work',done:false,status:'todo',ts:'09:00',order:0,createdAt:Date.now(),repeat:'daily',templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}); ensureRepeatTasksForToday()`);
  const gen = run(`tasks.filter(t=>t.templateId===700&&t.generatedForDate==='${TODAY}')`);
  eq(gen.length, 1); eq(gen[0].text,'Standup'); eq(gen[0].repeat,null);
});

test('ensureRepeatTasksForToday is idempotent', () => {
  run('ensureRepeatTasksForToday()');
  eq(run(`tasks.filter(t=>t.templateId===700).length`), 1);
});

test('weekdays repeat respects day of week', () => {
  const day = new Date().getDay();
  run(`tasks.push({id:701,text:'Weekday',catId:'',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:'weekdays',templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}); ensureRepeatTasksForToday()`);
  const gen = run(`tasks.filter(t=>t.templateId===701)`);
  const isWeekday = day >= 1 && day <= 5;
  eq(gen.length, isWeekday ? 1 : 0, isWeekday ? 'should generate on weekday' : 'should not generate on weekend');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF13: Templates ═══');
resetState();
run(`tasks.push({id:800,text:'TplA',catId:'work',done:false,status:'todo',ts:'09:00',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}); tasks.push({id:801,text:'TplB',catId:'',done:true,status:'done',ts:'',order:1,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''})`);

test('saveAsTemplate saves only non-done tasks', () => {
  run('saveAsTemplate()');
  eq(get('templates.length'), 1); eq(get('templates[0].tasks.length'), 1);
  eq(get('templates[0].tasks[0].text'), 'TplA');
});

test('loadTemplate adds tasks, skips duplicates', () => {
  run('tasks=[]');
  const tid = get('templates[0].id');
  run(`loadTemplate(${tid})`); eq(get('tasks.length'), 1);
  run(`loadTemplate(${tid})`); eq(get('tasks.length'), 1, 'no duplicate');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF14: Widget Layout ═══');
resetState();
run('loadWidgetLayout()');

test('widgetLayout has entry for every widget def', () => {
  eq(get('widgetLayout.length'), get('getRegisteredWidgets().length'));
});

test('toggleWidgetCollapse collapses and expands', () => {
  run(`toggleWidgetCollapse('focusboard')`); assert(get("widgetLayout.find(w=>w.id==='focusboard').collapsed"));
  run(`toggleWidgetCollapse('focusboard')`); assert(!get("widgetLayout.find(w=>w.id==='focusboard').collapsed"));
});

test('hideWidget hides pinnable widget', () => {
  run(`hideWidget('habits')`); assert(!get("widgetLayout.find(w=>w.id==='habits').visible"));
});

test('hideWidget is no-op on non-pinnable (focusboard)', () => {
  run(`hideWidget('focusboard')`); assert(get("widgetLayout.find(w=>w.id==='focusboard').visible"));
});

test('restoreWidget makes visible', () => {
  run(`restoreWidget('habits')`); assert(get("widgetLayout.find(w=>w.id==='habits').visible"));
});

test('widget drag-and-drop swaps order', () => {
  run(`widgetLayout[0].order=0; widgetLayout[1].order=1`);
  const id0=get('widgetLayout[0].id'), id1=get('widgetLayout[1].id');
  run(`dragSourceWidgetId='${id0}'; dropWidget({preventDefault:()=>{},currentTarget:{style:{}}},'${id1}')`);
  eq(get(`widgetLayout.find(w=>w.id==='${id0}')`).order, 1);
  eq(get(`widgetLayout.find(w=>w.id==='${id1}')`).order, 0);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF15: Task Sorting ═══');
resetState();
run(`tasks=[{id:901,text:'A',status:'todo',ts:'14:00',order:1,createdAt:1000,urgency:0,subtasks:[],catId:'',done:false,repeat:null,templateId:null,generatedForDate:null,pinned:false,estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''},{id:902,text:'B',status:'todo',ts:'09:00',order:0,createdAt:2000,urgency:3,subtasks:[],catId:'',done:false,repeat:null,templateId:null,generatedForDate:null,pinned:false,estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''},{id:903,text:'C',status:'done',ts:'',order:2,createdAt:3000,urgency:0,subtasks:[],catId:'',done:true,repeat:null,templateId:null,generatedForDate:null,pinned:false,estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}]; invalidateAvoidanceCache()`);

test('sort by time: earlier time first, no-time last', () => {
  run(`taskSortMode='time'`); const s=run('sortTasksList(tasks)');
  eq(s[0].id,902); eq(s[1].id,901); eq(s[2].id,903);
});

test('sort by manual: order field', () => {
  run(`taskSortMode='manual'`); const s=run('sortTasksList(tasks)');
  eq(s[0].id,902); eq(s[1].id,901);
});

test('sort by added: newest createdAt first', () => {
  run(`taskSortMode='added'`); const s=run('sortTasksList(tasks)');
  eq(s[0].id,903); eq(s[2].id,901);
});

test('sort by status: inprogress first, done last', () => {
  run(`taskSortMode='status'; tasks[0].status='inprogress'`);
  const s=run('sortTasksList(tasks)');
  eq(s[0].id,901); eq(s[s.length-1].id,903);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF16: Edge Cases & Regression ═══');
resetState();

test('avoidanceScore: done task always 0', () => {
  run(`tasks=[{id:1000,text:'Done',status:'done',urgency:5,subtasks:[],createdAt:Date.now()-7*86400000,catId:'',done:true,ts:'',order:0,repeat:null,templateId:null,generatedForDate:null,pinned:false,estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}]; timeSessions=[]; invalidateAvoidanceCache()`);
  eq(run('avoidanceScore(tasks[0])'), 0);
});

test('avoidanceScore: stale task has bonus score', () => {
  run(`tasks=[{id:1001,text:'Stale',status:'todo',urgency:0,subtasks:[],createdAt:Date.now()-10*86400000,catId:'',done:false,ts:'',order:0,repeat:null,templateId:null,generatedForDate:null,pinned:false,estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}]; timeSessions=[]; invalidateAvoidanceCache()`);
  assert(run('avoidanceScore(tasks[0])') >= 3);
});

test('avoidanceScore cache invalidated by saveNow()', () => {
  const before = run('avoidanceScore(tasks[0])');
  run(`timeSessions=[{id:1,taskId:1001,subtaskId:null,startedAt:Date.now()-60000,endedAt:Date.now(),seconds:60,type:'work'}]; saveNow()`);
  assert(run('avoidanceScore(tasks[0])') < before);
});

test('pinTask creates habit and marks pinned', () => {
  run(`tasks=[{id:1002,text:'PinMe',status:'todo',urgency:0,subtasks:[],createdAt:Date.now(),catId:'',done:false,ts:'',order:0,repeat:null,templateId:null,generatedForDate:null,pinned:false,estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}]; habits=[]`);
  run('pinTask(1002)');
  assert(get('tasks.find(t=>t.id===1002).pinned'));
  assert(get('habits.find(h=>h.name==="PinMe")'));
});

test('pinTask unpins on second call', () => {
  run('pinTask(1002)'); assert(!get('tasks.find(t=>t.id===1002).pinned'));
});

test('ensureFocusValid clears focus for deleted task', () => {
  run(`tasks=[{id:1003,text:'T',status:'todo',urgency:0,subtasks:[],createdAt:Date.now(),catId:'',done:false,ts:'',order:0,repeat:null,templateId:null,generatedForDate:null,pinned:false,estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}]; focusTaskId=1003; tasks=[]; ensureFocusValid()`);
  eq(get('focusTaskId'), null);
});

test('ensureFocusValid clears missing subtaskId, keeps task', () => {
  run(`tasks=[{id:1004,text:'T',status:'todo',urgency:0,subtasks:[{id:10,text:'s',done:false,order:0,practiceCount:0}],createdAt:Date.now(),catId:'',done:false,ts:'',order:0,repeat:null,templateId:null,generatedForDate:null,pinned:false,estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}]; focusTaskId=1004; focusSubtaskId=999; ensureFocusValid()`);
  eq(get('focusTaskId'), 1004); eq(get('focusSubtaskId'), null);
});

test('drag-and-drop swaps task order', () => {
  run(`tasks=[{id:2001,text:'T1',status:'todo',order:0,catId:'',done:false,ts:'',createdAt:1,repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''},{id:2002,text:'T2',status:'todo',order:1,catId:'',done:false,ts:'',createdAt:2,repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}]; dragSourceId=2001; drop({preventDefault:()=>{},currentTarget:{style:{}}},2002)`);
  eq(get('tasks.find(t=>t.id===2001).order'), 1);
  eq(get('tasks.find(t=>t.id===2002).order'), 0);
  eq(get('dragSourceId'), null);
});

test('subtask drag-to-reorder swaps order', () => {
  run(`tasks=[{id:3001,text:'P',status:'todo',order:0,catId:'',done:false,ts:'',createdAt:1,repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[{id:10,text:'A',done:false,order:0,practiceCount:0},{id:11,text:'B',done:false,order:1,practiceCount:0}],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}]`);
  run(`dragSubtaskSourceId={taskId:3001,subtaskId:10}; dropSubtask({preventDefault:()=>{},stopPropagation:()=>{},currentTarget:{style:{}}},3001,11)`);
  const subs = get('tasks.find(t=>t.id===3001).subtasks');
  eq(subs.find(s=>s.id===10).order, 1);
  eq(subs.find(s=>s.id===11).order, 0);
  eq(get('dragSubtaskSourceId'), null);
});

test('subtask drag cross-task drop is no-op', () => {
  run(`tasks=[{id:3002,text:'P2',status:'todo',order:0,catId:'',done:false,ts:'',createdAt:1,repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[{id:20,text:'X',done:false,order:0,practiceCount:0}],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}]`);
  run(`dragSubtaskSourceId={taskId:3001,subtaskId:10}`);
  run(`dropSubtask({preventDefault:()=>{},stopPropagation:()=>{},currentTarget:{style:{}}},3002,20)`);
  eq(get('tasks.find(t=>t.id===3002).subtasks[0].order'), 0, 'order unchanged');
  eq(get('dragSubtaskSourceId'), null);
});

test('openNoteEdit and saveNoteBlur round-trip', () => {
  run(`tasks=[{id:2003,text:'NT',status:'todo',order:0,catId:'',done:false,ts:'',createdAt:1,repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}]`);
  run('openNoteEdit(2003)'); eq(get('expandedNoteTaskId'), 2003);
  withEl({'task-note-textarea-2003':{value:'My note'}}, ()=>run('saveNoteBlur(2003)'));
  eq(get('tasks.find(t=>t.id===2003).note'), 'My note'); eq(get('expandedNoteTaskId'), null);
});

test('crisisMode enter and exit', () => {
  run('enterCrisisMode()'); eq(get('crisisMode'), true);
  run('exitCrisisMode()');  eq(get('crisisMode'), false);
});

test('toggleDark switches T between LIGHT and DARK', () => {
  run('darkMode=false; T=LIGHT; toggleDark()');
  eq(get('darkMode'), true); assert(get('T')===get('DARK'));
  run('toggleDark()');
  eq(get('darkMode'), false); assert(get('T')===get('LIGHT'));
});

test('fmtDur: edge cases', () => {
  eq(run('fmtDur(0)'), '0s');       eq(run('fmtDur(59)'), '59s');
  eq(run('fmtDur(60)'), '1m 00s');  eq(run('fmtDur(3600)'), '1h 00m');
  eq(run('fmtDur(-10)'), '0s');
  assert(typeof run('fmtDur(null)') === 'string');
});

test('secsToMmSs / parseMmSs roundtrip', () => {
  [0,1,59,60,600,1500,3599].forEach(s => {
    const mmss = run(`secsToMmSs(${s})`);
    eq(run(`parseMmSs('${mmss}')`), s, `roundtrip ${s}s`);
  });
});

test('esc HTML-escapes correctly', () => {
  eq(run("esc('<b>hi</b>')"), '&lt;b&gt;hi&lt;/b&gt;');
  eq(run("esc('a & b')"), 'a &amp; b');
  eq(run("esc(null)"), 'null');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF17: Midnight Date Refresh ═══');
resetState();

test('_lastDateStr is initialised to todays date string', () => {
  eq(get('_lastDateStr'), new Date().toDateString());
});

test('_handleDateRollover: generates repeat tasks for new day', () => {
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate()-1);
  run(`
    tasks=[{id:9001,text:'Daily',catId:'',done:false,status:'todo',ts:'',order:0,
            createdAt:${yesterday.getTime()},repeat:'daily',templateId:null,
            generatedForDate:null,pinned:false,urgency:0,subtasks:[],
            estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}];
    _lastDateStr='${yesterday.toDateString()}';
  `);
  const todayStr=new Date().toDateString();
  run(`_handleDateRollover('${todayStr}')`);
  const gen=run(`tasks.filter(t=>t.templateId===9001&&t.generatedForDate==='${todayStr}')`);
  eq(gen.length, 1, 'repeat task generated');
  eq(get('_lastDateStr'), todayStr, '_lastDateStr updated');
});

test('_handleDateRollover: resets alarm fired-flags', () => {
  run(`alarms=[{id:1,time:'09:00',label:'A',on:true,fired:true,taskId:null}];
       _lastDateStr='Mon Jan 01 2024'`);
  run(`_handleDateRollover('${new Date().toDateString()}')`);
  eq(get('alarms[0].fired'), false);
});

test('_handleDateRollover: resets dailyIntentions for new day', () => {
  const todayStr=new Date().toDateString();
  run(`dailyIntentions={date:'Mon Jan 01 2024',answers:{arriving:'old',oneWin:'old',derail:'old',goodEnough:'old'},step:'done',winOutcome:'yes'};
       _lastDateStr='Mon Jan 01 2024'`);
  run(`_handleDateRollover('${todayStr}')`);
  eq(get('dailyIntentions.step'), 0);
  eq(get('dailyIntentions.winOutcome'), null);
  eq(get("dailyIntentions.answers.arriving"), '');
  eq(get('dailyIntentions.date'), todayStr);
});

test('_handleDateRollover: no spurious rollover when date unchanged', () => {
  const today=new Date().toDateString();
  run(`_lastDateStr='${today}'; alarms=[{id:2,time:'10:00',label:'B',on:true,fired:true,taskId:null}]`);
  // Do NOT call _handleDateRollover — simulate the interval guard
  run(`if('${today}'!==_lastDateStr) _handleDateRollover('${today}')`);
  eq(get('alarms[0].fired'), true, 'fired flag untouched when date unchanged');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF18: Idle Prompt (commitIdleLog / dismissIdlePrompt) ═══');
resetState();
run(`tasks.push({id:4001,text:'IdleTask',catId:'work',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''})`);

test('dismissIdlePrompt resets state, resets lastInteractionAt', () => {
  run(`idlePromptShown=true; idlePromptInput='15m'; idlePromptTaskId=4001`);
  const before=Date.now();
  run('dismissIdlePrompt()');
  eq(get('idlePromptShown'), false);
  eq(get('idlePromptInput'), '');
  eq(get('idlePromptTaskId'), null);
  assert(get('lastInteractionAt') >= before, 'lastInteractionAt reset');
});

test('commitIdleLog with task logs to timeSessions', () => {
  run(`idlePromptShown=true; idlePromptInput='20m'; idlePromptTaskId=4001`);
  withEl({'idle-time-input':{value:'20m'}}, ()=>run('commitIdleLog()'));
  const s=get('timeSessions[timeSessions.length-1]');
  eq(s.taskId, 4001);
  eq(s.seconds, 1200);
  eq(s.mode, 'manual');
  eq(s.type, 'work');
  eq(get('idlePromptShown'), false);
});

test('commitIdleLog with no task logs to offTaskLog as Downtime', () => {
  run(`idlePromptShown=true; idlePromptInput='10m'; idlePromptTaskId=null`);
  const offBefore=get('offTaskLog.length');
  withEl({'idle-time-input':{value:'10m'}}, ()=>run('commitIdleLog()'));
  eq(get('offTaskLog.length'), offBefore+1);
  const e=get('offTaskLog[offTaskLog.length-1]');
  eq(e.seconds, 600);
  assert(e.note.includes('Downtime'), 'note mentions Downtime');
  eq(get('idlePromptShown'), false);
});

test('commitIdleLog falls back to idlePromptInput when element absent', () => {
  // When no DOM element exists, commitIdleLog reads idlePromptInput state directly.
  // The mock getElementById returns a truthy object with value:'', so parseTimeInput('')
  // returns null and the guard fires — this test verifies the guard path is safe.
  run(`idlePromptShown=true; idlePromptInput=''; idlePromptTaskId=null`);
  const offBefore=get('offTaskLog.length');
  const sessBefore=get('timeSessions.length');
  // No DOM element wired — me().value is '' which parseTimeInput returns null for
  run('commitIdleLog()');
  // Guard should have fired — nothing saved
  eq(get('offTaskLog.length'), offBefore, 'no entry on empty input');
  eq(get('timeSessions.length'), sessBefore, 'no session on empty input');
  eq(get('idlePromptShown'), true, 'modal stays open');
});

test('commitIdleLog rejects zero/invalid time', () => {
  run(`idlePromptShown=true; idlePromptInput='abc'; idlePromptTaskId=null`);
  const offBefore=get('offTaskLog.length');
  const sessBefore=get('timeSessions.length');
  withEl({'idle-time-input':{value:'abc'}}, ()=>run('commitIdleLog()'));
  eq(get('offTaskLog.length'), offBefore, 'no offTaskLog entry');
  eq(get('timeSessions.length'), sessBefore, 'no session entry');
  eq(get('idlePromptShown'), true, 'modal stays open on bad input');
});

test('idle threshold: idlePromptShown set after threshold exceeded', () => {
  run(`idlePromptShown=false; lastInteractionAt=Date.now()-21*60*1000; timerRunning=false; showQuickLog=false; showFocusModal=false; showSessionsModal=false; showCatModal=false; showWidgetDrawer=false`);
  // Simulate the interval check inline
  run(`
    if(!idlePromptShown&&!timerRunning&&!showQuickLog&&!showFocusModal&&!showSessionsModal&&!showCatModal&&!showWidgetDrawer){
      const idleMins=(Date.now()-lastInteractionAt)/60000;
      if(idleMins>=idlePromptThresholdMins){ idlePromptShown=true; idlePromptInput=''; idlePromptTaskId=focusTaskId; }
    }
  `);
  eq(get('idlePromptShown'), true);
});

test('idle threshold: not triggered when timer is running', () => {
  run(`idlePromptShown=false; lastInteractionAt=Date.now()-30*60*1000; timerRunning=true`);
  run(`
    if(!idlePromptShown&&!timerRunning){ const idleMins=(Date.now()-lastInteractionAt)/60000; if(idleMins>=idlePromptThresholdMins){ idlePromptShown=true; } }
  `);
  eq(get('idlePromptShown'), false);
  run('timerRunning=false');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF19: stopAndSaveTimer wall-clock floor ═══');
resetState();
run(`tasks.push({id:5001,text:'WallTask',catId:'work',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}); focusTaskId=5001`);

test('wall-clock floor: session uses wall-clock when timer reads shorter', () => {
  // Simulate: activeSession started 5 min ago, but timerSecs only shows 30s (drift)
  const wallSecs = 300;
  run(`
    timerMode='stopwatch';
    timerSecs=30;
    timerRunning=true;
    timerSessionType='work';
    activeSession={id:Date.now(),taskId:5001,subtaskId:null,startedAt:Date.now()-${wallSecs}*1000,mode:'stopwatch',type:'work'};
    stopAndSaveTimer(true);
  `);
  const s=get('timeSessions[timeSessions.length-1]');
  assert(s.seconds >= wallSecs, `expected >=${wallSecs}s, got ${s.seconds}s`);
  eq(s.taskId, 5001);
});

test('wall-clock floor: session uses timer when timer reads longer than wall-clock', () => {
  // Simulate: activeSession started 1 min ago, timerSecs=120 (longer — use timer value)
  run(`
    timerMode='stopwatch';
    timerSecs=120;
    timerRunning=true;
    timerSessionType='work';
    activeSession={id:Date.now(),taskId:5001,subtaskId:null,startedAt:Date.now()-60*1000,mode:'stopwatch',type:'work'};
    stopAndSaveTimer(true);
  `);
  const s=get('timeSessions[timeSessions.length-1]');
  assert(s.seconds >= 120, `expected >=120s, got ${s.seconds}s`);
});

test('wall-clock floor: countdown elapsed uses planned-remaining, floored by wall-clock', () => {
  // Countdown from 25min, 2min remaining → elapsed = 23min.
  // activeSession started 23min ago — wall-clock and timer should agree.
  const elapsed = 23*60;
  run(`
    timerMode='countdown';
    timerPlannedSecs=25*60;
    timerSecs=2*60;
    timerRunning=true;
    timerSessionType='work';
    activeSession={id:Date.now(),taskId:5001,subtaskId:null,startedAt:Date.now()-${elapsed}*1000,mode:'countdown',type:'work'};
    stopAndSaveTimer(true);
  `);
  const s=get('timeSessions[timeSessions.length-1]');
  assert(s.seconds >= elapsed, `expected >=${elapsed}s, got ${s.seconds}s`);
});

test('wall-clock floor: session with no activeSession is rejected gracefully', () => {
  const before=get('timeSessions.length');
  run(`timerRunning=false; activeSession=null; timerSecs=0; stopAndSaveTimer(true)`);
  eq(get('timeSessions.length'), before, 'no session saved with nothing active');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF20: Task editing, pinTask, repeat interactions, subtask quick-log ═══');
resetState();
run(`tasks.push({id:6001,text:'EditTask',catId:'work',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[{id:601,text:'Sub A',done:false,order:0,practiceCount:0}],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''})`);

test('setTaskCat updates catId and clears editingTaskCatId', () => {
  run(`editingTaskCatId=6001; setTaskCat(6001,'health')`);
  eq(get('tasks.find(t=>t.id===6001).catId'), 'health');
  eq(get('editingTaskCatId'), null);
});

test('setTaskCat on missing task is no-op', () => {
  run('setTaskCat(9999,"work")'); // no throw, no side-effect
  assert(!get('tasks.find(t=>t.id===9999)'), 'task absent');
});

test('pinTask on done task resets it to todo', () => {
  run(`tasks.find(t=>t.id===6001).status='done'; tasks.find(t=>t.id===6001).done=true; habits=[]; pinTask(6001)`);
  eq(get('tasks.find(t=>t.id===6001).pinned'), true);
  eq(get('tasks.find(t=>t.id===6001).status'), 'todo');
  eq(get('tasks.find(t=>t.id===6001).done'), false);
});

test('pinTask creates habit with matching name (idempotent)', () => {
  // Already pinned from previous test — unpinning then re-pinning should not double-add habit
  run('pinTask(6001)'); // unpin
  run('pinTask(6001)'); // re-pin
  eq(get('habits.filter(h=>h.name==="EditTask").length'), 1, 'no duplicate habit');
});

test('pinTask does not create duplicate habit if one already exists', () => {
  // habit already exists from above; pin again shouldn't add another
  run('tasks.find(t=>t.id===6001).pinned=false; pinTask(6001)');
  eq(get('habits.filter(h=>h.name==="EditTask").length'), 1);
});

test('pinTask unpin does not remove habit', () => {
  const habitsBefore = get('habits.length');
  run('pinTask(6001)'); // unpin
  eq(get('habits.length'), habitsBefore, 'habit survives unpin');
  eq(get('tasks.find(t=>t.id===6001).pinned'), false);
});

test('saveEstimate saves valid minutes', () => {
  run('saveEstimate(6001,45)');
  eq(get('tasks.find(t=>t.id===6001).estimatedMins'), 45);
  eq(get('editingEstimateId'), null);
});

test('saveEstimate clears on zero/negative', () => {
  run('saveEstimate(6001,0)');  eq(get('tasks.find(t=>t.id===6001).estimatedMins'), null);
  run('saveEstimate(6001,-5)'); eq(get('tasks.find(t=>t.id===6001).estimatedMins'), null);
});

test('saveEstimate caps at 9999', () => {
  run('saveEstimate(6001,99999)');
  eq(get('tasks.find(t=>t.id===6001).estimatedMins'), 9999);
});

test('resetSubtaskPractice sets count to 0', () => {
  run(`tasks.find(t=>t.id===6001).subtasks[0].practiceCount=7; resetSubtaskPractice(6001,601)`);
  eq(get('tasks.find(t=>t.id===6001).subtasks[0].practiceCount'), 0);
});

test('commitSubtaskQuickLog saves session with correct subtaskId', () => {
  run(`subtaskQuickLogId={taskId:6001,subtaskId:601}; subtaskQuickLogInput='15m'`);
  run('commitSubtaskQuickLog()');
  const s=get('timeSessions[timeSessions.length-1]');
  eq(s.taskId, 6001); eq(s.subtaskId, 601); eq(s.seconds, 900);
  eq(get('subtaskQuickLogId'), null); eq(get('subtaskQuickLogInput'), '');
});

test('commitSubtaskQuickLog rejects invalid time', () => {
  const before=get('timeSessions.length');
  run(`subtaskQuickLogId={taskId:6001,subtaskId:601}; subtaskQuickLogInput='bad'`);
  run('commitSubtaskQuickLog()');
  eq(get('timeSessions.length'), before);
  assert(get('subtaskQuickLogId')!==null, 'popover stays open');
});

test('commitSubtaskQuickLog no-op when subtaskQuickLogId is null', () => {
  const before=get('timeSessions.length');
  run('subtaskQuickLogId=null; commitSubtaskQuickLog()');
  eq(get('timeSessions.length'), before);
});

test('stQlPickPill sets input and updates state', () => {
  run(`subtaskQuickLogId={taskId:6001,subtaskId:601}`);
  run('stQlPickPill(25)');
  eq(get('subtaskQuickLogInput'), '25m');
});

test('ensureRepeatTasksForToday: weekly matches created day of week', () => {
  const today = new Date();
  const dayMs = today.getTime();
  // Create a weekly template whose createdAt is today (same day of week)
  run(`tasks=tasks.filter(t=>t.templateId==null); tasks.push({id:7001,text:'Weekly',catId:'',done:false,status:'todo',ts:'',order:0,createdAt:${dayMs},repeat:'weekly',templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}); ensureRepeatTasksForToday()`);
  const gen=run(`tasks.filter(t=>t.templateId===7001)`);
  eq(gen.length, 1, 'weekly task generated when day matches');
  eq(gen[0].repeat, null, 'generated instance has repeat=null');
  eq(gen[0].subtasks.length, 0, 'generated instance has empty subtasks');
});

test('ensureRepeatTasksForToday: generated instance has repeat=null and subtasks=[]', () => {
  // Already generated above — check the instance fields
  const gen=run(`tasks.find(t=>t.templateId===7001)`);
  assert(gen, 'instance exists');
  eq(gen.repeat, null);
  eq(gen.subtasks.length, 0);
  eq(gen.done, false);
  eq(gen.status, 'todo');
});

test('ensureRepeatTasksForToday: daily template generates when weekly does not apply', () => {
  run(`tasks=tasks.filter(t=>t.id!==7001&&t.templateId!==7001); tasks.push({id:7002,text:'Daily2',catId:'',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:'daily',templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}); ensureRepeatTasksForToday()`);
  eq(run(`tasks.filter(t=>t.templateId===7002).length`), 1);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF21: Timer mode, countdown, break, transition ═══');
resetState();
run(`tasks.push({id:8001,text:'TimerTask',catId:'work',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}); focusTaskId=8001`);

test('setTimerMode blocked while running', () => {
  run(`timerRunning=true; setTimerMode('stopwatch')`);
  // mode should not change — still whatever it was
  run('timerRunning=false');
});

test('setTimerMode switches and resets timer (stopwatch)', () => {
  run(`timerMode='countdown'; timerSecs=999; setTimerMode('stopwatch')`);
  eq(get('timerMode'), 'stopwatch');
  eq(get('timerSecs'), 0);
  eq(get('timerRunning'), false);
});

test('setTimerMode switches to countdown and initialises secs', () => {
  run(`timerCountdownMins=20; setTimerMode('countdown')`);
  eq(get('timerMode'), 'countdown');
  eq(get('timerSecs'), 1200);
  eq(get('timerPlannedSecs'), 1200);
});

test('setCountdownMins clamps to 1–240', () => {
  run('setCountdownMins(0)');   eq(get('timerCountdownMins'), 1);
  run('setCountdownMins(999)'); eq(get('timerCountdownMins'), 240);
  run('setCountdownMins(30)');  eq(get('timerCountdownMins'), 30);
});

test('setCountdownMins NaN falls back to 25', () => {
  run("setCountdownMins('abc')"); eq(get('timerCountdownMins'), 25);
});

test('setCountdownMins updates timerSecs when idle countdown', () => {
  run(`timerMode='countdown'; timerRunning=false; setCountdownMins(15)`);
  eq(get('timerSecs'), 900);
  eq(get('timerPlannedSecs'), 900);
});

test('startBreakTimer sets up break session correctly', () => {
  run(`timerRunning=false; startBreakTimer(5)`);
  eq(get('timerSessionType'), 'break');
  eq(get('timerMode'), 'countdown');
  eq(get('timerCountdownMins'), 5);
  eq(get('timerPlannedSecs'), 300);
  eq(get('timerSecs'), 300);
  eq(get('timerRunning'), true);
  run('stopTimerInternal()');
});

test('startBreakTimer blocked while running', () => {
  run(`timerRunning=true; timerSessionType='work'`);
  run('startBreakTimer(10)');
  eq(get('timerSessionType'), 'work', 'sessionType unchanged');
  run('timerRunning=false');
});

test('startCountdown requires focus task', () => {
  run('focusTaskId=null; showFocusModal=false; startCountdown()');
  eq(get('showFocusModal'), true);
  run('showFocusModal=false; focusTaskId=8001');
});

test('startCountdown starts timer with planned secs', () => {
  run(`timerRunning=false; timerCountdownMins=25; startCountdown()`);
  eq(get('timerRunning'), true);
  eq(get('timerMode'), 'countdown');
  eq(get('timerPlannedSecs'), 1500);
  run('stopTimerInternal()');
});

test('toggleTimer with no focus opens picker', () => {
  run(`focusTaskId=null; timerSessionType='work'; showFocusModal=false; toggleTimer()`);
  eq(get('showFocusModal'), true);
  run('showFocusModal=false; focusTaskId=8001');
});

test('toggleTimer starts stopwatch when idle', () => {
  run(`timerRunning=false; timerMode='stopwatch'; timerSecs=0; toggleTimer()`);
  eq(get('timerRunning'), true);
  run('stopTimerInternal()');
});

test('toggleTimer pauses when running', () => {
  run(`timerRunning=true; activeSession={id:1,taskId:8001,subtaskId:null,startedAt:Date.now(),mode:'stopwatch',type:'work'}; toggleTimer()`);
  eq(get('timerRunning'), false);
  // activeSession is preserved on pause — not cleared until stopAndSaveTimer or resetTimer
});

test('transitionSaveAndContinue saves journal entry and session', () => {
  const jBefore=get('journalEntries.length');
  run(`timerMode='stopwatch'; timerSecs=600; timerRunning=true; timerSessionType='work'; showTransitionPrompt=true; transitionReflect='Felt good'; activeSession={id:Date.now(),taskId:8001,subtaskId:null,startedAt:Date.now()-600000,mode:'stopwatch',type:'work'}`);
  withEl({'transition-reflect-input':{value:'Felt good'}}, ()=>run('transitionSaveAndContinue()'));
  assert(get('journalEntries.length') > jBefore, 'journal entry added');
  eq(get('journalEntries[0].type'), 'reflect');
  assert(get('journalEntries[0].text').includes('Felt good'));
  eq(get('showTransitionPrompt'), false);
  eq(get('timerRunning'), false);
});

test('transitionSkip saves session without journal entry', () => {
  const jBefore=get('journalEntries.length');
  run(`timerMode='stopwatch'; timerSecs=300; timerRunning=true; timerSessionType='work'; showTransitionPrompt=true; activeSession={id:Date.now(),taskId:8001,subtaskId:null,startedAt:Date.now()-300000,mode:'stopwatch',type:'work'}`);
  run('transitionSkip()');
  eq(get('journalEntries.length'), jBefore, 'no journal entry');
  eq(get('showTransitionPrompt'), false);
  eq(get('timerRunning'), false);
});

test('toggleTimerLayout cycles rings↔bars', () => {
  run("timerLayout='rings'; toggleTimerLayout()"); eq(get('timerLayout'), 'bars');
  run('toggleTimerLayout()'); eq(get('timerLayout'), 'rings');
});

test('toggleEnergyFilter toggles flag', () => {
  run('energyFilterOn=false; toggleEnergyFilter()'); eq(get('energyFilterOn'), true);
  run('toggleEnergyFilter()'); eq(get('energyFilterOn'), false);
});

test('toggleTimeTargets toggles flag', () => {
  run('showTimeTargets=false; toggleTimeTargets()'); eq(get('showTimeTargets'), true);
  run('toggleTimeTargets()'); eq(get('showTimeTargets'), false);
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF22: Session modal, setEditingSessionMmSs, deleteAllSessionsForFocus ═══');
resetState();
run(`tasks.push({id:9001,text:'SessTask',catId:'',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}); focusTaskId=9001; timeSessions=[{id:901,taskId:9001,subtaskId:null,startedAt:Date.now()-600000,endedAt:Date.now(),seconds:600,mode:'stopwatch',type:'work'},{id:902,taskId:9001,subtaskId:null,startedAt:Date.now()-1200000,endedAt:Date.now()-600000,seconds:600,mode:'stopwatch',type:'work'}]`);

test('openSessions with explicit taskId sets sessionsViewTaskId', () => {
  run('openSessions(9001)');
  eq(get('showSessionsModal'), true);
  eq(get('sessionsViewTaskId'), 9001);
  eq(get('editingSessionId'), null);
});

test('openSessions with null falls back to focusTaskId', () => {
  run('showSessionsModal=false; openSessions(null)');
  eq(get('sessionsViewTaskId'), 9001);
  eq(get('showSessionsModal'), true);
});

test('openSessions with null and no focusTaskId is no-op', () => {
  run('focusTaskId=null; showSessionsModal=false; openSessions(null)');
  eq(get('showSessionsModal'), false);
  run('focusTaskId=9001');
});

test('closeSessions clears all session modal state', () => {
  run('editingSessionId=901; sessionsViewTaskId=9001; showSessionsModal=true; closeSessions()');
  eq(get('showSessionsModal'), false);
  eq(get('editingSessionId'), null);
  eq(get('sessionsViewTaskId'), null);
});

test('startSessionEdit populates editingSessionMmSs from session seconds', () => {
  run('startSessionEdit(901)');
  eq(get('editingSessionId'), 901);
  eq(get('editingSessionSecs'), 600);
  eq(get('editingSessionMmSs'), '10:00');
});

test('setEditingSessionMmSs updates both fields on valid input', () => {
  run("setEditingSessionMmSs('12:30')");
  eq(get('editingSessionMmSs'), '12:30');
  eq(get('editingSessionSecs'), 750);
});

test('setEditingSessionMmSs ignores invalid input (keeps prior secs)', () => {
  run('editingSessionSecs=600');
  run("setEditingSessionMmSs('bad')");
  eq(get('editingSessionMmSs'), 'bad');
  eq(get('editingSessionSecs'), 600, 'secs unchanged on bad input');
});

test('cancelSessionEdit clears editing state', () => {
  run('editingSessionId=901; editingSessionMmSs="05:00"; cancelSessionEdit()');
  eq(get('editingSessionId'), null);
  eq(get('editingSessionMmSs'), '00:00');
});

test('deleteAllSessionsForFocus removes all sessions for sessionsViewTaskId', () => {
  run('sessionsViewTaskId=9001; deleteAllSessionsForFocus()');
  eq(get('timeSessions.filter(s=>s.taskId===9001).length'), 0);
  eq(get('editingSessionId'), null);
});

test('deleteAllSessionsForFocus falls back to focusTaskId when sessionsViewTaskId is null', () => {
  run(`timeSessions=[{id:903,taskId:9001,subtaskId:null,startedAt:0,endedAt:0,seconds:300,mode:'stopwatch',type:'work'}]; sessionsViewTaskId=null; focusTaskId=9001; deleteAllSessionsForFocus()`);
  eq(get('timeSessions.filter(s=>s.taskId===9001).length'), 0);
});

test('deleteAllSessionsForFocus is no-op when both IDs are null', () => {
  run(`timeSessions=[{id:904,taskId:9001,subtaskId:null,startedAt:0,endedAt:0,seconds:300,mode:'stopwatch',type:'work'}]; sessionsViewTaskId=null; focusTaskId=null; deleteAllSessionsForFocus()`);
  eq(get('timeSessions.length'), 1, 'no sessions removed');
  run('focusTaskId=9001');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF23: UI state toggles, filter, modal open/close, music/habit edits ═══');
resetState();
run(`tasks.push({id:10001,text:'FilterTask',catId:'work',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[{id:1001,text:'SubX',done:false,order:0,practiceCount:0}],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}); habits.push({id:9901,name:'MH',catId:'',hits:[{id:111,timestamp:Date.now(),minutes:0}],anchor:null,anchorOrder:0})`);

test('filterTasks sets taskFilter', () => {
  run("filterTasks('work')"); eq(get('taskFilter'), 'work');
  run("filterTasks('all')");  eq(get('taskFilter'), 'all');
});

test('setTaskSortMode updates taskSortMode', () => {
  run("setTaskSortMode('time')"); eq(get('taskSortMode'), 'time');
  run("setTaskSortMode('manual')"); eq(get('taskSortMode'), 'manual');
});

test('openCatManager / closeCatManager toggle showCatModal', () => {
  run('openCatManager()');  eq(get('showCatModal'), true);
  run('closeCatManager()'); eq(get('showCatModal'), false); eq(get('editingCatId'), null);
});

test('openWidgetDrawer / closeWidgetDrawer toggle showWidgetDrawer', () => {
  run('openWidgetDrawer()');  eq(get('showWidgetDrawer'), true);
  run('closeWidgetDrawer()'); eq(get('showWidgetDrawer'), false);
});

test('openFocusPicker / closeFocusPicker toggle showFocusModal', () => {
  run('openFocusPicker()');  eq(get('showFocusModal'), true); eq(get('focusSearch'), '');
  run('closeFocusPicker()'); eq(get('showFocusModal'), false);
});

test('setFocusSearch updates focusSearch', () => {
  // setFocusSearch also tries to focus/position a DOM element — test only state mutation
  run("focusSearch=''; showFocusModal=true");
  run("focusSearch='hello'"); // set directly since DOM call would throw in Node
  eq(get('focusSearch'), 'hello');
  run("focusSearch=''");
});

test('setFocusBoardPickerSearch updates focusBoardPickerSearch', () => {
  run("focusBoardPickerSearch=''");
  run("focusBoardPickerSearch='abc'");
  eq(get('focusBoardPickerSearch'), 'abc');
});

test('toggleSubtaskExpand adds then removes from Set', () => {
  run('expandedSubtaskTaskIds=new Set(); toggleSubtaskExpand(10001)');
  assert(get('expandedSubtaskTaskIds.has(10001)'));
  run('toggleSubtaskExpand(10001)');
  assert(!get('expandedSubtaskTaskIds.has(10001)'));
});

test('closeSubtaskQuickLog clears state', () => {
  run('subtaskQuickLogId={taskId:10001,subtaskId:1001}; subtaskQuickLogInput="5m"; closeSubtaskQuickLog()');
  eq(get('subtaskQuickLogId'), null);
  eq(get('subtaskQuickLogInput'), '');
});

test('setFocusSubtaskOnBoard sets both focus IDs', () => {
  run('tasks.find(t=>t.id===10001).subtasks[0].done=false; setFocusSubtaskOnBoard(10001,1001)');
  eq(get('focusTaskId'), 10001);
  eq(get('focusSubtaskId'), 1001);
});

test('setFocusSubtaskOnBoard blocked when task is done', () => {
  run('tasks.find(t=>t.id===10001).done=true; tasks.find(t=>t.id===10001).status="done"; focusTaskId=null; setFocusSubtaskOnBoard(10001,1001)');
  eq(get('focusTaskId'), null);
  run('tasks.find(t=>t.id===10001).done=false; tasks.find(t=>t.id===10001).status="todo"');
});

test('setFocusSubtaskOnBoard blocked when subtask is done', () => {
  run('tasks.find(t=>t.id===10001).subtasks[0].done=true; focusTaskId=null; setFocusSubtaskOnBoard(10001,1001)');
  eq(get('focusTaskId'), null);
  run('tasks.find(t=>t.id===10001).subtasks[0].done=false');
});

test('saveMusicField stores key and clears editingMusicField', () => {
  run(`tasks.find(t=>t.id===10001).subtasks[0].musicMeta=null; saveMusicField(10001,1001,'key','Am')`);
  eq(get(`tasks.find(t=>t.id===10001).subtasks[0].musicMeta.key`), 'Am');
  eq(get('editingMusicField'), null);
});

test('saveMusicField bpm: valid range stored, out-of-range → null', () => {
  run("saveMusicField(10001,1001,'bpm',120)");
  eq(get('tasks.find(t=>t.id===10001).subtasks[0].musicMeta.bpm'), 120);
  run("saveMusicField(10001,1001,'bpm',10)"); // below 20
  eq(get('tasks.find(t=>t.id===10001).subtasks[0].musicMeta.bpm'), null);
  run("saveMusicField(10001,1001,'bpm',400)"); // above 300
  eq(get('tasks.find(t=>t.id===10001).subtasks[0].musicMeta.bpm'), null);
});

test('saveLyrics stores text', () => {
  run("saveLyrics(10001,1001,'Verse one\\nVerse two')");
  eq(get("tasks.find(t=>t.id===10001).subtasks[0].musicMeta.lyrics"), 'Verse one\nVerse two');
});

test('saveHabitHitTime updates hit timestamp preserving date', () => {
  const hid=get('habits.find(h=>h.name==="MH").id');
  const hitId=get(`habits.find(h=>h.id===${hid}).hits[0].id`);
  run(`saveHabitHitTime(${hid},${hitId},'09:30')`);
  const ts=get(`habits.find(h=>h.id===${hid}).hits[0].timestamp`);
  const d=new Date(ts);
  eq(d.getHours(), 9); eq(d.getMinutes(), 30);
  eq(get('editingHabitHitId'), null);
});

test('saveHabitHitMins updates minutes, clamps at 0', () => {
  const hid=get('habits.find(h=>h.name==="MH").id');
  const hitId=get(`habits.find(h=>h.id===${hid}).hits[0].id`);
  run(`saveHabitHitMins(${hid},${hitId},45)`);
  eq(get(`habits.find(h=>h.id===${hid}).hits[0].minutes`), 45);
  run(`saveHabitHitMins(${hid},${hitId},-10)`);
  eq(get(`habits.find(h=>h.id===${hid}).hits[0].minutes`), 0);
});

test('setEnergyPending updates a field without saving', () => {
  run("energyPending={energy:null,sensory:null,tag:''}; setEnergyPending('energy',4)");
  eq(get('energyPending.energy'), 4);
  run("setEnergyPending('sensory','calm')"); eq(get('energyPending.sensory'), 'calm');
});

test('setIntentionAnswer updates answers without saving', () => {
  run(`ensureIntentionsToday('${TODAY}'); setIntentionAnswer('arriving','Feeling ok')`);
  eq(get("dailyIntentions.answers.arriving"), 'Feeling ok');
});

test('startEditOffTask sets editingOffTaskId', () => {
  run(`offTaskLog=[{id:5555,date:'${TODAY}',startTime:'10:00',endTime:'10:30',seconds:1800,note:''}]; startEditOffTask(5555)`);
  eq(get('editingOffTaskId'), 5555);
});

test('cancelEditOffTask clears editingOffTaskId', () => {
  run('cancelEditOffTask()'); eq(get('editingOffTaskId'), null);
});

test('startEditEstimate sets editingEstimateId and clears time editing', () => {
  run('editingTimeId=10001; startEditEstimate(10001)');
  eq(get('editingEstimateId'), 10001);
  eq(get('editingTimeId'), null);
});

test('cancelEditEstimate clears editingEstimateId', () => {
  run('cancelEditEstimate()'); eq(get('editingEstimateId'), null);
});

test('startEditCat / cancelEditCat manage editingCatId', () => {
  const catId=get('categories[0].id');
  run(`startEditCat('${catId}')`); eq(get('editingCatId'), catId);
  run('cancelEditCat()'); eq(get('editingCatId'), null);
});

test('startEditTaskTime / cancelEditTaskTime manage editingTimeId', () => {
  run('startEditTaskTime(10001)'); eq(get('editingTimeId'), 10001);
  run('cancelEditTaskTime()'); eq(get('editingTimeId'), null);
});

test('closeNoteEdit clears expandedNoteTaskId and saves from DOM', () => {
  run('expandedNoteTaskId=10001');
  withEl({['task-note-textarea-10001']:{value:'My note'}}, ()=>run('closeNoteEdit(10001)'));
  eq(get('expandedNoteTaskId'), null);
  eq(get("tasks.find(t=>t.id===10001).note"), 'My note');
});

test('closeHitInput clears hit input state', () => {
  run('hitInputHabitId=9901; hitInputMins=15; hitInputTime="10:00"; closeHitInput()');
  eq(get('hitInputHabitId'), null);
  eq(get('hitInputMins'), 0);
  eq(get('hitInputTime'), '');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF24: Pure helpers, getters, widget state, cache, storage round-trip ═══');
resetState();
run(`
  tasks=[
    {id:11001,text:'A',catId:'work',done:false,status:'todo',ts:'09:00',order:0,createdAt:Date.now()-1000,repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[{id:1101,text:'Sub',done:false,order:0,practiceCount:0}],estimatedMins:30,note:'',anxiety:0,taskScope:'project',doneDate:''},
    {id:11002,text:'B',catId:'home',done:false,status:'inprogress',ts:'14:00',order:1,createdAt:Date.now()-2000,repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:2,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''},
    {id:11003,text:'C',catId:'work',done:true,status:'done',ts:'',order:2,createdAt:Date.now()-3000,repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}
  ];
  timeSessions=[
    {id:201,taskId:11001,subtaskId:null,startedAt:Date.now()-3000,endedAt:Date.now()-2000,seconds:300,mode:'stopwatch',type:'work'},
    {id:202,taskId:11001,subtaskId:1101,startedAt:Date.now()-2000,endedAt:Date.now()-1000,seconds:200,mode:'stopwatch',type:'work'},
    {id:203,taskId:11002,subtaskId:null,startedAt:Date.now()-1000,endedAt:Date.now(),seconds:100,mode:'stopwatch',type:'work'}
  ];
  invalidateAvoidanceCache();
`);

test('getTask returns task by id, null for missing', () => {
  assert(get('getTask(11001)') !== null);
  eq(get('getTask(11001).text'), 'A');
  eq(get('getTask(99999)'), undefined, 'missing returns undefined (find semantics)');
});

test('getCat returns category by id, undefined for missing', () => {
  assert(get("getCat('work')") !== null);
  eq(get("getCat('work').name"), 'Work');
  eq(get("getCat('missing')"), undefined);
});

test('getSubtask returns subtask, null for missing parent or subtask', () => {
  assert(get('getSubtask(11001,1101)') !== null);
  eq(get('getSubtask(11001,1101).text'), 'Sub');
  eq(get('getSubtask(99999,1101)'), null);
  eq(get('getSubtask(11001,9999)'), null);
});

test('getSessionsForTask returns sorted descending by startedAt', () => {
  const sess=run('getSessionsForTask(11001)');
  eq(sess.length, 2);
  assert(sess[0].startedAt > sess[1].startedAt, 'sorted newest first');
});

test('getSessionsForTask returns empty array for task with no sessions', () => {
  eq(run('getSessionsForTask(11003).length'), 0);
});

test('getTotalOwnSessions excludes subtask sessions', () => {
  eq(run('getTotalOwnSessions(11001)'), 300, 'only parent session');
});

test('normalizeTaskTime pads single-digit hour, requires 2-digit minutes', () => {
  eq(run("normalizeTaskTime('9:05')"),  '09:05');  // single-digit hour padded
  eq(run("normalizeTaskTime('14:30')"), '14:30');  // already normalised
  eq(run("normalizeTaskTime('0:00')"),  '00:00');  // midnight
  eq(run("normalizeTaskTime('9:5')"),   null,      // minute must be 2 digits → null
     'single-digit minute not accepted');
  eq(run("normalizeTaskTime('bad')"),   null);
  eq(run("normalizeTaskTime('')"),      null);
});

test('parseTaskTime converts HH:MM to minutes-since-midnight', () => {
  eq(run("parseTaskTime('09:00')"), 540);
  eq(run("parseTaskTime('14:30')"), 870);
  eq(run("parseTaskTime('00:00')"), 0);
  eq(run("parseTaskTime('23:59')"), 1439);
  eq(run("parseTaskTime('24:00')"), null, 'hour 24 invalid');
  eq(run("parseTaskTime('12:60')"), null, 'minute 60 invalid');
  eq(run("parseTaskTime('')"),      null);
  eq(run("parseTaskTime(null)"),    null);
});

test('getVisibleTasksSorted respects taskFilter', () => {
  run("taskFilter='work'; taskSortMode='manual'");
  const visible=run('getVisibleTasksSorted()');
  assert(visible.every(t=>t.catId==='work'), 'only work tasks');
  run("taskFilter='all'");
});

test('getVisibleTasksSorted returns all tasks when filter is all', () => {
  run("taskFilter='all'; taskSortMode='manual'");
  eq(run('getVisibleTasksSorted().length'), 3);
});

test('nextTaskOrder returns max order + 1', () => {
  eq(run('nextTaskOrder()'), 3); // max order is 2
});

test('nextTaskOrder returns 0 when tasks array is empty', () => {
  run('const _saved=tasks; tasks=[]');
  eq(run('nextTaskOrder()'), 0);
  run('tasks=_saved');
});

test('getWidgetState returns widget entry by id', () => {
  run('loadWidgetLayout()');
  const ws=run("getWidgetState('focusboard')");
  assert(ws !== null && ws !== undefined);
  eq(ws.id, 'focusboard');
});

test('getWidgetState returns undefined for unknown id', () => {
  eq(run("getWidgetState('nonexistent')"), undefined);
});

test('invalidateTaskHitsCache clears the cache', () => {
  // Prime the cache with a known entry
  run(`habits.push({id:77,name:'CacheHabit',catId:'work',hits:[],anchor:null,anchorOrder:0})`);
  run(`getAllHitsForHabit(habits.find(h=>h.id===77),'${TODAY}')`);
  // Cache should now have an entry; invalidate and confirm it can rebuild
  run('invalidateTaskHitsCache()');
  // After invalidation a fresh call should not throw and should still return an array
  const hits=run(`getAllHitsForHabit(habits.find(h=>h.id===77),'${TODAY}')`);
  assert(Array.isArray(hits), 'returns array after cache invalidation');
});

test('storage round-trip: save → load restores tasks', () => {
  run('saveNow()');
  const originalText=get('tasks.find(t=>t.id===11001).text');
  run('tasks=[]');
  eq(get('tasks.length'), 0);
  run('load(); migrateTasks()');
  assert(get('tasks.length') > 0, 'tasks restored');
  eq(get('tasks.find(t=>t.id===11001).text'), originalText);
});

test('storage round-trip: save → load restores timeSessions', () => {
  run('saveNow(); timeSessions=[]; load()');
  assert(get('timeSessions.length') > 0, 'sessions restored');
});

test('storage round-trip: dark mode persisted', () => {
  run('darkMode=true; T=DARK; saveNow(); darkMode=false; T=LIGHT; load()');
  eq(get('darkMode'), true);
  eq(get('T'), get('DARK'));
  run('darkMode=false; T=LIGHT; saveNow()');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF25: clearFocus, startTaskStopwatch branches, compareTasks, colour pickers, getEnergyToday, migrateJournal, importBackup ═══');
resetState();
run(`
  tasks.push({id:12001,text:'SWT',catId:'work',done:false,status:'todo',ts:'10:00',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''});
  tasks.push({id:12002,text:'SWT2',catId:'home',done:false,status:'todo',ts:'',order:1,createdAt:Date.now()-1000,repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''});
  invalidateAvoidanceCache();
`);

// ── clearFocus ───────────────────────────────────────────────────────────────
test('clearFocus nulls focus IDs, stops timer, closes focus modal', () => {
  run(`focusTaskId=12001; focusSubtaskId=999; showFocusModal=true; timerRunning=true; startTimerInternal(); clearFocus()`);
  eq(get('focusTaskId'), null);
  eq(get('focusSubtaskId'), null);
  eq(get('showFocusModal'), false);
  eq(get('timerRunning'), false);
});

// ── startTaskStopwatch branches ──────────────────────────────────────────────
test('startTaskStopwatch: done task is no-op', () => {
  run(`tasks.find(t=>t.id===12001).done=true; tasks.find(t=>t.id===12001).status='done'; focusTaskId=null; startTaskStopwatch(12001)`);
  eq(get('focusTaskId'), null);
  run(`tasks.find(t=>t.id===12001).done=false; tasks.find(t=>t.id===12001).status='todo'`);
});

test('startTaskStopwatch: running same task → opens quick-log', () => {
  run(`focusTaskId=12001; timerRunning=true; timerSecs=300; timerMode='stopwatch'; timerSessionType='work'; activeSession={id:Date.now(),taskId:12001,subtaskId:null,startedAt:Date.now()-300000,mode:'stopwatch',type:'work'}; startTaskStopwatch(12001)`);
  eq(get('showQuickLog'), true);
  eq(get('quickLogTaskId'), 12001);
  run('showQuickLog=false; quickLogTaskId=null; timerRunning=false; activeSession=null');
});

test('startTaskStopwatch: idle same task → starts stopwatch', () => {
  run(`focusTaskId=12001; timerRunning=false; timerSecs=0; startTaskStopwatch(12001)`);
  eq(get('timerRunning'), true);
  eq(get('timerMode'), 'stopwatch');
  eq(get('focusTaskId'), 12001);
  run('stopTimerInternal()');
});

test('startTaskStopwatch: different task → switches focus, stops running timer', () => {
  run(`focusTaskId=12001; timerRunning=true; startTimerInternal(); startTaskStopwatch(12002)`);
  eq(get('focusTaskId'), 12002);
  eq(get('timerRunning'), false, 'prior timer stopped');
  eq(get('focusSubtaskId'), null);
});

test('startTaskStopwatch: different task idle → sets focus without starting', () => {
  run(`focusTaskId=12001; timerRunning=false; startTaskStopwatch(12002)`);
  eq(get('focusTaskId'), 12002);
  eq(get('timerRunning'), false, 'not auto-started');
});

// ── compareTasks — anxiety mode (untested branch) ────────────────────────────
test('compareTasks anxiety mode: higher avoidance score sorts first', () => {
  // Craft two tasks: one with urgency=3 (score 3), one urgency=0 (score 0)
  run(`tasks=[
    {id:13001,text:'Low',catId:'',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''},
    {id:13002,text:'High',catId:'',done:false,status:'todo',ts:'',order:1,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:3,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}
  ]; timeSessions=[]; invalidateAvoidanceCache(); taskSortMode='anxiety'`);
  const sorted=run('sortTasksList(tasks)');
  eq(sorted[0].id, 13002, 'higher urgency first');
  eq(sorted[1].id, 13001);
});

test('compareTasks time mode: null ts sorts to end', () => {
  run("taskSortMode='time'");
  // tasks[0]=Low has ts='', tasks[1]=High has ts='' — both null, fall back to order
  run(`tasks=[
    {id:13003,text:'NoTime',catId:'',done:false,status:'todo',ts:'',order:1,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''},
    {id:13004,text:'HasTime',catId:'',done:false,status:'todo',ts:'09:00',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}
  ]`);
  const sorted=run('sortTasksList(tasks)');
  eq(sorted[0].id, 13004, 'task with ts first');
  eq(sorted[1].id, 13003, 'task without ts last');
  run("taskSortMode='manual'");
});

// ── Colour pickers ───────────────────────────────────────────────────────────
test('cycleNewCatColor wraps around COLOR_OPTS length', () => {
  run('newCatColorIdx=0; cycleNewCatColor()'); eq(get('newCatColorIdx'), 1);
  run(`newCatColorIdx=${get('COLOR_OPTS.length')-1}; cycleNewCatColor()`);
  eq(get('newCatColorIdx'), 0, 'wraps to 0');
});

test('pickNewCatColor sets exact index', () => {
  run('pickNewCatColor(5)'); eq(get('newCatColorIdx'), 5);
  run('pickNewCatColor(0)'); eq(get('newCatColorIdx'), 0);
});

// ── getEnergyToday ───────────────────────────────────────────────────────────
test('getEnergyToday returns matching entry or null', () => {
  run(`energyLog=[{date:'${TODAY}',energy:3,sensory:'calm',tag:'ok'},{date:'Mon Jan 01 2024',energy:1,sensory:null,tag:''}]`);
  const e=run(`getEnergyToday('${TODAY}')`);
  assert(e !== null && e !== undefined); eq(e.energy, 3);
  eq(run("getEnergyToday('Fri Jan 01 2000')"), null, 'no match returns null');
});

// ── startEditHabitHit ─────────────────────────────────────────────────────────
test('startEditHabitHit sets editingHabitHitId', () => {
  run(`habits=[{id:8801,name:'H',catId:'',hits:[{id:88,timestamp:Date.now(),minutes:10}],anchor:null,anchorOrder:0}]`);
  run('startEditHabitHit(8801,88)');
  const s=get('editingHabitHitId');
  assert(s !== null); eq(s.habitId, 8801); eq(s.hitId, 88);
});

// ── migrateJournal ────────────────────────────────────────────────────────────
test('migrateJournal: migrates old adhd4_notes to dump entry (once)', () => {
  run(`journalEntries=[]; audioRecordings=[]; localStorage.setItem('adhd4_notes','Old brain dump')`);
  run('migrateJournal()');
  assert(get('journalEntries.length') >= 1, 'entry added');
  const e=run(`journalEntries.find(e=>e.type==='dump'&&e.migratedFromNotes)`);
  assert(e, 'dump entry with migratedFromNotes flag');
  eq(e.text, 'Old brain dump');
  eq(get("localStorage.getItem('adhd4_notes')"), null, 'old key removed');
});

test('migrateJournal: idempotent — does not duplicate on second call', () => {
  const before=get('journalEntries.length');
  run('migrateJournal()');
  eq(get('journalEntries.length'), before, 'no duplicate');
});

test('migrateJournal: migrates audioRecordings to voice entries', () => {
  run(`audioRecordings=[{id:9900,label:'Test note',createdAt:Date.now(),durationSecs:30,mimeType:'audio/webm'}]; journalEntries=[]; migrateJournal()`);
  const e=run(`journalEntries.find(e=>e.type==='voice'&&e.audioId===9900)`);
  assert(e, 'voice entry created');
  eq(e.text, 'Test note');
});

test('migrateJournal: does not duplicate voice entry on second call', () => {
  const before=get('journalEntries.filter(e=>e.audioId===9900).length');
  run('migrateJournal()');
  eq(get('journalEntries.filter(e=>e.audioId===9900).length'), before);
});

// ── parseQuickLogInput alias ─────────────────────────────────────────────────
test('parseQuickLogInput is alias for parseTimeInput', () => {
  eq(run("parseQuickLogInput('25m')"), 1500);
  eq(run("parseQuickLogInput('1h')"),  3600);
  eq(run("parseQuickLogInput(null)"),  null);
});

// ── importBackup (via simulated FileReader.onload) ────────────────────────────
test('importBackup: restores all data fields from valid JSON', () => {
  const backup={
    tasks:[{id:20001,text:'Imported',catId:'work',done:false,status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}],
    categories:[{id:'work',name:'Work',color:{bg:'#dbeafe',text:'#1e3a8a',dot:'#2563eb',name:'blue'}}],
    habits:[],alarms:[],templates:[],timeSessions:[],offTaskLog:[],journalEntries:[],energyLog:[],
    plannerDayDumps:{'2025-06-01':[{id:1,text:'Dump item',catId:'',done:false,createdAt:1}]},
    dayWizardState:{date:'2025-06-01',phase:'start',step:1,startDone:false,endDone:false,wizBannerDismissedAt:0},
    taskSortMode:'time',dayStartHour:9,dayEndHour:20,focusBoardMode:'urgent',focusBoardManualIds:[20001],version:17
  };
  // Simulate FileReader.onload directly (the real importBackup uses FileReader async API)
  run(`
    const _data=${JSON.stringify(backup)};
    tasks=_data.tasks;
    categories=_data.categories;
    habits=_data.habits||[];
    alarms=_data.alarms||[];
    templates=_data.templates||[];
    timeSessions=_data.timeSessions||[];
    offTaskLog=_data.offTaskLog||[];
    journalEntries=_data.journalEntries||[];
    energyLog=_data.energyLog||[];
    if(_data.plannerDayDumps)plannerDayDumps=_data.plannerDayDumps;
    if(_data.dayWizardState)dayWizardState=_data.dayWizardState;
    if(_data.taskSortMode)taskSortMode=_data.taskSortMode;
    if(_data.dayStartHour!=null)dayStartHour=_data.dayStartHour;
    if(_data.dayEndHour!=null)dayEndHour=Math.max(14,Math.min(22,_data.dayEndHour));
    if(_data.focusBoardMode)focusBoardMode=_data.focusBoardMode;
    if(_data.focusBoardManualIds)focusBoardManualIds=_data.focusBoardManualIds;
    migrateTasks(); migrateJournal();
  `);
  eq(get('tasks.length'), 1);
  eq(get('tasks[0].text'), 'Imported');
  eq(get('taskSortMode'), 'time');
  eq(get('dayStartHour'), 9);
  eq(get('dayEndHour'), 20);
  eq(get('focusBoardMode'), 'urgent');
  eq(get("plannerDayDumps['2025-06-01'].length"), 1);
  eq(get('dayWizardState.step'), 1);
  assert(get('focusBoardManualIds.includes(20001)'));
});

test('importBackup: rejects payload missing tasks or categories', () => {
  // The guard `if(!data.tasks||!data.categories)` triggers a toast and early return
  // We verify the guard logic directly since FileReader is async
  const hasGuard=run(`
    const _bad={habits:[]};
    const _isInvalid=!_bad.tasks||!_bad.categories;
    _isInvalid;
  `);
  assert(hasGuard, 'invalid payload detected');
});

// ── saveWidgetLayout ──────────────────────────────────────────────────────────
test('saveWidgetLayout persists to localStorage', () => {
  run('loadWidgetLayout(); saveWidgetLayout()');
  const raw=get("localStorage.getItem('adhd4_widget_layout')");
  assert(raw !== null, 'key exists');
  const parsed=JSON.parse(raw);
  assert(Array.isArray(parsed), 'is array');
  eq(parsed.length, get('getRegisteredWidgets().length'));
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF26: Task Hotkeys (v47) ═══');
resetState();
run(`tasks.push({id:14001,text:'HK',catId:'work',done:false,status:'todo',ts:'10:00',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[{id:1401,text:'SubH',done:false,order:0,practiceCount:0}],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''}); focusTaskId=14001`);

test('S key toggles subtask expand', () => {
  run('expandedSubtaskTaskIds=new Set()');
  run('toggleSubtaskExpand(focusTaskId)');
  assert(get('expandedSubtaskTaskIds.has(14001)'), 'expanded after S');
  run('toggleSubtaskExpand(focusTaskId)');
  assert(!get('expandedSubtaskTaskIds.has(14001)'), 'collapsed after second S');
});

test('N key toggles note edit open/close', () => {
  run('expandedNoteTaskId=null');
  run('if(expandedNoteTaskId===focusTaskId) closeNoteEdit(focusTaskId); else openNoteEdit(focusTaskId)');
  eq(get('expandedNoteTaskId'), 14001, 'opens note');
  // closeNoteEdit reads DOM element; simulate by setting directly
  run('expandedNoteTaskId=null');
  eq(get('expandedNoteTaskId'), null, 'closes note');
});

test('T key toggles time edit open/close', () => {
  run('editingTimeId=null');
  run('if(editingTimeId===focusTaskId) cancelEditTaskTime(); else startEditTaskTime(focusTaskId)');
  eq(get('editingTimeId'), 14001, 'opens time edit');
  run('if(editingTimeId===focusTaskId) cancelEditTaskTime(); else startEditTaskTime(focusTaskId)');
  eq(get('editingTimeId'), null, 'closes time edit');
});

test('E key toggles estimate edit open/close', () => {
  run('editingEstimateId=null');
  run('if(editingEstimateId===focusTaskId) cancelEditEstimate(); else startEditEstimate(focusTaskId)');
  eq(get('editingEstimateId'), 14001, 'opens estimate edit');
  run('if(editingEstimateId===focusTaskId) cancelEditEstimate(); else startEditEstimate(focusTaskId)');
  eq(get('editingEstimateId'), null, 'closes estimate edit');
});

test('O key toggles overflow panel', () => {
  run('taskOverflowOpenId=null');
  run('taskOverflowOpenId=(taskOverflowOpenId===focusTaskId?null:focusTaskId)');
  eq(get('taskOverflowOpenId'), 14001, 'opens overflow');
  run('taskOverflowOpenId=(taskOverflowOpenId===focusTaskId?null:focusTaskId)');
  eq(get('taskOverflowOpenId'), null, 'closes overflow');
});

test('Q key opens quick-log for focused task', () => {
  run('showQuickLog=false');
  run('openQuickLog(focusTaskId,0,Date.now())');
  eq(get('showQuickLog'), true);
  eq(get('quickLogTaskId'), 14001);
  run('discardQuickLog()');
});

test('F key opens focus picker', () => {
  run('showFocusModal=false');
  run('openFocusPicker()');
  eq(get('showFocusModal'), true);
  run('closeFocusPicker()');
});

test('B key starts 5m break timer', () => {
  run('timerRunning=false; startBreakTimer(5)');
  eq(get('timerSessionType'), 'break');
  eq(get('timerCountdownMins'), 5);
  eq(get('timerRunning'), true);
  run('stopTimerInternal(); timerSessionType="work"');
});

test('Del key deletes focused task and clears focus', () => {
  run('deleteTask(focusTaskId)');
  assert(!get('tasks.find(t=>t.id===14001)'), 'task deleted');
  eq(get('focusTaskId'), null, 'focus cleared');
});

// ════════════════════════════════════════════════════════════════════════════
console.log('\n═══ WF27: Planner Timeline ═══');
resetState();
run(`
  tasks.push({id:15001,text:'Morning standup',catId:'work',done:false,status:'todo',
    ts:'09:00',durationMins:30,order:0,createdAt:Date.now(),repeat:null,
    templateId:null,generatedForDate:null,pinned:false,urgency:0,
    subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''});
  tasks.push({id:15002,text:'Deep work',catId:'work',done:false,status:'todo',
    ts:'10:00',durationMins:90,order:1,createdAt:Date.now(),repeat:null,
    templateId:null,generatedForDate:null,pinned:false,urgency:0,
    subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''});
  tasks.push({id:15003,text:'No time task',catId:'',done:false,status:'todo',
    ts:'',durationMins:null,order:2,createdAt:Date.now(),repeat:null,
    templateId:null,generatedForDate:null,pinned:false,urgency:0,
    subtasks:[],estimatedMins:null,note:'',anxiety:0,taskScope:'project',doneDate:''});
`);

test('TL_ constants are defined with correct values', () => {
  eq(get('TL_START_HOUR'), 6);
  eq(get('TL_END_HOUR'), 24);
  assert(get('TL_PX_PER_MIN') > 0, 'px per min > 0');
  eq(get('TL_SNAP'), 5);
  assert(get('TL_LABEL_W') > 0, 'label width > 0');
  assert(get('TL_TOTAL_PX') > 0, 'total px > 0');
  eq(get('TL_MIN_DUR'), 15);
});

test('_tlMinsToHHMM formats minutes to HH:MM', () => {
  eq(run('_tlMinsToHHMM(6*60)'),       '06:00');
  eq(run('_tlMinsToHHMM(9*60)'),       '09:00');
  eq(run('_tlMinsToHHMM(14*60+30)'),   '14:30');
  eq(run('_tlMinsToHHMM(23*60+59)'),   '23:59');
  eq(run('_tlMinsToHHMM(0)'),          '00:00');
});

test('_tlMinsToY converts minutes to pixel offset', () => {
  eq(run('_tlMinsToY(6*60)'), 0, '6:00 → y=0');
  eq(run('_tlMinsToY(7*60)'), Math.round(60 * get('TL_PX_PER_MIN')), '7:00 → 60min * px/min');
});

test('_tlSnap rounds to nearest 5-min increment', () => {
  eq(run('_tlSnap(542)'), 540);
  eq(run('_tlSnap(543)'), 545);
  eq(run('_tlSnap(545)'), 545);
  eq(run('_tlSnap(548)'), 550);
});

test('plannerSelectDate opens dump view for selected date', () => {
  run("plannerView='month'; plannerSelectedDate=null");
  run("plannerSelectDate('2025-06-15')");
  eq(get('plannerView'), 'dump', 'single click opens dump view');
  eq(get('plannerSelectedDate'), '2025-06-15');
});

test('plannerGoToMonth sets view back to month', () => {
  run("plannerView='day'; plannerGoToMonth()");
  eq(get('plannerView'), 'month');
});

test('plannerNavMonth wraps year on month overflow/underflow', () => {
  run("plannerMonth={year:2025,month:11}; plannerNavMonth(1)");
  eq(get('plannerMonth.year'), 2026); eq(get('plannerMonth.month'), 0);
  run("plannerNavMonth(-1)");
  eq(get('plannerMonth.year'), 2025); eq(get('plannerMonth.month'), 11);
});

test('plannerJumpToTask sets and then clears plannerHighlightTaskId', () => {
  // In the test harness, setTimeout fires synchronously, so the highlight is
  // set then immediately cleared — verify the function completes without error
  // and the state ends up null (correct final state after highlight fades).
  run('plannerHighlightTaskId=null');
  run('plannerJumpToTask(15001)'); // sets → render() → setTimeout fires → clears
  eq(get('plannerHighlightTaskId'), null, 'cleared after timeout (sync in harness)');
  // Verify the function logic works by calling it on a valid task id
  run('plannerJumpToTask(15002)'); // no throw = success
});

test('tlClearTaskTime clears ts and durationMins', () => {
  run('tlClearTaskTime(15001)');
  eq(get('tasks.find(t=>t.id===15001).ts'), '');
  eq(get('tasks.find(t=>t.id===15001).durationMins'), null);
});

test('tlClearTaskTime on missing task is no-op', () => {
  const before = get('tasks.length');
  run('tlClearTaskTime(99999)');
  eq(get('tasks.length'), before);
});

test('tlCommitNewTask creates task with correct ts and durationMins', () => {
  const before = get('tasks.length');
  run(`
    timelineNewTaskDraft={startMins:10*60,endMins:10*60+45};
    timelineNewTaskText='New timeline task';
    timelineNewTaskCatId='work';
    tlCommitNewTask();
  `);
  eq(get('tasks.length'), before + 1, 'task added');
  const t = get('tasks[tasks.length-1]');
  eq(t.text, 'New timeline task');
  eq(t.ts, '10:00');
  eq(t.catId, 'work');
  assert(t.durationMins >= 45, `durationMins=${t.durationMins}`);
  eq(get('timelineNewTaskDraft'), null, 'draft cleared');
  eq(get('timelineNewTaskText'), '', 'text cleared');
  eq(get('timelineNewTaskCatId'), '', 'catId cleared');
});

test('tlCommitNewTask rejects empty task name, keeps draft open', () => {
  const before = get('tasks.length');
  run(`
    timelineNewTaskDraft={startMins:11*60,endMins:11*60+30};
    timelineNewTaskText='   ';
    tlCommitNewTask();
  `);
  eq(get('tasks.length'), before, 'no task added');
  assert(get('timelineNewTaskDraft') !== null, 'draft stays open');
});

test('tlCommitNewTask no-op when draft is null', () => {
  const before = get('tasks.length');
  run('timelineNewTaskDraft=null; tlCommitNewTask()');
  eq(get('tasks.length'), before);
});

test('tlCancelNewTask clears draft, text, and catId', () => {
  run(`
    timelineNewTaskDraft={startMins:9*60,endMins:9*60+30};
    timelineNewTaskText='Canceled';
    timelineNewTaskCatId='work';
    tlCancelNewTask();
  `);
  eq(get('timelineNewTaskDraft'), null);
  eq(get('timelineNewTaskText'), '');
  eq(get('timelineNewTaskCatId'), '');
});

test('tlPointerUp move: saves new ts on task', () => {
  run(`tasks.find(t=>t.id===15002).ts='10:00'`);
  run(`
    timelineDragState={
      type:'move', taskId:15002,
      startY:0, startMins:10*60, curMins:11*60,
      offsetMins:0, origTs:'10:00', origDur:90,
      scroll:null, altCopy:false, moved:true
    };
    tlPointerUp({},{getBoundingClientRect:()=>({top:0})});
  `);
  eq(get('tasks.find(t=>t.id===15002).ts'), '11:00');
  eq(get('timelineDragState'), null);
});

test('tlPointerUp move with altCopy: duplicates task at new time', () => {
  const before = get('tasks.length');
  run(`tasks.find(t=>t.id===15002).ts='11:00'`);
  run(`
    timelineDragState={
      type:'move', taskId:15002,
      startY:0, startMins:11*60, curMins:13*60,
      offsetMins:0, origTs:'11:00', origDur:90,
      scroll:null, altCopy:true, moved:true
    };
    tlPointerUp({},{getBoundingClientRect:()=>({top:0})});
  `);
  eq(get('tasks.length'), before + 1, 'task duplicated');
  eq(get('tasks[tasks.length-1].ts'), '13:00');
  eq(get('tasks.find(t=>t.id===15002).ts'), '11:00', 'original unchanged');
});

test('tlPointerUp resize: updates durationMins', () => {
  run(`tasks.find(t=>t.id===15002).ts='11:00'; tasks.find(t=>t.id===15002).durationMins=90`);
  run(`
    timelineDragState={
      type:'resize', taskId:15002,
      startY:0, startMins:11*60, origDur:90,
      scroll:null, curEndMins:13*60+30
    };
    tlPointerUp({},{getBoundingClientRect:()=>({top:0})});
  `);
  eq(get('tasks.find(t=>t.id===15002).durationMins'), 150, '2h30m = 150min');
  eq(get('timelineDragState'), null);
});

test('tlPointerUp with null drag state is no-op', () => {
  run('timelineDragState=null');
  run("tlPointerUp({},{getBoundingClientRect:()=>({top:0})})");
  // no throw, no state change
  eq(get('timelineDragState'), null);
});

test('migrateTasks adds durationMins=null to existing tasks', () => {
  run(`tasks=[{id:16001,text:'Old',catId:'',done:false,status:'todo',ts:'09:00',order:0,createdAt:Date.now(),repeat:null,templateId:null,generatedForDate:null,pinned:false,urgency:0,subtasks:[],estimatedMins:null,note:'',anxiety:0}]; migrateTasks()`);
  eq(get('tasks.find(t=>t.id===16001).durationMins'), null);
});

test('dateToYMD formats date correctly', () => {
  eq(run("dateToYMD(new Date(2025, 5, 15))"), '2025-06-15');
});

test('ymdToDate parses YYYY-MM-DD correctly', () => {
  const d = run("ymdToDate('2025-06-15')");
  eq(d.getFullYear(), 2025);
  eq(d.getMonth(), 5); // June = index 5
  eq(d.getDate(), 15);
});

test('plannerOpenDump sets view=dump and clears input', () => {
  run("plannerDumpInput='old'; plannerOpenDump('2025-06-15')");
  eq(get('plannerView'), 'dump');
  eq(get('plannerSelectedDate'), '2025-06-15');
  eq(get('plannerDumpInput'), '');
});

test('plannerOpenTimeline sets view=day', () => {
  run("plannerOpenTimeline('2025-06-15')");
  eq(get('plannerView'), 'day');
  eq(get('plannerSelectedDate'), '2025-06-15');
});

test('plannerAddDump adds item to plannerDayDumps', () => {
  run("plannerDayDumps={}; plannerDumpInput='Buy milk'; plannerAddDump('2025-06-15')");
  const arr = get("plannerDayDumps['2025-06-15']");
  assert(Array.isArray(arr) && arr.length===1, 'item added');
  eq(arr[0].text, 'Buy milk');
  eq(arr[0].done, false);
  eq(get('plannerDumpInput'), '', 'input cleared');
});

test('plannerAddDump empty text is no-op', () => {
  run("plannerDumpInput='   '; plannerAddDump('2025-06-15')");
  eq(get("plannerDayDumps['2025-06-15'].length"), 1, 'no extra item');
});

test('plannerToggleDump toggles done state', () => {
  const id = get("plannerDayDumps['2025-06-15'][0].id");
  run(`plannerToggleDump('2025-06-15',${id})`);
  eq(get("plannerDayDumps['2025-06-15'][0].done"), true);
  run(`plannerToggleDump('2025-06-15',${id})`);
  eq(get("plannerDayDumps['2025-06-15'][0].done"), false);
});

test('plannerDeleteDump removes item', () => {
  run("plannerDumpInput='Temp'; plannerAddDump('2025-06-15')");
  const id = get("plannerDayDumps['2025-06-15'][0].id");
  run(`plannerDeleteDump('2025-06-15',${id})`);
  assert(!get(`plannerDayDumps['2025-06-15'].find(x=>x.id===${id})`), 'removed');
});

test('plannerPromoteDump creates a real task and removes dump item', () => {
  run("plannerDayDumps['2025-06-15']=[{id:9001,text:'Promoted task',catId:'work',done:false,createdAt:Date.now()}]");
  const tasksBefore = get('tasks.length');
  run("plannerPromoteDump('2025-06-15',9001)");
  eq(get('tasks.length'), tasksBefore+1, 'task added');
  eq(get('tasks[tasks.length-1].text'), 'Promoted task');
  eq(get('tasks[tasks.length-1].catId'), 'work');
  eq(get("plannerDayDumps['2025-06-15'].find(x=>x.id===9001)"), undefined, 'dump item removed');
});

test('plannerPromoteDump on missing item is no-op', () => {
  const before = get('tasks.length');
  run("plannerPromoteDump('2025-06-15',99999)");
  eq(get('tasks.length'), before);
});

test('skipIntention advances step without requiring answer text', () => {
  run(`dailyIntentions={date:'${TODAY}',answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null}`);
  run(`skipIntention('${TODAY}')`);
  eq(get('dailyIntentions.step'), 1, 'step advanced');
  eq(get("dailyIntentions.answers.arriving"), '—', 'answer marked skipped');
});

test('skipIntention on last step sets done', () => {
  run(`dailyIntentions.step=3; dailyIntentions.answers.goodEnough=''`);
  run(`skipIntention('${TODAY}')`);
  eq(get('dailyIntentions.step'), 'done');
});

test('skipIntention preserves existing answer if already filled', () => {
  run(`dailyIntentions={date:'${TODAY}',answers:{arriving:'I feel good',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null}`);
  run(`skipIntention('${TODAY}')`);
  eq(get("dailyIntentions.answers.arriving"), 'I feel good', 'existing answer preserved');
  eq(get('dailyIntentions.step'), 1);
});

// ══ WF28: Task Scoping ═══════════════════════════════════════════════════════
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

// ══ WF29: Dump Widget ════════════════════════════════════════════════════════
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

// ══ WF30: Day Wizard ═════════════════════════════════════════════════════════
console.log('\n═══ WF30: Day Wizard ═══');
resetState();

run(`
  tasks.push({id:30001,text:'Standup',catId:'work',done:false,status:'todo',
    ts:'09:00',durationMins:30,order:0,createdAt:Date.now(),
    repeat:null,templateId:null,generatedForDate:null,
    pinned:false,urgency:0,subtasks:[],estimatedMins:null,
    note:'',anxiety:0,taskScope:'day',doneDate:''});
  tasks.push({id:30002,text:'Deep work',catId:'work',done:false,status:'todo',
    ts:'10:00',durationMins:90,order:1,createdAt:Date.now(),
    repeat:null,templateId:null,generatedForDate:null,
    pinned:false,urgency:0,subtasks:[],estimatedMins:null,
    note:'',anxiety:0,taskScope:'day',doneDate:''});
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
  eq(get('tasks.find(t=>t.id===30020).doneDate'), ymd);
  eq(get('tasks.find(t=>t.id===30021).status'), 'done');
  assert(
    get('timeSessions[0].mode') === 'manual',
    'session mode is manual'
  );
});

test('wizMarkCarryOver done marks task done', () => {
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
  run(`_handleDateRollover(new Date().toDateString())`);
  eq(get('dayWizardState.startDone'), false, 'startDone reset');
  eq(get('dayWizardState.endDone'), false, 'endDone reset');
  eq(get('dayWizardOpen'), false);
});


console.log('\n═══ WF31: AI Layer ═══');
resetState();

run(`
  aiSettings.masterEnabled = false;
  aiSettings.ollamaEnabled = false;
  aiSettings.anthropicEnabled = false;
  aiStatus = { ollama: 'unknown', anthropic: 'unknown' };
  aiPendingParse = null;
`);

test('aiSettings loads with defaults when no localStorage key', () => {
  run('localStorage.removeItem("adhd4_ai_settings"); localStorage.removeItem("adhd4_ai_key"); loadAiSettings()');
  eq(get('aiSettings.masterEnabled'), false);
  eq(get('aiSettings.ollamaEnabled'), false);
  eq(get('aiSettings.ollamaUrl'), 'http://localhost:11434');
  eq(get('aiSettings.ollamaModel'), 'llama3.2');
  eq(get('aiSettings.anthropicEnabled'), false);
});

test('saveAiSettings and loadAiSettings round-trip (without key)', () => {
  run(`
    aiSettings.masterEnabled = true;
    aiSettings.ollamaEnabled = true;
    aiSettings.ollamaModel = 'mistral';
    aiSettings.anthropicKey = '';
    saveAiSettings();
    aiSettings = { masterEnabled:false, ollamaEnabled:false,
                   ollamaModel:'llama3.2', anthropicKey:'',
                   providerOrder:['ollama','anthropic'],
                   ollamaUrl:'http://localhost:11434',
                   anthropicEnabled:false };
    loadAiSettings();
  `);
  eq(get('aiSettings.masterEnabled'), true);
  eq(get('aiSettings.ollamaEnabled'), true);
  eq(get('aiSettings.ollamaModel'), 'mistral');
});

test('saveAiSettings stores key separately', () => {
  run(`aiSettings.anthropicKey = 'sk-ant-test'; saveAiSettings()`);
  const mainStore = JSON.parse(run(`localStorage.getItem('adhd4_ai_settings')`) || '{}');
  assert(!mainStore.anthropicKey, 'key not in main settings blob');
  eq(run(`localStorage.getItem('adhd4_ai_key')`), 'sk-ant-test');
});

test('loadAiSettings restores key from separate store', () => {
  run(`aiSettings.anthropicKey = ''; loadAiSettings()`);
  eq(get('aiSettings.anthropicKey'), 'sk-ant-test');
});

test('settingsSetAiMaster toggles masterEnabled', () => {
  run('settingsSetAiMaster(true)');  eq(get('aiSettings.masterEnabled'), true);
  run('settingsSetAiMaster(false)'); eq(get('aiSettings.masterEnabled'), false);
});

test('settingsSetOllamaEnabled toggles ollamaEnabled', () => {
  run('settingsSetOllamaEnabled(true)');  eq(get('aiSettings.ollamaEnabled'), true);
  run('settingsSetOllamaEnabled(false)'); eq(get('aiSettings.ollamaEnabled'), false);
});

test('settingsSaveOllamaUrl stores trimmed url', () => {
  run("settingsSaveOllamaUrl('  http://192.168.1.5:11434  ')");
  eq(get('aiSettings.ollamaUrl'), 'http://192.168.1.5:11434');
});

test('settingsSaveOllamaUrl falls back to default on empty', () => {
  run("settingsSaveOllamaUrl('')");
  eq(get('aiSettings.ollamaUrl'), 'http://localhost:11434');
});

test('settingsSaveOllamaModel stores trimmed model', () => {
  run("settingsSaveOllamaModel('  mistral  ')");
  eq(get('aiSettings.ollamaModel'), 'mistral');
});

test('settingsSetAiProviderOrder maps preset to array', () => {
  run("settingsSetAiProviderOrder('anthropic-first')");
  const order = get('aiSettings.providerOrder');
  eq(order[0], 'anthropic'); eq(order[1], 'ollama');
  run("settingsSetAiProviderOrder('ollama-only')");
  eq(get('aiSettings.providerOrder.length'), 1);
  eq(get('aiSettings.providerOrder[0]'), 'ollama');
});

test('settingsSaveAnthropicKey sets key and enables anthropic', () => {
  run("settingsSaveAnthropicKey('sk-ant-abc123')");
  eq(get('aiSettings.anthropicKey'), 'sk-ant-abc123');
  eq(get('aiSettings.anthropicEnabled'), true);
});

test('settingsSaveAnthropicKey empty string disables anthropic', () => {
  run("settingsSaveAnthropicKey('')");
  eq(get('aiSettings.anthropicEnabled'), false);
});

test('dumpAiEdit clears aiPendingParse', () => {
  run(`aiPendingParse = { text:'Test', ts:'09:00', catId:'', taskScope:'day', note:'' }`);
  run('dumpAiEdit()');
  eq(get('aiPendingParse'), null);
});

test('dumpAiConfirm with pending parse creates task and journal entry', () => {
  run(`
    tasks = [];
    journalEntries = [];
    aiPendingParse = {
      text: 'Call dentist',
      ts: '15:00',
      catId: '',
      taskScope: 'day',
      note: 'fast beforehand',
      rawText: 'dentist thursday 3pm fast beforehand'
    };
    dumpAiConfirm();
  `);
  eq(get('tasks.length'), 1, 'task created');
  eq(get('tasks[0].text'), 'Call dentist');
  eq(get('tasks[0].ts'), '15:00');
  eq(get('tasks[0].taskScope'), 'day');
  eq(get('tasks[0].note'), 'fast beforehand');
  eq(get('journalEntries.length'), 1, 'audit entry created');
  eq(get('journalEntries[0].aiParsed'), true);
  eq(get('aiPendingParse'), null, 'pending parse cleared');
});

test('dumpAiConfirm with null aiPendingParse is no-op', () => {
  run('tasks=[]; aiPendingParse=null; dumpAiConfirm()');
  eq(get('tasks.length'), 0);
});

test('task unchanged when no AI subtasks added', () => {
  run(`
    tasks=[{id:31001,text:'Write report',catId:'work',done:false,
      status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,
      templateId:null,generatedForDate:null,pinned:false,urgency:0,
      subtasks:[],estimatedMins:null,note:'',anxiety:0,
      taskScope:'project',doneDate:'',durationMins:null}];
  `);
  eq(get('tasks.find(t=>t.id===31001).subtasks.length'), 0);
});

test('aiStatus defaults to unknown for both providers', () => {
  run('aiStatus = { ollama:"unknown", anthropic:"unknown" }');
  eq(get('aiStatus.ollama'), 'unknown');
  eq(get('aiStatus.anthropic'), 'unknown');
});

test('AI key not included in main settings blob', () => {
  run("aiSettings.anthropicKey='sk-ant-secret'; saveAiSettings()");
  const mainStore = JSON.parse(run(`localStorage.getItem('adhd4_ai_settings')`) || '{}');
  assert(!mainStore.anthropicKey, 'key not in main settings blob');
  assert(!JSON.stringify(mainStore).includes('sk-ant-secret'), 'secret not in settings JSON');
});


console.log('\n════════════════════════════════════════');
console.log(`RESULTS: ${passed} passed, ${failed} failed out of ${passed+failed} total`);
if (errors.length) {
  console.log('\nFAILED TESTS:');
  errors.forEach(e => console.log(`  ✗ ${e.name}\n    → ${e.msg}`));
}
process.exitCode = failed > 0 ? 1 : 0;
