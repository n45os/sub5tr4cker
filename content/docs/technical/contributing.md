---
title: Contributing
description: How to contribute code, docs, and feedback to SubsTrack.
---

# Contributing

SubsTrack is open source. Contributions to code, documentation, and design are welcome.

## Getting started

1. Fork the repository and clone your fork.
2. Install dependencies: `npm install`.
3. Copy `.env.example` to `.env.local` and set at least `MONGODB_URI` and `NEXTAUTH_SECRET`.
4. Run MongoDB locally (e.g. Docker: `docker run -d -p 27017:27017 mongo:7`).
5. Run the app: `npm run dev`.
6. Open [http://localhost:3054](http://localhost:3054).

## Project structure

- **`src/app/`** — Next.js App Router (pages, API routes).
- **`src/lib/`** — Core logic (db, auth, email, telegram, billing, notifications).
- **`src/models/`** — Mongoose models.
- **`src/jobs/`** — Cron job definitions.
- **`docs/`** — Architecture and API design (source of truth for the plan).
- **`content/docs/`** — User and technical docs (rendered at `/docs`).

See `AGENTS.md` in the repo for a fuller map and conventions.

## Conventions

- **Comments** — Start with a lowercase letter; no trailing period.
- **TypeScript** — Strict mode; prefer `const`; use Zod for request validation.
- **API** — Return `{ data }` on success, `{ error: { code, message } }` on failure.
- **Commits** — Clear, concise messages. Prefer “feat: …”, “fix: …”, “docs: …”.

## Pull requests

1. Create a branch from `main` (e.g. `feat/telegram-link` or `fix/reminder-timezone`).
2. Make your changes; keep PRs focused.
3. Ensure the app builds: `npm run build`.
4. Run the linter: `npm run lint`.
5. Open a PR with a short description and, if relevant, a link to an issue.
6. Address review feedback; maintainers will merge when ready.

## Documentation

- **User-facing docs** — Edit or add Markdown under `content/docs/user-guide/` or `content/docs/technical/`. They are rendered at `/docs` on the same site.
- **Technical design** — Update `docs/PLAN.md`, `docs/api-design.md`, or `docs/data-models.md` in the repo when you change architecture or APIs.
- **README** — Update the main README if you change setup, env, or deployment.

## Reporting issues

Use the repository’s issue tracker. Include:

- SubsTrack version or commit.
- What you did, what you expected, what happened.
- Relevant logs or screenshots (redact secrets).

## Feature ideas

Open an issue with the “enhancement” or “feature” label. Describe the use case and, if you have one, a proposed approach. Discussion there helps before a PR.

## Code of conduct

Be respectful and constructive. The project maintainers reserve the right to moderate discussions and PRs.

Thank you for contributing.
