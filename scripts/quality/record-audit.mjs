#!/usr/bin/env node
// record-audit — the orchestrator records a passing security-auditor review of the
// sensitive files in the current batch, so batch-verify can ENFORCE (not just print a
// checklist line) that sensitive flows were audited. This closes the last item of the
// batch-close checklist that was still prose — the same rite→script move the template
// already made for DELIVERY_LOG, quality-gate, and impress-gate.
//
// The security-auditor subagent is READ-ONLY and cannot write its own record — by
// design: the ORCHESTRATOR runs this after receiving the auditor's "clear" verdict.
// This is a NAMED script (not an interpreter one-liner or a redirect), so the
// orchestrator-write-guard lets it run; it appends to .claude/.audit-log.jsonl
// (gitignored, paths + content-hashes only, never file content).
//
// Freshness is per-file CONTENT hash (git hash-object): any later edit to a sensitive
// file changes its hash and invalidates this record, forcing a re-audit — robust to
// both commits and uncommitted working-tree edits.
//
// Usage:
//   node scripts/quality/record-audit.mjs --verdict clear [--auditor security-auditor]
//         [--files a.ts,b.sql]   (default: the sensitive files currently changed)
//         [--note "..."]
//
// Exit: 0 recorded · 1 usage/error · 3 nothing sensitive to record (informational).

import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const argv = process.argv.slice(2);
function flag(name) { const i = argv.indexOf(name); return i !== -1 ? argv[i + 1] : null; }

const verdict = flag("--verdict");
const auditor = flag("--auditor") || "security-auditor";
const note = flag("--note") || "";
const filesArg = flag("--files");

if (!verdict) {
  process.stderr.write("record-audit: --verdict is required (e.g. --verdict clear)\n");
  process.exit(1);
}

function git(args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8", timeout: 15_000 });
  if (r.error || r.status !== 0) return null;
  return r.stdout;
}

// --- shared sensitive-path helpers (kept in sync with batch-verify.mjs) -------------
function readStack() {
  try { return readFileSync(join(ROOT, "docs", "STACK.md"), "utf8"); } catch { return null; }
}
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
function changedFiles() {
  const hasHead = git(["rev-parse", "--verify", "HEAD"]) !== null;
  const tracked = hasHead ? git(["diff", "--name-only", "HEAD"]) : git(["diff", "--name-only"]);
  const untracked = git(["ls-files", "--others", "--exclude-standard"]) ?? "";
  return [...new Set(((tracked ?? "") + "\n" + untracked).split("\n").filter(Boolean))];
}
function hashOf(file) {
  const h = git(["hash-object", "--", file]);
  return h ? h.trim() : null;
}

// --- resolve which files this audit covers ------------------------------------------
const globs = sensitiveGlobs(readStack()).map(globToRe);
let files;
if (filesArg) {
  files = filesArg.split(",").map((s) => s.trim()).filter(Boolean);
} else {
  files = changedFiles().filter((f) => globs.some((re) => re.test(f)));
}
if (!files.length) {
  process.stderr.write("record-audit: no sensitive files to record (nothing changed matches " +
    "docs/STACK.md 'Sensitive paths', or none declared). Nothing recorded.\n");
  process.exit(3);
}

const fileHashes = {};
for (const f of files) {
  const h = hashOf(f);
  if (h) fileHashes[f] = h;
}
if (!Object.keys(fileHashes).length) {
  process.stderr.write("record-audit: could not hash any of the given files (git unavailable / bad paths).\n");
  process.exit(1);
}

const head = (git(["rev-parse", "HEAD"]) ?? "").trim() || null;
const entry = {
  ts: new Date().toISOString(),
  auditor, verdict, head, note,
  files: fileHashes, // { path: git-blob-hash }
};

try {
  mkdirSync(join(ROOT, ".claude"), { recursive: true });
  appendFileSync(join(ROOT, ".claude", ".audit-log.jsonl"), JSON.stringify(entry) + "\n");
} catch (e) {
  process.stderr.write(`record-audit: could not write .claude/.audit-log.jsonl (${e.code ?? "error"}).\n`);
  process.exit(1);
}

process.stderr.write(`record-audit: recorded ${auditor} verdict '${verdict}' for ${Object.keys(fileHashes).length} ` +
  `sensitive file(s). batch-verify will treat them as audited until they change.\n`);
process.exit(0);
