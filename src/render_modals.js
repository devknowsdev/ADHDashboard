/*
MODULE: render_modals.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_modals.js responsibilities
USES: local modules
STATE_READS: T, state, tasks
STATE_WRITES: PILLS, activeTasks, actualMins, autocomplete, c, cat, catId, catRows, class, clobber
PUBLIC_API: renderCatModalHtml, renderFocusModalHtml, renderIdlePromptHtml, renderQuickLogHtml, renderSessionsModalHtml, renderSubtaskQuickLogHtml
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

function renderFocusModalHtml(){
  const pending=sortTasksList(tasks.filter(t=>!t.done));
  const q=(focusSearch||'').trim().toLowerCase();
  const list=pending.filter(t=>!q||t.text.toLowerCase().includes(q)||(t.subtasks||[]).some(st=>st.text.toLowerCase().includes(q)));
  const rows=list.length?list.map(t=>{
    const tracked=getTotalForTask(t.id);
    const isFocus=focusTaskId===t.id&&focusSubtaskId==null;
    const pendingSubtasks=(t.subtasks||[]).filter(st=>!st.done);
    const filteredSubs=q?pendingSubtasks.filter(st=>st.text.toLowerCase().includes(q)):pendingSubtasks;
    const subtaskRows=filteredSubs.map(st=>{
      const stTracked=getTotalForSubtask(t.id,st.id);
      const isStFocus=focusTaskId===t.id&&focusSubtaskId===st.id;
      return `<div onclick="setFocus(${t.id},${st.id})" style="display:flex;align-items:center;gap:8px;padding:7px 0 7px 28px;border-bottom:1px dashed ${T.border};cursor:pointer;background:${isStFocus?T.surface2:'transparent'};">
        <span style="color:${T.muted2};font-size:11px;">›</span>
        <div style="width:8px;height:8px;border-radius:50%;background:${isStFocus?T.accent2:T.border};flex-shrink:0;"></div>
        <div style="flex:1;font-size:12px;font-weight:600;color:${T.text};">${esc(st.text)}</div>
        ${stTracked>0?`<div style="font-size:11px;color:${T.muted};font-family:'DM Mono',monospace;">${fmtDur(stTracked)}</div>`:''}
      </div>`;
    }).join('');
    return `
      <div onclick="setFocus(${t.id})" style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1.5px solid ${T.border};cursor:pointer;background:${isFocus?T.surface2:'transparent'};">
        <div style="width:10px;height:10px;border-radius:50%;background:${isFocus?T.accent:T.border2};flex-shrink:0;"></div>
        <div style="flex:1;font-size:13px;font-weight:700;color:${T.text};">${esc(t.text)}</div>
        ${tracked>0?`<div style="font-size:11px;color:${T.muted};font-family:'DM Mono',monospace;">${fmtDur(tracked)}</div>`:''}
      </div>
      ${subtaskRows}
    `;
  }).join(''):`<div style="color:${T.muted2};font-size:12px;padding:10px 0;">No matching tasks.</div>`;

  return `
  <div onclick="if(event.target===this)closeFocusPicker()" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;">
    <div style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:16px;padding:18px;width:100%;max-width:520px;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <span style="font-size:15px;font-weight:800;color:${T.text};">Choose your focus task</span>
        <button onclick="closeFocusPicker()" style="${btnStyle('default','padding:5px 9px;font-size:14px;')}"><i class="ti ti-x"></i></button>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;background:${T.surface3};border:1px solid ${T.borderBlue||T.border};border-radius:10px;padding:8px;">
        <input id="focus-search" type="text" value="${esc(focusSearch)}" placeholder="Search tasks…" oninput="setFocusSearch(this.value)" style="${inputStyle('flex:1;')}"/>
        <button onclick="clearFocus()" style="${btnStyle('danger','font-size:11px;padding:5px 10px;')}"><i class="ti ti-trash"></i>clear focus</button>
      </div>
      <div style="max-height:340px;overflow:auto;border-top:1.5px solid ${T.border};">
        ${rows}
      </div>
      <div style="margin-top:12px;display:flex;justify-content:flex-end;">
        <button onclick="closeFocusPicker()" style="${btnStyle('default','font-size:11px;padding:5px 10px;')}">close</button>
      </div>
    </div>
  </div>`;
}

function renderSessionsModalHtml(){
  const tid=sessionsViewTaskId!=null?sessionsViewTaskId:focusTaskId;
  const t=getTask(tid);
  if(!t) return '';
  const sess=getSessionsForTask(t.id);
  const rows=sess.length?sess.map(s=>{
    const start=new Date(s.startedAt);
    const end=new Date(s.endedAt);
    const timeStr=`${start.toLocaleDateString()} ${start.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})} → ${end.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}`;
    const isEditing=editingSessionId===s.id;
    // Subtask label for this session
    const subCtx=s.subtaskId?getSubtask(t.id,s.subtaskId):null;
    const subtaskBadge=subCtx?`<span style="font-size:10px;color:${T.accent2};padding:1px 7px;background:${T.blue||T.surface2};border:1px solid ${T.borderBlue||T.border};border-radius:10px;white-space:nowrap;">› ${esc(subCtx.text)}</span>`:'';
    return `
      <div style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1.5px solid ${T.border};">
        <div style="width:9px;height:9px;border-radius:50%;background:${s.mode==='countdown'?T.pomo:T.accent2};flex-shrink:0;"></div>
        <div style="flex:1;min-width:0;">
          <div style="font-size:12px;font-weight:800;color:${T.text};">${esc(timeStr)}</div>
          <div style="display:flex;align-items:center;gap:6px;margin-top:2px;flex-wrap:wrap;">
            <span style="font-size:11px;color:${T.muted};">${s.mode}</span>
            ${subtaskBadge}
          </div>
        </div>
        ${isEditing?`
          <div style="display:flex;flex-direction:column;gap:2px;align-items:flex-end;">
            <input id="session-edit-mmss-${s.id}" type="text" inputmode="numeric" placeholder="MM:SS" maxlength="7"
              value="${esc(editingSessionMmSs)}"
              oninput="setEditingSessionMmSs(this.value)"
              onkeydown="if(event.key==='Enter'){saveSessionEdit(${s.id});event.preventDefault();}if(event.key==='Escape'){cancelSessionEdit();}"
              data-no-clobber="true"
              style="${inputStyle('width:90px;text-align:center;font-family:DM Mono,monospace;')}"/>
            <span style="font-size:9px;color:${T.muted2};letter-spacing:.04em;">MM:SS</span>
          </div>
          <button onclick="saveSessionEdit(${s.id})" style="${btnStyle('accent','font-size:11px;padding:4px 9px;')}"><i class="ti ti-check"></i></button>
          <button onclick="cancelSessionEdit()" style="${btnStyle('default','font-size:11px;padding:4px 9px;')}"><i class="ti ti-x"></i></button>
        `:`
          <div style="font-size:12px;font-family:'DM Mono',monospace;font-weight:700;color:${T.text};min-width:70px;text-align:right;">${fmtDur(s.seconds)}</div>
          <button onclick="startSessionEdit(${s.id})" style="${btnStyle('default','font-size:11px;padding:4px 9px;')}"><i class="ti ti-edit"></i></button>
          <button onclick="deleteSession(${s.id})" style="${btnStyle('danger','font-size:11px;padding:4px 9px;')}"><i class="ti ti-trash"></i></button>
        `}
      </div>
    `;
  }).join(''):`<div style="color:${T.muted2};font-size:12px;padding:10px 0;">No sessions yet.</div>`;

  const total=getTotalForTask(t.id);
  const ownTotal=getTotalOwnSessions(t.id);
  const subtaskTotal=total-ownTotal;
  const subtaskBreakdown=subtaskTotal>0?`<span style="font-size:10px;color:${T.muted2};margin-left:4px;">(${fmtDur(ownTotal)} task + ${fmtDur(subtaskTotal)} sub-tasks)</span>`:'';

  // ── Estimation accuracy line ──
  const estLine=(()=>{
    if(!t.estimatedMins||!sess.length) return '';
    const actualMins=Math.round(total/60);
    const estMins=t.estimatedMins;
    const deltaMins=actualMins-estMins;
    const pctOver=estMins>0?Math.abs(deltaMins)/estMins*100:0;
    const deltaStr=deltaMins===0?'on target':(deltaMins>0?`+${deltaMins}m over`:`${deltaMins}m under`);
    const deltaColor=deltaMins<0?T.green:(pctOver>20?T.pomo:T.urg1);
    return `<div style="margin-top:10px;padding:8px 12px;background:${T.surface2};border:1.5px solid ${T.border};border-radius:10px;font-size:12px;display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
      <i class="ti ti-clock-check" style="color:${T.muted};font-size:13px;flex-shrink:0;"></i>
      <span style="color:${T.muted};font-weight:600;">Estimated: <span style="font-family:'DM Mono',monospace;color:${T.text};">${estMins}m</span></span>
      <span style="color:${T.muted};">·</span>
      <span style="color:${T.muted};font-weight:600;">Actual: <span style="font-family:'DM Mono',monospace;color:${T.text};">${actualMins}m</span></span>
      <span style="color:${T.muted};">·</span>
      <span style="font-family:'DM Mono',monospace;font-weight:700;color:${deltaColor};">${deltaStr}</span>
    </div>`;
  })();

  return `
  <div onclick="if(event.target===this)closeSessions()" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;">
    <div style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:16px;padding:18px;width:100%;max-width:620px;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;background:${T.surface3};border-radius:10px;padding:10px 12px;margin:-4px -4px 12px;">
        <div>
          <div style="font-size:15px;font-weight:900;color:${T.text};">Sessions</div>
          <div style="font-size:11px;color:${T.muted};margin-top:2px;">${esc(t.text)} • ${sess.length} session${sess.length===1?'':'s'} • ${fmtDur(total)} total${subtaskBreakdown}</div>
        </div>
        <button onclick="closeSessions()" style="${btnStyle('default','padding:5px 9px;font-size:14px;')}"><i class="ti ti-x"></i></button>
      </div>
      <div style="max-height:420px;overflow:auto;border-top:1.5px solid ${T.border};">
        ${rows}
      </div>
      ${estLine}
      <div style="margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
        <button onclick="deleteAllSessionsForFocus()" style="${btnStyle('danger','font-size:11px;padding:5px 10px;')}"><i class="ti ti-trash"></i>delete all for this task</button>
        <button onclick="closeSessions()" style="${btnStyle('default','font-size:11px;padding:5px 10px;')}">close</button>
      </div>
    </div>
  </div>`;
}

// Item 11: Subtask quick-log popover (inline time entry on subtask rows)
function renderSubtaskQuickLogHtml(){
  if(!subtaskQuickLogId) return '';
  const {taskId,subtaskId}=subtaskQuickLogId;
  const t=getTask(taskId);
  const st=getSubtask(taskId,subtaskId);
  if(!t||!st) return '';
  const previewSecs=parseTimeInput(subtaskQuickLogInput);
  const displayStr=previewSecs>0?fmtDur(previewSecs):'—';
  const isValid=previewSecs>0;
  const PILLS=[5,10,15,25,30,45];
  return `
  <div onclick="if(event.target===this)closeSubtaskQuickLog()" style="position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:2100;display:flex;align-items:center;justify-content:center;padding:20px;">
    <div style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:14px;padding:18px 20px;width:100%;max-width:340px;box-sizing:border-box;box-shadow:0 8px 32px rgba(0,0,0,.2);">
      <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:12px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:9px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${T.muted};margin-bottom:2px;">log time · sub-task</div>
          <div style="font-size:13px;font-weight:800;color:${T.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(st.text)}</div>
          <div style="font-size:11px;color:${T.muted2};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">› ${esc(t.text)}</div>
        </div>
        <button onclick="closeSubtaskQuickLog()" style="${btnStyle('default','padding:4px 8px;font-size:13px;')}"><i class="ti ti-x"></i></button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <input id="st-ql-input" type="text" inputmode="text" autocomplete="off"
          value="${esc(subtaskQuickLogInput)}"
          placeholder="e.g. 25m, 1h, 1:30"
          style="${inputStyle('flex:1;font-size:15px;font-family:DM Mono,monospace;padding:8px 12px;')}"
          data-no-clobber="true"
          oninput="subtaskQuickLogInput=this.value;render();setTimeout(()=>{const el=document.getElementById('st-ql-input');if(el&&document.activeElement!==el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}},0)"
          onkeydown="if(event.key==='Enter'){commitSubtaskQuickLog();event.preventDefault();}if(event.key==='Escape'){closeSubtaskQuickLog();}"/>
        <span style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:${isValid?T.accent:T.muted2};flex-shrink:0;">${displayStr}</span>
      </div>
      <div style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:12px;">
        ${PILLS.map(m=>`<button onclick="subtaskQuickLogInput='${m}m';render();setTimeout(()=>{const el=document.getElementById('st-ql-input');if(el){el.focus();el.select();}},0)"
          style="font-family:'Syne',sans-serif;font-size:11px;font-weight:700;padding:4px 9px;border-radius:999px;cursor:pointer;border:1.5px solid ${parseTimeInput(subtaskQuickLogInput)===m*60?T.accent2:T.border};background:${parseTimeInput(subtaskQuickLogInput)===m*60?T.accent2:'transparent'};color:${parseTimeInput(subtaskQuickLogInput)===m*60?'#fff':T.muted};">
          ${m}m
        </button>`).join('')}
      </div>
      <div style="display:flex;gap:6px;">
        <button onclick="commitSubtaskQuickLog()" ${!isValid?'disabled':''} style="${btnStyle('accent','flex:1;justify-content:center;font-size:12px;padding:8px 12px;')}${!isValid?'opacity:.45;cursor:not-allowed;':''}"><i class="ti ti-device-floppy"></i> Log</button>
        <button onclick="closeSubtaskQuickLog()" style="${btnStyle('default','font-size:12px;padding:8px 10px;')}">Cancel</button>
      </div>
    </div>
  </div>`;
}

// ── Quick-log modal ───────────────────────────────────────────────────────────
function renderQuickLogHtml(){
  const t=getTask(quickLogTaskId);
  if(!t) return '';
  const cat=getCat(t.catId);

  // Parse the current text input for live preview
  const previewSecs=parseTimeInput(quickLogInput) ?? quickLogSecs;
  const displayStr=previewSecs>0?fmtDur(previewSecs):'—';
  const isValid=previewSecs>0;

  const PILLS=[5,10,15,25,30,45,60];

  return `
  <div onclick="if(event.target===this)discardQuickLog()" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px;">
    <div id="quick-log-modal" style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:18px;padding:22px 24px;width:100%;max-width:400px;box-sizing:border-box;box-shadow:0 8px 40px rgba(0,0,0,.22);">

      <!-- Header -->
      <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:16px;">
        <div style="flex:1;min-width:0;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${T.muted};margin-bottom:3px;">log session</div>
          <div style="font-size:14px;font-weight:800;color:${T.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${esc(t.text)}</div>
          ${cat?`<span style="font-size:10px;padding:2px 8px;border-radius:20px;font-weight:600;background:${cat.color.bg};color:${cat.color.text};display:inline-block;margin-top:3px;">${esc(cat.name)}</span>`:''}
        </div>
        <button onclick="discardQuickLog()" style="${btnStyle('default','padding:5px 9px;font-size:14px;flex-shrink:0;')}"><i class="ti ti-x"></i></button>
      </div>

      <!-- Text time input -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">
        <input id="ql-time-input" type="text" inputmode="text" autocomplete="off"
          value="${esc(quickLogInput)}"
          placeholder="e.g. 25, 25m, 1h, 1h10m, 1:25"
          style="${inputStyle('flex:1;font-size:16px;font-family:DM Mono,monospace;padding:10px 14px;')}"
          data-no-clobber="true"
          oninput="qlTimeInputChange(this.value)"
          onkeydown="qlTimeKeydown(event)"/>
        <span id="ql-preview" style="font-family:'DM Mono',monospace;font-size:22px;font-weight:700;color:${isValid?T.accent:T.muted2};min-width:68px;text-align:right;flex-shrink:0;">${displayStr}</span>
      </div>

      <!-- Quick-pick pills -->
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px;">
        ${PILLS.map(m=>`<button id="ql-pill-${m}" onclick="qlPickPill(${m})"
          style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;padding:5px 11px;border-radius:999px;cursor:pointer;border:1.5px solid ${quickLogInput===String(m)+'m'||parseTimeInput(quickLogInput)===m*60?T.accent2:T.border};background:${quickLogInput===String(m)+'m'||parseTimeInput(quickLogInput)===m*60?T.accent2:'transparent'};color:${quickLogInput===String(m)+'m'||parseTimeInput(quickLogInput)===m*60?'#fff':T.muted};transition:all .12s;">
          ${m}m
        </button>`).join('')}
      </div>

      <!-- Note field -->
      <textarea id="ql-note" rows="2" placeholder="Note (optional)…"
        style="${inputStyle('resize:none;font-size:12px;margin-bottom:12px;')}"
        data-no-clobber="true"
        onkeydown="if(event.key==='Enter'&&!event.shiftKey){commitQuickLog();event.preventDefault();}"
      >${esc(quickLogNote)}</textarea>

      <!-- Actions -->
      <div style="display:flex;gap:8px;align-items:center;">
        <button onclick="commitQuickLog()" ${!isValid?'disabled':''} style="${btnStyle('accent','flex:1;justify-content:center;font-size:13px;padding:9px 14px;')}${!isValid?'opacity:.45;cursor:not-allowed;':''}">
          <i class="ti ti-device-floppy"></i> Log &amp; close <span style="font-size:10px;opacity:0.7;margin-left:4px;">↵</span>
        </button>
        <button onclick="discardQuickLog()" style="${btnStyle('default','font-size:12px;padding:9px 12px;')}">
          Discard
        </button>
      </div>
      <div style="text-align:center;font-size:10px;color:${T.muted2};margin-top:8px;">
        <kbd style="background:${T.surface2};border:1px solid ${T.border};border-radius:4px;padding:1px 5px;">Enter</kbd> to log &nbsp;·&nbsp;
        <kbd style="background:${T.surface2};border:1px solid ${T.border};border-radius:4px;padding:1px 5px;">Esc</kbd> to discard
      </div>
    </div>
  </div>`;
}

// Parse flexible time input into seconds.
// Accepts: "25" → 25min, "25m" → 25min, "1h" → 60min, "1h10" → 70min,
//          "1h10m" → 70min, "1:25" → 85min, "90" → 90min

// ── Idle prompt modal ────────────────────────────────────────────────────────
// Migrated from actions.js — render-only, no state mutations.
function renderIdlePromptHtml(){
  const idleMins=Math.round((Date.now()-lastInteractionAt)/60000);
  const previewSecs=parseTimeInput(idlePromptInput)||(idleMins*60);
  const displayStr=fmtDur(previewSecs);
  const PILLS=[5,10,15,25,30,45,60];
  const activeTasks=[{id:null,text:'Downtime'},...tasks.filter(t=>t.status!=='done')];
  const taskOpts=activeTasks.map(t=>`<option value="${t.id===null?'':t.id}" ${idlePromptTaskId===t.id?'selected':''}>${esc(t.text)}</option>`).join('');

  return `<div onclick="if(event.target===this)dismissIdlePrompt()" style="position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:1800;display:flex;align-items:flex-end;justify-content:center;padding:20px;">
    <div style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:18px 18px 12px 12px;padding:20px 22px;width:100%;max-width:420px;box-sizing:border-box;box-shadow:0 -4px 30px rgba(0,0,0,.18);animation:qlPop .2s ease-out both;">
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <span style="font-size:20px;">🕐</span>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:800;color:${T.text};">Been busy?</div>
          <div style="font-size:11px;color:${T.muted};">You've been away ~${idleMins}m. Log what you were doing.</div>
        </div>
        <button onclick="dismissIdlePrompt()" style="${btnStyle('default','padding:5px 9px;font-size:14px;flex-shrink:0;')}"><i class="ti ti-x"></i></button>
      </div>

      <!-- Task selector -->
      <select onchange="idlePromptTaskId=this.value===''?null:parseInt(this.value)||this.value;render()"
        style="${selectStyle('width:100%;margin-bottom:10px;')}">
        ${taskOpts}
      </select>

      <!-- Time input + pills -->
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        <input id="idle-time-input" type="text" inputmode="text" autocomplete="off"
          value="${esc(idlePromptInput||idleMins+'m')}"
          placeholder="e.g. 20m, 1h, 1:30"
          style="${inputStyle('flex:1;font-size:15px;font-family:DM Mono,monospace;padding:9px 12px;')}"
          data-no-clobber="true"
          oninput="idleInputChange(this.value)"/>
        <span id="idle-preview" style="font-family:'DM Mono',monospace;font-size:20px;font-weight:700;color:${T.accent};flex-shrink:0;">${displayStr}</span>
      </div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;margin-bottom:14px;">
        ${PILLS.map(m=>`<button id="idle-pill-${m}" onclick="idlePickPill(${m})"
          style="font-family:'Syne',sans-serif;font-size:11px;font-weight:700;padding:4px 10px;border-radius:999px;cursor:pointer;border:1.5px solid ${parseTimeInput(idlePromptInput)===m*60?T.accent2:T.border};background:${parseTimeInput(idlePromptInput)===m*60?T.accent2:'transparent'};color:${parseTimeInput(idlePromptInput)===m*60?'#fff':T.muted};">
          ${m}m
        </button>`).join('')}
      </div>

      <div style="display:flex;gap:8px;">
        <button onclick="commitIdleLog()" style="${btnStyle('accent','flex:1;justify-content:center;font-size:13px;padding:9px 14px;')}">
          <i class="ti ti-device-floppy"></i> Log it
        </button>
        <button onclick="dismissIdlePrompt()" style="${btnStyle('default','font-size:12px;padding:9px 14px;')}">
          Skip
        </button>
      </div>
    </div>
  </div>`;
}


// ── Category manager modal ──────────────────────────────────────────────────
// Migrated from actions.js — render-only, no state mutations.
function renderCatModalHtml(){
  const catRows=categories.length?categories.map(c=>{
    if(editingCatId===c.id)return`
      <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1.5px solid ${T.border};">
        <div style="width:22px;height:22px;border-radius:50%;background:${c.color.dot};border:2px solid ${T.border2};flex-shrink:0;"></div>
        <input id="cedit-name-${c.id}" type="text" value="${esc(c.name)}" maxlength="20" onkeydown="if(event.key==='Enter')saveEditCat('${c.id}')" style="${inputStyle('flex:1;padding:5px 8px;font-size:13px;width:auto;')}"/>
        <button onclick="saveEditCat('${c.id}')" style="${btnStyle('accent','font-size:11px;padding:4px 9px;')}"><i class="ti ti-check"></i></button>
        <button onclick="cancelEditCat()" style="${btnStyle('default','font-size:11px;padding:4px 9px;')}"><i class="ti ti-x"></i></button>
      </div>
      <div style="padding:6px 0 4px 30px;display:flex;flex-wrap:wrap;gap:5px;">
        ${COLOR_OPTS.map((col,i)=>`<div onclick="setCatColor('${c.id}',${i})" title="${col.name}" style="width:22px;height:22px;border-radius:50%;background:${col.dot};cursor:pointer;border:3px solid ${c.color.name===col.name?T.text:'transparent'};box-sizing:border-box;"></div>`).join('')}
      </div>`;
    return`<div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1.5px solid ${T.border};">
      <div style="width:22px;height:22px;border-radius:50%;background:${c.color.dot};flex-shrink:0;"></div>
      <div style="flex:1;font-size:13px;font-weight:600;color:${T.text};">${esc(c.name)}</div>
      <span style="font-size:10px;padding:2px 8px;border-radius:20px;font-weight:600;background:${c.color.bg};color:${c.color.text};">${tasks.filter(t=>t.catId===c.id).length} tasks</span>
      <button onclick="startEditCat('${c.id}')" style="${btnStyle('default','font-size:11px;padding:4px 9px;')}"><i class="ti ti-edit"></i></button>
      <button onclick="confirmDeleteCat('${c.id}')" style="${btnStyle('danger','font-size:11px;padding:4px 9px;')}"><i class="ti ti-trash"></i></button>
    </div>`;
  }).join(''):`<div style="color:${T.muted2};font-size:12px;padding:8px 0;">No categories yet.</div>`;

  return`<div onclick="if(event.target===this)closeCatManager()" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;">
    <div style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:16px;padding:20px;width:100%;max-width:440px;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="font-size:15px;font-weight:700;color:${T.text};">Manage categories</span>
        <button onclick="closeCatManager()" style="${btnStyle('default','padding:5px 9px;font-size:14px;')}"><i class="ti ti-x"></i></button>
      </div>
      ${catRows}
      <div style="margin-top:12px;border-top:1.5px solid ${T.border};padding-top:12px;">
        <div style="font-size:11px;color:${T.muted};margin-bottom:6px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;">Add new category</div>
        <div style="display:flex;gap:6px;align-items:center;">
          <input id="new-cat-name" type="text" placeholder="Category name…" maxlength="20" onkeydown="if(event.key==='Enter')addCategory()" style="${inputStyle('flex:1;')}"/>
          <div onclick="cycleNewCatColor()" title="pick colour" style="width:28px;height:28px;border-radius:50%;background:${COLOR_OPTS[newCatColorIdx].dot};border:2px solid ${T.border2};cursor:pointer;flex-shrink:0;box-sizing:border-box;"></div>
          <button onclick="addCategory()" style="${btnStyle('accent','font-size:11px;padding:5px 10px;')}"><i class="ti ti-plus"></i>Add</button>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px;">
          ${COLOR_OPTS.map((c,i)=>`<div onclick="pickNewCatColor(${i})" title="${c.name}" style="width:22px;height:22px;border-radius:50%;background:${c.dot};cursor:pointer;border:3px solid ${i===newCatColorIdx?T.text:'transparent'};box-sizing:border-box;"></div>`).join('')}
        </div>
      </div>
    </div>
  </div>`;
}

function renderSettingsModalHtml(){
  const providerVal=_aiProviderOrderValue();
  const keyDisplay=aiShowKey?esc(aiSettings.anthropicKey):'••••••••••••';

  const aiTab=`
    <div style="font-size:14px;font-weight:800;color:${T.text};margin-bottom:14px;">
      <i class="ti ti-sparkles"></i> AI Assistant
    </div>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;cursor:pointer;">
      <input type="checkbox" ${aiSettings.masterEnabled?'checked':''} onchange="settingsSetAiMaster(this.checked)"/>
      <span style="font-size:13px;color:${T.text};">Enable AI features</span>
    </label>
    <label style="display:flex;align-items:center;gap:8px;margin-bottom:14px;cursor:pointer;">
      <input type="checkbox" ${listenModeActive?'checked':''} onchange="toggleListenMode()"/>
      <span style="font-size:13px;color:${T.text};">Enable voice commands</span>
    </label>
    <div style="font-size:10px;color:${T.muted2};margin-bottom:12px;">Speak commands like “start timer”, “stop timer”, “focus [task name]”, or “start [task name]”.</div>
    <div style="font-size:10px;font-weight:700;color:${T.muted};letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px;">Providers</div>
    <div style="margin-bottom:12px;">
      <span style="font-size:11px;color:${T.muted};">Priority:</span>
      <select onchange="settingsSetAiProviderOrder(this.value)" style="${selectStyle('font-size:11px;padding:4px 8px;margin-left:6px;')}">
        <option value="ollama-first" ${providerVal==='ollama-first'?'selected':''}>Ollama first</option>
        <option value="anthropic-first" ${providerVal==='anthropic-first'?'selected':''}>Claude first</option>
        <option value="ollama-only" ${providerVal==='ollama-only'?'selected':''}>Ollama only</option>
        <option value="anthropic-only" ${providerVal==='anthropic-only'?'selected':''}>Claude only</option>
      </select>
    </div>
    <div style="padding:10px;background:${T.surface2};border-radius:10px;margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:${T.text};margin-bottom:8px;">Ollama (local, private)</div>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
        <input type="checkbox" ${aiSettings.ollamaEnabled?'checked':''} onchange="settingsSetOllamaEnabled(this.checked)"/>
        <span style="font-size:12px;color:${T.text};">Enable Ollama</span>
      </label>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
        <span style="font-size:11px;color:${T.muted};width:42px;">URL:</span>
        <input type="text" value="${esc(aiSettings.ollamaUrl||OLLAMA_DEFAULT_URL)}"
          onchange="settingsSaveOllamaUrl(this.value)"
          style="${inputStyle('flex:1;min-width:160px;font-size:11px;')}"/>
      </div>
      <div style="padding:10px;background:${T.surface2};border-radius:10px;margin-bottom:10px;">
        <div style="font-size:11px;font-weight:700;color:${T.text};margin-bottom:8px;">Local AI Daemon</div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
          <span style="font-size:11px;color:${T.muted};width:42px;">URL:</span>
          <input type="text" value="${typeof localStorage !== 'undefined' ? esc(localStorage.getItem('adhd4_local_ai_url')||'http://127.0.0.1:3000') : 'http://127.0.0.1:3000'}"
            onchange="settingsSaveLocalAiUrl(this.value)"
            style="${inputStyle('flex:1;min-width:160px;font-size:11px;')}"/>
        </div>
        <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px;flex-wrap:wrap;">
          <span style="font-size:11px;color:${T.muted};width:42px;">Token:</span>
          <input type="password" value="${typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token') ? '••••••••' : ''}"
            onchange="settingsSaveLocalAiToken(this.value)"
            style="${inputStyle('flex:1;min-width:160px;font-size:11px;')}"/>
          <button onclick="settingsTestLocalAi()" style="${btnStyle('default','font-size:11px;padding:4px 8px;')}">Test</button>
        </div>
        <div style="font-size:10px;color:${T.muted2};margin-top:6px;">Saved locally in localStorage.</div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
        <span style="font-size:11px;color:${T.muted};width:42px;">Model:</span>
        <input type="text" value="${esc(aiSettings.ollamaModel||OLLAMA_DEFAULT_MODEL)}"
          onchange="settingsSaveOllamaModel(this.value)"
          style="${inputStyle('flex:1;min-width:120px;font-size:11px;')}"/>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <button onclick="settingsTestOllama()" style="${btnStyle('default','font-size:11px;padding:4px 10px;')}">Test connection</button>
        ${_aiStatusDot('ollama')}
      </div>
      <div style="font-size:10px;color:${T.muted2};margin-top:6px;">Suggested: llama3.2, mistral, phi3, gemma2</div>
    </div>
    <div style="padding:10px;background:${T.surface2};border-radius:10px;margin-bottom:10px;">
      <div style="font-size:11px;font-weight:700;color:${T.text};margin-bottom:8px;">Claude API</div>
      <label style="display:flex;align-items:center;gap:8px;margin-bottom:8px;cursor:pointer;">
        <input type="checkbox" ${aiSettings.anthropicEnabled?'checked':''} disabled style="opacity:0.6;"/>
        <span style="font-size:12px;color:${T.muted};">Enabled when key is set</span>
      </label>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:8px;flex-wrap:wrap;">
        <span style="font-size:11px;color:${T.muted};width:42px;">Key:</span>
        <input type="${aiShowKey?'text':'password'}" value="${keyDisplay}"
          placeholder="sk-ant-…"
          onchange="settingsSaveAnthropicKey(this.value)"
          style="${inputStyle('flex:1;min-width:160px;font-size:11px;font-family:DM Mono,monospace;')}"/>
        <button onclick="settingsToggleShowKey()" style="${btnStyle('default','font-size:11px;padding:4px 8px;')}">${aiShowKey?'hide':'show'}</button>
      </div>
      <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <button onclick="settingsTestAnthropic()" style="${btnStyle('default','font-size:11px;padding:4px 10px;')}">Test connection</button>
        ${_aiStatusDot('anthropic')}
      </div>
      <div style="font-size:10px;color:${T.muted2};margin-top:6px;">Key stored locally only. Task text is sent to Anthropic servers.</div>
    </div>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
      <button onclick="installLocalAi()" style="${btnStyle('default','font-size:11px;padding:6px 10px;')}"><i class="ti ti-download"></i> Install local AI</button>
      <button onclick="openAiAuditModal()" style="${btnStyle('default','font-size:11px;padding:6px 10px;')}"><i class="ti ti-list-check"></i> View AI audit log</button>
    </div>
    <div style="font-size:10px;color:${T.muted2};padding:8px;background:${T.surface3};border-radius:8px;line-height:1.5;">
      <i class="ti ti-info-circle"></i> Voice recordings and journal entries are never sent to any AI provider.
      Only task text and summary statistics are used in AI calls.
    </div>`;

  return `
  <div onclick="if(event.target===this)closeSettings()" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;">
    <div style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:16px;padding:18px;width:100%;max-width:480px;box-sizing:border-box;max-height:90vh;overflow:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="font-size:15px;font-weight:800;color:${T.text};">Settings</span>
        <button onclick="closeSettings()" style="${btnStyle('default','padding:5px 9px;font-size:14px;')}"><i class="ti ti-x"></i></button>
      </div>
      ${aiTab}
    </div>
  </div>`;
}

function renderAiAuditHtml(){
  const rows = (aiAuditLog || []).slice().reverse().map(a => {
    const time = new Date(a.ts).toLocaleString();
    return `<div style="padding:10px;border-bottom:1px solid ${T.border};display:flex;flex-direction:column;gap:6px;">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div style="font-weight:800;color:${T.text};font-size:13px;">${esc(a.cmd)}</div>
        <div style="font-size:11px;color:${T.muted};">${time}</div>
      </div>
      <div style="font-size:12px;color:${T.muted2};font-family:DM Mono,monospace;white-space:pre-wrap;">args: ${esc(JSON.stringify(a.args))}</div>
      <div style="font-size:12px;color:${T.muted2};font-family:DM Mono,monospace;white-space:pre-wrap;">result: ${esc(JSON.stringify(a.result))}</div>
    </div>`;
  }).join('') || `<div style="color:${T.muted2};padding:12px;font-size:12px;">No AI audit entries yet.</div>`;

  return `
  <div onclick="if(event.target===this)closeAiAuditModal()" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1100;display:flex;align-items:center;justify-content:center;padding:16px;">
    <div style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:14px;padding:14px;width:100%;max-width:720px;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-size:15px;font-weight:800;color:${T.text};">AI Audit Log</div>
        <div style="display:flex;gap:8px;">
          <button onclick="aiClearAuditLog();render();" style="${btnStyle('danger','font-size:12px;padding:6px 10px;')}"><i class=\"ti ti-trash\"></i> Clear</button>
          <button onclick="closeAiAuditModal()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Close</button>
        </div>
      </div>
      <div style="max-height:420px;overflow:auto;border-top:1px solid ${T.border};padding-top:8px;">
        ${rows}
      </div>
    </div>
  </div>`;
}

function renderAiInterpretHtml(){
  const interp = aiPendingInterpret || {};
  const tasks = Array.isArray(interp.taskSuggestions) ? interp.taskSuggestions : [];
  const tasksHtml = tasks.length ? tasks.map(t => {
    return `<div style="padding:10px;border-bottom:1px solid ${T.border};">
      <div style="font-size:12px;font-weight:700;color:${T.text};">${esc(t.text || '[no task text]')}</div>
      <div style="font-size:11px;color:${T.muted2};font-family:DM Mono,monospace;white-space:pre-wrap;">${esc(t.ts || '')}${t.catId?` · ${esc(t.catId)}`:''}${t.taskScope?` · ${esc(t.taskScope)}`:''}</div>
      ${t.note?`<div style="font-size:11px;color:${T.text};margin-top:4px;">${esc(t.note)}</div>`:''}
    </div>`;
  }).join('') : `<div style="color:${T.muted2};padding:12px;font-size:12px;">No task suggestions were generated.</div>`;

  return `
  <div onclick="if(event.target===this)dumpAiInterpretClose()" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1100;display:flex;align-items:center;justify-content:center;padding:16px;">
    <div onclick="event.stopPropagation()" style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:14px;padding:16px;width:100%;max-width:620px;box-sizing:border-box;max-height:90vh;overflow:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-size:15px;font-weight:800;color:${T.text};">AI Journal Interpretation</div>
          <div style="font-size:12px;color:${T.muted2};">Review the summary and suggested tasks before adding them.</div>
        </div>
        <button onclick="dumpAiInterpretClose()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Close</button>
      </div>
      <div style="margin-bottom:12px;padding:12px;background:${T.surface2};border-radius:12px;">
        <div style="font-size:12px;font-weight:700;color:${T.text};margin-bottom:6px;">Summary</div>
        <div style="font-size:13px;color:${T.text};line-height:1.6;white-space:pre-wrap;">${esc(interp.summary || 'No summary available.')}</div>
      </div>
      <div style="margin-bottom:12px;padding:12px;background:${T.surface2};border-radius:12px;">
        <div style="font-size:12px;font-weight:700;color:${T.text};margin-bottom:6px;">Insight</div>
        <div style="font-size:13px;color:${T.text};line-height:1.6;white-space:pre-wrap;">${esc(interp.insight || 'No insight captured.')}</div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:12px;font-weight:700;color:${T.text};margin-bottom:8px;">Task suggestions</div>
        <div style="border:1.5px solid ${T.border};border-radius:12px;overflow:hidden;">${tasksHtml}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
        <button onclick="dumpAiInterpretClose()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Dismiss</button>
        <button onclick="dumpAiInterpretAddTasks()" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">Add suggested tasks</button>
      </div>
    </div>
  </div>`;
}

function renderAiDailyPlanHtml(){
  const pending = aiPendingSuggestion || {};
  const tasks = Array.isArray(pending.taskSuggestions) ? pending.taskSuggestions : [];
  const tasksHtml = tasks.length ? tasks.map((t) => `
      <div style="padding:10px;border-bottom:1px solid ${T.border};">
        <div style="font-size:12px;font-weight:700;color:${T.text};">${esc(t.text)}</div>
        <div style="font-size:11px;color:${T.muted2};font-family:DM Mono,monospace;white-space:pre-wrap;">${esc(t.ts || '')}${t.note?` · ${esc(t.note)}`:''}</div>
      </div>
    `).join('') : `<div style="color:${T.muted2};padding:12px;font-size:12px;">No suggestions available.</div>`;
  return `
  <div onclick="if(event.target===this)dumpAiDailyPlanClose()" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1100;display:flex;align-items:center;justify-content:center;padding:16px;">
    <div onclick="event.stopPropagation()" style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:14px;padding:16px;width:100%;max-width:620px;box-sizing:border-box;max-height:90vh;overflow:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;gap:10px;flex-wrap:wrap;">
        <div>
          <div style="font-size:15px;font-weight:800;color:${T.text};">AI Daily Planning Suggestions</div>
          <div style="font-size:12px;color:${T.muted2};">Review the AI plan before adding suggested tasks to your list.</div>
        </div>
        <button onclick="dumpAiDailyPlanClose()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Close</button>
      </div>
      <div style="margin-bottom:12px;padding:12px;background:${T.surface2};border-radius:12px;">
        <div style="font-size:12px;font-weight:700;color:${T.text};margin-bottom:6px;">Summary</div>
        <div style="font-size:13px;color:${T.text};line-height:1.6;white-space:pre-wrap;">${esc(pending.summary || 'AI suggests a few concrete tasks for your day.')}</div>
      </div>
      <div style="margin-bottom:12px;">
        <div style="font-size:12px;font-weight:700;color:${T.text};margin-bottom:8px;">Suggested tasks</div>
        <div style="border:1.5px solid ${T.border};border-radius:12px;overflow:hidden;">${tasksHtml}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;">
        <button onclick="dumpAiDailyPlanClose()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Dismiss</button>
        <button onclick="dumpAiDailyPlanAddTasks()" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">Add suggested tasks</button>
      </div>
    </div>
  </div>`;
}

function renderAiExecLogHtml(){
  if(!aiExecStreaming) return '';
  return `
  <div onclick="if(event.target===this){}" style="position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:1200;display:flex;align-items:flex-end;justify-content:center;padding:20px;pointer-events:none;">
    <div style="pointer-events:auto;background:${T.surface};border:1.5px solid ${T.border2};border-radius:12px;padding:12px;width:100%;max-width:520px;box-sizing:border-box;box-shadow:0 -8px 40px rgba(0,0,0,.28);">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-size:13px;font-weight:800;color:${T.text};">Execution running</div>
        <div style="font-size:11px;color:${T.muted2};">Streaming updates…</div>
      </div>
      <div id="ai-exec-log-area" style="max-height:200px;overflow:auto;border-top:1px solid ${T.border};padding-top:8px;color:${T.muted};font-family:DM Mono,monospace;font-size:12px;">Live events will appear in the console.</div>
    </div>
  </div>`;
}

function renderAiPlanPreviewHtml(){
  const pending = aiPendingPlan || {};
  const nodes = Array.isArray(pending.graph?.nodes) ? pending.graph.nodes : [];
  const nodesHtml = nodes.length ? nodes.map((n) => {
    const risky = (Array.isArray(n.packet.filePaths) && n.packet.filePaths.length>0) || n.packet.node_type==='terminal' || (n.packet.context && n.packet.context.targetFile);
    const approved = (typeof aiApprovedNodes !== 'undefined' && aiApprovedNodes && aiApprovedNodes[n.id]);
    return `
      <div style="padding:8px;border-bottom:1px solid ${T.border};">
        <div style="font-size:12px;font-weight:700;color:${T.text};">${esc(n.id || '[node]')}</div>
        <pre style="font-family:DM Mono,monospace;font-size:11px;color:${T.muted2};white-space:pre-wrap;margin-top:6px;">${esc(JSON.stringify(n.packet || {}, null, 2))}</pre>
        ${risky?`<div style="margin-top:8px;display:flex;gap:8px;align-items:center;">
          <button onclick="previewNodeDiff('${esc(n.id)}')" style="${btnStyle('default','font-size:11px;padding:5px 8px;')}">Preview diff</button>
          <button onclick="approveNode('${esc(n.id)}')" style="${approved?btnStyle('accent','font-size:11px;padding:5px 8px;'):btnStyle('default','font-size:11px;padding:5px 8px;')}">${approved?'Approved':'Approve'}</button>
          <span style="font-size:11px;color:${approved?T.accent:T.muted2};">${approved?'Approved':'Requires approval'}</span>
        </div>`:''}
      </div>
    `;
  }).join('') : `<div style="color:${T.muted2};padding:12px;font-size:12px;">No nodes returned.</div>`;

  return `
  <div onclick="if(event.target===this)closeAiPlanPreview()" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1100;display:flex;align-items:center;justify-content:center;padding:16px;">
    <div onclick="event.stopPropagation()" style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:14px;padding:16px;width:100%;max-width:720px;box-sizing:border-box;max-height:90vh;overflow:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
        <div>
          <div style="font-size:15px;font-weight:800;color:${T.text};">AI Plan Preview</div>
          <div style="font-size:12px;color:${T.muted2};">Review the generated task-graph nodes below.</div>
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="copyAiPlanJson()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Copy JSON</button>
          <button onclick="executeAiPendingPlan()" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">Execute</button>
          <button onclick="closeAiPlanPreview()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Close</button>
        </div>
      </div>
      <div style="margin-bottom:12px;border:1.5px solid ${T.border};border-radius:12px;overflow:hidden;">${nodesHtml}</div>
    </div>
  </div>`;
}

function renderAiDiffModalHtml(){
  if(!aiPreviewDiff) return '';
  const nodeId = aiPreviewDiff.nodeId;
  const diff = String(aiPreviewDiff.diff || '').trim() || 'No diff available.';
  return `
  <div onclick="if(event.target===this)aiPreviewDiff=null;render()" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1200;display:flex;align-items:center;justify-content:center;padding:16px;">
    <div onclick="event.stopPropagation()" style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:12px;padding:14px;width:100%;max-width:820px;box-sizing:border-box;max-height:84vh;overflow:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-size:15px;font-weight:800;color:${T.text};">Preview Diff — ${esc(nodeId)}</div>
        <div style="display:flex;gap:8px;align-items:center;">
              ${aiPreviewDiff && aiPreviewDiff.kind==='repair' ? `
                <button onclick="fileRepairPending && (aiPreviewDiff=null,render())" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Close</button>
                <button onclick="applyFileRepair();" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">Apply Repair</button>
              ` : aiPreviewDiff && aiPreviewDiff.kind==='compare' ? `
                <button onclick="aiPreviewDiff=null;render()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Close</button>
              ` : `
                <button onclick="approveNode('${esc(nodeId)}')" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">Approve</button>
                <button onclick="approveAndApplyNode('${esc(nodeId)}')" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">Approve & Apply</button>
                <button onclick="undoNode('${esc(nodeId)}')" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Undo</button>
                <button onclick="aiPreviewDiff=null;render()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Close</button>
              `}
        </div>
      </div>
      <pre style="font-family:DM Mono,monospace;font-size:12px;color:${T.muted2};white-space:pre-wrap;border-top:1px solid ${T.border};padding-top:8px;">${esc(diff)}</pre>
    </div>
  </div>`;
}

function renderChatModalHtml(){
  if(!showChatModal) return '';
  const convs = Array.isArray(chatConversations) ? chatConversations : [];
  const convsHtml = convs.map(c => `<div style="padding:8px;border-bottom:1px solid ${T.border};cursor:pointer;${c.id===activeConversationId?('background:'+T.surface2+';'):''}" onclick="openConversation(${c.id});render()"><div style="font-weight:700;color:${T.text};">${esc(c.title||('Conversation '+c.id))}</div><div style="font-size:11px;color:${T.muted};">${esc(c.created_at||'')}</div></div>`).join('') || `<div style="color:${T.muted2};padding:12px;">No conversations yet.</div>`;
  const msgs = activeConversationId ? (chatMessages[activeConversationId] || []) : [];
  const msgsHtml = msgs.map(m => {
    const role = esc(m.role||'');
    const body = esc(m.response || m.prompt || '');
    // attachments field may be JSON string of ids
    let attIds = [];
    try { attIds = JSON.parse(m.attachments || '[]'); } catch (e) { attIds = []; }
    let attHtml = '';
    if (Array.isArray(attIds) && attIds.length) {
      attHtml = '<div style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap;">' + attIds.map(aId => {
        const meta = (typeof chatAttachmentMeta !== 'undefined' && chatAttachmentMeta[aId]) ? chatAttachmentMeta[aId] : null;
        const label = meta && (meta.filename || meta.fileName) ? esc(meta.filename || meta.fileName) : ('Attachment ' + aId);
        const preview = meta && meta.previewUrl ? meta.previewUrl : null;
        if (preview) {
          return `<div style="display:flex;flex-direction:column;align-items:flex-start;"><img src="${preview}" style="max-width:160px;max-height:120px;border-radius:8px;border:1px solid ${T.border};display:block;"/><div style="margin-top:6px;"><button onclick="downloadAttachment(${aId})" style="${btnStyle('default','font-size:12px;padding:6px 8px;')}">${label}</button></div></div>`;
        }
        return `<button onclick="downloadAttachment(${aId})" style="${btnStyle('default','font-size:12px;padding:6px 8px;')}">${label}</button>`;
      }).join('') + '</div>';
    }
    if(role==='assistant'){
      const prov = esc((m.provider||'') + (m.model?(' / '+m.model):''));
      return `<div style="margin-bottom:10px;"><div style="font-size:12px;color:${T.muted};font-weight:700;">Assistant <span style='font-size:11px;color:${T.muted2};font-weight:400;margin-left:8px;'>${prov}</span></div><div style="background:${T.surface3};padding:10px;border-radius:8px;margin-top:6px;font-family:DM Mono,monospace;font-size:13px;color:${T.text};white-space:pre-wrap;">${body}</div>${attHtml}</div>`;
    }
    return `<div style="margin-bottom:10px;"><div style="font-size:12px;color:${T.muted};font-weight:700;">User</div><div style="padding:8px;border-radius:6px;margin-top:6px;background:${T.surface};font-size:13px;color:${T.text};">${body}</div>${attHtml}</div>`;
  }).join('') || `<div style="color:${T.muted2};padding:12px;">No messages yet.</div>`;

  return `
  <div onclick="if(event.target===this){showChatModal=false;render()}" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1250;display:flex;align-items:center;justify-content:center;padding:16px;">
    <div onclick="event.stopPropagation()" style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:12px;padding:12px;width:100%;max-width:960px;box-sizing:border-box;max-height:86vh;overflow:auto;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <div style="font-size:15px;font-weight:800;color:${T.text};">Chat</div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button onclick="showChatModal=false;render()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Close</button>
        </div>
      </div>
      <div style="display:flex;gap:12px;">
        <div style="width:260px;max-height:60vh;overflow:auto;border-right:1px solid ${T.border};padding-right:8px;">${convsHtml}</div>
        <div style="flex:1;display:flex;flex-direction:column;max-height:60vh;">
          <div id="chat-messages" style="flex:1;overflow:auto;padding:8px;">${msgsHtml}</div>
          <div style="margin-top:10px;display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;gap:8px;align-items:center;">
              <input id="chat-composer" data-no-clobber="true" placeholder="Write a message..." value="${esc(chatComposerText||'')}" oninput="chatComposerText=this.value" style="${inputStyle('flex:1;min-width:0;font-size:13px;')};" />
              <button onclick="sendChatPrompt();render();" style="${btnStyle('accent','font-size:13px;padding:8px 12px;')}">Send</button>
            </div>
            <div style="display:flex;gap:8px;align-items:center;">
              <input type="file" id="chat-file-input" onchange="handleChatFileInput(this.files)" />
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">${(chatComposerAttachments||[]).map(id=>{const m=(typeof chatAttachmentMeta!=='undefined'&&chatAttachmentMeta[id])?chatAttachmentMeta[id]:null;const lbl=m && (m.filename||m.fileName)?esc(m.filename||m.fileName):('#'+id);return `<span style="background:${T.surface2};padding:6px;border-radius:6px;font-size:12px;color:${T.text};">${lbl} <button onclick="removeComposerAttachment(${id});render()" style="${btnStyle('danger','font-size:10px;padding:2px 6px;margin-left:6px;')}">x</button></span>`;}).join('')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

  function renderFileManagerModalHtml(){
    if(!showFileManager) return '';
    const files = Array.isArray(fileManagerFiles) ? fileManagerFiles : [];
    const q = (fileManagerFilter||'').trim().toLowerCase();
    const list = files.filter(f => !q || (f.filename||'').toLowerCase().includes(q) || (f.tags||[]).some(t => (t||'').toLowerCase().includes(q)));
    const listHtml = list.length ? list.map(f => {
      const id = f.id;
      const meta = (typeof chatAttachmentMeta!=='undefined' && chatAttachmentMeta[id]) ? chatAttachmentMeta[id] : f;
      const preview = meta && meta.previewUrl ? meta.previewUrl : null;
      return `<div onclick="selectFileManagerAttachment(${id});render()" style="display:flex;gap:8px;align-items:center;padding:8px;border-bottom:1px solid ${T.border};cursor:pointer;${fileManagerSelected===id?('background:'+T.surface2+';'):''}">
        <div style="width:56px;height:44px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          ${preview?`<img src="${preview}" style="max-width:56px;max-height:44px;border-radius:6px;border:1px solid ${T.border};"/>`:`<div style="width:56px;height:44px;display:flex;align-items:center;justify-content:center;border-radius:6px;border:1px dashed ${T.border};color:${T.muted};font-size:12px;">${esc((f.content_type||'').split('/')[1]||'file')}</div>`}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-weight:700;color:${T.text};font-size:13px;">${esc(f.filename||('attachment-'+id))}</div>
          <div style="font-size:11px;color:${T.muted};margin-top:4px;">${esc(f.content_type||'')} • ${f.size?fmtBytes(f.size):''}</div>
          <div style="margin-top:6px;display:flex;gap:6px;flex-wrap:wrap;">${(f.tags||[]).map(tag=>`<span style="background:${T.surface2};padding:4px 8px;border-radius:999px;font-size:12px;color:${T.text};">${esc(tag)}</span>`).join('')}</div>
        </div>
      </div>`;
    }).join('') : `<div style="color:${T.muted2};padding:12px;">No files.</div>`;

    const sel = fileManagerSelected ? (fileManagerFiles||[]).find(x=>x.id===fileManagerSelected) : null;
    const selMeta = sel && chatAttachmentMeta && chatAttachmentMeta[sel.id] ? chatAttachmentMeta[sel.id] : sel;

    return `
    <div onclick="if(event.target===this){showFileManager=false;render()}" style="position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:1300;display:flex;align-items:center;justify-content:center;padding:12px;">
      <div onclick="event.stopPropagation()" style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:12px;padding:12px;width:100%;max-width:980px;box-sizing:border-box;max-height:86vh;overflow:auto;display:flex;gap:12px;">
        <div style="width:340px;border-right:1px solid ${T.border};padding-right:8px;max-height:74vh;overflow:auto;">
          <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
            <input placeholder="Filter files or tags…" value="${esc(fileManagerFilter||'')}" oninput="fileManagerFilter=this.value;render();" style="${inputStyle('flex:1;')}" />
            <button onclick="loadFileManagerFiles();render();" style="${btnStyle('default','font-size:12px;padding:6px 8px;')}">Refresh</button>
          </div>
          <div style="max-height:60vh;overflow:auto;border-top:1px solid ${T.border};">${listHtml}</div>
        </div>
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <div style="font-size:15px;font-weight:800;color:${T.text};">Files</div>
            <div style="display:flex;gap:8px;align-items:center;">
              <button onclick="showFileManager=false;render()" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Close</button>
            </div>
          </div>
          <div style="flex:1;overflow:auto;padding:8px;border:1px solid ${T.border};border-radius:8px;background:${T.surface3};">
            ${sel?`<div style="display:flex;gap:12px;align-items:flex-start;">
              <div style="width:180px;height:140px;flex-shrink:0;">${selMeta && selMeta.previewUrl?`<img src="${selMeta.previewUrl}" style="max-width:180px;max-height:140px;border-radius:8px;border:1px solid ${T.border};"/>`:`<div style="width:180px;height:140px;display:flex;align-items:center;justify-content:center;border:1px dashed ${T.border};color:${T.muted};">No preview</div>`}</div>
              <div style="flex:1;min-width:0;">
                <div style="font-weight:800;color:${T.text};font-size:16px;">${esc(sel.filename||('attachment-'+sel.id))}</div>
                <div style="font-size:12px;color:${T.muted};margin-top:6px;">${esc(sel.content_type||'')}${sel.size?(' • '+fmtBytes(sel.size)):''}</div>
                <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                  <a href="#" onclick="downloadAttachment(${sel.id});return false;" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Download</a>
                  <button onclick="(async()=>{const fn=prompt('Rename metadata filename to:','${esc(sel.filename||'')}'); if(fn){ await renameAttachment(${sel.id},fn); await loadFileManagerFiles(); }})();render();" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Rename</button>
                  <button onclick="(async()=>{ await moveAttachment(${sel.id}); await loadFileManagerFiles(); })();render();" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Move</button>
                  <button onclick="(async()=>{ if(confirm('Delete this file?')){ await deleteAttachment(${sel.id}); await loadFileManagerFiles(); } })();render();" style="${btnStyle('danger','font-size:12px;padding:6px 10px;')}">Delete</button>
                  <button onclick="(async()=>{ await compareSelectedWithPrompt(); })();render();" style="${btnStyle('default','font-size:12px;padding:6px 10px;')}">Compare</button>
                  <button onclick="(async()=>{ await previewRepairAttachment(${sel.id}); })();render();" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">Repair</button>
                </div>
                <div style="margin-top:12px;">
                  <div style="font-weight:700;margin-bottom:6px;color:${T.text};">Tags</div>
                  <div style="display:flex;gap:8px;flex-wrap:wrap;">${(sel.tags||[]).map(tag=>`<span style="background:${T.surface2};padding:6px 8px;border-radius:999px;font-size:12px;color:${T.text};">${esc(tag)} <button onclick="removeTagFromAttachment(${sel.id}, ${JSON.stringify(tag)});render();" style="${btnStyle('danger','font-size:10px;padding:2px 6px;margin-left:6px;')}">x</button></span>`).join('')}</div>
                  <div style="margin-top:8px;display:flex;gap:8px;align-items:center;">
                    <input id="fm-tag-input-${sel.id}" placeholder="New tag" style="${inputStyle('flex:1;')}" />
                    <button onclick="(async()=>{const v=document.getElementById('fm-tag-input-${sel.id}').value; if(v){ await addTagToAttachment(${sel.id}, v); document.getElementById('fm-tag-input-${sel.id}').value=''; await loadFileManagerFiles(); }} )();render();" style="${btnStyle('accent','font-size:12px;padding:6px 10px;')}">Add</button>
                  </div>
                </div>
              </div>
            </div>`:'<div style="color:'+T.muted2+';">Select a file from the list to view details.</div>'}
          </div>
        </div>
      </div>
    </div>`;
  }
