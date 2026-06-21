/*
AI INTEGRATION LAYER (ADDED)
*/

(function initAIIntegration(){

  const AI_CONTROL = window.__AI_CONTROL__;
  const AI_ADAPTER = window.__AI_ADAPTER__;

  if(!AI_ADAPTER) return;

  // =============================
  // AI MODE SYSTEM (ADDED)
  // =============================

  window.__AI_MODE__ = window.__AI_MODE__ || {
    value: "full" // off | assist | full | experimental
  };

  // =============================
  // AI RESOURCE GOVERNOR (NEW)
  // =============================

  window.__AI_GOVERNOR__ = window.__AI_GOVERNOR__ || {
    maxMemoryEntries: 300,
    maxEmbeddings: 200,
    maxExplainTraces: 200,
    embeddingThrottleMs: 5000,
    lastEmbeddingAt: 0
  };

  function isAIEnabled(scope){
    const mode = window.__AI_MODE__?.value;

    if(mode === "off") return false;

    if(mode === "assist"){
      return scope === "scheduler" || scope === "checkins";
    }

    return true;
  }

  window.aiQuery = async function({scope="general", input={}, mode="auto"}){

    if(!isAIEnabled(scope)){
      AI_CONTROL?.registerAIAction?.(scope,{type:"blocked_by_mode",input});
      return {output:null,blocked:true};
    }

    if(AI_CONTROL && !AI_CONTROL.aiEnabled(scope)){
      AI_CONTROL.registerAIAction?.(scope,{type:"blocked",input});
      return {output:null,blocked:true};
    }

    const result = await AI_ADAPTER.queryAI({scope,input,mode,AI_CONTROL});

    AI_CONTROL?.registerAIAction?.(scope,{type:"executed",provider:result.provider});

    window.__AI_MEMORY__?.add?.({
      ts:Date.now(),
      type:"ai_action",
      scope,
      data:result
    });

    window.__AI_EXPLAIN__?.add?.({
      taskId:input?.id || input?.taskId || null,
      scope,
      provider:result.provider,
      breakdown:result
    });

    const text = typeof input === "string" ? input : JSON.stringify(input);
    window.__AI_EMBEDDINGS__?.add?.(text,{scope});

    return result;
  };

  window.aiSchedule = async function(task){

    const context = {
      task,
      memory: window.__AI_MEMORY__?.recent?.(20) || [],
      prefs: window.__AI_PREFERENCES__?.weights || {}
    };

    return window.aiQuery({scope:"scheduler",input:context,mode:"auto"});
  };

  window.aiOverride = function(taskId,change){

    window.__AI_MEMORY__?.add?.({
      ts:Date.now(),
      type:"override",
      scope:"scheduler",
      data:{taskId,change}
    });

    window.__AI_PREFERENCES__?.registerOverride?.(change);
  };

  window.aiCheckin = async function(data){
    return window.aiQuery({scope:"checkins",input:data,mode:"auto"});
  };

  window.runAIInstall = async function(){
    return window.__AI_BOOTSTRAP__?.runBootstrap?.() || {error:"no_installer"};
  };

  window.aiEvolvePreferences = function(){
    window.__AI_PREFERENCES__?.evolve?.();
  };

  window.getAIExplanation = function(taskId){
    return window.__AI_EXPLAIN__?.get?.(taskId);
  };

  window.bindCalendarTask = function(el,task){
    if(!el) return;
    el.addEventListener("click",()=>{
      window.renderAIExplainPanel?.(task.id);
    });
  };

  // =============================
  // AI MODE UI TOGGLE (ADDED)
  // =============================

  window.attachAIModeUI = function(){
    if(document.getElementById("ai-mode-toggle")) return;

    const el = document.createElement("div");
    el.id = "ai-mode-toggle";
    el.style.position = "fixed";
    el.style.top = "10px";
    el.style.right = "10px";
    el.style.zIndex = "99999";

    el.innerHTML = `
      <select>
        <option value="off">AI Off</option>
        <option value="assist">Assist</option>
        <option value="full" selected>Full</option>
        <option value="experimental">Experimental</option>
      </select>
    `;

    const select = el.querySelector("select");
    select.value = window.__AI_MODE__.value;

    select.onchange = (e)=>{
      window.__AI_MODE__.value = e.target.value;
    };

    document.body.appendChild(el);
  };

  setTimeout(()=>window.attachAIModeUI?.(),500);

})();

// =====================================================
// MATERIALIZED AI SUBSYSTEMS (FINAL LAYER)
// =====================================================

// MEMORY ENGINE
const AI_MEMORY = {
  entries: [],
  add(entry){
    this.entries.push(entry);

    // GOVERNOR CAP
    const gov = window.__AI_GOVERNOR__;
    if(gov && this.entries.length > gov.maxMemoryEntries){
      this.entries = this.entries.slice(-200);
    }

    localStorage.setItem("AI_MEMORY", JSON.stringify(this.entries));
  },
  query(fn){ return this.entries.filter(fn); },
  recent(limit=50){ return [...this.entries].slice(-limit); },
  load(){ this.entries = JSON.parse(localStorage.getItem("AI_MEMORY")||"[]"); }
};
AI_MEMORY.load();
window.__AI_MEMORY__=AI_MEMORY;

// EMBEDDINGS
const AI_EMBEDDINGS = {
  items: [],
  async add(text,metadata={}){

    const gov = window.__AI_GOVERNOR__;

    // THROTTLE
    const now = Date.now();
    if(gov && (now - gov.lastEmbeddingAt < gov.embeddingThrottleMs)){
      return;
    }
    if(gov) gov.lastEmbeddingAt = now;

    if(window.__AI_EMBED_CACHE__?.has(text)) return;
    window.__AI_EMBED_CACHE__ = window.__AI_EMBED_CACHE__ || new Map();
    window.__AI_EMBED_CACHE__.set(text,true);

    try{
      const res = await fetch("http://localhost:11434/api/embeddings",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"nomic-embed-text",prompt:text})
      });
      const data = await res.json();
      this.items.push({text,embedding:data.embedding,metadata,ts:Date.now()});

      // CAP
      if(gov && this.items.length > gov.maxEmbeddings){
        this.items = this.items.slice(-150);
      }

      localStorage.setItem("AI_EMBEDDINGS",JSON.stringify(this.items));
    }catch(e){}
  },
  cosine(a,b){
    let dot=0,ma=0,mb=0;
    for(let i=0;i<a.length;i++){dot+=a[i]*b[i];ma+=a[i]*a[i];mb+=b[i]*b[i];}
    return dot/(Math.sqrt(ma)*Math.sqrt(mb));
  },
  search(vec){
    return this.items.map(i=>({...i,score:this.cosine(vec,i.embedding)}))
      .sort((a,b)=>b.score-a.score).slice(0,10);
  },
  load(){ this.items = JSON.parse(localStorage.getItem("AI_EMBEDDINGS")||"[]"); }
};
AI_EMBEDDINGS.load();
window.__AI_EMBEDDINGS__=AI_EMBEDDINGS;

// PREFERENCES
const AI_PREFERENCES = {
  weights:{urgency:2,deadline:3,energy:-1,duration:-0.01},
  overrides:[],
  registerOverride(data){
    this.overrides.push({ts:Date.now(),data});
    localStorage.setItem("AI_PREFS",JSON.stringify(this));
  },
  evolve(){
    const o=this.overrides;
    const energy=o.filter(x=>x.data?.reason==="too_tiring").length;
    const deadline=o.filter(x=>x.data?.reason==="missed_deadline").length;
    this.weights.energy+=energy*0.01;
    this.weights.urgency=(this.weights.urgency||2)+deadline*0.02;
    localStorage.setItem("AI_PREFS",JSON.stringify(this));
  },
  load(){
    const d=JSON.parse(localStorage.getItem("AI_PREFS")||"null");
    if(d){Object.assign(this,d);} }
};
AI_PREFERENCES.load();
window.__AI_PREFERENCES__=AI_PREFERENCES;

// EXPLAIN
const AI_EXPLAIN={
  traces:[],
  add(t){
    this.traces.push(t);

    // CAP
    const gov = window.__AI_GOVERNOR__;
    if(gov && this.traces.length > gov.maxExplainTraces){
      this.traces = this.traces.slice(-150);
    }

    localStorage.setItem("AI_EXPLAIN",JSON.stringify(this.traces));
  },
  get(id){return this.traces.find(t=>t.taskId===id);},
  load(){this.traces=JSON.parse(localStorage.getItem("AI_EXPLAIN")||"[]");}
};
AI_EXPLAIN.load();
window.__AI_EXPLAIN__=AI_EXPLAIN;