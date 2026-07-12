# Routing Contract — one canonical path per function

This is a routing reference, not a subagent. For each task type it names the single
canonical skill/stack to use. Resolves all known BMAD ↔ Superpowers overlaps.

## Cross-agent contract

This repository is designed to work with Claude Code and Codex.

- AGENTS.md is the shared agent contract.
- CLAUDE.md contains Claude-specific orchestration rules and imports AGENTS.md.
- Codex should follow AGENTS.md directly, plus `CODEX.md` for Codex-specific routing.
- Implementation agents must follow `docs/ENGINEERING_STANDARDS.md`; UI work also
  follows `docs/DESIGN_STANDARDS.md` and the project's Visual language in `docs/STACK.md`.
- Project-specific commands live in `docs/STACK.md`.
- Per-project **capabilities** (relevant agents · optional integrations/MCPs · out-of-scope)
  live in `docs/STACK.md` — consult them to load only what's relevant; don't pursue paths a
  project marked out of scope.
- Do not assume project context from the folder name; ask first.
- Do not implement non-trivial work before planning and **explicit human approval** of the plan.
- After each implementation batch, run `quality-gate`.
- After large changes, run `refactor-pass`.
- Before release, run `release-sanity`.

Claude Code loads skills from `.claude/skills/`; Codex loads them from `.agents/skills/`
(cross-agent-safe skills are symlinked there; Claude-specific ones get a lean Codex wrapper).

**Codex-specific routing lives in `CODEX.md`** (kept out of this shared contract so it
doesn't load into every Claude session). Codex reads both this file and `CODEX.md`.

## Routing table
> Skill names are the **bare vendored names** (e.g. invoke `brainstorming`, not
> `superpowers:brainstorming`). "Superpowers" / "BMAD" below are just origin labels.

| Task | Canonical | Notes |
|------|-----------|-------|
| Project onboarding (new or existing) | `project-onboarding` | classifies the project + writes docs/PROJECT_BRIEF/STACK/ARCHITECTURE/DECISIONS (incl. STACK Capabilities) + conditional docs (API_CONTRACTS/DATABASE/TESTING/DEPLOYMENT/DELIVERY_LOG) where they apply; existing repos get a minimal detection scan; run `bmad-document-project` explicitly for deep brownfield documentation |
| Discover / evaluate a new skill | `skill-discovery` | recommends only, never installs (see "External skills are optional") |
| Feature / impl ideation | Superpowers `brainstorming` | default gate before any coding |
| Product discovery for a PRD | `bmad-brainstorming` | only inside the BMAD planning track |
| Product brief (one-pager, pre-PRD) | `bmad-product-brief` | the lean brief; `bmad-prd` is the fuller spec above it |
| PRD (create / update / validate) | `bmad-prd` | product/spec altitude |
| Domain / market / technical research | `bmad-domain-research`, `bmad-market-research`, `bmad-technical-research` | discovery inputs to a brief/PRD |
| Epics & stories | `bmad-create-epics-and-stories`, `bmad-create-story` | |
| Macro architecture | `bmad-create-architecture` | |
| UX patterns / design specs | `bmad-ux` | UX planning before `frontend-designer` implements |
| Technical impl plan (one story) | Superpowers `writing-plans` | the *how*, below PRD altitude |
| Implementation | Superpowers `test-driven-development` + `verification-before-completion` | |
| UI implementation / visual quality | `docs/DESIGN_STANDARDS.md` + STACK "Visual language" | contract applied by frontend-designer/engineer; quality-gate checks UI batches |
| Unit / integration tests | Superpowers `test-driven-development` | |
| E2E tests | `bmad-qa-generate-e2e-tests` | for existing features |
| Hard bug / fix | Superpowers `systematic-debugging` | |
| Forensic / incident / code-archaeology | `bmad-investigate` | understanding, not fixing |
| Code review (canonical engine) | Superpowers `requesting-code-review` | light, coupled to TDD/verification; continuous |
| Handling review feedback | Superpowers `receiving-code-review` | not a 2nd reviewer |
| Deep adversarial audit of CODE (opt-in) | `bmad-code-review` | only when explicitly requested |
| Adversarial review of a non-code artifact (spec, doc, plan) | `bmad-review-adversarial-general` | cynical review of any artifact; not for code diffs |
| Exhaustive edge-case analysis (method-driven) | `bmad-review-edge-case-hunter` | walks every branch/boundary; orthogonal to adversarial |
| Refactor round (after large change) | `refactor-pass` | behavior-preserving cleanup; see `docs/ENGINEERING_STANDARDS.md` |
| Batch verification gate | `quality-gate` | mandatory after each implementation batch |
| Pre-release audit | `release-sanity` | before publishing; runs the quality-gate checklist first |
| Starter usage report | `starter-feedback` | evidence-based audit at milestones; output feeds template maintenance |
| Parallel / risky work | Superpowers `using-git-worktrees` | |
| Deployment / CI / infra config | agent `devops-deployment` | platform build/deploy/env; never touches real secrets |
| Docs / artifact persistence | agent `documentation-writer` | docs & READMEs; persists PRDs/briefs under docs/ |

> The two rows above route to **agents** (`.claude/agents/`), not invocable skills — every
> other Canonical value is a skill in `.claude/skills/`. Spawn them via the Agent tool.

## Duplication rulings (do NOT pick the loser)
- **brainstorming**: Superpowers = default for dev/design; `bmad-brainstorming` = product track only.
- **PRD vs writing-plans**: NOT duplicates — BMAD = product/spec altitude; `writing-plans` = technical plan for a single story.
- **code-review**: Superpowers `requesting-code-review` is THE engine; `receiving-code-review` = protocol for responding. `bmad-code-review` = opt-in deep adversarial audit, never the default.
- **investigate vs systematic-debugging**: bug to fix → `systematic-debugging`; system/incident to understand → `bmad-investigate`.
- **E2E vs TDD**: unit → `test-driven-development`; E2E suites → `bmad-qa-generate-e2e-tests`.
- **skill vs agent**: `bmad-create-architecture`/`bmad-prd` are the *processes*; `system-architect`/`product-strategist` are the *agents* that run them. Not duplicates.

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

**End-to-end flow (new project / non-trivial feature):**
1. **Onboarding** → `project-onboarding` (main window).
2. **Planning** → BMAD in the main **Opus** window (PRD → stories), with the human.
3. **Scaffold** → **one** Sonnet implementer (the orchestrator picks by primary stack —
   frontend-engineer for a fullstack web app, backend-engineer for an API/service — lane
   relaxed to the whole scaffold for this step only), in an isolated worktree, builds the base
   scaffold. Framework generators (create-next-app etc.) run in a temp subdir and are
   integrated selectively — never onto the repo root (`block-dangerous-bash` enforces this).
4. **After the scaffold is integrated & stable** → independent stories fan out to Sonnet agents
   in **separate** worktrees (`subagent-driven-development` / `dispatching-parallel-agents`).
5. **Auth / RLS / schema** → `supabase-specialist` and/or `database-architect`.
6. **UI / design** → `frontend-designer` before `frontend-engineer` when there's a visual decision.
7. **Backend / API** → `backend-engineer`.
8. **Finalization** → `qa-tester`, `code-reviewer`, and `security-auditor` when applicable.
9. **Synthesis** → Opus receives the results; it does not write boilerplate directly.

**Rules:**
- **Approval gate:** the human approves the plan/story list **before** any implementation
  fan-out (plan → approve → execute). "Faça tudo" authorizes orchestration end-to-end, not
  skipping that approval. At plan approval the human also chooses the cadence: per-batch
  confirmation (default) or epic-level autonomy — batches then proceed with all gates
  still running and REPORTING, stopping only at epic completion; batches touching
  sensitive flows (see `docs/CONSTITUTION.md`) always stop for approval
  regardless.
- No scaffold, multi-file change, or new product is implemented **inline by the orchestrator** —
  the only exception is a small, clearly-local change.
- Planning never uses a worktree; medium/large implementation does.
- **Parallelization starts only after the shared scaffold is stable** — never fan out onto an
  empty or unstable base.

| Work | Worktree? |
|------|-----------|
| Onboarding / planning / architecture | No — interactive, in main window |
| Review / audit (read-only) | No |
| Single small edit | No |
| Base scaffold (one agent) | Yes |
| Implementation of a story | Yes |
| Parallel independent changes (after scaffold) | Yes |
| Risky / destructive change | Yes |

### Parallel fan-out protocol (canonical)
Worktrees isolate **parallel code writes**, not interactive doc work. Planning, onboarding,
and review never use a worktree. `worktree.baseRef` is `head`, so every new worktree starts
from the current branch HEAD — keep HEAD stable before fanning out.

1. **Planning** happens in the main Opus window with the human, ending in **explicit human
   approval** of the plan/story list (plan → approve → execute) before anything is built.
2. **Scaffold / initial foundation** goes to a **single** Sonnet implementer in a worktree.
3. Before **any** parallel fan-out, create a **checkpoint commit** of the stable base.
4. Each parallel agent starts from the **stable HEAD** (never from another agent's worktree).
5. Each agent works in **its own** worktree.
6. Each agent returns: **summary · files changed · tests run · risks · commit hash ·
   discipline followed (skills applied + verification evidence)**.
7. The orchestrator consolidates by **cherry-pick** (or requests human approval) — it does
   not hand-apply agent code into the main window. (Convention, not a guarded invariant:
   no hook verifies cherry-pick vs hand-paste; the orchestrator upholds it. `quality-gate`
   step 8 only flags *unconsolidated* worktrees.)
8. **Never** dispatch an isolated agent asking it to edit a worktree that already belongs to
   another agent.
9. Exploratory visual iteration uses a **single** worktree or preview page until the visual
   direction is approved.
10. Only **parallelize visual propagation after** the visual language is approved.
11. **Cherry-pick conflict** → never hand-apply agent code into the main window. Re-dispatch
    the conflicting story to a fresh implementer rebased on the new HEAD, or ask the human.
    Stories that must touch the same files are **sequenced, not parallelized**.

## Project profiles

`docs/STACK.md` declares `Profile: standard | light` (set at onboarding; editable any
time — it's a project doc. A `Profile:` flip is surfaced two ways: the Stop-hook
quick-check warns whenever a diff changes the line, and quality-gate step 3 flags it —
so a `standard → light` downgrade of the inline-write ASK can't pass unnoticed).
It scales orchestration friction to project size. It never relaxes: governance
protection, the security hooks, quick-check, or the sensitive-flow rule below.

| Aspect | standard | light |
|---|---|---|
| Main-window inline app-code write | ASK (human approves small tasks) | passes silently |
| BMAD planning for non-trivial work | required | opt-in (brief in-window planning still expected for multi-file work) |
| quality-gate per batch | full sequence | proportional (commands + diff/secret inspection; review opt-in) |
| `requesting-code-review` per batch | required | opt-in |
| Delegation / worktrees / fan-out | canonical for medium+ | available, optional |
| Sensitive flows (see `docs/CONSTITUTION.md`) | full discipline + `security-auditor` | **identical — never relaxed** |

Exposure-based env policy (both profiles): writes to an **ignored-and-untracked** real
`.env` (and secrets in ignored-and-untracked files) are allowed — the guarded risk is a
secret entering a commit, not existing locally. Versionable targets stay blocked;
`git add -f` asks for confirmation; quick-check remains the end-of-turn net.

## Batches & gates
**Never accumulate more than one implementation batch without verification and review.**
(A discipline rule the orchestrator upholds — no hook counts batches; the Stop-hook
quick-check is read-only and does not track batch boundaries.)

A **batch** is one of: a single story · one structural change · a small, cohesive set of
components · one approved redesign round.

After **each** batch, before starting the next:
1. run `quality-gate` — its step 1 executes `scripts/quality/batch-verify.mjs`
   (the `docs/STACK.md` commands, fail-fast, evidence over claims) + diff/secret
   inspection, and
   appends the `docs/DELIVERY_LOG.md` entry (what shipped · validation · review/approval ·
   commit) when the project keeps one (the skill is the canonical vehicle; running the
   same checklist as explicit practice and recording it in the DELIVERY_LOG entry is
   equally valid — what matters is that the checks ran and were recorded). The entry is
   recorded *by the skill/practice*, not verified at write time by any hook — `starter-feedback`
   audits its presence after the fact;
2. run `verification-before-completion` — evidence before any "done" claim;
3. run `requesting-code-review`;
4. trigger `security-auditor` when the batch touches a sensitive flow (see
   `docs/CONSTITUTION.md`), relevant dependencies, or external assets;
5. fix blockers — only then start the next batch.

In the **light** profile the per-batch sequence is proportional (see "Project
profiles"): step 1 runs in its reduced form, steps 2–3 are opt-in, step 4 (sensitive
flows) is **always** mandatory.

**Gate decision map:** `docs/QUALITY_GATES.md` says *which* gate to run *when* (Quick Check ·
Development Gate · Release Gate) and routes to the canonical skill for each — it does not
restate them. For large/scalable features, consult `docs/SCALABILITY_CHECKLIST.md`
(MVP → production → scale, stack-agnostic).

**External assets:** record origin and license in `NOTICE.md` (or an asset log) before publication.

**Design:** `frontend-designer` defines the direction and light variants → the **user approves
the direction** → `frontend-engineer` implements → only then propagate to other sections.

## Model default
Implementer agents = **Sonnet**. Judgment roles (code-reviewer, security-auditor,
system-architect) = **Opus** — read-only, low token volume, highest catch-rate leverage.
"Opus escalation" for implementation still means handing the task back to the orchestrator
window; subagents do not switch their own model. See `CLAUDE.md`.
