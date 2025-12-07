"""Base command class for claude-envoy commands.

To add a new command:
1. Create a new file in commands/ (e.g., myapi.py)
2. Subclass BaseCommand for each subcommand
3. Export a COMMANDS dict mapping subcommand names to classes

Example:
    class MySearchCommand(BaseCommand):
        name = "search"
        description = "Search something"

        def add_arguments(self, parser):
            parser.add_argument("query", help="Search query")

        def execute(self, query: str, **kwargs) -> dict:
            # Implementation
            return self.success({"results": [...]})

    COMMANDS = {"search": MySearchCommand}
"""

from __future__ import annotations

import os
import time
from abc import ABC, abstractmethod
from typing import Any, Optional


class BaseCommand(ABC):
    """Base class for all envoy commands."""

    name: str = ""
    description: str = ""

    @property
    def timeout_ms(self) -> int:
        return int(os.environ.get("ENVOY_TIMEOUT_MS", "120000"))

    @abstractmethod
    def add_arguments(self, parser) -> None:
        """Add command-specific arguments to the parser."""
        pass

    @abstractmethod
    def execute(self, **kwargs) -> dict:
        """Execute the command and return result dict."""
        pass

    def success(self, data: dict, metadata: Optional[dict] = None) -> dict:
        """Return a success response."""
        result = {"status": "success", "data": data}
        if metadata:
            result["metadata"] = metadata
        return result

    def error(self, error_type: str, message: str, suggestion: Optional[str] = None) -> dict:
        """Return an error response."""
        error_data = {
            "type": error_type,
            "message": message,
            "command": f"{self.__class__.__module__}.{self.name}",
        }
        if suggestion:
            error_data["suggestion"] = suggestion
        return {"status": "error", "error": error_data}

    def timed_execute(self, func, *args, **kwargs) -> tuple[Any, int]:
        """Execute a function and return (result, duration_ms)."""
        start = time.time()
        result = func(*args, **kwargs)
        duration_ms = int((time.time() - start) * 1000)
        return result, duration_ms

    def read_file(self, path: str) -> Optional[str]:
        """Read a file, return None if not found."""
        try:
            with open(path, "r") as f:
                return f.read()
        except FileNotFoundError:
            return None

    def read_files(self, paths: list[str]) -> dict[str, str]:
        """Read multiple files, return {path: content} for existing files."""
        result = {}
        for path in paths:
            content = self.read_file(path)
            if content is not None:
                result[path] = content
        return result
