/*
MODULE: render_focusboard_cards.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_focusboard_cards.js responsibilities
USES: local modules
STATE_READS: T, state, tasks
STATE_WRITES: NOTE_TRUNC, PILL_SHOW, _live, _saved, a, activeTasks, allEntries, allTargets, available, background
PUBLIC_API: _renderFocusDayLog, _renderFocusTaskLog, _renderManualPicker, _renderTimeTargets, buildBoardCard
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Focus board: manual picker, time targets panel, and board card builder.
// Depends on: core.js (btnStyle, inputStyle, selectStyle), helpers.js (esc, getCat, getTask,
//             fmtDur, getTotalForTask, getSubtask), state.js, actions_tasks.js,
//             actions_tasktimer.js (startTaskStopwatch, toggleAlarm, deleteAlarm).
// Called by render_focus.js: renderFocusBoardWidget (for picker + targets),
//                             and buildBoardCard (used in card grid).
function _renderManualPicker(focusTask){
  const activeTasks=tasks.filter(t=>t.status!=='done');
  // ── Manual mode: task picker + drop zone ──
  let manualPickerHtml='';
  if(focusBoardMode==='manual'){
    // Task picker dropdown
    const available=activeTasks.filter(t=>!focusBoardManualIds.includes(t.id));
    const q=(focusBoardPickerSearch||'').trim().toLowerCase();
    const filtered=q?available.filter(t=>t.text.toLowerCase().includes(q)):available;
    const pickerRows=filtered.slice(0,8).map(t=>{
      const cat=getCat(t.catId);
      return `<div onclick="addToFocusBoard(${t.id})"
        style="display:flex;align-items:center;gap:7px;padding:6px 10px;cursor:pointer;border-bottom:1px solid ${T.border};"
        onmouseover="this.style.background='${T.surface2}'" onmouseout="this.style.background='transparent'">
        ${cat?`<span style="width:7px;height:7px;border-radius:50%;background:${cat.color.dot};display:inline-block;flex-shrink:0;"></span>`:''}
        <span style="font-size:12px;font-weight:600;color:${T.text};flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.text)}</span>
        ${(t.urgency||0)>0?`<span style="font-size:10px;color:#f97316;"><i class="ti ti-flame"></i></span>`:''}
      </div>`;
    }).join('');

    const dropZoneStyle=`display:flex;align-items:center;justify-content:center;gap:7px;padding:8px 12px;border:2px dashed ${T.border2};border-radius:10px;margin-top:8px;font-size:11px;color:${T.muted2};cursor:default;transition:all .15s;`;

    manualPickerHtml=`
      <div style="margin-top:8px;position:relative;">
        <div style="display:flex;gap:6px;align-items:center;">
          <button onclick="focusBoardPickerOpen=!focusBoardPickerOpen;focusBoardPickerSearch='';render();setTimeout(()=>{const el=document.getElementById('fb-picker-search');if(el)el.focus();},0)"
            style="${btnStyle('default','font-size:11px;padding:5px 12px;border-radius:999px;')}">
            <i class="ti ti-plus"></i> Add task
          </button>
          ${focusBoardManualIds.length>0?`<button onclick="focusBoardManualIds=[];save();render()"
            style="${btnStyle('default','font-size:11px;padding:5px 10px;border-radius:999px;')}">
            <i class="ti ti-x"></i> Clear all
          </button>`:''}
        </div>
        ${focusBoardPickerOpen?`
          <div onclick="focusBoardPickerOpen=false;render()" style="position:fixed;inset:0;z-index:199;"></div>
          <div style="position:absolute;top:32px;left:0;right:0;background:${T.surface};border:1.5px solid ${T.border2};border-radius:10px;z-index:200;box-shadow:0 4px 20px rgba(0,0,0,.18);overflow:hidden;" onclick="event.stopPropagation()">
            <div style="padding:6px 8px;border-bottom:1px solid ${T.border};" data-no-clobber="true">
              <input id="fb-picker-search" type="text" placeholder="Search tasks…" value="${esc(focusBoardPickerSearch)}"
                oninput="setFocusBoardPickerSearch(this.value)"
                onkeydown="if(event.key==='Escape'){focusBoardPickerOpen=false;render();}"
                style="${inputStyle('font-size:12px;padding:5px 8px;')}"/>
            </div>
            <div style="max-height:220px;overflow-y:auto;">
              ${pickerRows||`<div style="padding:10px;font-size:12px;color:${T.muted2};">No matching tasks.</div>`}
            </div>
          </div>`:''}
        <div style="${dropZoneStyle}"
          ondragover="event.preventDefault();this.style.background='${T.surface2}';this.style.borderColor='${T.accent2}';"
          ondragleave="this.style.background='';this.style.borderColor='${T.border2}';"
          ondrop="dropOnFocusBoard(event)">
          <i class="ti ti-drag-drop" style="font-size:14px;"></i>
          <span>Drag tasks here to add</span>
        </div>
      </div>`;
  }

  return manualPickerHtml;
}

function _renderTimeTargets(nowMins){
  // ── Time targets collapsible panel ──
  // Merge: tasks with ts set become implicit targets; manual alarms are also shown
  const taskTargets=tasks.filter(t=>t.ts&&t.status!=='done').map(t=>{
    const[h,m]=t.ts.split(':').map(Number);
    return {time:t.ts,mins:h*60+m,label:t.text,taskId:t.id,isTask:true,id:'task_'+t.id};
  });
  const manualTargets=alarms.map(a=>{
    const[h,m]=a.time.split(':').map(Number);
    return{...a,mins:h*60+m,isTask:false};
  });
  // Merge, deduplicate by time+taskId, sort by time
  const allTargets=[...taskTargets,...manualTargets].sort((a,b)=>a.mins-b.mins);
  const upcomingCount=allTargets.filter(a=>a.mins>=nowMins&&(a.isTask||(!a.fired&&a.on))).length;

  const targetsPanel=showTimeTargets?`
    <div style="margin-top:10px;padding:10px 12px;background:${T.surface2};border:1.5px solid ${T.border};border-radius:10px;">
      <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${T.muted};margin-bottom:8px;"><i class="ti ti-flag-3"></i> Time Targets</div>
      ${allTargets.length?allTargets.map(a=>{
        const isPast=a.mins<nowMins;
        const minsLeft=a.mins-nowMins;
        const urgCl=minsLeft<=15?T.pomo:minsLeft<=45?T.urg1:T.muted2;
        const linkedTask=a.taskId?getTask(a.taskId):null;
        if(a.isTask){
          // Task-derived target — clicking focuses the task
          return `<div onclick="startTaskStopwatch(${a.taskId})" style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed ${T.border};cursor:pointer;opacity:${isPast?0.45:1};">
            <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:13px;color:${isPast?T.muted:urgCl};min-width:40px;">${a.time}</span>
            <div style="flex:1;min-width:0;font-size:12px;color:${T.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(a.label)}</div>
            <span style="font-size:9px;padding:1px 6px;background:${T.surface3};border:1px solid ${T.borderBlue||T.border};border-radius:8px;color:${T.muted2};flex-shrink:0;">task</span>
            ${!isPast?`<span style="font-size:10px;color:${urgCl};font-family:'DM Mono',monospace;flex-shrink:0;">${minsLeft<60?minsLeft+'m':Math.floor(minsLeft/60)+'h'+(minsLeft%60?minsLeft%60+'m':'')}</span>`:''} 
          </div>`;
        } else {
          return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed ${T.border};opacity:${isPast||a.fired?0.45:1};">
            <span style="font-family:'DM Mono',monospace;font-weight:700;font-size:13px;color:${isPast?T.muted:urgCl};min-width:40px;">${a.time}</span>
            <div style="flex:1;min-width:0;">
              <div style="font-size:12px;color:${T.text};">${esc(a.label)}</div>
              ${linkedTask?`<div style="font-size:10px;color:${T.muted2};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(linkedTask.text)}</div>`:''}
            </div>
            ${a.fired?`<span style="font-size:9px;color:${T.pomo};font-weight:700;">fired</span>`:''}
            <button onclick="event.stopPropagation();toggleAlarm(${a.id})" style="${btnStyle('default','font-size:9px;padding:1px 5px;')}">${a.on?'on':'off'}</button>
            <button onclick="event.stopPropagation();deleteAlarm(${a.id})" style="${btnStyle('danger','font-size:9px;padding:1px 5px;')}"><i class="ti ti-x"></i></button>
          </div>`;
        }
      }).join(''):`<div style="font-size:12px;color:${T.muted2};padding:4px 0;">No targets yet. Set a time on a task in the Tasks list, or add one below.</div>`}
      <!-- Add manual target -->
      <div style="display:flex;gap:5px;align-items:center;flex-wrap:wrap;margin-top:8px;padding-top:6px;border-top:1px solid ${T.border};" data-no-clobber="true">
        <input id="alarm-time-in" type="text" placeholder="14:30" maxlength="5" style="${inputStyle('width:58px;font-family:DM Mono,monospace;padding:4px 6px;font-size:12px;')}"/>
        <input id="alarm-label-in" type="text" placeholder="Label…" style="${inputStyle('flex:1;min-width:90px;font-size:12px;')}"/>
        <select id="alarm-task-in" style="${selectStyle('font-size:10px;padding:3px 6px;flex:1;min-width:100px;max-width:180px;')}">
          <option value="">— link task (optional)</option>
          ${tasks.filter(t=>t.status!=='done').map(t=>`<option value="${t.id}">${esc(t.text.length>30?t.text.slice(0,30)+'…':t.text)}</option>`).join('')}
        </select>
        <button onclick="addAlarm()" style="${btnStyle('accent','padding:5px 9px;font-size:12px;')}"><i class="ti ti-plus"></i></button>
      </div>
    </div>`:'';

  const targetsBtnLabel=showTimeTargets
    ?`<i class="ti ti-chevron-up"></i> targets`
    :`<i class="ti ti-flag-3"></i> targets${upcomingCount>0?` <span style="font-size:9px;background:${T.pomo};color:#fff;border-radius:10px;padding:1px 5px;margin-left:3px;">${upcomingCount}</span>`:''}`;

  return {targetsPanel,targetsBtnLabel};
}

function _renderFocusTaskLog(focusTask, todayStr) {
  if(!focusTask) return `<div style="font-size:12px;color:${T.muted2};padding:8px 0;">No task focused. Select a card below.</div>`;
  const sess=getSessionsForTask(focusTask.id);
  const todaySess=sess.filter(s=>new Date(s.startedAt).toDateString()===todayStr);
  const total=getTotalForTask(focusTask.id);
  const rows=todaySess.length?todaySess.map(s=>{
    const isEdit=editingSessionId===s.id;
    const subCtx=s.subtaskId?getSubtask(focusTask.id,s.subtaskId):null;
    const start=new Date(s.startedAt);
    const timeStr=start.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    return `<div style="display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px dashed ${T.border};">
      <span style="font-family:'DM Mono',monospace;font-size:10px;color:${T.muted2};flex-shrink:0;">${timeStr}</span>
      ${subCtx?`<span style="font-size:10px;color:${T.accent2};flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">› ${esc(subCtx.text)}</span>`:`<span style="flex:1;"></span>`}
      ${isEdit
        ?`<input id="session-edit-mmss-${s.id}" type="text" value="${esc(editingSessionMmSs)}" placeholder="MM:SS" maxlength="7"
            oninput="setEditingSessionMmSs(this.value)"
            onkeydown="if(event.key==='Enter'){saveSessionEdit(${s.id});event.preventDefault();}if(event.key==='Escape'){cancelSessionEdit();}"
            data-no-clobber="true"
            style="${inputStyle('width:80px;text-align:center;font-family:DM Mono,monospace;padding:3px 6px;font-size:11px;')}"/>
          <button onclick="saveSessionEdit(${s.id})" style="${btnStyle('accent','font-size:10px;padding:3px 7px;')}"><i class="ti ti-check"></i></button>
          <button onclick="cancelSessionEdit()" style="${btnStyle('default','font-size:10px;padding:3px 7px;')}"><i class="ti ti-x"></i></button>`
        :`<span onclick="startSessionEdit(${s.id})" title="Click to edit" style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${T.text};cursor:pointer;padding:2px 8px;border-radius:6px;border:1px dashed ${T.border};">${fmtDur(s.seconds)}</span>
          <button onclick="deleteSession(${s.id})" style="${btnStyle('danger','font-size:10px;padding:2px 6px;')}"><i class="ti ti-trash"></i></button>`}
    </div>`;
  }).join(''):`<div style="font-size:11px;color:${T.muted2};padding:6px 0;">No sessions today yet.</div>`;
  return `<div style="margin-bottom:10px;padding:10px 12px;background:${T.surface2};border:1.5px solid ${T.border};border-radius:10px;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;color:${T.muted};letter-spacing:.06em;text-transform:uppercase;">${esc(focusTask.text)} — today</div>
      <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${T.accent};">${fmtDur(total)}</span>
    </div>
    ${rows}
  </div>`;

}

function _renderFocusDayLog(todayStr) {
  // All work sessions today
  const todaySessions=timeSessions
    .filter(s=>s.type!=='break'&&new Date(s.startedAt).toDateString()===todayStr)
    .sort((a,b)=>a.startedAt-b.startedAt);
  // Off-task entries today
  const offToday=offTaskLog
    .filter(e=>e.date===todayStr)
    .map(e=>({
      startedAt:new Date(todayStr+' '+e.startTime).getTime(),
      endedAt:new Date(todayStr+' '+e.endTime).getTime(),
      seconds:e.seconds,taskId:null,isDowntime:true,id:e.id,note:e.note
    }));
  // Merge and sort all entries
  const allEntries=[...todaySessions.map(s=>({...s,isDowntime:false})),...offToday]
    .sort((a,b)=>a.startedAt-b.startedAt);
  if(!allEntries.length) return `<div style="font-size:12px;color:${T.muted2};padding:8px 0;">Nothing logged today yet.</div>`;

  // Build rows with gap detection
  const rows=[];
  let prev=null;
  allEntries.forEach(entry=>{
    // Gap ≥ 5 min → show a downtime slot
    if(prev){
      const gapSecs=(entry.startedAt-prev.endedAt)/1000;
      if(gapSecs>=300){
        const gapStart=new Date(prev.endedAt);
        const gapEnd=new Date(entry.startedAt);
        const gapStr=gapStart.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+' → '+gapEnd.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        rows.push(`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed ${T.border};opacity:0.55;">
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:${T.muted2};flex-shrink:0;">${gapStr}</span>
          <span style="flex:1;font-size:11px;color:${T.muted2};font-style:italic;">Downtime</span>
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:${T.muted2};">${fmtDur(Math.round(gapSecs))}</span>
        </div>`);
      }
    }
    const t2=entry.isDowntime?null:getTask(entry.taskId);
    const name=entry.isDowntime?(entry.note||'Downtime'):(t2?t2.text:'Unknown task');
    const startStr=new Date(entry.startedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const endStr=new Date(entry.endedAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
    const isEdit=editingSessionId===entry.id&&!entry.isDowntime;
    rows.push(`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed ${T.border};">
      <span style="font-family:'DM Mono',monospace;font-size:10px;color:${T.muted2};flex-shrink:0;">${startStr}→${endStr}</span>
      <span style="flex:1;font-size:12px;font-weight:600;color:${entry.isDowntime?T.muted2:T.text};min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(name)}</span>
      ${isEdit
        ?`<input id="session-edit-mmss-${entry.id}" type="text" value="${esc(editingSessionMmSs)}" placeholder="MM:SS"
            oninput="setEditingSessionMmSs(this.value)"
            onkeydown="if(event.key==='Enter'){saveSessionEdit(${entry.id});event.preventDefault();}if(event.key==='Escape'){cancelSessionEdit();}"
            data-no-clobber="true"
            style="${inputStyle('width:75px;font-family:DM Mono,monospace;padding:2px 5px;font-size:11px;')}"/>
          <button onclick="saveSessionEdit(${entry.id})" style="${btnStyle('accent','font-size:10px;padding:2px 6px;')}"><i class="ti ti-check"></i></button>
          <button onclick="cancelSessionEdit()" style="${btnStyle('default','font-size:10px;padding:2px 6px;')}"><i class="ti ti-x"></i></button>`
        :`<span ${!entry.isDowntime?`onclick="startSessionEdit(${entry.id})"`:''} title="${entry.isDowntime?'':'Click to edit'}" style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${T.text};${!entry.isDowntime?'cursor:pointer;padding:2px 6px;border-radius:5px;border:1px dashed '+T.border+';':''}">${fmtDur(entry.seconds)}</span>
          ${!entry.isDowntime?`<button onclick="deleteSession(${entry.id})" style="${btnStyle('danger','font-size:10px;padding:2px 5px;')}"><i class="ti ti-trash"></i></button>`:''}`}
    </div>`);
    prev=entry;
  });
  const totalToday=todaySessions.reduce((s,e)=>s+(e.seconds||0),0);
  return `<div style="margin-bottom:10px;padding:10px 12px;background:${T.surface2};border:1.5px solid ${T.border};border-radius:10px;max-height:340px;overflow:auto;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;color:${T.muted};letter-spacing:.06em;text-transform:uppercase;">Today's timeline</div>
      <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${T.accent};">${fmtDur(totalToday)} tracked</span>
    </div>
    ${rows.join('')}
  </div>`;

}

function buildBoardCard(t,focusTask,timerColor,timerMode,timerSecs,timerPlannedSecs,timerRunning,showRemove){
  const isFocus=focusTask&&focusTask.id===t.id;
  const isRunning=isFocus&&timerRunning&&timerSessionType!=='break';
  const cat=getCat(t.catId);
  const urgencyColor=(u)=>u>=4?T.urg3:u>=2?T.urg2:u>=1?T.urg1:'transparent';
  const uColor=urgencyColor(t.urgency||0);
  const _saved=getTotalForTask(t.id);
  const _live=(isRunning?(timerMode==='stopwatch'?timerSecs:Math.max(0,timerPlannedSecs-timerSecs)):0);
  const tracked=_saved+_live;
  const removeBtn=showRemove
    ?`<span onclick="event.stopPropagation();removeFromFocusBoard(${t.id})" title="Remove from board"
        style="position:absolute;top:4px;left:4px;width:16px;height:16px;border-radius:50%;background:${T.surface2};border:1px solid ${T.border};display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:10px;color:${T.muted2};z-index:1;opacity:0.6;"
        onmouseover="this.style.opacity=1;this.style.borderColor='${T.pomo}';this.style.color='${T.pomo}'"
        onmouseout="this.style.opacity=0.6;this.style.borderColor='${T.border}';this.style.color='${T.muted2}'">
        <i class="ti ti-x"></i>
      </span>`
    :'';

  // Live elapsed readout shown on the card when this task is running
  const liveElapsed=isRunning?(()=>{
    const secs=timerMode==='stopwatch'?timerSecs:Math.max(0,timerPlannedSecs-timerSecs);
    const m=Math.floor(secs/60),s=secs%60;
    return String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  })():null;

  // Subtask mini-pills on board card — first 4 shown, chevron toggles the rest
  const subtasks=(t.subtasks||[]).filter(st=>!st.done).sort((a,b)=>(a.order||0)-(b.order||0));
  const pillDot=cat?cat.color.dot:T.accent2;
  const pillBg=cat?cat.color.bg:T.surface3;
  const pillText=cat?cat.color.text:T.muted;
  const PILL_SHOW=4;
  const isSubExpanded=boardSubExpandedTaskIds.has(t.id);
  const visibleSubs=isSubExpanded?subtasks:subtasks.slice(0,PILL_SHOW);
  const overflowCount=subtasks.length-PILL_SHOW;
  const pillHtml=visibleSubs.map(st=>{
    const isStFocus=focusTaskId===t.id&&focusSubtaskId===st.id;
    return `<span onclick="event.stopPropagation();setFocusSubtaskOnBoard(${t.id},${st.id})"
      title="${esc(st.text)}"
      style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:${isStFocus?'700':'500'};padding:2px 7px 2px 5px;border-radius:20px;cursor:pointer;white-space:nowrap;overflow:hidden;flex-shrink:1;min-width:0;border:1.5px solid ${isStFocus?pillDot:pillDot+'55'};background:${isStFocus?pillDot+'22':pillBg};color:${isStFocus?pillDot:pillText};transition:all .1s;"
      onmouseover="this.style.background='${pillDot}33';this.style.borderColor='${pillDot}'"
      onmouseout="this.style.background='${isStFocus?pillDot+'22':pillBg}';this.style.borderColor='${isStFocus?pillDot:pillDot+'55'}'">
      <span style="width:5px;height:5px;border-radius:50%;background:${isStFocus?pillDot:pillDot+'88'};flex-shrink:0;"></span>
      <span style="overflow:hidden;text-overflow:ellipsis;">${esc(st.text)}</span>
    </span>`;
  }).join('');
  const chevronBtn=overflowCount>0
    ?`<span onclick="event.stopPropagation();toggleBoardSubExpand(${t.id})"
        title="${isSubExpanded?'Show fewer':'Show all '+subtasks.length+' sub-tasks'}"
        style="display:inline-flex;align-items:center;gap:2px;font-size:9px;font-family:'DM Mono',monospace;font-weight:700;padding:2px 7px;border-radius:20px;white-space:nowrap;flex-shrink:0;cursor:pointer;border:1.5px solid ${T.border};background:${isSubExpanded?T.surface3:T.surface2};color:${T.muted2};"
        onmouseover="this.style.borderColor='${T.accent2}';this.style.color='${T.accent2}'"
        onmouseout="this.style.borderColor='${T.border}';this.style.color='${T.muted2}'">
        ${isSubExpanded?`<i class="ti ti-chevron-up" style="font-size:9px;"></i>`:`+${overflowCount}`}
      </span>`
    :'';
  const subtaskPillsHtml=subtasks.length
    ?`<div style="margin-top:5px;display:flex;gap:3px;${isSubExpanded?'flex-wrap:wrap;':'overflow:hidden;flex-wrap:nowrap;'}${showRemove?'padding-left:12px;':''}">
        ${pillHtml}${chevronBtn}
      </div>`
    :'';

  // Board card note — truncated display + inline edit
  const cardNote=t.note||'';
  const isNoteEditing=boardCardNoteEditId===t.id;
  // How many chars fit in one line at ~170px card width: roughly 28 chars at font-size 10px
  const NOTE_TRUNC=40;
  const noteTruncated=cardNote.length>NOTE_TRUNC?cardNote.slice(0,NOTE_TRUNC)+'…':cardNote;
  const noteHtml=isNoteEditing
    ?`<div onclick="event.stopPropagation()" style="margin-top:5px;${showRemove?'padding-left:12px;':''}" data-no-clobber="true">
        <textarea id="board-note-textarea-${t.id}"
          placeholder="Note…"
          rows="2"
          onblur="saveBoardCardNoteBlur(${t.id})"
          onkeydown="if(event.key==='Escape'||event.key==='Enter'&&!event.shiftKey){event.preventDefault();saveBoardCardNote(${t.id});}"
          style="width:100%;box-sizing:border-box;font-family:'Syne',sans-serif;font-size:11px;line-height:1.4;background:${T.surface3};border:1px solid ${T.border2};border-radius:6px;padding:4px 7px;color:${T.inputText};outline:none;resize:none;"
        >${esc(cardNote)}</textarea>
      </div>`
    :`<div onclick="event.stopPropagation();openBoardCardNote(${t.id})"
        title="${cardNote?esc(cardNote):'Add a note…'}"
        style="margin-top:4px;${showRemove?'padding-left:12px;':''}display:flex;align-items:center;gap:4px;cursor:text;min-height:18px;padding:2px 5px;border-radius:5px;border:1px dashed ${cardNote?'transparent':T.border};">
        <span style="font-size:10px;color:${cardNote?T.muted2:T.muted2};opacity:${cardNote?0.7:0.5};flex-shrink:0;"><i class="ti ti-pencil-minus"></i></span>
        ${cardNote
          ?`<span style="font-size:10px;color:${T.muted};line-height:1.35;word-break:break-word;flex:1;">${esc(noteTruncated)}</span>`
          :`<span style="font-size:10px;color:${T.muted2};font-style:italic;opacity:0.6;">note…</span>`}
      </div>`;
  return `<div onclick="setFocus(${t.id})"
    ondblclick="event.stopPropagation();startTaskStopwatch(${t.id})"
    data-board-task-id="${t.id}"
    tabindex="0"
    title="${isFocus?(isRunning?'Double-click or Enter to stop':'Double-click or Enter to start timer'):'Click to select · Double-click to start'}"
    style="padding:9px 11px 9px 14px;border-radius:10px;border:1.5px solid ${isFocus?(isRunning?timerColor:(focusTask?T.accent:T.border)):T.border};background:${isFocus?T.surface2:T.surface};cursor:pointer;transition:all .15s;border-left:4px solid ${t.urgency>0?uColor:isFocus?T.accent:T.border};position:relative;outline:none;${isRunning?`animation:timerPulse 1.4s ease-in-out infinite;`:''}"
    onmouseover="this.style.background='${T.surface2}';this.style.borderColor='${T.accent}'"
    onmouseout="this.style.background='${isFocus?T.surface2:T.surface}';this.style.borderColor='${isFocus?(isRunning?timerColor:T.accent):T.border}'"
    onkeydown="if(event.key==='Enter'){event.preventDefault();startTaskStopwatch(${t.id});}">
    ${removeBtn}
    ${t.pinned?`<span style="position:absolute;top:5px;right:7px;font-size:10px;color:${T.accent2};opacity:0.7;"><i class="ti ti-pin"></i></span>`:''}
    ${isRunning?`<span style="position:absolute;top:5px;right:${t.pinned?'20px':'7px'};font-size:10px;color:${timerColor};"><i class="ti ti-player-play"></i></span>`:
      (isFocus&&!isRunning)?`<span style="position:absolute;top:5px;right:${t.pinned?'20px':'7px'};font-size:10px;color:${T.accent};opacity:0.6;" title="Press Enter to start"><i class="ti ti-player-play"></i></span>`:''}
    <div style="font-size:13px;font-weight:700;color:${T.text};line-height:1.3;padding-right:16px;${showRemove?'padding-left:12px;':''}word-break:break-word;">${esc(t.text)}</div>
    <div style="display:flex;align-items:center;gap:5px;margin-top:4px;flex-wrap:wrap;${showRemove?'padding-left:12px;':''}">
      ${cat?`<span style="width:6px;height:6px;border-radius:50%;background:${cat.color.dot};display:inline-block;flex-shrink:0;"></span><span style="font-size:10px;color:${T.muted2};">${esc(cat.name)}</span>`:''}
      ${t.ts?`<span style="font-family:'DM Mono',monospace;font-size:10px;color:${T.muted2};">${t.ts}</span>`:''}
      ${liveElapsed
        ?`<span id="board-timer-label-${t.id}" style="display:inline-flex;align-items:center;gap:3px;font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${timerColor};animation:timerPulse 1.4s ease-in-out infinite;"><i class="ti ti-clock" style="font-size:10px;opacity:0.5;"></i>${liveElapsed}</span>`
        :(tracked>0?`<span style="font-family:'DM Mono',monospace;font-size:10px;color:${T.muted};">${fmtDur(tracked)}</span>`:'')}
      ${t.status==='inprogress'?`<span style="font-size:9px;color:#f59e0b;font-weight:700;">●</span>`:''}
      ${isFocus&&!isRunning?`<span style="font-size:9px;color:${T.accent};font-weight:700;letter-spacing:.04em;">↵ START</span>`:''}
      ${isFocus&&isRunning?`<span style="font-size:9px;color:${timerColor};font-weight:700;letter-spacing:.04em;">↵ STOP</span>`:''}
    </div>
    ${subtaskPillsHtml}
    ${(()=>{
      // Show music meta chips for the currently focused subtask (if music cat)
      const isMusicCat=cat&&cat.name.toLowerCase().includes('music');
      if(!isMusicCat||!subtasks.length) return '';
      const focusedSt=subtasks.find(st=>focusTaskId===t.id&&focusSubtaskId===st.id);
      if(!focusedSt) return '';
      const mm=focusedSt.musicMeta||{};
      const chips=[];
      if(mm.key) chips.push(`<span style="font-size:9px;font-family:'DM Mono',monospace;font-weight:700;padding:1px 6px;border-radius:10px;background:${T.surface3};border:1px solid ${T.border2};color:${T.text};white-space:nowrap;"><span style="color:${T.muted2};font-weight:400;font-size:8px;">key </span>${esc(mm.key)}</span>`);
      if(mm.tuning) chips.push(`<span style="font-size:9px;font-family:'DM Mono',monospace;font-weight:700;padding:1px 6px;border-radius:10px;background:${T.surface3};border:1px solid ${T.border2};color:${T.text};white-space:nowrap;"><span style="color:${T.muted2};font-weight:400;font-size:8px;">tune </span>${esc(mm.tuning)}</span>`);
      if(mm.bpm) chips.push(`<span style="font-size:9px;font-family:'DM Mono',monospace;font-weight:700;padding:1px 6px;border-radius:10px;background:${T.surface3};border:1px solid ${T.border2};color:${T.text};white-space:nowrap;"><span style="color:${T.muted2};font-weight:400;font-size:8px;">bpm </span>${mm.bpm}</span>`);
      if(mm.lyrics) chips.push(`<span style="font-size:9px;font-family:'DM Mono',monospace;padding:1px 6px;border-radius:10px;background:${T.surface3};border:1px solid ${T.border2};color:${T.muted2};white-space:nowrap;"><i class="ti ti-music" style="font-size:8px;"></i> lyrics</span>`);
      if(!chips.length) return '';
      return `<div style="display:flex;gap:3px;flex-wrap:wrap;margin-top:4px;${showRemove?'padding-left:12px;':''}">${chips.join('')}</div>`;
    })()}
    ${noteHtml}
  </div>`;
}

