# Decisions: Full Plugin System

Decision log from brainstorming and planning sessions. Newest entries at the top.

---

## 2026-03-18 — Initial Capture

### Q: What should plugins be able to extend?
**A**: User selected "Templates + new notification channels" for the current implementation. Full plugin system (billing modes, payment platforms, UI, webhooks) should be planned for later.
**Impact**: We implemented only templates and channels in this iteration; full system is logged here for future work.

### Q: How should plugins be installed?
**A**: User wanted integration with GitHub repo (e.g. clone from GitHub, validate manifest).
**Impact**: CLI commands `plugin add owner/repo`, `plugin remove slug`, `plugin list` use `git clone` and `plugins/registry.json`.

### Key Decisions Made
1. Log full plugin system as a future idea in `_future/full-plugin-system/` — so we don’t lose the vision but don’t block the current release.
2. Keep current scope to notification templates and channels only — matches plan and keeps the first plugin iteration shippable.
3. Use the same manifest and loader pattern for any future extension points (billing, payment, webhooks) so the architecture stays consistent.
