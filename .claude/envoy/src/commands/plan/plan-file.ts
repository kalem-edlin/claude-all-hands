/**
 * Plan file commands: write-plan, get-full-plan, append-user-input
 */

import { Command } from "commander";
import {
  appendUserInput as appendUserInputLib,
  getBranch,
  getPromptId,
  planExists,
  readAllPrompts,
  readPlan,
  readSummary,
  readUserInput,
  writePlan,
} from "../../lib/index.js";
import { BaseCommand, CommandResult } from "../base.js";

/**
 * Create or update plan.md with front matter.
 */
export class WritePlanCommand extends BaseCommand {
  readonly name = "write-plan";
  readonly description = "Create plan.md with YAML front matter";

  defineArguments(cmd: Command): void {
    cmd.option("--title <title>", "Plan title");
    cmd.option("--objective <objective>", "High-level objective");
    cmd.option("--context <context>", "Design doc style context");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const title = args.title as string | undefined;
    const objective = args.objective as string | undefined;
    const context = args.context as string | undefined;

    // Build content section
    const contentParts: string[] = [];
    if (title) {
      contentParts.push(`# ${title}\n`);
    }
    if (objective) {
      contentParts.push(`## Objective\n\n${objective}\n`);
    }
    if (context) {
      contentParts.push(`## Context\n\n${context}\n`);
    }

    const content = contentParts.join("\n");

    writePlan({ stage: "draft" }, content);

    return this.success({
      created: true,
      branch,
    });
  }
}

/**
 * Get full plan context including all files.
 */
export class GetFullPlanCommand extends BaseCommand {
  readonly name = "get-full-plan";
  readonly description = "Aggregate all plan files";

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

    const plan = readPlan();
    const userInput = readUserInput();
    const summary = readSummary();
    const prompts = readAllPrompts();

    return this.success({
      branch,
      plan: plan
        ? {
            front_matter: plan.frontMatter,
            content: plan.content,
          }
        : null,
      user_input: userInput,
      summary,
      prompts: prompts.map((p) => ({
        id: getPromptId(p.number, p.variant),
        front_matter: p.frontMatter,
        content: p.content,
      })),
    });
  }
}

/**
 * Append content to user_input.md.
 */
export class AppendUserInputCommand extends BaseCommand {
  readonly name = "append-user-input";
  readonly description = "Append content to user_input.md";

  defineArguments(cmd: Command): void {
    cmd.argument("<content>", "User input content to append");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const content = args.content as string;
    if (!content || !content.trim()) {
      return this.error("empty_content", "Content cannot be empty");
    }

    appendUserInputLib(content);

    return this.success({
      appended: true,
    });
  }
}
