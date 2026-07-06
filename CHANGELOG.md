# Changelog — Starter Pack

All notable template changes, one entry per maintenance batch. Projects check their
template version in `VERSION` (reported by `starter-doctor`) and pull updates with
`node scripts/quality/update-from-template.mjs`.

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
