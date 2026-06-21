/*
MODULE: ui.js
LAYER: unknown
PURPOSE: Existing module stabilized with ownership metadata.
OWNS: ui.js responsibilities
USES: local modules
STATE_READS: T
STATE_WRITES: background, display, el, t, textContent, toastTimer, type
PUBLIC_API: showToast
DEPENDENCIES: see dependency graph
INVARIANTS: render pure; actions mutate; helpers transform
LAST_STABILIZED: 2026-06-21
*/

let toastTimer=null;

function showToast(msg,type){
  const t=document.getElementById('toast');if(!t)return;
  t.textContent=msg;
  t.style.background=type==='ok'?T.accent:type==='warn'?'#92400e':T.accent2;
  t.style.display='block';
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{
    const el=document.getElementById('toast');
    if(el)el.style.display='none';
  },3200);
}
