---
name: quality-gate
description: >
  Mandatory verification after each implementation batch. Use after finishing any batch,
  before starting the next, or when the user says "run the quality gate" / "is this
  ready". Runs the docs/STACK.md commands, inspects the diff (scope, minimality, secrets,
  versionable .env), applies the design checklist to UI batches, and adapts depth to the
  project Profile (standard/light) — sensitive flows always get the full sequence.
---

# Quality gate

Run after **each** implementation batch, before the next one starts. It verifies the batch
is sound; it does not refactor (`refactor-pass`) or audit for release (`release-sanity`).

## Rules
- **Read `docs/STACK.md` first** for the configured commands.
- **Never invent a command.** Run only what is configured.
- If a command is `TBD` / `UNCONFIGURED`, report it as **not configured** — do not
  substitute a guess or skip silently.
- **Read the `Profile` in `docs/STACK.md`.** In the **light** profile the gate is
  proportional: run steps 1–5 and 7–8 always; step 6 verifies the sanctioned path (see
  below); steps 9–10 are opt-in. **Exception (both profiles):** a batch touching auth,
  RLS, payments, webhooks, or PII always runs the FULL sequence and triggers
  `security-auditor`.

## Steps
1. **Run configured checks** — formatter, linter, typecheck, tests, build — each only if
   configured in `docs/STACK.md`. Capture exit status and key output.
2. **Diff inspection** — review `git diff` (and `git status --short`) for the batch.
   Minimality: flag new code that duplicates an existing util, the standard library, or an
   installed dependency (reuse ladder — `docs/ENGINEERING_STANDARDS.md`); ask whether the
   diff could be smaller.
3. **Unexpected files** — flag anything changed that the batch shouldn't touch (generated
   files, unrelated modules, `.claude/**`, governance files). **Always flag a change to
   the `Profile:` line of `docs/STACK.md`** — a profile switch alters the write-guard's
   behavior and must be a deliberate human decision, never a side effect of a batch.
4. **Obvious secrets** — scan new/changed content for API keys, tokens, private keys,
   credential-bearing URLs. Flag any hit.
5. **Real `.env` files** — flag any **versionable** real `.env` (tracked or not
   git-ignored). An ignored, local-only `.env` is fine — never read its content.
   `.env.example` / `.env.template` with placeholders are the shareable form.
6. **Sanctioned-path check** — confirm application code was written through a
   sanctioned path: an implementation agent, an ASK-approved inline write (standard
   profile), or an inline write in the light profile. Flag code that bypassed the
   write-guard.
7. **Design check (UI batches only)** — when the diff touches UI files
   (`tsx/jsx/vue/svelte/css/scss/html`), run the design review checklist at the end of
   `docs/DESIGN_STANDARDS.md`: five view states · contrast/keyboard basics ·
   responsiveness at extremes · consistency with `docs/STACK.md` Visual language ·
   no one-off tokens. Report findings like any other gate item. Skip silently for
   non-UI batches.
8. **Agent worktrees** — run `git worktree list`; any agent worktree
   (`.claude/worktrees/*`) with uncommitted or unconsolidated content requires an
   explicit decision — consolidate (cherry-pick) or discard (`git worktree remove`) —
   before the batch closes. Report what was found.
9. **Code review** — recommend `requesting-code-review` when the batch is non-trivial.
10. **Delivery log** — when the project keeps `docs/DELIVERY_LOG.md`, append the batch
    entry: what shipped · validation · review/approval · commit hash. Skip silently when
    the project has no delivery log.

## Deliverable
A table plus a short verdict:

| Command | Result | Status |
|---|---|---|
| `<from docs/STACK.md>` | pass / fail / output summary | PASS / FAIL / NOT CONFIGURED |

Then: unexpected files (including any `Profile:` change), secret/versionable-`.env`
findings, the sanctioned-path check, the design check (UI batches), the agent-worktree
status (consolidated · discarded · none found), the code review recommendation, the
`docs/DELIVERY_LOG.md` entry appended (when the project keeps one), and an overall
**gate PASS / gate FAIL**.
