#!/usr/bin/env node
// PreToolUse — orchestrator write-guard (flow governance, NOT a security sandbox).
//
// Reads the hook payload from stdin and uses agent_id / agent_type / tool_name /
// tool_input to keep the main orchestrator window from writing application code or
// starter-governance files directly, and to keep read-only agents from mutating via
// Write/Edit OR Bash.
//
// Orchestrator (main window) write policy:
//   * default mode          -> DENY direct writes to application code & governance files.
//   * explicit maintenance  -> CLAUDE_ORCHESTRATOR_WRITE_OVERRIDE=1 DOWNGRADES those
//                              denials to ASK (a human approves each individual write).
//   * never ALLOW automatically for the main window.
//   * writing OUTSIDE the project root (or any traversal that escapes the cwd) is
//     ALWAYS DENY — even under the override.
//
// "Silent pass-through" = exit 0 with NO stdout (never emit permissionDecision
// "defer" — that value has another meaning and is not used here).
//
// The override is LOCAL to this hook: it never disables the other security hooks
// (real .env files, sensitive files, secret scanning, destructive commands) — those
// still run and can still block. Bash coverage is best-effort, not a perfect sandbox.

import path from "node:path";

// --- Application-code surface -------------------------------------------------
const APP_EXTS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".css", ".scss",
  ".vue", ".svelte", ".py", ".rb", ".go", ".java", ".sql",
]);
const APP_EXT_RE = /\.(tsx?|jsx?|css|scss|vue|svelte|py|rb|go|java|sql)\b/;
// Bash write/move verbs that can land content in a target file.
const BASH_WRITE_OP = /(>>?|\btee\b|\bcp\b|\bmv\b|\bsed\s+-i|\bperl\s+-[a-z]*i)/;
// Governance targets reachable from a Bash command string.
const BASH_GOV_TARGET = /(\bCLAUDE\.md\b|\bAGENTS\.md\b|\.claude\/)/;
// Mutating Bash verbs/flags a read-only agent must never run (best-effort).
const MUTATING_BASH = new RegExp([
  ">",                                   // > and >> redirections
  "\\btee\\b", "\\bcp\\b", "\\bmv\\b", "\\brm\\b", "\\btouch\\b", "\\bmkdir\\b",
  "\\bsed\\s+-i", "\\bperl\\s+-[a-z]*i",
  "\\bgit\\s+(?:add|commit|restore|reset|clean|checkout|switch|merge|rebase|cherry-pick)\\b",
  "\\b(?:npm|pnpm|yarn|bun)\\s+install\\b",
  "-delete\\b",
].join("|"));

// Best-effort governance: safe redirects to /dev/null and stderr-to-stdout are stripped
// before mutation detection. Inspection commands such as `... 2>&1`, `... 2>/dev/null`,
// or `... &>/dev/null` must not be misread as writes. This is flow governance, NOT a
// shell parser: redirects to real files (`> out.txt`, `2> err.log`, `>> report.txt`) are
// deliberately left intact so genuine writes still trip MUTATING_BASH / BASH_WRITE_OP.
function stripSafeReadOnlyRedirects(command) {
  return command
    .replace(/\b2>>?\s*&1\b/g, " ")
    .replace(/(?:^|\s)(?:1|2)?>>?\s*\/dev\/null(?=\s|$)/g, " ")
    .replace(/(?:^|\s)&>>?\s*\/dev\/null(?=\s|$)/g, " ");
}

// Best-effort: does any output redirect target escape the project root? Mirrors the
// Write/Edit out-of-root rule for the main window. Run on the sanitized command so
// `> /dev/null` and friends (already stripped) are never considered. Not a full shell
// parser — covers `>`/`>>`/`&>`/`N>` redirect targets, which is what governance needs.
function redirectTargetsOutsideRoot(command, root) {
  const re = /(?:^|\s)[0-9]*(?:>>?|&>>?)\s*("[^"]*"|'[^']*'|[^\s|&;<>()]+)/g;
  let m;
  while ((m = re.exec(command)) !== null) {
    const target = m[1].replace(/^["']|["']$/g, "");
    if (!target || target === "/dev/null") continue;
    if (normalize(target, root).outside) return true;
  }
  return false;
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

// --- Reasons ------------------------------------------------------------------
const REASON_GOV =
  "Main orchestrator cannot modify starter governance files in a normal session. " +
  "Restart Claude Code with CLAUDE_ORCHESTRATOR_WRITE_OVERRIDE=1 for intentional maintenance.";
const REASON_APP =
  "Main orchestrator cannot edit application code directly. Delegate implementation to a " +
  "Sonnet subagent. For an intentional exceptional inline fix, restart Claude Code with " +
  "CLAUDE_ORCHESTRATOR_WRITE_OVERRIDE=1.";
const REASON_OUTSIDE =
  "Writing outside the project root is not allowed. Perform this operation manually " +
  "outside Claude Code if it is intentionally required.";
const REASON_RO_BASH =
  "Read-only agent attempted a mutating Bash command. Use inspection-only commands or " +
  "delegate the change to an implementation agent.";

// --- Override -----------------------------------------------------------------
// Explicit maintenance switch: downgrades main-window DENY -> ASK, never to ALLOW.
const OVERRIDE = process.env.CLAUDE_ORCHESTRATOR_WRITE_OVERRIDE === "1";

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
const root = (process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd()).toString();

// --- Bash ---------------------------------------------------------------------
if (toolName === "Bash") {
  const cmd = (toolInput.command ?? "").toString();
  // Best-effort governance: safe redirects to /dev/null and stderr-to-stdout are
  // stripped before mutation detection. The sanitized command is used in every Bash
  // branch (read-only agents, main-window governance, application code, out-of-root);
  // the original `cmd` is kept only for potential logging.
  const scmd = stripSafeReadOnlyRedirects(cmd);
  // Subagents: read-only roles may inspect but not mutate; implementers pass through.
  if (!isMain) {
    if (BASH_READ_ONLY.has(agentType) && MUTATING_BASH.test(scmd)) deny(REASON_RO_BASH);
    pass();
  }
  // Main window: a write redirect that escapes the project root is ALWAYS denied, even
  // under the override (mirrors the Write/Edit out-of-root rule). Then governance first
  // (a path may be both governance and app code), then application code. DENY by default,
  // ASK under the override, never ALLOW.
  if (redirectTargetsOutsideRoot(scmd, root)) deny(REASON_OUTSIDE);
  if (BASH_WRITE_OP.test(scmd) && BASH_GOV_TARGET.test(scmd)) mainBlock(REASON_GOV);
  if (BASH_WRITE_OP.test(scmd) && APP_EXT_RE.test(scmd)) mainBlock(REASON_APP);
  pass();
}

// --- Write / Edit (+ MultiEdit compatibility) ---------------------------------
const rawPath = (toolInput.file_path ?? toolInput.path ?? toolInput.filePath ?? "").toString();
if (!rawPath) pass();

const { rel, outside, ext } = normalize(rawPath, root);
const inDocs = rel.startsWith("docs/");
const inBmadOut = rel.startsWith("_bmad-output/");
const inClaude = rel.startsWith(".claude/");
const isAppCode = APP_EXTS.has(ext);

// Subagent policies (agent_id present).
if (!isMain) {
  if (READ_ONLY.has(agentType)) {
    deny(`Agent ${agentType} is read-only and may not write files.`);
  }
  if (agentType === "system-architect") {
    if (ARCHITECT_ALLOW.has(rel)) pass();
    deny("system-architect may only write docs/ARCHITECTURE.md or docs/DECISIONS.md.");
  }
  if (agentType === "documentation-writer") {
    if (inDocs || DOC_WRITER_ROOT.has(rel)) pass();
    deny("documentation-writer may only write docs/**, README.md, USAGE.md, NOTICE.md, or THIRD_PARTY_NOTICES.md.");
  }
  // Implementers (and any unrecognized subagent) may write.
  pass();
}

// Main / orchestrator window (no agent_id).
if (outside) deny(REASON_OUTSIDE);                 // unconditional — even under override
if (inDocs || inBmadOut || MAIN_SILENT_ROOT.has(rel)) pass();
if (rel === "CLAUDE.md" || rel === "AGENTS.md" || inClaude) mainBlock(REASON_GOV);
if (isAppCode) mainBlock(REASON_APP);
pass();
