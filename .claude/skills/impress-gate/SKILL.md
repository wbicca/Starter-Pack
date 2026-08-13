---
name: impress-gate
description: >
  Default-on visual quality gauntlet for UI batches: a fresh-context, read-only critic
  drives the REAL running app (Playwright), captures evidence, and only approves when
  genuinely impressed against an explicit rubric. Runs automatically after batch-verify
  passes on a batch that touches UI files (no ask needed); also on demand when the user
  says "run the impress gate" / "só aprova se impressionar". Skipping is the recorded
  exception, never the silent default.
---

# Impress gate — the critic must SEE it work

A gauntlet-style quality loop for work whose bar is graded, not binary (UI, flows,
visual polish). A **fresh-context critic** navigates the real rendered app, interacts,
captures screenshots and console errors, and returns `IMPRESSED` / `NOT IMPRESSED`
with the largest remaining gap. The builder fixes; the loop repeats — bounded.

**Scope and trigger:** UI/visible-flow batches only — and there it runs **by default**,
without being asked. The trigger is a **discipline rule the orchestrator upholds**, not a
hook-enforced invariant: `batch-verify` deterministically DETECTS the UI batch and prints
the verdict line on the close checklist, but nothing executes the gate for you — the
orchestrator does, prompted by that line (field evidence: opt-in steps are silently
abandoned, so the reminder lives where the execution happens). Skipping is
legitimate only for a trivial visual change (typo, copy) and the reason is recorded in
the DELIVERY_LOG entry. Backend/API keeps `batch-verify` as its bar. Never runs in CI.
Token-intensive by design — that is the trade for a real quality bar. The project can
opt out entirely in `docs/STACK.md` → Capabilities (`Visual quality gate: no`).

## Preconditions (never skip)

1. **`batch-verify` green first.** Aesthetics of broken code is not a judgment worth
   paying for. The impress gate is a layer ON TOP of the deterministic gate, never a
   substitute.
2. **A runnable app** — dev server or preview the critic can actually reach.
3. **Tooling present** — Playwright in the project, or the `webapp-testing` skill.
   If absent: **suggest the smallest install, ask the human once, record the approval
   in `docs/STACK.md` → Capabilities.** Never install silently (CONSTITUTION §1);
   never pull browser binaries in CI.

## The rubric ("impressed" is a checklist, not a feeling)

An unanchored judge drifts generous. The critic judges against, in order:

1. **The project's Visual language** (`docs/STACK.md`) — reference, tokens, theme.
2. **`docs/DESIGN_STANDARDS.md`** — the five view states · contrast AA · keyboard/
   focus · responsive extremes · interactive states · no one-off tokens.
3. **A concrete reference, when one exists** (screenshot or named product standard).
   Compare **blind** when possible: present the candidate and reference without
   labels and ask which is better and why.
4. **Delight margin** — beyond correct: is anything memorable? Would a demanding
   user say "this is well made"? Name what would impress more, even when approving.

## Protocol

1. **Dispatch the critic**: a READ-ONLY agent with fresh context (never the builder,
   never the orchestrator's window context). It receives: the batch's user-visible
   goal, the rubric above, the app URL, and the reference (if any). It must NOT see
   the diff — it judges the product, not the code.
2. **The critic interacts, not just looks**: navigate the flow end-to-end; provoke
   the five states (empty · loading · error · success · partial); resize to narrow
   phone and wide desktop; tab through with the keyboard; capture the console.
   Screenshots go to the session scratchpad (`/tmp` — the write-guard's scratch
   exemption covers read-only agents).
3. **Verdict, structured**:
   - `IMPRESSED` or `NOT IMPRESSED`;
   - the **largest remaining gap** (always — even on IMPRESSED);
   - evidence: screenshot paths, console errors, the states actually exercised;
   - one sentence: what would make it exceptional.
4. **Loop**: `NOT IMPRESSED` → the largest gap goes back to the implementer
   (goal-loop rules apply) → re-run the critic with fresh context. **Max 3 rounds.**
5. **Stop conditions** (whichever fires first): IMPRESSED · 3 rounds spent ·
   improvement no longer worth the cost → escalate to the human with the evidence
   and the open gap. The human's call is final; record it (DELIVERY_LOG entry).

## Anti-sycophancy rules (the gate's integrity)

- The critic **must name the largest gap even when approving** — an approval with no
  gap named is an invalid verdict; re-run it.
- Blind comparison whenever a reference exists.
- Fresh context every round — a critic that saw round 1 anchors on round 1.
- Evidence or it didn't happen: a verdict without screenshots/console capture is
  invalid.

## Deliverable

Report: verdict per round · largest gap per round · evidence paths · rounds used ·
final state (approved / escalated). The DELIVERY_LOG entry for the batch records the
verdict and rounds.
