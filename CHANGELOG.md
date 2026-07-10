# Changelog — Starter Pack

All notable template changes, one entry per maintenance batch. Projects check their
template version in `VERSION` (reported by `starter-doctor`) and pull updates with
`node scripts/quality/update-from-template.mjs`.

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
