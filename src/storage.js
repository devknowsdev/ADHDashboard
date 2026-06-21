/*
MODULE: storage.js
LAYER: storage
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: storage.js responsibilities
USES: local modules
STATE_READS: T, darkMode, habits, tasks
STATE_WRITES: ID_MIGRATE, T, _saveTimer, alarms, allDefs, answers, audioRecordings, c, categories, clockColWidth
PUBLIC_API: _flushSave, load, loadAudioMeta, loadWidgetLayout, save, saveAudioMeta, saveNow, saveWidgetLayout
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Persistence and startup reads live here so the rest of the app can treat
// them as a single, well-defined boundary.

let _saveTimer=null;

function load(){
  try{
    const sc=localStorage.getItem('adhd4_cats');
    categories=sc?JSON.parse(sc):defaultCats.map(c=>({...c}));
    tasks=JSON.parse(localStorage.getItem('adhd4_tasks')||'[]');
    alarms=JSON.parse(localStorage.getItem('adhd4_alarms')||'[]');
    habits=JSON.parse(localStorage.getItem('adhd4_habits')||'[]');
    templates=JSON.parse(localStorage.getItem('adhd4_templates')||'[]');
    const fn=localStorage.getItem('adhd4_focus');
    if(fn){
      const parsed=JSON.parse(fn);
      focusTaskId=(parsed && typeof parsed==='object') ? (parsed.id ?? null) : parsed;
      focusSubtaskId=(parsed && typeof parsed==='object') ? (parsed.subtaskId ?? null) : null;
    }
    timeSessions=JSON.parse(localStorage.getItem('adhd4_time_sessions')||'[]');
    offTaskLog=JSON.parse(localStorage.getItem('adhd4_offtask')||'[]');
    try{journalEntries=JSON.parse(localStorage.getItem('adhd4_journal')||'[]');}catch(e){journalEntries=[];}
    dayStartHour=parseInt(localStorage.getItem('adhd4_day_start_hour')||'8',10)||8;
    dayEndHour=parseInt(localStorage.getItem('adhd4_day_end_hour')||'17',10)||17;
    taskSortMode=localStorage.getItem('adhd4_task_sort')||'manual';
    darkMode=localStorage.getItem('adhd4_dark')==='1';
    T=darkMode?DARK:LIGHT;
    crisisMode=localStorage.getItem('adhd4_crisis_mode')==='1';
    focusBoardMode=localStorage.getItem('adhd4_focus_board_mode')||'all';
    timerLayout=localStorage.getItem('adhd4_timer_layout')||'rings';
    clockColWidth=parseInt(localStorage.getItem('adhd4_clock_col_width')||'220',10)||220;
    try{focusBoardManualIds=JSON.parse(localStorage.getItem('adhd4_focus_board_manual')||'[]');}catch(e){focusBoardManualIds=[];}
    // plannedTasks removed — tasks with ts+durationMins is the source of truth
    try{plannerDayDumps=JSON.parse(localStorage.getItem('adhd4_day_dumps')||'{}');}catch(e){plannerDayDumps={};}
    loadWidgetLayout();
    try{energyLog=JSON.parse(localStorage.getItem('adhd4_energy')||'[]');}catch(e){energyLog=[];}
    try{
      const raw=JSON.parse(localStorage.getItem('adhd4_intentions')||'null');
      const todayStr2=new Date().toDateString();
      if(raw&&raw.date===todayStr2){
        if(raw.slots&&!raw.answers){
          dailyIntentions={date:todayStr2,answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null};
        } else {
          dailyIntentions=raw;
          if(!dailyIntentions.answers) dailyIntentions.answers={arriving:'',oneWin:'',derail:'',goodEnough:''};
          INTENTION_QUESTIONS.forEach(q=>{if(dailyIntentions.answers[q.key]===undefined)dailyIntentions.answers[q.key]='';});
          if(dailyIntentions.step===undefined) dailyIntentions.step=0;
          if(dailyIntentions.winOutcome===undefined) dailyIntentions.winOutcome=null;
        }
      } else {
        dailyIntentions={date:todayStr2,answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null};
      }
    }catch(e){dailyIntentions={date:new Date().toDateString(),answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null};}
    try{
      const rawWiz=JSON.parse(localStorage.getItem('adhd4_day_wizard')||'null');
      const todayYmd2=dateToYMD(new Date());
      if(rawWiz&&rawWiz.date===todayYmd2){
        dayWizardState=rawWiz;
        if(dayWizardState.wizBannerDismissedAt===undefined)dayWizardState.wizBannerDismissedAt=0;
      }else{
        dayWizardState={date:todayYmd2,phase:null,step:0,startDone:false,endDone:false,wizBannerDismissedAt:0};
      }
    }catch(e){
      dayWizardState={date:dateToYMD(new Date()),phase:null,step:0,startDone:false,endDone:false,wizBannerDismissedAt:0};
    }
    try{loadAudioMeta();}catch(e){audioRecordings=[];}
    const cutoff=Date.now()-90*24*60*60*1000;
    const tsBefore=timeSessions.length;
    timeSessions=timeSessions.filter(s=>(s.startedAt||0)>=cutoff);
    if(timeSessions.length!==tsBefore) localStorage.setItem('adhd4_time_sessions',JSON.stringify(timeSessions));
    const otBefore=offTaskLog.length;
    const todayStr=new Date().toDateString();
    offTaskLog=offTaskLog.filter(e=>{
      const ts=e.startedAt||(e.startTime?new Date(e.date+' '+e.startTime).getTime():0);
      return ts>=cutoff||e.date===todayStr;
    });
    if(offTaskLog.length!==otBefore) localStorage.setItem('adhd4_offtask',JSON.stringify(offTaskLog));
  }catch(e){
    categories=defaultCats.map(c=>({...c}));
  }
}

function save(){
  if(_saveTimer) clearTimeout(_saveTimer);
  _saveTimer=setTimeout(_flushSave, 300);
}

function saveNow(){
  if(_saveTimer){clearTimeout(_saveTimer);_saveTimer=null;}
  _flushSave();
}

function _flushSave(){
  _saveTimer=null;
  localStorage.setItem('adhd4_cats',JSON.stringify(categories));
  localStorage.setItem('adhd4_tasks',JSON.stringify(tasks));
  localStorage.setItem('adhd4_alarms',JSON.stringify(alarms));
  localStorage.setItem('adhd4_habits',JSON.stringify(habits));
  localStorage.setItem('adhd4_templates',JSON.stringify(templates));
  localStorage.setItem('adhd4_time_sessions',JSON.stringify(timeSessions));
  localStorage.setItem('adhd4_offtask',JSON.stringify(offTaskLog));
  localStorage.setItem('adhd4_journal',JSON.stringify(journalEntries));
  localStorage.setItem('adhd4_day_start_hour',String(dayStartHour));
  localStorage.setItem('adhd4_day_end_hour',String(dayEndHour));
  localStorage.setItem('adhd4_day_wizard',JSON.stringify(dayWizardState));
  localStorage.setItem('adhd4_task_sort',taskSortMode);
  localStorage.setItem('adhd4_dark',darkMode?'1':'0');
  localStorage.setItem('adhd4_crisis_mode',crisisMode?'1':'0');
  localStorage.setItem('adhd4_focus_board_mode',focusBoardMode);
  localStorage.setItem('adhd4_timer_layout',timerLayout);
  localStorage.setItem('adhd4_clock_col_width',String(clockColWidth));
  localStorage.setItem('adhd4_focus_board_manual',JSON.stringify(focusBoardManualIds));
  localStorage.setItem('adhd4_day_dumps',JSON.stringify(plannerDayDumps));
  saveWidgetLayout();
  localStorage.setItem('adhd4_energy',JSON.stringify(energyLog));
  localStorage.setItem('adhd4_intentions',JSON.stringify(dailyIntentions));
  if(focusTaskId!=null)localStorage.setItem('adhd4_focus',JSON.stringify({id:focusTaskId,subtaskId:focusSubtaskId??null}));
  else localStorage.removeItem('adhd4_focus');
  invalidateAvoidanceCache();
  invalidateTaskHitsCache();
}

window.addEventListener('beforeunload',saveNow);

function loadAudioMeta(){
  try{
    audioRecordings=JSON.parse(localStorage.getItem('adhd4_audio_meta')||'[]');
  }catch(e){audioRecordings=[];}
}

function saveAudioMeta(){
  localStorage.setItem('adhd4_audio_meta',JSON.stringify(audioRecordings));
}

function loadWidgetLayout(){
  // ID migration map: old IDs → new merged widget IDs
  // NOTE: 'habits' intentionally removed — it is now a standalone widget again.
  const ID_MIGRATE={'timer':'focusboard','alarms':'focusboard','focustimer':'focusboard','intentions':'checkin','energy':'checkin','braindump':'journal','voicenotes':'journal'};
  // All widgets now live in the registry — WIDGETS array removed from constants.js
  const allDefs=getRegisteredWidgets();
  try{
    let raw=JSON.parse(localStorage.getItem('adhd4_widget_layout')||'null');
    // Migrate old IDs; force tools + habits visible for existing users who never had them
    if(raw) raw=raw.map(w=>({...w, id: ID_MIGRATE[w.id]||w.id, visible: (w.id==='tools'||w.id==='habits')?true:w.visible}))
                    .filter((w,i,arr)=>arr.findIndex(x=>x.id===w.id)===i); // dedupe merged
    widgetLayout=allDefs.map((def,i)=>{
      const saved=raw?raw.find(x=>x.id===def.id):null;
      return {
        id:def.id,
        visible: saved ? saved.visible : def.defaultVisible!==false,
        collapsed: saved ? (saved.collapsed||false) : false,
        order: saved!=null && saved.order!=null ? saved.order : i,
      };
    });
  }catch(e){
    widgetLayout=allDefs.map((def,i)=>({id:def.id,visible:def.defaultVisible!==false,collapsed:false,order:i}));
  }
}

function saveWidgetLayout(){
  localStorage.setItem('adhd4_widget_layout',JSON.stringify(widgetLayout));
}
