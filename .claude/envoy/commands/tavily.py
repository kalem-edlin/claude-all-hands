"""Tavily API commands - search and extract for agentic workflows."""
# pyright: reportAttributeAccessIssue=false 

import os
from typing import Optional

import requests
from .base import BaseCommand


class TavilySearchCommand(BaseCommand):
    """Web search with optional LLM answer."""

    name = "search"
    description = "Web search with optional LLM answer"

    def add_arguments(self, parser) -> None:
        parser.add_argument("query", help="Search query")
        parser.add_argument("--max-results", type=int, help="Max results (API default: 5, max: 20)")

    def execute(self, query: str, max_results: Optional[int] = None, **kwargs) -> dict:
        api_key = os.environ.get("TAVILY_API_KEY")
        if not api_key:
            return self.error("auth_error", "TAVILY_API_KEY not set")

        # include_answer=True by default, let API handle max_results default
        payload = {
            "query": query,
            "search_depth": "basic",
            "topic": "general",
            "include_answer": True,
        }
        if max_results is not None:
            payload["max_results"] = max_results

        try:
            response, duration_ms = self.timed_execute(self._call_api, api_key, payload)

            results = [
                {
                    "title": r.get("title"),
                    "url": r.get("url"),
                    "content": r.get("content"),
                    "score": r.get("score"),
                    "raw_content": r.get("raw_content"),
                }
                for r in response.get("results", [])
            ]

            return self.success(
                {
                    "query": response.get("query", query),
                    "answer": response.get("answer"),
                    "results": results,
                },
                {
                    "response_time": response.get("response_time"),
                    "result_count": len(results),
                    "command": "tavily search",
                    "duration_ms": duration_ms,
                },
            )

        except requests.exceptions.Timeout:
            return self.error("timeout", f"Request timed out after {self.timeout_ms}ms")
        except requests.exceptions.RequestException as e:
            return self.error("api_error", str(e))

    def _call_api(self, api_key: str, payload: dict) -> dict:
        response = requests.post(
            "https://api.tavily.com/search",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=self.timeout_ms / 1000,
        )
        response.raise_for_status()
        return response.json()


class TavilyExtractCommand(BaseCommand):
    """Extract content from URLs."""

    name = "extract"
    description = "Extract full content from URLs"

    def add_arguments(self, parser) -> None:
        parser.add_argument("urls", nargs="+", help="URLs to extract (max 20)")

    def execute(self, urls: list[str], **kwargs) -> dict:
        api_key = os.environ.get("TAVILY_API_KEY")
        if not api_key:
            return self.error("auth_error", "TAVILY_API_KEY not set")

        if len(urls) > 20:
            return self.error("invalid_input", "Maximum 20 URLs allowed")

        # Opinionated defaults: advanced depth for full content, markdown, no images
        payload = {
            "urls": urls,
            "extract_depth": "advanced",
            "format": "markdown",
            "include_images": False,
        }

        try:
            response, duration_ms = self.timed_execute(self._call_api, api_key, payload)

            results = [
                {
                    "url": r.get("url"),
                    "raw_content": r.get("raw_content"),
                    "images": r.get("images", []),
                }
                for r in response.get("results", [])
            ]

            failed = response.get("failed_results", [])

            return self.success(
                {"results": results, "failed_results": failed},
                {
                    "response_time": response.get("response_time"),
                    "success_count": len(results),
                    "failed_count": len(failed),
                    "command": "tavily extract",
                    "duration_ms": duration_ms,
                },
            )

        except requests.exceptions.Timeout:
            return self.error("timeout", f"Request timed out after {self.timeout_ms}ms")
        except requests.exceptions.RequestException as e:
            return self.error("api_error", str(e))

    def _call_api(self, api_key: str, payload: dict) -> dict:
        response = requests.post(
            "https://api.tavily.com/extract",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=self.timeout_ms / 1000,
        )
        response.raise_for_status()
        return response.json()


# Auto-discovered by envoy.py
COMMANDS = {
    "search": TavilySearchCommand,
    "extract": TavilyExtractCommand,
}
