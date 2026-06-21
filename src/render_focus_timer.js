/*
MODULE: render_focus_timer.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_focus_timer.js responsibilities
USES: local modules
STATE_READS: T, state
STATE_WRITES: SIZE, active, anchor, background, barClockHtml, barLayoutHtml, barRows, baseline, c1, c2
PUBLIC_API: _renderTimerBar, _renderTimerVisual
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Focus Board timer visuals — SVG ring clock (_renderTimerVisual) and
// timer bar layout (_renderTimerBar).
// Depends on: core.js (btnStyle, inputStyle, labelStyle), helpers.js (esc, getCat, fmtDur,
//             getSessionsForTask), state.js (timerRunning, timerMode, timerSecs,
//             timerPlannedSecs, timerSessionType, timerCountdownMins, timerLayout,
//             focusTaskId, focusSubtaskId, dayStartHour, clockColWidth).
// Called exclusively by render_focus.js: renderFocusBoardWidget.
function _renderTimerVisual(focusTask,nowMins,focusTotal,now){
  // ── Composite clock ──────────────────────────────────────────────────────────
  // Three concentric SVG rings + large digital clock centre
  // Ring 1 (inner):  stopwatch elapsed — fills over 60 min then wraps
  // Ring 2 (middle): task estimate — fills as tracked time approaches estimatedMins
  // Ring 3 (outer):  scheduled time target — fills toward task's ts deadline
  //
  // Geometry: viewBox 220×220, cx=cy=110
  //   r1=46 sw1=8  → inner edge at 42px  (clears 30pt HH:MM text ±38px)
  //   r2=60 sw2=7
  //   r3=73 sw3=6
  const SIZE=220;
  const cx=110,cy=110;

  // ── Ring 1: stopwatch / elapsed ──
  const r1=46, sw1=8;
  const c1=2*Math.PI*r1;
  const elapsedSecs = timerRunning&&timerSessionType!=='break'
    ? (timerMode==='stopwatch' ? timerSecs : Math.max(0,timerPlannedSecs-timerSecs))
    : 0;
  const ring1Fill = (elapsedSecs % 3600) / 3600;
  const ring1Offset = c1*(1-ring1Fill);
  const ring1Color = timerRunning&&timerSessionType!=='break' ? T.accent2 : T.border;

  // ── Ring 2: task estimate countdown ──
  const r2=60, sw2=7;
  const c2=2*Math.PI*r2;
  const estMins = focusTask?.estimatedMins ?? null;
  const totalTrackedSecs = focusTask ? focusTotal : 0;
  let ring2Fill=0, ring2Color=T.border, ring2Active=false;
  if(estMins && estMins>0){
    ring2Active=true;
    ring2Fill = Math.min(1, totalTrackedSecs / (estMins*60));
    ring2Color = ring2Fill<0.6 ? T.green : ring2Fill<0.85 ? T.urg1 : T.pomo;
  }
  const ring2Offset = c2*(1-ring2Fill);

  // ── Ring 3: time-of-day target countdown ──
  const r3=73, sw3=6;
  const c3=2*Math.PI*r3;
  let ring3Fill=0, ring3Color=T.border, ring3Active=false, ring3Label='';
  const focusTaskTarget = focusTask?.ts ? focusTask : null;
  if(focusTaskTarget?.ts){
    const [th,tm] = focusTaskTarget.ts.split(':').map(Number);
    const targetMins = th*60+tm;
    const dayStart = dayStartHour*60;
    const span = Math.max(1, targetMins - dayStart);
    const elapsed3 = Math.max(0, nowMins - dayStart);
    ring3Fill = Math.min(1, elapsed3/span);
    ring3Active = true;
    ring3Label = focusTaskTarget.ts;
    const minsLeft = targetMins - nowMins;
    ring3Color = minsLeft<=15 ? T.pomo : minsLeft<=45 ? T.urg1 : T.accent;
  }
  const ring3Offset = c3*(1-ring3Fill);

  // ── Centre text ──
  const stopwatchLabel = timerRunning&&timerSessionType!=='break'
    ? (()=>{const m=Math.floor(elapsedSecs/60),s=elapsedSecs%60;return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;})()
    : focusTotal>0 ? fmtDur(focusTotal) : '';

  const clockHH = String(now.getHours()).padStart(2,'0');
  const clockMM = String(now.getMinutes()).padStart(2,'0');
  const clockSS = String(now.getSeconds()).padStart(2,'0');

  // Legend dots
  const legendItems = [
    ring2Active ? {color:ring2Color, label:`est ${estMins}m`} : null,
    ring3Active ? {color:ring3Color, label:`⏰ ${ring3Label}`} : null,
  ].filter(Boolean);

  const legendHtml = legendItems.length ? `
    <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:4px;">
      ${legendItems.map(l=>`
        <span style="display:inline-flex;align-items:center;gap:4px;font-size:10px;color:${T.muted};">
          <span style="width:8px;height:8px;border-radius:50%;background:${l.color};display:inline-block;flex-shrink:0;"></span>
          ${esc(l.label)}
        </span>`).join('')}
    </div>` : '';

  const clockSvg=`
    <svg id="focus-clock-svg" width="100%" height="100%" viewBox="0 0 ${SIZE} ${SIZE}" style="overflow:visible;display:block;">
      <!-- track rings -->
      <circle cx="${cx}" cy="${cy}" r="${r1}" fill="none" stroke="${T.border}" stroke-width="${sw1}" opacity="0.35"/>
      <circle cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="${T.border}" stroke-width="${sw2}" opacity="${ring2Active?0.25:0}"/>
      <circle cx="${cx}" cy="${cy}" r="${r3}" fill="none" stroke="${T.border}" stroke-width="${sw3}" opacity="${ring3Active?0.2:0}"/>

      <!-- Ring 1: elapsed -->
      <circle id="focus-ring1" cx="${cx}" cy="${cy}" r="${r1}" fill="none" stroke="${ring1Color}" stroke-width="${sw1}"
        stroke-dasharray="${c1.toFixed(2)}" stroke-dashoffset="${ring1Offset.toFixed(2)}"
        stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
        style="transition:stroke-dashoffset .9s linear,stroke .4s;"/>

      <!-- Ring 2: estimate (only if active) -->
      ${ring2Active?`<circle cx="${cx}" cy="${cy}" r="${r2}" fill="none" stroke="${ring2Color}" stroke-width="${sw2}"
        stroke-dasharray="${c2.toFixed(2)}" stroke-dashoffset="${ring2Offset.toFixed(2)}"
        stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
        style="transition:stroke-dashoffset .9s linear,stroke .4s;"/>`:''}

      <!-- Ring 3: time target (only if active) -->
      ${ring3Active?`<circle cx="${cx}" cy="${cy}" r="${r3}" fill="none" stroke="${ring3Color}" stroke-width="${sw3}"
        stroke-dasharray="${c3.toFixed(2)}" stroke-dashoffset="${ring3Offset.toFixed(2)}"
        stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"
        style="transition:stroke-dashoffset .9s linear,stroke .4s;"/>`:''}

      <!-- Clock face: HH:MM large -->
      <text id="svg-clock-hhmm" x="${cx}" y="${cy-7}" text-anchor="middle" dominant-baseline="middle"
        font-family="'DM Mono',monospace" font-size="28" font-weight="700"
        fill="${T.text}" style="letter-spacing:.04em;">${clockHH}:${clockMM}</text>

      <!-- Seconds -->
      <text id="svg-clock-ss" x="${cx+2}" y="${cy+16}" text-anchor="middle" dominant-baseline="middle"
        font-family="'DM Mono',monospace" font-size="12" font-weight="500"
        fill="${T.muted}" style="letter-spacing:.06em;">${clockSS}</text>

      <!-- Stopwatch / session elapsed below seconds -->
      ${stopwatchLabel?`<text id="focus-stopwatch-label" x="${cx}" y="${cy+32}" text-anchor="middle" dominant-baseline="middle"
        font-family="'DM Mono',monospace" font-size="10" font-weight="600"
        fill="${timerRunning?ring1Color:T.muted2}">${stopwatchLabel}</text>`:''}

      <!-- Tick mark at 12 o'clock -->
      <line x1="${cx}" y1="${cy-r3-sw3/2-2}" x2="${cx}" y2="${cy-r3+sw3/2+2}"
        stroke="${T.border2}" stroke-width="1.5" opacity="0.4"/>
    </svg>`;


  // ── Bar layout ── (alternative to rings)
  // Three labeled horizontal progress bars: elapsed, estimate, time-target
  const barRows = [];

  // Bar 1: session elapsed (wraps at 60 min)
  const elapsed60Fill = (elapsedSecs % 3600) / 3600;
  const elapsed60Label = stopwatchLabel || fmtDur(elapsedSecs);
  barRows.push({
    label:'Elapsed', sublabel: elapsed60Label,
    fill: elapsed60Fill, color: ring1Color,
    active: true,
    hint: timerRunning ? 'Running' : 'Session'
  });

  // Bar 2: vs estimate
  if(ring2Active){
    barRows.push({
      label:'vs Estimate', sublabel:`${fmtDur(totalTrackedSecs)} / ${estMins}m`,
      fill: ring2Fill, color: ring2Color,
      active: true,
      hint: ring2Fill>=1 ? 'Over estimate' : `${Math.round((1-ring2Fill)*estMins)}m left`
    });
  }

  // Bar 3: time-of-day target
  if(ring3Active){
    const tgtMinsLeft = (()=>{const[th2,tm2]=ring3Label.split(':').map(Number);return th2*60+tm2-nowMins;})();
    barRows.push({
      label:'To target', sublabel: ring3Label,
      fill: ring3Fill, color: ring3Color,
      active: true,
      hint: tgtMinsLeft>0 ? `${tgtMinsLeft}m left` : 'Past target'
    });
  }

  // Clock line for bar layout (compact HH:MM:SS)
  const barClockHtml=`
    <div style="display:flex;align-items:baseline;gap:4px;margin-bottom:12px;">
      <span id="svg-clock-hhmm" style="font-family:'DM Mono',monospace;font-size:32px;font-weight:700;color:${T.text};letter-spacing:.03em;">${clockHH}:${clockMM}</span>
      <span id="svg-clock-ss"   style="font-family:'DM Mono',monospace;font-size:14px;font-weight:500;color:${T.muted};">${clockSS}</span>
    </div>`;

  const barLayoutHtml=`
    <div style="display:flex;flex-direction:column;gap:0;min-width:0;flex:1;justify-content:center;">
      ${barClockHtml}
      ${barRows.map(row=>`
        <div style="margin-bottom:10px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
            <span style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.muted};">${row.label}</span>
            <span style="font-family:'DM Mono',monospace;font-size:11px;color:${row.color};font-weight:600;">${row.sublabel}</span>
          </div>
          <div style="height:7px;border-radius:99px;background:${T.border};overflow:hidden;position:relative;">
            <div style="position:absolute;inset-y:0;left:0;width:${Math.round(Math.min(1,row.fill)*100)}%;background:${row.color};border-radius:99px;transition:width .9s linear;"></div>
          </div>
          <div style="font-size:9px;color:${T.muted2};margin-top:2px;text-align:right;">${row.hint}</div>
        </div>`).join('')}
      ${barRows.length===0?`<div style="font-size:12px;color:${T.muted2};font-style:italic;">No tracking data yet</div>`:''}
    </div>`;

  return {clockSvg,legendHtml,barLayoutHtml,barClockHtml,barRows};
}

function _renderTimerBar(focusTask,focusTotal,timerColor,clockSvg,legendHtml,barClockHtml,barRows){
  // ── Shared left controls column ──
  // Layout: [Controls | Task details | Timer visual]
  // btn helper — labeled pill button used throughout this column
  const ctrlBtn=(onclick,label,icon,active=false,extraStyle='')=>`
    <button onclick="${onclick}"
      style="display:flex;align-items:center;gap:6px;width:100%;padding:7px 10px;border-radius:8px;border:1.5px solid ${active?T.accent2:T.border};background:${active?T.accent2+'22':'transparent'};color:${active?T.accent2:T.muted};cursor:pointer;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;letter-spacing:.03em;transition:all .15s;text-align:left;${extraStyle}"
      onmouseover="this.style.background='${T.surface3}'" onmouseout="this.style.background='${active?T.accent2+'22':'transparent'}'">
      <i class="ti ${icon}" style="font-size:13px;flex-shrink:0;"></i>${label}
    </button>`;

  const controlsColHtml=`
    <div class="timer-controls-col" style="display:flex;flex-direction:column;gap:3px;padding:14px 12px;border-right:1px solid ${T.border};min-width:130px;">

      <!-- Mode toggle: Stopwatch / Countdown -->
      <div style="display:flex;gap:2px;margin-bottom:6px;background:${T.surface2};border-radius:8px;padding:2px;">
        <button onclick="setTimerMode('stopwatch')"
          style="flex:1;padding:4px 6px;border-radius:6px;border:none;cursor:pointer;font-family:'Syne',sans-serif;font-size:10px;font-weight:600;transition:all .15s;background:${timerMode==='stopwatch'?T.surface:T.surface2};color:${timerMode==='stopwatch'?T.accent2:T.muted};${timerMode==='stopwatch'?'box-shadow:0 1px 3px rgba(0,0,0,.1);':''}">
          <i class="ti ti-clock-play" style="font-size:11px;display:block;margin:0 auto 2px;"></i>Watch
        </button>
        <button onclick="setTimerMode('countdown')"
          style="flex:1;padding:4px 6px;border-radius:6px;border:none;cursor:pointer;font-family:'Syne',sans-serif;font-size:10px;font-weight:600;transition:all .15s;background:${timerMode==='countdown'?T.surface:T.surface2};color:${timerMode==='countdown'?T.pomo:T.muted};${timerMode==='countdown'?'box-shadow:0 1px 3px rgba(0,0,0,.1);':''}">
          <i class="ti ti-hourglass" style="font-size:11px;display:block;margin:0 auto 2px;"></i>Down
        </button>
      </div>

      <!-- Primary action -->
      <button onclick="toggleTimer()"
        style="display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:10px 12px;border-radius:10px;border:none;cursor:pointer;background:${timerColor};color:#fff;font-family:'Syne',sans-serif;font-size:13px;font-weight:800;letter-spacing:.04em;box-shadow:0 2px 10px ${timerColor}44;transition:transform .1s,box-shadow .2s;margin-bottom:6px;"
        onmousedown="this.style.transform='scale(.97)'" onmouseup="this.style.transform=''" onmouseleave="this.style.transform=''">
        <i class="ti ti-${timerRunning?'player-pause':'player-play'}" style="font-size:15px;"></i>
        ${timerRunning?'Pause':(timerMode==='countdown'?'Count':'Start')}
      </button>

      <!-- Compact countdown row -->
      <div style="display:flex;align-items:center;gap:4px;padding:2px 2px 4px;" title="Start a countdown instead" data-no-clobber="true">
        <i class="ti ti-hourglass" style="font-size:11px;color:${timerMode==='countdown'&&timerRunning?T.pomo:T.muted2};flex-shrink:0;"></i>
        <input type="number" min="1" max="240" value="${timerCountdownMins}"
          onchange="setCountdownMins(this.value)"
          onclick="event.stopPropagation()"
          style="${inputStyle('width:44px;text-align:center;font-family:DM Mono,monospace;padding:2px 4px;font-size:11px;')}"/>
        <span style="font-size:10px;color:${T.muted2};flex-shrink:0;">m</span>
        <button onclick="startCountdown()" title="Start countdown"
          style="flex:1;padding:3px 4px;border-radius:6px;border:1px solid ${timerMode==='countdown'&&timerRunning?T.pomo:T.border};background:${timerMode==='countdown'&&timerRunning?T.pomo+'22':'transparent'};color:${timerMode==='countdown'&&timerRunning?T.pomo:T.muted};font-size:10px;font-weight:700;cursor:pointer;font-family:'Syne',sans-serif;transition:background .1s;white-space:nowrap;"
          onmouseover="this.style.background='${T.surface3}'" onmouseout="this.style.background='${timerMode==='countdown'&&timerRunning?T.pomo+'22':'transparent'}'">
          ${timerMode==='countdown'&&timerRunning?'⏱ …':'⏱ go'}
        </button>
      </div>

      <!-- Divider -->
      <div style="height:1px;background:${T.border};margin:4px 0;"></div>

      ${ctrlBtn('stopAndSaveTimer(false)','Save &amp; log','ti-device-floppy')}
      ${focusTask?ctrlBtn('doneFocus()','Mark done','ti-check',false,'color:'+T.green+';border-color:'+T.green+';'):''}
      ${ctrlBtn('resetTimer()','Reset','ti-refresh')}
      ${ctrlBtn(`openQuickLog(null,0,Date.now())`,'Manual log','ti-pencil')}

      <!-- Divider -->
      <div style="height:1px;background:${T.border};margin:4px 0;"></div>

      <!-- Layout toggle -->
      ${ctrlBtn('toggleTimerLayout()',timerLayout==='rings'?'Bar view':'Ring view',timerLayout==='rings'?'ti-layout-rows':'ti-circle')}
    </div>`;

  // ── Task details column (centre) ──
  const taskInfoColHtml=`
    <div class="timer-task-col" style="padding:16px 20px;display:flex;flex-direction:column;justify-content:center;gap:8px;min-width:0;">
      ${focusTask
        ?`<div>
            <div style="font-size:17px;font-weight:800;color:${T.text};line-height:1.3;word-break:break-word;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${esc(focusTask.text)}</div>
            ${focusTask.catId?(()=>{const cat=getCat(focusTask.catId);return cat?`<div style="display:flex;align-items:center;gap:5px;margin-top:4px;"><span style="width:7px;height:7px;border-radius:50%;background:${cat.color.dot};display:inline-block;flex-shrink:0;"></span><span style="font-size:11px;color:${T.muted2};font-weight:600;">${esc(cat.name)}</span></div>`:'';})():''}
          </div>`
        :`<div style="font-size:13px;color:${T.muted2};font-style:italic;line-height:1.6;">No task selected.<br>Pick a card below to start.</div>`}
      ${focusTask?`
        <div style="display:flex;flex-direction:column;gap:4px;">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:${timerRunning?timerColor:T.muted};">${fmtDur(focusTotal)}</span>
            <span style="font-size:10px;color:${T.muted2};">${getSessionsForTask(focusTask.id).length} session${getSessionsForTask(focusTask.id).length===1?'':'s'}</span>
          </div>
          ${focusTask.estimatedMins||focusTask.ts?`<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            ${focusTask.estimatedMins?`<span style="font-size:10px;color:${T.muted2};">~${focusTask.estimatedMins}m estimated</span>`:''}
            ${focusTask.ts?`<span style="font-family:'DM Mono',monospace;font-size:10px;color:${T.muted2};">⏰ ${focusTask.ts}</span>`:''}
          </div>`:''}
        </div>`:''}
    </div>`;

  // ── Timer bar — layout-conditional ──
  const timerBar = timerLayout==='rings' ? `
    <div class="timer-bar-grid" style="display:grid;grid-template-columns:auto 1fr auto;align-items:stretch;gap:0;padding:0;background:${T.surface2};border:1.5px solid ${timerRunning?timerColor:T.border};border-radius:16px;margin-bottom:12px;transition:border-color .3s,box-shadow .3s;overflow:hidden;${timerRunning?`box-shadow:0 0 0 3px ${timerColor}22;`:''}">
      ${controlsColHtml}
      ${taskInfoColHtml}
      <!-- Drag handle + resizable clock column -->
      <div style="display:flex;align-items:stretch;flex-shrink:0;">
        <!-- Drag handle — the dividing line itself -->
        <div class="timer-drag-handle" id="clock-drag-handle"
          style="width:6px;cursor:col-resize;background:transparent;border-left:1.5px solid ${T.border};flex-shrink:0;transition:background .15s;position:relative;display:flex;align-items:center;justify-content:center;"
          onmouseover="this.style.background='${T.border}';this.querySelector('.drag-dots').style.opacity='1'"
          onmouseout="this.style.background='transparent';this.querySelector('.drag-dots').style.opacity='0.3'"
          onmousedown="startClockResize(event)">
          <div class="drag-dots" style="opacity:0.3;transition:opacity .15s;display:flex;flex-direction:column;gap:3px;pointer-events:none;">
            <div style="width:3px;height:3px;border-radius:50%;background:${T.muted2};"></div>
            <div style="width:3px;height:3px;border-radius:50%;background:${T.muted2};"></div>
            <div style="width:3px;height:3px;border-radius:50%;background:${T.muted2};"></div>
          </div>
        </div>
        <!-- Clock column — width driven by clockColWidth state -->
        <div class="timer-clock-col" id="clock-col"
          style="width:${clockColWidth}px;min-width:120px;max-width:420px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 10px;gap:4px;overflow:hidden;">
          ${clockSvg}
          ${legendHtml}
        </div>
      </div>
    </div>`
  : `
    <div class="timer-bar-grid" style="display:grid;grid-template-columns:auto 1fr;align-items:stretch;gap:0;padding:0;background:${T.surface2};border:1.5px solid ${timerRunning?timerColor:T.border};border-radius:16px;margin-bottom:12px;transition:border-color .3s,box-shadow .3s;overflow:hidden;${timerRunning?`box-shadow:0 0 0 3px ${timerColor}22;`:''}">
      ${controlsColHtml}
      <!-- Bars + task name: right section -->
      <div style="display:flex;flex-direction:column;min-width:0;">
        <!-- Task name -->
        <div style="padding:14px 20px 10px;border-bottom:1px solid ${T.border};">
          ${focusTask
            ?`<div style="font-size:15px;font-weight:800;color:${T.text};line-height:1.3;word-break:break-word;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;">${esc(focusTask.text)}</div>
              ${focusTask.catId?(()=>{const cat=getCat(focusTask.catId);return cat?`<div style="display:flex;align-items:center;gap:5px;margin-top:2px;"><span style="width:6px;height:6px;border-radius:50%;background:${cat.color.dot};display:inline-block;"></span><span style="font-size:10px;color:${T.muted2};">${esc(cat.name)}</span></div>`:'';})():''}`
            :`<span style="font-size:13px;color:${T.muted2};font-style:italic;">No task selected — pick a card below</span>`}
        </div>
        <!-- Progress bars -->
        <div style="padding:14px 20px 10px;flex:1;">
          ${barClockHtml}
          ${barRows.map(row=>`
            <div style="margin-bottom:12px;">
              <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4px;">
                <span style="font-size:10px;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:${T.muted};">${row.label}</span>
                <div style="display:flex;align-items:baseline;gap:6px;">
                  <span style="font-size:9px;color:${T.muted2};">${row.hint}</span>
                  <span style="font-family:'DM Mono',monospace;font-size:11px;color:${row.color};font-weight:700;">${row.sublabel}</span>
                </div>
              </div>
              <div style="height:8px;border-radius:99px;background:${T.border};overflow:hidden;position:relative;">
                <div style="position:absolute;inset-y:0;left:0;width:${Math.round(Math.min(1,row.fill)*100)}%;background:${row.color};border-radius:99px;transition:width .9s linear;"></div>
              </div>
            </div>`).join('')}
          ${barRows.length===0?`<div style="font-size:12px;color:${T.muted2};font-style:italic;">Start a task to see tracking bars</div>`:''}
        </div>
      </div>
    </div>`;

  return timerBar;
}

