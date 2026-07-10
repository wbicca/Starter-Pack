#!/usr/bin/env node
// Smoke test for the five .claude/hooks/* hooks — table-driven, node: builtins only.
//
// Each case pipes a hook payload into `node <hook>` (CLAUDE_PROJECT_DIR = repo root)
// and asserts the resulting permissionDecision. "pass" = silent pass-through (no
// stdout, exit 0). Cases encode real incidents (sanitizer bypass via `;`, `=>` /
// `Promise<T>` false positives, placeholder-allowlist inversion) plus the core
// protections, written against the post-hardening behavior.
//
// Secret-shaped fixtures are constructed at RUNTIME so this source file never
// contains anything the secret scanners would match.
//
// Run: node scripts/quality/hook-smoke.mjs   → PASS/FAIL table, exit 1 on any FAIL.

import { spawnSync } from "node:child_process";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, tmpdir } from "node:os";
import { realpathSync, mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

const HOOKS = {
  "write-guard":  ".claude/hooks/orchestrator-write-guard.mjs",
  "scan-secrets": ".claude/hooks/scan-secrets.mjs",
  "danger-bash":  ".claude/hooks/block-dangerous-bash.mjs",
  "sensitive":    ".claude/hooks/protect-sensitive-files.mjs",
  "format":       ".claude/hooks/format-after-edit.mjs",
};

// --- payload builders ----------------------------------------------------------

const bash = (command, agent) => ({
  tool_name: "Bash", tool_input: { command }, cwd: root,
  ...(agent ? { agent_id: "smoke-agent", agent_type: agent } : {}),
});
const write = (file_path, agent) => ({
  tool_name: "Write", tool_input: { file_path, content: "smoke" }, cwd: root,
  ...(agent ? { agent_id: "smoke-agent", agent_type: agent } : {}),
});
const notebook = (notebook_path, agent) => ({
  tool_name: "NotebookEdit", tool_input: { notebook_path, new_source: "smoke" }, cwd: root,
  ...(agent ? { agent_id: "smoke-agent", agent_type: agent } : {}),
});
const content = (text) => ({
  tool_name: "Write", tool_input: { file_path: "src/config.ts", content: text }, cwd: root,
});

// --- runtime-built fixtures ------------------------------------------------------

const ALNUM = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const randAlnum = (n) =>
  Array.from({ length: n }, () => ALNUM[Math.floor(Math.random() * ALNUM.length)]).join("");
const b64url = (obj) => Buffer.from(JSON.stringify(obj)).toString("base64url");
// jwtPayload builds a JWT from an ARBITRARY payload object so forged / minimal anon
// tokens (self-declared role, no Supabase signal) can be exercised on the deny path.
const jwtPayload = (payload) => `${b64url({ alg: "HS256", typ: "JWT" })}.${b64url(payload)}.${randAlnum(16)}`;
const jwt = (role) => jwtPayload({ role });
const LIVE_KEY = "sk_live_" + randAlnum(24);          // fabricated, never a real key
const JWT_KEY = ["JWT", "SECRET"].join("_");          // avoids the literal in this source
const STRIPE_KEY = ["STRIPE", "SECRET", "KEY"].join("_");
const API_URL_KEY = ["API", "URL"].join("_");
const ENTROPIC = "aB3" + randAlnum(17);               // 20 chars, >= 3 classes guaranteed
// Dotted high-entropy literal: two alnum runs joined by a dot, >= 16 chars, >= 3 classes.
// Clears the credential bar, so the identifier/property-chain escape must NOT fire (F4).
const DOTTED_SECRET = "aB3" + randAlnum(6) + "." + randAlnum(12);

// The write-guard whitelists the EXACT os.tmpdir() (real path) — pick a /var/folders
// sibling guaranteed to live outside it, and the current project's memory slug.
const realTmp = (() => { try { return realpathSync(tmpdir()); } catch { return tmpdir(); } })();
const varFoldersOutside = ["/var/folders/zz/hook-smoke-not-tmp", "/var/folders/qq/hook-smoke-not-tmp"]
  .find((p) => !realTmp.startsWith(p) && !p.startsWith(realTmp) &&
               !tmpdir().startsWith(p) && !p.startsWith(tmpdir())) + "/notes.md";
const PROJECT_SLUG = root.replace(/[/ ]/g, "-");
// Fake CLAUDE_CONFIG_DIR (F7): out-of-root and NOT under /tmp, /private/tmp, or
// ~/.claude — so the same memory path passes ONLY when the env var is honored.
const FAKE_CONFIG_DIR = join(homedir(), ".claude-smoke-config");

// --- exposure / profile fixtures (runtime temp dirs) -----------------------------
// GIT_FIX: a real git repo whose .gitignore ignores ONLY ".env" and "notes.local.md".
//   → ".env" is ignored-and-untracked (never committable): exposure policy allows it.
//   → ".env.production" is NOT ignored (versionable): exposure policy blocks it.
//   Its docs/STACK.md declares Profile: standard.
// LIGHT_FIX: same shape, but docs/STACK.md declares Profile: light.
// NOGIT_FIX: not a git repo and no docs/ — exercises both fail-safes
//   (isVersionable → true → block; readProfile → standard).
function makeFixture(name, profile) {
  const dir = mkdtempSync(join(realTmp, `hook-smoke-${name}-`));
  if (profile) {
    spawnSync("git", ["init", "-q"], { cwd: dir, encoding: "utf8" });
    writeFileSync(join(dir, ".gitignore"), ".env\nnotes.local.md\n");
    mkdirSync(join(dir, "docs"), { recursive: true });
    writeFileSync(
      join(dir, "docs", "STACK.md"),
      `# Stack\n\n> **Status: CONFIGURED**\n> **Profile: ${profile}**  (allowed values: standard · light)\n`,
    );
  }
  return dir;
}
const GIT_FIX = makeFixture("git", "standard");
const LIGHT_FIX = makeFixture("light", "light");
const NOGIT_FIX = makeFixture("nogit", null);
// BADPROF_FIX: an unknown profile value ("lightweight") must fall back to standard —
// pins the \b boundary in readProfile (without it, "lightweight" parses as "light").
const BADPROF_FIX = makeFixture("badprof", "lightweight");
// TRACKED_FIX: the dangerous real-world case — a .env COMMITTED by mistake and only
// then git-ignored. check-ignore says "ignored", but the file is tracked, so it is
// still versionable (its content is in history and future edits would be committed).
// Pins the ls-files-before-check-ignore ordering inside isVersionable.
function makeTrackedEnvFixture() {
  const dir = mkdtempSync(join(realTmp, "hook-smoke-tracked-"));
  const g = (args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" });
  g(["init", "-q"]);
  g(["config", "user.email", "smoke@example.invalid"]);
  g(["config", "user.name", "hook-smoke"]);
  writeFileSync(join(dir, ".env"), "KEY=placeholder\n");
  g(["add", "-f", ".env"]);
  g(["commit", "-q", "-m", "fixture: committed .env"]);
  writeFileSync(join(dir, ".gitignore"), ".env\n");
  return dir;
}
const TRACKED_FIX = makeTrackedEnvFixture();
process.on("exit", () => {
  for (const d of [GIT_FIX, LIGHT_FIX, NOGIT_FIX, TRACKED_FIX, BADPROF_FIX]) rmSync(d, { recursive: true, force: true });
});

// Per-root payload builders (fixture cases must set BOTH payload.cwd and the
// per-case env CLAUDE_PROJECT_DIR to the fixture root).
const bashAt = (root, command) => ({ tool_name: "Bash", tool_input: { command }, cwd: root });
const writeAt = (root, file_path, text = "smoke") => ({
  tool_name: "Write", tool_input: { file_path, content: text }, cwd: root,
});

// --- case table ------------------------------------------------------------------

const cases = [
  // write-guard: main window (no agent_id) — Bash
  { hook: "write-guard", name: "main bash: grep => in .ts (no write)", expect: "pass",
    payload: bash(`grep -rn "=>" src/index.ts`) },
  { hook: "write-guard", name: "main bash: 2>/dev/null then ; (sanitizer)", expect: "pass",
    payload: bash(`ls .claude/hooks 2>/dev/null; echo done`) },
  { hook: "write-guard", name: "main bash: redirect into .claude/", expect: "deny",
    payload: bash(`echo hi > .claude/settings.json`) },
  { hook: "write-guard", name: "main bash: redirect into app code (standard → ask)", expect: "ask",
    payload: bash(`echo hi > src/app.ts`) },

  // write-guard: read-only subagent — Bash
  { hook: "write-guard", name: "code-reviewer bash: grep Promise<T>", expect: "pass",
    payload: bash(`grep -rn "Promise<T>" src/`, "code-reviewer") },
  { hook: "write-guard", name: "code-reviewer bash: sed -i mutation", expect: "deny",
    payload: bash(`sed -i '' 's/a/b/' src/x.ts`, "code-reviewer") },
  { hook: "write-guard", name: "code-reviewer bash: newline then cp", expect: "deny",
    payload: bash("true \n cp src/app.ts /tmp/x.ts", "code-reviewer") },
  { hook: "write-guard", name: "code-reviewer bash: xargs cp", expect: "deny",
    payload: bash(`find . | xargs cp -t /tmp`, "code-reviewer") },
  { hook: "write-guard", name: "main bash: newline then tee .claude/", expect: "deny",
    payload: bash("true \n tee .claude/settings.json") },
  // write-guard: command-position openers — backtick & bare `(` (F2)
  { hook: "write-guard", name: "main bash: backtick cp into .claude/hooks", expect: "deny",
    payload: bash("`cp /etc/hosts .claude/hooks/x.mjs`") },
  { hook: "write-guard", name: "code-reviewer bash: backtick cp into .claude/hooks", expect: "deny",
    payload: bash("`cp /etc/hosts .claude/hooks/x.mjs`", "code-reviewer") },
  { hook: "write-guard", name: "main bash: (tee .claude/settings.json)", expect: "deny",
    payload: bash("(tee .claude/settings.json)") },
  { hook: "write-guard", name: "code-reviewer bash: (cp src/a.ts /tmp/x)", expect: "deny",
    payload: bash("(cp src/a.ts /tmp/x)", "code-reviewer") },

  // write-guard: main window — Write
  { hook: "write-guard", name: "main write: /tmp scratchpad (whitelist)", expect: "pass",
    payload: write("/tmp/scratch/notes.md") },
  { hook: "write-guard", name: "main write: out-of-root non-temp", expect: "deny",
    payload: write(join(homedir(), "elsewhere", "x.md")) },
  { hook: "write-guard", name: "main write: /var/folders outside tmpdir", expect: "deny",
    payload: write(varFoldersOutside) },
  { hook: "write-guard", name: "main write: other project's memory", expect: "deny",
    payload: write(join(homedir(), ".claude", "projects", "-Some-Other-Project", "memory", "x.md")) },
  { hook: "write-guard", name: "main write: this project's memory", expect: "pass",
    payload: write(join(homedir(), ".claude", "projects", PROJECT_SLUG, "memory", "x.md")) },
  // write-guard: CLAUDE_CONFIG_DIR is honored for this project's memory dir (F7) —
  // per-case env (c.env) is merged into the spawn env; without it the path is out-of-root.
  { hook: "write-guard", name: "main write: custom config-dir memory (env set)", expect: "pass",
    env: { CLAUDE_CONFIG_DIR: FAKE_CONFIG_DIR },
    payload: write(join(FAKE_CONFIG_DIR, "projects", PROJECT_SLUG, "memory", "x.md")) },
  { hook: "write-guard", name: "main write: custom config-dir memory (env unset)", expect: "deny",
    payload: write(join(FAKE_CONFIG_DIR, "projects", PROJECT_SLUG, "memory", "x.md")) },
  { hook: "write-guard", name: "main write: src/app.mjs (standard → ask)", expect: "ask",
    payload: write("src/app.mjs") },
  { hook: "write-guard", name: "main write: scripts/quality/ (governance)", expect: "deny",
    payload: write("scripts/quality/quick-check.mjs") },

  // write-guard: subagents — Write (governance symmetry)
  { hook: "write-guard", name: "frontend-eng write: CLAUDE.md", expect: "ask",
    payload: write("CLAUDE.md", "frontend-engineer") },
  { hook: "write-guard", name: "frontend-eng write: .claude/hooks/x.mjs", expect: "ask",
    payload: write(".claude/hooks/x.mjs", "frontend-engineer") },
  { hook: "write-guard", name: "frontend-eng write: src/app.ts", expect: "pass",
    payload: write("src/app.ts", "frontend-engineer") },
  { hook: "write-guard", name: "code-reviewer write: src/app.ts", expect: "deny",
    payload: write("src/app.ts", "code-reviewer") },
  // write-guard: os.tmpdir() no longer trusted — /var/folders sibling denies (F1)
  { hook: "write-guard", name: "main write: /var/folders not under real tmpdir (F1)", expect: "deny",
    payload: write(varFoldersOutside) },

  // write-guard: NotebookEdit (F6) — notebook_path fallback + matcher coverage
  { hook: "write-guard", name: "main notebook: .claude/x.ipynb (governance)", expect: "deny",
    payload: notebook(".claude/x.ipynb") },
  { hook: "write-guard", name: "frontend-eng notebook: notebooks/a.ipynb", expect: "pass",
    payload: notebook("notebooks/a.ipynb", "frontend-engineer") },

  // write-guard: agent-worktree normalization — paths under .claude/worktrees/<name>/
  // are judged by their INNER relative path (field-test blocker: implementer writes
  // inside its own worktree must pass; smuggled governance copies stay protected).
  { hook: "write-guard", name: "frontend-eng write: worktree src/app.ts", expect: "pass",
    payload: write(".claude/worktrees/agent-1/src/app.ts", "frontend-engineer") },
  { hook: "write-guard", name: "frontend-eng write: worktree CLAUDE.md", expect: "ask",
    payload: write(".claude/worktrees/agent-1/CLAUDE.md", "frontend-engineer") },
  { hook: "write-guard", name: "frontend-eng write: worktree .claude/hooks/x.mjs", expect: "ask",
    payload: write(".claude/worktrees/agent-1/.claude/hooks/x.mjs", "frontend-engineer") },
  { hook: "write-guard", name: "main write: worktree src/app.ts (standard → ask)", expect: "ask",
    payload: write(".claude/worktrees/agent-1/src/app.ts") },
  { hook: "write-guard", name: "backend-eng bash: tee worktree src/api.ts", expect: "pass",
    payload: bash(`tee ".claude/worktrees/agent-1/src/api.ts" < /dev/null`, "backend-engineer") },
  { hook: "write-guard", name: "main bash: tee worktree src/api.ts (standard → ask)", expect: "ask",
    payload: bash(`tee ".claude/worktrees/agent-1/src/api.ts" < /dev/null`) },
  { hook: "write-guard", name: "code-reviewer bash: cat worktree src/api.ts", expect: "pass",
    payload: bash(`cat .claude/worktrees/agent-1/src/api.ts`, "code-reviewer") },

  // write-guard: profiles — standard asks, light passes, governance never relaxes
  { hook: "write-guard", name: "light profile: main write app code → pass", expect: "pass",
    env: { CLAUDE_PROJECT_DIR: LIGHT_FIX }, payload: writeAt(LIGHT_FIX, "src/app.ts") },
  { hook: "write-guard", name: "light profile: main bash redirect app code → pass", expect: "pass",
    env: { CLAUDE_PROJECT_DIR: LIGHT_FIX }, payload: bashAt(LIGHT_FIX, `echo hi > src/app.ts`) },
  { hook: "write-guard", name: "light profile: governance still denied", expect: "deny",
    env: { CLAUDE_PROJECT_DIR: LIGHT_FIX }, payload: writeAt(LIGHT_FIX, ".claude/settings.json") },
  { hook: "write-guard", name: "standard fixture: main write app code → ask", expect: "ask",
    env: { CLAUDE_PROJECT_DIR: GIT_FIX }, payload: writeAt(GIT_FIX, "src/app.ts") },
  { hook: "write-guard", name: "no STACK.md: profile falls back to standard → ask", expect: "ask",
    env: { CLAUDE_PROJECT_DIR: NOGIT_FIX }, payload: writeAt(NOGIT_FIX, "src/app.ts") },
  { hook: "write-guard", name: "unknown profile 'lightweight' → standard → ask", expect: "ask",
    env: { CLAUDE_PROJECT_DIR: BADPROF_FIX }, payload: writeAt(BADPROF_FIX, "src/app.ts") },
  { hook: "write-guard", name: "light profile: out-of-root write still denied", expect: "deny",
    env: { CLAUDE_PROJECT_DIR: LIGHT_FIX }, payload: writeAt(LIGHT_FIX, "../escape/x.ts") },
  { hook: "write-guard", name: "light profile: bash governance write still denied", expect: "deny",
    env: { CLAUDE_PROJECT_DIR: LIGHT_FIX }, payload: bashAt(LIGHT_FIX, `echo hi > .claude/settings.json`) },

  // scan-secrets
  { hook: "scan-secrets", name: "env-var reference is code, not secret", expect: "pass",
    payload: content(`${JWT_KEY}: process.env.${JWT_KEY},`) },
  { hook: "scan-secrets", name: ".env.example placeholder value", expect: "pass",
    payload: content(`API_KEY=your_key_here`) },
  { hook: "scan-secrets", name: "high-entropy live-key literal", expect: "deny",
    payload: content(`API_KEY="${LIVE_KEY}"`) },
  { hook: "scan-secrets", name: "unquoted high-entropy literal", expect: "deny",
    payload: content(`${STRIPE_KEY}=${ENTROPIC}`) },
  { hook: "scan-secrets", name: "quoted literal + trailing semicolon", expect: "deny",
    payload: content(`const ${STRIPE_KEY} = "${ENTROPIC}";`) },
  { hook: "scan-secrets", name: "JWT role=anon + supabase iss (Supabase public)", expect: "pass",
    payload: content(`const KEY = "${jwtPayload({ role: "anon", iss: "https://abc.supabase.co/auth/v1" })}";`) },
  { hook: "scan-secrets", name: "JWT with role=service_role", expect: "deny",
    payload: content(`const KEY = "${jwt("service_role")}";`) },
  // scan-secrets: identifier/property-chain escape must NOT fire for credential-shaped
  // values (F4) — dotted high-entropy and paren-bearing high-entropy literals deny.
  { hook: "scan-secrets", name: "dotted high-entropy literal (F4)", expect: "deny",
    payload: content(`${JWT_KEY}="${DOTTED_SECRET}"`) },
  { hook: "scan-secrets", name: "paren-bearing high-entropy literal (F4)", expect: "deny",
    payload: content(`${JWT_KEY}="aB3${randAlnum(6)}(${randAlnum(12)})"`) },
  { hook: "scan-secrets", name: "process.env reference stays code (F4 env-marker)", expect: "pass",
    payload: content(`${API_URL_KEY}=process.env.${API_URL_KEY}`) },
  // scan-secrets: anon JWT needs a Supabase structural signal (F5)
  { hook: "scan-secrets", name: "forged anon JWT, no supabase signal (F5)", expect: "deny",
    payload: content(`const KEY = "${jwtPayload({ role: "anon" })}";`) },
  { hook: "scan-secrets", name: "anon JWT with ref claim (F5)", expect: "pass",
    payload: content(`const KEY = "${jwtPayload({ role: "anon", ref: "abcdefghijklmnop" })}";`) },

  // scan-secrets: exposure-based — content written to an ignored+untracked file
  // can never be committed, so literal credentials there are allowed.
  { hook: "scan-secrets", name: "fixture: live key into ignored .env → pass", expect: "pass",
    env: { CLAUDE_PROJECT_DIR: GIT_FIX },
    payload: writeAt(GIT_FIX, ".env", `API_KEY="${LIVE_KEY}"`) },
  { hook: "scan-secrets", name: "fixture: live key into ignored notes.local.md → pass", expect: "pass",
    env: { CLAUDE_PROJECT_DIR: GIT_FIX },
    payload: writeAt(GIT_FIX, "notes.local.md", `API_KEY="${LIVE_KEY}"`) },
  { hook: "scan-secrets", name: "fixture: live key into versionable src file → deny", expect: "deny",
    env: { CLAUDE_PROJECT_DIR: GIT_FIX },
    payload: writeAt(GIT_FIX, "src/config.ts", `API_KEY="${LIVE_KEY}"`) },

  // block-dangerous-bash
  { hook: "danger-bash", name: "trailing comment is stripped", expect: "pass",
    payload: bash(`true # git reset --hard`) },
  { hook: "danger-bash", name: "git reset --hard", expect: "ask",
    payload: bash(`git reset --hard`) },
  { hook: "danger-bash", name: "rm -rf / (catastrophic)", expect: "deny",
    payload: bash(`rm -rf /`) },
  // block-dangerous-bash: shell-metachar terminators after the target (F3)
  { hook: "danger-bash", name: "rm -rf /; echo done (semicolon terminator)", expect: "deny",
    payload: bash(`rm -rf /; echo done`) },
  { hook: "danger-bash", name: "backtick rm -rf / (backtick terminator)", expect: "deny",
    payload: bash("`rm -rf /`") },
  { hook: "danger-bash", name: "rm -rf node_modules (critical dir)", expect: "ask",
    payload: bash(`rm -rf node_modules`) },
  { hook: "danger-bash", name: "fork bomb", expect: "deny",
    payload: bash(`:(){ :|:& };:`) },

  // block-dangerous-bash: exposure-based env targets + git add -f confirmation
  { hook: "danger-bash", name: "fixture: echo > ignored .env → pass", expect: "pass",
    env: { CLAUDE_PROJECT_DIR: GIT_FIX },
    payload: bashAt(GIT_FIX, `echo "KEY=value" > .env`) },
  { hook: "danger-bash", name: "fixture: echo > versionable .env.production → deny", expect: "deny",
    env: { CLAUDE_PROJECT_DIR: GIT_FIX },
    payload: bashAt(GIT_FIX, `echo "KEY=value" > .env.production`) },
  { hook: "danger-bash", name: "git add -f (force-add ignored file)", expect: "ask",
    payload: bash(`git add -f .env`) },
  { hook: "danger-bash", name: "git add --force", expect: "ask",
    payload: bash(`git add --force notes.local.md`) },
  { hook: "danger-bash", name: "plain git add (no force)", expect: "pass",
    payload: bash(`git add src/app.ts`) },

  // protect-sensitive-files
  { hook: "sensitive", name: "write real .env (git-ignored here) — exposure allows", expect: "pass",
    payload: write(".env") },
  { hook: "sensitive", name: "write .env.example template", expect: "pass",
    payload: write(".env.example") },
  { hook: "sensitive", name: "write .env.staging (git-ignored here) — exposure allows", expect: "pass",
    payload: write(".env.staging") },
  { hook: "sensitive", name: "write .env.local.example template", expect: "pass",
    payload: write(".env.local.example") },

  // protect-sensitive-files: exposure-based policy (fixture repos)
  { hook: "sensitive", name: "fixture: .env ignored+untracked → pass", expect: "pass",
    env: { CLAUDE_PROJECT_DIR: GIT_FIX }, payload: writeAt(GIT_FIX, ".env") },
  { hook: "sensitive", name: "fixture: .env.production versionable → deny", expect: "deny",
    env: { CLAUDE_PROJECT_DIR: GIT_FIX }, payload: writeAt(GIT_FIX, ".env.production") },
  { hook: "sensitive", name: "fixture: no git repo → fail-safe deny", expect: "deny",
    env: { CLAUDE_PROJECT_DIR: NOGIT_FIX }, payload: writeAt(NOGIT_FIX, ".env") },

  // exposure policy: tracked-AND-ignored .env stays blocked in every hook (the file
  // is in history — ls-files must win over check-ignore).
  { hook: "sensitive", name: "fixture: tracked+ignored .env → deny", expect: "deny",
    env: { CLAUDE_PROJECT_DIR: TRACKED_FIX }, payload: writeAt(TRACKED_FIX, ".env") },
  { hook: "scan-secrets", name: "fixture: live key into tracked+ignored .env → deny", expect: "deny",
    env: { CLAUDE_PROJECT_DIR: TRACKED_FIX },
    payload: writeAt(TRACKED_FIX, ".env", `API_KEY="${LIVE_KEY}"`) },
  { hook: "danger-bash", name: "fixture: echo > tracked+ignored .env → deny", expect: "deny",
    env: { CLAUDE_PROJECT_DIR: TRACKED_FIX },
    payload: bashAt(TRACKED_FIX, `echo "KEY=value" > .env`) },

  // format-after-edit (PostToolUse — must always stay silent / non-blocking)
  { hook: "format", name: "edit payload without file-scoped script", expect: "pass",
    payload: { tool_name: "Write", tool_input: { file_path: join(root, "src/app.ts") }, cwd: root } },
];

// --- runner ---------------------------------------------------------------------

const env = { ...process.env, CLAUDE_PROJECT_DIR: root };
delete env.CLAUDE_ORCHESTRATOR_WRITE_OVERRIDE; // main-window cases assume no override
delete env.CLAUDE_CONFIG_DIR; // config-dir cases opt in per-case via c.env

function runCase(c) {
  const r = spawnSync(process.execPath, [join(root, HOOKS[c.hook])], {
    input: JSON.stringify(c.payload), encoding: "utf8",
    env: c.env ? { ...env, ...c.env } : env, cwd: root, timeout: 15_000,
  });
  const out = (r.stdout ?? "").trim();
  if (!out) return r.status === 0 ? "pass" : `exit-${r.status}`;
  try {
    const d = JSON.parse(out)?.hookSpecificOutput?.permissionDecision;
    return d ?? (r.status === 0 ? "pass" : `exit-${r.status}`);
  } catch {
    return "bad-stdout";
  }
}

let failed = 0;
const rows = cases.map((c) => {
  const got = runCase(c);
  const ok = got === c.expect;
  if (!ok) failed++;
  return { status: ok ? "PASS" : "FAIL", hook: c.hook, name: c.name, expect: c.expect, got };
});

const w = {
  status: 8, hook: Math.max(...rows.map((r) => r.hook.length)) + 2,
  name: Math.max(...rows.map((r) => r.name.length)) + 2, expect: 8,
};
console.log(
  "STATUS".padEnd(w.status) + "HOOK".padEnd(w.hook) + "CASE".padEnd(w.name) +
  "EXPECT".padEnd(w.expect) + "GOT");
for (const r of rows) {
  console.log(
    r.status.padEnd(w.status) + r.hook.padEnd(w.hook) + r.name.padEnd(w.name) +
    r.expect.padEnd(w.expect) + r.got);
}
console.log(`\n${rows.length - failed}/${rows.length} passed`);
process.exit(failed > 0 ? 1 : 0);
