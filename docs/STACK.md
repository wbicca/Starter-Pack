# BRX Standard Stack

> **Status: UNCONFIGURED** — fill this via the init flow before doing feature work.

## Initialization (run once, while Status is UNCONFIGURED)
Ask the user: **new project or existing project?**

### Existing project
- Run a full, meticulous analysis via `bmad-document-project`.
- Detect language, framework, UI, DB/Auth, hosting, test tooling, and conventions.
- Write the findings into "Resolved stack" below; set Status: CONFIGURED.

### New project
- Ask the user which stacks to use (language, framework, UI, DB/Auth, hosting, tests).
- Record their choices in "Resolved stack" below; set Status: CONFIGURED.

## Resolved stack
_(empty until initialized)_
- Language:
- Framework:
- UI:
- DB/Auth:
- Hosting:
- Tests:

## Hard stack rules (apply once configured)
- If Supabase/Postgres is chosen: RLS on by default for every table.
- Auth/RLS changes are Opus-escalation work (see `CLAUDE.md` model policy).
