/*
MODULE: render_tasks.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_tasks.js responsibilities
USES: local modules
STATE_READS: T, state, tasks
STATE_WRITES: _liveExtra, _savedTracked, a, aScore, addSubtaskHtml, addingSubtaskForTaskId, background, borderColor, bpm, bpmHtml
PUBLIC_API: _renderResolutionPrompt, _renderSubtaskMusicMeta, _renderSubtaskRows, _renderTaskCheckbox, _renderTaskRow, _renderUrgencyControl, renderTasksWidget
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Tasks widget — task list, subtask rows, music meta, drag-to-reorder, note editing.
// Depends on: core.js (btnStyle, inputStyle, selectStyle, labelStyle, cardStyle),
//             helpers.js (esc, getCat, getTask, fmtDur, getTotalForTask,
//                         getSessionsForTask, avoidanceScore, getVisibleTasksSorted,
//                         sortTasksList, nextTaskOrder, getEnergyToday),
//             state.js, actions_tasks.js, actions_tasktimer.js.
// Registered in render.js widgetRenderMap under key 'tasks'.
// render_checkin.js owns renderCheckinWidget (key 'checkin').
function renderTasksWidget(todayStr){
  const todayEnergyEntry=getEnergyToday(todayStr);
  const catTabsHtml=`
    <button style="${btnStyle(taskFilter==='all'?'accent':'default','font-size:11px;padding:4px 10px;border-radius:20px;margin:0 2px 4px;')}" onclick="filterTasks('all')">All</button>
    ${categories.map(c=>{const a=taskFilter===c.id;return`<button style="font-family:'Syne',sans-serif;font-size:11px;font-weight:600;padding:4px 10px;border-radius:20px;border:1.5px solid ${a?c.color.dot:T.border2};background:${a?c.color.dot:T.btnBg};color:${a?'#fff':T.btnText};cursor:pointer;display:inline-flex;align-items:center;gap:4px;margin:0 2px 4px;" onclick="filterTasks('${c.id}')"><span style="width:7px;height:7px;border-radius:50%;background:${c.color.dot};display:inline-block;flex-shrink:0"></span>${esc(c.name)}</button>`;}).join('')}
  `;
  const sortOpts=[{v:'manual',label:'Manual'},{v:'time',label:'By time'},{v:'added',label:'Recently added'},{v:'status',label:'Active first'},{v:'anxiety',label:'By urgency'}];
  const taskSortHtml=`
    <div class="task-sort-row" style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
      <span style="font-size:10px;font-weight:700;letter-spacing:.1em;color:${T.muted};text-transform:uppercase;">Order</span>
      <select onchange="setTaskSortMode(this.value)" style="${selectStyle('min-width:140px;font-size:12px;padding:5px 8px;')}">
        ${sortOpts.map(o=>`<option value="${o.v}" ${taskSortMode===o.v?'selected':''}>${o.label}</option>`).join('')}
      </select>
      <span style="font-size:10px;color:${T.muted2};">${taskSortMode==='manual'?'Drag rows to reorder':'Switch to Manual to drag'}</span>
      ${todayEnergyEntry?`<button onclick="toggleEnergyFilter()" title="Show only tasks matching your energy" style="${btnStyle(energyFilterOn?'accent2':'default','font-size:11px;padding:4px 10px;border-radius:999px;')}">⚡ Match energy</button>`:''}
    </div>
  `;
  let visibleTasks=getVisibleTasksSorted();
  if(energyFilterOn&&todayEnergyEntry){
    visibleTasks=visibleTasks.filter(t=>!t.energyRequired||t.energyRequired<=todayEnergyEntry.energy);
  }
  const taskListHtml=visibleTasks.length?visibleTasks.map(t=>_renderTaskRow(t,todayStr)).join(''):`<div style="color:${T.muted2};font-size:12px;padding:8px 0">No tasks here — add one below!</div>`;
  // v47: hotkey hint strip — only shown when a task is focused
  const hotkeysHint=focusTaskId!=null?`<div style="font-size:9px;color:${T.muted2};letter-spacing:.04em;padding:2px 0 6px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;"><i class="ti ti-keyboard" style="font-size:10px;flex-shrink:0;"></i><span><b>S</b> subs &nbsp;<b>N</b> note &nbsp;<b>T</b> time &nbsp;<b>E</b> est &nbsp;<b>O</b> options &nbsp;<b>Q</b> quick-log &nbsp;<b>B</b> break &nbsp;<b>F</b> focus &nbsp;<b>Del</b> delete</span></div>`:'';
  const doneCount=tasks.filter(t=>(t.status||'todo')==='done').length;
  const inProgressCount=tasks.filter(t=>(t.status||'todo')==='inprogress').length;
  const progPct=tasks.length?Math.round(doneCount/tasks.length*100):0;
  const inProgPct=tasks.length?Math.round(inProgressCount/tasks.length*100):0;
  const taskAddCatOpts=`<option value="" style="background:${T.inputBg};color:${T.inputText}">— none</option>`+categories.map(c=>`<option value="${c.id}" style="background:${T.inputBg};color:${T.inputText}">${esc(c.name)}</option>`).join('');
  return `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;flex-wrap:wrap;gap:6px;">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-left:auto;">
        <button onclick="saveAsTemplate()" style="${btnStyle('default','font-size:11px;padding:4px 10px;')}"><i class="ti ti-bookmark"></i>Save template</button>
        <select onchange="if(this.value){loadTemplate(this.value);this.value=''}" style="${selectStyle('font-size:11px;padding:4px 8px;')}">
          <option value="">Load template…</option>
          ${templates.map(tmpl=>`<option value="${tmpl.id}">${esc(tmpl.name)}</option>`).join('')}
        </select>
        <button onclick="openCatManager()" style="${btnStyle('default','font-size:11px;padding:4px 10px;')}"><i class="ti ti-adjustments-horizontal"></i>categories</button>
      </div>
    </div>
    <div class="cat-tabs" style="display:flex;flex-wrap:wrap;gap:2px;margin-bottom:10px;">${catTabsHtml}</div>
    ${taskSortHtml}
    ${hotkeysHint}
    <div>${taskListHtml}</div>
    <div style="height:5px;background:${T.surface2};border-radius:4px;margin-top:8px;overflow:hidden;border:1px solid ${T.border};">
      <div style="height:100%;width:${progPct}%;background:linear-gradient(90deg,${T.accent},${T.accent2});border-radius:4px 0 0 4px;transition:width .4s;display:inline-block;vertical-align:top;"></div><div style="height:100%;width:${inProgPct}%;background:#f59e0b;border-radius:${progPct===0?'4px':'0'} ${(progPct+inProgPct)>=100?'4px':'0'} ${(progPct+inProgPct)>=100?'4px':'0'} ${progPct===0?'4px':'0'};transition:width .4s;display:inline-block;vertical-align:top;opacity:0.7;"></div>
    </div>
    <div style="display:flex;gap:6px;margin-top:8px;align-items:center;flex-wrap:wrap;" data-no-clobber="true">
      <input id="task-in" type="text" placeholder="Add a task… (Enter to add)" onkeydown="if(event.key==='Enter')addTask()" style="${inputStyle('flex:1;min-width:160px;')}"/>
      <input id="task-time-in" type="text" placeholder="14:30" maxlength="5" title="optional scheduled time" style="${inputStyle('width:68px;font-family:DM Mono,monospace;')}"/>
      <select id="task-cat" style="${selectStyle('min-width:100px;')}">${taskAddCatOpts}</select>
      <select id="task-repeat" style="${selectStyle('font-size:11px;padding:5px 8px;min-width:90px;')}">
        <option value="none">No repeat</option>
        <option value="daily">Daily</option>
        <option value="weekdays">Weekdays</option>
        <option value="weekly">Weekly</option>
      </select>
      <select id="task-scope" style="${selectStyle('font-size:11px;')}">
        <option value="day">Day task</option>
        <option value="project">Project</option>
      </select>
      <button onclick="addTask()" style="${btnStyle('accent','font-size:11px;padding:6px 11px;')}"><i class="ti ti-plus"></i>Add</button>
    </div>
  `;
}




function _renderSubtaskMusicMeta(t, st, stMm, stLyricsKey, stLyricsOpen) {
  const fields=['key','tuning'].map(field=>{
    const val=stMm[field]||'';
    const labels={key:'Key',tuning:'Tuning'};
    const placeholders={key:'e.g. Am',tuning:'e.g. Eb'};
    const isEd=editingMusicField&&editingMusicField.taskId===t.id&&editingMusicField.subtaskId===st.id&&editingMusicField.field===field;
    return isEd
      ?`<input id="music-field-${t.id}-${st.id}-${field}" type="text" value="${esc(val)}" placeholder="${placeholders[field]}" maxlength="20"
          onkeydown="if(event.key==='Enter'){saveMusicField(${t.id},${st.id},'${field}',this.value);event.preventDefault();}if(event.key==='Escape'){editingMusicField=null;render();}"
          onblur="saveMusicField(${t.id},${st.id},'${field}',this.value)"
          style="${inputStyle('width:72px;padding:2px 6px;font-size:11px;font-family:DM Mono,monospace;')}"/>`
      :`<span onclick="event.stopPropagation();openMusicField(${t.id},${st.id},'${field}')"
          title="${labels[field]} — click to edit"
          style="font-size:10px;padding:2px 8px;border-radius:20px;font-family:'DM Mono',monospace;font-weight:600;cursor:pointer;white-space:nowrap;border:1px dashed ${val?T.border2:T.border};background:${val?T.surface2:'transparent'};color:${val?T.text:T.muted2};opacity:${val?1:0.5};"
          onmouseover="this.style.opacity=1;this.style.borderColor='${T.accent2}'"
          onmouseout="this.style.opacity='${val?1:0.5}';this.style.borderColor='${val?T.border2:T.border}'">
          ${val?`<span style="font-size:8px;color:${T.muted2};margin-right:2px;text-transform:uppercase;">${labels[field]}</span>${esc(val)}`:labels[field]+'?'}
        </span>`;
  });
  const bpm=stMm.bpm;
  const isBpmEd=editingMusicField&&editingMusicField.taskId===t.id&&editingMusicField.subtaskId===st.id&&editingMusicField.field==='bpm';
  const bpmHtml=isBpmEd
    ?`<input id="music-field-${t.id}-${st.id}-bpm" type="number" value="${bpm||''}" placeholder="120" min="20" max="300"
        onkeydown="if(event.key==='Enter'){saveMusicField(${t.id},${st.id},'bpm',this.value);event.preventDefault();}if(event.key==='Escape'){editingMusicField=null;render();}"
        onblur="saveMusicField(${t.id},${st.id},'bpm',this.value)"
        style="${inputStyle('width:62px;padding:2px 6px;font-size:11px;font-family:DM Mono,monospace;')}"/>`
    :`<span onclick="event.stopPropagation();openMusicField(${t.id},${st.id},'bpm')"
        title="BPM — click to edit"
        style="font-size:10px;padding:2px 8px;border-radius:20px;font-family:'DM Mono',monospace;font-weight:600;cursor:pointer;white-space:nowrap;border:1px dashed ${bpm?T.border2:T.border};background:${bpm?T.surface2:'transparent'};color:${bpm?T.text:T.muted2};opacity:${bpm?1:0.5};"
        onmouseover="this.style.opacity=1;this.style.borderColor='${T.accent2}'"
        onmouseout="this.style.opacity='${bpm?1:0.5}';this.style.borderColor='${bpm?T.border2:T.border}'">
        ${bpm?`<span style="font-size:8px;color:${T.muted2};margin-right:2px;text-transform:uppercase;">BPM</span>${bpm}`:'BPM?'}
      </span>`;
  const lyricsBtn=`<button onclick="event.stopPropagation();expandedLyricsId=(${stLyricsOpen}?null:{taskId:${t.id},subtaskId:${st.id}});editingMusicField=null;render();if(!${stLyricsOpen})setTimeout(()=>{const el=document.getElementById('lyrics-textarea-${stLyricsKey}');if(el)el.focus();},0)"
    title="${stMm.lyrics?'View/edit lyrics':'Add lyrics'}"
    style="${btnStyle(stLyricsOpen?'accent2':'default','font-size:10px;padding:2px 8px;border-radius:20px;'+(stMm.lyrics?'':'opacity:0.5;'))}">
    <i class="ti ti-music"></i>${stMm.lyrics?'lyrics':'+ lyrics'}
  </button>`;
  const lyricsArea=stLyricsOpen?`
    <div style="padding:4px 6px 6px 28px;" onclick="event.stopPropagation()">
      <textarea id="lyrics-textarea-${stLyricsKey}"
        placeholder="Paste or type lyrics here…"
        onblur="saveLyrics(${t.id},${st.id},this.value)"
        onkeydown="if(event.key==='Escape'){saveLyrics(${t.id},${st.id},this.value);expandedLyricsId=null;render();}"
        style="${inputStyle('resize:vertical;font-size:11px;padding:6px 9px;line-height:1.6;min-height:100px;font-family:DM Mono,monospace;white-space:pre-wrap;')}"
      >${esc(stMm.lyrics||'')}</textarea>
    </div>`:'';
  return `<div style="display:flex;align-items:center;gap:4px;padding:3px 6px 4px 28px;flex-wrap:wrap;" onclick="event.stopPropagation()">${fields.join('')}${bpmHtml}${lyricsBtn}</div>${lyricsArea}`;

}

function _renderSubtaskRows(t, todayStr, isMusicCat) {
  const isExpanded=expandedSubtaskTaskIds.has(t.id);
  const isAddingSubtask=addingSubtaskForTaskId===t.id;
  if(!isExpanded&&!isAddingSubtask) return '';
  const sortedSubs=[...(t.subtasks||[])].sort((a,b)=>(a.order||0)-(b.order||0));
  const subRows=sortedSubs.map(st=>{
    const stTracked=getTotalForSubtask(t.id,st.id);
    const isStFocus=focusTaskId===t.id&&focusSubtaskId===st.id;
    const stLastSession = timeSessions
      .filter(s=>s.taskId===t.id && s.subtaskId===st.id)
      .reduce((max,s)=>Math.max(max,s.startedAt),0);
    const stDaysSince = stLastSession 
      ? (Date.now()-stLastSession)/(1000*60*60*24) 
      : null;
    const stStaleness = (stDaysSince===null && !st.done)
      ? `<span style="font-size:9px;color:${T.muted2};font-family:'DM Mono',monospace;">never</span>`
      : (stDaysSince!==null && stDaysSince>2 && !st.done)
        ? `<span style="font-size:9px;color:${stDaysSince>7?T.pomo:T.urg2};font-family:'DM Mono',monospace;">${Math.floor(stDaysSince)}d ago</span>`
        : '';
    // Item 11: inline time-log button on subtask row
    const stTimeLogBtn=`<button onclick="event.stopPropagation();openSubtaskQuickLog(${t.id},${st.id})" title="Log time to this sub-task" style="${btnStyle('default','font-size:9px;padding:1px 5px;border-radius:6px;')}"><i class="ti ti-clock-plus"></i></button>`;
    // Subtask estimate — inline editable
    const isStEstEditing=editingSubtaskEstimateId&&editingSubtaskEstimateId.taskId===t.id&&editingSubtaskEstimateId.subtaskId===st.id;
    const stEstHtml=isStEstEditing
      ?`<input id="st-est-input-${st.id}" type="number" min="1" max="9999" placeholder="min"
          value="${st.estimatedMins||''}"
          onclick="event.stopPropagation()"
          onkeydown="if(event.key==='Enter'){saveSubtaskEstimate(${t.id},${st.id},this.value);event.preventDefault();}if(event.key==='Escape'){cancelEditSubtaskEstimate();}"
          onblur="saveSubtaskEstimate(${t.id},${st.id},this.value)"
          data-no-clobber="true"
          style="${inputStyle('width:52px;padding:2px 5px;font-size:10px;font-family:DM Mono,monospace;text-align:center;')}"/>`
      :`<span onclick="event.stopPropagation();startEditSubtaskEstimate(${t.id},${st.id})"
          title="${st.estimatedMins?'Estimated: '+st.estimatedMins+'m — click to edit':'Set estimated time'}"
          style="font-size:10px;font-family:'DM Mono',monospace;padding:1px 6px;border-radius:10px;cursor:pointer;flex-shrink:0;border:1px dashed ${st.estimatedMins?T.border2:T.border};background:${st.estimatedMins?T.surface2:'transparent'};color:${st.estimatedMins?T.muted:T.muted2};opacity:${st.estimatedMins?1:0.5};"
          onmouseover="this.style.opacity=1;this.style.borderColor='${T.accent2}'"
          onmouseout="this.style.opacity='${st.estimatedMins?1:0.5}';this.style.borderColor='${st.estimatedMins?T.border2:T.border}'">
          ${st.estimatedMins?`~${st.estimatedMins}m`:`<i class="ti ti-clock" style="font-size:9px;"></i>`}
        </span>`;
    // Music meta row for this subtask (only for music-cat tasks)
    const stMm=st.musicMeta||{};
    const stLyricsKey=`${t.id}-${st.id}`;
    const stLyricsOpen=expandedLyricsId&&expandedLyricsId.taskId===t.id&&expandedLyricsId.subtaskId===st.id;
    const stMusicMetaHtml=isMusicCat?_renderSubtaskMusicMeta(t,st,stMm,stLyricsKey,stLyricsOpen):'';
    return `<div style="border-bottom:1px dashed ${T.border};">
      <div onclick="event.stopPropagation()" draggable="true"
        ondragstart="dragStartSubtask(event,${t.id},${st.id})"
        ondragover="dragOverSubtask(event)"
        ondrop="dropSubtask(event,${t.id},${st.id})"
        ondragend="dragEndSubtask(event)"
        style="display:flex;align-items:center;gap:6px;padding:5px 6px 5px 28px;${isStFocus?'background:'+T.surface2+';border-radius:6px;':''}" onmouseover="this.style.background='${T.surface2}'" onmouseout="this.style.background='${isStFocus?T.surface2:'transparent'}'">
        <span title="drag to reorder" style="cursor:grab;color:${T.muted2};font-size:12px;flex-shrink:0;padding:0 1px;opacity:0.4;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.4"><i class="ti ti-grip-vertical"></i></span>
        <span onclick="event.stopPropagation();incrementSubtaskPractice(${t.id},${st.id})" oncontextmenu="event.preventDefault();resetSubtaskPractice(${t.id},${st.id})" title="Tap to log a practice run · Right-click to reset" style="cursor:pointer;font-size:10px;font-family:'DM Mono',monospace;padding:2px 8px;border-radius:10px;flex-shrink:0;user-select:none;min-width:32px;text-align:center;${(()=>{const pc=st.practiceCount||0;return pc===0?'color:'+T.muted2+';background:transparent;border:1px dashed '+T.border+';':'color:'+(pc>=10?T.green:pc>=5?T.accent2:T.urg2)+';background:'+T.surface2+';border:1px solid '+(pc>=10?T.green:pc>=5?T.accent2:T.urg2)+';';})()}" onmouseover="this.style.opacity='0.75'" onmouseout="this.style.opacity='1'">×${st.practiceCount||0}</span>
        <div onclick="event.stopPropagation();toggleSubtask(${t.id},${st.id})" style="width:14px;height:14px;border-radius:3px;border:1.5px solid ${st.done?T.green:T.border2};background:${st.done?T.green:'transparent'};flex-shrink:0;display:flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;">${st.done?'<span style="color:#fff;font-size:9px;font-weight:700;line-height:1">✓</span>':''}</div>
        <div onclick="event.stopPropagation();setFocus(${t.id},${st.id})" style="flex:1;font-size:12px;color:${T.text};cursor:pointer;${st.done?'text-decoration:line-through;color:'+T.muted2+';':''}" title="Focus on this sub-task">${esc(st.text)}</div>
        ${stEstHtml}
        ${stTracked>0?("<span onclick=\"event.stopPropagation();openSubtaskQuickLog("+t.id+","+st.id+")\" title=\"Click to log more time\" style=\"font-size:10px;font-family:'DM Mono',monospace;color:"+T.muted+";padding:1px 6px;background:"+T.surface2+";border:1px solid "+T.border+";border-radius:10px;cursor:pointer;\">"+fmtDur(stTracked)+"</span>"):stTimeLogBtn}
        ${stStaleness}
        ${isStFocus?"<span style=\"font-size:9px;color:"+T.accent2+";font-weight:700;padding:1px 5px;background:"+T.surface2+";border:1px solid "+T.accent2+";border-radius:8px;\">focus</span>":''}
        <span onclick="event.stopPropagation();deleteSubtask(${t.id},${st.id})" style="opacity:0.35;font-size:11px;color:${T.muted2};cursor:pointer;padding:0 2px;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.35" title="delete sub-task"><i class="ti ti-x"></i></span>
      </div>
      ${stMusicMetaHtml}
    </div>`;
  }).join('');
  const addSubtaskHtml=isAddingSubtask
    ?`<div style="display:flex;align-items:center;gap:6px;padding:5px 6px 5px 28px;border-bottom:1px dashed ${T.border};">
        <span style="color:${T.muted2};font-size:11px;flex-shrink:0;">+</span>
        <input id="subtask-add-input-${t.id}" type="text" placeholder="Sub-task name… (Enter to add)" maxlength="200"
          onkeydown="if(event.key==='Enter'){addSubtask(${t.id});}if(event.key==='Escape'){closeAddSubtask();}"
          style="${inputStyle('flex:1;font-size:12px;padding:4px 8px;')}"/>
        <button onclick="addSubtask(${t.id})" style="${btnStyle('accent','font-size:10px;padding:3px 7px;')}"><i class="ti ti-check"></i></button>
        <button onclick="closeAddSubtask()" style="${btnStyle('default','font-size:10px;padding:3px 7px;')}"><i class="ti ti-x"></i></button>
      </div>`
    :`<div style="padding:4px 6px 4px 28px;">
        <button onclick="openAddSubtask(${t.id})" style="${btnStyle('default','font-size:10px;padding:3px 10px;border-radius:20px;')}"><i class="ti ti-plus"></i> add sub-task</button>
      </div>`;
  // Subtask summary footer — only shown when there are subtasks with data
  const totalSubTracked=sortedSubs.reduce((s,st)=>s+getTotalForSubtask(t.id,st.id),0);
  const totalSubEst=sortedSubs.reduce((s,st)=>s+(st.estimatedMins||0),0);
  const doneCount=sortedSubs.filter(st=>st.done).length;
  const subtaskFooter=(sortedSubs.length>0)?`
    <div style="display:flex;align-items:center;gap:8px;padding:4px 10px 5px 28px;border-top:1px solid ${T.border};background:${T.surface2};">
      <span style="font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${T.muted};flex:1;">${doneCount}/${sortedSubs.length} done</span>
      ${totalSubEst>0?`<span style="font-size:10px;font-family:'DM Mono',monospace;color:${T.muted2};">est ${totalSubEst}m</span>`:''}
      ${totalSubTracked>0?`<span style="font-size:10px;font-family:'DM Mono',monospace;color:${T.muted};">${fmtDur(totalSubTracked)} tracked</span>`:''}
    </div>`:'';
  return `<div onclick="event.stopPropagation()" style="border-left:2px solid ${T.borderBlue||T.border};margin-left:10px;">${subRows}${addSubtaskHtml}${subtaskFooter}</div>`;

}

function _renderTaskCheckbox(t, taskStatus) {
  if(t.pinned) return `<span title="Pinned — complete via daily task" style="width:18px;height:18px;border-radius:50%;border:2px solid ${T.accent2};background:transparent;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;box-sizing:border-box;"><i class="ti ti-pin" style="font-size:10px;color:${T.accent2};"></i></span>`;
  if(taskStatus==='done') return `<div onclick="event.stopPropagation();toggleTask(${t.id})" title="Done — click to reset" role="checkbox" aria-checked="true" style="width:18px;height:18px;border-radius:50%;border:2px solid ${T.green};background:${T.green};flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;"><span style="color:#fff;font-size:11px;font-weight:700;line-height:1">✓</span></div>`;
  if(taskStatus==='inprogress') return `<div onclick="event.stopPropagation();toggleTask(${t.id})" title="In progress — click to mark done" role="checkbox" aria-checked="mixed" style="width:18px;height:18px;border-radius:50%;border:2px solid #f59e0b;background:transparent;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;position:relative;overflow:hidden;"><div style="position:absolute;top:0;left:0;width:50%;height:100%;background:#f59e0b;border-radius:9px 0 0 9px;"></div><span style="color:#fff;font-size:10px;font-weight:700;line-height:1;position:relative;z-index:1;">›</span></div>`;
  return `<div onclick="event.stopPropagation();toggleTask(${t.id})" title="To do — click to mark in progress" role="checkbox" aria-checked="false" style="width:18px;height:18px;border-radius:50%;border:2px solid ${T.border2};background:transparent;flex-shrink:0;margin-top:1px;display:flex;align-items:center;justify-content:center;cursor:pointer;box-sizing:border-box;"></div>`;
}

function _renderUrgencyControl(t) {
  const aScore=avoidanceScore(t);
  const urgencyMeta=[
    {lvl:0,color:T.border2,label:'No urgency'},
    {lvl:1,color:T.urg1,label:'Soon'},
    {lvl:2,color:T.urg1,label:'Soon'},
    {lvl:3,color:T.urg2,label:'Urgent'},
    {lvl:4,color:T.urg3,label:'Critical'},
    {lvl:5,color:T.urg3,label:'Critical'},
  ];
  const uSet=t.urgency||0;
  const uMeta=urgencyMeta[uSet];
  const pickerOpen=urgencyPickerTaskId===t.id;
  // Flame button — shows current colour, click opens picker
  const flameBtn=`<button onclick="event.stopPropagation();urgencyPickerTaskId=(urgencyPickerTaskId===${t.id}?null:${t.id});render()"
    title="Set urgency"
    style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;margin-top:1px;width:22px;height:22px;border-radius:50%;border:1.5px solid ${uSet>0?uMeta.color:T.border};background:${uSet>0?uMeta.color+'22':'transparent'};color:${uSet>0?uMeta.color:T.border2};cursor:pointer;font-size:13px;padding:0;transition:all .15s;">
    <i class="ti ti-flame"></i>
  </button>`;
  // Picker popover — row of coloured flame options
  const flamePicker=pickerOpen?`
    <div onclick="event.stopPropagation()" style="display:inline-flex;align-items:center;gap:3px;padding:4px 6px;border-radius:10px;border:1.5px solid ${T.border2};background:${T.surface};box-shadow:0 4px 16px rgba(0,0,0,.15);vertical-align:middle;margin-left:4px;">
      ${urgencyMeta.slice(1).map(m=>`
        <button onclick="event.stopPropagation();setTaskUrgency(${t.id},${m.lvl})"
          title="${m.label}"
          style="width:24px;height:24px;border-radius:50%;border:2px solid ${uSet===m.lvl?m.color:'transparent'};background:${uSet===m.lvl?m.color+'33':'transparent'};color:${m.color};cursor:pointer;font-size:14px;display:flex;align-items:center;justify-content:center;padding:0;transition:all .12s;"
          onmouseover="this.style.background='${m.color}33';this.style.borderColor='${m.color}'"
          onmouseout="this.style.background='${uSet===m.lvl?m.color+'33':'transparent'}';this.style.borderColor='${uSet===m.lvl?m.color:'transparent'}'">
          <i class="ti ti-flame"></i>
        </button>`).join('')}
      ${uSet>0?`<button onclick="event.stopPropagation();setTaskUrgency(${t.id},0)"
        title="Clear urgency"
        style="width:20px;height:20px;border-radius:50%;border:1px solid ${T.border};background:transparent;color:${T.muted2};cursor:pointer;font-size:10px;display:flex;align-items:center;justify-content:center;padding:0;margin-left:1px;"
        onmouseover="this.style.background='${T.surface2}'" onmouseout="this.style.background='transparent'">
        <i class="ti ti-x"></i>
      </button>`:''}
    </div>`:'';
  return flameBtn+flamePicker;
}

function _renderResolutionPrompt(t, aScore, taskStatus) {
  if(!showWarnings || aScore<4 || taskStatus==='done') return '';
  const computedBonus = aScore - (t.urgency||0);
  const taskSess = timeSessions.filter(s=>s.taskId===t.id);
  const lastT = taskSess.length 
    ? Math.max(...taskSess.map(s=>s.startedAt)) 
    : (t.createdAt||t.id);
  const neglectDays = (Date.now()-lastT)/(1000*60*60*24);
  const resolutionMsg = neglectDays > 7
    ? `Not touched in <b>${Math.floor(neglectDays)} days</b>. What's one small action right now?`
    : neglectDays > 3
      ? `Hasn't been worked on in ${Math.floor(neglectDays)} days. What's blocking it?`
      : (t.urgency||0) >= 4
        ? `You've flagged this as high urgency. Is it your next focus?`
        : `All sub-tasks untouched. What's the <b>first concrete step</b>?`;
  return `<div style="display:flex;align-items:flex-start;gap:7px;padding:5px 6px 6px 34px;border-top:1px dashed ${T.border};background:${T.surface2};">
    <span style="font-size:11px;color:#f97316;flex-shrink:0;margin-top:1px;"><i class="ti ti-alert-triangle"></i></span>
    <span title="Risk score: ${aScore}/8 (${computedBonus} from neglect signals)" style="font-size:9px;padding:1px 5px;border-radius:20px;font-weight:600;background:${aScore>=6?T.urg3:aScore>=4?T.urg2:T.urg1};color:#fff;flex-shrink:0;margin-top:2px;font-family:'DM Mono',monospace;">${aScore}</span>
    <div style="flex:1;font-size:11px;color:${T.muted};line-height:1.4;">${resolutionMsg}</div>
    <button onclick="event.stopPropagation();openAddSubtask(${t.id})" style="${btnStyle('default','font-size:10px;padding:2px 8px;border-radius:20px;flex-shrink:0;')}"><i class="ti ti-git-branch"></i>break it down</button>
  </div>`;

}

function _renderTaskRow(t,todayStr){
    const cat=getCat(t.catId);
    const isMusicCat=cat&&cat.name.toLowerCase().includes('music');
    const _savedTracked=getTotalForTask(t.id);
    const _liveExtra=(timerRunning&&focusTaskId===t.id&&timerSessionType!=='break')
      ?(timerMode==='stopwatch'?timerSecs:Math.max(0,timerPlannedSecs-timerSecs))
      :0;
    const tracked=_savedTracked+_liveExtra;
    const isFocus=focusTaskId===t.id;
    const isHighlighted=plannerHighlightTaskId===t.id;
    const taskStatus=t.status||'todo';
    const hasSubtasks=(t.subtasks||[]).length>0;
    const isExpanded=expandedSubtaskTaskIds.has(t.id);
    const isAddingSubtask=addingSubtaskForTaskId===t.id;
    const isTimerRunningHere=isFocus&&timerRunning;
    const overflowOpen=taskOverflowOpenId===t.id;
    const aScore=avoidanceScore(t);
    const computedBonus=aScore-(t.urgency||0);
    const noteText=t.note||'';
    const timeVal=t.ts||'';

    const draggable=`draggable="true" ondragstart="dragStart(event,${t.id})" ${taskSortMode==='manual'?`ondragover="dragOver(event)" ondrop="drop(event,${t.id})" ondragend="dragEnd(event)"`:`ondragend="dragEnd(event)"`}`;

    // ── Always-visible elements ──────────────────────────────────────────────

    const checkHtml=_renderTaskCheckbox(t,taskStatus);
    const urgencyDots=_renderUrgencyControl(t);

    // Scheduled time — always shown if set, hidden if not
    const timeHtml=editingTimeId===t.id
      ?`<input id="task-time-edit-${t.id}" type="text" value="${esc(timeVal)}" placeholder="14:30" maxlength="5"
          onkeydown="if(event.key==='Enter'){saveTaskTime(${t.id},this.value);event.preventDefault();}if(event.key==='Escape'){cancelEditTaskTime();}"
          onblur="saveTaskTime(${t.id},this.value)"
          style="${inputStyle('width:58px;padding:3px 6px;font-size:11px;font-family:DM Mono,monospace;text-align:center;')}"/>`
      :(timeVal
        ?`<span onclick="event.stopPropagation();startEditTaskTime(${t.id})" title="Scheduled time — click to edit"
            style="font-size:11px;color:${T.muted};font-family:'DM Mono',monospace;flex-shrink:0;cursor:pointer;padding:2px 5px;border-radius:5px;">
            ${timeVal}
          </span>`
        :'');

    // Timer button — only shown on the focused task
    const timerIconHtml=isFocus
      ?`<button onclick="event.stopPropagation();startTaskStopwatch(${t.id})" title="${isTimerRunningHere?'Pause':'Start stopwatch'}"
          style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:26px;height:26px;border-radius:50%;border:1.5px solid ${isTimerRunningHere?T.accent2:T.border2};background:${isTimerRunningHere?T.accent2:'transparent'};color:${isTimerRunningHere?'#fff':T.muted};cursor:pointer;font-size:13px;padding:0;transition:all .15s;${isTimerRunningHere?'animation:timerPulse 1.4s ease-in-out infinite;':''}">
          <i class="ti ti-${isTimerRunningHere?'player-pause':'clock-play'}"></i>
        </button>`
      :'';

    // Category pill — inline under name
    let catPillHtml;
    if(editingTaskCatId===t.id){
      const catOpts=`<option value="">— none</option>`+categories.map(c=>`<option value="${c.id}" ${t.catId===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
      catPillHtml=`<select onchange="setTaskCat(${t.id},this.value)" onblur="editingTaskCatId=null;render()" style="${selectStyle('font-size:10px;padding:2px 6px;min-width:80px;border-radius:20px;')}">${catOpts}</select>`;
    } else if(cat){
      catPillHtml=`<span onclick="event.stopPropagation();editingTaskCatId=${t.id};render()" title="Change category" style="font-size:10px;padding:1px 7px;border-radius:20px;font-weight:500;background:${cat.color.bg};color:${cat.color.text};white-space:nowrap;flex-shrink:0;cursor:pointer;">${esc(cat.name)}</span>`;
    } else {
      catPillHtml='';
    }

    // Tracked time — small inline if present
    const trackedChip=tracked>0
      ?`<span onclick="event.stopPropagation();openSessions(${t.id})" title="View sessions" style="font-size:10px;padding:1px 6px;border-radius:10px;font-weight:500;background:${T.surface2};color:${T.muted};white-space:nowrap;flex-shrink:0;font-family:'DM Mono',monospace;border:0.5px solid ${T.border};cursor:pointer;">${fmtDur(tracked)}</span>`
      :'';

    // Repeat / energy badges — compact, shown inline with cat
    const repeatIcon=t.repeat?`<span title="Repeating: ${t.repeat}" style="font-size:10px;color:${T.accent2};flex-shrink:0;"><i class="ti ti-refresh"></i></span>`:'';
    const energyBadge=t.energyRequired?`<span title="Energy required: ${t.energyRequired}/5" style="font-size:10px;color:${T.muted2};flex-shrink:0;">${'⚡'.repeat(t.energyRequired)}</span>`:'';

    // Risk badge — only when warnings on and score is notable
    const riskBadge=(showWarnings&&computedBonus>0&&taskStatus!=='done')
      ?`<span title="Risk: ${aScore}/8" style="font-size:9px;padding:1px 4px;border-radius:10px;font-weight:600;background:${aScore>=6?T.urg3:aScore>=4?T.urg2:T.urg1};color:#fff;flex-shrink:0;font-family:'DM Mono',monospace;">${aScore}</span>`
      :'';

    // Scope badge — only for project tasks (day is the default, no noise needed)
    const scopeBadge=t.taskScope==='project'
      ?`<span title="Project task — stays until deleted" style="font-size:9px;padding:1px 5px;border-radius:10px;border:1px solid ${T.border};color:${T.muted2};margin-left:3px;flex-shrink:0;">proj</span>`
      :'';

    // Subtask count badge — always visible on the main row when subtasks exist
    const subtaskCountBadge=(hasSubtasks||isExpanded||isAddingSubtask)
      ?`<button onclick="event.stopPropagation();toggleSubtaskExpand(${t.id})" title="${isExpanded?'Collapse subtasks':'Expand subtasks'}"
          style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 7px 2px 5px;border-radius:20px;cursor:pointer;flex-shrink:0;border:1.5px solid ${isExpanded?T.accent2:T.borderBlue||T.border2};background:${isExpanded?T.accent2+'22':T.surface2};color:${isExpanded?T.accent2:T.muted};transition:all .15s;"
          onmouseover="this.style.borderColor='${T.accent2}';this.style.color='${T.accent2}'"
          onmouseout="this.style.borderColor='${isExpanded?T.accent2:T.borderBlue||T.border2}';this.style.color='${isExpanded?T.accent2:T.muted}'">
          <i class="ti ti-git-branch" style="font-size:10px;"></i>${(t.subtasks||[]).length}
        </button>`
      :`<button onclick="event.stopPropagation();openAddSubtask(${t.id})" title="Add a sub-task"
          style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:600;padding:2px 7px 2px 5px;border-radius:20px;cursor:pointer;flex-shrink:0;border:1px dashed ${T.border};background:transparent;color:${T.muted2};opacity:0;transition:all .15s;"
          class="subtask-add-hint"
          onmouseover="this.style.opacity=1;this.style.borderColor='${T.accent2}';this.style.color='${T.accent2}'"
          onmouseout="this.style.opacity=0">
          <i class="ti ti-git-branch" style="font-size:10px;"></i>+
        </button>`;
    const estimateHtml=editingEstimateId===t.id
      ?`<input id="est-input-${t.id}" type="number" min="1" max="9999" placeholder="min"
          value="${t.estimatedMins||''}"
          onkeydown="if(event.key==='Enter'){saveEstimate(${t.id},this.value);event.preventDefault();}if(event.key==='Escape'){cancelEditEstimate();}"
          onblur="saveEstimate(${t.id},this.value)"
          style="${inputStyle('width:62px;padding:2px 5px;font-size:11px;font-family:DM Mono,monospace;text-align:center;')}"/>`
      :t.estimatedMins!=null
        ?`<button onclick="event.stopPropagation();startEditEstimate(${t.id})" style="${btnStyle('default','font-size:10px;padding:2px 7px;')}">~${t.estimatedMins}m</button>`
        :`<button onclick="event.stopPropagation();startEditEstimate(${t.id})" style="${btnStyle('default','font-size:10px;padding:2px 7px;opacity:0.5;')}">+ est</button>`;

    // Time edit shortcut in overflow
    const timeEditBtn=timeVal
      ?`<button onclick="event.stopPropagation();startEditTaskTime(${t.id})" style="${btnStyle('default','font-size:10px;padding:2px 7px;')}"><i class="ti ti-clock"></i>${timeVal}</button>
        <button onclick="event.stopPropagation();clearTaskTime(${t.id})" title="Clear time" style="${btnStyle('default','font-size:10px;padding:2px 5px;')}"><i class="ti ti-clock-x"></i></button>`
      :`<button onclick="event.stopPropagation();startEditTaskTime(${t.id})" style="${btnStyle('default','font-size:10px;padding:2px 7px;opacity:0.5;')}"><i class="ti ti-clock"></i>+ time</button>`;

    // Note button
    const noteBtn=`<button onclick="event.stopPropagation();openNoteEdit(${t.id})" style="${btnStyle(noteText?'accent2':'default','font-size:10px;padding:2px 7px;')}"><i class="ti ti-pencil"></i>${noteText?'note':'+ note'}</button>`;

    // Subtask button
    const subtaskBtn=hasSubtasks
      ?`<button onclick="event.stopPropagation();toggleSubtaskExpand(${t.id})" style="${btnStyle('default','font-size:10px;padding:2px 7px;')}"><i class="ti ti-${isExpanded?'chevron-up':'git-branch'}"></i>${(t.subtasks||[]).length} sub</button>`
      :`<button onclick="event.stopPropagation();openAddSubtask(${t.id})" style="${btnStyle('default','font-size:10px;padding:2px 7px;opacity:0.6;')}"><i class="ti ti-git-branch"></i>+ sub</button>`;

    // Pin button
    const pinBtn=`<button onclick="event.stopPropagation();pinTask(${t.id})" title="${t.pinned?'Unpin':'Pin as daily task'}" style="${btnStyle(t.pinned?'accent2':'default','font-size:10px;padding:2px 7px;')}"><i class="ti ti-pin${t.pinned?'':'-off'}"></i>${t.pinned?'pinned':'pin'}</button>`;

    // Delete button
    const deleteBtn=`<button onclick="event.stopPropagation();deleteTask(${t.id})" style="${btnStyle('danger','font-size:10px;padding:2px 7px;')}"><i class="ti ti-trash"></i>delete</button>`;

    const aiBreakdownBtn=(aiSettings.masterEnabled&&(t.subtasks||[]).length<2)
      ?`<button onclick="event.stopPropagation();taskAiBreakdown(${t.id})" style="${btnStyle('default','font-size:10px;padding:2px 7px;')}"><i class="ti ti-sitemap"></i> AI breakdown</button>`
      :'';

    const overflowPanel=overflowOpen?`
      <div onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;padding:6px 6px 6px 34px;border-top:0.5px solid ${T.border};background:${T.surface2};">
        ${estimateHtml}
        ${timeEditBtn}
        ${noteBtn}
        ${subtaskBtn}
        ${aiBreakdownBtn}
        ${pinBtn}
        ${deleteBtn}
      </div>`:'';

    // ── Note row (always below main row when open) ───────────────────────────
    const isNoteExpanded=expandedNoteTaskId===t.id;
    const noteRowHtml=isNoteExpanded
      ?`<div style="padding:4px 6px 6px 34px;" onclick="event.stopPropagation()" data-no-clobber="true">
          <textarea id="task-note-textarea-${t.id}"
            placeholder="Add a note…"
            onblur="saveNoteBlur(${t.id})"
            onkeydown="if(event.key==='Escape'){closeNoteEdit(${t.id});}"
            style="${inputStyle('resize:none;font-size:11px;padding:5px 8px;line-height:1.5;min-height:52px;')}"
          >${esc(noteText)}</textarea>
        </div>`
      :(noteText&&!overflowOpen
        ?`<div onclick="event.stopPropagation();openNoteEdit(${t.id})" style="padding:2px 6px 5px 34px;font-size:11px;color:${T.muted2};line-height:1.4;cursor:text;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="Click to edit note">${esc(noteText.length>80?noteText.slice(0,80)+'…':noteText)}</div>`
        :'');

    const resolutionPrompt=_renderResolutionPrompt(t,aScore,taskStatus);
    const subtaskRowsHtml=_renderSubtaskRows(t,todayStr,isMusicCat);

    // ── Main row ─────────────────────────────────────────────────────────────
    // v47: removed per-task background tint when subtasks exist
    // v47: focused task uses surface3 (darker green); hover uses surface2
    const highlightStyle=isHighlighted?'box-shadow:0 0 0 3px '+T.accent+'55;border:1.5px solid '+T.accent+';transition:box-shadow .3s,border-color .3s;':'';
    return`<div data-task-id="${t.id}" style="border-bottom:0.5px solid ${T.border};border-radius:8px;background:${T.surface};${highlightStyle}">
      <div ${draggable} style="display:flex;align-items:center;gap:6px;padding:8px 8px 8px 6px;${isFocus?`background:${T.surface3};border-left:3px solid ${T.accent};padding-left:4px;border-radius:4px;`:'border-left:3px solid transparent;'}"
        onmouseover="this.style.background='${isFocus?T.surface3:T.surface2}';const sh=this.querySelector('.subtask-add-hint');if(sh)sh.style.opacity='1';"
        onmouseout="this.style.background='${isFocus?T.surface3:'transparent'}';const sh=this.querySelector('.subtask-add-hint');if(sh)sh.style.opacity='0';"
      >
        <span title="${taskSortMode==='manual'?'drag to reorder':'drag to Focus Board'}" style="cursor:grab;color:${T.muted2};font-size:13px;flex-shrink:0;padding:0 1px;opacity:${taskSortMode==='manual'?0.4:0.2};"><i class="ti ti-grip-vertical"></i></span>
        <div style="flex-shrink:0;">${urgencyDots}</div>
        ${checkHtml}
        <!-- Task name + meta -->
        <div style="flex:1;min-width:0;" onclick="setFocus(${t.id})" ondblclick="toggleSubtaskExpand(${t.id})">
          <div style="font-size:13px;line-height:1.4;word-break:break-word;color:${taskStatus==='done'?T.muted2:T.text};cursor:pointer;font-weight:${taskStatus==='done'?'400':isFocus?'600':'400'};${taskStatus==='done'?'text-decoration:line-through;':''}">${esc(t.text)}</div>
          ${(catPillHtml||trackedChip||repeatIcon||energyBadge||riskBadge||scopeBadge)?`<div style="display:flex;align-items:center;gap:4px;margin-top:2px;flex-wrap:wrap;">${catPillHtml}${trackedChip}${repeatIcon}${energyBadge}${riskBadge}${scopeBadge}</div>`:''}
        </div>
        <!-- Subtask count badge — always visible -->
        ${subtaskCountBadge}
        <!-- Always-visible right side -->
        ${timeHtml}
        ${timerIconHtml}
        <!-- Overflow toggle -->
        <button onclick="event.stopPropagation();taskOverflowOpenId=(taskOverflowOpenId===${t.id}?null:${t.id});render()"
          title="More options"
          style="display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;width:24px;height:24px;border-radius:6px;border:0.5px solid ${overflowOpen?T.border2:T.border};background:${overflowOpen?T.surface2:'transparent'};color:${overflowOpen?T.text:T.muted2};cursor:pointer;font-size:12px;padding:0;transition:all .12s;">
          <i class="ti ti-dots"></i>
        </button>
      </div>
      ${overflowPanel}
      ${noteRowHtml}
      ${resolutionPrompt}
      ${subtaskRowsHtml}
    </div>`;
}



// renderDayLogWidget moved to render_daylog.js
// renderJournalWidget moved to render_journal.js

registerWidget({
  id: 'tasks',
  label: 'Tasks',
  icon: 'ti-list-check',
  pinnable: false,
  collapsible: true,
  fullWidth: true,
  defaultVisible: true,
  render: renderTasksWidget,
});
