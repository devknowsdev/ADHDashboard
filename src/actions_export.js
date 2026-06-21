/*
MODULE: actions_export.js
LAYER: actions
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: actions_export.js responsibilities
USES: local modules
STATE_READS: habits, state, tasks
STATE_WRITES: a, alarms, allH, ans, blob, byCat, c, cat, catId, categories
PUBLIC_API: addCategory, cancelEditCat, closeCatManager, confirmDeleteCat, cycleNewCatColor, exportDailyLog, exportFullBackup, importBackup, openCatManager, pickNewCatColor, saveEditCat, setCatColor
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Export, import, and category management actions.
// Depends on: core.js (btnStyle), helpers.js (esc, getCat, getTask, fmtDur,
//             getAllHitsForHabit), state.js, storage.js (save), ui.js (showToast),
//             render.js (render), helpers.js (migrateTasks), audio.js (migrateJournal).
function openCatManager(){showCatModal=true;render();}
function closeCatManager(){showCatModal=false;editingCatId=null;render();}
function startEditCat(id){editingCatId=id;render();}
function cancelEditCat(){editingCatId=null;render();}

function setCatColor(id,idx){const c=categories.find(x=>x.id===id);if(!c)return;c.color=COLOR_OPTS[idx];save();render();}
function saveEditCat(id){
  const inp=document.getElementById('cedit-name-'+id);if(!inp)return;
  const name=inp.value.trim();if(!name)return;
  const c=categories.find(x=>x.id===id);if(c)c.name=name;
  editingCatId=null;save();render();
}
function confirmDeleteCat(id){
  const c=categories.find(x=>x.id===id);if(!c)return;
  const n=tasks.filter(t=>t.catId===id).length;
  if(!confirm(n>0?`Delete "${c.name}"? ${n} task(s) will lose this category.`:`Delete "${c.name}"?`))return;
  tasks.forEach(t=>{if(t.catId===id)t.catId='';});
  categories=categories.filter(x=>x.id!==id);
  if(taskFilter===id)taskFilter='all';
  save();showToast('Category removed','ok');render();
}
function cycleNewCatColor(){newCatColorIdx=(newCatColorIdx+1)%COLOR_OPTS.length;render();}
function pickNewCatColor(i){newCatColorIdx=i;render();}
function addCategory(){
  const inp=document.getElementById('new-cat-name');if(!inp)return;
  const name=inp.value.trim();if(!name)return;
  if(categories.find(c=>c.name.toLowerCase()===name.toLowerCase())){showToast('Already exists','warn');return;}
  categories.push({id:'cat_'+Date.now(),name,color:COLOR_OPTS[newCatColorIdx]});
  save();showToast('"'+name+'" added','ok');render();
}

// ── Export / Import ───────────────────────────────────────────────────────────
function exportFullBackup(){
  const pad=n=>String(n).padStart(2,'0');
  const d=new Date();
  const dateStr=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const data={
    tasks,categories,habits,alarms,templates,timeSessions,offTaskLog,journalEntries,energyLog,
    dailyIntentions,plannerDayDumps,dayWizardState,
    audioRecordings,widgetLayout,taskSortMode,
    dayStartHour,dayEndHour,darkMode,crisisMode,timerLayout,clockColWidth,
    focusBoardMode,focusBoardManualIds,
    exportedAt:Date.now(),version:17,
  };
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`focus-dashboard-backup-${dateStr}.json`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backup downloaded (audio not included)','ok');
}

function exportDailyLog(todayStr){
  const pad=n=>String(n).padStart(2,'0');
  const d=new Date();
  const dateStr=`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const energy=energyLog.find(e=>e.date===todayStr);
  const energyLabels=['','Low','Low-Med','Medium','Med-High','High'];
  const lines=[];
  lines.push('FOCUS DASHBOARD — DAILY LOG');
  lines.push(`Date: ${todayStr}`);
  if(energy){
    lines.push(`Energy: ${energyLabels[energy.energy]||energy.energy}/5${energy.sensory?` | Sensory: ${energy.sensory}`:''}${energy.tag?' | '+energy.tag:''}`);
  }
  lines.push('');
  // Daily plan
  const ans=dailyIntentions.answers||{};
  if(ans.arriving||ans.oneWin||ans.derail||ans.goodEnough){
    lines.push('── DAILY PLAN ──');
    if(ans.arriving) lines.push(`Capacity: ${ans.arriving}`);
    if(ans.oneWin)   lines.push(`Priority: ${ans.oneWin}`);
    if(ans.derail)   lines.push(`If-then:  ${ans.derail}`);
    if(ans.goodEnough) lines.push(`Good enough: ${ans.goodEnough}`);
    if(dailyIntentions.winOutcome) lines.push(`Outcome: ${dailyIntentions.winOutcome}`);
    lines.push('');
  }
  // Tasks relevant to today: done tasks with sessions today, or any task with sessions today
  const tasksWithSessions=tasks.filter(t=>timeSessions.some(s=>s.taskId===t.id&&new Date(s.startedAt).toDateString()===todayStr));
  const relevantTasks=tasksWithSessions;
  if(relevantTasks.length){
    lines.push('── TASKS ──');
    relevantTasks.forEach(t=>{
      const secs=timeSessions.filter(s=>s.taskId===t.id&&new Date(s.startedAt).toDateString()===todayStr).reduce((s,x)=>s+(x.seconds||0),0);
      const cat=getCat(t.catId);
      lines.push(`[${t.status==='done'?'✓':' '}] ${t.text}${cat?' ('+cat.name+')':''}${secs>0?' — '+fmtDur(secs):''}`);
    });
    lines.push('');
  }
  // Time by category
  const todaySessions=timeSessions.filter(s=>new Date(s.startedAt).toDateString()===todayStr&&s.type!=='break');
  const totalTracked=todaySessions.reduce((s,x)=>s+(x.seconds||0),0);
  if(totalTracked>0){
    lines.push('── TIME TRACKED ──');
    const byCat={};
    todaySessions.forEach(s=>{
      const t=getTask(s.taskId);const catId=t?t.catId:'';
      byCat[catId]=(byCat[catId]||0)+(s.seconds||0);
    });
    Object.entries(byCat).forEach(([catId,secs])=>{
      const cat=getCat(catId);
      lines.push(`  ${cat?cat.name:'Uncategorised'}: ${fmtDur(secs)}`);
    });
    lines.push(`  Total: ${fmtDur(totalTracked)}`);
    lines.push('');
  }
  // Habits
  const habitHits=habits.filter(h=>getAllHitsForHabit(h,todayStr).length>0);
  if(habitHits.length){
    lines.push('── HABITS ──');
    habitHits.forEach(h=>{
      const allH=getAllHitsForHabit(h,todayStr);
      const mins=allH.reduce((s,x)=>s+(x.minutes||0),0);
      lines.push(`  ${h.name}: ${allH.length}× ${mins>0?'('+mins+'m)':''}`);
    });
    lines.push('');
  }
  // Off-task log
  const offToday=offTaskLog.filter(e=>e.date===todayStr);
  if(offToday.length){
    lines.push('── OFF-TASK LOG ──');
    offToday.forEach(e=>lines.push(`  ${e.startTime}–${e.endTime} (${fmtDur(e.seconds||0)})${e.note?' — '+e.note:''}`));
    lines.push('');
  }
  // Journal entries
  const jToday=journalEntries.filter(e=>new Date(e.createdAt).toDateString()===todayStr);
  if(jToday.length){
    lines.push('── JOURNAL ──');
    jToday.forEach(e=>{
      const dh=new Date(e.createdAt);
      const tStr=pad(dh.getHours())+':'+pad(dh.getMinutes());
      lines.push(`  [${e.type}] ${tStr} — ${e.text}`);
    });
    lines.push('');
  }
  lines.push('── END OF LOG ──');
  const blob=new Blob([lines.join('\n')],{type:'text/plain'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`focus-log-${dateStr}.txt`;
  document.body.appendChild(a);a.click();document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Daily log downloaded','ok');
}

function importBackup(file){
  if(!file)return;
  const reader=new FileReader();
  reader.onload=e=>{
    try{
      const data=JSON.parse(e.target.result);
      if(!data.tasks||!data.categories){showToast('Invalid backup file','warn');return;}
      if(!confirm('This will replace all current data. Are you sure?'))return;
      tasks=data.tasks||[];
      categories=data.categories||[];
      habits=data.habits||[];
      alarms=data.alarms||[];
      templates=data.templates||[];
      timeSessions=data.timeSessions||[];
      offTaskLog=data.offTaskLog||[];
      journalEntries=data.journalEntries||[];
      energyLog=data.energyLog||[];
      if(data.dailyIntentions)dailyIntentions=data.dailyIntentions;
      if(data.plannerDayDumps)plannerDayDumps=data.plannerDayDumps;
      if(data.dayWizardState)dayWizardState=data.dayWizardState;
      if(data.widgetLayout)widgetLayout=data.widgetLayout;
      if(data.taskSortMode)taskSortMode=data.taskSortMode;
      if(data.dayStartHour!=null)dayStartHour=data.dayStartHour;
      if(data.dayEndHour!=null)dayEndHour=Math.max(14,Math.min(22,data.dayEndHour));
      if(data.darkMode!=null){darkMode=!!data.darkMode;T=darkMode?DARK:LIGHT;}
      if(data.crisisMode!=null)crisisMode=!!data.crisisMode;
      if(data.timerLayout)timerLayout=data.timerLayout;
      if(data.clockColWidth!=null)clockColWidth=data.clockColWidth;
      if(data.focusBoardMode)focusBoardMode=data.focusBoardMode;
      if(data.focusBoardManualIds)focusBoardManualIds=data.focusBoardManualIds;
      save();migrateTasks();migrateJournal();render();
      showToast('Backup restored!','ok');
    }catch(err){showToast('Invalid backup file','warn');}
  };
  reader.readAsText(file);
}
// ─────────────────────────────────────────────────────────────────────────────
