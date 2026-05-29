#!/usr/bin/env node
// PreToolUse/Bash — block obviously destructive shell commands.

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

const c = cmd.toLowerCase();

// Hard-destructive patterns (regex, whitespace-tolerant).
const DANGEROUS = [
  { re: /rm\s+-rf?\s+\/(?:\s|$)/, why: "rm -rf / wipes the filesystem." },
  { re: /rm\s+-rf?\s+\*/, why: "rm -rf * deletes everything in the directory." },
  { re: /\bsudo\s+rm\b/, why: "sudo rm can destroy system files." },
  { re: /git\s+reset\s+--hard/, why: "git reset --hard discards uncommitted work." },
  { re: /git\s+clean\s+-[a-z]*f[a-z]*d|git\s+clean\s+-[a-z]*d[a-z]*f/, why: "git clean -fd removes untracked files/dirs." },
  { re: /chmod\s+-r\s+777/, why: "chmod -R 777 makes files world-writable." },
  { re: /docker\s+system\s+prune\s+-a/, why: "docker system prune -a removes all images/volumes." },
  { re: /find\s+\.\s+-delete/, why: "find . -delete recursively deletes files." },
  { re: /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/, why: "fork bomb." },
];

for (const d of DANGEROUS) {
  if (d.re.test(c)) {
    deny(`Blocked dangerous command: ${d.why} Ask for explicit confirmation, or preview with a listing command (e.g. ls / git status) first.`);
  }
}

// rm -rf of critical directories.
const CRITICAL = [".git", "node_modules", "dist", "build", ".next"];
const rmTarget = c.match(/rm\s+-rf?\s+([^\s;|&]+)/);
if (rmTarget) {
  const target = rmTarget[1].replace(/^\.?\//, "").replace(/\/+$/, "");
  if (CRITICAL.includes(target)) {
    deny(`Blocked: 'rm -rf ${rmTarget[1]}' removes the critical '${target}' directory. Confirm explicitly first, or use a safer/reversible approach.`);
  }
}

process.exit(0);
