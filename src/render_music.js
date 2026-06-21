/*
MODULE: render_music.js
LAYER: render
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: render_music.js responsibilities
USES: local modules
STATE_READS: T, state
STATE_WRITES: A4, BLACKS, WHITES, a, anchor, b, beatDots, beatOpts, black, blackHtml
PUBLIC_API: _renderKeyboardTab, _renderMetronomeTab, _renderTunerTab, renderToolsWidget
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Music Tools render functions — metronome, tuner, and keyboard tab HTML builders.
// Depends on: core.js (btnStyle, inputStyle, selectStyle), helpers.js (esc),
//             state.js (metroBpm, metroRunning, metroBeats, metroSubdivision, metroBeat,
//                       tunerActive, tunerNote, tunerCents, tunerFreq,
//                       kbOctave, kbWaveform, kbVolume, kbActiveNotes, toolsTab),
//             music.js (all audio engine functions).
// Registered in render.js widgetRenderMap under key 'tools'.
// ─ Render ──────────────────────────────────────────────────────────────────
function _renderMetronomeTab(){
    const beatDots=Array.from({length:metroBeats},(_,i)=>{
      const isActive=metroRunning&&metroBeat>0&&((metroBeat-1)%(metroBeats*metroSubdivision)===i*metroSubdivision);
      return `<div style="width:10px;height:10px;border-radius:50%;background:${isActive?T.accent2:T.border};transition:background .05s;flex-shrink:0;"></div>`;
    }).join('');
    const subOpts=[{v:1,label:'♩ ¼'},{v:2,label:'♪ ⅛'},{v:4,label:'♬ 1/16'}];
    const beatOpts=[2,3,4,5,6,7,8];
  return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:14px;padding:6px 0;">
        <!-- BPM display -->
        <div style="display:flex;align-items:center;gap:10px;">
          <button onclick="nudgeMetroBpm(-5)" style="${btnStyle('default','font-size:14px;padding:5px 10px;border-radius:8px;font-weight:700;')}">−5</button>
          <button onclick="nudgeMetroBpm(-1)" style="${btnStyle('default','font-size:14px;padding:5px 9px;border-radius:8px;font-weight:700;')}">−</button>
          <div style="display:flex;flex-direction:column;align-items:center;min-width:72px;">
            <div id="metro-bpm-display" style="font-family:'DM Mono',monospace;font-size:38px;font-weight:700;color:${T.text};line-height:1;">${metroBpm}</div>
            <div style="font-size:10px;color:${T.muted2};letter-spacing:.08em;text-transform:uppercase;">BPM</div>
          </div>
          <button onclick="nudgeMetroBpm(1)" style="${btnStyle('default','font-size:14px;padding:5px 9px;border-radius:8px;font-weight:700;')}">+</button>
          <button onclick="nudgeMetroBpm(5)" style="${btnStyle('default','font-size:14px;padding:5px 10px;border-radius:8px;font-weight:700;')}">+5</button>
        </div>
        <!-- Slider -->
        <input id="metro-bpm-slider" type="range" min="20" max="300" value="${metroBpm}"
          oninput="setMetroBpm(this.value)"
          onchange="metroBpm=parseInt(this.value);if(metroRunning){stopMetro();startMetro();}else render();"
          style="width:100%;accent-color:${T.accent2};cursor:pointer;"/>
        <!-- Beat dots -->
        <div style="display:flex;gap:7px;align-items:center;height:18px;">${beatDots}</div>
        <!-- Start / Tap -->
        <div style="display:flex;gap:8px;width:100%;">
          <button onclick="toggleMetro()" style="${btnStyle(metroRunning?'accent2':'accent','flex:1;justify-content:center;font-size:13px;padding:10px 14px;border-radius:10px;font-weight:800;')}">
            <i class="ti ti-${metroRunning?'player-stop':'player-play'}"></i> ${metroRunning?'Stop':'Start'}
          </button>
          <button onclick="tapTempo()" style="${btnStyle('default','flex:1;justify-content:center;font-size:13px;padding:10px 14px;border-radius:10px;font-weight:700;')}">
            <i class="ti ti-hand-finger"></i> Tap
          </button>
        </div>
        <!-- Beats per bar + subdivision -->
        <div style="display:flex;gap:12px;width:100%;flex-wrap:wrap;">
          <div style="flex:1;min-width:90px;">
            <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${T.muted};margin-bottom:5px;">Beats / bar</div>
            <div style="display:flex;gap:3px;flex-wrap:wrap;">
              ${beatOpts.map(b=>`<button onclick="setMetroBeats(${b})"
                style="${btnStyle(metroBeats===b?'accent2':'default','font-size:11px;padding:3px 8px;border-radius:6px;')}">${b}</button>`).join('')}
            </div>
          </div>
          <div style="flex:1;min-width:110px;">
            <div style="font-size:9px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${T.muted};margin-bottom:5px;">Subdivision</div>
            <div style="display:flex;gap:3px;flex-wrap:wrap;">
              ${subOpts.map(s=>`<button onclick="setMetroSubdivision(${s.v})"
                style="${btnStyle(metroSubdivision===s.v?'accent2':'default','font-size:11px;padding:3px 8px;border-radius:6px;')}">${s.label}</button>`).join('')}
            </div>
          </div>
        </div>
      </div>`;
}

function _renderTunerTab(){
    const inTune=tunerActive&&tunerNote!=='—'&&Math.abs(tunerCents)<=5;
    const noteColor=inTune?T.green:Math.abs(tunerCents)<15?T.urg1:T.pomo;
    // SVG gauge arc: 120° span centered at top, needle rotates −45 to +45 with cents
  return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:6px 0;">
        <!-- Gauge SVG -->
        <svg width="120" height="80" viewBox="0 0 120 80" style="overflow:visible;">
          <!-- Background arc -->
          <path d="M 15 70 A 45 45 0 0 1 105 70" fill="none" stroke="${T.border}" stroke-width="5" stroke-linecap="round"/>
          <!-- Coloured arc (always full span; colour changes with tuning) -->
          <path id="tuner-arc" d="M 15 70 A 45 45 0 0 1 105 70" fill="none" stroke="${tunerActive&&tunerNote!=='—'?noteColor:T.border2}" stroke-width="5" stroke-linecap="round" style="transition:stroke .15s;"/>
          <!-- Centre tick marks: L −10¢ −5¢ 0 +5¢ +10¢ R -->
          ${[-45,-27,-9,0,9,27,45].map(a=>{
            const rad=(a-90)*Math.PI/180;
            const inner=a===0?30:36, outer=a===0?22:38;
            return `<line x1="${60+inner*Math.cos(rad)}" y1="${70+inner*Math.sin(rad)}" x2="${60+outer*Math.cos(rad)}" y2="${70+outer*Math.sin(rad)}" stroke="${a===0?T.accent2:T.border}" stroke-width="${a===0?2:1}" stroke-linecap="round"/>`;
          }).join('')}
          <!-- Needle -->
          <g id="tuner-needle" transform="rotate(${tunerActive&&tunerNote!=='—'?Math.max(-45,Math.min(45,tunerCents*0.9)):0},60,70)" style="transition:transform .08s;">
            <line x1="60" y1="70" x2="60" y2="28" stroke="${tunerActive&&tunerNote!=='—'?noteColor:T.muted2}" stroke-width="2" stroke-linecap="round"/>
            <circle cx="60" cy="70" r="4" fill="${tunerActive&&tunerNote!=='—'?noteColor:T.muted2}"/>
          </g>
          <!-- ±50¢ labels -->
          <text x="8" y="76" font-size="8" fill="${T.muted2}" text-anchor="middle" font-family="DM Mono,monospace">−50</text>
          <text x="112" y="76" font-size="8" fill="${T.muted2}" text-anchor="middle" font-family="DM Mono,monospace">+50</text>
        </svg>
        <!-- Note name -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:2px;">
          <div id="tuner-note" style="font-family:'DM Mono',monospace;font-size:42px;font-weight:700;color:${tunerActive&&tunerNote!=='—'?noteColor:T.muted2};line-height:1;transition:color .15s;">${tunerNote}</div>
          <div id="tuner-cents" style="font-family:'DM Mono',monospace;font-size:14px;font-weight:600;color:${T.muted};min-height:18px;">${tunerActive&&tunerNote!=='—'?(tunerCents>0?'+':'')+tunerCents+'¢':''}</div>
          <div id="tuner-freq" style="font-family:'DM Mono',monospace;font-size:11px;color:${T.muted2};min-height:16px;">${tunerActive&&tunerNote!=='—'?tunerFreq.toFixed(1)+' Hz':''}</div>
        </div>
        <button onclick="toggleTuner()" style="${btnStyle(tunerActive?'danger':'accent','font-size:13px;padding:9px 24px;border-radius:10px;font-weight:700;justify-content:center;')}">
          <i class="ti ti-${tunerActive?'microphone-off':'microphone'}"></i> ${tunerActive?'Stop tuner':'Start tuner'}
        </button>
        ${!tunerActive?`<div style="font-size:10px;color:${T.muted2};text-align:center;line-height:1.4;">Requires mic access · A4 = 440 Hz</div>`:''}
      </div>`;
}

function _renderKeyboardTab(){
    // Two octaves: octave and octave+1, C to B each
    const WHITES=['C','D','E','F','G','A','B'];
    const BLACKS={C:'C#',D:'D#',F:'F#',G:'G#',A:'A#'}; // white → black to its right
    const oct2=kbOctave+1;
    // Build two octaves of keys
    const octaves=[kbOctave,oct2];
    const whiteKeys=[];
    octaves.forEach(o=>WHITES.forEach(n=>whiteKeys.push({note:n,oct:o,black:false})));
    // Build HTML: white keys as a flex row, black keys absolutely positioned
    const totalWhites=whiteKeys.length; // 14
    const whiteW=100/totalWhites; // percent
    let whiteHtml='',blackHtml='';
    whiteKeys.forEach((k,i)=>{
      const noteKey=k.note+k.oct;
      const isActive=kbActiveNotes.has(noteKey);
      whiteHtml+=`<div id="kb-key-${noteKey}" data-black="0"
        onmousedown="event.preventDefault();kbNoteOn('${noteKey}')"
        onmouseup="kbNoteOff('${noteKey}')"
        onmouseleave="kbNoteOff('${noteKey}')"
        ontouchstart="event.preventDefault();kbNoteOn('${noteKey}')"
        ontouchend="event.preventDefault();kbNoteOff('${noteKey}')"
        style="position:absolute;left:${i*whiteW}%;width:${whiteW-0.4}%;height:100%;background:${isActive?'#93c5fd':'#ffffff'};border:1px solid ${T.border};border-radius:0 0 5px 5px;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;padding-bottom:3px;box-sizing:border-box;user-select:none;-webkit-user-select:none;">
        <span style="font-size:7px;color:#94a3b8;font-family:'DM Mono',monospace;font-weight:600;">${k.note==='C'?k.note+k.oct:''}</span>
      </div>`;
      // Add black key after this white if applicable
      const blackNote=BLACKS[k.note];
      if(blackNote){
        const blackKey=blackNote+k.oct;
        const isBlackActive=kbActiveNotes.has(blackKey);
        const blackLeft=(i+0.65)*whiteW;
        blackHtml+=`<div id="kb-key-${blackKey}" data-black="1"
          onmousedown="event.preventDefault();kbNoteOn('${blackKey}')"
          onmouseup="kbNoteOff('${blackKey}')"
          onmouseleave="kbNoteOff('${blackKey}')"
          ontouchstart="event.preventDefault();kbNoteOn('${blackKey}')"
          ontouchend="event.preventDefault();kbNoteOff('${blackKey}')"
          style="position:absolute;left:${blackLeft}%;width:${whiteW*0.6}%;height:62%;background:${isBlackActive?'#3b82f6':'#1e293b'};border-radius:0 0 4px 4px;cursor:pointer;z-index:2;box-sizing:border-box;user-select:none;-webkit-user-select:none;">
        </div>`;
      }
    });
    const waveOpts=['sine','square','sawtooth','triangle'];
  return `
      <div style="display:flex;flex-direction:column;gap:10px;padding:4px 0;">
        <!-- Controls row -->
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:5px;">
            <span style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;">Oct</span>
            <button onclick="setKbOctave(${kbOctave-1})" ${kbOctave<=1?'disabled':''} style="${btnStyle('default','font-size:12px;padding:3px 8px;')}">−</button>
            <span style="font-family:'DM Mono',monospace;font-size:14px;font-weight:700;color:${T.text};min-width:18px;text-align:center;">${kbOctave}</span>
            <button onclick="setKbOctave(${kbOctave+1})" ${kbOctave>=6?'disabled':''} style="${btnStyle('default','font-size:12px;padding:3px 8px;')}">+</button>
          </div>
          <div style="display:flex;gap:3px;flex-wrap:wrap;">
            ${waveOpts.map(w=>`<button onclick="setKbWaveform('${w}')"
              style="${btnStyle(kbWaveform===w?'accent2':'default','font-size:10px;padding:3px 8px;border-radius:6px;')}">${w.slice(0,3)}</button>`).join('')}
          </div>
          <div style="display:flex;align-items:center;gap:5px;margin-left:auto;">
            <span style="font-size:10px;color:${T.muted};font-weight:700;text-transform:uppercase;letter-spacing:.06em;"><i class="ti ti-volume"></i></span>
            <input type="range" min="0" max="1" step="0.05" value="${kbVolume}"
              oninput="setKbVolume(this.value)"
              style="width:60px;accent-color:${T.accent2};cursor:pointer;"/>
          </div>
        </div>
        <!-- Keyboard -->
        <div style="position:relative;height:80px;width:100%;select:none;">
          ${whiteHtml}
          ${blackHtml}
        </div>
        <div style="font-size:9px;color:${T.muted2};text-align:center;">Click or touch keys · Shift-click to hold</div>
      </div>`;
}

function renderToolsWidget(){
  const tabs=['metronome','tuner','keyboard'];
  const tabIcons={metronome:'ti-metronome',tuner:'ti-wave-sine',keyboard:'ti-piano'};
  const tabLabels={metronome:'Metro',tuner:'Tuner',keyboard:'Keys'};
  const tabBar=tabs.map(tab=>`<button onclick="toolsTab='${tab}';render()"
    style="flex:1;font-family:'Syne',sans-serif;font-size:11px;font-weight:700;padding:6px 4px;border:none;border-bottom:2px solid ${toolsTab===tab?T.accent2:'transparent'};background:transparent;color:${toolsTab===tab?T.accent2:T.muted};cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;transition:all .12s;">
    <i class="ti ${tabIcons[tab]}"></i>${tabLabels[tab]}
  </button>`).join('');

  let body='';

  if(toolsTab==='metronome') body=_renderMetronomeTab();
  else if(toolsTab==='tuner') body=_renderTunerTab();
  else if(toolsTab==='keyboard') body=_renderKeyboardTab();

  return `
    <div style="border-bottom:1.5px solid ${T.border};margin:-14px -14px 12px;display:flex;">
      ${tabBar}
    </div>
    ${body}`;
}


registerWidget({
  id: 'tools',
  label: 'Music Tools',
  icon: 'ti-music',
  pinnable: true,
  collapsible: true,
  fullWidth: false,
  defaultVisible: true,
  render: renderToolsWidget,
});
