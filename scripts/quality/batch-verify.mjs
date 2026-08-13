#!/usr/bin/env node
// batch-verify — deterministic batch verification (Development Gate, step 1).
// Reads docs/STACK.md (Commands table + Profile), runs the CONFIGURED non-mutating
// quality commands in order (Lint → Typecheck → Test → Build, fail-fast) and reports
// evidence: a command/result table on stderr + an exit code. The quality-gate skill
// and the project CI seed both call this script — one rail, local and remote.
//
// Policies:
//   * Format is deliberately EXCLUDED — formatters mutate files; a verifier never mutates.
//   * Unconfigured Test while the batch touches app code:
//       standard profile → exit 2 (blocker) unless --accept-unconfigured (human waiver);
//       light profile    → warning only.
//   * App code changed without any test change → warning (review signal, never blocks).
//   * Clean working tree with a committed branch → the app-code heuristics fall back
//     to the committed diff vs the default branch's merge-base (a fully committed
//     branch must not slip past the guard as "no changes").
//   * Zero configured commands while the batch touches app code → loud warning: a
//     PASS that executed nothing is not evidence.
//   * docs/DELIVERY_LOG.md older than the last commit → warning: the delivery-log
//     entry has no substitute (compares against the last commit of any kind, so
//     squash/rebase merges — single-parent — are not missed). On a PASS with a stale
//     log the script PRINTS a draft
//     entry; with --log it APPENDS the draft to the log for the human to edit (the
//     only mutation this verifier ever performs, and only on explicit opt-in — CI
//     never passes --log).
//   * On every PASS the script prints the batch-close checklist (the gate steps a
//     script cannot run: log entry, review, security, worktrees) — field evidence
//     showed the checklist only survives where the execution happens. A UI batch
//     (tsx/jsx/vue/svelte/css/scss/html in the diff) adds the impress-gate line:
//     the gate runs by default on UI batches; skipping requires a recorded reason.
//   * Sensitive-flow enforcement: docs/STACK.md → Capabilities may declare
//     `Sensitive paths:` globs (auth/RLS/payments/webhooks/fiscal/PII → real paths).
//     A batch touching one FAILS (exit 2, BOTH profiles — sensitive flows never
//     relax) unless a fresh security-auditor pass is recorded for the exact current
//     content of those files (per-file git-blob hash in .claude/.audit-log.jsonl,
//     written by scripts/quality/record-audit.mjs). --accept-audit-waiver downgrades
//     to a warning (human exception, reason in DELIVERY_LOG). In --range/CI mode the
//     gitignored audit log is invisible, so it warns instead of failing (a committed
//     CI signal is the v1.6.1 follow-up).
//
// Exit codes: 0 = PASS (possibly with warnings) · 1 = a configured command failed ·
// 2 = a blocker: unconfigured-Test (standard) OR a sensitive path without a fresh
// security-auditor record. Timeout per command via BATCH_VERIFY_TIMEOUT_MS
// (default 600000); a timed-out command's whole process group is killed.
//
// Diff-availability asymmetry (deliberate): --range mode (CI) FAILS CLOSED on a bad
// ref — CI must never silently skip the guard. Local mode FAILS OPEN when git is
// unavailable (warning, heuristics skipped) — a broken local git must not brick the
// gate the human is standing next to.
//
// Usage: node scripts/quality/batch-verify.mjs [--accept-unconfigured] [--accept-audit-waiver]
//                                              [--range <ref>] [--log]
//   --range <ref>          diff <ref>...HEAD instead of the local working state (CI use).
//   --log                  append the drafted DELIVERY_LOG entry (local close; never CI).
//   --accept-audit-waiver  human-approved exception to the sensitive-flow audit gate.
//
// Trust model: STACK.md commands run with shell:true BY DESIGN — they are exactly what
// the gate is supposed to execute (compound commands need shell operators), STACK.md
// is project-owned, and quality-gate flags STACK diffs. Do not "harden" this into
// shell:false — it would break `a && b` commands without adding a real boundary.

import { spawn, spawnSync } from "node:child_process";
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const ACCEPT_UNCONFIGURED = argv.includes("--accept-unconfigured");
const ACCEPT_AUDIT_WAIVER = argv.includes("--accept-audit-waiver");
const APPEND_LOG = argv.includes("--log");
const rangeIdx = argv.indexOf("--range");
const RANGE = rangeIdx !== -1 ? argv[rangeIdx + 1] : null;
if (rangeIdx !== -1 && !RANGE) {
  process.stderr.write("batch-verify: --range requires a <ref> argument\n");
  process.exit(1);
}
const TIMEOUT = Number(process.env.BATCH_VERIFY_TIMEOUT_MS) || 600_000;

const err = (s) => process.stderr.write(s + "\n");

// --- docs/STACK.md: Commands table + Profile --------------------------------------
// Format excluded on purpose (see header). Order = execution order.
const RUNNABLE = ["Lint", "Typecheck", "Test", "Build"];

function readStack() {
  try { return readFileSync(join(ROOT, "docs", "STACK.md"), "utf8"); } catch { return null; }
}

// Strip markdown emphasis/code-span artifacts (`cmd`, **cmd**) that reviewers commonly
// add around a cell's content, so a well-formed-but-decorated row still parses.
function stripMdArtifacts(s) {
  return s.trim().replace(/^`+|`+$/g, "").replace(/^\*+|\*+$/g, "").trim();
}

function parseCommands(stack, warnings) {
  const rows = new Map();
  if (!stack) return rows;
  for (const line of stack.split(/\r?\n/)) {
    // Cell-split parse: first cell = Purpose, LAST cell = Status, everything between
    // joins back as the Command — so a literal `|` inside the command (pipes) never
    // spills into the Status column. A trailing extra cell (a note) lands in Status
    // and surfaces the not-CONFIGURED warning below instead of silently dropping.
    if (!/^\|.*\|\s*$/.test(line)) continue;
    const cells = line.split("|");
    if (cells.length < 4) continue; // needs at least | Purpose | Command | Status |
    const purpose = cells[1].trim();
    if (!RUNNABLE.includes(purpose)) continue;
    const command = stripMdArtifacts(cells.slice(2, -2).join("|"));
    const status = stripMdArtifacts(cells[cells.length - 2]);
    // Exact match: "UNCONFIGURED" contains "configured" as a substring — never /i-test loosely.
    const isTbd = command === "" || /^tbd$/i.test(command);
    const configured = /^configured$/i.test(status) && !isTbd;
    if (!configured && !isTbd && warnings) {
      warnings.push(`docs/STACK.md row for ${purpose} has a command but its Status was not ` +
        "recognized as CONFIGURED — check the row's formatting (extra columns / markdown).");
    }
    rows.set(purpose, { command, configured });
  }
  return rows;
}

// keep in sync with .claude/hooks/orchestrator-write-guard.mjs (readProfile)
function readProfile(stack) {
  if (!stack) return "standard";
  const m = stack.match(/Profile:\s*\**\s*(standard|light)\b/i);
  return m ? m[1].toLowerCase() : "standard";
}

// --- batch diff (app-code / test-change heuristics) --------------------------------
function git(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", timeout: 15_000 });
  if (r.error || r.status !== 0) return null;
  return r.stdout;
}

function changedFiles(warnings) {
  if (RANGE) {
    const out = git(["diff", "--name-only", `${RANGE}...HEAD`]);
    if (out === null) {
      err(`batch-verify: --range ref '${RANGE}' could not be diffed — bad ref or shallow ` +
        "clone (fetch the base branch history, e.g. fetch-depth: 0). Failing closed.");
      process.exit(1);
    }
    return out.split("\n").filter(Boolean);
  }
  const hasHead = git(["rev-parse", "--verify", "HEAD"]) !== null;
  const tracked = hasHead ? git(["diff", "--name-only", "HEAD"]) : git(["diff", "--name-only"]);
  if (tracked === null) return null;
  const untracked = git(["ls-files", "--others", "--exclude-standard"]) ?? "";
  const files = [...new Set((tracked + "\n" + untracked).split("\n").filter(Boolean))];
  if (files.length > 0 || !hasHead) return files;
  // Committed-branch blind spot: a fully committed branch has an empty working
  // diff, so the app-code heuristics saw nothing and the gate could report PASS
  // while executing nothing. Fall back to the committed diff vs the default
  // branch's merge-base (first candidate ref that resolves and is not HEAD).
  const headSha = (git(["rev-parse", "HEAD"]) ?? "").trim();
  for (const ref of ["origin/main", "origin/master", "main", "master"]) {
    if (git(["rev-parse", "--verify", ref]) === null) continue;
    const mb = (git(["merge-base", ref, "HEAD"]) ?? "").trim();
    if (!mb || mb === headSha) continue;
    const out = git(["diff", "--name-only", mb, "HEAD"]);
    if (out === null) continue;
    const branchFiles = out.split("\n").filter(Boolean);
    if (branchFiles.length) {
      warnings.push(`working tree clean — evaluated committed branch diff vs ${ref} (merge-base).`);
      return branchFiles;
    }
  }
  return files;
}

// derived from .claude/hooks/orchestrator-write-guard.mjs (APP_EXTS) — anchored with $ and
// /i here on purpose; not byte-identical.
const APP_EXT_RE = /\.(tsx?|jsx?|mjs|cjs|mts|cts|css|scss|vue|svelte|py|rb|go|java|sql|sh|html?|rs|php|kts?|c|h|cpp|cc|hpp|cs|swift)$/i;
const TEST_PATH_RE = /(^|\/)(__tests__|tests?|e2e)\/|\.(test|spec)\.[^./]+$/i;

// --- sensitive-flow enforcement (kept in sync with record-audit.mjs) ----------------
// docs/STACK.md → Capabilities may declare `Sensitive paths:` as comma-separated globs
// mapping the CONSTITUTION's sensitive flows (auth · RLS · payments · webhooks · fiscal
// · PII) to this project's real paths. A batch touching one of them must carry a
// recorded security-auditor pass (.claude/.audit-log.jsonl, per-file content hash) or
// the gate FAILS (exit 2) — in BOTH profiles: sensitive flows never relax.
function sensitiveGlobs(stack) {
  if (!stack) return [];
  const m = stack.match(/^[-*]?\s*Sensitive paths:\s*(.+)$/mi);
  if (!m) return [];
  return m[1].split(",").map((s) => s.trim().replace(/^`|`$/g, ""))
    .filter((s) => s && !/^(n\/a|none|tbd|<.*>)$/i.test(s));
}
function globToRe(glob) {
  let re = "";
  for (let i = 0; i < glob.length; i++) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") { re += ".*"; i++; if (glob[i + 1] === "/") i++; }
      else re += "[^/]*";
    } else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp("^" + re + "$");
}
function hashOf(file) {
  const h = git(["hash-object", "--", file]);
  return h ? h.trim() : null;
}
// An audit entry covers a file iff it lists that path with the CURRENT content hash.
function auditedHashes() {
  const covered = new Map(); // path -> Set(hashes recorded)
  let raw;
  try { raw = readFileSync(join(ROOT, ".claude", ".audit-log.jsonl"), "utf8"); } catch { return covered; }
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (!e || typeof e.files !== "object" || !e.files) continue;
    for (const [p, h] of Object.entries(e.files)) {
      if (!covered.has(p)) covered.set(p, new Set());
      covered.get(p).add(h);
    }
  }
  return covered;
}

// --- main ---------------------------------------------------------------------------
const stack = readStack();
const warnings = [];
const commands = parseCommands(stack, warnings);
const profile = readProfile(stack);
if (!stack) warnings.push("docs/STACK.md missing/unreadable — treating every command as not configured.");

// UI surface (matches the quality-gate design-check set): a batch touching these
// triggers the impress-gate line in the close checklist and the log draft.
const UI_EXT_RE = /\.(tsx|jsx|vue|svelte|css|scss|html?)$/i;

const changed = changedFiles(warnings);
let appChanged = false;
let testChanged = false;
let uiChanged = false;
let sensitiveChanged = [];
if (changed === null) {
  warnings.push("git unavailable — diff heuristics (app-code/test-change) skipped.");
} else {
  appChanged = changed.some((f) => APP_EXT_RE.test(f) && !TEST_PATH_RE.test(f));
  testChanged = changed.some((f) => TEST_PATH_RE.test(f));
  uiChanged = changed.some((f) => UI_EXT_RE.test(f) && !TEST_PATH_RE.test(f));
  const sglobs = sensitiveGlobs(stack).map(globToRe);
  if (sglobs.length) sensitiveChanged = changed.filter((f) => sglobs.some((re) => re.test(f)));
}

// Run one STACK command. `detached` puts the shell in its own process group on POSIX
// so a timeout can kill the WHOLE group — spawnSync's timeout only reached the shell,
// leaving test/build grandchildren running as orphans. Windows has no process groups:
// best-effort child.kill there (batch-verify remains usable, reaping is POSIX-only).
function runCommand(command) {
  return new Promise((res) => {
    let timedOut = false;
    const child = spawn(command, {
      cwd: ROOT, shell: true, stdio: "inherit", detached: process.platform !== "win32",
    });
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        if (process.platform !== "win32") process.kill(-child.pid, "SIGKILL");
        else child.kill("SIGKILL");
      } catch { try { child.kill("SIGKILL"); } catch { /* already gone */ } }
    }, TIMEOUT);
    child.on("error", (e) => { clearTimeout(timer); res({ ok: false, why: `ERROR (${e.code ?? "spawn"})` }); });
    child.on("exit", (status, signal) => {
      clearTimeout(timer);
      if (timedOut) res({ ok: false, why: `TIMEOUT (${TIMEOUT}ms — process group killed)` });
      else if (status === null) res({ ok: false, why: `FAIL (killed by ${signal ?? "signal"})` });
      else res({ ok: status === 0, why: status === 0 ? "PASS" : `FAIL (exit ${status})` });
    });
  });
}

const results = [];
let commandFailed = false;
for (const purpose of RUNNABLE) {
  const row = commands.get(purpose);
  if (!row || !row.configured) {
    results.push({ purpose, command: row?.command || "—", result: "NOT CONFIGURED" });
    continue;
  }
  if (commandFailed) {
    results.push({ purpose, command: row.command, result: "NOT RUN (fail-fast)" });
    continue;
  }
  err(`batch-verify: running ${purpose}: ${row.command}`);
  const r = await runCommand(row.command);
  if (!r.ok) commandFailed = true;
  results.push({ purpose, command: row.command, result: r.why });
}

// A PASS that executed nothing is not evidence — say so loudly when the batch
// touches app code (or the diff could not be computed at all).
const anyConfigured = RUNNABLE.some((p) => commands.get(p)?.configured === true);
if (!anyConfigured && (appChanged || changed === null)) {
  warnings.push("no configured command was executed — this PASS verified nothing; " +
    "fill the docs/STACK.md Commands table (a PASS with zero commands is not evidence).");
}

// Unconfigured-Test policy (only when the batch touches app code).
const testConfigured = commands.get("Test")?.configured === true;
let blocker = null;
if (!testConfigured && appChanged) {
  const base = "Test command is UNCONFIGURED in docs/STACK.md and this batch touches app code.";
  if (profile === "standard" && !ACCEPT_UNCONFIGURED) {
    blocker = base + " Configure the Test command, or rerun with --accept-unconfigured " +
      "(human decision — record the waiver in docs/DELIVERY_LOG.md).";
  } else if (ACCEPT_UNCONFIGURED) {
    warnings.push(base + " (waived via --accept-unconfigured — record it in docs/DELIVERY_LOG.md)");
  } else {
    warnings.push(base + " (light profile — warning only)");
  }
}

// Review signal: app code changed but no test file changed. Never blocks.
if (appChanged && !testChanged) {
  warnings.push("app code changed without any test change — review signal (docs/ENGINEERING_STANDARDS.md), not a blocker.");
}

// Sensitive-flow enforcement: a batch touching a declared sensitive path must carry a
// recorded, still-fresh security-auditor pass (per-file content hash). Applies in BOTH
// profiles — the CONSTITUTION says sensitive flows never relax. This is the rite→script
// move for the last prose checklist item (record via scripts/quality/record-audit.mjs).
let auditBlocker = null;
if (sensitiveChanged.length) {
  const covered = auditedHashes();
  const unaudited = sensitiveChanged.filter((f) => {
    const h = hashOf(f);
    return !h || !covered.get(f)?.has(h);
  });
  if (unaudited.length) {
    const list = unaudited.slice(0, 5).join(", ") + (unaudited.length > 5 ? ` (+${unaudited.length - 5} more)` : "");
    const base = `batch touches sensitive path(s) with no fresh security-auditor record: ${list}.`;
    if (RANGE) {
      // CI cannot see the gitignored local audit log — surface, don't fail (the local
      // gate is the enforcement point; a committed CI signal is the v1.6.1 follow-up).
      warnings.push(base + " (CI/--range: cannot see the local audit log — enforced locally; verify the audit happened before merge)");
    } else if (ACCEPT_AUDIT_WAIVER) {
      warnings.push(base + " (waived via --accept-audit-waiver — record the reason in docs/DELIVERY_LOG.md)");
    } else {
      auditBlocker = base + " Dispatch security-auditor, then record it: " +
        "node scripts/quality/record-audit.mjs --verdict clear  (or rerun with " +
        "--accept-audit-waiver for a human-approved exception, reason in docs/DELIVERY_LOG.md).";
    }
  }
}

// Delivery-log staleness: the DELIVERY_LOG entry has no substitute. When the log
// exists but is older than the last merge, batches likely closed without their
// entry — surface it every run (a warning: the fix is a doc append, never a block).
const LOG_PATH = join(ROOT, "docs", "DELIVERY_LOG.md");
const logExists = existsSync(LOG_PATH);
let logStale = false;
if (logExists) {
  const logT = Number((git(["log", "-1", "--format=%ct", "--", "docs/DELIVERY_LOG.md"]) ?? "").trim());
  // Compare against the last commit of ANY kind, not just merges: a squash/rebase
  // merge lands as a single-parent commit, so `--merges` was empty and the staleness
  // check silently never fired for the default GitHub flow (round-3 gauntlet finding).
  const headT = Number((git(["log", "-1", "--format=%ct"]) ?? "").trim());
  if (Number.isFinite(logT) && Number.isFinite(headT) && logT > 0 && headT > logT) {
    logStale = true;
    warnings.push("docs/DELIVERY_LOG.md is older than the last commit — batches may be " +
      "missing their delivery-log entry (the entry has no substitute).");
  }
}

// Draft DELIVERY_LOG entry — generated from git + the command results so closing the
// batch is an edit, not a from-scratch write (field evidence: as a purely manual step
// the entry happened in 4 of 26 batches). Human edits the TODO before committing.
function draftLogEntry(results) {
  const today = new Date().toISOString().slice(0, 10);
  const head = (git(["rev-parse", "--short", "HEAD"]) ?? "").trim() || "TBD";
  const logSha = (git(["log", "-1", "--format=%H", "--", "docs/DELIVERY_LOG.md"]) ?? "").trim();
  // What shipped = commit subjects since the log's last commit (unlogged batches).
  // Any commit, not just merges (squash/rebase are single-parent). Sanitize each
  // subject so a crafted commit message cannot forge markdown headings/list items in
  // the drafted entry (defense in depth — the human still edits before committing).
  const clean = (s) => s.replace(/^[\s#>*-]+/, "").replace(/[`|]/g, "").trim();
  let shipped = (logSha ? (git(["log", `${logSha}..HEAD`, "--no-merges", "--format=%s"]) ?? "") : "")
    .split("\n").filter(Boolean).slice(0, 10).map(clean).filter(Boolean);
  if (!shipped.length) shipped = [(clean((git(["log", "-1", "--format=%s"]) ?? "").trim()) || "TBD")];
  const validation = results.map((r) => `${r.purpose}: ${r.result}`).join(" · ");
  return [
    `### ${today} — batch close (draft by batch-verify — edit before committing)`,
    ...shipped.map((s) => `- **Shipped:** ${s}`),
    `- **Validation:** ${validation}`,
    `- **Review/approval:** TODO (who reviewed · human approval)`,
    // UI batch: the impress-gate runs by default — record its verdict, or the
    // recorded reason for skipping (a trivial visual change).
    ...(uiChanged ? [`- **Impress:** TODO (verdict · rounds — or the recorded skip reason)`] : []),
    // Sensitive batch: record the security-auditor verdict (or the waiver reason).
    ...(sensitiveChanged.length ? [`- **Security-audit:** TODO (security-auditor verdict — or the recorded waiver reason)`] : []),
    `- **Commit:** ${head}`,
    "",
  ].join("\n");
}

// --- report --------------------------------------------------------------------------
err("");
err("| Command | Result |");
err("|---|---|");
for (const r of results) err(`| ${r.purpose}: \`${r.command}\` | ${r.result} |`);
for (const w of warnings) err(`WARNING: ${w}`);
if (blocker) err(`BLOCKER: ${blocker}`);
if (auditBlocker) err(`BLOCKER: ${auditBlocker}`);

if (commandFailed) { err("\nbatch-verify: FAIL"); process.exit(1); }
if (blocker) { err("\nbatch-verify: FAIL (unconfigured Test on an app-code batch)"); process.exit(2); }
if (auditBlocker) { err("\nbatch-verify: FAIL (sensitive path without a fresh security-auditor record)"); process.exit(2); }

// PASS path: draft the DELIVERY_LOG entry (print when stale; append on --log) and
// print the batch-close checklist — the gate steps a script cannot run.
if (APPEND_LOG && !logExists) {
  err("\nbatch-verify: --log had no effect — docs/DELIVERY_LOG.md does not exist " +
    "(the project keeps no delivery log, or create it first).");
}
if (logExists && (APPEND_LOG || logStale)) {
  const draft = draftLogEntry(results);
  if (APPEND_LOG) {
    try {
      appendFileSync(LOG_PATH, "\n" + draft);
      err("\nbatch-verify: draft entry appended to docs/DELIVERY_LOG.md — edit the TODO before committing.");
    } catch (e) {
      err(`\nbatch-verify: could not append to docs/DELIVERY_LOG.md (${e.code ?? "error"}) — draft below:\n${draft}`);
    }
  } else {
    err("\nDraft DELIVERY_LOG entry (append with --log):\n" + draft);
  }
}
err("");
err("Batch close checklist (steps this script cannot run):");
err("  [ ] DELIVERY_LOG entry appended — no substitute (use --log for a draft)");
err("  [ ] code review dispatched (non-trivial batch)");
if (sensitiveChanged.length) {
  // Reaching PASS means every sensitive file is audited (or the waiver was accepted).
  err("  [x] security-auditor ENFORCED — sensitive path(s) carry a fresh recorded audit (or an accepted waiver)");
} else {
  err("  [ ] security-auditor dispatched (sensitive flow — see docs/CONSTITUTION.md; declare Sensitive paths in docs/STACK.md to enforce)");
}
err("  [ ] agent worktrees consolidated or removed (git worktree list)");
if (uiChanged) {
  err("  [ ] impress-gate verdict recorded (UI batch detected — runs by default; skipping requires a recorded reason)");
}

err(warnings.length ? "\nbatch-verify: PASS (with warnings)" : "\nbatch-verify: PASS");
process.exit(0);
