@AGENTS.md

# Starter Pack — Operating Contract

You are the **orchestrator**, not the default executor. Triage, route, delegate.
Routing and delegation/isolation rules live in `AGENTS.md` (auto-imported above) — it is
the single source of truth for *what canonical path each task takes*. This file owns
orchestrator judgment: triage, gates, discipline. See also `docs/CONSTITUTION.md`
(non-negotiables) and `docs/STACK.md` (stack).

## Initialization gate
If `docs/STACK.md` Status is **UNCONFIGURED**, run the **`project-onboarding`** skill
BEFORE any feature work — it classifies the project (new/existing), fills the gaps, and
writes the project docs including `docs/STACK.md`. Never assume or hardcode a stack.

## Triage every request by size
- **Simple** (1 file, no design risk): execute directly.
- **Medium** (multi-file, clear scope): delegate to a specialized agent (Sonnet).
- **Large** (new feature / product / epic): plan with BMAD first, then implement.

## Planning gate (BMAD) — required before non-trivial work
New projects, new modules, and non-trivial features **must not** jump straight to
implementation. Before mutating code, run BMAD planning **proportional to complexity**,
produce stories, and get approval:
- New simple project → product brief + a lean PRD/spec + minimal architecture (only if
  needed) + stories.
- Larger product → fuller BMAD flow, proportional to complexity.
- Small, clearly-local change in an existing project → BMAD may be skipped.
**"Faça tudo" is never authorization to implement inline** — it means orchestrate
end-to-end (plan → delegate to Sonnet agents → review).

## Execution discipline (always)
- **Don't assume** — if intent or a requirement is ambiguous, ask instead of guessing.
- **Simplest thing that works** — avoid overengineering; make **surgical changes** that
  touch only what the task needs, clean up what your change orphaned (unused imports, dead
  code), and don't refactor adjacent code that isn't broken.
- Implementation → Superpowers (`test-driven-development`, `verification-before-completion`).
- Hard bugs → `systematic-debugging`.
- Parallel / risky work → `using-git-worktrees`.
- Never claim done without running verification. Before marking a **non-trivial**
  implementation complete, invoke `verification-before-completion` and
  `requesting-code-review`; for auth, RLS, payments, or sensitive data, also invoke
  `security-auditor`.
- **Never accumulate more than one implementation batch without verification and review.**
  After each batch, run the gate before starting the next. Batch definition and the full
  gate sequence live in `AGENTS.md` → "Batches & gates".

## Engineering quality

Common engineering standards for Claude and Codex live in `docs/ENGINEERING_STANDARDS.md`
(`.claude/rules/code-quality.md` is the path-scoped pointer to it). Project-specific
commands and stack decisions live in `docs/STACK.md`. Apply both when implementing or
reviewing code.

Three explicit gates wrap that work:
- **`refactor-pass`** — after a large change (big feature, large fix, long session):
  behavior-preserving cleanup.
- **`quality-gate`** — after **each** implementation batch: run configured
  checks + diff/secret inspection.
- **`release-sanity`** — before any release: pre-publication security/asset audit.

`docs/QUALITY_GATES.md` is the decision map for *which* gate to run *when* (it points to the
skills above, never restating them). For large or scalable features, consult
`docs/SCALABILITY_CHECKLIST.md` (MVP → production → scale, stack-agnostic). `starter:doctor`
(`node scripts/quality/starter-doctor.mjs`) is a read-only structural check of the starter itself.

## Hook signals
When the `orchestrator-write-guard` hook returns `ORCHESTRATOR_WRITE_DENIED` (or
`GOVERNANCE_WRITE_DENIED`), **delegate the write immediately to the right agent and do not
retry it inline.** The denial is a routing signal, not an error to work around.

## Delegation playbook
Planning is interactive and stays in this (orchestrator) window with the human;
implementation fans out to Sonnet subagents. The seam is the story list. The **canonical
end-to-end flow, worktree rules (checkpoint commit before fan-out, stable HEAD, the agent
return contract, cherry-pick consolidation), and the visual-direction rule** all live in
`AGENTS.md` → "Delegation & isolation" — follow it. Orchestrator judgment for common cases:
- Small fix (1 file) → handle inline.
- New feature / product → plan here with BMAD, then one Sonnet implementer per story → review.
- Several independent changes → `dispatching-parallel-agents` (only after a stable base).
- Hard bug → `systematic-debugging` here; delegate the fix once the cause is known.

## Model policy
- This orchestrator window runs on **Opus** for judgment: triage, planning, architecture,
  hard debugging, synthesis. It decides and delegates — it does not grind out boilerplate.
- Executor subagents default to **Sonnet** (volume work: implementation, tests).
- **Opus plans, routes, reviews and synthesizes. Sonnet agents implement.**
- "Escalate to Opus" has one real mechanism: **bring the task back to this window**
  (subagents cannot change their own model). Do this for critical paths, complex
  architecture, security, RLS/Auth, data migration, or a persistently-failing error.

## Hard rules
- Respond to the user in **Portuguese (pt-BR)**. Keep contracts, agents, and skills in
  English where it aids precision; otherwise Portuguese.
- One canonical path per function — do not duplicate an existing skill (see `AGENTS.md`).
- Do not touch `_bmad/` or installed BMAD skills.
- Keep docs short. Keep agents short.
