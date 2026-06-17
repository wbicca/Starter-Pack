# Deployment — <PROJECT_NAME>

> Conditional doc. Generate when the project **is deployed somewhere** (most apps: SaaS,
> backend/API, frontend/app, dashboard). Skip only when deployment is explicitly out of
> scope; if a target exists but isn't decided yet, create it with TBD. Never invent hosting.

## Purpose
How the app ships and runs: environments, configuration, the deploy/rollback path, and the
operational signals needed to run it safely.

## When to update
- The hosting target, pipeline, or environment set changes.
- New configuration/secret keys are introduced.
- The rollback or release procedure changes.

## Required sections
- **Environments** — which exist (e.g. dev/staging/prod) and how they differ.
- **Hosting & pipeline** — where it runs and how it gets there (CI/CD).
- **Configuration** — required env vars/secrets by name (values never stored here; see
  `.env.example`).
- **Deploy & rollback** — the one-step deploy path and the known rollback.
- **Operational signals** — health checks, key metrics/alerts, where logs live.

## Guiding questions
- What is the hosting target, and is it serverless/edge (cold starts, time limits)?
- What environments are needed, and how is config separated per environment?
- What is the rollback path, and is it tested?
- What must be observable to operate this in production?
- How are secrets managed (platform tooling, never committed)?

## Known decisions
- <date · decision · why — e.g. "Vercel for web; Railway for the worker service"> (TBD)

## TBD / open questions
- TODO: <undecided hosting, pipeline, or environment strategy>
