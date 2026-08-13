# Standard Stack

> **Status: UNCONFIGURED**  (allowed values: UNCONFIGURED · PARTIAL · CONFIGURED)
> Filled per project by the **`project-onboarding`** skill — don't hand-run the init flow
> here; that procedure lives in the skill, which sets the Status honestly and fills the
> sections below. The structure is present so the gates have something to read even before
> onboarding.

> **Profile: standard**  (allowed values: standard · light)
> `standard`: inline app-code writes by the main window ASK for approval; full
> orchestration/gates for non-trivial work. `light`: inline writes pass; proportional
> gates (see `AGENTS.md` → "Project profiles"). Sensitive flows (see
> `docs/CONSTITUTION.md`) keep full discipline in BOTH profiles.

## Resolved stack
_(empty until configured)_
- App root: .
- Language:
- Framework:
- UI:
- DB/Auth:
- Hosting:
- Tests:

## Commands

> `quality-gate` runs ONLY the commands configured here. Leave anything unconfigured as TBD /
> UNCONFIGURED — never invent one. Set a row to CONFIGURED once the command is verified.

| Purpose | Command | Status |
|---|---|---|
| Install | TBD | UNCONFIGURED |
| Development | TBD | UNCONFIGURED |
| Lint | TBD | UNCONFIGURED |
| Format | TBD | UNCONFIGURED |
| Typecheck | TBD | UNCONFIGURED |
| Test | TBD | UNCONFIGURED |
| Build | TBD | UNCONFIGURED |
| E2E | TBD | UNCONFIGURED |
| Security | TBD | UNCONFIGURED |
| Release | TBD | UNCONFIGURED |

## Capabilities

> Declared at onboarding so agents load only what's relevant to THIS project and don't
> consider irrelevant paths. Mark anything unused as `n/a`; never invent capabilities.

- Relevant agents: _(subset actually used, filled at onboarding)_
- Optional integrations / MCPs in use: _(e.g. Supabase, Railway, codegraph — or `none`)_
- Planning track: _(BMAD | manual specs — with `manual specs` the BMAD routes stay dormant)_
- Visual quality gate: _(yes — impress-gate on UI batches | no — needs Playwright/webapp-testing)_
- Explicitly out of scope: _(e.g. no database, no deploy yet, no payments)_

## Visual language

> Filled at onboarding for projects with a UI (`n/a` otherwise). The generic design
> contract is `docs/DESIGN_STANDARDS.md`; this section records THIS project's choices.

- Design reference / inspiration: _(e.g. Linear-like density, shadcn defaults — or n/a)_
- Component library / tokens: _(e.g. shadcn/ui + Tailwind tokens — or n/a)_
- Theme: _(light/dark/both · brand colors — or n/a)_

## Hard stack rules (apply once configured)
- If Supabase/Postgres is chosen: RLS on by default for every table.
- Auth/RLS or data-migration changes are Opus-escalation work (see `CLAUDE.md` model policy).
