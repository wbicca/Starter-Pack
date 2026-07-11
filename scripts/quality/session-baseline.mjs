#!/usr/bin/env node
// SessionStart hook (startup only) — snapshot of pre-existing quick-check findings.
//
// Records which quick-check issues ALREADY exist when the session starts, so
// quick-check can report them as "pre-existing (before this session)" warnings
// instead of blocking completion on problems this session did not create.
// Writes .claude/.quick-check-baseline.json (overwritten on every session start):
//   { whitespaceFiles, conflictFiles, envTracked, secretFiles, lastWarningsHash }
// File PATHS only — secret values are never recorded.
//
// Residual limitation: a NEW session re-baselines, so issues introduced in one
// session become "pre-existing" in the next — best-effort by design, not a security
// boundary (the /clear matcher was dropped so an in-session reset cannot re-baseline).
//
// Best-effort: any git failure → silent exit 0. SessionStart stdout becomes session
// context, so on success this prints NOTHING.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, statSync, existsSync } from "node:fs";
import { resolve } from "node:path";
// Shared secret patterns — same source quick-check consumes. The baseline applies no
// placeholder exemption, so it records a SUPERSET of what quick-check flags — the safe
// direction (a drifted narrower copy here produced false completion-blockers:
// un-baselined findings the session did not create).
import { INTRINSIC_SECRETS } from "../../.claude/hooks/lib/secret-patterns.mjs";

// ---------------------------------------------------------------------------
// Utilities (mirrors scripts/quality/quick-check.mjs)
// ---------------------------------------------------------------------------

function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { stdout: (r.stdout ?? "").trim(), status: r.status ?? 1 };
}

function gitList(root, args) {
  return run("git", args, { cwd: root }).stdout.split("\n").filter(Boolean);
}

const uniq = (arr) => [...new Set(arr)];

// ---------------------------------------------------------------------------
// Classifiers — same definitions as quick-check.mjs
// ---------------------------------------------------------------------------

const ENV_ALLOWED = new Set([".env.example", ".env.local.example", ".env.template"]);
const ENV_RE = /^\.env(?:\..+)?$/;
const baseName = (f) => f.split("/").pop();
const isRealEnv = (f) => ENV_RE.test(baseName(f)) && !ENV_ALLOWED.has(baseName(f));

const SKIP_DIRS = [".git/", "node_modules/", ".next/", "dist/", "build/", "vendor/",
                   "_bmad/", ".claude/worktrees/"];
const inSkippedDir = (f) =>
  f.endsWith("/") || SKIP_DIRS.some((d) => f.startsWith(d) || f.includes("/" + d));

// Intrinsic secret shapes — from the shared lib (one source with quick-check).
const INTRINSIC = INTRINSIC_SECRETS.map((s) => s.re);

// ---------------------------------------------------------------------------
// Capped text read — null for missing, oversized (>512KB), or binary files
// (null-byte sniff in the first 8KB). Same approach as quick-check.
// ---------------------------------------------------------------------------

const MAX_SCAN_BYTES = 512 * 1024;

function readTextCapped(abs) {
  try {
    if (!existsSync(abs) || statSync(abs).size > MAX_SCAN_BYTES) return null;
    const buf = readFileSync(abs);
    if (buf.subarray(0, 8192).includes(0)) return null;
    return buf.toString("utf8");
  } catch { return null; }
}

// `=======` alone is a legal Markdown setext underline; it only counts alongside a
// `<<<<<<< ` line — which already flags the file by itself, so the check reduces to
// the open/close markers (git emits the trio together).
function hasConflictMarkers(content) {
  return content.split("\n").some((l) => /^<{7} |^>{7} /.test(l));
}

// ---------------------------------------------------------------------------
// Snapshot — fast, read-only, then one JSON write.
// ---------------------------------------------------------------------------

try {
  const rootR = run("git", ["rev-parse", "--show-toplevel"]);
  if (rootR.status !== 0 || !rootR.stdout) process.exit(0);
  const root = rootR.stdout;

  // whitespaceFiles — file-level output of git diff --check (working tree + staged).
  const whitespaceFiles = [];
  for (const args of [["diff", "--check"], ["diff", "--cached", "--check"]]) {
    const r = run("git", args, { cwd: root });
    if (r.status !== 0 && r.stdout) {
      whitespaceFiles.push(...r.stdout.split("\n").filter(Boolean).map((l) => l.split(":")[0]));
    }
  }

  const staged    = gitList(root, ["diff", "--cached", "--name-only"]);
  const modified  = gitList(root, ["diff", "--name-only"]);
  const untracked = gitList(root, ["ls-files", "--others", "--exclude-standard"]);
  const tracked   = gitList(root, ["ls-files"]);

  // conflictFiles — modified/staged/untracked text files containing conflict markers.
  const conflictFiles = [];
  for (const rel of uniq([...modified, ...staged, ...untracked])) {
    if (inSkippedDir(rel)) continue;
    const content = readTextCapped(resolve(root, rel));
    if (content != null && hasConflictMarkers(content)) conflictFiles.push(rel);
  }

  // envTracked — tracked files that are real .env files.
  const envTracked = tracked.filter(isRealEnv);

  // secretFiles — untracked/modified files whose CONTENT currently matches an
  // intrinsic secret pattern. Paths only; values are never recorded.
  const secretFiles = [];
  for (const rel of uniq([...untracked, ...modified])) {
    if (inSkippedDir(rel)) continue;
    const content = readTextCapped(resolve(root, rel));
    if (content != null && INTRINSIC.some((re) => re.test(content))) secretFiles.push(rel);
  }

  const baseline = {
    whitespaceFiles: uniq(whitespaceFiles).filter(Boolean),
    conflictFiles,
    envTracked,
    secretFiles,
    lastWarningsHash: null,
  };
  writeFileSync(resolve(root, ".claude/.quick-check-baseline.json"),
                JSON.stringify(baseline, null, 2) + "\n");
} catch {
  /* best-effort — never block session start */
}

process.exit(0);
