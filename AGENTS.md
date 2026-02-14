# Agent Rules (Codex)

This file defines project-specific rules for Codex/agents working in this repo.

## Engineering Standards (Required)

- Prefer the simplest solution that works (KISS). Avoid speculative abstractions (YAGNI).
- Apply DRY: deduplicate logic and centralize shared behavior (helpers/modules) when repetition appears.
- Follow SOLID where it makes code easier to change.
- SOLID: Single Responsibility. Prefer small modules/functions with one job.
- SOLID: Dependency boundaries. Keep infrastructure concerns (Convex/Discord/Sell.app) behind small adapters.
- TypeScript hygiene: avoid `any` unless you have a clear boundary and a TODO to remove it.
- TypeScript hygiene: validate untrusted input (API routes, webhooks) and fail with clear errors.
- Error handling: use early returns, avoid deep nesting.
- Error handling: return consistent error shapes from API routes.
- Changes should include verification: run the most relevant `pnpm` script(s) (at minimum `pnpm -w typecheck`).
- Changes should include verification: if you claim "build works", run `pnpm -w build`.

## Living Roadmap Is The Source Of Truth

- Always treat `docs/roadmap.md` as the canonical "overall plan".
- At the end of any task/feature/bugfix where you would normally say "done":
- Update `docs/roadmap.md` to reflect reality.
- Mark checklist items complete with a completion date (`YYYY-MM-DD`).
- Update "Current Status" (Now/Next/Blockers) if it changed.
- Add a link to any new `docs/plans/YYYY-MM-DD-*.md` documents, and optionally the PR/commit.
- If a change introduces a new risk/blocker (e.g. infra/domain/SSL), add it to the "Blockers / Risks" section.
