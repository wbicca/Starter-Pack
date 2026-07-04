# Delivery Log — <PROJECT_NAME>

> Append-only record of what each implementation batch delivered and how it was verified —
> a cheap, durable audit trail in plain text (no dashboards, no tooling). **Distinct from
> `DECISIONS.md`**, which records *why* decisions were made; this records *what shipped* and
> how it was checked. One canonical path each — do not merge them.

## Purpose
Trace each delivered batch (a story, a structural change, a redesign round) to its
verification and approval, so the project keeps a lightweight history of what was actually
shipped and on what evidence.

## When to update
Append one entry **after each batch passes its quality-gate**, before starting the next.
Skip for a docs-only repo with no implementation batches.

## Entry format
- **Date · Batch** — what was delivered (one line).
- **Files** — key files changed.
- **Validation** — gate result / commands run (or `UNCONFIGURED` per `docs/STACK.md`).
- **Review / approval** — `code-reviewer` verdict and human approval, when applicable.
- **Commit** — short hash.

## Log
<!-- Newest first. Append new entries directly below this line. -->
