#!/usr/bin/env node
// PreToolUse/Edit·MultiEdit·Write — best-effort block of obvious hardcoded secrets in
// new content aimed at VERSIONABLE files (exposure-based: ignored-and-untracked
// targets are skipped — they can never be committed). Heuristic, not exhaustive.
//
// Assignment-style keys (JWT_SECRET, STRIPE_SECRET_KEY, …) are flagged ONLY when the
// value looks like a LITERAL credential — code expressions (process.env.X, ${VAR},
// identifiers, property chains, function calls) and whole-value placeholders always
// pass. JWTs whose payload role is "anon" (Supabase public anon key) are allowed;
// "service_role" or undecodable payloads stay denied.

import { isVersionable } from "./lib/exposure.mjs";
import { INTRINSIC_SECRETS, ASSIGNMENT_KEYS, PUBLIC_KEY_PREFIX } from "./lib/secret-patterns.mjs";
import { logEvent } from "./lib/govlog.mjs";

let LOG_ROOT = "";

function deny(reason) {
  // Category only — the matched value is never logged (govlog contract).
  logEvent(LOG_ROOT, { hook: "scan-secrets", decision: "deny", code: reason.slice(0, 80) });
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

// Exposure-based short-circuit: content aimed at an ignored-and-untracked file can
// never be committed — skip the scan. Writes without an identifiable target path
// (defensive default) are scanned normally. quick-check still guards the diff at
// end of turn, and versionable targets get the full scan below.
const targetPath = (input.file_path ?? input.path ?? input.filePath ?? input.notebook_path ?? "").toString();
if (targetPath) {
  const root = (process.env.CLAUDE_PROJECT_DIR || payload.cwd || process.cwd()).toString();
  if (!isVersionable(targetPath, root)) process.exit(0);
}

// Collect all "new content" across Write / Edit / MultiEdit / NotebookEdit shapes.
const parts = [];
if (typeof input.content === "string") parts.push(input.content);
if (typeof input.new_string === "string") parts.push(input.new_string);
if (typeof input.new_source === "string") parts.push(input.new_source); // NotebookEdit cell
for (const key of ["edits", "replacements"]) {
  if (Array.isArray(input[key])) {
    for (const e of input[key]) {
      if (e && typeof e.new_string === "string") parts.push(e.new_string);
      if (e && typeof e.content === "string") parts.push(e.content);
    }
  }
}
const text = parts.join("\n");
if (!text.trim()) process.exit(0);

// A value is a safe placeholder ONLY if the WHOLE value is one (no substring matching).
const PLACEHOLDERS = new Set([
  "your_key_here", "change_me", "changeme", "placeholder", "example_value",
]);
function isPlaceholder(value) {
  const v = value.trim().replace(/^["']|["']$/g, "").toLowerCase();
  if (v === "") return true;
  if (PLACEHOLDERS.has(v)) return true;
  if (/^<.*>$/.test(v)) return true;        // <your-key>
  if (/^\$\{.*\}$/.test(v)) return true;    // ${ENV_VAR}
  if (/^x{6,}$/.test(v)) return true;       // xxxxxx
  return false;
}

// Known credential prefixes — a value carrying one of these is a literal credential
// regardless of character variety (char-class-free here is safe: values are runtime
// data, and this source never assigns them to a flagged key).
const CRED_PREFIX = /^(?:sk_live_|sk_test_|ghp_|github_pat_|AKIA|ASIA|AIza|eyJ|xox[abp]-)/;

// Character classes present in a value: lower / upper / digit / symbol.
function charClasses(v) {
  let n = 0;
  if (/[a-z]/.test(v)) n++;
  if (/[A-Z]/.test(v)) n++;
  if (/[0-9]/.test(v)) n++;
  if (/[^A-Za-z0-9]/.test(v)) n++;
  return n;
}

// Flag an assignment value ONLY when it looks like a LITERAL credential. Code
// expressions are never secrets — the old placeholder allowlist denied legitimate
// code that merely maps a flagged key to its process.env lookup.
function looksLikeLiteralCredential(value) {
  // Normalize: strip trailing , ; BEFORE the surrounding quotes so `= "literal";`
  // unwraps fully (quotes first would leave a dangling `";`), then re-trim.
  const v = value.trim().replace(/[,;]+$/, "").trim().replace(/^["']|["']$/g, "").trim();
  if (!v) return false;

  // Env lookups / template interpolation are code, not credentials — checked BEFORE
  // the credential-shape gate so a high-entropy env expression always passes.
  if (v.includes("process.env") || v.includes("os.environ") ||
      v.includes("import.meta.env") || v.includes("${")) return false;

  // Credential shape: known prefix, or high entropy (>= 16 chars drawn from
  // >= 3 character classes). Anything below this bar is never flagged here — and
  // nothing that clears it may slip out through the identifier escape below.
  const credShaped = CRED_PREFIX.test(v) || (v.length >= 16 && charClasses(v) >= 3);
  if (!credShaped) return false;

  // Everything reaching here is credential-shaped and not an env lookup → flag it.
  // (A dotted/parenthesized high-entropy token like `Xk9mZ2p.L8qR4vN1tY7w` cleared the
  // credential bar above, so it is treated as a secret, never as a code identifier.)
  return true;
}

// Assignment-style keys and intrinsic secret shapes live in the shared module
// (.claude/hooks/lib/secret-patterns.mjs) — one source for this hook, quick-check,
// and session-baseline. Placeholder + literal-credential checks apply to assignment
// values; intrinsic shapes always block (no placeholder exemption).
const ASSIGNMENTS = ASSIGNMENT_KEYS;
const INTRINSIC = INTRINSIC_SECRETS;

// A JWT whose payload role is "anon" is the Supabase PUBLIC anon key — allowed, but
// only when the payload ALSO carries a Supabase structural signal (a string `ref`
// claim, or an `iss` string containing "supabase"): a self-declared `role: "anon"`
// alone is forgeable, so a bare `{"role":"anon"}` stays on the deny path.
// "service_role" or an undecodable/other payload keeps the deny.
// NOTE: the signature is never verified — this role check is cosmetic classification
// to route the decision, not authentication.
function jwtIsPublicAnon(token) {
  // Skip decode entirely for oversized tokens (never a real anon key) — treat as
  // non-anon so they stay denied without paying the parse cost.
  if (token.length > 8192) return false;
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64url").toString("utf8"));
    if (payload === null || payload.role !== "anon") return false;
    const hasRef = typeof payload.ref === "string" && payload.ref.length > 0;
    const hasSupabaseIss = typeof payload.iss === "string" && payload.iss.includes("supabase");
    return hasRef || hasSupabaseIss;
  } catch {
    return false;
  }
}

const lines = text.split("\n");

for (const s of ASSIGNMENTS) {
  // Preserve each pattern's own flags — the generic rule is case-sensitive by design.
  const assignRe = new RegExp(s.re.source + "\\s*[:=]", s.re.flags);
  for (const line of lines) {
    if (!assignRe.test(line)) continue;
    // Client-exposed-by-design prefixes (NEXT_PUBLIC_ etc.) are exempt from the
    // GENERIC credential-name rule only — specific keys keep their deny.
    if (s.generic) {
      const key = (line.match(/([A-Za-z0-9_]+)\s*[:=]/) || [])[1] || "";
      if (PUBLIC_KEY_PREFIX.test(key)) continue;
    }
    // Split ONCE on the first : or = — re-joining with "=" corrupted values that
    // legitimately contain separators (JWT_SECRET=a:b=c became a=b=c).
    const value = line.replace(/^[^:=]*[:=]/, "");
    if (isPlaceholder(value)) continue;               // whole-value placeholder → allow
    if (!looksLikeLiteralCredential(value)) continue; // code expression / low entropy → allow
    deny(`Possible secret detected (${s.why}). Use placeholders and document required variables in .env.example.`);
  }
}

for (const s of INTRINSIC) {
  const m = text.match(s.re);
  if (!m) continue;
  // For URL credentials, let an obvious placeholder password through.
  if (s.group && isPlaceholder(m[s.group])) continue;
  // Supabase public anon key (JWT with role "anon") is publishable by design.
  if (s.jwt && jwtIsPublicAnon(m[0])) continue;
  deny(`Possible secret detected (${s.cat}). Use placeholders and document required variables in .env.example.`);
}

process.exit(0);
