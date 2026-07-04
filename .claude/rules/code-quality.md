---
name: code-quality
description: Path-scoped pointer to the common engineering standards for implementing and reviewing code — stack-agnostic. Applies to source files; thresholds are review signals, not hard limits.
paths:
  - "**/*.{ts,tsx,js,jsx,mjs,cjs}"
  - "**/*.{py,rb,go,rs,java,kt,kts,swift,scala,php,cs}"
  - "**/*.{c,h,cc,cpp,hpp,m,mm}"
  - "**/*.{sql,sh,bash}"
  - "**/*.{vue,svelte}"
---

# Code quality — implementation & review

This rule is path-scoped: it applies whenever you implement or review code in the files
matched above.

- **Follow `docs/ENGINEERING_STANDARDS.md`** — the common source for Claude and Codex
  (code style, comments, tests, dependencies, structure, formatting, logging, and the
  refactor-pass / quality-gate / release-sanity gates). It is not duplicated here.
- **Use `docs/STACK.md`** for the real, project-specific commands (lint, format,
  typecheck, test, build). Never invent a command that isn't configured there.

The thresholds in the standards are **review signals, not hard gates** — apply judgment.
