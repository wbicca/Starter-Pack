#!/usr/bin/env node
// starter:doctor — deterministic, read-only structural diagnostic for the Starter Pack.
//
// Reports four sections — Structure, Governance consistency, Security & hygiene, and
// Project readiness — each as OK / WARNING / BLOCKER lines, then suggested next steps.
//
// It does NOT install, build, test, format, edit any file, or run destructive commands.
// It is NOT a drift-check engine and does NOT do fragile semantic parsing of Markdown —
// it only checks deterministic structural facts (a declared thing has its file, a required
// path exists, an obvious secret/.env is versionable, STACK is filled, etc.).
//
// Exit codes: 0 = all OK or warnings only · 1 = at least one real blocker.
//
// Reuses the same primitives as quick-check.mjs (git-backed file sets, env classifiers)
// rather than duplicating its turn-level checks.

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync, statSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

// ---------------------------------------------------------------------------
// Primitives (same shape as quick-check.mjs)
// ---------------------------------------------------------------------------

function run(cmd, args = [], opts = {}) {
  const r = spawnSync(cmd, args, { encoding: "utf8", ...opts });
  return { stdout: (r.stdout ?? "").trim(), stderr: (r.stderr ?? "").trim(), status: r.status ?? 1 };
}

function repoRoot() {
  const r = run("git", ["rev-parse", "--show-toplevel"]);
  return r.status === 0 ? r.stdout : process.cwd();
}

function gitList(root, args) {
  return run("git", args, { cwd: root }).stdout.split("\n").filter(Boolean);
}

const ROOT = repoRoot();
const exists = (rel) => existsSync(resolve(ROOT, rel));
const isDir = (rel) => { try { return statSync(resolve(ROOT, rel)).isDirectory(); } catch { return false; } };
const readSafe = (rel) => { try { return readFileSync(resolve(ROOT, rel), "utf8"); } catch { return ""; } };
// Strip control characters so a crafted local file name can't inject terminal escape
// sequences when its name is echoed back in a finding message.
const stripControl = (s) => Array.from(s).map((ch) => { const c = ch.charCodeAt(0); return c < 32 || c === 127 ? " " : ch; }).join("").trim();

// ---------------------------------------------------------------------------
// Findings accumulator
// ---------------------------------------------------------------------------

const sections = [];
function section(title, fn) {
  const findings = []; // { level: 'ok'|'warn'|'block', msg }
  const ok = (m) => findings.push({ level: "ok", msg: m });
  const warn = (m) => findings.push({ level: "warn", msg: m });
  const block = (m) => findings.push({ level: "block", msg: m });
  fn({ ok, warn, block });
  sections.push({ title, findings });
}

// Require a file/dir; push block (or warn) if missing.
function requirePath(api, rel, { dir = false, level = "block", label } = {}) {
  const present = dir ? isDir(rel) : exists(rel);
  const name = label || rel;
  if (present) { api.ok(`${name} present`); return true; }
  (level === "warn" ? api.warn : api.block)(`${name} missing`);
  return false;
}

// ---------------------------------------------------------------------------
// Expected inventory (kept in sync with the repo contract)
// ---------------------------------------------------------------------------

const REQUIRED_FILES = [
  "CLAUDE.md", "AGENTS.md", "README.md", "USAGE.md", "NOTICE.md", ".gitignore",
  "docs/CONSTITUTION.md", "docs/ENGINEERING_STANDARDS.md", "docs/STACK.md",
  ".claude/settings.json",
  "scripts/quality/quick-check.mjs",
];
const REQUIRED_DIRS = [
  "docs", ".claude", ".claude/agents", ".claude/skills", ".claude/hooks",
  ".codex", ".codex/agents", ".agents/skills", "scripts/quality",
];
const EXPECTED_AGENTS = [
  "product-strategist", "system-architect", "frontend-designer", "frontend-engineer",
  "backend-engineer", "database-architect", "supabase-specialist", "devops-deployment",
  "code-reviewer", "qa-tester", "security-auditor", "documentation-writer",
];
const EXPECTED_HOOKS = [
  "orchestrator-write-guard", "block-dangerous-bash", "protect-sensitive-files",
  "scan-secrets", "format-after-edit",
];
const EXPECTED_SHARED_SKILLS = [
  "project-onboarding", "quality-gate", "refactor-pass", "release-sanity",
];
// Read-only agents must NOT be granted a write tool; worktree implementers should carry
// isolation metadata. Used by the agent-frontmatter section below.
const READ_ONLY_AGENTS = ["code-reviewer", "security-auditor", "product-strategist"];
const WORKTREE_AGENTS = [
  "frontend-designer", "frontend-engineer", "backend-engineer", "database-architect",
  "supabase-specialist", "devops-deployment", "qa-tester",
];
// Code/test-writing implementers that should also preload TDD via skills: frontmatter.
const TDD_AGENTS = ["frontend-engineer", "backend-engineer", "qa-tester"];
// Canonical starter skills named in AGENTS.md / CLAUDE.md — each must ship a SKILL.md.
const CANONICAL_SKILLS = [
  "project-onboarding", "quality-gate", "refactor-pass", "release-sanity", "skill-discovery",
];
// Codex agent TOMLs that must be registered in .codex/config.toml.
const CODEX_AGENTS = ["backend-engineer", "frontend-engineer", "code-reviewer", "security-auditor"];

// Extract the leading YAML-ish frontmatter block from a Markdown agent file.
function frontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  return m ? m[1] : "";
}
// Grab the value of a `key: value` line inside a frontmatter block (first match wins).
function fmField(fm, key) {
  const m = fm.match(new RegExp(`^${key}\\s*:\\s*(.+)$`, "m"));
  return m ? m[1].trim() : null;
}

// ---------------------------------------------------------------------------
// 1. Structure
// ---------------------------------------------------------------------------

section("Structure", (api) => {
  for (const f of REQUIRED_FILES) requirePath(api, f);
  for (const d of REQUIRED_DIRS) requirePath(api, d, { dir: true });

  const missingAgents = EXPECTED_AGENTS.filter((a) => !exists(`.claude/agents/${a}.md`));
  if (missingAgents.length) api.block(`missing agent file(s): ${missingAgents.join(", ")}`);
  else api.ok(`all ${EXPECTED_AGENTS.length} expected agents present`);

  const missingHooks = EXPECTED_HOOKS.filter((h) => !exists(`.claude/hooks/${h}.mjs`));
  if (missingHooks.length) api.block(`missing hook file(s): ${missingHooks.join(", ")}`);
  else api.ok(`all ${EXPECTED_HOOKS.length} expected hooks present`);

  const missingShared = EXPECTED_SHARED_SKILLS.filter((s) => !isDir(`.agents/skills/${s}`));
  if (missingShared.length) api.warn(`shared skill(s) not exposed to Codex: ${missingShared.join(", ")}`);
  else api.ok(`all ${EXPECTED_SHARED_SKILLS.length} shared skills exposed in .agents/skills`);

  requirePath(api, ".codex/config.toml", { label: ".codex/config.toml (Codex config)" });
});

// ---------------------------------------------------------------------------
// 1b. Agent frontmatter, canonical skills, and Codex registration
// ---------------------------------------------------------------------------

section("Agent frontmatter and skill contract", (api) => {
  // Model policy: every operational agent must be model: sonnet.
  const wrongModel = [];
  for (const a of EXPECTED_AGENTS) {
    const rel = `.claude/agents/${a}.md`;
    if (!exists(rel)) continue; // existence already blocked in Structure
    const fm = frontmatter(readSafe(rel));
    if (fmField(fm, "model") !== "sonnet") wrongModel.push(a);
  }
  if (wrongModel.length) api.block(`agent(s) not model: sonnet: ${wrongModel.join(", ")}`);
  else api.ok(`all ${EXPECTED_AGENTS.length} agents are model: sonnet`);

  // Read-only agents must not grant Write / Edit / MultiEdit on their tools: line.
  const leakyWrite = [];
  for (const a of READ_ONLY_AGENTS) {
    const rel = `.claude/agents/${a}.md`;
    if (!exists(rel)) continue;
    const tools = fmField(frontmatter(readSafe(rel)), "tools") || "";
    if (/\b(Write|Edit|MultiEdit)\b/.test(tools)) leakyWrite.push(a);
  }
  if (leakyWrite.length) api.block(`read-only agent(s) grant a write tool: ${leakyWrite.join(", ")}`);
  else api.ok(`all ${READ_ONLY_AGENTS.length} read-only agents withhold Write/Edit/MultiEdit`);

  // Worktree implementers should carry isolation: worktree (advisory metadata → warn).
  const noIsolation = [];
  for (const a of WORKTREE_AGENTS) {
    const rel = `.claude/agents/${a}.md`;
    if (!exists(rel)) continue;
    if (fmField(frontmatter(readSafe(rel)), "isolation") !== "worktree") noIsolation.push(a);
  }
  if (noIsolation.length) api.warn(`worktree implementer(s) missing isolation: worktree: ${noIsolation.join(", ")}`);
  else api.ok(`all ${WORKTREE_AGENTS.length} worktree implementers declare isolation: worktree`);

  // Worktree implementers should preload discipline skills via skills: frontmatter
  // (subagents don't get the SessionStart skill injection — advisory → warn).
  const missingPreload = [];
  for (const a of WORKTREE_AGENTS) {
    const rel = `.claude/agents/${a}.md`;
    if (!exists(rel)) continue;
    const skills = (fmField(frontmatter(readSafe(rel)), "skills") || "").split(",").map((s) => s.trim());
    if (!skills.includes("verification-before-completion")) missingPreload.push(`${a} (verification-before-completion)`);
    if (TDD_AGENTS.includes(a) && !skills.includes("test-driven-development")) missingPreload.push(`${a} (test-driven-development)`);
  }
  if (missingPreload.length) api.warn(`implementer(s) missing preloaded skill(s) in skills: frontmatter: ${missingPreload.join(", ")}`);
  else api.ok(`all ${WORKTREE_AGENTS.length} worktree implementers preload discipline skills via skills: frontmatter`);

  // Canonical starter skills must each ship a SKILL.md.
  const missingSkills = CANONICAL_SKILLS.filter((s) => !exists(`.claude/skills/${s}/SKILL.md`));
  if (missingSkills.length) api.block(`canonical starter skill(s) missing SKILL.md: ${missingSkills.join(", ")}`);
  else api.ok(`all ${CANONICAL_SKILLS.length} canonical starter skills present`);

  // Each Codex agent TOML that exists must be registered in .codex/config.toml (warn).
  const codexConfig = readSafe(".codex/config.toml");
  const unregistered = CODEX_AGENTS.filter(
    (a) => exists(`.codex/agents/${a}.toml`) && !codexConfig.includes(`[agents.${a}]`),
  );
  if (unregistered.length) api.warn(`Codex agent toml(s) not registered in .codex/config.toml: ${unregistered.join(", ")}`);
  else api.ok("all Codex agent tomls are registered in .codex/config.toml");
});

// ---------------------------------------------------------------------------
// 2. Governance consistency (deterministic cross-references only)
// ---------------------------------------------------------------------------

section("Governance consistency", (api) => {
  // Every script referenced in settings.json hooks must have its file.
  const settings = readSafe(".claude/settings.json");
  if (settings) {
    let parsed;
    try { parsed = JSON.parse(settings); } catch { parsed = null; }
    if (!parsed) api.block(".claude/settings.json is not valid JSON");
    else {
      api.ok(".claude/settings.json is valid JSON");
      // Collect hook commands referenced and confirm each .mjs target exists.
      const cmds = JSON.stringify(parsed).match(/[\w./-]+\.mjs/g) || [];
      const missing = [...new Set(cmds)]
        .map((c) => c.replace(/^.*\.claude\//, ".claude/").replace(/^.*scripts\//, "scripts/"))
        .filter((rel) => (rel.startsWith(".claude/") || rel.startsWith("scripts/")) && !exists(rel));
      if (missing.length) api.block(`settings.json references missing script(s): ${missing.join(", ")}`);
      else api.ok("settings.json hook scripts all resolve to files");
    }
  }

  // Codex hooks file should resolve its referenced scripts too.
  if (exists(".codex/hooks.json")) {
    const ch = readSafe(".codex/hooks.json");
    const cmds = (ch.match(/[\w./-]+\.mjs/g) || [])
      .map((c) => c.replace(/^.*scripts\//, "scripts/").replace(/^.*\.claude\//, ".claude/"))
      .filter((rel) => (rel.startsWith("scripts/") || rel.startsWith(".claude/")) && !exists(rel));
    if (cmds.length) api.block(`.codex/hooks.json references missing script(s): ${cmds.join(", ")}`);
    else api.ok(".codex/hooks.json scripts resolve to files");
  }

  // Governance docs (docs/CONSTITUTION.md, ENGINEERING_STANDARDS.md, STACK.md) are already
  // required in the Structure section — not re-checked here to avoid duplicate output.

  // Onboarding templates the skill promises must exist. Core templates are always written;
  // conditional ones (API_CONTRACTS/DATABASE/TESTING/DEPLOYMENT) are generated per project
  // type, so their *template* files must exist even though a given project may skip the doc.
  const tdir = ".claude/skills/project-onboarding/templates";
  const coreTemplates = ["PROJECT_BRIEF", "STACK", "ARCHITECTURE", "DECISIONS"];
  const conditionalTemplates = ["API_CONTRACTS", "DATABASE", "TESTING", "DEPLOYMENT", "DELIVERY_LOG"];
  if (!isDir(tdir)) {
    api.warn(`onboarding templates dir missing (${tdir})`);
  } else {
    const missingCore = coreTemplates.filter((t) => !exists(`${tdir}/${t}.md`));
    if (missingCore.length) api.block(`onboarding missing core template(s): ${missingCore.join(", ")}`);
    else api.ok("onboarding core templates present");
    const missingCond = conditionalTemplates.filter((t) => !exists(`${tdir}/${t}.md`));
    if (missingCond.length) api.warn(`onboarding missing conditional template(s): ${missingCond.join(", ")}`);
    else api.ok("onboarding conditional templates present");
  }
});

// ---------------------------------------------------------------------------
// 3. Security & repository hygiene (reuse quick-check classifiers)
// ---------------------------------------------------------------------------

const ENV_ALLOWED = new Set([".env.example", ".env.local.example", ".env.template"]);
const ENV_RE = /^\.env(?:\..+)?$/;
const baseName = (f) => f.split("/").pop();
const isRealEnv = (f) => ENV_RE.test(baseName(f)) && !ENV_ALLOWED.has(baseName(f));

section("Security and repository hygiene", (api) => {
  const tracked = gitList(ROOT, ["ls-files"]);
  const staged = gitList(ROOT, ["diff", "--cached", "--name-only"]);
  const modified = gitList(ROOT, ["diff", "--name-only"]);
  const untracked = gitList(ROOT, ["ls-files", "--others", "--exclude-standard"]);
  const versionable = [...new Set([...tracked, ...staged, ...modified, ...untracked])];

  // Real .env that would be committed = blocker.
  const envBad = versionable.filter(isRealEnv);
  if (envBad.length) api.block(`real .env file is versionable: ${envBad.join(", ")} — git rm --cached / rename to .env.example`);
  else api.ok("no versionable real .env files");

  // Reuse quick-check.mjs as the canonical secret scanner (do not duplicate patterns).
  const qc = resolve(ROOT, "scripts/quality/quick-check.mjs");
  if (existsSync(qc)) {
    // stdin: "ignore" so quick-check's hook-vs-CLI detection resolves to CLI mode
    // immediately (no 120ms stdin wait) and deterministically.
    const r = run("node", [qc], { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    // quick-check exits 2 on blockers, 0 otherwise; surface its stderr lines (sanitized).
    const blockerLines = (r.stderr.split("\n") || []).filter((l) => /^BLOCKER:/.test(l));
    if (r.status === 2 && blockerLines.length) {
      for (const l of blockerLines) api.block(`quick-check: ${stripControl(l.replace(/^BLOCKER:\s*/, ""))}`);
    } else {
      api.ok("quick-check secret/.env/hygiene scan clean");
    }
  } else {
    api.warn("quick-check.mjs not found — skipped secret scan reuse");
  }

  // .env.example presence is a soft signal (warn only).
  if (!exists(".env.example") && !exists(".env.template")) {
    api.warn("no .env.example / .env.template — add one when the project needs env vars");
  } else {
    api.ok(".env.example / .env.template present");
  }

  // .gitignore should ignore .env (best-effort, deterministic substring check).
  const gi = readSafe(".gitignore");
  if (gi && /(^|\n)\s*\.env(\b|\n|$)/.test(gi)) api.ok(".gitignore ignores .env");
  else if (gi) api.warn(".gitignore does not obviously ignore .env — confirm secrets can't be committed");

  // Leftover agent worktrees (.claude/worktrees/*) — each must be consolidated
  // (cherry-pick) or removed before a batch closes; a leftover means unreviewed work.
  // Warn-level: a process smell, not a broken repo. (.DS_Store is not a worktree.)
  let worktrees = [];
  try { worktrees = readdirSync(resolve(ROOT, ".claude/worktrees")); } catch { worktrees = []; }
  worktrees = worktrees.filter((e) => e !== ".DS_Store");
  if (worktrees.length) {
    api.warn(`agent worktree(s) present: ${worktrees.map(stripControl).join(", ")} — consolidate or remove before closing the batch`);
  } else {
    api.ok("no leftover agent worktrees");
  }
});

// ---------------------------------------------------------------------------
// 4. Project readiness
// ---------------------------------------------------------------------------

section("Project readiness", (api) => {
  const stack = readSafe("docs/STACK.md");
  if (!stack) { api.block("docs/STACK.md missing"); return; }

  const statusMatch = stack.match(/Status:\s*\**\s*(UNCONFIGURED|PARTIAL|CONFIGURED)/i);
  const status = statusMatch ? statusMatch[1].toUpperCase() : null;
  if (!status) api.warn("docs/STACK.md has no recognizable Status (UNCONFIGURED|PARTIAL|CONFIGURED)");
  else if (status === "UNCONFIGURED") api.warn("docs/STACK.md Status is UNCONFIGURED — run project-onboarding before feature work");
  else api.ok(`docs/STACK.md Status is ${status}`);

  // Essential project docs (created during onboarding) — warn when absent, since a fresh
  // template repo legitimately has only the seed docs.
  for (const d of ["docs/PROJECT_BRIEF.md", "docs/ARCHITECTURE.md", "docs/DECISIONS.md"]) {
    if (exists(d)) api.ok(`${d} present`);
    else api.warn(`${d} not yet created (expected after onboarding)`);
  }

  // Capabilities section (filled at onboarding) — deterministic header check, meaningful
  // only once the stack is configured. Not fragile content parsing — just header presence.
  if (status && status !== "UNCONFIGURED") {
    if (/^##\s+Capabilities\b/m.test(stack)) api.ok("docs/STACK.md has a Capabilities section");
    else api.warn("docs/STACK.md is configured but has no Capabilities section (relevant agents / integrations / out-of-scope)");
  }

  // Package manager / runtime identification (informational).
  if (exists("package.json")) api.ok("package.json present (Node project)");
  else api.warn("no package.json — npm script commands (e.g. starter:doctor) are not registered; run this doctor via 'node scripts/quality/starter-doctor.mjs'");

  // Quality commands availability (only meaningful once STACK is configured).
  if (status && status !== "UNCONFIGURED") {
    if (/\|\s*Test\s*\|\s*TBD/i.test(stack) || /\|\s*Test\s*\|\s*UNCONFIGURED/i.test(stack)) {
      api.warn("docs/STACK.md is configured but Test command is still TBD/UNCONFIGURED");
    } else {
      api.ok("docs/STACK.md appears to have quality commands filled");
    }
  }
});

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------

const ICON = { ok: "OK   ", warn: "WARN ", block: "BLOCK" };
let totalWarn = 0;
let totalBlock = 0;

const out = [];
out.push("starter:doctor — structural diagnostic\n");
for (const { title, findings } of sections) {
  out.push(`\n## ${title}`);
  for (const f of findings) {
    if (f.level === "warn") totalWarn++;
    if (f.level === "block") totalBlock++;
    out.push(`  [${ICON[f.level]}] ${f.msg}`);
  }
}

out.push("\n## Summary");
out.push(`  ${totalBlock} blocker(s), ${totalWarn} warning(s)`);

out.push("\n## Suggested next steps");
if (totalBlock > 0) {
  out.push("  - Resolve blockers above (missing required files/agents/hooks, invalid settings, versionable secrets).");
}
if (totalWarn > 0) {
  out.push("  - Review warnings: run project-onboarding if STACK is UNCONFIGURED; add .env.example when needed.");
}
if (totalBlock === 0 && totalWarn === 0) {
  out.push("  - None. Structure, governance, hygiene, and readiness all pass.");
}

process.stdout.write(out.join("\n") + "\n");
process.exit(totalBlock > 0 ? 1 : 0);
