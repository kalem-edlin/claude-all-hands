---
description: Slash command design and patterns - user-invoked workflows, dynamic context loading, tool restrictions.
---

# Slash Commands

## Overview

Slash commands provide user-accessible entry points into complex workflows. Unlike skills (which agents invoke), commands are user-facing prompts triggered via `/command-name`. They expand as prompts in the current conversation, enabling standardized workflow invocation.

## Key Decisions

- **Commands as workflow triggers**: Commands orchestrate multi-step processes. The /document command [ref:.claude/commands/document.md::1c0097c] triggers full documentation generation - branch setup, taxonomist delegation, parallel writers, validation, PR creation. One slash command, complex orchestration.

- **Dynamic context loading**: Commands can execute bash before prompt expansion using `!` prefix. The /continue command [ref:.claude/commands/continue.md::605e950] loads plan status via `!envoy plan check` so Claude understands current state without manual lookup.

- **Tool restrictions for safety**: Commands can limit which tools Claude uses via `allowed-tools` frontmatter. Git workflow commands restrict to specific git operations, preventing accidental destructive actions.

- **XML structure for clarity**: Command bodies use same XML structure as skills - `<objective>`, `<process>`, `<success_criteria>`. This provides consistent instruction format that Claude parses reliably.

## Patterns

**Argument handling**: Commands access user input via `$ARGUMENTS` (all args as string) or positional `$1`, `$2`, `$3`. The /create-specialist command [ref:.claude/commands/create-specialist.md::dbb53d3] uses `$ARGUMENTS` as initial context for the input gate.

**Input gates**: Complex commands gather requirements via AskUserQuestion before delegation. The /create-skill command [ref:.claude/commands/create-skill.md::dbb53d3] gates on goals, target agents, reference URLs, and directory scope before delegating to curator.

**Delegation contracts**: Commands define explicit INPUTS/OUTPUTS for subagent delegation. This enables deterministic handoffs where agents know exactly what they receive and must return.

## Use Cases

- **Documentation generation**: User runs `/document`. Command ensures clean git state, delegates to taxonomist for codebase analysis, spawns parallel writers, runs validation, creates PR. Single invocation handles entire workflow.

- **Artifact creation**: User runs `/create-specialist auth-expert`. Command creates branch, gathers requirements via input gate, delegates to curator for implementation, runs audit, manages testing and merge workflow.

- **Workflow continuation**: User runs `/continue`. Command checks plan status, gets next prompts, delegates to specialists, loops until complete, runs documentation extraction, creates PR.
