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

## CI cost & GitHub Actions quota (private repos)
A private repo pays per runner-minute, and the clock counts **per job**, not per run
(a 3-job matrix at 10 min each = 30 min). The seeded `ci.yml` already applies the cheap
wins (`paths-ignore` for doc-only commits · `concurrency` to cancel superseded runs ·
`timeout-minutes` · dependency/build cache · an expensive suite kept PR-only). Operate
with these two facts:
- **Card on file ≠ spending limit raised.** The Actions spending limit defaults to **$0**
  even with a valid card — until raised, only the free allowance runs. It lives in
  **Settings → Billing → Spending limit on the ACCOUNT**, not the repo.
- **"Quota exhausted" masquerades as a CI bug.** When the allowance runs out, jobs
  `cancelled`/`failure` with **no failing step** (empty `steps: []`), finish in **~3s**,
  and their logs 404 (`BlobNotFound`). A job that fails that way = check the billing
  limit **before** diagnosing code. (The billing API endpoints are unreliable; read the
  dashboard.)
- **Shared test DB** → serialize the job (`concurrency: cancel-in-progress: false`) so a
  cancel never leaves the DB half-torn-down; the real cure is a DB **per run**
  (`services:` inside the runner, image matching the prod major version).

## Known decisions
- <date · decision · why — e.g. "Vercel for web; Railway for the worker service"> (TBD)

## TBD / open questions
- TODO: <undecided hosting, pipeline, or environment strategy>
