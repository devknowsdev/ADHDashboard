# Technical Debt

Status: Living Document

This version reflects the actual audit findings from Sprint 013.

## Priority Definitions

Critical

Breaks architecture or causes data loss.

High

Creates duplication or blocks development.

Medium

Maintainability issue.

Low

Polish or optimization.

---

| ID | Area | Debt | Evidence | Priority | Status |
|---|---|---|---|---|---|
| TD-001 | Governance | Repository governance docs exist and are now explicit enough for AI onboarding. | `START_HERE`, `ARCHITECTURE.md`, `WIDGET_GUIDE.md`, and the Sprint 013 audit docs. | Complete | Done |
| TD-002 | Tasks | `status` and `done` duplicate the same completion concept. | `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/helpers.js:189-191`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions_tasktimer.js:72-79`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions_tasktimer.js:145-153` | High | Open |
| TD-003 | Journal / audio | Voice-note metadata is split between `audioRecordings[]` and `journalEntries[]`. | `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/audio.js:116-123`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/audio.js:175-181`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/helpers.js:235-243` | High | Open |
| TD-004 | Planner | Planner writes into task scheduling fields from multiple view handlers. | `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions_planner.js:110-116`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/actions_planner.js:197-215`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render_planner.js:460-483` | High | Open |
| TD-005 | Render shell | Global UI state is shared across many widgets and runtime shortcuts, which makes ownership unclear. | `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/state.js:7-167`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/runtime.js:45-218`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/render.js:155-163` | Medium | Open |
| TD-006 | Legacy state | `energyToday`, `showBreakBar`, and archive handoff artifacts remain in the tree without runtime consumers. | `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/state.js:35-37`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/state.js:112-115`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/HANDOFF_ai.md`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/HANDOFF_day_wizard.md`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/HANDOFF_task_scope_and_dump.md`, `/Users/duif/Documents/ADHDashboard/ADHDashboard Repo/src/HANDOVER_SPRINT_010.md` | Low | Open |

---

## Notes

* The registry model is working and should be preserved.
* Most of the debt is not about missing features; it is about duplicate
  ownership and write-path clarity.
* Sprint 014 should focus on reducing duplication, not introducing new abstractions.
