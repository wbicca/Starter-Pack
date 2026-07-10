---
name: design-quality
description: Path-scoped pointer to the frontend design standards — hierarchy, view states, accessibility, responsiveness, consistency. Applies to UI files; principles are review signals, not hard gates.
paths:
  - "**/*.{tsx,jsx,vue,svelte}"
  - "**/*.{css,scss,sass,less}"
  - "**/*.{html,htm}"
---

# Design quality — UI implementation & review

This rule is path-scoped: it applies whenever you implement or review UI in the files
matched above.

- **Follow `docs/DESIGN_STANDARDS.md`** — the visual-quality contract (hierarchy,
  typography, color/contrast, the five view states, feedback, accessibility,
  responsiveness, UI reuse ladder). It is not duplicated here.
- **Use `docs/STACK.md` → "Visual language"** for THIS project's design reference,
  tokens, and component library. Design within the project's language, never a generic
  one — and never invent tokens/components where the project already has them.

The principles are **review signals, not hard gates** — apply judgment.
