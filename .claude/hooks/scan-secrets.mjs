#!/usr/bin/env node
// PreToolUse/Edit·MultiEdit·Write — best-effort block of obvious hardcoded secrets in
// new content. Heuristic, not exhaustive: it catches common shapes, not every secret.
//
// Assignment-style keys (JWT_SECRET, STRIPE_SECRET_KEY, …) are flagged ONLY when the
// value looks like a LITERAL credential — code expressions (process.env.X, ${VAR},
// identifiers, property chains, function calls) and whole-value placeholders always
// pass. JWTs whose payload role is "anon" (Supabase public anon key) are allowed;
// "service_role" or undecodable payloads stay denied.

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

  // Identifier / property-chain / call escape — ONLY with an explicit code signal
  // ("." or "(") and never for credential-shaped values. A purely alphanumeric
  // high-entropy token, or a dotted/high-entropy token that clears the credential
  // bar (e.g. `Xk9mZ2p.L8qR4vN1tY7w`), is a credential, never an identifier.
  if (!credShaped && !CRED_PREFIX.test(v) && (v.includes(".") || v.includes("(")) &&
      /^[A-Za-z_$][\w.$]*(\(.*\))?$/.test(v)) return false;

  return true;
}

// Assignment-style: KEY=value. Placeholder + literal-credential checks apply to the value.
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
  { re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, why: "JWT token", jwt: true },
  // DATABASE_URL / POSTGRES_URL (or any postgres URL) with an inline real credential
  { re: /\b(?:postgres|postgresql):\/\/[^:\s\/@]+:([^@\s\/]+)@/, why: "database URL with inline credentials", group: 1 },
];

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
  const assignRe = new RegExp(s.re.source + "\\s*[:=]", "i");
  const line = lines.find((l) => assignRe.test(l));
  if (!line) continue;
  const value = line.split(/[:=]/).slice(1).join("=");
  if (isPlaceholder(value)) continue;               // whole-value placeholder → allow
  if (!looksLikeLiteralCredential(value)) continue; // code expression / low entropy → allow
  deny(`Possible secret detected (${s.why}). Use placeholders and document required variables in .env.example.`);
}

for (const s of INTRINSIC) {
  const m = text.match(s.re);
  if (!m) continue;
  // For URL credentials, let an obvious placeholder password through.
  if (s.group && isPlaceholder(m[s.group])) continue;
  // Supabase public anon key (JWT with role "anon") is publishable by design.
  if (s.jwt && jwtIsPublicAnon(m[0])) continue;
  deny(`Possible secret detected (${s.why}). Use placeholders and document required variables in .env.example.`);
}

process.exit(0);
