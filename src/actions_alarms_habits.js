/*
MODULE: actions_alarms_habits.js
LAYER: actions
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: actions_alarms_habits.js responsibilities
USES: local modules
STATE_READS: habits, state
STATE_WRITES: a, alarms, anchor, anchorOrder, anchorSel, anchorVal, catSel, d, editingHabitHitId, el
PUBLIC_API: addAlarm, addHabit, adjustHitMins, closeHitInput, deleteAlarm, openHitInput, removeHabitHit, saveHabitHit, saveHabitHitMins, saveHabitHitTime, setHabitAnchor, setHitInputMins
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Alarms and habit hit actions.
// Depends on: core.js (btnStyle), helpers.js (getCat, fmtDur), state.js, storage.js (save),
//             ui.js (showToast), render.js (render).
// Called from: render_habits.js, render_focusboard_cards.js (time targets),
//              render_daylog.js (checkAlarms via runtime.js).
function addAlarm(){
  const t=document.getElementById('alarm-time-in').value.trim(),l=document.getElementById('alarm-label-in').value.trim()||'Target';
  const taskSel=document.getElementById('alarm-task-in');
  const taskId=taskSel&&taskSel.value?parseInt(taskSel.value):null;
  if(!/^\d{1,2}:\d{1,2}$/.test(t)){showToast('Use HH:MM format','warn');return;}
  const[hh,mm]=t.split(':');
  const pad=String(parseInt(hh)).padStart(2,'0')+':'+String(parseInt(mm)).padStart(2,'0');
  alarms.push({id:Date.now(),time:pad,label:l,on:true,fired:false,taskId});
  save();showToast('Target set for '+pad,'ok');render();
}
function toggleAlarm(id){const a=alarms.find(x=>x.id===id);if(!a)return;a.on=!a.on;a.fired=false;save();render();}
function deleteAlarm(id){alarms=alarms.filter(x=>x.id!==id);save();render();}
function addHabit(){
  const inp=document.getElementById('habit-in'),text=inp.value.trim();if(!text)return;
  const catSel=document.getElementById('habit-cat');
  const anchorSel=document.getElementById('habit-anchor-new');
  const anchorVal=anchorSel?anchorSel.value||null:null;
  // anchorOrder = max existing order within that anchor group + 1
  const sameAnchor=habits.filter(h=>h.anchor===anchorVal);
  const anchorOrder=sameAnchor.length?Math.max(...sameAnchor.map(h=>h.anchorOrder||0))+1:0;
  habits.push({id:Date.now(),name:text,catId:catSel?catSel.value:'',hits:[],anchor:anchorVal,anchorOrder});
  inp.value='';
  save();render();
}
function setHabitAnchor(habitId,anchorId){
  const h=habits.find(x=>x.id===habitId);if(!h)return;
  const newAnchor=anchorId||null;
  if(h.anchor===newAnchor) return;
  // Assign anchorOrder = max in target group + 1
  const sameAnchor=habits.filter(x=>x.anchor===newAnchor&&x.id!==habitId);
  h.anchorOrder=sameAnchor.length?Math.max(...sameAnchor.map(x=>x.anchorOrder||0))+1:0;
  h.anchor=newAnchor;
  save();render();
}
// ---- Hit popover ----
function openHitInput(habitId){
  hitInputHabitId=habitId;
  hitInputMins=0;
  // Pre-fill time with current time
  const now=new Date();
  hitInputTime=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
  render();
}
function closeHitInput(){hitInputHabitId=null;hitInputMins=0;hitInputTime='';render();}
function adjustHitMins(habitId,delta){
  if(hitInputHabitId!==habitId) return;
  hitInputMins=Math.max(0,hitInputMins+delta);
  // Update display span without full re-render for snappiness
  const el=document.getElementById('hit-mins-display-'+habitId);
  if(el) el.textContent=hitInputMins+'m';
  // Also sync the number input (uses a stable id now)
  const numEl=document.getElementById('hit-mins-num-'+habitId);
  if(numEl) numEl.value=hitInputMins||'';
}
function setHitInputMins(habitId,val){
  if(hitInputHabitId!==habitId) return;
  const n=parseInt(val,10);
  hitInputMins=isNaN(n)||n<0?0:Math.min(480,n);
  const el=document.getElementById('hit-mins-display-'+habitId);
  if(el) el.textContent=hitInputMins+'m';
}
function saveHabitHit(habitId){
  const h=habits.find(x=>x.id===habitId);if(!h)return;
  const now=new Date();
  let ts=now.getTime();
  // Apply user-specified time-of-day if provided
  if(hitInputTime){
    const [hh,mm]=hitInputTime.split(':').map(Number);
    const d=new Date();d.setHours(hh,mm,0,0);
    ts=d.getTime();
  }
  h.hits.push({id:Date.now(),timestamp:ts,minutes:hitInputMins||0});
  hitInputHabitId=null;hitInputMins=0;hitInputTime='';
  save();render();
}
// Legacy: called from hit chips when clicking to edit timestamp
function removeHabitHit(habitId,hitId){
  const h=habits.find(x=>x.id===habitId);if(!h)return;
  h.hits=h.hits.filter(x=>x.id!==hitId);
  save();render();
}
function startEditHabitHit(habitId,hitId){
  editingHabitHitId={habitId,hitId};render();
}
function saveHabitHitTime(habitId,hitId,timeVal){
  const h=habits.find(x=>x.id===habitId);if(!h)return;
  const hit=h.hits.find(x=>x.id===hitId);if(!hit)return;
  const [hh,mm]=timeVal.split(':').map(Number);
  const d=new Date(hit.timestamp);
  d.setHours(hh,mm,0,0);
  hit.timestamp=d.getTime();
  editingHabitHitId=null;
  save();render();
}
function saveHabitHitMins(habitId,hitId,val){
  const h=habits.find(x=>x.id===habitId);if(!h)return;
  const hit=h.hits.find(x=>x.id===hitId);if(!hit)return;
  hit.minutes=Math.max(0,parseInt(val)||0);
  save();render();
}

