/*
AI CONTROL LAYER
Central governance system for all AI-driven mutations
*/

// -----------------------------
// AI TOGGLE STATE (GLOBAL)
// -----------------------------

const AI_FLAGS = {
  day: true,
  week: true,
  month: true,
  checkins: true,
  scheduler: true,
  rebalancer: true,
  ui: true
};

function aiEnabled(scope){
  return AI_FLAGS[scope] !== false;
}

function setAI(scope, value){
  if(scope in AI_FLAGS){
    AI_FLAGS[scope] = !!value;
  }
}

function getAIState(){
  return { ...AI_FLAGS };
}

const AI_FEEDBACK_LOG = [];

function logAIEvent(event){
  AI_FEEDBACK_LOG.push({ ts: Date.now(), ...event });
  if(AI_FEEDBACK_LOG.length > 500) AI_FEEDBACK_LOG.shift();
}

function registerUserOverride(scope, action){
  logAIEvent({ type: "override", scope, action });
  const recent = AI_FEEDBACK_LOG.filter(e => e.scope === scope && e.type === "override").length;
  if(recent > 3) AI_FLAGS[scope] = false;
}

function registerAIAction(scope, action){
  logAIEvent({ type: "ai_action", scope, action });
}

function persistAIState(){
  try{
    localStorage.setItem("AI_FLAGS", JSON.stringify(AI_FLAGS));
    localStorage.setItem("AI_FEEDBACK_LOG", JSON.stringify(AI_FEEDBACK_LOG));
  }catch(e){}
}

function loadAIState(){
  try{
    Object.assign(AI_FLAGS, JSON.parse(localStorage.getItem("AI_FLAGS")||"{}"));
    AI_FEEDBACK_LOG.push(...JSON.parse(localStorage.getItem("AI_FEEDBACK_LOG")||"[]"));
  }catch(e){}
}

loadAIState();

window.__AI_CONTROL__ = {
  aiEnabled,
  setAI,
  getAIState,
  registerUserOverride,
  registerAIAction
};