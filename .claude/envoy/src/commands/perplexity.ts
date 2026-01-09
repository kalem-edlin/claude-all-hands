/**
 * Perplexity API commands.
 */

import { Command } from "commander";
import { BaseCommand, type CommandResult } from "./base.js";

interface PerplexityResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  citations?: string[];
}

class PerplexityResearchCommand extends BaseCommand {
  readonly name = "research";
  readonly description = "Deep research with citations, optional --grok-challenge to validate via X";

  protected override get timeoutMs(): number {
    // sonar-deep-research is slow, needs longer timeout
    return parseInt(process.env.PERPLEXITY_TIMEOUT_MS ?? "300000", 10);
  }

  defineArguments(cmd: Command): void {
    cmd
      .argument("<query>", "Research query")
      .option("--grok-challenge", "Challenge findings with Grok X search");
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const apiKey = process.env.PERPLEXITY_API_KEY;
    if (!apiKey) {
      return this.error("auth_error", "PERPLEXITY_API_KEY not set");
    }

    const query = args.query as string;
    const grokChallenge = args.grokChallenge as boolean | undefined;

    try {
      const [response, durationMs] = await this.timedExecute(() =>
        this.callApi(apiKey, query)
      );

      let content = response.choices?.[0]?.message?.content ?? "";
      // Remove <think> tags if present
      content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      const citations = response.citations ?? [];

      const researchData = { content, citations };
      const meta: Record<string, unknown> = {
        model: "sonar-deep-research",
        command: "perplexity research",
        duration_ms: durationMs,
      };

      if (!grokChallenge) {
        return this.success(researchData, meta);
      }

      // Chain to Grok challenger
      try {
        // Dynamic import to avoid circular dependency
        const { COMMANDS } = await import("./xai.js");
        const xaiCmd = new COMMANDS.search();
        const challengeResult = await xaiCmd.execute({
          query,
          resultsToChallenge: content,
        });

        const result: Record<string, unknown> = { research: researchData };
        if (challengeResult.status === "success") {
          result.challenge = challengeResult.data;
          meta.challenge_duration_ms = challengeResult.metadata?.duration_ms;
        } else {
          result.challenge = { error: challengeResult.error ?? "Unknown error" };
        }

        return this.success(result, meta);
      } catch (e) {
        // If xai module not available, return research without challenge
        return this.success(
          { research: researchData, challenge: { error: "xai module not available" } },
          meta
        );
      }
    } catch (e) {
      if (e instanceof Error && e.message.includes("timeout")) {
        return this.error("timeout", `Request timed out after ${this.timeoutMs}ms`);
      }
      return this.error("api_error", e instanceof Error ? e.message : String(e));
    }
  }

  private async callApi(apiKey: string, query: string): Promise<PerplexityResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch("https://api.perplexity.ai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "sonar-deep-research",
          messages: [{ role: "user", content: query }],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return (await response.json()) as PerplexityResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Auto-discovered by cli.ts
export const COMMANDS = {
  research: PerplexityResearchCommand,
};

