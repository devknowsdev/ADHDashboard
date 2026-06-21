/*
AI INTEGRATION LAYER (ADDED)
*/

(function initAIIntegration(){

  const AI_CONTROL = window.__AI_CONTROL__;
  const AI_ADAPTER = window.__AI_ADAPTER__;

  if(!AI_ADAPTER) return;

  window.__AI_MODE__ = window.__AI_MODE__ || {
    value: "full"
  };

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
    if(mode === "assist") return scope === "scheduler" || scope === "checkins";
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

    window.__AI_MEMORY__?.add?.({ts:Date.now(),type:"ai_action",scope,data:result});

    window.__AI_EXPLAIN__?.add?.({taskId:input?.id || input?.taskId || null,scope,provider:result.provider,breakdown:result});

    const text = typeof input === "string" ? input : JSON.stringify(input);
    window.__AI_EMBEDDINGS__?.add?.(text,{scope});

    return result;
  };

  // scheduler
  window.aiSchedule = async function(task){
    const context = {
      task,
      memory: window.__AI_MEMORY__?.recent?.(20) || [],
      prefs: window.__AI_PREFERENCES__?.weights || {}
    };
    return window.aiQuery({scope:"scheduler",input:context,mode:"auto"});
  };

  window.aiOverride = function(taskId,change){
    window.__AI_MEMORY__?.add?.({ts:Date.now(),type:"override",scope:"scheduler",data:{taskId,change}});
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
    el.addEventListener("click",()=>window.renderAIExplainPanel?.(task.id));
  };

  // =============================
  // PERFORMANCE DASHBOARD (NEW)
  // =============================

  window.__AI_PERF = {
    get(){
      const gov = window.__AI_GOVERNOR__;
      return {
        mode: window.__AI_MODE__?.value,
        memory: window.__AI_MEMORY__?.entries?.length || 0,
        embeddings: window.__AI_EMBEDDINGS__?.items?.length || 0,
        explain: window.__AI_EXPLAIN__?.traces?.length || 0,
        lastEmbeddingAt: gov?.lastEmbeddingAt || 0
      };
    }
  };

  window.attachAIPerfDashboard = function(){

    if(document.getElementById("ai-perf-dashboard")) return;

    const el = document.createElement("div");
    el.id = "ai-perf-dashboard";
    el.style.position = "fixed";
    el.style.bottom = "10px";
    el.style.right = "10px";
    el.style.width = "220px";
    el.style.fontSize = "11px";
    el.style.background = "rgba(0,0,0,0.75)";
    el.style.color = "#fff";
    el.style.padding = "8px";
    el.style.borderRadius = "8px";
    el.style.zIndex = "99999";

    function render(){
      const s = window.__AI_PERF.get();
      el.innerHTML = `
        <div><b>AI PERF</b></div>
        <div>mode: ${s.mode}</div>
        <div>memory: ${s.memory}</div>
        <div>embeddings: ${s.embeddings}</div>
        <div>explain: ${s.explain}</div>
        <div>embed ts: ${s.lastEmbeddingAt}</div>
      `;
    }

    render();
    setInterval(render, 2500);

    document.body.appendChild(el);
  };

  setTimeout(()=>window.attachAIPerfDashboard?.(),800);

})();

// =============================
// SUBSYSTEMS
// =============================

const AI_MEMORY = {
  entries: [],
  add(entry){
    this.entries.push(entry);
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

const AI_EMBEDDINGS = {
  items: [],
  async add(text,metadata={}){
    const gov = window.__AI_GOVERNOR__;
    const now = Date.now();

    if(gov && now - gov.lastEmbeddingAt < gov.embeddingThrottleMs) return;
    if(gov) gov.lastEmbeddingAt = now;

    window.__AI_EMBED_CACHE__ = window.__AI_EMBED_CACHE__ || new Map();
    if(window.__AI_EMBED_CACHE__.has(text)) return;
    window.__AI_EMBED_CACHE__.set(text,true);

    try{
      const res = await fetch("http://localhost:11434/api/embeddings",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"nomic-embed-text",prompt:text})
      });
      const data = await res.json();

      this.items.push({text,embedding:data.embedding,metadata,ts:Date.now()});

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

const AI_EXPLAIN={
  traces:[],
  add(t){
    this.traces.push(t);
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