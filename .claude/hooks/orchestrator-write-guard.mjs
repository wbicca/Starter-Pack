#!/usr/bin/env node
// PreToolUse — orchestrator write-guard (flow governance, NOT a security sandbox).
//
// Reads the hook payload from stdin and uses agent_id / agent_type / tool_name /
// tool_input to keep the main orchestrator window from writing application code or
// starter-governance files directly, and to keep read-only agents from mutating via
// Write/Edit OR Bash.
//
// Orchestrator (main window) write policy:
//   * governance files       -> DENY (CLAUDE_ORCHESTRATOR_WRITE_OVERRIDE=1 downgrades
//                               to ASK). Identical in every profile.
//   * application code       -> profile-based (docs/STACK.md `Profile:` field):
//                               standard → ASK, session-scoped: the first approved
//                               inline write records a marker (PostToolUse) and
//                               covers the rest of the session;
//                               light → silent pass. Never a hard DENY anymore.
//   * out-of-root writes     -> DENY (harness temp/memory conventions excepted).
//   * writing OUTSIDE the project root (or any traversal that escapes the cwd) is
//     DENY — even under the override — EXCEPT the Claude Code harness conventions
//     (/tmp, /private/tmp, and THIS project's own ~/.claude/projects/<slug> memory
//     dir), which pass silently. The env-derived os.tmpdir() is intentionally NOT
//     trusted (a hostile TMPDIR must not widen the allowlist).
//
// Subagent write policy:
//   * read-only roles       -> DENY any mutation (Write/Edit or mutating Bash).
//   * implementers touching the governance surface (CLAUDE.md, AGENTS.md, .claude/,
//     .codex/, .agents/, scripts/quality/) -> ASK — governance edits happen only in
//     explicit, human-approved maintenance batches.
//   * implementers writing app code -> silent pass.
//   * agent worktrees (.claude/worktrees/<name>/) are normalized first: the inner
//     relative path is judged by the same rules, so app code inside a worktree passes
//     while a worktree's copy of CLAUDE.md / .claude/** is still governance.
//   * ASK surfaces an approval prompt only for INTERACTIVE subagents; a background Task
//     subagent has no human to prompt, so ASK proceeds — governance edits by subagents
//     must therefore be a deliberate orchestrator-dispatched maintenance batch. The
//     strongest rail is the main-window DENY (which requires the override), not the
//     subagent ASK — but like every regex-based guard here it is best-effort flow
//     governance, not a sandbox a determined actor cannot walk past.
//
// Bash mutation detection is target-based: redirect TARGETS are extracted with an
// anchored regex (so `=>` / `Promise<T>` in grep patterns never match) and write
// VERBS are anchored to command position (so verbs inside prose/patterns don't match).
//
// "Silent pass-through" = exit 0 with NO stdout (never emit permissionDecision
// "defer" — that value has another meaning and is not used here).
//
// The override is LOCAL to this hook: it never disables the other security hooks
// (real .env files, sensitive files, secret scanning, destructive commands) — those
// still run and can still block. Bash coverage is best-effort, not a perfect sandbox.

import path from "node:path";
import os from "node:os";
import fs from "node:fs";

// --- Application-code surface -------------------------------------------------
const APP_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".css", ".scss",
  ".vue", ".svelte", ".py", ".rb", ".go", ".java", ".sql", ".sh", ".html", ".htm",
]);
const APP_EXT_RE = /\.(tsx?|jsx?|mjs|cjs|mts|cts|css|scss|vue|svelte|py|rb|go|java|sql|sh|html?)\b/;
// Bash write verbs, anchored to command position (start of command, after ; & | ( or a
// newline, after a backtick, inside $( ), or as the command run by xargs) so the same
// words inside grep patterns or prose never match. The bare `(` and backtick openers
// catch subshell/command-substitution forms like `(cp a b)` and `` `cp a b` ``.
const VERB_WRITE = /(?:^|[;&|\n(`]\s*|\$\(\s*|\bxargs\s+(?:-\S+\s+)*)(?:sudo\s+)?(?:tee|cp|mv|rm|touch|mkdir|rmdir|ln)\b|\bsed\s+(?:-i|--in-place)|\bperl\s+-[a-z]*i|\bdd\s+[^;|&\n]*\bof=/;
// Interpreter one-liners and patch tools mutate files OPAQUELY — no redirect target and
// no write verb the regexes above can see. Detection is two-step for interpreters: an
// exec flag (-e/-c, `deno eval`, or a heredoc feeding the interpreter) in command
// position PLUS a write-API signal in the command text (stdout/stderr writes are
// stripped first — printing is not a file write). `git apply` / `patch` are opaque by
// themselves: their targets live inside the patch content.
const INTERP_EXEC = /(?:^|[;&|\n(`]\s*|\$\(\s*)(?:sudo\s+)?(?:node|python3?|ruby|perl|deno|bun)\s+(?:-\S+\s+)*(?:-[ec]\b|--eval\b|--command\b)|\bdeno\s+eval\b|\b(?:node|python3?|ruby|perl|bun)\b[^;|&\n]*<</;
const WRITE_API_PRINT = /\b(?:process\.(?:stdout|stderr)|sys\.(?:stdout|stderr))\.write\b/g;
const WRITE_API = /\bwriteFile(?:Sync)?\b|\bappendFile(?:Sync)?\b|\bcreateWriteStream\b|\bwrite_text\b|\bcopyFile(?:Sync)?\b|\brename(?:Sync)?\b|\bunlink(?:Sync)?\b|\brmSync\b|\bmkdir(?:Sync)?\b|\bopen\s*\([^()]*["'][wax][b+]*["']|\.write\s*\(/;
const PATCH_TOOLS = /(?:^|[;&|\n(`]\s*|\$\(\s*)(?:sudo\s+)?(?:git\s+apply\b|patch\b)/;
// Governance surface reachable from a Bash command string.
const BASH_GOV_TARGET = /(\bCLAUDE\.md\b|\bAGENTS\.md\b|\.claude\/|\.codex\/|\.agents\/|scripts\/quality\/)/;
// Mutating git / package-manager invocations (read-only agents), anchored the same way
// (start | ; & | ( newline | backtick | $( | xargs) so `(git reset)` / `` `npm install` ``
// are caught in command position too.
const RO_GIT_PM = new RegExp([
  "(?:^|[;&|\\n(`]\\s*|\\$\\(\\s*)git\\s+(?:add|commit|restore|reset|clean|checkout|switch|merge|rebase|cherry-pick)\\b",
  "(?:^|[;&|\\n(`]\\s*|\\$\\(\\s*)(?:npm|pnpm|yarn|bun)\\s+install\\b",
  "-delete\\b",
].join("|"));

// Best-effort governance: safe redirects to /dev/null and stderr-to-stdout are stripped
// before mutation detection. Inspection commands such as `... 2>&1`, `... 2>/dev/null;`,
// or `... &>/dev/null |` must not be misread as writes — the lookahead accepts the
// separators ; | & ) as terminators, not just whitespace/end. This is flow governance,
// NOT a shell parser: redirects to real files (`> out.txt`, `2> err.log`) are
// deliberately left intact so genuine writes still yield redirect targets below.
function stripSafeReadOnlyRedirects(command) {
  return command
    .replace(/\b2>>?\s*&1\b/g, " ")
    .replace(/(?:^|\s)(?:1|2)?>>?\s*\/dev\/null(?=[\s;|&)]|$)/g, " ")
    .replace(/(?:^|\s)&>>?\s*\/dev\/null(?=[\s;|&)]|$)/g, " ");
}

// Shared redirect-target extraction. The anchor (start / whitespace / ; | & ( or a
// backtick) before the optional fd digits means `=>`, `->`, `>&2`, and `<` never
// produce a target, while subshell/command-substitution openers still count as command
// position. Run on the sanitized command so `> /dev/null` and friends are never considered.
const REDIRECT_RE = /(?:^|[\s;|&(`])[0-9]*(?:>>?|&>>?)\s*("[^"]*"|'[^']*'|[^\s|&;<>()]+)/g;
function extractRedirectTargets(scmd) {
  const targets = [];
  let m;
  REDIRECT_RE.lastIndex = 0;
  while ((m = REDIRECT_RE.exec(scmd)) !== null) {
    const target = m[1].replace(/^["']|["']$/g, "");
    if (target && target !== "/dev/null") targets.push(target);
  }
  return targets;
}

// --- Agent roles --------------------------------------------------------------
const IMPLEMENTERS = new Set([
  "frontend-designer", "frontend-engineer", "backend-engineer",
  "database-architect", "supabase-specialist", "devops-deployment", "qa-tester",
]);
// Read-only via Write/Edit.
const READ_ONLY = new Set([
  "product-strategist", "code-reviewer", "security-auditor",
]);
// Read-only via Bash (superset: system-architect may write its two docs through the
// Write tool, but must not mutate anything through the shell).
const BASH_READ_ONLY = new Set([
  "product-strategist", "system-architect", "code-reviewer", "security-auditor",
]);
// documentation-writer: docs/** plus this exact set of root docs.
const DOC_WRITER_ROOT = new Set([
  "README.md", "USAGE.md", "NOTICE.md", "THIRD_PARTY_NOTICES.md",
]);
// system-architect: only these two docs.
const ARCHITECT_ALLOW = new Set([
  "docs/ARCHITECTURE.md", "docs/DECISIONS.md",
]);
// Main window: edit these root docs silently.
const MAIN_SILENT_ROOT = new Set([
  "README.md", "USAGE.md", "NOTICE.md", "THIRD_PARTY_NOTICES.md",
]);

// Governance surface for Write/Edit paths (mirrors BASH_GOV_TARGET).
function isGovPath(rel) {
  return rel === "CLAUDE.md" || rel === "AGENTS.md" ||
    rel.startsWith(".claude/") || rel.startsWith(".codex/") ||
    rel.startsWith(".agents/") || rel.startsWith("scripts/quality/");
}

// Agent worktrees live under .claude/worktrees/<name>/ and contain a full checkout.
// Strip that prefix and judge the INNER path by the same rules: app code inside a
// worktree is app code; a worktree's copy of CLAUDE.md or .claude/** is still governance.
const WORKTREE_PREFIX_RE = /^\.claude\/worktrees\/[^/]+\//;
function stripWorktreePrefix(rel) { return rel.replace(WORKTREE_PREFIX_RE, ""); }

// Claude Code harness conventions that legitimately live OUTSIDE the project root:
// the /tmp and /private/tmp scratchpads, and THIS project's memory dir
// (~/.claude/projects/<slug>, slug = project root with "/" and spaces as "-").
// os.tmpdir() is deliberately NOT trusted here: it is derived from the TMPDIR env var,
// so an attacker-controlled TMPDIR could otherwise widen this allowlist to an arbitrary
// out-of-root path. Only the two static temp roots and the per-project memory dir pass;
// everything else out-of-root stays a hard deny.
function harnessTempPrefixes(root) {
  const prefixes = ["/tmp", "/private/tmp"];
  const slug = root.replace(/[/ ]/g, "-");
  prefixes.push(path.join(os.homedir(), ".claude", "projects", slug));
  // CLAUDE_CONFIG_DIR is the harness's own config variable — same trust level as
  // CLAUDE_PROJECT_DIR; users with a custom config dir keep their per-project memory
  // writable (same <configDir>/projects/<slug> convention as ~/.claude).
  if (process.env.CLAUDE_CONFIG_DIR) {
    prefixes.push(path.join(process.env.CLAUDE_CONFIG_DIR, "projects", slug));
  }
  return prefixes;
}
function isHarnessTempPath(abs, root) {
  return harnessTempPrefixes(root).some((p) => {
    const pre = p.endsWith("/") ? p : p + "/";
    return abs === p || abs.startsWith(pre);
  });
}

// --- Reasons ------------------------------------------------------------------
// Short, operational codes. Policy is unchanged — only the wording is terser so the
// orchestrator gets a clear next action instead of a paragraph.
const REASON_GOV =
  "GOVERNANCE_WRITE_DENIED: use an explicit maintenance session with CLAUDE_ORCHESTRATOR_WRITE_OVERRIDE=1.";
const REASON_GOV_ASK =
  "GOVERNANCE_WRITE_ASK: governance/hook file — requires human approval (template-maintenance change).";
const REASON_APP_ASK =
  "ORCHESTRATOR_WRITE_ASK: inline app-code write — approve for a small task, or decline and delegate to an implementation agent. Medium/large work should still be delegated.";
const REASON_OUTSIDE =
  "OUT_OF_PROJECT_WRITE_DENIED: writing outside the project root is not allowed.";
const REASON_RO_BASH =
  "READ_ONLY_MUTATION_DENIED: inspect only or delegate changes to an implementation agent.";
const REASON_OPAQUE =
  "OPAQUE_WRITE_ASK: interpreter/patch command writes files the guard cannot resolve — approve if intended, or use the Write/Edit tools so the target is visible.";

// --- Override -----------------------------------------------------------------
// Explicit maintenance switch: downgrades main-window DENY -> ASK, never to ALLOW.
const OVERRIDE = process.env.CLAUDE_ORCHESTRATOR_WRITE_OVERRIDE === "1";

// --- Session-scoped inline-write approval ---------------------------------------
// In the standard profile the FIRST approved inline app-code write of a session
// records a marker file (written by the PostToolUse pass below — a declined ask
// never runs the tool, so no marker ever appears). Later inline app-code writes in
// the SAME session pass silently: one human approval covers the session, not every
// keystroke (field data: 28 of 29 asks were approvals). Governance and out-of-root
// rules never consult the marker. os.tmpdir() is safe here — we only place OUR
// marker there; it does not widen any write allowlist.
function askMarkerPath(sessionId) {
  const sane = sessionId.replace(/[^A-Za-z0-9-]/g, "-");
  return path.join(os.tmpdir(), "claude-inline-ask-" + sane);
}

// --- Project profile ------------------------------------------------------------
// docs/STACK.md may declare `Profile: standard | light` (set by project-onboarding).
// standard → main-window app-code writes ASK (human approves small-task inline work).
// light    → main-window app-code writes pass silently (simple projects).
// Governance protection is identical in both profiles. Missing/invalid → standard.
function readProfile(root) {
  try {
    const stack = fs.readFileSync(path.join(root, "docs", "STACK.md"), "utf8");
    const m = stack.match(/Profile:\s*\**\s*(standard|light)\b/i);
    return m ? m[1].toLowerCase() : "standard";
  } catch {
    return "standard";
  }
}

// --- Output helpers -----------------------------------------------------------
function decide(decision, reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: decision,
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}
const ask = (r) => decide("ask", r);
const deny = (r) => decide("deny", r);
const pass = () => process.exit(0); // silent pass-through
// Main-window block: DENY by default, ASK under the explicit override, never ALLOW.
const mainBlock = (r) => (OVERRIDE ? ask(r) : deny(r));

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
  });
}

// --- Path normalization -------------------------------------------------------
// Returns { rel, outside, ext } with rel relative to the project root, using
// forward slashes. `outside` flags traversal or any path beyond the root.
function normalize(rawPath, root) {
  const abs = path.resolve(root, rawPath);
  const rel = path.relative(root, abs).split(path.sep).join("/");
  const outside =
    rel === ".." || rel.startsWith("../") || path.isAbsolute(rel);
  return { rel, outside, ext: path.extname(rel).toLowerCase() };
}

// --- Main ---------------------------------------------------------------------
const raw = await readStdin();
let input;
try {
  input = JSON.parse(raw || "{}");
} catch {
  pass();
}

const toolName = (input.tool_name ?? "").toString();
const toolInput = input.tool_input ?? {};
const agentId = input.agent_id ?? input.agentId ?? null;
const agentType = (input.agent_type ?? input.agentType ?? "").toString();
const isMain = !agentId; // no agent_id => main / orchestrator window
const sessionId = (input.session_id ?? "").toString();
const root = (process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()).toString();

// --- PostToolUse: record the session-scoped inline-write approval ---------------
// This hook is also wired on PostToolUse for file-write tools. A PostToolUse event
// means the tool ALREADY ran — so a standard-profile main-window app-code write got
// its human approval (or an earlier marker). Record the marker and exit silently;
// PostToolUse never emits a permission decision.
if ((input.hook_event_name ?? "") === "PostToolUse") {
  if (isMain && sessionId && toolName !== "Bash") {
    const p = (toolInput.file_path ?? toolInput.path ?? toolInput.filePath ?? toolInput.notebook_path ?? "").toString();
    if (p) {
      const n = normalize(p, root);
      const relPost = stripWorktreePrefix(n.rel);
      if (!n.outside && !isGovPath(relPost) && APP_EXTS.has(n.ext) &&
          readProfile(root) === "standard") {
        try { fs.writeFileSync(askMarkerPath(sessionId), ""); } catch { /* best-effort */ }
      }
    }
  }
  process.exit(0);
}

// Main-window app-code block: light profile passes; in standard, the first approved
// inline write of the session (marker) covers the rest — otherwise ASK (never DENY,
// never silent ALLOW in standard). Governance keeps mainBlock (deny; override → ask).
const appBlock = () => {
  if (readProfile(root) === "light") pass();
  if (sessionId && fs.existsSync(askMarkerPath(sessionId))) pass();
  ask(REASON_APP_ASK);
};

// --- Bash ---------------------------------------------------------------------
if (toolName === "Bash") {
  const cmd = (toolInput.command ?? "").toString();
  // Safe redirects to /dev/null and stderr-to-stdout are stripped, then agent-worktree
  // prefixes (.claude/worktrees/<name>/) are stripped so inner paths are judged by the
  // same rules (a redirect to .claude/worktrees/x/src/a.ts is judged as src/a.ts, while
  // .claude/worktrees/x/.claude/settings.json still reads as governance). Real redirect
  // TARGETS are then extracted once and shared by every Bash branch (read-only agents,
  // subagent governance, main-window governance/app-code/out-of-root).
  const scmd = stripSafeReadOnlyRedirects(cmd);
  const scmdEff = scmd.replace(/\.claude\/worktrees\/[^/\s"']+\//g, "");
  const targets = extractRedirectTargets(scmdEff);
  // Opaque write: interpreter exec + write-API signal (printing stripped first), or a
  // patch tool. The guard cannot resolve WHICH file such a command writes.
  const interpWrite =
    INTERP_EXEC.test(scmdEff) && WRITE_API.test(scmdEff.replace(WRITE_API_PRINT, " "));
  const opaqueWrite = interpWrite || PATCH_TOOLS.test(scmdEff);
  // Governance hit = a redirect lands on the governance surface, OR a write verb /
  // opaque write runs in a command that mentions the governance surface.
  const govHit =
    targets.some((t) => BASH_GOV_TARGET.test(t)) ||
    ((VERB_WRITE.test(scmdEff) || opaqueWrite) && BASH_GOV_TARGET.test(scmdEff));

  // Subagents: read-only roles may inspect but not mutate (any real redirect target
  // counts as a mutation); non-read-only subagents touching the governance surface
  // get an ASK (human approves); implementers writing app code pass through.
  if (!isMain) {
    if (BASH_READ_ONLY.has(agentType)) {
      // Scratch exemption: output captured into harness temp paths (/tmp,
      // /private/tmp, per-project memory) is not a repo mutation — a read-only
      // auditor must be able to write command results to scratch and read them
      // back (e.g. a mutation-test baseline). Only redirects and `tee` get the
      // exemption: cp/mv/rm keep their deny even when aimed at a temp path
      // (moving repo files out is not "inspecting"), and opaque writes stay
      // denied (their target is unresolvable). Repo-tree targets always deny.
      const roTargets = targets.filter((t) => !isHarnessTempPath(path.resolve(root, t), root));
      const scmdRO = scmdEff.replace(
        /(?:^|[;&|\n(`])\s*tee\s+(?:-a\s+)?("[^"]*"|'[^']*'|[^\s;|&]+)/g,
        (m, t) =>
          isHarnessTempPath(path.resolve(root, t.replace(/^["']|["']$/g, "")), root) ? " " : m,
      );
      if (roTargets.length > 0 || VERB_WRITE.test(scmdRO) || RO_GIT_PM.test(scmdRO) ||
          opaqueWrite) {
        deny(REASON_RO_BASH);
      }
    }
    if (!BASH_READ_ONLY.has(agentType) && govHit) ask(REASON_GOV_ASK);
    pass();
  }

  // Main window: redirect targets resolving outside the project root are denied even
  // under the override — except harness temp/memory locations, which pass. Then
  // governance first (a path may be both governance and app code), then application
  // code — each on redirect targets OR write verb + surface match. DENY by default,
  // ASK under the override, never ALLOW.
  const realTargets = targets.filter((t) => !isHarnessTempPath(path.resolve(root, t), root));
  if (realTargets.some((t) => normalize(t, root).outside)) deny(REASON_OUTSIDE);
  if (realTargets.some((t) => BASH_GOV_TARGET.test(t)) ||
      ((VERB_WRITE.test(scmdEff) || opaqueWrite) && BASH_GOV_TARGET.test(scmdEff))) {
    mainBlock(REASON_GOV);
  }
  if (realTargets.some((t) => APP_EXT_RE.test(t)) ||
      ((VERB_WRITE.test(scmdEff) || opaqueWrite) && APP_EXT_RE.test(scmdEff))) {
    appBlock();
  }
  // Opaque write with no resolvable surface (e.g. `git apply x.diff`, a variable path
  // inside `node -e`): ASK in every profile — an unknown target is not "app code".
  if (opaqueWrite) ask(REASON_OPAQUE);
  pass();
}

// --- Write / Edit (+ MultiEdit / NotebookEdit compatibility) ------------------
const rawPath = (toolInput.file_path ?? toolInput.path ?? toolInput.filePath ?? toolInput.notebook_path ?? "").toString();
if (!rawPath) pass();

const { rel, outside, ext } = normalize(rawPath, root);
// Judge agent-worktree paths by their inner relative path (`outside` and `ext` are
// unaffected by the strip): src/** inside a worktree is app code; a worktree's copy of
// CLAUDE.md or .claude/** is still governance.
const relEff = stripWorktreePrefix(rel);
const inDocs = relEff.startsWith("docs/");
const inBmadOut = relEff.startsWith("_bmad-output/");
const isAppCode = APP_EXTS.has(ext);

// Subagent policies (agent_id present).
if (!isMain) {
  if (READ_ONLY.has(agentType)) {
    deny(REASON_RO_BASH);
  }
  if (agentType === "system-architect") {
    if (ARCHITECT_ALLOW.has(relEff)) pass();
    deny("system-architect may only write docs/ARCHITECTURE.md or docs/DECISIONS.md.");
  }
  if (agentType === "documentation-writer") {
    if (inDocs || DOC_WRITER_ROOT.has(relEff)) pass();
    deny("documentation-writer may only write docs/**, README.md, USAGE.md, NOTICE.md, or THIRD_PARTY_NOTICES.md.");
  }
  // Governance symmetry: implementers may touch the governance surface only via an
  // explicit human approval (template-maintenance batches) — ASK, never silent.
  if (isGovPath(relEff)) ask(REASON_GOV_ASK);
  // Implementers (and any unrecognized subagent) may write application code.
  pass();
}

// Main / orchestrator window (no agent_id).
if (outside) {
  // Harness conventions (scratchpad, per-project memory) are legitimate out-of-root
  // writes → silent pass. Everything else: unconditional deny, even under override.
  if (isHarnessTempPath(path.resolve(root, rawPath), root)) pass();
  deny(REASON_OUTSIDE);
}
if (inDocs || inBmadOut || MAIN_SILENT_ROOT.has(relEff)) pass();
if (isGovPath(relEff)) mainBlock(REASON_GOV);
if (isAppCode) appBlock();
pass();
