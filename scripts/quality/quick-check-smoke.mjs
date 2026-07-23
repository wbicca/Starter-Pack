#!/usr/bin/env node
// Smoke test for scripts/quality/quick-check.mjs — table-driven, node builtins only.
//
// Each case builds a temp git fixture and asserts quick-check's MANUAL-mode exit code
// and stderr markers, or (hook cases) its Stop-hook JSON. Pins the v1.3 policies:
//   * provider keys (sk-ant-…) reach the Stop-hook net via the shared pattern lib;
//   * baselined SECRET findings are never silenced — they re-emit every turn even
//     when the warning set is unchanged (a credential is never "acceptable");
//   * a Profile: change in docs/STACK.md surfaces a warning.
//
// Secret fixtures are built at runtime so this source never matches the scanners.
//
// Run: node scripts/quality/quick-check-smoke.mjs → PASS/FAIL table, exit 1 on FAIL.

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(root, "scripts", "quality", "quick-check.mjs");
const realTmp = (() => { try { return realpathSync(tmpdir()); } catch { return tmpdir(); } })();

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const randAlnum = (n) =>
  Array.from({ length: n }, () => ALNUM[Math.floor(Math.random() * ALNUM.length)]).join("");
const ANT_KEY = "sk-ant-aB3" + randAlnum(16);
const GH_PAT = "ghp_aB3" + randAlnum(20);

function makeFixture({ files = {}, gitignore, commit = true } = {}) {
  const dir = mkdtempSync(join(realTmp, "quick-check-smoke-"));
  const g = (args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  g(["init", "-q"]);
  g(["config", "user.email", "smoke@example.invalid"]);
  g(["config", "user.name", "quick-check-smoke"]);
  writeFileSync(join(dir, "README.md"), "fixture\n");
  if (gitignore) writeFileSync(join(dir, ".gitignore"), gitignore);
  if (commit) { g(["add", "."]); g(["commit", "-q", "-m", "init"]); }
  for (const [rel, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, rel)), { recursive: true });
    writeFileSync(join(dir, rel), content);
  }
  return { dir, g };
}

function writeBaseline(dir, baseline) {
  mkdirSync(join(dir, ".claude"), { recursive: true });
  const base = { whitespaceFiles: [], conflictFiles: [], envTracked: [],
                 emittedWarnings: [] };
  base[["secret", "Files"].join("")] = [];
  writeFileSync(join(dir, ".claude", ".quick-check-baseline.json"),
    JSON.stringify({ ...base, ...baseline }, null, 2) + "\n");
}

function runManual(dir) {
  const r = spawnSync(process.execPath, [SCRIPT], { cwd: dir, encoding: "utf8", timeout: 30_000 });
  return { status: r.status ?? 1, stderr: r.stderr ?? "" };
}
function runHook(dir) {
  const r = spawnSync(process.execPath, [SCRIPT], {
    cwd: dir, encoding: "utf8", timeout: 30_000,
    input: JSON.stringify({ hook_event_name: "Stop", stop_hook_active: false }),
  });
  let json = {};
  try { json = JSON.parse((r.stdout ?? "").trim() || "{}"); } catch { /* keep {} */ }
  return { status: r.status ?? 1, json };
}

const secretsOf = (paths) => ({ [["secret", "Files"].join("")]: paths });

const cases = [
  { name: "clean repo → exit 0",
    run() { const { dir } = makeFixture(); this.dir = dir;
      const r = runManual(dir); return r.status === 0 && r.stderr.includes("clean"); } },
  { name: "versionable .env → blocker exit 2",
    run() { const { dir } = makeFixture({ files: { ".env": "KEY=v\n" } }); this.dir = dir;
      const r = runManual(dir); return r.status === 2 && /\.env file is versionable/.test(r.stderr); } },
  { name: "ignored local .env → warning only, exit 0",
    run() { const { dir } = makeFixture({ gitignore: ".env\n", files: { ".env": "KEY=v\n" } }); this.dir = dir;
      const r = runManual(dir); return r.status === 0 && /ignored local environment file/.test(r.stderr); } },
  { name: "provider key (sk-ant) in untracked file → blocker exit 2",
    run() { const { dir } = makeFixture({ files: { "notes.md": `key: ${ANT_KEY}\n` } }); this.dir = dir;
      const r = runManual(dir); return r.status === 2 && /possible secret/.test(r.stderr); } },
  { name: "GitHub PAT in added diff line → blocker exit 2",
    run() { const { dir } = makeFixture(); this.dir = dir;
      writeFileSync(join(dir, "README.md"), `fixture\nvalue ${GH_PAT}\n`);
      const r = runManual(dir); return r.status === 2 && /possible secret/.test(r.stderr); } },
  { name: "conflict markers in modified file → blocker exit 2",
    run() { const { dir } = makeFixture(); this.dir = dir;
      writeFileSync(join(dir, "README.md"), "<<<<<<< HEAD\nfixture\n>>>>>>> other\n");
      const r = runManual(dir); return r.status === 2 && /conflict markers/.test(r.stderr); } },
  { name: "baselined conflict file → pre-existing warning, exit 0",
    run() { const { dir } = makeFixture(); this.dir = dir;
      writeFileSync(join(dir, "README.md"), "<<<<<<< HEAD\nfixture\n>>>>>>> other\n");
      // the real session-baseline records the file under BOTH classifiers (git diff
      // --check also reports conflict markers as whitespace errors)
      writeBaseline(dir, { conflictFiles: ["README.md"], whitespaceFiles: ["README.md"] });
      const r = runManual(dir); return r.status === 0 && /pre-existing/.test(r.stderr); } },
  { name: "baselined secret file → warning (not blocker), exit 0",
    run() { const { dir } = makeFixture({ files: { "notes.md": `value ${GH_PAT}\n` } }); this.dir = dir;
      writeBaseline(dir, secretsOf(["notes.md"]));
      const r = runManual(dir); return r.status === 0 && /pre-existing/.test(r.stderr); } },
  { name: "hook: baselined secret re-emits despite unchanged warning set",
    run() {
      const { dir } = makeFixture({ files: { "notes.md": `value ${GH_PAT}\n` } }); this.dir = dir;
      writeBaseline(dir, secretsOf(["notes.md"]));
      const first = runHook(dir);           // emits warning, stores lastWarningsHash
      const second = runHook(dir);          // unchanged set — secret must STILL re-emit
      const msg = (r) => r.json.systemMessage || "";
      return /secret/.test(msg(first)) && /secret/.test(msg(second));
    } },
  { name: "Profile: change in docs/STACK.md diff → warning",
    run() {
      const { dir, g } = makeFixture(); this.dir = dir;
      mkdirSync(join(dir, "docs"), { recursive: true });
      writeFileSync(join(dir, "docs", "STACK.md"), "> **Profile: standard**\n");
      g(["add", "."]); g(["commit", "-q", "-m", "stack"]);
      writeFileSync(join(dir, "docs", "STACK.md"), "> **Profile: light**\n");
      const r = runManual(dir);
      return r.status === 0 && /Profile: line changed/.test(r.stderr);
    } },
  // v1.4: per-warning dedup must PERSIST even when no baseline file exists yet (the
  // old whole-set store silently failed without one → the same warning re-emitted
  // every turn, 50× in one field report). One emit per session, then silence.
  { name: "hook: ignored .env warning emits once per session (dedup persists)",
    run() {
      const { dir } = makeFixture({ gitignore: ".env\n", files: { ".env": "KEY=v\n" } }); this.dir = dir;
      const first = runHook(dir);           // no baseline file yet — store must create it
      const second = runHook(dir);          // same warning set — must stay silent now
      const msg = (r) => r.json.systemMessage || "";
      return /ignored local environment file/.test(msg(first)) && !msg(second);
    } },
  { name: "hook: stop_hook_active passes through",
    run() {
      const { dir } = makeFixture({ files: { ".env": "KEY=v\n" } }); this.dir = dir;
      const r = spawnSync(process.execPath, [SCRIPT], {
        cwd: dir, encoding: "utf8", timeout: 30_000,
        input: JSON.stringify({ hook_event_name: "Stop", stop_hook_active: true }),
      });
      return (r.stdout ?? "").trim() === "{}";
    } },
  { name: "hook: fresh blocker emits decision block",
    run() {
      const { dir } = makeFixture({ files: { ".env": "KEY=v\n" } }); this.dir = dir;
      const r = runHook(dir);
      return r.json.decision === "block" && /QUICK_CHECK_FAILED/.test(r.json.reason || "");
    } },
];

let failed = 0;
for (const c of cases) {
  let ok = false;
  try { ok = c.run(); } catch { ok = false; }
  if (c.dir) rmSync(c.dir, { recursive: true, force: true });
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
