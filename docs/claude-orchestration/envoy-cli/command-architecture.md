---
description: Command architecture using auto-discovery, BaseCommand abstraction, and Commander.js registration for unified CLI interface with instrumented execution.
---

# Command Architecture

## Overview

Envoy CLI uses auto-discovery to load command modules at runtime. This eliminates manual registration and enables modular command organization. Commands extend a base class providing standardized result formatting, observability instrumentation, and error handling.

## Key Decisions

- **Auto-discovery over manual registration**: Commands are discovered from filesystem at startup [ref:.claude/envoy/src/commands/index.ts:discoverCommands:0ebeacb]. Reduces boilerplate, prevents registration drift, enables isolated command development.

- **BaseCommand abstraction**: All commands inherit from BaseCommand [ref:.claude/envoy/src/commands/base.ts::e99bf1f]. Provides consistent result structure (success/error), automatic observability logging, and helper methods for file operations.

- **JSON-only output**: Every command returns structured JSON. Enables reliable parsing by consuming agents, consistent error surfaces, machine-readable results for automation.

- **Commander.js for CLI routing**: Leverages mature CLI framework [ref:.claude/envoy/src/cli.ts::e99bf1f]. Handles argument parsing, help generation, subcommand routing without custom parsing logic.

- **Command groups via directory structure**: Top-level directories become command groups (oracle, plan, docs). Single files become simple command groups. Directory modules use index.ts barrel exports.

- **COMMANDS dict convention**: Each module exports COMMANDS mapping subcommand names to classes. Discovery inspects this dict to register all subcommands.

## Patterns

Commands define arguments via defineArguments() method receiving Commander instance. Execute() receives parsed args as key-value object. BaseCommand's executeWithLogging() wraps execute() with timing and observability.

Result format: {status: "success"|"error", data?: {...}, error?: {type, message, suggestion}, metadata?: {...}}. Success() and error() helpers enforce structure. stripEmpty() removes null/empty values from responses to reduce noise.

## Use Cases

- Agent invokes envoy command, receives structured JSON response
- New command added by creating file in commands/, exporting COMMANDS dict
- Error surfacing: type + message + suggestion enables agent recovery
- Observability: every command logged with timing, args, agent name for debugging
