#!/usr/bin/env python3
"""PreToolUse hook: block WebSearch for non-research agents."""
import sys

# Exit code 2 with stderr - surfaces message to subagents in tool result
print("WebSearch not allowed - if you are the main agent, you MUST delegate to researcher agent, if you are a subagent, you MUST respond to main agent to have researcher search", file=sys.stderr)
sys.exit(2)
