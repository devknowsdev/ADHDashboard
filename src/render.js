/*
MODULE: render.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render.js responsibilities
USES: local modules
STATE_READS: T, darkMode, tasks
STATE_WRITES: _renderTimer, _scrollY, activeElement, ae, barLabel, boardTimer, body, c1, circ, class
PUBLIC_API: _doRender, _partialTimerUpdate, _renderFloatBar, render, renderNow
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-22
*/

// Lightweight DOM patch for timer tick renders when an input has focus.
// Updates only the floating bar label + SVG clock text nodes — no innerHTML rebuild.
function _partialTimerUpdate(){
  // Floating bar time label
  const m=Math.floor(timerSecs/60),s=timerSecs%60;
  const label=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
  const barLabel=document.getElementById('float-bar-label');
  if(barLabel) barLabel.textContent=label;
  // Float bar SVG ring dashoffset
  const floatRing=document.getElementById('float-bar-ring');
  if(floatRing){
    const circ=2*Math.PI*44;
    const offset=timerMode==='countdown'?(circ*(1-Math.min(1,timerPlannedSecs>0?(timerPlannedSecs-timerSecs)/timerPlannedSecs:0))).toFixed(2):circ.toFixed(2);
    floatRing.setAttribute('stroke-dashoffset',offset);
  }
  // SVG composite clock
  const n=new Date();
  const hhmm=String(n.getHours()).padStart(2,'0')+':'+String(n.getMinutes()).padStart(2,'0');
  const ss=String(n.getSeconds()).padStart(2,'0');
  const svgHhmm=document.getElementById('svg-clock-hhmm');
  if(svgHhmm) svgHhmm.textContent=hhmm;
  const svgSs=document.getElementById('svg-clock-ss');
  if(svgSs) svgSs.textContent=ss;
  // Crisis header clock
  const headerClock=document.getElementById('clock-el');
  if(headerClock) headerClock.textContent=hhmm+':'+ss;
  // Focus board ring1 (elapsed) dashoffset + stopwatch label
  const focusRing1=document.getElementById('focus-ring1');
  if(focusRing1&&timerRunning&&timerSessionType!=='break'){
    const r1=46;
    const c1=2*Math.PI*r1;
    const elapsedSecs=timerMode==='stopwatch'?timerSecs:Math.max(0,timerPlannedSecs-timerSecs);
    const ring1Offset=c1*(1-(elapsedSecs%3600)/3600);
    focusRing1.setAttribute('stroke-dashoffset',ring1Offset.toFixed(2));
    const swLabel=document.getElementById('focus-stopwatch-label');
    if(swLabel){
      const em=Math.floor(elapsedSecs/60),es=elapsedSecs%60;
      swLabel.textContent=`${String(em).padStart(2,'0')}:${String(es).padStart(2,'0')}`;
    }
  }
  // Focus board card live elapsed label — keyed by focusTaskId so stale cards are never patched
  const boardTimer=focusTaskId!=null?document.getElementById('board-timer-label-'+focusTaskId):null;
  if(boardTimer){
    const elapsedSecs=timerMode==='stopwatch'?timerSecs:Math.max(0,timerPlannedSecs-timerSecs);
    const em=Math.floor(elapsedSecs/60),es=elapsedSecs%60;
    boardTimer.textContent=`${String(em).padStart(2,'0')}:${String(es).padStart(2,'0')}`;
  }
}

function _renderFloatBar(){
  // Returns the floating timer bar HTML (fixed top strip) when a session is active,
  // or '' when no session is running/paused.
  const hasActiveSession=timerRunning||(activeSession!==null&&!showQuickLog);
  if(!hasActiveSession) return '';
  const isBreakFloat=timerSessionType==='break';
  const floatColor=isBreakFloat?T.accent2:(timerMode==='countdown'?T.pomo:T.accent2);
  const floatLabel=(()=>{const m=Math.floor(timerSecs/60),s=timerSecs%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;})();
  const focusTaskFloat=getTask(focusTaskId);
  const floatTaskName=isBreakFloat?'☕ break':(focusTaskFloat?focusTaskFloat.text:'');
  return `
    <!-- pointer-events:none on wrapper so the bar never intercepts clicks on page content below -->
    <div style="position:fixed;top:0;left:0;right:0;z-index:8000;pointer-events:none;">
      <div style="display:flex;align-items:center;gap:10px;padding:7px 14px;background:${T.surface};border-bottom:2px solid ${floatColor};box-shadow:0 2px 12px ${floatColor}33;position:relative;pointer-events:none;">
        <!-- Colour accent line -->
        <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${floatColor};opacity:0.8;pointer-events:none;"></div>
        <!-- Mini ring (display only, no interaction needed) -->
        <svg style="transform:rotate(-90deg);flex-shrink:0;pointer-events:none;" width="32" height="32" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="44" fill="none" stroke="${T.border}" stroke-width="10"/>
          <circle cx="50" cy="50" r="44" fill="none" stroke="${floatColor}" stroke-width="10"
            id="float-bar-ring"
            stroke-dasharray="${(2*Math.PI*44).toFixed(2)}"
            stroke-dashoffset="${timerMode==='countdown'?(2*Math.PI*44*(1-Math.min(1,timerPlannedSecs>0?(timerPlannedSecs-timerSecs)/timerPlannedSecs:0))).toFixed(2):(2*Math.PI*44).toFixed(2)}"
            stroke-linecap="round" style="transition:stroke-dashoffset .5s linear;"/>
        </svg>
        <!-- Time -->
        <span id="float-bar-label" style="font-family:'DM Mono',monospace;font-size:18px;font-weight:700;color:${floatColor};flex-shrink:0;min-width:54px;pointer-events:none;">${floatLabel}</span>
        <!-- Paused indicator -->
        ${!timerRunning?`<span style="font-size:10px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${floatColor};opacity:.7;flex-shrink:0;pointer-events:none;">paused</span>`:''}
        <!-- Task name -->
        <span style="flex:1;font-size:13px;font-weight:600;color:${T.text};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-width:0;pointer-events:none;">${esc(floatTaskName)}</span>
        <!-- Play/Pause — pointer-events:auto re-enables clicks just for buttons -->
        <button onclick="toggleTimer()" title="${timerRunning?'Pause':'Resume'}" style="pointer-events:auto;width:30px;height:30px;border-radius:50%;border:none;cursor:pointer;background:${floatColor};color:#fff;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:13px;">
          <i class="ti ti-player-${timerRunning?'pause':'play'}"></i>
        </button>
        <!-- Save -->
        <button onclick="stopAndSaveTimer()" title="Save session" style="pointer-events:auto;width:30px;height:30px;border-radius:50%;border:1.5px solid ${T.border};cursor:pointer;background:${T.btnBg};color:${T.muted};display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:12px;">
          <i class="ti ti-device-floppy"></i>
        </button>
      </div>
    </div>
    <div style="height:46px;"></div>`;
}

// ── Header action buttons — wizard + AI entry points ──────────────────────────
// Both of these are persistent, always-visible header buttons (unlike the
// day-wizard banner, which only appears under specific conditions and was the
// only previous entry point — see actions_wizard.js wizOpenFromHeader()).
function _renderWizardHeaderBtn(now){
  const hs=wizHeaderState(now);
  return `<button onclick="wizOpenFromHeader()" title="${esc(hs.label)}" style="${btnStyle('default','padding:5px 9px;font-size:14px;border-radius:8px;position:relative;')}">
    <i class="ti ${hs.icon}"></i>
    ${hs.pending?`<span style="position:absolute;top:3px;right:3px;width:7px;height:7px;border-radius:50%;background:${T.accent};border:1.5px solid ${T.surface};"></span>`:''}
  </button>`;
}
function _renderAiHeaderBtn(){
  const on=aiSettings.masterEnabled;
  return `<button onclick="openAiSettings()" title="${on?'AI assistant — enabled':'AI assistant — set up'}" style="${btnStyle(on?'accent2':'default','padding:5px 9px;font-size:14px;border-radius:8px;')}">
    <i class="ti ti-sparkles"></i>
  </button>`;
}

function _renderChatHeaderBtn(){
  return `<button onclick="openChatModal()" title="Open chat" style="${btnStyle('default','padding:5px 9px;font-size:14px;border-radius:8px;')}"><i class="ti ti-message-circle"></i></button>`;
}

function _renderFilesHeaderBtn(){
  return `<button onclick="openFileManager()" title="Files" style="${btnStyle('default','padding:5px 9px;font-size:14px;border-radius:8px;')}"><i class="ti ti-folder"></i></button>`;
}

function _renderListenHeaderBtn(){
  const on=listenModeActive;
  return `<button onclick="toggleListenMode()" title="${on?'Voice listen mode on':'Enable voice commands'}" style="${btnStyle(on?'accent2':'default','padding:5px 9px;font-size:14px;border-radius:8px;')}">
    <i class="ti ti-${on?'microphone-off':'microphone'}"></i>
  </button>`;
}

// ── Debounced render — batches rapid consecutive render() calls ───────────────
let _renderTimer=null;
function render(){
  if(_renderTimer) cancelAnimationFrame(_renderTimer);
  _renderTimer=requestAnimationFrame(()=>{_renderTimer=null;_doRender();});
}
function renderNow(){
  if(_renderTimer){cancelAnimationFrame(_renderTimer);_renderTimer=null;}
  _doRender();
}
function _doRender(){
  // If the focused element (or any ancestor) carries data-no-clobber="true", skip the full
  // DOM rebuild and only update the timer/clock readouts.  This replaces the old hardcoded
  // ID blocklist — any input rendered with data-no-clobber is automatically protected.
  const ae=document.activeElement;
  if(ae && ae.closest?.('[data-no-clobber="true"]')){
    _partialTimerUpdate();
    return;
  }

  ensureFocusValid();
  const root=document.getElementById('root');
  // Preserve scroll position so clicking a task doesn't jump to the top
  const _scrollY=window.scrollY;
  root.style.cssText=`background:${T.bg};color:${T.text};font-family:'Syne',sans-serif;padding:12px;min-height:100vh;box-sizing:border-box;--border-col:${T.border};`;root.id='root';

  const now=new Date();
  const todayStr=now.toDateString();
  const todayYmd=dateToYMD(now);
  const clockStr=String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0');
  const dateStr=DAYS[now.getDay()]+', '+MONTHS[now.getMonth()]+' '+now.getDate();

  const focusTask=getTask(focusTaskId);

  // ── Crisis / focus mode: render ONLY the focustimer widget ──
  if(crisisMode){
    const timerBody=renderFocusBoardWidget(focusTask,todayStr,now);
    const focustimerDef=getWidgetDef('focusboard');
    const ws=getWidgetState('focusboard');
    const collapsed=ws?ws.collapsed:false;
    root.innerHTML=`
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;padding:6px 10px;background:${T.surface};border:1.5px solid ${T.border2};border-radius:12px;">
    <span style="font-family:'DM Mono',monospace;font-size:15px;font-weight:500;color:${T.text};" id="clock-el">${clockStr}</span>
    <button onclick="exitCrisisMode()" style="${btnStyle('accent2','font-size:12px;padding:6px 14px;border-radius:8px;')}"><i class="ti ti-layout-grid"></i> Exit focus mode</button>
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    ${renderWidgetChrome('focusboard',focustimerDef,collapsed,timerBody)}
  </div>
  ${showFocusModal?renderFocusModalHtml():''}
  ${showSessionsModal?renderSessionsModalHtml():''}
  ${showQuickLog?renderQuickLogHtml():''}
  ${idlePromptShown?renderIdlePromptHtml():''}
  <div id="toast" style="position:fixed;bottom:20px;right:20px;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;color:#fff;z-index:9999;display:none;max-width:260px;font-family:'Syne',sans-serif;"></div>
    `;
    window.scrollTo(0,_scrollY);
    return;
  }

  const orderedWidgets=widgetLayout
    .filter(w=>{const def=getWidgetDef(w.id);return w.visible&&def;})
    .sort((a,b)=>a.order-b.order);

  const widgetsHtml=orderedWidgets.map(w=>{
    const def=getWidgetDef(w.id);
    if(!def)return '';
    // focusboard's render fn takes (focusTask, todayStr, now) — every other
    // registered widget takes (todayStr, now). Special-cased here since the
    // registry's render contract is otherwise uniform.
    const body=w.id==='focusboard'
      ? def.render(focusTask,todayStr,now)
      : def.render(todayStr,now);
    const extraBtns=w.id==='tasks'
      ? `<button onclick="showWarnings=!showWarnings;render()" title="${showWarnings?'Hide warnings':'Show warnings'}" style="${btnStyle(showWarnings?'accent':'default','font-size:11px;padding:3px 7px;')}"><i class="ti ti-alert-triangle"></i></button>`
      : '';
    return renderWidgetChrome(w.id,def,w.collapsed,body,extraBtns);
  }).join('');

  const hiddenCount=widgetLayout.filter(w=>!w.visible).length;

  const floatBar=_renderFloatBar();
  const wizBanner=_renderWizardBanner(todayYmd,now);

  root.innerHTML=`
  ${wizBanner}
  ${floatBar}
  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
    <div style="font-size:16px;font-weight:600;color:${T.accent}">focus<span style="color:${T.accent2}">.</span></div>
    <div style="display:flex;align-items:center;gap:10px;">
      <span class="header-date" style="font-size:11px;color:${T.muted};">${dateStr}</span>
      ${_renderWizardHeaderBtn(now)}
      ${_renderAiHeaderBtn()}
      ${_renderChatHeaderBtn()}
      ${_renderFilesHeaderBtn()}
      ${_renderListenHeaderBtn()}
      <button onclick="dumpAiDailyPlan()" title="Ask AI for a daily plan suggestion" style="${btnStyle('default','padding:5px 9px;font-size:14px;border-radius:8px;')}"><i class="ti ti-list-check"></i></button>
      <button onclick="openSettings()" title="Settings" style="${btnStyle('default','padding:5px 9px;font-size:14px;border-radius:8px;')}"><i class="ti ti-settings"></i></button>
      <button onclick="enterCrisisMode()" title="Focus mode — hide everything except the timer" style="${btnStyle('default','padding:5px 9px;font-size:14px;border-radius:8px;')}"><i class="ti ti-focus-2"></i></button>
      <button onclick="toggleDark()" title="${darkMode?'Light mode':'Dark mode'}" style="${btnStyle('default','padding:5px 9px;font-size:14px;border-radius:8px;')}"><i class="ti ti-${darkMode?'sun':'moon'}"></i></button>
    </div>
  </div>
  <div id="widget-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
    ${widgetsHtml}
  </div>
  ${hiddenCount>0?`<div style="margin-top:10px;display:flex;justify-content:center;">
    <button onclick="openWidgetDrawer()" style="${btnStyle('default','font-size:12px;padding:7px 18px;border-radius:999px;')}"><i class="ti ti-layout-grid-add"></i> + Widgets (${hiddenCount} hidden)</button>
  </div>`:''}
  ${showCatModal?renderCatModalHtml():''}
  ${showSettingsModal?renderSettingsModalHtml():''}
  ${showAiAuditModal?renderAiAuditHtml():''}
  ${aiPendingInterpret?renderAiInterpretHtml():''}
  ${aiPendingSuggestion?renderAiDailyPlanHtml():''}
  ${aiPendingPlan?renderAiPlanPreviewHtml():''}
  ${aiExecStreaming?renderAiExecLogHtml():''}
  ${aiPreviewDiff?renderAiDiffModalHtml():''}
  ${showChatModal?renderChatModalHtml():''}
  ${showFileManager?renderFileManagerModalHtml():''}
  ${showFocusModal?renderFocusModalHtml():''}
  ${showSessionsModal?renderSessionsModalHtml():''}
  ${showQuickLog?renderQuickLogHtml():''}
  ${showWidgetDrawer?renderWidgetDrawerHtml():''}
  ${idlePromptShown?renderIdlePromptHtml():''}
  ${subtaskQuickLogId?renderSubtaskQuickLogHtml():''}
  <div id="toast" style="position:fixed;bottom:20px;right:20px;padding:10px 16px;border-radius:10px;font-size:13px;font-weight:600;color:#fff;z-index:9999;display:none;max-width:260px;font-family:'Syne',sans-serif;"></div>
  ${dayWizardOpen?renderDayWizard(todayYmd,now):''}
  `;

  window.scrollTo(0,_scrollY);

  // If intentions widget is on the active step (not done), auto-focus its textarea on first load
  // (only if nothing else has focus and we haven't already typed something)
  if(dailyIntentions.step!=='done'&&document.activeElement===document.body){
    const intentionInput=document.getElementById('intention-answer-input');
    if(intentionInput) intentionInput.focus();
  }
}
