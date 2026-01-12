---
description: SKILL.md format and skill invocation model - modular domain expertise, router patterns, progressive disclosure.
---

# Skill System

## Overview

Skills are filesystem-based capability modules. When invoked, Claude reads SKILL.md and gains domain expertise. This enables knowledge sharing across agents without duplicating instructions. Skills solve the problem of encoding specialized knowledge that multiple agents need access to.

## Key Decisions

- **SKILL.md always loaded**: When skill is invoked, SKILL.md is guaranteed to be read. Essential principles go there - cannot be skipped. Workflow-specific content lives in subdirectories, loaded only when relevant. This is progressive disclosure for token efficiency.

- **Router pattern for complex skills**: Complex skills [ref:.claude/skills/skills-development/SKILL.md::4dcde68] use intake/routing structure. SKILL.md asks "what do you want to do?" then routes to specific workflow file. Keeps main file under 500 lines while enabling deep capability.

- **Pure XML structure**: Skills use semantic XML tags, not markdown headings. This provides better parsing and enables consistent section extraction. Tags like `<objective>`, `<process>`, `<success_criteria>` create predictable structure.

- **Directory convention enforces organization**: Skills live in `.claude/skills/<skill-name>/SKILL.md`. Subdirectories follow purpose: `workflows/` for procedures, `references/` for domain knowledge, `templates/` for output structures, `scripts/` for executable code.

## Patterns

**Progressive loading**: Router skills load minimal context initially, then pull specific references as needed. The hooks-development skill [ref:.claude/skills/hooks-development/SKILL.md::4dcde68] loads core hook concepts in SKILL.md, routes to workflow, workflow specifies which reference files to read for that specific task.

**Skill composition**: Agents declare multiple skills in frontmatter. Curator has `skills: claude-code-patterns, research-tools, skills-development, subagents-development, hooks-development, commands-development`. This gives broad capability without cramming everything into one prompt.

**Template vs reference distinction**: Templates are fill-in-the-blank output structures - copy and customize. References are read-only domain knowledge - learn from but don't copy directly. This distinction matters for how Claude uses the content.

## Technologies

**YAML frontmatter**: Required fields are `name` (must match directory) and `description` (what skill does AND when to use it). Description is critical for skill discoverability and auto-loading decisions.

## Use Cases

- **Creating new hook**: User wants session notification. Curator invokes /hooks-development skill, skill routes to create workflow, workflow pulls hook-types.md and examples.md references, guides through configuration.

- **Domain expertise injection**: Documentation-writer needs to understand subagent patterns before documenting them. Writer's assigned skills get auto-loaded, providing necessary context without manual lookup.

- **Standardized outputs**: Creating a new agent file. Skills-development skill provides templates for simple vs router skills, ensuring consistent structure across all new skills.
