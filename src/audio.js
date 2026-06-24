/*
MODULE: audio.js
LAYER: service
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: audio.js responsibilities
USES: local modules
STATE_READS: none
STATE_WRITES: AUDIO_DB_NAME, AUDIO_STORE, audioRecState, audioRecordings, audioStream, blob, codecs, currentAudioEl, d, db
PUBLIC_API: defaultAudioLabel, deleteAudioBlob, deleteRecording, fmtAudioDate, getAudioBlob, openAudioDB, playRecording, saveAudioBlob, saveAudioLabel, startEditAudioLabel, stopAudioRecording, stopPlayback
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

// Audio recording, playback, and IndexedDB storage live here.

const AUDIO_DB_NAME='adhd4_audio_db';
const AUDIO_STORE='blobs';

function openAudioDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open(AUDIO_DB_NAME,1);
    req.onerror=()=>reject(req.error);
    req.onupgradeneeded=()=>{req.result.createObjectStore(AUDIO_STORE);};
    req.onsuccess=()=>resolve(req.result);
  });
}

function saveAudioBlob(id,blob){
  return openAudioDB().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(AUDIO_STORE,'readwrite');
    tx.objectStore(AUDIO_STORE).put(blob,id);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  }));
}

function getAudioBlob(id){
  return openAudioDB().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(AUDIO_STORE,'readonly');
    const req=tx.objectStore(AUDIO_STORE).get(id);
    req.onsuccess=()=>resolve(req.result||null);
    req.onerror=()=>reject(req.error);
  }));
}

function deleteAudioBlob(id){
  return openAudioDB().then(db=>new Promise((resolve,reject)=>{
    const tx=db.transaction(AUDIO_STORE,'readwrite');
    tx.objectStore(AUDIO_STORE).delete(id);
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error);
  }));
}

function fmtAudioDate(ts){
  const d=new Date(ts);
  return d.toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'})+' '+d.toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
}

function defaultAudioLabel(ts){
  const d=new Date(ts);
  return 'Voice note '+d.toLocaleString([],{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
}

function updateRecLiveDisplay(){
  const el=document.getElementById('rec-live-time');
  if(!el||audioRecState!=='recording') return;
  const secs=Math.floor((Date.now()-recStartedAt)/1000);
  const m=Math.floor(secs/60),s=secs%60;
  el.textContent=String(m).padStart(2,'0')+':'+String(s).padStart(2,'0');
}

async function toggleAudioRecording(){
  if(audioRecState==='recording'){
    await stopAudioRecording();
    return;
  }
  if(!navigator.mediaDevices||!navigator.mediaDevices.getUserMedia){
    // Fallback: allow uploading an audio file when mic isn't available
    try{
      const input=document.createElement('input');
      input.type='file';
      input.accept='audio/*';
      input.onchange=async function(){
        const file = input.files && input.files[0];
        if(!file){ showToast('No file selected','warn'); return; }
        const id = Date.now();
        const started = Date.now();
        const meta = { id, label: defaultAudioLabel(started), createdAt: started, durationSecs: 0, mimeType: file.type };
        try{
          await saveAudioBlob(id, file);
          audioRecordings.unshift(meta);
          saveAudioMeta();
          journalEntries = journalEntries||[];
          journalEntries.unshift({id:id+1,type:'voice',text:meta.label,catId:'',createdAt:started,audioId:id});
          localStorage.setItem('adhd4_journal',JSON.stringify(journalEntries));
          showToast('Recording uploaded','ok');
          render();
        }catch(e){ showToast('Could not save upload','warn'); }
      };
      input.click();
    }catch(e){ showToast('Microphone not available','warn'); }
    return;
  }
  try{
    stopPlayback();
    audioStream=await navigator.mediaDevices.getUserMedia({audio:true});
    recChunks=[];
    const mime=MediaRecorder.isTypeSupported('audio/webm;codecs=opus')?'audio/webm;codecs=opus':'audio/webm';
    mediaRecorder=new MediaRecorder(audioStream,{mimeType:mime});
    mediaRecorder.ondataavailable=e=>{if(e.data&&e.data.size)recChunks.push(e.data);};
    mediaRecorder.start(250);
    recStartedAt=Date.now();
    audioRecState='recording';
    render();
    recTickInterval=setInterval(updateRecLiveDisplay,500);
    showToast('Recording…','ok');
  }catch(e){
    showToast('Mic permission denied or unavailable','warn');
    audioRecState='idle';
    render();
  }
}

async function stopAudioRecording(){
  if(audioRecState!=='recording'||!mediaRecorder) return;
  clearInterval(recTickInterval);
  recTickInterval=null;
  const mime=mediaRecorder.mimeType||'audio/webm';
  const started=recStartedAt;
  await new Promise(resolve=>{
    mediaRecorder.onstop=resolve;
    try{mediaRecorder.stop();}catch(e){resolve();}
  });
  if(audioStream){
    audioStream.getTracks().forEach(t=>t.stop());
    audioStream=null;
  }
  mediaRecorder=null;
  audioRecState='idle';

  const blob=new Blob(recChunks,{type:mime});
  recChunks=[];
  const durationSecs=Math.max(1,Math.round((Date.now()-started)/1000));
  if(!blob.size){
    showToast('Recording too short','warn');
    render();
    return;
  }

  const id=Date.now();
  const meta={id,label:defaultAudioLabel(started),createdAt:started,durationSecs,mimeType:mime};
  try{
    await saveAudioBlob(id,blob);
    audioRecordings.unshift(meta);
    saveAudioMeta();
    journalEntries.unshift({id:id+1,type:'voice',text:meta.label,catId:'',createdAt:started,audioId:id});
    localStorage.setItem('adhd4_journal',JSON.stringify(journalEntries));
    showToast('Recording saved','ok');
  }catch(e){
    showToast('Could not save recording','warn');
  }
  render();
}

let listenRecognition = null;

function getSpeechRecognitionCtor(){
  if(typeof window==='undefined') return null;
  return window.SpeechRecognition||window.webkitSpeechRecognition||null;
}

function toggleListenMode(){
  if(listenModeActive) stopListenMode();
  else startListenMode();
}

function startListenMode(){
  if(listenModeActive) return;
  const ctor = getSpeechRecognitionCtor();
  if(!ctor){
    showToast('Speech recognition unavailable','warn');
    return;
  }
  try{
    if(listenRecognition){
      listenRecognition.onresult=null; listenRecognition.onerror=null; listenRecognition.onend=null;
      listenRecognition=null;
    }
    listenRecognition=new ctor();
    listenRecognition.lang='en-US';
    listenRecognition.continuous=true;
    listenRecognition.interimResults=false;
    listenRecognition.maxAlternatives=1;
    listenRecognition.onresult=handleListenResult;
    listenRecognition.onerror=handleListenError;
    listenRecognition.onend=()=>{ if(listenModeActive){ setTimeout(()=>{ if(listenModeActive) startListenMode(); },300); } };
    listenRecognition.start();
    listenModeActive=true;
    showToast('Voice commands enabled','ok');
    render&&render();
  }catch(e){
    console.warn('startListenMode failed',e);
    listenModeActive=false;
    listenRecognition=null;
    showToast('Could not enable voice commands','warn');
  }
}

function stopListenMode(){
  if(!listenModeActive) return;
  listenModeActive=false;
  if(listenRecognition){
    listenRecognition.onresult=null;
    listenRecognition.onerror=null;
    listenRecognition.onend=null;
    try{ listenRecognition.stop(); }catch(e){}
    listenRecognition=null;
  }
  showToast('Voice commands stopped','ok');
  render&&render();
}

function handleListenError(event){
  console.warn('Speech recognition error',event);
  showToast('Voice command error','warn');
  stopListenMode();
}

function handleListenResult(event){
  if(!event||!event.results) return;
  const last = event.results[event.results.length-1];
  const transcript = Array.from(last).map(r=>r.transcript).join(' ').trim();
  if(!transcript) return;
  if(last.isFinal){
    processListenCommand(transcript);
  }
}

function normalizeVoiceText(str){
  return String(str||'').replace(/[^\w\s]/g,' ').replace(/\s+/g,' ').trim().toLowerCase();
}

function findTaskByVoiceText(query){
  const target = normalizeVoiceText(query);
  if(!target||!Array.isArray(tasks)) return null;
  const matches = tasks
    .filter(t=>t && typeof t.text==='string')
    .map(t=>({task:t,text:normalizeVoiceText(t.text)}));
  const exact = matches.find(x=>x.text===target);
  if(exact) return exact.task;
  const includes = matches.filter(x=>x.text.includes(target));
  if(includes.length===1) return includes[0].task;
  if(includes.length>1) return includes[0].task;
  const prefix = matches.filter(x=>target.includes(x.text));
  if(prefix.length) return prefix[0].task;
  return null;
}

function processListenCommand(text){
  const lower = normalizeVoiceText(text);
  if(!lower) return;

  if(lower.includes('clear focus') || lower.includes('remove focus')){
    if(typeof clearFocus==='function') clearFocus();
    showToast('Focus cleared','ok');
    return;
  }

  if(lower.includes('stop timer') || lower.includes('pause timer') || lower==='stop' || lower==='pause'){
    if(timerRunning){
      if(typeof stopTimerInternal==='function') stopTimerInternal();
      showToast('Timer paused','ok');
    } else {
      showToast('No timer is running','warn');
    }
    return;
  }

  if(lower.includes('start timer') || lower.includes('resume timer') || lower==='resume'){
    if(!focusTaskId){
      showToast('No task is focused','warn');
      return;
    }
    if(timerRunning){
      showToast('Timer already running','warn');
      return;
    }
    if(typeof startTimerInternal==='function') startTimerInternal();
    showToast('Timer started','ok');
    return;
  }

  if(lower.startsWith('focus ') || lower.startsWith('focus on ') || lower.startsWith('select ') || lower.startsWith('open ')){
    const query = lower.replace(/^(focus on |focus |select |open )/, '').trim();
    const t = findTaskByVoiceText(query);
    if(t){
      if(typeof setFocus==='function') setFocus(t.id);
      showToast(`Focused "${t.text}"`,'ok');
      return;
    }
  }

  if(lower.startsWith('start ') || lower.startsWith('begin ') || lower.startsWith('resume ')){
    const query = lower.replace(/^(start |begin |resume )/, '').trim();
    const t = findTaskByVoiceText(query);
    if(t){
      if(typeof startTaskStopwatch==='function') startTaskStopwatch(t.id);
      showToast(`Started "${t.text}"`,'ok');
      return;
    }
  }

  if(lower.startsWith('complete ') || lower.startsWith('finish ') || lower.startsWith('mark ') || lower.includes(' done')){
    let query = lower.replace(/^(complete |finish |mark )/, '').replace(/ as done$/, '').replace(/ done$/, '').trim();
    const t = findTaskByVoiceText(query);
    if(t){
      if(t.status!=='done'){
        if(typeof toggleTask==='function') toggleTask(t.id);
        showToast(`Marked "${t.text}" done`,'ok');
      } else {
        showToast(`"${t.text}" is already done`,'warn');
      }
      return;
    }
  }

  showToast(`Heard: "${text}"`, 'warn');
}

if(typeof window !== 'undefined'){
  window.toggleListenMode = toggleListenMode;
  window.processListenCommand = processListenCommand;
}

function stopPlayback(){
  if(currentAudioEl){
    currentAudioEl.pause();
    currentAudioEl.src='';
    currentAudioEl=null;
  }
  playingAudioId=null;
}

async function playRecording(id){
  if(playingAudioId===id){
    stopPlayback();
    render();
    return;
  }
  stopPlayback();
  const blob=await getAudioBlob(id);
  if(!blob){
    showToast('Recording file missing','warn');
    return;
  }
  const url=URL.createObjectURL(blob);
  currentAudioEl=new Audio(url);
  playingAudioId=id;
  currentAudioEl.onended=()=>{
    URL.revokeObjectURL(url);
    playingAudioId=null;
    currentAudioEl=null;
    render();
  };
  currentAudioEl.onerror=()=>{
    showToast('Could not play','warn');
    stopPlayback();
    render();
  };
  try{
    await currentAudioEl.play();
    render();
  }catch(e){
    showToast('Playback blocked','warn');
    stopPlayback();
    render();
  }
}

async function deleteRecording(id){
  if(!confirm('Delete this recording?')) return;
  stopPlayback();
  audioRecordings=audioRecordings.filter(r=>r.id!==id);
  saveAudioMeta();
  journalEntries=journalEntries.filter(e=>e.audioId!==id);
  localStorage.setItem('adhd4_journal',JSON.stringify(journalEntries));
  try{await deleteAudioBlob(id);}catch(e){}
  if(editingAudioLabelId===id) editingAudioLabelId=null;
  showToast('Recording deleted','ok');
  render();
}

function startEditAudioLabel(id){
  editingAudioLabelId=id;
  render();
  setTimeout(()=>{
    const el=document.getElementById('audio-label-'+id);
    if(el){el.focus();el.select();}
  },0);
}

function saveAudioLabel(id,val){
  const r=audioRecordings.find(x=>x.id===id);
  if(!r) return;
  const label=String(val||'').trim();
  r.label=label||defaultAudioLabel(r.createdAt);
  editingAudioLabelId=null;
  saveAudioMeta();
  render();
}
