#!/bin/bash
# Local dev wrapper - uses tsx when ALLHANDS_PATH set, otherwise npx

if [ -n "$ALLHANDS_PATH" ]; then
  exec npx tsx "$ALLHANDS_PATH/src/cli.ts" "$@"
else
  exec npx claude-all-hands "$@"
fi
