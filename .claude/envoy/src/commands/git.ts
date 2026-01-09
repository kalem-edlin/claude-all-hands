/**
 * Git helper commands for claude-envoy.
 *
 * Wraps git/gh CLI operations for orchestration system:
 * - get-base-branch: Returns base branch name (main/master/develop)
 * - is-base-branch: Returns if currently on base branch
 * - checkout-base: Checks out the base branch
 * - diff-base: Git diff vs base branch
 * - create-pr: Creates PR via gh cli
 * - cleanup-worktrees: Cleans merged/orphaned worktrees
 * - merge-worktree: Merges worktree branch into feature branch, records commit hash
 */

import { spawnSync } from "child_process";
import { Command } from "commander";
import { BaseCommand, type CommandResult } from "./base.js";
import { getBaseBranch, getBranch } from "../lib/git.js";
import { readPrompt, writePrompt, getPromptId } from "../lib/index.js";

interface ChangedFile {
  path: string;
  added: number;
  modified: number;
  deleted: number;
}

interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  lastCommitDate?: string;
}

/**
 * Run a git command and return stdout.
 */
function runGit(args: string[]): { success: boolean; stdout: string; stderr: string } {
  const result = spawnSync("git", args, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024, // 10MB
  });
  return {
    success: result.status === 0,
    stdout: result.stdout?.trim() || "",
    stderr: result.stderr?.trim() || "",
  };
}

/**
 * Run gh CLI command and return stdout.
 */
function runGh(args: string[]): { success: boolean; stdout: string; stderr: string } {
  const result = spawnSync("gh", args, {
    encoding: "utf-8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return {
    success: result.status === 0,
    stdout: result.stdout?.trim() || "",
    stderr: result.stderr?.trim() || "",
  };
}

/**
 * Parse git diff --stat output to get changed files with line counts.
 */
function parseChangedFiles(diffStat: string): ChangedFile[] {
  const files: ChangedFile[] = [];
  const lines = diffStat.split("\n");

  for (const line of lines) {
    // Match: path | N + M - pattern or simpler variations
    // Examples:
    //   src/file.ts | 10 +++++-----
    //   src/new.ts  | 5 +++++
    //   src/del.ts  | 3 ---
    const match = line.match(/^\s*(.+?)\s+\|\s+(\d+)\s*([\+\-]*)?/);
    if (match) {
      const path = match[1].trim();
      const plusCount = (match[3] || "").match(/\+/g)?.length || 0;
      const minusCount = (match[3] || "").match(/-/g)?.length || 0;

      // Skip summary line (e.g., "3 files changed, 10 insertions...")
      if (path.includes("changed") || path.includes("insertion") || path.includes("deletion")) {
        continue;
      }

      files.push({
        path,
        added: plusCount,
        modified: Math.min(plusCount, minusCount), // Overlapping changes
        deleted: minusCount,
      });
    }
  }

  return files;
}

/**
 * Parse git worktree list output.
 */
function parseWorktrees(): WorktreeInfo[] {
  const { success, stdout } = runGit(["worktree", "list", "--porcelain"]);
  if (!success) return [];

  const worktrees: WorktreeInfo[] = [];
  let current: Partial<WorktreeInfo> = {};

  for (const line of stdout.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current.path) {
        worktrees.push(current as WorktreeInfo);
      }
      current = { path: line.substring(9) };
    } else if (line.startsWith("HEAD ")) {
      current.commit = line.substring(5);
    } else if (line.startsWith("branch ")) {
      // refs/heads/branch-name -> branch-name
      current.branch = line.substring(7).replace("refs/heads/", "");
    }
  }

  if (current.path) {
    worktrees.push(current as WorktreeInfo);
  }

  return worktrees;
}

/**
 * Get last commit date for a branch.
 */
function getLastCommitDate(branch: string): string | undefined {
  const { success, stdout } = runGit([
    "log",
    "-1",
    "--format=%ci",
    branch,
  ]);
  return success ? stdout : undefined;
}

// ============================================================================
// Git Commands
// ============================================================================

/**
 * Get base branch name for this repository.
 */
class GetBaseBranchCommand extends BaseCommand {
  readonly name = "get-base-branch";
  readonly description = "Returns base branch name (main/master/develop)";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const baseBranch = getBaseBranch();

    return this.success({
      branch: baseBranch,
    });
  }
}

/**
 * Check if currently on base branch.
 */
class IsBaseBranchCommand extends BaseCommand {
  readonly name = "is-base-branch";
  readonly description = "Returns if currently on base branch";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const currentBranch = getBranch();
    if (!currentBranch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const baseBranch = getBaseBranch();
    const isBase = currentBranch === baseBranch;

    return this.success({
      is_base: isBase,
      current_branch: currentBranch,
      base_branch: baseBranch,
    });
  }
}

/**
 * Checkout the base branch.
 */
class CheckoutBaseCommand extends BaseCommand {
  readonly name = "checkout-base";
  readonly description = "Checks out the base branch";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const currentBranch = getBranch();
    if (!currentBranch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const baseBranch = getBaseBranch();

    const { success, stderr } = runGit(["checkout", baseBranch]);

    if (!success) {
      return this.error("checkout_failed", `Failed to checkout ${baseBranch}: ${stderr}`);
    }

    return this.success({
      success: true,
      branch: baseBranch,
      previous_branch: currentBranch,
    });
  }
}

/**
 * Git diff vs base branch.
 */
class DiffBaseCommand extends BaseCommand {
  readonly name = "diff-base";
  readonly description = "Git diff vs base branch";

  defineArguments(cmd: Command): void {
    cmd.option("--path <path>", "Optional path to scope the diff");
    cmd.option("--summary", "Return summary instead of full diff");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const currentBranch = getBranch();
    if (!currentBranch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const baseBranch = getBaseBranch();
    const path = args.path as string | undefined;
    const summaryOnly = !!args.summary;

    // Build diff command
    const diffArgs = ["diff", `${baseBranch}...HEAD`];
    if (path) {
      diffArgs.push("--", path);
    }

    // Get full diff or summary
    let diff: string;
    if (summaryOnly) {
      diffArgs.push("--stat");
      const result = runGit(diffArgs);
      diff = result.stdout;
    } else {
      const result = runGit(diffArgs);
      diff = result.stdout || "(No changes)";
    }

    // Always get stat for changed_files
    const statArgs = ["diff", `${baseBranch}...HEAD`, "--stat"];
    if (path) {
      statArgs.push("--", path);
    }
    const statResult = runGit(statArgs);
    const changedFiles = parseChangedFiles(statResult.stdout);

    return this.success({
      diff,
      changed_files: changedFiles,
      base_branch: baseBranch,
      current_branch: currentBranch,
      path: path || null,
    });
  }
}

/**
 * Create PR via gh cli.
 */
class CreatePrCommand extends BaseCommand {
  readonly name = "create-pr";
  readonly description = "Creates PR via gh cli";

  defineArguments(cmd: Command): void {
    cmd.requiredOption("--title <title>", "PR title");
    cmd.requiredOption("--body <body>", "PR body/description");
    cmd.option("--draft", "Create as draft PR");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const currentBranch = getBranch();
    if (!currentBranch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const baseBranch = getBaseBranch();
    const title = args.title as string;
    const body = args.body as string;
    const draft = !!args.draft;

    // Check if gh CLI is available
    const ghCheck = runGh(["--version"]);
    if (!ghCheck.success) {
      return this.error(
        "gh_not_found",
        "GitHub CLI (gh) not found",
        "Install with: brew install gh"
      );
    }

    // Check if authenticated
    const authCheck = runGh(["auth", "status"]);
    if (!authCheck.success) {
      return this.error(
        "gh_not_authenticated",
        "GitHub CLI not authenticated",
        "Run: gh auth login"
      );
    }

    // Ensure current branch is pushed
    const pushResult = runGit(["push", "-u", "origin", currentBranch]);
    if (!pushResult.success) {
      return this.error(
        "push_failed",
        `Failed to push branch: ${pushResult.stderr}`
      );
    }

    // Create PR
    const prArgs = ["pr", "create", "--base", baseBranch, "--title", title, "--body", body];
    if (draft) {
      prArgs.push("--draft");
    }

    const prResult = runGh(prArgs);
    if (!prResult.success) {
      return this.error(
        "pr_create_failed",
        `Failed to create PR: ${prResult.stderr}`
      );
    }

    // Extract PR URL from output
    const prUrl = prResult.stdout.trim();

    return this.success({
      success: true,
      pr_url: prUrl,
      base_branch: baseBranch,
      head_branch: currentBranch,
    });
  }
}

/**
 * Clean merged/orphaned worktrees.
 */
class CleanupWorktreesCommand extends BaseCommand {
  readonly name = "cleanup-worktrees";
  readonly description = "Cleans merged/orphaned worktrees";

  defineArguments(cmd: Command): void {
    cmd.option("--dry-run", "Show what would be cleaned without actually cleaning");
    cmd.option("--force-orphans", "Force delete orphaned worktrees without prompting");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const currentBranch = getBranch();
    if (!currentBranch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const baseBranch = getBaseBranch();
    const dryRun = !!args["dry-run"];
    const forceOrphans = !!args["force-orphans"];

    // Get all worktrees
    const worktrees = parseWorktrees();

    // Filter to implementation worktrees (pattern: *--implementation-*)
    // Uses double-dash separator because git doesn't allow branch/subbranch if branch exists
    const implWorktrees = worktrees.filter((wt) =>
      wt.branch && /--implementation-/.test(wt.branch)
    );

    const cleaned: string[] = [];
    const orphaned: WorktreeInfo[] = [];
    const kept: string[] = [];
    const errors: string[] = [];

    // Check merged status for each worktree
    for (const wt of implWorktrees) {
      // Check if branch is merged into base
      const mergeCheck = runGit(["branch", "--merged", baseBranch]);
      const isMerged = mergeCheck.success &&
        mergeCheck.stdout.split("\n").some((b) => b.trim() === wt.branch);

      if (isMerged) {
        // Branch is merged - clean it up
        if (!dryRun) {
          // Remove worktree
          const removeWt = runGit(["worktree", "remove", wt.path, "--force"]);
          if (!removeWt.success) {
            errors.push(`Failed to remove worktree ${wt.path}: ${removeWt.stderr}`);
            continue;
          }

          // Delete branch
          const removeBranch = runGit(["branch", "-d", wt.branch]);
          if (!removeBranch.success) {
            errors.push(`Failed to delete branch ${wt.branch}: ${removeBranch.stderr}`);
          }
        }
        cleaned.push(wt.branch);
      } else {
        // Check if orphaned (no matching prompt in plan directory)
        // For now, mark as orphaned if not merged
        const lastCommit = getLastCommitDate(wt.branch);
        orphaned.push({
          ...wt,
          lastCommitDate: lastCommit,
        });
      }
    }

    // Handle orphaned worktrees
    for (const wt of orphaned) {
      if (forceOrphans && !dryRun) {
        // Force delete
        const removeWt = runGit(["worktree", "remove", wt.path, "--force"]);
        if (removeWt.success) {
          const removeBranch = runGit(["branch", "-D", wt.branch]);
          cleaned.push(wt.branch);
        } else {
          errors.push(`Failed to remove orphaned worktree ${wt.path}: ${removeWt.stderr}`);
          kept.push(wt.branch);
        }
      } else {
        kept.push(wt.branch);
      }
    }

    return this.success({
      cleaned,
      orphaned: orphaned.map((wt) => ({
        branch: wt.branch,
        path: wt.path,
        last_commit: wt.lastCommitDate,
      })),
      kept,
      errors: errors.length > 0 ? errors : undefined,
      dry_run: dryRun,
    });
  }
}

/**
 * Merge a worktree branch back into feature branch and record the merge commit hash.
 * Handles three scenarios:
 * 1. Already merged → find merge commit and record hash
 * 2. Merge in progress (conflicts) → error with resolution instructions
 * 3. Not merged → attempt merge, record hash on success
 */
class MergeWorktreeCommand extends BaseCommand {
  readonly name = "merge-worktree";
  readonly description = "Merge worktree branch into feature branch, record commit hash";

  defineArguments(cmd: Command): void {
    cmd.argument("<prompt_num>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const featureBranch = getBranch();
    if (!featureBranch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const promptNum = parseInt(args.prompt_num as string, 10);
    if (isNaN(promptNum) || promptNum < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variantArg = args.variant as string | undefined;
    const variant = variantArg && /^[A-Z]$/.test(variantArg) ? variantArg : null;
    if (variantArg && !variant) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    // Read prompt to get worktree branch name
    const prompt = readPrompt(promptNum, variant);
    if (!prompt) {
      const id = getPromptId(promptNum, variant);
      return this.error("not_found", `Prompt ${id} not found`);
    }

    const worktreeBranch = prompt.frontMatter.worktree_branch_name;
    if (!worktreeBranch) {
      return this.error("no_worktree", "Prompt has no worktree branch assigned");
    }

    const promptId = getPromptId(promptNum, variant);

    // Check if already has merge_commit_hash recorded
    if (prompt.frontMatter.merge_commit_hash) {
      return this.success({
        skipped: true,
        reason: "Already has merge commit hash recorded",
        merge_commit_hash: prompt.frontMatter.merge_commit_hash,
      });
    }

    // Check for merge in progress (unresolved conflicts)
    const mergeHead = runGit(["rev-parse", "--verify", "MERGE_HEAD"]);
    if (mergeHead.success) {
      return this.error(
        "merge_in_progress",
        "Merge in progress with unresolved conflicts. Resolve conflicts and commit, then re-run this command.",
        "After resolving: git add . && git commit, then re-run merge-worktree"
      );
    }

    // Check if worktree branch exists
    const branchCheck = runGit(["rev-parse", "--verify", worktreeBranch]);
    if (!branchCheck.success) {
      return this.error("branch_not_found", `Worktree branch ${worktreeBranch} not found`);
    }

    // Check if already merged (worktree branch is ancestor of current HEAD)
    const mergeBase = runGit(["merge-base", "--is-ancestor", worktreeBranch, "HEAD"]);
    if (mergeBase.success) {
      // Already merged - find the merge commit
      // Look for merge commits that mention this prompt
      const mergeCommit = runGit([
        "log", "--oneline", "--merges", "--grep", `Merge prompt ${promptId}`,
        "-n", "1", "--format=%H"
      ]);

      if (mergeCommit.success && mergeCommit.stdout) {
        // Found the merge commit
        const updatedFrontMatter = {
          ...prompt.frontMatter,
          merge_commit_hash: mergeCommit.stdout,
          status: "merged" as const,
        };
        writePrompt(promptNum, variant, updatedFrontMatter, prompt.content);

        return this.success({
          prompt_id: promptId,
          worktree_branch: worktreeBranch,
          merge_commit_hash: mergeCommit.stdout,
          status: "merged",
          found_existing: true,
        });
      }

      // Branch is merged but can't find specific commit - use most recent merge or HEAD
      const headHash = runGit(["rev-parse", "HEAD"]);
      if (headHash.success) {
        const updatedFrontMatter = {
          ...prompt.frontMatter,
          merge_commit_hash: headHash.stdout,
          status: "merged" as const,
        };
        writePrompt(promptNum, variant, updatedFrontMatter, prompt.content);

        return this.success({
          prompt_id: promptId,
          worktree_branch: worktreeBranch,
          merge_commit_hash: headHash.stdout,
          status: "merged",
          found_existing: true,
          note: "Branch was already merged, using HEAD as merge commit",
        });
      }
    }

    // Not merged yet - perform the merge
    const merge = runGit(["merge", "--no-ff", worktreeBranch, "-m", `Merge prompt ${promptId} implementation`]);
    if (!merge.success) {
      // Check if it's a conflict
      if (merge.stderr.includes("CONFLICT") || merge.stderr.includes("Automatic merge failed")) {
        return this.error(
          "merge_conflict",
          "Merge conflict detected. Resolve conflicts manually, commit, then re-run this command to record hash.",
          "After resolving: git add . && git commit -m 'Resolve merge conflicts', then re-run merge-worktree"
        );
      }
      return this.error("merge_failed", `Merge failed: ${merge.stderr}`);
    }

    // Get the merge commit hash
    const commitHash = runGit(["rev-parse", "HEAD"]);
    if (!commitHash.success) {
      return this.error("git_error", `Failed to get merge commit hash: ${commitHash.stderr}`);
    }

    // Update prompt with merge commit hash and status
    const updatedFrontMatter = {
      ...prompt.frontMatter,
      merge_commit_hash: commitHash.stdout,
      status: "merged" as const,
    };
    writePrompt(promptNum, variant, updatedFrontMatter, prompt.content);

    return this.success({
      prompt_id: promptId,
      worktree_branch: worktreeBranch,
      merge_commit_hash: commitHash.stdout,
      status: "merged",
    });
  }
}

// Auto-discovered by cli.ts
export const COMMANDS = {
  "get-base-branch": GetBaseBranchCommand,
  "is-base-branch": IsBaseBranchCommand,
  "checkout-base": CheckoutBaseCommand,
  "diff-base": DiffBaseCommand,
  "create-pr": CreatePrCommand,
  "cleanup-worktrees": CleanupWorktreesCommand,
  "merge-worktree": MergeWorktreeCommand,
};
