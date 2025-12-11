#!/usr/bin/env python3
"""AllHands CLI entry point."""

import argparse
import sys
from pathlib import Path

from . import __version__
from .init import cmd_init
from .update import cmd_update
from .sync_back import cmd_sync_back


def main():
    parser = argparse.ArgumentParser(
        prog="allhands",
        description="Bidirectional sync for Claude Code framework",
    )
    parser.add_argument("--version", action="version", version=f"%(prog)s {__version__}")

    subparsers = parser.add_subparsers(dest="command", required=True)

    # init command
    init_parser = subparsers.add_parser("init", help="Initialize allhands in target repo")
    init_parser.add_argument("target", type=Path, help="Target repository path")
    init_parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompts")

    # update command
    update_parser = subparsers.add_parser("update", help="Pull latest from allhands")
    update_parser.add_argument("--yes", "-y", action="store_true", help="Skip confirmation prompts")

    # sync-back command
    sync_parser = subparsers.add_parser("sync-back", help="Sync changes back to allhands as PR")
    sync_parser.add_argument("--auto", action="store_true", help="Non-interactive mode (for hooks)")

    args = parser.parse_args()

    try:
        if args.command == "init":
            return cmd_init(args.target, auto_yes=args.yes)
        elif args.command == "update":
            return cmd_update(auto_yes=args.yes)
        elif args.command == "sync-back":
            return cmd_sync_back(auto=args.auto)
    except KeyboardInterrupt:
        print("\nAborted.", file=sys.stderr)
        return 130
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
