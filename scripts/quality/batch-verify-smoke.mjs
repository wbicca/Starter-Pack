#!/usr/bin/env node
// Smoke test for scripts/quality/batch-verify.mjs — table-driven, node: builtins only.
// Each case builds a temp git fixture (README committed, optional docs/STACK.md,
// optional app/test change) and asserts batch-verify's exit code and key stderr
// markers. Commands in fixtures are `node -e "process.exit(0|1)"` so no real
// toolchain is needed.
//
// Run: node scripts/quality/batch-verify-smoke.mjs → PASS/FAIL table, exit 1 on FAIL.

import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, realpathSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = join(root, "scripts", "quality", "batch-verify.mjs");
const realTmp = (() => { try { return realpathSync(tmpdir()); } catch { return tmpdir(); } })();

const OK = `node -e "process.exit(0)"`;
const BAD = `node -e "process.exit(1)"`;

// Build a docs/STACK.md with the real Commands-table shape. Purposes left undefined
// render as `TBD | UNCONFIGURED`. `extraRows` appends raw table rows after Build (for
// pinning malformed-row handling). `crlf` converts the final string to CRLF line endings.
function stackMd({ profile = "standard", lint, typecheck, test, build, extraRows = [], crlf = false } = {}) {
  const row = (p, c) => (c ? `| ${p} | ${c} | CONFIGURED |` : `| ${p} | TBD | UNCONFIGURED |`);
  const out = [
    "# Stack", "",
    "> **Status: CONFIGURED**",
    `> **Profile: ${profile}**`, "",
    "## Commands", "",
    "| Purpose | Command | Status |",
    "|---|---|---|",
    row("Lint", lint), row("Typecheck", typecheck), row("Test", test), row("Build", build),
    ...extraRows,
    "| Install | TBD | UNCONFIGURED |",
    "| Format | TBD | UNCONFIGURED |",
    "| E2E | TBD | UNCONFIGURED |",
    "| Security | TBD | UNCONFIGURED |",
    "",
  ].join("\n");
  return crlf ? out.replace(/\n/g, "\r\n") : out;
}

function makeFixture({ stack, appChange = true, testChange = false, commitAppChange = false,
                       branchAppChange = false, staleDeliveryLog = false, squashDeliveryLog = false,
                       uiChange = false, nogit = false } = {}) {
  const dir = mkdtempSync(join(realTmp, "batch-verify-smoke-"));
  const g = (args, env) => (nogit ? { status: 0 } : spawnSync("git", args, {
    cwd: dir, encoding: "utf8", ...(env ? { env: { ...process.env, ...env } } : {}),
  }));
  g(["init", "-q"]);
  g(["config", "user.email", "smoke@example.invalid"]);
  g(["config", "user.name", "batch-verify-smoke"]);
  writeFileSync(join(dir, "README.md"), "fixture\n");
  if (stack !== null && stack !== undefined) {
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(join(dir, "docs", "STACK.md"), stack);
  }
  g(["add", "."]);
  g(["commit", "-q", "-m", "init"]);
  if (staleDeliveryLog) {
    // DELIVERY_LOG committed on day 1, a merge lands on day 2 → the log is stale.
    // Explicit dates keep the %ct comparison deterministic (same-second commits
    // would make it flaky).
    const OLD = { GIT_COMMITTER_DATE: "2026-01-01T00:00:00 +0000", GIT_AUTHOR_DATE: "2026-01-01T00:00:00 +0000" };
    const NEW = { GIT_COMMITTER_DATE: "2026-01-02T00:00:00 +0000", GIT_AUTHOR_DATE: "2026-01-02T00:00:00 +0000" };
    writeFileSync(join(dir, "docs", "DELIVERY_LOG.md"), "# Delivery Log\n");
    g(["add", "."]); g(["commit", "-q", "-m", "log"], OLD);
    g(["checkout", "-q", "-b", "side"]);
    writeFileSync(join(dir, "side.md"), "side\n");
    g(["add", "."]); g(["commit", "-q", "-m", "side"], OLD);
    g(["checkout", "-q", "-"]);
    g(["merge", "-q", "--no-ff", "side", "-m", "merge side"], NEW);
  }
  if (squashDeliveryLog) {
    // Same staleness, but the later work lands as a SQUASH merge (single-parent) —
    // `git log --merges` is empty here, so the old detection silently missed it.
    const OLD = { GIT_COMMITTER_DATE: "2026-01-01T00:00:00 +0000", GIT_AUTHOR_DATE: "2026-01-01T00:00:00 +0000" };
    const NEW = { GIT_COMMITTER_DATE: "2026-01-02T00:00:00 +0000", GIT_AUTHOR_DATE: "2026-01-02T00:00:00 +0000" };
    writeFileSync(join(dir, "docs", "DELIVERY_LOG.md"), "# Delivery Log\n");
    g(["add", "."]); g(["commit", "-q", "-m", "log"], OLD);
    g(["checkout", "-q", "-b", "side"]);
    writeFileSync(join(dir, "side.md"), "side\n");
    g(["add", "."]); g(["commit", "-q", "-m", "side"], OLD);
    g(["checkout", "-q", "-"]);
    g(["merge", "-q", "--squash", "side"]);
    g(["commit", "-q", "-m", "squash side"], NEW);
  }
  if (branchAppChange) {
    // Fully committed app change on a FEATURE branch: the working tree is clean, so
    // only the merge-base fallback can surface it.
    g(["checkout", "-q", "-b", "feature"]);
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "app.ts"), "export const x = 1;\n");
    g(["add", "."]);
    g(["commit", "-q", "-m", "app change on feature"]);
  } else if (commitAppChange) {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "app.ts"), "export const x = 1;\n");
    g(["add", "."]);
    g(["commit", "-q", "-m", "app change"]);
  } else if (appChange) {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "app.ts"), "export const x = 1;\n");
  }
  if (uiChange) {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "App.tsx"), "export const App = () => null;\n");
  }
  if (testChange) {
    mkdirSync(join(dir, "src"), { recursive: true });
    writeFileSync(join(dir, "src", "app.test.ts"), "// test\n");
  }
  return dir;
}

const cases = [
  { name: "all configured, green → exit 0", exit: 0,
    fx: { stack: stackMd({ lint: OK, typecheck: OK, test: OK, build: OK }) } },
  { name: "Test failing → exit 1", exit: 1,
    fx: { stack: stackMd({ test: BAD }) } },
  { name: "fail-fast: Lint fails, Test not run", exit: 1, stderrHas: "NOT RUN",
    fx: { stack: stackMd({ lint: BAD, test: OK }) } },
  { name: "Test TBD + app diff + standard → exit 2", exit: 2, stderrHas: "BLOCKER",
    fx: { stack: stackMd({}) } },
  { name: "Test TBD + app diff + light → warning, exit 0", exit: 0,
    stderrHas: "light profile", fx: { stack: stackMd({ profile: "light" }) } },
  { name: "waiver --accept-unconfigured → exit 0", exit: 0, stderrHas: "waived",
    args: ["--accept-unconfigured"], fx: { stack: stackMd({}) } },
  { name: "app change without test change → warning", exit: 0,
    stderrHas: "without any test change", fx: { stack: stackMd({ test: OK }) } },
  { name: "app + test change → no test-gap warning", exit: 0,
    stderrNotHas: "without any test change",
    fx: { stack: stackMd({ test: OK }), testChange: true } },
  { name: "STACK.md missing + app diff → exit 2 (fail-safe standard)", exit: 2,
    fx: { stack: null } },
  { name: "no changes + Test TBD → pass (nothing to guard)", exit: 0,
    fx: { stack: stackMd({}), appChange: false } },
  { name: "malformed row (extra column) → warning, not silent drop", exit: 0,
    stderrHas: "not recognized as CONFIGURED",
    fx: { stack: stackMd({ test: OK, extraRows: ['| Build | npm run build | CONFIGURED | note |'] }) } },
  { name: "backticked command cell runs fine", exit: 0, stderrHas: "Test: ",
    fx: { stack: stackMd({ test: "`" + OK + "`" }) } },
  { name: "bold status parses as configured", exit: 1,
    fx: { stack: stackMd({}).replace("| Test | TBD | UNCONFIGURED |", `| Test | ${BAD} | **CONFIGURED** |`) } },
  { name: "CRLF STACK.md parses", exit: 1,
    fx: { stack: stackMd({ test: BAD, crlf: true }) } },
  { name: "--range with valid base → runs & guards", exit: 2, stderrHas: "BLOCKER",
    args: ["--range", "HEAD~1"], fx: { stack: stackMd({}), commitAppChange: true } },
  { name: "--range with bad ref → hard exit 1", exit: 1, stderrHas: "Failing closed",
    args: ["--range", "no-such-ref"], fx: { stack: stackMd({ test: OK }) } },
  // v1.3: a literal `|` inside the command cell must not corrupt the row (the old
  // regex spilled `| tee …` into the Status column → silent NOT CONFIGURED).
  { name: "pipe inside command cell parses & runs", exit: 0, stderrHas: "Test: ",
    fx: { stack: stackMd({ test: `${OK} | ${OK}` }) } },
  { name: "pipe inside command cell — failing tail propagates", exit: 1,
    fx: { stack: stackMd({ test: `${OK} | ${BAD}` }) } },
  // v1.3: per-command timeout is reported as TIMEOUT (and the process group is
  // reaped — no orphaned grandchildren keeping CI busy).
  { name: "command timeout → TIMEOUT result, exit 1", exit: 1, stderrHas: "TIMEOUT",
    env: { BATCH_VERIFY_TIMEOUT_MS: "500" },
    fx: { stack: stackMd({ test: `node -e "setTimeout(()=>{},10000)"` }) } },
  // v1.3: pins the documented asymmetry — local mode FAILS OPEN when git is
  // unavailable (CI --range mode fails closed, pinned above).
  { name: "no git repo → fail-open warning, exit 0", exit: 0, stderrHas: "git unavailable",
    fx: { stack: stackMd({}), nogit: true } },
  // v1.4: committed feature-branch work must not slip past the app-code guard —
  // a clean working tree falls back to the merge-base diff vs the default branch.
  { name: "committed feature branch caught via merge-base fallback → exit 2", exit: 2,
    stderrHas: "BLOCKER", fx: { stack: stackMd({}), appChange: false, branchAppChange: true } },
  // v1.4: a PASS with zero configured commands must say it verified nothing.
  { name: "zero configured commands + app diff (light) → verified-nothing warning", exit: 0,
    stderrHas: "verified nothing", fx: { stack: stackMd({ profile: "light" }) } },
  // v1.4: DELIVERY_LOG older than the last merge → staleness warning (never blocks).
  { name: "DELIVERY_LOG older than last merge → staleness warning", exit: 0,
    stderrHas: "delivery-log entry",
    fx: { stack: stackMd({ test: OK }), appChange: false, staleDeliveryLog: true } },
  // v1.5: a stale log on a PASS prints the draft entry; --log appends it.
  { name: "stale DELIVERY_LOG on PASS prints draft entry", exit: 0,
    stderrHas: "Draft DELIVERY_LOG entry",
    fx: { stack: stackMd({ test: OK }), appChange: false, staleDeliveryLog: true } },
  { name: "--log appends draft entry to DELIVERY_LOG", exit: 0,
    stderrHas: "appended to docs/DELIVERY_LOG.md", args: ["--log"],
    fx: { stack: stackMd({ test: OK }), appChange: false, staleDeliveryLog: true } },
  // v1.5: every PASS prints the batch-close checklist (no impress line off UI).
  { name: "PASS prints batch close checklist", exit: 0,
    stderrHas: "Batch close checklist", stderrNotHas: "impress-gate",
    fx: { stack: stackMd({ lint: OK, typecheck: OK, test: OK, build: OK }), testChange: true } },
  // v1.5.1: a UI batch adds the impress-gate line to the checklist.
  { name: "UI batch adds impress-gate line to checklist", exit: 0,
    stderrHas: "impress-gate verdict",
    fx: { stack: stackMd({ test: OK }), uiChange: true, testChange: true } },
  // v1.5.2: staleness must also fire for squash-merged work (gauntlet C1#3 — the old
  // --merges check was empty and silently missed the default GitHub flow).
  { name: "squash-merged work makes DELIVERY_LOG stale → warning", exit: 0,
    stderrHas: "delivery-log entry",
    fx: { stack: stackMd({ test: OK }), appChange: false, squashDeliveryLog: true } },
];

let failed = 0;
const dirs = [];
for (const c of cases) {
  const dir = makeFixture(c.fx);
  dirs.push(dir);
  const r = spawnSync(process.execPath, [SCRIPT, ...(c.args ?? [])], {
    cwd: dir, encoding: "utf8", timeout: 60_000,
    env: c.env ? { ...process.env, ...c.env } : process.env,
  });
  const stderr = r.stderr ?? "";
  const okExit = r.status === c.exit;
  const okHas = !c.stderrHas || stderr.includes(c.stderrHas);
  const okNot = !c.stderrNotHas || !stderr.includes(c.stderrNotHas);
  const ok = okExit && okHas && okNot;
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${c.name}  (exit ${r.status}, expected ${c.exit})`);
  if (!ok && c.stderrHas && !okHas) console.log(`      stderr missing marker: "${c.stderrHas}"`);
  if (!ok && c.stderrNotHas && !okNot) console.log(`      stderr has forbidden marker: "${c.stderrNotHas}"`);
}
for (const d of dirs) rmSync(d, { recursive: true, force: true });
console.log(`\n${cases.length - failed}/${cases.length} passed`);
process.exit(failed ? 1 : 0);
