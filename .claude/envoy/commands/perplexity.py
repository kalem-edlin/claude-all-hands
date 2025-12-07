"""Perplexity API commands."""

import os
import requests
from .base import BaseCommand


class PerplexityResearchCommand(BaseCommand):
    """Deep research with citations using sonar-deep-research."""

    name = "research"
    description = "Deep research with citations"

    def add_arguments(self, parser) -> None:
        parser.add_argument("query", help="Research query")

    def execute(self, query: str, **kwargs) -> dict:
        api_key = os.environ.get("PERPLEXITY_API_KEY")
        if not api_key:
            return self.error("auth_error", "PERPLEXITY_API_KEY not set")

        try:
            response, duration_ms = self.timed_execute(
                self._call_api, api_key, query
            )

            content = response["choices"][0]["message"]["content"]
            # Always strip thinking to minimize context
            import re
            content = re.sub(r"<think>[\s\S]*?</think>", "", content).strip()

            citations = response.get("citations", [])

            return self.success(
                {"content": content, "citations": citations},
                {"model": "sonar-deep-research", "command": "perplexity research", "duration_ms": duration_ms},
            )

        except requests.exceptions.Timeout:
            return self.error("timeout", f"Request timed out after {self.timeout_ms}ms")
        except requests.exceptions.RequestException as e:
            return self.error("api_error", str(e))
        except (KeyError, IndexError) as e:
            return self.error("parse_error", f"Unexpected response format: {e}")

    def _call_api(self, api_key: str, query: str) -> dict:
        response = requests.post(
            "https://api.perplexity.ai/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "sonar-deep-research",
                "messages": [{"role": "user", "content": query}],
            },
            timeout=self.timeout_ms / 1000,
        )
        response.raise_for_status()
        return response.json()


# Auto-discovered by envoy.py
COMMANDS = {
    "research": PerplexityResearchCommand,
}
