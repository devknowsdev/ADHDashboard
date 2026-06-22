/*
MODULE: helpers.js
LAYER: helpers
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: helpers.js responsibilities
USES: local modules
STATE_READS: T, habits, tasks
STATE_WRITES: COLORS, DURATION, GRAVITY, _avoidanceCache, _taskHitsCache, alpha, already, alreadyMigrated, anchor, anchorOrder
PUBLIC_API: _buildAvoidanceCache, _blurForRender, addJournalEntry, avoidanceScore, compareTasks, confetti, dateToYMD, deleteJournalEntry, ensureFocusValid, esc, fmtDur, frame, getAllHitsForHabit
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-22
*/


function esc(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}
function getCat(id){return categories.find(c=>c.id===id);}
function getTask(id){return tasks.find(t=>t.id===id);}

// ── Render-clobber escape hatch ──────────────────────────────────────────────
// _doRender() (render.js) skips a full rebuild whenever document.activeElement
// sits inside a [data-no-clobber="true"] container — that's correct, it's what
// stops a render firing mid-keystroke from yanking focus out of whatever the
// person is typing into.
//
// The bug this fixes: several "Enter to add" COMMIT handlers (addTask,
// addJournalEntry, plannerAddDump, addHabit, addAlarm, addSubtask,
// wizAddCapture) live inside such a container, clear the input, then call
// save()/render() while that now-empty input is STILL focused. That trips the
// no-clobber check meant for in-progress typing — even though the commit is
// actually finished — so the render silently downgrades to
// _partialTimerUpdate() (clock/timer text only) and the new item never paints
// until something else forces a full render (refresh, tab-away, an unrelated
// timer tick). The data is saved correctly the whole time; only the paint is
// skipped, which is what made this look like a "needs refresh" bug.
//
// Fix: blur the input immediately before save()/render() in any such commit
// handler, so the no-clobber check no longer matches and the full rebuild
// actually runs. Existing setTimeout(...).focus() calls that re-focus the
// input afterward (for fast repeated entry) are unaffected — they run after
// the full render completes.
function _blurForRender(inputId){
  const el=document.getElementById(inputId);
  if(el&&typeof el.blur==='function') el.blur();
}

// ── Date helpers ──────────────────────────────────────────────────────────────
// Moved here from actions_planner.js (HANDOFF_task_scope_and_dump.md) so
// helpers.js can use them too — actions_planner.js loads after helpers.js,
// these are general-purpose date utilities, not planner-specific.
function dateToYMD(d){
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
}
function ymdToDate(s){
  const [y,m,d]=s.split('-').map(Number);
  return new Date(y,m-1,d);
}
function todayYMD(){return dateToYMD(new Date());}

// ── Confetti micro-reward ──────────────────────────────────────────────────
function confetti(origin){
  if(typeof requestAnimationFrame==='undefined') return;
  const canvas=document.getElementById('confetti-canvas');
  if(!canvas||!canvas.getContext) return;
  canvas.width=window.innerWidth;
  canvas.height=window.innerHeight;
  const ctx=canvas.getContext('2d');
  const COLORS=[T.accent,T.accent2,T.green,T.urg1];
  const count=45+Math.floor(Math.random()*20);
  const ox=origin?origin.x:canvas.width/2;
  const oy=origin?origin.y:canvas.height/2;
  const particles=Array.from({length:count},()=>({
    x:ox,y:oy,
    vx:(Math.random()-0.5)*9,
    vy:-(3+Math.random()*7),
    r:2+Math.random()*4,
    color:COLORS[Math.floor(Math.random()*COLORS.length)],
    shape:Math.random()<0.5?'circle':'square',
    alpha:1,
  }));
  const GRAVITY=0.28;
  const DURATION=600;
  const start=performance.now();
  function frame(now){
    const elapsed=now-start;
    const progress=Math.min(elapsed/DURATION,1);
    ctx.clearRect(0,0,canvas.width,canvas.height);
    particles.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;p.vy+=GRAVITY;
      p.alpha=Math.max(0,1-progress*1.4);
      ctx.globalAlpha=p.alpha;
      ctx.fillStyle=p.color;
      if(p.shape==='circle'){ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,2*Math.PI);ctx.fill();}
      else{ctx.fillRect(p.x-p.r,p.y-p.r,p.r*2,p.r*2);}
    });
    ctx.globalAlpha=1;
    if(progress<1) requestAnimationFrame(frame);
    else ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  requestAnimationFrame(frame);
}
// ─────────────────────────────────────────────────────────────────────────────

function fmtDur(totalSecs){
  const s=Math.max(0,Math.round(totalSecs||0));
  const h=Math.floor(s/3600);
  const m=Math.floor((s%3600)/60);
  const ss=s%60;
  if(h>0) return `${h}h ${String(m).padStart(2,'0')}m`;
  if(m>0) return `${m}m ${String(ss).padStart(2,'0')}s`;
  return `${ss}s`;
}
// Human-readable byte size
function fmtBytes(n){
  const b = Number(n) || 0;
  if (b < 1024) return `${b} B`;
  const units = ['KB','MB','GB','TB'];
  let i = -1; let val = b;
  while (val >= 1024 && i < units.length-1){ val = val/1024; i++; }
  return `${val.toFixed(i<0?0:1)} ${units[Math.max(0,i)]}`;
}
// Format seconds as MM:SS string (for editable fields)
function secsToMmSs(totalSecs){
  const s=Math.max(0,Math.round(totalSecs||0));
  const m=Math.floor(s/60);
  const ss=s%60;
  return `${String(m).padStart(2,'0')}:${String(ss).padStart(2,'0')}`;
}
// Parse MM:SS or M:SS string back to seconds; returns null on bad input
function parseMmSs(str){
  const m=String(str||'').trim().match(/^(\d+):(\d{2})$/);
  if(!m) return null;
  const mins=parseInt(m[1],10),secs=parseInt(m[2],10);
  if(secs>59) return null;
  return mins*60+secs;
}
function getSessionsForTask(taskId){
  return timeSessions.filter(s=>s.taskId===taskId).sort((a,b)=>b.startedAt-a.startedAt);
}
function getTotalForTask(taskId){
  // Rolls up all sessions on the task (regardless of subtaskId) — parent + all subtasks
  return timeSessions.filter(s=>s.taskId===taskId).reduce((sum,s)=>sum+(s.seconds||0),0);
}
function getTotalForSubtask(parentTaskId, subtaskId){
  return timeSessions.filter(s=>s.taskId===parentTaskId&&s.subtaskId===subtaskId).reduce((sum,s)=>sum+(s.seconds||0),0);
}
function getTotalOwnSessions(taskId){
  // Only sessions directly on the parent (subtaskId null)
  return timeSessions.filter(s=>s.taskId===taskId&&!s.subtaskId).reduce((sum,s)=>sum+(s.seconds||0),0);
}

// ── Task-hits cache ───────────────────────────────────────────────────────────
// getTaskHitsForHabit iterates tasks + timeSessions on every habit row render,
// and is called multiple times per habit (streak loop, today summary, etc.).
// Cache keyed by "catId|dateStr" — cheap to build, invalidated on every save.
let _taskHitsCache = new Map(); // "catId|dateStr" → hit[]

function invalidateTaskHitsCache(){
  _taskHitsCache = new Map();
}

// Returns synthetic hit objects derived from tasks in the habit's category for a given day.
// A task qualifies if it has status==='done' today OR has timeSessions logged today.
// Each qualifying task produces one hit; minutes = sum of that task's sessions that day.
// synthetic:true marks these as read-only — they are never written to h.hits[].
function getTaskHitsForHabit(habit, todayStr){
  if(!habit.catId) return [];
  const cacheKey=habit.catId+'|'+todayStr;
  if(_taskHitsCache.has(cacheKey)) return _taskHitsCache.get(cacheKey);
  const qualifying=tasks.filter(t=>t.catId===habit.catId);
  const hits=[];
  qualifying.forEach(t=>{
    const todaySessions=timeSessions.filter(s=>s.taskId===t.id&&new Date(s.startedAt).toDateString()===todayStr);
    const doneToday=t.status==='done'&&t.createdAt&&new Date(t.createdAt).toDateString()===todayStr;
    // Check if task was completed today via its most recent session or by done status change
    // Use the latest session timestamp, or createdAt for done-today tasks with no sessions
    const hasSessions=todaySessions.length>0;
    const doneTimestamp=(()=>{
      if(hasSessions) return Math.max(...todaySessions.map(s=>s.startedAt+(s.seconds||0)*1000));
      if(doneToday) return t.createdAt;
      return null;
    })();
    if(!hasSessions&&!doneToday) return;
    const mins=Math.round(todaySessions.reduce((s,x)=>s+(x.seconds||0),0)/60);
    hits.push({
      id:'task-'+t.id,
      timestamp: doneTimestamp||Date.now(),
      minutes: mins,
      taskId: t.id,
      taskText: t.text,
      synthetic: true,
    });
  });
  _taskHitsCache.set(cacheKey, hits);
  return hits;
}

// Merges manual hits (h.hits[]) and task-derived hits, sorted newest-first.
function getAllHitsForHabit(habit, todayStr){
  const manual=(habit.hits||[])
    .filter(x=>new Date(x.timestamp).toDateString()===todayStr&&!x.migrated)
    .map(x=>({...x,synthetic:false}));
  const taskHits=getTaskHitsForHabit(habit,todayStr);
  // Deduplicate: if a task already has a manual hit for same task (rare edge), prefer manual
  const taskIds=new Set(manual.filter(x=>x.taskId).map(x=>x.taskId));
  const filteredTaskHits=taskHits.filter(x=>!taskIds.has(x.taskId));
  return [...manual,...filteredTaskHits].sort((a,b)=>b.timestamp-a.timestamp);
}

function getSubtask(parentTaskId, subtaskId){
  const t=getTask(parentTaskId);if(!t)return null;
  return (t.subtasks||[]).find(st=>st.id===subtaskId)||null;
}
function ensureFocusValid(){
  if(focusTaskId==null){focusSubtaskId=null;return;}
  const t=getTask(focusTaskId);
  if(!t){focusTaskId=null;focusSubtaskId=null;save();return;}
  // If a subtask is focused, validate it still exists
  if(focusSubtaskId!=null){
    const st=getSubtask(focusTaskId,focusSubtaskId);
    if(!st){focusSubtaskId=null;save();}
  }
}

function migrateTasks(){
  tasks.forEach((t,i)=>{
    if(t.order==null) t.order=i;
    if(t.createdAt==null) t.createdAt=typeof t.id==='number'?t.id:Date.now();
    if(t.anxiety==null) t.anxiety=0;
    if(t.urgency===undefined) t.urgency=t.anxiety||0;
    if(t.ts==null) t.ts='';
    if(t.repeat===undefined) t.repeat=null;
    if(t.templateId===undefined) t.templateId=null;
    if(t.generatedForDate===undefined) t.generatedForDate=null;
    if(t.pinned===undefined) t.pinned=false;
    if(t.energyRequired===undefined) t.energyRequired=null; // null | 1 | 2 | 3
    if(t.estimatedMins===undefined) t.estimatedMins=null; // null | integer (minutes)
    if(t.durationMins===undefined) t.durationMins=null;   // null | integer (minutes) — timeline block duration
    if(t.taskScope===undefined) t.taskScope='project'; // 'day' | 'project' | 'fixed' — preserve existing behavior for pre-existing tasks
    if(t.doneDate===undefined) t.doneDate=''; // 'YYYY-MM-DD' set when toggled done, cleared on un-done
    if(!t.subtasks) t.subtasks=[]; // [{id, text, done, order, practiceCount, musicMeta}]
    t.subtasks.forEach((st,si)=>{if(st.order==null)st.order=si;if(st.done===undefined)st.done=false;if(st.practiceCount===undefined)st.practiceCount=0;if(st.musicMeta===undefined)st.musicMeta={key:'',tuning:'',bpm:null,lyrics:''};if(st.estimatedMins===undefined)st.estimatedMins=null;});
    // Item 10: migrate note field
    if(t.note===undefined) t.note='';
    // Music meta migration: if parent has musicMeta with real data and only one subtask, move it down; then remove from parent
    if(t.musicMeta){
      const mm=t.musicMeta;
      const hasData=mm.key||mm.tuning||mm.bpm||mm.lyrics;
      if(hasData && t.subtasks.length===1 && !t.subtasks[0].musicMeta?.key && !t.subtasks[0].musicMeta?.tuning && !t.subtasks[0].musicMeta?.bpm && !t.subtasks[0].musicMeta?.lyrics){
        t.subtasks[0].musicMeta=Object.assign({key:'',tuning:'',bpm:null,lyrics:''},mm);
      }
      delete t.musicMeta;
    }
    // Migrate status: 'todo' | 'inprogress' | 'done'
    if(!t.status){t.status=t.done?'done':'todo';}
    t.done=(t.status==='done'); // keep done in sync as boolean for any legacy reads
  });
  // Migrate habits: days[] → hits[]
  habits.forEach(h=>{
    if(h.days && !h.hits){
      const now=new Date();
      const dayOfWeek=now.getDay();
      h.hits=[];
      h.days.forEach((val,i)=>{
        if(val){
          // compute midnight of that weekday this week
          const diff=i-dayOfWeek;
          const d=new Date(now);
          d.setDate(d.getDate()+diff);
          d.setHours(0,0,0,0);
          h.hits.push({id:Date.now()+i,timestamp:d.getTime(),migrated:true});
        }
      });
      delete h.days;
    }
    if(!h.hits) h.hits=[];
    if(h.catId===undefined) h.catId=''; // optional category tag
    if(h.anchor===undefined) h.anchor=null; // null | HABIT_ANCHORS id
    if(h.anchorOrder===undefined) h.anchorOrder=0; // sort within anchor group
    // Ensure every hit has a minutes field (0 = untracked)
    h.hits.forEach(hit=>{if(hit.minutes===undefined) hit.minutes=0;});
  });
  // Migrate timeSessions: missing type → 'work', missing subtaskId → null
  timeSessions.forEach(s=>{if(!s.type)s.type='work';if(s.subtaskId===undefined)s.subtaskId=null;});
}

// ---- Journal ----
function migrateJournal(){
  // 1. Migrate old adhd4_notes textarea string → type:'dump' entry (once)
  const oldNotes=localStorage.getItem('adhd4_notes');
  if(oldNotes&&oldNotes.trim()){
    // Only migrate if there's no existing dump entry with this exact text
    const alreadyMigrated=journalEntries.some(e=>e.type==='dump'&&e.text===oldNotes.trim()&&e.migratedFromNotes);
    if(!alreadyMigrated){
      journalEntries.push({id:Date.now(),type:'dump',text:oldNotes.trim(),catId:'',createdAt:Date.now(),migratedFromNotes:true});
      localStorage.removeItem('adhd4_notes');
      localStorage.setItem('adhd4_journal',JSON.stringify(journalEntries));
    }
  }
  // 2. Migrate audioRecordings → type:'voice' journal entries (idempotent)
  audioRecordings.forEach(r=>{
    const already=journalEntries.some(e=>e.type==='voice'&&e.audioId===r.id);
    if(!already){
      journalEntries.push({id:r.id+1,type:'voice',text:r.label,catId:'',createdAt:r.createdAt,audioId:r.id});
    }
  });
  // Persist if any migration happened
  localStorage.setItem('adhd4_journal',JSON.stringify(journalEntries));
}

function addJournalEntry(){
  const ta=document.getElementById('journal-capture-text');
  const catSel=document.getElementById('journal-capture-cat');
  if(!ta) return;
  const text=ta.value.trim();
  if(!text){showToast('Write something first','warn');return;}
  const catId=catSel?catSel.value:'';
  journalEntries.unshift({id:Date.now(),type:journalNewType,text,catId,createdAt:Date.now()});
  ta.value='';
  journalNewType='dump';
  _blurForRender('journal-capture-text');
  save();render();
  // Re-focus capture area after render
  setTimeout(()=>{const el=document.getElementById('journal-capture-text');if(el)el.focus();},0);
}

function deleteJournalEntry(id){
  if(!confirm('Delete this entry?')) return;
  const e=journalEntries.find(x=>x.id===id);
  // If it's a voice entry, also clean up from audioRecordings + IndexedDB
  if(e&&e.type==='voice'&&e.audioId!=null){
    stopPlayback();
    audioRecordings=audioRecordings.filter(r=>r.id!==e.audioId);
    saveAudioMeta();
    deleteAudioBlob(e.audioId).catch(()=>{});
  }
  journalEntries=journalEntries.filter(x=>x.id!==id);
  save();render();
}


function parseTaskTime(ts){
  if(!ts||typeof ts!=='string') return null;
  const m=ts.trim().match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return null;
  const h=parseInt(m[1],10),min=parseInt(m[2],10);
  if(h<0||h>23||min<0||min>59) return null;
  return h*60+min;
}

function normalizeTaskTime(raw){
  const m=String(raw||'').trim().match(/^(\d{1,2}):(\d{2})$/);
  if(!m) return null;
  return String(parseInt(m[1],10)).padStart(2,'0')+':'+String(parseInt(m[2],10)).padStart(2,'0');
}

function compareTasks(a,b){
  if(taskSortMode==='manual') return (a.order||0)-(b.order||0);
  if(taskSortMode==='time'){
    const ta=parseTaskTime(a.ts),tb=parseTaskTime(b.ts);
    if(ta==null&&tb==null) return (a.order||0)-(b.order||0);
    if(ta==null) return 1;
    if(tb==null) return -1;
    return ta-tb||(a.order||0)-(b.order||0);
  }
  if(taskSortMode==='added') return (b.createdAt||0)-(a.createdAt||0);
  if(taskSortMode==='anxiety'){
    const sa=avoidanceScore(a), sb=avoidanceScore(b);
    if(sa!==sb) return sb-sa;
    return (a.order||0)-(b.order||0);
  }
  if(taskSortMode==='status'){
    const rank={inprogress:0,todo:1,done:2};
    const ra=rank[a.status||'todo']??1, rb=rank[b.status||'todo']??1;
    if(ra!==rb) return ra-rb;
    return (a.order||0)-(b.order||0);
  }
  return (a.order||0)-(b.order||0);
}

function sortTasksList(list){
  return [...list].sort(compareTasks);
}

// ── Avoidance-score cache ────────────────────────────────────────────────────
// Scoring rescans timeSessions, so we cache results in a Map and rebuild lazily.
// Invalidated on every save and on a 60-second staleness clock in runtime.js.
let _avoidanceCache = new Map(); // taskId → score

function invalidateAvoidanceCache(){
  _avoidanceCache = new Map();
}

function _buildAvoidanceCache(){
  // One pass over timeSessions: collect lastTouched per taskId
  const lastTouched = new Map(); // taskId → max startedAt
  for(let i=0;i<timeSessions.length;i++){
    const s=timeSessions[i];
    const prev=lastTouched.get(s.taskId)||0;
    if(s.startedAt>prev) lastTouched.set(s.taskId,s.startedAt);
  }
  const now=Date.now();
  _avoidanceCache = new Map();
  for(let i=0;i<tasks.length;i++){
    const t=tasks[i];
    if(t.status==='done'){_avoidanceCache.set(t.id,0);continue;}
    let score=t.urgency||0;
    const lt=lastTouched.has(t.id)?lastTouched.get(t.id):(t.createdAt||t.id);
    const days=(now-lt)/(1000*60*60*24);
    if(days>1) score+=1;
    if(days>3) score+=2;
    if(days>7) score+=2;
    const subs=t.subtasks||[];
    if(subs.length>0&&subs.every(st=>!st.done)) score+=1;
    _avoidanceCache.set(t.id,Math.min(score,8));
  }
}

// Computed avoidance score — never stored, derived from behaviour signals + manual urgency.
// Reads from Map cache; rebuilds cache on first call after invalidation.
function avoidanceScore(t){
  if(t.status==='done') return 0;
  if(!_avoidanceCache.has(t.id)) _buildAvoidanceCache();
  return _avoidanceCache.get(t.id)??0;
}

function getVisibleTasksSorted(){
  const todayYmd=dateToYMD(new Date());
  const filtered=tasks.filter(t=>{
    // Category filter (existing)
    if(taskFilter!=='all'&&t.catId!==taskFilter) return false;
    // Hide day-scope done tasks from previous days
    if(t.status==='done'&&t.taskScope==='day'&&t.doneDate&&t.doneDate!==todayYmd) return false;
    // Hide day-scope not-done tasks created before today (stale captures)
    // Only if they have no scheduled time (ts) — scheduled tasks are intentional
    if(t.status!=='done'&&t.taskScope==='day'&&!t.ts&&t.createdAt&&dateToYMD(new Date(t.createdAt))!==todayYmd) return false;
    return true;
  });
  return sortTasksList(filtered);
}

function nextTaskOrder(){
  if(!tasks.length) return 0;
  return Math.max(...tasks.map(t=>t.order||0))+1;
}
