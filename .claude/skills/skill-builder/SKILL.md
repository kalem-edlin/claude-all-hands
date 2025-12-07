---
name: skill-builder
description: Use when creating new skills or updating existing skill files. Contains skill structure patterns, frontmatter requirements, progressive disclosure, and tool integration guidance.
---

# Skill Builder

Guide for constructing well-formed Claude Code skills.

## Required Structure

Every skill is a single .md file in `.claude/skills/` with YAML frontmatter:

```yaml
---
name: skill-name
description: What the skill does AND when to use it. Max 1024 chars.
---

# Skill content here
```

## Frontmatter Rules

| Field | Requirement |
|-------|-------------|
| `name` | Max 64 chars, lowercase-hyphenated |
| `description` | Max 1024 chars, must include WHEN to trigger |

**Critical**: Description guides model invocation. Include trigger keywords and use cases.

## Progressive Disclosure

Design for context efficiency:

1. **Metadata** (~200 chars): Name + description loaded at startup
2. **Body** (1-10KB): Main instructions, loaded when triggered
3. **Referenced URLs**: External docs, fetched on-demand via WebFetch

Keep body concise. Link to external docs for deep content.

## Content Organization

```markdown
---
name: example-skill
description: Use when [trigger]. Does [capability].
---

# Skill Name

Brief overview (2-3 sentences).

## Quick Reference
Essential patterns, commands, and tools available.

## Key Workflows
Step-by-step procedures.

## Deep Research
URLs for detailed documentation when needed.
```

## Available Tools for Skills

Skills can direct agents to use specific tools:

- **AskUserQuestion**: Structured user input with clickable options. Better than plain text for decisions - faster, clearer, fewer errors.
- **WebFetch**: Fetch external documentation on-demand.
- **Read/Glob/Grep**: Codebase analysis.

Mention relevant tools in Quick Reference when applicable to the skill's workflow.

## Human-in-Loop Patterns

For skills that benefit from user interaction, consider phased workflows with decision points:

1. **Gather**: Use AskUserQuestion to clarify requirements upfront
2. **Execute**: Perform the task
3. **Validate**: Check results before presenting
4. **Integrate**: Offer next steps based on user choice

AskUserQuestion is particularly valuable for:
- Type/category selection (what kind of thing to create)
- Source material clarification (what inputs user provides)
- Platform/target selection (where this will be used)
- Preference choices (customization options)

This creates a professional, guided experience vs free-form text exchanges.

## Scoping to Agents

Skills scoped via agent's `skills:` frontmatter:

```yaml
# .claude/agents/agent-name.md
---
skills:
  - skill-name
---
```

Only agents listing the skill load it.

## Good vs Bad Descriptions

**Good**:
```
Use when building agents, skills, hooks, or MCP configs. Contains Claude Code native feature documentation and structure patterns.
```

**Bad**:
```
Claude Code patterns.
```

Good descriptions tell WHEN (trigger conditions) and WHAT (capabilities).
