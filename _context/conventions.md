<!-- last-updated: 2026-03-18 -->

# Conventions

## Code Style

- Comments start lowercase, no trailing period
- Named exports (default exports only for Next.js pages)
- `const` over `let`, never `var`
- Async/await everywhere, no raw promises

## API Routes

- Zod validation on all POST/PATCH bodies
- Auth check via `auth()` from `@/lib/auth`
- Success: `{ data: ... }`, Error: `{ error: { code, message } }`
- Standard HTTP status codes

## Models

- TypeScript interface + Mongoose schema
- `mongoose.models.X || mongoose.model()` pattern
- `timestamps: true` on all schemas
- Indexes declared in schema options

## Components

- shadcn/ui for primitives
- Server components by default, `'use client'` only when needed
- Feature components grouped by domain in `src/components/features/`

## Files

- Kebab-case for files: `billing-period.ts`, not `BillingPeriod.ts`
- PascalCase for components: `GroupCard.tsx`
- Barrel exports via `index.ts` in model and lib directories
