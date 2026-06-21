/*
AI INTEGRATION LAYER (ADDED)
Wires runtime into AI_CONTROL + AI_ADAPTER system
*/

(function initAIIntegration(){

  const AI_CONTROL = window.__AI_CONTROL__;
  const AI_ADAPTER = window.__AI_ADAPTER__;

  if(!AI_ADAPTER) return;

  window.aiQuery = async function({scope="general", input={}, mode="auto"}){

    if(AI_CONTROL && !AI_CONTROL.aiEnabled(scope)){
      AI_CONTROL.registerAIAction?.(scope, {type:"blocked", input});
      return { output: null, blocked: true };
    }

    const result = await AI_ADAPTER.queryAI({
      scope,
      input,
      mode,
      AI_CONTROL
    });

    AI_CONTROL?.registerAIAction?.(scope, {type:"executed", provider: result.provider});

    window.__AI_MEMORY__?.add?.({
      ts: Date.now(),
      type: "ai_action",
      scope,
      data: result
    });

    window.__AI_EXPLAIN__?.add?.({
      taskId: input?.id || null,
      scope,
      provider: result.provider,
      breakdown: result
    });

    return result;
  };

  window.aiSchedule = async function(task){
    return window.aiQuery({ scope:"scheduler", input: task, mode:"auto" });
  };

  window.aiCheckin = async function(data){
    return window.aiQuery({ scope:"checkins", input: data, mode:"auto" });
  };

  window.runAIInstall = async function(){
    return window.__AI_BOOTSTRAP__?.runBootstrap?.() || { error:"no_installer" };
  };

  window.aiEvolvePreferences = function(){
    window.__AI_PREFERENCES__?.evolve?.();
  };

  window.getAIExplanation = function(taskId){
    return window.__AI_EXPLAIN__?.get?.(taskId);
  };

})();

// =====================================================
// MATERIALIZED AI SUBSYSTEMS (FINAL LAYER)
// =====================================================

// -----------------------------
// MEMORY ENGINE
// -----------------------------

const AI_MEMORY = {
  entries: [],

  add(entry){
    this.entries.push(entry);
    localStorage.setItem("AI_MEMORY", JSON.stringify(this.entries));
  },

  query(fn){
    return this.entries.filter(fn);
  },

  load(){
    this.entries = JSON.parse(localStorage.getItem("AI_MEMORY") || "[]");
  }
};

AI_MEMORY.load();
window.__AI_MEMORY__ = AI_MEMORY;

// -----------------------------
// EMBEDDINGS STORE
// -----------------------------

const AI_EMBEDDINGS = {
  items: [],

  async add(text, metadata={}){
    try{
      const res = await fetch("http://localhost:11434/api/embeddings", {
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"nomic-embed-text", prompt:text })
      });

      const data = await res.json();

      this.items.push({
        text,
        embedding:data.embedding,
        metadata,
        ts:Date.now()
      });

      localStorage.setItem("AI_EMBEDDINGS", JSON.stringify(this.items));
    }catch(e){}
  },

  cosine(a,b){
    let dot=0,ma=0,mb=0;
    for(let i=0;i<a.length;i++){
      dot+=a[i]*b[i];
      ma+=a[i]*a[i];
      mb+=b[i]*b[i];
    }
    return dot/(Math.sqrt(ma)*Math.sqrt(mb));
  },

  search(vec){
    return this.items
      .map(i=>({...i,score:this.cosine(vec,i.embedding)}))
      .sort((a,b)=>b.score-a.score)
      .slice(0,10);
  },

  load(){
    this.items = JSON.parse(localStorage.getItem("AI_EMBEDDINGS")||"[]");
  }
};

AI_EMBEDDINGS.load();
window.__AI_EMBEDDINGS__ = AI_EMBEDDINGS;

// -----------------------------
// PREFERENCE ENGINE
// -----------------------------

const AI_PREFERENCES = {
  weights:{ urgency:2, deadline:3, energy:-1, duration:-0.01 },
  overrides:[],

  registerOverride(data){
    this.overrides.push({ ts:Date.now(), data });
    localStorage.setItem("AI_PREFS", JSON.stringify(this));
  },

  evolve(){
    const o = this.overrides;

    const energy = o.filter(x=>x.data?.reason==="too_tiring").length;
    const deadline = o.filter(x=>x.data?.reason==="missed_deadline").length;

    this.weights.energy += energy*0.01;
    this.weights.urgency = (this.weights.urgency||2) + deadline*0.02;

    localStorage.setItem("AI_PREFS", JSON.stringify(this));
  },

  load(){
    const d = JSON.parse(localStorage.getItem("AI_PREFS")||"null");
    if(d){ Object.assign(this,d); }
  }
};

AI_PREFERENCES.load();
window.__AI_PREFERENCES__ = AI_PREFERENCES;

// -----------------------------
// EXPLAINABILITY ENGINE
// -----------------------------

const AI_EXPLAIN = {
  traces: [],

  add(trace){
    this.traces.push(trace);
    localStorage.setItem("AI_EXPLAIN", JSON.stringify(this.traces));
  },

  get(taskId){
    return this.traces.find(t=>t.taskId===taskId);
  },

  load(){
    this.traces = JSON.parse(localStorage.getItem("AI_EXPLAIN")||"[]");
  }
};

AI_EXPLAIN.load();
window.__AI_EXPLAIN__ = AI_EXPLAIN;