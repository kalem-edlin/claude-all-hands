/**
 * Git utilities for claude-envoy.
 */

import { execSync, spawnSync } from "child_process";

// Protected branches - no planning required
const PROTECTED_BRANCHES = new Set([
  "main",
  "master",
  "develop",
  "development",
  "dev",
  "staging",
  "stage",
  "production",
  "prod",
]);

// Prefixes that indicate direct mode (no planning)
const DIRECT_MODE_PREFIXES = ["quick/", "curator/"];

/**
 * Get current git branch name.
 */
export function getBranch(): string {
  try {
    const result = spawnSync("git", ["branch", "--show-current"], {
      encoding: "utf-8",
    });
    return result.status === 0 ? result.stdout.trim() : "";
  } catch {
    return "";
  }
}

/**
 * Convert branch name to safe directory name (feat/auth -> feat-auth).
 */
export function sanitizeBranch(branch: string): string {
  return branch.replace(/[^a-zA-Z0-9_-]/g, "-");
}

/**
 * Check if branch should skip planning.
 */
export function isDirectModeBranch(branch: string): boolean {
  if (PROTECTED_BRANCHES.has(branch)) {
    return true;
  }
  return DIRECT_MODE_PREFIXES.some((prefix) => branch.startsWith(prefix));
}

/**
 * Auto-detect base branch using merge-base.
 * Respects BASE_BRANCH env variable if set.
 */
export function getBaseBranch(): string {
  // Check env variable first
  const envBase = process.env.BASE_BRANCH;
  if (envBase) {
    return envBase;
  }

  const candidates = ["main", "master", "develop", "staging", "production"];

  for (const base of candidates) {
    try {
      const result = spawnSync("git", ["merge-base", base, "HEAD"], {
        encoding: "utf-8",
      });
      if (result.status === 0) {
        return base;
      }
    } catch {
      continue;
    }
  }

  return "main";
}

/**
 * Get git diff against a reference.
 */
export function getDiff(ref: string): string {
  try {
    const result = spawnSync("git", ["diff", ref], {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB
    });

    if (result.status !== 0) {
      // Fallback to empty tree if ref doesn't exist (fresh repo)
      const emptyTree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";
      const fallback = spawnSync("git", ["diff", emptyTree], {
        encoding: "utf-8",
        maxBuffer: 10 * 1024 * 1024,
      });
      return fallback.stdout || "(No changes)";
    }

    return result.stdout || "(No changes)";
  } catch {
    return "(Unable to get diff)";
  }
}

/**
 * Get the project root directory (where .git is located).
 */
export function getProjectRoot(): string {
  try {
    const result = execSync("git rev-parse --show-toplevel", {
      encoding: "utf-8",
    });
    return result.trim();
  } catch {
    return process.cwd();
  }
}

/**
 * Get the plan directory path for current branch.
 */
export function getPlanDir(cwd?: string): string {
  const root = cwd ?? getProjectRoot();
  const branch = getBranch();
  const planId = sanitizeBranch(branch);
  return `${root}/.claude/plans/${planId}`;
}

