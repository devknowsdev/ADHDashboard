/*
MODULE: actions.js
LAYER: actions
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: actions.js responsibilities
USES: local modules
STATE_READS: T, state, tasks
STATE_WRITES: _IDLE_PILLS, _QL_PILLS, a, active, b, background, border, btn, cancel, colonMatch
PUBLIC_API: _idlePatchUI, _qlPatchUI, commitIdleLog, commitQuickLog, discardQuickLog, dismissIdlePrompt, idleInputChange, idlePickPill, openQuickLog, parseQuickLogInput, parseTimeInput, promoteDumpToTask
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Quick-log and idle-prompt action layer: parse, open, discard, commit, DOM-patch.
// Render functions for idle prompt and cat modal → render_modals.js.
// Depends on: state.js, helpers.js (fmtDur, getTask, getCat), storage.js (save),
//             ui.js (showToast), render.js (render, renderNow),
//             actions_tasktimer.js (resetTimer), audio.js (journalEntries).
function parseTimeInput(raw){
  if(!raw||!raw.trim()) return null;
  const s=raw.trim().toLowerCase();
  // HH:MM or M:SS — treat as h:mm (hours:minutes) if first part <=12, else minutes:seconds
  const colonMatch=s.match(/^(\d+):(\d{1,2})$/);
  if(colonMatch){
    const a=parseInt(colonMatch[1],10), b=parseInt(colonMatch[2],10);
    if(isNaN(a)||isNaN(b)) return null;
    // Treat as H:MM (hours:minutes) → return seconds
    return (a*60+b)*60;
  }
  // "1h25m" or "1h25" or "1h"
  const hmMatch=s.match(/^(\d+)h(?:(\d+)m?)?$/);
  if(hmMatch){
    const h=parseInt(hmMatch[1],10);
    const m=hmMatch[2]!=null?parseInt(hmMatch[2],10):0;
    if(isNaN(h)||isNaN(m)) return null;
    return (h*60+m)*60;
  }
  // "25m" or "25"
  const mMatch=s.match(/^(\d+)m?$/);
  if(mMatch){
    const m=parseInt(mMatch[1],10);
    if(isNaN(m)) return null;
    return m*60;
  }
  return null;
}

// Keep legacy alias so any other callers still work
function parseQuickLogInput(raw){ return parseTimeInput(raw); }

function openQuickLog(taskId, prefilledSecs, startedAt){
  showQuickLog=true;
  quickLogTaskId=taskId;
  quickLogSecs=prefilledSecs||0;
  // Pre-fill the text field with a friendly representation of the timer duration
  quickLogInput=prefilledSecs>0?(()=>{
    const m=Math.floor(prefilledSecs/60), s=prefilledSecs%60;
    if(s===0) return m+'m';
    return m+'m '+s+'s';
  })():'';
  quickLogNote='';
  quickLogStartedAt=startedAt||Date.now()-prefilledSecs*1000;
  render();
  setTimeout(()=>{
    const inp=document.getElementById('ql-time-input');
    if(inp){inp.focus();inp.select();}
  },50);
}

function discardQuickLog(){
  showQuickLog=false;
  quickLogTaskId=null;
  quickLogInput='';
  quickLogNote='';
  render();
}

// Shared targeted-patch helpers for quick-log pill rows
const _QL_PILLS=[5,10,15,25,30,45,60];
const _IDLE_PILLS=[5,10,15,25,30,45,60];

function _qlPatchUI(previewSecs){
  const displayEl=document.getElementById('ql-preview');
  if(displayEl){
    displayEl.textContent=previewSecs>0?fmtDur(previewSecs):'—';
    displayEl.style.color=previewSecs>0?T.accent:T.muted2;
  }
  _QL_PILLS.forEach(m=>{
    const btn=document.getElementById('ql-pill-'+m);
    if(!btn) return;
    const active=previewSecs===m*60;
    btn.style.border=`1.5px solid ${active?T.accent2:T.border}`;
    btn.style.background=active?T.accent2:'transparent';
    btn.style.color=active?'#fff':T.muted;
  });
  const logBtn=document.getElementById('ql-log-btn');
  if(logBtn){
    logBtn.disabled=!(previewSecs>0);
    logBtn.style.opacity=previewSecs>0?'1':'0.45';
    logBtn.style.cursor=previewSecs>0?'pointer':'not-allowed';
  }
}

// Called on every keystroke in the text input
function qlTimeInputChange(val){
  quickLogInput=val;
  const noteEl=document.getElementById('ql-note');
  if(noteEl) quickLogNote=noteEl.value;
  const previewSecs=parseTimeInput(val)??quickLogSecs;
  _qlPatchUI(previewSecs);
}

function qlTimeKeydown(e){
  if(e.key==='Enter'){
    e.preventDefault();
    commitQuickLog();
  } else if(e.key==='Escape'){
    e.preventDefault();
    discardQuickLog();
  }
}

function qlPickPill(mins){
  quickLogInput=mins+'m';
  const inp=document.getElementById('ql-time-input');
  if(inp){inp.value=quickLogInput;inp.focus();inp.select();}
  _qlPatchUI(mins*60);
}

function _idlePatchUI(previewSecs){
  const displayEl=document.getElementById('idle-preview');
  if(displayEl) displayEl.textContent=fmtDur(previewSecs>0?previewSecs:0);
  _IDLE_PILLS.forEach(m=>{
    const btn=document.getElementById('idle-pill-'+m);
    if(!btn) return;
    const active=previewSecs===m*60;
    btn.style.border=`1.5px solid ${active?T.accent2:T.border}`;
    btn.style.background=active?T.accent2:'transparent';
    btn.style.color=active?'#fff':T.muted;
  });
}

function idleInputChange(val){
  idlePromptInput=val;
  const previewSecs=parseTimeInput(val)||(Math.round((Date.now()-lastInteractionAt)/60000)*60);
  _idlePatchUI(previewSecs);
}

function idlePickPill(mins){
  idlePromptInput=mins+'m';
  const inp=document.getElementById('idle-time-input');
  if(inp){inp.value=idlePromptInput;inp.focus();inp.select();}
  _idlePatchUI(mins*60);
}

// ── "Been busy?" idle prompt ─────────────────────────────────────────────────

function dismissIdlePrompt(){
  idlePromptShown=false;
  lastInteractionAt=Date.now(); // reset so it doesn't re-trigger immediately
  idlePromptInput='';
  idlePromptTaskId=null;
  render();
}

function commitIdleLog(){
  const timeInputEl=document.getElementById('idle-time-input');
  const rawInput=timeInputEl?timeInputEl.value:(idlePromptInput||'');
  const secs=parseTimeInput(rawInput);
  if(!secs||secs<=0){showToast('Enter a time greater than 0','warn');return;}
  const endAt=Date.now();
  const startedAt=endAt-secs*1000;
  const resolvedTaskId=idlePromptTaskId!=null?idlePromptTaskId:null;
  if(resolvedTaskId){
    // Log to a real task
    timeSessions.push({
      id:Date.now(),taskId:resolvedTaskId,subtaskId:null,
      startedAt,endedAt:endAt,seconds:secs,mode:'manual',type:'work'
    });
    showToast(`+${fmtDur(secs)} logged to "${getTask(resolvedTaskId)?.text||'task'}"`, 'ok');
  } else {
    // Log as Downtime
    offTaskLog.push({
      id:Date.now(),date:new Date().toDateString(),
      startTime:new Date(startedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}),
      endTime:new Date(endAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',hour12:false}),
      seconds:secs,note:'Downtime (idle log)'
    });
    showToast(`${fmtDur(secs)} logged as Downtime`,'ok');
  }
  save();
  dismissIdlePrompt();
}

function commitQuickLog(){
  if(!quickLogTaskId) return;
  const noteEl=document.getElementById('ql-note');
  const note=(noteEl?noteEl.value:quickLogNote||'').trim();
  // Read current value from the visible text input (if it exists), else fall back to state
  const timeInputEl=document.getElementById('ql-time-input');
  const rawInput=timeInputEl?timeInputEl.value:quickLogInput;
  const secs=parseTimeInput(rawInput) ?? parseTimeInput(quickLogInput) ?? quickLogSecs;
  if(secs<=0){showToast('Enter a time greater than 0','warn');return;}
  const endAt=Date.now();
  const startedAt=quickLogStartedAt||endAt-secs*1000;
  timeSessions.push({
    id:Date.now(),
    taskId:quickLogTaskId,
    subtaskId:focusSubtaskId&&focusTaskId===quickLogTaskId?focusSubtaskId:null,
    startedAt,
    endedAt:endAt,
    seconds:secs,
    mode:'stopwatch',
    type:'work',
    note:note||undefined,
  });
  // If this task was being focused via subtask, count practice
  if(focusSubtaskId&&focusTaskId===quickLogTaskId){
    const t=getTask(quickLogTaskId);
    if(t){const st=(t.subtasks||[]).find(s=>s.id===focusSubtaskId);if(st)st.practiceCount=(st.practiceCount||0)+1;}
  }
  if(note){
    journalEntries.unshift({id:Date.now()+1,type:'reflect',text:`[${getTask(quickLogTaskId)?.text||'task'}] ${note}`,catId:getTask(quickLogTaskId)?.catId||'',createdAt:endAt});
  }
  showQuickLog=false;
  quickLogTaskId=null;
  quickLogInput='';
  quickLogNote='';
  save();
  showToast('Session logged ✓','ok');
  resetTimer(true);
  render();
}

// ── promoteDumpToTask: promote a journal/dump entry to a real task ────────────
function promoteDumpToTask(journalId){
  const entry=journalEntries.find(e=>e.id===journalId);
  if(!entry) return;
  const now=Date.now();
  // confirm() returns true in tests; in the app it shows a scope-choice dialog.
  // true = project (stays until deleted), false/cancel = day (disappears tomorrow)
  const isProject=confirm(
    '"'+entry.text.slice(0,60)+'"\n\nMake this a Project task? (stays until deleted)\nCancel = Day task (disappears tomorrow)'
  );
  tasks.push({
    id:now,
    text:entry.text,
    catId:entry.catId||'',
    done:false,
    status:'todo',
    taskScope:isProject?'project':'day',
    doneDate:'',
    ts:'',
    durationMins:null,
    order:nextTaskOrder(),
    createdAt:now,
    repeat:null,
    templateId:null,
    generatedForDate:null,
    pinned:false,
    energyRequired:null,
    anxiety:0,
    urgency:0,
    subtasks:[],
    estimatedMins:null,
    note:'',
  });
  journalEntries=journalEntries.filter(e=>e.id!==journalId);
  save();
  showToast('"'+entry.text.slice(0,40)+'" added to Tasks','ok');
  render();
}
