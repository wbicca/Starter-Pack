---
name: quality-gate
description: >
  Mandatory verification after each implementation batch (a story, a structural change, a
  small cohesive set of components, or an approved redesign round). Use after finishing any
  batch and before starting the next, or when the user says "run the quality gate", "verify
  this batch", or "is this ready". Runs ONLY the commands configured in docs/STACK.md,
  inspects the diff for unexpected/unsafe changes, checks for secrets and real .env files,
  confirms the orchestrator did not implement inline, and reports a command/result/status table.
---

# Quality gate

Run after **each** implementation batch, before the next one starts. It verifies the batch
is sound; it does not refactor (`refactor-pass`) or audit for release (`release-sanity`).

## Rules
- **Read `docs/STACK.md` first** for the configured commands.
- **Never invent a command.** Run only what is configured.
- If a command is `TBD` / `UNCONFIGURED`, report it as **not configured** — do not
  substitute a guess or skip silently.

## Steps
1. **Run configured checks** — formatter, linter, typecheck, tests, build — each only if
   configured in `docs/STACK.md`. Capture exit status and key output.
2. **Diff inspection** — review `git diff` (and `git status --short`) for the batch.
3. **Unexpected files** — flag anything changed that the batch shouldn't touch (generated
   files, unrelated modules, `.claude/**`, governance files).
4. **Obvious secrets** — scan new/changed content for API keys, tokens, private keys,
   credential-bearing URLs. Flag any hit.
5. **Real `.env` files** — flag any real `.env` (only `.env.example` / `.env.template`
   with placeholders are allowed).
6. **Orchestrator-inline check** — confirm application code was written by an
   implementation agent, not inline by the orchestrator. Flag if it was.
7. **Code review** — recommend `requesting-code-review` when the batch is non-trivial.
8. **Delivery log** — when the project keeps `docs/DELIVERY_LOG.md`, append the batch
   entry: what shipped · validation · review/approval · commit hash. Skip silently when
   the project has no delivery log.

## Deliverable
A table plus a short verdict:

| Command | Result | Status |
|---|---|---|
| `<from docs/STACK.md>` | pass / fail / output summary | PASS / FAIL / NOT CONFIGURED |

Then: unexpected files, secret/`.env` findings, the orchestrator-inline check, the code
review recommendation, the `docs/DELIVERY_LOG.md` entry appended (when the project keeps
one), and an overall **gate PASS / gate FAIL**.
