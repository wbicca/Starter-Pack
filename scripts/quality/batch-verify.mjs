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
//
// Exit codes: 0 = PASS (possibly with warnings) · 1 = a configured command failed ·
// 2 = unconfigured-Test blocker (standard). Timeout per command via
// BATCH_VERIFY_TIMEOUT_MS (default 600000).
//
// Usage: node scripts/quality/batch-verify.mjs [--accept-unconfigured] [--range <ref>]
//   --range <ref>  diff <ref>...HEAD instead of the local working state (CI use).

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const ACCEPT_UNCONFIGURED = argv.includes("--accept-unconfigured");
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

function parseCommands(stack) {
  const rows = new Map();
  if (!stack) return rows;
  for (const line of stack.split("\n")) {
    const m = line.match(/^\|\s*([A-Za-z ]+?)\s*\|\s*(.*?)\s*\|\s*(.*?)\s*\|\s*$/);
    if (!m) continue;
    const purpose = m[1].trim();
    if (!RUNNABLE.includes(purpose)) continue;
    const command = m[2].trim();
    const status = m[3].trim();
    // Exact match: "UNCONFIGURED" contains "configured" as a substring — never /i-test loosely.
    const configured = /^configured$/i.test(status) && command !== "" && !/^tbd$/i.test(command);
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

function changedFiles() {
  if (RANGE) {
    const out = git(["diff", "--name-only", `${RANGE}...HEAD`]);
    return out === null ? null : out.split("\n").filter(Boolean);
  }
  const hasHead = git(["rev-parse", "--verify", "HEAD"]) !== null;
  const tracked = hasHead ? git(["diff", "--name-only", "HEAD"]) : git(["diff", "--name-only"]);
  if (tracked === null) return null;
  const untracked = git(["ls-files", "--others", "--exclude-standard"]) ?? "";
  return [...new Set((tracked + "\n" + untracked).split("\n").filter(Boolean))];
}

// keep in sync with .claude/hooks/orchestrator-write-guard.mjs (APP_EXTS)
const APP_EXT_RE = /\.(tsx?|jsx?|mjs|cjs|mts|cts|css|scss|vue|svelte|py|rb|go|java|sql|sh|html?)$/i;
const TEST_PATH_RE = /(^|\/)(__tests__|tests?|e2e)\/|\.(test|spec)\.[^./]+$/i;

// --- main ---------------------------------------------------------------------------
const stack = readStack();
const commands = parseCommands(stack);
const profile = readProfile(stack);
const warnings = [];
if (!stack) warnings.push("docs/STACK.md missing/unreadable — treating every command as not configured.");

const changed = changedFiles();
let appChanged = false;
let testChanged = false;
if (changed === null) {
  warnings.push("git unavailable — diff heuristics (app-code/test-change) skipped.");
} else {
  appChanged = changed.some((f) => APP_EXT_RE.test(f) && !TEST_PATH_RE.test(f));
  testChanged = changed.some((f) => TEST_PATH_RE.test(f));
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
  const r = spawnSync(row.command, { cwd: ROOT, shell: true, stdio: "inherit", timeout: TIMEOUT });
  if (r.status === 0) {
    results.push({ purpose, command: row.command, result: "PASS" });
  } else {
    commandFailed = true;
    const why = r.error ? `ERROR (${r.error.code ?? "spawn"})` : `FAIL (exit ${r.status})`;
    results.push({ purpose, command: row.command, result: why });
  }
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

// --- report --------------------------------------------------------------------------
err("");
err("| Command | Result |");
err("|---|---|");
for (const r of results) err(`| ${r.purpose}: \`${r.command}\` | ${r.result} |`);
for (const w of warnings) err(`WARNING: ${w}`);
if (blocker) err(`BLOCKER: ${blocker}`);

if (commandFailed) { err("\nbatch-verify: FAIL"); process.exit(1); }
if (blocker) { err("\nbatch-verify: FAIL (unconfigured Test on an app-code batch)"); process.exit(2); }
err(warnings.length ? "\nbatch-verify: PASS (with warnings)" : "\nbatch-verify: PASS");
process.exit(0);
