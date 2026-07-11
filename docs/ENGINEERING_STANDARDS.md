# Engineering Standards — common source for Claude and Codex

Stack-agnostic standards for writing and reviewing code in this project. This is the
shared source both Claude Code and Codex follow; `.claude/rules/code-quality.md` is a
path-scoped pointer here. Project-specific commands and stack decisions live in
`docs/STACK.md` — always read the real commands there; never invent one.

The numbers below are **review signals, not hard gates**. Apply judgment: a longer unit
that is genuinely cohesive is fine; never split or pad code only to hit a threshold.

For UI work, the visual counterpart of this document is `docs/DESIGN_STANDARDS.md`
(pointed to by `.claude/rules/design-quality.md`).

## Code style
- Prefer small, focused functions. Treat functions above ~**40 lines** as a review
  signal, not a violation.
- Treat files above ~**500 lines** as a review signal to check for more than one
  responsibility.
- One thing per function; one responsibility per module.
- Use specific domain names. Avoid vague names like `data`, `handler`, `Manager`,
  `utils` when a clearer name exists.
- Keep types explicit at public boundaries.
- Avoid `any`/untyped escapes. If unavoidable, isolate them and justify why.
- Remove duplicated business logic. Do **not** abstract merely-similar code prematurely
  (abstract on real repetition, not the first guess).
- Prefer early returns and shallow control flow over deep nesting.
- Error messages should include actionable context and the expected shape when useful.
- Never expose secrets or PII in errors or logs.

## Reuse ladder — before writing new code
Climb in order; stop at the first rung that solves the problem. Write new code only when
every rung above has failed:
1. **Does this need to exist at all?** Challenge the requirement first.
2. **Does the codebase already do it?** Search before writing.
3. **Does the standard library do it?**
4. **Does the platform/framework do it natively?**
5. **Does an already-installed dependency do it?**
6. **Is it a one-liner** instead of a new abstraction?
7. Only then: **write the minimum code that works.**

Adding a **new** dependency is not a rung — it needs explicit justification (see
Dependencies). Reviewers apply the same ladder in reverse: flag new code that duplicates
an existing util, the standard library, or an installed dependency.

## Comments
- Preserve useful comments during refactors.
- Write **why**, not the obvious **what**.
- Document public APIs and non-obvious domain behavior.
- Reference issues/SHAs only when a line exists because of a specific bug or upstream
  constraint.

## Tests
- Use the project-specific test commands from `docs/STACK.md`.
- Test observable behavior and public contracts, not private helpers in isolation
  (test those directly only when their logic is complex enough to warrant it).
- Bug fixes require a regression test that fails before the fix.
- Mock external I/O; prefer named fakes for reused or complex behavior over ad-hoc mocks.
- Tests should be fast, independent, repeatable, self-validating, and timely.

## Dependencies
- Inject side-effectful, replaceable, external dependencies.
- Direct imports are fine for pure, stable utilities.
- Wrap a third-party library only when it is central, volatile, side-effectful, or
  expensive to replace/mock — not as a thin pass-through.

## Structure
- Follow framework conventions; prefer small, focused modules.
- Use predictable paths so code is found where a reader expects it.

## Formatting
- Use the configured formatter/linter (see `docs/STACK.md`).
- Do not debate formatting that tooling already handles.

## Logging
- Structured logs for observability; plain text for human-facing CLI output.
- Never log secrets, credentials, tokens, or PII.

## Refactor pass
After a large feature, a large fix, or a long development session — see the
`refactor-pass` skill:
- remove dead code;
- refactor obvious duplication;
- add missing tests;
- remove magic numbers;
- check large modules/functions for split opportunities;
- improve names;
- **do not change behavior without tests.**

## Quality gate
> Which gate to run *when* (Quick Check · Development · Release) is mapped in
> `docs/QUALITY_GATES.md` — it routes to the canonical skills below without restating them.

After **each** implementation batch — see the `quality-gate` skill:
- run formatter / linter / typecheck / tests / build **when configured** in `docs/STACK.md`;
- inspect the `git diff`;
- verify there are no unrelated changes;
- verify no secrets, real `.env` files, or unsafe permissions were introduced;
- report the commands run and their results.

## Release sanity
Before publishing — see the `release-sanity` skill:
- search for secrets;
- check for dangerous permissions;
- check for destructive commands;
- check for path traversal;
- check for missing validation at trust boundaries;
- check for unnecessary unwraps / unsafe casts (where applicable);
- check external assets and their licenses;
- run `security-auditor` when sensitive flows (see `docs/CONSTITUTION.md`) exist.
