#!/bin/sh
# Warn about changes that will sync to claude-all-hands on merge
# This hook runs in TARGET repos only (where .allhandsignore exists)

# Only run if this is a target repo (has .allhandsignore)
if [ ! -f ".allhandsignore" ]; then
    exit 0
fi

# Use CLI to get actual files that differ from source (not just staged files)
SYNC_FILES=$(npx claude-all-hands sync-back --list 2>/dev/null || true)

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
