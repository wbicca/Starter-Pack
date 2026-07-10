# Design Standards — frontend quality contract

Stack-agnostic standards for building and reviewing UI. Shared by Claude Code and
Codex; `.claude/rules/design-quality.md` is the path-scoped pointer here. The project's
own visual choices (reference, tokens, component library, theme) live in
`docs/STACK.md` → **Visual language** — always design within THAT language, not a
generic one.

Like `docs/ENGINEERING_STANDARDS.md`, these are **review signals, not hard gates** —
apply judgment, and prefer consistency with the project over any rule below.

## Hierarchy & layout
- Every screen has ONE primary action; visual weight follows importance.
- Use a consistent spacing scale (e.g. 4/8-based). No ad-hoc margins that exist
  nowhere else in the project.
- Align to a grid; group related elements (proximity) and separate unrelated ones.
- Whitespace is a tool, not waste — dense UIs are a deliberate choice, not an accident.

## Typography
- Use the project's type scale (sizes, weights, line-heights) — never invent one-off
  font sizes. 2 families max; establish hierarchy with size/weight, not decoration.
- Body text: comfortable line length and line-height (~1.4–1.6 for paragraphs).

## Color & contrast
- Use the project's tokens/palette; never hardcode a new hex where a token exists.
- Text contrast meets **WCAG AA** (4.5:1 normal, 3:1 large text) as the floor.
- Color is never the ONLY carrier of meaning (add icon/label/pattern).
- Respect the theme: if the project supports dark mode, every new surface supports it.

## The five states of every view
Design them all before "done" — a view with only the happy path is half a view:
1. **Empty** — first-use/no-data: explain and point to the next action.
2. **Loading** — skeleton/spinner/progress; avoid layout shift when content lands.
3. **Error** — actionable message (what failed, what to do); never a dead end.
4. **Success/ideal** — the happy path.
5. **Partial** — long lists, truncation, pagination, offline/stale data where relevant.

## Feedback & interaction
- Every interactive element has visible hover/focus/active/disabled states.
- User actions get immediate feedback (<100ms perceived): pressed state, spinner,
  optimistic update, or toast.
- Destructive actions confirm or offer undo.
- Motion is purposeful and subtle; respect `prefers-reduced-motion`.

## Accessibility (floor, not ceiling)
- Semantic elements first (button, nav, label, heading order); ARIA only to fill gaps.
- Full keyboard operability; visible focus ring (never `outline: none` without a
  replacement).
- Images/icons that carry meaning have text alternatives; form fields have labels.
- Touch targets ≥ ~44px on touch surfaces.

## Responsiveness
- Follow the project's breakpoint strategy (mobile-first unless the project says
  otherwise); never fixed pixel layouts for flowing content.
- Test the extremes: narrow phone and wide desktop; no horizontal scroll of the page
  body; text scales without breaking layout.

## Consistency (reuse ladder for UI)
Before creating any visual element, climb: existing component → variant of an existing
component → composition of existing primitives → only then a new component styled with
existing tokens. A new component that duplicates an existing pattern is a review flag —
same philosophy as the code reuse ladder in `docs/ENGINEERING_STANDARDS.md`.

## Design review checklist (used by quality-gate on UI batches)
- [ ] Consistent with `docs/STACK.md` Visual language (tokens, components, theme)?
- [ ] All five view states handled?
- [ ] Contrast AA + keyboard/focus pass?
- [ ] Responsive at narrow and wide extremes?
- [ ] Interactive states (hover/focus/disabled) present?
- [ ] No one-off spacing/color/type values where tokens exist?
