#!/usr/bin/env node
// Shared exposure check for the PreToolUse security hooks.
//
// A path is "versionable" when it could end up in a commit: it is TRACKED by git,
// or it is NOT git-ignored. The security hooks block only versionable targets —
// an ignored-and-untracked local file (e.g. a real .env kept out of git) is a
// local-machine concern, not an exposure risk. The quick-check Stop hook applies
// the same criterion at end of turn (its `.env` blocker is already
// versionability-based) — this helper brings the PreToolUse layer in line.
//
// FAIL-SAFE: any git failure (git missing, not a repo, timeout, bad path) reports
// versionable = true, so callers BLOCK. Never widen access on an error.

import { spawnSync } from "node:child_process";

export function isVersionable(target, root) {
  const opts = {
    cwd: root, encoding: "utf8", timeout: 2000,
    stdio: ["ignore", "ignore", "ignore"],
  };
  // Tracked → versionable regardless of .gitignore (it is already in history).
  const tracked = spawnSync("git", ["ls-files", "--error-unmatch", "--", target], opts);
  if (tracked.error || tracked.status === null) return true; // git missing / timeout
  if (tracked.status === 0) return true;                     // tracked
  // Untracked: ignored → local-only; not ignored → would enter the next commit.
  const ignored = spawnSync("git", ["check-ignore", "-q", "--", target], opts);
  if (ignored.error || ignored.status === null) return true;
  if (ignored.status === 0) return false;                    // ignored + untracked
  return true;                                               // 1 = not ignored · 128 = not a repo
}
