---
name: release-sanity
description: >
  Pre-release audit before publishing, tagging, or deploying — or when the user says "run
  release sanity" / "are we ready to ship".
---

# Release sanity

The final audit before publishing. Broader and stricter than `quality-gate`: it assumes
the code works and asks whether it is **safe to ship**.

## Steps
1. **Quality gate first.** Run the `quality-gate` skill (or its equivalent checklist):
   configured checks from `docs/STACK.md`, diff inspection, unexpected files, obvious
   secrets, real `.env` files. Carry its findings forward.
2. **Secret leakage** — scan the tree and diff for keys, tokens, private keys,
   credential-bearing URLs, and anything that should be an env var.
3. **Dangerous permissions** — world-writable files, over-broad scopes, executable bits
   that shouldn't be set.
4. **Destructive commands** — `rm -rf`, force resets, `git clean -fd`, unguarded
   migrations/drops in scripts or CI.
5. **Path traversal** — untrusted input flowing into file paths.
6. **Missing validation** — unvalidated input at trust boundaries (request bodies, params,
   external responses).
7. **Unsafe casts / unwraps** — forced unwraps, `as`/`any` casts, panics on external data
   (where the language applies).
8. **External assets & licenses** — confirm third-party assets have a recorded origin and
   license in `NOTICE.md` (or the asset log).
9. **Logs** — no PII or secrets in logs, traces, or analytics events.
10. **New dependencies** — each new dependency justified; flag unexplained additions.
11. **Hooks / permissions** — `.claude/hooks/**` and settings/permissions not weakened or
    changed improperly.
12. **security-auditor** — run it when sensitive flows exist (see `docs/CONSTITUTION.md`).

## Deliverable
- **Blockers** — must fix before release.
- **Risks** — should review; not strictly blocking.
- **Verdict** — **APPROVED** or **NOT APPROVED**, with the reason.
