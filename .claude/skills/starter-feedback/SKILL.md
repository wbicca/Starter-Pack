---
name: starter-feedback
description: Generate an evidence-based usage report of the Starter Pack in the current project. Use at the end of an epic or milestone, or when the user says "starter feedback" or "como está o uso do starter".
---

# Starter Feedback — evidence-based usage audit

Produce an adversarial, evidence-backed report on how the Starter Pack actually performed
in this project. The report's value is what it finds **wrong** — a report that only
praises the template is a failed report.

## 1. Read-only rule

- Fix **nothing**. This skill observes and reports; it never repairs.
- Never edit anything under `.claude/**` (or any other governance path).
- Every claim must cite evidence: a file path, a git command output, or a transcript hit.
- If a claim cannot be verified from evidence, mark it **[NOT VERIFIABLE]** — do not guess.

## 2. Evidence method

Collect before writing anything:

- **Git**: `git log --oneline`, `git worktree list`, `git status` — batch cadence, commit
  hashes returned by agents, leftover worktrees.
- **Project docs** (`docs/`):
  - `STACK.md` honesty — do Status / Commands / Capabilities match reality (installed
    deps, scripts, actual stack)?
  - `DELIVERY_LOG.md` — one entry per batch? (what shipped · validation · review · commit)
  - `DECISIONS.md` — were real decisions recorded?
- **Checks**: run the `docs/STACK.md` test command if one is configured; run
  `node scripts/quality/starter-doctor.mjs` and `node scripts/quality/quick-check.mjs`
  and record their output.
- **Transcripts**: find the project's transcript dir under `$CLAUDE_CONFIG_DIR/projects/`
  (fall back to `~/.claude/projects/`). The slug is the absolute project path with `/`
  and spaces replaced by `-`. **GREP the `*.jsonl` files — never read them whole**:
  - `"name":"Skill"` — which skills were actually invoked;
  - `"name":"Task"` / `"name":"Agent"` + `subagent_type` — delegation and routing;
  - `ORCHESTRATOR_WRITE_*|GOVERNANCE_WRITE|READ_ONLY_MUTATION|QUICK_CHECK` — write-guard
    signals (`ORCHESTRATOR_WRITE_*` matches both the legacy `DENIED` in older transcripts
    and the current `ASK`) and other hook signals;
  - `worktree` — isolation usage.
- **Known limit**: subagent-internal tool calls do not appear in the main-window
  transcript — state this limit wherever it caps a finding's confidence.

## 3. Report sections (exactly these, in order)

1. **Project summary** — what was built, over which period, how many sessions/batches.
2. **Routing audit** — table: step → what the contract expected (AGENTS.md routing) →
   what actually happened (evidence) → ✅/⚠️/❌.
3. **Contract compliance** — approval gate honored? one batch at a time? worktrees for
   medium/large work? agents returned commit hashes? consolidation by cherry-pick or
   hand-apply? DELIVERY_LOG kept per batch?
4. **Hook friction** — every deny/ask encountered: true positive or false positive, and
   how it was resolved.
5. **Doc quality** — invented facts vs honest TBDs; did STACK.md follow its lifecycle
   (UNCONFIGURED → filled at onboarding → updated)?
6. **Cost/weight perceived** — where the starter helped vs where it was overhead
   (extra hops, redundant gates, prompts fighting the contract).
7. **Top 5 frictions** — ranked, each with evidence and a **concrete template
   improvement** (what to change in which file).
8. **Verdict** — one paragraph: would this project have gone better or worse without
   the starter, and why.

## 4. Output

- Save the report to `docs/STARTER_FEEDBACK.md` with a versioned header: date + the
  template version from the root `VERSION` file.
- Print a short summary in the conversation (language of the conversation).
- Be adversarial: prefer surfacing an uncomfortable, well-evidenced friction over a
  polite generality. The report feeds template maintenance — findings must be actionable.
