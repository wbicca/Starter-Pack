# Constitution — non-negotiables

When a future decision conflicts with anything here, this file wins.

1. **Self-contained.** Core behavior must be self-contained, vendored in-repo. External
   skills/plugins/MCPs are optional enhancements only — nothing external may be required,
   installed, vendored, or made mandatory without explicit human approval.
2. **One canonical path per function.** No duplicate skills (see `AGENTS.md`).
3. **Orchestrate, don't default to executing.** Triage → delegate (see `CLAUDE.md`).
4. **Plan before large work.** BMAD for product/architecture; Superpowers for execution.
5. **Evidence before "done".** `verification-before-completion` is mandatory.
6. **Cheapest competent model.** Sonnet by default; Opus only when justified.
7. **Don't modify the engine.** `_bmad/` and installed BMAD skills are read-only.
8. **Docs stay lean.** Reference contracts, not manuals.

## Project-specific non-negotiables

Filled during `project-onboarding`, only with explicit user approval. Do not invent rules.

No project-specific non-negotiables defined yet.
