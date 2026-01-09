/**
 * Gemini API commands.
 * Phase 8: Consolidated Gemini integration with audit, review, and retry behavior.
 */

import { GoogleGenAI } from "@google/genai";
import { Command } from "commander";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, extname } from "path";
import { spawnSync } from "child_process";
import { getBaseBranch, getBranch, getDiff, getPlanDir, isDirectModeBranch } from "../lib/git.js";
import {
  readPlan,
  readAllPrompts,
  readUserInput,
  readDesignManifest,
  appendUserInput,
  writeAuditQuestionsFeedback,
  readAuditQuestionsFeedback,
  writeReviewQuestionsFeedback,
  readReviewQuestionsFeedback,
  appendPlanAudit,
  appendPlanReview,
  appendPromptReview,
  deleteFeedbackFile,
  readPrompt,
  updatePromptStatus,
  planExists,
  getPlanPaths,
  getPromptId,
  parsePromptId,
} from "../lib/index.js";
import { watchForDone } from "../lib/watcher.js";
import { withRetry, GEMINI_FALLBACKS } from "../lib/retry.js";
import { recordGeminiCall } from "../lib/observability.js";
import { BaseCommand, type CommandResult } from "./base.js";

// Default model for most operations
const DEFAULT_MODEL = "gemini-2.0-flash";
// Pro model for complex audit/review operations
const PRO_MODEL = "gemini-3-pro-preview";

// Blocking gate timeout (12 hours default)
const DEFAULT_BLOCKING_GATE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

function getBlockingGateTimeout(): number {
  const envTimeout = process.env.BLOCKING_GATE_TIMEOUT_MS;
  if (envTimeout) {
    const parsed = parseInt(envTimeout, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }
  return DEFAULT_BLOCKING_GATE_TIMEOUT_MS;
}

/**
 * Parse JSON from a response that may contain markdown code blocks.
 */
function parseJsonResponse(response: string): Record<string, unknown> {
  const jsonMatch = response.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      return JSON.parse(jsonMatch[0]);
    } catch {
      return { raw_response: response };
    }
  }
  return { raw_response: response };
}

/**
 * Read an image file and return base64 data with mime type.
 */
function readImageAsBase64(filePath: string): { data: string; mimeType: string } | null {
  if (!existsSync(filePath)) return null;

  const ext = extname(filePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
  };

  const mimeType = mimeTypes[ext];
  if (!mimeType) return null;

  try {
    const data = readFileSync(filePath).toString("base64");
    return { data, mimeType };
  } catch {
    return null;
  }
}

/**
 * Get commit summaries for a branch since divergence from base.
 */
function getCommitSummaries(baseRef: string): string {
  try {
    const result = spawnSync(
      "git",
      ["log", "--oneline", `${baseRef}..HEAD`],
      { encoding: "utf-8" }
    );
    return result.status === 0 ? result.stdout.trim() : "(No commits)";
  } catch {
    return "(Unable to get commits)";
  }
}

// ============================================================================
// Ask Command
// ============================================================================

class GeminiAskCommand extends BaseCommand {
  readonly name = "ask";
  readonly description = "Raw Gemini inference with retry";

  defineArguments(cmd: Command): void {
    cmd
      .argument("<query>", "Query for Gemini")
      .option("--files <files...>", "Files to include as context")
      .option("--context <context>", "Additional context")
      .option("--model <model>", "Model to use", DEFAULT_MODEL);
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const apiKey = process.env.VERTEX_API_KEY;
    if (!apiKey) {
      return this.error("auth_error", "VERTEX_API_KEY not set");
    }

    const query = args.query as string;
    const model = (args.model as string) ?? DEFAULT_MODEL;
    const files = args.files as string[] | undefined;
    const context = args.context as string | undefined;

    const parts: string[] = [];
    if (context) {
      parts.push(context);
    }
    if (files) {
      const fileContents = this.readFiles(files);
      if (Object.keys(fileContents).length > 0) {
        const fileContext = Object.entries(fileContents)
          .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
          .join("\n\n");
        parts.push(fileContext);
      }
    }
    parts.push(query);
    const prompt = parts.join("\n\n");

    const start = performance.now();
    const result = await withRetry(
      async () => {
        const client = new GoogleGenAI({ vertexai: true, apiKey });
        const genResult = await client.models.generateContent({
          model,
          contents: prompt,
        });
        return genResult.text ?? "";
      },
      "gemini.ask",
      {},
      GEMINI_FALLBACKS.ask
    );

    const durationMs = Math.round(performance.now() - start);
    recordGeminiCall({ endpoint: "ask", duration_ms: durationMs, success: result.success, retries: result.retries });

    if (!result.success) {
      return {
        status: "error",
        error: {
          type: result.error,
          message: "Gemini API unavailable after retries",
          suggestion: result.fallback_suggestion,
        },
        metadata: { retries: result.retries, duration_ms: durationMs },
      };
    }

    return this.success(
      { content: result.data },
      { model, command: "gemini ask", duration_ms: durationMs, retries: result.retries }
    );
  }
}

// ============================================================================
// Validate Command
// ============================================================================

class GeminiValidateCommand extends BaseCommand {
  readonly name = "validate";
  readonly description = "Validate plan against requirements (anti-overengineering)";

  private readonly SYSTEM_PROMPT = `You are a plan validator ensuring implementations are NOT over-engineered.

Given user requirements and a proposed plan, evaluate:
- Does plan exceed what user actually asked for?
- Are there unnecessary abstractions/features?
- Is complexity justified by requirements?
- Are there gaps, risks, or architectural concerns?

Be thorough and direct. Only ask questions for user discretion you can't answer yourself.

IMPORTANT: This is SYSTEM VALIDATION only. User approval is a separate step after validation passes.

Validation result: "valid" or "invalid" (binary).
- "valid": Plan is acceptable and ready for user approval.
- "invalid": Plan has issues (over-engineered, unclear requirements, missing details, etc.)

The verdict_context MUST explain the reasoning - whether over-engineered, what's missing, lack of user clarification, or why it passes.

CRITICAL: If user_questions is non-empty, validation_result MUST be "invalid". A "valid" result with pending questions is not allowed.

Output JSON:
{
  "validation_result": "valid" | "invalid",
  "verdict_context": "Specific reasoning - what's wrong, over-engineering issues, missing clarification, or why it passes",
  "recommended_edits": ["Edits to fix issues (required if invalid), or minor improvements (optional if valid)"],
  "user_questions": ["Questions needing user input - MUST be empty if validation_result is valid"]
}`;

  defineArguments(cmd: Command): void {
    cmd
      .option("--queries <path>", "Queries file path (optional)")
      .option("--context <context>", "Additional context");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const apiKey = process.env.VERTEX_API_KEY;
    if (!apiKey) {
      return this.error("auth_error", "VERTEX_API_KEY not set");
    }

    if (isDirectModeBranch(getBranch())) {
      return this.error("direct_mode", "No plan in direct mode");
    }

    const planPath = getPlanDir();
    const planFile = `${planPath}/plan.md`;
    const queriesPath = (args.queries as string) ?? `${planPath}/queries.jsonl`;
    const context = args.context as string | undefined;

    const planContent = this.readFile(planFile);
    if (!planContent) {
      return this.error("file_not_found", `Plan file not found: ${planFile}`);
    }

    let queriesContent = "";
    const queriesFile = this.readFile(queriesPath);
    if (queriesFile) {
      const queries = queriesFile
        .split("\n")
        .filter((line) => line.trim())
        .map((line) => {
          try {
            return JSON.parse(line).prompt ?? "";
          } catch {
            return "";
          }
        })
        .filter(Boolean);
      queriesContent = queries.map((q) => `- ${q}`).join("\n");
    }

    const additional = context ? `\n\n## Additional Context\n${context}` : "";
    const fullPrompt = `${this.SYSTEM_PROMPT}

## User Requirements/Queries
${queriesContent || "(No queries captured)"}

## Plan
${planContent}
${additional}

Respond with JSON only.`;

    const start = performance.now();
    const result = await withRetry(
      async () => {
        const client = new GoogleGenAI({ vertexai: true, apiKey });
        const genResult = await client.models.generateContent({
          model: DEFAULT_MODEL,
          contents: fullPrompt,
        });
        return genResult.text ?? "";
      },
      "gemini.validate",
      {},
      "Skip validation and proceed with user review only"
    );

    const durationMs = Math.round(performance.now() - start);

    if (!result.success) {
      return {
        status: "error",
        error: {
          type: result.error,
          message: "Gemini API unavailable after retries",
          suggestion: result.fallback_suggestion,
        },
        metadata: { retries: result.retries, duration_ms: durationMs },
      };
    }

    const parsed = parseJsonResponse(result.data);
    return this.success(parsed, {
      command: "gemini validate",
      duration_ms: durationMs,
      retries: result.retries,
    });
  }
}

// ============================================================================
// Architect Command
// ============================================================================

class GeminiArchitectCommand extends BaseCommand {
  readonly name = "architect";
  readonly description = "Solutions architecture for complex features";

  private readonly SYSTEM_PROMPT = `You are a solutions architect for complex software systems.

Given a feature request and optional codebase context:
1. Identify architectural decisions needed
2. Propose approaches with trade-offs
3. Recommend implementation strategy
4. Flag risks and unknowns

Output JSON:
{
  "complexity_assessment": "simple" | "moderate" | "complex" | "system_integration",
  "architectural_decisions": [{
    "decision": "string",
    "options": [{"option": "string", "pros": ["string"], "cons": ["string"]}],
    "recommendation": "string",
    "rationale": "string"
  }],
  "implementation_strategy": {
    "approach": "string",
    "phases": [{"phase": "string", "deliverables": ["string"]}],
    "dependencies": ["string"]
  },
  "risks": [{"risk": "string", "mitigation": "string", "severity": "low"|"medium"|"high"}],
  "questions_for_user": ["string"]
}`;

  defineArguments(cmd: Command): void {
    cmd
      .argument("<query>", "Feature/system description")
      .option("--files <files...>", "Relevant code files")
      .option("--context <context>", "Additional context or constraints");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const apiKey = process.env.VERTEX_API_KEY;
    if (!apiKey) {
      return this.error("auth_error", "VERTEX_API_KEY not set");
    }

    const query = args.query as string;
    const files = args.files as string[] | undefined;
    const context = args.context as string | undefined;

    let fileContext = "";
    if (files) {
      const fileContents = this.readFiles(files);
      if (Object.keys(fileContents).length > 0) {
        fileContext =
          "\n\n## Existing Code\n" +
          Object.entries(fileContents)
            .map(([path, content]) => `### ${path}\n\`\`\`\n${content}\n\`\`\``)
            .join("\n\n");
      }
    }

    const additional = context ? `\n\n## Additional Context\n${context}` : "";

    const fullPrompt = `${this.SYSTEM_PROMPT}

## Feature Request
${query}
${fileContext}
${additional}

Respond with JSON only.`;

    const start = performance.now();
    const result = await withRetry(
      async () => {
        const client = new GoogleGenAI({ vertexai: true, apiKey });
        const genResult = await client.models.generateContent({
          model: DEFAULT_MODEL,
          contents: fullPrompt,
        });
        return genResult.text ?? "";
      },
      "gemini.architect",
      {},
      "Proceed without architect analysis"
    );

    const durationMs = Math.round(performance.now() - start);

    if (!result.success) {
      return {
        status: "error",
        error: {
          type: result.error,
          message: "Gemini API unavailable after retries",
          suggestion: result.fallback_suggestion,
        },
        metadata: { retries: result.retries, duration_ms: durationMs },
      };
    }

    const parsed = parseJsonResponse(result.data);
    return this.success(parsed, {
      command: "gemini architect",
      duration_ms: durationMs,
      retries: result.retries,
    });
  }
}

// ============================================================================
// Audit Command (Phase 8)
// ============================================================================

class GeminiAuditCommand extends BaseCommand {
  readonly name = "audit";
  readonly description = "Audit plan for completeness and coherence";

  private readonly SYSTEM_PROMPT = `You are reviewing a development plan for completeness and coherence.

Review the plan for:
- Completeness: Are all requirements covered?
- Dependencies: Are prompt dependencies correctly ordered?
- Success criteria: Is each prompt's success criteria clear and testable?
- Scope creep: Does the plan stay focused on stated requirements?
- Gaps: Any missing functionality or edge cases?

If you have clarifying questions that would help improve the plan, return them.
Otherwise, return your verdict.

Output JSON:
{
  "verdict": "passed" | "failed",
  "thoughts": "Your analysis and reasoning",
  "clarifying_questions": ["Questions if needed - empty array if none"],
  "suggested_edits": [{"prompt_id": "1" or "2_A", "edit": "Suggested change"}]
}`;

  defineArguments(cmd: Command): void {
    // No arguments - reads from plan directory
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const apiKey = process.env.VERTEX_API_KEY;
    if (!apiKey) {
      return this.error("auth_error", "VERTEX_API_KEY not set");
    }

    if (isDirectModeBranch(getBranch())) {
      return this.error("direct_mode", "No plan in direct mode");
    }

    if (!planExists()) {
      return this.error("no_plan", "No plan directory exists for this branch");
    }

    // Gather all plan context
    const plan = readPlan();
    if (!plan) {
      return this.error("file_not_found", "Plan file not found");
    }

    const userInput = readUserInput() ?? "(No user input recorded)";
    const allPrompts = readAllPrompts();
    const designManifest = readDesignManifest();
    const paths = getPlanPaths();

    // Build prompts section
    const promptsSection = allPrompts
      .map((p, i) => {
        const id = getPromptId(p.number, p.variant);
        return `### Prompt ${id}
**Description:** ${p.frontMatter.description}
**Success Criteria:** ${p.frontMatter.success_criteria}
**Depends On:** ${p.frontMatter.depends_on.join(", ") || "None"}
**Kind:** ${p.frontMatter.kind}

${p.content}`;
      })
      .join("\n\n");

    // Build design assets section with images
    let designSection = "";
    const contentParts: Array<string | { inlineData: { mimeType: string; data: string } }> = [];

    if (designManifest && designManifest.designs.length > 0) {
      designSection = "## Design Assets\n\n";
      for (const design of designManifest.designs) {
        designSection += `- **${design.screenshot_file_name}**: ${design.description}\n`;
        // Try to read the image
        const imagePath = join(paths.design, design.screenshot_file_name);
        const imageData = readImageAsBase64(imagePath);
        if (imageData) {
          contentParts.push({ inlineData: imageData });
        }
      }
    }

    const fullPrompt = `${this.SYSTEM_PROMPT}

## User Intent
${userInput}

## Plan Overview
${plan.content}

## Prompts
${promptsSection}

${designSection}

Review the plan and respond with JSON only.`;

    // Add text prompt to content parts
    contentParts.unshift(fullPrompt);

    const start = performance.now();
    const result = await withRetry(
      async () => {
        const client = new GoogleGenAI({ vertexai: true, apiKey });
        const genResult = await client.models.generateContent({
          model: PRO_MODEL,
          contents: contentParts,
        });
        return genResult.text ?? "";
      },
      "gemini.audit",
      {},
      GEMINI_FALLBACKS.audit
    );

    const durationMs = Math.round(performance.now() - start);
    recordGeminiCall({ endpoint: "audit", duration_ms: durationMs, success: result.success, retries: result.retries });

    if (!result.success) {
      return {
        status: "error",
        error: {
          type: result.error,
          message: "Gemini API unavailable after retries",
          suggestion: result.fallback_suggestion,
        },
        metadata: { retries: result.retries, duration_ms: durationMs },
      };
    }

    const parsed = parseJsonResponse(result.data);
    const questions = (parsed.clarifying_questions as string[]) ?? [];

    // If there are clarifying questions, block for user answers
    if (questions.length > 0) {
      const feedbackPath = writeAuditQuestionsFeedback(questions);

      // Block until done: true
      await watchForDone(feedbackPath, getBlockingGateTimeout());
      const feedback = readAuditQuestionsFeedback();

      if (!feedback.success) {
        return this.error("invalid_feedback", feedback.error);
      }

      // Append thoughts and Q&A to user_input.md
      const qaContent = feedback.data.questions
        .map((q) => `**Q:** ${q.question}\n**A:** ${q.answer}`)
        .join("\n\n");
      const userThoughts = feedback.data.thoughts ? `**User Thoughts:** ${feedback.data.thoughts}\n\n` : "";
      appendUserInput(`## Audit Clarifications\n\n${userThoughts}${qaContent}`);

      // Delete feedback file
      deleteFeedbackFile("audit_questions");

      // Record audit entry
      appendPlanAudit({
        review_context: parsed.thoughts as string ?? "",
        decision: "needs_clarification",
        total_questions: questions.length,
        were_changes_suggested: ((parsed.suggested_edits as unknown[]) ?? []).length > 0,
      });

      return this.success({
        verdict: "needs_clarification",
        thoughts: parsed.thoughts,
        answered_questions: feedback.data.questions,
        suggested_edits: parsed.suggested_edits,
      }, {
        command: "gemini audit",
        duration_ms: durationMs,
        retries: result.retries,
      });
    }

    // No questions - record audit and return
    const verdict = parsed.verdict as string ?? "passed";
    appendPlanAudit({
      review_context: parsed.thoughts as string ?? "",
      decision: verdict === "passed" ? "approved" : "rejected",
      total_questions: 0,
      were_changes_suggested: ((parsed.suggested_edits as unknown[]) ?? []).length > 0,
    });

    return this.success({
      verdict,
      thoughts: parsed.thoughts,
      suggested_edits: parsed.suggested_edits,
    }, {
      command: "gemini audit",
      duration_ms: durationMs,
      retries: result.retries,
    });
  }
}

// ============================================================================
// Review Command (Phase 8)
// ============================================================================

class GeminiReviewCommand extends BaseCommand {
  readonly name = "review";
  readonly description = "Review implementation against requirements";

  private readonly PROMPT_REVIEW_SYSTEM = `You are reviewing implementation against requirements.

Given the original requirements and implementation diff, evaluate:
- Requirement fulfillment: Does the implementation meet success criteria?
- Code quality: Are there issues that matter?
- Edge cases: Any missed scenarios?

Output JSON:
{
  "verdict": "passed" | "failed",
  "thoughts": "Your analysis",
  "clarifying_questions": ["Questions if needed"],
  "suggested_changes": "Specific changes if verdict is failed"
}`;

  private readonly FULL_REVIEW_SYSTEM = `You are reviewing a complete feature implementation.

Given the full plan context and implementation diff, evaluate:
- Overall completeness: Are all prompts implemented correctly?
- Integration: Do the pieces work together?
- Quality: Code standards and best practices?

Output JSON:
{
  "verdict": "passed" | "failed",
  "thoughts": "Your analysis",
  "clarifying_questions": ["Questions if needed"],
  "suggested_changes": "Specific changes if verdict is failed"
}`;

  defineArguments(cmd: Command): void {
    cmd
      .argument("[prompt_num]", "Prompt number to review")
      .argument("[variant]", "Optional variant letter (A, B, etc.)")
      .option("--full", "Review entire plan implementation");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const apiKey = process.env.VERTEX_API_KEY;
    if (!apiKey) {
      return this.error("auth_error", "VERTEX_API_KEY not set");
    }

    if (isDirectModeBranch(getBranch())) {
      return this.error("direct_mode", "No plan in direct mode");
    }

    if (!planExists()) {
      return this.error("no_plan", "No plan directory exists for this branch");
    }

    const isFull = args.full as boolean;
    const promptNum = args.prompt_num as string | undefined;
    const variant = args.variant as string | undefined;

    if (isFull) {
      return this.executeFullReview(apiKey);
    }

    if (!promptNum) {
      return this.error("missing_argument", "Either --full or prompt_num is required");
    }

    return this.executePromptReview(apiKey, parseInt(promptNum, 10), variant ?? null);
  }

  private async executePromptReview(
    apiKey: string,
    promptNum: number,
    variant: string | null
  ): Promise<CommandResult> {
    const prompt = readPrompt(promptNum, variant);
    if (!prompt) {
      const id = getPromptId(promptNum, variant);
      return this.error("file_not_found", `Prompt ${id} not found`);
    }

    const userInput = readUserInput() ?? "";
    const promptId = getPromptId(promptNum, variant);

    // Get diff for worktree branch if available, otherwise current branch
    const baseBranch = getBaseBranch();
    const diffContent = getDiff(baseBranch);
    const commits = getCommitSummaries(baseBranch);

    const fullPrompt = `${this.PROMPT_REVIEW_SYSTEM}

## Original Requirements
**Description:** ${prompt.frontMatter.description}
**Success Criteria:** ${prompt.frontMatter.success_criteria}

## User Context
${userInput}

## Implementation (git diff)
\`\`\`diff
${diffContent.substring(0, 50000)}
\`\`\`

## Commit History
${commits}

Review and respond with JSON only.`;

    const start = performance.now();
    const result = await withRetry(
      async () => {
        const client = new GoogleGenAI({ vertexai: true, apiKey });
        const genResult = await client.models.generateContent({
          model: PRO_MODEL,
          contents: fullPrompt,
        });
        return genResult.text ?? "";
      },
      "gemini.review",
      {},
      GEMINI_FALLBACKS.review
    );

    const durationMs = Math.round(performance.now() - start);
    recordGeminiCall({ endpoint: "review", duration_ms: durationMs, success: result.success, retries: result.retries });

    if (!result.success) {
      return {
        status: "error",
        error: {
          type: result.error,
          message: "Gemini API unavailable after retries",
          suggestion: result.fallback_suggestion,
        },
        metadata: { retries: result.retries, duration_ms: durationMs },
      };
    }

    const parsed = parseJsonResponse(result.data);
    const questions = (parsed.clarifying_questions as string[]) ?? [];

    // If there are clarifying questions, block for user answers
    if (questions.length > 0) {
      const feedbackPath = writeReviewQuestionsFeedback(promptId, questions);

      await watchForDone(feedbackPath, getBlockingGateTimeout());
      const feedback = readReviewQuestionsFeedback(promptId);

      if (!feedback.success) {
        return this.error("invalid_feedback", feedback.error);
      }

      // Append to user_input.md
      const qaContent = feedback.data.questions
        .map((q) => `**Q:** ${q.question}\n**A:** ${q.answer}`)
        .join("\n\n");
      const userThoughts = feedback.data.thoughts ? `**User Thoughts:** ${feedback.data.thoughts}\n\n` : "";
      appendUserInput(`## Review Clarifications (Prompt ${promptId})\n\n${userThoughts}${qaContent}`);

      deleteFeedbackFile(`${promptId}_review_questions`);

      appendPromptReview(promptNum, variant, {
        review_context: parsed.thoughts as string ?? "",
        decision: "needs_changes",
        total_questions: questions.length,
        were_changes_suggested: !!(parsed.suggested_changes as string),
      });

      return this.success({
        verdict: "needs_clarification",
        thoughts: parsed.thoughts,
        answered_questions: feedback.data.questions,
        suggested_changes: parsed.suggested_changes,
      }, {
        command: "gemini review",
        duration_ms: durationMs,
        retries: result.retries,
        prompt_id: promptId,
      });
    }

    // No questions - update status and return
    const verdict = parsed.verdict as string ?? "passed";
    if (verdict === "passed") {
      updatePromptStatus(promptNum, variant, "reviewed");
    }

    appendPromptReview(promptNum, variant, {
      review_context: parsed.thoughts as string ?? "",
      decision: verdict === "passed" ? "approved" : "needs_changes",
      total_questions: 0,
      were_changes_suggested: !!(parsed.suggested_changes as string),
    });

    return this.success({
      verdict,
      thoughts: parsed.thoughts,
      suggested_changes: parsed.suggested_changes,
    }, {
      command: "gemini review",
      duration_ms: durationMs,
      retries: result.retries,
      prompt_id: promptId,
    });
  }

  private async executeFullReview(apiKey: string): Promise<CommandResult> {
    const plan = readPlan();
    if (!plan) {
      return this.error("file_not_found", "Plan file not found");
    }

    const userInput = readUserInput() ?? "";
    const allPrompts = readAllPrompts();
    const paths = getPlanPaths();

    // Read curator.md if exists
    const curatorPath = paths.curator;
    const curatorContent = existsSync(curatorPath)
      ? readFileSync(curatorPath, "utf-8")
      : "";

    const promptsSection = allPrompts
      .map((p) => {
        const id = getPromptId(p.number, p.variant);
        return `### Prompt ${id}
**Description:** ${p.frontMatter.description}
**Success Criteria:** ${p.frontMatter.success_criteria}
**Status:** ${p.frontMatter.status}

${p.content}`;
      })
      .join("\n\n");

    const baseBranch = getBaseBranch();
    const diffContent = getDiff(baseBranch);
    const commits = getCommitSummaries(baseBranch);

    const fullPrompt = `${this.FULL_REVIEW_SYSTEM}

## Plan
${plan.content}

## Prompts
${promptsSection}

## User Input
${userInput}

${curatorContent ? `## Curator Notes\n${curatorContent}` : ""}

## Implementation (git diff against ${baseBranch})
\`\`\`diff
${diffContent.substring(0, 50000)}
\`\`\`

## Commit History
${commits}

Review and respond with JSON only.`;

    const start = performance.now();
    const result = await withRetry(
      async () => {
        const client = new GoogleGenAI({ vertexai: true, apiKey });
        const genResult = await client.models.generateContent({
          model: PRO_MODEL,
          contents: fullPrompt,
        });
        return genResult.text ?? "";
      },
      "gemini.review",
      {},
      GEMINI_FALLBACKS.review
    );

    const durationMs = Math.round(performance.now() - start);
    recordGeminiCall({ endpoint: "review", duration_ms: durationMs, success: result.success, retries: result.retries });

    if (!result.success) {
      return {
        status: "error",
        error: {
          type: result.error,
          message: "Gemini API unavailable after retries",
          suggestion: result.fallback_suggestion,
        },
        metadata: { retries: result.retries, duration_ms: durationMs },
      };
    }

    const parsed = parseJsonResponse(result.data);
    const questions = (parsed.clarifying_questions as string[]) ?? [];

    if (questions.length > 0) {
      const feedbackPath = writeReviewQuestionsFeedback("full", questions);

      await watchForDone(feedbackPath, getBlockingGateTimeout());
      const feedback = readReviewQuestionsFeedback("full");

      if (!feedback.success) {
        return this.error("invalid_feedback", feedback.error);
      }

      const qaContent = feedback.data.questions
        .map((q) => `**Q:** ${q.question}\n**A:** ${q.answer}`)
        .join("\n\n");
      const userThoughts = feedback.data.thoughts ? `**User Thoughts:** ${feedback.data.thoughts}\n\n` : "";
      appendUserInput(`## Full Review Clarifications\n\n${userThoughts}${qaContent}`);

      deleteFeedbackFile("full_review_questions");

      appendPlanReview({
        review_context: parsed.thoughts as string ?? "",
        decision: "needs_changes",
        total_questions: questions.length,
        were_changes_suggested: !!(parsed.suggested_changes as string),
      });

      return this.success({
        verdict: "needs_clarification",
        thoughts: parsed.thoughts,
        answered_questions: feedback.data.questions,
        suggested_changes: parsed.suggested_changes,
      }, {
        command: "gemini review --full",
        duration_ms: durationMs,
        retries: result.retries,
      });
    }

    const verdict = parsed.verdict as string ?? "passed";
    appendPlanReview({
      review_context: parsed.thoughts as string ?? "",
      decision: verdict === "passed" ? "approved" : "needs_changes",
      total_questions: 0,
      were_changes_suggested: !!(parsed.suggested_changes as string),
    });

    return this.success({
      verdict,
      thoughts: parsed.thoughts,
      suggested_changes: parsed.suggested_changes,
    }, {
      command: "gemini review --full",
      duration_ms: durationMs,
      retries: result.retries,
    });
  }
}

// Auto-discovered by cli.ts
export const COMMANDS = {
  ask: GeminiAskCommand,
  validate: GeminiValidateCommand,
  architect: GeminiArchitectCommand,
  audit: GeminiAuditCommand,
  review: GeminiReviewCommand,
};
