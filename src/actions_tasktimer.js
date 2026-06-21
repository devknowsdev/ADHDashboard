/*
MODULE: actions_tasktimer.js
LAYER: actions
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: actions_tasktimer.js responsibilities
USES: local modules
STATE_READS: T, darkMode, state, tasks
STATE_WRITES: T, activeSession, ctx, darkMode, done, doneDate, doneText, editingSessionId, editingSessionMmSs, editingSessionSecs
PUBLIC_API: addTask, cancelEditTaskTime, cancelSessionEdit, clearFocus, clearTaskTime, closeFocusPicker, closeSessions, deleteAllSessionsForFocus, deleteSession, deleteTask, doneFocus, filterTasks
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

function toggleDark(){darkMode=!darkMode;T=darkMode?DARK:LIGHT;save();render();}
function filterTasks(tag){taskFilter=tag;render();}
function addTask(){
  const inp=document.getElementById('task-in'),sel=document.getElementById('task-cat');
  const timeIn=document.getElementById('task-time-in');
  const repeatSel=document.getElementById('task-repeat');
  const scopeEl=document.getElementById('task-scope');
  const text=inp.value.trim();if(!text)return;
  let ts='';
  if(timeIn && timeIn.value.trim()){
    const norm=normalizeTaskTime(timeIn.value.trim());
    if(!norm){showToast('Use HH:MM for time','warn');return;}
    ts=norm;
  }
  const repeatVal=repeatSel?repeatSel.value:'none';
  const taskScope=scopeEl?(scopeEl.value||'day'):'day';
  const now=Date.now();
  tasks.push({id:now,text,catId:sel.value,done:false,status:'todo',taskScope,doneDate:'',ts,order:nextTaskOrder(),createdAt:now,repeat:repeatVal==='none'?null:repeatVal,templateId:null,generatedForDate:null,pinned:false,energyRequired:null,anxiety:0,urgency:0,subtasks:[],estimatedMins:null,note:''});
  inp.value='';
  if(timeIn) timeIn.value='';
  save();renderNow();
}
function setTaskSortMode(mode){
  taskSortMode=mode;
  save();
  render();
}
function setTaskUrgency(id,level){
  const t=getTask(id);if(!t)return;
  t.urgency=(t.urgency===level?0:level);
  urgencyPickerTaskId=null; // close picker after selection
  save();render();
}

function startEditTaskTime(id){
  editingTimeId=id;
  render();
  setTimeout(()=>{
    const el=document.getElementById('task-time-edit-'+id);
    if(el){el.focus();el.select();}
  },0);
}
function cancelEditTaskTime(){editingTimeId=null;render();}
function saveTaskTime(id,raw){
  const t=getTask(id);
  if(!t){editingTimeId=null;return;}
  const trimmed=String(raw||'').trim();
  if(!trimmed){
    t.ts='';
    editingTimeId=null;
    save();
    render();
    return;
  }
  const norm=normalizeTaskTime(trimmed);
  if(!norm){
    showToast('Use HH:MM (e.g. 14:30)','warn');
    startEditTaskTime(id);
    return;
  }
  t.ts=norm;
  editingTimeId=null;
  save();
  render();
}
function clearTaskTime(id){
  const t=getTask(id);
  if(!t) return;
  t.ts='';
  editingTimeId=null;
  save();
  render();
}
function toggleTask(id){
  const t=tasks.find(x=>x.id===id);if(!t)return;
  // Cycle: todo → inprogress → done → todo
  if(!t.status||t.status==='todo') t.status='inprogress';
  else if(t.status==='inprogress') t.status='done';
  else t.status='todo';
  t.done=(t.status==='done');
  t.doneDate=t.done?dateToYMD(new Date()):'';
  if(t.done&&focusTaskId===id){focusSubtaskId=null;clearFocus();}
  // Fire confetti on the → done transition only
  if(t.done){
    const el=document.querySelector('[data-task-id="'+id+'"]');
    const origin=el?{x:el.getBoundingClientRect().left+9,y:el.getBoundingClientRect().top+9}:null;
    confetti(origin);
  }
  save();if(t.done)showToast('✓ Done! '+t.text,'ok');renderNow();
}
function deleteTask(id){
  if(focusTaskId===id){focusTaskId=null;focusSubtaskId=null;}
  tasks=tasks.filter(x=>x.id!==id);save();renderNow();
}

function openFocusPicker(){showFocusModal=true;focusSearch='';render();setTimeout(()=>{const el=document.getElementById('focus-search');if(el)el.focus();},0);}
function closeFocusPicker(){showFocusModal=false;render();}
function setFocusSearch(v){focusSearch=v;render();const el=document.getElementById('focus-search');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}}
function setFocus(id, subtaskId){
  const t=getTask(id);
  if(!t||t.done){showToast('Pick an active task','warn');return;}
  // If setting focus to a subtask, check it's not done
  if(subtaskId!=null){
    const st=getSubtask(id,subtaskId);
    if(!st||st.done){showToast('Pick an active sub-task','warn');return;}
  }
  focusTaskId=id;
  focusSubtaskId=subtaskId||null;
  showFocusModal=false;
  resetTimer(true);
  save();
  renderNow();
}
function startTaskStopwatch(id){
  const t=getTask(id);
  if(!t||t.done){showToast('Pick an active task','warn');return;}

  // Already running this task → stop + open quick-log
  if(timerRunning && focusTaskId===id){
    stopAndSaveTimer(false); // opens quick-log
    return;
  }
  // Already focused but idle → start stopwatch
  if(!timerRunning && focusTaskId===id){
    timerMode='stopwatch';
    timerSessionType='work';
    timerSecs=0;
    save();
    startTimerInternal();
    render();
    return;
  }  // Different task — stop any running timer, set focus (don't auto-start)
  if(timerRunning) stopTimerInternal();
  focusTaskId=id;
  focusSubtaskId=null;
  showFocusModal=false;
  save();
  render();
}
function clearFocus(){
  focusTaskId=null;
  focusSubtaskId=null;
  stopTimerInternal();
  showFocusModal=false;
  save();
  render();
}
function doneFocus(){
  if(focusTaskId==null) return;
  // "Done!" button always marks directly as done, regardless of current state
  const t=getTask(focusTaskId);if(!t)return;
  const doneText=t.text; // capture before clearFocus() nulls focusTaskId
  t.status='done';t.done=true;
  focusSubtaskId=null;
  clearFocus(); // handles save() + render() — no double-save/render needed
  showToast('✓ Done! '+doneText,'ok');
}

function openSessions(taskId){
  const resolvedId=taskId!=null?taskId:focusTaskId;
  if(resolvedId==null) return;
  showSessionsModal=true;
  sessionsViewTaskId=resolvedId;
  editingSessionId=null;
  render();
}
function closeSessions(){showSessionsModal=false;editingSessionId=null;sessionsViewTaskId=null;render();}
function startSessionEdit(id){
  const s=timeSessions.find(x=>x.id===id);
  if(!s) return;
  editingSessionId=id;
  editingSessionSecs=Math.max(1,Math.round(s.seconds||0));
  editingSessionMmSs=secsToMmSs(editingSessionSecs);
  render();
  setTimeout(()=>{const el=document.getElementById('session-edit-mmss-'+id);if(el){el.focus();el.select();}},0);
}
function setEditingSessionMmSs(val){
  editingSessionMmSs=val;
  const parsed=parseMmSs(val);
  if(parsed!==null) editingSessionSecs=Math.max(1,parsed);
}
function saveSessionEdit(id){
  const s=timeSessions.find(x=>x.id===id);
  if(!s) return;
  // Re-parse the MM:SS field in case oninput didn't fire (e.g. keyboard Enter)
  const parsed=parseMmSs(editingSessionMmSs);
  if(parsed===null){showToast('Use MM:SS format (e.g. 25:00)','warn');return;}
  s.seconds=Math.max(1,parsed);
  editingSessionId=null;
  editingSessionMmSs='00:00';
  save();
  render();
}
function cancelSessionEdit(){editingSessionId=null;editingSessionMmSs='00:00';render();}
function deleteSession(id){
  if(!confirm('Delete this session?')) return;
  timeSessions=timeSessions.filter(x=>x.id!==id);
  editingSessionId=null;
  save();
  render();
}
function deleteAllSessionsForFocus(){
  const tid=sessionsViewTaskId!=null?sessionsViewTaskId:focusTaskId;
  if(tid==null) return;
  if(!confirm('Delete ALL sessions for this task?')) return;
  timeSessions=timeSessions.filter(s=>s.taskId!==tid);
  editingSessionId=null;
  save();
  render();
}

function setTimerMode(mode){
  if(timerRunning){showToast('Pause/save before switching mode','warn');return;}
  timerMode=mode;
  resetTimer(true);
  render();
}
function setCountdownMins(v){
  const n=parseInt(v,10);
  timerCountdownMins=isNaN(n)?25:Math.max(1,Math.min(240,n));
  if(!timerRunning && timerMode==='countdown'){
    timerPlannedSecs=timerCountdownMins*60;
    timerSecs=timerPlannedSecs;
    // Only update the readout labels — no structural change needs a full rebuild
    _partialTimerUpdate();
  }
}
function startCountdown(){
  if(focusTaskId==null){showToast('Pick a focus task first','warn');openFocusPicker();return;}
  if(timerRunning) stopTimerInternal();
  timerMode='countdown';
  timerSessionType='work';
  timerPlannedSecs=timerCountdownMins*60;
  timerSecs=timerPlannedSecs;
  startTimerInternal();
  render();
}

function toggleTimer(){
  if(focusTaskId==null&&timerSessionType!=='break'){showToast('Pick a focus task first','warn');openFocusPicker();return;}
  if(timerRunning){
    stopTimerInternal();
    showToast('Paused (not saved)','warn');
    render();
    return;
  }
  // Stopwatch always starts from 0 when idle; countdown uses its configured duration
  if(timerMode==='stopwatch'){
    timerSecs=0;
  } else {
    // countdown — if secs ran out, re-arm
    if(timerSecs<=0){timerPlannedSecs=timerCountdownMins*60;timerSecs=timerPlannedSecs;}
  }
  startTimerInternal();
  render();
}

function startTimerInternal(){
  if(timerRunning) return;
  // Guard: clear any orphaned interval before creating a new one
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  timerRunning=true;
  if(timerMode==='countdown'){
    if(timerSecs<=0){timerPlannedSecs=timerCountdownMins*60;timerSecs=timerPlannedSecs;}
    activeSession={id:Date.now(),taskId:timerSessionType==='break'?null:focusTaskId,subtaskId:timerSessionType==='break'?null:focusSubtaskId,startedAt:Date.now(),mode:'countdown',type:timerSessionType};
    timerInterval=setInterval(()=>{
      if(!timerRunning) return;
      timerSecs=Math.max(0,timerSecs-1);
      if(timerSecs===0){
        if(timerSessionType==='break'){
          // Break finished — auto-save as before
          stopAndSaveTimer(true);
        }else{
          // Work block finished — stop interval, show transition prompt
          stopTimerInternal();
          showTransitionPrompt=true;
          transitionReflect='';
          try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(528,ctx.currentTime);o.frequency.setValueAtTime(660,ctx.currentTime+.15);o.frequency.setValueAtTime(880,ctx.currentTime+.3);g.gain.setValueAtTime(.3,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+1.2);o.start();o.stop(ctx.currentTime+1.2);}catch(e){}
          showToast('Block done — take a breath \uD83C\uDFAF','ok');
          render();
        }
      }else{
        _partialTimerUpdate();
      }
    },1000);
  }else{
    activeSession={id:Date.now(),taskId:timerSessionType==='break'?null:focusTaskId,subtaskId:timerSessionType==='break'?null:focusSubtaskId,startedAt:Date.now(),mode:'stopwatch',type:timerSessionType};
    timerInterval=setInterval(()=>{
      if(!timerRunning) return;
      timerSecs=timerSecs+1;
      _partialTimerUpdate();
    },1000);
  }
}

function stopTimerInternal(){
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  timerRunning=false;
}

function stopAndSaveTimer(skipQuickLog){
  const isBreak=timerSessionType==='break';
  if(!isBreak&&focusTaskId==null){showToast('Pick a focus task first','warn');return;}
  if(!activeSession && !timerRunning){showToast('Nothing to save','warn');return;}
  stopTimerInternal();

  const endAt=Date.now();
  let seconds=timerMode==='countdown'
    ? Math.max(0,Math.round(timerPlannedSecs-timerSecs))
    : Math.max(0,Math.round(timerSecs));
  // Sanity check: use wall-clock elapsed as a floor to guard against timer drift
  if(activeSession){
    const wallSecs=Math.max(0,Math.round((endAt - activeSession.startedAt)/1000));
    seconds=Math.max(seconds, wallSecs);
  }

  // Break sessions save silently without quick-log
  if(isBreak||skipQuickLog){
    if(seconds<=0){showToast('Session too short to save','warn');activeSession=null;timerSessionType='work';renderNow();return;}
    const startedAt=activeSession?.startedAt ?? (endAt - seconds*1000);
    timeSessions.push({
      id: activeSession?.id ?? Date.now(),
      taskId: isBreak ? null : focusTaskId,
      subtaskId: isBreak ? null : (activeSession?.subtaskId ?? focusSubtaskId ?? null),
      startedAt,
      endedAt: endAt,
      seconds,
      mode: timerMode,
      type: timerSessionType,
    });
    activeSession=null;
    timerSessionType='work';
    if(!isBreak && focusSubtaskId!=null){
      const t=getTask(focusTaskId);
      if(t){const st=(t.subtasks||[]).find(s=>s.id===focusSubtaskId);if(st)st.practiceCount=(st.practiceCount||0)+1;}
    }
    save();
    showToast(isBreak?'Break saved':'Session saved','ok');
    resetTimer(true);
    renderNow();
    return;
  }

  // Work session → open quick-log for time confirmation + note
  const startedAt=activeSession?.startedAt ?? (endAt - seconds*1000);
  const savedSessionId=activeSession?.id ?? Date.now();
  const savedSubtaskId=activeSession?.subtaskId ?? focusSubtaskId ?? null;
  activeSession=null;
  timerSessionType='work';
  openQuickLog(focusTaskId, seconds, startedAt);
}

// ---- Transition prompt actions ----
function transitionSaveAndContinue(){
  // Capture reflection text from DOM before stopAndSaveTimer re-renders
  const inp=document.getElementById('transition-reflect-input');
  if(inp) transitionReflect=inp.value.trim();
  // Save the journal reflect entry
  const text=transitionReflect||'Work block completed.';
  journalEntries.unshift({id:Date.now(),type:'reflect',text,catId:'',createdAt:Date.now()});
  // Dismiss prompt before stopAndSaveTimer so it doesn't re-show mid-render
  showTransitionPrompt=false;
  transitionReflect='';
  save();
  // Now save the timer session (handles its own render + toast)
  stopAndSaveTimer(true);
}
function transitionSkip(){
  const inp=document.getElementById('transition-reflect-input');
  if(inp) transitionReflect=inp.value.trim();
  showTransitionPrompt=false;
  transitionReflect='';
  stopAndSaveTimer(true);
}

function resetTimer(silent){
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
  timerRunning=false;
  activeSession=null;
  showTransitionPrompt=false;
  transitionReflect='';
  if(timerMode==='countdown'){
    timerPlannedSecs=Math.max(60,Math.round((timerCountdownMins||25)*60));
    timerSecs=timerPlannedSecs;
  }else{
    timerSecs=0;
    timerPlannedSecs=0;
  }
  if(!silent) render();
}
function startBreakTimer(mins){
  if(timerRunning){showToast('Stop the current timer first','warn');return;}
  timerSessionType='break';
  timerMode='countdown';
  timerCountdownMins=mins;
  timerPlannedSecs=mins*60;
  timerSecs=timerPlannedSecs;
  startTimerInternal();
  showToast(`Break started: ${mins} min`,'ok');
  render();
}
function toggleTimerLayout(){timerLayout=timerLayout==='rings'?'bars':'rings';localStorage.setItem('adhd4_timer_layout',timerLayout);render();}
function toggleEnergyFilter(){energyFilterOn=!energyFilterOn;render();}
function toggleTimeTargets(){showTimeTargets=!showTimeTargets;render();}
