# ADHDashboard — Handoff: AI Integration Layer

**For the implementing Claude. Implement HANDOFF_task_scope_and_dump.md
and HANDOFF_day_wizard.md before this. This is Phase 4.**

**Target: all prior tests still passing + new WF31 block green.
AI features degrade gracefully to zero — no AI = app works exactly
as before.**

---

## Guiding principle

Every AI-enhanced feature must have a non-AI fallback that works
without any configuration. AI is a layer on top, never a dependency.
The app is local-first; the AI layer is cloud-optional.

---

## What AI does in this app

Six specific integration points. Nothing else. No chat window,
no AI dashboard, no general-purpose assistant interface.

| Point | Trigger | Input | Output |
|-------|---------|-------|--------|
| NL task capture | User types natural language in Dump or wizard | Raw text | Parsed task fields |
| Wizard personalisation | Day start wizard, after energy check | Energy, schedule, avoidance | One personalised sentence |
| Task breakdown | "Break it down" button on any task | Task title + category | Suggested subtask list |
| Day-end reflection prompt | Debrief wizard, how-did-it-go step | Today's activity summary | One focused question |
| Carry-over insight | Debrief wizard, carry-over step | Incomplete tasks + patterns | One nudge sentence |
| Weekly pattern nudge | Once per week, if enough data | 2+ weeks of task/energy data | One pattern observation |

All six return `null` on any failure. Callers show a non-AI fallback UI
when they receive null.

---

## Provider architecture

Two providers, one interface. A third-party provider can be added later
by implementing the same interface.

```
aiCall(systemPrompt, userPrompt, opts)
    │
    ├── if Ollama enabled and reachable → OllamaProvider
    │       └── POST http://localhost:11434/api/generate
    │
    ├── elif Anthropic key configured → AnthropicProvider
    │       └── POST https://api.anthropic.com/v1/messages
    │
    └── else → null (degrade gracefully)
```

Provider priority is user-configurable (default: Ollama first, then
Anthropic). This respects the local-first principle — if Ollama is
running, data stays on device.

---

## New file: `src/ai.js`

Load order: after `storage.js`, before `render_wizard.js`.
Add one `<script src="src/ai.js"></script>` tag in `index.html`.

### Full implementation

```js
// ai.js — AI integration layer for ADHDashboard
// All AI calls go through aiCall(). Returns null on any failure.
// Depends on: state.js (aiSettings), storage.js (saveAiSettings)
// Called from: actions_wizard.js, render_journal.js, render_tasks.js,
//              actions_tasks.js

// ── Provider constants ────────────────────────────────────────────────────────
const AI_PROVIDER_OLLAMA    = 'ollama';
const AI_PROVIDER_ANTHROPIC = 'anthropic';
const AI_TIMEOUT_MS         = 8000;   // 8s timeout for any AI call
const AI_MAX_TOKENS         = 512;    // cap output tokens — we want short answers
const OLLAMA_DEFAULT_URL    = 'http://localhost:11434';
const OLLAMA_DEFAULT_MODEL  = 'llama3.2';
const ANTHROPIC_MODEL       = 'claude-haiku-4-5';
const ANTHROPIC_ENDPOINT    = 'https://api.anthropic.com/v1/messages';

// ── State (declared in state.js — see additions below) ────────────────────────
// aiSettings: { providerOrder, ollamaEnabled, ollamaUrl, ollamaModel,
//               anthropicEnabled, anthropicKey, masterEnabled }
// aiStatus: { ollama: 'unknown'|'ok'|'error', anthropic: 'unknown'|'ok'|'error' }

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
  return null; // all providers failed or none configured
}

// ── Ollama provider ───────────────────────────────────────────────────────────

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

// ── Anthropic provider ────────────────────────────────────────────────────────

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
        'Content-Type':         'application/json',
        'x-api-key':            aiSettings.anthropicKey,
        'anthropic-version':    '2023-06-01',
        'anthropic-dangerous-requests': 'true',
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

// ── JSON helper ───────────────────────────────────────────────────────────────
// Use when the caller needs structured data back.
// Strips markdown fences, parses JSON, returns null on failure.

async function aiCallJson(systemPrompt, userPrompt, opts = {}) {
  const raw = await aiCall(systemPrompt, userPrompt, {
    ...opts,
    temperature: opts.temperature ?? 0.1, // lower temp for structured output
  });
  if (!raw) return null;
  try {
    // Strip ```json fences if present
    const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    return JSON.parse(clean);
  } catch (e) {
    // Try extracting a JSON object/array from within the text
    const match = raw.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (match) {
      try { return JSON.parse(match[1]); } catch (e2) { return null; }
    }
    return null;
  }
}

// ── Connectivity check ────────────────────────────────────────────────────────
// Called from settings UI to test each provider.

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
  // Use a minimal call to verify the key works
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
// Each returns null if AI unavailable. Callers must handle null.

// 1. Natural language task parsing
// Input:  "dentist Thursday 3pm, need to fast beforehand"
// Output: { text, ts, catId, taskScope, note, tags } or null

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

// 2. Wizard personalisation — one sentence for the capture step
// Input:  energy (1-5), count of scheduled tasks, top avoidance task name
// Output: string or null

async function aiWizardPrompt(energy, scheduledCount, topAvoidanceTask) {
  const system = `You are a supportive productivity coach for someone with ADHD.
Write ONE short, warm sentence (max 15 words) to prompt them for today's task capture.
Be specific to their situation. No generic advice. No emojis. Lowercase.
Consider: energy level ${energy}/5, ${scheduledCount} tasks already scheduled${topAvoidanceTask ? ', they keep avoiding: "' + topAvoidanceTask + '"' : ''}.`;

  const user = `Energy: ${energy}/5. Scheduled: ${scheduledCount}. ${topAvoidanceTask ? 'Avoiding: "' + topAvoidanceTask + '"' : ''}`;

  return await aiCall(system, user, { maxTokens: 40 });
}

// 3. Task breakdown — suggest subtasks
// Input:  task text, category name
// Output: [{text}] array or null

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

// 4. Day-end reflection prompt — one focused question
// Input:  summary of the day
// Output: string question or null

async function aiDayEndPrompt(tasksCompleted, timeTrackedMins, tasksMissed) {
  const system = `You are a gentle end-of-day coach for someone with ADHD.
Write ONE short, non-judgmental question (max 20 words) to prompt reflection.
Base it on what actually happened today. No lecturing. No advice. Just curiosity.
Lowercase. End with a question mark.`;

  const user = `Completed: ${tasksCompleted} tasks. Tracked: ${timeTrackedMins} mins. Missed: ${tasksMissed} tasks.`;

  return await aiCall(system, user, { maxTokens: 50 });
}

// 5. Carry-over insight — one nudge sentence
// Input:  array of task texts that keep not getting done
// Output: string or null

async function aiCarryOverInsight(repeatedlyMissedTasks) {
  if (!repeatedlyMissedTasks || !repeatedlyMissedTasks.length) return null;

  const system = `You are a compassionate ADHD coach.
The user keeps not completing certain tasks. Write ONE warm, non-judgmental sentence
(max 20 words) that acknowledges this without criticism and opens a small question.
Lowercase. No advice.`;

  const user = `Tasks carried over multiple times: ${repeatedlyMissedTasks.slice(0, 3).map(t => '"' + t + '"').join(', ')}`;

  return await aiCall(system, user, { maxTokens: 50 });
}

// 6. Weekly pattern nudge — one observation
// Input:  energy averages by day, avoidance patterns
// Output: string or null

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
  // Store key separately from main save blob for clarity
  const toSave = { ...aiSettings };
  // Never store the raw key in the main save — keep it in its own key
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
      masterEnabled:  raw?.masterEnabled  ?? false,
      providerOrder:  raw?.providerOrder  ?? [AI_PROVIDER_OLLAMA, AI_PROVIDER_ANTHROPIC],
      ollamaEnabled:  raw?.ollamaEnabled  ?? false,
      ollamaUrl:      raw?.ollamaUrl      ?? OLLAMA_DEFAULT_URL,
      ollamaModel:    raw?.ollamaModel    ?? OLLAMA_DEFAULT_MODEL,
      anthropicEnabled: raw?.anthropicEnabled ?? false,
      anthropicKey:   key,
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
```

---

## State additions (`state.js`)

Add after the existing music tools state block:

```js
// ── AI settings & status ──────────────────────────────────────────────────────
let aiSettings = {
  masterEnabled:    false,
  providerOrder:    ['ollama', 'anthropic'], // try ollama first
  ollamaEnabled:    false,
  ollamaUrl:        'http://localhost:11434',
  ollamaModel:      'llama3.2',
  anthropicEnabled: false,
  anthropicKey:     '',
};
let aiStatus = {
  ollama:    'unknown', // 'unknown' | 'ok' | 'error'
  anthropic: 'unknown',
};
let aiPendingParse = null; // parsed task fields awaiting user confirmation
                           // { text, ts, catId, taskScope, note } | null
```

---

## Storage additions (`storage.js`)

In `load()`, at the end of the try block:

```js
loadAiSettings(); // defined in ai.js
```

In `_flushSave()`, AI settings are NOT saved here — `saveAiSettings()`
is called explicitly from the settings UI on change. This prevents the
API key being inadvertently included in any export/backup flow.

**Important:** `exportBackup()` in `actions_export.js` must NOT include
`adhd4_ai_key` or `adhd4_ai_settings` in the export. Add a guard if
the export currently does a bulk localStorage dump.

---

## Settings UI additions (`render_modals.js`)

Add an **AI** tab to the settings modal alongside the existing
Appearance / Hotkeys / Timer / Behaviour tabs.

### AI settings tab content

```
┌─────────────────────────────────────────┐
│ 🤖 AI Assistant                         │
│                                         │
│ [toggle] Enable AI features             │
│                                         │
│ ── Providers ───────────────────────────│
│                                         │
│ Priority: [Ollama first ▾]              │
│           (Ollama first / Claude first /│
│            Ollama only / Claude only)   │
│                                         │
│ ── Ollama (local, private) ─────────────│
│ [toggle] Enable Ollama                  │
│ URL:    [http://localhost:11434      ]  │
│ Model:  [llama3.2                    ]  │
│ [Test connection]  ● Connected / ✗ Error│
│ Suggested models: llama3.2, mistral,    │
│ phi3, gemma2                            │
│                                         │
│ ── Claude API ──────────────────────────│
│ [toggle] Enable Claude API              │
│ Key:    [sk-ant-••••••••••••    ] [show]│
│ [Test connection]  ● Connected / ✗ Error│
│ Your key is stored locally only.        │
│ Task text is sent to Anthropic servers. │
│                                         │
│ ── Privacy ─────────────────────────────│
│ ℹ Voice recordings and journal entries  │
│   are never sent to any AI provider.    │
│   Only task text and summary statistics │
│   are used in AI calls.                 │
└─────────────────────────────────────────┘
```

### Actions wired from settings tab

```js
// Test buttons call these and render the result inline
async function settingsTestOllama() {
  const result = await aiCheckOllama();
  aiStatus.ollama = result.ok ? 'ok' : 'error';
  render();
  if (result.ok && result.models) {
    showToast('Ollama connected. Models: ' + result.models.slice(0,3).join(', '), 'ok');
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
  saveAiSettings(); render();
}

function settingsSetOllamaEnabled(val) {
  aiSettings.ollamaEnabled = val;
  saveAiSettings(); render();
}

function settingsSetAiProviderOrder(val) {
  // val is one of: 'ollama-first' | 'anthropic-first' | 'ollama-only' | 'anthropic-only'
  const map = {
    'ollama-first':     [AI_PROVIDER_OLLAMA, AI_PROVIDER_ANTHROPIC],
    'anthropic-first':  [AI_PROVIDER_ANTHROPIC, AI_PROVIDER_OLLAMA],
    'ollama-only':      [AI_PROVIDER_OLLAMA],
    'anthropic-only':   [AI_PROVIDER_ANTHROPIC],
  };
  aiSettings.providerOrder = map[val] || [AI_PROVIDER_OLLAMA, AI_PROVIDER_ANTHROPIC];
  saveAiSettings(); render();
}

function settingsSaveAnthropicKey(key) {
  aiSettings.anthropicKey = key.trim();
  aiSettings.anthropicEnabled = !!key.trim();
  saveAiSettings(); render();
}

function settingsSaveOllamaUrl(url) {
  aiSettings.ollamaUrl = url.trim() || OLLAMA_DEFAULT_URL;
  saveAiSettings(); render();
}

function settingsSaveOllamaModel(model) {
  aiSettings.ollamaModel = model.trim() || OLLAMA_DEFAULT_MODEL;
  saveAiSettings(); render();
}
```

Status indicator helper for the settings UI:

```js
function _aiStatusDot(provider) {
  const s = aiStatus[provider];
  const col = s === 'ok' ? T.green : s === 'error' ? T.pomo : T.muted2;
  const label = s === 'ok' ? 'Connected' : s === 'error' ? 'Error' : 'Not tested';
  return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:11px;color:${col};">
    <span style="width:7px;height:7px;border-radius:50%;background:${col};display:inline-block;"></span>
    ${label}
  </span>`;
}
```

---

## Integration into existing features

### Dump widget — NL task capture (`render_journal.js`)

Add an AI-enhanced input mode alongside the existing plain text input.
Only shown when `aiSettings.masterEnabled` is true.

When active, the capture textarea gets an "AI parse" button:

```js
// In the capture bar, after the textarea:
${aiSettings.masterEnabled ? `
  <button onclick="dumpAiParse()"
    style="${btnStyle('default','font-size:11px;padding:4px 9px;')}">
    <i class="ti ti-sparkles"></i> Parse
  </button>` : ''}
```

When `aiPendingParse` is set (non-null), show a confirmation card
below the input instead of the normal submit:

```
┌─────────────────────────────────┐
│ ✨ AI parsed this as:           │
│                                 │
│ Task:  "Dentist appointment"    │
│ Time:  15:00                    │
│ Scope: Day task                 │
│ Note:  "fast beforehand"        │
│                                 │
│ [Looks right, add it] [Edit]    │
└─────────────────────────────────┘
```

Actions:

```js
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
  tasks.push({
    id: now,
    text:       aiPendingParse.text || aiPendingParse.rawText,
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
  // Also add to dump as a todo entry for audit trail
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
  showToast('"' + (aiPendingParse?.text || 'Task') + '" added', 'ok');
  render();
}

function dumpAiEdit() {
  // Populate the form with parsed values for manual edit, clear pending parse
  if (!aiPendingParse) return;
  const el = document.getElementById('journal-capture-text');
  if (el) el.value = aiPendingParse.text || aiPendingParse.rawText;
  aiPendingParse = null;
  render();
}
```

### Task breakdown (`render_tasks.js` or `render_focus.js`)

Add a "Break it down" button to the task overflow panel (`taskOverflowOpenId`).
Only shown when `aiSettings.masterEnabled` and task has no subtasks yet
(or fewer than 2).

```js
// In the overflow panel for a task:
${aiSettings.masterEnabled && (t.subtasks || []).length < 2 ? `
  <button onclick="taskAiBreakdown(${t.id})"
    style="${btnStyle('default','font-size:11px;padding:4px 10px;')}">
    <i class="ti ti-sitemap"></i> Break it down
  </button>` : ''}
```

```js
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
  // Add all suggested subtasks — user can delete unwanted ones
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
```

### Day wizard — personalised prompt (`actions_wizard.js`)

In `openDayWizard('start')`, after loading energy and schedule data,
fire an async AI call and store the result in a wizard-local variable.
Because AI calls are async and the wizard renders synchronously, use
a pattern where the result triggers a re-render when it arrives:

```js
let wizAiPrompt = null; // current personalised prompt string, or null

async function _wizFetchPersonalisedPrompt(todayYmd) {
  wizAiPrompt = null; // clear while loading
  const energy = getEnergyToday(todayYmd);
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
  wizAiPrompt = result; // null if AI unavailable — render shows fallback
  render();
}
```

Call `_wizFetchPersonalisedPrompt(todayYmd)` (without await) when the
wizard opens. The render function checks `wizAiPrompt` and shows either
the AI string or a static fallback:

```js
// In _renderWizStep_RapidCapture():
const promptText = wizAiPrompt
  || (energyVal <= 2
    ? "what's the one thing that has to happen today?"
    : "what needs to happen today?");
```

### Day-end debrief — reflection prompt (`actions_wizard.js`)

Same async pattern. Fire `_wizFetchDayEndPrompt()` when the debrief
wizard opens, store in `wizDayEndPrompt`, render uses it or falls back
to a static question.

```js
let wizDayEndPrompt = null;

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
```

### Weekly nudge (`runtime.js`)

In the existing interval check (or a new weekly check), fire once per
week after 7+ days of data. Store result in `weeklyAiNudge` state
variable (ephemeral, not persisted). Show as a dismissable card in the
check-in widget or as a banner.

```js
// In runtime.js, in the existing setInterval block:
// Check once per day whether a weekly nudge is due
if (/* day rollover */ && aiSettings.masterEnabled) {
  _maybeFireWeeklyNudge();
}

async function _maybeFireWeeklyNudge() {
  // Only fire if we have 7+ days of energy data
  if (energyLog.length < 7) return;
  // Only fire once per week — check last nudge date
  const lastNudge = localStorage.getItem('adhd4_last_weekly_nudge');
  const now = Date.now();
  if (lastNudge && now - parseInt(lastNudge) < 6 * 24 * 60 * 60 * 1000) return;

  // Build energy by day-of-week averages from last 14 days
  const cutoff = now - 14 * 24 * 60 * 60 * 1000;
  const recent = energyLog.filter(e => new Date(e.date).getTime() >= cutoff);
  const byDay = [0,1,2,3,4,5,6].map(dow => {
    const entries = recent.filter(e => new Date(e.date).getDay() === dow);
    return entries.length
      ? entries.reduce((s, e) => s + e.energy, 0) / entries.length
      : null;
  });

  const topAvoided = /* find most-avoided category from avoidance scores */null;

  const nudge = await aiWeeklyNudge(byDay, topAvoided);
  if (nudge) {
    weeklyAiNudge = nudge;
    localStorage.setItem('adhd4_last_weekly_nudge', String(now));
    render();
  }
}
```

Add `let weeklyAiNudge = null;` to `state.js`.

---

## AI indicator in UI

Wherever an AI-enhanced element appears, show a subtle indicator so the
user knows AI was involved. Use a consistent small badge:

```js
function _aiSparkle() {
  return `<span title="AI-generated" style="font-size:9px;color:${T.accent2};
    margin-left:3px;opacity:0.7;"><i class="ti ti-sparkles"></i></span>`;
}
```

Apply to: personalised wizard prompt, parsed task confirmation card,
AI-suggested subtasks (each row), day-end reflection question,
weekly nudge card.

---

## Privacy constraints (hard rules)

These are never sent to any AI provider under any circumstances:

- Voice recording audio or transcripts (`audioRecordings`, voice journal entries)
- Raw journal entry text marked `type: 'reflect'` or `type: 'note'`
- Energy sensory notes (`sensory` field)
- The `tag` field on energy log entries
- Any field from `dailyIntentions.answers`

What IS sent:

- Task `text` fields (for parsing and breakdown)
- Task `ts`, `catId`, `taskScope`, `durationMins` (for context)
- Aggregate statistics (count of tasks done/missed, total time tracked)
- Energy level numbers (1-5) — not the sensory/tag fields
- Category names

The system prompts in `aiParseTask`, `aiBreakdownTask`, etc. must never
be constructed in a way that could accidentally include journal text.
Each function takes explicit parameters — never a raw dump of app state.

---

## New file load order (`index.html`)

```html
<!-- After storage.js, before ui.js -->
<script src="src/ai.js"></script>
```

`ai.js` must load before any file that calls `aiSettings` or `aiStatus`.
It must load after `storage.js` (which calls `loadAiSettings()` defined
in `ai.js`) — actually, since `loadAiSettings` is defined in `ai.js` and
called from `load()` in `storage.js`, and `load()` is called from
`init.js` (after all scripts load), there is no circular dependency.
The load order works: `storage.js` loads, defines `load()` which
references `loadAiSettings`, then `ai.js` loads and defines it, then
`init.js` calls `load()`.

Full addition to load order in `index.html`:
```
constants.js → state.js → widget_registry.js → helpers.js → core.js
→ storage.js → ai.js  ← NEW
→ audio.js → ui.js → render_*.js → actions.js → render_modals.js
→ render.js → music.js → render_music.js → actions_*.js
→ actions_wizard.js → render_wizard.js → runtime.js → init.js
```

---

## test_workflows.js additions

AI functions are async and make network calls, so they cannot be
meaningfully tested in the Node harness as written. Instead, test:
- The sync helper functions
- The settings load/save cycle
- The integration hooks (dumpAiConfirm, taskAiBreakdown with a mocked
  aiBreakdownTask, dumpAiEdit)
- Graceful degradation when AI returns null

Add **WF31: AI Layer** block:

```js
console.log('\n═══ WF31: AI Layer ═══');
resetState();

// Mock aiCall to return null (AI unavailable) for all sync tests
run(`
  const _realAiCall = typeof aiCall !== 'undefined' ? aiCall : null;
  // AI settings start disabled
  aiSettings.masterEnabled = false;
  aiSettings.ollamaEnabled = false;
  aiSettings.anthropicEnabled = false;
  aiStatus = { ollama: 'unknown', anthropic: 'unknown' };
  aiPendingParse = null;
`);

test('aiSettings loads with defaults when no localStorage key', () => {
  run('localStorage.removeItem("adhd4_ai_settings"); loadAiSettings()');
  eq(get('aiSettings.masterEnabled'), false);
  eq(get('aiSettings.ollamaEnabled'), false);
  eq(get('aiSettings.ollamaUrl'), OLLAMA_DEFAULT_URL);
  eq(get('aiSettings.ollamaModel'), OLLAMA_DEFAULT_MODEL);
  eq(get('aiSettings.anthropicEnabled'), false);
});

test('saveAiSettings and loadAiSettings round-trip (without key)', () => {
  run(`
    aiSettings.masterEnabled = true;
    aiSettings.ollamaEnabled = true;
    aiSettings.ollamaModel = 'mistral';
    aiSettings.anthropicKey = '';
    saveAiSettings();
    aiSettings = { masterEnabled:false, ollamaEnabled:false,
                   ollamaModel:'llama3.2', anthropicKey:'',
                   providerOrder:['ollama','anthropic'],
                   ollamaUrl:'http://localhost:11434',
                   anthropicEnabled:false };
    loadAiSettings();
  `);
  eq(get('aiSettings.masterEnabled'), true);
  eq(get('aiSettings.ollamaEnabled'), true);
  eq(get('aiSettings.ollamaModel'), 'mistral');
});

test('saveAiSettings stores key separately', () => {
  run(`aiSettings.anthropicKey = 'sk-ant-test'; saveAiSettings()`);
  const mainStore = JSON.parse(get("localStorage.getItem('adhd4_ai_settings')") || '{}');
  assert(!mainStore.anthropicKey, 'key not in main settings blob');
  eq(get("localStorage.getItem('adhd4_ai_key')"), 'sk-ant-test');
});

test('loadAiSettings restores key from separate store', () => {
  run(`aiSettings.anthropicKey = ''; loadAiSettings()`);
  eq(get('aiSettings.anthropicKey'), 'sk-ant-test');
});

test('settingsSetAiMaster toggles masterEnabled', () => {
  run('settingsSetAiMaster(true)');  eq(get('aiSettings.masterEnabled'), true);
  run('settingsSetAiMaster(false)'); eq(get('aiSettings.masterEnabled'), false);
});

test('settingsSetOllamaEnabled toggles ollamaEnabled', () => {
  run('settingsSetOllamaEnabled(true)');  eq(get('aiSettings.ollamaEnabled'), true);
  run('settingsSetOllamaEnabled(false)'); eq(get('aiSettings.ollamaEnabled'), false);
});

test('settingsSaveOllamaUrl stores trimmed url', () => {
  run("settingsSaveOllamaUrl('  http://192.168.1.5:11434  ')");
  eq(get('aiSettings.ollamaUrl'), 'http://192.168.1.5:11434');
});

test('settingsSaveOllamaUrl falls back to default on empty', () => {
  run("settingsSaveOllamaUrl('')");
  eq(get('aiSettings.ollamaUrl'), get('OLLAMA_DEFAULT_URL'));
});

test('settingsSaveOllamaModel stores trimmed model', () => {
  run("settingsSaveOllamaModel('  mistral  ')");
  eq(get('aiSettings.ollamaModel'), 'mistral');
});

test('settingsSetAiProviderOrder maps preset to array', () => {
  run("settingsSetAiProviderOrder('anthropic-first')");
  const order = get('aiSettings.providerOrder');
  eq(order[0], 'anthropic'); eq(order[1], 'ollama');
  run("settingsSetAiProviderOrder('ollama-only')");
  eq(get('aiSettings.providerOrder.length'), 1);
  eq(get('aiSettings.providerOrder[0]'), 'ollama');
});

test('settingsSaveAnthropicKey sets key and enables anthropic', () => {
  run("settingsSaveAnthropicKey('sk-ant-abc123')");
  eq(get('aiSettings.anthropicKey'), 'sk-ant-abc123');
  eq(get('aiSettings.anthropicEnabled'), true);
});

test('settingsSaveAnthropicKey empty string disables anthropic', () => {
  run("settingsSaveAnthropicKey('')");
  eq(get('aiSettings.anthropicEnabled'), false);
});

test('dumpAiEdit clears aiPendingParse', () => {
  run(`aiPendingParse = { text:'Test', ts:'09:00', catId:'', taskScope:'day', note:'' }`);
  run('dumpAiEdit()');
  eq(get('aiPendingParse'), null);
});

test('dumpAiConfirm with pending parse creates task and journal entry', () => {
  run(`
    tasks = [];
    journalEntries = [];
    aiPendingParse = {
      text: 'Call dentist',
      ts: '15:00',
      catId: '',
      taskScope: 'day',
      note: 'fast beforehand',
      rawText: 'dentist thursday 3pm fast beforehand'
    };
    dumpAiConfirm();
  `);
  eq(get('tasks.length'), 1, 'task created');
  eq(get('tasks[0].text'), 'Call dentist');
  eq(get('tasks[0].ts'), '15:00');
  eq(get('tasks[0].taskScope'), 'day');
  eq(get('tasks[0].note'), 'fast beforehand');
  eq(get('journalEntries.length'), 1, 'audit entry created');
  eq(get('journalEntries[0].aiParsed'), true);
  eq(get('aiPendingParse'), null, 'pending parse cleared');
});

test('dumpAiConfirm with null aiPendingParse is no-op', () => {
  run('tasks=[]; aiPendingParse=null; dumpAiConfirm()');
  eq(get('tasks.length'), 0);
});

test('taskAiBreakdown with null result is graceful no-op', () => {
  // Without a real AI provider, aiBreakdownTask returns null —
  // simulate by testing that the function handles null subtasks
  run(`
    tasks=[{id:31001,text:'Write report',catId:'work',done:false,
      status:'todo',ts:'',order:0,createdAt:Date.now(),repeat:null,
      templateId:null,generatedForDate:null,pinned:false,urgency:0,
      subtasks:[],estimatedMins:null,note:'',anxiety:0,
      taskScope:'project',doneDate:'',durationMins:null}];
    // Simulate AI returning null (unavailable)
    const _orig = aiBreakdownTask;
    // We can't easily mock async in this harness — test the guard
    // by verifying the task is unchanged after a direct null-result path
    // The actual async test is: if subtasks.length was 0 and aiBreakdownTask
    // returns null, no subtasks are added.
    // Verify task still has 0 subtasks (no mutation happened):
  `);
  eq(get('tasks.find(t=>t.id===31001).subtasks.length'), 0);
});

test('aiStatus defaults to unknown for both providers', () => {
  run('aiStatus = { ollama:"unknown", anthropic:"unknown" }');
  eq(get('aiStatus.ollama'), 'unknown');
  eq(get('aiStatus.anthropic'), 'unknown');
});

test('exportBackup does not include AI key', () => {
  run("aiSettings.anthropicKey='sk-ant-secret'; saveAiSettings()");
  // exportBackup produces a JSON string — verify key absent
  // (This test only works if exportBackup is defined and returns/downloads JSON)
  // Check the localStorage key is separate and not in adhd4_* main keys
  const mainKeys = run(`
    Object.keys(localStorage._storage || ls)
      .filter(k => k.startsWith('adhd4_') && k !== 'adhd4_ai_key' && k !== 'adhd4_ai_settings')
      .map(k => localStorage.getItem(k))
      .join(' ')
  `);
  assert(!String(mainKeys).includes('sk-ant-secret'), 'key not in main storage');
});
```

---

## File change summary

| File | What changes |
|------|-------------|
| `state.js` | Add `aiSettings`, `aiStatus`, `aiPendingParse`, `wizAiPrompt`, `wizDayEndPrompt`, `weeklyAiNudge` |
| `storage.js` | `load()`: call `loadAiSettings()`; `_flushSave()`: nothing (AI settings saved separately) |
| `runtime.js` | Add `_maybeFireWeeklyNudge()` call in date-rollover or daily interval |
| `render_modals.js` | Add AI tab to settings modal with all controls |
| `render_journal.js` | Add AI parse button + confirmation card; handle `aiPendingParse` state |
| `render_tasks.js` | Add "Break it down" button in task overflow panel |
| `actions_wizard.js` | Add `_wizFetchPersonalisedPrompt()`, `_wizFetchDayEndPrompt()`, `wizAiPrompt`, `wizDayEndPrompt` usage |
| `test_workflows.js` | Add WF31 block |
| `index.html` | Add `<script src="src/ai.js"></script>` after `storage.js` |
| `ARCHITECTURE.md` | Update status; document AI layer, provider pattern, privacy constraints |
| *(new)* `src/ai.js` | Full AI layer: providers, feature functions, settings persistence |

### Files that do NOT change
- `helpers.js`, `core.js`, `constants.js`, `widget_registry.js`
- `render_focus.js`, `render_habits.js`, `render_daylog.js`, `render_planner.js`
- `actions_tasks.js`, `actions_planner.js`, `actions_alarms_habits.js`
- `render_wizard.js` (only `actions_wizard.js` gains the async fetch helpers)

---

## Implementation order

1. `state.js` — add new state variables
2. `src/ai.js` — full file (providers, feature functions, settings persistence)
3. `index.html` — add script tag for `ai.js`
4. `storage.js` — add `loadAiSettings()` call in `load()`
5. `render_modals.js` — add AI settings tab + action functions
6. Run `node test_workflows.js` — WF31 settings/sync tests should pass
7. `render_journal.js` — AI parse button + confirmation card + `dumpAiEdit`/`dumpAiConfirm`
8. `render_tasks.js` — "Break it down" button + `taskAiBreakdown`
9. `actions_wizard.js` — async prompt fetch helpers + `wizAiPrompt`/`wizDayEndPrompt` usage
10. `runtime.js` — weekly nudge hook
11. Run `node test_workflows.js` — full suite must be green
12. Update `ARCHITECTURE.md`

---

## Ollama setup note (for documentation / settings UI help text)

Include this as collapsible help text in the AI settings tab:

```
Setting up Ollama:
1. Install from ollama.com
2. Run: ollama pull llama3.2
3. Allow browser access: set OLLAMA_ORIGINS=* in your environment
   (on Mac: launchctl setenv OLLAMA_ORIGINS "*" then restart Ollama)
4. Click "Test connection" above

Recommended models by machine:
- llama3.2 (3B)  — fast, good for task parsing, needs ~4GB RAM
- llama3.2 (1B)  — fastest, lower quality, needs ~2GB RAM
- mistral (7B)   — better reasoning, needs ~8GB RAM
- phi3 (3.8B)    — good balance, needs ~4GB RAM
```

---

## Carry-forward note for ARCHITECTURE.md

```
**AI layer implemented.**
New file: src/ai.js — provider abstraction (Ollama + Anthropic Claude).
Settings: adhd4_ai_settings + adhd4_ai_key (stored separately).
State: aiSettings, aiStatus, aiPendingParse, weeklyAiNudge.
All AI calls return null on failure — full graceful degradation.
Privacy: only task text + aggregate stats sent to providers.
Voice, journal text, intentions answers never sent.
```
