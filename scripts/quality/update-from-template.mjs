#!/usr/bin/env node
// starter:update — pull starter-owned updates from the Starter Pack template repo.
//
// Adds the template as a git remote, fetches its master, and diffs/applies ONLY the
// starter-owned paths (UPDATE_PATHS below). Project-owned content is never touched:
//   - docs/ and README.md belong to the project and are NOT in UPDATE_PATHS;
//   - .claude/settings.local.json, .claude/worktrees/, and
//     .claude/.quick-check-baseline.json are untracked in the template, so a pathspec
//     checkout from the template tree never writes them.
//
// Default mode is a DRY-RUN: it prints the version pair and the diff stat, changing
// nothing. With --apply it stages the update via
// `git checkout starter-template/master -- <paths>` — changes are left STAGED, never
// committed — then runs starter-doctor and surfaces its exit code. The human reviews
// `git diff --cached` and commits.
//
// Usage: node scripts/quality/update-from-template.mjs [--apply] [--remote <url>] [--allow-remote]
// The template URL can also be overridden via the STARTER_TEMPLATE_URL env var.
//
// REMOTE VALIDATION: an update overwrites the security hooks on disk, so the effective
// remote (flag, env var, or a pre-existing `starter-template` remote) must match the
// official template URL. Any other remote is refused unless --allow-remote is passed
// deliberately — a once-poisoned remote or exported env var must never be used silently.
//
// Exit codes: 0 = ok / already up to date · 1 = error (or doctor blockers after apply).

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const TEMPLATE_URL = "https://github.com/wbicca/Starter-Pack.git";
const REMOTE_NAME = "starter-template";
// Starter-owned paths — the ONLY paths an update may read from the template or write.
const UPDATE_PATHS = [
  ".claude", ".codex", ".agents", "scripts/quality",
  "CLAUDE.md", "AGENTS.md", "CODEX.md", "USAGE.md", "VERSION", "CHANGELOG.md",
  ".github/workflows/ci.yml",
];

// ---------------------------------------------------------------------------
// Primitives (same shape as starter-doctor.mjs)
// ---------------------------------------------------------------------------

function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { stdout: (r.stdout ?? "").trim(), stderr: (r.stderr ?? "").trim(), status: r.status ?? 1 };
}

function fail(msg) {
  process.stderr.write(`ERROR: ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

const argv = process.argv.slice(2);
const apply = argv.includes("--apply");
const allowRemote = argv.includes("--allow-remote");
const remoteFlagIdx = argv.indexOf("--remote");
const remoteUrl =
  (remoteFlagIdx !== -1 && argv[remoteFlagIdx + 1]) ||
  process.env.STARTER_TEMPLATE_URL ||
  TEMPLATE_URL;
if (remoteFlagIdx !== -1 && !argv[remoteFlagIdx + 1]) fail("--remote requires a <url> argument");

// Official template remote (https or ssh, optional .git / trailing slash).
const OFFICIAL_RE = /^(?:https:\/\/github\.com\/|git@github\.com:)wbicca\/Starter-Pack(?:\.git)?\/?$/i;
function requireOfficial(url, source) {
  if (OFFICIAL_RE.test(url) || allowRemote) return;
  fail(
    `'${url}' (${source}) is not the official template remote (${TEMPLATE_URL}).\n` +
      "An update overwrites the local security hooks — refusing. " +
      "Pass --allow-remote to use a different template deliberately.",
  );
}
requireOfficial(remoteUrl, remoteFlagIdx !== -1 ? "--remote" : process.env.STARTER_TEMPLATE_URL ? "STARTER_TEMPLATE_URL" : "default");

// ---------------------------------------------------------------------------
// 1. Ensure we are inside a git repo
// ---------------------------------------------------------------------------

const rootR = run("git", ["rev-parse", "--show-toplevel"]);
if (rootR.status !== 0) fail("not inside a git repository — run this from the project root.");
const ROOT = rootR.stdout;

// ---------------------------------------------------------------------------
// 2. Ensure the template remote exists
// ---------------------------------------------------------------------------

const existing = run("git", ["remote", "get-url", REMOTE_NAME], { cwd: ROOT });
if (existing.status !== 0) {
  const add = run("git", ["remote", "add", REMOTE_NAME, remoteUrl], { cwd: ROOT });
  if (add.status !== 0) fail(`could not add remote ${REMOTE_NAME}: ${add.stderr}`);
  console.log(`Added remote ${REMOTE_NAME} -> ${remoteUrl}`);
} else {
  // A pre-existing remote is the URL git will actually fetch — validate THAT one.
  requireOfficial(existing.stdout, `pre-existing remote ${REMOTE_NAME}`);
  if (existing.stdout !== remoteUrl) {
    console.log(`NOTE: remote ${REMOTE_NAME} already exists (${existing.stdout}) — using it as-is.`);
  }
}

// ---------------------------------------------------------------------------
// 3. Fetch the template master
// ---------------------------------------------------------------------------

console.log(`Fetching ${REMOTE_NAME}/master ...`);
const fetch = run("git", ["fetch", REMOTE_NAME, "master"], { cwd: ROOT });
if (fetch.status !== 0) {
  fail(
    `git fetch ${REMOTE_NAME} master failed — check network access and the remote URL.` +
      (fetch.stderr ? `\n${fetch.stderr}` : ""),
  );
}

// ---------------------------------------------------------------------------
// 4. Report local vs template VERSION
// ---------------------------------------------------------------------------

let localVersion = "(missing)";
try { localVersion = readFileSync(resolve(ROOT, "VERSION"), "utf8").trim() || "(empty)"; } catch { /* keep (missing) */ }
const remoteVersionR = run("git", ["show", `${REMOTE_NAME}/master:VERSION`], { cwd: ROOT });
const remoteVersion = remoteVersionR.status === 0 ? remoteVersionR.stdout.trim() : "(missing)";
console.log(`Local VERSION:    ${localVersion}`);
console.log(`Template VERSION: ${remoteVersion}`);

// ---------------------------------------------------------------------------
// 5. Diff the starter-owned paths
// ---------------------------------------------------------------------------

const diff = run("git", ["diff", "--stat", "HEAD", `${REMOTE_NAME}/master`, "--", ...UPDATE_PATHS], { cwd: ROOT });
if (diff.status !== 0) fail(`git diff failed: ${diff.stderr}`);
if (!diff.stdout) {
  console.log("Already up to date — no template changes under the starter-owned paths.");
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 6. Warn about local modifications an apply would overwrite
// ---------------------------------------------------------------------------

const dirty = run("git", ["status", "--porcelain", "--", ...UPDATE_PATHS], { cwd: ROOT });
const dirtyFiles = dirty.stdout.split("\n").filter(Boolean);
if (dirtyFiles.length) {
  console.log("\nWARNING: locally-modified file(s) under starter-owned paths — --apply would overwrite them:");
  for (const f of dirtyFiles) console.log(`  ${f}`);
}

console.log("\nTemplate changes under starter-owned paths:\n");
console.log(diff.stdout);

// ---------------------------------------------------------------------------
// 7. Dry-run stops here; --apply stages the update (never commits)
// ---------------------------------------------------------------------------

if (!apply) {
  console.log("\nDRY-RUN — nothing was changed. Run with --apply to stage the update.");
  process.exit(0);
}

const checkout = run("git", ["checkout", `${REMOTE_NAME}/master`, "--", ...UPDATE_PATHS], { cwd: ROOT });
if (checkout.status !== 0) fail(`git checkout of the template paths failed: ${checkout.stderr}`);
console.log("\nStaged the template update (nothing committed).");

// Sanity-check the updated starter structure and surface the doctor's exit code.
console.log("\nRunning starter-doctor on the updated tree ...\n");
const doctor = spawnSync(process.execPath, [resolve(ROOT, "scripts", "quality", "starter-doctor.mjs")], {
  cwd: ROOT,
  stdio: "inherit",
});
const doctorStatus = doctor.status ?? 1;
console.log(`\nstarter-doctor exit code: ${doctorStatus}`);

console.log("Next: review the staged update with `git diff --cached` and commit it yourself.");
process.exit(doctorStatus === 0 ? 0 : 1);
