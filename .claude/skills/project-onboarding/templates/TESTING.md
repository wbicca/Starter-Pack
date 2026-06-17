# Testing — <PROJECT_NAME>

> Conditional doc. Generate when the project has **non-trivial logic to test** (backend/API,
> SaaS, dashboard/CRM, app frontend). A trivial static landing may skip it. Record the real
> strategy and commands — pull the commands from `docs/STACK.md`, never invent one.

## Purpose
How confidence is established: what is tested, at which levels, and how to run the suites.
Complements `docs/ENGINEERING_STANDARDS.md` (test principles) and `docs/STACK.md` (commands).

## When to update
- A new test level/tool is adopted (unit, integration, E2E).
- The test commands in `docs/STACK.md` change.
- Coverage expectations or critical-path test policy changes.

## Required sections
- **Levels** — which of unit / integration / E2E are used, and for what.
- **Tools** — test runner(s) and frameworks (mirror `docs/STACK.md`).
- **Commands** — how to run each suite (reference `docs/STACK.md`; do not duplicate values
  that may drift — link to them).
- **What must be tested** — critical paths, contracts, and the bug-fix-needs-a-regression
  rule (per `docs/ENGINEERING_STANDARDS.md`).
- **Coverage & gaps** — what's intentionally not covered, and why.

## Guiding questions
- What are the critical paths that must never break?
- Which levels give the most confidence per cost for this stack?
- How is external I/O mocked or faked?
- Are E2E tests needed (existing features → `bmad-qa-generate-e2e-tests`)?

## Known decisions
- <date · decision · why — e.g. "Vitest for unit/integration; Playwright for E2E"> (TBD)

## TBD / open questions
- TODO: <undecided tools, levels, or coverage targets>
