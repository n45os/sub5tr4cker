# Full Plugin System

- **slug**: full-plugin-system
- **registered**: 2026-03-18
- **last updated**: 2026-03-18
- **status**: new
- **priority**: low
- **tags**: plugins, extensibility, billing, payment, webhooks

## Summary

SubsTrack currently has a plugin system for notification templates and channels (install from GitHub, register in `plugins/registry.json`). This idea captures extending that system to support more extension points: custom billing modes, payment platforms, UI widgets, webhook endpoints, and other pluggable behaviour. The goal is to let the community add new ways to split costs, new payment methods, and dashboard customisations without forking the app. This idea is logged for future planning; the current scope (templates + channels) is implemented first.

## Goal

Admins and developers can install plugins that add new billing modes, payment platforms, dashboard widgets, and webhook integrations, with configuration stored in app settings and a consistent install/update story (e.g. GitHub-based).

## Scope

### In scope
- Plugin-provided billing modes (e.g. custom split formulas, tiered pricing)
- Plugin-provided payment platforms (beyond revolut, paypal, bank_transfer, stripe, custom)
- Optional UI extension points (e.g. custom cards or tabs on group/dashboard pages)
- Webhook or callback APIs that plugins can register to receive events (e.g. payment confirmed, member added)
- Versioning and compatibility rules for plugins against the core app

### Out of scope
- Replacing the core data model (Group, BillingPeriod, User) with plugin-defined models
- Multi-tenant or white-label hosting as part of this idea
- A public plugin marketplace (only GitHub install for now)

## Open Questions

- How to version plugin API compatibility (e.g. semver for the loader interface)?
- Whether UI extensions should be server-rendered fragments or client-only widgets.
- How webhooks should be secured (per-plugin secrets, HMAC, etc.).
