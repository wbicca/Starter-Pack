# Stack — <PROJECT_NAME>

> Status: UNCONFIGURED | PARTIAL | CONFIGURED  ·  set during onboarding (keep one).
> Record only what is actually chosen/detected.

> Profile: standard | light  ·  set during onboarding (keep one). standard = inline
> app-code writes ask for approval, full gates. light = simple project: inline writes
> pass, proportional gates. Sensitive flows keep full discipline in both.

## Resolved stack
- App root: .   <!-- keep `.` for a root-level app; set the subdirectory for a monorepo, e.g. crm-app -->
- Language: <e.g. TypeScript>
- Framework: <e.g. Next.js>
- UI: <e.g. shadcn/ui + Tailwind, or n/a>
- DB / Auth: <e.g. Supabase (Postgres, RLS), or n/a>
- Hosting: <e.g. Vercel; Railway for services>
- Tests: <e.g. Vitest + Playwright>

## Commands

> Fill in only commands that are actually configured. Leave the rest as TBD /
> UNCONFIGURED — never invent one. Set Status to CONFIGURED once a command is verified.
> Never record volatile counts (number of tests/files) as sanity invariants — they go
> stale in days; reference the command, not its current output.

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

- Relevant agents: <subset actually used, e.g. frontend-engineer, backend-engineer, database-architect>
- Optional integrations / MCPs in use: <e.g. Supabase, Railway, codegraph — or `none`>
- Planning track: <BMAD | manual specs — with `manual specs` the BMAD routes stay dormant>
- Visual quality gate: <yes (default for UI projects — impress-gate runs automatically on UI batches) | no — needs Playwright or webapp-testing>
- Explicitly out of scope: <e.g. no database, no deploy yet, no payments>

## Visual language

> Only for projects with a UI — write `n/a` otherwise. Generic contract:
> `docs/DESIGN_STANDARDS.md`.

- Design reference / inspiration: <e.g. Linear-like density, shadcn defaults — or n/a>
- Component library / tokens: <e.g. shadcn/ui + Tailwind tokens — or n/a>
- Theme: <light/dark/both · brand colors — or n/a>

## Hard rules
- <e.g. If Supabase/Postgres: RLS on by default for every table.>
- <Auth/RLS or data-migration changes are Opus-escalation work.>

## Optional / not yet decided
- TODO: <anything still open>
