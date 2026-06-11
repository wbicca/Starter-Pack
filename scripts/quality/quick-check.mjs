#!/usr/bin/env node
// Stop hook + manual CLI — fast, read-only "quick check".
//
// BLOCKERS (fail completion): whitespace/conflict errors, conflict markers, real
//   .env files that are versionable (tracked/staged/modified/untracked-not-ignored),
//   obvious secrets in added lines, versionable residual temporaries, paths outside
//   the repo root.
// WARNINGS (do NOT block): ignored local files that exist on disk (e.g. .env.local,
//   *.tmp) — surfaced by name only, never read, so an intentionally-local file is not
//   treated as a leak. Allowed example files (.env.example, …) are silent.
//
// Does NOT run: install, build, typecheck, tests, E2E, formatter, heavy linter.
// Does NOT replace: $quality-gate, $refactor-pass, $release-sanity, a real secret
//   scanner, or a security audit.

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { resolve, normalize, relative } from "node:path";

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
// Blocker — git diff --check (whitespace / leftover markers)
// ---------------------------------------------------------------------------

function checkWhitespace(root) {
  const r = run("git", ["diff", "--check"], { cwd: root });
  if (r.status !== 0 && r.stdout) {
    const files = uniq(r.stdout.split("\n").filter(Boolean).map((l) => l.split(":")[0])).join(", ");
    return `whitespace/conflict errors in ${files || "working tree"} (fix with git diff --check)`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Blocker — conflict markers in modified + staged + untracked (NOT ignored) files
// ---------------------------------------------------------------------------

function checkConflictMarkers(root, sets) {
  const files = uniq([...sets.modified, ...sets.staged, ...sets.untracked]);
  const conflicts = [];
  for (const rel of files) {
    const abs = resolve(root, rel);
    if (!existsSync(abs)) continue;
    let content;
    try { content = readFileSync(abs, "utf8"); } catch { continue; }
    if (content.split("\n").some((l) => /^<{7} |^={7}$|^>{7} /.test(l))) {
      conflicts.push(rel);
    }
  }
  if (conflicts.length > 0) {
    return `unresolved conflict markers in ${listOf(conflicts)} — resolve merge conflicts before continuing`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Blocker — obvious secrets in ADDED lines of the diff
// ---------------------------------------------------------------------------

function checkSecrets(root) {
  const diffText =
    run("git", ["diff"], { cwd: root }).stdout +
    run("git", ["diff", "--cached"], { cwd: root }).stdout;
  if (!diffText) return null;

  // Only examine lines that start with "+" (added), skipping "+++ b/…" headers.
  const addedLines = diffText.split("\n").filter((l) => l.startsWith("+") && !l.startsWith("+++"));
  const text = addedLines.join("\n");
  if (!text.trim()) return null;

  // --- secret patterns ---
  // Regex char-classes prevent this SOURCE FILE from matching the scanner's
  // literal-prefix patterns (e.g. sk_live_ is safe as a prefix + char-class).
  // The PEM header uses [A-Z ]* so the source never contains the exact literal.
  const INTRINSIC = [
    { re: /\bsk_live_[A-Za-z0-9]{4,}/, cat: "Stripe live secret token" },
    { re: /\bsk_test_[A-Za-z0-9]{4,}/, cat: "Stripe test secret token" },
    { re: /\bAKIA[0-9A-Z]{12,}/, cat: "AWS access key (AKIA)" },
    { re: /\bASIA[0-9A-Z]{12,}/, cat: "AWS temp access key (ASIA)" },
    { re: /\bghp_[A-Za-z0-9]{20,}/, cat: "GitHub PAT (ghp_)" },
    { re: /\bgithub_pat_[A-Za-z0-9_]{20,}/, cat: "GitHub fine-grained PAT" },
    { re: /\bAIza[0-9A-Za-z_\-]{20,}/, cat: "Google API key (AIza)" },
    // PEM private key — char-class on the type segment avoids the exact literal.
    { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, cat: "PEM private key block" },
    // JWT: eyJ<20+> . <10+> . <10+>
    { re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, cat: "JWT token" },
    // Database URL with inline credentials
    { re: /\b(?:postgres|postgresql):\/\/[^:\s/@]+:([^@\s/]+)@/, cat: "database URL with inline credentials", group: 1 },
  ];

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

  for (const s of INTRINSIC) {
    const m = text.match(s.re);
    if (!m) continue;
    // For DB URL, skip obvious placeholder passwords.
    if (s.group != null && isPlaceholder(m[s.group])) continue;
    // NEVER print the matched value — report category + expected fix only.
    return `possible secret in added diff lines (${s.cat}) — remove credential, use placeholder, document in .env.example`;
  }
  return null;
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
// ---------------------------------------------------------------------------

function runChecks() {
  const root = repoRoot();
  const sets = fileSets(root);
  const blockers = [];
  const warnings = [];
  const pushB = (r) => { if (r) blockers.push(r); };

  pushB(checkWhitespace(root));
  pushB(checkConflictMarkers(root, sets));
  pushB(checkSecrets(root));
  pushB(checkOutsidePaths(root));

  // --- Versionable .env / temporaries → BLOCK (would be committed) ---
  const versionable = uniq([...sets.tracked, ...sets.staged, ...sets.modified, ...sets.untracked]);
  const envBad = versionable.filter(isRealEnv);
  if (envBad.length) {
    pushB(`real .env file is versionable: ${listOf(envBad)} — git rm --cached / rename to .env.example / .env.template`);
  }
  const tmpBad = versionable.filter(isTemp);
  if (tmpBad.length) {
    pushB(`versionable temporary file(s): ${listOf(tmpBad)} — remove before committing`);
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

  return { blockers, warnings };
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

  const { blockers, warnings } = runChecks();

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

  // Warnings only → surface a non-blocking systemMessage.
  if (warnings.length > 0) {
    process.stdout.write(JSON.stringify({
      systemMessage: `QUICK_CHECK_WARNING: ${warnings.join(" ")}`,
    }));
    process.exit(0);
  }

  process.stdout.write("{}");
  process.exit(0);

} else {
  // ---- MANUAL MODE (CLI invocation, no piped JSON) ----
  const { blockers, warnings } = runChecks();

  for (const b of blockers) process.stderr.write(`BLOCKER: ${b}\n`);
  for (const w of warnings) process.stderr.write(`WARNING: ${w}\n`);

  if (blockers.length > 0) process.exit(2);     // blockers fail
  if (warnings.length === 0) process.stderr.write("quick-check: clean\n");
  process.exit(0);                              // warnings-only or clean → pass
}
