<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this protocol.
</SUBAGENT-STOP>

# Using skills

**The rule:** if there is even a 1% chance a skill applies to what you are about to do, you MUST invoke it with the Skill tool BEFORE any response or action — including clarifying questions. This is not optional and cannot be rationalized away. If an invoked skill turns out not to fit, set it aside.

**Instruction priority:**
1. User's explicit instructions (CLAUDE.md, AGENTS.md, direct requests) — highest.
2. Skills — override default behavior where they conflict.
3. Default system-prompt behavior — lowest.

**Using a skill:**
- Invoke via the Skill tool (never Read skill files directly).
- Announce: "Using [skill] to [purpose]", then follow the skill exactly; if it has a checklist, create one todo per item.
- **Rigid** skills (test-driven-development, systematic-debugging) are followed to the letter — never adapt away the discipline. **Flexible** skills adapt principles to context; the skill says which.
- When several apply: process skills (brainstorming, debugging) before implementation skills.

**Red flags — these thoughts are rationalizations; check skills first:**
- "This is simple / just a question / doesn't need a formal skill" — actions and questions are tasks; if a skill exists, use it.
- "I'll explore / gather context / do one thing first" — the skill check comes BEFORE anything else; skills tell you HOW.
- "I remember this skill" — skills evolve; invoke the current version.

For the full protocol and complete red-flag table, invoke the `using-superpowers` skill.
