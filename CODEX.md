# Codex routing

Codex-specific routing. `AGENTS.md` is the shared contract (read it first); this file
holds only what is specific to the Codex runtime, so it doesn't load into every Claude
session. Claude Code loads skills from `.claude/skills/`; Codex loads them from
`.agents/skills/`, where each is a lean Codex wrapper pointing at the canonical skill.

- Codex must explicitly spawn subagents for non-trivial implementation and review work.
- Use `frontend-engineer` for frontend implementation.
- Use `backend-engineer` for backend/API implementation.
- Use `code-reviewer` after each non-trivial implementation batch.
- Use `security-auditor` for any sensitive flow (see `docs/CONSTITUTION.md`), dependencies, permissions, or external assets.
- Use built-in `explorer` for read-heavy investigation when needed.
- On the Codex side only `$project-onboarding`, `$quality-gate`, `$refactor-pass`, and
  `$release-sanity` exist as invocable skills (`.agents/skills/`). Every other routing-table
  row is a **practice to apply inline** — follow its intent via internal best practices +
  BMAD/Superpowers principles + project docs; it is not an invocable Codex skill.
- Roles without a Codex agent (database/schema, visual design, QA, deploy) are handled in the
  main thread or by the nearest available agent (`backend-engineer`/`frontend-engineer`) with
  extra care.
- The **impress-gate** (default-on for UI batches on the Claude side) has no Codex skill or
  Playwright-equipped critic. On Codex, `batch-verify`'s UI-batch checklist line is satisfied
  by running the `docs/DESIGN_STANDARDS.md` review checklist manually against the running app,
  or waived with a recorded reason in the DELIVERY_LOG entry. Do not treat the printed line as
  a hard block Codex cannot clear.
- Keep planning in the main thread.
- Do not spawn recursive agent trees.
- After each batch, invoke `$quality-gate`.
- After large changes, invoke `$refactor-pass`.
- Before release, invoke `$release-sanity`.
