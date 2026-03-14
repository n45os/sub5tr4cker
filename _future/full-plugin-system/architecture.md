# Architecture: Full Plugin System

## Approach

Extend the existing plugin loader and manifest (see `src/lib/plugins/manifest.ts` and `loader.ts`) so that a plugin can declare not only `templates` and `channels` but also `billingModes`, `paymentPlatforms`, and optionally `uiHooks` or `webhooks`. The core app would register these at startup: billing calculator would consult a registry of mode handlers (built-in + plugin); payment platform dropdown and validation would come from a similar registry; UI could render optional plugin-provided components in known slots (e.g. group detail sidebar). Webhooks would be registered as HTTP endpoints the app calls on events (e.g. POST to plugin-defined URL with HMAC). All of this stays file-based and GitHub-installed; no sandboxing in the first iteration. See decisions.md for why we deferred this and shipped templates + channels only first.

## Components

### Plugin manifest (extended)
- **Purpose**: Declare billing modes, payment platforms, UI entry points, webhook config.
- **Tech**: Same `substrack-plugin.json` schema extended with optional `billingModes`, `paymentPlatforms`, `webhooks`.
- **Integrates with**: Loader, billing calculator, settings, notification service.

### Billing mode registry
- **Purpose**: Map mode id (e.g. `equal_split`, `plugin:myplugin:tiered`) to a function that computes per-member amounts.
- **Tech**: Same loader pattern; plugin exports `computeSplit(group, period)` or similar.
- **Integrates with**: `src/lib/billing/calculator.ts`, Group model billing.mode.

### Payment platform registry
- **Purpose**: List of platform ids and labels (and optional validation/UI); group.payment.platform can be plugin-provided.
- **Tech**: Manifest declares platforms; optional plugin file for custom validation or link generation.
- **Integrates with**: Group form, payment instructions UI.

### Webhook dispatcher
- **Purpose**: On events (member added, payment confirmed, etc.), POST to plugin-configured URLs with signed payload.
- **Tech**: New module in `src/lib/plugins/webhooks.ts`; config stored under `plugin.<slug>.webhookUrl` and optional secret.
- **Integrates with**: Notification service, billing confirmation flow, group/member APIs.

## Data Flow

- On app startup, loader reads `plugins/registry.json`, loads each plugin manifest, validates and registers templates, channels, and (in full system) billing modes, payment platforms, webhooks.
- When calculating split, billing calculator looks up mode in registry and calls the appropriate handler (built-in or plugin).
- When sending notifications, channel registry is used (already implemented). When emitting events, webhook dispatcher would iterate plugin webhooks and POST.
- Settings UI already supports `plugin.<slug>.<key>`; webhook URL and secret would be stored there.

## Integration Points

- **Existing**: `src/lib/plugins/loader.ts`, `channels.ts`, `templates.ts`, `manifest.ts`; `src/lib/billing/calculator.ts`; `src/models/group.ts` (billing.mode, payment.platform); settings API and Plugins tab.
- **New**: Billing mode registry, payment platform registry, webhook dispatcher, optional UI slot components.

## Tech Stack Additions

| Technology | Purpose | Why this one |
|-----------|---------|---------------|
| (none new) | — | Extend current Node/Next.js plugin loader and manifest; no new runtime deps. |
