/*
MODULE: ai.js
LAYER: services
PURPOSE: AI integration layer — Ollama + Anthropic providers, feature helpers, settings.
OWNS: ai.js responsibilities
USES: state.js, storage.js, helpers.js
STATE_READS: aiSettings, aiStatus, categories, tasks, journalEntries
STATE_WRITES: aiSettings, aiStatus, aiPendingParse, aiPendingSuggestion, wizAiPrompt, wizDayEndPrompt, wizCarryOverInsight, weeklyAiNudge
PUBLIC_API: aiCall, aiCallJson, aiParseTask, aiInterpretJournalEntry, aiWizardPrompt, aiBreakdownTask, aiDayEndPrompt, aiCarryOverInsight, aiWeeklyNudge, aiDailyPlanSuggestion, loadAiSettings, saveAiSettings, settingsSetAiMaster, dumpAiParse, dumpAiConfirm, dumpAiInterpret, dumpAiInterpretAddTasks, dumpAiInterpretClose, dumpAiDailyPlan, dumpAiDailyPlanAddTasks, dumpAiDailyPlanClose, taskAiBreakdown
DEPENDENCIES: storage.js (save), render.js (render), ui.js (showToast)
INVARIANTS: all AI calls return null on failure; voice/journal never sent to providers
LAST_STABILIZED: 2026-06-21
*/

// ── Provider constants ────────────────────────────────────────────────────────
const AI_PROVIDER_OLLAMA    = 'ollama';
const AI_PROVIDER_ANTHROPIC = 'anthropic';
const AI_TIMEOUT_MS         = 8000;
const AI_MAX_TOKENS         = 512;
const OLLAMA_DEFAULT_URL    = 'http://localhost:11434';
const OLLAMA_DEFAULT_MODEL  = 'llama3.2';
const ANTHROPIC_MODEL       = 'claude-haiku-4-5';
const ANTHROPIC_ENDPOINT    = 'https://api.anthropic.com/v1/messages';

// ── Core call ─────────────────────────────────────────────────────────────────

async function aiCall(systemPrompt, userPrompt, opts = {}) {
  if (!aiSettings.masterEnabled) return null;

  const order = aiSettings.providerOrder || [AI_PROVIDER_OLLAMA, AI_PROVIDER_ANTHROPIC];

  for (const provider of order) {
    if (provider === AI_PROVIDER_OLLAMA && aiSettings.ollamaEnabled) {
      const result = await _ollamaCall(systemPrompt, userPrompt, opts);
      if (result !== null) {
        aiStatus.ollama = 'ok';
        return result;
      }
      aiStatus.ollama = 'error';
    }
    if (provider === AI_PROVIDER_ANTHROPIC && aiSettings.anthropicEnabled
        && aiSettings.anthropicKey) {
      const result = await _anthropicCall(systemPrompt, userPrompt, opts);
      if (result !== null) {
        aiStatus.anthropic = 'ok';
        return result;
      }
      aiStatus.anthropic = 'error';
    }
  }
  return null;
}

async function _ollamaCall(systemPrompt, userPrompt, opts = {}) {
  try {
    const url  = (aiSettings.ollamaUrl  || OLLAMA_DEFAULT_URL).replace(/\/$/, '');
    const model = aiSettings.ollamaModel || OLLAMA_DEFAULT_MODEL;
    const fullPrompt = systemPrompt
      ? `${systemPrompt}\n\n${userPrompt}`
      : userPrompt;

    const body = {
      model,
      prompt:    fullPrompt,
      stream:    false,
      options: {
        num_predict: opts.maxTokens || AI_MAX_TOKENS,
        temperature: opts.temperature ?? 0.3,
      },
    };

    const response = await fetch(`${url}/api/generate`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(opts.timeout || AI_TIMEOUT_MS),
    });

    if (!response.ok) {
      const txt = await response.text().catch(()=>'');
      aiStatus.ollama = 'error';
      aiStatus.ollamaError = `HTTP ${response.status} ${String(txt).slice(0,200)}`;
      console.warn('Ollama call error:', response.status, txt);
      return null;
    }
    const data = await response.json();
    return (data.response || '').trim() || null;

  } catch (e) {
    aiStatus.ollama = 'error';
    aiStatus.ollamaError = e && e.message ? e.message : String(e);
    console.warn('Ollama call failed:', e);
    return null;
  }
}

async function _anthropicCall(systemPrompt, userPrompt, opts = {}) {
  try {
    const body = {
      model:      ANTHROPIC_MODEL,
      max_tokens: opts.maxTokens || AI_MAX_TOKENS,
      messages:   [{ role: 'user', content: userPrompt }],
    };
    if (systemPrompt) body.system = systemPrompt;

    const response = await fetch(ANTHROPIC_ENDPOINT, {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         aiSettings.anthropicKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body:   JSON.stringify(body),
      signal: AbortSignal.timeout(opts.timeout || AI_TIMEOUT_MS),
    });

    if (!response.ok) {
      const txt = await response.text().catch(()=>'');
      aiStatus.anthropic = 'error';
      aiStatus.anthropicError = `HTTP ${response.status} ${String(txt).slice(0,200)}`;
      console.warn('Anthropic call error:', response.status, txt);
      return null;
    }
    const data = await response.json();
    return data.content?.[0]?.text?.trim() || null;

  } catch (e) {
    aiStatus.anthropic = 'error';
    aiStatus.anthropicError = e && e.message ? e.message : String(e);
    console.warn('Anthropic call failed:', e);
    return null;
  }
}

async function aiCallJson(systemPrompt, userPrompt, opts = {}) {
  const raw = await aiCall(systemPrompt, userPrompt, {
    ...opts,
    temperature: opts.temperature ?? 0.1,
  });
  if (!raw) return null;
  try {
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    const match = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try { return JSON.parse(match[1]); } catch (e2) { return null; }
    }
    return null;
  }
}

async function aiCheckOllama() {
  try {
    const url = (aiSettings.ollamaUrl || OLLAMA_DEFAULT_URL).replace(/\/$/, '');
    const r = await fetch(`${url}/api/tags`, {
      signal: AbortSignal.timeout(3000),
    });
    if (r.ok) {
      const data = await r.json();
      aiStatus.ollama = 'ok';
      return {
        ok: true,
        models: (data.models || []).map(m => m.name),
      };
    }
    aiStatus.ollama = 'error';
    return { ok: false, error: `HTTP ${r.status}` };
  } catch (e) {
    aiStatus.ollama = 'error';
    return { ok: false, error: e.message || 'Unreachable' };
  }
}

async function aiCheckAnthropic() {
  if (!aiSettings.anthropicKey) {
    return { ok: false, error: 'No API key set' };
  }
  const result = await _anthropicCall(
    'You are a test.',
    'Reply with the single word: ok',
    { maxTokens: 5, timeout: 5000 }
  );
  const ok = result !== null && result.toLowerCase().includes('ok');
  aiStatus.anthropic = ok ? 'ok' : 'error';
  return { ok, error: ok ? null : 'Key invalid or unreachable' };
}

// ── High-level feature functions ──────────────────────────────────────────────

async function aiParseTask(rawText) {
  if (!rawText || !rawText.trim()) return null;

  const catNames = categories.map(c => c.name).join(', ');
  const system = `You are a task parser for a productivity app.
Extract task details from natural language input.
Available categories: ${catNames || 'none'}.
Respond ONLY with valid JSON, no explanation, no markdown fences.
JSON shape: {"text":"task name","ts":"HH:MM or empty","catId":"category id or empty","taskScope":"day or project","note":"extra context or empty"}
Rules:
- text: the core task, concise
- ts: 24h time if mentioned, else empty string
- catId: match to available category ids if relevant, else empty string
- taskScope: "day" if one-off or time-specific, "project" if ongoing/multi-step
- note: anything that doesn't fit the task name
Category ids and names: ${categories.map(c => `${c.id}="${c.name}"`).join(', ') || 'none'}`;

  return await aiCallJson(system, rawText.trim());
}

async function aiInterpretJournalEntry(rawText) {
  if (!rawText || !rawText.trim()) return null;

  const categoryList = categories.map(c => `${c.id}="${c.name}"`).join(', ') || 'none';
  const system = `You are an ADHD journaling assistant.
Read the user's journal entry and return ONLY valid JSON with no explanation or markdown fences.
Available categories: ${categoryList}.
JSON shape:
{
  "summary":"brief summary of the entry",
  "insight":"optional reflective observation or theme",
  "taskSuggestions":[
    {"text":"task name","ts":"HH:MM or empty","catId":"category id or empty","taskScope":"day or project","note":"why this task is useful or what to do"}
  ]
}
Rules:
- summary should be one short sentence.
- insight should be a helpful observation or leave empty if not applicable.
- If no task can be suggested, return taskSuggestions as an empty array.
- Do not invent categories; use only available category ids or leave catId empty.`;

  const rawResult = await aiCallJson(system, rawText.trim());
  return _sanitizeInterpretedJournalResult(rawResult);
}

function _normalizeJournalTime(raw) {
  const str = String(raw || '').trim();
  return /^\d{1,2}:\d{2}$/.test(str) ? str : '';
}

function _normalizeInterpretedTaskScope(raw) {
  const scope = String(raw || '').trim().toLowerCase();
  return scope === 'project' ? 'project' : 'day';
}

function _normalizeInterpretedTaskSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== 'object') return null;
  const text = String(suggestion.text || '').trim();
  if (!text) return null;

  const validCatIds = new Set(categories.map(c => c.id));
  const catId = String(suggestion.catId || '').trim();
  return {
    text,
    ts: _normalizeJournalTime(suggestion.ts),
    catId: validCatIds.has(catId) ? catId : '',
    taskScope: _normalizeInterpretedTaskScope(suggestion.taskScope),
    note: String(suggestion.note || '').trim(),
  };
}

function _sanitizeInterpretedJournalResult(result) {
  if (!result || typeof result !== 'object') return null;
  return {
    summary: String(result.summary || '').trim(),
    insight: String(result.insight || '').trim(),
    taskSuggestions: Array.isArray(result.taskSuggestions)
      ? result.taskSuggestions
          .map(_normalizeInterpretedTaskSuggestion)
          .filter(Boolean)
      : [],
  };
}

function _normalizeDailyPlanSuggestionItem(item) {
  if (!item || typeof item !== 'object') return null;
  const text = String(item.text || '').trim();
  if (!text) return null;
  return {
    text,
    ts: _normalizeJournalTime(item.ts),
    note: String(item.note || '').trim(),
  };
}

function _sanitizeDailyPlanSuggestionResult(result) {
  if (!result || typeof result !== 'object') return null;
  return {
    summary: String(result.summary || '').trim(),
    taskSuggestions: Array.isArray(result.taskSuggestions)
      ? result.taskSuggestions.map(_normalizeDailyPlanSuggestionItem).filter(Boolean)
      : [],
  };
}

async function aiDailyPlanSuggestion(energy, scheduledCount, unscheduledCount, topAvoidanceTask, habitSummary) {
  const system = `You are an ADHD planning assistant.
Read the user's current energy, schedule, unscheduled work, and habit pattern.
Respond ONLY with valid JSON and no markdown fences.
JSON shape:
{
  "summary":"brief planning suggestion",
  "taskSuggestions":[
    {"text":"short task idea","ts":"HH:MM or empty","note":"why this helps"}
  ]
}
Keep suggestions concrete, grounded in the user's current day, and avoid vague generalities.`;
  const user = `Energy: ${energy || 3}/5.
Scheduled tasks: ${scheduledCount}.
Unscheduled tasks: ${unscheduledCount}.
Top avoided task: ${topAvoidanceTask || 'none'}.
Habit note: ${habitSummary || 'none'}.`;
  const rawResult = await aiCallJson(system, user, { maxTokens: 180 });
  return _sanitizeDailyPlanSuggestionResult(rawResult);
}

async function dumpAiDailyPlan() {
  if (!aiSettings.masterEnabled || !(aiSettings.ollamaEnabled || aiSettings.anthropicEnabled)) {
    showToast('AI suggestions unavailable; enable an AI provider first', 'warn');
    return;
  }
  const todayStr = new Date().toDateString();
  const energyEntry = getEnergyToday ? getEnergyToday(todayStr) : null;
  const energy = energyEntry ? energyEntry.energy : 3;
  const scheduledCount = tasks.filter(t => t.ts && t.status !== 'done').length;
  const unscheduledCount = tasks.filter(t => !t.ts && t.status !== 'done').length;
  const topAvoidance = tasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => avoidanceScore(b) - avoidanceScore(a))[0];
  const doneHabitCount = (typeof getAllHitsForHabit === 'function')
    ? habits.filter(h => getAllHitsForHabit(h, todayStr).length).length
    : 0;
  const habitSummary = habits.length
    ? `${habits.length} habits, ${doneHabitCount} logged today`
    : 'no habits yet';
  showToast('Asking AI for a daily plan suggestion…', 'ok');
  const suggestion = await aiDailyPlanSuggestion(energy, scheduledCount, unscheduledCount, topAvoidance ? topAvoidance.text : '', habitSummary);
  if (!suggestion) {
    showToast('Could not get AI suggestion', 'warn');
    aiAuditLog.push({
      ts: Date.now(),
      cmd: 'dailyPlanSuggestion',
      args: { energy, scheduledCount, unscheduledCount, topAvoidance: topAvoidance ? topAvoidance.text : '', habitSummary },
      result: { ok: false, error: 'could not generate suggestion' },
      userConfirmed: false,
    });
    return;
  }
  aiPendingSuggestion = suggestion;
  aiAuditLog.push({
    ts: Date.now(),
    cmd: 'dailyPlanSuggestion',
    args: { energy, scheduledCount, unscheduledCount, topAvoidance: topAvoidance ? topAvoidance.text : '', habitSummary },
    result: { ok: true, suggestions: suggestion.taskSuggestions.length },
    userConfirmed: false,
  });
  render();
}

function dumpAiDailyPlanAddTasks() {
  if (!aiPendingSuggestion || !Array.isArray(aiPendingSuggestion.taskSuggestions)) return;
  const suggestions = aiPendingSuggestion.taskSuggestions;
  const now = Date.now();
  const added = [];
  suggestions.forEach((item, index) => {
    if (!item || !item.text) return;
    const task = {
      id: now + index,
      text: item.text,
      catId: '',
      done: false,
      status: 'todo',
      taskScope: 'day',
      doneDate: '',
      ts: item.ts || '',
      durationMins: null,
      order: nextTaskOrder ? nextTaskOrder() : (tasks.length ? tasks.length : 0),
      createdAt: now,
      repeat: null,
      templateId: null,
      generatedForDate: null,
      pinned: false,
      energyRequired: null,
      anxiety: 0,
      urgency: 0,
      subtasks: [],
      estimatedMins: null,
      note: item.note || '',
    };
    tasks.push(task);
    added.push(task.text);
  });
  if (added.length) {
    if (typeof save === 'function') save();
    showToast(`Added ${added.length} suggested task${added.length === 1 ? '' : 's'}`, 'ok');
  } else {
    showToast('No valid AI suggestions to add', 'warn');
  }
  aiAuditLog.push({
    ts: Date.now(),
    cmd: 'addDailyPlanSuggestedTasks',
    args: { added: added.length },
    result: { ok: added.length > 0, added },
    userConfirmed: false,
  });
  aiPendingSuggestion = null;
  if (typeof render === 'function') render();
}

function dumpAiDailyPlanClose() {
  aiPendingSuggestion = null;
  if (typeof render === 'function') render();
}

// --- Local adapter helpers and Plan preview UI glue ---
async function aiAdapterIsAvailable() {
  if (typeof window === 'undefined' || !window.AiAdapter) return false;
  try { return await window.AiAdapter.isAvailable(); } catch (e) { return false; }
}

async function aiAdapterBuildGraph(opts) {
  if (typeof window === 'undefined' || !window.AiAdapter) return null;
  try { return await window.AiAdapter.buildGraph(opts); } catch (e) { console.warn('AiAdapter.buildGraph failed', e); return null; }
}

// Prompt the user for a short description and request a plan preview from the local adapter.
// Falls back to the existing daily-plan suggestion path if the adapter is unavailable.
async function openAiPlanPrompt() {
  const desc = window.prompt('Describe what you want planned (short):');
  if (!desc) return;
  showToast('Generating plan preview…', 'ok');
  let res = null;
  if (await aiAdapterIsAvailable()) {
    res = await aiAdapterBuildGraph({ graphId: 'plan-' + Date.now(), projectId: 'dashboard', description: desc, mode: 'build_feature' });
  }
  if (!res) {
    // fallback: reuse the daily-plan suggestion flow as a graceful alternative
    const suggestion = await aiDailyPlanSuggestion(3, tasks.filter(t => t.ts && t.status !== 'done').length, tasks.filter(t => !t.ts && t.status !== 'done').length, '', '');
    if (suggestion) {
      aiPendingPlan = { source: 'fallback-daily-plan', graph: { id: 'fallback', projectId: 'dashboard', nodes: suggestion.taskSuggestions.map((t, i) => ({ id: 's' + i, status: 'suggested', packet: { text: t.text, ts: t.ts, note: t.note } })) } };
      render();
      return;
    }
    showToast('Local AI unavailable and fallback failed', 'warn');
    return;
  }
  aiPendingPlan = res;
  render();
}

function closeAiPlanPreview() {
  aiPendingPlan = null;
  render();
}

async function copyAiPlanJson() {
  if (!aiPendingPlan) return;
  try {
    await navigator.clipboard.writeText(JSON.stringify(aiPendingPlan, null, 2));
    showToast('Plan JSON copied to clipboard', 'ok');
  } catch (e) {
    showToast('Copy failed', 'warn');
  }
}
 
// Execute the current aiPendingPlan (if present) using the local adapter and show live progress.
async function executeAiPendingPlan() {
  if (!aiPendingPlan) return showToast('No plan to execute', 'warn');
  if (!window.AiAdapter || typeof window.AiAdapter.executeGraph !== 'function') return showToast('Local executor unavailable', 'warn');
  showToast('Starting execution…', 'ok');
  const graph = aiPendingPlan.graph;
  // Require approval for nodes that may mutate files or run terminal commands.
  const risky = (graph.nodes||[]).filter(n => (Array.isArray(n.packet.filePaths) && n.packet.filePaths.length>0) || n.packet.node_type==='terminal' || (n.packet.context && n.packet.context.targetFile));
  const unapproved = risky.map(n=>n.id).filter(id=>!aiApprovedNodes[id]);
  if (unapproved.length>0 && aiSettings.executeRequiresConfirmation) {
    showToast('Execution blocked: approve file/terminal nodes first', 'warn');
    console.warn('Unapproved nodes:', unapproved);
    return;
  }
  const logAreaId = 'ai-exec-log-area';
  // Attach a simple log modal to show streaming events
  aiExecStreaming = true;
  render();
  window.AiAdapter.executeGraph(graph, 'sequential', (evt) => {
    if (!evt) return;
    if (evt.type === 'start') {
      console.log('exec start', evt);
    } else if (evt.type === 'node') {
      // attach to task_history area or console
      console.log('node update', evt.nodeId, evt.status, evt.result);
      // show in a simple toast per node status change
      showToast(`Node ${evt.nodeId}: ${evt.status}`, 'ok');
    } else if (evt.type === 'heartbeat') {
      // no-op
    } else if (evt.type === 'done') {
      showToast('Execution complete', 'ok');
      aiExecStreaming = false;
      render();
    } else if (evt.type === 'error') {
      showToast('Execution error: ' + String(evt.error), 'warn');
      aiExecStreaming = false;
      render();
    }
  }).catch((e) => {
    showToast('Execution failed to start', 'warn');
    aiExecStreaming = false;
    render();
  });
}

// Preview a node's diff by requesting the daemon run the graph in a temp workspace
async function previewNodeDiff(nodeId) {
  if (!aiPendingPlan || !aiPendingPlan.graph) return showToast('No plan to preview', 'warn');
  if (!window.AiAdapter || typeof window.AiAdapter.previewNode !== 'function') return showToast('Local adapter unavailable', 'warn');
  const graph = aiPendingPlan.graph;
  showToast('Generating preview diff…', 'ok');
  try {
    // Request a non-mock preview to produce high-fidelity diffs using real executors.
    const res = await window.AiAdapter.previewNode(graph, nodeId, { mockExecutors: false });
    aiPreviewDiff = { nodeId, diff: res.diff || '', logs: res.logs || [] };
    render();
  } catch (e) {
    showToast('Preview failed', 'warn');
  }
}

function approveNode(nodeId) {
  aiApprovedNodes[nodeId] = true;
  // Persist approval
  try {
    if (typeof saveAiApprovedNodesToStorage === 'function') saveAiApprovedNodesToStorage();
    else if (typeof window !== 'undefined' && typeof window.saveAiApprovedNodesToStorage === 'function') window.saveAiApprovedNodesToStorage();
  } catch (e) {
    console.warn('Failed to persist approved node', e);
  }
  showToast('Node approved', 'ok');
  render();
}

// Approve the node and request the daemon to apply it against the real workdir.
async function approveAndApplyNode(nodeId) {
  approveNode(nodeId);
  if (!window.AiAdapter || typeof window.AiAdapter.executeNode !== 'function') return showToast('Local adapter cannot apply node', 'warn');
  if (!aiPendingPlan || !aiPendingPlan.graph) return showToast('No plan available', 'warn');
  showToast('Applying node to project (this may take a moment)…', 'ok');
  try {
    const res = await window.AiAdapter.executeNode(aiPendingPlan.graph, nodeId);
    aiPreviewDiff = { nodeId, diff: res.diff || '', logs: res.logs || [] };
    showToast('Node applied', 'ok');
    render();
  } catch (e) {
    showToast('Apply failed', 'warn');
    console.error('apply error', e);
  }
}

// Undo (rollback) a node's checkpoint
async function undoNode(nodeId) {
  if (!confirm('Undo changes for this node? This will revert the node\'s checkpoint. Continue?')) return;
  if (!window.AiAdapter || typeof window.AiAdapter.rollbackNode !== 'function') return showToast('Local adapter cannot roll back node', 'warn');
  showToast('Requesting rollback…', 'ok');
  try {
    const res = await window.AiAdapter.rollbackNode(nodeId);
    if (res && res.ok) {
      showToast('Rollback applied', 'ok');
      render();
    } else {
      showToast('Rollback failed: ' + (res && res.error ? res.error : 'unknown'), 'warn');
    }
  } catch (e) {
    showToast('Rollback failed', 'warn');
    console.error('rollback error', e);
  }
}

async function dumpAiInterpret(journalId) {
  const entry = journalEntries.find(e => e.id === journalId);
  if (!entry) return;
  const raw = String(entry.text || '').trim();
  if (!raw) return;

  if (!aiSettings.masterEnabled || !(aiSettings.ollamaEnabled || aiSettings.anthropicEnabled)) {
    showToast('AI interpretation unavailable; enable an AI provider first', 'warn');
    return;
  }

  showToast('Interpreting journal entry…', 'ok');
  const interpreted = await aiInterpretJournalEntry(raw);
  if (!interpreted) {
    showToast('Could not interpret entry', 'warn');
    aiAuditLog.push({
      ts: Date.now(),
      cmd: 'interpretJournalEntry',
      args: { journalId },
      result: { ok: false, error: 'could not interpret' },
      userConfirmed: false,
    });
    return;
  }

  aiPendingInterpret = {
    journalId,
    rawText: raw,
    summary: interpreted.summary || '',
    insight: interpreted.insight || '',
    taskSuggestions: Array.isArray(interpreted.taskSuggestions) ? interpreted.taskSuggestions : [],
  };
  entry.aiInterpretedSummary = aiPendingInterpret.summary;
  entry.aiInterpretedInsight = aiPendingInterpret.insight;
  if (typeof save === 'function') save();
  aiAuditLog.push({
    ts: Date.now(),
    cmd: 'interpretJournalEntry',
    args: { journalId, rawText: raw },
    result: { ok: true, summary: aiPendingInterpret.summary, taskSuggestions: aiPendingInterpret.taskSuggestions.length },
    userConfirmed: false,
  });
  render();
}

function dumpAiInterpretAddTasks() {
  if (!aiPendingInterpret || !Array.isArray(aiPendingInterpret.taskSuggestions)) return;
  const suggestions = aiPendingInterpret.taskSuggestions;
  const now = Date.now();
  const added = [];
  const entry = journalEntries.find(e => e.id === aiPendingInterpret.journalId);

  suggestions.forEach((suggestion, index) => {
    const normalized = _normalizeInterpretedTaskSuggestion(suggestion);
    if (!normalized) return;
    const task = {
      id: now + index,
      text: normalized.text,
      catId: normalized.catId,
      done: false,
      status: 'todo',
      taskScope: normalized.taskScope,
      doneDate: '',
      ts: normalized.ts,
      durationMins: null,
      order: nextTaskOrder ? nextTaskOrder() : (tasks.length ? tasks.length : 0),
      createdAt: Date.now(),
      repeat: null,
      templateId: null,
      generatedForDate: null,
      pinned: false,
      energyRequired: null,
      anxiety: 0,
      urgency: 0,
      subtasks: [],
      estimatedMins: null,
      note: normalized.note,
    };
    tasks.push(task);
    added.push(task.text);
  });

  if (entry) {
    entry.aiInterpretedTasksAdded = added.length;
  }

  if (added.length) {
    if (typeof save === 'function') save();
    showToast(`Added ${added.length} interpreted task${added.length === 1 ? '' : 's'}`, 'ok');
  } else {
    showToast('No valid tasks found', 'warn');
  }
  aiAuditLog.push({
    ts: Date.now(),
    cmd: 'addInterpretedTasks',
    args: { journalId: aiPendingInterpret.journalId, added: added.length },
    result: { ok: added.length > 0, added },
    userConfirmed: false,
  });
  aiPendingInterpret = null;
  if (typeof render === 'function') render();
}

function dumpAiInterpretClose() {
  aiPendingInterpret = null;
  if (typeof render === 'function') render();
}

async function aiWizardPrompt(energy, scheduledCount, topAvoidanceTask) {
  const system = `You are a supportive productivity coach for someone with ADHD.
Write ONE short, warm sentence (max 15 words) to prompt them for today's task capture.
Be specific to their situation. No generic advice. No emojis. Lowercase.
Consider: energy level ${energy}/5, ${scheduledCount} tasks already scheduled${topAvoidanceTask ? ', they keep avoiding: "' + topAvoidanceTask + '"' : ''}.`;

  const user = `Energy: ${energy}/5. Scheduled: ${scheduledCount}. ${topAvoidanceTask ? 'Avoiding: "' + topAvoidanceTask + '"' : ''}`;

  return await aiCall(system, user, { maxTokens: 40 });
}

async function aiBreakdownTask(taskText, catName) {
  const system = `You are a task breakdown assistant for someone with ADHD.
Break the given task into 3-6 concrete, actionable subtasks.
Each subtask should be completable in under 30 minutes.
Respond ONLY with valid JSON array, no explanation.
JSON shape: [{"text":"subtask name"}, ...]
Keep subtask names short (under 8 words). Be specific, not vague.`;

  const user = `Task: "${taskText}"${catName ? ` (category: ${catName})` : ''}`;

  const result = await aiCallJson(system, user);
  if (!Array.isArray(result)) return null;
  return result.filter(x => x && typeof x.text === 'string' && x.text.trim());
}

async function aiDayEndPrompt(tasksCompleted, timeTrackedMins, tasksMissed) {
  const system = `You are a gentle end-of-day coach for someone with ADHD.
Write ONE short, non-judgmental question (max 20 words) to prompt reflection.
Base it on what actually happened today. No lecturing. No advice. Just curiosity.
Lowercase. End with a question mark.`;

  const user = `Completed: ${tasksCompleted} tasks. Tracked: ${timeTrackedMins} mins. Missed: ${tasksMissed} tasks.`;

  return await aiCall(system, user, { maxTokens: 50 });
}

async function aiCarryOverInsight(repeatedlyMissedTasks) {
  if (!repeatedlyMissedTasks || !repeatedlyMissedTasks.length) return null;

  const system = `You are a compassionate ADHD coach.
The user keeps not completing certain tasks. Write ONE warm, non-judgmental sentence
(max 20 words) that acknowledges this without criticism and opens a small question.
Lowercase. No advice.`;

  const user = `Tasks carried over multiple times: ${repeatedlyMissedTasks.slice(0, 3).map(t => '"' + t + '"').join(', ')}`;

  return await aiCall(system, user, { maxTokens: 50 });
}

async function aiWeeklyNudge(energyByDay, topAvoidedCategory) {
  const system = `You are a supportive ADHD coach reviewing weekly patterns.
Write ONE specific, warm observation (max 25 words) about the pattern you see.
Do not give advice. Just name what you notice. Lowercase.`;

  const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const energySummary = energyByDay
    .map((e, i) => `${dayNames[i]}: ${e !== null ? e.toFixed(1) : 'no data'}`)
    .join(', ');

  const user = `Weekly energy: ${energySummary}. Most avoided: ${topAvoidedCategory || 'unknown'}.`;

  return await aiCall(system, user, { maxTokens: 60 });
}

// ── Settings persistence ──────────────────────────────────────────────────────

function saveAiSettings() {
  const toSave = { ...aiSettings };
  const key = toSave.anthropicKey;
  delete toSave.anthropicKey;
  localStorage.setItem('adhd4_ai_settings', JSON.stringify(toSave));
  if (key) localStorage.setItem('adhd4_ai_key', key);
  else localStorage.removeItem('adhd4_ai_key');
}

function loadAiSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem('adhd4_ai_settings') || 'null');
    const key = localStorage.getItem('adhd4_ai_key') || '';
    aiSettings = {
      masterEnabled:    raw?.masterEnabled    ?? false,
      providerOrder:    raw?.providerOrder    ?? [AI_PROVIDER_OLLAMA, AI_PROVIDER_ANTHROPIC],
      ollamaEnabled:    raw?.ollamaEnabled    ?? false,
      ollamaUrl:        raw?.ollamaUrl        ?? OLLAMA_DEFAULT_URL,
      ollamaModel:      raw?.ollamaModel      ?? OLLAMA_DEFAULT_MODEL,
      anthropicEnabled: raw?.anthropicEnabled ?? false,
      anthropicKey:     key,
    };
  } catch (e) {
    aiSettings = {
      masterEnabled: false,
      providerOrder: [AI_PROVIDER_OLLAMA, AI_PROVIDER_ANTHROPIC],
      ollamaEnabled: false,
      ollamaUrl:     OLLAMA_DEFAULT_URL,
      ollamaModel:   OLLAMA_DEFAULT_MODEL,
      anthropicEnabled: false,
      anthropicKey:  '',
    };
  }
}

// ── Settings UI helpers ───────────────────────────────────────────────────────

function _aiStatusDot(provider) {
  const s = aiStatus[provider];
  const col = s === 'ok' ? T.green : s === 'error' ? T.pomo : T.muted2;
  const label = s === 'ok' ? 'Connected' : s === 'error' ? 'Error' : 'Not tested';
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:${col};">
    <span style="width:7px;height:7px;border-radius:50%;background:${col};display:inline-block;"></span>
    ${label}
  </span>`;
}

function _aiSparkle() {
  return `<span title="AI-generated" style="font-size:9px;color:${T.accent2};margin-left:3px;opacity:0.7;"><i class="ti ti-sparkles"></i></span>`;
}

function _aiProviderOrderValue() {
  const o = aiSettings.providerOrder || [];
  if (o.length === 1 && o[0] === AI_PROVIDER_OLLAMA) return 'ollama-only';
  if (o.length === 1 && o[0] === AI_PROVIDER_ANTHROPIC) return 'anthropic-only';
  if (o[0] === AI_PROVIDER_ANTHROPIC) return 'anthropic-first';
  return 'ollama-first';
}

function openSettings() {
  showSettingsModal = true;
  settingsTab = 'ai';
  render();
}

function openAiSettings() {
  openSettings();
}

function closeSettings() {
  showSettingsModal = false;
  render();
}

async function settingsTestOllama() {
  const result = await aiCheckOllama();
  aiStatus.ollama = result.ok ? 'ok' : 'error';
  render();
  if (result.ok && result.models) {
    showToast('Ollama connected. Models: ' + result.models.slice(0, 3).join(', '), 'ok');
  } else {
    showToast('Ollama unreachable: ' + result.error, 'warn');
  }
}

async function settingsTestAnthropic() {
  const result = await aiCheckAnthropic();
  aiStatus.anthropic = result.ok ? 'ok' : 'error';
  render();
  showToast(result.ok ? 'Claude API connected' : 'Claude API error: ' + result.error,
            result.ok ? 'ok' : 'warn');
}

function settingsSetAiMaster(val) {
  aiSettings.masterEnabled = val;
  saveAiSettings();
  render();
}

function settingsSetOllamaEnabled(val) {
  aiSettings.ollamaEnabled = val;
  saveAiSettings();
  render();
}

function settingsSetAiExecuteConfirmation(val) {
  aiSettings.executeRequiresConfirmation = !!val;
  saveAiSettings();
  render();
}

function settingsSetAiProviderOrder(val) {
  const map = {
    'ollama-first':     [AI_PROVIDER_OLLAMA, AI_PROVIDER_ANTHROPIC],
    'anthropic-first':  [AI_PROVIDER_ANTHROPIC, AI_PROVIDER_OLLAMA],
    'ollama-only':      [AI_PROVIDER_OLLAMA],
    'anthropic-only':   [AI_PROVIDER_ANTHROPIC],
  };
  aiSettings.providerOrder = map[val] || [AI_PROVIDER_OLLAMA, AI_PROVIDER_ANTHROPIC];
  saveAiSettings();
  render();
}

function settingsSaveAnthropicKey(key) {
  aiSettings.anthropicKey = key.trim();
  aiSettings.anthropicEnabled = !!key.trim();
  saveAiSettings();
  render();
}

function settingsSaveOllamaUrl(url) {
  aiSettings.ollamaUrl = url.trim() || OLLAMA_DEFAULT_URL;
  saveAiSettings();
  render();
}

function settingsSaveOllamaModel(model) {
  aiSettings.ollamaModel = model.trim() || OLLAMA_DEFAULT_MODEL;
  saveAiSettings();
  render();
}

function settingsSaveLocalAiToken(token) {
  const t = String(token || '').trim();
  if (t) localStorage.setItem('adhd4_local_ai_token', t);
  else localStorage.removeItem('adhd4_local_ai_token');
  showToast(t ? 'Local AI token saved' : 'Local AI token removed', 'ok');
  render();
}

function settingsSaveLocalAiUrl(url) {
  const v = String(url || '').trim();
  if (typeof localStorage !== 'undefined') {
    if (v) localStorage.setItem('adhd4_local_ai_url', v);
    else localStorage.removeItem('adhd4_local_ai_url');
  }
  showToast(v ? 'Local AI URL saved' : 'Local AI URL removed', 'ok');
  render();
}

async function settingsTestLocalAi() {
  const url = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_url')) || window.__AI_FORGE_LOCAL_URL__ || 'http://127.0.0.1:3000';
  const token = (typeof localStorage !== 'undefined' && localStorage.getItem('adhd4_local_ai_token')) || window.__AI_FORGE_LOCAL_TOKEN__ || '';
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/api/v1/health`, {
      method: 'GET',
      headers: token ? { 'x-local-token': token } : {},
      signal: AbortSignal.timeout(3000),
    });
    if (res.ok) {
      showToast('Local AI daemon reachable', 'ok');
    } else {
      showToast('Local AI daemon responded with error', 'warn');
    }
  } catch (e) {
    showToast('Local AI daemon unreachable', 'warn');
  }
  render();
}

function settingsToggleShowKey() {
  aiShowKey = !aiShowKey;
  render();
}

// --- Chat / Conversations UI helpers ---
async function openChatModal() {
  showChatModal = true;
  chatLoading = true;
  render();
  try {
    await loadConversations();
    // auto-open first conversation if present
    if (Array.isArray(chatConversations) && chatConversations.length && !activeConversationId) {
      await openConversation(chatConversations[0].id);
    }
  } finally {
    chatLoading = false;
    render();
  }
}

// --- File Manager UI helpers ---
async function openFileManager(){
  showFileManager = true;
  fileManagerLoading = true;
  render();
  try {
    await loadFileManagerFiles();
  } finally {
    fileManagerLoading = false;
    render();
  }
}

async function loadFileManagerFiles(){
  if (!window.AiAdapter || typeof window.AiAdapter.listAllAttachments !== 'function') return showToast('Local adapter unavailable', 'warn');
  try {
    const res = await window.AiAdapter.listAllAttachments();
    const files = res?.attachments || [];
    fileManagerFiles = files;
    // preload image previews into chatAttachmentMeta cache
    await Promise.all(files.map(async (f) => {
      if (!f || !f.id) return;
      const id = Number(f.id);
      if (chatAttachmentMeta && chatAttachmentMeta[id]) return;
      chatAttachmentMeta[id] = { ...f };
      const ct = (f.content_type || f.contentType || '').toString();
      if (ct.startsWith && ct.startsWith('image/')) {
        try {
          const blob = await window.AiAdapter.downloadAttachment(id).catch(()=>null);
          if (blob) chatAttachmentMeta[id].previewUrl = URL.createObjectURL(blob);
        } catch (e) {}
      }
    }));
    render();
  } catch (e) {
    console.error('loadFileManagerFiles error', e);
    showToast('Failed to load files', 'warn');
    fileManagerFiles = fileManagerFiles || [];
  }
}

async function addTagToAttachment(id, tag){
  if (!tag || !id) return;
  try {
    const res = await window.AiAdapter.addAttachmentTag(id, tag);
    // update local caches
    const tags = res?.tags || [];
    fileManagerFiles = (fileManagerFiles || []).map(f => f.id===id?{...f,tags}:f);
    if (!chatAttachmentMeta) chatAttachmentMeta = {};
    if (!chatAttachmentMeta[id]) chatAttachmentMeta[id] = { id };
    chatAttachmentMeta[id].tags = tags;
    render();
  } catch (e) {
    console.error('addTagToAttachment error', e);
    showToast('Failed to add tag', 'warn');
  }
}

async function removeTagFromAttachment(id, tag){
  if (!tag || !id) return;
  try {
    const res = await window.AiAdapter.removeAttachmentTag(id, tag);
    const tags = res?.tags || [];
    fileManagerFiles = (fileManagerFiles || []).map(f => f.id===id?{...f,tags}:f);
    if (chatAttachmentMeta && chatAttachmentMeta[id]) chatAttachmentMeta[id].tags = tags;
    render();
  } catch (e) {
    console.error('removeTagFromAttachment error', e);
    showToast('Failed to remove tag', 'warn');
  }
}

async function renameAttachment(id, filename){
  if (!id || !filename) return;
  try {
    const res = await window.AiAdapter.renameAttachment(id, filename);
    const att = res?.attachment || null;
    if (att) {
      fileManagerFiles = (fileManagerFiles || []).map(f => f.id===id?att:f);
      if (!chatAttachmentMeta) chatAttachmentMeta = {};
      chatAttachmentMeta[id] = { ...(chatAttachmentMeta[id] || {}), ...(att || {}) };
      showToast('Renamed', 'ok');
      render();
    }
  } catch (e) {
    console.error('renameAttachment error', e);
    showToast('Rename failed', 'warn');
  }
}

function selectFileManagerAttachment(id){
  fileManagerSelected = id;
  render();
}

// Delete an attachment (UI wrapper)
async function deleteAttachment(id){
  if (!id) return;
  if (!confirm('Delete this file? This action cannot be undone.')) return;
  if (!window.AiAdapter || typeof window.AiAdapter.deleteAttachment !== 'function') return showToast('Local adapter unavailable', 'warn');
  try {
    await window.AiAdapter.deleteAttachment(id);
    // remove from local caches
    fileManagerFiles = (fileManagerFiles || []).filter(f => f.id !== id);
    if (chatAttachmentMeta && chatAttachmentMeta[id] && chatAttachmentMeta[id].previewUrl) {
      try { URL.revokeObjectURL(chatAttachmentMeta[id].previewUrl); } catch (e) {}
      delete chatAttachmentMeta[id];
    }
    if (fileManagerSelected === id) fileManagerSelected = null;
    showToast('File deleted', 'ok');
    render();
  } catch (e) {
    console.error('deleteAttachment error', e);
    showToast('Delete failed', 'warn');
  }
}

// Move (physically rename) attachment
async function moveAttachment(id){
  if (!id) return;
  const dest = prompt('New filename (no path):', (fileManagerFiles.find(f=>f.id===id)||{}).filename || '');
  if (!dest) return;
  if (!window.AiAdapter || typeof window.AiAdapter.moveAttachment !== 'function') return showToast('Local adapter unavailable', 'warn');
  try {
    const res = await window.AiAdapter.moveAttachment(id, dest);
    const att = res?.attachment || null;
    if (att) {
      fileManagerFiles = (fileManagerFiles || []).map(f => f.id===id?att:f);
      if (!chatAttachmentMeta) chatAttachmentMeta = {};
      chatAttachmentMeta[id] = { ...(chatAttachmentMeta[id] || {}), ...(att || {}) };
      showToast('Moved', 'ok');
      render();
    }
  } catch (e) {
    console.error('moveAttachment error', e);
    showToast('Move failed', 'warn');
  }
}

// Compare selected file with another (prompt for other id)
async function compareSelectedWithPrompt(){
  if (!fileManagerSelected) return showToast('Select a file first', 'warn');
  const other = prompt('Enter other attachment id to compare with:');
  if (!other) return;
  const idA = Number(fileManagerSelected);
  const idB = Number(other);
  if (!window.AiAdapter || typeof window.AiAdapter.compareAttachments !== 'function') return showToast('Local adapter unavailable', 'warn');
  showToast('Computing diff…', 'ok');
  try {
    const res = await window.AiAdapter.compareAttachments(idA, idB);
    aiPreviewDiff = { nodeId: `cmp-${idA}-${idB}`, diff: res?.diff || '', kind: 'compare' };
    render();
  } catch (e) {
    console.error('compare error', e);
    showToast('Compare failed', 'warn');
  }
}

// Preview repair for an attachment (shows diff). Use applyRepair() to apply.
async function previewRepairAttachment(id){
  if (!id) return;
  if (!window.AiAdapter || typeof window.AiAdapter.repairAttachment !== 'function') return showToast('Local adapter unavailable', 'warn');
  showToast('Generating repair preview…', 'ok');
  try {
    const res = await window.AiAdapter.repairAttachment(id, { apply: false });
    aiPreviewDiff = { nodeId: `repair-${id}`, diff: res?.diff || '', kind: 'repair' };
    fileRepairPending = { id };
    render();
  } catch (e) {
    console.error('previewRepairAttachment error', e);
    showToast('Repair preview failed', 'warn');
  }
}

async function applyFileRepair(){
  if (!fileRepairPending || !fileRepairPending.id) return showToast('No pending repair', 'warn');
  const id = fileRepairPending.id;
  if (!confirm('Apply repair to file?')) return;
  if (!window.AiAdapter || typeof window.AiAdapter.repairAttachment !== 'function') return showToast('Local adapter unavailable', 'warn');
  showToast('Applying repair…', 'ok');
  try {
    const res = await window.AiAdapter.repairAttachment(id, { apply: true });
    aiPreviewDiff = { nodeId: `repair-${id}`, diff: res?.diff || '', kind: 'repair' };
    // Refresh files list and metadata
    await loadFileManagerFiles();
    fileRepairPending = null;
    showToast('Repair applied', 'ok');
    render();
  } catch (e) {
    console.error('applyFileRepair error', e);
    showToast('Apply failed', 'warn');
  }
}

async function loadConversations() {
  if (!window.AiAdapter || typeof window.AiAdapter.listConversations !== 'function') return showToast('Local adapter unavailable', 'warn');
  try {
    const res = await window.AiAdapter.listConversations();
    chatConversations = res?.conversations || [];
    render();
  } catch (e) {
    console.error('loadConversations error', e);
    showToast('Could not load conversations', 'warn');
  }
}

async function openConversation(convId) {
  activeConversationId = convId;
  chatLoading = true;
  render();
  try {
    await loadConversationMessages(convId);
  } finally {
    chatLoading = false;
    render();
  }
}

async function loadConversationMessages(convId) {
  if (!window.AiAdapter || typeof window.AiAdapter.getConversationMessages !== 'function') return showToast('Local adapter unavailable', 'warn');
  try {
    const res = await window.AiAdapter.getConversationMessages(convId);
    const messages = res?.messages || [];
    chatMessages[convId] = messages;
    render();

    // Collect unique attachment ids from messages and composer
    const attIdsSet = new Set();
    for (const m of messages) {
      try {
        const arr = m.attachments ? JSON.parse(m.attachments) : [];
        if (Array.isArray(arr)) arr.forEach(id => attIdsSet.add(Number(id)));
      } catch (e) {}
    }
    (chatComposerAttachments || []).forEach(id => attIdsSet.add(Number(id)));

    // Fetch metadata and image previews for any unknown attachments
    const toFetch = [];
    for (const id of attIdsSet) if (!chatAttachmentMeta || !chatAttachmentMeta[id]) toFetch.push(id);
    if (toFetch.length) {
      await Promise.all(toFetch.map(async (id) => {
        try {
          const metaRes = await window.AiAdapter.getAttachmentMeta(id).catch(()=>null);
          if (metaRes && metaRes.attachment) {
            chatAttachmentMeta[id] = metaRes.attachment;
            const ct = (chatAttachmentMeta[id].content_type || chatAttachmentMeta[id].contentType || '').toString();
            if (ct.startsWith && ct.startsWith('image/')) {
              try {
                const blob = await window.AiAdapter.downloadAttachment(id).catch(()=>null);
                if (blob) chatAttachmentMeta[id].previewUrl = URL.createObjectURL(blob);
              } catch (e) {}
            }
          }
        } catch (e) {}
      }));
      render();
    }
  } catch (e) {
    console.error('loadConversationMessages error', e);
    showToast('Failed to load messages', 'warn');
    chatMessages[convId] = chatMessages[convId] || [];
  }
}

async function sendChatPrompt() {
  const text = (chatComposerText || '').trim();
  if (!text) return;
  if (!window.AiAdapter || typeof window.AiAdapter.executeGraph !== 'function') return showToast('Local adapter unavailable', 'warn');
  chatComposerText = '';
  render();
  try {
    // Ensure conversation exists
    if (!activeConversationId) {
      const created = await window.AiAdapter.createConversation({ title: String(text).slice(0, 80) });
      activeConversationId = created?.id || null;
      await loadConversations();
    }

    // Post the user message to the conversation store (include attachments)
    try {
      await window.AiAdapter.postConversationMessage(activeConversationId, { role: 'user', prompt: text, attachments: chatComposerAttachments });
    } catch (e) {
      console.warn('Failed to post user message to conversation', e);
    }

    // Clear composer attachments after posting
    chatComposerAttachments = [];

    showToast('Sending to AI…', 'ok');

    // Build a single-node TaskGraph that includes the conversationId in context
    const graph = { id: 'chat-' + Date.now(), projectId: 'dashboard', nodes: [ { id: 'msg1', packet: { intent: text, context: { conversationId: activeConversationId }, constraints: [], dependencies: [], node_type: 'ui', filePaths: [] } } ] };

    // Run the graph via the adapter; when done, reload messages
    await window.AiAdapter.executeGraph(graph, 'sequential', (evt) => {
      if (!evt) return;
      if (evt.type === 'done') {
        loadConversationMessages(activeConversationId);
        showToast('AI responded', 'ok');
      } else if (evt.type === 'error') {
        showToast('AI error: ' + String(evt.error), 'warn');
      }
    });
  } catch (e) {
    console.error('sendChatPrompt error', e);
    showToast('Failed to send prompt', 'warn');
  }
}

// --- Attachment helpers for chat composer ---
function handleChatFileInput(files){
  if (!files || !files.length) return;
  uploadComposerAttachment(files[0]);
  // clear the input (caller passes this.files so clearing isn't necessary)
}

async function uploadComposerAttachment(file){
  if (!file) return;
  if (!window.AiAdapter || typeof window.AiAdapter.uploadAttachment !== 'function') return showToast('Local adapter unavailable', 'warn');
  showToast('Uploading attachment…', 'ok');
  try {
    if (!activeConversationId) {
      const created = await window.AiAdapter.createConversation({ title: `attachments-${Date.now()}` });
      activeConversationId = created?.id || null;
      await loadConversations();
    }
    const res = await window.AiAdapter.uploadAttachment(file, activeConversationId);
    if (res && res.id) {
      const id = Number(res.id);
      chatComposerAttachments.push(id);
      // cache metadata for faster UI rendering
      chatAttachmentMeta[id] = {
        id,
        filename: res.filename || file.name,
        content_type: res.contentType || res.content_type || file.type || null,
        size: res.size || null,
        created_at: Date.now(),
      };
      // if it's an image, fetch a small preview blob
      try {
        const ct = (chatAttachmentMeta[id].content_type || '').toString();
        if (ct.startsWith && ct.startsWith('image/')) {
          const blob = await window.AiAdapter.downloadAttachment(id).catch(()=>null);
          if (blob) chatAttachmentMeta[id].previewUrl = URL.createObjectURL(blob);
        }
      } catch (e) {}
      showToast('Attachment uploaded', 'ok');
      render();
    }
  } catch (e) {
    console.error('uploadComposerAttachment error', e);
    showToast('Upload failed', 'warn');
  }
}

function removeComposerAttachment(id){
  chatComposerAttachments = (chatComposerAttachments || []).filter(x => x !== id);
  render();
}

async function downloadAttachment(attachmentId){
  if (!window.AiAdapter || typeof window.AiAdapter.downloadAttachment !== 'function') return showToast('Local adapter unavailable', 'warn');
  try {
    const blob = await window.AiAdapter.downloadAttachment(attachmentId);
    const metaRes = await window.AiAdapter.getAttachmentMeta(attachmentId).catch(()=>null);
    const filename = metaRes?.attachment?.filename || `attachment-${attachmentId}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error('downloadAttachment error', e);
    showToast('Download failed', 'warn');
  }
}

// ── Dump widget integration ───────────────────────────────────────────────────

async function dumpAiParse() {
  const el = document.getElementById('journal-capture-text');
  if (!el || !el.value.trim()) return;
  const raw = el.value.trim();
  showToast('Parsing…', 'ok');
  const parsed = await aiParseTask(raw);
  if (!parsed) {
    showToast('Could not parse — adding as plain text', 'warn');
    return;
  }
  aiPendingParse = { ...parsed, rawText: raw };
  render();
}

function dumpAiConfirm() {
  if (!aiPendingParse) return;
  const now = Date.now();
  const taskText = aiPendingParse.text || aiPendingParse.rawText;
  tasks.push({
    id: now,
    text:       taskText,
    catId:      aiPendingParse.catId || '',
    done:       false,
    status:     'todo',
    taskScope:  aiPendingParse.taskScope || 'day',
    doneDate:   '',
    ts:         aiPendingParse.ts || '',
    durationMins: null,
    order:      nextTaskOrder(),
    createdAt:  now,
    repeat:     null,
    templateId: null,
    generatedForDate: null,
    pinned:     false,
    energyRequired: null,
    anxiety:    0,
    urgency:    0,
    subtasks:   [],
    estimatedMins: null,
    note:       aiPendingParse.note || '',
  });
  journalEntries.unshift({
    id: now + 1,
    type: 'todo',
    text: aiPendingParse.rawText,
    catId: aiPendingParse.catId || '',
    createdAt: now,
    aiParsed: true,
  });
  aiPendingParse = null;
  save();
  showToast('"' + taskText + '" added', 'ok');
  render();
}

function dumpAiEdit() {
  if (!aiPendingParse) return;
  const el = document.getElementById('journal-capture-text');
  if (el) el.value = aiPendingParse.text || aiPendingParse.rawText;
  aiPendingParse = null;
  render();
}

// ── Task breakdown integration ──────────────────────────────────────────────

async function taskAiBreakdown(taskId) {
  const t = getTask(taskId);
  if (!t) return;
  const cat = getCat(t.catId);
  showToast('Thinking…', 'ok');
  const subtasks = await aiBreakdownTask(t.text, cat ? cat.name : '');
  if (!subtasks || !subtasks.length) {
    showToast('Could not suggest subtasks', 'warn');
    return;
  }
  const maxOrder = Math.max(0, ...(t.subtasks || []).map(s => s.order || 0));
  subtasks.forEach((s, i) => {
    t.subtasks = t.subtasks || [];
    t.subtasks.push({
      id:            Date.now() + i,
      text:          s.text,
      done:          false,
      order:         maxOrder + i + 1,
      practiceCount: 0,
      musicMeta:     { key: '', tuning: '', bpm: null, lyrics: '' },
      estimatedMins: null,
    });
  });
  expandedSubtaskTaskIds.add(taskId);
  save();
  showToast(`Added ${subtasks.length} subtasks`, 'ok');
  render();
}

// ── Wizard async prompts ──────────────────────────────────────────────────────

async function _wizFetchPersonalisedPrompt(todayYmd) {
  wizAiPrompt = null;
  const todayStr = new Date().toDateString();
  const energy = getEnergyToday(todayStr);
  const energyVal = energy ? energy.energy : 3;
  const scheduled = tasks.filter(t => t.ts && t.status !== 'done').length;
  const topAvoidance = tasks
    .filter(t => t.status !== 'done')
    .sort((a, b) => avoidanceScore(b) - avoidanceScore(a))[0];
  const result = await aiWizardPrompt(
    energyVal,
    scheduled,
    topAvoidance ? topAvoidance.text : null
  );
  wizAiPrompt = result;
  render();
}

async function _wizFetchDayEndPrompt(todayYmd) {
  wizDayEndPrompt = null;
  const todayStr = new Date().toDateString();
  const completed = tasks.filter(t =>
    t.status === 'done' && t.doneDate === todayYmd).length;
  const tracked = Math.round(
    timeSessions
      .filter(s => new Date(s.startedAt).toDateString() === todayStr)
      .reduce((sum, s) => sum + (s.seconds || 0), 0) / 60
  );
  const missed = tasks.filter(t =>
    t.ts && t.status !== 'done' &&
    (() => {
      const [h, m] = t.ts.split(':').map(Number);
      return (h * 60 + m) < (new Date().getHours() * 60 + new Date().getMinutes());
    })()
  ).length;
  wizDayEndPrompt = await aiDayEndPrompt(completed, tracked, missed);
  render();
}

async function _wizFetchCarryOverInsight() {
  wizCarryOverInsight = null;
  const missed = tasks
    .filter(t => t.status !== 'done' && avoidanceScore(t) >= 4)
    .sort((a, b) => avoidanceScore(b) - avoidanceScore(a))
    .map(t => t.text);
  if (!missed.length) return;
  wizCarryOverInsight = await aiCarryOverInsight(missed);
  render();
}

// ── Weekly nudge ──────────────────────────────────────────────────────────────

function _findTopAvoidedCategory() {
  const scores = {};
  tasks.filter(t => t.status !== 'done').forEach(t => {
    const cat = getCat(t.catId);
    const name = cat ? cat.name : 'uncategorised';
    scores[name] = (scores[name] || 0) + avoidanceScore(t);
  });
  let top = null, max = 0;
  for (const [name, score] of Object.entries(scores)) {
    if (score > max) { max = score; top = name; }
  }
  return top;
}

async function _maybeFireWeeklyNudge() {
  if (!aiSettings.masterEnabled) return;
  if (energyLog.length < 7) return;
  const lastNudge = localStorage.getItem('adhd4_last_weekly_nudge');
  const now = Date.now();
  if (lastNudge && now - parseInt(lastNudge, 10) < 6 * 24 * 60 * 60 * 1000) return;

  const cutoff = now - 14 * 24 * 60 * 60 * 1000;
  const recent = energyLog.filter(e => new Date(e.date).getTime() >= cutoff);
  const byDay = [0, 1, 2, 3, 4, 5, 6].map(dow => {
    const entries = recent.filter(e => new Date(e.date).getDay() === dow);
    return entries.length
      ? entries.reduce((s, e) => s + e.energy, 0) / entries.length
      : null;
  });

  const topAvoided = _findTopAvoidedCategory();
  const nudge = await aiWeeklyNudge(byDay, topAvoided);
  if (nudge) {
    weeklyAiNudge = nudge;
    localStorage.setItem('adhd4_last_weekly_nudge', String(now));
    render();
  }
}

function dismissWeeklyAiNudge() {
  weeklyAiNudge = null;
  render();
}
