"""Vertex AI (Gemini) commands."""

from __future__ import annotations

import json
import os
import re
import subprocess
from pathlib import Path
from typing import Optional

from .base import BaseCommand


class VertexAskCommand(BaseCommand):
    """Raw Gemini inference - thin wrapper, no system prompt."""

    name = "ask"
    description = "Raw Gemini inference"

    def add_arguments(self, parser) -> None:
        parser.add_argument("query", help="Query for Gemini")
        parser.add_argument("--files", nargs="+", help="Files to include as context")
        parser.add_argument("--context", help="Additional context")
        parser.add_argument("--model", default="gemini-2.0-flash", help="Model to use")

    def execute(
        self,
        *,
        query: str,
        model: str = "gemini-2.0-flash",
        files: Optional[list[str]] = None,
        context: Optional[str] = None,
        **kwargs,
    ) -> dict:
        api_key = os.environ.get("VERTEX_API_KEY")
        if not api_key:
            return self.error("auth_error", "VERTEX_API_KEY not set")

        parts = []
        if context:
            parts.append(context)
        if files:
            file_contents = self.read_files(files)
            if file_contents:
                file_context = "\n\n".join(f"### {path}\n```\n{content}\n```" for path, content in file_contents.items())
                parts.append(file_context)
        parts.append(query)
        prompt = "\n\n".join(parts)

        try:
            response, duration_ms = self.timed_execute(self._call_api, api_key, model, prompt)
            return self.success(
                {"content": response},
                {"model": model, "command": "vertex ask", "duration_ms": duration_ms},
            )
        except Exception as e:
            return self.error("api_error", str(e))

    def _call_api(self, api_key: str, model: str, prompt: str) -> str:
        from google import genai

        client = genai.Client(vertexai=True, api_key=api_key)
        response = client.models.generate_content(model=model, contents=prompt)
        return response.text


class VertexValidateCommand(BaseCommand):
    """Validate plan against user requirements."""

    name = "validate"
    description = "Validate plan against requirements (anti-overengineering)"

    SYSTEM_PROMPT = """You are a plan validator ensuring implementations are NOT over-engineered.

Given user requirements and a proposed plan, evaluate:
- Does plan exceed what user actually asked for?
- Are there unnecessary abstractions/features?
- Is complexity justified by requirements?

Output JSON:
{
  "verdict": "approved" | "needs_simplification" | "needs_clarification",
  "issues": [{"section": "string", "problem": "string", "suggestion": "string"}],
  "questions_for_user": ["string"],
  "recommended_edits": [{"section": "string", "current": "string", "proposed": "string"}]
}"""

    def add_arguments(self, parser) -> None:
        parser.add_argument("--plan", required=True, help="Plan file or directory path")
        parser.add_argument("--queries", help="Queries file path (optional)")
        parser.add_argument("--context", help="Additional context")

    def execute(self, *, plan: str, queries: Optional[str] = None, context: Optional[str] = None, **kwargs) -> dict:
        api_key = os.environ.get("VERTEX_API_KEY")
        if not api_key:
            return self.error("auth_error", "VERTEX_API_KEY not set")

        plan_path = Path(plan)
        if plan_path.is_dir():
            plan_file = plan_path / "plan.md"
            queries_file = queries or plan_path / "queries.jsonl"
        else:
            plan_file = plan_path
            queries_file = queries

        plan_content = self.read_file(str(plan_file))
        if not plan_content:
            return self.error("file_not_found", f"Plan file not found: {plan_file}")

        queries_content = ""
        if queries_file and Path(queries_file).exists():
            with open(queries_file) as f:
                queries_list = [json.loads(line).get("prompt", "") for line in f if line.strip()]
            queries_content = "\n".join(f"- {q}" for q in queries_list)

        additional = f"\n\n## Additional Context\n{context}" if context else ""
        full_prompt = f"""{self.SYSTEM_PROMPT}

## User Requirements/Queries
{queries_content or "(No queries captured)"}

## Plan
{plan_content}
{additional}

Respond with JSON only."""

        try:
            response, duration_ms = self.timed_execute(self._call_api, api_key, full_prompt)
            parsed = self._parse_json_response(response)
            return self.success(parsed, {"command": "vertex validate", "duration_ms": duration_ms})
        except Exception as e:
            return self.error("api_error", str(e))

    def _call_api(self, api_key: str, prompt: str) -> str:
        from google import genai

        client = genai.Client(vertexai=True, api_key=api_key)
        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        return response.text

    def _parse_json_response(self, response: str) -> dict:
        json_match = re.search(r"\{[\s\S]*\}", response)
        if json_match:
            return json.loads(json_match.group())
        return {"raw_response": response}


class VertexReviewCommand(BaseCommand):
    """Review implementation against plan."""

    name = "review"
    description = "Review implementation against plan (uses git diff)"

    SYSTEM_PROMPT = """You are an implementation reviewer.

Given a plan and git diff of changes, evaluate:
- Does implementation match plan intent?
- Are there deviations that need addressing?
- Code quality issues?

Output JSON:
{
  "step_reviewed": int | null,
  "verdict": "approved" | "needs_work" | "off_track",
  "plan_adherence": {"on_track": true/false, "deviations": ["string"]},
  "issues": [{"file": "string", "line": int, "severity": "string", "issue": "string", "suggestion": "string"}],
  "approved_steps": [int],
  "questions_for_user": ["string"]
}"""

    def add_arguments(self, parser) -> None:
        parser.add_argument("--plan", required=True, help="Plan file or directory path")
        parser.add_argument("--last-commit", action="store_true", help="Diff against last commit instead of main")
        parser.add_argument("--context", help="Additional context")

    def execute(self, *, plan: str, last_commit: bool = False, context: Optional[str] = None, **kwargs) -> dict:
        api_key = os.environ.get("VERTEX_API_KEY")
        if not api_key:
            return self.error("auth_error", "VERTEX_API_KEY not set")

        plan_path = Path(plan)
        plan_file = plan_path / "plan.md" if plan_path.is_dir() else plan_path
        plan_content = self.read_file(str(plan_file))
        if not plan_content:
            return self.error("file_not_found", f"Plan file not found: {plan_file}")

        diff_ref = "HEAD~1" if last_commit else "main"
        diff_result = subprocess.run(["git", "diff", diff_ref], capture_output=True, text=True)

        # Fallback to empty tree if ref doesn't exist (fresh repo)
        if diff_result.returncode != 0:
            empty_tree = "4b825dc642cb6eb9a060e54bf8d69288fbee4904"  # git's empty tree hash
            diff_ref = "empty tree"
            diff_result = subprocess.run(["git", "diff", empty_tree], capture_output=True, text=True)
            if diff_result.returncode != 0:
                return self.error("git_error", f"Failed to get diff: {diff_result.stderr}")

        diff_content = diff_result.stdout or "(No changes)"

        additional = f"\n\n## Additional Context\n{context}" if context else ""
        full_prompt = f"""{self.SYSTEM_PROMPT}

## Plan
{plan_content}

## Git Diff (against {diff_ref})
```diff
{diff_content}
```
{additional}

Respond with JSON only."""

        try:
            response, duration_ms = self.timed_execute(self._call_api, api_key, full_prompt)
            parsed = self._parse_json_response(response)
            return self.success(parsed, {"command": "vertex review", "duration_ms": duration_ms})
        except Exception as e:
            return self.error("api_error", str(e))

    def _call_api(self, api_key: str, prompt: str) -> str:
        from google import genai

        client = genai.Client(vertexai=True, api_key=api_key)
        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        return response.text

    def _parse_json_response(self, response: str) -> dict:
        json_match = re.search(r"\{[\s\S]*\}", response)
        if json_match:
            return json.loads(json_match.group())
        return {"raw_response": response}


class VertexArchitectCommand(BaseCommand):
    """Solutions architecture guidance."""

    name = "architect"
    description = "Solutions architecture for complex features"

    SYSTEM_PROMPT = """You are a solutions architect for complex software systems.

Given a feature request and optional codebase context:
1. Identify architectural decisions needed
2. Propose approaches with trade-offs
3. Recommend implementation strategy
4. Flag risks and unknowns

Output JSON:
{
  "complexity_assessment": "simple" | "moderate" | "complex" | "system_integration",
  "architectural_decisions": [{
    "decision": "string",
    "options": [{"option": "string", "pros": ["string"], "cons": ["string"]}],
    "recommendation": "string",
    "rationale": "string"
  }],
  "implementation_strategy": {
    "approach": "string",
    "phases": [{"phase": "string", "deliverables": ["string"]}],
    "dependencies": ["string"]
  },
  "risks": [{"risk": "string", "mitigation": "string", "severity": "low"|"medium"|"high"}],
  "questions_for_user": ["string"]
}"""

    def add_arguments(self, parser) -> None:
        parser.add_argument("query", help="Feature/system description")
        parser.add_argument("--files", nargs="+", help="Relevant code files")
        parser.add_argument("--context", help="Additional context or constraints")

    def execute(self, *, query: str, files: Optional[list[str]] = None, context: Optional[str] = None, **kwargs) -> dict:
        api_key = os.environ.get("VERTEX_API_KEY")
        if not api_key:
            return self.error("auth_error", "VERTEX_API_KEY not set")

        file_context = ""
        if files:
            file_contents = self.read_files(files)
            if file_contents:
                file_context = "\n\n## Existing Code\n" + "\n\n".join(
                    f"### {path}\n```\n{content}\n```" for path, content in file_contents.items()
                )

        additional = f"\n\n## Additional Context\n{context}" if context else ""

        full_prompt = f"""{self.SYSTEM_PROMPT}

## Feature Request
{query}
{file_context}
{additional}

Respond with JSON only."""

        try:
            response, duration_ms = self.timed_execute(self._call_api, api_key, full_prompt)
            parsed = self._parse_json_response(response)
            return self.success(parsed, {"command": "vertex architect", "duration_ms": duration_ms})
        except Exception as e:
            return self.error("api_error", str(e))

    def _call_api(self, api_key: str, prompt: str) -> str:
        from google import genai

        client = genai.Client(vertexai=True, api_key=api_key)
        response = client.models.generate_content(model="gemini-2.0-flash", contents=prompt)
        return response.text

    def _parse_json_response(self, response: str) -> dict:
        json_match = re.search(r"\{[\s\S]*\}", response)
        if json_match:
            return json.loads(json_match.group())
        return {"raw_response": response}


COMMANDS = {
    "ask": VertexAskCommand,
    "validate": VertexValidateCommand,
    "review": VertexReviewCommand,
    "architect": VertexArchitectCommand,
}
