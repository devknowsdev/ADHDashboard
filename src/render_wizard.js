/*
MODULE: render_wizard.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_wizard.js responsibilities
USES: local modules
STATE_READS: T, state, tasks
STATE_WRITES: addedTaskIds, b, body, c, captured, capturedRows, chipHtml, chipTasks, chips, class
PUBLIC_API: _renderWizStep_CalendarReview, _renderWizStep_CapacityCheck, _renderWizStep_CarryOver, _renderWizStep_Close, _renderWizStep_Commit, _renderWizStep_HowDidItGo, _renderWizStep_LastCapture, _renderWizStep_Priority, _renderWizStep_RapidCapture, _renderWizStep_Schedule, _renderWizStep_UntrackedDay, _renderWizUntrackedReview
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Day Wizard — render layer. Pure rendering only; state mutations live in
// actions_wizard.js. Not a widget — does NOT call registerWidget(). The
// wizard overlay and its two banners are wired directly into render.js's
// _doRender(), since they sit above/outside the normal widget grid.
//
// Depends on: state.js (dayWizardState, dayWizardOpen, wizCaptureInput,
//             wizCaptureList, wizShowAllCarryOver, dayEndHour, tasks,
//             plannerDayDumps, dailyIntentions, energyLog, energyPending,
//             timeSessions), core.js (cardStyle, btnStyle, inputStyle,
//             labelStyle, fmtDur), helpers.js (esc, getTask, getCat,
//             dateToYMD), actions_wizard.js (all wiz* functions, plus
//             _wizUntrackedDay/_wizFreeBlocks which live there too).
//
// Date-format note (matches the bug actions_wizard.js's header already
// flags): energyLog/dailyIntentions key off Date.toDateString() — this file
// computes that once as `todayStr` and passes it to any helper that reads
// either of those. Everything else (tasks, plannerDayDumps, dayWizardState
// itself) keys off dateToYMD() — passed as `todayYmd`.
//
// Step indexing: each phase's visible step sequence is computed fresh on
// every render via _wizStepsFor(phase, todayYmd), rather than hardcoding
// step numbers. This keeps wizAdvanceStep/wizBackStep simple ++/-- on a
// flat integer while steps that are conditional on data (untracked day,
// priority already resolved) are transparently skipped — the index into
// the *computed* array is what matters, not the literal numbers named in
// the spec's per-step headings.

// ── Step sequence calculation ────────────────────────────────────────────────
// Returns an ordered array of step-keys for the given phase. dayWizardState.step
// is an index into this array. Recomputed every render so it always reflects
// current data (e.g. a task completing mid-wizard shouldn't desync indices).
function _wizStepsFor(phase,todayYmd){
  if(phase==='start'){
    return ['capacity','calendar','capture','schedule','commit'];
  }
  if(phase==='end'){
    const steps=[];
    if(_wizUntrackedDay(todayYmd))steps.push('untracked');
    steps.push('howdidit');
    const priority=(dailyIntentions.answers.oneWin||'').trim();
    if(priority&&!dailyIntentions.winOutcome)steps.push('priority');
    steps.push('carryover','lastcapture','close');
    return steps;
  }
  return [];
}

// ── Shared chrome ─────────────────────────────────────────────────────────────
function _wizProgressDots(steps,stepIdx){
  return steps.map((_,i)=>`
    <div style="width:${i===stepIdx?16:7}px;height:7px;border-radius:4px;
      background:${i<stepIdx?T.accent:i===stepIdx?T.accent2:T.border};
      transition:all .2s;"></div>
  `).join('');
}

function _wizShell(innerHtml,opts){
  const {showBack=false,phase}=opts||{};
  const closeFn=phase==='start'?'wizCompleteStart':'wizCompleteEnd';
  return `
  <div style="position:fixed;inset:0;z-index:2000;background:${T.bg};
              overflow-y:auto;display:flex;align-items:flex-start;
              justify-content:center;padding:24px 16px;box-sizing:border-box;">
    <div style="width:100%;max-width:480px;">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div style="display:flex;align-items:center;gap:7px;">
          <i class="ti ti-${phase==='start'?'sun':'moon'}" style="color:${phase==='start'?T.accent:T.accent2};font-size:16px;"></i>
          <span style="font-size:13px;font-weight:700;color:${T.text};">
            ${phase==='start'?'Plan your day':'Day End Debrief'}
          </span>
        </div>
        <button onclick="${closeFn}()" title="Close — you can pick this up later"
          style="${btnStyle('default','padding:5px 9px;font-size:13px;')}">
          <i class="ti ti-x"></i>
        </button>
      </div>
      <div style="${cardStyle()}">
        ${innerHtml}
      </div>
      ${showBack?`
        <div style="margin-top:10px;display:flex;justify-content:flex-start;">
          <button onclick="wizBackStep()" style="${btnStyle('default','font-size:11px;padding:4px 10px;')}">
            <i class="ti ti-arrow-left"></i> back
          </button>
        </div>`:''}
    </div>
  </div>`;
}

// ── Main entry point ──────────────────────────────────────────────────────────
function renderDayWizard(todayYmd,now){
  const phase=dayWizardState.phase;
  if(phase!=='start'&&phase!=='end')return '';
  const todayStr=now.toDateString();

  if(phase==='end'&&wizReviewMode){
    return _wizShell(_renderWizUntrackedReview(todayYmd),{showBack:false,phase});
  }

  const steps=_wizStepsFor(phase,todayYmd);
  const stepIdx=Math.min(dayWizardState.step,steps.length-1);
  const stepKey=steps[stepIdx];

  const renderers={
    capacity:_renderWizStep_CapacityCheck,
    calendar:_renderWizStep_CalendarReview,
    capture:_renderWizStep_RapidCapture,
    schedule:_renderWizStep_Schedule,
    commit:_renderWizStep_Commit,
    untracked:_renderWizStep_UntrackedDay,
    howdidit:_renderWizStep_HowDidItGo,
    priority:_renderWizStep_Priority,
    carryover:_renderWizStep_CarryOver,
    lastcapture:_renderWizStep_LastCapture,
    close:_renderWizStep_Close,
  };
  const renderFn=renderers[stepKey];
  if(!renderFn)return '';

  const body=renderFn(todayYmd,todayStr,now);
  const dots=`<div style="display:flex;gap:3px;align-items:center;justify-content:center;margin-bottom:12px;">${_wizProgressDots(steps,stepIdx)}</div>`;
  return _wizShell(dots+body,{showBack:stepIdx>0,phase});
}

// ── Step 0 (start) — Capacity check ──────────────────────────────────────────
function _renderWizStep_CapacityCheck(todayYmd,todayStr,now){
  const existing=getEnergyToday(todayStr);
  const levels=[{v:1,icon:'💤',label:'Low'},{v:2,icon:'🌙',label:'Lo-mid'},{v:3,icon:'☀️',label:'Mid'},{v:4,icon:'🔥',label:'High'},{v:5,icon:'⚡',label:'Peak'}];

  if(existing&&energyPending.energy==null){
    // Already logged today — show it, offer to update or just continue.
    const lvl=levels.find(l=>l.v===existing.energy);
    return `
      <div style="text-align:center;padding:6px 0 4px;">
        <div style="font-size:34px;line-height:1;margin-bottom:6px;">${lvl?lvl.icon:''}</div>
        <div style="font-size:13px;color:${T.text};margin-bottom:2px;">
          Energy already logged today: <strong>${lvl?lvl.label:existing.energy}</strong>
        </div>
        <div style="font-size:11px;color:${T.muted};margin-bottom:14px;">You can update it or just move on.</div>
        <div style="display:flex;gap:8px;justify-content:center;">
          <button onclick="energyPending={energy:${existing.energy},sensory:${JSON.stringify(existing.sensory||null)},tag:${JSON.stringify(existing.tag||'')}};render()"
            style="${btnStyle('default','font-size:12px;padding:6px 14px;')}">Update</button>
          <button onclick="wizAdvanceStep()" style="${btnStyle('accent','font-size:12px;padding:6px 16px;')}">
            Continue <i class="ti ti-arrow-right"></i>
          </button>
        </div>
      </div>`;
  }

  const cur=energyPending.energy!=null?energyPending:{energy:null,sensory:null,tag:''};
  const energyBtns=levels.map(l=>`
    <button onclick="setEnergyPending('energy',${l.v})" title="${l.label}"
      style="${btnStyle(cur.energy===l.v?'accent':'default','flex:1;flex-direction:column;align-items:center;gap:1px;font-size:18px;padding:8px 2px;border-radius:10px;line-height:1;')}">
      ${l.icon}<div style="font-size:9px;margin-top:3px;white-space:nowrap;">${l.label}</div>
    </button>`).join('');

  return `
    <div style="font-size:14px;font-weight:700;color:${T.text};margin-bottom:10px;text-align:center;">
      How's your capacity right now?
    </div>
    <div style="display:flex;gap:4px;margin-bottom:14px;">${energyBtns}</div>
    <div style="display:flex;justify-content:center;">
      <button onclick="wizConfirmEnergyAndAdvance('${todayStr}')"
        style="${btnStyle('accent','font-size:12px;padding:6px 18px;')}">
        Continue <i class="ti ti-arrow-right"></i>
      </button>
    </div>`;
}

// ── Step 1 (start) — Calendar review ─────────────────────────────────────────
function _renderWizStep_CalendarReview(todayYmd){
  const scheduled=tasks.filter(t=>t.ts&&t.status!=='done').sort((a,b)=>a.ts.localeCompare(b.ts));

  if(!scheduled.length){
    return `
      <div style="text-align:center;padding:10px 0;">
        <div style="font-size:13px;color:${T.text};margin-bottom:14px;">
          Nothing on the calendar yet — let's capture what needs to happen today.
        </div>
        <button onclick="wizAdvanceStep()" style="${btnStyle('accent','font-size:12px;padding:6px 18px;')}">
          Continue <i class="ti ti-arrow-right"></i>
        </button>
      </div>`;
  }

  const rows=scheduled.map(t=>`
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid ${T.border};">
      <span style="font-size:11px;color:${T.muted};font-family:'DM Mono',monospace;width:42px;flex-shrink:0;">${esc(t.ts)}</span>
      <span style="font-size:12px;color:${T.text};flex:1;">${esc(t.text)}</span>
    </div>`).join('');

  const freeBlocks=_wizFreeBlocks(todayYmd);
  const freeBlocksHtml=freeBlocks.length?`
    <div style="margin-top:8px;font-size:10px;color:${T.muted2};">
      Free time: ${freeBlocks.map(b=>`${_wizMinsToHHMM(b.start)}–${_wizMinsToHHMM(b.end)} (${b.mins}m)`).join(', ')}
    </div>`:'';

  return `
    <div style="font-size:13px;color:${T.text};margin-bottom:8px;">
      You've already got ${scheduled.length} thing${scheduled.length===1?'':'s'} planned.
    </div>
    <div style="max-height:200px;overflow-y:auto;margin-bottom:6px;">${rows}</div>
    ${freeBlocksHtml}
    <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;">
      <button onclick="wizSkipToSchedule()" style="${btnStyle('default','font-size:12px;padding:6px 14px;')}">
        Looks good, skip to commit
      </button>
      <button onclick="wizAdvanceStep()" style="${btnStyle('accent','font-size:12px;padding:6px 14px;')}">
        Add more
      </button>
    </div>`;
}

function _wizMinsToHHMM(mins){
  const h=Math.floor(mins/60),m=mins%60;
  return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0');
}

// ── Step 2 (start) / Step 4 (end) — Rapid capture ────────────────────────────
function _renderWizStep_RapidCapture(todayYmd){
  const existing=getEnergyToday(new Date().toDateString());
  const energy=energyPending.energy!=null?energyPending.energy:(existing?existing.energy:3);
  const prompt=energy<=2?"What's the ONE thing that has to happen today?"
    :energy===3?'What are the two or three things that matter most today?'
    :'What needs to happen today? Dump it all.';

  const captured=plannerDayDumps[todayYmd]||[];
  const capturedRows=captured.map(item=>`
    <div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:${T.surface2};
                border-radius:8px;margin-bottom:4px;">
      <span style="font-size:12px;color:${T.text};flex:1;">${esc(item.text)}</span>
      <button onclick="plannerDeleteDump('${todayYmd}',${item.id});render()"
        style="${btnStyle('default','font-size:10px;padding:2px 6px;')}"><i class="ti ti-x"></i></button>
    </div>`).join('');

  const suggestions=tasks.filter(t=>!t.ts&&t.status!=='done').slice(0,5);
  const suggestionRows=suggestions.length?`
    <div style="margin-top:10px;">
      <div style="font-size:10px;color:${T.muted2};margin-bottom:5px;">From your task list:</div>
      ${suggestions.map(t=>`
        <div style="display:flex;align-items:center;gap:6px;padding:4px 0;">
          <span style="font-size:12px;color:${T.muted};flex:1;">${esc(t.text)}</span>
          <button onclick="wizAddExistingTask(${t.id},'${todayYmd}')"
            style="${btnStyle('default','font-size:10px;padding:2px 8px;')}"><i class="ti ti-plus"></i></button>
        </div>`).join('')}
    </div>`:'';

  return `
    <div style="font-size:13px;font-weight:700;color:${T.text};margin-bottom:10px;">${prompt}</div>
    <div style="display:flex;gap:6px;margin-bottom:8px;">
      <input id="wiz-capture-input" type="text" value="${esc(wizCaptureInput)}"
        placeholder="Type and press Enter…" data-no-clobber="true"
        oninput="wizCaptureInput=this.value;"
        onkeydown="if(event.key==='Enter'){wizAddCapture('${todayYmd}');event.preventDefault();}"
        style="${inputStyle('flex:1;')}"/>
      <button onclick="wizAddCapture('${todayYmd}')" style="${btnStyle('accent','font-size:12px;padding:7px 12px;')}">
        <i class="ti ti-plus"></i>
      </button>
    </div>
    ${capturedRows}
    ${suggestionRows}
    <div style="display:flex;gap:8px;justify-content:center;margin-top:14px;">
      <button onclick="wizAdvanceStep()" style="${btnStyle('default','font-size:12px;padding:6px 14px;')}">Skip</button>
      <button onclick="wizAdvanceStep()" style="${btnStyle('accent','font-size:12px;padding:6px 16px;')}">
        Done capturing <i class="ti ti-arrow-right"></i>
      </button>
    </div>`;
}

// ── Step 3 (start) — Schedule ─────────────────────────────────────────────────
function _renderWizStep_Schedule(todayYmd){
  const dumps=(plannerDayDumps[todayYmd]||[]).filter(d=>!d.done);
  const addedTaskIds=wizCaptureList.filter(c=>c.taskId).map(c=>c.taskId);
  const chipTasks=tasks.filter(t=>!t.ts&&addedTaskIds.includes(t.id));

  const slots=[
    {label:'Morning',time:'09:00'},
    {label:'Midday',time:'12:00'},
    {label:'Afternoon',time:'14:00'},
    {label:'Evening',time:'16:00'},
  ];

  const chipHtml=(kind,id,text)=>`
    <div style="padding:8px;background:${T.surface2};border-radius:10px;margin-bottom:8px;">
      <div style="font-size:12px;color:${T.text};margin-bottom:6px;">${esc(text)}</div>
      <div style="display:flex;gap:5px;flex-wrap:wrap;">
        ${slots.map(s=>`<button onclick="wizScheduleCapture('${kind}',${id},'${todayYmd}','${s.time}')"
          style="${btnStyle('default','font-size:10px;padding:3px 9px;border-radius:999px;')}">${s.label}</button>`).join('')}
        <input type="time" onchange="if(this.value)wizScheduleCapture('${kind}',${id},'${todayYmd}',this.value)"
          style="${selectStyle('font-size:10px;padding:3px 6px;width:90px;')}"/>
      </div>
    </div>`;

  const chips=[
    ...dumps.map(d=>chipHtml('dump',d.id,d.text)),
    ...chipTasks.map(t=>chipHtml('task',t.id,t.text)),
  ].join('');

  const freeBlocks=_wizFreeBlocks(todayYmd);
  const hintHtml=freeBlocks.length?`
    <div style="font-size:10px;color:${T.muted2};margin-bottom:10px;">
      ${freeBlocks.map(b=>`Free ${b.mins}m at ${_wizMinsToHHMM(b.start)} — good slot for deep work?`).join(' ')}
    </div>`:'';

  return `
    <div style="font-size:13px;font-weight:700;color:${T.text};margin-bottom:10px;">Want to put times on these?</div>
    ${hintHtml}
    ${chips||`<div style="font-size:12px;color:${T.muted2};margin-bottom:10px;">Nothing to schedule.</div>`}
    <div style="display:flex;justify-content:center;margin-top:10px;">
      <button onclick="wizAdvanceStep()" style="${btnStyle('accent','font-size:12px;padding:6px 16px;')}">
        I'll figure it out as I go <i class="ti ti-arrow-right"></i>
      </button>
    </div>`;
}

// ── Step 4 (start) — Commit ───────────────────────────────────────────────────
function _renderWizStep_Commit(todayYmd,todayStr){
  const existing=(dailyIntentions.answers.oneWin||'').trim();
  const scheduledCount=tasks.filter(t=>t.ts&&t.status!=='done').length;
  const existingEnergy=getEnergyToday(todayStr);
  const lvl=existingEnergy?{1:'💤',2:'🌙',3:'☀️',4:'🔥',5:'⚡'}[existingEnergy.energy]:'';

  const priorityHtml=existing?`
    <div style="padding:10px;background:${T.surface2};border-radius:10px;margin-bottom:12px;">
      <div style="font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${T.muted};margin-bottom:4px;">
        Today's priority
      </div>
      <div style="font-size:13px;color:${T.text};">${esc(existing)}</div>
    </div>`:`
    <div style="margin-bottom:12px;">
      <div style="font-size:12px;color:${T.text};margin-bottom:6px;">
        What's the one thing that would make today a success?
      </div>
      <input id="wiz-priority-input" type="text" placeholder="…" data-no-clobber="true"
        style="${inputStyle('')}"/>
    </div>`;

  return `
    <div style="text-align:center;margin-bottom:10px;">
      <div style="font-size:15px;font-weight:700;color:${T.text};">You're set. ${lvl}</div>
      <div style="font-size:11px;color:${T.muted};margin-top:2px;">
        ${scheduledCount} thing${scheduledCount===1?'':'s'} scheduled
      </div>
    </div>
    ${priorityHtml}
    <div style="display:flex;justify-content:center;">
      <button onclick="wizSubmitCommit('${todayStr}')" style="${btnStyle('accent','font-size:13px;padding:7px 20px;')}">
        Start my day <i class="ti ti-arrow-right"></i>
      </button>
    </div>`;
}

// ── Step 0 (end, conditional) — Untracked day ────────────────────────────────
function _renderWizStep_UntrackedDay(todayYmd){
  const scheduled=tasks.filter(t=>{
    if(!t.ts||t.status==='done')return false;
    const [h,m]=t.ts.split(':').map(Number);
    const endMins=h*60+m+(t.durationMins||30);
    const nowMins=new Date().getHours()*60+new Date().getMinutes();
    return endMins<nowMins;
  });

  const rows=scheduled.map(t=>`
    <div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid ${T.border};">
      <span style="font-size:11px;color:${T.muted};font-family:'DM Mono',monospace;width:42px;flex-shrink:0;">${esc(t.ts)}</span>
      <span style="font-size:12px;color:${T.text};flex:1;">${esc(t.text)}</span>
    </div>`).join('');

  return `
    <div style="font-size:13px;color:${T.text};margin-bottom:10px;">
      You had ${scheduled.length} things scheduled today but nothing was tracked. How did it go?
    </div>
    <div style="max-height:180px;overflow-y:auto;margin-bottom:12px;">${rows}</div>
    <div style="display:flex;flex-direction:column;gap:6px;">
      <button onclick="wizBulkLogScheduled('${todayYmd}');wizAdvanceStep()"
        style="${btnStyle('accent','font-size:12px;padding:7px;')}">Mostly to plan</button>
      <button onclick="_wizEnterReview()" style="${btnStyle('default','font-size:12px;padding:7px;')}">It went differently</button>
      <button onclick="wizAdvanceStep()" style="${btnStyle('default','font-size:12px;padding:7px;')}">I'll log it myself</button>
    </div>`;
}

// ── Step 1 (end) — How did it go ─────────────────────────────────────────────
function _renderWizStep_HowDidItGo(){
  return `
    <div style="font-size:13px;font-weight:700;color:${T.text};margin-bottom:10px;">
      One word or phrase — how was today?
    </div>
    <input id="wiz-reflect-input" type="text" placeholder="…" data-no-clobber="true"
      style="${inputStyle('margin-bottom:12px;')}"/>
    <div style="display:flex;gap:8px;justify-content:center;">
      <button onclick="wizAdvanceStep()" style="${btnStyle('default','font-size:12px;padding:6px 14px;')}">Skip</button>
      <button onclick="const el=document.getElementById('wiz-reflect-input');if(el)wizAddReflection(el.value);wizAdvanceStep()"
        style="${btnStyle('accent','font-size:12px;padding:6px 16px;')}">
        Continue <i class="ti ti-arrow-right"></i>
      </button>
    </div>`;
}

// ── Step 2 (end, conditional) — Priority outcome ─────────────────────────────
function _renderWizStep_Priority(){
  const priority=(dailyIntentions.answers.oneWin||'').trim();
  return `
    <div style="font-size:12px;color:${T.muted};margin-bottom:6px;">Did your priority happen?</div>
    <div style="padding:10px;background:${T.surface2};border-radius:10px;margin-bottom:14px;">
      <div style="font-size:13px;color:${T.text};">${esc(priority)}</div>
    </div>
    <div style="display:flex;gap:6px;justify-content:center;">
      <button onclick="setWinOutcome('yes');wizAdvanceStep()" style="${btnStyle('default','font-size:12px;padding:6px 12px;')}">✓ Done</button>
      <button onclick="setWinOutcome('partial');wizAdvanceStep()" style="${btnStyle('default','font-size:12px;padding:6px 12px;')}">~ Partial</button>
      <button onclick="setWinOutcome('no');wizAdvanceStep()" style="${btnStyle('default','font-size:12px;padding:6px 12px;')}">✗ Not done</button>
    </div>`;
}

// ── Step 3 (end) — Carry-over ─────────────────────────────────────────────────
function _renderWizStep_CarryOver(){
  const incomplete=tasks.filter(t=>t.status!=='done');
  const showAll=wizShowAllCarryOver;
  const visible=showAll?incomplete:incomplete.slice(0,6);

  const rows=visible.map(t=>`
    <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid ${T.border};">
      <span style="font-size:12px;color:${T.text};flex:1;">${esc(t.text)}</span>
      <button onclick="wizMarkCarryOver(${t.id},'drop');render()" style="${btnStyle('danger','font-size:10px;padding:3px 8px;')}">Drop</button>
      <button onclick="wizMarkCarryOver(${t.id},'done');render()" style="${btnStyle('default','font-size:10px;padding:3px 8px;')}">Done</button>
    </div>`).join('');

  const showAllToggle=(!showAll&&incomplete.length>6)?`
    <button onclick="wizShowAllCarryOver=true;render()" style="${btnStyle('default','font-size:10px;padding:3px 10px;margin-top:6px;')}">
      Show all ${incomplete.length}
    </button>`:'';

  return `
    <div style="font-size:13px;font-weight:700;color:${T.text};margin-bottom:10px;">
      What's carrying forward to tomorrow?
    </div>
    ${incomplete.length?`<div style="max-height:240px;overflow-y:auto;">${rows}</div>${showAllToggle}`
      :`<div style="font-size:12px;color:${T.muted2};margin-bottom:10px;">Nothing incomplete — nice.</div>`}
    <div style="display:flex;justify-content:center;margin-top:14px;">
      <button onclick="wizAdvanceStep()" style="${btnStyle('accent','font-size:12px;padding:6px 16px;')}">
        All good <i class="ti ti-arrow-right"></i>
      </button>
    </div>`;
}

// ── Step 4 (end) — Last capture ───────────────────────────────────────────────
function _renderWizStep_LastCapture(todayYmd){
  return `
    <div style="font-size:13px;font-weight:700;color:${T.text};margin-bottom:10px;">
      Anything to get out of your head before you close?
    </div>
    ${_renderWizStep_RapidCapture(todayYmd)}`;
}

// ── Step 5 (end) — Close ──────────────────────────────────────────────────────
function _renderWizStep_Close(todayYmd,todayStr){
  const totalSecs=timeSessions
    .filter(s=>new Date(s.startedAt).toDateString()===todayStr)
    .reduce((sum,s)=>sum+(s.seconds||0),0);
  const doneToday=tasks.filter(t=>t.status==='done'&&t.doneDate===todayYmd).length;
  const existingEnergy=getEnergyToday(todayStr);
  const lvl=existingEnergy?{1:'💤',2:'🌙',3:'☀️',4:'🔥',5:'⚡'}[existingEnergy.energy]:'—';

  return `
    <div style="text-align:center;">
      <div style="font-size:15px;font-weight:700;color:${T.text};margin-bottom:14px;">Good work today.</div>
      <div style="display:flex;justify-content:space-around;margin-bottom:16px;">
        <div>
          <div style="font-size:18px;font-weight:700;color:${T.accent};">${fmtDur(totalSecs)}</div>
          <div style="font-size:10px;color:${T.muted2};">tracked</div>
        </div>
        <div>
          <div style="font-size:18px;font-weight:700;color:${T.accent};">${doneToday}</div>
          <div style="font-size:10px;color:${T.muted2};">completed</div>
        </div>
        <div>
          <div style="font-size:18px;line-height:1.2;">${lvl}</div>
          <div style="font-size:10px;color:${T.muted2};">energy</div>
        </div>
      </div>
      <button onclick="wizCompleteEnd()" style="${btnStyle('accent','font-size:13px;padding:7px 22px;')}">Close</button>
    </div>`;
}

// ── Untracked-day "it went differently" review flow ──────────────────────────
// Simpler than a full per-task wizard sub-state: reuses the existing task list
// rendering (closes the wizard step-by-step prompt and lets the person mark
// each task done/not via the same carry-over-style buttons), then returns to
// the wizard. Kept here rather than adding new persisted state for it.
function _wizEnterReview(){
  wizReviewMode=true;
  render();
}

function _renderWizUntrackedReview(todayYmd){
  const scheduled=tasks.filter(t=>t.ts&&t.status!=='done');
  const rows=scheduled.map(t=>`
    <div style="padding:8px 0;border-bottom:1px solid ${T.border};">
      <div style="font-size:12px;color:${T.text};margin-bottom:6px;">
        <span style="color:${T.muted};font-family:'DM Mono',monospace;">${esc(t.ts)}</span> ${esc(t.text)}
      </div>
      <div style="display:flex;gap:5px;">
        <button onclick="wizMarkCarryOver(${t.id},'done');render()" style="${btnStyle('default','font-size:10px;padding:3px 8px;')}">Done ✓</button>
        <button onclick="render()" style="${btnStyle('default','font-size:10px;padding:3px 8px;')}">Didn't happen ✗</button>
        <button onclick="openQuickLog(${t.id},0,Date.now())" style="${btnStyle('default','font-size:10px;padding:3px 8px;')}">Log time</button>
      </div>
    </div>`).join('');
  return `
    <div style="font-size:13px;font-weight:700;color:${T.text};margin-bottom:10px;">Review today's schedule</div>
    <div style="max-height:260px;overflow-y:auto;margin-bottom:12px;">${rows}</div>
    <div style="display:flex;justify-content:center;">
      <button onclick="wizReviewMode=false;wizAdvanceStep()" style="${btnStyle('accent','font-size:12px;padding:6px 16px;')}">
        Done reviewing <i class="ti ti-arrow-right"></i>
      </button>
    </div>`;
}

// ── Banners ───────────────────────────────────────────────────────────────────
// Rendered at the very top of the page, above the widget grid, before the
// floating timer bar. Returns '' (no banner) whenever the wizard overlay
// itself is open, or when nothing currently qualifies.
function _renderWizardBanner(todayYmd,now){
  if(dayWizardOpen)return '';
  const dismissedAt=dayWizardState.wizBannerDismissedAt||0;
  const dismissedRecently=(Date.now()-dismissedAt)<2*60*60*1000;

  if(!dayWizardState.startDone&&!dismissedRecently){
    return `
    <div style="background:${T.accent}11;border-bottom:1px solid ${T.accent}33;
                padding:8px 16px;display:flex;align-items:center;gap:10px;margin:-12px -12px 10px -12px;">
      <i class="ti ti-sun" style="color:${T.accent};"></i>
      <span style="font-size:13px;color:${T.text};flex:1;">Ready to plan your day?</span>
      <button onclick="openDayWizard('start')" style="${btnStyle('accent','font-size:12px;padding:4px 12px;')}">Plan my day</button>
      <button onclick="dismissWizardBanner()" style="${btnStyle('default','font-size:11px;padding:4px 8px;')}">Later</button>
    </div>`;
  }

  const hour=now.getHours();
  if(!dayWizardState.endDone&&hour>=dayEndHour&&!dismissedRecently){
    return `
    <div style="background:${T.accent2}11;border-bottom:1px solid ${T.accent2}33;
                padding:8px 16px;display:flex;align-items:center;gap:10px;margin:-12px -12px 10px -12px;">
      <i class="ti ti-moon" style="color:${T.accent2};"></i>
      <span style="font-size:13px;color:${T.text};flex:1;">Time to wrap up?</span>
      <button onclick="openDayWizard('end')" style="${btnStyle('accent2','font-size:12px;padding:4px 12px;')}">End my day</button>
      <button onclick="dismissWizardBanner()" style="${btnStyle('default','font-size:11px;padding:4px 8px;')}">Later</button>
    </div>`;
  }
  return '';
}
