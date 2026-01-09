/**
 * xAI Grok API commands - X search for technology research.
 */

import { Command } from "commander";
import { BaseCommand, type CommandResult } from "./base.js";

const SYSTEM_PROMPT = `You are a technology research assistant. Search X (Twitter) for posts about the given technology, tool, or concept.

Find and synthesize:
- Developer opinions and experiences
- Comparisons with alternatives
- Common issues or gotchas
- Recent developments or announcements
- Community sentiment

Return a structured summary with key findings and notable posts.`;

const CHALLENGER_PROMPT = `You are a critical research challenger. Given research findings, search X to:

1. CHALLENGE: Find contradicting opinions, failed implementations, known issues
2. ALTERNATIVES: Surface newer/better tools the research may have missed
3. TRENDS: Identify emerging patterns that could affect the recommendations
4. SENTIMENT: Gauge real developer satisfaction vs marketing claims
5. DISCUSSIONS: Find where the best practitioners are discussing this topic

Be skeptical. Surface what the research missed or got wrong. Focus on recent posts (last 6 months).`;

interface XaiResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  citations?: string[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    reasoning_tokens?: number;
  };
  server_side_tool_usage?: {
    SERVER_SIDE_TOOL_X_SEARCH?: number;
  };
}

class XaiSearchCommand extends BaseCommand {
  readonly name = "search";
  readonly description = "Search X for technology opinions, alternatives, and community insights";

  defineArguments(cmd: Command): void {
    cmd
      .argument("<query>", "Technology/topic to research on X")
      .option("--context <context>", "Previous research findings to build upon")
      .option(
        "--results-to-challenge <results>",
        "Research results to challenge (enables challenger mode)"
      );
  }

  async execute(args: Record<string, unknown>): Promise<CommandResult> {
    const apiKey = process.env.X_AI_API_KEY;
    if (!apiKey) {
      return this.error("auth_error", "X_AI_API_KEY not set");
    }

    const query = args.query as string;
    const context = args.context as string | undefined;
    const resultsToChallenge = args.resultsToChallenge as string | undefined;

    // Determine mode and build prompt
    let systemPrompt: string;
    let userPrompt: string;

    if (resultsToChallenge) {
      systemPrompt = CHALLENGER_PROMPT;
      userPrompt = `Original query: ${query}

Research findings to challenge:
${resultsToChallenge}

Search X to challenge these findings.`;
    } else if (context) {
      systemPrompt = SYSTEM_PROMPT;
      userPrompt = `Previous research findings:
${context}

Now search X for additional insights about: ${query}

Focus on opinions, alternatives, and community discussions that complement the existing findings.`;
    } else {
      systemPrompt = SYSTEM_PROMPT;
      userPrompt = `Search X for developer opinions, experiences, and alternatives regarding: ${query}`;
    }

    try {
      const [response, durationMs] = await this.timedExecute(() =>
        this.callApi(apiKey, userPrompt, systemPrompt)
      );

      const content = response.choices?.[0]?.message?.content ?? "";
      const citations = response.citations ?? [];
      const usage = response.usage ?? {};
      const toolUsage = response.server_side_tool_usage ?? {};

      return this.success(
        {
          content,
          citations,
        },
        {
          model: "grok-4-1-fast",
          command: "xai search",
          duration_ms: durationMs,
          input_tokens: usage.prompt_tokens,
          output_tokens: usage.completion_tokens,
          reasoning_tokens: usage.reasoning_tokens,
          x_search_calls: toolUsage.SERVER_SIDE_TOOL_X_SEARCH ?? 0,
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
    userPrompt: string,
    systemPrompt: string
  ): Promise<XaiResponse> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "grok-4-1-fast",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      return (await response.json()) as XaiResponse;
    } finally {
      clearTimeout(timeout);
    }
  }
}

// Auto-discovered by cli.ts
export const COMMANDS = {
  search: XaiSearchCommand,
};

