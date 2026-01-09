/**
 * Protocol commands: protocol, cleanup-debug-logs
 */

import { readFileSync, writeFileSync } from "fs";
import { spawnSync } from "child_process";
import { Command } from "commander";
import { resolveProtocol, formatProtocol, listProtocols, getProjectRoot } from "../../lib/index.js";
import { BaseCommand, CommandResult } from "../base.js";

/**
 * Read and output a protocol with inheritance support.
 */
export class ProtocolCommand extends BaseCommand {
  readonly name = "protocol";
  readonly description = "Output protocol steps with inheritance resolved";

  defineArguments(cmd: Command): void {
    cmd.argument("<name>", "Protocol name (implementation, debugging, discovery, bug-discovery)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const name = args.name as string;
    if (!name || !name.trim()) {
      return this.error("invalid_name", "Protocol name cannot be empty");
    }

    const protocol = resolveProtocol(name);
    if (!protocol) {
      const available = listProtocols();
      return this.error(
        "not_found",
        `Protocol '${name}' not found`,
        available.length > 0
          ? `Available protocols: ${available.join(", ")}`
          : "No protocols found in .claude/protocols/"
      );
    }

    // Output formatted protocol for agent consumption
    const formatted = formatProtocol(protocol);

    return this.success({
      name: protocol.name,
      description: protocol.description,
      inputs: protocol.inputs,
      outputs: protocol.outputs,
      step_count: protocol.steps.length,
      formatted_output: formatted,
    });
  }
}

/**
 * Clean up [DEBUG-TEMP] markers from worktree files.
 *
 * Algorithm:
 * 1. Find marker line: `// [DEBUG-TEMP]` (JS/TS) or `# [DEBUG-TEMP]` (Python/Shell)
 * 2. Delete marker line
 * 3. Delete ALL consecutive non-whitespace lines below
 * 4. Stop at first blank/whitespace-only line
 * 5. Repeat for all markers in file
 */
export class CleanupDebugLogsCommand extends BaseCommand {
  readonly name = "cleanup-debug-logs";
  readonly description = "Remove all [DEBUG-TEMP] markers and their log statements";

  // Marker patterns for different languages
  private readonly JS_MARKER = "// [DEBUG-TEMP]";
  private readonly PY_MARKER = "# [DEBUG-TEMP]";

  defineArguments(_cmd: Command): void {
    // No arguments - operates on current worktree
  }

  async execute(_args: Record<string, unknown>): Promise<CommandResult> {
    const projectRoot = getProjectRoot();
    const modifiedFiles: string[] = [];
    let totalMarkersRemoved = 0;

    // Find all files containing DEBUG-TEMP markers using grep
    let filesToProcess: string[] = [];
    try {
      const result = spawnSync(
        "grep",
        ["-rl", "\\[DEBUG-TEMP\\]", projectRoot, "--include=*.ts", "--include=*.tsx", "--include=*.js", "--include=*.jsx", "--include=*.py", "--include=*.sh"],
        { encoding: "utf-8" }
      );
      if (result.status === 0 && result.stdout) {
        filesToProcess = result.stdout.trim().split("\n").filter(Boolean);
      }
    } catch {
      // grep might fail if no matches, that's fine
    }

    if (filesToProcess.length === 0) {
      return this.success({
        success: true,
        files_modified: [],
        markers_removed: 0,
        message: "No [DEBUG-TEMP] markers found",
      });
    }

    for (const filePath of filesToProcess) {
      try {
        const content = readFileSync(filePath, "utf-8");
        const { cleaned, markersRemoved } = this.cleanFile(content);

        if (markersRemoved > 0) {
          writeFileSync(filePath, cleaned, "utf-8");
          modifiedFiles.push(filePath);
          totalMarkersRemoved += markersRemoved;
        }
      } catch {
        // Skip files we can't read/write
      }
    }

    return this.success({
      success: true,
      files_modified: modifiedFiles,
      markers_removed: totalMarkersRemoved,
    });
  }

  /**
   * Clean a file's content by removing [DEBUG-TEMP] markers and associated log lines.
   */
  private cleanFile(content: string): { cleaned: string; markersRemoved: number } {
    const lines = content.split("\n");
    const cleanedLines: string[] = [];
    let markersRemoved = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check if this is a marker line
      if (trimmed === this.JS_MARKER || trimmed === this.PY_MARKER) {
        markersRemoved++;
        i++; // Skip the marker line

        // Skip all consecutive non-blank lines below the marker
        while (i < lines.length) {
          const nextLine = lines[i];
          // Stop at first blank/whitespace-only line
          if (nextLine.trim() === "") {
            break;
          }
          i++; // Skip this log line
        }
        // Don't add anything - we've removed the marker and its logs
      } else {
        cleanedLines.push(line);
        i++;
      }
    }

    return {
      cleaned: cleanedLines.join("\n"),
      markersRemoved,
    };
  }
}
