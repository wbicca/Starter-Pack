---
name: skill-discovery
description: >
  Discover, evaluate, and recommend internal or external skills/plugins that could help
  with a task — WITHOUT installing anything. Use whenever the user asks "is there a skill
  for X", "find a skill", "what could help me do Y", wonders whether to add a plugin, or
  hits a capability gap and you're tempted to reach for an external tool. Always run this
  before adding any new skill: it checks whether BMAD, Superpowers, or the BRX agents
  already cover the need, then recommends at most 3 options classified by how (if at all)
  to adopt them. It only advises — installation, vendoring, and making anything mandatory
  are human decisions made elsewhere.
---

# Skill Discovery

Help the orchestrator make a *governed* decision about extending capabilities. The
default answer is often "you already have this" — surfacing that saves tokens, avoids
duplication, and keeps the starter self-contained.

## Objective
Turn a capability gap into a short, honest recommendation: what could fill it, whether
it's even needed, and — if it is — the least-invasive way to adopt it. You never install,
vendor, or enable anything yourself.

## When to use
- The user asks whether a skill/plugin exists for a need, or how to extend capabilities.
- You catch yourself wanting an external tool to finish a task.
- Someone proposes adding/vendoring a skill or enabling a global plugin.

## When NOT to use
- The task is already doable with current tools/agents — just do it.
- The user explicitly approved a specific install already — that's an orchestrator action,
  not discovery. (If approved, the orchestrator may use the global `find-skills` skill or
  another suitable method to actually install.)

## Process
1. **Restate the need** in one sentence — the concrete capability, not the tool name.
2. **Check what already exists FIRST.** Does BMAD, Superpowers, an existing `.claude/skills`
   skill, or a BRX agent (`AGENTS.md`) already cover this? If yes → recommend **não instalar**
   and point to the canonical path. Stop here.
3. **If genuinely uncovered**, find up to **3** candidate options (internal or external).
4. **Evaluate** each against the criteria below.
5. **Classify** each option (see categories).
6. **Require approval.** Present the recommendation and stop. Do not install, vendor, enable
   a global plugin, or make anything mandatory.

## Evaluation criteria (ask these of every candidate)
- Does it resolve a *real* gap?
- Does it duplicate BMAD/Superpowers/BRX agents?
- Is the source trustworthy?
- Is it small and specific (vs. a sprawling dependency)?
- Does it require dangerous permissions?
- Could it expose or require secrets?
- Is it worth the ongoing maintenance cost?
- Can it stay optional?

## Classification (pick one per option)
- **não instalar** — already covered, or not worth it.
- **usar como opcional** — useful enhancement; reference it as optional, never required.
- **instalar como plugin pessoal/global** — experimental/individual; belongs in the user's
  global setup, NOT in the starter.
- **vendorizar no projeto** — essential to the BRX standard; copy in-repo — only after approval.
- **criar skill própria** — the need is BRX-specific; author a dedicated skill instead.

## Response format
Lead with the headline (often "already covered — recommend installing nothing"). Then, for
each option (max 3):

```
### Option N — <name> (<source>)
- Gap it fills:
- Duplicates BMAD/Superpowers? :
- Security risk:
- Maintenance risk:
- Context/token impact:
- Works without secrets? :
- Optional or vendored? :
- → Recommended classification: <one of the 5>
```

End with a single clear recommendation and an explicit ask: "Want me to proceed with X?
Nothing is installed until you approve."

## Blocking rules (never cross without explicit human approval)
- Never install a skill automatically.
- Never vendor a skill into `.claude/skills`.
- Never enable a global plugin.
- Never make an external skill mandatory.
If approved, installation is carried out by the orchestrator (e.g. via the global
`find-skills` skill or another method) — not by this skill.

## Final checklist
- [ ] Restated the real need.
- [ ] Checked BMAD / Superpowers / existing skills / BRX agents first.
- [ ] ≤ 3 options, each evaluated against all criteria.
- [ ] Each option classified into one of the 5 categories.
- [ ] Nothing installed/vendored/enabled; ended with an approval request.
