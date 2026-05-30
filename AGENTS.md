# Routing Contract — one canonical path per function

This is a routing reference, not a subagent. For each task type it names the single
canonical skill/stack to use. Resolves all known BMAD ↔ Superpowers overlaps.

## Routing table
> Skill names are the **bare vendored names** (e.g. invoke `brainstorming`, not
> `superpowers:brainstorming`). "Superpowers" / "BMAD" below are just origin labels.

| Task | Canonical | Notes |
|------|-----------|-------|
| Project onboarding (new or existing) | `project-onboarding` | classifies the project + writes docs/PROJECT_BRIEF/STACK/ARCHITECTURE/DECISIONS; uses `bmad-document-project` internally for existing repos |
| Discover / evaluate a new skill | `skill-discovery` | recommends only, never installs (see "External skills are optional") |
| Feature / impl ideation | Superpowers `brainstorming` | default gate before any coding |
| Product discovery for a PRD | `bmad-brainstorming` | only inside the BMAD planning track |
| PRD / product brief | `bmad-prd` | create / update / validate |
| Epics & stories | `bmad-create-epics-and-stories`, `bmad-create-story` | |
| Macro architecture | `bmad-create-architecture` | |
| Technical impl plan (one story) | Superpowers `writing-plans` | the *how*, below PRD altitude |
| Implementation | Superpowers `test-driven-development` + `verification-before-completion` | |
| Unit / integration tests | Superpowers `test-driven-development` | |
| E2E tests | `bmad-qa-generate-e2e-tests` | for existing features |
| Hard bug / fix | Superpowers `systematic-debugging` | |
| Forensic / incident / code-archaeology | `bmad-investigate` | understanding, not fixing |
| Code review (canonical engine) | Superpowers `requesting-code-review` | light, coupled to TDD/verification; continuous |
| Handling review feedback | Superpowers `receiving-code-review` | not a 2nd reviewer |
| Deep adversarial audit (opt-in) | `bmad-code-review` | only when explicitly requested |
| Parallel / risky work | Superpowers `using-git-worktrees` | |

## Duplication rulings (do NOT pick the loser)
- **brainstorming**: Superpowers = default for dev/design; `bmad-brainstorming` = product track only.
- **PRD vs writing-plans**: NOT duplicates — BMAD = product/spec altitude; `writing-plans` = technical plan for a single story.
- **code-review**: Superpowers `requesting-code-review` is THE engine; `receiving-code-review` = protocol for responding. `bmad-code-review` = opt-in deep adversarial audit, never the default.
- **investigate vs systematic-debugging**: bug to fix → `systematic-debugging`; system/incident to understand → `bmad-investigate`.
- **E2E vs TDD**: unit → `test-driven-development`; E2E suites → `bmad-qa-generate-e2e-tests`.
- **DEPRECATED — never use**: `bmad-create-prd`, `bmad-edit-prd`, `bmad-validate-prd` → always `bmad-prd`.

## External skills are optional
Agents route to vendored BMAD/Superpowers skills as their canonical path. Any external
plugin skill (e.g. design or platform helpers) is an **optional enhancement only** —
agents must work without it, falling back to internal best practices, BMAD, Superpowers,
and project docs (see `docs/CONSTITUTION.md` §1).

`skill-discovery` is the mandatory flow for discovering and evaluating any new skill — it
only recommends. Installation, vendoring, and global-plugin decisions belong to the
orchestrator/human and require explicit approval.

**Code navigation (optional):** if the `codegraph` MCP is available, prefer its tools
(`codegraph_search`, `codegraph_context`, `codegraph_explore`, callers/callees/impact)
over raw `Glob`/`Grep` for understanding code structure — it's cheaper and faster. If it's
not configured, fall back to `Glob`/`Grep`. Never required; the project must work without it.

## Authoring a new skill (canonical path)
- Prefer the **`skill-creator`** skill when available; otherwise follow the official skill
  format manually (a folder with `SKILL.md` + valid frontmatter).
- Use **BMAD Builder** (`bmad-module-builder` / `bmad-workflow-builder`) for BMAD modules,
  workflows, and expansion packs — not for simple Claude Code operational skills.
- `skill-discovery` may recommend skills but never installs without explicit approval.

## Delegation & isolation
- Planning (onboarding, PRD, epics, architecture) runs in the orchestrator window with the
  human — never delegated to an isolated agent.
- Implementation fans out from the story list: one Sonnet implementer per story via
  `subagent-driven-development`; independent parallel tasks via `dispatching-parallel-agents`.
- Use a git worktree (`using-git-worktrees`) to isolate parallel or risky code writes.

| Work | Worktree? |
|------|-----------|
| Onboarding / planning / architecture | No — interactive, in main window |
| Review / audit (read-only) | No |
| Single small edit | No |
| Implementation of a story | Yes |
| Parallel independent changes | Yes |
| Risky / destructive change | Yes |

## Model default
Executor agents = **Sonnet**. "Opus escalation" means handing the task back to the
orchestrator window (Opus); subagents do not switch their own model. See `CLAUDE.md`.
