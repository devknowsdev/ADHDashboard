/*
MODULE: music.js
LAYER: service
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: music.js responsibilities
USES: local modules
STATE_READS: state
STATE_WRITES: KB_NOTE_FREQS, MAX_SAMPLES, NOTE_NAMES, SIZE, _tapTimes, a, angle, arcEl, avg, b
PUBLIC_API: autoCorrelate, freqToNote, getOrCreateAudioCtx, kbAllOff, kbNoteOff, kbNoteOn, metroTick, nudgeMetroBpm, setKbOctave, setKbVolume, setKbWaveform, setMetroBeats
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Music Tools audio engine — metronome scheduler, guitar tuner, and keyboard synth.
// Render functions (_renderMetronomeTab, _renderTunerTab, _renderKeyboardTab,
// renderToolsWidget) live in render_music.js.
// Depends on: state.js, ui.js (showToast), render.js (render).
// ── Music Tools ───────────────────────────────────────────────────────────────

// ─ Shared audio context helper ─
function getOrCreateAudioCtx(existingCtx){
  if(existingCtx&&existingCtx.state!=='closed') return existingCtx;
  return new (window.AudioContext||window.webkitAudioContext)();
}

// ─ Metronome ─────────────────────────────────────────────────────────────────
function metroTick(){
  if(!metroRunning) return;
  const now=metroAudioCtx.currentTime;
  const secondsPerBeat=60/metroBpm;
  const secondsPerTick=secondsPerBeat/metroSubdivision;
  // Schedule clicks until 100ms ahead
  while(metroNextTime<now+0.1){
    const tickInBar=metroBeat%(metroBeats*metroSubdivision);
    const isDownbeat=tickInBar===0;
    const isSubdivision=!isDownbeat&&metroSubdivision>1&&tickInBar%metroSubdivision!==0;
    const freq=isDownbeat?1050:isSubdivision?660:880;
    const gain=isDownbeat?0.9:isSubdivision?0.35:0.6;
    const dur=isDownbeat?0.04:0.025;
    const o=metroAudioCtx.createOscillator();
    const g=metroAudioCtx.createGain();
    o.connect(g);g.connect(metroAudioCtx.destination);
    o.type='square';
    o.frequency.setValueAtTime(freq,metroNextTime);
    g.gain.setValueAtTime(0,metroNextTime);
    g.gain.linearRampToValueAtTime(gain,metroNextTime+0.002);
    g.gain.exponentialRampToValueAtTime(0.001,metroNextTime+dur);
    o.start(metroNextTime);o.stop(metroNextTime+dur+0.01);
    metroBeat++;
    metroNextTime+=secondsPerTick;
  }
}

function startMetro(){
  if(metroRunning) return;
  metroAudioCtx=getOrCreateAudioCtx(metroAudioCtx);
  if(metroAudioCtx.state==='suspended') metroAudioCtx.resume();
  metroBeat=0;
  metroNextTime=metroAudioCtx.currentTime+0.05;
  metroRunning=true;
  metroTick();
  metroInterval=setInterval(metroTick,25);
  render();
}
function stopMetro(){
  metroRunning=false;
  clearInterval(metroInterval);metroInterval=null;
  render();
}
function toggleMetro(){metroRunning?stopMetro():startMetro();}
function setMetroBpm(v){
  const n=parseInt(v);
  if(isNaN(n)) return;
  metroBpm=Math.max(20,Math.min(300,n));
  // Update DOM display without full render
  const el=document.getElementById('metro-bpm-display');
  if(el) el.textContent=metroBpm;
}
function nudgeMetroBpm(delta){
  metroBpm=Math.max(20,Math.min(300,metroBpm+delta));
  const el=document.getElementById('metro-bpm-display');
  if(el) el.textContent=metroBpm;
  const sl=document.getElementById('metro-bpm-slider');
  if(sl) sl.value=metroBpm;
}
function setMetroBeats(v){metroBeats=parseInt(v)||4;metroBeat=0;render();}
function setMetroSubdivision(v){metroSubdivision=parseInt(v)||1;metroBeat=0;render();}
function tapTempo(){
  const now=Date.now();
  if(!window._tapTimes) window._tapTimes=[];
  const taps=window._tapTimes;
  if(taps.length&&now-taps[taps.length-1]>2500) taps.length=0; // reset after pause
  taps.push(now);
  if(taps.length>8) taps.shift();
  if(taps.length>=2){
    const gaps=[];
    for(let i=1;i<taps.length;i++) gaps.push(taps[i]-taps[i-1]);
    const avg=gaps.reduce((a,b)=>a+b,0)/gaps.length;
    metroBpm=Math.max(20,Math.min(300,Math.round(60000/avg)));
    const el=document.getElementById('metro-bpm-display');
    if(el) el.textContent=metroBpm;
    const sl=document.getElementById('metro-bpm-slider');
    if(sl) sl.value=metroBpm;
  }
}

// ─ Tuner ──────────────────────────────────────────────────────────────────────
const NOTE_NAMES=['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'];
function freqToNote(freq){
  if(freq<=0) return {note:'—',cents:0,octave:0,midi:0};
  const midi=12*Math.log2(freq/440)+69;
  const midiRound=Math.round(midi);
  const cents=Math.round((midi-midiRound)*100);
  const octave=Math.floor(midiRound/12)-1;
  const note=NOTE_NAMES[((midiRound%12)+12)%12];
  return {note,cents,octave,midi:midiRound};
}
function autoCorrelate(buf,sampleRate){
  // Normalised autocorrelation (Pearson) — threshold works on [-1,1] range
  const SIZE=buf.length;
  const MAX_SAMPLES=Math.floor(SIZE/2);
  // Bail on silence before the inner loop
  let rmsSum=0;
  for(let i=0;i<SIZE;i++) rmsSum+=buf[i]*buf[i];
  if(rmsSum/SIZE<0.0001) return -1;
  let best=-1,bestCorr=-1,lastCorr=1,found=false;
  for(let lag=2;lag<MAX_SAMPLES;lag++){
    let num=0,e1=0,e2=0;
    for(let i=0;i<MAX_SAMPLES;i++){
      num+=buf[i]*buf[i+lag];
      e1+=buf[i]*buf[i];
      e2+=buf[i+lag]*buf[i+lag];
    }
    const denom=Math.sqrt(e1*e2);
    const corr=denom>0?num/denom:0;
    if(corr>0.9&&corr>lastCorr){
      found=true;
      if(corr>bestCorr){bestCorr=corr;best=lag;}
    } else if(found){break;}
    lastCorr=corr;
  }
  if(best===-1||bestCorr<0.9) return -1;
  // Parabolic interpolation for sub-sample accuracy
  if(best<=1||best>=MAX_SAMPLES-1) return sampleRate/best;
  const norm=(lag)=>{
    let n=0,a=0,b=0;
    for(let i=0;i<MAX_SAMPLES;i++){n+=buf[i]*buf[i+lag];a+=buf[i]*buf[i];b+=buf[i+lag]*buf[i+lag];}
    const d=Math.sqrt(a*b);return d>0?n/d:0;
  };
  const r0=norm(best-1),r1=norm(best),r2=norm(best+1);
  const shift=(r2-r0)/(2*(2*r1-r0-r2)||1);
  return sampleRate/(best+shift);
}
function tunerLoop(){
  if(!tunerActive||!tunerAnalyser) return;
  const buf=new Float32Array(tunerAnalyser.fftSize);
  tunerAnalyser.getFloatTimeDomainData(buf);
  // RMS check — only process if signal is present
  const rms=Math.sqrt(buf.reduce((s,v)=>s+v*v,0)/buf.length);
  if(rms<0.01){
    tunerNote='—';tunerCents=0;tunerFreq=0;
  } else {
    const freq=autoCorrelate(buf,tunerAudioCtx.sampleRate);
    if(freq>40&&freq<5000){
      tunerFreq=freq;
      const r=freqToNote(freq);
      tunerNote=r.note+r.octave;
      tunerCents=r.cents;
    } else {
      tunerNote='—';tunerCents=0;tunerFreq=0;
    }
  }
  // Lightweight DOM update — don't full-render on every animation frame
  const noteEl=document.getElementById('tuner-note');
  const centsEl=document.getElementById('tuner-cents');
  const freqEl=document.getElementById('tuner-freq');
  const needleEl=document.getElementById('tuner-needle');
  const arcEl=document.getElementById('tuner-arc');
  if(noteEl) noteEl.textContent=tunerNote;
  if(centsEl) centsEl.textContent=tunerNote!=='—'?(tunerCents>0?'+':'')+tunerCents+'¢':'';
  if(freqEl) freqEl.textContent=tunerNote!=='—'?tunerFreq.toFixed(1)+' Hz':'';
  if(needleEl){
    const angle=Math.max(-45,Math.min(45,tunerCents*0.9));
    needleEl.setAttribute('transform',`rotate(${angle},60,70)`);
  }
  if(arcEl){
    const inTune=Math.abs(tunerCents)<=5;
    arcEl.setAttribute('stroke',inTune?'#4ade80':Math.abs(tunerCents)<15?'#facc15':'#f87171');
  }
  tunerRafId=requestAnimationFrame(tunerLoop);
}
async function startTuner(){
  if(tunerActive) return;
  if(!navigator.mediaDevices){showToast('Mic not available','warn');return;}
  try{
    tunerStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
    tunerAudioCtx=getOrCreateAudioCtx(tunerAudioCtx);
    if(tunerAudioCtx.state==='suspended') await tunerAudioCtx.resume();
    tunerAnalyser=tunerAudioCtx.createAnalyser();
    tunerAnalyser.fftSize=4096;
    const src=tunerAudioCtx.createMediaStreamSource(tunerStream);
    src.connect(tunerAnalyser);
    tunerActive=true;
    render();
    tunerRafId=requestAnimationFrame(tunerLoop);
  }catch(e){showToast('Mic permission denied','warn');}
}
function stopTuner(){
  tunerActive=false;
  if(tunerRafId){cancelAnimationFrame(tunerRafId);tunerRafId=null;}
  if(tunerStream){tunerStream.getTracks().forEach(t=>t.stop());tunerStream=null;}
  tunerNote='—';tunerCents=0;tunerFreq=0;
  render();
}
function toggleTuner(){tunerActive?stopTuner():startTuner();}

// ─ Keyboard ──────────────────────────────────────────────────────────────────
const KB_NOTE_FREQS=(()=>{
  const notes=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const map={};
  for(let oct=0;oct<=8;oct++){
    notes.forEach((n,i)=>{
      const midi=12*(oct+1)+i;
      map[n+oct]=440*Math.pow(2,(midi-69)/12);
    });
  }
  return map;
})();
function kbNoteOn(noteKey){
  if(kbActiveNotes.has(noteKey)) return;
  kbAudioCtx=getOrCreateAudioCtx(kbAudioCtx);
  if(kbAudioCtx.state==='suspended') kbAudioCtx.resume();
  const freq=KB_NOTE_FREQS[noteKey];
  if(!freq) return;
  const osc=kbAudioCtx.createOscillator();
  const gain=kbAudioCtx.createGain();
  const filt=kbAudioCtx.createBiquadFilter();
  filt.type='lowpass';filt.frequency.value=4000;
  osc.connect(filt);filt.connect(gain);gain.connect(kbAudioCtx.destination);
  osc.type=kbWaveform;
  osc.frequency.setValueAtTime(freq,kbAudioCtx.currentTime);
  gain.gain.setValueAtTime(0,kbAudioCtx.currentTime);
  gain.gain.linearRampToValueAtTime(kbVolume*0.4,kbAudioCtx.currentTime+0.01);
  osc.start();
  kbOscillators.set(noteKey,{osc,gain});
  kbActiveNotes.add(noteKey);
  // Highlight key in DOM without full render
  const el=document.getElementById('kb-key-'+noteKey);
  if(el) el.style.background=el.dataset.black==='1'?'#3b82f6':'#93c5fd';
}
function kbNoteOff(noteKey){
  if(!kbActiveNotes.has(noteKey)) return;
  const node=kbOscillators.get(noteKey);
  if(node){
    const {gain,osc}=node;
    gain.gain.setValueAtTime(gain.gain.value,kbAudioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001,kbAudioCtx.currentTime+0.15);
    osc.stop(kbAudioCtx.currentTime+0.16);
    kbOscillators.delete(noteKey);
  }
  kbActiveNotes.delete(noteKey);
  const el=document.getElementById('kb-key-'+noteKey);
  if(el) el.style.background=el.dataset.black==='1'?'#1e293b':'#ffffff';
}
function kbAllOff(){
  [...kbActiveNotes].forEach(n=>kbNoteOff(n));
}
function setKbOctave(v){kbAllOff();kbOctave=parseInt(v);render();}
function setKbWaveform(v){kbWaveform=v;render();}
function setKbVolume(v){kbVolume=parseFloat(v);}
