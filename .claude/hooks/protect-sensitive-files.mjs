#!/usr/bin/env node
// PreToolUse/Edit·MultiEdit·Write — block writes to real .env files.

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
let input;
try {
  input = JSON.parse(raw || "{}").tool_input ?? {};
} catch {
  process.exit(0);
}

const path = (input.file_path ?? input.path ?? input.filePath ?? input.notebook_path ?? "").toString();
if (!path) process.exit(0);

const base = path.split("/").pop();

// Safe templates are always allowed.
// keep in sync with .claude/hooks/block-dangerous-bash.mjs and scripts/quality/quick-check.mjs
const ALLOWED = [".env.example", ".env.local.example", ".env.template"];
if (ALLOWED.includes(base)) process.exit(0);

// Protected real env files: .env and ANY .env.* (templates above already passed).
const PROTECTED = /^\.env$|^\.env\.[^/]+$/;
if (PROTECTED.test(base)) {
  deny("Real environment files are protected. Use .env.example instead.");
}

process.exit(0);
