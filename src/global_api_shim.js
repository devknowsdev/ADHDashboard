/*
Global API shim: define browser-facing action functions referenced by
render templates and tests. These are minimal implementations or aliases
that call existing helpers where available, and are mirrored onto
globalThis so Node VM harnesses can access them.
*/
(function(){
  const root = (typeof window !== 'undefined')?window:globalThis;

  function ensure(name, fn){
    try{
      if(typeof root[name] === 'undefined') root[name] = fn;
      if(typeof globalThis !== 'undefined' && typeof globalThis[name] === 'undefined') globalThis[name] = root[name];
    }catch(e){/* best-effort */}
  }

  
    ensure('toggleTask', function(taskId){ try{ const t = typeof getTask === 'function' ? getTask(taskId) : (tasks||[]).find(x=>x.id===taskId); if(!t) return;
      if(t.status==='todo'){ t.status='inprogress'; t.done=false; }
      else if(t.status==='inprogress'){ t.status='done'; t.done=true; if(typeof dateToYMD==='function') t.doneDate = dateToYMD(new Date()); else t.doneDate = new Date().toISOString().slice(0,10); }
      else { t.status='todo'; t.done=false; t.doneDate=''; }
        if(typeof ensureRepeatTasksForToday==='function') ensureRepeatTasksForToday();
        // If task was marked done and it was focused, clear focus
        if(t.status==='done' && typeof focusTaskId!=='undefined' && focusTaskId===taskId){ focusTaskId=null; focusSubtaskId=null; }
      if(typeof save==='function') save();
      if(typeof render==='function') render();
    }catch(e){console.warn('toggleTask error',e);}
  });

  // deleteTask: remove task and related sessions
  ensure('deleteTask', function(taskId){
    try{
      if(typeof tasks==='undefined') return;
      tasks = tasks.filter(t=>t.id!==taskId);
      if(typeof timeSessions!=='undefined') timeSessions = timeSessions.filter(s=>s.taskId!==taskId);
      if(typeof save==='function') save();
      if(typeof render==='function') render();
    }catch(e){console.warn('deleteTask error',e);}
  });

  ensure('setTaskUrgency', function(taskId,urg){ try{ const t=(typeof getTask==='function'?getTask(taskId):tasks.find(x=>x.id===taskId)); if(!t) return; const n=Number(urg)||0; t.urgency = (t.urgency===n)?0:n; urgencyPickerTaskId = null; save&&save(); render&&render(); }catch(e){} });
  ensure('saveTaskTime', function(taskId,timeStr){ try{ const t=(typeof getTask==='function'?getTask(taskId):tasks.find(x=>x.id===taskId)); if(!t) return; const raw = String(timeStr||'').trim(); if(raw===''){ t.ts = ''; } else if(typeof normalizeTaskTime==='function'){ const norm = normalizeTaskTime(raw); if(norm==null) return; t.ts = norm; } else { t.ts = raw; } save&&save(); render&&render(); }catch(e){} });
  ensure('clearTaskTime', function(taskId){ try{ const t=(typeof getTask==='function'?getTask(taskId):tasks.find(x=>x.id===taskId)); if(!t) return; t.ts = ''; save&&save(); render&&render(); }catch(e){}});

  ensure('startTaskStopwatch', function(taskId){ try{
      const t = (typeof getTask==='function'?getTask(taskId):tasks.find(x=>x.id===taskId));
      if(!t || t.done) return; // no-op for done tasks
      // If timer running on same task -> open quick-log
      if(timerRunning && activeSession && activeSession.taskId===taskId){ showQuickLog=true; quickLogTaskId=taskId; quickLogSecs = Math.round((Date.now()-activeSession.startedAt)/1000); render&&render(); return; }
      // If timer running on different task -> stop prior timer and switch focus (do NOT auto-start)
      if(timerRunning && activeSession && activeSession.taskId!==taskId){ if(typeof stopTimerInternal==='function') stopTimerInternal(); focusTaskId = taskId; focusSubtaskId = null; render&&render(); return; }
      // If idle and same task -> start stopwatch
      if(!timerRunning && focusTaskId===taskId){ timerMode='stopwatch'; if(typeof startTimerInternal==='function') startTimerInternal(); return; }
      // If idle and different task -> set focus only
      focusTaskId = taskId; focusSubtaskId = null; render&&render();
    }catch(e){console.warn('startTaskStopwatch',e);} });
  // setFocus: set focus to a task (and optional subtask), stop timers
  ensure('setFocus', function(taskId, subtaskId){
    try{
      const t = (typeof getTask==='function'?getTask(taskId):tasks.find(x=>x.id===taskId));
      if(!t||t.done) return;
      focusTaskId = taskId; focusSubtaskId = subtaskId||null;
      // reset timer state
      timerRunning = false; if(typeof clearInterval==='function' && timerInterval) clearInterval(timerInterval); timerInterval = null; activeSession = null;
      showFocusModal = false;
      if(typeof ensureRepeatTasksForToday==='function') ensureRepeatTasksForToday();
      save&&save(); render&&render();
    }catch(e){console.warn('setFocus',e);} });

  ensure('clearFocus', function(){ try{ focusTaskId=null; focusSubtaskId=null; timerRunning=false; if(typeof clearInterval==='function' && timerInterval) clearInterval(timerInterval); timerInterval=null; activeSession=null; showFocusModal=false; render&&render(); }catch(e){}});

  // Sessions / editor helpers
  ensure('openSessions', function(taskId){ try{ const explicit = (typeof taskId!=='undefined' && taskId!==null); const target = explicit?taskId:(focusTaskId||null); if(!explicit && !focusTaskId){ return; } showSessionsModal = true; sessionsViewTaskId = target; if(typeof render==='function') render(); }catch(e){} });
  ensure('closeSessions', function(){ try{ showSessionsModal = false; sessionsViewTaskId = null; editingSessionId=null; editingSessionMmSs='00:00'; editingSessionSecs=0; if(typeof render==='function') render(); }catch(e){} });
  ensure('deleteSession', function(sessionId){ try{ if(typeof timeSessions==='undefined') return; timeSessions = timeSessions.filter(s=>s.id!==sessionId); if(typeof save==='function') save(); if(typeof render==='function') render(); }catch(e){} });
  ensure('saveSessionEdit', function(sessionId){ try{ const s = (timeSessions||[]).find(x=>x.id===sessionId); if(!s) return; if(typeof editingSessionMmSs!=='undefined' && typeof parseMmSs==='function'){ const secs = parseMmSs(editingSessionMmSs); if(secs!=null){ s.seconds=secs; s.endedAt = s.startedAt + secs*1000; } } editingSessionId=null; editingSessionMmSs='00:00'; save&&save(); render&&render(); }catch(e){} });
  ensure('setEditingSessionMmSs', function(val){ try{ editingSessionMmSs = String(val||'00:00'); if(typeof parseMmSs==='function'){ const secs = parseMmSs(editingSessionMmSs); if(secs!=null) editingSessionSecs = secs; } }catch(e){} });
  ensure('cancelSessionEdit', function(){ try{ editingSessionId=null; editingSessionMmSs='00:00'; render&&render(); }catch(e){} });
  ensure('deleteAllSessionsForFocus', function(taskId){ try{ const id = (typeof taskId!=='undefined' && taskId!=null)?taskId:(sessionsViewTaskId!=null?sessionsViewTaskId:focusTaskId); if(!id) return; timeSessions = (timeSessions||[]).filter(s=>s.taskId!==id); save&&save(); render&&render(); }catch(e){} });

  // Focus picker helpers
  ensure('openFocusPicker', function(){ try{ showFocusModal=true; if(typeof render==='function') render(); }catch(e){} });
  ensure('closeFocusPicker', function(){ try{ showFocusModal=false; if(typeof render==='function') render(); }catch(e){} });

  // Timer controls (minimal behaviour to satisfy UI/tests)
  ensure('startTimerInternal', function(){ try{
      if(timerRunning) return;
      timerRunning=true;
      // create activeSession if missing
      if(!activeSession){ activeSession = {id:Date.now(), taskId: focusTaskId, subtaskId: focusSubtaskId || null, startedAt: Date.now(), mode: timerMode, type: 'work'}; }
      if(!timerInterval && typeof setInterval==='function') timerInterval = setInterval(()=>{ if(timerRunning){ if(timerMode==='countdown') timerSecs = Math.max(0, timerSecs-1); else timerSecs = (timerSecs||0)+1; } }, 1000);
      if(typeof render==='function') render(); }catch(e){} });
  ensure('stopTimerInternal', function(){ try{ timerRunning=false; if(typeof clearInterval==='function' && timerInterval) clearInterval(timerInterval); timerInterval=null; if(typeof render==='function') render(); }catch(e){} });
  ensure('stopAndSaveTimer', function(saveDirect){ try{ timerRunning=false; if(!activeSession){ render&&render(); return; }
      // compute wall-clock elapsed (floor) and timer-derived elapsed, then use the larger
      const wallElapsed = Math.floor((Date.now()-activeSession.startedAt)/1000);
      let timerDerived = null;
      try{
        if(activeSession && activeSession.mode==='countdown'){
          const planned = (typeof timerPlannedSecs!=='undefined' && timerPlannedSecs)?timerPlannedSecs:((timerCountdownMins||25)*60);
          const remaining = (typeof timerSecs==='number')?timerSecs:planned;
          timerDerived = Math.max(0, planned - remaining);
        } else {
          timerDerived = (typeof timerSecs==='number')?timerSecs:Math.round((Date.now()-activeSession.startedAt)/1000);
        }
      }catch(e){ timerDerived = Math.round((Date.now()-activeSession.startedAt)/1000); }
      const secs = Math.max(wallElapsed, Math.floor(timerDerived));
      const s = { id: Date.now(), taskId: activeSession.taskId, startedAt: activeSession.startedAt, endedAt: activeSession.startedAt + secs*1000, seconds: secs, mode: activeSession.mode||'auto', type:'work' };
      if(saveDirect){ timeSessions = timeSessions||[]; timeSessions.push(s); activeSession=null; save&&save(); showQuickLog=false; quickLogTaskId=null; }
      else { showQuickLog=true; quickLogTaskId = activeSession.taskId; quickLogSecs = elapsed; }
      render&&render(); }catch(e){} });
  ensure('startCountdown', function(mins){ try{ if(!focusTaskId){ showFocusModal=true; render&&render(); return; } timerMode='countdown'; timerCountdownMins = Number(mins)||timerCountdownMins; timerPlannedSecs = (timerCountdownMins||25)*60; timerSecs = timerPlannedSecs; timerRunning=true; activeSession = { id: Date.now(), taskId: focusTaskId, startedAt: Date.now(), mode:'countdown', type:'work' }; if(!timerInterval && typeof setInterval==='function') timerInterval = setInterval(()=>{ if(timerRunning) timerSecs = Math.max(0, timerSecs-1); }, 1000); if(typeof render==='function') render(); }catch(e){} });
  ensure('doneFocus', function(){ try{ // mark focused task done
    if(focusTaskId!=null){ const t=(typeof getTask==='function'?getTask(focusTaskId):tasks.find(x=>x.id===focusTaskId)); if(t){ t.status='done'; t.done=true; t.doneDate=(typeof dateToYMD==='function'?dateToYMD(new Date()):new Date().toISOString().slice(0,10)); save&&save(); } focusTaskId=null; focusSubtaskId=null; } render&&render(); }catch(e){} });
  ensure('toggleTimer', function(){ try{ if(!focusTaskId){ showFocusModal=true; render&&render(); return; } if(!timerRunning){ if(typeof startTimerInternal==='function') startTimerInternal(); } else { if(typeof stopTimerInternal==='function') stopTimerInternal(); } render&&render(); }catch(e){} });
  ensure('resetTimer', function(){ try{ timerRunning=false; timerMode='countdown'; timerCountdownMins=25; timerPlannedSecs=timerCountdownMins*60; timerSecs=timerPlannedSecs; activeSession=null; render&&render(); }catch(e){} });
  ensure('toggleTimerLayout', function(){ try{ timerLayout = (timerLayout==='rings')?'bars':'rings'; render&&render(); }catch(e){} });
  // Better setTimerMode behaviour: reset secs when switching modes
  ensure('setTimerMode', function(m){ try{ const prev = timerMode; timerMode = m||'countdown'; if(timerMode==='stopwatch'){ timerSecs = 0; }
    if(timerMode==='countdown'){ const mins = (typeof timerCountdownMins!=='undefined' && Number(timerCountdownMins))?Number(timerCountdownMins):25; timerPlannedSecs = mins*60; timerSecs = timerPlannedSecs; }
    render&&render(); }catch(e){} });
  ensure('setCountdownMins', function(n){ try{ let v = Number(n); if(isNaN(v)) v = 25; v = Math.min(240, Math.max(1, v)); timerCountdownMins = v; timerPlannedSecs = timerCountdownMins*60; if(timerMode==='countdown' && !timerRunning) timerSecs = timerPlannedSecs; render&&render(); }catch(e){} });

  // UI toggles
  ensure('toggleDark', function(){ try{ darkMode = !darkMode; if(typeof save==='function') save(); // flip theme object T
    if(typeof LIGHT !== 'undefined' && typeof DARK !== 'undefined'){ T = darkMode?DARK:LIGHT; }
    render&&render(); }catch(e){} });

  // Date rollover handler — used by tests to simulate day boundary
  ensure('_handleDateRollover', function(dateStr){ try{
    // Update last-date marker
    if(typeof dateStr==='string' && dateStr) _lastDateStr = dateStr; else _lastDateStr = new Date().toDateString();
    // Generate repeat tasks for new day
    if(typeof ensureRepeatTasksForToday==='function') ensureRepeatTasksForToday();
    // Reset alarms fired flags
    if(typeof alarms!=='undefined') alarms.forEach(a=>a.fired=false);
    // Reset day wizard / intentions for new day
    if(typeof dayWizardState!=='undefined'){ dayWizardState.startDone=false; dayWizardState.endDone=false; dayWizardOpen=false; }
    if(typeof dailyIntentions!=='undefined') dailyIntentions = {date:'',answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null};
    save&&save(); render&&render(); }catch(e){} });

  // Break timer
  ensure('startBreakTimer', function(mins){ try{ if(timerRunning) return; if(!focusTaskId){ showFocusModal=true; render&&render(); return; } timerSessionType='break'; timerMode='countdown'; timerCountdownMins = Number(mins)||5; timerPlannedSecs = timerCountdownMins*60; timerSecs = timerPlannedSecs; timerRunning=true; activeSession = { id:Date.now(), taskId: focusTaskId, startedAt: Date.now(), mode:'break', type:'break' }; if(!timerInterval && typeof setInterval==='function') timerInterval = setInterval(()=>{ if(timerRunning) timerSecs = Math.max(0, timerSecs-1); }, 1000); render&&render(); }catch(e){} });

  // Expose any extra names discovered in templates/tests that are reasonably safe noop aliases
  ['openFocusPicker','closeFocusPicker','openSessions','closeSessions','saveSessionEdit','cancelSessionEdit','deleteSession'].forEach(n=>{ if(typeof globalThis[n]==='undefined') globalThis[n]=root[n]; });

  // No-op aliases removed — prefer real implementations where available.
  const noopNames = [];
  noopNames.forEach(name=>{
    try{ if(typeof root[name]==='undefined') root[name]=function(){ try{ if(typeof render==='function') render(); }catch(e){} }; if(typeof globalThis!== 'undefined' && typeof globalThis[name]==='undefined') globalThis[name]=root[name]; }catch(e){}
  });

  // Transition helpers
  ensure('transitionSaveAndContinue', function(){ try{ const text = (typeof transitionReflect!=='undefined'&&transitionReflect)?transitionReflect:(document.getElementById?document.getElementById('transition-reflect-input')?.value||'':''); journalEntries = journalEntries||[]; journalEntries.unshift({id:Date.now(),type:'reflect',text,catId:'',createdAt:Date.now()}); if(typeof stopAndSaveTimer==='function') stopAndSaveTimer(true); showTransitionPrompt=false; transitionReflect=''; save&&save(); render&&render(); }catch(e){} });
  ensure('transitionSkip', function(){ try{ if(typeof stopAndSaveTimer==='function') stopAndSaveTimer(true); showTransitionPrompt=false; transitionReflect=''; save&&save(); render&&render(); }catch(e){} });

  // UI toggles
  ensure('toggleEnergyFilter', function(){ try{ energyFilterOn = !energyFilterOn; render&&render(); }catch(e){} });
  ensure('toggleTimeTargets', function(){ try{ showTimeTargets = !showTimeTargets; render&&render(); }catch(e){} });

  // Quick capture helper: adds a planner dump for today (or provided date)
  ensure('quickCapture', function(text, openPlanner){ try{
    const txt = String(text||'').trim(); if(!txt) return;
    const ymd = (typeof openPlanner==='string' && openPlanner)?openPlanner:dateToYMD(new Date());
    if(!plannerDayDumps) plannerDayDumps = {};
    if(!plannerDayDumps[ymd]) plannerDayDumps[ymd]=[];
    const item = { id: Date.now(), text: txt, catId:'', done:false, createdAt: Date.now() };
    plannerDayDumps[ymd].unshift(item);
    save&&save(); showToast && showToast('Captured','ok');
    if(openPlanner===true){ plannerOpenDump(ymd); }
    render&&render();
  }catch(e){}});

  // Task list controls
  ensure('filterTasks', function(f){ try{ taskFilter = f||'all'; render&&render(); }catch(e){} });
  ensure('setTaskSortMode', function(m){ try{ taskSortMode = m||'manual'; render&&render(); }catch(e){} });

  // Task time edit helpers
  ensure('startEditTaskTime', function(id){ try{ editingTimeId = id; render&&render(); }catch(e){} });
  ensure('cancelEditTaskTime', function(){ try{ editingTimeId = null; render&&render(); }catch(e){} });

  // Session edit starter
  ensure('startSessionEdit', function(sessionId){ try{ const s = (timeSessions||[]).find(x=>x.id===sessionId); if(!s) return; editingSessionId = sessionId; if(typeof secsToMmSs==='function') editingSessionMmSs = secsToMmSs(s.seconds||0); editingSessionSecs = s.seconds||0; render&&render(); }catch(e){} });

})();
