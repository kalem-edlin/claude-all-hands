#!/bin/bash

# Initialize claude-envoy (creates venv if needed)
"$CLAUDE_PROJECT_DIR/.claude/envoy/envoy" info > /dev/null 2>&1

# Check for active plan on current branch
branch=$(git branch --show-current 2>/dev/null)
if [ -n "$branch" ]; then
    if [ "$branch" = "main" ] || [ "$branch" = "master" ] || [ "$branch" = "develop" ] || [ "$branch" = "staging" ] || [ "$branch" = "production" ] || [[ "$branch" == quick/* ]]; then
        echo "Mode: Direct (no planning) - on $branch branch"
    else
        # Feature branch - ensure plan exists and get status
        result=$("$CLAUDE_PROJECT_DIR/.claude/envoy/envoy" plans create 2>/dev/null)
        status=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('data',{}).get('status',''))" 2>/dev/null)

        plan_id=$(echo "$branch" | sed 's/[^a-zA-Z0-9_-]/-/g')
        plan_file=".claude/plans/$plan_id/plan.md"

        # Reset deactivated status on new session
        if [ "$status" = "deactivated" ]; then
            "$CLAUDE_PROJECT_DIR/.claude/envoy/envoy" plans set-status draft > /dev/null 2>&1
            status="draft"
        fi

        if [ "$status" = "draft" ]; then
            echo "Plan status: draft (planning required)"
            echo "Plan file: $plan_file"
        elif [ "$status" = "active" ]; then
            echo "Plan status: active (implementing)"
            echo "Plan file: $plan_file"
        fi
    fi
fi

echo "You are the Main Agent - Main Agent Rules apply to you"