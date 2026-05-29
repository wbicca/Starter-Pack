# BRX Routing Contract — one canonical path per function

This is a routing reference, not a subagent. For each task type it names the single
canonical skill/stack to use. Resolves all known BMAD ↔ Superpowers overlaps.

## Routing table
| Task | Canonical | Notes |
|------|-----------|-------|
| Onboard existing project | `bmad-document-project` | full brownfield analysis → fills `docs/STACK.md` |
| Onboard new project | interactive stack questions | orchestrator asks; no skill needed |
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

## Model default
Executor agents = **Sonnet**. Opus only per the escalation list in `CLAUDE.md`.
