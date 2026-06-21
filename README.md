# ADHDashboard

Local-first productivity dashboard designed for ADHD and autism-friendly workflows. No build step, no account, no server required for day-to-day use — your data stays in the browser.

## Features

- **Focus Board** — timer (countdown/stopwatch), focus task, board cards, crisis/focus mode
- **Tasks** — categories, subtasks, urgency, repeat templates, day/project/fixed scope
- **Planner** — month grid and drag-to-schedule timeline
- **Day Wizard** — guided Day Start / Day End ritual
- **Dump (journal)** — quick capture with optional promote-to-task
- **Daily Check-in** — energy and intentions
- **Day Log** — time summaries, off-task log, backup/restore
- **Habits** — daily task tracking with hit grid
- **Music Tools** — metronome, tuner, task music metadata

## Quick start

1. Clone or download this repo.
2. Open `index.html` in a modern browser, **or** run a local server (recommended for voice notes):

   ```bash
   python3 -m http.server 8080
   # → http://localhost:8080
   ```

3. Use the app. Data persists automatically in `localStorage`.

See [web/README.md](web/README.md) for browser vs. local-server notes.

## Tests

Requires Node.js (no npm install):

```bash
node src/test_workflows.js
```

Expect **313 passed, 0 failed**.

Architecture lint (optional):

```bash
python3 tools/validate_architecture.py
```

## Backup

In the **Day Log** widget → **Export** section:

- **Backup (JSON)** — downloads tasks, settings, wizard state, planner dumps, etc. (version 17 format)
- **Restore backup** — replaces all data from a JSON file

Audio recordings are device-only and are not included in JSON backups.

## Project structure

```
index.html          Entry point; loads scripts in fixed order
src/
  state.js          All mutable global state
  storage.js        localStorage load/save
  render*.js        Widget HTML renderers
  actions*.js       State mutations
  render.js         Main render orchestrator
  runtime.js        Global listeners and intervals
  init.js           Boot: load → migrate → render
  test_workflows.js Node test harness (313 tests)
  ARCHITECTURE.md   Developer map — read before changing code
tools/
  validate_architecture.py
generated/          Auto-generated dependency graphs
```

## Tech stack

- Vanilla HTML/CSS/JavaScript (classic `<script>` tags, shared global scope)
- `localStorage` for persistence; IndexedDB for audio blobs
- [Tabler Icons](https://tabler.io/icons) and [Google Fonts](https://fonts.google.com) via CDN (requires network on first load)

## License

MIT — see [LICENSE](LICENSE).
