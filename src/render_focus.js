/*
MODULE: render_focus.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_focus.js responsibilities
USES: local modules
STATE_READS: T, state, tasks
STATE_WRITES: active, activeTasks, allEntries, ans, boardHtml, boardSection, boardTasks, cards, class, clobber
PUBLIC_API: _renderFocusDayLog, _renderFocusTaskLog, renderFocusBoardWidget
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Focus Board widget — task log, day log, and board orchestration.
// Timer visuals (_renderTimerVisual, _renderTimerBar) → render_focus_timer.js
// Board cards, manual picker, time targets → render_focusboard_cards.js
// Depends on: core.js (btnStyle, inputStyle, labelStyle, selectStyle), helpers.js (esc, getCat,
//             getTask, fmtDur, getTotalForTask, getSessionsForTask, getTotalOwnSessions,
//             getSubtask, avoidanceScore, getAllHitsForHabit), state.js,
//             actions_tasktimer.js, actions_tasks.js.
// Registered in render.js widgetRenderMap under key 'focusboard'.
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
 
function renderFocusBoardWidget(focusTask,todayStr,now){
  const nowMins=now.getHours()*60+now.getMinutes();
 
  // ── Live timer values ──
  const timerLabel=(()=>{const m=Math.floor(timerSecs/60),s=timerSecs%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;})();
  const isBreak=timerSessionType==='break';
  const timerColor=isBreak?T.accent2:(timerMode==='countdown'?T.pomo:T.accent2);
  const focusTotal=focusTask?(()=>{
    const saved=getTotalForTask(focusTask.id);
    const liveExtra=(timerRunning&&focusTaskId===focusTask.id&&timerSessionType!=='break')
      ?(timerMode==='stopwatch'?timerSecs:Math.max(0,timerPlannedSecs-timerSecs)):0;
    return saved+liveExtra;
  })():0;
 
  // ── Daily plan context ──
  const ans=dailyIntentions.answers;
  const priority=ans&&ans.oneWin;
  const intentionsStrip=priority?`
    <div style="display:flex;align-items:center;gap:7px;margin-bottom:10px;padding:6px 10px;background:${T.surface3};border:1px solid ${T.borderBlue||T.border};border-radius:8px;">
      <span style="font-size:11px;color:${T.accent};flex-shrink:0;"><i class="ti ti-target"></i></span>
      <div style="font-size:12px;color:${T.text};font-weight:600;line-height:1.4;word-break:break-word;flex:1;">${esc(priority)}</div>
    </div>`:''
 
  const {clockSvg,legendHtml,barLayoutHtml,barClockHtml,barRows} = _renderTimerVisual(focusTask,nowMins,focusTotal,now);
  const timerBar = _renderTimerBar(focusTask,focusTotal,timerColor,clockSvg,legendHtml,barClockHtml,barRows);
  // ── Transition prompt (block complete) ──
  if(showTransitionPrompt){
    const tpHtml=`
      <div style="background:${T.surface2};border:1.5px solid ${T.border2};border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:10px;margin-bottom:12px;">
        <div style="${labelStyle()}margin-bottom:0;"><i class="ti ti-brain"></i>block complete — 2-min reset</div>
        <div>
          <div style="font-size:11px;color:${T.muted};font-weight:700;margin-bottom:5px;">How's your energy now?</div>
          <div style="display:flex;gap:4px;">
            ${[{v:1,icon:'💤',label:'Low'},{v:2,icon:'🌙',label:'Lo-mid'},{v:3,icon:'☀️',label:'Mid'},{v:4,icon:'🔥',label:'High'},{v:5,icon:'⚡',label:'Peak'}].map(l=>`
            <button onclick="setEnergyPending('energy',${l.v});saveEnergyCheckin('${todayStr}')"
              title="${l.label}" style="${btnStyle(getEnergyToday(todayStr)&&getEnergyToday(todayStr).energy===l.v?'accent':'default','flex:1;flex-direction:column;align-items:center;font-size:14px;padding:4px 2px;border-radius:8px;line-height:1;')}">
              ${l.icon}<div style="font-size:8px;margin-top:1px;">${l.label}</div>
            </button>`).join('')}
          </div>
        </div>
        <input id="transition-reflect-input" type="text" maxlength="200" placeholder="Quick reflection… (optional)" value="${esc(transitionReflect)}" oninput="transitionReflect=this.value" onkeydown="if(event.key==='Enter'){transitionSaveAndContinue();}" style="${inputStyle('font-size:12px;')}" data-no-clobber="true"/>
        <div style="display:flex;gap:6px;">
          <button onclick="transitionSaveAndContinue()" style="${btnStyle('accent','font-size:12px;padding:6px 14px;flex:1;justify-content:center;')}"><i class="ti ti-device-floppy"></i>Save &amp; continue</button>
          <button onclick="transitionSkip()" style="${btnStyle('default','font-size:12px;padding:6px 12px;')}">Skip</button>
        </div>
      </div>`;
    return intentionsStrip+timerBar+tpHtml;
  }
 
  // ── Task quick-launch cards ──
  const activeTasks=tasks.filter(t=>t.status!=='done');
  const sortByUrgency=(a,b)=>{
    const ua=avoidanceScore(a),ub=avoidanceScore(b);
    if(ub!==ua) return ub-ua;
    const ta=a.ts||'99:99',tb=b.ts||'99:99';
    return ta<tb?-1:ta>tb?1:0;
  };
 
  // ── Mode pill selector ──
  const modePills=['all','urgent','manual'].map(m=>{
    const labels={all:'All',urgent:'Urgent',manual:'Manual'};
    const icons={all:'ti-layout-grid',urgent:'ti-flame',manual:'ti-list-check'};
    const active=focusBoardMode===m;
    return `<button onclick="setFocusBoardMode('${m}')"
      style="font-family:'Syne',sans-serif;font-size:11px;font-weight:700;padding:4px 12px;border-radius:999px;border:1.5px solid ${active?T.accent2:T.border};background:${active?T.accent2:'transparent'};color:${active?'#fff':T.muted};cursor:pointer;display:inline-flex;align-items:center;gap:5px;line-height:1;transition:all .15s;">
      <i class="ti ${icons[m]}" style="font-size:11px;"></i>${labels[m]}
    </button>`;
  }).join('');
  const modePillBar=`<div style="display:flex;gap:5px;align-items:center;margin-bottom:10px;">${modePills}</div>`;
 
  // ── Compute which tasks to show ──
  let boardTasks=[];
  if(focusBoardMode==='all'){
    const pinnedTasks=activeTasks.filter(t=>t.pinned);
    const regularTasks=activeTasks.filter(t=>!t.pinned).sort(sortByUrgency);
    boardTasks=[...pinnedTasks,...regularTasks];
  } else if(focusBoardMode==='urgent'){
    boardTasks=activeTasks.filter(t=>(t.urgency||0)>0||avoidanceScore(t)>=3).sort(sortByUrgency);
  } else {
    // manual: show tasks in the order they were added to the list; filter out done/missing
    boardTasks=focusBoardManualIds.map(id=>getTask(id)).filter(t=>t&&t.status!=='done');
  }
 
  // ── Build card grid ──
  let boardHtml='';
  if(boardTasks.length){
    const cards=boardTasks.map(t=>buildBoardCard(t,focusTask,timerColor,timerMode,timerSecs,timerPlannedSecs,timerRunning,focusBoardMode==='manual')).join('');
    boardHtml=`<div class="board-card-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:7px;">${cards}</div>`;
  } else if(focusBoardMode==='urgent'){
    boardHtml=`<div style="color:${T.muted2};font-size:12px;padding:8px 0;">No urgent tasks right now.</div>`;
  } else if(focusBoardMode==='manual'){
    boardHtml=`<div style="color:${T.muted2};font-size:12px;padding:8px 0;">No tasks added — use the picker below or drag tasks here.</div>`;
  } else {
    boardHtml=`<div style="color:${T.muted2};font-size:12px;padding:8px 0;">All tasks done 🎉 Add more in the Tasks widget.</div>`;
  }
 
  const manualPickerHtml = _renderManualPicker(focusTask);
  const {targetsPanel,targetsBtnLabel} = _renderTimeTargets(nowMins);
  // ── Focus Window mode segmented control ──────────────────────────────────────
  const fwModes=[
    {id:'clean',   label:'Clean',    icon:'ti-layout-navbar'},
    {id:'tasklog', label:'Task log', icon:'ti-clock-hour-4'},
    {id:'daylog',  label:'Day log',  icon:'ti-calendar-stats'},
  ];
  const fwSegmented=`
    <div style="display:inline-flex;border:1.5px solid ${T.border2};border-radius:8px;overflow:hidden;margin-bottom:10px;">
      ${fwModes.map(m=>`<button onclick="focusWindowMode='${m.id}';render()"
        style="font-family:'Syne',sans-serif;font-size:11px;font-weight:700;padding:5px 12px;border:none;border-right:1px solid ${T.border};cursor:pointer;background:${focusWindowMode===m.id?T.accent2:'transparent'};color:${focusWindowMode===m.id?'#fff':T.muted};transition:all .12s;display:inline-flex;align-items:center;gap:5px;">
        <i class="ti ${m.icon}" style="font-size:12px;"></i>${m.label}
      </button>`).join('')}
    </div>`;
 
  // ── Task log mode — sessions for the focused task ─────────────────────────
  const taskLogContent=_renderFocusTaskLog(focusTask,todayStr);
 
  // ── Day log mode — full timeline ──────────────────────────────────────────
  const dayLogContent=_renderFocusDayLog(todayStr);
 
  // Choose what to show in focus window based on mode
  const focusWindowContent=focusWindowMode==='clean'?''
    :focusWindowMode==='tasklog'?taskLogContent
    :dayLogContent;
 
  // In Clean + Tasklog modes show board cards; Day log replaces them
  const boardSection=focusWindowMode!=='daylog'
    ?`<div style="margin-bottom:10px;">${modePillBar}${boardHtml}${manualPickerHtml}</div>`
    :'';
 
  return `
    ${intentionsStrip}
    ${timerBar}
    ${fwSegmented}
    ${focusWindowContent}
    ${boardSection}
    <!-- Time targets toggle -->
    <div style="border-top:1.5px solid ${T.border};padding-top:8px;">
      <button onclick="toggleTimeTargets()" style="${btnStyle(showTimeTargets?'accent2':'default','font-size:11px;padding:4px 10px;border-radius:999px;')}">${targetsBtnLabel}</button>
      ${targetsPanel}
    </div>
  `;
 
}
 
// Helper: build a single board card (extracted to avoid duplication above)
 
registerWidget({
  id: 'focusboard',
  label: 'Focus Board',
  icon: 'ti-dashboard',
  pinnable: false,
  collapsible: true,
  fullWidth: true,
  defaultVisible: true,
  render: renderFocusBoardWidget,
});