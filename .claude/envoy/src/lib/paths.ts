/**
 * Plan directory path utilities.
 */

import { mkdirSync, existsSync } from "fs";
import { join } from "path";
import { getPlanDir } from "./git.js";
import { logInfo } from "./observability.js";

/**
 * Plan directory structure subdirectories.
 */
const PLAN_SUBDIRS = [
  "prompts",
  "findings",
  "findings/_archive",
  "design",
  "user_feedback",
];

/**
 * Ensure the plan directory exists with all required subdirectories.
 * Creates on demand if not present.
 *
 * @returns The plan directory path
 */
export function ensurePlanDir(): string {
  const planDir = getPlanDir();

  if (!existsSync(planDir)) {
    logInfo("plans.create_dir", { path: planDir });
    mkdirSync(planDir, { recursive: true });

    // Create subdirectories
    for (const subdir of PLAN_SUBDIRS) {
      const subdirPath = join(planDir, subdir);
      mkdirSync(subdirPath, { recursive: true });
    }
  }

  return planDir;
}

/**
 * Get paths for all standard plan files.
 */
export function getPlanPaths(): {
  planDir: string;
  plan: string;
  userInput: string;
  curator: string;
  summary: string;
  prompts: string;
  findings: string;
  design: string;
  userFeedback: string;
} {
  const planDir = getPlanDir();
  return {
    planDir,
    plan: join(planDir, "plan.md"),
    userInput: join(planDir, "user_input.md"),
    curator: join(planDir, "curator.md"),
    summary: join(planDir, "summary.md"),
    prompts: join(planDir, "prompts"),
    findings: join(planDir, "findings"),
    design: join(planDir, "design"),
    userFeedback: join(planDir, "user_feedback"),
  };
}

/**
 * Get the prompt file path for a given prompt number and optional variant.
 */
export function getPromptPath(number: number, variant?: string | null): string {
  const paths = getPlanPaths();
  const filename = variant ? `${number}_${variant}.md` : `${number}.md`;
  return join(paths.prompts, filename);
}

/**
 * Get the findings file path for a given specialist.
 */
export function getFindingsPath(specialist: string): string {
  const paths = getPlanPaths();
  return join(paths.findings, `${specialist}.yaml`);
}

/**
 * Get the user feedback file path (ephemeral, created by block commands).
 */
export function getUserFeedbackPath(id: string, ext: string = ".yaml"): string {
  const paths = getPlanPaths();
  return join(paths.userFeedback, `${id}${ext}`);
}

/**
 * Check if a plan directory exists for the current branch.
 */
export function planExists(): boolean {
  return existsSync(getPlanDir());
}

/**
 * Get prompt identifier string (e.g., "1", "2_A", "3_B").
 */
export function getPromptId(number: number, variant: string | null): string {
  return variant ? `${number}_${variant}` : `${number}`;
}

/**
 * Parse prompt identifier string into number and variant.
 */
export function parsePromptId(id: string): { number: number; variant: string | null } {
  const match = id.match(/^(\d+)(?:_([A-Z]))?$/);
  if (!match) {
    throw new Error(`Invalid prompt identifier: ${id}`);
  }
  return {
    number: parseInt(match[1], 10),
    variant: match[2] || null,
  };
}

/**
 * Get approach ID string: "{number}" or "{number}_{variant}"
 */
export function getApproachId(number: number, variant: string | null): string {
  return variant ? `${number}_${variant}` : `${number}`;
}
