#!/usr/bin/env node
// PostToolUse/Edit·MultiEdit·Write — best-effort format. Never blocks the session.

import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

function readStdin() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.on("data", (c) => (data += c));
    process.stdin.on("end", () => resolve(data));
  });
}

const raw = await readStdin();
let cwd = process.cwd();
try {
  cwd = JSON.parse(raw || "{}").cwd || cwd;
} catch {
  // ignore; fall back to process.cwd()
}

let pkg;
try {
  pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
} catch {
  process.exit(0); // no package.json (or unreadable) → silent
}

const scripts = pkg.scripts ?? {};
let cmd = null;
if (scripts.format) cmd = "pnpm format";
else if (scripts.lint) cmd = "pnpm lint --fix";

if (!cmd) process.exit(0); // no compatible script → silent

try {
  execSync(cmd, { cwd, stdio: "ignore", timeout: 60_000 });
} catch {
  console.error(`format-after-edit: '${cmd}' failed (non-blocking).`);
}

process.exit(0);
