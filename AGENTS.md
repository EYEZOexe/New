# Agent Rules (Codex)

This file defines project-specific rules for Codex/agents working in this repo.

## Engineering Standards (Required)

- Prefer the simplest solution that works (KISS). Avoid speculative abstractions (YAGNI).
- Apply DRY: deduplicate logic and centralize shared behavior (helpers/modules) when repetition appears.
- Follow SOLID where it makes code easier to change:
  - Single Responsibility: small modules/functions with one job.
  - Dependency boundaries: keep infrastructure concerns (Appwrite/Discord/Sell.app) behind small adapters.
- TypeScript hygiene:
  - Avoid `any` unless you have a clear boundary and a TODO to remove it.
  - Validate untrusted input (API routes, webhooks) and fail with clear errors.
- Error handling:
  - Use early returns, avoid deep nesting.
  - Return consistent error shapes from API routes.
- Changes should include verification:
  - Run the most relevant `pnpm` script(s) (at minimum `pnpm -w typecheck`).
  - If you claim "build works", run `pnpm -w build`.

## Living Roadmap Is The Source Of Truth

- Always treat `docs/roadmap.md` as the canonical "overall plan".
- At the end of any task/feature/bugfix where you would normally say "done":
  - Update `docs/roadmap.md` to reflect reality.
  - Mark checklist items complete with a completion date (`YYYY-MM-DD`).
  - Update "Current Status" (Now/Next/Blockers) if it changed.
  - Add a link to any new `docs/plans/YYYY-MM-DD-*.md` documents, and optionally the PR/commit.
- If a change introduces a new risk/blocker (e.g. infra/domain/SSL), add it to the "Blockers / Risks" section.
