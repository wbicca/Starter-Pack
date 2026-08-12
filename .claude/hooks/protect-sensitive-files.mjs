#!/usr/bin/env node
// PreToolUse/Edit·MultiEdit·Write — block writes to VERSIONABLE real .env files.
// Exposure-based: an ignored-and-untracked .env is local-only and passes; anything
// tracked or not git-ignored is denied (it could enter the next commit).

import { isVersionable } from "./lib/exposure.mjs";
import { logEvent } from "./lib/govlog.mjs";

let LOG_ROOT = "";

function deny(reason) {
  logEvent(LOG_ROOT, { hook: "protect-env", decision: "deny", code: reason.slice(0, 80) });
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
let payload;
try {
  payload = JSON.parse(raw || "{}");
} catch {
  process.exit(0);
}
const input = payload.tool_input ?? {};
LOG_ROOT = (process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd()).toString();

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
  const root = (process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd()).toString();
  // Ignored-and-untracked local .env → allowed (exposure-based policy).
  if (!isVersionable(path, root)) process.exit(0);
  deny("Real .env file is versionable (tracked or not git-ignored). Add it to .gitignore first, then retry — or use .env.example for shared placeholders.");
}

process.exit(0);
