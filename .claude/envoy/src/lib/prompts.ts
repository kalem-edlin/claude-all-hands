/**
 * Prompt file operations.
 */

import { existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { ensurePlanDir, getPlanPaths, getPromptPath } from "./paths.js";
import { readMarkdownFile, writeMarkdownWithFrontMatter } from "./markdown.js";

export interface PromptFrontMatter {
  number: number;
  variant: string | null;
  description: string;
  kind: "debug" | "feature";
  relevant_files: string[];
  success_criteria: string;
  depends_on: number[];
  requires_manual_testing: boolean;
  in_progress: boolean;
  current_iteration: number;
  reviews: Array<{
    review_context: string;
    decision: "approved" | "needs_changes" | "rejected";
    total_questions: number;
    were_changes_suggested: boolean;
  }>;
  delegated_to: "frontend" | "backend" | "fullstack" | null;
  worktree_branch_name: string | null;
  status: "unimplemented" | "implemented" | "reviewed" | "tested" | "merged";
  variant_solution: "discard" | "accept" | "feature-flag" | null;
  design_files: Array<{ path: string; description: string }>;
  walkthrough: Array<{
    iteration: number;
    type: "initial" | "review-refinement" | "testing-refinement";
    refinement_reason: string | null;
    approach: string;
    changes: Array<{ file: string; description: string }>;
    decisions: Array<{ decision: string; rationale: string }>;
  }>;
  documentation_extracted: boolean;
  planned_at: string;
  merge_commit_hash: string | null;
}

/**
 * Create default prompt front matter.
 */
export function createDefaultPromptFrontMatter(
  number: number,
  variant: string | null
): PromptFrontMatter {
  return {
    number,
    variant,
    description: "",
    kind: "feature",
    relevant_files: [],
    success_criteria: "",
    depends_on: [],
    requires_manual_testing: false,
    in_progress: false,
    current_iteration: 1,
    reviews: [],
    delegated_to: null,
    worktree_branch_name: null,
    status: "unimplemented",
    variant_solution: null,
    design_files: [],
    walkthrough: [],
    documentation_extracted: false,
    planned_at: new Date().toISOString(),
    merge_commit_hash: null,
  };
}

/**
 * Read a prompt file.
 */
export function readPrompt(
  number: number,
  variant?: string | null
): { frontMatter: PromptFrontMatter; content: string } | null {
  const promptPath = getPromptPath(number, variant);
  const result = readMarkdownFile(promptPath);
  if (!result) return null;
  return {
    frontMatter: result.frontMatter as unknown as PromptFrontMatter,
    content: result.content,
  };
}

/**
 * Write a prompt file.
 */
export function writePrompt(
  number: number,
  variant: string | null,
  frontMatter: Partial<PromptFrontMatter>,
  content: string
): void {
  const paths = getPlanPaths();
  ensurePlanDir();

  // Ensure prompts directory exists
  if (!existsSync(paths.prompts)) {
    mkdirSync(paths.prompts, { recursive: true });
  }

  const defaults = createDefaultPromptFrontMatter(number, variant);
  const merged = { ...defaults, ...frontMatter };
  const promptPath = getPromptPath(number, variant);
  writeMarkdownWithFrontMatter(promptPath, merged, content);
}

/**
 * Delete a prompt file.
 */
export function deletePrompt(number: number, variant?: string | null): boolean {
  const promptPath = getPromptPath(number, variant);
  if (existsSync(promptPath)) {
    unlinkSync(promptPath);
    return true;
  }
  return false;
}

/**
 * List all prompt files in the prompts directory.
 * Returns array of { number, variant, path }
 */
export function listPrompts(): Array<{
  number: number;
  variant: string | null;
  path: string;
}> {
  const paths = getPlanPaths();
  if (!existsSync(paths.prompts)) {
    return [];
  }

  const files = readdirSync(paths.prompts).filter((f) => f.endsWith(".md"));
  const prompts: Array<{ number: number; variant: string | null; path: string }> = [];

  for (const file of files) {
    // Match patterns: 1.md, 1_A.md, 12.md, 12_B.md
    const match = file.match(/^(\d+)(?:_([A-Z]))?\.md$/);
    if (match) {
      prompts.push({
        number: parseInt(match[1], 10),
        variant: match[2] || null,
        path: join(paths.prompts, file),
      });
    }
  }

  return prompts.sort((a, b) => {
    if (a.number !== b.number) return a.number - b.number;
    if (!a.variant && b.variant) return -1;
    if (a.variant && !b.variant) return 1;
    return (a.variant || "").localeCompare(b.variant || "");
  });
}

/**
 * Read all prompts and return their full data.
 */
export function readAllPrompts(): Array<{
  number: number;
  variant: string | null;
  frontMatter: PromptFrontMatter;
  content: string;
}> {
  const promptList = listPrompts();
  const results: Array<{
    number: number;
    variant: string | null;
    frontMatter: PromptFrontMatter;
    content: string;
  }> = [];

  for (const prompt of promptList) {
    const data = readPrompt(prompt.number, prompt.variant);
    if (data) {
      results.push({
        number: prompt.number,
        variant: prompt.variant,
        ...data,
      });
    }
  }

  return results;
}

/**
 * Update prompt status.
 */
export function updatePromptStatus(
  number: number,
  variant: string | null,
  status: PromptFrontMatter["status"]
): boolean {
  const prompt = readPrompt(number, variant);
  if (!prompt) return false;

  const updatedFrontMatter: PromptFrontMatter = {
    ...prompt.frontMatter,
    status,
  };
  writePrompt(number, variant, updatedFrontMatter, prompt.content);
  return true;
}

/**
 * Update prompt variant_solution field.
 */
export function updatePromptVariantSolution(
  number: number,
  variant: string | null,
  variantSolution: PromptFrontMatter["variant_solution"]
): boolean {
  const prompt = readPrompt(number, variant);
  if (!prompt) return false;

  const updatedFrontMatter: PromptFrontMatter = {
    ...prompt.frontMatter,
    variant_solution: variantSolution,
  };
  writePrompt(number, variant, updatedFrontMatter, prompt.content);
  return true;
}
