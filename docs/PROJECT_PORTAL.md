# ADHDashboard — Project Portal

Short orientation for engineers and quick navigation links.

Overview
- Local-first, no build step; UI boots via `index.html` → `init.js`.

Quick start
- Read: [ADHDashboard README.md](ADHDashboard-git/README.md)
- Run tests: `node src/test_workflows.js`

Key orientation docs
- [docs/ORIENTATION.md](ADHDashboard-git/docs/ORIENTATION.md)
- [docs/AI_API.md](ADHDashboard-git/docs/AI_API.md)
- [generated/PROJECT_INDEX.md](ADHDashboard-git/generated/PROJECT_INDEX.md)
- [generated/AI_CONTEXT.md](ADHDashboard-git/generated/AI_CONTEXT.md)

Where to look for common changes (recipes)
- **Change task UI**: `src/render_tasks.js`, `src/actions_tasks.js` — run `node src/test_workflows.js` after edits.
- **Add a widget**: follow [src/WIDGET_GUIDE.md](ADHDashboard-git/src/WIDGET_GUIDE.md) and register via `src/widget_registry.js`; add files to `index.html` load order.
- **Persistence changes**: `src/storage.js` and `src/state.js` (or `src/state/*` migration files).
- **AI integration**: `src/ai.js` and `src/ai_exec.js` (see [docs/AI_API.md](ADHDashboard-git/docs/AI_API.md)).

Developer tools
- Architecture lint: `python3 tools/validate_architecture.py`
- Searchable module list: [generated/PROJECT_INDEX.md](ADHDashboard-git/generated/PROJECT_INDEX.md)

Recommendations
- Add a short `ONBOARDING.md` with a 15-minute checklist and the three most-likely edit recipes above.
- Keep `generated/PROJECT_INDEX.md` updated as part of CI so new modules are discoverable.
