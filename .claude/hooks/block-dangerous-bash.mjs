#!/usr/bin/env node
// PreToolUse/Bash — best-effort block of obviously destructive commands and writes to
// real .env files. This is a safety NET, not a security boundary: a determined command
// can still be obfuscated past it. Keep it as defense-in-depth.

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: "deny",
      permissionDecisionReason: reason,
    },
  }));
  process.exit(0);
}

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

// Normalize: lowercase + strip quotes so quoted targets can't hide.
const c = cmd.toLowerCase();
const unquoted = c.replace(/['"]/g, "");

// Treat long rm flags as their short forms so --recursive --force == -rf.
const normRm = unquoted
  .replace(/--recursive/g, "-r")
  .replace(/--force/g, "-f")
  .replace(/--no-preserve-root/g, "");

// --- 1) Catastrophic rm of root / home ---
const RM_TARGET = /\br?m\s+(?:-[a-z]*\s+)*(\/\*?|\*|~|\$\{?home\}?)(?:\s|$)/;
// matches: rm -rf /   rm -rf /*   rm -rf *   rm -rf ~   rm -rf $HOME
// recursive flag may be combined (-rf) or split (--recursive --force → -r -f)
if (/\brm\b/.test(normRm) && /-[a-z]*r/.test(normRm) && RM_TARGET.test(normRm)) {
  deny("Blocked: recursive delete of a root/home/glob path. Confirm explicitly and target a specific subdirectory, or preview with ls first.");
}

// --- 2) Other hard-destructive patterns ---
const DANGEROUS = [
  { re: /rm\s+-[a-z]*r[a-z]*f?\s+\*/, why: "rm -rf * deletes everything in the directory." },
  { re: /\bsudo\s+rm\b/, why: "sudo rm can destroy system files." },
  { re: /git\s+reset\s+--hard/, why: "git reset --hard discards uncommitted work." },
  { re: /git\s+clean\b(?=.*-[a-z]*f)(?=.*-[a-z]*d)/, why: "git clean -fd removes untracked files/dirs (any flag order)." },
  { re: /chmod\s+-r\s+777/, why: "chmod -R 777 makes files world-writable." },
  { re: /docker\s+system\s+prune\s+-a/, why: "docker system prune -a removes all images/volumes." },
  { re: /find\s+\.\s+-delete/, why: "find . -delete recursively deletes files." },
  { re: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, why: "fork bomb." },
];
for (const d of DANGEROUS) {
  if (d.re.test(normRm)) {
    deny(`Blocked dangerous command: ${d.why} Ask for explicit confirmation, or preview with a listing command (e.g. ls / git status) first.`);
  }
}

// --- 3) rm -rf of a critical directory (quotes already stripped) ---
const CRITICAL = [".git", "node_modules", "dist", "build", ".next"];
const rmTarget = normRm.match(/\brm\s+(?:-[a-z]*\s+)*([^\s;|&>]+)/);
if (rmTarget) {
  const target = rmTarget[1].replace(/^\.?\//, "").replace(/\/+$/, "");
  if (CRITICAL.includes(target)) {
    deny(`Blocked: removing the critical '${target}' directory. Confirm explicitly first, or use a safer/reversible approach.`);
  }
}

// --- 4) Bash redirection / writes to a real .env file ---
// Catches: > .env   >> .env.local   cat > .env   tee .env   printf .. > .env.production
const ALLOWED_ENV = /\.env\.(example|local\.example|template)$|\.env\.example$/;
// pull candidate targets from redirections and tee
const targets = [];
for (const m of unquoted.matchAll(/(?:>>?|\btee\s+(?:-a\s+)?)\s*([^\s;|&]+)/g)) {
  targets.push(m[1]);
}
for (const t of targets) {
  const base = t.split("/").pop() || t;
  const isEnv = /^\.env$|^\.env\.[^/]+$/.test(base);
  const isAllowed = ALLOWED_ENV.test(base) || base === ".env.example" || base === ".env.local.example" || base === ".env.template";
  if (isEnv && !isAllowed) {
    deny("Blocked: writing to a real .env file via the shell. Real environment files are protected — use .env.example, or set values through your platform's secret manager.");
  }
}

process.exit(0);
