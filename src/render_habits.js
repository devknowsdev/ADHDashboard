/*
MODULE: render_habits.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_habits.js responsibilities
USES: local modules
STATE_READS: T, habits, tasks
STATE_WRITES: DAY_LABELS, a, anchor, anchored, c, cat, catOpts, class, clobber, count
PUBLIC_API: _renderHabitAddForm, habitRow, renderHabitsWidget, streakFor
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

function renderHabitsWidget(todayStr, now){
  if(!habits.length){
    return `
      <div style="color:${T.muted2};font-size:12px;padding:6px 0 10px;">No daily tasks yet. Add one below.</div>
      ${_renderHabitAddForm()}
    `;
  }

  // ── 7-day window: Mon–today (or last 7 days) ──────────────────────────────
  const DAY_LABELS=['Su','Mo','Tu','We','Th','Fr','Sa'];
  const days7=Array.from({length:7},(_,i)=>{
    const d=new Date(now);d.setDate(d.getDate()-(6-i));
    return {dateStr:d.toDateString(),label:DAY_LABELS[d.getDay()],isToday:i===6};
  });

  // ── Streak helper: consecutive days with ≥1 hit ending today ─────────────
  function streakFor(h){
    let count=0;
    for(let i=0;i<90;i++){
      const d=new Date(now);d.setDate(d.getDate()-i);
      const ds=d.toDateString();
      const hits=getAllHitsForHabit(h,ds);
      if(hits.length) count++;
      else break;
    }
    return count;
  }

  // ── Group habits by anchor ────────────────────────────────────────────────
  const anchored=HABIT_ANCHORS.map(a=>({
    anchor:a,
    habits:habits.filter(h=>h.anchor===a.id).sort((a,b)=>(a.anchorOrder||0)-(b.anchorOrder||0)),
  })).filter(g=>g.habits.length);
  const unanchored=habits.filter(h=>!h.anchor);

  // ── Render a single habit row ─────────────────────────────────────────────
  function habitRow(h){
    const todayHits=getAllHitsForHabit(h,todayStr);
    const doneToday=todayHits.length>0;
    const totalMinsToday=todayHits.reduce((s,x)=>s+(x.minutes||0),0);
    const streak=streakFor(h);
    const cat=getCat(h.catId);
    const isOpen=hitInputHabitId===h.id;

    // 7-day grid dots
    const gridDots=days7.map(day=>{
      const hits=getAllHitsForHabit(h,day.dateStr);
      const done=hits.length>0;
      const mins=hits.reduce((s,x)=>s+(x.minutes||0),0);
      return `<span title="${day.dateStr}${mins>0?' · '+mins+'m':''}"
        style="display:inline-flex;align-items:center;justify-content:center;width:${day.isToday?18:14}px;height:${day.isToday?18:14}px;border-radius:50%;
          background:${done?(cat?cat.color.dot:T.accent):T.border};
          border:${day.isToday?'2px solid '+T.border2:'1.5px solid transparent'};
          opacity:${done?1:0.3};flex-shrink:0;cursor:default;font-size:8px;color:#fff;font-weight:700;">
        ${done&&mins>0?''/* keep dot clean */:''}
      </span>`;
    }).join('');

    // Today's hit chips (manual only — task-derived shown as read-only)
    const manualHits=(h.hits||[]).filter(x=>new Date(x.timestamp).toDateString()===todayStr&&!x.migrated);
    const hitChips=manualHits.map(hit=>{
      const t=new Date(hit.timestamp);
      const tStr=String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0');
      const isEditing=editingHabitHitId&&editingHabitHitId.habitId===h.id&&editingHabitHitId.hitId===hit.id;
      if(isEditing){
        return `<span style="display:inline-flex;align-items:center;gap:3px;" onclick="event.stopPropagation()">
          <input type="time" value="${tStr}"
            onchange="saveHabitHitTime(${h.id},${hit.id},this.value)"
            onblur="editingHabitHitId=null;render()"
            style="${inputStyle('width:100px;font-size:10px;padding:2px 5px;display:inline-block;width:auto;')}"
            data-no-clobber="true"/>
        </span>`;
      }
      return `<span onclick="event.stopPropagation();startEditHabitHit(${h.id},${hit.id})"
        title="${hit.minutes>0?hit.minutes+'m · ':''}${tStr} — click to edit time"
        style="display:inline-flex;align-items:center;gap:3px;font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;cursor:pointer;
          background:${cat?cat.color.bg:T.surface2};color:${cat?cat.color.text:T.muted};
          border:1.5px solid ${cat?cat.color.dot+'55':T.border};">
        ${hit.minutes>0?`<span style="font-family:'DM Mono',monospace;">${hit.minutes}m</span>`:'✓'}
        <span style="opacity:0.6;font-size:9px;">${tStr}</span>
        <span onclick="event.stopPropagation();removeHabitHit(${h.id},${hit.id})"
          style="opacity:0.4;margin-left:1px;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.4">×</span>
      </span>`;
    }).join('');

    // Task-derived hit badge (read-only)
    const taskHits=getAllHitsForHabit(h,todayStr).filter(x=>x.synthetic);
    const taskBadge=taskHits.length?`<span title="Logged via task sessions" style="font-size:10px;padding:2px 8px;border-radius:20px;background:${T.surface3};color:${T.muted2};border:1px dashed ${T.border2};">
      <i class="ti ti-check" style="font-size:9px;"></i> task
    </span>`:'';

    // Hit input popover
    const popover=isOpen?`
      <div onclick="event.stopPropagation()" style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;padding:7px 10px;margin-top:6px;background:${T.surface3};border:1.5px solid ${T.border2};border-radius:10px;" data-no-clobber="true">
        <input type="time" value="${hitInputTime}"
          onchange="hitInputTime=this.value"
          style="${inputStyle('width:110px;font-size:12px;padding:4px 7px;display:inline-block;width:auto;')}"/>
        <div style="display:flex;align-items:center;gap:3px;">
          <button onclick="adjustHitMins(${h.id},-5)" style="${btnStyle('default','font-size:11px;padding:3px 7px;')}">−5m</button>
          <input id="hit-mins-num-${h.id}" type="number" min="0" max="480" value="${hitInputMins||''}"
            placeholder="0"
            oninput="setHitInputMins(${h.id},this.value)"
            style="${inputStyle('width:52px;text-align:center;font-size:12px;padding:4px 6px;font-family:DM Mono,monospace;display:inline-block;width:auto;')}"/>
          <span id="hit-mins-display-${h.id}" style="font-size:11px;color:${T.muted2};font-family:'DM Mono',monospace;min-width:26px;">${hitInputMins||0}m</span>
          <button onclick="adjustHitMins(${h.id},5)" style="${btnStyle('default','font-size:11px;padding:3px 7px;')}">+5m</button>
        </div>
        <button onclick="saveHabitHit(${h.id})" style="${btnStyle('accent','font-size:11px;padding:4px 10px;')}"><i class="ti ti-check"></i> Log</button>
        <button onclick="closeHitInput()" style="${btnStyle('default','font-size:11px;padding:4px 8px;')}"><i class="ti ti-x"></i></button>
      </div>`:'';

    return `<div style="padding:8px 6px;border-bottom:1.5px solid ${T.border};border-left:3px solid ${doneToday?(cat?cat.color.dot:T.accent):T.border};background:${T.surface};">
      <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
        <!-- Done indicator / log button -->
        <button onclick="openHitInput(${h.id})"
          title="${doneToday?'Log another hit':'Mark done for today'}"
          style="width:22px;height:22px;border-radius:50%;border:2px solid ${doneToday?(cat?cat.color.dot:T.green):T.border2};background:${doneToday?(cat?cat.color.dot:T.green):'transparent'};color:${doneToday?'#fff':T.muted2};cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:11px;flex-shrink:0;padding:0;transition:all .15s;">
          ${doneToday?'<i class="ti ti-check"></i>':'<i class="ti ti-plus"></i>'}
        </button>
        <!-- Name + cat -->
        <div style="flex:1;min-width:0;">
          <span style="font-size:13px;font-weight:700;color:${T.text};">${esc(h.name)}</span>
          ${cat?`<span style="font-size:10px;padding:1px 7px;border-radius:20px;font-weight:600;background:${cat.color.bg};color:${cat.color.text};margin-left:5px;">${esc(cat.name)}</span>`:''}
        </div>
        <!-- 7-day grid -->
        <div style="display:flex;align-items:center;gap:2px;flex-shrink:0;">${gridDots}</div>
        <!-- Streak -->
        ${streak>=2?`<span title="${streak}-day streak" style="font-size:10px;font-weight:700;font-family:'DM Mono',monospace;color:${streak>=7?T.green:streak>=3?T.accent2:T.muted};flex-shrink:0;">${streak}🔥</span>`:''}
        <!-- Total mins today -->
        ${totalMinsToday>0?`<span style="font-size:10px;font-family:'DM Mono',monospace;color:${T.muted};flex-shrink:0;">${totalMinsToday}m</span>`:''}
        <!-- Anchor picker (compact select) -->
        <select onchange="setHabitAnchor(${h.id},this.value)"
          title="Assign to a time anchor"
          style="${selectStyle('font-size:10px;padding:2px 5px;max-width:100px;border-radius:20px;')}">
          <option value="">— anchor</option>
          ${HABIT_ANCHORS.map(a=>`<option value="${a.id}" ${h.anchor===a.id?'selected':''}>${a.label}</option>`).join('')}
        </select>
        <!-- Delete -->
        <span onclick="deleteHabit(${h.id})" title="Delete habit"
          style="opacity:0.35;font-size:12px;color:${T.muted2};cursor:pointer;padding:0 3px;flex-shrink:0;"
          onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.35">
          <i class="ti ti-x"></i>
        </span>
      </div>
      <!-- Hit chips for today -->
      ${(hitChips||taskBadge)?`<div style="display:flex;gap:5px;flex-wrap:wrap;margin-top:5px;padding-left:29px;">${hitChips}${taskBadge}</div>`:''}
      ${popover}
    </div>`;
  }

  // ── Build sections ────────────────────────────────────────────────────────
  let sectionsHtml='';

  // Anchored groups
  anchored.forEach(g=>{
    const rows=g.habits.map(habitRow).join('');
    sectionsHtml+=`
      <div style="margin-bottom:6px;">
        <div style="display:flex;align-items:center;gap:6px;padding:5px 6px 3px;background:${T.surface3};border-radius:8px 8px 0 0;border:1px solid ${T.border};border-bottom:none;">
          <i class="ti ${g.anchor.icon}" style="font-size:12px;color:${T.muted2};"></i>
          <span style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${T.muted};">${g.anchor.label}</span>
          <span style="font-size:9px;color:${T.muted2};">${g.anchor.hint}</span>
        </div>
        <div style="border:1px solid ${T.border};border-top:none;border-radius:0 0 8px 8px;overflow:hidden;">${rows}</div>
      </div>`;
  });

  // Unanchored habits
  if(unanchored.length){
    const rows=unanchored.map(habitRow).join('');
    if(anchored.length){
      sectionsHtml+=`
        <div style="margin-bottom:6px;">
          <div style="font-size:10px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${T.muted};padding:4px 6px 3px;">Other</div>
          <div style="border:1px solid ${T.border};border-radius:8px;overflow:hidden;">${rows}</div>
        </div>`;
    } else {
      sectionsHtml+=`<div style="border:1px solid ${T.border};border-radius:8px;overflow:hidden;margin-bottom:6px;">${rows}</div>`;
    }
  }

  // ── Today's summary bar ───────────────────────────────────────────────────
  const doneCount=habits.filter(h=>getAllHitsForHabit(h,todayStr).length>0).length;
  const totalCount=habits.length;
  const pct=totalCount?Math.round(doneCount/totalCount*100):0;
  const summaryBar=`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;padding:8px 10px;background:${T.surface2};border:1.5px solid ${T.border};border-radius:10px;">
      <span style="font-size:12px;font-weight:700;color:${T.text};">${doneCount} / ${totalCount} today</span>
      <div style="flex:1;height:6px;border-radius:99px;background:${T.border};overflow:hidden;">
        <div style="height:100%;width:${pct}%;background:${pct===100?T.green:T.accent};border-radius:99px;transition:width .4s;"></div>
      </div>
      <span style="font-size:11px;font-family:'DM Mono',monospace;color:${pct===100?T.green:T.muted};">${pct}%</span>
    </div>`;

  return `${summaryBar}${sectionsHtml}${_renderHabitAddForm()}`;
}

function _renderHabitAddForm(){
  const catOpts=`<option value="">— no category</option>`+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  return `
    <div style="margin-top:10px;border-top:1.5px solid ${T.border};padding-top:10px;" data-no-clobber="true">
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <input id="habit-in" type="text" placeholder="New daily task… (Enter to add)"
          onkeydown="if(event.key==='Enter')addHabit()"
          style="${inputStyle('flex:1;min-width:160px;')}"/>
        <select id="habit-cat" style="${selectStyle('font-size:11px;padding:5px 8px;min-width:100px;')}">${catOpts}</select>
        <select id="habit-anchor-new" style="${selectStyle('font-size:11px;padding:5px 8px;min-width:110px;')}">
          <option value="">— no anchor</option>
          ${HABIT_ANCHORS.map(a=>`<option value="${a.id}">${a.label}</option>`).join('')}
        </select>
        <button onclick="addHabit()" style="${btnStyle('accent','font-size:11px;padding:6px 11px;')}"><i class="ti ti-plus"></i>Add</button>
      </div>
    </div>`;
}




registerWidget({
  id: 'habits',
  label: 'Daily Tasks',
  icon: 'ti-repeat',
  pinnable: true,
  collapsible: true,
  fullWidth: true,
  defaultVisible: true,
  render: renderHabitsWidget,
});
