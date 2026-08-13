---
name: quality-gate
description: >
  Mandatory verification after each implementation batch. Use after finishing any batch,
  before starting the next, or when the user says "run the quality gate" / "is this
  ready".
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
  below); **step 9 (code review) is opt-in, but step 10 (the DELIVERY_LOG entry) is
  NOT — it has no substitute in either profile** (a batch without its entry is not
  closed). **Exception (both profiles):** a batch touching a sensitive flow (see
  `docs/CONSTITUTION.md`) always runs the FULL sequence and triggers `security-auditor`.

## Steps
1. **Run the batch verifier** — `node scripts/quality/batch-verify.mjs` (the
   deterministic owner of this step: it reads the configured `docs/STACK.md` commands,
   runs Lint → Typecheck → Test → Build fail-fast, and prints the evidence table —
   plus, on a PASS, the batch-close checklist and a drafted DELIVERY_LOG entry when
   the log is stale; `--log` appends the draft for editing).
   Report its table and exit code. **Its execution is the only evidence accepted for
   "checks passed" — a subagent's report never substitutes for running it.** Exit `2`
   means the Test command is UNCONFIGURED while the batch touches app code (standard
   profile): the gate FAILS — either configure the command in `docs/STACK.md` or, on
   an explicit human decision, rerun with `--accept-unconfigured` and record the
   waiver in `docs/DELIVERY_LOG.md`.
   On a brand-new project the FIRST app-code batch typically hits exit `2` (Test is
   still `TBD`) — that is by design: configure the Test command as soon as the scaffold
   can run one, or record the waiver.
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
   **Sensitive-flow gate:** when the batch touches a `Sensitive paths` glob declared in
   `docs/STACK.md`, `batch-verify` blocks (exit 2, both profiles) until a
   `security-auditor` pass is recorded — dispatch it, then
   `node scripts/quality/record-audit.mjs --verdict clear` (or rerun with
   `--accept-audit-waiver` for a human-approved exception, reason in the DELIVERY_LOG).
5. **Real `.env` files** — flag any **versionable** real `.env` (tracked or not
   git-ignored). An ignored, local-only `.env` is fine — never read its content.
   `.env.example` / `.env.template` with placeholders are the shareable form.
6. **Sanctioned-path check** — confirm application code was written through a
   sanctioned path: an implementation agent, an ASK-approved inline write (standard
   profile — the first approval of a session covers its later inline writes), or an
   inline write in the light profile. Flag code that bypassed the write-guard.
7. **Design check (UI batches only)** — when the diff touches UI files
   (`tsx/jsx/vue/svelte/css/scss/html`), run the design review checklist at the end of
   `docs/DESIGN_STANDARDS.md`: five view states · contrast/keyboard basics ·
   responsiveness at extremes · consistency with `docs/STACK.md` Visual language ·
   no one-off tokens. Report findings like any other gate item. Skip silently for
   non-UI batches. For UI batches, the **`impress-gate` runs here BY DEFAULT** (after
   step 1's PASS, never as its substitute) unless the project opted out in
   `docs/STACK.md` → Capabilities; skipping it on a UI batch is legitimate only for a
   trivial visual change, with the reason recorded in the DELIVERY_LOG entry.
8. **Agent worktrees** — run `git worktree list`; any agent worktree
   (`.claude/worktrees/*`) with uncommitted or unconsolidated content requires an
   explicit decision — consolidate (PR merge, or cherry-pick locally) or discard
   (`git worktree remove`) —
   before the batch closes. Report what was found.
9. **Code review** — recommend `requesting-code-review` when the batch is non-trivial.
10. **Delivery log** — when the project keeps `docs/DELIVERY_LOG.md`, append the batch
    entry: what shipped · validation · review/approval · commit hash. **The entry has
    no substitute — a batch without its entry is not closed** (batch-verify warns when
    the log is older than the last merge). Skip only when the project keeps no
    delivery log.

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
