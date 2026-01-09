/**
 * Plan file I/O operations.
 */

import { existsSync, readFileSync, writeFileSync, appendFileSync } from "fs";
import { getBranch } from "./git.js";
import { ensurePlanDir, getPlanPaths } from "./paths.js";
import { readMarkdownFile, writeMarkdownWithFrontMatter } from "./markdown.js";

export interface PlanFrontMatter {
  stage: "draft" | "in_progress" | "completed";
  branch_name: string;
  audits: Array<{
    review_context: string;
    decision: "approved" | "needs_clarification" | "rejected";
    total_questions: number;
    were_changes_suggested: boolean;
  }>;
  reviews: Array<{
    review_context: string;
    decision: "approved" | "needs_changes" | "rejected";
    total_questions: number;
    were_changes_suggested: boolean;
  }>;
}

/**
 * Read plan.md and return parsed front matter + content.
 */
export function readPlan(): { frontMatter: PlanFrontMatter; content: string } | null {
  const paths = getPlanPaths();
  const result = readMarkdownFile(paths.plan);
  if (!result) return null;
  return {
    frontMatter: result.frontMatter as unknown as PlanFrontMatter,
    content: result.content,
  };
}

/**
 * Write plan.md with front matter and content.
 */
export function writePlan(frontMatter: Partial<PlanFrontMatter>, content: string): void {
  const paths = getPlanPaths();
  ensurePlanDir();

  const defaults: PlanFrontMatter = {
    stage: "draft",
    branch_name: getBranch(),
    audits: [],
    reviews: [],
  };

  const merged = { ...defaults, ...frontMatter };
  writeMarkdownWithFrontMatter(paths.plan, merged, content);
}

/**
 * Update plan stage without modifying content.
 */
export function updatePlanStage(stage: PlanFrontMatter["stage"]): void {
  const plan = readPlan();
  if (!plan) return;

  const updatedFrontMatter = { ...plan.frontMatter, stage };
  const paths = getPlanPaths();
  writeMarkdownWithFrontMatter(paths.plan, updatedFrontMatter, plan.content);
}

/**
 * Read user_input.md content.
 */
export function readUserInput(): string | null {
  const paths = getPlanPaths();
  if (!existsSync(paths.userInput)) {
    return null;
  }
  return readFileSync(paths.userInput, "utf-8");
}

/**
 * Append content to user_input.md.
 */
export function appendUserInput(content: string): void {
  const paths = getPlanPaths();
  ensurePlanDir();

  // Initialize file if it doesn't exist
  if (!existsSync(paths.userInput)) {
    writeFileSync(paths.userInput, "# User Input Log\n\n", "utf-8");
  }

  // Append with timestamp
  const timestamp = new Date().toISOString();
  const entry = `\n---\n**${timestamp}**\n\n${content}\n`;
  appendFileSync(paths.userInput, entry, "utf-8");
}

/**
 * Read summary.md content.
 */
export function readSummary(): string | null {
  const paths = getPlanPaths();
  if (!existsSync(paths.summary)) {
    return null;
  }
  return readFileSync(paths.summary, "utf-8");
}

/**
 * Write summary.md content.
 */
export function writeSummary(content: string): void {
  const paths = getPlanPaths();
  ensurePlanDir();
  writeFileSync(paths.summary, content, "utf-8");
}
