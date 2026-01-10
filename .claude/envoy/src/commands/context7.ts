/**
 * Context7 API commands - library documentation search and context retrieval.
 *
 * Flow: search (find library) → context (get docs for known library)
 */

import { Command } from "commander";
import { BaseCommand, type CommandResult } from "./base.js";
import { Context7, Context7Error, type Library } from "@upstash/context7-sdk";

/** Shared base for Context7 commands - DRY for auth + error handling */
abstract class Context7BaseCommand extends BaseCommand {
  protected requireApiKey(): CommandResult | Context7 {
    const apiKey = process.env.CONTEXT7_API_KEY;
    if (!apiKey) {
      return this.error("auth_error", "CONTEXT7_API_KEY not set");
    }
    return new Context7({ apiKey });
  }

  protected async withTimeout<T>(fn: () => Promise<T>): Promise<[T, number]> {
    const start = performance.now();
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("timeout")), this.timeoutMs)
    );
    const result = await Promise.race([fn(), timeout]);
    return [result, Math.round(performance.now() - start)];
  }

  protected handleError(e: unknown, extraHint?: string): CommandResult {
    if (e instanceof Context7Error) {
      return this.error("api_error", e.message, extraHint);
    }
    if (e instanceof Error && e.message.includes("timeout")) {
      return this.error("timeout", `Request timed out after ${this.timeoutMs}ms`);
    }
    return this.error("api_error", e instanceof Error ? e.message : String(e));
  }
}

class Context7SearchCommand extends Context7BaseCommand {
  readonly name = "search";
  readonly description = "Search for libraries by name, returns IDs for context command";

  defineArguments(cmd: Command): void {
    cmd
      .argument("<library>", "Library name to search (e.g., react, fastify)")
      .argument("[query]", "Optional query for relevance ranking")
      .option("--limit <n>", "Max results (default: 5)", parseInt);
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const clientOrError = this.requireApiKey();
    if ("status" in clientOrError) return clientOrError;

    const library = args.library as string;
    const query = (args.query as string) ?? `How to use ${library}`;
    const limit = (args.limit as number) ?? 5;

    try {
      const [libraries, durationMs] = await this.withTimeout(() =>
        clientOrError.searchLibrary(query, library)
      );

      if (!Array.isArray(libraries)) {
        return this.error("api_error", "Unexpected response format from Context7");
      }

      const results = libraries.slice(0, limit).map((lib: Library) => ({
        id: lib.id, // Required for context command
        name: lib.name,
        description: lib.description,
        snippets: lib.totalSnippets,
        trust: lib.trustScore,
      }));

      return this.success(
        {
          query: library,
          results,
          usage: results.length > 0
            ? `Use: envoy context7 context "${results[0].id}" "your question"`
            : undefined,
          ...(results.length === 0 && {
            suggestion: "Library not found. Try different search term or library may not be indexed.",
          }),
        },
        {
          result_count: results.length,
          command: "context7 search",
          duration_ms: durationMs,
        }
      );
    } catch (e) {
      return this.handleError(e);
    }
  }
}

class Context7ContextCommand extends Context7BaseCommand {
  readonly name = "context";
  readonly description = "Get documentation context for a known library (use search first)";

  defineArguments(cmd: Command): void {
    cmd
      .argument("<libraryId>", "Library ID from search (e.g., /facebook/react)")
      .argument("<query>", "What you need docs for (e.g., 'hooks usage')")
      .option("--text", "Return plain text instead of JSON (better for direct LLM use)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const clientOrError = this.requireApiKey();
    if ("status" in clientOrError) return clientOrError;

    const libraryId = args.libraryId as string;
    const query = args.query as string;
    const useText = args.text as boolean;

    try {
      if (useText) {
        // Plain text mode - directly usable in LLM prompts
        const [content, durationMs] = await this.withTimeout(() =>
          clientOrError.getContext(query, libraryId, { type: "txt" })
        );

        return this.success(
          {
            library: libraryId,
            query,
            content,
          },
          {
            format: "text",
            command: "context7 context",
            duration_ms: durationMs,
          }
        );
      }

      // JSON mode - structured docs
      const [docs, durationMs] = await this.withTimeout(() =>
        clientOrError.getContext(query, libraryId, { type: "json" })
      );

      if (!Array.isArray(docs)) {
        return this.error("api_error", "Unexpected response format from Context7");
      }

      const documentation = docs.map((doc) => ({
        title: doc.title,
        content: doc.content,
        source: doc.source,
      }));

      return this.success(
        {
          library: libraryId,
          query,
          docs: documentation,
        },
        {
          doc_count: documentation.length,
          command: "context7 context",
          duration_ms: durationMs,
        }
      );
    } catch (e) {
      return this.handleError(e, "Ensure libraryId is valid (from search results)");
    }
  }
}

export const COMMANDS = {
  search: Context7SearchCommand,
  context: Context7ContextCommand,
};
