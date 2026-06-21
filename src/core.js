/*
MODULE: core.js
LAYER: dispatcher/runtime
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: core.js responsibilities
USES: local modules
STATE_READS: T
STATE_WRITES: background, borderColor, boxShadow, c, cardTransition, class, collapsed, crisisMode, cutoff, dailyIntentions
PUBLIC_API: advanceIntention, backIntention, btnStyle, cardStyle, closeWidgetDrawer, dragEndWidget, dragOverWidget, dragStartWidget, dropWidget, ensureIntentionsToday, enterCrisisMode, exitCrisisMode
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

function getWidgetState(id){return widgetLayout.find(w=>w.id===id);}
function toggleWidgetCollapse(id){
  const w=getWidgetState(id);if(!w)return;
  w.collapsed=!w.collapsed;
  saveWidgetLayout();render();
}
function hideWidget(id){
  const def=getWidgetDef(id);
  if(!def||!def.pinnable)return;
  const w=getWidgetState(id);if(!w)return;
  w.visible=false;
  saveWidgetLayout();render();
}
function restoreWidget(id){
  const w=getWidgetState(id);if(!w)return;
  w.visible=true;w.collapsed=false;
  showWidgetDrawer=false;
  saveWidgetLayout();render();
}
function openWidgetDrawer(){showWidgetDrawer=true;render();}
function closeWidgetDrawer(){showWidgetDrawer=false;render();}

// Widget drag-and-drop
function dragStartWidget(e,id){e.dataTransfer.effectAllowed='move';dragSourceWidgetId=id;}
function dragOverWidget(e){e.preventDefault();e.dataTransfer.dropEffect='move';e.currentTarget.style.outline=`2px dashed ${T.accent2}`;}
function dropWidget(e,targetId){
  e.preventDefault();e.currentTarget.style.outline='';
  if(dragSourceWidgetId===targetId||dragSourceWidgetId==null)return;
  const src=getWidgetState(dragSourceWidgetId),tgt=getWidgetState(targetId);
  if(!src||!tgt)return;
  const tmp=src.order;src.order=tgt.order;tgt.order=tmp;
  saveWidgetLayout();render();dragSourceWidgetId=null;
}
function dragEndWidget(e){if(e&&e.currentTarget)e.currentTarget.style.outline='';dragSourceWidgetId=null;}

function renderWidgetChrome(id, def, collapsed, bodyHtml, extraButtons=''){
  const pinnable=def.pinnable;
  const fullWidth=def.fullWidth?'grid-column:1/-1;':'';
  const headerBtns=`
    <div style="display:flex;gap:4px;align-items:center;flex-shrink:0;">
      ${extraButtons}
      <button onclick="toggleWidgetCollapse('${id}')" title="${collapsed?'Expand':'Collapse'}" style="${btnStyle('default','font-size:11px;padding:3px 7px;')}"><i class="ti ti-chevron-${collapsed?'down':'up'}"></i></button>
      ${pinnable?`<button onclick="hideWidget('${id}')" title="Hide widget" style="${btnStyle('default','font-size:11px;padding:3px 7px;')}"><i class="ti ti-eye-off"></i></button>`:''}
      <span title="drag to reorder" style="cursor:grab;color:${T.muted2};font-size:14px;padding:0 2px;" draggable="true" ondragstart="dragStartWidget(event,'${id}')" ondragend="dragEndWidget(event)"><i class="ti ti-grip-horizontal"></i></span>
    </div>`;
  const hoverAttrs=def.noHover?''
    :`onmouseenter="const c=document.getElementById('wc-${id}');if(c){c.style.background='${T.blue}';c.style.borderColor='${T.borderBlue}';c.style.boxShadow='0 4px 20px rgba(0,0,0,.10)';}" onmouseleave="const c=document.getElementById('wc-${id}');if(c){c.style.background='${T.surface}';c.style.borderColor='${T.border}';c.style.boxShadow='';}"`
  ;
  const cardTransition=def.noHover?'':'transition:background .18s,border-color .18s,box-shadow .18s;';
  return `<div
    style="${fullWidth}"
    ${hoverAttrs}
    ondragover="dragOverWidget(event)" ondrop="dropWidget(event,'${id}')">
    <div id="wc-${id}" style="background:${T.surface};border:0.5px solid ${T.border};border-radius:14px;padding:14px;${cardTransition}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:${collapsed?'0':'10px'};border-bottom:0.5px solid ${T.border};margin:-14px -14px ${collapsed?'0':'10px'};padding:10px 14px;">
        <div style="font-size:13px;font-weight:500;color:${T.text};display:flex;align-items:center;gap:6px;"><i class="ti ${def.icon}" style="color:${T.muted};font-size:14px;"></i>${def.label}</div>
        ${headerBtns}
      </div>
      <div style="display:${collapsed?'none':'block'};">${bodyHtml}</div>
    </div>
  </div>`;
}

function renderWidgetDrawerHtml(){
  const hidden=widgetLayout.filter(w=>!w.visible);
  if(!hidden.length) return '';
  const rows=hidden.map(w=>{
    const def=getWidgetDef(w.id);if(!def)return '';
    return `<div style="display:flex;align-items:center;gap:10px;padding:9px 0;border-bottom:1.5px solid ${T.border};">
      <i class="ti ${def.icon}" style="color:${T.muted};font-size:16px;flex-shrink:0;"></i>
      <div style="flex:1;font-size:13px;font-weight:700;color:${T.text};">${def.label}</div>
      <button onclick="restoreWidget('${w.id}')" style="${btnStyle('accent','font-size:11px;padding:5px 10px;')}"><i class="ti ti-eye"></i> Show</button>
    </div>`;
  }).join('');
  return `<div onclick="if(event.target===this)closeWidgetDrawer()" style="position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:1000;display:flex;align-items:center;justify-content:center;padding:20px;">
    <div style="background:${T.surface};border:1.5px solid ${T.border2};border-radius:16px;padding:20px;width:100%;max-width:400px;box-sizing:border-box;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <span style="font-size:15px;font-weight:700;color:${T.text};">Hidden Widgets</span>
        <button onclick="closeWidgetDrawer()" style="${btnStyle('default','padding:5px 9px;font-size:14px;')}"><i class="ti ti-x"></i></button>
      </div>
      ${rows}
    </div>
  </div>`;
}

// ---- Energy check-in ----
function getEnergyToday(todayStr){return energyLog.find(e=>e.date===todayStr)||null;}
function setEnergyPending(field,val){energyPending[field]=val;render();}
function saveEnergyCheckin(todayStr){
  if(!energyPending.energy){showToast('Pick an energy level','warn');return;}
  const existing=energyLog.find(e=>e.date===todayStr);
  if(existing){
    existing.energy=energyPending.energy;
    existing.sensory=energyPending.sensory||null;
    existing.tag=(energyPending.tag||'').trim().split(/\s+/).slice(0,10).join(' ');
  }else{
    energyLog.push({date:todayStr,energy:energyPending.energy,sensory:energyPending.sensory||null,tag:(energyPending.tag||'').trim().split(/\s+/).slice(0,10).join(' ')});
  }
  // Prune to last 90 days
  const cutoff=Date.now()-90*24*60*60*1000;
  energyLog=energyLog.filter(e=>(new Date(e.date).getTime()||0)>=cutoff);
  energyPending={energy:null,sensory:null,tag:''};
  save();showToast('Check-in saved','ok');render();
}

// ---- Daily intentions (guided questions) ----
function ensureIntentionsToday(todayStr){
  if(dailyIntentions.date!==todayStr){
    dailyIntentions={date:todayStr,answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null};
  }
}
function setIntentionAnswer(key,val){
  dailyIntentions.answers[key]=val;
  // don't save on every keystroke — saved on advance/complete
}
function advanceIntention(todayStr){
  const q=INTENTION_QUESTIONS[dailyIntentions.step];
  if(!q) return;
  const val=(dailyIntentions.answers[q.key]||'').trim();
  if(!val){showToast('Write something — even a few words.','warn');return;}
  dailyIntentions.answers[q.key]=val;
  if(dailyIntentions.step>=INTENTION_QUESTIONS.length-1){
    dailyIntentions.step='done';
  } else {
    dailyIntentions.step++;
  }
  dailyIntentions.date=todayStr;
  save();render();
  if(dailyIntentions.step!=='done'){
    setTimeout(()=>{
      const el=document.getElementById('intention-answer-input');
      if(el){el.focus();}
    },60);
  }
}
function backIntention(){
  if(dailyIntentions.step==='done') dailyIntentions.step=INTENTION_QUESTIONS.length-1;
  else if(dailyIntentions.step>0) dailyIntentions.step--;
  save();render();
  setTimeout(()=>{const el=document.getElementById('intention-answer-input');if(el)el.focus();},60);
}
function resetIntentions(todayStr){
  dailyIntentions={date:todayStr,answers:{arriving:'',oneWin:'',derail:'',goodEnough:''},step:0,winOutcome:null};
  save();render();
  setTimeout(()=>{const el=document.getElementById('intention-answer-input');if(el)el.focus();},60);
}

function setWinOutcome(outcome){
  dailyIntentions.winOutcome=outcome;
  save();render();
  showToast('Outcome saved','ok');
}

// ---- Inline style helpers ----
function cardStyle(extra=''){
  return `background:${T.surface};border:0.5px solid ${T.border};border-radius:14px;padding:14px;${extra}`;
}
function inputStyle(extra=''){
  return `font-family:'Syne',sans-serif;font-size:13px;background:${T.inputBg};border:1px solid ${T.border2};border-radius:8px;padding:7px 10px;color:${T.inputText};width:100%;box-sizing:border-box;outline:none;${extra}`;
}
function btnStyle(variant='default',extra=''){
  if(variant==='accent') return `font-family:'Syne',sans-serif;font-size:12px;font-weight:500;padding:5px 12px;border-radius:8px;border:none;background:${T.accent};color:#ffffff;cursor:pointer;display:inline-flex;align-items:center;gap:5px;line-height:1;${extra}`;
  if(variant==='accent2') return `font-family:'Syne',sans-serif;font-size:12px;font-weight:500;padding:5px 12px;border-radius:8px;border:none;background:${T.accent2};color:#ffffff;cursor:pointer;display:inline-flex;align-items:center;gap:5px;line-height:1;${extra}`;
  if(variant==='danger') return `font-family:'Syne',sans-serif;font-size:12px;font-weight:500;padding:5px 12px;border-radius:8px;border:1px solid ${T.pomo};background:${T.surface};color:${T.pomo};cursor:pointer;display:inline-flex;align-items:center;gap:5px;line-height:1;${extra}`;
  return `font-family:'Syne',sans-serif;font-size:12px;font-weight:500;padding:5px 12px;border-radius:8px;border:0.5px solid ${T.border2};background:${T.btnBg};color:${T.btnText};cursor:pointer;display:inline-flex;align-items:center;gap:5px;line-height:1;${extra}`;
}
function labelStyle(){return `font-size:12px;font-weight:500;letter-spacing:.02em;color:${T.muted};margin-bottom:8px;display:flex;align-items:center;gap:6px;`;}
function selectStyle(extra=''){
  return `font-family:'Syne',sans-serif;font-size:13px;background:${T.inputBg};border:1px solid ${T.border2};border-radius:8px;padding:7px 8px;color:${T.inputText};box-sizing:border-box;outline:none;cursor:pointer;${extra}`;
}

function enterCrisisMode(){crisisMode=true;save();render();}
function exitCrisisMode(){crisisMode=false;save();render();}
