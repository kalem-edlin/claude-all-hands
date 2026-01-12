#!/usr/bin/env python3
"""PreToolUse hook: block claude-code-guide agent - delegate to curator instead."""
import json
import sys

data = json.load(sys.stdin)
tool_input = data.get("tool_input", {})

subagent_type = tool_input.get("subagent_type", "")
if subagent_type == "claude-code-guide":
    print(json.dumps({
        "hookSpecificOutput": {
            "hookEventName": "PreToolUse",
            "permissionDecision": "deny",
            "permissionDecisionReason": "claude-code-guide blocked. Delegate to curator agent for Claude Code guidance (hooks, skills, agents, commands, MCP, orchestration)."
        }
    }))
    sys.exit(0)

sys.exit(0)
