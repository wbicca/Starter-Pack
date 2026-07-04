---
name: refactor-pass
description: >
  Explicit behavior-preserving refactor round. Use after a large feature, a large fix, or
  a few hours of development — or when the user says "refactor pass", "clean this up",
  "tidy the code", or "do a refactor round". Removes dead code and duplication, improves
  names, removes magic numbers, and adds missing tests. It does NOT add features and does
  NOT change behavior without tests.
---

# Refactor Pass (Codex)

Codex wrapper for the shared refactor round. The canonical procedure lives in the Claude
skill (`.claude/skills/refactor-pass/SKILL.md`) — read that file as the source of truth
and follow it exactly; this wrapper only makes the skill discoverable to Codex.

Key contract points (details in the canonical skill): behavior-preserving only — if a
change could alter behavior, first pin the current contract with a test; not a substitute
for `quality-gate` (batch verification) or `release-sanity` (pre-release audit).
