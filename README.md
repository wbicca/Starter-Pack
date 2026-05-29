# BRX Starter

A company-wide Claude Code starter template. Clone it to begin any new project with a
consistent orchestration layer, specialized agents, security hooks, and a governed skill
ecosystem already in place. Built on **BMAD** (planning) + **Superpowers** (execution
discipline), everything vendored in-repo so it works without external plugins.

## Start here
On a freshly cloned project, run the **`project-onboarding`** skill first. It classifies
the project (new/existing + type), asks only the essential gaps, and writes the project
docs (`docs/PROJECT_BRIEF.md`, `STACK.md`, `ARCHITECTURE.md`, `DECISIONS.md`).
`docs/STACK.md` ships **UNCONFIGURED** on purpose — onboarding fills it per project.

## The canonical flow
1. **Onboard** → `project-onboarding` establishes project context and docs.
2. **Plan** (large work) → BMAD: `bmad-prd`, epics/stories, `bmad-create-architecture`.
3. **Build** → Superpowers discipline: `test-driven-development`, `verification-before-completion`.
4. **Review** → `requesting-code-review` (canonical).
The orchestrator (main Claude) triages every request and delegates — see `CLAUDE.md`.

## Map
- **`CLAUDE.md`** — how the orchestrator operates (triage, model policy, init gate).
- **`AGENTS.md`** — routing contract: the single canonical skill per task.
- **`docs/CONSTITUTION.md`** — non-negotiables.
- **`docs/STACK.md`** — the project's resolved stack (filled at onboarding).
- **`.claude/agents/`** — 12 specialized subagents (Sonnet by default).
- **`.claude/skills/`** — vendored skills: `project-onboarding`, `skill-discovery`, + BMAD & Superpowers.
- **`.claude/hooks/`** — security/quality hooks (dangerous-command block, env-file protection, secret scan, auto-format).

## Extending capabilities
Need something new? Use **`skill-discovery`** — it evaluates internal/external options and
recommends, but never installs. Installing, vendoring, or enabling a global plugin always
requires explicit human approval (see `docs/CONSTITUTION.md` §1).
