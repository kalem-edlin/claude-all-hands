/**
 * Knowledge commands - semantic search and indexing for docs/ documentation.
 *
 * Commands:
 *   envoy knowledge search <query> [--metadata-only]
 *   envoy knowledge reindex-all
 *   envoy knowledge reindex-from-changes [--files <json_array>]
 */

import { Command } from "commander";
import { spawnSync } from "child_process";
import { BaseCommand, CommandResult } from "./base.js";
import { KnowledgeService, type FileChange } from "../lib/knowledge.js";
import { getBaseBranch } from "../lib/git.js";

const getProjectRoot = (): string => {
  return process.env.PROJECT_ROOT || process.cwd();
};

/**
 * Auto-detect doc file changes since branch diverged from base.
 * Returns FileChange[] for docs/ files only.
 */
function getDocChangesFromGit(): FileChange[] {
  const baseBranch = getBaseBranch();
  const cwd = getProjectRoot();

  // Get merge-base commit
  const mergeBaseResult = spawnSync("git", ["merge-base", baseBranch, "HEAD"], {
    encoding: "utf-8",
    cwd,
  });

  if (mergeBaseResult.status !== 0) {
    return [];
  }

  const mergeBase = mergeBaseResult.stdout.trim();

  // Get changed files since merge-base, filtered to docs/
  const diffResult = spawnSync(
    "git",
    ["diff", "--name-status", `${mergeBase}..HEAD`, "--", "docs/"],
    { encoding: "utf-8", cwd }
  );

  if (diffResult.status !== 0 || !diffResult.stdout.trim()) {
    return [];
  }

  const changes: FileChange[] = [];
  const lines = diffResult.stdout.trim().split("\n");

  for (const line of lines) {
    const [status, filePath] = line.split("\t");
    if (!filePath || !filePath.endsWith(".md")) continue;
    // Skip README.md files (navigation only, not indexed)
    if (filePath.endsWith("README.md")) continue;

    if (status === "A") {
      changes.push({ path: filePath, added: true });
    } else if (status === "M") {
      changes.push({ path: filePath, modified: true });
    } else if (status === "D") {
      changes.push({ path: filePath, deleted: true });
    }
  }

  return changes;
}

/**
 * Search command - semantic search against docs index
 */
class SearchCommand extends BaseCommand {
  readonly name = "search";
  readonly description = "Semantic search docs (use descriptive phrases, not keywords)";

  defineArguments(cmd: Command): void {
    cmd
      .argument("<query>", "Descriptive phrase (e.g. 'how to handle API authentication' not 'auth')")
      .option("--metadata-only", "Return only file paths and descriptions (no full content)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const query = args.query as string;
    const metadataOnly = !!args.metadataOnly;

    if (!query) {
      return this.error("validation_error", "query is required");
    }

    try {
      const service = new KnowledgeService(getProjectRoot());
      const results = await service.search(query, 50, metadataOnly);

      return this.success({
        message: "Search completed",
        query,
        metadata_only: metadataOnly,
        results,
        result_count: results.length,
      });
    } catch (e) {
      return this.error(
        "search_error",
        e instanceof Error ? e.message : String(e)
      );
    }
  }
}

/**
 * Reindex-all command - full rebuild of docs index
 */
class ReindexAllCommand extends BaseCommand {
  readonly name = "reindex-all";
  readonly description = "Rebuild docs search index";

  defineArguments(): void {
    // No arguments
  }

  async execute(): Promise<CommandResult> {
    try {
      const service = new KnowledgeService(getProjectRoot());
      const result = await service.reindexAll();

      return this.success({
        message: "Docs index reindexed",
        stats: result,
      });
    } catch (e) {
      return this.error(
        "reindex_error",
        e instanceof Error ? e.message : String(e)
      );
    }
  }
}

/**
 * Reindex-from-changes command - incremental index update from file changes.
 * Auto-detects changes from git merge-base if --files not provided.
 */
class ReindexFromChangesCommand extends BaseCommand {
  readonly name = "reindex-from-changes";
  readonly description = "Update docs index from changed files (auto-detects from git if --files omitted)";

  defineArguments(cmd: Command): void {
    cmd.option("--files <json>", "JSON array of file changes (optional, auto-detects from git merge-base if omitted)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const filesJson = args.files as string | undefined;

    let changes: FileChange[];

    if (filesJson) {
      // Explicit --files provided
      try {
        changes = JSON.parse(filesJson);
      } catch {
        return this.error("validation_error", "Invalid JSON in --files parameter");
      }
    } else {
      // Auto-detect from git merge-base
      changes = getDocChangesFromGit();
      if (changes.length === 0) {
        return this.success({
          message: "No doc changes detected since branch diverged from base",
          files: [],
        });
      }
    }

    try {
      const service = new KnowledgeService(getProjectRoot());
      const result = await service.reindexFromChanges(changes);

      return this.success({
        message: result.message,
        files: result.files,
      });
    } catch (e) {
      return this.error(
        "reindex_error",
        e instanceof Error ? e.message : String(e)
      );
    }
  }
}

/**
 * Status command - check docs index health
 */
class StatusCommand extends BaseCommand {
  readonly name = "status";
  readonly description = "Check docs index status";

  defineArguments(): void {
    // No arguments
  }

  async execute(): Promise<CommandResult> {
    try {
      const service = new KnowledgeService(getProjectRoot());
      const status = await service.checkIndex();

      return this.success({
        index_exists: status.exists,
        needs_reindex: !status.exists,
      });
    } catch (e) {
      return this.error(
        "status_error",
        e instanceof Error ? e.message : String(e)
      );
    }
  }
}

export const COMMANDS = {
  search: SearchCommand,
  "reindex-all": ReindexAllCommand,
  "reindex-from-changes": ReindexFromChangesCommand,
  status: StatusCommand,
};
