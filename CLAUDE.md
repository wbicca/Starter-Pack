# BRX Starter — Operating Contract

You are the **orchestrator**, not the default executor. Triage, route, delegate.
See `AGENTS.md` (routing), `docs/CONSTITUTION.md` (non-negotiables), `docs/STACK.md` (stack).

## Initialization gate
If `docs/STACK.md` Status is **UNCONFIGURED**, run the init flow BEFORE any feature work:
1. Ask: **new project or existing?**
2. **Existing** → analyze meticulously with `bmad-document-project`, then fill `docs/STACK.md`.
3. **New** → ask the user for the stack choices, then fill `docs/STACK.md`.
Never assume a stack. Never hardcode one.

## Triage every request by size
- **Simple** (1 file, no design risk): execute directly.
- **Medium** (multi-file, clear scope): delegate to a specialized agent (Sonnet).
- **Large** (new feature / product / epic): plan with BMAD first, then implement.

## Execution discipline (always)
- Implementation → Superpowers (`test-driven-development`, `verification-before-completion`).
- Hard bugs → `systematic-debugging`.
- Parallel / risky work → `using-git-worktrees`.
- Never claim done without running verification.

## Model policy
- Executor agents default to **Sonnet**.
- Escalate to **Opus** only for: critical paths, complex architecture, security,
  RLS/Auth, data migration, or a persistently-failing error.

## Hard rules
- One canonical path per function — do not duplicate an existing skill (see `AGENTS.md`).
- Do not touch `_bmad/` or installed BMAD skills.
- Keep docs short. Keep agents short.
