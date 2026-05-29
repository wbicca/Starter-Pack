#!/usr/bin/env node
// PreToolUse/Edit·MultiEdit·Write — best-effort block of obvious hardcoded secrets in
// new content. Heuristic, not exhaustive: it catches common shapes, not every secret.

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

// Collect all "new content" across Write / Edit / MultiEdit shapes.
const parts = [];
if (typeof input.content === "string") parts.push(input.content);
if (typeof input.new_string === "string") parts.push(input.new_string);
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

// Assignment-style: KEY=value. Placeholder check applies to the value.
const ASSIGNMENTS = [
  { re: /SUPABASE_SERVICE_ROLE_KEY/i, why: "Supabase service role key" },
  { re: /STRIPE_SECRET_KEY/i, why: "Stripe secret key" },
  { re: /RESEND_API_KEY/i, why: "Resend API key" },
  { re: /JWT_SECRET/i, why: "JWT secret" },
  { re: /PRIVATE_KEY/i, why: "private key" },
];

// Intrinsic secret shapes: always block (no placeholder exemption).
const INTRINSIC = [
  { re: /\bsk_live_[A-Za-z0-9]/, why: "Stripe live secret token" },
  { re: /\bsk_test_[A-Za-z0-9]/, why: "Stripe test secret token" },
  { re: /\bAKIA[0-9A-Z]{12,}/, why: "AWS access key id (AKIA)" },
  { re: /\bASIA[0-9A-Z]{12,}/, why: "AWS temporary access key id (ASIA)" },
  { re: /\bghp_[A-Za-z0-9]{20,}/, why: "GitHub personal access token (ghp_)" },
  { re: /\bgithub_pat_[A-Za-z0-9_]{20,}/, why: "GitHub fine-grained PAT" },
  { re: /\bAIza[0-9A-Za-z_\-]{20,}/, why: "Google API key (AIza)" },
  { re: /-----BEGIN (?:RSA )?PRIVATE KEY-----/, why: "PEM private key block" },
  { re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, why: "JWT token" },
  // DATABASE_URL / POSTGRES_URL (or any postgres URL) with an inline real credential
  { re: /\b(?:postgres|postgresql):\/\/[^:\s\/@]+:([^@\s\/]+)@/, why: "database URL with inline credentials", group: 1 },
];

const lines = text.split("\n");

for (const s of ASSIGNMENTS) {
  const assignRe = new RegExp(s.re.source + "\\s*[:=]", "i");
  const line = lines.find((l) => assignRe.test(l));
  if (!line) continue;
  const value = line.split(/[:=]/).slice(1).join("=");
  if (isPlaceholder(value)) continue; // whole-value placeholder → allow
  deny(`Possible secret detected (${s.why}). Use placeholders and document required variables in .env.example.`);
}

for (const s of INTRINSIC) {
  const m = text.match(s.re);
  if (!m) continue;
  // For URL credentials, let an obvious placeholder password through.
  if (s.group && isPlaceholder(m[s.group])) continue;
  deny(`Possible secret detected (${s.why}). Use placeholders and document required variables in .env.example.`);
}

process.exit(0);
