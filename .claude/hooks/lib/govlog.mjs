#!/usr/bin/env node
// Append-only governance event log — .claude/.governance-log.jsonl (gitignored).
//
// Hooks append one JSON line per ASK / DENY / BLOCK / fresh-WARN decision so audits
// (starter-feedback) read exact counts instead of grepping transcripts — the 2026-08
// field report documented self-reference contamination, a silently-truncated count,
// and a [NOT VERIFIABLE] exactly where it mattered (which tool fired each ASK).
//
// Contract: PATHS AND CODES ONLY — never file content, never a secret value.
// Logging is best-effort and must never block a hook decision.

import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export function logEvent(root, event) {
  try {
    if (!root) return;
    const dir = path.join(root, ".claude");
    mkdirSync(dir, { recursive: true });
    appendFileSync(
      path.join(dir, ".governance-log.jsonl"),
      JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n",
    );
  } catch { /* logging never blocks */ }
}
