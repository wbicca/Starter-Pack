// Single source of truth for secret-detection patterns.
// Consumers: .claude/hooks/scan-secrets.mjs (PreToolUse write-time guard),
// scripts/quality/quick-check.mjs and scripts/quality/session-baseline.mjs (Stop-hook
// net + session baseline). Fixing a pattern here fixes every consumer at once — the
// previous per-file copies had already drifted (the PEM pattern diverged silently).
//
// Regex char-classes keep this SOURCE FILE from ever matching its own patterns
// (e.g. a prefix + [A-Za-z0-9]{n,} never matches the literal "[A-Za-z0-9]{n,}").
// Consumers must NEVER print matched values — report file + category only.

// Intrinsic secret shapes: the value alone identifies a credential.
// { re, cat, jwt?, group? } — `jwt` marks tokens eligible for the Supabase public-anon
// exemption (scan-secrets only); `group` marks the capture holding a password whose
// placeholder-ness may exempt the match (database URLs).
export const INTRINSIC_SECRETS = [
  { re: /\bsk_live_[A-Za-z0-9]{4,}/, cat: "Stripe live secret token" },
  { re: /\bsk_test_[A-Za-z0-9]{4,}/, cat: "Stripe test secret token" },
  { re: /\bsk-ant-[A-Za-z0-9_-]{16,}/, cat: "Anthropic API key (sk-ant-)" },
  // OpenAI-style: sk- + long token (sk-ant- excluded so Anthropic keys report once).
  { re: /\bsk-(?!ant-)[A-Za-z0-9_-]{20,}/, cat: "OpenAI-style API key (sk-)" },
  { re: /\bxox[abprs]-[A-Za-z0-9-]{10,}/, cat: "Slack token (xox)" },
  { re: /\bAKIA[0-9A-Z]{12,}/, cat: "AWS access key (AKIA)" },
  { re: /\bASIA[0-9A-Z]{12,}/, cat: "AWS temp access key (ASIA)" },
  { re: /\bghp_[A-Za-z0-9]{20,}/, cat: "GitHub PAT (ghp_)" },
  { re: /\bgithub_pat_[A-Za-z0-9_]{20,}/, cat: "GitHub fine-grained PAT" },
  { re: /\bAIza[0-9A-Za-z_-]{20,}/, cat: "Google API key (AIza)" },
  // PEM private key — [A-Z ]* covers RSA/EC/DSA/OPENSSH/ENCRYPTED variants (and keeps
  // the exact literal out of this source).
  { re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/, cat: "PEM private key block" },
  // JWT: eyJ<20+> . <10+> . <10+>
  { re: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/, cat: "JWT token", jwt: true },
  // Database URL with inline credentials
  { re: /\b(?:postgres|postgresql):\/\/[^:\s/@]+:([^@\s/]+)@/, cat: "database URL with inline credentials", group: 1 },
];

// Assignment-style keys: KEY=value is flagged only when the VALUE looks like a literal
// credential (scan-secrets applies the entropy/placeholder gates). Specific names come
// first so their message wins; the generic rule catches any credential-named variable.
export const ASSIGNMENT_KEYS = [
  { re: /SUPABASE_SERVICE_ROLE_KEY/i, why: "Supabase service role key" },
  { re: /STRIPE_SECRET_KEY/i, why: "Stripe secret key" },
  { re: /RESEND_API_KEY/i, why: "Resend API key" },
  { re: /JWT_SECRET/i, why: "JWT secret" },
  { re: /PRIVATE_KEY/i, why: "private key" },
  { re: /[A-Z0-9_]*(?:API_KEY|ACCESS_KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*/i, why: "credential-named variable", generic: true },
];

// Client-exposed-by-design env prefixes: exempt from the GENERIC assignment rule only
// (a NEXT_PUBLIC_* value is publishable; specific rules like *_SERVICE_ROLE_KEY still
// apply if they match).
export const PUBLIC_KEY_PREFIX = /^(?:NEXT_PUBLIC_|VITE_|REACT_APP_|EXPO_PUBLIC_)/i;
