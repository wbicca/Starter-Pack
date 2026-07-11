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
// BATCH_VERIFY_TIMEOUT_MS (default 600000); a timed-out command's whole process
// group is killed (no orphaned test/build workers).
//
// Diff-availability asymmetry (deliberate): --range mode (CI) FAILS CLOSED on a bad
// ref — CI must never silently skip the guard. Local mode FAILS OPEN when git is
// unavailable (warning, heuristics skipped) — a broken local git must not brick the
// gate the human is standing next to.
//
// Usage: node scripts/quality/batch-verify.mjs [--accept-unconfigured] [--range <ref>]
//   --range <ref>  diff <ref>...HEAD instead of the local working state (CI use).
//
// Trust model: STACK.md commands run with shell:true BY DESIGN — they are exactly what
// the gate is supposed to execute (compound commands need shell operators), STACK.md
// is project-owned, and quality-gate flags STACK diffs. Do not "harden" this into
// shell:false — it would break `a && b` commands without adding a real boundary.

import { spawn, spawnSync } from "node:child_process";
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

function changedFiles() {
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
  return [...new Set((tracked + "\n" + untracked).split("\n").filter(Boolean))];
}

// derived from .claude/hooks/orchestrator-write-guard.mjs (APP_EXTS) — anchored with $ and
// /i here on purpose; not byte-identical.
const APP_EXT_RE = /\.(tsx?|jsx?|mjs|cjs|mts|cts|css|scss|vue|svelte|py|rb|go|java|sql|sh|html?)$/i;
const TEST_PATH_RE = /(^|\/)(__tests__|tests?|e2e)\/|\.(test|spec)\.[^./]+$/i;

// --- main ---------------------------------------------------------------------------
const stack = readStack();
const warnings = [];
const commands = parseCommands(stack, warnings);
const profile = readProfile(stack);
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
