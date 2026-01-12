---
description: How agents, skills, and commands compose - delegation flows, context management, parallel execution.
---

# Composition Patterns

## Overview

The orchestration system composes three primitives: agents (isolated execution contexts), skills (domain expertise modules), and commands (user workflow triggers). Understanding how these compose enables building complex workflows from simple components.

## Key Decisions

- **Commands trigger, agents execute**: Commands define workflow structure; agents perform work. /document command orchestrates flow; documentation-taxonomist [ref:.claude/agents/documentation-taxonomist.md::447cbc9] and documentation-writer [ref:.claude/agents/documentation-writer.md::1c0097c] agents do actual analysis and writing. This separation enables reusing agents across different command workflows.

- **Skills inject expertise at runtime**: Agent declares skill dependencies in frontmatter. When agent runs, skills get loaded into context. Curator doesn't duplicate hook knowledge - it declares `skills: hooks-development` and gains that expertise on demand.

- **Main agent as orchestrator**: Main agent never performs domain work directly. It routes to specialists, manages delegation contracts, handles user interaction. This prevents context pollution where discovery/planning artifacts leak into implementation.

- **Parallel execution for throughput**: Documentation system runs up to 15 writer agents in parallel. Taxonomist ensures non-overlapping output directories so agents don't conflict. Single message with multiple Task tool calls for parallel dispatch.

## Patterns

**Layered delegation**: Command → Main Agent → Specialist → Skill. Each layer adds specificity. /audit-docs command defines workflow, main agent parses args and gates decisions, documentation-writer agents execute with /skills-development loaded for reference format knowledge.

**Context triad**: Delegation follows minimal returns, focused inputs, bulk to storage. Agents don't dump large context back to caller - they write to files and return confirmation. This prevents context explosion in multi-agent workflows.

**Iterative refinement loops**: Commands support feedback cycles. /create-skill runs curator create, then curator audit, then user testing, then feedback loop back to amendments if needed. Workflow continues until user approves.

**Branch-based isolation**: Artifact creation commands create dedicated branches (curator/, docs/). This isolates work from main branch, enables clean PR workflow, prevents incomplete work from polluting main.

## Technologies

**Task tool**: Claude Code's subagent dispatch mechanism. Agents declare tool access in frontmatter; Task tool provides isolated execution context with those tools available.

**envoy CLI**: Custom tooling bridging Claude Code to external capabilities. Handles research tools, git operations, documentation validation, plan management. Self-documenting via help commands.

## Use Cases

- **Full documentation flow**: /document → taxonomist init (analyze codebase, create structure) → parallel writers (create docs) → taxonomist confirm (audit coverage, write READMEs) → validation → commit → PR. Multiple agents, coordinated via command workflow.

- **Specialist creation with research**: /create-specialist → input gate (gather requirements) → curator create (with research-tools skill loaded for best practices lookup) → curator audit → user testing → merge. Skills provide research capability to curator without duplicating that knowledge.

- **Plan implementation**: /continue → get next prompts → parallel delegation to specialists (each with relevant skills loaded) → loop until done → documentation extraction → audit → completion. Complex multi-phase workflow orchestrated by single command.
