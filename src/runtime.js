/*
MODULE: runtime.js
LAYER: dispatcher/runtime
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: runtime.js responsibilities
USES: local modules
STATE_READS: T, state, tasks
STATE_WRITES: QUICK_MINS, _lastDateStr, a, activeTasks, audioRecState, card, clockColWidth, code, col, ctx
PUBLIC_API: _handleDateRollover, checkAlarms, onMove, onUp, startClockResize
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

function checkAlarms(){
  const now=new Date();
  const h=String(now.getHours()).padStart(2,'0'),m=String(now.getMinutes()).padStart(2,'0');
  alarms.forEach(a=>{
    if(!a.fired&&a.on&&a.time===h+':'+m&&now.getSeconds()<3){
      a.fired=true;save();showToast('🎯 Target reached: '+a.label,'warn');
      try{const ctx=new(window.AudioContext||window.webkitAudioContext)();const o=ctx.createOscillator(),g=ctx.createGain();o.connect(g);g.connect(ctx.destination);o.frequency.setValueAtTime(660,ctx.currentTime);o.frequency.setValueAtTime(880,ctx.currentTime+.15);g.gain.setValueAtTime(.35,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+1);o.start();o.stop(ctx.currentTime+1);}catch(e){}
    }
  });
}

// ── Global keyboard shortcuts ─────────────────────────────────────────────────
// Space        — pause / resume timer (focused task required)
// Enter        — start stopwatch (idle) or stop + open quick-log (running)
// Shift+Enter  — open quick-log for manual time entry
// Cmd+Enter    — silently log 5 min to focused task (no modal)
// Works from both the focus board and the task list.
// ── Resizable clock column ─────────────────────────────────────────────────
function startClockResize(e){
  e.preventDefault();
  const col=document.getElementById('clock-col');
  if(!col) return;
  const startX=e.clientX;
  // Drag moves LEFT to shrink, RIGHT to grow (handle is on the left edge of the clock col)
  const startW=col.offsetWidth;

  function onMove(ev){
    const delta=ev.clientX-startX;
    const newW=Math.max(120,Math.min(420,startW+delta));
    col.style.width=newW+'px';
    // Also update the state variable for persistence on mouseup
    clockColWidth=newW;
  }
  function onUp(){
    document.removeEventListener('mousemove',onMove);
    document.removeEventListener('mouseup',onUp);
    // Persist without full re-render
    localStorage.setItem('adhd4_clock_col_width',String(clockColWidth));
    save();
  }
  document.addEventListener('mousemove',onMove);
  document.addEventListener('mouseup',onUp);
}

// Item 20 singleton audit: registered once at script startup, never inside render() or any render-called fn.
// Close urgency picker + task overflow panel on outside click — SINGLETON (registered once)
document.addEventListener('click', function(){
  let needsRender=false;
  if(urgencyPickerTaskId!==null){urgencyPickerTaskId=null;needsRender=true;}
  if(taskOverflowOpenId!==null){taskOverflowOpenId=null;needsRender=true;}
  if(needsRender) render();
});

// Global keyboard shortcuts — SINGLETON (registered once)
document.addEventListener('keydown', function(e){
  // Never intercept when user is typing in a real input/textarea/select
  const tag=(document.activeElement||{}).tagName||'';
  const inInput=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT';

  // Quick-log is open — delegate entirely to its own keydown handler
  // (ql-hidden-input captures its own events; only intercept Escape here as backup)
  if(showQuickLog){
    if(!inInput && e.key==='Escape'){e.preventDefault();discardQuickLog();}
    return;
  }

  // Any modal open → don't intercept
  if(showFocusModal||showSessionsModal||showCatModal||showWidgetDrawer||showTransitionPrompt) return;

  if(inInput) return;

  // ── v47: Task-focused hotkeys ─────────────────────────────────────────────
  // Requires focusTaskId, no modifier keys, no modal/input open.
  if(focusTaskId!=null && !e.metaKey && !e.ctrlKey && !e.altKey){
    switch(e.key){
      case 's': case 'S':
        e.preventDefault(); toggleSubtaskExpand(focusTaskId); return;
      case 'n': case 'N':
        e.preventDefault();
        if(expandedNoteTaskId===focusTaskId) closeNoteEdit(focusTaskId);
        else openNoteEdit(focusTaskId);
        return;
      case 't': case 'T':
        e.preventDefault();
        if(editingTimeId===focusTaskId) cancelEditTaskTime();
        else startEditTaskTime(focusTaskId);
        return;
      case 'e': case 'E':
        e.preventDefault();
        if(editingEstimateId===focusTaskId) cancelEditEstimate();
        else startEditEstimate(focusTaskId);
        return;
      case 'o': case 'O':
        e.preventDefault();
        taskOverflowOpenId=(taskOverflowOpenId===focusTaskId?null:focusTaskId);
        render(); return;
      case 'q': case 'Q':
        e.preventDefault(); openQuickLog(focusTaskId,0,Date.now()); return;
      case 'b': case 'B':
        e.preventDefault(); startBreakTimer(5); return;
      case 'f': case 'F':
        e.preventDefault(); openFocusPicker(); return;
      case 'Delete':
        e.preventDefault(); deleteTask(focusTaskId); return;
    }
  }
  // Global F — open focus picker even when no task is focused
  if(!focusTaskId && !e.metaKey && !e.ctrlKey && !e.altKey){
    if(e.key==='f'||e.key==='F'){ e.preventDefault(); openFocusPicker(); return; }
  }

  // Up/Down arrows — navigate focus board cards
  if(e.key==='ArrowUp'||e.key==='ArrowDown'){
    // Build the same canonical array renderFocusBoardWidget uses
    const activeTasks=tasks.filter(t=>t.status!=='done');
    const sortByUrgency=(a,b)=>{
      const ua=avoidanceScore(a),ub=avoidanceScore(b);
      if(ub!==ua) return ub-ua;
      const ta=a.ts||'99:99',tb=b.ts||'99:99';
      return ta<tb?-1:ta>tb?1:0;
    };
    let navTasks=[];
    if(focusBoardMode==='all'){
      const pinnedTasks=activeTasks.filter(t=>t.pinned);
      const regularTasks=activeTasks.filter(t=>!t.pinned).sort(sortByUrgency);
      navTasks=[...pinnedTasks,...regularTasks];
    } else if(focusBoardMode==='urgent'){
      navTasks=activeTasks.filter(t=>(t.urgency||0)>0||avoidanceScore(t)>=3).sort(sortByUrgency);
    } else {
      navTasks=focusBoardManualIds.map(id=>getTask(id)).filter(t=>t&&t.status!=='done');
    }
    if(!navTasks.length) return;
    e.preventDefault();
    const curIdx=focusTaskId!=null?navTasks.findIndex(t=>t.id===focusTaskId):-1;
    let nextIdx;
    if(e.key==='ArrowDown'){
      nextIdx=curIdx<navTasks.length-1?curIdx+1:0;
    } else {
      nextIdx=curIdx>0?curIdx-1:navTasks.length-1;
    }
    const nextTask=navTasks[nextIdx];
    if(nextTask){
      focusTaskId=nextTask.id;
      focusSubtaskId=null;
      save();
      render();
      // Focus the card element so it's visually highlighted
      setTimeout(()=>{
        const card=document.querySelector(`[data-board-task-id="${nextTask.id}"]`);
        if(card) card.focus();
      },0);
    }
    return;
  }

  // Space — pause/resume running timer
  if(e.key===' '||e.code==='Space'){
    // Always prevent scroll when Space is pressed outside an input
    e.preventDefault();
    if(focusTaskId==null) return;
    if(timerRunning){
      stopTimerInternal();
      render();
    } else {
      if(timerMode==='stopwatch'&&timerSecs===0) timerSecs=0; // already reset
      startTimerInternal();
      render();
    }
    return;
  }

  // Enter — context-sensitive
  if(e.key==='Enter'){
    if(focusTaskId==null) return;
    e.preventDefault();

    // Cmd+Enter (Mac) / Ctrl+Enter (Win/Linux) → silently log 5 minutes, no modal
    if(e.metaKey||e.ctrlKey){
      const QUICK_MINS=5;
      const secs=QUICK_MINS*60;
      const endAt=Date.now();
      const startedAt=endAt-secs*1000;
      timeSessions.push({
        id:Date.now(),
        taskId:focusTaskId,
        subtaskId:focusSubtaskId!=null?focusSubtaskId:null,
        startedAt,endedAt:endAt,seconds:secs,
        mode:'manual',type:'work'
      });
      save();render();
      showToast(`+${QUICK_MINS}m logged to "${getTask(focusTaskId)?.text||'task'}"`, 'ok');
      return;
    }

    // Shift+Enter → open quick-log for manual entry
    if(e.shiftKey){
      openQuickLog(focusTaskId, 0, Date.now());
      return;
    }

    if(timerRunning){
      // Enter while running → stop and open quick-log
      stopAndSaveTimer(false);
    } else {
      // Enter while idle → start stopwatch
      if(timerSessionType==='break') return; // don't interfere with break flow
      timerMode='stopwatch';
      timerSessionType='work';
      timerSecs=0;
      startTimerInternal();
      render();
    }
    return;
  }
});

// Track last interaction to drive the idle "Been busy?" prompt — SINGLETON (registered once)
document.addEventListener('click',()=>{ lastInteractionAt=Date.now(); });
document.addEventListener('keydown',()=>{ lastInteractionAt=Date.now(); },true);

// Check idle state every 60 seconds — SINGLETON setInterval (registered once)
setInterval(()=>{
  if(idlePromptShown) return;          // already showing
  if(timerRunning) return;             // timer is running — not idle
  if(showQuickLog||showFocusModal||showSessionsModal||showCatModal||showWidgetDrawer) return;
  const idleMins=(Date.now()-lastInteractionAt)/60000;
  if(idleMins>=idlePromptThresholdMins){
    idlePromptShown=true;
    idlePromptInput='';
    idlePromptTaskId=focusTaskId; // pre-select current focus task if any
    render();
  }
},60000);

// Avoidance cache staleness — invalidate every 60 s so day-boundary staleness signals stay fresh — SINGLETON (registered once)
setInterval(()=>{ invalidateAvoidanceCache(); },60000);

// ── Midnight date-rollover tracker ─────────────────────────────────────────
// Stored outside the interval so the closure captures the mutable variable correctly.
// Initialised to today's date string at script load time.
let _lastDateStr=new Date().toDateString();

// Extracted for testability — called by the 1-second interval when the calendar date changes.
function _handleDateRollover(currentDateStr){
  _lastDateStr=currentDateStr;
  // 1. Generate any repeat task instances for the new day
  ensureRepeatTasksForToday();
  // 2. Reset all alarm fired-flags so they can fire on the new day
  alarms.forEach(a=>{ a.fired=false; });
  // 3. Reset daily intentions so the planning flow reappears for the new day
  dailyIntentions={date:currentDateStr,answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null};
  // 4. Invalidate avoidance scores (new day signals change staleness counts)
  invalidateAvoidanceCache();
  // 5. Reset the day wizard so Start/End prompts reappear for the new day
  dayWizardState={date:dateToYMD(new Date()),phase:null,step:0,startDone:false,endDone:false,wizBannerDismissedAt:0};
  dayWizardOpen=false;
  wizReviewMode=false;
  save();
  render();
}

setInterval(()=>{
  const n=new Date();
  const hhmm=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
  const ss=String(n.getSeconds()).padStart(2,'0');

  // ── Calendar date rollover (midnight) ──────────────────────────────────────
  // Detected on the first tick after the date changes; avoids a page reload for
  // overnight sessions by re-running all startup-time one-shots in-place.
  const currentDateStr=n.toDateString();
  if(currentDateStr!==_lastDateStr) _handleDateRollover(currentDateStr);

  // Crisis mode: plain text clock-el in header bar
  const headerClock=document.getElementById('clock-el');
  if(headerClock) headerClock.textContent=hhmm+':'+ss;

  // SVG composite clock — distinct ids so no clash
  const svgHhmm=document.getElementById('svg-clock-hhmm');
  if(svgHhmm) svgHhmm.textContent=hhmm;
  const svgSs=document.getElementById('svg-clock-ss');
  if(svgSs) svgSs.textContent=ss;

  checkAlarms();
},1000);

// beforeunload guard for in-progress recordings — SINGLETON (registered once)
window.addEventListener('beforeunload',e=>{
  if(audioRecState==='recording'){
    e.preventDefault();
    e.returnValue='';
  }
  // Clean up tuner mic stream on unload
  if(tunerStream) tunerStream.getTracks().forEach(t=>t.stop());
});
