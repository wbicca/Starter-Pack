#!/usr/bin/env node
// Stop hook + manual CLI — fast, read-only "quick check".
//
// BLOCKERS (fail completion): whitespace/conflict errors (working tree + staged),
//   conflict markers, real .env files that are versionable (tracked/staged/modified/
//   untracked-not-ignored), obvious secrets in added diff lines OR in untracked file
//   content, versionable residual temporaries, paths outside the repo root.
// WARNINGS (do NOT block): ignored local files that exist on disk (e.g. .env.local,
//   *.tmp) — surfaced by name only, never read, so an intentionally-local file is not
//   treated as a leak. Allowed example files (.env.example, …) are silent.
//
// BASELINE: if .claude/.quick-check-baseline.json exists (written by the SessionStart
//   hook scripts/quality/session-baseline.mjs), findings on files ALREADY flagged at
//   session start are downgraded to warnings labeled "pre-existing (before this
//   session)" — this session only blocks on problems it created. Missing/corrupt
//   baseline → everything blocks, as before. In hook mode, an unchanged warning set
//   (tracked via lastWarningsHash in the baseline) is emitted only once.
//
// Does NOT run: install, build, typecheck, tests, E2E, formatter, heavy linter.
// Does NOT replace: $quality-gate, $refactor-pass, $release-sanity, a real secret
//   scanner, or a security audit.

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve, normalize, relative } from "node:path";
// Shared secret patterns — one source with scan-secrets and session-baseline
// (module-relative path: works from any cwd).
import { INTRINSIC_SECRETS } from "../../.claude/hooks/lib/secret-patterns.mjs";

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { stdout: (r.stdout ?? "").trim(), stderr: (r.stderr ?? "").trim(), status: r.status ?? 1 };
}

function repoRoot() {
  const r = run("git", ["rev-parse", "--show-toplevel"]);
  return r.status === 0 ? r.stdout : process.cwd();
}

// Read stdin with a 120 ms deadline; returns "" when nothing arrives (manual/TTY).
function readStdinTimeout(ms = 120) {
  return new Promise((res) => {
    if (process.stdin.isTTY) { res(""); return; }
    let buf = "";
    const t = setTimeout(() => { process.stdin.destroy(); res(buf); }, ms);
    process.stdin.on("data", (c) => (buf += c));
    process.stdin.on("end", () => { clearTimeout(t); res(buf); });
    process.stdin.on("error", () => { clearTimeout(t); res(buf); });
  });
}

const uniq = (arr) => [...new Set(arr)];
const listOf = (arr, n = 3) =>
  arr.slice(0, n).join(", ") + (arr.length > n ? ` (+${arr.length - n} more)` : "");

// Capped text read — null for missing, oversized (>512KB), or binary files
// (null-byte sniff in the first 8KB). Keeps content scans cheap and text-only.
const MAX_SCAN_BYTES = 512 * 1024;
function readTextCapped(abs) {
  try {
    if (!existsSync(abs) || statSync(abs).size > MAX_SCAN_BYTES) return null;
    const buf = readFileSync(abs);
    if (buf.subarray(0, 8192).includes(0)) return null;
    return buf.toString("utf8");
  } catch { return null; }
}

// ---------------------------------------------------------------------------
// Session baseline — pre-existing findings snapshot (session-baseline.mjs)
// ---------------------------------------------------------------------------

const BASELINE_REL = ".claude/.quick-check-baseline.json";

// Missing/corrupt baseline → empty sets, i.e. exactly the pre-baseline behavior.
function loadBaseline(root) {
  try {
    const b = JSON.parse(readFileSync(resolve(root, BASELINE_REL), "utf8"));
    const set = (k) => new Set(Array.isArray(b[k]) ? b[k] : []);
    return {
      whitespaceFiles: set("whitespaceFiles"),
      conflictFiles: set("conflictFiles"),
      envTracked: set("envTracked"),
      secretFiles: set("secretFiles"),
      lastWarningsHash: typeof b.lastWarningsHash === "string" ? b.lastWarningsHash : null,
    };
  } catch {
    return {
      whitespaceFiles: new Set(), conflictFiles: new Set(),
      envTracked: new Set(), secretFiles: new Set(), lastWarningsHash: null,
    };
  }
}

// Best-effort: remember the last emitted warning set so hook mode doesn't repeat it.
function storeWarningsHash(root, hash) {
  try {
    const p = resolve(root, BASELINE_REL);
    const b = JSON.parse(readFileSync(p, "utf8"));
    b.lastWarningsHash = hash;
    writeFileSync(p, JSON.stringify(b, null, 2) + "\n");
  } catch { /* silent — dedup is a convenience, never an error */ }
}

// ---------------------------------------------------------------------------
// Git file sets — computed once, reused by every check.
// ---------------------------------------------------------------------------

function gitList(root, args) {
  return run("git", args, { cwd: root }).stdout.split("\n").filter(Boolean);
}

function fileSets(root) {
  return {
    // Versionable = anything that would land in a commit.
    tracked:   gitList(root, ["ls-files"]),
    staged:    gitList(root, ["diff", "--cached", "--name-only"]),
    modified:  gitList(root, ["diff", "--name-only"]),
    untracked: gitList(root, ["ls-files", "--others", "--exclude-standard"]),
    // Ignored local files (name only). --directory collapses ignored dirs (e.g.
    // node_modules/) to a single entry so the scan stays cheap.
    ignored:   gitList(root, ["ls-files", "--others", "--ignored", "--exclude-standard",
                              "--directory", "--no-empty-directory"]),
  };
}

// ---------------------------------------------------------------------------
// Name classifiers (shared by blocker + warning logic)
// ---------------------------------------------------------------------------

// keep in sync with .claude/hooks/protect-sensitive-files.mjs and .claude/hooks/block-dangerous-bash.mjs
const ENV_ALLOWED = new Set([".env.example", ".env.local.example", ".env.template"]);
// Matches: .env  .env.local  .env.production  .env.anything  etc.
const ENV_RE = /^\.env(?:\..+)?$/;
// Residual temporaries: .tmp-anything, anything.tmp, audit logs.
const TMP_RE = /(?:^|\/)(\.tmp-[^/]+|[^/]+\.tmp|audit[-_]?\d*\.log)$/i;

const baseName = (f) => f.split("/").pop();
const isRealEnv = (f) => ENV_RE.test(baseName(f)) && !ENV_ALLOWED.has(baseName(f));
const isTemp = (f) => TMP_RE.test(f);

// Heavy / irrelevant directories never worth scanning for local warnings.
const SKIP_DIRS = [".git/", "node_modules/", ".next/", "dist/", "build/", "vendor/",
                   "_bmad/", ".claude/worktrees/"];
const inSkippedDir = (f) =>
  f.endsWith("/") || SKIP_DIRS.some((d) => f.startsWith(d) || f.includes("/" + d));

// ---------------------------------------------------------------------------
// git diff --check (whitespace / leftover markers) — working tree + staged
// ---------------------------------------------------------------------------

function whitespaceProblemFiles(root) {
  const files = [];
  for (const args of [["diff", "--check"], ["diff", "--cached", "--check"]]) {
    const r = run("git", args, { cwd: root });
    if (r.status !== 0 && r.stdout) {
      files.push(...r.stdout.split("\n").filter(Boolean).map((l) => l.split(":")[0]));
    }
  }
  return uniq(files).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Conflict markers in modified + staged + untracked (NOT ignored) files
// ---------------------------------------------------------------------------

// `=======` alone is a legal Markdown setext underline — it only counts as a conflict
// marker when the SAME file also has a `<<<<<<< ` line (git emits the trio together).
// Since `<<<<<<< ` already flags the file by itself, the check reduces to open/close.
function hasConflictMarkers(content) {
  return content.split("\n").some((l) => /^<{7} |^>{7} /.test(l));
}

function conflictMarkerFiles(root, sets) {
  const files = uniq([...sets.modified, ...sets.staged, ...sets.untracked]);
  const conflicts = [];
  for (const rel of files) {
    if (inSkippedDir(rel)) continue;
    const content = readTextCapped(resolve(root, rel));
    if (content != null && hasConflictMarkers(content)) conflicts.push(rel);
  }
  return conflicts;
}

// ---------------------------------------------------------------------------
// Obvious secrets — ADDED diff lines (per-file) + untracked file CONTENT
// ---------------------------------------------------------------------------

// --- secret patterns ---
// Single source: .claude/hooks/lib/secret-patterns.mjs (shared with scan-secrets and
// session-baseline). The lib's char-classes keep source files from self-matching.
// The `jwt` metadata (Supabase anon exemption) is a scan-secrets concern — this
// end-of-turn net flags every JWT-shaped token.
const INTRINSIC = INTRINSIC_SECRETS;

const PLACEHOLDERS = new Set(["your_key_here", "changeme", "change_me", "placeholder", "example_value"]);
function isPlaceholder(v) {
  const s = (v || "").trim().replace(/^["']|["']$/g, "").toLowerCase();
  if (!s) return true;
  if (PLACEHOLDERS.has(s)) return true;
  if (/^<.*>$/.test(s)) return true;
  if (/^\$\{.*\}$/.test(s)) return true;
  if (/^x{6,}$/.test(s)) return true;
  return false;
}

// Match all patterns against one text chunk; record { file, cat } — NEVER the value.
function matchIntrinsic(text, file, findings) {
  for (const s of INTRINSIC) {
    const m = text.match(s.re);
    if (!m) continue;
    // For DB URL, skip obvious placeholder passwords.
    if (s.group != null && isPlaceholder(m[s.group])) continue;
    if (!findings.some((f) => f.file === file && f.cat === s.cat)) {
      findings.push({ file, cat: s.cat });
    }
  }
}

function secretFindings(root, sets) {
  const findings = []; // { file, cat }

  // Added diff lines (working tree + staged), attributed per-file via +++ headers.
  const diffText =
    run("git", ["diff"], { cwd: root }).stdout + "\n" +
    run("git", ["diff", "--cached"], { cwd: root }).stdout;
  const addedByFile = new Map();
  let current = "";
  for (const line of diffText.split("\n")) {
    if (line.startsWith("+++ ")) {
      current = line.slice(4).replace(/^b\//, "").replace(/^"(.*)"$/, "$1").trim();
      if (current === "/dev/null") current = "";
      continue;
    }
    if (!line.startsWith("+")) continue;
    addedByFile.set(current, (addedByFile.get(current) ?? "") + line.slice(1) + "\n");
  }
  for (const [file, text] of addedByFile) matchIntrinsic(text, file, findings);

  // Untracked files never appear in a diff — scan their CONTENT directly.
  for (const rel of sets.untracked) {
    if (inSkippedDir(rel)) continue;
    const content = readTextCapped(resolve(root, rel));
    if (content != null) matchIntrinsic(content, rel, findings);
  }
  return findings;
}

// ---------------------------------------------------------------------------
// Blocker — files outside repo root (best-effort)
// ---------------------------------------------------------------------------

function checkOutsidePaths(root) {
  const status = run("git", ["status", "--porcelain"], { cwd: root }).stdout;
  const bad = status
    .split("\n")
    .filter(Boolean)
    .map((l) => l.slice(3).trim().replace(/^"(.*)"$/, "$1"))
    .filter((f) => {
      try {
        const abs = normalize(resolve(root, f));
        const rel = relative(root, abs);
        return rel.startsWith("..") || (rel.length > 0 && rel[0] === "/");
      } catch { return false; }
    });
  if (bad.length > 0) {
    return `file(s) outside repo root: ${listOf(bad)} — unexpected path escape`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Run all checks → { blockers, warnings }.  Empty/empty = clean.
// Baseline subtraction: findings on files already flagged at session start are
// downgraded to "pre-existing (before this session)" warnings, at FILE level.
// ---------------------------------------------------------------------------

function runChecks() {
  const root = repoRoot();
  const sets = fileSets(root);
  const baseline = loadBaseline(root);
  const blockers = [];
  const warnings = [];
  // Persistent warnings are NEVER deduped by lastWarningsHash — they re-emit every
  // turn. Reserved for baselined secrets: a credential is never "acceptable because
  // pre-existing"; silence would normalize it.
  const persistent = [];

  // Split a file list against a baseline set: fresh files block, baselined ones warn.
  const split = (files, baseSet) => ({
    fresh: files.filter((f) => !baseSet.has(f)),
    pre:   files.filter((f) => baseSet.has(f)),
  });

  // --- whitespace / conflict errors (git diff --check, working tree + staged) ---
  const ws = split(whitespaceProblemFiles(root), baseline.whitespaceFiles);
  if (ws.fresh.length) {
    blockers.push(`whitespace/conflict errors in ${listOf(ws.fresh)} (fix with git diff --check)`);
  }
  if (ws.pre.length) {
    warnings.push(`whitespace/conflict errors pre-existing (before this session) in ${listOf(ws.pre)} — fix when convenient.`);
  }

  // --- conflict markers ---
  const cm = split(conflictMarkerFiles(root, sets), baseline.conflictFiles);
  if (cm.fresh.length) {
    blockers.push(`unresolved conflict markers in ${listOf(cm.fresh)} — resolve merge conflicts before continuing`);
  }
  if (cm.pre.length) {
    warnings.push(`conflict markers pre-existing (before this session) in ${listOf(cm.pre)} — resolve when convenient.`);
  }

  // --- secrets (diff added lines + untracked content) ---
  const found = secretFindings(root, sets);
  const secFresh = found.filter((f) => !baseline.secretFiles.has(f.file));
  const secPre = found.filter((f) => baseline.secretFiles.has(f.file));
  if (secFresh.length) {
    const files = uniq(secFresh.map((f) => f.file || "added diff lines"));
    blockers.push(`possible secret in ${listOf(files)} (${secFresh[0].cat}) — remove credential, use placeholder, document in .env.example`);
  }
  if (secPre.length) {
    persistent.push(`possible secret pre-existing (before this session) in ${listOf(uniq(secPre.map((f) => f.file)))} — remove it; never commit.`);
  }

  // --- paths outside the repo root ---
  const outside = checkOutsidePaths(root);
  if (outside) blockers.push(outside);

  // --- Versionable .env / temporaries → BLOCK (would be committed) ---
  const versionable = uniq([...sets.tracked, ...sets.staged, ...sets.modified, ...sets.untracked]);
  const env = split(versionable.filter(isRealEnv), baseline.envTracked);
  if (env.fresh.length) {
    blockers.push(`real .env file is versionable: ${listOf(env.fresh)} — git rm --cached / rename to .env.example / .env.template`);
  }
  if (env.pre.length) {
    warnings.push(`real .env file pre-existing (before this session): ${listOf(env.pre)} — untrack it; never commit.`);
  }
  const tmpBad = versionable.filter(isTemp);
  if (tmpBad.length) {
    blockers.push(`versionable temporary file(s): ${listOf(tmpBad)} — remove before committing`);
  }

  // --- Ignored local files → WARN only (name scan, content never read) ---
  const ignoredLocal = sets.ignored.filter((f) => !inSkippedDir(f));
  const envWarn = ignoredLocal.filter(isRealEnv);
  if (envWarn.length) {
    warnings.push(`ignored local environment file detected: ${listOf(envWarn)}. Confirm it is intentionally local and never commit it.`);
  }
  const tmpWarn = ignoredLocal.filter(isTemp);
  if (tmpWarn.length) {
    warnings.push(`ignored local temporary file detected: ${listOf(tmpWarn)}. Remove it if no longer needed.`);
  }

  // --- Profile: change in docs/STACK.md → WARN (a flip alters gate depth) ---
  for (const args of [["diff", "--", "docs/STACK.md"], ["diff", "--cached", "--", "docs/STACK.md"]]) {
    const d = run("git", args, { cwd: root }).stdout;
    if (d && d.split("\n").some((l) => /^[+-](?![+-]).*\bProfile:/.test(l))) {
      warnings.push("Profile: line changed in docs/STACK.md — a profile flip changes gate depth; confirm it was a deliberate, human-approved change.");
      break;
    }
  }

  return { root, baseline, blockers, warnings, persistent };
}

// ---------------------------------------------------------------------------
// Main entry point
// ---------------------------------------------------------------------------

const stdinRaw = await readStdinTimeout(120);
const isHookMode = stdinRaw.trim().startsWith("{");

if (isHookMode) {
  // ---- HOOK MODE (Claude Code / Codex Stop event) ----
  let event = {};
  try { event = JSON.parse(stdinRaw); } catch { /* malformed — treat as safe */ }

  // Prevent infinite loop: if this hook itself triggered another Stop, pass through.
  if (event.stop_hook_active === true) {
    process.stdout.write("{}");
    process.exit(0);
  }

  // Only react to the Stop event; ignore anything else cleanly.
  if (event.hook_event_name !== "Stop") {
    process.stdout.write("{}");
    process.exit(0);
  }

  const { root, baseline, blockers, warnings, persistent } = runChecks();

  // Blockers take precedence — block completion, never print raw credential values.
  if (blockers.length > 0) {
    const summary = blockers.length === 1
      ? blockers[0]
      : `${blockers.length} issues — ${blockers[0]} (+${blockers.length - 1} more; run manually for full list)`;
    process.stdout.write(JSON.stringify({
      decision: "block",
      reason: `QUICK_CHECK_FAILED: ${summary}`,
    }));
    process.exit(0);
  }

  // Warnings only → surface a non-blocking systemMessage. Dedup applies to ordinary
  // warnings (an unchanged set — same hash as lastWarningsHash — stays silent), but
  // PERSISTENT warnings (baselined secrets) re-emit every turn regardless.
  if (warnings.length > 0 || persistent.length > 0) {
    const hash = createHash("sha256").update([...warnings].sort().join("\n")).digest("hex");
    const unchanged = hash === baseline.lastWarningsHash;
    if (unchanged && persistent.length === 0) {
      process.stdout.write("{}");
      process.exit(0);
    }
    if (!unchanged) storeWarningsHash(root, hash);
    const parts = [...persistent, ...(unchanged ? [] : warnings)];
    process.stdout.write(JSON.stringify({
      systemMessage: `QUICK_CHECK_WARNING: ${parts.join(" ")}`,
    }));
    process.exit(0);
  }

  process.stdout.write("{}");
  process.exit(0);

} else {
  // ---- MANUAL MODE (CLI invocation, no piped JSON) ----
  const { blockers, warnings, persistent } = runChecks();

  for (const b of blockers) process.stderr.write(`BLOCKER: ${b}\n`);
  for (const w of [...persistent, ...warnings]) process.stderr.write(`WARNING: ${w}\n`);

  if (blockers.length > 0) process.exit(2);     // blockers fail
  if (warnings.length === 0 && persistent.length === 0) process.stderr.write("quick-check: clean\n");
  process.exit(0);                              // warnings-only or clean → pass
}
