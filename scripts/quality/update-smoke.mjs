#!/usr/bin/env node
// Smoke test for update-from-template.mjs remote validation — node builtins only.
//
// Pins the v1.3 hardening: the updater refuses to fetch from a NON-official template
// remote (flag, env var, or a pre-existing `starter-template` remote pointing
// elsewhere) unless --allow-remote is passed deliberately. An update overwrites the
// security hooks on disk, so a poisoned remote must never be used silently.
//
// All cases are offline: refusals happen BEFORE any fetch; the accepted-remote case
// uses a local file:// bare repo.
//
// Run: node scripts/quality/update-smoke.mjs   → PASS/FAIL table, exit 1 on any FAIL.

import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { mkdtempSync, writeFileSync, rmSync, realpathSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(root, "scripts", "quality", "update-from-template.mjs");
const realTmp = (() => { try { return realpathSync(tmpdir()); } catch { return tmpdir(); } })();

function git(dir, args) {
  return spawnSync("git", args, { cwd: dir, encoding: "utf8" });
}

// A minimal project repo (needs HEAD for the updater's diff step).
function makeRepo() {
  const dir = mkdtempSync(join(realTmp, "update-smoke-repo-"));
  git(dir, ["init", "-q", "-b", "master"]);
  git(dir, ["config", "user.email", "smoke@example.invalid"]);
  git(dir, ["config", "user.name", "update-smoke"]);
  writeFileSync(join(dir, "README.md"), "fixture\n");
  git(dir, ["add", "README.md"]);
  git(dir, ["commit", "-q", "-m", "fixture"]);
  return dir;
}

// A local "template" the --allow-remote case can actually fetch (bare clone of a
// one-commit repo whose master carries a VERSION file — a starter-owned path).
function makeBareTemplate() {
  const src = makeRepo();
  writeFileSync(join(src, "VERSION"), "9.9.9\n");
  git(src, ["add", "VERSION"]);
  git(src, ["commit", "-q", "-m", "template VERSION"]);
  const bare = mkdtempSync(join(realTmp, "update-smoke-bare-")) + ".git";
  spawnSync("git", ["clone", "-q", "--bare", src, bare], { encoding: "utf8" });
  cleanup.push(src);
  return bare;
}

const cleanup = [];
process.on("exit", () => { for (const d of cleanup) rmSync(d, { recursive: true, force: true }); });

function runUpdater(repo, args, env = {}) {
  const r = spawnSync(process.execPath, [SCRIPT, ...args], {
    cwd: repo, encoding: "utf8", env: { ...process.env, ...env }, timeout: 30_000,
  });
  return { status: r.status ?? 1, out: (r.stdout ?? "") + (r.stderr ?? "") };
}

const REFUSAL = /not the official template remote/i;

const cases = [
  {
    name: "--remote non-official URL → refuse (exit 1)",
    run() {
      const repo = makeRepo(); cleanup.push(repo);
      const r = runUpdater(repo, ["--remote", "https://github.com/evil/Starter-Pack.git"]);
      return r.status === 1 && REFUSAL.test(r.out);
    },
  },
  {
    name: "STARTER_TEMPLATE_URL non-official → refuse (exit 1)",
    run() {
      const repo = makeRepo(); cleanup.push(repo);
      const r = runUpdater(repo, [], { STARTER_TEMPLATE_URL: "https://evil.example/x.git" });
      return r.status === 1 && REFUSAL.test(r.out);
    },
  },
  {
    name: "pre-existing starter-template remote elsewhere → refuse (exit 1)",
    run() {
      const repo = makeRepo(); cleanup.push(repo);
      git(repo, ["remote", "add", "starter-template", "https://github.com/evil/other.git"]);
      const r = runUpdater(repo, []);
      return r.status === 1 && REFUSAL.test(r.out);
    },
  },
  {
    name: "--allow-remote + local file bare template → dry-run proceeds (exit 0)",
    run() {
      const repo = makeRepo(); cleanup.push(repo);
      const bare = makeBareTemplate(); cleanup.push(bare);
      const r = runUpdater(repo, ["--remote", bare, "--allow-remote"]);
      return r.status === 0 && /DRY-RUN|up to date/i.test(r.out);
    },
  },
];

let failed = 0;
for (const c of cases) {
  let ok = false;
  try { ok = c.run(); } catch { ok = false; }
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}`);
}
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed > 0 ? 1 : 0);
