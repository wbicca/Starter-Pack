# Changelog — Starter Pack

All notable template changes, one entry per maintenance batch. Projects check their
template version in `VERSION` (reported by `starter-doctor`) and pull updates with
`node scripts/quality/update-from-template.mjs`.

## 1.6.0 — 2026-08-13

Sensitive-flow enforcement — the strategy-critic's highest-leverage bet: code review's
sibling guarantee (security-auditor on sensitive flows) moves from a printed checklist
line to a deterministic gate, finishing the rite→script pattern the template already
validated for DELIVERY_LOG, quality-gate, and impress-gate.

- **`Sensitive paths` in `docs/STACK.md` → Capabilities**: comma-separated globs mapping
  the CONSTITUTION flows (auth · RLS · payments · webhooks · fiscal · PII) to the
  project's real paths. Set at onboarding (new Step-5 instruction + checklist item).
- **`batch-verify` enforces it**: a batch touching a sensitive path FAILS (exit 2, in
  BOTH profiles — sensitive flows never relax) until a fresh `security-auditor` pass is
  recorded. Freshness is per-file git-blob hash, so any later edit to a sensitive file
  invalidates the prior audit and re-requires it. `--accept-audit-waiver` is the
  human-approved exception (reason in DELIVERY_LOG); the close checklist's security line
  becomes `[x] ENFORCED`, and the DELIVERY_LOG draft gains a `Security-audit:` field.
- **`scripts/quality/record-audit.mjs` (new)**: the orchestrator records the auditor's
  verdict after it returns (the read-only auditor can't write its own record — by
  design). Appends paths + content-hashes only to `.claude/.audit-log.jsonl`
  (gitignored, like the governance log).
- **`starter-doctor`**: requires the new script; warns when the tree has sensitive-
  looking paths (auth/rls/webhook/payment/billing/fiscal/…) but STACK declares no
  `Sensitive paths` — the gate can't fire undeclared.
- **CI honesty**: in `--range`/CI mode the gitignored audit log is invisible, so the gate
  WARNS instead of failing — local enforcement is the point; a committed CI signal is
  the planned v1.6.1 follow-up.
- **Tests**: batch-verify-smoke 28→34 (unaudited→exit 2, recorded→PASS/ENFORCED, stale
  hash→exit 2, waiver, undeclared→no gate, CI-range→warn).

## 1.5.3 — 2026-08-13

Contract-coherence batch from a full release-sanity review (deterministic layer clean;
three fresh-context critics — agents/skills, E2E/Codex, strategy). Small confirmed
defects only; the strategic bet (sensitive-flow enforcement) is deferred to v1.6.

- The three Opus judgment agents (code-reviewer, security-auditor, system-architect) no
  longer carry the self-referential "Default model is Sonnet / escalate to Opus"
  boilerplate — a no-op that contradicted their `model: opus` frontmatter and the
  CLAUDE.md model policy. Reworded to reflect the Opus tier and the real hand-back rule.
- The frontend agents' goal-loop no longer says the impress-gate verdict is part of the
  agent's own "definition of done" — the gate is an orchestrator-level, fresh-context,
  never-the-builder step that runs AFTER the agent returns. Reworded to "expect it to
  bounce work back; fix the gap".
- `starter-doctor`'s `appRootFromStack` rejects an unfilled `App root: <…>` placeholder
  (it parsed the leading `<` as the value → monorepo checks silently targeted `<//…`);
  the onboarding STACK template now defaults `App root:` to `.` with an HTML-comment hint.
- The Codex onboarding wrapper (`.agents/skills/project-onboarding/SKILL.md`) is now a
  thin pointer to the canonical skill (like the other three wrappers) instead of a
  parallel rewrite that had drifted — it had dropped the profile/planning-track questions
  and the Profile/App-root/Visual-language/CI-seed steps the gates depend on.

## 1.5.2 — 2026-08-13

Gauntlet-loop self-review of the template (three fresh-context blind critics —
machinery, security, contract — all NOT IMPRESSED). Every fix traces to a reproduced
finding; the smokes gained a case per defect.

- **Security (write-time + net):**
  - `block-dangerous-bash`: `rm -rf ./*` and `rm -rf .*` now DENY — they slipped the
    `\*` anchor (`.*` can match `..` and escape to the parent).
  - `secret-patterns`: added distinct provider prefixes that passed before —
    `gho_/ghu_/ghs_/ghr_`, `rk_live_/rk_test_`, `whsec_`, `glpat-`, `SG.`, `xapp-`,
    `hf_`, `dop_v1_`, `ya29.` (GitLab-in-camelCase-key now caught via the intrinsic
    shape).
  - `starter-doctor`: the worktree/branch cleanup commands are emitted ONLY for names
    matching `^[A-Za-z0-9._/-]+$` — git accepts `$();&|` in ref names, so an untrusted
    name could otherwise inject a command the human runs by pasting; unsafe names get a
    manual-removal warning instead.
  - session ASK marker created with `O_NOFOLLOW` (a symlink planted at the predictable
    `/tmp` path can no longer make the write truncate a target file).
  - `session-baseline` surfaces `CLAUDE_ORCHESTRATOR_WRITE_OVERRIDE` when active — the
    governance DENY→ASK downgrade is no longer invisible.
  - `APP_EXTS` extended (rs/php/kt/c/cpp/cs/swift/yaml…) so a stack-agnostic starter
    ASKs on non-JS app code too.
- **Machinery correctness:**
  - Supabase anon key exemption moved to the shared lib and applied in quick-check AND
    session-baseline — the layers had diverged (quick-check blocked at end-of-turn what
    the write-time scanner publishes by design).
  - Squash/rebase-merge blindness fixed in four places: DELIVERY_LOG staleness
    (batch-verify + session-baseline) now compares against the last commit of any kind,
    and worktree "merged" detection (doctor + session-baseline) adds a content-identical
    arm — the old `--merges` / `--is-ancestor` checks silently never fired for the
    default GitHub squash flow.
  - `checkOutsidePaths` parses git rename entries correctly; `--log` warns when there is
    no DELIVERY_LOG to append to; the drafted entry sanitizes commit subjects.
- **Contract coherence:** the DELIVERY_LOG entry is NOT opt-in in the light profile
  (only code review is) — fixing a direct contradiction inside the quality-gate skill;
  README now lists batch-verify/impress-gate/starter-feedback and carries an honest
  Codex caveat; the seed `docs/STACK.md` Capabilities gained Planning track + Visual
  quality gate (matching the onboarding template); "symlinked" replaced by the real
  wrapper description; stale "cherry-pick consolidation" pointers updated to PR-canonical;
  CODEX.md says how to satisfy/waive the impress-gate; three doc-vs-code textual
  divergences corrected (placeholder scope, `=======`, `audit<digits>.log`); the
  impress-gate "runs by default" framing labeled as an orchestrator discipline rule.
- **Tests:** hook-smoke 150→159, quick-check-smoke 13→14, batch-verify-smoke 27→28.

## 1.5.1 — 2026-08-12

Impress-gate flipped from opt-in to **default-on for UI batches** — an opt-in step
contradicts the round-2 thesis (opt-in rites get silently abandoned; the quality-gate
skill measured 0 invocations). The trigger is deterministic, not a human memory:

- **batch-verify detects the UI batch** (tsx/jsx/vue/svelte/css/scss/html in the
  diff — same set as the quality-gate design check) and adds the impress-gate line to
  the close checklist; the DELIVERY_LOG draft gains an `Impress:` field on UI batches.
- **Default-on, scoped**: runs automatically after batch-verify's PASS on UI batches
  only — backend batches, CI, and opted-out projects (`Visual quality gate: no` in
  STACK Capabilities) are exempt by construction. Skipping on a UI batch is legitimate
  only for a trivial visual change, with the reason recorded in the log entry.
- Contract/docs sync: impress-gate + quality-gate skills, AGENTS routing row and
  batch-close paragraph, USAGE §3.5b, QUALITY_GATES, frontend agents' goal loop,
  onboarding STACK template default (`yes` for UI projects).
- Tests: batch-verify-smoke 26→27 (UI-batch checklist line; non-UI PASS pinned to NOT
  carry it).

## 1.5.0 — 2026-08-12

Round-2 field calibration ("what the starter automated survived; what it only wrote
in the contract did not") + the impress-gate. Every item traces to the 2026-08-12
`starter-feedback` audit (108 commits / 26 PRs / 150 dispatches under v1.4.0).

- **batch-verify closes the batch with you**: on a PASS it prints the batch-close
  checklist (the steps that only lived inside the never-invoked quality-gate skill:
  log entry · review · security · worktrees) and DRAFTS the DELIVERY_LOG entry from
  git + command results when the log is stale — `--log` appends it for editing (the
  verifier's only mutation, explicit opt-in, never CI). Field evidence: as a purely
  manual step the entry happened in 4 of 26 batches.
- **`impress-gate` skill (new, opt-in)**: gauntlet-style visual quality gate for UI
  batches — a fresh-context READ-ONLY critic drives the real app (Playwright /
  `webapp-testing`), provokes the five states, captures screenshots/console to
  scratch, and judges against an explicit rubric (DESIGN_STANDARDS + STACK Visual
  language + blind comparison vs a reference when one exists). Verdict always names
  the largest remaining gap; max 3 rounds then human escalation; missing tooling is
  suggested and approved once, never auto-installed. Wired into quality-gate step 7,
  the frontend agents' goal loop, and STACK Capabilities.
- **Session-scoped ASK covers Bash** (v1.4.0 defect, audit friction 4): the approval
  marker is now recorded for approved Bash redirects into app code too (PostToolUse
  wiring for Bash added) — ends the ~30 re-asks measured in approved sessions.
- **Governance event log**: every hook ask/deny/block/fresh-warn appends one JSON
  line to `.claude/.governance-log.jsonl` (gitignored; paths/codes only, with tool
  attribution). `starter-feedback` now reads exact counts instead of transcript
  archaeology (the audit documented grep self-contamination and a silent count
  failure).
- **Doctor: signal, not noise**: worktrees/`worktree-agent-*` branches whose content
  is already in the default branch are OK + ready-to-paste cleanup commands; only
  UNMERGED content warns (the chronic WARN covered 6 worktrees, all merged). New
  warning when STACK.md records a volatile count ("NNN tests") — enforcing the
  v1.4.0 rule that field data showed being violated (903 recorded vs 2242 real).
- **SessionStart pending-state brief**: session-baseline prints `PENDING_STATE:`
  (stale DELIVERY_LOG · merged worktrees awaiting cleanup · volatile count) once, at
  the moment the operator decides what to do — instead of chronic end-of-turn noise.
- **Planning track declared at onboarding**: `BMAD` | `manual specs` (new Step 0
  question + Capabilities line). With `manual specs` the BMAD routes stay installed
  but dormant — two audit rounds measured zero BMAD invocations against eight
  excellent hand-written specs.
- **Docs/contract sync**: AGENTS (routing row, batch close, planning track,
  worktree-cleanup pointer), USAGE (§3.5b impress-gate, `--log`, PENDING_STATE,
  governance log), QUALITY_GATES, quality-gate/onboarding/starter-feedback skills,
  DECISIONS template format note.
- **Tests**: hook-smoke 147→150 (Bash marker PostToolUse); batch-verify-smoke 23→26
  (draft print, `--log` append, checklist).

## 1.4.0 — 2026-07-23

Field-report calibration — every change traces to the first real-project
`starter-feedback` audit (CRM, 27 PRs / 7 days). Theme: move the weight from rite
to artifact; alarm only on what the policy forbids; cut lead time without cutting
evidence.

- **Read-only scratch exemption** (`orchestrator-write-guard`): read-only agents may
  capture command output via redirect/`tee` into harness temp paths (/tmp,
  /private/tmp, project memory) — fixes a security audit that had to DERIVE a
  mutation-test result it could have EXECUTED. Repo-tree targets, real verbs
  (cp/mv/rm) and opaque writes stay denied.
- **Session-scoped inline-write ASK**: in the standard profile the first approved
  inline app-code write records a marker (PostToolUse) and covers the rest of the
  session — field data showed 28 approvals in 29 asks. A decline records nothing;
  governance and out-of-root rules never consult the marker.
- **quick-check warning dedup fixed**: per-warning hashes (`emittedWarnings`) that
  persist even when no baseline file exists (the silent-store bug behind 50 identical
  `.env.local` warnings); each warning now emits once per session. Baselined-secret
  warnings still re-emit every turn.
- **batch-verify blind spots**: a clean working tree now falls back to the committed
  branch diff vs the default branch's merge-base (a fully committed branch had
  produced "PASS" that executed nothing); a PASS with zero configured commands says
  "verified nothing" out loud; a `DELIVERY_LOG.md` older than the last merge warns
  that entries are missing.
- **starter-doctor monorepo-aware**: resolves the app root from STACK.md (`App root:`
  line or `-C/--dir/--prefix` in Install/Test rows) before checking
  `package.json`/`.env.example` — kills the permanent false warnings on monorepos.
- **Contracts — rite → artifact**: the planning gate is now an artifact ("Planning
  artifact" in AGENTS.md — BMAD is the canonical path; a hand-written spec with the
  same sections satisfies it); the DELIVERY_LOG entry has **no substitute**;
  consolidation via **PR + CI** is canonical when a remote exists (cherry-pick =
  local alternative); **epic-level autonomy is the default cadence** (sensitive flows
  still stop); a single sequential story may use a branch instead of a worktree.
- **Implementer goal loop**: all 7 worktree implementers iterate implement →
  `batch-verify` → fix (max 3) and only return green with evidence — cuts the
  post-review fix-round ping-pong observed in the field.
- **Onboarding**: records `App root:`; brownfield adoption reconciles a replaced
  CLAUDE.md immediately (no orphaned `.bak`); volatile counts (test totals) are
  banned as sanity invariants; no second `AGENTS.md` in an app subdirectory.
- **Tests**: hook-smoke 136→147 (scratch exemption, session marker, PostToolUse);
  quick-check-smoke 12→13 (dedup persistence); batch-verify-smoke 20→23 (merge-base
  fallback, verified-nothing, DELIVERY_LOG staleness).

## 1.3.0 — 2026-07-11

Security-hook hardening, single-source consolidation, contract honesty, and a token
diet — from a full adversarial audit of the template (security · code quality ·
contracts · token economy).

- **Hooks hardened** (`.claude/hooks/`): the orchestrator-write-guard now treats
  interpreter one-liners (`node -e`/`python -c`/`--eval`, heredocs) that call a write
  API, and patch tools (`git apply`, `patch`), as **opaque writes** — ASK in the main
  window, DENY for read-only agents (closes the bypass where `node -e` wrote app code
  or governance files silently). `sed --in-place` and `dd of=` join the write verbs.
  block-dangerous-bash now ASKs on recursive `rm` of `.`/`..`/variables/command-
  substitutions/absolute paths (scratchpad roots exempt), `xargs rm`, `find -exec rm`,
  and `git -C <dir> add -f`.
- **Secret patterns unified** (`.claude/hooks/lib/secret-patterns.mjs`): one source now
  feeds scan-secrets, quick-check, and session-baseline (the three copies had already
  drifted on the PEM pattern). Adds Anthropic `sk-ant-`, OpenAI `sk-`, Slack `xox`,
  a wide PEM matcher (EC/OPENSSH/DSA), and a generic credential-named-variable rule
  (case-sensitive; `NEXT_PUBLIC_`/`VITE_` exempt).
- **quick-check**: baselined-secret findings now re-emit every turn (never silenced by
  the warning-set dedup — a credential is never "acceptable because pre-existing");
  warns when a diff changes the `Profile:` line of `docs/STACK.md`.
- **batch-verify**: Commands-table parser splits on cells (a literal `|` inside a
  command no longer corrupts the Status column → silent skip); per-command timeout now
  kills the whole process group (no orphaned test/build workers) and reports TIMEOUT.
- **update-from-template**: refuses a non-official template remote (flag, env var, or a
  pre-existing remote) without `--allow-remote` — an update overwrites the local hooks.
- **Tests**: hook-smoke 82→136 cases (opaque writes, rm forms, provider keys, the
  governance override, role allow-lists); new quick-check-smoke (12) and update-smoke
  (4); batch-verify-smoke 16→20. All wired into CI.
- **Docs — one canonical statement per rule**: the sensitive-flows list lives once in
  `docs/CONSTITUTION.md` (auth · RLS · payments · webhooks · fiscal/tax data · PII);
  every other file references it (this fixed a real drift). Unenforced MUSTs relabeled
  as conventions; hooks framed as best-effort flow governance, not a sandbox; USAGE
  batch sequence and agent return contract corrected.
- **Token diet**: Codex-only routing moved to `CODEX.md` (no longer loaded in every
  Claude session); the 5 starter skill descriptions trimmed to trigger-only; 7
  previously-unrouted BMAD skills added to the routing table. (The planned prune of 9
  unrouted BMAD skills was dropped — they are load-bearing in the BMAD engine.)

## 1.2.0 — 2026-07-10

Deterministic delivery verification, per the approved spec
(`docs/superpowers/specs/2026-07-10-starter-v1.2-deterministic-verification-design.md`).

- **batch-verify** (`scripts/quality/batch-verify.mjs`): deterministic owner of the
  Development Gate's step 1 — runs the configured `docs/STACK.md` commands
  (Lint → Typecheck → Test → Build, fail-fast; Format excluded: verifiers never
  mutate). Exit 2 blocks an app-code batch whose Test command is still `TBD`
  (standard profile; `--accept-unconfigured` = recorded human waiver; light profile
  warns). App-code-without-test-change emits a review-signal warning. Own smoke suite
  (16 fixture cases, incl. malformed-row/CRLF/--range regressions) wired into the
  template CI.
- **quality-gate hardened**: step 1 delegates to batch-verify; the script's execution
  is the only accepted evidence — a subagent's "tests passed" report never substitutes.
- **CI seed**: `project-onboarding` gains `templates/project-ci.yml` — derived projects
  get a GitHub Actions workflow running the SAME verifier plus quick-check.
- **Docs/doctor**: QUALITY_GATES/AGENTS/CLAUDE/USAGE updated; starter-doctor requires
  the new scripts.
- **Review hardening**: bad/shallow `--range` refs fail closed (exit 1); malformed
  STACK.md Commands rows warn instead of silently dropping a configured command;
  markdown artifacts (backticks/bold) in command cells are tolerated.

## 1.1.0 — 2026-07-10

Friction reduction + design quality, per the approved spec
(`docs/superpowers/specs/2026-07-09-starter-v1.1-friction-and-design-design.md`).

- **Profiles**: `Profile: standard | light` in `docs/STACK.md` (set at onboarding;
  quality-gate flags any `Profile:` change in a diff). Main-window inline app-code
  writes: DENY → **ASK** (standard) / silent pass (light). Governance protection and
  security hooks unchanged in both; sensitive flows always keep full discipline.
- **Exposure-based env policy**: shared `isVersionable` helper
  (`.claude/hooks/lib/exposure.mjs`); `protect-sensitive-files`, `scan-secrets`, and
  `block-dangerous-bash` now allow ignored-and-untracked targets (a local `.env` with
  real keys is fine); versionable targets stay blocked; `git add -f` asks; quick-check
  remains the end-of-turn net. Accepted residual risk (documented by review): content
  written to an ignored file is never re-scanned if the file later becomes versionable —
  mitigated by the `git add -f` ask and the versionability blockers.
- **Design**: `docs/DESIGN_STANDARDS.md` + `.claude/rules/design-quality.md`; frontend
  agents follow the design contract; quality-gate gains a UI-batch design checklist;
  onboarding records the project's Visual language in STACK.md.
- **Quality layer**: hook-smoke fixture repos + new cases (60 → 82, incl.
  tracked+ignored `.env` pins and light-profile invariants); starter-doctor validates
  `Profile` and requires DESIGN_STANDARDS.md; profile regex hardened with a word
  boundary (`lightweight` ≠ `light`).

## 1.0.0 — 2026-07-06

First stable release, after a full audit → hardening → field-test → real-project cycle.

- **Governance**: contradiction-free contracts (honest triage, single per-batch gate
  sequence, cherry-pick conflict rule, scaffold owner, epic-level autonomy option,
  "Integrity first" copy-loss detection, declined-ask rule).
- **Hooks**: hardened suite with a 60-case regression smoke (`hook-smoke.mjs`) — redirect-aware
  write detection, value-shape secret scan, ask-tier for recoverable commands, governance
  symmetry for subagents, worktree normalization, session baseline, CLAUDE_CONFIG_DIR support.
- **Skills**: pruned 22 unrouted/deprecated/duplicate skills (68 → 46); reuse ladder;
  lean always-loaded descriptions; condensed SessionStart injection; `starter-feedback`
  usage-report skill.
- **Agents**: implementers preload TDD/verification via `skills:`; commit-hash + discipline
  return contract; judgment roles (`code-reviewer`, `security-auditor`, `system-architect`)
  run on **Opus**, implementers on **Sonnet**.
- **Quality layer**: `starter-doctor` (structure + frontmatter + version), shared
  `quick-check`, GitHub Actions CI (ubuntu/windows), `update-from-template.mjs`.
- **Cross-agent**: Codex layer verified against the 0.139 config-reference; agents
  registered; Windows-safe wrapper skills.
