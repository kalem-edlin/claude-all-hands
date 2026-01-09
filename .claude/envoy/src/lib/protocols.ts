/**
 * Protocol YAML parser with inheritance support.
 *
 * Protocols define sequential workflows for agents to follow.
 * Extension protocols can:
 * - Replace a step: declare same step number (e.g., `7:`)
 * - Append to a step: use `+` suffix (e.g., `6+:`)
 * - Insert new steps: use dot notation (e.g., `6.1:`, `6.2:`)
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { join } from "path";
import YAML from "yaml";
import { getProjectRoot } from "./git.js";

// ============================================================================
// Types
// ============================================================================

export interface ProtocolInput {
  name: string;
  type: "integer" | "string" | "array";
  optional: boolean;
  description: string;
}

export interface ProtocolOutput {
  value: string;
  description: string;
}

export interface Protocol {
  name: string;
  description: string;
  extends: string | null;
  inputs: ProtocolInput[] | null;
  outputs: ProtocolOutput[];
  steps: Record<string, string>;
}

export interface ResolvedStep {
  number: number;
  subNumber: number;
  content: string;
}

export interface ResolvedProtocol {
  name: string;
  description: string;
  inputs: ProtocolInput[];
  outputs: ProtocolOutput[];
  steps: ResolvedStep[];
}

// ============================================================================
// Protocol Resolution
// ============================================================================

/**
 * Get protocols directory path.
 */
export function getProtocolsDir(): string {
  return join(getProjectRoot(), ".claude", "protocols");
}

/**
 * Get protocol file path by name.
 */
export function getProtocolPath(name: string): string {
  return join(getProtocolsDir(), `${name}.yaml`);
}

/**
 * Read a protocol file.
 */
export function readProtocol(name: string): Protocol | null {
  const path = getProtocolPath(name);
  if (!existsSync(path)) {
    return null;
  }

  try {
    const content = readFileSync(path, "utf-8");
    return YAML.parse(content) as Protocol;
  } catch {
    return null;
  }
}

/**
 * Parse a step key into its components.
 *
 * Examples:
 * - "1" -> { base: 1, sub: 0, append: false }
 * - "6+" -> { base: 6, sub: 0, append: true }
 * - "6.1" -> { base: 6, sub: 1, append: false }
 * - "13.1" -> { base: 13, sub: 1, append: false }
 */
function parseStepKey(key: string): { base: number; sub: number; append: boolean } {
  // Check for append modifier
  const append = key.endsWith("+");
  const cleanKey = append ? key.slice(0, -1) : key;

  // Check for dot notation
  if (cleanKey.includes(".")) {
    const [baseStr, subStr] = cleanKey.split(".");
    return {
      base: parseInt(baseStr, 10),
      sub: parseInt(subStr, 10),
      append: false, // Dot notation doesn't support append
    };
  }

  return {
    base: parseInt(cleanKey, 10),
    sub: 0,
    append,
  };
}

/**
 * Merge child protocol steps into base protocol steps.
 *
 * Inheritance rules:
 * - Replace: Same step number replaces base step
 * - Append: `+` suffix appends content to base step
 * - Insert: Dot notation inserts new steps (e.g., 6.1 between 6 and 7)
 */
function mergeSteps(
  baseSteps: Record<string, string>,
  childSteps: Record<string, string>
): Record<string, string> {
  const merged = { ...baseSteps };

  for (const [key, content] of Object.entries(childSteps)) {
    const parsed = parseStepKey(key);

    if (parsed.sub > 0) {
      // Insert: New step with dot notation (e.g., "6.1")
      // Store with dot notation key
      merged[key] = content;
    } else if (parsed.append) {
      // Append: Add content to existing step
      const baseKey = String(parsed.base);
      if (merged[baseKey]) {
        merged[baseKey] = merged[baseKey].trimEnd() + "\n" + content;
      } else {
        // If base step doesn't exist, just set it
        merged[baseKey] = content;
      }
    } else {
      // Replace: Same step number replaces base step
      merged[key] = content;
    }
  }

  return merged;
}

/**
 * Convert steps record to sorted array of resolved steps.
 */
function sortSteps(steps: Record<string, string>): ResolvedStep[] {
  const resolved: ResolvedStep[] = [];

  for (const [key, content] of Object.entries(steps)) {
    const parsed = parseStepKey(key);
    resolved.push({
      number: parsed.base,
      subNumber: parsed.sub,
      content: content.trim(),
    });
  }

  // Sort by base number, then by sub number
  resolved.sort((a, b) => {
    if (a.number !== b.number) {
      return a.number - b.number;
    }
    return a.subNumber - b.subNumber;
  });

  return resolved;
}

/**
 * Resolve a protocol with inheritance.
 * Returns null if protocol not found.
 */
export function resolveProtocol(name: string): ResolvedProtocol | null {
  const protocol = readProtocol(name);
  if (!protocol) {
    return null;
  }

  // If no extends, return as-is
  if (!protocol.extends) {
    return {
      name: protocol.name,
      description: protocol.description,
      inputs: protocol.inputs || [],
      outputs: protocol.outputs || [],
      steps: sortSteps(protocol.steps),
    };
  }

  // Resolve base protocol recursively
  const baseProtocol = resolveProtocol(protocol.extends);
  if (!baseProtocol) {
    // Base protocol not found, return current protocol without inheritance
    return {
      name: protocol.name,
      description: protocol.description,
      inputs: protocol.inputs || [],
      outputs: protocol.outputs || [],
      steps: sortSteps(protocol.steps),
    };
  }

  // Merge steps
  // First, convert base steps back to record format
  const baseStepsRecord: Record<string, string> = {};
  for (const step of baseProtocol.steps) {
    const key = step.subNumber > 0
      ? `${step.number}.${step.subNumber}`
      : String(step.number);
    baseStepsRecord[key] = step.content;
  }

  const mergedSteps = mergeSteps(baseStepsRecord, protocol.steps);

  // Use child's inputs if specified, otherwise inherit from base
  const inputs = protocol.inputs !== null ? protocol.inputs : baseProtocol.inputs;

  // Use child's outputs if specified, otherwise inherit from base
  const outputs = protocol.outputs.length > 0 ? protocol.outputs : baseProtocol.outputs;

  return {
    name: protocol.name,
    description: protocol.description,
    inputs: inputs || [],
    outputs: outputs || [],
    steps: sortSteps(mergedSteps),
  };
}

/**
 * Format a resolved protocol for output.
 * Returns a string with:
 * - Protocol name and description
 * - Inputs/outputs schema
 * - Numbered steps
 */
export function formatProtocol(protocol: ResolvedProtocol): string {
  const lines: string[] = [];

  // Header
  lines.push(`# ${protocol.name}`);
  lines.push(`${protocol.description}`);
  lines.push("");

  // Inputs
  if (protocol.inputs.length > 0) {
    lines.push("## Inputs");
    for (const input of protocol.inputs) {
      const optional = input.optional ? "(optional)" : "(required)";
      lines.push(`- ${input.name}: ${input.type} ${optional} - ${input.description}`);
    }
    lines.push("");
  }

  // Outputs
  if (protocol.outputs.length > 0) {
    lines.push("## Outputs");
    for (const output of protocol.outputs) {
      lines.push(`- ${output.value}`);
      lines.push(`  ${output.description}`);
    }
    lines.push("");
  }

  // Steps
  lines.push("## Steps");
  lines.push("");

  let stepCounter = 1;
  for (const step of protocol.steps) {
    // Use sequential numbering for output
    lines.push(`${stepCounter}: ${step.content}`);
    lines.push("");
    stepCounter++;
  }

  return lines.join("\n");
}

/**
 * List all available protocol names.
 */
export function listProtocols(): string[] {
  const dir = getProtocolsDir();
  if (!existsSync(dir)) {
    return [];
  }

  try {
    const files = readdirSync(dir);
    return files
      .filter((f) => f.endsWith(".yaml"))
      .map((f) => f.replace(".yaml", ""));
  } catch {
    return [];
  }
}
