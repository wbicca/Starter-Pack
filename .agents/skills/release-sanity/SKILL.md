---
name: release-sanity
description: >
  Pre-release audit before publishing or shipping. Use before a release, tag, deploy, or
  when the user says "run release sanity", "are we ready to ship", "audit before release",
  or "pre-release check". Runs the quality-gate checklist first, then audits for leaked
  secrets, dangerous permissions, destructive commands, missing validation, unlicensed
  external assets, and unjustified new dependencies — ending with a go / no-go verdict.
---

# Release Sanity (Codex)

Codex wrapper for the shared pre-release audit. The canonical procedure lives in the
Claude skill (`.claude/skills/release-sanity/SKILL.md`) — read that file as the source
of truth and follow it exactly; this wrapper only makes the skill discoverable to Codex.

Key contract points (details in the canonical skill): run the `quality-gate` checklist
first and carry its findings forward; the audit assumes the code works and asks whether
it is safe to ship, ending in an explicit go / no-go verdict.
