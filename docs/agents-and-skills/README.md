---
description: Architecture and usage patterns for Claude Code agents and skills. Covers agent roles, skill taxonomy, and orchestration patterns.
---

# Agents and Skills

## Overview

This project implements a multi-agent orchestration system for Claude Code. Agents are specialized Claude instances with focused roles, while skills provide modular domain expertise that agents can leverage.

## Key Concepts

- **Agents**: Markdown files (`.claude/agents/*.md`) that define specialized Claude instances with YAML frontmatter (name, description, tools, model, skills) and XML-structured system prompts
- **Skills**: Filesystem-based capability modules (`.claude/skills/**/SKILL.md`) providing domain expertise with optional workflows, references, templates, and scripts
- **Orchestration**: Main agent routes tasks to specialists based on description field matching; discovery agents gather context, implementation agents execute changes
- **Context Efficiency**: Agents minimize context return to caller; bulk data written to plan files, not returned directly

## Architecture

```
.claude/
├── agents/                    # Agent definitions
│   ├── curator.md            # Orchestration infrastructure expert
│   ├── planner.md            # Plan/prompt creation specialist
│   ├── researcher.md         # External research via web APIs
│   ├── surveyor.md           # Generic codebase discovery
│   ├── worker.md             # Generic implementation
│   ├── code-simplifier.md    # Code refinement specialist
│   ├── documentation-taxonomist.md  # Doc segmentation planner
│   └── documentation-writer.md      # Doc creation specialist
│
└── skills/                    # Skill packages
    ├── claude-code-patterns/  # Official Claude Code docs reference
    ├── git-ops/               # Git workflow standardization
    ├── orchestration-idols/   # External orchestration patterns
    ├── brainstorming/         # Collaborative design process
    ├── claude-envoy-patterns/ # Envoy command patterns
    ├── commands-development/  # Slash command creation
    ├── hooks-development/     # Hook configuration
    ├── research-tools/        # External research APIs
    ├── skills-development/    # Skill authoring (meta-skill)
    ├── subagents-development/ # Agent creation patterns
    ├── discovery-mode/        # Read-only analysis protocol
    ├── documentation-taxonomy/# Doc system reference
    └── implementation-mode/   # Prompt execution lifecycle
```

## Entry Points

- **Agent routing**: Main agent matches task description to agent's `description` field
- **Skill loading**: Agent's `skills:` frontmatter auto-loads skill SKILL.md at spawn
- **Commands**: `/agents` interactive interface for agent management
- **Configuration**: YAML frontmatter controls tools, model, permissions
