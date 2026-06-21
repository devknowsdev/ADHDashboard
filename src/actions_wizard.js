/*
MODULE: actions_wizard.js
LAYER: actions
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: actions_wizard.js responsibilities
USES: local modules
STATE_READS: state, tasks
STATE_WRITES: action, blocks, c, created, cursor, date, dayWizardOpen, done, doneDate, el
PUBLIC_API: _wizFreeBlocks, _wizUntrackedDay, closeDayWizard, dismissWizardBanner, list, openDayWizard, wizAddCapture, wizAddExistingTask, wizAddReflection, wizAdvanceStep, wizBackStep, wizBulkLogScheduled
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Day Wizard — action layer. State mutations only; rendering lives in render_wizard.js.
// Depends on: state.js (dayWizardState, dayWizardOpen, wizCaptureInput, wizCaptureList,
//             dailyIntentions, journalEntries, tasks, timeSessions),
//             helpers.js (dateToYMD), storage.js (save),
//             actions_planner.js (plannerDayDumps, plannerPromoteDump, nextTaskOrder),
//             actions_tasktimer.js (deleteTask),
//             core.js (ensureIntentionsToday),
//             render.js (render).
//
// Date-format note: tasks/dayWizardState/plannerDayDumps key off dateToYMD()
// ('YYYY-MM-DD'). energyLog/dailyIntentions key off Date.toDateString().
// Callers must pass the right one in — see render_wizard.js.

function openDayWizard(phase){
  dayWizardState.phase=phase;
  dayWizardState.step=0;
  dayWizardOpen=true;
  wizCaptureInput='';
  wizCaptureList=[];
  wizShowAllCarryOver=false;
  wizReviewMode=false;
  save();
  render();
}

function closeDayWizard(){
  dayWizardOpen=false;
  wizReviewMode=false;
  save();
  render();
}

function wizAdvanceStep(){
  dayWizardState.step++;
  save();
  render();
}

function wizBackStep(){
  dayWizardState.step=Math.max(0,dayWizardState.step-1);
  save();
  render();
}

function wizCompleteStart(){
  dayWizardState.startDone=true;
  dayWizardState.phase=null;
  dayWizardOpen=false;
  save();
  render();
}

function wizCompleteEnd(){
  dayWizardState.endDone=true;
  dayWizardState.phase=null;
  dayWizardOpen=false;
  wizReviewMode=false;
  save();
  render();
}

function dismissWizardBanner(){
  dayWizardState.wizBannerDismissedAt=Date.now();
  save();
  render();
}

// Saves the Day Start "one thing that would make today a success" answer.
// Not in the original handoff's function list — added because the commit
// step needs somewhere to put this that isn't render code. todayStr must be
// dailyIntentions' format (Date.toDateString()), not YMD.
function wizSetPriority(text,todayStr){
  const val=(text||'').trim();
  if(!val)return;
  ensureIntentionsToday(todayStr);
  dailyIntentions.answers.oneWin=val;
  dailyIntentions.date=todayStr;
  save();
}

// Saves the Day End "how was today" reflection as a journal entry.
// Also not in the original function list, same reasoning as wizSetPriority.
function wizAddReflection(text){
  const val=(text||'').trim();
  if(!val)return;
  journalEntries.unshift({id:Date.now(),type:'reflect',text:val,catId:'',createdAt:Date.now()});
  save();
}

// Energy step: saves the picked level if one was picked this session,
// otherwise just advances if today's level was already logged (avoids a
// redundant saveEnergyCheckin call and a bogus "pick a level" warning when
// the user arrives at this step with today's check-in already done).
function wizConfirmEnergyAndAdvance(todayStr){
  if(energyPending.energy){
    saveEnergyCheckin(todayStr);
  }else if(!getEnergyToday(todayStr)){
    showToast('Pick an energy level','warn');
    return;
  }
  wizAdvanceStep();
}

// Calendar-review step's "Looks good, skip to commit" button. Jumps to the
// Schedule step (index 3 in the fixed 5-step start sequence), skipping
// Rapid Capture only — matches the handoff spec's literal step target.
function wizSkipToSchedule(){
  dayWizardState.step=3;
  save();
  render();
}

// Rapid-capture step: notes an existing unscheduled task as "for today"
// without duplicating it into plannerDayDumps (it's already a real task).
// Picked up by the Schedule step's chip list via wizCaptureList[].taskId.
function wizAddExistingTask(taskId,todayYmd){
  const t=tasks.find(x=>x.id===taskId);
  if(!t)return;
  if(!wizCaptureList.some(c=>c.taskId===taskId)){
    wizCaptureList.push({id:t.id,taskId:t.id,text:t.text});
  }
  save();
  render();
}

// Commit step: saves the priority text (if the input was shown) then closes.
function wizSubmitCommit(todayStr){
  if(!(dailyIntentions.answers.oneWin||'').trim()){
    const el=document.getElementById('wiz-priority-input');
    if(el)wizSetPriority(el.value,todayStr);
  }
  wizCompleteStart();
}

// Rapid-capture step: commits the current input buffer as a new dump item
// for today, immediately (not just held in wizCaptureList) so it survives
// the wizard being dismissed mid-step.
function wizAddCapture(todayYmd){
  const text=(wizCaptureInput||'').trim();
  if(!text)return;
  if(!plannerDayDumps[todayYmd])plannerDayDumps[todayYmd]=[];
  const item={id:Date.now(),text,catId:'',done:false,createdAt:Date.now()};
  plannerDayDumps[todayYmd].unshift(item);
  wizCaptureList.push(item);
  wizCaptureInput='';
  save();
  render();
}

// Assigns a time to a task, or promotes a dump item to a task and assigns
// the time in one step. kind: 'task' | 'dump'.
function wizScheduleCapture(kind,id,todayYmd,time){
  if(kind==='dump'){
    plannerPromoteDump(todayYmd,id);
    // plannerPromoteDump pushes synchronously and doesn't return the new
    // task — it's always the most recently pushed task at this point.
    const created=tasks[tasks.length-1];
    if(created)created.ts=time;
  }else{
    const t=tasks.find(x=>x.id===id);
    if(!t)return;
    t.ts=time;
  }
  save();
  render();
}

// Bulk-logs all of today's scheduled-but-not-done tasks as if they ran
// exactly to plan: one time session each, marked done.
function wizBulkLogScheduled(todayYmd){
  const now=new Date();
  tasks
    .filter(t=>t.ts&&t.status!=='done')
    .forEach(t=>{
      const [h,m]=t.ts.split(':').map(Number);
      const startedAt=new Date(now);
      startedAt.setHours(h,m,0,0);
      const seconds=(t.durationMins||30)*60;
      timeSessions.push({
        id:Date.now()+Math.random(),
        taskId:t.id,
        subtaskId:null,
        startedAt:startedAt.getTime(),
        endedAt:startedAt.getTime()+seconds*1000,
        seconds,
        mode:'manual',
        type:'work',
      });
      t.status='done';
      t.done=true;
      t.doneDate=todayYmd;
    });
  save();
}

// Carry-over decision for an incomplete task. 'done' sets status directly
// rather than calling toggleTask(), which cycles todo→inprogress→done→todo
// and would need 0-2 calls depending on current state to land on 'done'.
function wizMarkCarryOver(taskId,action){
  const t=tasks.find(x=>x.id===taskId);
  if(!t)return;
  if(action==='drop'){
    deleteTask(taskId);
  }else if(action==='done'){
    t.status='done';
    t.done=true;
    t.doneDate=dateToYMD(new Date());
    save();
    render();
  }
  // 'keep' — no-op, task stays as-is
}

// True when ≥2 tasks were scheduled and have already ended, but nothing was
// time-tracked against any of them today.
function _wizUntrackedDay(todayYmd){
  const todayScheduled=tasks.filter(t=>{
    if(!t.ts||t.status==='done')return false;
    const [h,m]=t.ts.split(':').map(Number);
    const endMins=h*60+m+(t.durationMins||30);
    const nowMins=new Date().getHours()*60+new Date().getMinutes();
    return endMins<nowMins;
  });
  if(!todayScheduled.length)return false;
  const tracked=timeSessions.filter(s=>{
    return todayScheduled.some(t=>t.id===s.taskId)&&
           new Date(s.startedAt).toDateString()===new Date().toDateString();
  });
  return tracked.length===0&&todayScheduled.length>=2;
}

// Free ≥30-minute gaps between scheduled tasks, 8am-6pm window. Purely
// informational — used as scheduling hints in the wizard's Schedule step.
function _wizFreeBlocks(todayYmd){
  const scheduled=tasks
    .filter(t=>t.ts&&t.status!=='done')
    .map(t=>{
      const [h,m]=t.ts.split(':').map(Number);
      const start=h*60+m;
      const end=start+(t.durationMins||30);
      return {start,end,text:t.text};
    })
    .sort((a,b)=>a.start-b.start);
  const blocks=[];
  let cursor=8*60;
  scheduled.forEach(s=>{
    if(s.start-cursor>=30){
      blocks.push({start:cursor,end:s.start,mins:s.start-cursor});
    }
    cursor=Math.max(cursor,s.end);
  });
  if(18*60-cursor>=30){
    blocks.push({start:cursor,end:18*60,mins:18*60-cursor});
  }
  return blocks;
}
