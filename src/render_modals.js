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
