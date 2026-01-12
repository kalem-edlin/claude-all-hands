#!/bin/bash
# Notification hook for elicitation dialogs (AskUserQuestion tool)

# Read stdin to get question info
input=$(cat)

# Send notification
"$CLAUDE_PROJECT_DIR/.claude/envoy/envoy" notify hook question "Question waiting for response" 2>/dev/null || true

# Always continue
echo '{"continue": true}'
