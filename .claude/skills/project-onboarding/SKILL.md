---
name: project-onboarding
description: >
  Initialize a project bootstrapped from the Starter Pack template. Use on the first
  session of a new or adopted repo, when docs/STACK.md is UNCONFIGURED, or when the user
  says "onboard this project" / "set up a new project" / "initialize the starter".
  Classifies the project, asks only what is missing, writes the project docs — never
  implements code.
---

# Project Onboarding

Establish the context a fresh project needs so every later session and every agent
(see `AGENTS.md`) works from the same shared understanding. You produce **documents and
decisions**, not features.

## This is NOT implementation
Onboarding never writes application code, installs dependencies, runs migrations, or
deploys. If the user asks for those, finish onboarding first, then hand the work to the
right agent via the orchestrator. Producing the project docs below is the whole job.

## Communication style
Run the steps below quietly — do **not** narrate them or mention "Step 1/2" to the user.
Let tool calls speak for themselves. Surface to the user only: (1) the Step 0 questions,
(2) the key conclusion (the project classification), (3) questions when you genuinely need
more input, and (4) the final summary. No play-by-play of internal actions.

**Operating rules:**
- Ask the Step 0 questions **before any extensive scan**; keep the initial inspection minimal.
- Do not use a general-purpose subagent for trivial repository scans. Perform lightweight
  discovery directly with Glob, Grep and safe listings.
- If a tool's output comes back empty, duplicated, or corrupted **twice in a row, STOP** and
  recommend `systematic-debugging` before retrying — don't loop on broken output.

## Step 0 — Ask first (before any scan)
Before reading or scanning anything, ask the user (one short batch) and **wait for answers**:
1. "Descreva em uma frase o projeto que deseja criar ou analisar."
2. "O nome atual da pasta corresponde ao produto real? Posso usá-lo como referência ou devo ignorá-lo?"
3. "Este é um projeto novo, um projeto existente, ou você ainda não tem certeza?"
4. "Existem regras inegociáveis específicas deste projeto? (ex.: compliance, dados sensíveis,
   stack obrigatória, multi-tenant, white-label, segurança, performance, integrações obrigatórias)"
5. "Este projeto é algo simples/pequeno (script, landing, protótipo, ferramenta pessoal)
   ou um produto completo? Isso define o profile de orquestração (light vs standard)."

Rules:
- The folder name is a **hint only, never the source of truth** — do not classify the product from it.
- Do **not** classify or scan extensively before you have the answers.
- If the user isn't sure whether it's new or existing, do a **minimal inspection** (top-level
  `ls`/Glob only) just to help them decide — nothing more.

## Step 1 — Read the non-negotiables
The operating contracts (`CLAUDE.md`, `AGENTS.md`) are already fully loaded in every
session — do **not** re-read them. Read only `docs/CONSTITUTION.md`, which is not
auto-loaded. Everything you do must stay consistent with all three — especially the
self-contained principle (external plugins are optional, never required).

## Step 2 — Minimal repo scan (cheap signals first)
Do not read the whole repo. Map it with `Glob`/`Grep`, then open only the files that
carry the most signal per token:
- `package.json` (scripts, deps, framework), `README*`, anything already in `docs/`
- config files (`*.config.*`, `tsconfig`, `.nvmrc`, lockfiles), and the top-level folder tree
- for an existing codebase, grep for framework/entrypoint markers rather than reading sources

The goal is a confident mental model, not full coverage. Stop scanning once you can
classify the project and name its stack.

### codegraph check (optional)
Check whether codegraph is in use — its MCP tools (`codegraph_*`) are available, or a
`codegraph` config exists. If it **is** in use but this project has **no `.codegraph/`
index yet**, remind the user (don't let them forget): run **`codegraph init -i`** in the
project root to enable graph-based navigation — the watcher keeps it synced afterward. If
`.codegraph/` already exists, or codegraph isn't in use, skip this silently.

## Step 3 — Classify
Determine three things and state them back to the user:
1. **New** (empty/scaffold only) or **existing** (has real code/history).
2. **Type**: SaaS · dashboard · CRM · backend/API · frontend/app · landing/simple app.
   Pick the closest; if it's a blend, say so.
3. **Size/profile**: `light` (simple project/tool — inline implementation allowed,
   proportional gates) or `standard` (full orchestration). Propose it from Q5 and the
   scan; the user confirms. When in doubt, prefer `standard`.

## Step 4 — Ask only the essential gaps
Infer everything you can from Steps 1–3. Then ask — in one short batch — only what you
genuinely cannot determine and that changes the docs (e.g. target users, the chosen
stack for a new project, hosting, data store). Don't interrogate; a handful of pointed
questions is the bar. Never re-ask or re-confirm information the user already stated
explicitly (e.g. the project name in the brief) — treat it as settled and move on.

## Step 5 — Write the project docs
Create or update these under `docs/` — **create the `docs/` directory if it doesn't exist.**
Keep each lean — contracts, not manuals. Write the **prose in the conversation's language**
(Portuguese for a Portuguese-speaking user), but keep **structural keywords in English** —
especially `STACK.md`'s `Status: UNCONFIGURED | PARTIAL | CONFIGURED`, which the init gate
matches literally.
For **new** docs, start from the lean templates in this skill's `templates/` directory
(`PROJECT_BRIEF.md`, `STACK.md`, `ARCHITECTURE.md`, `DECISIONS.md`); fill only what's
known and leave a `TODO:` for genuine unknowns — never invent. For **existing** docs,
preserve what's still true and amend rather than rewrite.
- **`PROJECT_BRIEF.md`** — what the project is, who it's for, the core problem, scope.
- **`STACK.md`** — the resolved stack. Set the **Status** honestly: `UNCONFIGURED` when
  the stack isn't validated yet, `PARTIAL` when only some of it is known, `CONFIGURED`
  only once the main stack decisions (language, framework, DB/Auth, hosting) are filled.
  For an existing project, record the detected stack; for a new one, the user's choices.
  Also fill the **Capabilities** section (relevant agents · optional integrations/MCPs ·
  out-of-scope) from the classification, so agents load only what's relevant. Mark unused
  items `n/a`; never invent a capability.
  Set the **Profile** honestly (`standard` | `light`) from the size classification the
  user confirmed. Fill the **Visual language** section for projects with a UI (design
  reference · component library/tokens · theme) — or mark it `n/a`.
- **`ARCHITECTURE.md`** — high-level shape: main pieces, boundaries, data flow. Brief.
- **`DECISIONS.md`** — an append-only log of decisions made during onboarding, each with
  a one-line rationale (date · decision · why). This is the project's memory.

### Conditional project docs (optional, by type)
Beyond the four core docs, generate these **only when they apply** to the classified type —
never produce an empty or useless doc. Start each from its template in this skill's
`templates/` directory and fill only what's known, leaving `TBD:` for genuine unknowns.
- **`API_CONTRACTS.md`** — when the project exposes or consumes an API (backend/API, SaaS,
  or a frontend that owns its backend). Skip for a static frontend/landing with no backend.
- **`DATABASE.md`** — when the project owns a datastore (backend/API, SaaS, dashboard/CRM
  with persistence). Skip for a static frontend/landing with no database.
- **`TESTING.md`** — when there's non-trivial logic to test (most types). A trivial static
  landing may skip it.
- **`DEPLOYMENT.md`** — when the project is deployed somewhere (most apps). Skip only when
  deployment is explicitly out of scope; if a target exists but isn't decided, create it
  with `TBD:`.
- **`DELIVERY_LOG.md`** — seed an append-only delivery log when the project will have
  implementation batches (almost all real projects). Skip for a docs-only repo. It starts
  essentially empty (header only) and is appended to after each passing quality-gate.
- **`.github/workflows/ci.yml`** — seed from this skill's `templates/project-ci.yml`
  when the project has (or will have) a remote repository. Adjust the runtime/install
  steps to the stack (the template's comments say how). Skip for an explicitly
  local-only project and record that decision in `DECISIONS.md`.

Rules: a doc that is **N/A for the type** is skipped entirely; a doc whose area is **in
scope but unknown** is created with `TBD:` so the gap is tracked. Examples — static frontend:
core docs only (no DATABASE/API_CONTRACTS) but still a DELIVERY_LOG once it has batches;
backend/API: + API_CONTRACTS, DATABASE, TESTING, DELIVERY_LOG; SaaS full-stack: all of them.
For an **existing** project, preserve existing docs and amend rather than rewrite. Never
invent stack, architecture, or contracts.

**Project-specific non-negotiables:** if the user named project-specific hard rules in
Step 0 (Q4), propose filling the **"Project-specific non-negotiables"** section of
`docs/CONSTITUTION.md`. Write it **only with explicit user approval**, in their wording —
never invent rules. When the user confirms a hard rule during the onboarding
conversation, record it in `docs/CONSTITUTION.md` immediately — that in-flow
confirmation **is** the explicit human approval; do not leave a placeholder or defer it
to a second approval round. If there are none, leave the section's default placeholder.

## Guardrails (ask before crossing these)
- **Never** modify `docs/CONSTITUTION.md` without explicit user approval — it's the
  non-negotiables.
- Do not change `CLAUDE.md` or `AGENTS.md` unless you have a concrete reason; if you do,
  explain why and get approval first.
- Do not invoke implementer agents to change code during onboarding.

## Advisory routing (analysis only)
Consult these specialists for input, never to mutate the repo:
- **product-strategist** — for a new product's brief and positioning.
- **system-architect** — when architecture needs a real decision.
- **supabase-specialist** / **devops-deployment** — only to analyze an existing
  Supabase setup or deploy config, not to apply changes.
Keep delegation minimal; do the lightweight reading yourself.

**Optional MCP note:** Supabase/Railway MCP tools are optional runtime enhancements. If
unavailable, use repository files and user-provided context instead. Onboarding never
implements code, keeps repo reading minimal (Step 2), and records every decision it
makes in `DECISIONS.md`.

## Final deliverable (always end with this)
Report back, concisely:
1. **Project summary** — classification + one-paragraph description.
2. **Files written/updated** — list with a word on each.
3. **Decisions recorded** — what went into `DECISIONS.md`.
4. **Open gaps** — what's still unknown or needs the user.
5. **Recommended next flow** — classify the demand and name the next **mandatory** flow
   (e.g. BMAD planning before any implementation). Never jump straight to coding for a new
   project or a non-trivial feature.

## Validation checklist (run before declaring done)
- [ ] Asked the Step 0 questions (purpose, folder-name relationship, new/existing, project rules) BEFORE scanning.
- [ ] Treated the folder name as a hint only, not the source of truth.
- [ ] Classified: new/existing + type, confirmed with the user.
- [ ] Proposed Project-specific non-negotiables if any — written only with explicit approval.
- [ ] PROJECT_BRIEF / STACK / ARCHITECTURE / DECISIONS created or updated and lean.
- [ ] Conditional docs (API_CONTRACTS / DATABASE / TESTING / DEPLOYMENT / DELIVERY_LOG) generated only where they apply — no empty docs; unknown-but-in-scope areas marked TBD.
- [ ] CI seeded from templates/project-ci.yml when the project has a remote (or the local-only decision recorded).
- [ ] STACK.md Capabilities section filled (relevant agents · optional integrations · out-of-scope), or marked n/a.
- [ ] STACK.md Profile set (standard | light) and confirmed with the user.
- [ ] STACK.md Visual language filled for UI projects (or marked n/a).
- [ ] No application code written; no protected file changed without approval.
- [ ] Delivered the summary + recommended the next mandatory flow.
