#!/bin/bash
# Thin shim for UserPromptSubmit hook - pipes stdin to envoy
"$CLAUDE_PROJECT_DIR/.claude/envoy/envoy" plans capture
