#!/usr/bin/env python3
"""claude-envoy: CLI for agent-scoped external tool access.

Commands are auto-discovered from the commands/ directory.
Each command module registers itself via COMMANDS dict.
"""

import argparse
import importlib
import json
import os
import sys
from pathlib import Path


def discover_commands() -> dict:
    """Auto-discover command modules from commands/ directory.

    Each module should have a COMMANDS dict mapping subcommand names to classes.
    Returns: {group: {subcommand: CommandClass}}
    """
    commands_dir = Path(__file__).parent / "commands"
    all_commands = {}

    for module_file in commands_dir.glob("*.py"):
        if module_file.name.startswith("_"):
            continue

        module_name = module_file.stem
        try:
            module = importlib.import_module(f"commands.{module_name}")
            if hasattr(module, "COMMANDS"):
                all_commands[module_name] = module.COMMANDS
        except ImportError as e:
            # Skip modules with missing dependencies
            print(f"Warning: Could not load {module_name}: {e}", file=sys.stderr)

    return all_commands


def build_parser(commands: dict) -> argparse.ArgumentParser:
    """Build argparse parser from discovered commands."""
    parser = argparse.ArgumentParser(
        prog="envoy",
        description="CLI for agent-scoped external tool access",
    )
    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    for group_name, subcommands in commands.items():
        group = subparsers.add_parser(group_name, help=f"{group_name.title()} tools")
        group_sub = group.add_subparsers(dest="subcommand")

        for subcmd_name, cmd_class in subcommands.items():
            cmd = cmd_class()
            subcmd = group_sub.add_parser(subcmd_name, help=cmd.description)
            cmd.add_arguments(subcmd)

    # Built-in info command
    subparsers.add_parser("info", help="Show available commands and API status")

    return parser


def run_command(args: argparse.Namespace, commands: dict) -> dict:
    """Route to appropriate command handler."""
    if args.command == "info":
        return get_info(commands)

    if args.command in commands:
        subcommands = commands[args.command]
        if args.subcommand in subcommands:
            cmd = subcommands[args.subcommand]()
            # Convert args namespace to dict, excluding command/subcommand
            kwargs = {k: v for k, v in vars(args).items() if k not in ("command", "subcommand")}
            return cmd.execute(**kwargs)

    return {"status": "error", "error": {"type": "invalid_command", "message": "Unknown command"}}


def get_info(commands: dict) -> dict:
    """Return info about available commands and API status."""
    cmd_list = ["info"]
    for group, subcommands in commands.items():
        for subcmd in subcommands:
            cmd_list.append(f"{group} {subcmd}")

    return {
        "status": "success",
        "data": {
            "version": "0.1.0",
            "commands": sorted(cmd_list),
            "api_keys": {
                "PERPLEXITY_API_KEY": "set" if os.environ.get("PERPLEXITY_API_KEY") else "missing",
                "TAVILY_API_KEY": "set" if os.environ.get("TAVILY_API_KEY") else "missing",
                "VERTEX_API_KEY": "set" if os.environ.get("VERTEX_API_KEY") else "missing",
            },
            "timeout_ms": os.environ.get("ENVOY_TIMEOUT_MS", "120000"),
        },
    }


def main():
    # Add commands directory to path
    sys.path.insert(0, str(Path(__file__).parent))

    commands = discover_commands()
    parser = build_parser(commands)
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    if args.command in commands and not getattr(args, "subcommand", None):
        parser.parse_args([args.command, "-h"])

    result = run_command(args, commands)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
