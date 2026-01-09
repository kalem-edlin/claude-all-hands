/**
 * Tavily API commands - search and extract for agentic workflows.
 */

import { Command } from "commander";
import { BaseCommand, type CommandResult } from "./base.js";

interface TavilySearchResult {
  title?: string;
  url?: string;
  content?: string;
  score?: number;
  raw_content?: string;
}

interface TavilySearchResponse {
  query?: string;
  answer?: string;
  results?: TavilySearchResult[];
  response_time?: number;
}

interface TavilyExtractResult {
  url?: string;
  raw_content?: string;
  images?: string[];
}

interface TavilyExtractResponse {
  results?: TavilyExtractResult[];
  failed_results?: unknown[];
  response_time?: number;
}

class TavilySearchCommand extends BaseCommand {
  readonly name = "search";
  readonly description = "Web search with optional LLM answer";

  defineArguments(cmd: Command): void {
    cmd
      .argument("<query>", "Search query")
      .option("--max-results <n>", "Max results (API default: 5, max: 20)", parseInt);
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return this.error("auth_error", "TAVILY_API_KEY not set");
    }

    const query = args.query as string;
    const maxResults = args.maxResults as number | undefined;

    const payload: Record<string, unknown> = {
      query,
      search_depth: "basic",
      topic: "general",
      include_answer: true,
    };

    if (maxResults !== undefined) {
      payload.max_results = maxResults;
    }

    try {
      const [response, durationMs] = await this.timedExecute(() =>
        this.callApi(apiKey, payload)
      );

      const results = (response.results ?? []).map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
        score: r.score,
        raw_content: r.raw_content,
      }));

      return this.success(
        {
          query: response.query ?? query,
          answer: response.answer,
          results,
        },
        {
          response_time: response.response_time,
          result_count: results.length,
          command: "tavily search",
          duration_ms: durationMs,
        }
      );
    } catch (e) {
      if (e instanceof Error && e.message.includes("timeout")) {
        return this.error("timeout", `Request timed out after ${this.timeoutMs}ms`);
      }
      return this.error("api_error", e instanceof Error ? e.message : String(e));
    }
  }

  private async callApi(
    apiKey: string,
    payload: Record<string, unknown>
  ): Promise<TavilySearchResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return (await response.json()) as TavilySearchResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

class TavilyExtractCommand extends BaseCommand {
  readonly name = "extract";
  readonly description = "Extract full content from URLs";

  defineArguments(cmd: Command): void {
    cmd.argument("<urls...>", "URLs to extract (max 20)");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const apiKey = process.env.TAVILY_API_KEY;
    if (!apiKey) {
      return this.error("auth_error", "TAVILY_API_KEY not set");
    }

    const urls = args.urls as string[];

    if (urls.length > 20) {
      return this.error("invalid_input", "Maximum 20 URLs allowed");
    }

    const payload = {
      urls,
      extract_depth: "advanced",
      format: "markdown",
      include_images: false,
    };

    try {
      const [response, durationMs] = await this.timedExecute(() =>
        this.callApi(apiKey, payload)
      );

      const results = (response.results ?? []).map((r) => ({
        url: r.url,
        raw_content: r.raw_content,
        images: r.images ?? [],
      }));

      const failed = response.failed_results ?? [];

      return this.success(
        { results, failed_results: failed },
        {
          response_time: response.response_time,
          success_count: results.length,
          failed_count: failed.length,
          command: "tavily extract",
          duration_ms: durationMs,
        }
      );
    } catch (e) {
      if (e instanceof Error && e.message.includes("timeout")) {
        return this.error("timeout", `Request timed out after ${this.timeoutMs}ms`);
      }
      return this.error("api_error", e instanceof Error ? e.message : String(e));
    }
  }

  private async callApi(
    apiKey: string,
    payload: Record<string, unknown>
  ): Promise<TavilyExtractResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch("https://api.tavily.com/extract", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return (await response.json()) as TavilyExtractResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Auto-discovered by cli.ts
export const COMMANDS = {
  search: TavilySearchCommand,
  extract: TavilyExtractCommand,
};

