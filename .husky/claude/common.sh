#!/bin/sh
# Shared utilities for claude-related git hooks

# Sanitize branch name for plan directory (feat/auth -> feat-auth)
sanitize_branch() {
    echo "$1" | sed 's/[^a-zA-Z0-9_-]/-/g'
}

# Get current branch name
get_branch() {
    git branch --show-current 2>/dev/null || echo "detached"
}

# Get plan directory for current branch
get_plan_dir() {
    echo ".claude/plans/$(sanitize_branch "$(get_branch)")"
}
