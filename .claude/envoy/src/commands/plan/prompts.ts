/**
 * Prompt commands: write-prompt, read-prompt, clear-prompt, validate/update dependencies
 */

import { Command } from "commander";
import type { PromptFrontMatter } from "../../lib/index.js";
import {
  deletePrompt,
  getBranch,
  getPromptId,
  planExists,
  readAllPrompts,
  readPrompt,
  writePrompt,
} from "../../lib/index.js";
import { BaseCommand, CommandResult } from "../base.js";

/**
 * Create or update a prompt file.
 */
export class WritePromptCommand extends BaseCommand {
  readonly name = "write-prompt";
  readonly description = "Create prompt file with YAML front matter";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
    cmd.option("--files <files>", "Comma-separated relevant file paths");
    cmd.option("--depends-on <deps>", "Comma-separated prompt numbers this depends on");
    cmd.option("--debug", "Mark as debugging task");
    cmd.option("--criteria <criteria>", "Success criteria for the prompt");
    cmd.option("--context <context>", "Full approach and implementation notes");
    cmd.option("--requires-testing", "Flag if manual user testing required");
    cmd.option("--description <description>", "Human-readable summary");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    // Parse comma-separated values
    const files = args.files
      ? (args.files as string).split(",").map((f) => f.trim()).filter(Boolean)
      : [];
    const dependsOn = args.dependsOn
      ? (args.dependsOn as string).split(",").map((d) => parseInt(d.trim(), 10)).filter((n) => !isNaN(n))
      : [];

    const frontMatter: Partial<PromptFrontMatter> = {
      number,
      variant: variant || null,
      relevant_files: files,
      depends_on: dependsOn,
      kind: args.debug ? "debug" : "feature",
      success_criteria: (args.criteria as string) || "",
      requires_manual_testing: !!args.requiresTesting,
      description: (args.description as string) || "",
      planned_at: new Date().toISOString(),
    };

    const content = (args.context as string) || "# Approach & Plan\n\n";

    writePrompt(number, variant || null, frontMatter, content);

    return this.success({
      id: getPromptId(number, variant || null),
      created: true,
    });
  }
}

/**
 * Delete a prompt file.
 */
export class ClearPromptCommand extends BaseCommand {
  readonly name = "clear-prompt";
  readonly description = "Delete a prompt file";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const id = getPromptId(number, variant || null);
    const deleted = deletePrompt(number, variant || null);

    if (deleted) {
      return this.success({
        id,
        deleted: true,
      });
    } else {
      return this.error("not_found", `Prompt ${id} not found`);
    }
  }
}

/**
 * Read a prompt file.
 */
export class ReadPromptCommand extends BaseCommand {
  readonly name = "read-prompt";
  readonly description = "Read a prompt file";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const id = getPromptId(number, variant || null);
    const prompt = readPrompt(number, variant || null);
    if (!prompt) {
      return this.error("not_found", `Prompt ${id} not found`);
    }

    return this.success({
      id,
      front_matter: prompt.frontMatter,
      content: prompt.content,
    });
  }
}

/**
 * Validate that all prompt dependencies are still valid (not stale).
 */
export class ValidateDependenciesCommand extends BaseCommand {
  readonly name = "validate-dependencies";
  readonly description = "Check if prompt dependencies are stale";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    if (!planExists()) {
      return this.error("no_plan", "No plan directory exists for this branch");
    }

    const prompts = readAllPrompts();

    // Build map of prompt id -> planned_at
    const plannedAtMap = new Map<number, string>();
    for (const p of prompts) {
      // Use number as key (variants share dependency tracking with base)
      plannedAtMap.set(p.number, p.frontMatter.planned_at);
    }

    const stalePromptIds: string[] = [];

    for (const p of prompts) {
      const promptPlannedAt = new Date(p.frontMatter.planned_at).getTime();

      for (const depNum of p.frontMatter.depends_on) {
        const depPlannedAt = plannedAtMap.get(depNum);
        if (depPlannedAt) {
          const depTime = new Date(depPlannedAt).getTime();
          if (depTime > promptPlannedAt) {
            // Dependency was modified after this prompt was planned
            stalePromptIds.push(getPromptId(p.number, p.variant));
            break; // Only add once per prompt
          }
        }
      }
    }

    return this.success({
      valid: stalePromptIds.length === 0,
      stale_prompt_ids: stalePromptIds,
    });
  }
}

/**
 * Update prompt dependencies without changing planned_at.
 */
export class UpdatePromptDependenciesCommand extends BaseCommand {
  readonly name = "update-prompt-dependencies";
  readonly description = "Update depends_on and bump planned_at to resolve staleness";

  defineArguments(cmd: Command): void {
    cmd.argument("<number>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
    cmd.option("--depends-on <deps>", "Comma-separated prompt numbers this depends on");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const number = parseInt(args.number as string, 10);
    if (isNaN(number) || number < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const id = getPromptId(number, variant || null);

    // Read existing prompt
    const prompt = readPrompt(number, variant || null);
    if (!prompt) {
      return this.error("not_found", `Prompt ${id} not found`);
    }

    // Parse new depends_on
    const dependsOnStr = args.dependsOn as string | undefined;
    const newDependsOn = dependsOnStr
      ? dependsOnStr.split(",").map((d) => parseInt(d.trim(), 10)).filter((n) => !isNaN(n))
      : [];

    // Bump planned_at to resolve staleness when deps change
    const newPlannedAt = new Date().toISOString();

    // Update depends_on and planned_at
    const updatedFrontMatter = {
      ...prompt.frontMatter,
      depends_on: newDependsOn,
      planned_at: newPlannedAt,
    };

    writePrompt(number, variant || null, updatedFrontMatter, prompt.content);

    return this.success({
      id,
      depends_on: newDependsOn,
      planned_at: newPlannedAt,
      previous_planned_at: prompt.frontMatter.planned_at,
    });
  }
}
