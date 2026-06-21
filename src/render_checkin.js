/*
MODULE: render_checkin.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_checkin.js responsibilities
USES: local modules
STATE_READS: T, state
STATE_WRITES: class, clobber, col, cur, currentVal, d, date, dots, ds, e
PUBLIC_API: _renderIntentionsSection, renderCheckinWidget
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Daily Check-in widget — energy log + daily intentions (CBT/ADHD planning questions).
// Depends on: core.js (btnStyle, inputStyle, labelStyle), helpers.js (esc, getEnergyToday),
//             state.js (energyLog, energyPending, dailyIntentions, INTENTION_QUESTIONS),
//             core.js (ensureIntentionsToday, setEnergyPending, saveEnergyCheckin,
//                      advanceIntention, backIntention, resetIntentions, setWinOutcome)
// Registered in render.js widgetRenderMap under key 'checkin'.

function _renderIntentionsSection(step,answers,isDone,todayStr,now){
  let intentionsSection;

  if(isDone){
    const rows=INTENTION_QUESTIONS.map(q=>{
      const val=(answers[q.key]||'').trim();
      return `<div style="display:flex;gap:7px;align-items:flex-start;padding:5px 0;border-bottom:1px solid ${T.border};">
        <span style="font-size:12px;color:${T.accent2};flex-shrink:0;margin-top:2px;"><i class="ti ${q.icon}"></i></span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${T.muted};margin-bottom:1px;">${q.label}</div>
          <div style="font-size:11px;color:${T.text};line-height:1.4;word-break:break-word;">${esc(val)||`<span style="color:${T.muted2}">—</span>`}</div>
        </div>
      </div>`;
    }).join('');

    // Priority review — show after 13:00 or if already answered
    const hourNow=now.getHours();
    const priority=(answers.oneWin||'').trim();
    const outcome=dailyIntentions.winOutcome;
    const outcomeLabels={yes:'✓ done',partial:'~ partial',no:'✗ not done'};
    const outcomeColors={yes:T.green,partial:T.urg1,no:T.pomo};
    const winResolutionHtml=(priority&&(hourNow>=13||outcome))?`
      <div style="margin-top:8px;padding:8px 10px;background:${T.surface2};border:1px solid ${T.border};border-radius:10px;">
        <div style="font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${T.muted};margin-bottom:5px;"><i class="ti ti-target" style="margin-right:4px;"></i>did your priority happen?</div>
        <div style="font-size:11px;color:${T.muted};margin-bottom:7px;line-height:1.3;word-break:break-word;">${esc(priority)}</div>
        ${outcome?`
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:12px;font-weight:700;color:${outcomeColors[outcome]||T.muted};">${outcomeLabels[outcome]||outcome}</span>
            <button onclick="setWinOutcome(null)" style="${btnStyle('default','font-size:10px;padding:2px 8px;border-radius:20px;')}">change</button>
          </div>`
        :`<div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button onclick="setWinOutcome('yes')" style="${btnStyle('default','font-size:11px;padding:4px 11px;border-radius:999px;')}">✓ Done</button>
            <button onclick="setWinOutcome('partial')" style="${btnStyle('default','font-size:11px;padding:4px 11px;border-radius:999px;')}">~ Partial</button>
            <button onclick="setWinOutcome('no')" style="${btnStyle('default','font-size:11px;padding:4px 11px;border-radius:999px;')}">✗ Not done</button>
          </div>`}
      </div>`:'';

    intentionsSection=`
      <div style="margin-bottom:6px;">${rows}</div>
      ${winResolutionHtml}
      <button onclick="resetIntentions('${todayStr}')"
        style="${btnStyle('default','font-size:10px;padding:3px 10px;border-radius:20px;margin-top:8px;')}">
        <i class="ti ti-refresh"></i> reset
      </button>`;
  } else {
    const qi=typeof step==='number'?step:0;
    const q=INTENTION_QUESTIONS[qi];
    const currentVal=answers[q.key]||'';
    const dots=INTENTION_QUESTIONS.map((_,i)=>`
      <div style="width:${i===qi?16:7}px;height:7px;border-radius:4px;background:${i<qi?T.accent:i===qi?T.accent2:T.border};transition:all .2s;"></div>
    `).join('');
    const prevAnswers=INTENTION_QUESTIONS.slice(0,qi).map(pq=>`
      <div style="display:flex;gap:6px;align-items:baseline;padding:3px 0;opacity:0.7;">
        <span style="font-size:11px;color:${T.accent};flex-shrink:0;"><i class="ti ${pq.icon}"></i></span>
        <div style="font-size:11px;color:${T.muted};font-style:italic;word-break:break-word;line-height:1.3;">${esc(answers[pq.key])||'—'}</div>
      </div>`).join('');

    intentionsSection=`
      ${prevAnswers?`<div style="margin-bottom:8px;padding-bottom:8px;border-bottom:1px dashed ${T.border};">${prevAnswers}</div>`:''}
      <div style="background:${T.surface3};border:1.5px solid ${T.borderBlue||T.border};border-radius:12px;padding:12px;">
        <div style="display:flex;align-items:center;gap:7px;margin-bottom:4px;">
          <span style="font-size:15px;color:${T.accent2};"><i class="ti ${q.icon}"></i></span>
          <div style="font-size:13px;font-weight:800;color:${T.text};line-height:1.3;">${q.label}</div>
        </div>
        <div style="font-size:10px;color:${T.muted};margin-bottom:8px;line-height:1.5;">${q.hint}</div>
        <textarea
          id="intention-answer-input"
          rows="2"
          placeholder="${q.placeholder}"
          oninput="setIntentionAnswer('${q.key}',this.value)"
          onkeydown="if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){advanceIntention('${todayStr}');event.preventDefault();}"
          style="${inputStyle('resize:none;line-height:1.5;font-size:12px;')}"
          data-no-clobber="true"
        >${esc(currentVal)}</textarea>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px;">
          <div style="display:flex;gap:3px;align-items:center;">${dots}</div>
          <div style="display:flex;gap:5px;align-items:center;">
            <span style="font-size:9px;color:${T.muted2};">⌘↵</span>
            ${qi>0?`<button onclick="backIntention()" style="${btnStyle('default','font-size:11px;padding:4px 8px;')}"><i class="ti ti-arrow-left"></i></button>`:''}
            <button onclick="skipIntention('${todayStr}')" style="${btnStyle('default','font-size:11px;padding:4px 10px;')}">Skip</button>
            <button onclick="advanceIntention('${todayStr}')" style="${btnStyle('accent','font-size:11px;padding:4px 12px;')}">
              ${qi===INTENTION_QUESTIONS.length-1?'<i class="ti ti-check"></i> Done':'Next <i class="ti ti-arrow-right"></i>'}
            </button>
          </div>
        </div>
      </div>`;
  }

  return intentionsSection;
}

function renderCheckinWidget(todayStr,now){
  ensureIntentionsToday(todayStr);
  const existing=getEnergyToday(todayStr);
  const levels=[{v:1,icon:'💤',label:'Low'},{v:2,icon:'🌙',label:'Lo-mid'},{v:3,icon:'☀️',label:'Mid'},{v:4,icon:'🔥',label:'High'},{v:5,icon:'⚡',label:'Peak'}];
  const sensoryOpts=[{v:'calm',label:'Calm'},{v:'moderate',label:'Moderate'},{v:'overwhelmed',label:'Overwhelmed'}];
  const cur=energyPending.energy!=null?energyPending:(existing?{...existing}:{energy:null,sensory:null,tag:''});

  // ── Energy bar (compact single row) ──
  const energyBtns=levels.map(l=>`
    <button onclick="setEnergyPending('energy',${l.v})" title="${l.label}"
      style="${btnStyle(cur.energy===l.v?'accent':'default','flex:1;flex-direction:column;align-items:center;gap:1px;font-size:16px;padding:5px 2px;border-radius:8px;line-height:1;')}">
      ${l.icon}<div style="font-size:8px;margin-top:2px;white-space:nowrap;">${l.label}</div>
    </button>`).join('');

  // ── Sensory + tag + save (shown once energy is picked) ──
  const sensoryRow=cur.energy!=null?`
    <div style="display:flex;gap:4px;align-items:center;flex-wrap:wrap;margin-top:6px;" data-no-clobber="true">
      ${sensoryOpts.map(s=>`<button onclick="setEnergyPending('sensory','${s.v}')"
        style="${btnStyle(cur.sensory===s.v?'accent2':'default','font-size:10px;padding:3px 9px;border-radius:999px;')}">${s.label}</button>`).join('')}
      <input type="text" placeholder="tag…" maxlength="40" value="${esc(cur.tag||'')}"
        oninput="energyPending.tag=this.value;"
        style="${inputStyle('flex:1;min-width:80px;font-size:11px;padding:4px 8px;')}"/>
      <button onclick="saveEnergyCheckin('${todayStr}')"
        style="${btnStyle('accent','font-size:11px;padding:4px 10px;')}">
        ${existing?'Update':'Log'}
      </button>
    </div>`:
    `<div style="font-size:10px;color:${T.muted2};margin-top:5px;text-align:center;">Pick your energy level to log today's check-in</div>`;

  // ── 7-day spark strip ──
  const sparkDots=(()=>{
    const dots=[];
    for(let i=6;i>=0;i--){
      const d=new Date(now);d.setDate(d.getDate()-i);
      const ds=d.toDateString();
      const entry=energyLog.find(e=>e.date===ds);
      const energyColors=['','#64748b','#7c3aed','#0284c7','#16a34a','#ca8a04',T.urg3];
      const col=entry?energyColors[entry.energy]||T.border:T.border;
      const isToday=i===0;
      dots.push(`<span title="${d.toLocaleDateString()}: ${entry?'Energy '+entry.energy+'/5':'No entry'}"
        style="width:${isToday?14:10}px;height:${isToday?14:10}px;border-radius:50%;background:${col};display:inline-block;
               border:${isToday?'2px':'1.5px'} solid ${isToday?T.border2:T.border};flex-shrink:0;"></span>`);
    }
    return dots.join('');
  })();

  const energySection=`
    <div style="background:${T.surface2};border:1.5px solid ${T.border};border-radius:10px;padding:8px 10px;margin-bottom:10px;">
      <div style="display:flex;gap:3px;">${energyBtns}</div>
      ${sensoryRow}
      <div style="display:flex;align-items:center;gap:4px;margin-top:6px;padding-top:5px;border-top:1px solid ${T.border};">
        ${sparkDots}
        ${existing?`<span style="font-size:10px;color:${T.muted2};margin-left:auto;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:120px;">
          ${levels.find(l=>l.v===existing.energy)?.icon||''} ${existing.sensory||''}${existing.tag?' · '+esc(existing.tag):''}
        </span>`:''}
      </div>
    </div>`;

  const intentionsSection=_renderIntentionsSection(dailyIntentions.step,dailyIntentions.answers,dailyIntentions.step==='done',todayStr,now);

  const weeklyNudgeHtml=weeklyAiNudge?`
    <div style="padding:10px 12px;background:${T.surface2};border:1.5px solid ${T.borderBlue||T.border};border-radius:10px;margin-bottom:10px;display:flex;align-items:flex-start;gap:8px;">
      <span style="font-size:14px;flex-shrink:0;"><i class="ti ti-sparkles"></i></span>
      <div style="flex:1;font-size:12px;color:${T.text};line-height:1.5;">${esc(weeklyAiNudge)}</div>
      <button onclick="dismissWeeklyAiNudge()" style="${btnStyle('default','font-size:10px;padding:2px 6px;flex-shrink:0;')}"><i class="ti ti-x"></i></button>
    </div>`:'';

  return `
    ${weeklyNudgeHtml}
    <div style="${labelStyle()}"><i class="ti ti-heart-rate-monitor"></i>energy</div>
    ${energySection}
    <div style="${labelStyle()}"><i class="ti ti-clipboard-list"></i>daily plan</div>
    ${intentionsSection}
  `;
}

registerWidget({
  id: 'checkin',
  label: 'Daily Check-in',
  icon: 'ti-heart-rate-monitor',
  pinnable: true,
  collapsible: true,
  fullWidth: true,
  defaultVisible: true,
  render: renderCheckinWidget,
});
