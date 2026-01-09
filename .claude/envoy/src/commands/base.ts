/**
 * Base command class for claude-envoy commands.
 *
 * To add a new command:
 * 1. Create a new file in commands/ (e.g., myapi.ts)
 * 2. Extend BaseCommand for each subcommand
 * 3. Export a COMMANDS object mapping subcommand names to classes
 *
 * Example:
 *   class MySearchCommand extends BaseCommand {
 *     name = "search";
 *     description = "Search something";
 *
 *     defineArguments(cmd: Command): void {
 *       cmd.argument("<query>", "Search query");
 *     }
 *
 *     async execute(args: Record<string, unknown>): Promise<CommandResult> {
 *       // Implementation
 *       return this.success({ results: [...] });
 *     }
 *   }
 *
 *   export const COMMANDS = { search: MySearchCommand };
 */

import { Command } from "commander";
import { readFileSync } from "fs";
import {
  logCommandStart,
  logCommandComplete,
  recordMetric,
} from "../lib/observability.js";

export interface CommandResult {
  status: "success" | "error";
  data?: Record<string, unknown>;
  error?: {
    type: string;
    message: string;
    command?: string;
    suggestion?: string;
  };
  metadata?: Record<string, unknown>;
}

export interface CommandClass {
  new (): BaseCommand;
}

export abstract class BaseCommand {
  abstract readonly name: string;
  abstract readonly description: string;

  /** Command group name, set by CLI router */
  public groupName: string = "";

  protected get timeoutMs(): number {
    return parseInt(process.env.ENVOY_TIMEOUT_MS ?? "120000", 10);
  }

  /** Full command name for logging (group.name) */
  protected get commandName(): string {
    return this.groupName ? `${this.groupName}.${this.name}` : this.name;
  }

  /**
   * Define command-specific arguments using commander.
   */
  abstract defineArguments(cmd: Command): void;

  /**
   * Execute the command and return result dict.
   * Subclasses implement this for their specific logic.
   */
  abstract execute(args: Record<string, unknown>): Promise<CommandResult>;

  /**
   * Instrumented execution wrapper - logs start/complete and metrics.
   */
  async executeWithLogging(args: Record<string, unknown>): Promise<CommandResult> {
    const start = performance.now();
    logCommandStart(this.commandName, args);

    try {
      const result = await this.execute(args);
      const duration = Math.round(performance.now() - start);
      // Include result.data in context on success for traceability
      logCommandComplete(this.commandName, result.status, duration, result.data);
      return result;
    } catch (e) {
      const duration = Math.round(performance.now() - start);
      logCommandComplete(this.commandName, "error", duration, {
        error: e instanceof Error ? e.message : String(e),
      });
      throw e;
    }
  }

  /**
   * Return a success response.
   * Automatically strips empty values (empty strings, empty arrays, null) to reduce noise for consuming agents.
   */
  protected success(
    data: Record<string, unknown>,
    metadata?: Record<string, unknown>
  ): CommandResult {
    const cleanedData = this.stripEmpty(data);
    const result: CommandResult = { status: "success", data: cleanedData };
    if (metadata) result.metadata = metadata;
    return result;
  }

  /**
   * Recursively strip empty values from an object.
   * Removes: empty strings "", empty arrays [], null, undefined.
   * Preserves: false, 0, non-empty strings, non-empty arrays.
   */
  protected stripEmpty(obj: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip null and undefined
      if (value === null || value === undefined) continue;

      // Skip empty strings
      if (typeof value === "string" && value === "") continue;

      // Skip empty arrays
      if (Array.isArray(value) && value.length === 0) continue;

      // Recursively clean nested objects (but not arrays)
      if (typeof value === "object" && !Array.isArray(value)) {
        const cleaned = this.stripEmpty(value as Record<string, unknown>);
        // Only add if the cleaned object has properties
        if (Object.keys(cleaned).length > 0) {
          result[key] = cleaned;
        }
        continue;
      }

      // Recursively clean arrays of objects
      if (Array.isArray(value)) {
        const cleanedArray = value.map((item) => {
          if (typeof item === "object" && item !== null && !Array.isArray(item)) {
            return this.stripEmpty(item as Record<string, unknown>);
          }
          return item;
        });
        result[key] = cleanedArray;
        continue;
      }

      // Keep all other values (including false, 0, non-empty strings)
      result[key] = value;
    }

    return result;
  }

  /**
   * Return an error response.
   */
  protected error(
    type: string,
    message: string,
    suggestion?: string
  ): CommandResult {
    return {
      status: "error",
      error: {
        type,
        message,
        command: `${this.constructor.name}.${this.name}`,
        ...(suggestion && { suggestion }),
      },
    };
  }

  /**
   * Execute a function and return [result, durationMs].
   */
  protected async timedExecute<T>(
    fn: () => Promise<T>
  ): Promise<[T, number]> {
    const start = performance.now();
    const result = await fn();
    return [result, Math.round(performance.now() - start)];
  }

  /**
   * Read a file, return null if not found.
   */
  protected readFile(path: string): string | null {
    try {
      return readFileSync(path, "utf-8");
    } catch {
      return null;
    }
  }

  /**
   * Read multiple files, return {path: content} for existing files.
   */
  protected readFiles(paths: string[]): Record<string, string> {
    const result: Record<string, string> = {};
    for (const path of paths) {
      const content = this.readFile(path);
      if (content !== null) {
        result[path] = content;
      }
    }
    return result;
  }
}

