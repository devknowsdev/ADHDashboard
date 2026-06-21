/*
MODULE: ai.js
LAYER: services
PURPOSE: AI integration layer — Ollama + Anthropic providers, feature helpers, settings.
OWNS: ai.js responsibilities
USES: state.js, storage.js, helpers.js
STATE_READS: aiSettings, aiStatus, categories, tasks, journalEntries
STATE_WRITES: aiSettings, aiStatus, aiPendingParse, wizAiPrompt, wizDayEndPrompt, wizCarryOverInsight, weeklyAiNudge
PUBLIC_API: aiCall, aiCallJson, aiParseTask, aiWizardPrompt, aiBreakdownTask, aiDayEndPrompt, aiCarryOverInsight, aiWeeklyNudge, loadAiSettings, saveAiSettings, settingsSetAiMaster, dumpAiParse, dumpAiConfirm, taskAiBreakdown
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

    if (!response.ok) return null;
    const data = await response.json();
    return (data.response || '').trim() || null;

  } catch (e) {
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

    if (!response.ok) return null;
    const data = await response.json();
    return data.content?.[0]?.text?.trim() || null;

  } catch (e) {
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

function settingsToggleShowKey() {
  aiShowKey = !aiShowKey;
  render();
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
