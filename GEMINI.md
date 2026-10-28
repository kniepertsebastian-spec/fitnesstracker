# Fitnesstracker — Gemini Instructions

## Project
Personal, ad-free fitness tracking PWA.
Stack: pnpm workspaces, Node.js, TypeScript, Fastify, React, Vite, Tailwind CSS, TanStack Query, PostgreSQL, Prisma, vite-plugin-pwa.
Packages: `backend/`, `frontend/`, `packages/shared/`.
Deployment: Docker Compose, Caddy and Cloudflare Tunnel.

## General Workflow
- Reply in German; keep responses concise.
- Inspect relevant code, tests, configuration and project instructions before making changes.
- Follow existing architecture and conventions. Prefer minimal, targeted changes.
- Search before opening large files. Read only relevant context.
- Do not assume behavior that is not supported by the code or documentation.
- Ask questions only when ambiguity blocks safe implementation.
- Never claim checks passed unless actually run.

## Code Reviews
- Report only actionable, code-supported findings.
- Prioritize correctness, security, data integrity, offline synchronization and regressions.
- List findings first, highest severity first.
- For each finding, state severity, file/line, triggering condition, concrete impact and recommended fix.
- Verify the relevant execution path and check existing safeguards.
- Prefer fewer high-confidence findings over many low-confidence findings.
- Do not invent findings to fill a quota.
- Do not modify code during a review unless explicitly asked.
- Focus on changed code and direct dependencies by default.
- Inspect wider code paths only when needed to validate a finding or when explicitly requested.

### Ignore Unless Material
Do not report:
- Purely stylistic preferences, formatting or naming suggestions without concrete benefit.
- Hypothetical issues without a realistic, code-supported failure scenario.
- Assumptions unsupported by the repository or task context.
- Feature requests or enhancements outside the requested scope.
- Unrelated pre-existing issues unless they create a serious security or data-integrity risk.
- Duplicate findings caused by the same root issue.
- Minor optimizations without plausible, meaningful user impact.
- Generic best-practice advice without a specific defect.
- Issues already prevented by a verified safeguard.
- Test coverage gaps alone, unless they leave an important, concrete regression insufficiently detected.

Never ignore a substantiated security, privacy, synchronization or data-loss issue merely because it exists in unchanged code.

## Security and Privacy
- Treat the app as a private, single-user application, but never assume public endpoints are safe.
- Enforce authentication and authorization server-side.
- Validate request bodies, query parameters, path parameters and imported external data.
- Never trust client-supplied ownership, user IDs or permissions.
- Protect JWT secrets, setup tokens, database credentials and other environment secrets.
- Never expose secrets in logs, API responses, error messages or frontend bundles.
- Preserve the setup-token protection for registration unless explicitly instructed otherwise.
- Avoid leaking personal fitness data, progress photos or profile information.
- Validate file uploads, including file type, size and storage paths.
- Prevent path traversal and unauthorized access to private progress photos.
- Apply appropriate rate limits and safe error handling to API endpoints.
- Never weaken security controls to make a test pass.

## Offline and PWA Behavior
For relevant changes, inspect:
- Service worker installation, activation and updates.
- Cache invalidation and stale frontend assets.
- Offline workout entry and recovery after network failures.
- Synchronization when connectivity returns.
- Duplicate writes, retry behavior and idempotency.
- Conflicts between locally changed and server-side data.
- Authentication expiry during offline use.
- Whether private API responses or personal data are cached inappropriately.
- Installability, manifest configuration and mobile usability.

Preserve locally entered workout data across temporary network failures.
Do not assume a request succeeded merely because it was queued locally.
Ensure synchronization failures are visible and recoverable.
Avoid duplicate records when requests are retried.
Follow existing synchronization and persistence patterns rather than introducing a second mechanism.

## Backend and Database
- Follow existing Fastify module and route conventions.
- Use Prisma for schema changes and migrations.
- Preserve existing data and migration history.
- Validate data at API boundaries.
- Use transactions when related database operations must succeed or fail together.
- Check pagination and query sizes where relevant.
- Avoid N+1 queries and unnecessarily broad database reads when they have meaningful impact.
- Keep seed and import operations safe to rerun when their existing design requires idempotency.
- Preserve the exercise source adapter interface and import/upsert behavior.
- Never run destructive operations or modify production data without explicit approval.

## Fitness Data Integrity
- Preserve the relationships between exercises, workouts, sets, repetitions and recorded weights.
- Check units, numeric boundaries and rounding where relevant.
- Ensure goal progress is calculated consistently with existing rules.
- Preserve the intended eight-week training-plan rotation.
- Do not silently discard workout records or overwrite newer data during synchronization.
- Treat body measurements, nutrition information and progress photos as private personal data.
- Do not introduce medical diagnoses or present calculated fitness estimates as medical advice.
- Preserve existing formulas and document any intentional changes to calculations.

## Frontend and UX
- Follow existing React, Tailwind CSS and TanStack Query patterns.
- Keep UI components consistent with the existing design system and UI-token checks.
- Handle loading, empty, error, offline and retry states where relevant.
- Ensure workout entry remains practical on mobile devices.
- Preserve keyboard accessibility, semantic HTML and adequate contrast.
- Avoid unnecessary dependencies and abstractions.
- Do not duplicate server state in local state without a clear reason.

## Implementation
- Make the smallest change that correctly solves the problem.
- Add or update focused tests for changed behavior.
- Consider backend, frontend and shared-package effects in this monorepo.
- Check whether shared types or API contracts need coordinated updates.
- Read relevant Docker, Caddy and deployment configuration before changing deployment behavior.
- Never assume production environment variables or secrets are available locally.
- Do not change unrelated files merely to clean them up.

## Verification
Inspect `package.json` and workspace package scripts before choosing commands.

Run focused checks first. Use the following root scripts when appropriate:
- `pnpm typecheck`
- `pnpm test`
- `pnpm lint`
- `pnpm build`
- `pnpm check:ui`

Run only relevant checks for small changes; use broader verification for cross-package, synchronization, authentication or deployment changes.

- Report which checks were actually run.
- State failures, skipped checks and environmental limitations honestly.
- Database-dependent tests may require a configured test database.
- Do not claim runtime, offline or deployment behavior was verified without actually testing it.

## Context and Token Efficiency
- Read only files relevant to the task.
- Search before reading large documentation files.
- Load `ARCHITECTURE.md`, `ROADMAP.md` and `context.md` only when relevant.
- Do not read the entire repository by default.
- Avoid repeating documentation already present in the repository.
- Prefer concise explanations and focused diffs.
- For reviews, prioritize reproducible defects over speculative edge cases.

## Output
### Reviews
- Findings first, highest severity first.
- Include file/line references, trigger, impact and fix.
- If no actionable issues are found, say so clearly.
- Keep the overall summary brief.

### Code Changes
- Summarize changes and rationale.
- List relevant checks actually performed.
- Mention remaining risks and limitations.
- Never claim unverified success.
