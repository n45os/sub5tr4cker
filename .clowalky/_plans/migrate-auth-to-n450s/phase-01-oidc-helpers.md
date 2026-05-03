# Phase 1 — OIDC config + JWKS verifier helpers

## Goal
Build the low-level OIDC plumbing — discovery URL, JWKS-based JWT verification, token-exchange and refresh helpers — as standalone functions with zero coupling to NextAuth. Later phases compose them.

## Scope
- New `src/lib/auth/n450s/config.ts`:
  - Reads `AUTH_SERVICE_URL`, `OAUTH_CLIENT_ID`, `OAUTH_CLIENT_SECRET`, `OAUTH_REDIRECT_URIS`.
  - Throws at boot in advanced mode if any required var is missing (local mode just skips).
- New `src/lib/auth/n450s/jwks.ts`:
  - Lazily creates a `createRemoteJWKSet` from `${AUTH_SERVICE_URL}/.well-known/jwks.json`.
  - Exports `verifyAccessToken(token: string): Promise<N450sJwtPayload>` — verifies issuer (`n450s-auth`), algorithm (`RS256`), audience (`service:${OAUTH_CLIENT_ID}`).
- New `src/lib/auth/n450s/oauth-client.ts`:
  - `exchangeCodeForTokens(code, codeVerifier)` — POSTs to `/oauth/token` with grant `authorization_code`.
  - `refreshTokens(refreshToken)` — POSTs to `/oauth/token` with grant `refresh_token`.
  - `revokeRefreshToken(refreshToken)` — POSTs to `/oauth/revoke`.
  - `getUserinfo(accessToken)` — GET `/oauth/userinfo` (used as a fallback for missing claims).
- Add `jose` to dependencies (already common; pin to a recent version).
- Unit tests for `verifyAccessToken` happy / wrong-iss / wrong-aud / expired paths using a stubbed JWKS.

## Scope OUT
- Any HTTP routes — phase 2.
- Token storage — phase 3.

## Files to touch
- `src/lib/auth/n450s/config.ts`
- `src/lib/auth/n450s/jwks.ts`
- `src/lib/auth/n450s/oauth-client.ts`
- `src/lib/auth/n450s/jwks.test.ts`
- `package.json` (`jose` dep)

## Acceptance criteria
- [ ] `verifyAccessToken` rejects wrong issuer, wrong audience, expired tokens, and invalid signatures.
- [ ] `exchangeCodeForTokens` and `refreshTokens` correctly format the body and headers.
- [ ] No reference to NextAuth or Auth.js anywhere in these files.

## Manual verification
- `pnpm test -- src/lib/auth/n450s` green.
- `pnpm lint` clean.
