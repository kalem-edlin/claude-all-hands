---
name: claude-envoy-curation
description: Use when adding new external tool integrations to claude-envoy (replaces MCP servers). Contains command patterns and auto-discovery requirements.
---

<objective>
Extend claude-envoy with new commands for external tool integrations. claude-envoy replaces MCP servers as the standard way to connect Claude Code agents to external APIs and services.
</objective>

<quick_start>
1. Run `.claude/envoy/envoy info` to see current commands
2. Read `.claude/envoy/commands/base.py` for BaseCommand interface
3. Create new module in `.claude/envoy/commands/{group}.py`
4. Export via `COMMANDS = {"cmd": Class}` dict
5. Test with `.claude/envoy/envoy {group} {command} --help`
</quick_start>

<success_criteria>
- Command appears in `.claude/envoy/envoy info` output
- `--help` shows proper usage
- Returns valid JSON with `status` field
- Handles errors gracefully with `self.error()`
</success_criteria>

<constraints>
- All commands MUST output JSON to stdout
- Python 3.9 compat: use `Optional[]` not `|`, add `from __future__ import annotations`
- Opinionated defaults: minimize exposed params, hardcode sensible values
- No breaking changes to existing command signatures
</constraints>

<workflow>
## Architecture

```
.claude/envoy/
├── envoy              # Bash wrapper (auto-creates venv, loads .env)
├── envoy.py           # CLI with auto-discovery
├── commands/          # Command modules (auto-discovered)
│   ├── base.py        # BaseCommand class
│   └── {group}.py     # COMMANDS = {"cmd": Class, ...}
└── requirements.txt
```

## Adding a Command

### 1. Read existing patterns

```bash
# See current commands
.claude/envoy/envoy info

# Read base class
cat .claude/envoy/commands/base.py

# Read example module
cat .claude/envoy/commands/perplexity.py
```

### 2. Create or edit command module

In `.claude/envoy/commands/{group}.py`:

```python
from __future__ import annotations
from typing import Optional
from .base import BaseCommand

class MyCommand(BaseCommand):
    name = "mycommand"
    description = "What it does"

    def add_arguments(self, parser) -> None:
        parser.add_argument("query", help="Required arg")
        parser.add_argument("--optional", help="Optional flag")

    def execute(self, *, query: str, optional: Optional[str] = None, **kwargs) -> dict:
        # Implementation
        return self.success({"result": "..."})

# Auto-discovered by envoy.py
COMMANDS = {
    "mycommand": MyCommand,
}
```

### 3. Add dependencies

If new packages needed, add to `.claude/envoy/requirements.txt` and delete `.claude/envoy/.venv/` to trigger reinstall.
</workflow>

<validation>
## Testing

```bash
# Test command
.claude/envoy/envoy {group} {command} "test"

# Verify registration
.claude/envoy/envoy info

# Check help
.claude/envoy/envoy {group} {command} --help
```

## Checklist
- [ ] Command registered in `COMMANDS` dict
- [ ] `name` and `description` class attributes set
- [ ] `add_arguments()` defines CLI interface
- [ ] `execute()` returns `self.success()` or `self.error()`
- [ ] Dependencies added to requirements.txt if needed
</validation>

<examples>
## Base Command Helpers

```python
self.success(data, metadata=None)  # Return success response
self.error(type, message, suggestion=None)  # Return error response
self.read_file(path)  # Read file, returns None if not found
self.read_files(paths)  # Read multiple files
self.timed_execute(func, *args)  # Returns (result, duration_ms)
self.timeout_ms  # From ENVOY_TIMEOUT_MS env var
```

## Command Module Template

```python
from __future__ import annotations
from typing import Optional
from .base import BaseCommand

class SearchCommand(BaseCommand):
    name = "search"
    description = "Search external API"

    def add_arguments(self, parser) -> None:
        parser.add_argument("query", help="Search query")
        parser.add_argument("--max-results", type=int, default=5, help="Result limit")

    def execute(self, *, query: str, max_results: int = 5, **kwargs) -> dict:
        try:
            results = self._call_api(query, max_results)
            return self.success({"results": results})
        except Exception as e:
            return self.error("api_error", str(e))

COMMANDS = {
    "search": SearchCommand,
}
```
</examples>

<anti_patterns>
| Anti-Pattern | Problem | Correct Approach |
|--------------|---------|------------------|
| Print instead of return | Output not parseable | Always `return self.success()/self.error()` |
| Use `str \| None` syntax | Python 3.9 incompatible | Use `Optional[str]` with future annotations |
| Expose all API params | Overwhelming interface | Hardcode sensible defaults |
| Skip COMMANDS dict | Command not discovered | Always export via COMMANDS |
| Modify existing signatures | Breaks dependent skills | Add new params with defaults only |
</anti_patterns>
