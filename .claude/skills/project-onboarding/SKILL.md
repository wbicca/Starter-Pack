---
name: project-onboarding
description: >
  Initialize a real project bootstrapped from the BRX starter. Use this whenever a
  project is being set up for the first time, when the user says "onboard this
  project", "set up a new project", "let's start this repo", "initialize the starter",
  or when docs/STACK.md still reads UNCONFIGURED. Also trigger when you land in an
  unfamiliar repo cloned from this starter and need to establish project context before
  any other work. Onboarding classifies the project, fills the gaps, and writes the
  project docs — it is NOT implementation. Reach for it even if the user doesn't say
  the word "onboarding" but is clearly standing up a project from scratch or adopting
  an existing one.
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
Let tool calls speak for themselves. Surface to the user only: (1) the key conclusion
(the project classification), (2) questions when you genuinely need input, and (3) the
final summary. No play-by-play of internal actions.

## Step 1 — Read the contract (only these three)
Read `CLAUDE.md`, `AGENTS.md`, and `docs/CONSTITUTION.md`. They define how this repo
operates, the routing rules, and the non-negotiables. Everything you do must stay
consistent with them — especially the self-contained principle (external plugins are
optional, never required).

## Step 2 — Minimal repo scan (cheap signals first)
Do not read the whole repo. Map it with `Glob`/`Grep`, then open only the files that
carry the most signal per token:
- `package.json` (scripts, deps, framework), `README*`, anything already in `docs/`
- config files (`*.config.*`, `tsconfig`, `.nvmrc`, lockfiles), and the top-level folder tree
- for an existing codebase, grep for framework/entrypoint markers rather than reading sources

The goal is a confident mental model, not full coverage. Stop scanning once you can
classify the project and name its stack.

## Step 3 — Classify
Determine two things and state them back to the user:
1. **New** (empty/scaffold only) or **existing** (has real code/history).
2. **Type**: SaaS · dashboard · CRM · backend/API · frontend/app · landing/simple app.
   Pick the closest; if it's a blend, say so.

## Step 4 — Ask only the essential gaps
Infer everything you can from Steps 1–3. Then ask — in one short batch — only what you
genuinely cannot determine and that changes the docs (e.g. target users, the chosen
stack for a new project, hosting, data store). Don't interrogate; a handful of pointed
questions is the bar.

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
- **`ARCHITECTURE.md`** — high-level shape: main pieces, boundaries, data flow. Brief.
- **`DECISIONS.md`** — an append-only log of decisions made during onboarding, each with
  a one-line rationale (date · decision · why). This is the project's memory.

When updating an existing doc, preserve what's still true and amend rather than rewrite.

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
5. **Recommended next steps** — the natural follow-on work (and which agent owns it).

## Validation checklist (run before declaring done)
- [ ] Read CLAUDE.md, AGENTS.md, CONSTITUTION.md.
- [ ] Classified: new/existing + type, confirmed with the user.
- [ ] Asked only essential, non-inferable questions.
- [ ] PROJECT_BRIEF / STACK / ARCHITECTURE / DECISIONS created or updated and lean.
- [ ] No application code written; no protected file changed without approval.
- [ ] Delivered the 5-part summary.
