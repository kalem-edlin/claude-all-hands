/**
 * Findings commands: write-finding, write-approach, get-finding-approach, clear-approach, get-findings, read-design-manifest
 */

import { Command } from "commander";
import type { FindingApproach, FindingsFile } from "../../lib/index.js";
import {
  getApproachId,
  getBranch,
  readAllFindings,
  readDesignManifest,
  readFindings,
  writeFindings,
} from "../../lib/index.js";
import { BaseCommand, CommandResult } from "../base.js";

/**
 * Write a full findings file for a specialist.
 */
export class WriteFindingCommand extends BaseCommand {
  readonly name = "write-finding";
  readonly description = "Create findings YAML for a specialist";

  defineArguments(cmd: Command): void {
    cmd.argument("<specialist_name>", "Specialist name (e.g., frontend, backend_1)");
    cmd.option("--notes <notes>", "Key practices, stack, technologies, APIs, dependencies");
    cmd.option("--approaches <approaches>", "JSON array of approaches");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const specialistName = args.specialist_name as string;
    if (!specialistName || !specialistName.trim()) {
      return this.error("invalid_specialist", "Specialist name cannot be empty");
    }

    const notes = (args.notes as string) || "";

    // Parse approaches JSON if provided
    let approaches: FindingApproach[] = [];
    if (args.approaches) {
      try {
        const parsed = JSON.parse(args.approaches as string) as Array<{
          number: number;
          description?: string;
          variant?: string;
          context?: string;
          relevant_files?: string[];
          questions?: string[];
        }>;

        approaches = parsed.map((a) => ({
          number: a.number,
          variant: a.variant && /^[A-Z]$/.test(a.variant) ? a.variant : null,
          description: a.description || "",
          relevant_files: a.relevant_files || [],
          required_clarifying_questions: (a.questions || []).map((q: string) => ({ question: q })),
          user_requested_changes: "",
          approach_detail: a.context || "",
        }));
      } catch {
        return this.error("invalid_json", "Failed to parse approaches JSON");
      }
    }

    const findings: FindingsFile = {
      specialist_name: specialistName,
      notes,
      approaches,
    };

    writeFindings(specialistName, findings);

    return this.success({
      specialist: specialistName,
      created: true,
      approach_count: approaches.length,
    });
  }
}

/**
 * Write or update a single approach in a specialist's findings.
 */
export class WriteApproachCommand extends BaseCommand {
  readonly name = "write-approach";
  readonly description = "Update findings file with a new approach";

  defineArguments(cmd: Command): void {
    cmd.argument("<specialist_name>", "Specialist name (e.g., frontend, backend_1)");
    cmd.argument("<approach_num>", "Approach number (integer)");
    cmd.option("--description <description>", "3 sentence description of what approach solves");
    cmd.option("--variant <letter>", "Variant letter (A, B, C, etc.) - makes this a variant of approach_num");
    cmd.option("--context <context>", "Full approach context with pseudocode and findings");
    cmd.option("--files <files>", "Comma-separated list of relevant file paths");
    cmd.option("--questions <questions>", "Pipe-separated clarifying questions");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const specialistName = args.specialist_name as string;
    if (!specialistName || !specialistName.trim()) {
      return this.error("invalid_specialist", "Specialist name cannot be empty");
    }

    const approachNum = parseInt(args.approach_num as string, 10);
    if (isNaN(approachNum) || approachNum < 1) {
      return this.error("invalid_number", "Approach number must be a positive integer");
    }

    // Parse variant letter
    const variantArg = args.variant as string | undefined;
    const variant = variantArg && /^[A-Z]$/.test(variantArg) ? variantArg : null;
    if (variantArg && !variant) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    // Read existing findings or create new
    let findings = readFindings(specialistName);
    if (!findings) {
      findings = {
        specialist_name: specialistName,
        notes: "",
        approaches: [],
      };
    }

    // Parse files
    const files = args.files
      ? (args.files as string).split(",").map((f) => f.trim()).filter(Boolean)
      : [];

    // Parse questions (pipe-separated)
    const questions = args.questions
      ? (args.questions as string).split("|").map((q) => ({ question: q.trim() })).filter((q) => q.question)
      : [];

    // Validate: standalone and variant approaches cannot coexist for same number
    const hasStandalone = findings.approaches.some(
      (a) => a.number === approachNum && a.variant === null
    );
    const existingVariants = findings.approaches.filter(
      (a) => a.number === approachNum && a.variant !== null
    );

    if (variant) {
      // Adding variant - check if standalone exists
      if (hasStandalone) {
        return this.error(
          "standalone_exists",
          `Approach ${approachNum} exists as standalone. Cannot add variant ${variant}.`,
          `Clear approach ${approachNum} first with clear-approach, or update it without --variant`
        );
      }
    } else {
      // Adding standalone - check if variants exist
      if (existingVariants.length > 0) {
        const variantList = existingVariants.map((v) => `${approachNum}_${v.variant}`).join(", ");
        return this.error(
          "variants_exist",
          `Variants exist for approach ${approachNum}: ${variantList}. Cannot add standalone.`,
          `Clear existing variants first with clear-approach, or add this as a variant with --variant`
        );
      }
    }

    // Build the approach
    const approach: FindingApproach = {
      number: approachNum,
      variant,
      description: (args.description as string) || "",
      relevant_files: files,
      required_clarifying_questions: questions,
      user_requested_changes: "",
      approach_detail: (args.context as string) || "",
    };

    // Find and replace existing approach by number AND variant, or add new
    const existingIdx = findings.approaches.findIndex(
      (a) => a.number === approachNum && a.variant === variant
    );
    if (existingIdx >= 0) {
      findings.approaches[existingIdx] = approach;
    } else {
      findings.approaches.push(approach);
      // Sort by number, then by variant (null first, then alphabetically)
      findings.approaches.sort((a, b) => {
        if (a.number !== b.number) return a.number - b.number;
        if (!a.variant && b.variant) return -1;
        if (a.variant && !b.variant) return 1;
        return (a.variant || "").localeCompare(b.variant || "");
      });
    }

    writeFindings(specialistName, findings);

    const approachId = getApproachId(approachNum, variant);
    return this.success({
      specialist: specialistName,
      approach_id: approachId,
      approach_number: approachNum,
      variant: variant,
      updated: existingIdx >= 0,
      created: existingIdx < 0,
    });
  }
}

/**
 * Get a specific approach from a specialist's findings.
 */
export class GetFindingApproachCommand extends BaseCommand {
  readonly name = "get-finding-approach";
  readonly description = "Get a specific approach from findings";

  defineArguments(cmd: Command): void {
    cmd.argument("<specialist_name>", "Specialist name");
    cmd.argument("<approach_num>", "Approach number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const specialistName = args.specialist_name as string;
    const approachNum = parseInt(args.approach_num as string, 10);
    const variantArg = args.variant as string | undefined;
    const variant = variantArg && /^[A-Z]$/.test(variantArg) ? variantArg : null;

    if (isNaN(approachNum) || approachNum < 1) {
      return this.error("invalid_number", "Approach number must be a positive integer");
    }

    if (variantArg && !variant) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const findings = readFindings(specialistName);
    if (!findings) {
      return this.error("not_found", `Findings not found for specialist: ${specialistName}`);
    }

    // Find approach by number AND variant
    const approach = findings.approaches.find(
      (a) => a.number === approachNum && a.variant === variant
    );
    const approachId = getApproachId(approachNum, variant);
    if (!approach) {
      return this.error("not_found", `Approach ${approachId} not found for specialist: ${specialistName}`);
    }

    // Filter to only answered questions (skip unanswered)
    const answeredQuestions = (approach.user_addressed_questions || [])
      .filter((qa) => qa.answer && qa.answer.trim());

    // Return only user-facing fields
    return this.success({
      specialist: specialistName,
      approach_id: approachId,
      approach: {
        number: approach.number,
        variant: approach.variant,
        description: approach.description,
        relevant_files: approach.relevant_files,
        user_addressed_questions: answeredQuestions,
        user_requested_changes: approach.user_requested_changes,
        approach_detail: approach.approach_detail,
      },
    });
  }
}

/**
 * Clear/delete an approach from a specialist's findings.
 */
export class ClearApproachCommand extends BaseCommand {
  readonly name = "clear-approach";
  readonly description = "Remove an approach from findings";

  defineArguments(cmd: Command): void {
    cmd.argument("<specialist_name>", "Specialist name");
    cmd.argument("<approach_num>", "Approach number (integer)");
    cmd.argument("[variant]", "Optional variant letter (A, B, etc.)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const specialistName = args.specialist_name as string;
    const approachNum = parseInt(args.approach_num as string, 10);
    const variantArg = args.variant as string | undefined;
    const variant = variantArg && /^[A-Z]$/.test(variantArg) ? variantArg : null;

    if (isNaN(approachNum) || approachNum < 1) {
      return this.error("invalid_number", "Approach number must be a positive integer");
    }

    if (variantArg && !variant) {
      return this.error("invalid_variant", "Variant must be a single uppercase letter (A-Z)");
    }

    const findings = readFindings(specialistName);
    if (!findings) {
      return this.error("not_found", `Findings not found for specialist: ${specialistName}`);
    }

    const approachId = getApproachId(approachNum, variant);
    const idx = findings.approaches.findIndex(
      (a) => a.number === approachNum && a.variant === variant
    );

    if (idx < 0) {
      return this.error("not_found", `Approach ${approachId} not found for specialist: ${specialistName}`);
    }

    findings.approaches.splice(idx, 1);
    writeFindings(specialistName, findings);

    return this.success({
      specialist: specialistName,
      cleared: approachId,
      remaining_count: findings.approaches.length,
    });
  }
}

/**
 * Get all findings across all specialists.
 */
export class GetFindingsCommand extends BaseCommand {
  readonly name = "get-findings";
  readonly description = "Get all approaches across specialists";

  defineArguments(cmd: Command): void {
    cmd.option("--full", "Include full context and notes per specialist");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const full = !!args.full;
    const allFindings = readAllFindings();

    if (full) {
      // Return full context with notes (user-facing fields only)
      const specialists = allFindings.map((f) => ({
        specialist: f.specialist_name,
        notes: f.notes,
        approaches: f.approaches.map((a) => {
          // Filter to only answered questions
          const answeredQuestions = (a.user_addressed_questions || [])
            .filter((qa) => qa.answer && qa.answer.trim());
          return {
            approach_id: getApproachId(a.number, a.variant),
            number: a.number,
            variant: a.variant,
            description: a.description,
            relevant_files: a.relevant_files,
            user_addressed_questions: answeredQuestions,
            user_requested_changes: a.user_requested_changes,
            approach_detail: a.approach_detail,
          };
        }),
      }));

      return this.success({ specialists });
    }

    // Return summary only
    const approaches: Array<{
      specialist: string;
      approach_id: string;
      number: number;
      variant: string | null;
      description: string;
      relevant_files: string[];
    }> = [];

    for (const f of allFindings) {
      for (const a of f.approaches) {
        approaches.push({
          specialist: f.specialist_name,
          approach_id: getApproachId(a.number, a.variant),
          number: a.number,
          variant: a.variant,
          description: a.description,
          relevant_files: a.relevant_files,
        });
      }
    }

    return this.success({ approaches });
  }
}

/**
 * Read the design manifest.
 */
export class ReadDesignManifestCommand extends BaseCommand {
  readonly name = "read-design-manifest";
  readonly description = "Read design manifest with file descriptions";

  defineArguments(_cmd: Command): void {
    // No arguments
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const branch = getBranch();
    if (!branch) {
      return this.error("no_branch", "Not in a git repository or no branch checked out");
    }

    const manifest = readDesignManifest();
    if (!manifest) {
      return this.success({
        exists: false,
        designs: [],
      });
    }

    return this.success({
      exists: true,
      designs: manifest.designs.map((d) => ({
        file: d.screenshot_file_name,
        description: d.description,
      })),
    });
  }
}
