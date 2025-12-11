#!/bin/sh
# Warn about changes that will sync to claude-all-hands on merge
# This hook runs in TARGET repos only (where .allhandsignore exists)

# Only run if this is a target repo (has .allhandsignore)
if [ ! -f ".allhandsignore" ]; then
    exit 0
fi

# Get staged files in managed directories
MANAGED_CHANGES=$(git diff --cached --name-only | grep -E '^(\.claude/|\.husky/|CLAUDE\.md)' || true)

if [ -z "$MANAGED_CHANGES" ]; then
    exit 0
fi

# Use Python CLI for reliable pattern matching (handles ** and spaces correctly)
# shellcheck disable=SC2086
SYNC_FILES=$(echo $MANAGED_CHANGES | xargs python3 -m allhands check-ignored 2>/dev/null || echo $MANAGED_CHANGES)

if [ -z "$SYNC_FILES" ]; then
    exit 0
fi

# Format for display
SYNC_FILES_FORMATTED=""
for file in $SYNC_FILES; do
    SYNC_FILES_FORMATTED="$SYNC_FILES_FORMATTED
  → $file"
done

if [ -z "$(echo "$SYNC_FILES_FORMATTED" | tr -d '[:space:]')" ]; then
    exit 0
fi

# Show warning
echo ""
echo "┌────────────────────────────────────────────────────────────────┐"
echo "│  ⚠️  CLAUDE-ALL-HANDS SYNC WARNING                              │"
echo "├────────────────────────────────────────────────────────────────┤"
echo "│  These changes will sync to claude-all-hands on merge:        │"
echo "└────────────────────────────────────────────────────────────────┘"
echo "$SYNC_FILES_FORMATTED"
echo ""
echo "────────────────────────────────────────────────────────────────"
echo "  If these are TARGET-SPECIFIC, add to .allhandsignore before commit"
echo "  If these are FRAMEWORK IMPROVEMENTS, proceed with commit"
echo "────────────────────────────────────────────────────────────────"
echo ""

# Don't block - just warn
exit 0
