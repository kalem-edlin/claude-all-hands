/**
 * Findings file operations.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, unlinkSync, cpSync } from "fs";
import { join } from "path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import { ensurePlanDir, getPlanPaths, getFindingsPath, getApproachId } from "./paths.js";
import { logInfo } from "./observability.js";

export interface FindingApproach {
  number: number;
  // Variant letter (A, B, C, etc.) - null for primary approach
  variant: string | null;
  description: string;
  relevant_files: string[];
  // Internal: questions needing user input (not returned in reads)
  required_clarifying_questions: Array<{ question: string; answer?: string }>;
  // Only populated after user answers questions in gate
  user_addressed_questions?: Array<{ question: string; answer: string }>;
  // User directive for agent to re-investigate this approach
  user_requested_changes: string;
  approach_detail: string;
}

export interface FindingsFile {
  specialist_name: string;
  notes: string;
  approaches: FindingApproach[];
}

/**
 * Create default approach structure.
 */
export function createDefaultApproach(number: number, variant: string | null = null): FindingApproach {
  return {
    number,
    variant,
    description: "",
    relevant_files: [],
    required_clarifying_questions: [],
    user_requested_changes: "",
    approach_detail: "",
  };
}

/**
 * Read a specialist's findings file.
 */
export function readFindings(specialist: string): FindingsFile | null {
  const findingsPath = getFindingsPath(specialist);
  if (!existsSync(findingsPath)) {
    return null;
  }
  try {
    const content = readFileSync(findingsPath, "utf-8");
    return parseYaml(content) as FindingsFile;
  } catch {
    return null;
  }
}

/**
 * Write a specialist's findings file.
 */
export function writeFindings(specialist: string, findings: FindingsFile): void {
  const paths = getPlanPaths();
  ensurePlanDir();

  // Ensure findings directory exists
  if (!existsSync(paths.findings)) {
    mkdirSync(paths.findings, { recursive: true });
  }

  const findingsPath = getFindingsPath(specialist);
  const yaml = stringifyYaml(findings, { lineWidth: 0 });
  writeFileSync(findingsPath, yaml, "utf-8");
}

/**
 * List all findings files.
 */
export function listFindings(): Array<{ specialist: string; path: string }> {
  const paths = getPlanPaths();
  if (!existsSync(paths.findings)) {
    return [];
  }

  const files = readdirSync(paths.findings).filter((f) => f.endsWith(".yaml"));
  return files.map((f) => ({
    specialist: f.replace(".yaml", ""),
    path: join(paths.findings, f),
  }));
}

/**
 * Read all findings files.
 */
export function readAllFindings(): FindingsFile[] {
  const findingsList = listFindings();
  const results: FindingsFile[] = [];

  for (const { specialist } of findingsList) {
    const findings = readFindings(specialist);
    if (findings) {
      results.push(findings);
    }
  }

  return results;
}

/**
 * Archive all findings files to findings/_archive/.
 */
export function archiveFindings(): { archived: string[]; error?: string } {
  const paths = getPlanPaths();
  const archiveDir = join(paths.findings, "_archive");

  // Ensure archive directory exists
  if (!existsSync(archiveDir)) {
    mkdirSync(archiveDir, { recursive: true });
  }

  const findingsList = listFindings();
  const archived: string[] = [];

  for (const { specialist, path: findingsPath } of findingsList) {
    try {
      const archivePath = join(archiveDir, `${specialist}.yaml`);
      // Copy to archive (preserves original if move fails)
      cpSync(findingsPath, archivePath);
      // Delete original
      unlinkSync(findingsPath);
      archived.push(specialist);
      logInfo("findings.archive", { specialist, from: findingsPath, to: archivePath });
    } catch (e) {
      logInfo("findings.archive_error", { specialist, error: String(e) });
      return { archived, error: `Failed to archive ${specialist}: ${e}` };
    }
  }

  return { archived };
}

/**
 * Update a finding approach with user feedback from gate.
 */
export function updateApproachFeedback(
  specialist: string,
  approachNum: number,
  variant: string | null,
  updates: {
    userRequestedChanges?: string;
    questionAnswers?: Array<{ question: string; answer: string }>;
  }
): boolean {
  const findings = readFindings(specialist);
  if (!findings) return false;

  const approach = findings.approaches.find(
    (a) => a.number === approachNum && a.variant === variant
  );
  if (!approach) return false;

  if (updates.userRequestedChanges !== undefined) {
    approach.user_requested_changes = updates.userRequestedChanges;
  }

  if (updates.questionAnswers !== undefined && updates.questionAnswers.length > 0) {
    // Populate user_addressed_questions with answered questions
    approach.user_addressed_questions = updates.questionAnswers;
  }

  writeFindings(specialist, findings);
  const approachId = getApproachId(approachNum, variant);
  logInfo("findings.update_feedback", { specialist, approachId, hasChanges: !!updates.userRequestedChanges, hasAnswers: !!updates.questionAnswers });
  return true;
}

/**
 * Update a finding approach with user requested changes.
 * @deprecated Use updateApproachFeedback instead
 */
export function setApproachRefinement(
  specialist: string,
  approachNum: number,
  variant: string | null,
  changes: string
): boolean {
  return updateApproachFeedback(specialist, approachNum, variant, { userRequestedChanges: changes });
}

/**
 * Delete a specific approach from findings.
 */
export function deleteApproach(
  specialist: string,
  approachNum: number,
  variant: string | null
): boolean {
  const findings = readFindings(specialist);
  if (!findings) return false;

  const idx = findings.approaches.findIndex(
    (a) => a.number === approachNum && a.variant === variant
  );
  if (idx < 0) return false;

  findings.approaches.splice(idx, 1);
  writeFindings(specialist, findings);
  const approachId = getApproachId(approachNum, variant);
  logInfo("findings.delete_approach", { specialist, approachId });
  return true;
}
