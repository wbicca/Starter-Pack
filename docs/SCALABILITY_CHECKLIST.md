# Scalability Checklist — practical, stack-agnostic

A decision aid for building applications that can grow without rework. It is **not** a
mandate to build everything up front — each item exists to help a *practical* decision at
the right time. Stay stack-agnostic: this file never assumes Next.js, Supabase, Vercel,
or any vendor. The concrete stack lives in `docs/STACK.md`; code standards live in
`docs/ENGINEERING_STANDARDS.md`. This checklist is orthogonal to both.

Primary audience: `system-architect`, `backend-engineer`, `database-architect`,
`supabase-specialist`, `security-auditor`, `devops-deployment`.

## How to use this checklist
- Read it at three moments: planning a new app, planning a large feature, and before a
  production launch.
- Match the work to a **level** (MVP · Early production · Scale). Do the current level
  well; don't pre-build the next one without a real signal.
- Treat each item as a question to answer, not a box to mechanically tick. "Not needed
  yet, here's why" is a valid, documented answer.
- When an item implies a real decision, record it in `docs/DECISIONS.md`.
- Use the conditional notes (`When using …`, `When multi-tenant …`) to skip what does not
  apply to the current stack or shape.

## MVP
Goal: ship something correct and safe. Optimize for clarity and reversibility, not load.
- **Authentication**: a real auth mechanism from day one; never roll ad-hoc sessions.
- **Authorization**: enforce access on the server for every protected action — not just
  in the UI.
- **Input validation**: validate and type all input at the trust boundary (request edges,
  webhooks, file uploads). Reject unknown fields.
- **Data modeling**: model core entities and relationships explicitly; pick natural keys
  and ownership/foreign keys deliberately.
- **Constraints**: enforce invariants in the database (not-null, unique, foreign keys,
  check constraints) — not only in app code.
- **Tenancy decision**: decide single- vs multi-tenant *now*; it is expensive to retrofit.
  Record the decision even if single-tenant.
- **Error handling**: consistent error shape; never leak secrets, stack traces, or PII to
  clients.
- **Secrets**: no secrets in code or VCS; use env/secret storage. `.env.example` documents
  required keys.
- **Backups**: confirm the datastore has automatic backups enabled. Know the retention.
- **Migrations**: every schema change is a tracked, ordered migration — never hand-edited
  prod schema.
- **Pagination**: paginate any list endpoint that can grow unbounded, even at low volume.
- **Payload limits**: cap request body and upload size; set a sane default timeout.

## Early production
Goal: real users, real data. Add observability and the safety rails you'll need under load.
- **Roles & permissions**: a real role/permission model; centralize authorization checks.
- **RLS** *(when using PostgreSQL or Supabase)*: row-level security on by default for every
  table holding user/tenant data; test allowed **and** denied paths.
- **Tenant isolation** *(when multi-tenant)*: every query is scoped by tenant; verify no
  cross-tenant read/write is possible. Prefer enforcing isolation at the data layer.
- **Indexes**: index the columns you filter, join, and sort on; verify with query plans on
  realistic data. Watch for N+1 query patterns.
- **Data growth**: identify tables that grow without bound; plan archival/partitioning
  before they hurt.
- **Structured logging**: structured, correlated logs (request/trace id); never log
  secrets or PII.
- **Metrics & alerts**: track error rate, latency, and saturation of key resources; alert
  on symptoms users feel.
- **Idempotency**: make money-moving and side-effectful endpoints idempotent (idempotency
  keys); safe to retry.
- **Webhook safety** *(when consuming webhooks)*: verify signatures, dedupe by event id
  (webhooks are delivered more than once), and process idempotently.
- **Rate limiting**: rate-limit public and auth endpoints; set timeouts on all outbound
  calls.
- **Retries & backoff**: retry transient failures with exponential backoff + jitter; cap
  attempts; never retry non-idempotent calls blindly.
- **File uploads & storage**: validate type/size, store outside the app server, scan or
  constrain untrusted files, serve via signed/limited access.
- **Reversible migrations**: prefer additive, reversible migrations; expand-then-contract
  for breaking changes; know the rollback for each.
- **Deploy & rollback**: a one-step deploy and a known rollback path; health checks gate
  releases.
- **Audit trail**: record who did what for sensitive actions (auth changes, role changes,
  deletions).
- **Cost awareness**: know the per-request cost of paid APIs; cap and monitor usage.
- **AI cost & limits** *(when using LLM/AI APIs)*: budget tokens, set per-user/per-tenant
  usage limits, cache where possible, and handle provider rate limits/timeouts gracefully.
- **Sensitive data & LGPD** *(when handling personal data)*: minimize what you collect,
  define retention, support deletion/export, and document the legal basis.

## Scale
Goal: sustained growth and higher reliability. Add these when metrics or roadmap justify
them — not before.
- **Caching**: cache hot reads with explicit invalidation; know your staleness tolerance.
  Measure hit rate.
- **Queues & async**: move slow or spiky work to background queues; decouple request path
  from heavy work.
- **Concurrency control**: handle concurrent writes (optimistic locking, row locks, or
  serializable transactions) to prevent lost updates.
- **Deduplication**: dedupe at scale (event ids, natural keys) so retries and replays don't
  double-process.
- **Circuit breakers** *(when a dependency can fail or slow down)*: trip a breaker to fail
  fast and shed load instead of cascading.
- **Tracing**: distributed tracing across services to find latency and failure across hops.
- **Partitioning/sharding** *(when a table or tenant outgrows one node)*: plan data
  partitioning; avoid hot keys.
- **Read scaling**: read replicas / CQRS where read load dominates; mind replication lag.
- **Backup restore drills**: periodically *test* restoring from backup — an untested
  backup is not a backup.
- **Retention & archival**: enforce data retention; archive cold data out of hot paths.
- **Feature flags** *(when rolling out risky or gradual changes)*: gate big changes behind
  flags; support gradual rollout and fast kill-switch.
- **Capacity & cost at scale**: track unit economics (cost per user/request/tenant); set
  budget alerts before bills surprise you.

## Warning signs
Surface these the moment you see them; they predict pain:
- Authorization checked only in the UI / client.
- Unbounded list endpoints (no pagination, no limit).
- Queries without indexes on filtered/joined columns; visible N+1 patterns.
- Retries on non-idempotent operations; webhooks processed without dedupe.
- A single table that grows forever with no archival/partition plan.
- Migrations that are irreversible or hand-applied to production.
- Secrets in code, logs, or error messages; PII in logs.
- No backups, or backups never restored.
- No metrics/alerts on error rate and latency.
- Unbounded fan-out to a paid or AI API with no cost cap.

## Mandatory questions before a large feature
Answer these *before* implementing a significant feature:
1. Is this single- or multi-tenant, and how is tenant isolation enforced?
2. Who is authorized to do this, and where is that enforced (server-side)?
3. What new data does it create, how does it grow, and how is it indexed/paginated?
4. Is any operation side-effectful or money-moving? Is it idempotent and safe to retry?
5. Does it call external/AI APIs? What are the cost, rate limits, timeouts, and failure
   behavior?
6. What is the migration, and is it reversible? What is the rollback?
7. What sensitive/personal data is involved, and what are retention and deletion duties?
8. What must be observable (logs/metrics/alerts) to operate this in production?

## When to involve each agent
- **`system-architect`** — tenancy model, service boundaries, caching/queue/concurrency
  strategy, any cross-cutting scale decision.
- **`database-architect`** — schema, constraints, indexes, partitioning, reversible
  migrations, data-growth planning.
- **`supabase-specialist`** — RLS policies, auth config, and tenant isolation *when on
  Supabase*.
- **`security-auditor`** — auth/authz, RLS gaps, tenant isolation, secrets, PII, input
  validation at trust boundaries.
- **`backend-engineer`** — idempotency, validation, retries/backoff, rate limiting, webhook
  dedup, queue/worker implementation.
- **`devops-deployment`** — deploy/rollback, health checks, env/secret management, alerts,
  backup configuration, feature-flag plumbing.

## Conditional considerations by stack
The core items above are stack-agnostic. Apply these only when they match `docs/STACK.md`:
- **When using PostgreSQL or Supabase**: RLS by default; use database constraints and
  proper indexes; prefer transactions for multi-row invariants.
- **When using Supabase specifically**: run the security advisors after schema/policy
  changes; keep auth and RLS as the enforcement layer, not app code alone.
- **When multi-tenant**: enforce tenant scoping at the data layer; never rely on the
  application remembering to filter.
- **When using LLM/AI APIs**: treat tokens as a metered cost; cap per-user usage, cache,
  and handle provider rate limits/timeouts.
- **When consuming webhooks**: verify signatures and dedupe by event id; assume
  at-least-once delivery.
- **When serverless/edge**: mind cold starts, execution time limits, and connection
  pooling to the database.

## What not to build prematurely
Avoid these until a real signal (metrics, roadmap, or incident) justifies them:
- Microservices, sharding, or multi-region before a single service is the bottleneck.
- Caching layers added before you've measured a hot read path.
- Queues/event buses for work that is fast and synchronous today.
- Circuit breakers and elaborate resilience for dependencies that don't yet exist.
- Generic "platform" abstractions and config frameworks for a single use case.
- Premature denormalization or custom storage engines.

Premature scale work is cost and risk with no payoff. Build for the current level, keep
changes reversible, and let measured signals pull you to the next level.
