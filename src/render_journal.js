/*
MODULE: render_journal.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_journal.js responsibilities
USES: local modules
STATE_READS: T, state
STATE_WRITES: audioRecState, c, capturePlaceholder, cat, catOpts, catPill, class, clobber, contentHtml, cutoff
PUBLIC_API: matchesFilter, renderJournalWidget, typeBadge
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Journal widget — extracted from render_tasks.js for file-size management.
// Renamed to "Dump" in UI (widget ID stays 'journal' to preserve localStorage layout).
// Depends on: core.js (btnStyle, inputStyle, selectStyle, labelStyle), helpers.js (esc, getCat),
//             state.js (journalEntries, journalDateFilter, journalNewType, audioRecordings,
//                       audioRecState, recStartedAt, playingAudioId, categories),
//             audio.js (toggleAudioRecording, playRecording),
//             actions.js (promoteDumpToTask)
// Registered in render.js widgetRenderMap under key 'journal'.

function renderJournalWidget(todayStr){
  // ── Type badge colours ──
  const typeMeta={
    todo:    {label:'To-do',  bg:'#e0f2fe',text:'#0c4a6e',dot:'#0284c7'},
    dump:    {label:'Note',   bg:'#fef9c3',text:'#713f12',dot:'#ca8a04'},
    reflect: {label:'Reflect',bg:'#dcfce7',text:'#14532d',dot:'#16a34a'},
    project: {label:'Project',bg:'#dbeafe',text:'#1e3a8a',dot:'#2563eb'},
    voice:   {label:'Voice',  bg:'#fee2e2',text:'#7f1d1d',dot:'#dc2626'},
  };
  function typeBadge(type){
    const m=typeMeta[type]||typeMeta.dump;
    return `<span style="font-size:9px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;padding:2px 7px;border-radius:20px;background:${m.bg};color:${m.text};flex-shrink:0;">${m.label}</span>`;
  }

  // ── Date filter helpers ──
  const now2=new Date();
  function matchesFilter(createdAt){
    const d=new Date(createdAt);
    const ds=d.toDateString();
    if(journalDateFilter==='today') return ds===todayStr;
    if(journalDateFilter==='yesterday'){
      const y=new Date(now2);y.setDate(y.getDate()-1);return ds===y.toDateString();
    }
    // week: last 7 days including today
    const cutoff=new Date(now2);cutoff.setDate(cutoff.getDate()-6);cutoff.setHours(0,0,0,0);
    return d>=cutoff;
  }
  const filtered=[...journalEntries].filter(e=>matchesFilter(e.createdAt)).sort((a,b)=>b.createdAt-a.createdAt);

  // ── Date filter tabs ──
  const filterTabs=['today','yesterday','week'].map(f=>`
    <button onclick="journalDateFilter='${f}';render()"
      style="padding:4px 12px;font-size:11px;font-weight:700;letter-spacing:.04em;text-transform:uppercase;
             border:none;border-bottom:2px solid ${journalDateFilter===f?T.accent2:'transparent'};
             background:transparent;color:${journalDateFilter===f?T.accent2:T.muted};cursor:pointer;border-radius:0;">
      ${f==='week'?'This week':f.charAt(0).toUpperCase()+f.slice(1)}
    </button>`).join('');

  // ── Entry list ──
  const listHtml=filtered.length?filtered.map(e=>{
    const d=new Date(e.createdAt);
    const timeStr=String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
    const cat=getCat(e.catId);
    const catPill=cat?`<span style="font-size:9px;padding:2px 7px;border-radius:20px;font-weight:600;background:${cat.color.bg};color:${cat.color.text};">${esc(cat.name)}</span>`:'';

    // Promote button for todo entries
    const promoteBtn=e.type==='todo'
      ?`<button onclick="promoteDumpToTask(${e.id})" title="Add to Tasks" style="${btnStyle('accent','font-size:10px;padding:2px 8px;')}"><i class="ti ti-list-check"></i> Task</button>`
      :'';

    let contentHtml;
    if(e.type==='voice'&&e.audioId!=null){
      const rec=audioRecordings.find(r=>r.id===e.audioId);
      const isPlaying=playingAudioId===e.audioId;
      if(rec){
        contentHtml=`<div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
          <button onclick="playRecording(${e.audioId})" style="${btnStyle(isPlaying?'accent2':'default','font-size:12px;padding:5px 9px;')}">
            <i class="ti ti-${isPlaying?'player-stop':'player-play'}"></i>
          </button>
          <span style="font-size:12px;font-weight:600;color:${T.text};word-break:break-word;flex:1;">${esc(rec.label)}</span>
          <span style="font-size:10px;color:${T.muted};font-family:'DM Mono',monospace;">${fmtDur(rec.durationSecs)}</span>
        </div>`;
      } else {
        contentHtml=`<span style="font-size:12px;color:${T.muted2};font-style:italic;">(audio file missing)</span>`;
      }
    } else {
      contentHtml=`<div style="font-size:13px;color:${T.text};line-height:1.5;white-space:pre-wrap;word-break:break-word;">${esc(e.text||'')}</div>`;
    }

    return `<div style="padding:9px 0;border-bottom:1.5px solid ${T.border};">
      <div style="display:flex;align-items:center;gap:6px;margin-bottom:5px;flex-wrap:wrap;">
        <span style="font-size:10px;font-family:'DM Mono',monospace;color:${T.muted2};flex-shrink:0;">${timeStr}</span>
        ${typeBadge(e.type)}
        ${catPill}
        ${promoteBtn}
        <button onclick="deleteJournalEntry(${e.id})" style="${btnStyle('danger','font-size:10px;padding:2px 7px;margin-left:auto;')}"><i class="ti ti-trash"></i></button>
      </div>
      ${contentHtml}
    </div>`;
  }).join(''):`<div style="color:${T.muted2};font-size:12px;padding:10px 0;">Nothing here yet.</div>`;

  // ── Voice recorder bar ──
  const recLiveSecs=audioRecState==='recording'?Math.floor((Date.now()-recStartedAt)/1000):0;
  const recLiveStr=String(Math.floor(recLiveSecs/60)).padStart(2,'0')+':'+String(recLiveSecs%60).padStart(2,'0');
  const recBar=`
    <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding:8px 10px;border-radius:10px;background:${T.surface2};border:1.5px solid ${audioRecState==='recording'?T.pomo:T.border};margin-bottom:4px;">
      <button onclick="toggleAudioRecording()" style="${btnStyle(audioRecState==='recording'?'danger':'default','padding:7px 13px;font-size:12px;border-radius:999px;')}">
        <i class="ti ti-${audioRecState==='recording'?'square':'microphone'}"></i>
        ${audioRecState==='recording'?'Stop':'Voice'}
      </button>
      <div style="font-family:'DM Mono',monospace;font-size:18px;font-weight:600;color:${audioRecState==='recording'?T.pomo:T.muted};min-width:52px;" id="rec-live-time">${recLiveStr}</div>
      <div style="font-size:10px;color:${T.muted};flex:1;">${audioRecState==='recording'?'Recording… click Stop when done.':''}</div>
    </div>`;

  // ── Capture bar: type selector, placeholder per type ──
  const catOpts=`<option value="">— no cat</option>`+categories.map(c=>`<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const typeOpts=[
    {v:'todo',    l:'To-do'},
    {v:'dump',    l:'Note'},
    {v:'reflect', l:'Reflect'},
    {v:'voice',   l:'Voice'},
  ].map(o=>`<option value="${o.v}" ${journalNewType===o.v?'selected':''}>${o.l}</option>`).join('');

  const capturePlaceholder=journalNewType==='todo'
    ?'What do you need to do? (promote to task when ready)'
    :journalNewType==='reflect'
      ?'How\'s it going?'
      :'Any thought, link, name — capture it now, sort it later';

  return `
    <div id="journal-card" data-no-clobber="true">
    <div style="margin-bottom:8px;">
      <div style="${labelStyle()}"><i class="ti ti-inbox"></i>dump — capture now, sort later</div>
      <textarea id="journal-capture-text" rows="2" placeholder="${capturePlaceholder}"
        onkeydown="if((event.metaKey||event.ctrlKey)&&event.key==='Enter'){addJournalEntry();event.preventDefault();}"
        style="${inputStyle('resize:none;line-height:1.5;font-size:13px;margin-bottom:6px;margin-top:4px;')}"></textarea>
      <div style="font-size:10px;color:${T.muted2};margin-bottom:6px;">Nothing here is a commitment. Promote to task when ready.</div>
      <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
        <select onchange="journalNewType=this.value;render()" style="${selectStyle('font-size:11px;padding:4px 8px;min-width:90px;')}">${typeOpts}</select>
        <select id="journal-capture-cat" style="${selectStyle('font-size:11px;padding:4px 8px;flex:1;min-width:100px;')}">${catOpts}</select>
        <button onclick="addJournalEntry()" style="${btnStyle('accent','font-size:11px;padding:5px 11px;')}"><i class="ti ti-plus"></i>Save</button>
      </div>
      ${recBar}
    </div>
    <div style="display:flex;gap:0;border-bottom:1.5px solid ${T.border};margin-bottom:6px;">${filterTabs}</div>
    <div style="max-height:340px;overflow:auto;">
      ${listHtml}
    </div>
    </div>
  `;
}

registerWidget({
  id: 'journal',           // keep ID — changing breaks localStorage layout
  label: 'Dump',
  icon: 'ti-inbox',
  pinnable: true,
  collapsible: true,
  fullWidth: true,
  defaultVisible: true,
  render: renderJournalWidget,
});
