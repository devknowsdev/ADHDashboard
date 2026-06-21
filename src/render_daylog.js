/*
MODULE: render_daylog.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_daylog.js responsibilities
USES: local modules
STATE_READS: T, habits, state
STATE_WRITES: DAY_LABELS, accept, allEntries, breakMins, breakSessions, breakTodaySecs, byCat, byTask, cat, catBreakdown
PUBLIC_API: _renderDayTimeline, _renderTimeSummary, renderDayLogWidget
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Day Log widget — extracted from render_tasks.js for file-size management.
// Depends on: core.js (btnStyle, inputStyle, labelStyle), helpers.js (esc, getCat, getTask,
//             fmtDur, getAllHitsForHabit), state.js, actions_tasks.js (saveOffTask etc.)
// Registered in render.js widgetRenderMap under key 'daylog'.

function _renderDayTimeline(todayStr){
  const todaySessions2=timeSessions
    .filter(s=>s.type!=='break'&&new Date(s.startedAt).toDateString()===todayStr)
    .sort((a,b)=>a.startedAt-b.startedAt);
  const offToday=offTaskLog
    .filter(e=>e.date===todayStr)
    .map(e=>({
      startedAt:new Date(todayStr+' '+e.startTime).getTime(),
      endedAt:new Date(todayStr+' '+e.endTime).getTime(),
      seconds:e.seconds,taskId:null,isDowntime:true,id:e.id,note:e.note
    }));
  const allEntries=[...todaySessions2.map(s=>({...s,isDowntime:false})),...offToday]
    .sort((a,b)=>a.startedAt-b.startedAt);
  if(!allEntries.length) return `<div style="font-size:11px;color:${T.muted2};padding:6px 0;">Nothing logged today yet.</div>`;
  const rows=[];
  let prev=null;
  allEntries.forEach(entry=>{
    if(prev){
      const gapSecs=(entry.startedAt-prev.endedAt)/1000;
      if(gapSecs>=300){
        const gapStart=new Date(prev.endedAt);
        const gapEnd=new Date(entry.startedAt);
        const gapStr=gapStart.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})+' → '+gapEnd.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
        rows.push(`<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px dashed ${T.border};opacity:0.5;">
          <span style="font-family:'DM Mono',monospace;font-size:10px;color:${T.muted2};flex-shrink:0;min-width:100px;">${gapStr}</span>
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
      <span style="font-family:'DM Mono',monospace;font-size:10px;color:${T.muted2};flex-shrink:0;min-width:100px;">${startStr}→${endStr}</span>
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
  const totalToday2=todaySessions2.reduce((s,e)=>s+(e.seconds||0),0);
  return `<div style="margin-bottom:10px;padding:10px 12px;background:${T.surface2};border:1.5px solid ${T.border};border-radius:10px;max-height:300px;overflow:auto;">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
      <div style="font-size:11px;font-weight:700;color:${T.muted};letter-spacing:.06em;text-transform:uppercase;">Today's timeline</div>
      <span style="font-family:'DM Mono',monospace;font-size:12px;font-weight:700;color:${T.accent};">${fmtDur(totalToday2)} tracked</span>
    </div>
    ${rows.join('')}
  </div>`;
}

function _renderTimeSummary(todayStr,now){
  const tabs=[{id:'today',label:'Today'},{id:'week',label:'This week'},{id:'alltime',label:'All time'}];
  const tabBar=`<div style="display:inline-flex;border:1.5px solid ${T.border2};border-radius:8px;overflow:hidden;margin-bottom:10px;">
    ${tabs.map(tab=>`<button onclick="timeSummaryTab='${tab.id}';render()"
      style="font-family:'Syne',sans-serif;font-size:11px;font-weight:700;padding:5px 12px;border:none;border-right:1px solid ${T.border};cursor:pointer;background:${timeSummaryTab===tab.id?T.accent2:'transparent'};color:${timeSummaryTab===tab.id?'#fff':T.muted};transition:all .12s;">
      ${tab.label}
    </button>`).join('')}
  </div>`;

  const getWeekRange=()=>{
    const d=new Date(now);
    const day=d.getDay();
    const mon=new Date(d);mon.setDate(d.getDate()-(day===0?6:day-1));mon.setHours(0,0,0,0);
    const sun=new Date(mon);sun.setDate(mon.getDate()+6);sun.setHours(23,59,59,999);
    return {mon,sun};
  };
  const filterSessions=(sessions,tab)=>{
    if(tab==='today') return sessions.filter(s=>new Date(s.startedAt).toDateString()===todayStr);
    if(tab==='week'){const {mon,sun}=getWeekRange();return sessions.filter(s=>s.startedAt>=mon.getTime()&&s.startedAt<=sun.getTime());}
    return sessions;
  };
  const workOnly=timeSessions.filter(s=>(s.type||'work')==='work');
  const filtered=filterSessions(workOnly,timeSummaryTab);

  const byTask={};
  filtered.forEach(s=>{byTask[s.taskId]=(byTask[s.taskId]||0)+(s.seconds||0);});
  const taskRows=Object.entries(byTask)
    .sort((a,b)=>b[1]-a[1])
    .slice(0,12)
    .map(([tid,secs])=>{
      const task=getTask(parseInt(tid)||tid);
      const cat=task?getCat(task.catId):null;
      const name=task?task.text:'(deleted task)';
      const mins=Math.round(secs/60);
      const pct=filtered.length?Math.round(secs/filtered.reduce((s,x)=>s+(x.seconds||0),0)*100):0;
      return `<div style="display:flex;align-items:center;gap:8px;padding:4px 0;border-bottom:1px dashed ${T.border};">
        ${cat?`<span style="width:6px;height:6px;border-radius:50%;background:${cat.color.dot};flex-shrink:0;display:inline-block;"></span>`:'<span style="width:6px;flex-shrink:0;"></span>'}
        <span style="flex:1;font-size:11px;font-weight:600;color:${T.text};min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(name.length>40?name.slice(0,40)+'…':name)}</span>
        <div style="width:60px;height:5px;border-radius:99px;background:${T.border};overflow:hidden;flex-shrink:0;">
          <div style="height:100%;width:${pct}%;background:${T.accent};border-radius:99px;"></div>
        </div>
        <span style="font-family:'DM Mono',monospace;font-size:11px;font-weight:700;color:${T.muted};flex-shrink:0;min-width:40px;text-align:right;">${Math.floor(mins/60)?Math.floor(mins/60)+'h ':''}<b>${mins%60}m</b></span>
      </div>`;
    }).join('');

  const byCat={};
  filtered.forEach(s=>{
    const task=getTask(s.taskId);
    const catId=task?task.catId:'';
    byCat[catId]=(byCat[catId]||0)+(s.seconds||0);
  });
  const catRows=Object.entries(byCat)
    .sort((a,b)=>b[1]-a[1])
    .map(([catId,secs])=>{
      const cat=getCat(catId);
      const mins=Math.round(secs/60);
      const label=cat?cat.name:'(uncategorised)';
      return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 8px;border-radius:20px;background:${cat?cat.color.bg:T.surface2};color:${cat?cat.color.text:T.muted};font-family:'DM Mono',monospace;">${cat?`<span style="width:6px;height:6px;border-radius:50%;background:${cat.color.dot};display:inline-block;"></span>`:''} ${esc(label)} <b>${Math.floor(mins/60)?Math.floor(mins/60)+'h':''} ${mins%60}m</b></span>`;
    }).join('');

  const weekBarHtml=timeSummaryTab==='week'?(()=>{
    const {mon}=getWeekRange();
    const DAY_LABELS=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const days=Array.from({length:7},(_,i)=>{
      const d=new Date(mon);d.setDate(mon.getDate()+i);
      const ds=d.toDateString();
      const secs=workOnly.filter(s=>new Date(s.startedAt).toDateString()===ds).reduce((sum,s)=>sum+(s.seconds||0),0);
      return {label:DAY_LABELS[i],mins:Math.round(secs/60),isToday:ds===todayStr};
    });
    const maxMins=Math.max(...days.map(d=>d.mins),1);
    return `<div style="display:flex;align-items:flex-end;gap:4px;height:52px;margin-top:10px;padding:0 2px;">
      ${days.map(d=>`<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px;">
        <span style="font-family:'DM Mono',monospace;font-size:8px;color:${d.mins>0?T.accent2:T.muted2};">${d.mins>0?d.mins+'m':''}</span>
        <div style="width:100%;border-radius:3px 3px 0 0;background:${d.isToday?T.accent2:T.accent};opacity:${d.mins>0?1:0.15};transition:height .3s;height:${Math.max(2,Math.round(d.mins/maxMins*34))}px;"></div>
        <span style="font-size:9px;color:${d.isToday?T.accent2:T.muted2};font-weight:${d.isToday?'700':'400'};">${d.label}</span>
      </div>`).join('')}
    </div>`;
  })():'';

  const totalTracked=filtered.reduce((s,x)=>s+(x.seconds||0),0);
  return `<div style="margin-top:12px;padding-top:10px;border-top:1.5px solid ${T.border};">
    <div style="${labelStyle()}"><i class="ti ti-chart-bar"></i>time summary</div>
    ${tabBar}
    ${weekBarHtml}
    <div style="display:flex;flex-wrap:wrap;gap:4px;margin-bottom:8px;">${catRows||`<span style="font-size:11px;color:${T.muted2};">No data yet.</span>`}</div>
    ${taskRows?`<div style="font-size:10px;font-weight:700;color:${T.muted};letter-spacing:.08em;text-transform:uppercase;margin-bottom:4px;">By task</div><div>${taskRows}</div>`:''}
    <div style="margin-top:6px;font-size:11px;color:${T.muted};font-family:'DM Mono',monospace;font-weight:700;">Total: ${fmtDur(totalTracked)}</div>
  </div>`;
}

function renderDayLogWidget(todayStr,now){
  const workSessions=timeSessions.filter(s=>new Date(s.startedAt).toDateString()===todayStr&&(s.type||'work')==='work');
  const breakSessions=timeSessions.filter(s=>new Date(s.startedAt).toDateString()===todayStr&&s.type==='break');
  const trackedTodaySecs=workSessions.reduce((sum,s)=>sum+(s.seconds||0),0);
  const breakTodaySecs=breakSessions.reduce((sum,s)=>sum+(s.seconds||0),0);
  const isLiveBreak=timerRunning&&activeSession&&activeSession.type==='break';
  const liveSessionSecs=(timerRunning&&activeSession&&new Date(activeSession.startedAt).toDateString()===todayStr)?Math.round((Date.now()-activeSession.startedAt)/1000):0;
  const liveWorkSecs=isLiveBreak?0:liveSessionSecs;
  const liveBreakSecs=isLiveBreak?liveSessionSecs:0;
  const trackedMins=Math.round((trackedTodaySecs+liveWorkSecs)/60);
  const breakMins=Math.round((breakTodaySecs+liveBreakSecs)/60);
  const dayStartMins=dayStartHour*60;
  const nowMins=now.getHours()*60+now.getMinutes();
  const elapsedMins=Math.max(0,nowMins-dayStartMins);
  const manualTodaySecs=offTaskLog.filter(e=>e.date===todayStr).reduce((sum,e)=>sum+(e.seconds||0),0);

  const habitManualMins=habits.reduce((sum,h)=>{
    const todayManual=(h.hits||[]).filter(x=>new Date(x.timestamp).toDateString()===todayStr&&!x.migrated);
    return sum+todayManual.reduce((s,x)=>s+(x.minutes||0),0);
  },0);
  const habitTotalMins=habits.reduce((sum,h)=>{
    return sum+getAllHitsForHabit(h,todayStr).reduce((s,x)=>s+(x.minutes||0),0);
  },0);

  const unaccountedMins=Math.max(0,elapsedMins-trackedMins-breakMins-Math.round(manualTodaySecs/60)-habitManualMins);

  const catBreakdown=(()=>{
    if(!workSessions.length) return '';
    const byCat={};
    workSessions.forEach(s=>{
      const task=getTask(s.taskId);
      const catId=(task&&task.catId)||'';
      byCat[catId]=(byCat[catId]||0)+(s.seconds||0);
    });
    const entries=Object.entries(byCat).sort((a,b)=>b[1]-a[1]);
    if(!entries.length) return '';
    return entries.map(([catId,secs])=>{
      const cat=getCat(catId);
      const mins=Math.round(secs/60);
      if(mins<1) return '';
      const label=cat?cat.name:'(uncategorised)';
      const dot=cat?`<span style="width:7px;height:7px;border-radius:50%;background:${cat.color.dot};display:inline-block;flex-shrink:0;"></span>`:'';
      return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;padding:2px 8px;border-radius:20px;background:${cat?cat.color.bg:T.surface2};color:${cat?cat.color.text:T.muted};font-family:'DM Mono',monospace;">${dot}${esc(label)} ${Math.floor(mins/60)?Math.floor(mins/60)+'h ':''}<b>${mins%60}m</b></span>`;
    }).filter(Boolean).join('');
  })();

  const dayTimelineHtml=_renderDayTimeline(todayStr);

  const todayEntries=offTaskLog.filter(e=>e.date===todayStr);
  const entriesHtml=todayEntries.map(e=>{
    if(editingOffTaskId===e.id){
      return `<div style="display:flex;align-items:center;gap:6px;padding:5px 0;border-bottom:1px solid ${T.border};flex-wrap:wrap;">
        <input id="offtask-edit-start-${e.id}" type="time" value="${e.startTime}" style="${inputStyle('width:110px;font-size:11px;padding:3px 6px;')}"/>
        <span style="color:${T.muted}">–</span>
        <input id="offtask-edit-end-${e.id}" type="time" value="${e.endTime}" style="${inputStyle('width:110px;font-size:11px;padding:3px 6px;')}"/>
        <input id="offtask-edit-note-${e.id}" type="text" value="${esc(e.note||'')}" placeholder="note…" style="${inputStyle('flex:1;min-width:80px;font-size:11px;padding:3px 6px;')}"/>
        <button onclick="saveEditOffTask(${e.id})" style="${btnStyle('accent','font-size:11px;padding:3px 8px;')}"><i class="ti ti-check"></i></button>
        <button onclick="cancelEditOffTask()" style="${btnStyle('default','font-size:11px;padding:3px 8px;')}"><i class="ti ti-x"></i></button>
      </div>`;
    }
    return `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid ${T.border};">
      <span style="font-size:12px;font-family:'DM Mono',monospace;color:${T.text};">${e.startTime}–${e.endTime}</span>
      ${e.note?`<span style="font-size:11px;color:${T.muted};flex:1;">· ${esc(e.note)}</span>`:`<span style="flex:1;"></span>`}
      <span style="font-size:11px;font-family:'DM Mono',monospace;color:${T.muted2};">${fmtDur(e.seconds)}</span>
      <button onclick="startEditOffTask(${e.id})" style="${btnStyle('default','font-size:11px;padding:2px 6px;')}"><i class="ti ti-edit"></i></button>
      <button onclick="deleteOffTask(${e.id})" style="${btnStyle('danger','font-size:11px;padding:2px 6px;')}"><i class="ti ti-trash"></i></button>
    </div>`;
  }).join('')||`<div style="font-size:11px;color:${T.muted2};padding:4px 0;">No manual entries today.</div>`;

  const timeSummaryHtml=_renderTimeSummary(todayStr,now);

  return `
    <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:8px;">
      <div style="background:${T.surface3};border:1.5px solid ${T.borderBlue||T.border};border-radius:10px;padding:10px 16px;flex:1;min-width:120px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${T.muted};text-transform:uppercase;margin-bottom:4px;">Tracked today</div>
        <div style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace;color:${T.accent};">${Math.floor(trackedMins/60)}h ${trackedMins%60}m</div>
      </div>
      <div style="background:${T.surface2};border:1.5px solid ${T.border};border-radius:10px;padding:10px 16px;flex:1;min-width:120px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${T.muted};text-transform:uppercase;margin-bottom:4px;">Break time</div>
        <div style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace;color:${T.accent2};">${Math.floor(breakMins/60)}h ${breakMins%60}m</div>
      </div>
      ${habitTotalMins>0?`<div style="background:${T.surface2};border:1.5px solid ${T.border};border-radius:10px;padding:10px 16px;flex:1;min-width:120px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${T.muted};text-transform:uppercase;margin-bottom:4px;">Daily Tasks</div>
        <div style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace;color:${T.green};">${Math.floor(habitTotalMins/60)}h ${habitTotalMins%60}m</div>
      </div>`:''}
      <div style="background:${T.surface2};border:1.5px solid ${T.border};border-radius:10px;padding:10px 16px;flex:1;min-width:120px;">
        <div style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${T.muted};text-transform:uppercase;margin-bottom:4px;">Downtime (since ${dayStartHour}:00)</div>
        <div style="font-size:18px;font-weight:700;font-family:'DM Mono',monospace;color:${unaccountedMins>30?T.pomo:T.muted};">${Math.floor(unaccountedMins/60)}h ${unaccountedMins%60}m</div>
      </div>
    </div>
    ${catBreakdown?`<div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:10px;padding:6px 0;border-bottom:1.5px solid ${T.border};">${catBreakdown}</div>`:''}

    <div style="${labelStyle()}"><i class="ti ti-timeline"></i>today's timeline</div>
    ${dayTimelineHtml}

    <div style="font-size:10px;font-weight:700;color:${T.muted};letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">Off-task entries today</div>
    ${entriesHtml}
    <div style="margin-top:10px;border-top:1.5px solid ${T.border};padding-top:8px;">
      <div style="font-size:10px;font-weight:700;color:${T.muted};letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">Log manual off-task time</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <input id="offtask-start" type="time" style="${inputStyle('width:110px;font-size:12px;')}"/>
        <span style="color:${T.muted};font-size:13px;">–</span>
        <input id="offtask-end" type="time" style="${inputStyle('width:110px;font-size:12px;')}"/>
        <input id="offtask-note" type="text" placeholder="note (optional)…" style="${inputStyle('flex:1;min-width:100px;')}"/>
        <button onclick="saveOffTask()" style="${btnStyle('accent','font-size:11px;padding:6px 11px;')}"><i class="ti ti-plus"></i>Add</button>
      </div>
      <div style="margin-top:6px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <span style="font-size:11px;color:${T.muted};">Day starts at:</span>
        <input type="number" min="0" max="23" value="${dayStartHour}" onchange="dayStartHour=Math.max(0,Math.min(23,parseInt(this.value)||8));save();render();" style="${inputStyle('width:60px;font-size:12px;padding:3px 6px;text-align:center;')}"/>
        <span style="font-size:11px;color:${T.muted2};">:00</span>
        <span style="font-size:11px;color:${T.muted};margin-left:4px;">Day ends at:</span>
        <input type="number" min="14" max="22" value="${dayEndHour}" onchange="dayEndHour=Math.max(14,Math.min(22,parseInt(this.value)||17));save();render();" style="${inputStyle('width:60px;font-size:12px;padding:3px 6px;text-align:center;')}"/>
        <span style="font-size:11px;color:${T.muted2};">:00 <span style="opacity:.75;">(Day End wizard)</span></span>
      </div>
      <div style="margin-top:10px;border-top:1.5px solid ${T.border};padding-top:8px;">
        <div style="font-size:10px;font-weight:700;color:${T.muted};letter-spacing:.08em;text-transform:uppercase;margin-bottom:6px;">Export</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
          <button onclick="exportFullBackup()" style="${btnStyle('default','font-size:11px;padding:5px 11px;')}"><i class="ti ti-download"></i> Backup (JSON)</button>
          <button onclick="exportDailyLog(new Date().toDateString())" style="${btnStyle('default','font-size:11px;padding:5px 11px;')}"><i class="ti ti-download"></i> Today's log (text)</button>
          <button onclick="document.getElementById('restore-file-input').click()" style="${btnStyle('default','font-size:11px;padding:5px 11px;')}"><i class="ti ti-upload"></i> Restore backup</button>
          <input id="restore-file-input" type="file" accept=".json" style="display:none" onchange="importBackup(this.files[0]);this.value='';"/>
        </div>
        <div style="font-size:10px;color:${T.muted2};margin-top:4px;">Restore replaces all data. Audio recordings are device-only and cannot be restored.</div>
      </div>
    </div>
    ${timeSummaryHtml}
  `;
}

registerWidget({
  id: 'daylog',
  label: 'Day Log',
  icon: 'ti-calendar-stats',
  pinnable: true,
  collapsible: true,
  fullWidth: true,
  defaultVisible: true,
  render: renderDayLogWidget,
});
