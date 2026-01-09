/**
 * Blocking gate commands: block-findings-gate, block-plan-gate, block-prompt-testing-gate, etc.
 */

import { Command } from "commander";
import type { FindingApproach, PromptFrontMatter } from "../../lib/index.js";
import {
  appendUserInput as appendUserInputLib,
  archiveFindings,
  deleteApproach,
  deleteFeedbackFile,
  deletePrompt,
  getApproachId,
  getBranch,
  getFileTokenCount,
  getLoggingGateLogsPath,
  getMaxLogTokens,
  getPromptId,
  getTestingGateLogsPath,
  listPrompts,
  planExists,
  readAllFindings,
  readAllPrompts,
  readFindings,
  readFindingsGateFeedback,
  readLoggingGateFeedback,
  readPlanGateFeedback,
  readPrompt,
  readTestingGateFeedback,
  readVariantsGateFeedback,
  resetLoggingGateDone,
  resetTestingGateDone,
  updateApproachFeedback,
  updatePromptStatus,
  updatePromptVariantSolution,
  watchForDone,
  writeFindingsGateFeedback,
  writeFindings,
  writeLoggingGateFeedback,
  writePlanGateFeedback,
  writeTestingGateFeedback,
  writeVariantsGateFeedback,
} from "../../lib/index.js";
import { BaseCommand, CommandResult } from "../base.js";

/**
 * Default timeout for blocking gates: 12 hours in milliseconds.
 * Can be overridden via BLOCKING_GATE_TIMEOUT_MS environment variable.
 */
const DEFAULT_BLOCKING_GATE_TIMEOUT_MS = 12 * 60 * 60 * 1000;

export function getBlockingGateTimeout(): number {
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
 * Block for findings gate - user reviews specialist approaches before planning.
 */
export class BlockFindingsGateCommand extends BaseCommand {
  readonly name = "block-findings-gate";
  readonly description = "Block until user reviews findings and approaches";

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

    // Gather all findings and approaches
    const allFindings = readAllFindings();
    if (allFindings.length === 0) {
      return this.success({
        skipped: true,
        reason: "No findings to review",
        thoughts: "",
        affected_approaches: [],
      });
    }

    // Build approach feedback structure with clarifying questions
    const approachFeedback: Record<string, { user_required_changes: string; rejected?: boolean; question_answers?: Array<{ question: string; answer: string }> }> = {};

    for (const findings of allFindings) {
      for (const approach of findings.approaches) {
        const approachId = getApproachId(approach.number, approach.variant);
        const key = `${findings.specialist_name}_${approachId}`;
        const entry: { user_required_changes: string; rejected?: boolean; question_answers?: Array<{ question: string; answer: string }> } = {
          user_required_changes: "",
        };

        // Only add rejected field for variant approaches
        if (approach.variant !== null) {
          entry.rejected = false;
        }

        // Only add question_answers if there are questions
        if (approach.required_clarifying_questions.length > 0) {
          entry.question_answers = approach.required_clarifying_questions.map((q) => ({
            question: q.question,
            answer: "",
          }));
        }

        approachFeedback[key] = entry;
      }
    }

    // Create feedback file
    const filePath = writeFindingsGateFeedback(approachFeedback);

    // Block until done: true (with timeout)
    const watchResult = await watchForDone(filePath, getBlockingGateTimeout());
    const feedback = readFindingsGateFeedback();

    if (!feedback.success) {
      return this.error("invalid_feedback", feedback.error);
    }

    const data = feedback.data;

    // Validate: at least one variant per approach number must NOT be rejected
    const variantGroups: Record<string, { key: string; variant: string; rejected: boolean }[]> = {};
    for (const [key, value] of Object.entries(data.approach_feedback || {})) {
      const match = key.match(/^(.+)_(\d+)(?:_([A-Z]))?$/);
      if (!match) continue;
      const specialist = match[1];
      const approachNum = match[2];
      const variant = match[3];
      if (variant) {
        const groupKey = `${specialist}_${approachNum}`;
        if (!variantGroups[groupKey]) variantGroups[groupKey] = [];
        variantGroups[groupKey].push({ key, variant, rejected: !!value.rejected });
      }
    }
    for (const [groupKey, variants] of Object.entries(variantGroups)) {
      const allRejected = variants.every((v) => v.rejected);
      if (allRejected) {
        const variantList = variants.map((v) => v.variant).join(", ");
        return this.error(
          "all_variants_rejected",
          `All variants (${variantList}) for ${groupKey} are rejected. At least one variant must be kept.`,
          `Set rejected: false for at least one variant of ${groupKey}`
        );
      }
    }

    // Append thoughts to user_input.md if non-empty
    if (data.thoughts && data.thoughts.trim()) {
      appendUserInputLib(`[Findings Gate]\n${data.thoughts}`);
    }

    // Process approach feedback
    const affectedApproaches: Array<{ specialist_name: string; approach_id: string }> = [];
    const rejectedApproaches: Array<{ specialist_name: string; approach_id: string }> = [];

    for (const [key, value] of Object.entries(data.approach_feedback || {})) {
      const match = key.match(/^(.+)_(\d+)(?:_([A-Z]))?$/);
      if (!match) continue;

      const specialist = match[1];
      const approachNum = parseInt(match[2], 10);
      const variant = match[3] || null;
      const approachId = getApproachId(approachNum, variant);

      // Handle rejection
      if (value.rejected) {
        deleteApproach(specialist, approachNum, variant);
        rejectedApproaches.push({ specialist_name: specialist, approach_id: approachId });
        continue;
      }

      // Check if there's any meaningful feedback
      const hasChanges = value.user_required_changes && value.user_required_changes.trim();
      const hasAnswers = value.question_answers?.some((qa) => qa.answer && qa.answer.trim());

      if (hasChanges || hasAnswers) {
        const answeredQs = value.question_answers?.filter((qa) => qa.answer && qa.answer.trim()) ?? [];
        updateApproachFeedback(specialist, approachNum, variant, {
          userRequestedChanges: hasChanges ? value.user_required_changes : undefined,
          questionAnswers: hasAnswers ? answeredQs : undefined,
        });

        // Append to user_input.md for audit trail
        if (hasChanges) {
          appendUserInputLib(`[User Required Changes for ${specialist} approach ${approachId}]\n${value.user_required_changes}`);
        }
        if (hasAnswers && answeredQs.length > 0) {
          const formattedQs = answeredQs
            .map((qa) => `Q: ${qa.question}\nA: ${qa.answer}`)
            .join("\n\n");
          appendUserInputLib(`[User Addressed Questions for ${specialist} approach ${approachId}]\n${formattedQs}`);
        }

        affectedApproaches.push({ specialist_name: specialist, approach_id: approachId });
      }
    }

    // Post-process: If only one variant remains, strip the variant letter
    const specialistsToCheck = new Set<string>();
    for (const { specialist_name } of [...affectedApproaches, ...rejectedApproaches]) {
      specialistsToCheck.add(specialist_name);
    }
    for (const specialist of specialistsToCheck) {
      const findings = readFindings(specialist);
      if (!findings) continue;

      const byNumber: Record<number, FindingApproach[]> = {};
      for (const approach of findings.approaches) {
        if (!byNumber[approach.number]) byNumber[approach.number] = [];
        byNumber[approach.number].push(approach);
      }

      let modified = false;
      for (const [_numStr, approaches] of Object.entries(byNumber)) {
        if (approaches.length === 1 && approaches[0].variant !== null) {
          const oldId = getApproachId(approaches[0].number, approaches[0].variant);
          approaches[0].variant = null;
          modified = true;
          const affectedIdx = affectedApproaches.findIndex(
            (a) => a.specialist_name === specialist && a.approach_id === oldId
          );
          if (affectedIdx >= 0) {
            affectedApproaches[affectedIdx].approach_id = getApproachId(approaches[0].number, null);
          }
        }
      }

      if (modified) {
        writeFindings(specialist, findings);
      }
    }

    // Delete the feedback file
    deleteFeedbackFile("findings_gate");

    return this.success({
      thoughts: data.thoughts || "",
      affected_approaches: affectedApproaches,
      rejected_approaches: rejectedApproaches,
      duration_ms: watchResult.duration_ms,
    });
  }
}

/**
 * Block for plan gate - user reviews plan and prompts before implementation.
 */
export class BlockPlanGateCommand extends BaseCommand {
  readonly name = "block-plan-gate";
  readonly description = "Block until user reviews plan and prompts";

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

    // Get all prompt IDs
    const prompts = readAllPrompts();
    if (prompts.length === 0) {
      return this.error(
        "no_prompts",
        "No prompts exist to review. Create prompts with write-prompt first.",
        "Run: envoy plan write-prompt <number> ..."
      );
    }
    const promptIds = prompts.map((p) => getPromptId(p.number, p.variant));

    // Create feedback file
    const filePath = writePlanGateFeedback(promptIds);

    // Block until done: true (with timeout)
    const watchResult = await watchForDone(filePath, getBlockingGateTimeout());
    const feedback = readPlanGateFeedback();

    if (!feedback.success) {
      return this.error("invalid_feedback", feedback.error);
    }

    const data = feedback.data;

    // Append thoughts to user_input.md if non-empty
    if (data.thoughts && data.thoughts.trim()) {
      appendUserInputLib(`[Plan Gate]\n${data.thoughts}`);
    }

    // Append user_required_plan_changes to user_input.md if non-empty
    if (data.user_required_plan_changes && data.user_required_plan_changes.trim()) {
      appendUserInputLib(`[User Required Plan Changes]\n${data.user_required_plan_changes}`);
    }

    // Collect prompt changes
    const promptChanges: Array<{ prompt_id: string; user_required_changes: string }> = [];
    for (const [id, value] of Object.entries(data.prompt_feedback || {})) {
      if (value.user_required_changes && value.user_required_changes.trim()) {
        appendUserInputLib(`[User Required Changes for Prompt ${id}]\n${value.user_required_changes}`);
        promptChanges.push({ prompt_id: id, user_required_changes: value.user_required_changes });
      }
    }

    const hasChanges = !!(
      (data.user_required_plan_changes && data.user_required_plan_changes.trim()) ||
      promptChanges.length > 0
    );

    // Only archive findings when user approves with NO changes
    let archivedFindings: string[] = [];
    if (!hasChanges) {
      const archiveResult = archiveFindings();
      if (archiveResult.error) {
        return this.error("archive_error", archiveResult.error);
      }
      archivedFindings = archiveResult.archived;
    }

    // Delete the feedback file
    deleteFeedbackFile("plan_gate");

    return this.success({
      thoughts: data.thoughts || "",
      has_user_required_changes: hasChanges,
      user_required_plan_changes: data.user_required_plan_changes || "",
      prompt_changes: promptChanges,
      archived_findings: archivedFindings,
      duration_ms: watchResult.duration_ms,
    });
  }
}

/**
 * Block for prompt testing gate - user tests implementation manually.
 */
export class BlockPromptTestingGateCommand extends BaseCommand {
  readonly name = "block-prompt-testing-gate";
  readonly description = "Block until user completes manual testing";

  defineArguments(cmd: Command): void {
    cmd.argument("<prompt_num>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const promptNum = parseInt(args.prompt_num as string, 10);
    if (isNaN(promptNum) || promptNum < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    // Verify prompt exists
    const prompt = readPrompt(promptNum, variant || null);
    if (!prompt) {
      const id = getPromptId(promptNum, variant || null);
      return this.error("not_found", `Prompt ${id} not found`);
    }

    // Verify prompt is in implemented or reviewed status
    const status = prompt.frontMatter.status;
    if (status !== "implemented" && status !== "reviewed") {
      const id = getPromptId(promptNum, variant || null);
      return this.error(
        "invalid_status",
        `Prompt ${id} is in '${status}' status. Must be 'implemented' or 'reviewed' for testing.`,
        "Complete implementation first with: envoy plan complete-prompt <number>"
      );
    }

    // Create feedback files (YAML + sibling log file)
    const { yamlPath, logsPath } = writeTestingGateFeedback(promptNum, variant || null);

    // Block until done: true (with timeout)
    const watchResult = await watchForDone(yamlPath, getBlockingGateTimeout());
    const feedback = readTestingGateFeedback(promptNum, variant || null);

    if (!feedback.success) {
      return this.error("invalid_feedback", feedback.error);
    }

    const data = feedback.data;

    // Check token count on log file
    const tokenResult = getFileTokenCount(logsPath);
    if (tokenResult.success) {
      const maxTokens = getMaxLogTokens();
      if (tokenResult.tokenCount > maxTokens) {
        resetTestingGateDone(promptNum, variant || null);
        return this.error(
          "logs_too_large",
          `Log file has ${tokenResult.tokenCount} tokens, max allowed is ${maxTokens}. Please reduce log size and set done: true again.`,
          `Current: ${tokenResult.tokenCount} tokens, Max: ${maxTokens} tokens`
        );
      }
    }

    // Append thoughts to user_input.md if non-empty
    if (data.thoughts && data.thoughts.trim()) {
      const id = getPromptId(promptNum, variant || null);
      appendUserInputLib(`[Testing Gate ${id}]\n${data.thoughts}`);
    }

    // Delete the feedback files
    const feedbackId = variant ? `${promptNum}_${variant}_testing` : `${promptNum}_testing`;
    deleteFeedbackFile(feedbackId);

    if (data.test_passed === false) {
      if (data.user_required_changes && data.user_required_changes.trim()) {
        const id = getPromptId(promptNum, variant || null);
        appendUserInputLib(`[User Required Changes for ${id}]\n${data.user_required_changes}`);
      }

      return this.success({
        thoughts: data.thoughts || "",
        passed: false,
        user_required_changes: data.user_required_changes || "",
        logs: data.logs || "",
        duration_ms: watchResult.duration_ms,
      });
    }

    // Test passed - update prompt status to tested
    updatePromptStatus(promptNum, variant || null, "tested");

    return this.success({
      thoughts: data.thoughts || "",
      passed: true,
      logs: data.logs || "",
      duration_ms: watchResult.duration_ms,
    });
  }
}

/**
 * Block for variant selection gate - user chooses between variants after all tested.
 */
export class BlockPromptVariantsGateCommand extends BaseCommand {
  readonly name = "block-prompt-variants-gate";
  readonly description = "Block until user selects variant";

  defineArguments(cmd: Command): void {
    cmd.argument("<prompt_num>", "Prompt number (integer)");
    cmd.argument("<variant>", "Variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const promptNum = parseInt(args.prompt_num as string, 10);
    if (isNaN(promptNum) || promptNum < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string;
    if (!variant || !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    // Verify this is a variant prompt
    const prompt = readPrompt(promptNum, variant);
    if (!prompt) {
      return this.error("not_found", `Prompt ${promptNum}_${variant} not found`);
    }

    if (!prompt.frontMatter.variant) {
      return this.success({
        skipped: true,
        reason: "Not a variant prompt",
        variant_solution: null,
        reason_text: "",
      });
    }

    // Find all variants for this prompt number
    const allPrompts = listPrompts();
    const variantLetters = allPrompts
      .filter((p) => p.number === promptNum && p.variant)
      .map((p) => p.variant as string)
      .sort();

    if (variantLetters.length < 2) {
      return this.success({
        skipped: true,
        reason: "Only one variant exists",
        variant_solution: null,
        reason_text: "",
      });
    }

    // Create feedback file (only creates if doesn't exist)
    const filePath = writeVariantsGateFeedback(promptNum, variantLetters);

    // Block until done: true (with timeout)
    const watchResult = await watchForDone(filePath, getBlockingGateTimeout());
    const feedback = readVariantsGateFeedback(promptNum);

    if (!feedback.success) {
      return this.error("invalid_feedback", feedback.error);
    }

    const data = feedback.data;

    // Append thoughts to user_input.md if non-empty
    if (data.thoughts && data.thoughts.trim()) {
      appendUserInputLib(`[Variants Gate ${promptNum}]\n${data.thoughts}`);
    }

    // Process variant decisions
    for (const [letter, decision] of Object.entries(data.variants)) {
      if (decision.decision) {
        let variantSolution: PromptFrontMatter["variant_solution"] = null;
        if (decision.decision === "accepted") {
          variantSolution = "accept";
        } else if (decision.decision === "rejected") {
          variantSolution = "discard";
        } else if (decision.decision === "feature-flag") {
          variantSolution = "feature-flag";
        }

        updatePromptVariantSolution(promptNum, letter, variantSolution);

        // Delete rejected prompts
        if (decision.decision === "rejected") {
          deletePrompt(promptNum, letter);
        }
      }
    }

    // Delete the feedback file
    deleteFeedbackFile(`${promptNum}_variants`);

    // Return this variant's decision
    const thisDecision = data.variants[variant];
    let variantSolution: string | null = null;
    if (thisDecision?.decision === "accepted") {
      variantSolution = "accepted";
    } else if (thisDecision?.decision === "rejected") {
      variantSolution = "rejected";
    } else if (thisDecision?.decision === "feature-flag") {
      variantSolution = "feature-flag";
    }

    return this.success({
      thoughts: data.thoughts || "",
      variant_solution: variantSolution,
      reason: thisDecision?.reason || "",
      duration_ms: watchResult.duration_ms,
    });
  }
}

/**
 * Block for debugging logging gate - user captures debug output.
 */
export class BlockDebuggingLoggingGateCommand extends BaseCommand {
  readonly name = "block-debugging-logging-gate";
  readonly description = "Block until user captures debug logs";

  defineArguments(cmd: Command): void {
    cmd.argument("<prompt_num>", "Prompt number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const promptNum = parseInt(args.prompt_num as string, 10);
    if (isNaN(promptNum) || promptNum < 1) {
      return this.error("invalid_number", "Prompt number must be a positive integer");
    }

    const variant = args.variant as string | undefined;
    if (variant && !/^[A-Z]$/.test(variant)) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    // Verify prompt exists
    const prompt = readPrompt(promptNum, variant || null);
    if (!prompt) {
      const id = getPromptId(promptNum, variant || null);
      return this.error("not_found", `Prompt ${id} not found`);
    }

    // Verify prompt is debug kind
    if (prompt.frontMatter.kind !== "debug") {
      const id = getPromptId(promptNum, variant || null);
      return this.error(
        "not_debug",
        `Prompt ${id} is '${prompt.frontMatter.kind}' kind. Logging gate only applies to 'debug' prompts.`,
        "Use block-prompt-testing-gate for feature prompts"
      );
    }

    // Create feedback files (YAML + sibling log file)
    const { yamlPath, logsPath } = writeLoggingGateFeedback(promptNum, variant || null);

    // Block until done: true (with timeout)
    const watchResult = await watchForDone(yamlPath, getBlockingGateTimeout());
    const feedback = readLoggingGateFeedback(promptNum, variant || null);

    if (!feedback.success) {
      return this.error("invalid_feedback", feedback.error);
    }

    const data = feedback.data;

    // Check token count on log file
    const tokenResult = getFileTokenCount(logsPath);
    if (tokenResult.success) {
      const maxTokens = getMaxLogTokens();
      if (tokenResult.tokenCount > maxTokens) {
        resetLoggingGateDone(promptNum, variant || null);
        return this.error(
          "logs_too_large",
          `Log file has ${tokenResult.tokenCount} tokens, max allowed is ${maxTokens}. Please reduce log size and set done: true again.`,
          `Current: ${tokenResult.tokenCount} tokens, Max: ${maxTokens} tokens`
        );
      }
    }

    // Append thoughts to user_input.md if non-empty
    if (data.thoughts && data.thoughts.trim()) {
      const id = getPromptId(promptNum, variant || null);
      appendUserInputLib(`[Logging Gate ${id}]\n${data.thoughts}`);
    }

    // Delete the feedback files
    const feedbackId = variant ? `${promptNum}_${variant}_logging` : `${promptNum}_logging`;
    deleteFeedbackFile(feedbackId);

    return this.success({
      thoughts: data.thoughts || "",
      logs: data.logs || "",
      duration_ms: watchResult.duration_ms,
    });
  }
}
