---
name: project-onboarding
description: >
  Initialize a project bootstrapped from the Starter Pack template. Use when a project is
  being set up for the first time, when the user says "onboard this project", "set up a new
  project", "initialize the starter", or when docs/STACK.md still reads UNCONFIGURED.
  Onboarding classifies the project, fills the gaps, and writes the project docs — it is NOT
  implementation.
---

# Project Onboarding (Codex)

Codex wrapper for the shared onboarding flow. The canonical procedure lives in the Claude
skill (`.claude/skills/project-onboarding/SKILL.md`) — **read that file as the source of
truth and follow it exactly.** This wrapper only makes the skill discoverable to Codex; it
deliberately does not restate the steps, so the two can never drift (a parallel rewrite
here previously fell behind and dropped fields the gates read).

You produce **documents and decisions, not features.** Never write application code, install
dependencies, run migrations, or deploy during onboarding.

Codex notes (everything else follows the canonical skill):
- Do the **full Step 0 question batch**, including the profile question (`light`/`standard`)
  and the planning-track question (`BMAD` / `manual specs`) — these set fields the gates
  actually read (`Profile`, Capabilities). Skipping them leaves `docs/STACK.md` silently
  defaulting to `standard` with no recorded choice, and Codex has no write-guard to catch it.
- In the docs step, set **`Profile`, `App root`, Visual language** and **seed the CI**
  (`templates/project-ci.yml`) exactly as the canonical skill instructs.
- Claude-specific advisory routing (Claude subagents, the codegraph MCP check) is optional —
  ignore it if unavailable; use `explorer` or shell inspection for read-heavy scanning.
- Resolve the repo root before reading templates: `REPO_ROOT="$(git rev-parse --show-toplevel)"`,
  then read from `$REPO_ROOT/.claude/skills/project-onboarding/templates/`.
