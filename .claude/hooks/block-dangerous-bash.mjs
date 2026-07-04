#!/usr/bin/env node
// PreToolUse/Bash — best-effort guard for destructive commands and writes to real
// .env files. Catastrophic/irreversible patterns (rm of root/home/glob, sudo rm,
// fork bomb) are DENIED; risky-but-legitimate operations (git reset --hard, git
// clean -fd, chmod -R 777, docker prune -a, find -delete, rm of critical dirs) are
// downgraded to ASK so a human confirms them. Trailing shell comments are stripped
// before matching so prose like `true # git reset --hard` never trips a pattern.
// This is a safety NET, not a security boundary: a determined command can still be
// obfuscated past it. Keep it as defense-in-depth.

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
const deny = (reason) => decide("deny", reason);
const ask = (reason) => decide("ask", reason);

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
  });
}

const raw = await readStdin();
let cmd = "";
try {
  cmd = (JSON.parse(raw || "{}").tool_input?.command ?? "").toString();
} catch {
  process.exit(0); // malformed input: don't block
}

// Strip best-effort trailing shell comments (a `#` at line start or preceded by
// whitespace, followed by whitespace). This only removes text from CONSIDERATION —
// it can never hide a real command from the patterns below.
const uncommented = cmd
  .split("\n")
  .map((l) => l.replace(/(^|\s)#\s.*$/, "$1"))
  .join("\n");

// Normalize: lowercase + strip quotes so quoted targets can't hide.
const c = uncommented.toLowerCase();
const unquoted = c.replace(/['"]/g, "");

// Treat long rm flags as their short forms so --recursive --force == -rf.
const normRm = unquoted
  .replace(/--recursive/g, "-r")
  .replace(/--force/g, "-f")
  .replace(/--no-preserve-root/g, "");

// --- 1) Catastrophic rm of root / home ---
// The terminator is a lookahead accepting whitespace, end-of-string, OR a shell
// metachar (; | & ) or backtick) so `rm -rf /; echo done`, `(rm -rf /)`, and
// `` `rm -rf /` `` are all caught, not just a trailing space.
const RM_TARGET = /\br?m\s+(?:-[a-z]*\s+)*(\/\*?|\*|~|\$\{?home\}?)(?=[\s;|&)`]|$)/;
// matches: rm -rf /   rm -rf /*   rm -rf *   rm -rf ~   rm -rf $HOME
// recursive flag may be combined (-rf) or split (--recursive --force → -r -f)
if (/\brm\b/.test(normRm) && /-[a-z]*r/.test(normRm) && RM_TARGET.test(normRm)) {
  deny("Blocked: recursive delete of a root/home/glob path. Confirm explicitly and target a specific subdirectory, or preview with ls first.");
}

// --- 2) Other catastrophic/irreversible patterns → DENY ---
const DANGEROUS = [
  { re: /rm\s+-[a-z]*r[a-z]*f?\s+\*/, why: "rm -rf * deletes everything in the directory." },
  { re: /\bsudo\s+rm\b/, why: "sudo rm can destroy system files." },
  { re: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, why: "fork bomb." },
];
for (const d of DANGEROUS) {
  if (d.re.test(normRm)) {
    deny(`Blocked dangerous command: ${d.why} Ask for explicit confirmation, or preview with a listing command (e.g. ls / git status) first.`);
  }
}

// --- 3) Risky but sometimes-legitimate operations → ASK (human confirms) ---
const CONFIRM = [
  { re: /git\s+reset\s+--hard/, what: "Approving runs git reset --hard, permanently discarding all uncommitted changes." },
  { re: /git\s+clean\b(?=.*-[a-z]*f)(?=.*-[a-z]*d)/, what: "Approving runs git clean -fd, permanently deleting untracked files and directories." },
  { re: /chmod\s+-r\s+777/, what: "Approving runs chmod -R 777, making the target tree world-writable." },
  { re: /docker\s+system\s+prune\s+-a/, what: "Approving removes ALL unused Docker images, containers, networks, and build cache." },
  { re: /find\s+\.\s+-delete/, what: "Approving recursively deletes every file find matches under the current directory." },
];
for (const d of CONFIRM) {
  if (d.re.test(normRm)) ask(d.what);
}

// --- 4) rm -rf of a critical directory → ASK (quotes already stripped) ---
const CRITICAL = [".git", "node_modules", "dist", "build", ".next"];
const rmTarget = normRm.match(/\brm\s+(?:-[a-z]*\s+)*([^\s;|&>]+)/);
if (rmTarget) {
  const target = rmTarget[1].replace(/^\.?\//, "").replace(/\/+$/, "");
  if (CRITICAL.includes(target)) {
    ask(`Approving permanently deletes the '${target}' directory (rebuild/reinstall may be required).`);
  }
}

// --- 5) Shell writes (redirection / tee / cp / mv / rsync) to protected files ---
// Protected: starter contract files + real .env files. Allow .env example/template.
const ALLOWED_ENV = /^\.env\.(example|local\.example|template)$/;
const PROTECTED_STARTER = ["claude.md", "agents.md", "constitution.md"];
const PROTECTED_MSG =
  "Protected starter file or real environment file. Scaffold in a temporary subdirectory or ask the human to perform the approved environment setup manually.";

const writeTargets = [];
// redirections (> / >>) and tee
for (const m of unquoted.matchAll(/(?:>>?|\btee\s+(?:-a\s+)?)\s*([^\s;|&]+)/g)) {
  writeTargets.push(m[1]);
}
// cp / mv / rsync → destination is the last non-flag token of the segment (best-effort)
for (const m of unquoted.matchAll(/\b(?:cp|mv|rsync)\b([^;|&]*)/g)) {
  const toks = m[1].split(/\s+/).filter((t) => t && !t.startsWith("-"));
  if (toks.length) writeTargets.push(toks[toks.length - 1]);
}
for (const t of writeTargets) {
  const base = (t.split("/").pop() || t);
  if (PROTECTED_STARTER.includes(base)) deny(PROTECTED_MSG);
  const isEnv = /^\.env$|^\.env\.[^/]+$/.test(base);
  if (isEnv && !ALLOWED_ENV.test(base)) deny(PROTECTED_MSG);
}

// --- 6) Scaffolders aimed at the repo root (would overwrite starter files) ---
const isScaffolder =
  /\b(create-next-app|create-react-app|create-remix|create-astro|create-svelte|create-vite|create-vue|nuxi)\b/.test(c) ||
  /\b(npm|pnpm|yarn|bun)\s+create\b/.test(c);
const targetsRoot = /\s\.(\/)?(\s|$)/.test(unquoted);
if (isScaffolder && targetsRoot) {
  deny("Blocked: scaffolding into the Starter Pack root would overwrite CLAUDE.md/AGENTS.md/docs. Scaffold in a temporary subdirectory (e.g. .tmp-app/) and integrate selectively.");
}

process.exit(0);
