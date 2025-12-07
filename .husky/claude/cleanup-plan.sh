#!/bin/sh
# Clean up plan directory for merged branch
# Called from post-merge hook

. "$(dirname "$0")/common.sh"

# Get the branch that was just merged (from reflog)
merged_branch=$(git reflog -1 2>/dev/null | grep -oE 'merge [^:]+' | sed 's/merge //' || echo "")

if [ -n "$merged_branch" ]; then
    plan_dir=".claude/plans/$(sanitize_branch "$merged_branch")"
    if [ -d "$plan_dir" ]; then
        rm -r "$plan_dir"
        echo "Cleaned up plan directory: $plan_dir"
    fi
fi
