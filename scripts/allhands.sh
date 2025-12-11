#!/bin/sh
# AllHands CLI - Shell wrapper entry point
# Usage: allhands <command> [args]

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PYTHONPATH="$SCRIPT_DIR" exec python3 -m allhands "$@"
