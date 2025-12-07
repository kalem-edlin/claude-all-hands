#!/bin/bash

echo "Loading Claude Code at: $CLAUDE_PROJECT_DIR"

# Initialize claude-envoy (creates venv if needed)
"$CLAUDE_PROJECT_DIR/.claude/envoy/envoy" info > /dev/null 2>&1 && echo "claude-envoy ready"