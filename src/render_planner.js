/*
MODULE: render_planner.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_planner.js responsibilities
USES: local modules
STATE_READS: T, state, tasks
STATE_WRITES: Click, DAYS_FULL, DAY_LABELS, DAY_SHORT, MAX_SHOW, MONTHS_FULL, MONTH_NAMES, MONTH_SHORT, active, anchor
PUBLIC_API: _plannerDateLabel, _renderPlannerDump, _renderPlannerMonth, _renderPlannerSidebar, _renderPlannerTimeline, _renderPlannerWeek, _tlPillHtml, renderPlannerWidget
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Planner widget — month / week / day views with persistent left sidebar.
// Depends on: core.js (btnStyle,inputStyle,selectStyle), helpers.js (esc,getCat,getTask,
//             normalizeTaskTime,getTotalForTask,fmtDur), state.js, actions_planner.js.
// Registered via registerWidget().

function _plannerDateLabel(ymd){
  const d=ymdToDate(ymd);
  const DAYS_FULL=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const MONTHS_FULL=['January','February','March','April','May','June','July','August','September','October','November','December'];
  return DAYS_FULL[d.getDay()]+', '+d.getDate()+' '+MONTHS_FULL[d.getMonth()]+' '+d.getFullYear();
}

// ── Sidebar (persistent left strip) ──────────────────────────────────────────
function _renderPlannerSidebar(){
  const views=[
    {id:'month', icon:'ti-calendar-month', label:'Month'},
    {id:'week',  icon:'ti-calendar-week',  label:'Week'},
    {id:'day',   icon:'ti-calendar-event', label:'Day'},
  ];
  // Show zoom controls only in day/week views
  const showZoom=plannerView==='day'||plannerView==='week';
  // Show layout toggle only in day view
  const showLayout=plannerView==='day';

  const viewBtns=views.map(v=>{
    const active=plannerView===v.id||(plannerView==='dump'&&v.id==='day');
    return `<button
      onclick="${v.id==='day'?`plannerSelectedDate=plannerSelectedDate||todayYMD();plannerView='day';render()`:`plannerView='${v.id}';render()`}"
      title="${v.label}"
      style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:7px 0;border:none;cursor:pointer;border-radius:8px;width:100%;background:${active?T.accent2+'22':'transparent'};color:${active?T.accent2:T.muted};">
      <i class="ti ${v.icon}" style="font-size:16px;"></i>
      <span style="font-size:8px;font-weight:700;letter-spacing:.04em;">${v.label}</span>
    </button>`;
  }).join('');

  const divider=`<div style="height:1px;background:${T.border};margin:4px 0;"></div>`;

  const zoomControls=showZoom?`
    ${divider}
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
      <button onclick="plannerNudgeZoom(0.1)" title="Zoom in"
        style="width:28px;height:28px;border-radius:6px;border:1px solid ${T.border};background:${T.surface};color:${T.muted};cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">+</button>
      <span style="font-size:9px;font-family:'DM Mono',monospace;color:${T.muted2};">${Math.round(plannerZoom*100)}%</span>
      <button onclick="plannerNudgeZoom(-0.1)" title="Zoom out"
        style="width:28px;height:28px;border-radius:6px;border:1px solid ${T.border};background:${T.surface};color:${T.muted};cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;">−</button>
      <button onclick="plannerSetZoom(1)" title="Reset zoom"
        style="width:28px;height:16px;border-radius:4px;border:1px solid ${T.border};background:${T.surface};color:${T.muted2};cursor:pointer;font-size:8px;margin-top:1px;">1×</button>
    </div>`:'';

  const layoutControls=showLayout?`
    ${divider}
    <div style="display:flex;flex-direction:column;align-items:center;gap:3px;">
      <button onclick="plannerSetDayLayout('vertical')" title="Vertical timeline"
        style="width:28px;height:28px;border-radius:6px;border:1px solid ${plannerDayLayout==='vertical'?T.accent2:T.border};background:${plannerDayLayout==='vertical'?T.accent2+'22':'transparent'};color:${plannerDayLayout==='vertical'?T.accent2:T.muted};cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;">
        <i class="ti ti-layout-rows"></i></button>
      <button onclick="plannerSetDayLayout('horizontal')" title="Horizontal timeline"
        style="width:28px;height:28px;border-radius:6px;border:1px solid ${plannerDayLayout==='horizontal'?T.accent2:T.border};background:${plannerDayLayout==='horizontal'?T.accent2+'22':'transparent'};color:${plannerDayLayout==='horizontal'?T.accent2:T.muted};cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;">
        <i class="ti ti-layout-columns"></i></button>
    </div>`:'';

  // Today shortcut
  const plannerAiBtn = aiSettings.masterEnabled ? `
    ${divider}
    <button onclick="dumpAiDailyPlan()" title="Ask AI for a planner suggestion"
      style="position:relative;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0;border:none;cursor:pointer;border-radius:8px;width:100%;background:${T.surface2};color:${T.accent};">
      <i class="ti ti-sparkles" style="font-size:15px;"></i>
      <span style="font-size:8px;font-weight:700;">AI plan</span>
      ${aiPendingSuggestion?`<span style="position:absolute;top:4px;right:6px;width:6px;height:6px;border-radius:50%;background:${T.accent};"></span>`:''}
    </button>` : '';

  const plannerPlanPreviewBtn = aiSettings.masterEnabled ? `
    <button onclick="openAiPlanPrompt()" title="Plan preview"
      style="margin-top:6px;display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 0;border:none;cursor:pointer;border-radius:8px;width:100%;background:${T.surface};color:${T.muted};">
      <i class="ti ti-eye" style="font-size:14px;"></i>
      <span style="font-size:8px;font-weight:700;">Plan preview</span>
    </button>` : '';

  const todayBtn=`
    ${divider}
    <button onclick="plannerSelectDate(todayYMD())" title="Go to today"
      style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:5px 0;border:none;cursor:pointer;border-radius:8px;width:100%;background:transparent;color:${T.muted};">
      <i class="ti ti-calendar-today" style="font-size:15px;"></i>
      <span style="font-size:8px;font-weight:700;">Today</span>
    </button>`;

  return `<div style="width:44px;flex-shrink:0;display:flex;flex-direction:column;align-items:center;padding:8px 4px;gap:2px;background:${T.surface};border-right:1px solid ${T.border};">
    ${viewBtns}
    ${zoomControls}
    ${layoutControls}
    ${plannerAiBtn}${plannerPlanPreviewBtn}
    ${todayBtn}
  </div>`;
}

// ── Pill builder (shared between vertical + horizontal day views) ─────────────
function _tlPillHtml(t, z){
  const [th,tm]=t.ts.split(':').map(Number);
  const startMins=th*60+tm;
  if(startMins<TL_START_HOUR*60||startMins>=TL_END_HOUR*60) return '';
  const dur=t.durationMins||30;
  const endMins=startMins+dur;
  const pxPerMin=TL_PX_PER_MIN*z;
  const cat=getCat(t.catId);
  const bg=cat?cat.color.bg:T.surface2;
  const textCol=cat?cat.color.text:T.muted;
  const dot=cat?cat.color.dot:T.accent2;
  const isFocused=focusTaskId===t.id;
  const isHighlighted=plannerHighlightTaskId===t.id;
  const tracked=getTotalForTask(t.id);
  const isUntracked=t.durationMins&&tracked===0;
  const isH=plannerDayLayout==='horizontal';
  const pos=isH
    ?`left:${_tlMinsToX(startMins,z)}px;top:4px;bottom:4px;width:${Math.max(TL_SNAP*pxPerMin,dur*pxPerMin)}px;`
    :`top:${_tlMinsToY(startMins,z)}px;left:4px;right:4px;height:${Math.max(TL_SNAP*pxPerMin,dur*pxPerMin)}px;`;
  // Resize handle: right edge for horizontal, bottom edge for vertical
  const resizeHandle=isH
    ?`<div onpointerdown="tlResizeStart(event,${t.id},this.closest('.tl-scroll'))"
         onclick="event.stopPropagation()"
         style="position:absolute;top:0;right:0;bottom:0;width:6px;cursor:ew-resize;display:flex;align-items:center;justify-content:center;opacity:0.4;"
         onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.4">
         <div style="width:2px;height:12px;background:${dot};border-radius:1px;"></div></div>`
    :`<div onpointerdown="tlResizeStart(event,${t.id},this.closest('.tl-scroll'))"
         onclick="event.stopPropagation()"
         style="position:absolute;bottom:0;left:0;right:0;height:6px;cursor:ns-resize;display:flex;align-items:center;justify-content:center;opacity:0.4;"
         onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.4">
         <div style="width:20px;height:2px;background:${dot};border-radius:1px;"></div></div>`;
  return `<div id="tl-pill-${t.id}"
    style="position:absolute;${pos}
           background:${bg};border:1.5px solid ${isHighlighted?T.accent:isFocused?T.accent2:dot+'66'};
           border-left:${isH?'1.5px':'3px'} solid ${dot};border-top:${isH?'3px':'1.5px'} solid ${dot};
           border-radius:6px;overflow:hidden;cursor:pointer;box-sizing:border-box;z-index:5;"
    onpointerdown="tlMoveStart(event,${t.id},this.closest('.tl-scroll'))"
    onclick="tlPillClick(${t.id})"
    onmouseover="this.style.boxShadow='0 2px 10px rgba(0,0,0,.2)'"
    onmouseout="this.style.boxShadow=''"
    title="${esc(t.text)} · ${_tlMinsToHHMM(startMins)}–${_tlMinsToHHMM(endMins)}${tracked?' · '+fmtDur(tracked)+' tracked':''}">
    <div style="padding:2px 5px 1px;overflow:hidden;${isH?'white-space:nowrap;':''}" >
      <div class="tl-time" style="font-size:8px;font-family:'DM Mono',monospace;color:${textCol};opacity:0.7;line-height:1.2;overflow:hidden;text-overflow:ellipsis;">${_tlMinsToHHMM(startMins)}–${_tlMinsToHHMM(endMins)}</div>
      <div style="font-size:10px;font-weight:700;color:${textCol};overflow:hidden;text-overflow:ellipsis;line-height:1.3;">${esc(t.text)}</div>
      ${isUntracked?`<div style="font-size:8px;font-weight:700;color:${T.urg1};opacity:0.8;">untracked</div>`:''}
    </div>
    <!-- Remove button -->
    <div onclick="event.stopPropagation();tlClearTaskTime(${t.id})"
         style="position:absolute;top:2px;right:3px;width:12px;height:12px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;color:${textCol};opacity:0.3;cursor:pointer;"
         onmouseover="this.style.opacity=1;this.style.background='${T.surface}'"
         onmouseout="this.style.opacity=0.3;this.style.background='transparent'" title="Remove from timeline">×</div>
    ${resizeHandle}
  </div>`;
}

// ── Day view (vertical or horizontal) ────────────────────────────────────────
function _renderPlannerTimeline(ymd){
  const todayYmd2=dateToYMD(new Date());
  const isToday=ymd===todayYmd2;
  const label=_plannerDateLabel(ymd);
  const z=plannerZoom;
  const pxPerMin=TL_PX_PER_MIN*z;
  const totalPx=Math.round((TL_END_HOUR-TL_START_HOUR)*60*pxPerMin);
  const labelW=TL_LABEL_W;
  const tlTasks=tasks.filter(t=>t.ts&&t.status!=='done');
  const isH=plannerDayLayout==='horizontal';

  // Gridlines
  const gridLines=[];
  for(let h=TL_START_HOUR;h<=TL_END_HOUR;h++){
    const isMajor=h%3===0;
    const isCurrentHour=isToday&&h===new Date().getHours();
    const px=isH?_tlMinsToX(h*60,z):_tlMinsToY(h*60,z);
    const label=`<span style="font-size:9px;font-family:'DM Mono',monospace;color:${isCurrentHour?T.accent2:T.muted2};line-height:1;">${String(h).padStart(2,'0')}:00</span>`;
    if(isH){
      gridLines.push(`<div style="position:absolute;top:0;bottom:0;left:${px}px;display:flex;flex-direction:column;pointer-events:none;">
        <div style="padding:0 3px;height:${labelW}px;display:flex;align-items:center;">${label}</div>
        <div style="flex:1;width:${isMajor?'1.5px':'0.5px'};background:${isMajor?T.border:T.surface3};"></div>
      </div>`);
    } else {
      gridLines.push(`<div style="position:absolute;left:0;right:0;top:${px}px;display:flex;align-items:center;pointer-events:none;">
        <span style="width:${labelW}px;flex-shrink:0;font-size:9px;font-family:'DM Mono',monospace;color:${isCurrentHour?T.accent2:T.muted2};text-align:right;padding-right:6px;line-height:1;">${String(h).padStart(2,'0')}:00</span>
        <div style="flex:1;height:${isMajor?'1.5px':'0.5px'};background:${isMajor?T.border:T.surface3};"></div>
      </div>`);
    }
  }

  // Now line
  let nowLine='';
  if(isToday){
    const nowMins=new Date().getHours()*60+new Date().getMinutes();
    if(nowMins>=TL_START_HOUR*60&&nowMins<=TL_END_HOUR*60){
      const np=isH?_tlMinsToX(nowMins,z):_tlMinsToY(nowMins,z);
      nowLine=isH
        ?`<div style="position:absolute;top:0;bottom:0;left:${np}px;width:2px;background:${T.pomo};pointer-events:none;z-index:10;">
            <div style="position:absolute;left:-3px;top:${labelW-4}px;width:8px;height:8px;border-radius:50%;background:${T.pomo};"></div></div>`
        :`<div style="position:absolute;left:${labelW}px;right:0;top:${np}px;height:2px;background:${T.pomo};pointer-events:none;z-index:10;">
            <div style="position:absolute;left:-4px;top:-3px;width:8px;height:8px;border-radius:50%;background:${T.pomo};"></div></div>`;
    }
  }

  // Pills
  const pillsHtml=tlTasks.map(t=>_tlPillHtml(t,z)).join('');

  // Draft pill
  let draftPill='';
  if(timelineNewTaskDraft){
    const {startMins,endMins}=timelineNewTaskDraft;
    const sz=Math.max(TL_SNAP*pxPerMin,(endMins-startMins)*pxPerMin);
    const catOpts=`<option value="">— no category</option>`+categories.map(c=>`<option value="${c.id}" ${timelineNewTaskCatId===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
    const draftStyle=isH
      ?`left:${_tlMinsToX(startMins,z)}px;top:${labelW+4}px;bottom:4px;width:${sz}px;`
      :`top:${_tlMinsToY(startMins,z)}px;left:${labelW+4}px;right:4px;height:${sz}px;`;
    draftPill=`
      <div id="tl-draft-pill" style="position:absolute;${draftStyle}
           background:${T.surface3};border:2px dashed ${T.accent2};border-radius:6px;z-index:20;
           box-sizing:border-box;pointer-events:none;">
        <div id="tl-draft-label" style="font-size:9px;font-family:'DM Mono',monospace;color:${T.accent2};padding:3px 5px;">${_tlMinsToHHMM(startMins)} – ${_tlMinsToHHMM(endMins)}</div>
      </div>
      <!-- Text input overlay -->
      <div onclick="event.stopPropagation()" style="position:absolute;${isH?`left:${_tlMinsToX(startMins,z)}px;top:${labelW+sz+8}px;`:`top:${_tlMinsToY(startMins,z)+sz+4}px;left:${labelW+4}px;right:4px;`}z-index:30;
           background:${T.surface};border:1.5px solid ${T.accent2};border-radius:8px;padding:7px 8px;
           box-shadow:0 4px 16px rgba(0,0,0,.18);min-width:180px;" data-no-clobber="true">
        <div style="font-size:9px;color:${T.accent2};font-weight:700;margin-bottom:4px;">${_tlMinsToHHMM(startMins)}–${_tlMinsToHHMM(endMins)} · new task</div>
        <input id="tl-new-task-input" type="text" placeholder="Task name…" value="${esc(timelineNewTaskText)}"
          oninput="timelineNewTaskText=this.value"
          onkeydown="if(event.key==='Enter'){tlCommitNewTask();}if(event.key==='Escape'){tlCancelNewTask();}"
          style="${inputStyle('font-size:12px;padding:5px 8px;margin-bottom:5px;')}"/>
        <div style="display:flex;gap:5px;flex-wrap:wrap;">
          <select onchange="timelineNewTaskCatId=this.value" style="${selectStyle('font-size:11px;padding:3px 6px;flex:1;min-width:80px;')}">${catOpts}</select>
          <button onclick="tlCommitNewTask()" style="${btnStyle('accent','font-size:11px;padding:4px 9px;')}"><i class="ti ti-check"></i>Add</button>
          <button onclick="tlCancelNewTask()" style="${btnStyle('default','font-size:11px;padding:4px 7px;')}"><i class="ti ti-x"></i></button>
        </div>
      </div>`;
  }

  // Unscheduled tray
  const unscheduled=tasks.filter(t=>!t.ts&&t.status!=='done');
  const unschTray=unscheduled.length?`
    <div style="padding:5px 10px;border-top:1px solid ${T.border};background:${T.surface};">
      <span style="font-size:10px;font-weight:700;color:${T.muted};text-transform:uppercase;letter-spacing:.06em;margin-right:8px;"><i class="ti ti-inbox"></i> Unscheduled (${unscheduled.length})</span>
      <span style="font-size:9px;color:${T.muted2};">click to place at 09:00</span>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:4px;">
        ${unscheduled.slice(0,7).map(t=>{const cat=getCat(t.catId);return `<span onclick="tasks.find(x=>x.id===${t.id}).ts='09:00';tasks.find(x=>x.id===${t.id}).durationMins=30;save();render()"
          style="font-size:11px;padding:2px 9px;border-radius:20px;cursor:pointer;border:1px dashed ${T.border2};background:${cat?cat.color.bg:T.surface2};color:${cat?cat.color.text:T.muted};"
          onmouseover="this.style.opacity='0.7'" onmouseout="this.style.opacity='1'">${esc(t.text.length>20?t.text.slice(0,20)+'…':t.text)}</span>`;}).join('')}
        ${unscheduled.length>7?`<span style="font-size:10px;color:${T.muted2};padding:4px 0;">+${unscheduled.length-7} more</span>`:''}
      </div>
    </div>`:'';

  // Header: date + dump shortcut
  const header=`<div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid ${T.border};background:${isToday?T.surface3:T.surface};">
    <div style="flex:1;font-size:13px;font-weight:700;color:${T.text};">${label}${isToday?` <span style="font-size:10px;padding:1px 6px;border-radius:10px;border:1px solid ${T.border};color:${T.accent};">today</span>`:''}</div>
    <button onclick="plannerOpenDump('${ymd}')" style="${btnStyle('default','font-size:11px;padding:3px 8px;')}" title="Day notes"><i class="ti ti-notes"></i></button>
  </div>`;

  if(isH){
    // Horizontal: time axis = X, tasks stack on Y with fixed 60px row height
    const bodyH=Math.max(160,tlTasks.length*52+labelW+16);
    return `${header}
      <div class="tl-scroll" style="position:relative;height:${Math.min(460,bodyH)}px;max-height:460px;overflow:auto;background:${T.surface};"
        onpointerdown="if(event.target===this||event.target.classList.contains('tl-grid-bg'))tlCreateStart(event,this)"
        onpointermove="tlPointerMove(event,this)" onpointerup="tlPointerUp(event,this)"
        onpointercancel="timelineDragState=null;render()">
        <div style="position:relative;height:${bodyH}px;width:${totalPx+labelW}px;min-width:100%;">
          <!-- Time axis row -->
          <div class="tl-grid-bg" style="position:absolute;inset:0;pointer-events:none;">
            ${gridLines.join('')}
            ${nowLine}
          </div>
          <!-- Pills area -->
          <div style="position:absolute;top:${labelW}px;left:0;right:0;bottom:0;">
            ${pillsHtml}
            ${draftPill}
          </div>
        </div>
      </div>
      ${unschTray}`;
  }

  // Vertical
  return `${header}
    <div class="tl-scroll" style="position:relative;height:460px;overflow-y:auto;overflow-x:hidden;background:${T.surface};"
      onpointerdown="if(event.target===this||event.target.classList.contains('tl-grid-bg'))tlCreateStart(event,this)"
      onpointermove="tlPointerMove(event,this)" onpointerup="tlPointerUp(event,this)"
      onpointercancel="timelineDragState=null;render()">
      <div class="tl-grid-bg" style="position:absolute;inset:0;height:${totalPx}px;pointer-events:none;">
        ${gridLines.join('')}${nowLine}
      </div>
      <div style="position:relative;height:${totalPx}px;">
        ${pillsHtml}${draftPill}
      </div>
    </div>
    ${unschTray}`;
}

// ── Week view ─────────────────────────────────────────────────────────────────
function _renderPlannerWeek(){
  const today=new Date();
  const todayYmd2=dateToYMD(today);
  // Week: Mon–Sun containing today (or plannerSelectedDate if set)
  const anchor=plannerSelectedDate?ymdToDate(plannerSelectedDate):today;
  const day=anchor.getDay(); // 0=Sun
  const monday=new Date(anchor);
  monday.setDate(anchor.getDate()-((day+6)%7));
  const days=Array.from({length:7},(_,i)=>{
    const d=new Date(monday);d.setDate(monday.getDate()+i);
    return dateToYMD(d);
  });
  const DAY_SHORT=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const z=plannerZoom;
  const pxPerMin=TL_PX_PER_MIN*z;
  const totalPx=Math.round((TL_END_HOUR-TL_START_HOUR)*60*pxPerMin);
  const labelW=32;
  const tlTasks=tasks.filter(t=>t.ts&&t.status!=='done');

  // Hour gridlines (vertical)
  const gridLines=[];
  for(let h=TL_START_HOUR;h<=TL_END_HOUR;h++){
    const y=_tlMinsToY(h*60,z);
    const isMajor=h%3===0;
    gridLines.push(`<div style="position:absolute;left:0;right:0;top:${y}px;height:${isMajor?'1.5':'0.5'}px;background:${isMajor?T.border:T.surface3};pointer-events:none;"></div>
      ${isMajor?`<span style="position:absolute;left:0;top:${y}px;width:${labelW}px;font-size:8px;font-family:'DM Mono',monospace;color:${T.muted2};line-height:1;padding-top:1px;text-align:right;padding-right:3px;">${String(h).padStart(2,'0')}</span>`:''}
    `);
  }

  const cols=days.map((ymd,i)=>{
    const isToday=ymd===todayYmd2;
    const d=ymdToDate(ymd);
    const dumpCount=(plannerDayDumps[ymd]||[]).filter(x=>!x.done).length;
    // Pills for this day — for week view we just show all ts tasks on every column
    // (tasks are time-of-day not date-specific; week view mirrors the day view)
    const colPills=tlTasks.map(t=>{
      const [th,tm]=t.ts.split(':').map(Number);
      const startMins=th*60+tm;
      if(startMins<TL_START_HOUR*60||startMins>=TL_END_HOUR*60) return '';
      const dur=t.durationMins||30;
      const cat=getCat(t.catId);
      const bg=cat?cat.color.bg:T.surface2;
      const dot=cat?cat.color.dot:T.accent2;
      const textCol=cat?cat.color.text:T.muted;
      const top=_tlMinsToY(startMins,z);
      const height=Math.max(TL_SNAP*pxPerMin,dur*pxPerMin);
      return `<div onclick="plannerOpenTimeline('${ymd}');focusTaskId=${t.id};render()"
        style="position:absolute;left:2px;right:2px;top:${top}px;height:${height}px;
               background:${bg};border-left:3px solid ${dot};border-radius:4px;
               overflow:hidden;cursor:pointer;box-sizing:border-box;z-index:3;"
        onmouseover="this.style.boxShadow='0 1px 6px rgba(0,0,0,.15)'"
        onmouseout="this.style.boxShadow=''"
        title="${esc(t.text)} · ${_tlMinsToHHMM(startMins)}">
        <div style="padding:1px 3px;font-size:9px;font-weight:700;color:${textCol};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.text)}</div>
      </div>`;
    }).join('');
    // Now line in today's column
    let nowDot='';
    if(isToday){
      const nowMins=today.getHours()*60+today.getMinutes();
      if(nowMins>=TL_START_HOUR*60&&nowMins<=TL_END_HOUR*60){
        const ny=_tlMinsToY(nowMins,z);
        nowDot=`<div style="position:absolute;left:0;right:0;top:${ny}px;height:2px;background:${T.pomo};pointer-events:none;z-index:10;"></div>`;
      }
    }
    return `<div style="flex:1;min-width:0;border-left:1px solid ${T.border};">
      <!-- Day header -->
      <div onclick="plannerOpenTimeline('${ymd}')"
        style="padding:3px 4px;text-align:center;border-bottom:1px solid ${T.border};
               background:${isToday?T.surface3:T.surface};cursor:pointer;user-select:none;">
        <div style="font-size:10px;font-weight:${isToday?800:600};color:${isToday?T.accent:T.muted};">${DAY_SHORT[i]}</div>
        <div style="font-size:12px;font-weight:${isToday?800:500};color:${isToday?T.accent:T.text};">${d.getDate()}</div>
        ${aiPendingSuggestion && isToday?`<div style="width:8px;height:8px;border-radius:50%;background:${T.accent};margin:4px auto 0;"></div>`:''}
        ${dumpCount?`<div style="font-size:8px;color:${T.accent2};font-weight:700;">${dumpCount}</div>`:''}
      </div>
      <!-- Pills column -->
      <div style="position:relative;height:${totalPx}px;">
        ${colPills}${nowDot}
      </div>
    </div>`;
  }).join('');

  // Week nav
  const prevMon=new Date(monday);prevMon.setDate(monday.getDate()-7);
  const nextMon=new Date(monday);nextMon.setDate(monday.getDate()+7);
  const MONTH_SHORT=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const weekLabel=`${monday.getDate()} ${MONTH_SHORT[monday.getMonth()]} – ${days[6].split('-')[2]} ${MONTH_SHORT[ymdToDate(days[6]).getMonth()]} ${monday.getFullYear()}`;

  return `
    <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid ${T.border};background:${T.surface};">
      <button onclick="plannerSelectedDate='${dateToYMD(prevMon)}';render()" style="${btnStyle('default','font-size:11px;padding:3px 8px;')}"><i class="ti ti-chevron-left"></i></button>
      <div style="flex:1;text-align:center;font-size:12px;font-weight:700;color:${T.text};">${weekLabel}</div>
      <button onclick="plannerSelectedDate='${dateToYMD(nextMon)}';render()" style="${btnStyle('default','font-size:11px;padding:3px 8px;')}"><i class="ti ti-chevron-right"></i></button>
    </div>
    <div style="display:flex;overflow:auto;background:${T.surface};">
      <!-- Hour labels -->
      <div style="width:${labelW}px;flex-shrink:0;position:relative;padding-top:42px;">
        <div style="position:relative;height:${totalPx}px;">${gridLines.join('')}</div>
      </div>
      <!-- Day columns -->
      ${cols}
    </div>`;
}

// ── Month view ────────────────────────────────────────────────────────────────
function _renderPlannerMonth(){
  const today=new Date();
  const todayYmd2=dateToYMD(today);
  if(!plannerMonth) plannerMonth={year:today.getFullYear(),month:today.getMonth()};
  const {year,month}=plannerMonth;
  const MONTH_NAMES=['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAY_LABELS=['Mo','Tu','We','Th','Fr','Sa','Su'];
  const firstDay=new Date(year,month,1);
  const lastDay=new Date(year,month+1,0);
  const startPad=(firstDay.getDay()+6)%7;
  const cells=[];
  for(let i=0;i<startPad;i++) cells.push(null);
  for(let d=1;d<=lastDay.getDate();d++) cells.push(year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0'));
  while(cells.length%7!==0) cells.push(null);

  const scheduledTasks=tasks.filter(t=>t.ts&&t.status!=='done');

  const rows=[];
  for(let r=0;r<cells.length/7;r++){
    const tds=cells.slice(r*7,r*7+7).map(ymd=>{
      if(!ymd) return `<td style="border:1px solid ${T.border};background:${T.surface2};min-height:56px;"></td>`;
      const isToday=ymd===todayYmd2;
      const isSelected=ymd===plannerSelectedDate;
      const isPast=ymd<todayYmd2;
      const dayNum=Number(ymd.split('-')[2]);
      const bg=isSelected?T.accent2+'22':isToday?T.surface3:isPast?T.surface2:T.surface;
      const dumpCount=(plannerDayDumps[ymd]||[]).filter(x=>!x.done).length;
      const MAX_SHOW=3;
      const dayDots=scheduledTasks.slice(0,MAX_SHOW).map(t=>{const cat=getCat(t.catId);return `<span style="width:5px;height:5px;border-radius:50%;background:${cat?cat.color.dot:T.accent2};display:inline-block;flex-shrink:0;"></span>`;}).join('');
      const overflow=scheduledTasks.length>MAX_SHOW?`<span style="font-size:7px;color:${T.muted2};">+${scheduledTasks.length-MAX_SHOW}</span>`:'';
      return `<td onclick="plannerSelectDate('${ymd}')" ondblclick="event.stopPropagation();plannerOpenTimeline('${ymd}')"
        style="border:${isSelected||isToday?'2px':'1px'} solid ${isSelected?T.accent2:isToday?T.border2:T.border};
               vertical-align:top;cursor:pointer;padding:3px 4px;min-height:56px;background:${bg};user-select:none;">
        <div style="font-size:11px;font-weight:${isToday?800:500};color:${isToday?T.accent:isPast?T.muted2:T.text};">${dayNum}</div>
        ${aiPendingSuggestion && isToday?`<div style="width:8px;height:8px;border-radius:50%;background:${T.accent};margin:4px 0 2px;"></div>`:''}
        <div style="display:flex;flex-wrap:wrap;gap:2px;margin-top:2px;align-items:center;">${dayDots}${overflow}${dumpCount?`<span style="font-size:8px;font-weight:700;color:${T.accent2};">${dumpCount}</span>`:''}</div>
      </td>`;
    }).join('');
    rows.push(`<tr>${tds}</tr>`);
  }

  return `
    <div style="display:flex;align-items:center;gap:6px;padding:6px 10px;border-bottom:1px solid ${T.border};background:${T.surface};">
      <button onclick="plannerNavMonth(-1)" style="${btnStyle('default','font-size:11px;padding:3px 8px;')}"><i class="ti ti-chevron-left"></i></button>
      <div style="flex:1;text-align:center;font-size:13px;font-weight:700;color:${T.text};">${MONTH_NAMES[month]} ${year}</div>
      <button onclick="plannerNavMonth(1)" style="${btnStyle('default','font-size:11px;padding:3px 8px;')}"><i class="ti ti-chevron-right"></i></button>
    </div>
    <div style="padding:2px 8px 2px;background:${T.surface};border-bottom:1px solid ${T.border};font-size:9px;color:${T.muted2};">Click = capture · double-click = schedule</div>
    <div style="overflow-x:auto;background:${T.surface};">
      <table style="width:100%;border-collapse:collapse;min-width:280px;table-layout:fixed;">
        <thead><tr>${DAY_LABELS.map(l=>`<th style="font-size:9px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.muted};padding:3px 0;text-align:center;border:1px solid ${T.border};background:${T.surface2};">${l}</th>`).join('')}</tr></thead>
        <tbody>${rows.join('')}</tbody>
      </table>
    </div>`;
}

// ── Dump day view (unchanged) ─────────────────────────────────────────────────
function _renderPlannerDump(ymd){
  const todayYmd2=dateToYMD(new Date());
  const isToday=ymd===todayYmd2;
  const label=_plannerDateLabel(ymd);
  const dumps=(plannerDayDumps[ymd]||[]);
  const unscheduled=tasks.filter(t=>!t.ts&&t.status!=='done');
  const scheduledToday=tasks.filter(t=>t.ts&&t.status!=='done');

  const dumpRows=dumps.length?dumps.map(item=>`
    <div style="display:flex;align-items:center;gap:7px;padding:5px 0;border-bottom:1px dashed ${T.border};">
      <div onclick="plannerToggleDump('${ymd}',${item.id})"
        style="width:16px;height:16px;border-radius:4px;border:1.5px solid ${item.done?T.green:T.border2};background:${item.done?T.green:'transparent'};flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;box-sizing:border-box;">
        ${item.done?'<span style="color:#fff;font-size:10px;line-height:1">✓</span>':''}
      </div>
      <span style="flex:1;font-size:13px;color:${item.done?T.muted2:T.text};${item.done?'text-decoration:line-through;':''};word-break:break-word;">${esc(item.text)}</span>
      <button onclick="plannerPromoteDump('${ymd}',${item.id})" title="Add to Tasks" style="${btnStyle('default','font-size:10px;padding:2px 6px;')}"><i class="ti ti-list-check"></i></button>
      <span onclick="plannerDeleteDump('${ymd}',${item.id})" style="opacity:0.3;cursor:pointer;font-size:12px;color:${T.muted2};padding:0 2px;"
        onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.3">×</span>
    </div>`).join('')
    :`<div style="font-size:12px;color:${T.muted2};padding:8px 0;font-style:italic;">Nothing captured yet.</div>`;

  const unschRows=unscheduled.slice(0,6).map(t=>{const cat=getCat(t.catId);return `<div style="display:flex;align-items:center;gap:7px;padding:4px 0;border-bottom:1px dashed ${T.border};">
    ${cat?`<span style="width:7px;height:7px;border-radius:50%;background:${cat.color.dot};flex-shrink:0;display:inline-block;"></span>`:''}
    <span style="flex:1;font-size:12px;color:${T.muted};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.text)}</span>
    <button onclick="tasks.find(x=>x.id===${t.id}).ts='09:00';tasks.find(x=>x.id===${t.id}).durationMins=30;save();plannerOpenTimeline('${ymd}')"
      style="${btnStyle('default','font-size:10px;padding:2px 6px;')}" title="Place on timeline at 9:00"><i class="ti ti-calendar-plus"></i></button>
  </div>`;}).join('');

  const schedRows=scheduledToday.slice(0,5).map(t=>{const cat=getCat(t.catId);return `<div style="display:flex;align-items:center;gap:6px;padding:3px 0;border-bottom:1px dashed ${T.border};">
    <span style="font-family:'DM Mono',monospace;font-size:10px;color:${T.muted2};flex-shrink:0;min-width:36px;">${t.ts}</span>
    <span style="flex:1;font-size:12px;color:${T.text};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(t.text)}</span>
    ${t.durationMins?`<span style="font-size:10px;color:${T.muted2};">${t.durationMins}m</span>`:''}
  </div>`;}).join('');

  return `
    <div style="display:flex;align-items:center;gap:8px;padding:7px 10px;border-bottom:1px solid ${T.border};background:${isToday?T.surface3:T.surface};">
      <div style="flex:1;font-size:13px;font-weight:700;color:${T.text};">${label}${isToday?` <span style="font-size:10px;padding:1px 6px;border-radius:10px;border:1px solid ${T.border};color:${T.accent};">today</span>`:''}</div>
      <button onclick="plannerOpenTimeline('${ymd}')" style="${btnStyle('accent','font-size:11px;padding:4px 10px;')}"><i class="ti ti-calendar-time"></i> Schedule</button>
    </div>
    <div style="padding:10px 12px;max-height:560px;overflow-y:auto;" data-no-clobber="true">
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${T.muted};margin-bottom:5px;"><i class="ti ti-bolt"></i> Quick capture</div>
        <div style="display:flex;gap:6px;">
          <input id="planner-dump-input" type="text" placeholder="Anything for this day…"
            value="${esc(plannerDumpInput)}" oninput="plannerDumpInput=this.value"
            onkeydown="if(event.key==='Enter')plannerAddDump('${ymd}')"
            style="${inputStyle('flex:1;')}"/>
          <button onclick="plannerAddDump('${ymd}')" style="${btnStyle('accent','padding:7px 11px;')}"><i class="ti ti-plus"></i></button>
        </div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${T.muted};margin-bottom:4px;"><i class="ti ti-notes"></i> Captured${dumps.length?` (${dumps.filter(x=>!x.done).length} open)`:''}</div>
        ${dumpRows}
      </div>
      ${scheduledToday.length?`<div style="margin-bottom:12px;padding:8px 10px;background:${T.surface2};border:1px solid ${T.border};border-radius:8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${T.muted};margin-bottom:4px;"><i class="ti ti-clock"></i> Scheduled
          <button onclick="plannerOpenTimeline('${ymd}')" style="${btnStyle('default','font-size:10px;padding:1px 7px;margin-left:5px;')}">timeline →</button></div>
        ${schedRows}${scheduledToday.length>5?`<div style="font-size:10px;color:${T.muted2};margin-top:3px;">+${scheduledToday.length-5} more</div>`:''}</div>`:''}
      ${unscheduled.length?`<div style="padding:8px 10px;background:${T.surface2};border:1px dashed ${T.border};border-radius:8px;">
        <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:${T.muted};margin-bottom:4px;"><i class="ti ti-inbox"></i> Unscheduled (${unscheduled.length})</div>
        ${unschRows}${unscheduled.length>6?`<div style="font-size:10px;color:${T.muted2};margin-top:3px;">+${unscheduled.length-6} more</div>`:''}</div>`:''}
    </div>`;
}

// ── Widget entry point ────────────────────────────────────────────────────────
function renderPlannerWidget(){
  if(!plannerMonth){const n=new Date();plannerMonth={year:n.getFullYear(),month:n.getMonth()};}
  let body;
  if(plannerView==='day'&&plannerSelectedDate)      body=_renderPlannerTimeline(plannerSelectedDate);
  else if(plannerView==='dump'&&plannerSelectedDate) body=_renderPlannerDump(plannerSelectedDate);
  else if(plannerView==='week')                      body=_renderPlannerWeek();
  else                                               body=_renderPlannerMonth();

  const aiBanner = aiPendingSuggestion ? `
    <div style="padding:10px 12px;margin:12px 16px 0 16px;background:${T.surface2};border:1.5px solid ${T.accent2};border-radius:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;">
      <div style="font-size:12px;color:${T.text};line-height:1.4;">AI daily plan ready — review the suggestion and add tasks.</div>
      <button onclick="dumpAiDailyPlan()" style="${btnStyle('accent','font-size:10px;padding:4px 9px;')}">Review</button>
    </div>` : '';

  const sidebar=_renderPlannerSidebar();
  return `<div style="margin:-14px;overflow:hidden;border-radius:14px;display:flex;min-height:300px;">
    ${sidebar}
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;background:${T.surface};">
      ${aiBanner}
      ${body}
    </div>
  </div>`;
}

registerWidget({
  id: 'planner',
  label: 'Planner',
  icon: 'ti-calendar-month',
  pinnable: true,
  collapsible: true,
  fullWidth: true,
  defaultVisible: true,
  render: renderPlannerWidget,
});
