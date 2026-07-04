---
name: refactor-pass
description: >
  Behavior-preserving refactor round after a large feature, large fix, or long session —
  or when the user says "refactor pass" / "clean this up". Removes dead code and
  duplication, improves names, replaces hand-rolled code that duplicates existing utils,
  adds missing tests. Never changes behavior without tests.
---

# Refactor pass

A deliberate cleanup round that improves the code's internal quality **without changing
its observable behavior**. Run it after a large change or a long session — not as a
substitute for the `quality-gate` (which verifies a batch) or `release-sanity` (which
audits before publishing).

## Ground rules
- **Do not change behavior without a test.** If a change could alter behavior, first add
  or confirm a test that pins the current contract, then refactor against it.
- Follow `docs/ENGINEERING_STANDARDS.md` for style, naming, tests, and structure.
- Use the real commands from `docs/STACK.md` to run tests; never invent one.
- Stay surgical — refactor what the round targets; don't rewrite adjacent code that isn't
  part of the cleanup.

## What to do
1. **Scope it.** Identify the code touched by the recent work (or the area the user named).
2. **Remove dead code** — unreached branches, unused exports/imports, orphaned helpers.
3. **Refactor obvious duplication** — collapse real repetition (third occurrence), not
   merely-similar code.
4. **Replace hand-rolled code** that duplicates the standard library, the platform, or an
   existing util with the existing solution (reuse ladder — `docs/ENGINEERING_STANDARDS.md`).
5. **Remove magic numbers** — name constants where it aids clarity.
6. **Improve names** — replace vague names (`data`, `handler`, `Manager`, `utils`) with
   specific domain terms.
7. **Split oversized modules/functions** — only when it genuinely improves clarity (use
   the ~40-line / ~500-line signals as prompts, never as hard rules).
8. **Add missing tests** — cover public behavior and boundaries that the recent work left
   untested.
9. **Preserve useful comments** — keep the *why*; don't strip context during the move.
10. **Verify** — run the configured tests/typecheck/lint and confirm green before claiming done.

## Deliverable
Report:
- **Changes** — what was refactored, grouped by area.
- **Risks** — anything that could have shifted behavior, and how it was guarded.
- **Tests** — commands run and their results (or which are UNCONFIGURED in `docs/STACK.md`).
