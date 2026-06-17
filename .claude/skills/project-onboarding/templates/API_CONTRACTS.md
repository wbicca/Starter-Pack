# API Contracts — <PROJECT_NAME>

> Conditional doc. Generate when the project **exposes or consumes** an HTTP/RPC API
> (backend/API, SaaS full-stack, or a frontend that owns its backend). Skip for a static
> frontend/landing with no backend. Never invent endpoints — record only what is decided.

## Purpose
The contract between clients and the API: endpoints, shapes, auth, and error semantics, so
every agent and consumer integrates against the same source of truth.

## When to update
- A new endpoint/route is added, removed, or its shape changes.
- Auth, versioning, pagination, or error conventions change.
- A breaking change is planned (record the migration/compat path).

## Required sections
- **Conventions** — base URL, versioning, content type, auth scheme, pagination, error shape.
- **Endpoints** — for each: method · path · purpose · auth required · request shape ·
  response shape · error cases.
- **Auth & authorization** — how requests are authenticated and how access is scoped.
- **Validation** — where/how input is validated at the boundary.
- **Breaking-change policy** — how versioning and deprecation are handled.

## Guiding questions
- Is the API public, internal, or both? Who consumes it?
- REST, GraphQL, RPC, or a mix?
- How are auth and per-tenant/per-user scoping enforced?
- What is the standard error shape and status-code convention?
- How are list endpoints paginated and bounded?

## Known decisions
- <date · decision · why — e.g. "REST + JSON; cursor pagination"> (TBD)

## TBD / open questions
- TODO: <unknown endpoints, auth scheme, or conventions still to decide>
