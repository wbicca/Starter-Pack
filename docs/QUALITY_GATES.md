# Quality Gates — decision map

This is a **map**, not a manual. It tells you *which* gate to run *when*, and points to the
canonical skill/script that owns the actual steps. It deliberately does **not** restate the
contents of those skills — the skill is the single source of truth; this file only routes to
it. If a step here ever disagrees with a skill, the skill wins.

Canonical owners:
- **Quick Check** → `scripts/quality/quick-check.mjs` (a script + Stop hook, *not* a skill).
- **Development Gate** → `quality-gate` skill (step 1 executed by
  `scripts/quality/batch-verify.mjs` — evidence over claims) + `refactor-pass` skill
  when applicable.
- **Release Gate** → `release-sanity` skill (which runs the quality-gate checklist first).

Code standards these gates enforce live in `docs/ENGINEERING_STANDARDS.md`; the concrete
commands live in `docs/STACK.md` (never invent one).

## Level selection
| Change | Level | Run |
|--------|-------|-----|
| Small/local edit, fast feedback | **Quick Check** | `quick-check.mjs` (auto on Stop; or run it manually) |
| Relevant bug, medium feature, multi-file batch | **Development Gate** | `quality-gate` (+ `refactor-pass` after a large change) |
| Release, deploy, critical change, closing a big feature | **Release Gate** | `release-sanity` (+ `security-auditor` when sensitive) |

Levels are cumulative: a release runs the Development Gate's checklist inside
`release-sanity`, which itself extends Quick Check's concerns. Passing a higher gate
implies the lower ones were satisfied.

---

## Quick Check
**When:** every turn (it runs automatically on the Stop hook for Claude Code and Codex), and
any time you want a fast, read-only sanity pass. Owner: `scripts/quality/quick-check.mjs`
(run manually with `node scripts/quality/quick-check.mjs`).

**What it does:** a fast, **read-only** check. It does **not** run install, build,
typecheck, tests, lint, or a formatter — and it does not replace the Development or Release
gates.

**Current blockers** (fail completion; manual exit code `2`):
- Whitespace/conflict errors (`git diff --check`).
- Unresolved conflict markers in modified/staged/untracked files.
- Obvious secrets in **added** diff lines (Stripe/AWS/GitHub/Google keys, PEM, JWT,
  credential-bearing DB URLs); placeholders are ignored.
- A real `.env` file that is **versionable** (tracked/staged/modified/untracked-not-ignored).
- Versionable residual temporary files (`*.tmp`, `.tmp-*`, `audit*.log`).
- Files resolving outside the repo root.

**Current warnings** (do **not** block; surfaced by name only, content never read):
- An **ignored, local** real `.env` file exists on disk (confirm it's intentionally local).
- An **ignored, local** temporary file exists on disk (remove if unneeded).
- Allowed example files (`.env.example`, `.env.local.example`, `.env.template`) are silent.

**Definition of Done (Quick Check):** no blockers; warnings acknowledged.

---

## Development Gate
**When:** after **each** implementation batch — a story, one structural change, a small
cohesive set of components, or one approved redesign round — and before starting the next
batch. Owner: `quality-gate` skill.

**What it does** (see the skill for the full procedure): runs `scripts/quality/batch-verify.mjs` — which executes **only** the commands
configured in `docs/STACK.md` (Lint → Typecheck → Test → Build, fail-fast; Format is
excluded because formatters mutate) and blocks (`exit 2`, standard profile) when Test
is unconfigured on an app-code batch, unless a `--accept-unconfigured` human waiver is
recorded — inspects the diff, flags unexpected/governance files **and any `Profile:`
change in `docs/STACK.md`**, scans for obvious secrets and **versionable** real `.env`
files (an ignored, local-only `.env` is fine), runs the design checklist when the batch
touches UI files, confirms application code went through a **sanctioned path**
(implementation agent · ASK-approved inline write in `standard` · inline in `light`),
and recommends a code review for non-trivial batches.

- **If a command is `UNCONFIGURED`/`TBD` in `docs/STACK.md`**, the gate reports it as *not
  configured* — it never guesses or silently skips.
- **`refactor-pass`** — run **after a large change or long session** (behavior-preserving
  cleanup). It is *not* a substitute for the quality-gate; it complements it.

**Expected validations:** the configured `docs/STACK.md` commands, a clean diff with no
unexpected/governance-file changes, no secrets, no versionable real `.env`, design
checklist clean for UI batches, sanctioned-path check passed.

**Definition of Done (Development Gate):** configured checks pass (or are honestly reported
as not configured); diff is clean and scoped; no secrets/real `.env`; app code went through
a sanctioned path; code review done when the batch is non-trivial; an entry appended to
`docs/DELIVERY_LOG.md` when the project keeps one (what shipped · validation · review/approval
· commit).

---

## Release Gate
**When:** before any release, tag, deploy, critical change, or when closing a large feature.
Owner: `release-sanity` skill.

**What it does** (see the skill for the full procedure): runs the quality-gate checklist
first, then audits for leaked secrets, dangerous permissions, destructive commands, path
traversal, missing validation at trust boundaries, unsafe casts/unwraps, unlicensed
external assets, PII/secrets in logs, unjustified new dependencies, and improper
hook/permission changes — ending in a go / no-go verdict.

**Expected validations:** everything in the Development Gate, plus the release-sanity audit
items, plus `security-auditor` for any sensitive flow.

**Definition of Done (Release Gate):** `release-sanity` returns **APPROVED** — no blockers;
risks reviewed and accepted; external assets recorded in `NOTICE.md`; `security-auditor`
run and clear when sensitive flows exist.

---

## Who to involve, and when
- **`code-reviewer`** — after any non-trivial batch (Development Gate recommends it), and
  before merging a significant change. Canonical engine: `requesting-code-review`.
- **`qa-tester`** — when a feature needs test coverage, especially E2E for existing
  features, or when the batch changed observable behavior without tests.
- **`security-auditor`** — whenever the batch or release touches auth, RLS, payments,
  webhooks, PII, permissions, dependencies, or external assets. Mandatory at the Release
  Gate for sensitive flows.
- **Consult `docs/SCALABILITY_CHECKLIST.md`** — when planning a large feature or a release
  that changes data model, tenancy, external/AI API usage, or load characteristics.
- **Ask the human** — when a check is `UNCONFIGURED` and you're unsure whether to proceed;
  when a finding's severity is ambiguous; when a gate would require changing a script's
  blocker/warning **semantics**; or when a blocker can't be resolved without a product
  decision.

## How this map avoids duplicating the skills
- It lists **when** and **which**, never the step-by-step **how** — that stays in each skill.
- Blockers/warnings here are a *summary of current behavior* for routing; the script and
  skills remain authoritative and may evolve independently.
- Changing gate behavior means editing the owning skill/script, not this map. This file is
  updated to *reflect* such a change, never to introduce one.

## Findings (current state)
- **No `quick-check` skill exists.** "Quick Check" is the script
  `scripts/quality/quick-check.mjs`, wired as a Stop hook (Claude Code via
  `.claude/settings.json`, Codex via `.codex/hooks.json`) and runnable manually. This map
  treats the script as the canonical owner.
- **Three secret checks operate at different layers, by design** (not a contradiction):
  the `scan-secrets` PreToolUse hook (blocks writing a secret), Quick Check (blocks a secret
  in added diff lines at end of turn), and the Development/Release gates (broader diff/tree
  scan). They overlap intentionally as defense in depth.
- **Real `.env` handling is consistent across layers:** every layer is exposure-based.
  The `protect-sensitive-files` hook (and the shell-write guard) block only a
  **versionable** real `.env` (tracked or not git-ignored); an ignored-and-untracked
  local `.env` is writable. Quick Check blocks a *versionable* `.env` and only *warns*
  on an *ignored, local* one. Versionable = blocker, intentionally-local = allowed/warning
  — the guarded risk is a secret entering a commit.
