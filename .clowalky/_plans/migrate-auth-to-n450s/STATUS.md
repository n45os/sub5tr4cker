| ID | Phase | Status | Depends on | Brief | Started | Completed | Notes |
|----|-------|--------|------------|-------|---------|-----------|-------|
| 0 | Decide auth scope + register OAuth client | complete | — | phase-00-scope-and-client.md | 2026-05-03 | 2026-05-03 | OAuth client registration is operator-driven (separate repo + running auth service); decisions.md documents the procedure and target values. Secret stays out of repo. |
| 1 | Add OIDC config + JWKS verifier helpers | complete | 0 | phase-01-oidc-helpers.md | 2026-05-03 | 2026-05-03 | jose@^6.2.1 added; jwks.test.ts covers happy / wrong-iss / wrong-aud / expired / bad-signature. Pre-existing lint errors in unrelated files left untouched; tests in `src/lib/billing/*` are unrelated WIP and out of scope. |
| 2 | Implement n450s login + callback routes | complete | 1 | phase-02-login-callback.md | 2026-05-03 | 2026-05-03 | setSessionTokens left as a no-op stub in callback route — phase 3 wires real cookie writes. HMAC sign/verify helpers duplicated across login/callback (no shared module added since it would fall outside the brief's "Files to touch" allowlist). |
| 3 | Token storage + middleware refresh (sliding sessions) | pending | 2 | phase-03-token-refresh.md | | | this is the "persistent sessions" fix |
| 4 | Rewrite `auth()` wrapper around n450s tokens (advanced mode) | pending | 3 | phase-04-auth-wrapper.md | | | local mode unchanged |
| 5 | User-row linking (`User.authIdentityId = sub`) | pending | 4 | phase-05-user-link.md | | | migration script for existing users |
| 6 | Remove Credentials + Magic-invite providers | pending | 4,5 | phase-06-deprecate-providers.md | | | invite flow uses n450s invite codes |
| 7 | Login UI rewrite (n450s redirect, Google via n450s, fallback states) | pending | 4 | phase-07-login-ui.md | | | parallel with 5/6 if no overlap |
| 8 | Tests + integration smoke | pending | 5,6,7 | phase-08-tests.md | | | |
| 9 | Production cutover + rollback plan | pending | 8 | phase-09-cutover.md | | | manual; documented procedure |
