# Risks: Full Plugin System

## High Risk

### Plugin code runs in process
- **What could go wrong**: A buggy or malicious plugin can crash the app or access all data.
- **Likelihood**: medium (depends on who installs what)
- **Impact**: high
- **Mitigation**: Document that plugins are trusted code; consider only loading plugins from a curated list or requiring review. Sandboxing (workers) is a later option.

## Medium Risk

### Version skew between app and plugins
- **What could go wrong**: After an app upgrade, plugin exports (e.g. billing mode signature) change and plugins break.
- **Likelihood**: medium
- **Impact**: medium
- **Mitigation**: Manifest declares `minAppVersion` or compatible API version; loader warns or skips incompatible plugins. Maintain a small plugin API surface and avoid breaking changes.

### Webhook delivery and secrets
- **What could go wrong**: Webhook URL or secret leaked; or delivery failures not visible to admin.
- **Likelihood**: low
- **Impact**: medium
- **Mitigation**: Store webhook secret in settings (encrypted like other secrets); add simple delivery log or retry policy.

## Low Risk

### Performance of many plugins
- **What could go wrong**: Dozens of plugins slow startup or notification send.
- **Likelihood**: low
- **Impact**: low
- **Mitigation**: Lazy-load plugin modules where possible; keep registry scan cheap.

## Unknowns

- Whether the community will actually build plugins (templates/channels first will validate demand).
- Whether UI slots (phase 4) are worth the complexity or if webhooks + API are enough for integrations.
