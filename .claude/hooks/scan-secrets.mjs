#!/usr/bin/env node
// PreToolUse/Edit·MultiEdit·Write — block obvious hardcoded secrets in new content.

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

// Collect all "new content" fields across Write / Edit / MultiEdit shapes.
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

// Safe placeholders — if the assigned value is clearly a placeholder, ignore.
const PLACEHOLDER = /(your_key_here|change_me|changeme|example|placeholder|<[^>]*>|x{6,}|\.\.\.)/i;

const SECRETS = [
  { re: /SUPABASE_SERVICE_ROLE_KEY\s*=/, why: "Supabase service role key" },
  { re: /STRIPE_SECRET_KEY\s*=/, why: "Stripe secret key" },
  { re: /RESEND_API_KEY\s*=/, why: "Resend API key" },
  { re: /JWT_SECRET\s*=/, why: "JWT secret" },
  { re: /PRIVATE_KEY\s*=/, why: "private key" },
  { re: /\bsk_live_[A-Za-z0-9]/, why: "Stripe live secret token" },
  { re: /\bsk_test_[A-Za-z0-9]/, why: "Stripe test secret token" },
  { re: /-----BEGIN (?:RSA )?PRIVATE KEY-----/, why: "PEM private key block" },
  { re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, why: "JWT token" },
];

for (const s of SECRETS) {
  const m = text.match(s.re);
  if (!m) continue;
  // For KEY= patterns, check the value on that line isn't a placeholder.
  const line = text.split("\n").find((l) => s.re.test(l)) ?? "";
  const isAssignment = /=/.test(s.re.source);
  if (isAssignment) {
    const value = line.split("=").slice(1).join("=").trim().replace(/^["']|["']$/g, "");
    if (!value || PLACEHOLDER.test(value)) continue; // empty or placeholder → allow
  }
  deny(`Possible secret detected (${s.why}). Use placeholders and document required variables in .env.example.`);
}

process.exit(0);
