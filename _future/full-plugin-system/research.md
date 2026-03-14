# Research: Full Plugin System

> research conducted on 2026-03-18

## Similar Solutions / Prior Art

### WordPress plugins
- **URL**: https://developer.wordpress.org/plugins/
- **What it does**: Hooks and filters for extending core behaviour; plugin manifest (header in PHP); install from zip or directory.
- **Relevant takeaway**: Hook naming and documentation are critical; many projects use a filter/hook registry pattern.

### Obsidian plugins
- **URL**: https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin
- **What it does**: TypeScript/JavaScript plugins with a manifest (manifest.json), lifecycle (onload, onunload), and API surface from the app.
- **Relevant takeaway**: Clear API boundary and versioned manifest (minAppVersion) reduce breakage.

### Stripe Apps / Connect
- **URL**: https://stripe.com/docs/connect
- **What it does**: Third-party extensions for Stripe dashboards and payment flows; OAuth and webhook events.
- **Relevant takeaway**: Webhooks and scoped config (per-account) are common for payment-related extensions.

## Technology Options

### Option A: Keep file-based plugins (current)
- **Pros**: No extra runtime; install via CLI and git clone; simple.
- **Cons**: No sandbox; plugin code runs in process; need to trust repo.
- **Links**: Current implementation in `src/lib/plugins/`.

### Option B: Sandboxed workers or subprocess
- **Pros**: Isolation; can kill misbehaving plugins.
- **Cons**: Complexity; IPC; slower; harder to share DB/auth.
- **Links**: Node worker_threads, child_process.

### Option C: Remote plugins (HTTP API)
- **Pros**: Language-agnostic; deploy separately.
- **Cons**: Latency; auth; versioning across network.
- **Links**: n/a.

## Key Findings

- Current SubsTrack plugin system (templates + channels) uses a manifest (`substrack-plugin.json`), registry (`plugins/registry.json`), and loader that reads from disk. Extending to more “extension points” (billing, payment, UI) would follow the same pattern: manifest declares `provides.billingModes`, `provides.paymentPlatforms`, etc., and the app registers them at startup.
- docs/PLAN.md already mentions “Plugin system for custom notification channels” (Phase 4) and “Pluggable email provider” / “Pluggable notification channels”. Full plugin system expands that to billing and payment.

## Raw Links

- https://developer.wordpress.org/plugins/ — WordPress plugin handbook
- https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin — Obsidian plugin development
- https://stripe.com/docs/connect — Stripe Connect for extensibility
