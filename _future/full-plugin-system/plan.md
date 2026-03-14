# Implementation Plan: Full Plugin System

## Phase 1: Billing mode plugins — (medium)

### Goal
Allow plugins to register custom billing modes (e.g. tiered, usage-based) that appear in the group form and are used by the billing calculator.

### Tasks
- [ ] Extend plugin manifest with `billingModes: { [id]: { file, name, description } }`
- [ ] Add billing mode registry in `src/lib/plugins/billing-modes.ts` that merges built-in modes with plugin modes
- [ ] Refactor `src/lib/billing/calculator.ts` to resolve mode from registry and call plugin export for unknown modes
- [ ] Update group form and API validation to allow plugin billing mode ids
- [ ] Document the plugin billing interface (input: group, period; output: per-member amounts)

### Deliverables
- Admins can select a plugin-provided billing mode when creating/editing a group; billing periods use it for split calculation.

---

## Phase 2: Payment platform plugins — (small)

### Goal
Allow plugins to add new payment platform options (e.g. Venmo, Bunq) and optional validation or link generation.

### Tasks
- [ ] Extend manifest with `paymentPlatforms: { [id]: { name, optionalFile? } }`
- [ ] Add payment platform registry; group form and API accept any registered id
- [ ] Optional plugin file for custom validation or “payment link” builder per platform

### Deliverables
- New payment platforms appear in the dropdown and can be stored in group.payment.platform.

---

## Phase 3: Webhook dispatcher — (medium)

### Goal
Let plugins register a webhook URL (and optional secret); app POSTs to it on configurable events (member added, payment confirmed, etc.).

### Tasks
- [ ] Add `webhooks` to manifest (events list, configSchema for url and secret)
- [ ] Implement `src/lib/plugins/webhooks.ts`: register webhooks from plugins, dispatch with HMAC-signed body on event
- [ ] Emit events from group member API, billing confirm flow, etc.
- [ ] Store webhook URL and secret under plugin settings; show in Plugins tab

### Deliverables
- Plugins can receive signed webhook calls when members are added or payments confirmed.

---

## Phase 4: UI extension points (optional) — (large)

### Goal
Allow plugins to render custom UI in known slots (e.g. group detail sidebar, dashboard card).

### Tasks
- [ ] Define slot names and contract (e.g. `group.detail.sidebar`, `dashboard.cards`)
- [ ] Plugin exports React component or server fragment; loader mounts it in slot
- [ ] Security and sanitisation for plugin-rendered content
- [ ] Versioning (minAppVersion in manifest) to avoid breakage

### Deliverables
- Optional custom cards or panels on group/dashboard pages provided by plugins.

## Dependencies

- Current plugin system (templates + channels) must be stable and documented.
- Billing calculator and group model are the main integration points for phases 1–2.

## Estimated Total Effort

Roughly 2–4 weeks for phases 1–3 (billing modes, payment platforms, webhooks); phase 4 (UI) is optional and larger (1–2 weeks) depending on security and slot design.
