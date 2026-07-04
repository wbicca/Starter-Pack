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

Codex wrapper for the shared onboarding flow. The full reference lives in the Claude skill
(`.claude/skills/project-onboarding/SKILL.md`); this wrapper keeps only the cross-agent
core and points to the shared templates and contract docs. Claude-specific advisory routing
(Claude subagents, codegraph MCP) is intentionally omitted here.

You produce **documents and decisions, not features.** Never write application code, install
dependencies, run migrations, or deploy during onboarding — finish the docs first, then hand
implementation to the right agent.

## Read the contract first
Read `AGENTS.md` (shared agent contract) and `docs/CONSTITUTION.md` (non-negotiables).
Everything you do must stay consistent with them — especially the self-contained principle
(external plugins are optional, never required).

## Step 0 — Ask first (before any scan)
Ask the user (one short batch) and **wait for answers**:
1. "Descreva em uma frase o projeto que deseja criar ou analisar."
2. "O nome atual da pasta corresponde ao produto real? Posso usá-lo como referência ou devo ignorá-lo?"
3. "Este é um projeto novo, um projeto existente, ou você ainda não tem certeza?"
4. "Existem regras inegociáveis específicas deste projeto? (ex.: compliance, dados sensíveis,
   stack obrigatória, multi-tenant, white-label, segurança, performance, integrações obrigatórias)"

The folder name is a **hint only, never the source of truth.** Do not classify or scan
extensively before you have the answers.

## Step 1 — Minimal scan
Map the repo with read-only search/listing (use the `explorer` agent or shell inspection for
read-heavy work). Open only high-signal files: `package.json`/manifests, `README*`, existing
`docs/`, config files, and the top-level tree. Stop once you can classify the project and
name its stack — aim for a confident mental model, not full coverage.

## Step 2 — Classify
State back to the user: **new** (empty/scaffold) vs **existing** (real code/history), and the
**type** (SaaS · dashboard · CRM · backend/API · frontend/app · landing). If it's a blend, say so.

## Step 3 — Ask only the essential gaps
Infer everything you can. Then ask, in one short batch, only what you genuinely cannot
determine and that changes the docs (target users, chosen stack, hosting, data store).
Never re-ask or re-confirm information the user already stated explicitly (e.g. the
project name in the brief) — treat it as settled and move on.

## Step 4 — Write the project docs
Create or update these under `docs/` (create `docs/` if missing). Start new docs from the
**shared lean templates**. Resolve the repository root first — never assume the current
working directory — then read the templates relative to it:

```bash
REPO_ROOT="$(git rev-parse --show-toplevel)"
ls "$REPO_ROOT/.claude/skills/project-onboarding/templates/"
```

The templates are `PROJECT_BRIEF.md`, `STACK.md`, `ARCHITECTURE.md`, `DECISIONS.md` under
`$REPO_ROOT/.claude/skills/project-onboarding/templates/`. Fill only what's known,
leave a `TODO:` for genuine unknowns, never invent. Write **prose in the conversation's
language**, but keep **structural keywords in English** — especially `STACK.md`'s
`Status: UNCONFIGURED | PARTIAL | CONFIGURED`, which the init gate matches literally.
- **`PROJECT_BRIEF.md`** — what it is, who it's for, the core problem, scope.
- **`STACK.md`** — the resolved stack + honest Status + the real commands (leave UNCONFIGURED ones as TBD). Also fill the **Capabilities** section (relevant agents · optional integrations/MCPs · out-of-scope) so agents load only what's relevant; mark unused items `n/a`.
- **`ARCHITECTURE.md`** — high-level shape: main pieces, boundaries, data flow. Brief.
- **`DECISIONS.md`** — append-only log (date · decision · why) = the project's memory.

Beyond the four core docs, generate these **conditional** docs only when they apply to the
type (same `templates/` directory; fill only what's known, `TBD:` for unknowns, never an
empty doc): **`API_CONTRACTS.md`** (exposes/consumes an API), **`DATABASE.md`** (owns a
datastore), **`TESTING.md`** (non-trivial logic to test), **`DEPLOYMENT.md`** (is deployed
somewhere), **`DELIVERY_LOG.md`** (append-only delivery record; seed when the project will
have implementation batches — skip for a docs-only repo). A doc N/A for the type is skipped;
an in-scope-but-unknown area is created with `TBD:`. Static frontend → core docs only (+ a
DELIVERY_LOG once it has batches); backend/API → + API_CONTRACTS, DATABASE, TESTING,
DELIVERY_LOG; SaaS full-stack → all. For an **existing** project, preserve and amend existing docs.

**Project-specific non-negotiables:** if the user named hard rules in Step 0 (Q4), propose
filling that section of `docs/CONSTITUTION.md` — **only with explicit user approval**, in
their wording. When the user confirms a hard rule during the onboarding conversation,
record it in `docs/CONSTITUTION.md` immediately — that in-flow confirmation **is** the
explicit human approval; do not leave a placeholder or defer it to a second approval
round. Never modify `docs/CONSTITUTION.md` otherwise.

## Final deliverable
Report concisely: (1) project summary + classification, (2) files written/updated,
(3) decisions recorded, (4) open gaps, (5) the recommended next mandatory flow (plan before
implementing — never jump straight to coding for a new project or non-trivial feature).
