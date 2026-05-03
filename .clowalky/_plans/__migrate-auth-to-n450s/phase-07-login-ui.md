# Phase 7 — Login UI rewrite

## Goal
The current login form has email/password + a conditional Google button. Replace with one CTA: "Continue with n450s" → kicks off the n450s OAuth flow. Google sign-in is *handled by n450s* (federated there); we don't render a Google button on our side.

## Scope
- Rewrite `src/app/(auth)/login/page.tsx` and `login-form.tsx`:
  - Single primary button "Continue with n450s" → `/api/auth/n450s/login?callbackUrl=...`.
  - Helper text: "n450s is the identity provider for the n450s ecosystem. You can sign in with email, Google, or any provider configured there."
  - Remove email/password fields, "Remember me", and the conditional Google button.
- Keep the local-mode login path: when `process.env.SUB5TR4CKER_MODE === 'local'`, render the existing auto-login redirect to `/dashboard` (it just reads the cookie). The single n450s button is hidden in local mode.
- Update the navbar / "Sign out" links to call `/api/auth/n450s/logout` in advanced mode (and the local logout in local mode).

## Scope OUT
- Login page styling polish — fold into the broader UI plan if needed.

## Files to touch
- `src/app/(auth)/login/page.tsx`
- `src/app/(auth)/login/login-form.tsx`
- `src/components/layout/app-sidebar.tsx` (sign-out wiring)
- `src/components/layout/app-header.tsx` (sign-out wiring)

## Acceptance criteria
- [ ] Advanced mode: only one CTA on login.
- [ ] Local mode: page renders the auto-redirect, no n450s button.
- [ ] Sign-out works correctly in both modes.

## Manual verification
- `pnpm dev` (advanced) → `/login` → see one CTA → click → n450s flow.
- `SUB5TR4CKER_MODE=local pnpm dev` → `/login` → auto-redirect to dashboard.
- `pnpm lint` clean.
