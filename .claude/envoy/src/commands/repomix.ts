/**
 * Repomix wrapper commands for claude-envoy.
 *
 * Provides budget-aware code extraction:
 * - estimate: Token count only (no code returned) for budget planning
 * - extract: Combined code content for all paths (after budget confirmed)
 *
 * Multi-path support: Both commands accept multiple paths to aggregate results.
 */

import { Command } from "commander";
import { BaseCommand, type CommandResult } from "./base.js";
import { runRepomix } from "../lib/repomix.js";

class RepomixEstimateCommand extends BaseCommand {
  readonly name = "estimate";
  readonly description = "Get aggregated token count for paths (no code returned)";

  defineArguments(cmd: Command): void {
    cmd.argument("<paths...>", "File or directory paths to estimate");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const paths = args.paths as string[];

    try {
      const { success, output, tokenCount, tree } = runRepomix(paths, true);

      if (!success) {
        return this.error("repomix_failed", output);
      }

      return this.success({
        paths,
        token_count: tokenCount,
        tree,
        message: `Estimated ${tokenCount} tokens for ${paths.length} path(s)`,
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("ETIMEDOUT")) {
        return this.error("timeout", "repomix timed out after 5 minutes");
      }
      if (e instanceof Error && e.message.includes("ENOENT")) {
        return this.error(
          "not_found",
          "repomix not found - ensure npx is available",
          "npm install -g repomix"
        );
      }
      return this.error("error", e instanceof Error ? e.message : String(e));
    }
  }
}

class RepomixExtractCommand extends BaseCommand {
  readonly name = "extract";
  readonly description = "Get combined code content for paths (for implementation context)";

  defineArguments(cmd: Command): void {
    cmd.argument("<paths...>", "File or directory paths to extract");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const paths = args.paths as string[];

    try {
      const { success, output, tokenCount } = runRepomix(paths, false);

      if (!success) {
        return this.error("repomix_failed", output);
      }

      return this.success({
        paths,
        token_count: tokenCount,
        content: output,
      });
    } catch (e) {
      if (e instanceof Error && e.message.includes("ETIMEDOUT")) {
        return this.error("timeout", "repomix timed out after 5 minutes");
      }
      if (e instanceof Error && e.message.includes("ENOENT")) {
        return this.error(
          "not_found",
          "repomix not found - ensure npx is available",
          "npm install -g repomix"
        );
      }
      return this.error("error", e instanceof Error ? e.message : String(e));
    }
  }
}

// Auto-discovered by cli.ts
export const COMMANDS = {
  estimate: RepomixEstimateCommand,
  extract: RepomixExtractCommand,
};

