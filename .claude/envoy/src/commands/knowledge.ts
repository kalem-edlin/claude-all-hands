/**
 * Knowledge commands - semantic search and indexing for documentation.
 *
 * Commands:
 *   envoy knowledge search <index_name> <query>
 *   envoy knowledge reindex-all [--index_name <name>]
 *   envoy knowledge reindex-from-changes <index_name> --files <json_array>
 */

import { Command } from "commander";
import { BaseCommand, CommandResult } from "./base.js";
import { KnowledgeService, type FileChange } from "../lib/knowledge.js";

const getProjectRoot = (): string => {
  return process.env.PROJECT_ROOT || process.cwd();
};

/**
 * Search command - semantic search against indexed documents
 */
class SearchCommand extends BaseCommand {
  readonly name = "search";
  readonly description = "Semantic search (use descriptive phrases, not keywords)";

  defineArguments(cmd: Command): void {
    cmd
      .argument("<index_name>", "Index to search (docs, curator)")
      .argument("<query>", "Descriptive phrase (e.g. 'how to handle API authentication' not 'auth')");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const indexName = args.index_name as string;
    const query = args.query as string;

    if (!indexName || !query) {
      return this.error("validation_error", "index_name and query are required");
    }

    try {
      const service = new KnowledgeService(getProjectRoot());
      const results = await service.search(indexName, query);

      return this.success({
        message: "Search completed",
        query,
        index: indexName,
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
 * Reindex-all command - full rebuild of one or all indexes
 */
class ReindexAllCommand extends BaseCommand {
  readonly name = "reindex-all";
  readonly description = "Rebuild search index from all documents";

  defineArguments(cmd: Command): void {
    cmd.option("--index_name <name>", "Specific index to reindex (default: all)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const indexName = args.index_name as string | undefined;

    try {
      const service = new KnowledgeService(getProjectRoot());
      const results = await service.reindexAll(indexName);

      return this.success({
        message: indexName ? `Index '${indexName}' reindexed` : "All indexes reindexed",
        stats: results,
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
 * Reindex-from-changes command - incremental index update from file changes
 */
class ReindexFromChangesCommand extends BaseCommand {
  readonly name = "reindex-from-changes";
  readonly description = "Update index from changed files (for git hooks)";

  defineArguments(cmd: Command): void {
    cmd
      .argument("<index_name>", "Index to update (docs, curator)")
      .requiredOption("--files <json>", "JSON array of file changes");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const indexName = args.index_name as string;
    const filesJson = args.files as string;

    if (!indexName || !filesJson) {
      return this.error(
        "validation_error",
        "index_name and --files are required"
      );
    }

    let changes: FileChange[];
    try {
      changes = JSON.parse(filesJson);
    } catch {
      return this.error("validation_error", "Invalid JSON in --files parameter");
    }

    try {
      const service = new KnowledgeService(getProjectRoot());
      const result = await service.reindexFromChanges(indexName, changes);

      if (!result.success) {
        return {
          status: "error",
          error: {
            type: "missing_references",
            message: result.message,
          },
          data: {
            missing_references: result.missing_references,
            files: result.files,
          },
        };
      }

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
 * Status command - check index health
 */
class StatusCommand extends BaseCommand {
  readonly name = "status";
  readonly description = "Check index status and health";

  defineArguments(cmd: Command): void {
    // No arguments needed
  }

  async execute(): Promise<CommandResult> {
    try {
      const service = new KnowledgeService(getProjectRoot());
      const status = await service.checkIndexes();

      return this.success({
        valid_indexes: status.valid,
        missing_indexes: status.missing,
        needs_reindex: status.missing.length > 0,
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
