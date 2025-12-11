---
name: claude-envoy-usage
description: Use when building skills that need external tool access (APIs, LLMs, web). claude-envoy replaces MCP servers with agent-scoped integrations.
---

<objective>
Access external tools via claude-envoy. Self-documenting system - discover available commands dynamically before use.
</objective>

<quick_start>
```bash
# Discover available commands
.claude/envoy/envoy info

# Get help for command group
.claude/envoy/envoy <group> --help

# Get help for specific command
.claude/envoy/envoy <group> <command> --help
```
</quick_start>

<success_criteria>
- Commands discovered via `envoy info` before use
- JSON response parsed correctly (`status`, `data` fields)
- File contents passed via envoy (not loaded into Claude context)
</success_criteria>

<constraints>
- Always discover commands dynamically - don't assume availability
- All commands return JSON: `{"status": "success|error", "data": {...}}`
</constraints>

<workflow>
### Integration Process
1. Run `.claude/envoy/envoy info` to see available command groups
2. Run `--help` on relevant commands to learn arguments
3. Include specific invocations in skill workflow sections
4. Parse JSON response - all commands return `{"status": "success|error", "data": {...}}`

### Context Preservation
envoy reads files directly and passes to external LLMs. Claude only receives JSON output, keeping file contents out of context window.

### When to Extend
If needed functionality doesn't exist, use the `claude-envoy-curation` skill to add new commands.
</workflow>
