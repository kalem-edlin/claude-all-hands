#!/usr/bin/env python3
"""PreToolUse hook: intercept WebFetch → redirect to researcher agent."""
import json
import sys

data = json.load(sys.stdin)
url = data.get("tool_input", {}).get("url", "")

if not url:
    sys.exit(0)

# Exit code 2 with stderr - surfaces message in tool result
msg = f"""WebFetch blocked.

If you are the main agent: you MUST delegate to researcher agent.
If you are a subagent: use `.claude/envoy/envoy tavily extract "<url> <url> <url>..."` to fetch instead"""

print(msg, file=sys.stderr)
sys.exit(2)
