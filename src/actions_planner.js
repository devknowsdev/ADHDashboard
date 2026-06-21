/*
MODULE: actions_planner.js
LAYER: actions
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: actions_planner.js responsibilities
USES: local modules
STATE_READS: state, tasks
STATE_WRITES: TL_END_HOUR, TL_LABEL_W, TL_MIN_DUR, TL_PX_PER_MIN, TL_SNAP, TL_START_HOUR, TL_TOTAL_PX, arr, clickMins, curEndMins
PUBLIC_API: _tlClamp, _tlEventToMins, _tlMinsToHHMM, _tlMinsToX, _tlMinsToY, _tlSnap, _tlXToMins, _tlYToMins, plannerAddDump, plannerDeleteDump, plannerGoToMonth, plannerGoToWeek
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-22
*/

// Planner widget actions — timeline navigation, drag-to-create/move/resize/copy,
// task jump-highlight, and date helpers.
// Depends on: state.js, storage.js (save), ui.js (showToast), render.js (render),
//             helpers.js (normalizeTaskTime, nextTaskOrder, dateToYMD, ymdToDate,
//             todayYMD, _blurForRender), actions_tasktimer.js.

// dateToYMD, ymdToDate, todayYMD moved to helpers.js (HANDOFF_task_scope_and_dump.md)
// — general-purpose date utilities, not planner-specific; helpers.js loads first
// and needed them for getVisibleTasksSorted().

// ── Timeline constants ────────────────────────────────────────────────────────
var TL_START_HOUR=6;      // first visible hour
var TL_END_HOUR=24;       // last visible hour (exclusive — shows up to 23:55)
var TL_PX_PER_MIN=0.9;    // pixels per minute (reduced from 1.4 for better overview)
var TL_SNAP=5;            // snap increment in minutes
var TL_LABEL_W=38;        // px width of hour-label column
var TL_TOTAL_PX=Math.round((TL_END_HOUR-TL_START_HOUR)*60*TL_PX_PER_MIN);
var TL_MIN_DUR=15;        // minimum block duration in minutes

// ── Timeline coordinate helpers ───────────────────────────────────────────────
function _tlMinsToY(mins, zoom){
  const z=zoom||plannerZoom||1;
  return Math.round((mins-TL_START_HOUR*60)*TL_PX_PER_MIN*z);
}
function _tlYToMins(y,scrollEl,zoom){
  const z=zoom||plannerZoom||1;
  const scrollTop=scrollEl?scrollEl.scrollTop:0;
  return (y+scrollTop)/(TL_PX_PER_MIN*z)+TL_START_HOUR*60;
}
// Horizontal axis equivalents
function _tlMinsToX(mins, zoom){
  const z=zoom||plannerZoom||1;
  return Math.round((mins-TL_START_HOUR*60)*TL_PX_PER_MIN*z);
}
function _tlXToMins(x,scrollEl,zoom){
  const z=zoom||plannerZoom||1;
  const scrollLeft=scrollEl?scrollEl.scrollLeft:0;
  return (x+scrollLeft)/(TL_PX_PER_MIN*z)+TL_START_HOUR*60;
}
function _tlSnap(mins){
  return Math.round(mins/TL_SNAP)*TL_SNAP;
}
function _tlClamp(mins){
  return Math.max(TL_START_HOUR*60,Math.min(TL_END_HOUR*60-TL_MIN_DUR,mins));
}
function _tlMinsToHHMM(mins){
  const h=Math.floor(mins/60)%24,m=mins%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}

// ── Month navigation ──────────────────────────────────────────────────────────
function plannerNavMonth(delta){
  if(!plannerMonth){const n=new Date();plannerMonth={year:n.getFullYear(),month:n.getMonth()};}
  let m=plannerMonth.month+delta,y=plannerMonth.year;
  if(m>11){m=0;y++;}if(m<0){m=11;y--;}
  plannerMonth={year:y,month:m};render();
}
function plannerSelectDate(ymd){plannerOpenDump(ymd);}
function plannerGoToMonth(){plannerView='month';plannerSelectedDate=null;render();}

// ── plannerJumpToTask: scroll Tasks widget to a task row and briefly highlight ──
function plannerJumpToTask(taskId){
  plannerHighlightTaskId=taskId;
  render();
  // Scroll the task row into view after render, then clear highlight after 1.5s
  setTimeout(()=>{
    const el=document.querySelector('[data-task-id="'+taskId+'"]');
    if(el) el.scrollIntoView({behavior:'smooth',block:'nearest'});
  },50);
  setTimeout(()=>{plannerHighlightTaskId=null;render();},1500);
}

// tlPillClick: click without drag → jump to task in Tasks widget
function tlPillClick(taskId){
  // If drag moved significantly, ignore — pointer handlers set timelineDragState=null on commit
  plannerJumpToTask(taskId);
}

// ── Day dump view actions ─────────────────────────────────────────────────────
function plannerOpenDump(ymd){
  plannerSelectedDate=ymd;
  plannerView='dump';
  plannerDumpInput='';
  render();
  setTimeout(()=>{const el=document.getElementById('planner-dump-input');if(el)el.focus();},0);
}
function plannerOpenTimeline(ymd){
  plannerSelectedDate=ymd;
  plannerView='day';
  render();
  // Auto-scroll to current time or 8am
  setTimeout(()=>{
    const sc=document.querySelector('.tl-scroll');
    if(!sc)return;
    const now=new Date();
    const isToday=ymd===dateToYMD(now);
    const targetMins=isToday?now.getHours()*60+now.getMinutes():8*60;
    if(plannerDayLayout==='horizontal'){
      sc.scrollLeft=Math.max(0,_tlMinsToX(targetMins)-120);
    } else {
      sc.scrollTop=Math.max(0,_tlMinsToY(targetMins)-80);
    }
  },60);
}
function plannerAddDump(ymd){
  const text=(plannerDumpInput||'').trim();
  if(!text)return;
  if(!plannerDayDumps[ymd]) plannerDayDumps[ymd]=[];
  plannerDayDumps[ymd].unshift({id:Date.now(),text,catId:'',done:false,createdAt:Date.now()});
  plannerDumpInput='';
  // Fix: render-clobber bug — #planner-dump-input lives in a data-no-clobber
  // wrapper (_renderPlannerDump) and was still focused when render() ran, so
  // the captured item never painted until something else forced a full render.
  _blurForRender('planner-dump-input');
  save();render();
  setTimeout(()=>{const el=document.getElementById('planner-dump-input');if(el)el.focus();},0);
}
function plannerToggleDump(ymd,id){
  const arr=plannerDayDumps[ymd];if(!arr)return;
  const item=arr.find(x=>x.id===id);if(!item)return;
  item.done=!item.done;save();render();
}
function plannerDeleteDump(ymd,id){
  if(!plannerDayDumps[ymd])return;
  plannerDayDumps[ymd]=plannerDayDumps[ymd].filter(x=>x.id!==id);
  save();render();
}
function plannerPromoteDump(ymd,id){
  const arr=plannerDayDumps[ymd];if(!arr)return;
  const item=arr.find(x=>x.id===id);if(!item)return;
  const now=Date.now();
  tasks.push({
    id:now,text:item.text,catId:item.catId||'',done:false,status:'todo',
    taskScope:'day',doneDate:'',
    ts:'',durationMins:null,order:nextTaskOrder(),createdAt:now,
    repeat:null,templateId:null,generatedForDate:null,
    pinned:false,energyRequired:null,anxiety:0,urgency:0,
    subtasks:[],estimatedMins:null,note:'',
  });
  plannerDayDumps[ymd]=arr.filter(x=>x.id!==id);
  save();showToast('"'+item.text+'" added to Tasks','ok');render();
}

// ── Zoom + layout ─────────────────────────────────────────────────────────────
function plannerSetZoom(v){
  plannerZoom=Math.max(0.4,Math.min(2.5,parseFloat(v)||1));
  render();
}
function plannerNudgeZoom(delta){
  plannerZoom=Math.max(0.4,Math.min(2.5,Math.round((plannerZoom+delta)*10)/10));
  render();
}
function plannerSetDayLayout(layout){
  plannerDayLayout=layout;
  render();
  // Re-scroll to current time after layout switch
  setTimeout(()=>{
    const sc=document.querySelector('.tl-scroll');
    if(!sc||!plannerSelectedDate)return;
    const now=new Date();
    const isToday=plannerSelectedDate===dateToYMD(now);
    const targetMins=isToday?now.getHours()*60+now.getMinutes():8*60;
    if(plannerDayLayout==='vertical'){
      const px=_tlMinsToY(targetMins,plannerZoom);
      sc.scrollTop=Math.max(0,px-80);
    } else {
      const px=_tlMinsToX(targetMins,plannerZoom);
      sc.scrollLeft=Math.max(0,px-120);
    }
  },60);
}
function plannerGoToWeek(){plannerView='week';render();}
function skipIntention(todayStr){
  ensureIntentionsToday(todayStr);
  const qi=typeof dailyIntentions.step==='number'?dailyIntentions.step:0;
  const q=INTENTION_QUESTIONS[qi];
  if(q&&!(dailyIntentions.answers[q.key]||'').trim()){
    dailyIntentions.answers[q.key]='—'; // mark as explicitly skipped
  }
  if(qi>=INTENTION_QUESTIONS.length-1){
    dailyIntentions.step='done';
  } else {
    dailyIntentions.step=qi+1;
  }
  dailyIntentions.date=todayStr;
  save();render();
}

// ── tlClearTaskTime: remove ts + durationMins from a task ────────────────────
function tlClearTaskTime(taskId){
  const t=tasks.find(x=>x.id===taskId);if(!t)return;
  t.ts='';t.durationMins=null;
  save();render();
}

// ── tlCommitNewTask / tlCancelNewTask ─────────────────────────────────────────
function tlCommitNewTask(){
  if(!timelineNewTaskDraft)return;
  const text=timelineNewTaskText.trim();
  if(!text){showToast('Enter a task name','warn');return;}
  const {startMins,endMins}=timelineNewTaskDraft;
  const dur=endMins-startMins;
  const ts=_tlMinsToHHMM(startMins);
  const now=Date.now();
  tasks.push({
    id:now,text,catId:timelineNewTaskCatId||'',done:false,status:'todo',
    ts:normalizeTaskTime(ts)||ts,
    durationMins:Math.max(TL_MIN_DUR,dur),
    order:nextTaskOrder(),createdAt:now,
    repeat:null,templateId:null,generatedForDate:null,
    pinned:false,energyRequired:null,anxiety:0,urgency:0,
    subtasks:[],estimatedMins:null,note:'',
  });
  timelineNewTaskDraft=null;timelineNewTaskText='';timelineNewTaskCatId='';
  save();showToast('"'+text+'" added to timeline','ok');render();
}
function tlCancelNewTask(){
  timelineNewTaskDraft=null;timelineNewTaskText='';timelineNewTaskCatId='';
  render();
}

// ── Pointer event helpers — layout-aware ─────────────────────────────────────
function _tlEventToMins(e, scrollEl){
  const rect=scrollEl.getBoundingClientRect();
  if(plannerDayLayout==='horizontal'){
    return _tlXToMins(e.clientX-rect.left, scrollEl);
  }
  return _tlYToMins(e.clientY-rect.top, scrollEl);
}

// tlCreateStart: pointerdown on empty timeline grid → begin drag-to-create
function tlCreateStart(e,scrollEl){
  if(e.button!==0)return;
  e.preventDefault();
  const rawMins=_tlEventToMins(e,scrollEl);
  const startMins=_tlClamp(_tlSnap(rawMins));
  timelineDragState={type:'create',startMins,curMins:startMins,scroll:scrollEl};
  timelineNewTaskDraft={startMins,endMins:startMins+TL_MIN_DUR};
  timelineNewTaskText='';timelineNewTaskCatId='';
  scrollEl.setPointerCapture(e.pointerId);
  render();
}

// tlMoveStart: pointerdown on a pill body → begin move (or alt-copy)
function tlMoveStart(e,taskId,scrollEl){
  if(e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  const t=tasks.find(x=>x.id===taskId);if(!t)return;
  const [th,tm]=t.ts.split(':').map(Number);
  const origMins=th*60+tm;
  const clickMins=_tlEventToMins(e,scrollEl);
  const offsetMins=clickMins-origMins;
  timelineDragState={
    type:'move',taskId,
    startMins:origMins,curMins:origMins,
    offsetMins,
    origTs:t.ts,origDur:t.durationMins||30,
    scroll:scrollEl,
    altCopy:e.altKey||e.ctrlKey,
    moved:false,
  };
  scrollEl.setPointerCapture(e.pointerId);
}

// tlResizeStart: pointerdown on pill resize handle → begin resize
function tlResizeStart(e,taskId,scrollEl){
  if(e.button!==0)return;
  e.preventDefault();e.stopPropagation();
  const t=tasks.find(x=>x.id===taskId);if(!t)return;
  const [th,tm]=t.ts.split(':').map(Number);
  timelineDragState={
    type:'resize',taskId,
    startMins:th*60+tm,
    origDur:t.durationMins||30,
    scroll:scrollEl,
  };
  scrollEl.setPointerCapture(e.pointerId);
}

// tlPointerMove: update drag state and DOM-patch without full render
function tlPointerMove(e,scrollEl){
  if(!timelineDragState)return;
  e.preventDefault();
  const ds=timelineDragState;
  const rawMins=_tlEventToMins(e,scrollEl);
  const z=plannerZoom;
  const pxPerMin=TL_PX_PER_MIN*z;
  const isH=plannerDayLayout==='horizontal';

  if(ds.type==='create'){
    const curMins=_tlClamp(_tlSnap(rawMins));
    const startMins=Math.min(ds.startMins,curMins);
    const endMins=Math.max(ds.startMins,curMins)+TL_MIN_DUR;
    timelineNewTaskDraft={startMins,endMins};
    const pill=document.getElementById('tl-draft-pill');
    const label=document.getElementById('tl-draft-label');
    if(pill){
      const sz=Math.max(TL_SNAP*pxPerMin,(endMins-startMins)*pxPerMin);
      if(isH){pill.style.left=_tlMinsToX(startMins)+'px';pill.style.width=sz+'px';}
      else   {pill.style.top=_tlMinsToY(startMins)+'px';pill.style.height=sz+'px';}
    }
    if(label) label.textContent=_tlMinsToHHMM(startMins)+' – '+_tlMinsToHHMM(endMins);
    return;
  }

  if(ds.type==='move'){
    const snapped=_tlClamp(_tlSnap(rawMins-(ds.offsetMins||0)));
    ds.curMins=snapped;ds.moved=true;
    const pill=document.getElementById('tl-pill-'+ds.taskId);
    if(pill){
      if(isH) pill.style.left=_tlMinsToX(snapped)+'px';
      else    pill.style.top=_tlMinsToY(snapped)+'px';
      const lbl=pill.querySelector('.tl-time');
      if(lbl) lbl.textContent=_tlMinsToHHMM(snapped)+' – '+_tlMinsToHHMM(snapped+(ds.origDur||30));
    }
    return;
  }

  if(ds.type==='resize'){
    const t=tasks.find(x=>x.id===ds.taskId);if(!t)return;
    const [th,tm]=t.ts.split(':').map(Number);
    const startMins=th*60+tm;
    const newEndMins=_tlClamp(_tlSnap(rawMins));
    const newDur=Math.max(TL_MIN_DUR,newEndMins-startMins);
    const pill=document.getElementById('tl-pill-'+ds.taskId);
    if(pill){
      const sz=Math.max(TL_SNAP*pxPerMin,newDur*pxPerMin);
      if(isH) pill.style.width=sz+'px';
      else    pill.style.height=sz+'px';
    }
    ds.curEndMins=newEndMins;
  }
}

// tlPointerUp: commit the drag
function tlPointerUp(e,scrollEl){
  if(!timelineDragState)return;
  const ds=timelineDragState;
  timelineDragState=null;

  if(ds.type==='create'){
    render();
    setTimeout(()=>{const el=document.getElementById('tl-new-task-input');if(el)el.focus();},0);
    return;
  }

  if(ds.type==='move'){
    if(!ds.moved){render();return;}
    const t=tasks.find(x=>x.id===ds.taskId);if(!t){render();return;}
    if(ds.altCopy){
      const now=Date.now();
      const newTs=_tlMinsToHHMM(ds.curMins);
      tasks.push({...t,id:now,ts:normalizeTaskTime(newTs)||newTs,createdAt:now,order:nextTaskOrder(),subtasks:[],done:false,status:'todo',templateId:null,generatedForDate:null});
      save();showToast('Copied to '+newTs,'ok');
    } else {
      const newTs=_tlMinsToHHMM(ds.curMins);
      t.ts=normalizeTaskTime(newTs)||newTs;
      save();
    }
    render();return;
  }

  if(ds.type==='resize'){
    const t=tasks.find(x=>x.id===ds.taskId);if(!t){render();return;}
    if(ds.curEndMins!=null){
      const [th,tm]=t.ts.split(':').map(Number);
      t.durationMins=Math.max(TL_MIN_DUR,ds.curEndMins-(th*60+tm));
      save();
    }
    render();
  }
}
