/*
MODULE: actions_tasks.js
LAYER: actions
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: actions_tasks.js responsibilities
USES: local modules
STATE_READS: T, habits, state, tasks
STATE_WRITES: _ST_QL_PILLS, active, added, addingSubtaskForTaskId, already, background, boardCardNoteEditId, border, bpm, btn
PUBLIC_API: addSubtask, addToFocusBoard, cancelEditEstimate, cancelEditOffTask, cancelEditSubtaskEstimate, closeAddSubtask, closeNoteEdit, closeSubtaskQuickLog, commitSubtaskQuickLog, deleteHabit, deleteOffTask, deleteSubtask
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Subtask management, task editing (cat, pin, repeat, estimate, notes, music meta),
// drag-to-reorder (tasks + subtasks), focus board mode, and off-task log.
// Depends on: core.js (btnStyle, inputStyle), helpers.js (esc, getTask, getSubtask,
//             fmtDur, parseTimeInput, nextTaskOrder, getTotalForSubtask),
//             state.js, storage.js (save), ui.js (showToast), render.js (render, renderNow),
//             actions_tasktimer.js (openQuickLog), actions_alarms_habits.js (deleteHabit).
// ---- Subtask management ----
function toggleSubtaskExpand(taskId){
  if(expandedSubtaskTaskIds.has(taskId)) expandedSubtaskTaskIds.delete(taskId);
  else expandedSubtaskTaskIds.add(taskId);
  render();
}
function toggleBoardSubExpand(taskId){
  if(boardSubExpandedTaskIds.has(taskId)) boardSubExpandedTaskIds.delete(taskId);
  else boardSubExpandedTaskIds.add(taskId);
  render();
}
// Item 12: set focus to a subtask from the board card pill
function setFocusSubtaskOnBoard(taskId,subtaskId){
  const t=getTask(taskId);if(!t||t.done)return;
  const st=getSubtask(taskId,subtaskId);if(!st||st.done)return;
  focusTaskId=taskId;
  focusSubtaskId=subtaskId;
  save();render();
}
function openAddSubtask(taskId){
  addingSubtaskForTaskId=taskId;
  expandedSubtaskTaskIds.add(taskId);
  render();
  setTimeout(()=>{const el=document.getElementById('subtask-add-input-'+taskId);if(el)el.focus();},0);
}
function closeAddSubtask(){addingSubtaskForTaskId=null;render();}
function addSubtask(taskId){
  const inp=document.getElementById('subtask-add-input-'+taskId);if(!inp)return;
  const text=inp.value.trim();if(!text)return;
  const t=getTask(taskId);if(!t)return;
  if(!t.subtasks)t.subtasks=[];
  const order=t.subtasks.length;
  t.subtasks.push({id:Date.now(),text,done:false,order,practiceCount:0});
  inp.value='';
  save();renderNow();
  setTimeout(()=>{const el=document.getElementById('subtask-add-input-'+taskId);if(el)el.focus();},0);
}
function toggleSubtask(taskId,subtaskId){
  const t=getTask(taskId);if(!t)return;
  const st=(t.subtasks||[]).find(s=>s.id===subtaskId);if(!st)return;
  st.done=!st.done;
  if(st.done&&focusTaskId===taskId&&focusSubtaskId===subtaskId){focusSubtaskId=null;}
  save();renderNow();
}
function deleteSubtask(taskId,subtaskId){
  const t=getTask(taskId);if(!t)return;
  t.subtasks=(t.subtasks||[]).filter(s=>s.id!==subtaskId);
  timeSessions=timeSessions.filter(s=>!(s.taskId===taskId&&s.subtaskId===subtaskId));
  if(focusTaskId===taskId&&focusSubtaskId===subtaskId)focusSubtaskId=null;
  save();render();
}
function incrementSubtaskPractice(taskId,subtaskId){
  const t=getTask(taskId);if(!t)return;
  const st=(t.subtasks||[]).find(s=>s.id===subtaskId);if(!st)return;
  st.practiceCount=(st.practiceCount||0)+1;
  save();render();
}
function resetSubtaskPractice(taskId,subtaskId){
  const t=getTask(taskId);if(!t)return;
  const st=(t.subtasks||[]).find(s=>s.id===subtaskId);if(!st)return;
  if(!confirm(`Reset practice count for "${st.text}" to 0?`))return;
  st.practiceCount=0;
  save();render();
}

function setTaskCat(taskId,catId){
  const t=getTask(taskId);if(!t)return;
  t.catId=catId;
  editingTaskCatId=null;
  save();render();
}
function pinTask(id){
  const t=getTask(id);if(!t)return;
  t.pinned=!t.pinned;
  if(t.pinned){
    if(t.done){t.done=false;t.status='todo';}
    if(!habits.find(h=>h.name===t.text)){
      habits.push({id:Date.now(),name:t.text,catId:t.catId||'',hits:[],anchor:null,anchorOrder:0});
    }
  }
  save();render();
}
function ensureRepeatTasksForToday(){
  const todayStr=new Date().toDateString();
  const dayOfWeek=new Date().getDay();
  const repeatTemplateTasks=[...tasks.filter(t=>t.repeat!=null&&t.templateId==null)];
  repeatTemplateTasks.forEach(tmpl=>{
    // Check if today matches schedule
    let matches=false;
    if(tmpl.repeat==='daily') matches=true;
    else if(tmpl.repeat==='weekdays') matches=dayOfWeek>=1&&dayOfWeek<=5;
    else if(tmpl.repeat==='weekly') matches=new Date(tmpl.createdAt).getDay()===dayOfWeek;
    if(!matches) return;
    const already=tasks.find(t=>t.templateId===tmpl.id&&t.generatedForDate===todayStr);
    if(!already){
      const now=Date.now();
      tasks.push({...tmpl,id:now,templateId:tmpl.id,generatedForDate:todayStr,done:false,status:'todo',taskScope:'day',doneDate:'',createdAt:now,order:nextTaskOrder(),repeat:null,subtasks:[]});
    }
  });
}
function saveAsTemplate(){
  const name=prompt('Template name:');
  if(!name||!name.trim()) return;
  const tasksCopy=tasks.filter(t=>!t.done).map(t=>({text:t.text,catId:t.catId,ts:t.ts}));
  templates.push({id:Date.now(),name:name.trim(),tasks:tasksCopy});
  save();showToast('Template saved: '+name.trim(),'ok');render();
}
function loadTemplate(templateId){
  const tmpl=templates.find(t=>t.id==templateId);
  if(!tmpl) return;
  const existingTexts=new Set(tasks.map(t=>t.text.toLowerCase()));
  let added=0;
  tmpl.tasks.forEach(tt=>{
    if(!existingTexts.has(tt.text.toLowerCase())){
      const now=Date.now()+added;
      tasks.push({id:now,text:tt.text,catId:tt.catId||'',done:false,ts:tt.ts||'',order:nextTaskOrder(),createdAt:now,repeat:null,templateId:null,generatedForDate:null,pinned:false});
      added++;
    }
  });
  save();showToast(`Loaded template: ${tmpl.name} (+${added} tasks)`,'ok');render();
}
function saveOffTask(){
  const sIn=document.getElementById('offtask-start');
  const eIn=document.getElementById('offtask-end');
  const nIn=document.getElementById('offtask-note');
  if(!sIn||!eIn) return;
  const sv=sIn.value.trim(),ev=eIn.value.trim();
  if(!sv||!ev){showToast('Enter start and end times','warn');return;}
  const [sh,sm]=sv.split(':').map(Number);
  const [eh,em]=ev.split(':').map(Number);
  if(isNaN(sh)||isNaN(sm)||isNaN(eh)||isNaN(em)){showToast('Use HH:MM format','warn');return;}
  const startMins=sh*60+sm,endMins=eh*60+em;
  if(endMins<=startMins){showToast('End time must be after start','warn');return;}
  const secs=(endMins-startMins)*60;
  const todayStr=new Date().toDateString();
  offTaskLog.push({id:Date.now(),date:todayStr,startTime:sv,endTime:ev,seconds:secs,note:(nIn?nIn.value.trim():'')});
  sIn.value='';eIn.value='';if(nIn)nIn.value='';
  save();render();
}
function deleteOffTask(id){
  offTaskLog=offTaskLog.filter(e=>e.id!==id);
  save();render();
}
function startEditOffTask(id){editingOffTaskId=id;render();}
function saveEditOffTask(id){
  const e=offTaskLog.find(x=>x.id===id);if(!e) return;
  const sIn=document.getElementById('offtask-edit-start-'+id);
  const eIn=document.getElementById('offtask-edit-end-'+id);
  const nIn=document.getElementById('offtask-edit-note-'+id);
  if(!sIn||!eIn) return;
  const sv=sIn.value.trim(),ev=eIn.value.trim();
  const [sh,sm]=sv.split(':').map(Number);
  const [eh,em]=ev.split(':').map(Number);
  if(isNaN(sh)||isNaN(sm)||isNaN(eh)||isNaN(em)){showToast('Use HH:MM format','warn');return;}
  const startMins=sh*60+sm,endMins=eh*60+em;
  if(endMins<=startMins){showToast('End time must be after start','warn');return;}
  e.startTime=sv;e.endTime=ev;e.seconds=(endMins-startMins)*60;
  if(nIn)e.note=nIn.value.trim();
  editingOffTaskId=null;save();render();
}
function cancelEditOffTask(){editingOffTaskId=null;render();}

// ---- Estimation functions ----
function startEditEstimate(id){editingEstimateId=id;editingTimeId=null;render();setTimeout(()=>{const el=document.getElementById('est-input-'+id);if(el){el.focus();el.select();}},0);}

// Item 10: Inline note editing
function openNoteEdit(taskId){
  expandedNoteTaskId=taskId;
  render();
  setTimeout(()=>{const el=document.getElementById('task-note-textarea-'+taskId);if(el){el.focus();}},0);
}
function closeNoteEdit(taskId){
  // Save from DOM before closing
  const el=document.getElementById('task-note-textarea-'+taskId);
  if(el){
    const t=getTask(taskId);
    if(t){t.note=el.value;save();}
  }
  expandedNoteTaskId=null;
  render();
}
function saveNoteBlur(taskId){
  const el=document.getElementById('task-note-textarea-'+taskId);
  if(el){
    const t=getTask(taskId);
    if(t){t.note=el.value;save();}
  }
  expandedNoteTaskId=null;
  render();
}

// Board card inline note editing
function openBoardCardNote(taskId){
  boardCardNoteEditId=taskId;
  render();
  setTimeout(()=>{const el=document.getElementById('board-note-textarea-'+taskId);if(el){el.focus();}},0);
}
function saveBoardCardNoteBlur(taskId){
  const el=document.getElementById('board-note-textarea-'+taskId);
  if(el){const t=getTask(taskId);if(t){t.note=el.value.trim();save();}}
  boardCardNoteEditId=null;
  render();
}
function saveBoardCardNote(taskId){
  const el=document.getElementById('board-note-textarea-'+taskId);
  if(el){const t=getTask(taskId);if(t){t.note=el.value.trim();save();}}
  boardCardNoteEditId=null;
  render();
}

// Item 11: Subtask quick-log popover
function openSubtaskQuickLog(taskId,subtaskId){
  subtaskQuickLogId={taskId,subtaskId};
  subtaskQuickLogInput='';
  render();
  setTimeout(()=>{const el=document.getElementById('st-ql-input');if(el){el.focus();}},0);
}
function closeSubtaskQuickLog(){subtaskQuickLogId=null;subtaskQuickLogInput='';render();}
function commitSubtaskQuickLog(){
  if(!subtaskQuickLogId) return;
  const secs=parseTimeInput(subtaskQuickLogInput);
  if(!secs||secs<=0){showToast('Enter a valid time','warn');return;}
  const endAt=Date.now();
  const startedAt=endAt-secs*1000;
  timeSessions.push({id:Date.now(),taskId:subtaskQuickLogId.taskId,subtaskId:subtaskQuickLogId.subtaskId,startedAt,endedAt:endAt,seconds:secs,mode:'manual',type:'work'});
  const st=getSubtask(subtaskQuickLogId.taskId,subtaskQuickLogId.subtaskId);
  showToast(`+${fmtDur(secs)} logged${st?' to "'+st.text+'"':''}`, 'ok');
  subtaskQuickLogId=null;subtaskQuickLogInput='';
  save();render();
}

// Targeted DOM patch for subtask quick-log input — no full render(), no focus loss
const _ST_QL_PILLS=[5,10,15,25,30,45];
function stQlInputChange(val){
  subtaskQuickLogInput=val;
  const previewSecs=parseTimeInput(val);
  const displayEl=document.getElementById('st-ql-preview');
  if(displayEl){
    displayEl.textContent=previewSecs>0?fmtDur(previewSecs):'—';
    displayEl.style.color=previewSecs>0?T.accent:T.muted2;
  }
  _ST_QL_PILLS.forEach(m=>{
    const btn=document.getElementById('st-ql-pill-'+m);
    if(!btn) return;
    const active=previewSecs===m*60;
    btn.style.border=`1.5px solid ${active?T.accent2:T.border}`;
    btn.style.background=active?T.accent2:'transparent';
    btn.style.color=active?'#fff':T.muted;
  });
  const logBtn=document.getElementById('st-ql-log-btn');
  if(logBtn){
    logBtn.disabled=!(previewSecs>0);
    logBtn.style.opacity=previewSecs>0?'1':'0.45';
    logBtn.style.cursor=previewSecs>0?'pointer':'not-allowed';
  }
}
function stQlPickPill(mins){
  subtaskQuickLogInput=mins+'m';
  const inp=document.getElementById('st-ql-input');
  if(inp){inp.value=subtaskQuickLogInput;inp.focus();inp.select();}
  stQlInputChange(subtaskQuickLogInput);
}
function saveEstimate(id,val){
  const t=getTask(id);if(!t)return;
  const n=parseInt(val,10);
  t.estimatedMins=(isNaN(n)||n<=0)?null:Math.min(n,9999);
  editingEstimateId=null;save();render();
}
function cancelEditEstimate(){editingEstimateId=null;render();}

// Subtask estimate editing
function startEditSubtaskEstimate(taskId,subtaskId){
  editingSubtaskEstimateId={taskId,subtaskId};
  render();
  setTimeout(()=>{const el=document.getElementById('st-est-input-'+subtaskId);if(el){el.focus();el.select();}},0);
}
function cancelEditSubtaskEstimate(){editingSubtaskEstimateId=null;render();}
function saveSubtaskEstimate(taskId,subtaskId,val){
  const t=getTask(taskId);if(!t)return;
  const st=(t.subtasks||[]).find(s=>s.id===subtaskId);if(!st)return;
  const n=parseInt(val,10);
  st.estimatedMins=(isNaN(n)||n<=0)?null:Math.min(n,9999);
  editingSubtaskEstimateId=null;
  save();render();
}
// Music meta
function saveMusicField(taskId,subtaskId,field,val){
  const t=getTask(taskId);if(!t)return;
  const st=(t.subtasks||[]).find(s=>s.id===subtaskId);if(!st)return;
  if(!st.musicMeta) st.musicMeta={key:'',tuning:'',bpm:null,lyrics:''};
  if(field==='bpm'){const n=parseInt(val,10);st.musicMeta.bpm=(isNaN(n)||n<20||n>300)?null:n;}
  else st.musicMeta[field]=val.trim();
  editingMusicField=null;save();render();
}
function openMusicField(taskId,subtaskId,field){
  editingMusicField={taskId,subtaskId,field};expandedLyricsId=null;render();
  setTimeout(()=>{const el=document.getElementById(`music-field-${taskId}-${subtaskId}-${field}`);if(el){el.focus();el.select();}},0);
}
function saveLyrics(taskId,subtaskId,val){
  const t=getTask(taskId);if(!t)return;
  const st=(t.subtasks||[]).find(s=>s.id===subtaskId);if(!st)return;
  if(!st.musicMeta) st.musicMeta={key:'',tuning:'',bpm:null,lyrics:''};
  st.musicMeta.lyrics=val;
  save();
}
// Drag-and-drop
function dragStart(e,id){e.dataTransfer.effectAllowed='move';dragSourceId=id;}
function dragOver(e){e.preventDefault();e.dataTransfer.dropEffect='move';e.currentTarget.style.outline=`2px dashed ${T.accent2}`;}
function drop(e,targetId){
  e.preventDefault();
  e.currentTarget.style.outline='';
  if(dragSourceId===targetId||dragSourceId==null) return;
  const src=getTask(dragSourceId),tgt=getTask(targetId);
  if(!src||!tgt) return;
  const tmp=src.order;src.order=tgt.order;tgt.order=tmp;
  save();render();dragSourceId=null;
}
function dragEnd(e){
  if(e&&e.currentTarget) e.currentTarget.style.outline='';
  if(dragSourceId!=null){dragSourceId=null;render();}
}

// ── Subtask drag-to-reorder ───────────────────────────────────────────────────
function dragStartSubtask(e,taskId,subtaskId){
  e.stopPropagation();
  e.dataTransfer.effectAllowed='move';
  dragSubtaskSourceId={taskId,subtaskId};
}
function dragOverSubtask(e){
  e.preventDefault();e.stopPropagation();
  e.dataTransfer.dropEffect='move';
  e.currentTarget.style.outline=`2px dashed ${T.accent2}`;
}
function dropSubtask(e,taskId,subtaskId){
  e.preventDefault();e.stopPropagation();
  e.currentTarget.style.outline='';
  if(!dragSubtaskSourceId) return;
  if(dragSubtaskSourceId.taskId!==taskId){dragSubtaskSourceId=null;return;} // cross-task drop not supported
  if(dragSubtaskSourceId.subtaskId===subtaskId){dragSubtaskSourceId=null;return;}
  const t=getTask(taskId);if(!t) return;
  const src=(t.subtasks||[]).find(s=>s.id===dragSubtaskSourceId.subtaskId);
  const tgt=(t.subtasks||[]).find(s=>s.id===subtaskId);
  if(!src||!tgt) return;
  const tmp=src.order;src.order=tgt.order;tgt.order=tmp;
  dragSubtaskSourceId=null;
  save();render();
}
function dragEndSubtask(e){
  if(e&&e.currentTarget) e.currentTarget.style.outline='';
  if(dragSubtaskSourceId!=null){dragSubtaskSourceId=null;render();}
}

// ── Focus board mode ──────────────────────────────────────────────────────────
function setFocusBoardMode(mode){
  focusBoardMode=mode;
  focusBoardPickerOpen=false;
  focusBoardPickerSearch='';
  save();render();
}
function addToFocusBoard(taskId){
  if(!focusBoardManualIds.includes(taskId)) focusBoardManualIds.push(taskId);
  focusBoardPickerOpen=false;
  focusBoardPickerSearch='';
  save();render();
}
function removeFromFocusBoard(taskId){
  focusBoardManualIds=focusBoardManualIds.filter(id=>id!==taskId);
  save();render();
}
function setFocusBoardPickerSearch(v){
  focusBoardPickerSearch=v;render();
  const el=document.getElementById('fb-picker-search');
  if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}
}
function dropOnFocusBoard(e){
  e.preventDefault();
  e.currentTarget.style.outline='';
  e.currentTarget.style.background='';
  if(dragSourceId==null) return;
  if(focusBoardMode!=='manual'){focusBoardMode='manual';} // auto-switch to manual on drop
  addToFocusBoard(dragSourceId);
  dragSourceId=null;
}

function deleteHabit(id){habits=habits.filter(x=>x.id!==id);save();render();}
