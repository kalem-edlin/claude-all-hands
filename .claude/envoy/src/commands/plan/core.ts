/**
 * Core plan commands: init, status, check
 */

import { Command } from "commander";
import {
  ensurePlanDir,
  getBaseBranch,
  getBranch,
  getPromptId,
  planExists,
  readAllPrompts,
  readPlan,
  readSummary,
  readUserInput,
} from "../../lib/index.js";
import { BaseCommand, CommandResult } from "../base.js";

/**
 * Initialize plan directory for current branch.
 */
export class InitCommand extends BaseCommand {
  readonly name = "init";
  readonly description = "Initialize plan directory for current branch";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    ensurePlanDir();

    return this.success({
      initialized: true,
      branch,
      base_branch: getBaseBranch(),
    });
  }
}

/**
 * Get plan directory status for current branch.
 */
export class StatusCommand extends BaseCommand {
  readonly name = "status";
  readonly description = "Get plan directory status for current branch";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const exists = planExists();

    return this.success({
      exists,
      branch,
      base_branch: getBaseBranch(),
    });
  }
}

/**
 * Check plan status and return context based on stage.
 */
export class CheckCommand extends BaseCommand {
  readonly name = "check";
  readonly description = "Get plan status and context based on stage";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    if (!planExists()) {
      return this.success({
        exists: false,
        stage: null,
        message: "No plan directory exists for this branch",
      });
    }

    const plan = readPlan();
    const userInput = readUserInput();
    const summary = readSummary();
    const prompts = readAllPrompts();

    // Default stage if plan doesn't exist yet
    const stage = plan?.frontMatter?.stage ?? "draft";

    // Build response based on stage
    const response: Record<string, unknown> = {
      exists: true,
      stage,
      branch,
    };

    if (stage === "draft" && userInput) {
      // Draft with user input: return user_input.md
      response.user_input = userInput;
    } else if (stage === "in_progress") {
      // In progress: return user_input, plan context, and prompt descriptions
      response.user_input = userInput;
      response.plan_context = plan?.content ?? null;
      response.prompts = prompts.map((p) => ({
        id: getPromptId(p.number, p.variant),
        description: p.frontMatter.description,
        status: p.frontMatter.status,
        kind: p.frontMatter.kind,
        depends_on: p.frontMatter.depends_on,
      }));
    } else if (stage === "completed") {
      // Completed: return summary
      response.summary = summary;
    }

    return this.success(response);
  }
}
