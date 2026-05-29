#!/usr/bin/env node
// PostToolUse/Edit·MultiEdit·Write — best-effort formatting, scoped to the edited file
// when possible. Never blocks the session, never installs, never builds/tests/typechecks.

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
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
let file = "";
try {
  const j = JSON.parse(raw || "{}");
  cwd = j.cwd || cwd;
  const ti = j.tool_input || {};
  file = ti.file_path || ti.path || ti.filePath || "";
} catch {
  /* fall back to process.cwd(), no file scope */
}

// No package.json → nothing to do.
let pkg;
try {
  pkg = JSON.parse(readFileSync(join(cwd, "package.json"), "utf8"));
} catch {
  process.exit(0);
}

// Detect the package manager by lockfile (then packageManager field as a hint).
function detectPM() {
  if (existsSync(join(cwd, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(cwd, "package-lock.json"))) return "npm";
  if (existsSync(join(cwd, "yarn.lock"))) return "yarn";
  if (existsSync(join(cwd, "bun.lockb")) || existsSync(join(cwd, "bun.lock"))) return "bun";
  const pm = (pkg.packageManager || "").split("@")[0];
  return ["pnpm", "npm", "yarn", "bun"].includes(pm) ? pm : null;
}
const pm = detectPM();
if (!pm) process.exit(0); // can't be sure how to run scripts → stay silent

// Build argv for "run <script> [file]" per package manager.
function argv(script, arg) {
  const a = arg ? [arg] : [];
  switch (pm) {
    case "npm": return ["run", script, ...(arg ? ["--", arg] : [])];
    case "pnpm": return [script, ...a];
    case "yarn": return [script, ...a];
    case "bun": return ["run", script, ...a];
  }
}

const scripts = pkg.scripts || {};
let chosen = null; // { args, note }
if (file && scripts["format:file"]) {
  chosen = { args: argv("format:file", file) };
} else if (file && scripts["lint:fix:file"]) {
  chosen = { args: argv("lint:fix:file", file) };
} else if (scripts["format"]) {
  // No file-scoped script → fall back to the global formatter, and say so.
  chosen = { args: argv("format"), note: `format-after-edit: no file-scoped script; ran '${pm} format' on the repo (fallback).` };
}
// Note: a global "lint" is intentionally NOT run automatically (can be slow / side-effecting).

if (!chosen) process.exit(0);

try {
  execFileSync(pm, chosen.args, { cwd, stdio: "ignore", timeout: 60_000 });
  if (chosen.note) console.error(chosen.note);
} catch {
  console.error(`format-after-edit: '${pm} ${chosen.args.join(" ")}' failed (non-blocking).`);
}

process.exit(0);
