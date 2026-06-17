# Database — <PROJECT_NAME>

> Conditional doc. Generate when the project **owns a datastore** (backend/API, SaaS,
> dashboard/CRM with persistence). Skip for a static frontend/landing with no database.
> Record only the modeling actually chosen/detected — never invent schema.

## Purpose
The data model and its rules: core entities, relationships, constraints, indexes, and the
migration discipline that keeps the schema evolvable and safe.

## When to update
- An entity, relationship, constraint, or index is added or changed.
- A migration is written (especially a destructive or irreversible one).
- Tenancy, retention, or data-growth strategy changes.

## Required sections
- **Engine** — datastore and version (e.g. PostgreSQL), and why.
- **Core entities** — each entity, its key, and its purpose.
- **Relationships** — how entities relate (ownership, foreign keys, cardinality).
- **Constraints & indexes** — invariants enforced in the DB and the indexes that back the
  main queries.
- **Tenancy & access** — single- vs multi-tenant; how rows are scoped *(RLS when using
  PostgreSQL/Supabase)*.
- **Migrations** — how migrations are tracked, applied, and rolled back; reversibility rule.

## Guiding questions
- What are the core entities and their ownership/keys?
- Single- or multi-tenant, and how is isolation enforced at the data layer?
- Which columns are filtered/joined/sorted (and therefore indexed)?
- Which tables grow without bound, and what's the archival/partition plan?
- What is the migration and rollback process?

## Known decisions
- <date · decision · why — e.g. "Postgres; RLS on by default; tenant_id on every table"> (TBD)

## TBD / open questions
- TODO: <undecided entities, tenancy model, or indexing strategy>
