---
name: quality-gate
description: >
  Mandatory verification after each implementation batch (a story, a structural change, a
  small cohesive set of components, or an approved redesign round). Use after finishing any
  batch and before starting the next, or when the user says "run the quality gate", "verify
  this batch", or "is this ready". Runs ONLY the commands configured in docs/STACK.md,
  inspects the diff for unexpected/unsafe changes, checks for secrets and real .env files,
  and reports a command/result/status table.
---

# Quality Gate (Codex)

Codex wrapper for the shared batch-verification gate. The canonical procedure lives in
the Claude skill (`.claude/skills/quality-gate/SKILL.md`) — read that file as the source
of truth and follow it exactly; this wrapper only makes the skill discoverable to Codex.

Key contract points (details in the canonical skill): read `docs/STACK.md` first and run
only the commands configured there — never invent one; a `TBD`/`UNCONFIGURED` command is
reported as not configured, not skipped silently.
