"""xAI Grok API commands - X search for technology research."""

import os
from typing import Optional

import requests
from .base import BaseCommand


SYSTEM_PROMPT = """You are a technology research assistant. Search X (Twitter) for posts about the given technology, tool, or concept.

Find and synthesize:
- Developer opinions and experiences
- Comparisons with alternatives
- Common issues or gotchas
- Recent developments or announcements
- Community sentiment

Return a structured summary with key findings and notable posts."""


class XaiSearchCommand(BaseCommand):
    """Search X for technology insights using Grok with X Search tool."""

    name = "search"
    description = "Search X for technology opinions, alternatives, and community insights"

    def add_arguments(self, parser) -> None:
        parser.add_argument("query", help="Technology/topic to research on X")
        parser.add_argument("--context", help="Previous research findings to build upon")

    def execute(self, query: str, context: Optional[str] = None, **kwargs) -> dict:
        api_key = os.environ.get("X_AI_API_KEY")
        if not api_key:
            return self.error("auth_error", "X_AI_API_KEY not set")

        # Build prompt
        if context:
            user_prompt = f"""Previous research findings:
{context}

Now search X for additional insights about: {query}

Focus on opinions, alternatives, and community discussions that complement the existing findings."""
        else:
            user_prompt = f"Search X for developer opinions, experiences, and alternatives regarding: {query}"

        try:
            response, duration_ms = self.timed_execute(
                self._call_api, api_key, user_prompt
            )

            content = response["choices"][0]["message"]["content"]
            citations = response.get("citations", [])
            usage = response.get("usage", {})
            tool_usage = response.get("server_side_tool_usage", {})

            return self.success(
                {
                    "content": content,
                    "citations": citations,
                },
                {
                    "model": "grok-4-1-fast",
                    "command": "xai search",
                    "duration_ms": duration_ms,
                    "input_tokens": usage.get("prompt_tokens"),
                    "output_tokens": usage.get("completion_tokens"),
                    "reasoning_tokens": usage.get("reasoning_tokens"),
                    "x_search_calls": tool_usage.get("SERVER_SIDE_TOOL_X_SEARCH", 0),
                },
            )

        except requests.exceptions.Timeout:
            return self.error("timeout", f"Request timed out after {self.timeout_ms}ms")
        except requests.exceptions.RequestException as e:
            return self.error("api_error", str(e))
        except (KeyError, IndexError) as e:
            return self.error("parse_error", f"Unexpected response format: {e}")

    def _call_api(self, api_key: str, user_prompt: str) -> dict:
        response = requests.post(
            "https://api.x.ai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "grok-4-1-fast",
                "messages": [
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                "tools": [
                    {"type": "x_search"}
                ],
            },
            timeout=self.timeout_ms / 1000,
        )
        response.raise_for_status()
        return response.json()


COMMANDS = {
    "search": XaiSearchCommand,
}
