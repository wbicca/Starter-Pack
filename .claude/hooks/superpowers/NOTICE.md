# Superpowers — vendored into this template

The 14 skills under `.claude/skills/` listed below, plus the hook scripts in this
folder, are vendored (copied) from the **Superpowers** plugin so this template is
self-contained — anyone who clones the repo gets the skills without installing the
plugin.

- **Upstream:** https://github.com/obra/superpowers
- **Version vendored:** 5.1.0
- **License:** MIT (see `LICENSE` in this folder)
- **Author:** Jesse Vincent

## Vendored skills (`.claude/skills/`)

brainstorming · dispatching-parallel-agents · executing-plans ·
finishing-a-development-branch · receiving-code-review · requesting-code-review ·
subagent-driven-development · systematic-debugging · test-driven-development ·
using-git-worktrees · using-superpowers · verification-before-completion ·
writing-plans · writing-skills

## Why the plugin is disabled for this project

`.claude/settings.json` sets `"superpowers@claude-plugins-official": false` to
override any global enablement. This guarantees a **single source of truth** (the
vendored copy) and avoids the same skills loading twice (once via plugin, once
vendored).

## Updating

These files are a point-in-time copy. To refresh to a newer Superpowers release,
re-copy `skills/` and `hooks/` from the upstream plugin and bump the version above.
`hooks/session-start` was adapted for project use (path + output format) — re-apply
those two edits after re-copying. See the header comment in that file.
